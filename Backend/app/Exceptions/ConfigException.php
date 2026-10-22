<?php

declare(strict_types=1);

namespace Shopio\Exceptions;

/**
 * Thrown when configuration is missing or invalid. Never surfaced to clients.
 */
final class ConfigException extends \RuntimeException
{
}
