<?php

declare(strict_types=1);

namespace Shopio\Tests\Feature;

use Shopio\Config\Config;
use Shopio\Database\Database;
use Shopio\Repositories\SellerDocumentRepository;
use Shopio\Tests\Support\Factory;
use Shopio\Tests\Support\TestApplication;
use Shopio\Tests\TestCase;

/**
 * Seller verification documents and server-side workspace preferences.
 *
 * The happy-path multipart upload is exercised against a real built-in server in
 * UploadTest; this class covers validation, ownership, listing and deletion.
 */
final class SellerDocumentTest extends TestCase
{
    private function db(): Database
    {
        return TestApplication::make(Database::class);
    }

    private function documents(): SellerDocumentRepository
    {
        return TestApplication::make(SellerDocumentRepository::class);
    }

    public function test_preferences_are_persisted_as_json_for_the_authenticated_seller(): void
    {
        $seller = Factory::seller();
        $token = $this->bearer($seller['user']);

        $this->assertStatus(200, $this->get('/api/v1/sellers/preferences', [], $token));

        $preferences = [
            'notifications' => [
                'newOrders' => true,
                'lowStock' => false,
                'reviews' => true,
            ],
            'orders' => [
                'handlingTime' => '1',
                'autoAccept' => 'yes',
                'confirmEmails' => true,
            ],
            'shipping' => [
                'carrier' => 'DHL',
                'freeThreshold' => '150000',
            ],
            'marketing_opt_in' => false,
        ];

        $response = $this->patchJson('/api/v1/sellers/preferences', [
            'preferences' => $preferences,
        ], $token);

        $this->assertStatus(200, $response);
        $this->assertSame($preferences, $response->dataArray());

        $reloaded = $this->get('/api/v1/sellers/preferences', [], $token);
        $this->assertStatus(200, $reloaded);
        $this->assertSame($preferences, $reloaded->dataArray());

        $row = $this->db()->selectOne(
            'SELECT preferences FROM seller_profiles WHERE id = :id',
            ['id' => (int) $seller['id']],
        );
        $decoded = json_decode((string) ($row['preferences'] ?? ''), true);
        $this->assertSame($preferences, $decoded);
    }

    public function test_preferences_require_a_seller_and_valid_keys(): void
    {
        $customer = Factory::user();

        $this->assertStatus(403, $this->patchJson('/api/v1/sellers/preferences', [
            'preferences' => ['notifications' => ['newOrders' => true]],
        ], $this->bearer($customer)));

        $seller = Factory::seller();
        $response = $this->patchJson('/api/v1/sellers/preferences', [
            'preferences' => ['Bad Key' => true],
        ], $this->bearer($seller['user']));

        $this->assertStatus(422, $response);
        $this->assertArrayHasKey('preferences', $response->errors());

        $empty = $this->patchJson('/api/v1/sellers/preferences', [
            'preferences' => [],
        ], $this->bearer($seller['user']));
        $this->assertStatus(422, $empty);
    }

    public function test_document_upload_requires_a_file_and_a_valid_document_type(): void
    {
        $seller = Factory::seller();
        $token = $this->bearer($seller['user']);

        $missingFile = $this->request('POST', '/api/v1/sellers/documents', [
            'headers' => $token,
            'form' => ['document_type' => 'business_licence'],
        ]);
        $this->assertStatus(422, $missingFile);
        $this->assertArrayHasKey('file', $missingFile->errors());

        $invalidType = $this->request('POST', '/api/v1/sellers/documents', [
            'headers' => $token,
            'form' => ['document_type' => 'passport_photo'],
        ]);
        $this->assertStatus(422, $invalidType);
        $this->assertArrayHasKey('document_type', $invalidType->errors());
    }

