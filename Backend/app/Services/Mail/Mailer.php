<?php

declare(strict_types=1);

namespace Shopio\Services\Mail;

/**
 * Provider-independent mail interface. Implementations must never log or return
 * the message body when it contains a token.
 */
interface Mailer
{
    public function send(string $to, string $subject, string $body, ?string $name = null): bool;

    public function name(): string;
}
