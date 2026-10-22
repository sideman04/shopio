<?php

declare(strict_types=1);

namespace Shopio\Services\Mail;

/**
 * No-op mailer that records what was "sent" so tests can extract verification
 * and reset tokens without real SMTP. Never used in production.
 */
final class NullMailer implements Mailer
{
    /** @var list<array{to:string,subject:string,body:string}> */
    private array $sent = [];

    public function name(): string
    {
        return 'null';
    }

    public function send(string $to, string $subject, string $body, ?string $name = null): bool
    {
        $this->sent[] = ['to' => $to, 'subject' => $subject, 'body' => $body];

        return true;
    }

    /**
     * @return list<array{to:string,subject:string,body:string}>
     */
    public function sent(): array
    {
        return $this->sent;
    }

    public function lastBody(): ?string
    {
        $last = end($this->sent);

        return $last === false ? null : $last['body'];
    }

    public function lastRecipient(): ?string
    {
        $last = end($this->sent);

        return $last === false ? null : $last['to'];
    }

    public function clear(): void
    {
        $this->sent = [];
    }
}
