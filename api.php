<?php
/**
 * CASINO ROYALE — Spaceship cPanel PHP REST API Endpoint
 * Serves both REST routes (/api/* rewritten by .htaccess) and ?action=* calls
 * for Apache/LiteSpeed cPanel hosting without Node.js.
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/marzpay.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store, no-cache, must-revalidate');

const CR_VALID_PROVIDERS = [
    'MTN Mobile Money',
    'Airtel Money',
    'MTN',
    'Airtel',
    'System',
];

const CR_BOOTSTRAPPED_ADMIN_EMAILS = [
    'makaug171@gmail.com',
    'markniaras@gmail.com',
];

function cr_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * @return array<string, mixed>
 */
function cr_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    if (strlen($raw) > 6 * 1024 * 1024) {
        cr_json(413, ['ok' => false, 'error' => 'Request payload too large.']);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        cr_json(400, ['ok' => false, 'error' => 'Invalid JSON request body.']);
    }
    return $decoded;
}

function cr_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function cr_base64url_decode(string $data): string|false
{
    $rem = strlen($data) % 4;
    $padded = $rem === 0 ? $data : $data . str_repeat('=', 4 - $rem);
    return base64_decode(strtr($padded, '-_', '+/'), true);
}

function cr_upsert_kv(string $key, array $value): void
{
    $pdo = getDbConnection();
    $nowMs = (int) round(microtime(true) * 1000);
    $driver = cr_db()->getDriver();
    $json = (string) json_encode($value);
    if ($driver === 'pgsql') {
        $stmt = $pdo->prepare(
            'INSERT INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)
             ON CONFLICT (state_key) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at'
        );
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at)'
        );
    }
    $stmt->execute([$key, $json, $nowMs]);
}

/**
 * @return array<string, mixed>|null
 */
function cr_get_kv(string $key): ?array
{
    $pdo = getDbConnection();
    $stmt = $pdo->prepare('SELECT state_json FROM cr_kv_state WHERE state_key = ? LIMIT 1');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (is_array($row) && !empty($row['state_json'])) {
        $decoded = json_decode((string) $row['state_json'], true);
        if (is_array($decoded)) {
            return $decoded;
        }
    }
    return null;
}

function cr_get_signing_secret(): string
{
    $envSecret = cr_env('SESSION_SECRET');
    if ($envSecret !== '') {
        return $envSecret;
    }

    $pdo = getDbConnection();
    cr_db()->ensureSchema();
    $existing = cr_get_kv('php_api_signing_secret');
    if (is_array($existing) && !empty($existing['secret'])) {
        return (string) $existing['secret'];
    }

    $generated = bin2hex(random_bytes(32));
    $nowMs = (int) round(microtime(true) * 1000);
    $driver = cr_db()->getDriver();
    if ($driver === 'pgsql') {
        $ins = $pdo->prepare(
            'INSERT INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)
             ON CONFLICT (state_key) DO NOTHING'
        );
    } else {
        $ins = $pdo->prepare(
            'INSERT IGNORE INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)'
        );
    }
    $ins->execute(['php_api_signing_secret', json_encode(['secret' => $generated]), $nowMs]);

    $recheck = cr_get_kv('php_api_signing_secret');
    if (is_array($recheck) && !empty($recheck['secret'])) {
        return (string) $recheck['secret'];
    }

    return $generated;
}

/**
 * @param array<string, mixed> $claims
 */
function cr_issue_token(array $claims): string
{
    $payload = array_merge($claims, ['exp' => time() + (60 * 60 * 12)]);
    $encoded = cr_base64url_encode((string) json_encode($payload));
    $sig = cr_base64url_encode(hash_hmac('sha256', $encoded, cr_get_signing_secret(), true));
    return $encoded . '.' . $sig;
}

/**
 * @return array<string, mixed>|null
 */
function cr_verify_token(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }
    [$encoded, $sig] = $parts;
    if ($encoded === '' || $sig === '') {
        return null;
    }
    $expected = cr_base64url_encode(hash_hmac('sha256', $encoded, cr_get_signing_secret(), true));
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $raw = cr_base64url_decode($encoded);
    if ($raw === false) {
        return null;
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed) || empty($parsed['uid']) || empty($parsed['exp']) || (int) $parsed['exp'] < time()) {
        return null;
    }
    return $parsed;
}

/**
 * @return array<string, mixed>
 */
function cr_require_auth(): array
{
    $authHeader = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($authHeader === '' && function_exists('apache_request_headers')) {
        $hdrs = apache_request_headers();
        if (is_array($hdrs)) {
            $authHeader = (string) ($hdrs['Authorization'] ?? $hdrs['authorization'] ?? '');
        }
    }
    $token = str_starts_with($authHeader, 'Bearer ') ? trim(substr($authHeader, 7)) : '';
    $claims = $token !== '' ? cr_verify_token($token) : null;
    if ($claims === null) {
        cr_json(401, ['ok' => false, 'error' => 'Authentication required. Please sign in.']);
    }

    $pdo = getDbConnection();
    $stmt = $pdo->prepare('SELECT uid, role, account_status, player_id, email, full_name FROM cr_users WHERE uid = ? LIMIT 1');
    $stmt->execute([(string) $claims['uid']]);
    $user = $stmt->fetch();
    if (!is_array($user) || ($user['account_status'] ?? '') === 'Suspended') {
        cr_json(403, ['ok' => false, 'error' => 'Account inactive or suspended.']);
    }
    return $user;
}

/**
 * @return array<string, mixed>
 */
function cr_require_admin(): array
{
    $user = cr_require_auth();
    if (($user['role'] ?? 'player') !== 'admin') {
        cr_json(403, ['ok' => false, 'error' => 'Administrator privileges required.']);
    }
    return $user;
}

function cr_write_admin_log(string $adminUid, string $adminEmail, string $action, string $targetType, string $targetId, string $details): void
{
    $nowMs = (int) round(microtime(true) * 1000);
    $logId = 'log_' . base_convert((string) $nowMs, 10, 36) . '_' . bin2hex(random_bytes(2));
    $stmt = getDbConnection()->prepare(
        'INSERT INTO cr_admin_logs (log_id, admin_uid, admin_email, action, target_type, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$logId, $adminUid, $adminEmail, $action, $targetType, $targetId, substr($details, 0, 1000), $nowMs]);
}

function cr_sanitize_provider(string $raw): string
{
    $clean = trim($raw);
    if (!in_array($clean, CR_VALID_PROVIDERS, true)) {
        cr_json(400, ['ok' => false, 'error' => 'Unsupported Mobile Money provider.']);
    }
    return $clean;
}

function cr_upsert_admin_record(string $uid, string $email, string $fullName): void
{
    $pdo = getDbConnection();
    $nowMs = (int) round(microtime(true) * 1000);
    if (cr_db()->getDriver() === 'pgsql') {
        $stmt = $pdo->prepare(
            'INSERT INTO cr_administrators (uid, email, full_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, status = EXCLUDED.status'
        );
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO cr_administrators (uid, email, full_name, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email), full_name = VALUES(full_name), status = VALUES(status)'
        );
    }
    $stmt->execute([$uid, $email, $fullName, 'Super Admin', 'Active', $nowMs]);
}

