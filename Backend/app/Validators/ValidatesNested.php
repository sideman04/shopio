<?php

declare(strict_types=1);

namespace Shopio\Validators;

use Shopio\Exceptions\ValidationException;

/**
 * Shared helpers for field-group validation inside domain validators.
 */
trait ValidatesNested
{
    /**
     * Validates a list of homogeneous array items (e.g. variants, images) with
     * an explicit per-item rule set. Enforces a maximum item count.
     *
     * @param array<string,string> $itemRules
     * @return list<array<string,mixed>>
     */
    protected static function validateItems(mixed $items, array $itemRules, int $max = 50, string $field = 'items'): array
    {
        if (!is_array($items)) {
            throw new ValidationException([$field => ['Must be an array.']]);
        }

        if (count($items) > $max) {
            throw new ValidationException([$field => ["Must not contain more than {$max} items."]]);
        }

        $validated = [];
        $errors = [];

        foreach (array_values($items) as $index => $item) {
            if (!is_array($item)) {
                $errors["{$field}.{$index}"] = ['Must be an object.'];

                continue;
            }

            try {
                $validated[] = Validator::check($item, $itemRules);
            } catch (ValidationException $e) {
                foreach ($e->errors() as $key => $messages) {
                    $errors["{$field}.{$index}.{$key}"] = $messages;
                }
            }
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        return $validated;
    }
}