    public function test_a_seller_can_list_and_delete_only_their_own_documents(): void
    {
        $owner = Factory::seller();
        $other = Factory::seller();
        $documentId = $this->documents()->create((int) $owner['id'], [
            'document_type' => 'business_licence',
            'label' => '2026 business licence',
            'file_url' => '/media/documents/2026/licence.pdf',
            'file_path' => 'documents/2026/licence.pdf',
            'original_name' => 'licence.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 2048,
        ]);

        $list = $this->get('/api/v1/sellers/documents', [], $this->bearer($owner['user']));
        $this->assertStatus(200, $list);
        $this->assertCount(1, $list->dataArray());
        $document = $list->dataArray()[0];
        $this->assertSame($documentId, (int) ($document['id'] ?? 0));
        $this->assertSame('business_licence', $document['documentType'] ?? null);
        $this->assertSame('pending', $document['status'] ?? null);
        $this->assertSame('/media/documents/2026/licence.pdf', $document['fileUrl'] ?? null);

        // Another seller must not be able to delete or even discover the row.
        $forbidden = $this->delete(
            '/api/v1/sellers/documents/' . $documentId,
            $this->bearer($other['user']),
        );
        $this->assertStatus(404, $forbidden);
        $this->assertSame(1, (int) $this->db()->scalar('SELECT COUNT(*) FROM seller_documents'));

        $deleted = $this->delete(
            '/api/v1/sellers/documents/' . $documentId,
            $this->bearer($owner['user']),
        );
        $this->assertStatus(200, $deleted);
        $this->assertSame(0, (int) $this->db()->scalar('SELECT COUNT(*) FROM seller_documents'));

        $this->assertCount(0, $this->get('/api/v1/sellers/documents', [], $this->bearer($owner['user']))->dataArray());
    }

    public function test_deleting_a_document_removes_its_stored_file(): void
    {
        $seller = Factory::seller();
        $relativePath = 'documents/tests/' . bin2hex(random_bytes(8)) . '.pdf';
        $absolutePath = rtrim((string) Config::get('UPLOAD_DIR', 'storage/uploads'), '/') . '/' . $relativePath;
        $directory = dirname($absolutePath);
        if (!is_dir($directory)) {
            mkdir($directory, 0770, true);
        }
        file_put_contents($absolutePath, "%PDF-1.4\n%%EOF\n");
        $this->assertFileExists($absolutePath);

        $documentId = $this->documents()->create((int) $seller['id'], [
            'document_type' => 'tax_certificate',
            'label' => 'TIN certificate',
            'file_url' => '/media/' . $relativePath,
            'file_path' => $relativePath,
            'original_name' => 'tin.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 17,
        ]);

        $this->assertStatus(200, $this->delete(
            '/api/v1/sellers/documents/' . $documentId,
            $this->bearer($seller['user']),
        ));
        $this->assertFileDoesNotExist($absolutePath);
    }

    public function test_admin_can_review_a_sellers_uploaded_documents(): void
    {
        $admin = Factory::admin();
        $seller = Factory::seller();
        $documentId = $this->documents()->create((int) $seller['id'], [
            'document_type' => 'id_document',
            'label' => 'National ID',
            'file_url' => '/media/documents/id.jpg',
            'file_path' => 'documents/id.jpg',
            'original_name' => 'id.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 4096,
        ]);

        $response = $this->get(
            '/api/v1/admin/sellers/' . (int) $seller['id'] . '/documents',
            [],
            $this->bearer($admin),
        );
        $this->assertStatus(200, $response);
        $documents = $response->dataArray();
        $this->assertCount(1, $documents);
        $this->assertSame($documentId, (int) ($documents[0]['id'] ?? 0));
        $this->assertSame('id_document', $documents[0]['documentType'] ?? null);

        $decision = $this->patchJson(
            '/api/v1/admin/sellers/' . (int) $seller['id'],
            ['verification_status' => 'approved', 'notes' => 'Identity and business details verified.'],
            $this->bearer($admin),
        );
        $this->assertStatus(200, $decision);

        $reviewed = $this->db()->selectOne(
            'SELECT status, review_notes, reviewed_by, reviewed_at FROM seller_documents WHERE id = :id',
            ['id' => $documentId],
        );
        $this->assertSame('approved', $reviewed['status'] ?? null);
        $this->assertSame('Identity and business details verified.', $reviewed['review_notes'] ?? null);
        $this->assertSame((int) $admin['id'], (int) $reviewed['reviewed_by']);
        $this->assertNotNull($reviewed['reviewed_at'] ?? null);

        $customer = Factory::user();
        $this->assertStatus(403, $this->get(
            '/api/v1/admin/sellers/' . (int) $seller['id'] . '/documents',
            [],
            $this->bearer($customer),
        ));
    }
}
