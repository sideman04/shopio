<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Repositories\AuditRepository;

/**
 * Audit trail. Every administrative and financial state transition is recorded
 * here. Details must never include secrets (the logger redactor is a backstop,
 * not a licence to log passwords).
 */
final class AuditService
{
    public function __construct(private readonly AuditRepository $audits)
    {
    }

    /**
     * @param array<string,mixed>|null $details
     */
    public function record(
        ?AuthenticatedUser $actor,
        string $action,
        string $entityType,
        ?int $entityId = null,
        ?Request $request = null,
        ?array $details = null,
    ): void {
        $this->audits->record(
            $actor?->id,
            $action,
            $entityType,
            $entityId,
            $request?->clientIp(),
            $request?->userAgent(),
            $details,
        );
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function paginate(array $filters, int $page, int $perPage): array
    {
        return $this->audits->paginate($filters, $page, $perPage);
    }

    /**
     * @return list<array<string,mixed>>
     */
    public function recent(int $limit = 20): array
    {
        return $this->audits->recent($limit);
    }
}
