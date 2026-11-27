<?php
/**
 * CASINO ROYALE — MarzPay Mobile Money API Client (Spaceship cPanel PHP)
 * Credentials are read strictly from config.php / server environment variables.
 * Uses HTTP Basic Authentication (MARZPAY_API_KEY : MARZPAY_API_SECRET).
 */

declare(strict_types=1);

require_once __DIR__ . '/config.php';

if (PHP_SAPI !== 'cli' && basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'marzpay.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access to marzpay.php is forbidden.']);
    exit;
}

function cr_marzpay_is_configured(): bool
{
    $cfg = cr_get_config();
    $mp = $cfg['marzpay'] ?? [];
    return !empty($mp['api_key']) && !empty($mp['api_secret']);
}

function cr_marzpay_base_url(): string
{
    $cfg = cr_get_config();
    $raw = (string) ($cfg['marzpay']['base_url'] ?? 'https://wallet.wearemarz.com/api/v1');
    $parts = parse_url($raw);
    if (!is_array($parts)) {
        throw new RuntimeException('Invalid MARZPAY_BASE_URL configuration.');
    }
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    $allowedHost = $host === 'wearemarz.com' || str_ends_with($host, '.wearemarz.com');
    if ($scheme !== 'https' || !$allowedHost) {
        throw new RuntimeException('MARZPAY_BASE_URL must be an official HTTPS wearemarz.com URL.');
    }
    $path = isset($parts['path']) ? rtrim((string) $parts['path'], '/') : '/api/v1';
    return "https://{$host}{$path}";
}

function cr_marzpay_normalize_ug_phone(string $rawPhone): string
{
    $clean = preg_replace('/[^\d+]/', '', $rawPhone) ?? '';
    if (preg_match('/^\+256\d{9}$/', $clean)) {
        return $clean;
    }
    if (preg_match('/^256\d{9}$/', $clean)) {
        return '+' . $clean;
    }
    if (preg_match('/^0\d{9}$/', $clean)) {
        return '+256' . substr($clean, 1);
    }
    if (preg_match('/^[73]\d{8}$/', $clean)) {
        return '+256' . $clean;
    }
    throw new InvalidArgumentException('Enter a valid Ugandan Mobile Money number (e.g. +256772123456 or 0772123456).');
}

function cr_marzpay_uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function cr_marzpay_map_status(mixed $raw): string
{
    $s = strtolower(trim((string) $raw));
    if (in_array($s, ['completed', 'successful', 'success', 'paid'], true)) {
        return 'completed';
    }
    if (in_array($s, ['failed', 'rejected', 'cancelled', 'expired', 'error'], true)) {
        return 'failed';
    }
    return 'pending';
}

function cr_marzpay_safe_callback_url(): ?string
{
    $appUrl = cr_env('APP_URL');
    if ($appUrl === '') {
        return null;
    }
    $parts = parse_url($appUrl);
    if (!is_array($parts)) {
        return null;
    }
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    if ($scheme !== 'https' || $host === '' || $host === 'localhost' || str_ends_with($host, '.local')) {
        return null;
    }
    if (filter_var($host, FILTER_VALIDATE_IP) && !filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return null;
    }
    return "https://{$host}/api.php?action=marzpay-webhook";
}

function cr_marzpay_detect_outbound_ip(): ?string
{
    if (!function_exists('curl_init')) {
        return null;
    }
    $ch = curl_init('https://api.ipify.org?format=json');
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    $ip = is_array($decoded) && is_string($decoded['ip'] ?? null) ? trim($decoded['ip']) : '';
    return ($ip !== '' && filter_var($ip, FILTER_VALIDATE_IP)) ? $ip : null;
}

/**
 * @param array<string, mixed>|null $payload
 * @return array<string, mixed>
 */
