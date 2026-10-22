<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use PDOException;

/**
 * Webhook receipts. The unique key (provider, event_id) makes processing
 * idempotent and rejects replays of the same provider event.
 */
final class WebhookEventRepository extends Repository
{
    /**
     * @return array{duplicate:bool,id:?int}
     */
    public function record(
        string $provider,
        string $eventId,
        ?string $eventType,
        string $rawPayload,
        bool $signatureValid,
    ): array {
        try {
            $this->db->execute(
                'INSERT INTO webhook_events (provider, event_id, event_type, payload, signature_valid, status)
                 VALUES (:provider, :event_id, :event_type, :payload, :valid, \'received\')',
                [
                    'provider' => $provider,
                    'event_id' => $eventId,
                    'event_type' => $eventType,
                    'payload' => mb_substr($rawPayload, 0, 65535),
                    'valid' => $signatureValid ? 1 : 0,
                ],
            );

            return ['duplicate' => false, 'id' => $this->db->lastInsertId()];
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) !== 1062) {
                throw $this->db->mapPdoException($e);
            }
        }

        return ['duplicate' => true, 'id' => null];
    }

    public function markProcessed(int $id, string $status, ?string $errorMessage = null): void
    {
        $this->db->execute(
            'UPDATE webhook_events
             SET status = :status, error_message = :error, processed_at = UTC_TIMESTAMP()
             WHERE id = :id',
            [
                'status' => $status,
                'error' => $errorMessage === null ? null : mb_substr($errorMessage, 0, 500),
                'id' => $id,
            ],
        );
    }

    /**
     * @return array<string,mixed>|null
     */
    public function find(string $provider, string $eventId): ?array
    {
        return $this->db->selectOne(
            'SELECT id, provider, event_id, event_type, status, signature_valid, processed_at, created_at
             FROM webhook_events WHERE provider = :provider AND event_id = :event_id LIMIT 1',
            ['provider' => $provider, 'event_id' => $eventId],
        );
    }
}
