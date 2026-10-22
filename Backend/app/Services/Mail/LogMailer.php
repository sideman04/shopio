<?php

declare(strict_types=1);

namespace Shopio\Services\Mail;

use Shopio\Support\Logger;

/**
 * Development mailer: writes a redacted record to the application log instead of
 * sending. Tokens are never included.
 */
final class LogMailer implements Mailer
{
    public function name(): string
    {
        return 'log';
    }

    public function send(string $to, string $subject, string $body, ?string $name = null): bool
    {
        Logger::instance()->info('mail.dispatch', [
            'to' => $to,
            'subject' => $subject,
            'body_length' => strlen($body),
        ]);

        return true;
    }
}