function cr_marzpay_request(string $method, string $endpointPath, ?array $payload = null): array
{
    if (!function_exists('curl_init')) {
        throw new RuntimeException('PHP cURL extension is required for MarzPay API requests.');
    }

    $cfg = cr_get_config();
    $apiKey = (string) ($cfg['marzpay']['api_key'] ?? '');
    $apiSecret = (string) ($cfg['marzpay']['api_secret'] ?? '');
    if ($apiKey === '' || $apiSecret === '') {
        throw new RuntimeException('MarzPay API credentials (MARZPAY_API_KEY and MARZPAY_API_SECRET) are not configured.');
    }

    $baseUrl = cr_marzpay_base_url();
    $url = $baseUrl . (str_starts_with($endpointPath, '/') ? $endpointPath : '/' . $endpointPath);

    $headers = [
        'Authorization: Basic ' . base64_encode($apiKey . ':' . $apiSecret),
        'Accept: application/json',
    ];

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Failed to initialize HTTP client for MarzPay.');
    }

    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 18,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
    ];

    if ($payload !== null) {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_POSTFIELDS] = $json === false ? '{}' : $json;
    }

    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);

    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('MarzPay API request failed: ' . $curlErr);
    }

    $decoded = json_decode((string) $raw, true);
    if (!is_array($decoded)) {
        $decoded = ['message' => substr((string) $raw, 0, 240)];
    }

    if ($httpCode < 200 || $httpCode >= 300) {
        $errMsg = (string) ($decoded['message'] ?? $decoded['error'] ?? "MarzPay API returned HTTP {$httpCode}.");
        if (preg_match('/not whitelisted|ip whitelist/i', $errMsg)) {
            $reportedIp = is_string($decoded['ip'] ?? null) && filter_var(trim($decoded['ip']), FILTER_VALIDATE_IP)
                ? trim($decoded['ip'])
                : cr_marzpay_detect_outbound_ip();
            if ($reportedIp !== null) {
                $errMsg .= " (Server outbound IP: {$reportedIp})";
            }
        }
        throw new RuntimeException($errMsg);
    }

    return $decoded;
}

/**
 * MarzPay requires each metadata entry to contain exactly one custom field name (plus optional isPII).
 *
 * @param array<int, array<string, mixed>> $extraMetadata
 * @return array<int, array<string, mixed>>
 */
function cr_marzpay_format_metadata(string $reference, array $extraMetadata = []): array
{
    $normalized = [['casinoReference' => $reference]];
    foreach ($extraMetadata as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $hasIsPii = array_key_exists('isPII', $entry);
        $isPii = $hasIsPii ? (bool) $entry['isPII'] : null;
        $fields = [];
        foreach ($entry as $k => $v) {
            if (!is_string($k) || $k === '' || $k === 'isPII' || $v === null || $v === '') {
                continue;
            }
            if (is_scalar($v)) {
                $fields[$k] = $v;
            }
        }
        if (count($fields) === 1) {
            foreach ($fields as $fk => $fv) {
                $item = [$fk => $fv];
                if ($hasIsPii) {
                    $item['isPII'] = $isPii;
                }
                $normalized[] = $item;
            }
        } else {
            foreach ($fields as $fk => $fv) {
                $normalized[] = [$fk => $fv];
            }
        }
        if (count($normalized) >= 9) {
            break;
        }
    }
    return array_slice($normalized, 0, 9);
}

/**
 * @param array<int, array<string, mixed>> $metadata
 * @return array<string, mixed>
 */
function cr_marzpay_collect_money(int $amountUgx, string $phoneNumber, string $reference, string $description, array $metadata = []): array
{
    $cfg = cr_get_config();
    $country = strtoupper((string) ($cfg['marzpay']['country'] ?? 'UG'));
    $normalizedPhone = cr_marzpay_normalize_ug_phone($phoneNumber);
    $uuidRef = cr_marzpay_uuid_v4();

    $body = [
        'amount' => $amountUgx,
        'phone_number' => $normalizedPhone,
        'country' => $country ?: 'UG',
        'reference' => $uuidRef,
        'description' => substr($description, 0, 160),
        'metadata' => cr_marzpay_format_metadata($reference, $metadata),
    ];
    $callback = cr_marzpay_safe_callback_url();
    if ($callback !== null) {
        $body['callback_url'] = $callback;
    }

    $res = cr_marzpay_request('POST', '/collect-money', $body);
    $data = is_array($res['data'] ?? null) ? $res['data'] : $res;
    $txObj = is_array($data['transaction'] ?? null) ? $data['transaction'] : $data;

    return [
        'uuid' => (string) ($txObj['uuid'] ?? $txObj['id'] ?? $uuidRef),
        'reference' => $reference,
        'status' => cr_marzpay_map_status($txObj['status'] ?? ($res['status'] ?? 'pending')),
        'phoneNumber' => $normalizedPhone,
        'amountUgx' => $amountUgx,
        'message' => (string) ($res['message'] ?? 'Collection prompt sent to Mobile Money handset.'),
    ];
}

/**
 * @param array<int, array<string, mixed>> $metadata
 * @return array<string, mixed>
 */
