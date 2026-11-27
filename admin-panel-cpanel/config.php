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

if (!function_exists('cr_env_is_empty')) {
    function cr_env_is_empty(string $key): bool
    {
        $envVal = $_ENV[$key] ?? null;
        if (is_string($envVal) && trim($envVal) !== '') {
            return false;
        }
        $srvVal = $_SERVER[$key] ?? ($_SERVER['REDIRECT_' . $key] ?? null);
        if (is_string($srvVal) && trim($srvVal) !== '') {
            return false;
        }
        $getVal = getenv($key);
        if ($getVal !== false && trim((string) $getVal) !== '') {
            return false;
        }
        return true;
    }
}

if (!function_exists('cr_load_env_file')) {
    function cr_load_env_file(string $envPath): void
    {
        if (!@is_file($envPath) || !@is_readable($envPath)) {
            return;
        }
        $lines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return;
        }
        foreach ($lines as $line) {
            $trimmed = trim(ltrim($line, "\xEF\xBB\xBF"));
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }
            if (str_starts_with($trimmed, 'export ')) {
                $trimmed = trim(substr($trimmed, 7));
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
            if ($val !== '' && cr_env_is_empty($key)) {
                $_ENV[$key] = $val;
                @putenv($key . '=' . $val);
            }
        }
    }
}

if (!function_exists('cr_env')) {
    function cr_env(string $key, string $default = ''): string
    {
        $candidates = [
            $_ENV[$key] ?? null,
            $_SERVER[$key] ?? null,
            $_SERVER['REDIRECT_' . $key] ?? null,
            getenv($key),
            defined($key) ? constant($key) : null,
        ];
        foreach ($candidates as $val) {
            if ($val === false || $val === null || !is_scalar($val)) {
                continue;
            }
            $trimmed = trim((string) $val);
            if ($trimmed !== '') {
                return $trimmed;
            }
        }
        return $default;
    }
}

if (!function_exists('cr_load_php_secrets_file')) {
    function cr_load_php_secrets_file(string $secretsPath): void
    {
        if (!@is_file($secretsPath) || !@is_readable($secretsPath)) {
            return;
        }
        $data = require $secretsPath;
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                if (!is_string($key) || $key === '' || !is_scalar($value)) {
                    continue;
                }
                $upperKey = strtoupper($key);
                $strVal = trim((string) $value);
                if ($strVal !== '' && cr_env_is_empty($upperKey)) {
                    $_ENV[$upperKey] = $strVal;
                    @putenv($upperKey . '=' . $strVal);
                }
            }
            return;
        }

        // Also support variable-assignment style inside casinoug-secrets.php (e.g. $DB_NAME = '...')
        $defined = get_defined_vars();
        foreach ($defined as $varName => $value) {
            if ($varName === 'secretsPath' || $varName === 'data' || !is_string($varName) || !is_scalar($value)) {
                continue;
            }
            $upperKey = strtoupper($varName);
            $strVal = trim((string) $value);
            if ($strVal !== '' && cr_env_is_empty($upperKey)) {
                $_ENV[$upperKey] = $strVal;
                @putenv($upperKey . '=' . $strVal);
            }
        }
    }
}

// Discover casinoug-secrets.php / casinoroyale-secrets.php / secrets.php / .env
// across current folder, up to 4 parent cPanel directories, document root, and sibling site roots.
$crSearchDirs = [];
$crAddDir = static function (string $dir) use (&$crSearchDirs): void {
    $clean = rtrim($dir, "/\\");
    if ($clean !== '' && !in_array($clean, $crSearchDirs, true) && @is_dir($clean)) {
        $crSearchDirs[] = $clean;
    }
};

$crCursor = __DIR__;
for ($i = 0; $i < 5; $i++) {
    $crAddDir($crCursor);
    $crAddDir($crCursor . '/uganda.casnioug.site');
    $crAddDir($crCursor . '/public_html');
    $parent = dirname($crCursor);
    if ($parent === $crCursor || $parent === '/' || $parent === '\\') {
        break;
    }
    $crCursor = $parent;
}
if (!empty($_SERVER['DOCUMENT_ROOT']) && is_string($_SERVER['DOCUMENT_ROOT'])) {
    $docRoot = $_SERVER['DOCUMENT_ROOT'];
    $crAddDir($docRoot);
    $crAddDir(dirname($docRoot));
}

// Prefer files outside web root first (indices >= 1), then fallback inside the current directory
foreach ($crSearchDirs as $dir) {
    cr_load_php_secrets_file($dir . '/casinoug-secrets.php');
    cr_load_php_secrets_file($dir . '/casinoroyale-secrets.php');
    cr_load_php_secrets_file($dir . '/secrets.php');
    cr_load_env_file($dir . '/.env');
}

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
