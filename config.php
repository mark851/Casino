<?php
/**
 * CASINO ROYALE — Spaceship cPanel Environment & Database Configuration
 * Credentials are read strictly from server environment variables or .env.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli' && basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'config.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access to config.php is forbidden.']);
    exit;
}

if (!function_exists('cr_load_env_file')) {
    function cr_load_env_file(string $envPath): void
    {
        if (!is_file($envPath) || !is_readable($envPath)) {
            return;
        }
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return;
        }
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            $eqPos = strpos($trimmed, '=');
            if ($eqPos === false) {
                continue;
            }
            $key = trim(substr($trimmed, 0, $eqPos));
            $val = trim(substr($trimmed, $eqPos + 1));
            if ($key === '') {
                continue;
            }
            if (
                (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                (str_starts_with($val, "'") && str_ends_with($val, "'"))
            ) {
                $val = substr($val, 1, -1);
            }
            if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $val;
                @putenv($key . '=' . $val);
            }
        }
    }
}

if (!function_exists('cr_env')) {
    function cr_env(string $key, string $default = ''): string
    {
        $val = $_ENV[$key]
            ?? $_SERVER[$key]
            ?? $_SERVER['REDIRECT_' . $key]
            ?? getenv($key);
        if ($val === false || $val === null) {
            return $default;
        }
        return trim((string) $val);
    }
}

if (!function_exists('cr_load_php_secrets_file')) {
    function cr_load_php_secrets_file(string $secretsPath): void
    {
        if (!is_file($secretsPath) || !is_readable($secretsPath)) {
            return;
        }
        $data = require $secretsPath;
        if (!is_array($data)) {
            return;
        }
        foreach ($data as $key => $value) {
            if (!is_string($key) || $key === '' || !is_scalar($value)) {
                continue;
            }
            $strVal = (string) $value;
            if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $strVal;
                @putenv($key . '=' . $strVal);
            }
        }
    }
}

// 1. Optional secrets file placed one directory above public_html in cPanel (non-web-accessible)
cr_load_php_secrets_file(dirname(__DIR__) . '/casinoroyale-secrets.php');
cr_load_php_secrets_file(dirname(__DIR__) . '/secrets.php');
cr_load_env_file(dirname(__DIR__) . '/.env');
// 2. Fallback to secrets.php or .env inside the app directory (blocked from HTTP via .htaccess)
cr_load_php_secrets_file(__DIR__ . '/secrets.php');
cr_load_env_file(__DIR__ . '/.env');

if (!function_exists('cr_get_config')) {
    /**
     * Returns database and Spaceship cPanel integration settings.
     * Supports DB_DRIVER=auto|mysql|postgres as well as cPanel CPANEL_DB_* aliases.
     *
     * @return array<string, mixed>
     */
    function cr_get_config(): array
    {
        $databaseUrl = cr_env('DATABASE_URL') ?: cr_env('MYSQL_URL') ?: cr_env('POSTGRES_URL');
        $requestedDriver = strtolower(cr_env('DB_DRIVER', 'auto'));

        $host = cr_env('DB_HOST') ?: cr_env('CPANEL_DB_HOST', 'localhost');
        $user = cr_env('DB_USER') ?: cr_env('CPANEL_DB_USER');
        $password = cr_env('DB_PASSWORD') ?: cr_env('CPANEL_DB_PASSWORD');
        $database = cr_env('DB_NAME') ?: cr_env('CPANEL_DB_NAME');
        $portEnv = cr_env('DB_PORT');

        $driver = 'mysql';
        if ($requestedDriver === 'postgres' || $requestedDriver === 'postgresql' || $requestedDriver === 'pgsql') {
            $driver = 'pgsql';
        } elseif ($databaseUrl !== '' && preg_match('/^postgres(ql)?:\/\//i', $databaseUrl)) {
            $driver = 'pgsql';
        }

        if ($databaseUrl !== '') {
            $parts = parse_url($databaseUrl);
            if (is_array($parts)) {
                if (!empty($parts['host'])) {
                    $host = (string) $parts['host'];
                }
                if (!empty($parts['port'])) {
                    $portEnv = (string) $parts['port'];
                }
                if (!empty($parts['user'])) {
                    $user = urldecode((string) $parts['user']);
                }
                if (isset($parts['pass'])) {
                    $password = urldecode((string) $parts['pass']);
                }
                if (!empty($parts['path'])) {
                    $database = ltrim((string) $parts['path'], '/');
                }
            }
        }

        $port = $portEnv !== '' ? (int) $portEnv : ($driver === 'pgsql' ? 5432 : 3306);

        return [
            'app_name' => 'CASINO ROYALE',
            'timezone' => 'Africa/Kampala',
            'currency' => 'UGX',
            'withdrawal_fee_rate' => 0.02,
            'bootstrapped_admin_email' => 'makaug171@gmail.com',
            'db' => [
                'driver' => $driver,
                'host' => $host,
                'port' => $port,
                'database' => $database,
                'user' => $user,
                'password' => $password,
                'charset' => 'utf8mb4',
                'database_url' => $databaseUrl,
            ],
            'cpanel' => [
                'host' => cr_env('CPANEL_HOST'),
                'port' => (int) (cr_env('CPANEL_PORT', '2083') ?: 2083),
                'user' => cr_env('CPANEL_USER'),
                'api_token' => cr_env('CPANEL_API_TOKEN'),
            ],
            'marzpay' => [
                'api_key' => cr_env('MARZPAY_API_KEY'),
                'api_secret' => cr_env('MARZPAY_API_SECRET'),
                'base_url' => cr_env('MARZPAY_BASE_URL', 'https://wallet.wearemarz.com/api/v1'),
                'webhook_secret' => cr_env('MARZPAY_WEBHOOK_SECRET'),
                'country' => strtoupper(cr_env('MARZPAY_COUNTRY', 'UG') ?: 'UG'),
            ],
            'admin_passcode' => cr_env('ADMIN_PASSCODE'),
        ];
    }
}

date_default_timezone_set('Africa/Kampala');

return cr_get_config();
