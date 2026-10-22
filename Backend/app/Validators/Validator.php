<?php

declare(strict_types=1);

namespace Shopio\Validators;

use Shopio\Exceptions\ValidationException;
use Shopio\Support\Str;

/**
 * Small, dependency-free request validator.
 *
 * Two jobs:
 *  1. Reject malformed input with field-level messages (422).
 *  2. Return ONLY the fields declared in the rules — the primary defence against
 *     mass assignment. A field the validator does not know about can never reach
 *     a repository through validated data.
 *
 * Rule syntax: `'required|string|min:3|max:150'`. `regex:` must be the last rule
 * in a chain because its pattern may itself contain `|`.
 */
final class Validator
{
    /** @var array<string,list<string>> */
    private array $errors = [];

    /** @var array<string,mixed> */
    private array $validated = [];

    /**
     * @param array<string,mixed> $data
     * @param array<string,string> $rules
     */
    public function __construct(
        private readonly array $data,
        private readonly array $rules,
    ) {
    }

    /**
     * @param array<string,mixed>  $data
     * @param array<string,string> $rules
     * @return array<string,mixed>
     */
    public static function check(array $data, array $rules): array
    {
        return (new self($data, $rules))->validate();
    }

    /**
     * @return array<string,mixed>
     */
    public function validate(): array
    {
        foreach ($this->rules as $field => $ruleString) {
            $this->validateField((string) $field, $ruleString);
        }

        if ($this->errors !== []) {
            throw new ValidationException($this->errors);
        }

        return $this->validated;
    }

    private function validateField(string $field, string $ruleString): void
    {
        $rules = $this->parseRules($ruleString);
        $present = array_key_exists($field, $this->data);
        $value = $this->data[$field] ?? null;

        // `sometimes` means the rule set only applies when the field is present.
        // Without this guard partial PATCH updates would force every optional
        // field to be sent on each request.
        if (in_array('sometimes', $rules, true) && !$present) {
            return;
        }

        $required = in_array('required', $rules, true) || $this->isConditionallyRequired($rules);
        $nullable = in_array('nullable', $rules, true);

        if (!$present || $value === null || $value === '') {
            if ($required && !$nullable) {
                $this->addError($field, 'This field is required.');

                return;
            }

            if ($nullable) {
                $this->validated[$field] = null;
            }

            return;
        }

        foreach ($rules as $rule) {
            if (in_array($rule, ['required', 'nullable', 'sometimes'], true) || str_starts_with($rule, 'required_')) {
                continue;
            }

            if (str_starts_with($rule, 'regex:')) {
                $pattern = substr($rule, 6);
                if (@preg_match($pattern, '') === false) {
                    $this->addError($field, 'Server validation rule is misconfigured.');

                    return;
                }
                if (preg_match($pattern, (string) $value) !== 1) {
                    $this->addError($field, 'The format is invalid.');

                    return;
                }
                continue;
            }

            [$name, $parameter] = array_pad(explode(':', $rule, 2), 2, null);

            if (!$this->applyRule($name, $parameter, $value, $field)) {
                return;
            }

            $value = $this->coerce($name, $value);
        }

        $this->validated[$field] = $value;
    }

