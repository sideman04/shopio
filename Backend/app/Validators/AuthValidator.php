<?php

declare(strict_types=1);

namespace Shopio\Validators;

/**
 * Authentication request validators.
 */
final class AuthValidator
{
    use ValidatesNested;

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function register(array $data): array
    {
        return Validator::check($data, [
            'full_name' => 'required|safe_text|string|min:2|max:150',
            'email' => 'required|email|max:254',
            'phone' => 'nullable|phone|max:32',
            'password' => 'required|password:10|confirmed',
            'password_confirmation' => 'required|string|max:200',
            'accept_terms' => 'required|boolean|in:1',
            'store_name' => 'nullable|safe_text|string|min:2|max:150',
            'business_category' => 'nullable|safe_text|string|max:120',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function login(array $data): array
    {
        return Validator::check($data, [
            'email' => 'required|email|max:254',
            'password' => 'required|string|min:1|max:200',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function forgotPassword(array $data): array
    {
        return Validator::check($data, [
            'email' => 'required|email|max:254',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function resetPassword(array $data): array
    {
        return Validator::check($data, [
            'token' => 'required|token',
            'password' => 'required|password:10|confirmed',
            'password_confirmation' => 'required|string|max:200',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function verifyEmail(array $data): array
    {
        return Validator::check($data, [
            'token' => 'required|token',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function emailOnly(array $data): array
    {
        return Validator::check($data, [
            'email' => 'required|email|max:254',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function changePassword(array $data): array
    {
        return Validator::check($data, [
            'current_password' => 'required|string|max:200',
            'password' => 'required|password:10|confirmed|different:current_password',
            'password_confirmation' => 'required|string|max:200',
        ]);
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    public static function verifyPhone(array $data): array
    {
        return Validator::check($data, [
            'code' => 'required|string|min:4|max:10',
        ]);
    }
}
