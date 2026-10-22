<?php

declare(strict_types=1);

namespace Shopio\Services;

use Shopio\Auth\AuthenticatedUser;
use Shopio\Http\Request;
use Shopio\Repositories\SupportRepository;

/**
 * Public support intake and administrative handling.
 */
final class SupportService
{
    public function __construct(
        private readonly SupportRepository $support,
        private readonly RateLimiter $limiter,
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public function submit(?AuthenticatedUser $auth, array $data, Request $request): array
    {
        // Throttle support submissions per IP to blunt spam.
        $this->limiter->consume('support:submit:ip', $request->clientIp(), 5, 3600, 3600,
            'Too many messages. Please try again later.');

        $id = $this->support->create(
            $auth?->id,
            (string) $data['name'],
            (string) $data['email'],
            (string) $data['subject'],
            (string) $data['message'],
        );

        $this->audit->record($auth, 'support.submitted', 'support_message', $id, $request);

        $ticket = $this->support->findById($id) ?? [];

        return [
            'id' => (int) ($ticket['id'] ?? $id),
            'status' => (string) ($ticket['status'] ?? 'new'),
            'createdAt' => $ticket['created_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $filters
     * @return array{items:list<array<string,mixed>>,total:int}
     */
    public function listForAdmin(array $filters, int $page, int $perPage): array
    {
        $result = $this->support->paginateForAdmin($filters, $page, $perPage);

        $items = array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'name' => (string) $row['name'],
            'email' => (string) $row['email'],
            'subject' => (string) $row['subject'],
            'message' => (string) $row['message'],
            'status' => (string) $row['status'],
            'assignedToName' => $row['assigned_to_name'] ?? null,
            'resolvedAt' => $row['resolved_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
        ], $result['rows']);

        return ['items' => $items, 'total' => $result['total']];
    }

    public function updateStatus(AuthenticatedUser $auth, int $id, array $data, Request $request): array
    {
        $this->support->updateStatus($id, (string) $data['status'], $auth->id);
        $this->audit->record($auth, 'support.status_changed', 'support_message', $id, $request, ['status' => $data['status']]);

        $ticket = $this->support->findById($id) ?? [];

        if ($ticket !== [] && !empty($ticket['user_id'])) {
            $this->notifications->notify(
                (int) $ticket['user_id'],
                'support',
                'Support request updated',
                'Your support request "' . (string) $ticket['subject'] . '" is now ' . (string) $data['status'] . '.',
                null,
            );
        }

        return [
            'id' => (int) ($ticket['id'] ?? $id),
            'status' => (string) ($ticket['status'] ?? $data['status']),
        ];
    }
}