    private function applyRule(string $name, ?string $parameter, mixed $value, string $field): bool
    {
        switch ($name) {
            case 'string':
                if (!is_string($value)) {
                    return $this->fail($field, 'Must be a string.');
                }
                break;

            case 'integer':
                if (is_int($value)) {
                    break;
                }
                if (is_string($value) && preg_match('/^-?\d+$/', $value) === 1) {
                    break;
                }
                return $this->fail($field, 'Must be an integer.');

            case 'numeric':
                if (!is_numeric($value)) {
                    return $this->fail($field, 'Must be a number.');
                }
                break;

            case 'decimal':
                if (!Str::isNumericString(is_string($value) ? $value : (string) $value)) {
                    return $this->fail($field, 'Must be a decimal amount with up to 2 decimal places.');
                }
                if (preg_match('/^-?\d+(\.\d{1,2})?$/', (string) $value) !== 1) {
                    return $this->fail($field, 'Must have at most 2 decimal places.');
                }
                break;

            case 'boolean':
                if (!in_array($value, [true, false, 1, 0, '1', '0', 'true', 'false'], true)) {
                    return $this->fail($field, 'Must be a boolean.');
                }
                break;

            case 'array':
                if (!is_array($value)) {
                    return $this->fail($field, 'Must be an array.');
                }
                break;

            case 'list_of':
                if (!is_array($value)) {
                    return $this->fail($field, 'Must be an array.');
                }
                foreach ($value as $item) {
                    if ($parameter === 'int' && !(is_int($item) || (is_string($item) && preg_match('/^\d+$/', $item) === 1))) {
                        return $this->fail($field, 'Must be a list of integers.');
                    }
                    if ($parameter === 'string' && !is_string($item)) {
                        return $this->fail($field, 'Must be a list of strings.');
                    }
                }
                break;

            case 'email':
                if (!is_string($value) || filter_var($value, FILTER_VALIDATE_EMAIL) === false || strlen($value) > 254) {
                    return $this->fail($field, 'Must be a valid email address.');
                }
                break;

            case 'url':
                if (!is_string($value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
                    return $this->fail($field, 'Must be a valid URL.');
                }
                if (!preg_match('#^https?://#i', $value)) {
                    return $this->fail($field, 'URL must use http or https.');
                }
                break;

            case 'url_or_path':
                if (!is_string($value)) {
                    return $this->fail($field, 'Must be a URL or internal path.');
                }

                $isAbsolute = filter_var($value, FILTER_VALIDATE_URL) !== false
                    && preg_match('#^https?://#i', $value) === 1;
                // Single-slash paths only: `//example.com` is a protocol-relative
                // URL and would leave the application for an external origin.
                $isInternal = preg_match('#^/(?![/\\\\])[^\s]*$#', $value) === 1;

                if (!$isAbsolute && !$isInternal) {
                    return $this->fail($field, 'Must be a valid URL or an internal path starting with /.');
                }
                break;

            case 'phone':
                if (!is_string($value) || Str::normalisePhone($value) === null) {
                    return $this->fail($field, 'Must be a valid phone number.');
                }
                break;

            case 'date':
                if (!is_string($value) || strtotime($value) === false) {
                    return $this->fail($field, 'Must be a valid date.');
                }
                break;

            case 'date_format':
                if (!is_string($value)) {
                    return $this->fail($field, 'Must be a valid date string.');
                }
                $parsed = \DateTimeImmutable::createFromFormat('!' . (string) $parameter, $value, new \DateTimeZone('UTC'));
                if ($parsed === false || $parsed->format((string) $parameter) !== $value) {
                    return $this->fail($field, 'Must match the format ' . $parameter . '.');
                }
                break;

            case 'in':
                $allowed = explode(',', (string) $parameter);
                if (!in_array((string) $value, $allowed, true)) {
                    return $this->fail($field, 'Must be one of: ' . $parameter . '.');
                }
                break;

            case 'not_in':
                $denied = explode(',', (string) $parameter);
                if (in_array((string) $value, $denied, true)) {
                    return $this->fail($field, 'This value is not allowed.');
                }
                break;

            case 'min':
                if (!$this->compareLengthOrValue($value, $parameter, 'min')) {
                    return $this->fail($field, $this->minMessage($value, $parameter));
                }
                break;

            case 'max':
                if (!$this->compareLengthOrValue($value, $parameter, 'max')) {
                    return $this->fail($field, $this->maxMessage($value, $parameter));
                }
                break;

            case 'between':
                [$low, $high] = array_pad(explode(',', (string) $parameter), 2, null);
                if (is_string($value)) {
                    $length = mb_strlen($value);
                    if ($length < (int) $low || $length > (int) $high) {
                        return $this->fail($field, "Must be between {$low} and {$high} characters.");
                    }
                } else {
                    if ((float) $value < (float) $low || (float) $value > (float) $high) {
                        return $this->fail($field, "Must be between {$low} and {$high}.");
                    }
                }
                break;

            case 'confirmed':
                $confirmation = $this->data[$field . '_confirmation'] ?? null;
                if (!is_string($value) || !is_string($confirmation) || !hash_equals($value, $confirmation)) {
                    return $this->fail($field, 'Confirmation does not match.');
                }
                break;

            case 'different':
                if ((string) ($this->data[(string) $parameter] ?? '') === (string) $value) {
                    return $this->fail($field, 'Must be different from ' . $parameter . '.');
                }
                break;

            case 'password':
                if (!is_string($value)) {
                    return $this->fail($field, 'Must be a string.');
                }
                $min = (int) ($parameter ?? 10);
                if (strlen($value) < $min) {
                    return $this->fail($field, "Must be at least {$min} characters.");
                }
                if (strlen($value) > 200) {
                    return $this->fail($field, 'Must not exceed 200 characters.');
                }
                if (preg_match('/[A-Za-z]/', $value) !== 1 || preg_match('/\d/', $value) !== 1) {
                    return $this->fail($field, 'Must contain at least one letter and one number.');
                }
                break;

            case 'slug':
                if (!is_string($value) || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $value) !== 1) {
                    return $this->fail($field, 'Must be a lowercase slug.');
                }
                break;

            case 'sku':
                if (!is_string($value) || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{1,98}$/', $value) !== 1) {
                    return $this->fail($field, 'Must contain only letters, numbers, dot, dash or underscore.');
                }
                break;

            case 'token':
                if (!is_string($value) || preg_match('/^[A-Za-z0-9_-]{20,256}$/', $value) !== 1) {
                    return $this->fail($field, 'Must be a valid token.');
                }
                break;

            case 'safe_text':
                if (!is_string($value)) {
                    return $this->fail($field, 'Must be text.');
                }
                Str::assertSafeText($value, $field);
                break;

            default:
                // Unknown rule => configuration error, never silently pass.
                return $this->fail($field, 'Server validation rule is unknown.');
        }

        return true;
    }