function cr_resolve_route(): string
{
    $route = trim((string) ($_GET['route'] ?? $_GET['action'] ?? ''), '/');
    if ($route === '' && !empty($_SERVER['PATH_INFO'])) {
        $route = trim((string) $_SERVER['PATH_INFO'], '/');
    }
    if ($route === '' && !empty($_SERVER['REQUEST_URI'])) {
        $path = (string) parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH);
        if (preg_match('#(?:^|/)api/(.+)$#', $path, $rm)) {
            $route = trim((string) $rm[1], '/');
        }
    }
    return strtolower($route !== '' ? $route : 'health');
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$route = cr_resolve_route();

// Map legacy ?action= aliases onto unified REST routes
$aliases = [
    'register' => 'auth/register',
    'login' => 'auth/login',
    'admin-login' => 'auth/admin-login',
    'wallet' => 'wallet/transactions',
    'deposit' => 'wallet/deposit',
    'withdraw' => 'wallet/withdraw',
    'marzpay-webhook' => 'webhooks/marzpay',
    'admin-overview' => 'admin/overview',
    'admin-settle' => 'admin/settle-legacy',
    'admin-manual-deposit' => 'admin/transactions/manual',
    'admin-sync-schema' => 'admin/cpanel/sync-schema',
    'admin-cpanel-databases' => 'admin/cpanel/status',
    'admin-marzpay-status' => 'admin/marzpay/status',
];
if (isset($aliases[$route])) {
    $route = $aliases[$route];
}

