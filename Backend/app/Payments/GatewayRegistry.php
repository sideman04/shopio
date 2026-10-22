<?php

declare(strict_types=1);

namespace Shopio\Payments;

use Shopio\Exceptions\PaymentException;

/**
 * Lookup table for payment provider adapters.
 *
 * The registry is populated at boot; unknown providers fail closed rather than
 * silently falling back to a default.
 */
final class GatewayRegistry
{
    /** @var array<string,GatewayInterface> */
    private array $gateways = [];

    public function register(GatewayInterface $gateway): void
    {
        $this->gateways[strtolower($gateway->name())] = $gateway;
    }

    public function has(string $provider): bool
    {
        return isset($this->gateways[strtolower($provider)]);
    }

    /**
     * @throws PaymentException
     */
    public function resolve(string $provider): GatewayInterface
    {
        $gateway = $this->gateways[strtolower($provider)] ?? null;
        if ($gateway === null) {
            throw new PaymentException('Unsupported payment provider.', ['provider' => ['Provider is not available.']]);
        }

        return $gateway;
    }

    /**
     * @return list<string>
     */
    public function names(): array
    {
        return array_keys($this->gateways);
    }
}
