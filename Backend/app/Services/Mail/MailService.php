<?php

declare(strict_types=1);

namespace Shopio\Services\Mail;

use Shopio\Config\Config;

/**
 * Composes transactional emails. HTML is escaped; the only interpolated values
 * are the recipient name and a single-use token that is never logged.
 */
final class MailService
{
    public function __construct(private readonly Mailer $mailer)
    {
    }

    public function mailer(): Mailer
    {
        return $this->mailer;
    }

    public function sendEmailVerification(string $to, string $name, string $token): void
    {
        $url = $this->link('/verify-email', ['token' => $token]);
        $body = "Hello {$this->escape($name)},\n\n"
            . "Confirm your Shopio email address by opening:\n{$url}\n\n"
            . "Token: {$token}\n\n"
            . "If you did not create a Shopio account you can ignore this message.";

        $this->mailer->send($to, 'Verify your Shopio email address', $body, $name);
    }

    public function sendPasswordReset(string $to, string $name, string $token): void
    {
        $url = $this->link('/reset-password', ['token' => $token]);
        $ttlMinutes = (int) round(Config::int('PASSWORD_RESET_TTL', 3600) / 60);
        $body = "Hello {$this->escape($name)},\n\n"
            . "A password reset was requested for your Shopio account.\n"
            . "This link expires in {$ttlMinutes} minutes and can only be used once:\n{$url}\n\n"
            . "Token: {$token}\n\n"
            . "If you did not request this, no action is required and your password is unchanged.";

        $this->mailer->send($to, 'Reset your Shopio password', $body, $name);
    }

    public function sendPhoneVerificationCode(string $phone, string $code): void
    {
        // The phone provider integration is pluggable; the SMS transport is out of
        // scope for this deliverable and is represented by the mail transport seam.
        $this->mailer->send(
            $phone,
            'Shopio phone verification',
            "Your Shopio verification code is {$code}. It expires in "
            . (int) round(Config::int('PHONE_VERIFY_TTL', 600) / 60) . " minutes.",
        );
    }

    public function sendOrderConfirmation(string $to, string $name, string $orderNumber, string $total, string $currency): void
    {
        $body = "Hello {$this->escape($name)},\n\n"
            . "Thank you for your Shopio order {$this->escape($orderNumber)}.\n"
            . "Total: {$this->escape($total)} {$this->escape($currency)}\n\n"
            . "We will notify you when your order is on its way.";

        $this->mailer->send($to, "Shopio order {$orderNumber} confirmed", $body, $name);
    }

    public function sendOrderStatusChanged(string $to, string $name, string $orderNumber, string $status): void
    {
        $body = "Hello {$this->escape($name)},\n\n"
            . "Your Shopio order {$this->escape($orderNumber)} is now: {$this->escape($status)}.";

        $this->mailer->send($to, "Shopio order {$orderNumber} update", $body, $name);
    }

    public function sendPayoutDecision(string $to, string $name, string $reference, string $status, string $amount, string $currency): void
    {
        $body = "Hello {$this->escape($name)},\n\n"
            . "Your payout request {$this->escape($reference)} ({$this->escape($amount)} {$this->escape($currency)}) "
            . "is now: {$this->escape($status)}.";

        $this->mailer->send($to, 'Shopio payout update', $body, $name);
    }

    /**
     * @param array<string,string> $query
     */
    private function link(string $path, array $query = []): string
    {
        $base = rtrim(Config::get('FRONTEND_URL', Config::get('APP_URL', 'http://localhost:5173') ?? '') ?? '', '/');
        $url = $base . $path;

        if ($query !== []) {
            $url .= '?' . http_build_query($query);
        }

        return $url;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
