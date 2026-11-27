<?php
/**
 * CASINO ROYALE — PDO Database Connection & Diagnostics Helper
 * Supports Spaceship cPanel MySQL/MariaDB and PostgreSQL with prepared statements.
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (!function_exists('cr_build_dsn')) {
    /**
     * @param array<string, mixed> $dbCfg
     */
    function cr_build_dsn(array $dbCfg): string
    {
        $driver = (string) ($dbCfg['driver'] ?? 'mysql');
        $host = (string) ($dbCfg['host'] ?? 'localhost');
        $port = (int) ($dbCfg['port'] ?? ($driver === 'pgsql' ? 5432 : 3306));
        $database = (string) ($dbCfg['database'] ?? '');
        $charset = (string) ($dbCfg['charset'] ?? 'utf8mb4');

        if ($driver === 'pgsql') {
            return sprintf('pgsql:host=%s;port=%d;dbname=%s', $host, $port, $database);
        }

        return sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $database, $charset);
    }
}

if (!function_exists('cr_get_pdo')) {
    function cr_get_pdo(): PDO
    {
        static $pdo = null;
        if ($pdo instanceof PDO) {
            return $pdo;
        }

        $config = cr_get_config();
        /** @var array<string, mixed> $dbCfg */
        $dbCfg = $config['db'];

        $database = (string) ($dbCfg['database'] ?? '');
        $user = (string) ($dbCfg['user'] ?? '');
        if ($database === '' || $user === '') {
            throw new RuntimeException(
                'Database credentials missing. Set DB_NAME, DB_USER, DB_PASSWORD (or DATABASE_URL) in .env or cPanel.'
            );
        }

        $dsn = cr_build_dsn($dbCfg);
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ];

        $pdo = new PDO($dsn, $user, (string) ($dbCfg['password'] ?? ''), $options);
        return $pdo;
    }
}

if (!function_exists('cr_test_connection')) {
    /**
     * @return array<string, mixed>
     */
    function cr_test_connection(): array
    {
        $start = microtime(true);
        $config = cr_get_config();
        /** @var array<string, mixed> $dbCfg */
        $dbCfg = $config['db'];

        try {
            $pdo = cr_get_pdo();
            $pdo->query('SELECT 1');
            $latencyMs = (int) max(1, round((microtime(true) - $start) * 1000));
            return [
                'connected' => true,
                'driver' => $dbCfg['driver'],
                'host' => $dbCfg['host'],
                'port' => $dbCfg['port'],
                'database' => $dbCfg['database'],
                'latencyMs' => $latencyMs,
            ];
        } catch (Throwable $e) {
            $latencyMs = (int) max(1, round((microtime(true) - $start) * 1000));
            return [
                'connected' => false,
                'driver' => $dbCfg['driver'],
                'host' => $dbCfg['host'],
                'port' => $dbCfg['port'],
                'database' => $dbCfg['database'],
                'latencyMs' => $latencyMs,
                'error' => 'Database connection unavailable. Check host, database name, and credentials.',
            ];
        }
    }
}

if (PHP_SAPI !== 'cli' && basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'connection.php') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    $status = cr_test_connection();
    http_response_code($status['connected'] ? 200 : 503);
    echo json_encode([
        'ok' => (bool) $status['connected'],
        'driver' => $status['driver'],
        'connected' => (bool) $status['connected'],
        'latencyMs' => $status['latencyMs'],
    ]);
}