try {
    // ── Health & Public Auth ────────────────────────────────────────────────
    if ($route === 'health') {
        $conn = cr_test_connection();
        cr_json($conn['connected'] ? 200 : 503, [
            'ok' => (bool) $conn['connected'],
            'driver' => $conn['driver'],
            'connected' => (bool) $conn['connected'],
            'latencyMs' => $conn['latencyMs'],
        ]);
    }

    if ($route === 'auth/admin-status' && $method === 'GET') {
        cr_db()->ensureSchema();
        $cfg = cr_get_config();
        $envPasscodeActive = !empty($cfg['admin_passcode']);
        $kv = cr_get_kv('admin_credential_hash');
        $hasStoredHash = is_array($kv) && !empty($kv['hash']);
        if (!$hasStoredHash) {
            $uStmt = getDbConnection()->prepare('SELECT payload_json FROM cr_users WHERE role = ? LIMIT 1');
            $uStmt->execute(['admin']);
            $uRow = $uStmt->fetch();
            if (is_array($uRow) && !empty($uRow['payload_json'])) {
                $p = json_decode((string) $uRow['payload_json'], true);
                if (is_array($p) && !empty($p['passwordHash'])) {
                    $hasStoredHash = true;
                }
            }
        }
        cr_json(200, [
            'adminConfigured' => $envPasscodeActive || $hasStoredHash,
            'envPasscodeActive' => $envPasscodeActive,
            'bootstrappedEmail' => CR_BOOTSTRAPPED_ADMIN_EMAILS[0],
        ]);
    }

    if ($route === 'auth/admin-claim' && $method === 'POST') {
        cr_db()->ensureSchema();
        $cfg = cr_get_config();
        $kv = cr_get_kv('admin_credential_hash');
        if (!empty($cfg['admin_passcode']) || (is_array($kv) && !empty($kv['hash']))) {
            cr_json(400, ['ok' => false, 'error' => 'Administrator credentials are already configured on the server.']);
        }
        $body = cr_body();
        $email = strtolower(trim((string) ($body['email'] ?? CR_BOOTSTRAPPED_ADMIN_EMAILS[0])));
        if (!in_array($email, CR_BOOTSTRAPPED_ADMIN_EMAILS, true)) {
            cr_json(400, ['ok' => false, 'error' => 'First-run setup must use an authorized admin email (' . CR_BOOTSTRAPPED_ADMIN_EMAILS[0] . ').']);
        }
        $password = (string) ($body['password'] ?? '');
        if (strlen($password) < 8) {
            cr_json(400, ['ok' => false, 'error' => 'Choose an administrator password with at least 8 characters.']);
        }

        $pdo = getDbConnection();
        $nowMs = (int) round(microtime(true) * 1000);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        cr_upsert_kv('admin_credential_hash', ['hash' => $hash, 'email' => $email, 'updatedAt' => $nowMs]);

        $stmt = $pdo->prepare('SELECT uid, player_id, payload_json FROM cr_users WHERE LOWER(email) = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (is_array($row)) {
            $uid = (string) $row['uid'];
            $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);
            $userObj = is_array($payload) ? $payload : [];
            $userObj['role'] = 'admin';
            $userObj['accountStatus'] = 'Active';
            $userObj['emailVerified'] = true;
            $userObj['passwordHash'] = $hash;
            $userObj['updatedAt'] = $nowMs;
            $upd = $pdo->prepare('UPDATE cr_users SET role = ?, account_status = ?, payload_json = ?, updated_at = ? WHERE uid = ?');
            $upd->execute(['admin', 'Active', json_encode($userObj), $nowMs, $uid]);
        } else {
            $uid = 'uid_admin_' . base_convert((string) $nowMs, 10, 36);
            $userObj = [
                'uid' => $uid,
                'playerId' => 'CR-ADM001',
                'fullName' => 'Royale Admin Operations',
                'email' => $email,
                'phone' => '+256700112233',
                'dateOfBirth' => '1992-01-10',
                'termsAccepted' => true,
                'emailVerified' => true,
                'phoneVerified' => true,
                'kycStatus' => 'Approved',
                'accountStatus' => 'Active',
                'role' => 'admin',
                'passwordHash' => $hash,
                'createdAt' => $nowMs,
                'updatedAt' => $nowMs,
            ];
            $ins = $pdo->prepare(
                'INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([$uid, 'CR-ADM001', 'Royale Admin Operations', $email, '+256700112233', 'admin', 'Approved', 'Active', json_encode($userObj), $nowMs]);
            $insW = $pdo->prepare(
                'INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
                 VALUES (?, ?, ?, 250000, 0, ?)'
            );
            $insW->execute([$uid, 'CR-ADM001', 'UGX', $nowMs]);
        }

        cr_upsert_admin_record($uid, $email, 'Royale Admin Operations');
        cr_write_admin_log($uid, $email, 'ADMIN_CREDENTIALS_CLAIMED', 'administrator', $uid, 'Administrator password claimed via PHP setup');

        unset($userObj['passwordHash']);
        $token = cr_issue_token(['uid' => $uid, 'email' => $email, 'role' => 'admin']);
        cr_json(200, ['ok' => true, 'token' => $token, 'user' => $userObj, 'overview' => cr_db()->getAdminOverview()]);
    }

    if ($route === 'auth/admin-login' && $method === 'POST') {
        cr_db()->ensureSchema();
        $body = cr_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $cfg = cr_get_config();
        $envPasscode = (string) ($cfg['admin_passcode'] ?? '');
        $isBootEmail = in_array($email, CR_BOOTSTRAPPED_ADMIN_EMAILS, true);

        $pdo = getDbConnection();
        $stmt = $pdo->prepare('SELECT uid, role, account_status, payload_json FROM cr_users WHERE LOWER(email) = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        $isKnownAdmin = is_array($row) && ($row['role'] ?? '') === 'admin';
        if (!$isBootEmail && !$isKnownAdmin) {
            cr_json(401, ['ok' => false, 'error' => 'This email does not have active administrator permissions.']);
        }
        if (is_array($row) && ($row['account_status'] ?? '') === 'Suspended') {
            cr_json(403, ['ok' => false, 'error' => 'Administrator account is suspended.']);
        }

        $payload = is_array($row) ? json_decode((string) ($row['payload_json'] ?? '{}'), true) : [];
        $hash = is_array($payload) ? (string) ($payload['passwordHash'] ?? '') : '';
        $kv = cr_get_kv('admin_credential_hash');
        $kvHash = is_array($kv) ? (string) ($kv['hash'] ?? '') : '';

        $verified = false;
        if ($envPasscode !== '' && $password !== '' && hash_equals($envPasscode, $password)) {
            $verified = true;
        } elseif ($kvHash !== '' && $isBootEmail && password_verify($password, $kvHash)) {
            $verified = true;
        } elseif ($hash !== '' && password_verify($password, $hash)) {
            $verified = true;
        }

        if (!$verified) {
            if ($envPasscode === '' && $kvHash === '' && $hash === '') {
                cr_json(401, ['ok' => false, 'error' => 'Set your first-run administrator password using the setup form below.']);
            }
            cr_json(401, ['ok' => false, 'error' => 'Invalid administrator email or passcode.']);
        }

        $nowMs = (int) round(microtime(true) * 1000);
        if (!is_array($row)) {
            $uid = 'uid_admin_' . base_convert((string) $nowMs, 10, 36);
            $adminObj = [
                'uid' => $uid,
                'playerId' => 'CR-ADM001',
                'fullName' => 'Royale Admin Operations',
                'email' => $email,
                'phone' => '+256700112233',
                'dateOfBirth' => '1992-01-10',
                'termsAccepted' => true,
                'emailVerified' => true,
                'phoneVerified' => true,
                'kycStatus' => 'Approved',
                'accountStatus' => 'Active',
                'role' => 'admin',
                'createdAt' => $nowMs,
                'updatedAt' => $nowMs,
            ];
            $ins = $pdo->prepare(
                'INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([$uid, 'CR-ADM001', 'Royale Admin Operations', $email, '+256700112233', 'admin', 'Approved', 'Active', json_encode($adminObj), $nowMs]);
            if (cr_db()->getDriver() === 'pgsql') {
                $pdo->prepare('INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at) VALUES (?, ?, ?, 250000, 0, ?) ON CONFLICT (uid) DO NOTHING')
                    ->execute([$uid, 'CR-ADM001', 'UGX', $nowMs]);
            } else {
                $pdo->prepare('INSERT IGNORE INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at) VALUES (?, ?, ?, 250000, 0, ?)')
                    ->execute([$uid, 'CR-ADM001', 'UGX', $nowMs]);
            }
            cr_upsert_admin_record($uid, $email, 'Royale Admin Operations');
        } else {
            $uid = (string) $row['uid'];
            $adminObj = is_array($payload) ? $payload : [];
            unset($adminObj['passwordHash']);
        }

        $token = cr_issue_token(['uid' => $uid, 'email' => $email, 'role' => 'admin']);
        cr_json(200, ['ok' => true, 'token' => $token, 'user' => $adminObj, 'overview' => cr_db()->getAdminOverview()]);
    }

    if ($route === 'auth/register' && $method === 'POST') {
        $body = cr_body();
        $fullName = trim((string) ($body['fullName'] ?? ''));
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $phone = trim((string) ($body['phone'] ?? ''));
        $dob = trim((string) ($body['dateOfBirth'] ?? '1995-01-01'));
        $password = (string) ($body['password'] ?? '');

        if ($fullName === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            cr_json(400, ['ok' => false, 'error' => 'Provide valid fullName, email, and password (min 8 chars).']);
        }
        if (in_array($email, CR_BOOTSTRAPPED_ADMIN_EMAILS, true)) {
            cr_json(403, ['ok' => false, 'error' => 'Reserved administrator email cannot register as player.']);
        }

        $pdo = getDbConnection();
        cr_db()->ensureSchema();
        $chk = $pdo->prepare('SELECT uid FROM cr_users WHERE LOWER(email) = ? LIMIT 1');
        $chk->execute([$email]);
        if ($chk->fetch()) {
            cr_json(409, ['ok' => false, 'error' => 'An account with that email already exists. Please sign in instead.']);
        }

        $nowMs = (int) round(microtime(true) * 1000);
        $uid = 'uid_' . base_convert((string) $nowMs, 10, 36) . '_' . bin2hex(random_bytes(3));
        $playerId = 'CR-' . strtoupper(substr($uid, -6));
        $cleanName = substr($fullName, 0, 120);
        $cleanPhone = substr($phone !== '' ? $phone : '+256700000000', 0, 40);
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $userPayload = [
            'uid' => $uid,
            'playerId' => $playerId,
            'fullName' => $cleanName,
            'email' => $email,
            'phone' => $cleanPhone,
            'dateOfBirth' => $dob !== '' ? $dob : '1995-01-01',
            'termsAccepted' => true,
            'emailVerified' => true,
            'phoneVerified' => false,
            'kycStatus' => 'Not Submitted',
            'accountStatus' => 'Pending',
            'role' => 'player',
            'passwordHash' => $passwordHash,
            'createdAt' => $nowMs,
            'updatedAt' => $nowMs,
        ];

        $pdo->beginTransaction();
        try {
            $insU = $pdo->prepare(
                'INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insU->execute([
                $uid,
                $playerId,
                $cleanName,
                $email,
                $cleanPhone,
                'player',
                'Not Submitted',
                'Pending',
                json_encode($userPayload),
                $nowMs,
            ]);

            $insP = $pdo->prepare(
                'INSERT INTO cr_player_profiles (uid, player_id, display_name, kyc_status, account_status, total_games, games_won, games_lost, win_rate, points, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?)'
            );
            $insP->execute([
                $uid,
                $playerId,
                substr($cleanName, 0, 80),
                'Not Submitted',
                'Pending',
                $nowMs,
            ]);

            $insW = $pdo->prepare(
                'INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
                 VALUES (?, ?, ?, 0, 0, ?)'
            );
            $insW->execute([$uid, $playerId, 'UGX', $nowMs]);

            $pdo->commit();
        } catch (Throwable $txErr) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $txErr;
        }

        unset($userPayload['passwordHash']);
        $token = cr_issue_token(['uid' => $uid, 'email' => $email, 'role' => 'player']);
        $hydration = cr_db()->getPlayerHydration($uid);
        cr_json(201, ['ok' => true, 'token' => $token, 'user' => $userPayload, 'hydration' => $hydration]);
    }

    if ($route === 'auth/login' && $method === 'POST') {
        cr_db()->ensureSchema();
        $body = cr_body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        $pdo = getDbConnection();
        $stmt = $pdo->prepare('SELECT uid, role, account_status, payload_json FROM cr_users WHERE LOWER(email) = ? LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        $isBootEmail = in_array($email, CR_BOOTSTRAPPED_ADMIN_EMAILS, true);
        $isAdminAccount = $isBootEmail || (is_array($row) && ($row['role'] ?? '') === 'admin');

        if (!is_array($row) && !$isBootEmail) {
            cr_json(401, ['ok' => false, 'error' => 'Invalid email or password.']);
        }
        if (is_array($row) && ($row['account_status'] ?? '') === 'Suspended') {
            cr_json(403, ['ok' => false, 'error' => 'Account suspended.']);
        }

        $payload = is_array($row) ? json_decode((string) ($row['payload_json'] ?? '{}'), true) : [];
        $hash = is_array($payload) ? (string) ($payload['passwordHash'] ?? '') : '';

        $verified = false;
        if ($isAdminAccount) {
            $cfg = cr_get_config();
            $envPasscode = (string) ($cfg['admin_passcode'] ?? '');
            $kv = cr_get_kv('admin_credential_hash');
            $kvHash = is_array($kv) ? (string) ($kv['hash'] ?? '') : '';
            if ($envPasscode !== '' && $password !== '' && hash_equals($envPasscode, $password)) {
                $verified = true;
            } elseif ($kvHash !== '' && $isBootEmail && password_verify($password, $kvHash)) {
                $verified = true;
            } elseif ($hash !== '' && password_verify($password, $hash)) {
                $verified = true;
            }
        } else {
            $verified = $hash !== '' && password_verify($password, $hash);
        }

        if (!$verified) {
            cr_json(401, ['ok' => false, 'error' => 'Invalid email or password.']);
        }

        $nowMs = (int) round(microtime(true) * 1000);
        if (!is_array($row)) {
            $uid = 'uid_admin_' . base_convert((string) $nowMs, 10, 36);
            $userObj = [
                'uid' => $uid,
                'playerId' => 'CR-ADM001',
                'fullName' => 'Royale Admin Operations',
                'email' => $email,
                'phone' => '+256700112233',
                'dateOfBirth' => '1992-01-10',
                'termsAccepted' => true,
                'emailVerified' => true,
                'phoneVerified' => true,
                'kycStatus' => 'Approved',
                'accountStatus' => 'Active',
                'role' => 'admin',
                'createdAt' => $nowMs,
                'updatedAt' => $nowMs,
            ];
            $ins = $pdo->prepare(
                'INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([$uid, 'CR-ADM001', 'Royale Admin Operations', $email, '+256700112233', 'admin', 'Approved', 'Active', json_encode($userObj), $nowMs]);
            cr_upsert_admin_record($uid, $email, 'Royale Admin Operations');
            $role = 'admin';
        } else {
            $uid = (string) $row['uid'];
            $role = (string) ($row['role'] ?? 'player');
            $userObj = is_array($payload) ? $payload : [];
            unset($userObj['passwordHash']);
        }

        $token = cr_issue_token(['uid' => $uid, 'email' => $email, 'role' => $role]);
        $hydration = cr_db()->getPlayerHydration($uid);
        $overview = $role === 'admin' ? cr_db()->getAdminOverview() : null;
        cr_json(200, ['ok' => true, 'token' => $token, 'user' => $hydration['user'] ?? $userObj, 'hydration' => $hydration, 'overview' => $overview]);
    }

    if ($route === 'auth/demo-player' && $method === 'POST') {
        cr_db()->ensureSchema();
        $pdo = getDbConnection();
        $stmt = $pdo->prepare('SELECT uid, payload_json FROM cr_users WHERE uid = ? LIMIT 1');
        $stmt->execute(['uid_demo_player']);
        $row = $stmt->fetch();
        $nowMs = (int) round(microtime(true) * 1000);
        if (!is_array($row)) {
            $demoUser = [
                'uid' => 'uid_demo_player',
                'playerId' => 'CR-KMP001',
                'fullName' => 'Samuel Musoke',
                'email' => 'player@casinoroyale.ug',
                'phone' => '+256772100200',
                'dateOfBirth' => '1997-05-14',
                'termsAccepted' => true,
                'emailVerified' => true,
                'phoneVerified' => true,
                'kycStatus' => 'Approved',
                'accountStatus' => 'Active',
                'role' => 'player',
                'createdAt' => $nowMs,
                'updatedAt' => $nowMs,
            ];
            $insU = $pdo->prepare(
                'INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $insU->execute(['uid_demo_player', 'CR-KMP001', 'Samuel Musoke', 'player@casinoroyale.ug', '+256772100200', 'player', 'Approved', 'Active', json_encode($demoUser), $nowMs]);
            $insP = $pdo->prepare(
                'INSERT INTO cr_player_profiles (uid, player_id, display_name, kyc_status, account_status, total_games, games_won, games_lost, win_rate, points, updated_at)
                 VALUES (?, ?, ?, ?, ?, 24, 17, 7, 71.00, 1840, ?)'
            );
            $insP->execute(['uid_demo_player', 'CR-KMP001', 'Samuel Musoke', 'Approved', 'Active', $nowMs]);
            $insW = $pdo->prepare(
                'INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
                 VALUES (?, ?, ?, 45000, 0, ?)'
            );
            $insW->execute(['uid_demo_player', 'CR-KMP001', 'UGX', $nowMs]);
        }
        $hydration = cr_db()->getPlayerHydration('uid_demo_player');
        $token = cr_issue_token(['uid' => 'uid_demo_player', 'email' => 'player@casinoroyale.ug', 'role' => 'player']);
        cr_json(200, ['ok' => true, 'token' => $token, 'user' => $hydration['user'], 'hydration' => $hydration]);
    }

    if ($route === 'auth/me' && $method === 'GET') {
        $auth = cr_require_auth();
        $hydration = cr_db()->getPlayerHydration((string) $auth['uid']);
        if ($hydration === null) {
            cr_json(404, ['ok' => false, 'error' => 'Account not found.']);
        }
        $overview = ($auth['role'] ?? '') === 'admin' ? cr_db()->getAdminOverview() : null;
        cr_json(200, ['ok' => true, 'hydration' => $hydration, 'overview' => $overview]);
    }

    // ── Player Wallet & MarzPay Endpoints ───────────────────────────────────
    if ($route === 'wallet/transactions' && $method === 'GET') {
        $auth = cr_require_auth();
        $hydration = cr_db()->getPlayerHydration((string) $auth['uid']);
        cr_json(200, [
            'ok' => true,
            'wallet' => $hydration['wallet'] ?? null,
            'transactions' => $hydration['transactions'] ?? [],
        ]);
    }

    if ($route === 'wallet/deposit' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $provider = cr_sanitize_provider((string) ($body['provider'] ?? 'MTN Mobile Money'));
        $phone = trim((string) ($body['phoneNumber'] ?? ''));
        $amount = (int) round((float) ($body['amountUgx'] ?? 0));
        $note = trim((string) ($body['note'] ?? ''));

        if ($amount < CasinoRoyaleDatabase::MIN_DEPOSIT_UGX || $amount > CasinoRoyaleDatabase::MAX_DEPOSIT_UGX) {
            cr_json(400, ['ok' => false, 'error' => 'Deposit amount outside allowed UGX limits.']);
        }

        $customRef = 'CR-DEP-' . random_int(100000, 999999);
        $initialStatus = 'Verified';
        $externalRef = '';

        if (cr_marzpay_is_configured()) {
            $mp = cr_marzpay_collect_money(
                $amount,
                $phone,
                $customRef,
                'CASINO ROYALE Deposit (' . (string) $auth['player_id'] . ')',
                [['uid' => (string) $auth['uid']], ['playerId' => (string) $auth['player_id']]]
            );
            if ($mp['status'] === 'failed') {
                cr_json(400, ['ok' => false, 'error' => (string) ($mp['message'] ?? 'MarzPay collection declined.')]);
            }
            $phone = (string) $mp['phoneNumber'];
            $externalRef = (string) $mp['uuid'];
            $initialStatus = $mp['status'] === 'completed' ? 'Verified' : 'Pending';
        }

        $res = submitDepositDb(
            (string) $auth['uid'],
            (string) $auth['player_id'],
            $amount,
            $provider,
            $phone,
            $note,
            $initialStatus,
            $externalRef,
            $customRef
        );
        $db = cr_db();
        $txRow = $db->getTransactionById((string) $res['txId']) ?: [];
        $hydration = $db->getPlayerHydration((string) $auth['uid']);
        cr_json(200, [
            'ok' => true,
            'deposit' => $res,
            'tx' => $db->formatTransactionRow($txRow),
            'wallet' => $hydration['wallet'] ?? null,
        ]);
    }

    if ((preg_match('#^wallet/deposit/([^/]+)/verify$#', $route, $m) || $route === 'marzpay-verify') && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $txId = isset($m[1]) ? urldecode($m[1]) : trim((string) ($body['txId'] ?? ''));
        if ($txId === '') {
            cr_json(400, ['ok' => false, 'error' => 'txId is required.']);
        }
        $db = cr_db();
        $txRow = $db->getTransactionById($txId);
        if ($txRow === null || $txRow['tx_type'] !== 'Deposit') {
            cr_json(404, ['ok' => false, 'error' => 'Deposit transaction not found.']);
        }
        if (($auth['role'] ?? 'player') !== 'admin' && (string) $txRow['uid'] !== (string) $auth['uid']) {
            cr_json(403, ['ok' => false, 'error' => 'Forbidden.']);
        }
        $mpUuid = $db->getMarzPayUuidForTx($txId);
        if ($mpUuid === null || !cr_marzpay_is_configured()) {
            cr_json(400, ['ok' => false, 'error' => 'No live MarzPay transaction reference found for this deposit.']);
        }
        $remote = cr_marzpay_get_transaction($mpUuid);
        $settled = $db->settlePendingDeposit($txId, (string) $remote['status']);
        $updatedTx = $db->getTransactionById($txId) ?: [];
        $hydration = $db->getPlayerHydration((string) $txRow['uid']);
        cr_json(200, [
            'ok' => true,
            'deposit' => $settled,
            'tx' => $db->formatTransactionRow($updatedTx),
            'wallet' => $hydration['wallet'] ?? null,
        ]);
    }

    if ($route === 'webhooks/marzpay' && $method === 'POST') {
        $rawBody = file_get_contents('php://input');
        if ($rawBody === false) {
            $rawBody = '';
        }
        $cfg = cr_get_config();
        $webhookSecret = (string) ($cfg['marzpay']['webhook_secret'] ?? '');
        if ($webhookSecret !== '') {
            $sig = (string) ($_SERVER['HTTP_X_MARZPAY_SIGNATURE'] ?? '');
            $ts = (string) ($_SERVER['HTTP_X_MARZPAY_TIMESTAMP'] ?? '');
            if (!cr_marzpay_verify_webhook_signature($rawBody, $sig, $ts)) {
                cr_json(401, ['ok' => false, 'error' => 'Invalid MarzPay webhook signature.']);
            }
        }
        $payload = json_decode($rawBody ?: '{}', true);
        if (!is_array($payload)) {
            cr_json(400, ['ok' => false, 'error' => 'Invalid webhook JSON payload.']);
        }
        $txBlock = is_array($payload['transaction'] ?? null)
            ? $payload['transaction']
            : (is_array($payload['data']['transaction'] ?? null) ? $payload['data']['transaction'] : $payload);
        $uuid = trim((string) ($txBlock['uuid'] ?? $txBlock['id'] ?? ''));
        if ($uuid === '' || !cr_marzpay_is_configured()) {
            cr_json(400, ['ok' => false, 'error' => 'Missing MarzPay uuid or API configuration.']);
        }
        $remote = cr_marzpay_get_transaction($uuid);
        $db = cr_db();
        $matchedTxId = $db->findTxIdByMarzPayUuid($uuid);
        if ($matchedTxId === null && !empty($txBlock['reference'])) {
            $refStmt = getDbConnection()->prepare('SELECT tx_id FROM cr_transactions WHERE reference = ? LIMIT 1');
            $refStmt->execute([trim((string) $txBlock['reference'])]);
            $refRow = $refStmt->fetch();
            if (is_array($refRow) && !empty($refRow['tx_id'])) {
                $matchedTxId = (string) $refRow['tx_id'];
            }
        }
        if ($matchedTxId !== null) {
            $row = $db->getTransactionById($matchedTxId);
            if (is_array($row) && $row['tx_type'] === 'Deposit') {
                $settled = $db->settlePendingDeposit($matchedTxId, (string) $remote['status']);
                cr_json(200, ['ok' => true, 'matched' => true, 'deposit' => $settled]);
            }
            if (is_array($row) && $row['tx_type'] === 'Withdrawal' && $row['status'] === 'Pending' && ($remote['status'] ?? '') === 'completed') {
                $settled = $db->settleWithdrawal($matchedTxId, 'Paid', 'marzpay_webhook');
                cr_json(200, ['ok' => true, 'matched' => true, 'withdrawal' => $settled]);
            }
        }
        cr_json(200, ['ok' => true, 'matched' => false]);
    }

    if ($route === 'wallet/withdraw' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $provider = cr_sanitize_provider((string) ($body['provider'] ?? 'MTN Mobile Money'));
        $phone = trim((string) ($body['phoneNumber'] ?? ''));
        $amount = (int) round((float) ($body['amountUgx'] ?? 0));
        $note = trim((string) ($body['note'] ?? ''));

        $res = submitWithdrawalDb(
            (string) $auth['uid'],
            (string) $auth['player_id'],
            $amount,
            $provider,
            $phone,
            $note
        );
        $db = cr_db();
        $txRow = $db->getTransactionById((string) $res['txId']) ?: [];
        $hydration = $db->getPlayerHydration((string) $auth['uid']);
        cr_json(200, [
            'ok' => true,
            'withdrawal' => $res,
            'tx' => $db->formatTransactionRow($txRow),
            'wallet' => $hydration['wallet'] ?? null,
        ]);
    }

    if (preg_match('#^wallet/withdraw/([^/]+)/cancel$#', $route, $m) && $method === 'POST') {
        $auth = cr_require_auth();
        $res = cr_db()->cancelPendingWithdrawal((string) $auth['uid'], urldecode($m[1]));
        cr_json(200, array_merge(['ok' => true], $res));
    }

    if ($route === 'wallet/stake' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $res = cr_db()->recordGameStake(
            (string) $auth['uid'],
            (string) $auth['player_id'],
            (int) round((float) ($body['amountUgx'] ?? 0)),
            substr((string) ($body['gameLabel'] ?? 'Table Stake'), 0, 120)
        );
        cr_json(200, array_merge(['ok' => true], $res));
    }

    if ($route === 'wallet/win' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $res = cr_db()->recordMatchWin(
            (string) $auth['uid'],
            (string) $auth['player_id'],
            (int) round((float) ($body['amountUgx'] ?? 0)),
            substr((string) ($body['gameLabel'] ?? 'Match Winnings'), 0, 120)
        );
        cr_json(200, array_merge(['ok' => true], $res));
    }

    // ── KYC & Support Submissions ───────────────────────────────────────────
    if ($route === 'kyc/submit' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $uid = (string) $auth['uid'];
        $nowMs = (int) round(microtime(true) * 1000);
        $legalName = substr(trim((string) ($body['legal_name'] ?? $auth['full_name'])), 0, 120);
        $kycPayload = [
            'verification_id' => (string) ($body['verification_id'] ?? $uid),
            'uid' => $uid,
            'player_id' => (string) ($body['player_id'] ?? $auth['player_id']),
            'legal_name' => $legalName,
            'date_of_birth' => (string) ($body['date_of_birth'] ?? ''),
            'id_type' => (string) ($body['id_type'] ?? 'National ID'),
            'id_number_reference' => !empty($body['id_number_reference']) ? substr((string) $body['id_number_reference'], 0, 80) : null,
            'front_image_storage_path' => (string) ($body['front_image_storage_path'] ?? ''),
            'back_image_storage_path' => (string) ($body['back_image_storage_path'] ?? ''),
            'verification_status' => 'Pending Verification',
            'submitted_at' => $nowMs,
            'resubmission_count' => (int) ($body['resubmission_count'] ?? 0),
            'updatedAt' => $nowMs,
        ];

        $pdo = getDbConnection();
        $pdo->beginTransaction();
        try {
            if (cr_db()->getDriver() === 'pgsql') {
                $insK = $pdo->prepare(
                    'INSERT INTO cr_kyc_records (uid, verification_id, player_id, legal_name, verification_status, payload_json, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT (uid) DO UPDATE SET legal_name = EXCLUDED.legal_name, verification_status = EXCLUDED.verification_status, payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at'
                );
            } else {
                $insK = $pdo->prepare(
                    'INSERT INTO cr_kyc_records (uid, verification_id, player_id, legal_name, verification_status, payload_json, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE legal_name = VALUES(legal_name), verification_status = VALUES(verification_status), payload_json = VALUES(payload_json), updated_at = VALUES(updated_at)'
                );
            }
            $insK->execute([$uid, $kycPayload['verification_id'], $kycPayload['player_id'], $legalName, 'Pending Verification', json_encode($kycPayload), $nowMs]);

            $uSel = $pdo->prepare('SELECT payload_json FROM cr_users WHERE uid = ? LIMIT 1');
            $uSel->execute([$uid]);
            $uRow = $uSel->fetch();
            $uPayload = is_array($uRow) ? (json_decode((string) ($uRow['payload_json'] ?? '{}'), true) ?: []) : [];
            $uPayload['fullName'] = $legalName;
            $uPayload['kycStatus'] = 'Pending Verification';
            $uPayload['updatedAt'] = $nowMs;

            $updU = $pdo->prepare('UPDATE cr_users SET full_name = ?, kyc_status = ?, payload_json = ?, updated_at = ? WHERE uid = ?');
            $updU->execute([$legalName, 'Pending Verification', json_encode($uPayload), $nowMs, $uid]);
            $updP = $pdo->prepare('UPDATE cr_player_profiles SET display_name = ?, kyc_status = ?, updated_at = ? WHERE uid = ?');
            $updP->execute([substr($legalName, 0, 80), 'Pending Verification', $nowMs, $uid]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        cr_json(200, ['ok' => true, 'hydration' => cr_db()->getPlayerHydration($uid)]);
    }

    if ($route === 'support/tickets' && $method === 'POST') {
        $auth = cr_require_auth();
        $body = cr_body();
        $nowMs = (int) round(microtime(true) * 1000);
        $ticketId = 'tkt_' . base_convert((string) $nowMs, 10, 36) . '_' . bin2hex(random_bytes(2));
        $ticket = [
            'ticketId' => $ticketId,
            'uid' => (string) $auth['uid'],
            'playerId' => (string) $auth['player_id'],
            'playerName' => (string) $auth['full_name'],
            'name' => (string) $auth['full_name'],
            'email' => (string) $auth['email'],
            'subject' => substr((string) ($body['subject'] ?? 'Support Request'), 0, 120),
            'category' => substr((string) ($body['category'] ?? 'General'), 0, 60),
            'message' => substr((string) ($body['message'] ?? ''), 0, 1500),
            'status' => 'Open',
            'createdAt' => $nowMs,
            'updatedAt' => $nowMs,
        ];
        $ins = getDbConnection()->prepare(
            'INSERT INTO cr_support_tickets (ticket_id, uid, subject, status, payload_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $ins->execute([$ticketId, (string) $auth['uid'], $ticket['subject'], 'Open', json_encode($ticket), $nowMs]);
        cr_json(200, ['ok' => true, 'ticket' => $ticket]);
    }

    // ── Admin & Spaceship cPanel Database Access Endpoints ──────────────────
    if ($route === 'admin/overview' && $method === 'GET') {
        cr_require_admin();
        cr_json(200, ['ok' => true, 'overview' => cr_db()->getAdminOverview()]);
    }

    if ($route === 'admin/transactions' && $method === 'GET') {
        cr_require_admin();
        $ov = cr_db()->getAdminOverview();
        cr_json(200, [
            'ok' => true,
            'transactions' => array_values((array) $ov['transactions']),
            'wallets' => $ov['wallets'],
            'users' => $ov['users'],
        ]);
    }

    if ((preg_match('#^admin/transactions/([^/]+)/settle$#', $route, $m) || $route === 'admin/settle-legacy') && $method === 'POST') {
        $admin = cr_require_admin();
        $body = cr_body();
        $txId = isset($m[1]) ? urldecode($m[1]) : trim((string) ($body['txId'] ?? ''));
        $decision = ($body['decision'] ?? '') === 'Paid' ? 'Paid' : (($body['decision'] ?? '') === 'Rejected' ? 'Rejected' : '');
        if ($txId === '' || $decision === '') {
            cr_json(400, ['ok' => false, 'error' => 'Provide txId and decision (Paid or Rejected).']);
        }

        $mpPayoutUuid = '';
        $db = cr_db();
        if ($decision === 'Paid' && cr_marzpay_is_configured()) {
            $txRow = $db->getTransactionById($txId);
            if (!is_array($txRow) || $txRow['tx_type'] !== 'Withdrawal' || $txRow['status'] !== 'Pending') {
                cr_json(400, ['ok' => false, 'error' => 'Pending withdrawal transaction not found.']);
            }
            $payoutPhone = trim((string) ($txRow['phone_number'] ?? ''));
            if ($payoutPhone === '') {
                cr_json(400, ['ok' => false, 'error' => 'Recipient phone number missing for MarzPay payout.']);
            }
            $netPayout = (int) ($txRow['net_payout_ugx'] ?: $txRow['amount_ugx']);
            $mpRes = cr_marzpay_send_money(
                $netPayout,
                $payoutPhone,
                (string) $txRow['reference'],
                'CASINO ROYALE Payout ' . (string) $txRow['reference'],
                [['txId' => $txId], ['uid' => (string) $txRow['uid']]]
            );
            if ($mpRes['status'] === 'failed') {
                cr_json(400, ['ok' => false, 'error' => (string) ($mpRes['message'] ?? 'MarzPay disbursement declined.')]);
            }
            $mpPayoutUuid = (string) $mpRes['uuid'];
            $db->saveMarzPayRef($txId, $mpPayoutUuid);
        }

        $res = settleWithdrawalDb($txId, $decision, (string) $admin['uid']);
        $updatedTx = $db->getTransactionById($txId) ?: [];
        $hydration = $db->getPlayerHydration((string) ($updatedTx['uid'] ?? ''));
        cr_write_admin_log(
            (string) $admin['uid'],
            (string) $admin['email'],
            $decision === 'Paid' ? 'APPROVE_WITHDRAWAL' : 'REJECT_WITHDRAWAL',
            'transaction',
            $txId,
            "Settled withdrawal {$txId} as {$decision} via api.php" . ($mpPayoutUuid !== '' ? " (MarzPay {$mpPayoutUuid})" : '')
        );
        cr_json(200, [
            'ok' => true,
            'settlement' => $res,
            'tx' => $db->formatTransactionRow($updatedTx),
            'wallet' => $hydration['wallet'] ?? null,
        ]);
    }

    if ($route === 'admin/transactions/manual' && $method === 'POST') {
        $admin = cr_require_admin();
        $body = cr_body();
        $targetUid = trim((string) ($body['targetUid'] ?? ''));
        $amount = (int) round((float) ($body['amountUgx'] ?? 0));
        $provider = cr_sanitize_provider((string) ($body['provider'] ?? 'MTN Mobile Money'));
        $kind = ($body['kind'] ?? '') === 'Admin Adjustment' ? 'Admin Adjustment' : 'Deposit';
        $note = trim((string) ($body['note'] ?? 'Credited via Spaceship cPanel API'));

        if ($targetUid === '') {
            cr_json(400, ['ok' => false, 'error' => 'targetUid is required.']);
        }

        $uStmt = getDbConnection()->prepare('SELECT uid, player_id, phone, full_name FROM cr_users WHERE uid = ? LIMIT 1');
        $uStmt->execute([$targetUid]);
        $targetUser = $uStmt->fetch();
        if (!is_array($targetUser)) {
            cr_json(404, ['ok' => false, 'error' => 'Target user not found.']);
        }

        $res = submitDepositDb(
            $targetUid,
            (string) $targetUser['player_id'],
            $amount,
            $provider,
            (string) ($targetUser['phone'] ?? ''),
            $note,
            'Verified',
            '',
            null,
            $kind
        );
        $db = cr_db();
        $txRow = $db->getTransactionById((string) $res['txId']) ?: [];
        $hydration = $db->getPlayerHydration($targetUid);
        cr_write_admin_log(
            (string) $admin['uid'],
            (string) $admin['email'],
            'CPANEL_WALLET_CREDIT',
            'transaction',
            (string) $res['txId'],
            "Credited UGX {$amount} ({$res['reference']}) to {$targetUser['full_name']}"
        );
        cr_json(200, [
            'ok' => true,
            'deposit' => $res,
            'tx' => $db->formatTransactionRow($txRow),
            'wallet' => $hydration['wallet'] ?? null,
        ]);
    }

    if (preg_match('#^admin/kyc/([^/]+)/decision$#', $route, $m) && $method === 'POST') {
        $admin = cr_require_admin();
        $targetUid = urldecode($m[1]);
        $body = cr_body();
        $status = (string) ($body['status'] ?? '');
        $allowed = ['Approved', 'Rejected', 'Resubmission Required', 'Suspended'];
        if (!in_array($status, $allowed, true)) {
            cr_json(400, ['ok' => false, 'error' => 'Invalid KYC decision status.']);
        }
        $pdo = getDbConnection();
        $kStmt = $pdo->prepare('SELECT payload_json FROM cr_kyc_records WHERE uid = ? LIMIT 1');
        $kStmt->execute([$targetUid]);
        $kRow = $kStmt->fetch();
        if (!is_array($kRow)) {
            cr_json(404, ['ok' => false, 'error' => 'KYC record not found.']);
        }
        $nowMs = (int) round(microtime(true) * 1000);
        $kycObj = json_decode((string) $kRow['payload_json'], true) ?: [];
        $kycObj['verification_status'] = $status;
        $kycObj['reviewed_at'] = gmdate('c');
        $kycObj['reviewed_by'] = (string) $admin['uid'];
        if (!empty($body['reason'])) {
            $kycObj['rejection_reason'] = substr(trim((string) $body['reason']), 0, 500);
        }
        $kycObj['updatedAt'] = $nowMs;
        $accStatus = $status === 'Approved' ? 'Active' : ($status === 'Suspended' ? 'Suspended' : 'Pending');

        $pdo->beginTransaction();
        try {
            $uSel = $pdo->prepare('SELECT payload_json FROM cr_users WHERE uid = ? LIMIT 1');
            $uSel->execute([$targetUid]);
            $uRow = $uSel->fetch();
            $uPayload = is_array($uRow) ? (json_decode((string) ($uRow['payload_json'] ?? '{}'), true) ?: []) : [];
            $uPayload['kycStatus'] = $status;
            $uPayload['accountStatus'] = $accStatus;
            $uPayload['updatedAt'] = $nowMs;

            $pdo->prepare('UPDATE cr_kyc_records SET verification_status = ?, payload_json = ?, updated_at = ? WHERE uid = ?')
                ->execute([$status, json_encode($kycObj), $nowMs, $targetUid]);
            $pdo->prepare('UPDATE cr_users SET kyc_status = ?, account_status = ?, payload_json = ?, updated_at = ? WHERE uid = ?')
                ->execute([$status, $accStatus, json_encode($uPayload), $nowMs, $targetUid]);
            $pdo->prepare('UPDATE cr_player_profiles SET kyc_status = ?, account_status = ?, updated_at = ? WHERE uid = ?')
                ->execute([$status, $accStatus, $nowMs, $targetUid]);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
        cr_write_admin_log((string) $admin['uid'], (string) $admin['email'], 'KYC_' . strtoupper($status), 'identity_verification', $targetUid, "KYC -> {$status}");
        cr_json(200, ['ok' => true, 'kyc' => $kycObj]);
    }

    if (preg_match('#^admin/players/([^/]+)/status$#', $route, $m) && $method === 'POST') {
        $admin = cr_require_admin();
        $targetUid = urldecode($m[1]);
        $body = cr_body();
        $accStatus = ($body['accountStatus'] ?? '') === 'Suspended' ? 'Suspended' : 'Active';
        $nowMs = (int) round(microtime(true) * 1000);
        $pdo = getDbConnection();
        $uSel = $pdo->prepare('SELECT payload_json FROM cr_users WHERE uid = ? LIMIT 1');
        $uSel->execute([$targetUid]);
        $uRow = $uSel->fetch();
        $uPayload = is_array($uRow) ? (json_decode((string) ($uRow['payload_json'] ?? '{}'), true) ?: []) : [];
        $uPayload['accountStatus'] = $accStatus;
        $uPayload['updatedAt'] = $nowMs;

        $pdo->prepare('UPDATE cr_users SET account_status = ?, payload_json = ?, updated_at = ? WHERE uid = ?')->execute([$accStatus, json_encode($uPayload), $nowMs, $targetUid]);
        $pdo->prepare('UPDATE cr_player_profiles SET account_status = ?, updated_at = ? WHERE uid = ?')->execute([$accStatus, $nowMs, $targetUid]);
        cr_write_admin_log((string) $admin['uid'], (string) $admin['email'], 'ACCOUNT_' . strtoupper($accStatus), 'user', $targetUid, "Account -> {$accStatus}");
        $hydration = cr_db()->getPlayerHydration($targetUid);
        cr_json(200, ['ok' => true, 'user' => $hydration['user'] ?? null]);
    }

    if ($route === 'admin/cpanel/status' && $method === 'GET') {
        cr_require_admin();
        cr_json(200, [
            'ok' => true,
            'diagnostics' => cr_db()->getDiagnostics(),
            'cpanel' => testCpanelDatabasesUapi(),
        ]);
    }

    if (($route === 'admin/cpanel/sync-schema' || $route === 'admin/cpanel/test-connection') && $method === 'POST') {
        cr_require_admin();
        cr_db()->ensureSchema();
        cr_json(200, [
            'ok' => true,
            'diagnostics' => cr_db()->getDiagnostics(),
            'cpanel' => testCpanelDatabasesUapi(),
        ]);
    }

    if ($route === 'admin/marzpay/status' && $method === 'GET') {
        cr_require_admin();
        $cfg = cr_get_config();
        cr_json(200, [
            'ok' => true,
            'config' => [
                'configured' => cr_marzpay_is_configured(),
                'webhookSecretConfigured' => !empty($cfg['marzpay']['webhook_secret']),
                'baseUrl' => (string) ($cfg['marzpay']['base_url'] ?? 'https://wallet.wearemarz.com/api/v1'),
                'country' => (string) ($cfg['marzpay']['country'] ?? 'UG'),
            ],
            'balance' => cr_marzpay_get_balance(),
        ]);
    }

    if (preg_match('#^admin/support/([^/]+)/resolve$#', $route, $m) && $method === 'POST') {
        $admin = cr_require_admin();
        $ticketId = urldecode($m[1]);
        $body = cr_body();
        $reply = trim((string) ($body['reply'] ?? 'Resolved by Kampala Operations.'));
        $ticket = cr_db()->resolveSupportTicket($ticketId, $reply, (string) $admin['uid']);
        cr_write_admin_log((string) $admin['uid'], (string) $admin['email'], 'RESOLVE_TICKET', 'support_ticket', $ticketId, 'Resolved support ticket via PHP API');
        cr_json(200, ['ok' => true, 'ticket' => $ticket]);
    }

    if ($route === 'admin/settings' && $method === 'POST') {
        $admin = cr_require_admin();
        $body = cr_body();
        $updated = cr_db()->updateSystemSettings($body, (string) $admin['uid']);
        cr_write_admin_log((string) $admin['uid'], (string) $admin['email'], 'UPDATE_SETTINGS', 'system_settings', 'global', 'Updated website & game rules via PHP API');
        cr_json(200, ['ok' => true, 'systemSettings' => $updated]);
    }

    if ($route === 'admin/cpanel/export-sql' && $method === 'GET') {
        cr_require_admin();
        $sql = cr_db()->exportSqlDump();
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="casinoroyale-cpanel-' . gmdate('Y-m-d') . '.sql"');
        http_response_code(200);
        echo $sql;
        exit;
    }

    cr_json(404, ['ok' => false, 'error' => 'Unknown API route: ' . $route]);
} catch (InvalidArgumentException $e) {
    cr_json(400, ['ok' => false, 'error' => $e->getMessage()]);
} catch (RuntimeException $e) {
    cr_json(400, ['ok' => false, 'error' => $e->getMessage()]);
} catch (PDOException $e) {
    error_log('CASINO ROYALE DB PDO error: ' . $e->getMessage());
    cr_json(500, ['ok' => false, 'error' => 'Database connection or permission error. Verify DB_NAME, DB_USER, DB_PASSWORD, and cPanel ALL PRIVILEGES.']);
} catch (Throwable $e) {
    error_log('CASINO ROYALE api.php error: ' . $e->getMessage());
    cr_json(500, ['ok' => false, 'error' => 'Internal server error processing database request.']);
}