    /**
     * Evaluates conditional presence rules such as `required_without:address_id`.
     *
     * @param list<string> $rules
     */
    private function isConditionallyRequired(array $rules): bool
    {
        foreach ($rules as $rule) {
            if (str_starts_with($rule, 'required_without:')) {
                $other = substr($rule, 17);
                if ($this->isEmptyValue($other)) {
                    return true;
                }
                continue;
            }

            if (str_starts_with($rule, 'required_with:')) {
                $other = substr($rule, 14);
                if (!$this->isEmptyValue($other)) {
                    return true;
                }
                continue;
            }

            if (str_starts_with($rule, 'required_if:')) {
                [$other, $expected] = array_pad(explode(',', substr($rule, 12), 2), 2, null);
                if (array_key_exists((string) $other, $this->data)
                    && (string) $this->data[$other] === (string) $expected) {
                    return true;
                }
            }
        }

        return false;
    }

    private function isEmptyValue(string $field): bool
    {
        if (!array_key_exists($field, $this->data)) {
            return true;
        }

        $value = $this->data[$field];

        return $value === null || $value === '' || $value === [];
    }

    private function compareLengthOrValue(mixed $value, ?string $parameter, string $mode): bool
    {
        $limit = (float) $parameter;

        if (is_string($value)) {
            $length = mb_strlen($value);

            return $mode === 'min' ? $length >= $limit : $length <= $limit;
        }

        if (is_array($value)) {
            $count = count($value);

            return $mode === 'min' ? $count >= $limit : $count <= $limit;
        }

        return $mode === 'min' ? (float) $value >= $limit : (float) $value <= $limit;
    }

    private function minMessage(mixed $value, ?string $parameter): string
    {
        if (is_string($value)) {
            return "Must be at least {$parameter} characters.";
        }

        return "Must be at least {$parameter}.";
    }

    private function maxMessage(mixed $value, ?string $parameter): string
    {
        if (is_string($value)) {
            return "Must not exceed {$parameter} characters.";
        }

        return "Must not exceed {$parameter}.";
    }

    private function coerce(string $rule, mixed $value): mixed
    {
        return match ($rule) {
            'integer' => (int) $value,
            'numeric', 'decimal' => is_string($value) ? trim($value) : $value,
            'boolean' => in_array($value, [true, 1, '1', 'true'], true),
            'string', 'safe_text', 'email' => is_string($value) ? trim($value) : $value,
            'date' => $this->normaliseDate($value),
            default => $value,
        };
    }

    /**
     * Store dates in the format MySQL DATETIME expects, in UTC.
     *
     * Clients send ISO-8601 timestamps (e.g. "2026-10-19T21:00:00.000Z").
     * Passing those directly to MySQL fails with error 1292, so normalise after
     * the `date` rule has validated the input.
     */
    private function normaliseDate(mixed $value): mixed
    {
        if (!is_string($value)) {
            return $value;
        }

        try {
            return (new \DateTimeImmutable($value, new \DateTimeZone('UTC')))
                ->setTimezone(new \DateTimeZone('UTC'))
                ->format('Y-m-d H:i:s');
        } catch (\Exception) {
            return $value;
        }
    }

    private function fail(string $field, string $message): bool
    {
        $this->addError($field, $message);

        return false;
    }

    private function addError(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }

    /**
     * @return list<string>
     */
    private function parseRules(string $ruleString): array
    {
        $rules = [];
        $parts = explode('|', $ruleString);

        foreach ($parts as $index => $part) {
            if (str_starts_with($part, 'regex:')) {
                // Re-glue everything from here so a pattern containing `|` survives.
                $rules[] = 'regex:' . implode('|', array_slice($parts, $index));

                return $rules;
            }

            if ($part !== '') {
                $rules[] = $part;
            }
        }

        return $rules;
    }
}
