<?php
/**
 * CASINO ROYALE — Main Database Bootstrap & cPanel Helper Facade
 * Include this file in Spaceship cPanel PHP scripts to access PDO, deposits,
 * withdrawals, tables status, and optional cPanel UAPI database discovery.
 */

declare(strict_types=1);

require_once __DIR__ . '/database.php';

if (!function_exists('cr_db')) {
    function cr_db(): CasinoRoyaleDatabase
    {
        static $instance = null;
        if (!$instance instanceof CasinoRoyaleDatabase) {
            $instance = new CasinoRoyaleDatabase(cr_get_pdo());
        }
        return $instance;
    }
}

if (!function_exists('getDbConnection')) {
    function getDbConnection(): PDO
    {
        return cr_get_pdo();
    }
}

if (!function_exists('getDbTablesOverview')) {
    /**
     * @return array<string, mixed>
     */
    function getDbTablesOverview(): array
    {
        $db = cr_db();
        $db->ensureSchema();
        return [
            'connection' => cr_test_connection(),
            'tables' => $db->getTablesSummary(),
            'paymentSummary' => $db->getPaymentSummary(),
        ];
    }
}

if (!function_exists('submitDepositDb')) {
    /**
     * @return array<string, mixed>
     */
    function submitDepositDb(
        string $uid,
        string $playerId,
        int $amountUgx,
        string $provider = 'MTN Mobile Money',
        string $phoneNumber = '',
        string $note = '',
        string $initialStatus = 'Verified',
        string $externalRef = '',
        ?string $customReference = null,
        string $txType = 'Deposit'
    ): array {
        return cr_db()->recordDeposit(
            $uid,
            $playerId,
            $amountUgx,
            $provider,
            $phoneNumber,
            $note,
            $initialStatus,
            $externalRef,
            $customReference,
            $txType
        );
    }
}

if (!function_exists('submitWithdrawalDb')) {
    /**
     * @return array<string, mixed>
     */
    function submitWithdrawalDb(
        string $uid,
        string $playerId,
        int $amountUgx,
        string $provider = 'MTN Mobile Money',
        string $phoneNumber = '',
        string $note = ''
    ): array {
        return cr_db()->requestWithdrawal($uid, $playerId, $amountUgx, $provider, $phoneNumber, $note);
    }
}

if (!function_exists('settleWithdrawalDb')) {
    /**
     * @return array<string, mixed>
     */
    function settleWithdrawalDb(string $txId, string $decision, string $adminUid = 'cpanel_admin'): array
    {
        return cr_db()->settleWithdrawal($txId, $decision, $adminUid);
    }
}

if (!function_exists('listTransactionsDb')) {
    /**
     * @return array<int, array<string, mixed>>
     */
    function listTransactionsDb(int $limit = 100, ?string $uid = null): array
    {
        return cr_db()->listTransactions($limit, $uid);
    }
}

if (!function_exists('cr_is_public_https_host')) {
    function cr_is_public_https_host(string $rawHost): ?string
    {
        $withProto = preg_match('/^https?:\/\//i', $rawHost) ? $rawHost : 'https://' . $rawHost;
        $parts = parse_url($withProto);
        if (!is_array($parts) || empty($parts['host']) || strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            return null;
        }
        $host = strtolower((string) $parts['host']);
        if ($host === 'localhost' || str_ends_with($host, '.local') || $host === '::1') {
            return null;
        }
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $isPublic = filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
            );
            if ($isPublic === false) {
                return null;
            }
        }
        return $host;
    }
}

if (!function_exists('testCpanelDatabasesUapi')) {
    /**
     * Queries Spaceship cPanel UAPI for configured MySQL & PostgreSQL databases.
     *
     * @return array<string, mixed>
     */
    function testCpanelDatabasesUapi(): array
    {
        $cfg = cr_get_config();
        /** @var array<string, mixed> $cpanel */
        $cpanel = $cfg['cpanel'];
        $rawHost = (string) ($cpanel['host'] ?? '');
        $user = (string) ($cpanel['user'] ?? '');
        $token = (string) ($cpanel['api_token'] ?? '');
        $port = max(1, min(65535, (int) ($cpanel['port'] ?? 2083)));

        if ($rawHost === '' || $user === '' || $token === '') {
            return [
                'configured' => false,
                'connected' => false,
                'mysqlDatabases' => [],
                'postgresDatabases' => [],
                'message' => 'CPANEL_HOST, CPANEL_USER, and CPANEL_API_TOKEN are not configured.',
            ];
        }

        $safeHost = cr_is_public_https_host($rawHost);
        if ($safeHost === null) {
            return [
                'configured' => true,
                'connected' => false,
                'mysqlDatabases' => [],
                'postgresDatabases' => [],
                'message' => 'CPANEL_HOST must be a valid public HTTPS hostname.',
            ];
        }

        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 8,
                'header' => "Authorization: cpanel {$user}:{$token}\r\nAccept: application/json\r\n",
            ],
        ]);

        $mysqlRaw = @file_get_contents("https://{$safeHost}:{$port}/execute/Mysql/list_databases", false, $ctx);
        $pgRaw = @file_get_contents("https://{$safeHost}:{$port}/execute/Postgresql/list_databases", false, $ctx);

        if ($mysqlRaw === false) {
            return [
                'configured' => true,
                'connected' => false,
                'host' => $safeHost,
                'mysqlDatabases' => [],
                'postgresDatabases' => [],
                'message' => "Unable to connect to Spaceship cPanel UAPI on {$safeHost}:{$port}.",
            ];
        }

        $mysqlJson = json_decode($mysqlRaw, true);
        $mysqlDbs = [];
        if (is_array($mysqlJson['data'] ?? null)) {
            foreach ($mysqlJson['data'] as $item) {
                if (!empty($item['database'])) {
                    $mysqlDbs[] = (string) $item['database'];
                }
            }
        }

        $pgDbs = [];
        if ($pgRaw !== false) {
            $pgJson = json_decode($pgRaw, true);
            if (is_array($pgJson['data'] ?? null)) {
                foreach ($pgJson['data'] as $item) {
                    if (!empty($item['database'])) {
                        $pgDbs[] = (string) $item['database'];
                    }
                }
            }
        }

        return [
            'configured' => true,
            'connected' => true,
            'host' => $safeHost,
            'mysqlDatabases' => $mysqlDbs,
            'postgresDatabases' => $pgDbs,
            'message' => sprintf(
                'Connected to %s (%d MySQL, %d PostgreSQL databases).',
                $safeHost,
                count($mysqlDbs),
                count($pgDbs)
            ),
        ];
    }
}

if (PHP_SAPI !== 'cli' && basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'db.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access to db.php is disabled. Include it from server scripts.']);
    exit;
}