function cr_marzpay_send_money(int $amountUgx, string $phoneNumber, string $reference, string $description, array $metadata = []): array
{
    $cfg = cr_get_config();
    $country = strtoupper((string) ($cfg['marzpay']['country'] ?? 'UG'));
    $normalizedPhone = cr_marzpay_normalize_ug_phone($phoneNumber);
    $uuidRef = cr_marzpay_uuid_v4();

    $body = [
        'amount' => $amountUgx,
        'phone_number' => $normalizedPhone,
        'country' => $country ?: 'UG',
        'reference' => $uuidRef,
        'description' => substr($description, 0, 160),
        'metadata' => cr_marzpay_format_metadata($reference, $metadata),
    ];
    $callback = cr_marzpay_safe_callback_url();
    if ($callback !== null) {
        $body['callback_url'] = $callback;
    }

    $res = cr_marzpay_request('POST', '/send-money', $body);
    $data = is_array($res['data'] ?? null) ? $res['data'] : $res;
    $txObj = is_array($data['transaction'] ?? null) ? $data['transaction'] : $data;

    return [
        'uuid' => (string) ($txObj['uuid'] ?? $txObj['id'] ?? $uuidRef),
        'reference' => $reference,
        'status' => cr_marzpay_map_status($txObj['status'] ?? ($res['status'] ?? 'pending')),
        'phoneNumber' => $normalizedPhone,
        'amountUgx' => $amountUgx,
        'message' => (string) ($res['message'] ?? 'Disbursement initiated via MarzPay.'),
    ];
}

/**
 * @return array<string, mixed>
 */
function cr_marzpay_get_transaction(string $uuid): array
{
    $cleanUuid = trim($uuid);
    if (!preg_match('/^[a-zA-Z0-9_-]{8,128}$/', $cleanUuid)) {
        throw new InvalidArgumentException('Invalid MarzPay transaction identifier.');
    }
    $res = cr_marzpay_request('GET', '/transactions/' . rawurlencode($cleanUuid));
    $data = is_array($res['data'] ?? null) ? $res['data'] : $res;
    $txObj = is_array($data['transaction'] ?? null) ? $data['transaction'] : $data;
    return [
        'uuid' => (string) ($txObj['uuid'] ?? $cleanUuid),
        'reference' => (string) ($txObj['reference'] ?? ''),
        'status' => cr_marzpay_map_status($txObj['status'] ?? ($res['status'] ?? 'pending')),
        'raw' => $txObj,
    ];
}

/**
 * @return array<string, mixed>
 */
function cr_marzpay_get_balance(): array
{
    if (!cr_marzpay_is_configured()) {
        return [
            'configured' => false,
            'connected' => false,
            'currency' => 'UGX',
            'message' => 'MARZPAY_API_KEY and MARZPAY_API_SECRET are not set in server environment.',
        ];
    }
    try {
        $res = cr_marzpay_request('GET', '/balance');
        $data = is_array($res['data'] ?? null) ? $res['data'] : $res;
        $bal = $data['balance'] ?? ($data['available_balance'] ?? 0);
        if (is_array($bal)) {
            $bal = $bal['raw'] ?? ($bal['available'] ?? 0);
        }
        return [
            'configured' => true,
            'connected' => true,
            'currency' => (string) ($data['currency'] ?? 'UGX'),
            'availableBalanceUgx' => is_numeric($bal) ? (int) round((float) $bal) : null,
            'message' => 'Connected to MarzPay API (wallet.wearemarz.com).',
        ];
    } catch (Throwable $e) {
        return [
            'configured' => true,
            'connected' => false,
            'currency' => 'UGX',
            'message' => 'MarzPay API check failed: ' . $e->getMessage(),
        ];
    }
}

function cr_marzpay_verify_webhook_signature(string $rawBody, string $signatureHeader, string $timestampHeader = ''): bool
{
    $cfg = cr_get_config();
    $secret = (string) ($cfg['marzpay']['webhook_secret'] ?? '');
    if ($secret === '') {
        return false;
    }
    $provided = strtolower(trim((string) preg_replace('/^sha256=/i', '', $signatureHeader)));
    if ($provided === '') {
        return false;
    }
    $candidates = $timestampHeader !== '' ? ["{$timestampHeader}.{$rawBody}", $rawBody] : [$rawBody];
    foreach ($candidates as $candidate) {
        $expected = strtolower(hash_hmac('sha256', $candidate, $secret));
        if (hash_equals($expected, $provided)) {
            return true;
        }
    }
    return false;
}
