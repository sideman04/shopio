<?php

declare(strict_types=1);

namespace Shopio\Repositories;

use Shopio\Support\Str;

final class CookieConsentRepository extends Repository
{
    /**
     * Persist the latest choice for one authenticated account or anonymous browser.
     *
     * @param array{necessary:bool,functional:bool,analytics:bool,marketing:bool,status:string,policy_version:string} $consent
     */
    public function save(?int $userId, ?string $anonymousToken, array $consent): void
    {
        $anonymousHash = $userId === null && $anonymousToken !== null
            ? Str::hashToken($anonymousToken)
            : null;

        $this->db->execute(
            'INSERT INTO cookie_consents (
                user_id, anonymous_id, necessary, functional, analytics, marketing,
                consent_status, policy_version, consent_timestamp
             ) VALUES (
                :user_id, :anonymous_id, :necessary, :functional, :analytics, :marketing,
                :consent_status, :policy_version, UTC_TIMESTAMP()
             )
             ON DUPLICATE KEY UPDATE
                necessary = VALUES(necessary),
                functional = VALUES(functional),
                analytics = VALUES(analytics),
                marketing = VALUES(marketing),
                consent_status = VALUES(consent_status),
                policy_version = VALUES(policy_version),
                consent_timestamp = UTC_TIMESTAMP(),
                updated_at = CURRENT_TIMESTAMP',
            [
                'user_id' => $userId,
                'anonymous_id' => $anonymousHash,
                'necessary' => $consent['necessary'],
                'functional' => $consent['functional'],
                'analytics' => $consent['analytics'],
                'marketing' => $consent['marketing'],
                'consent_status' => $consent['status'],
                'policy_version' => $consent['policy_version'],
            ],
        );
    }
}
