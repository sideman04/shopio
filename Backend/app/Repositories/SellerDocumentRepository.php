<?php

declare(strict_types=1);

namespace Shopio\Repositories;

/**
 * Verification documents uploaded by sellers.
 */
final class SellerDocumentRepository extends Repository
{
    /**
     * @return list<array<string,mixed>>
     */
    public function forSeller(int $sellerId): array
    {
        return $this->db->select(
            'SELECT d.*, u.full_name AS reviewed_by_name
             FROM seller_documents d
             LEFT JOIN users u ON u.id = d.reviewed_by
             WHERE d.seller_id = :seller_id
             ORDER BY d.created_at DESC, d.id DESC',
            ['seller_id' => $sellerId],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findByIdForSeller(int $id, int $sellerId): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM seller_documents WHERE id = :id AND seller_id = :seller_id LIMIT 1',
            ['id' => $id, 'seller_id' => $sellerId],
        );
    }

    public function countForSeller(int $sellerId): int
    {
        return (int) $this->db->scalar(
            'SELECT COUNT(*) FROM seller_documents WHERE seller_id = :seller_id',
            ['seller_id' => $sellerId],
        );
    }

    public function create(int $sellerId, array $data): int
    {
        $this->db->execute(
            'INSERT INTO seller_documents
                (seller_id, document_type, label, file_url, file_path, original_name, mime_type, size_bytes, status)
             VALUES
                (:seller_id, :document_type, :label, :file_url, :file_path, :original_name, :mime_type, :size_bytes, \'pending\')',
            [
                'seller_id' => $sellerId,
                'document_type' => $data['document_type'],
                'label' => $data['label'] ?? null,
                'file_url' => $data['file_url'],
                'file_path' => $data['file_path'],
                'original_name' => $data['original_name'] ?? null,
                'mime_type' => $data['mime_type'],
                'size_bytes' => (int) ($data['size_bytes'] ?? 0),
            ],
        );

        return $this->db->lastInsertId();
    }

    /**
     * Mirrors a seller-level verification decision onto documents that are
     * still awaiting review. Finalised documents are left untouched.
     */
    public function reviewPendingForSeller(int $sellerId, string $status, ?string $notes, int $reviewedBy): void
    {
        $this->db->execute(
            "UPDATE seller_documents
             SET status = :status,
                 review_notes = :notes,
                 reviewed_by = :reviewed_by,
                 reviewed_at = UTC_TIMESTAMP()
             WHERE seller_id = :seller_id AND status = 'pending'",
            [
                'status' => $status,
                'notes' => $notes,
                'reviewed_by' => $reviewedBy,
                'seller_id' => $sellerId,
            ],
        );
    }

    public function delete(int $id, int $sellerId): bool
    {
        $statement = $this->db->execute(
            'DELETE FROM seller_documents WHERE id = :id AND seller_id = :seller_id',
            ['id' => $id, 'seller_id' => $sellerId],
        );

        return $this->db->affectedRows($statement) > 0;
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findById(int $id): ?array
    {
        return $this->db->selectOne(
            'SELECT * FROM seller_documents WHERE id = :id LIMIT 1',
            ['id' => $id],
        );
    }
}
