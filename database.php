<?php
/**
 * CASINO ROYALE — Database Schema, Wallet Deposits & Withdrawals Engine (MySQL & PostgreSQL)
 */

declare(strict_types=1);

require_once __DIR__ . '/connection.php';

if (PHP_SAPI !== 'cli' && basename((string) ($_SERVER['SCRIPT_FILENAME'] ?? '')) === 'database.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct execution of database.php is disabled.']);
    exit;
}

class CasinoRoyaleDatabase
{
    public const MIN_DEPOSIT_UGX = 1000;
    public const MAX_DEPOSIT_UGX = 5000000;
    public const MIN_WITHDRAWAL_UGX = 1000;
    public const MAX_WITHDRAWAL_UGX = 5000000;
    public const WITHDRAWAL_FEE_RATE = 0.02;

    private PDO $pdo;
    private string $driver;

    public function __construct(?PDO $pdo = null)
    {
        $this->pdo = $pdo ?? cr_get_pdo();
        $this->driver = strtolower((string) $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME));
    }

    public function getPdo(): PDO
    {
        return $this->pdo;
    }

    public function getDriver(): string
    {
        return $this->driver;
    }

    public function ensureSchema(): void
    {
        $longText = $this->driver === 'pgsql' ? 'TEXT' : 'LONGTEXT';
        $statements = [
            "CREATE TABLE IF NOT EXISTS cr_users (
                uid VARCHAR(128) PRIMARY KEY,
                player_id VARCHAR(64) NOT NULL,
                full_name VARCHAR(160) NOT NULL,
                email VARCHAR(190) NOT NULL,
                phone VARCHAR(64) NOT NULL,
                role VARCHAR(32) NOT NULL DEFAULT 'player',
                kyc_status VARCHAR(48) NOT NULL DEFAULT 'Not Submitted',
                account_status VARCHAR(32) NOT NULL DEFAULT 'Pending',
                payload_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_player_profiles (
                uid VARCHAR(128) PRIMARY KEY,
                player_id VARCHAR(64) NOT NULL,
                display_name VARCHAR(120) NOT NULL,
                kyc_status VARCHAR(48) NOT NULL DEFAULT 'Not Submitted',
                account_status VARCHAR(32) NOT NULL DEFAULT 'Pending',
                total_games INT NOT NULL DEFAULT 0,
                games_won INT NOT NULL DEFAULT 0,
                games_lost INT NOT NULL DEFAULT 0,
                win_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                points INT NOT NULL DEFAULT 0,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_wallets (
                uid VARCHAR(128) PRIMARY KEY,
                player_id VARCHAR(64) NOT NULL,
                currency VARCHAR(16) NOT NULL DEFAULT 'UGX',
                available_balance BIGINT NOT NULL DEFAULT 0,
                pending_balance BIGINT NOT NULL DEFAULT 0,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_transactions (
                tx_id VARCHAR(128) PRIMARY KEY,
                uid VARCHAR(128) NOT NULL,
                player_id VARCHAR(64) NOT NULL,
                tx_type VARCHAR(48) NOT NULL,
                provider VARCHAR(64) NOT NULL,
                phone_number VARCHAR(64) NULL,
                amount_ugx BIGINT NOT NULL,
                fee_ugx BIGINT NOT NULL DEFAULT 0,
                net_payout_ugx BIGINT NOT NULL DEFAULT 0,
                balance_after BIGINT NOT NULL DEFAULT 0,
                status VARCHAR(32) NOT NULL,
                reference VARCHAR(80) NOT NULL,
                note VARCHAR(255) NULL,
                reviewed_by VARCHAR(128) NULL,
                created_at BIGINT NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_kyc_records (
                uid VARCHAR(128) PRIMARY KEY,
                verification_id VARCHAR(128) NOT NULL,
                player_id VARCHAR(64) NOT NULL,
                legal_name VARCHAR(160) NOT NULL,
                verification_status VARCHAR(48) NOT NULL,
                payload_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_tournaments (
                tournament_id VARCHAR(128) PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                game_type VARCHAR(32) NOT NULL,
                entry_fee_ugx BIGINT NOT NULL,
                status VARCHAR(48) NOT NULL,
                payload_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_support_tickets (
                ticket_id VARCHAR(128) PRIMARY KEY,
                uid VARCHAR(128) NULL,
                subject VARCHAR(200) NOT NULL,
                status VARCHAR(32) NOT NULL,
                payload_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_admin_logs (
                log_id VARCHAR(128) PRIMARY KEY,
                admin_uid VARCHAR(128) NOT NULL,
                admin_email VARCHAR(190) NOT NULL,
                action VARCHAR(80) NOT NULL,
                target_type VARCHAR(64) NULL,
                target_id VARCHAR(128) NULL,
                details TEXT NULL,
                created_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_administrators (
                uid VARCHAR(128) PRIMARY KEY,
                email VARCHAR(190) NOT NULL,
                full_name VARCHAR(160) NOT NULL,
                role VARCHAR(64) NOT NULL DEFAULT 'Super Admin',
                status VARCHAR(32) NOT NULL DEFAULT 'Active',
                created_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_system_settings (
                setting_id VARCHAR(64) PRIMARY KEY,
                brand_name VARCHAR(120) NOT NULL DEFAULT 'CASINO ROYALE',
                maintenance_mode SMALLINT NOT NULL DEFAULT 0,
                contact_phone VARCHAR(64) NOT NULL DEFAULT '+256 700 482 190',
                contact_email VARCHAR(190) NOT NULL DEFAULT 'support@casinoroyale.ug',
                payload_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
            "CREATE TABLE IF NOT EXISTS cr_kv_state (
                state_key VARCHAR(64) PRIMARY KEY,
                state_json {$longText} NOT NULL,
                updated_at BIGINT NOT NULL
            )",
        ];

        foreach ($statements as $sql) {
            $this->pdo->exec($sql);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getTablesSummary(): array
    {
        $tables = [
            'cr_users' => ['label' => 'Registered Players & Admins', 'category' => 'accounts'],
            'cr_player_profiles' => ['label' => 'Player Profiles & Points', 'category' => 'accounts'],
            'cr_wallets' => ['label' => 'UGX Player Wallets', 'category' => 'payments'],
            'cr_transactions' => ['label' => 'Deposits, Withdrawals & Ledger', 'category' => 'payments'],
            'cr_kyc_records' => ['label' => '18+ ID Verification Vault', 'category' => 'compliance'],
            'cr_tournaments' => ['label' => 'Daily & Custom Tournaments', 'category' => 'gaming'],
            'cr_support_tickets' => ['label' => 'Support Inbox Tickets', 'category' => 'operations'],
            'cr_admin_logs' => ['label' => 'Administrative Audit Logs', 'category' => 'operations'],
            'cr_administrators' => ['label' => 'Authorised Officers', 'category' => 'compliance'],
            'cr_system_settings' => ['label' => 'Platform Rules & cPanel Config', 'category' => 'operations'],
            'cr_kv_state' => ['label' => 'Synced Platform State', 'category' => 'operations'],
        ];

        $result = [];
        foreach ($tables as $tableName => $meta) {
            $count = 0;
            try {
                // Table names are whitelisted static keys from $tables above
                $stmt = $this->pdo->query("SELECT COUNT(*) AS cnt FROM {$tableName}");
                $row = $stmt ? $stmt->fetch() : false;
                $count = is_array($row) ? (int) ($row['cnt'] ?? 0) : 0;
            } catch (Throwable) {
                $count = 0;
            }
            $result[] = [
                'tableName' => $tableName,
                'label' => $meta['label'],
                'category' => $meta['category'],
                'rowCount' => $count,
            ];
        }
        return $result;
    }

    /**
     * @return array<string, int>
     */
    public function getPaymentSummary(): array
    {
        $depStmt = $this->pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_ugx), 0) AS total FROM cr_transactions WHERE tx_type = 'Deposit' AND status = 'Verified'"
        );
        $depRow = $depStmt ? $depStmt->fetch() : ['cnt' => 0, 'total' => 0];

        $pendStmt = $this->pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_ugx), 0) AS total FROM cr_transactions WHERE tx_type = 'Withdrawal' AND status = 'Pending'"
        );
        $pendRow = $pendStmt ? $pendStmt->fetch() : ['cnt' => 0, 'total' => 0];

        $paidStmt = $this->pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_ugx), 0) AS total FROM cr_transactions WHERE tx_type = 'Withdrawal' AND status = 'Paid'"
        );
        $paidRow = $paidStmt ? $paidStmt->fetch() : ['cnt' => 0, 'total' => 0];

        $walStmt = $this->pdo->query(
            'SELECT COALESCE(SUM(available_balance), 0) AS total FROM cr_wallets'
        );
        $walRow = $walStmt ? $walStmt->fetch() : ['total' => 0];

        return [
            'verifiedDepositCount' => (int) ($depRow['cnt'] ?? 0),
            'verifiedDepositsUgx' => (int) ($depRow['total'] ?? 0),
            'pendingWithdrawalCount' => (int) ($pendRow['cnt'] ?? 0),
            'pendingWithdrawalsUgx' => (int) ($pendRow['total'] ?? 0),
            'paidWithdrawalCount' => (int) ($paidRow['cnt'] ?? 0),
            'paidWithdrawalsUgx' => (int) ($paidRow['total'] ?? 0),
            'totalWalletBalanceUgx' => (int) ($walRow['total'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function recordDeposit(
        string $uid,
        string $playerId,
        int $amountUgx,
        string $provider,
        string $phoneNumber,
        string $note = '',
        string $initialStatus = 'Verified',
        string $externalRef = '',
        ?string $customReference = null
    ): array {
        if ($amountUgx < self::MIN_DEPOSIT_UGX || $amountUgx > self::MAX_DEPOSIT_UGX) {
            throw new InvalidArgumentException('Deposit amount outside allowed UGX limits.');
        }

        $safeStatus = $initialStatus === 'Pending' ? 'Pending' : 'Verified';
        $nowMs = (int) round(microtime(true) * 1000);
        $txId = 'tx_' . $nowMs . '_' . bin2hex(random_bytes(3));
        $reference = ($customReference !== null && $customReference !== '')
            ? $customReference
            : ('CR-DEP-' . random_int(100000, 999999));

        $this->pdo->beginTransaction();
        try {
            $wallet = $this->lockOrCreateWallet($uid, $playerId, $nowMs);
            $currentAvail = (int) $wallet['available_balance'];
            $nextBalance = $safeStatus === 'Verified' ? ($currentAvail + $amountUgx) : $currentAvail;

            if ($safeStatus === 'Verified') {
                $upd = $this->pdo->prepare(
                    'UPDATE cr_wallets SET available_balance = ?, updated_at = ? WHERE uid = ?'
                );
                $upd->execute([$nextBalance, $nowMs, $uid]);
            }

            $ins = $this->pdo->prepare(
                'INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $txId,
                $uid,
                $wallet['player_id'],
                'Deposit',
                $provider,
                substr($phoneNumber, 0, 64),
                $amountUgx,
                $amountUgx,
                $nextBalance,
                $safeStatus,
                $reference,
                substr($note, 0, 255),
                $nowMs,
                $nowMs,
            ]);

            $this->pdo->commit();
            if ($externalRef !== '') {
                $this->saveMarzPayRef($txId, $externalRef);
            }
            return [
                'txId' => $txId,
                'reference' => $reference,
                'externalRef' => $externalRef !== '' ? $externalRef : null,
                'amountUgx' => $amountUgx,
                'balanceAfter' => $nextBalance,
                'status' => $safeStatus,
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getTransactionById(string $txId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM cr_transactions WHERE tx_id = ? LIMIT 1');
        $stmt->execute([$txId]);
        $row = $stmt->fetch();
        return is_array($row) ? $row : null;
    }

    public function saveMarzPayRef(string $txId, string $uuid): void
    {
        $nowMs = (int) round(microtime(true) * 1000);
        $pairs = [
            "mp_tx:{$txId}" => json_encode(['txId' => $txId, 'uuid' => $uuid]),
            "mp_uuid:{$uuid}" => json_encode(['txId' => $txId, 'uuid' => $uuid]),
        ];
        foreach ($pairs as $k => $v) {
            if ($this->driver === 'pgsql') {
                $stmt = $this->pdo->prepare(
                    'INSERT INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)
                     ON CONFLICT (state_key) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at'
                );
            } else {
                $stmt = $this->pdo->prepare(
                    'INSERT INTO cr_kv_state (state_key, state_json, updated_at) VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at)'
                );
            }
            $stmt->execute([$k, (string) $v, $nowMs]);
        }
    }

    public function getMarzPayUuidForTx(string $txId): ?string
    {
        $stmt = $this->pdo->prepare('SELECT state_json FROM cr_kv_state WHERE state_key = ? LIMIT 1');
        $stmt->execute(["mp_tx:{$txId}"]);
        $row = $stmt->fetch();
        if (is_array($row) && !empty($row['state_json'])) {
            $parsed = json_decode((string) $row['state_json'], true);
            if (is_array($parsed) && !empty($parsed['uuid'])) {
                return (string) $parsed['uuid'];
            }
        }
        return null;
    }

    public function findTxIdByMarzPayUuid(string $uuid): ?string
    {
        $stmt = $this->pdo->prepare('SELECT state_json FROM cr_kv_state WHERE state_key = ? LIMIT 1');
        $stmt->execute(["mp_uuid:{$uuid}"]);
        $row = $stmt->fetch();
        if (is_array($row) && !empty($row['state_json'])) {
            $parsed = json_decode((string) $row['state_json'], true);
            if (is_array($parsed) && !empty($parsed['txId'])) {
                return (string) $parsed['txId'];
            }
        }
        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public function settlePendingDeposit(string $txId, string $marzpayStatus): array
    {
        $nowMs = (int) round(microtime(true) * 1000);
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT * FROM cr_transactions WHERE tx_id = ? FOR UPDATE');
            $stmt->execute([$txId]);
            $tx = $stmt->fetch();
            if (!is_array($tx) || $tx['tx_type'] !== 'Deposit') {
                throw new RuntimeException('Deposit transaction not found.');
            }
            if ($tx['status'] === 'Verified') {
                $wallet = $this->lockOrCreateWallet((string) $tx['uid'], (string) $tx['player_id'], $nowMs);
                $this->pdo->commit();
                return [
                    'txId' => $txId,
                    'status' => 'Verified',
                    'balanceAfter' => (int) $wallet['available_balance'],
                    'amountUgx' => (int) $tx['amount_ugx'],
                ];
            }
            if ($tx['status'] !== 'Pending') {
                $this->pdo->commit();
                return [
                    'txId' => $txId,
                    'status' => (string) $tx['status'],
                    'balanceAfter' => (int) $tx['balance_after'],
                    'amountUgx' => (int) $tx['amount_ugx'],
                ];
            }

            $uid = (string) $tx['uid'];
            $amountUgx = (int) $tx['amount_ugx'];
            $wallet = $this->lockOrCreateWallet($uid, (string) $tx['player_id'], $nowMs);

            if ($marzpayStatus === 'completed') {
                $nextBal = (int) $wallet['available_balance'] + $amountUgx;
                $updW = $this->pdo->prepare('UPDATE cr_wallets SET available_balance = ?, updated_at = ? WHERE uid = ?');
                $updW->execute([$nextBal, $nowMs, $uid]);
                $updTx = $this->pdo->prepare('UPDATE cr_transactions SET status = ?, balance_after = ?, updated_at = ? WHERE tx_id = ?');
                $updTx->execute(['Verified', $nextBal, $nowMs, $txId]);
                $this->pdo->commit();
                return [
                    'txId' => $txId,
                    'status' => 'Verified',
                    'balanceAfter' => $nextBal,
                    'amountUgx' => $amountUgx,
                ];
            }

            if ($marzpayStatus === 'failed') {
                $updTx = $this->pdo->prepare('UPDATE cr_transactions SET status = ?, updated_at = ? WHERE tx_id = ?');
                $updTx->execute(['Failed', $nowMs, $txId]);
                $this->pdo->commit();
                return [
                    'txId' => $txId,
                    'status' => 'Failed',
                    'balanceAfter' => (int) $wallet['available_balance'],
                    'amountUgx' => $amountUgx,
                ];
            }

            $this->pdo->commit();
            return [
                'txId' => $txId,
                'status' => 'Pending',
                'balanceAfter' => (int) $wallet['available_balance'],
                'amountUgx' => $amountUgx,
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function requestWithdrawal(
        string $uid,
        string $playerId,
        int $amountUgx,
        string $provider,
        string $phoneNumber,
        string $note = ''
    ): array {
        if ($amountUgx < self::MIN_WITHDRAWAL_UGX || $amountUgx > self::MAX_WITHDRAWAL_UGX) {
            throw new InvalidArgumentException('Withdrawal amount outside allowed UGX limits.');
        }

        $feeUgx = (int) round($amountUgx * self::WITHDRAWAL_FEE_RATE);
        $netPayoutUgx = max(0, $amountUgx - $feeUgx);
        $nowMs = (int) round(microtime(true) * 1000);
        $txId = 'tx_' . $nowMs . '_' . bin2hex(random_bytes(3));
        $reference = 'CR-WDR-' . random_int(100000, 999999);

        $this->pdo->beginTransaction();
        try {
            $wallet = $this->lockOrCreateWallet($uid, $playerId, $nowMs);
            $avail = (int) $wallet['available_balance'];
            $pending = (int) $wallet['pending_balance'];

            if ($avail < $amountUgx) {
                throw new RuntimeException('Insufficient UGX available balance.');
            }

            $nextAvail = $avail - $amountUgx;
            $nextPending = $pending + $amountUgx;

            $upd = $this->pdo->prepare(
                'UPDATE cr_wallets SET available_balance = ?, pending_balance = ?, updated_at = ? WHERE uid = ?'
            );
            $upd->execute([$nextAvail, $nextPending, $nowMs, $uid]);

            $ins = $this->pdo->prepare(
                'INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $txId,
                $uid,
                $wallet['player_id'],
                'Withdrawal',
                $provider,
                substr($phoneNumber, 0, 64),
                $amountUgx,
                $feeUgx,
                $netPayoutUgx,
                $nextAvail,
                'Pending',
                $reference,
                substr($note, 0, 255),
                $nowMs,
                $nowMs,
            ]);

            $this->pdo->commit();
            return [
                'txId' => $txId,
                'reference' => $reference,
                'amountUgx' => $amountUgx,
                'feeUgx' => $feeUgx,
                'netPayoutUgx' => $netPayoutUgx,
                'balanceAfter' => $nextAvail,
                'status' => 'Pending',
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function settleWithdrawal(string $txId, string $decision, string $adminUid): array
    {
        if ($decision !== 'Paid' && $decision !== 'Rejected') {
            throw new InvalidArgumentException('Decision must be Paid or Rejected.');
        }

        $nowMs = (int) round(microtime(true) * 1000);
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'SELECT * FROM cr_transactions WHERE tx_id = ? FOR UPDATE'
            );
            $stmt->execute([$txId]);
            $tx = $stmt->fetch();

            if (!is_array($tx) || $tx['tx_type'] !== 'Withdrawal' || $tx['status'] !== 'Pending') {
                throw new RuntimeException('Pending withdrawal transaction not found.');
            }

            $uid = (string) $tx['uid'];
            $amountUgx = (int) $tx['amount_ugx'];
            $wallet = $this->lockOrCreateWallet($uid, (string) $tx['player_id'], $nowMs);
            $nextPending = max(0, (int) $wallet['pending_balance'] - $amountUgx);
            $nextAvail = (int) $wallet['available_balance'] + ($decision === 'Rejected' ? $amountUgx : 0);

            $updW = $this->pdo->prepare(
                'UPDATE cr_wallets SET available_balance = ?, pending_balance = ?, updated_at = ? WHERE uid = ?'
            );
            $updW->execute([$nextAvail, $nextPending, $nowMs, $uid]);

            $updTx = $this->pdo->prepare(
                'UPDATE cr_transactions SET status = ?, reviewed_by = ?, updated_at = ? WHERE tx_id = ?'
            );
            $updTx->execute([$decision, $adminUid, $nowMs, $txId]);

            $this->pdo->commit();
            return [
                'txId' => $txId,
                'status' => $decision,
                'availableBalance' => $nextAvail,
                'pendingBalance' => $nextPending,
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listTransactions(int $limit = 100, ?string $uid = null): array
    {
        $safeLimit = max(1, min(500, $limit));
        if ($uid !== null && $uid !== '') {
            $stmt = $this->pdo->prepare(
                "SELECT * FROM cr_transactions WHERE uid = ? ORDER BY created_at DESC LIMIT {$safeLimit}"
            );
            $stmt->execute([$uid]);
            return $stmt->fetchAll();
        }
        $stmt = $this->pdo->query("SELECT * FROM cr_transactions ORDER BY created_at DESC LIMIT {$safeLimit}");
        return $stmt ? $stmt->fetchAll() : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function lockOrCreateWallet(string $uid, string $playerId, int $nowMs): array
    {
        $stmt = $this->pdo->prepare('SELECT * FROM cr_wallets WHERE uid = ? FOR UPDATE');
        $stmt->execute([$uid]);
        $wallet = $stmt->fetch();
        if (is_array($wallet)) {
            return $wallet;
        }

        $ins = $this->pdo->prepare(
            'INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
             VALUES (?, ?, ?, 0, 0, ?)'
        );
        $ins->execute([$uid, $playerId, 'UGX', $nowMs]);

        return [
            'uid' => $uid,
            'player_id' => $playerId,
            'currency' => 'UGX',
            'available_balance' => 0,
            'pending_balance' => 0,
            'updated_at' => $nowMs,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function formatWalletRow(array $row): array
    {
        $uid = (string) ($row['uid'] ?? '');
        $updated = (int) ($row['updated_at'] ?? round(microtime(true) * 1000));
        return [
            'uid' => $uid,
            'playerId' => (string) ($row['player_id'] ?? ''),
            'currency' => (string) ($row['currency'] ?? 'UGX'),
            'availableBalance' => (int) ($row['available_balance'] ?? 0),
            'pendingBalance' => (int) ($row['pending_balance'] ?? 0),
            'realMoneyEnabled' => true,
            'regulatoryNotice' => '18+ Identity-Verified UGX Mobile Money Gaming Account.',
            'createdAt' => $updated,
            'updatedAt' => $updated,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function formatTransactionRow(array $row): array
    {
        $txId = (string) ($row['tx_id'] ?? '');
        $amount = (int) ($row['amount_ugx'] ?? 0);
        $netPayout = (int) ($row['net_payout_ugx'] ?? $amount);
        $type = (string) ($row['tx_type'] ?? 'Deposit');
        $provider = (string) ($row['provider'] ?? 'MTN Mobile Money');
        return [
            'txId' => $txId,
            'transactionId' => $txId,
            'uid' => (string) ($row['uid'] ?? ''),
            'playerId' => (string) ($row['player_id'] ?? ''),
            'type' => $type,
            'provider' => $provider,
            'phoneNumber' => (string) ($row['phone_number'] ?? ''),
            'amountUgx' => $amount,
            'feeUgx' => (int) ($row['fee_ugx'] ?? 0),
            'netAmountUgx' => $netPayout,
            'netPayoutUgx' => $netPayout,
            'balanceAfter' => (int) ($row['balance_after'] ?? 0),
            'status' => (string) ($row['status'] ?? 'Verified'),
            'reference' => (string) ($row['reference'] ?? ''),
            'description' => $type === 'Withdrawal' ? "{$provider} Payout Request" : "{$provider} {$type}",
            'note' => (string) ($row['note'] ?? ''),
            'reviewedBy' => $row['reviewed_by'] !== null ? (string) $row['reviewed_by'] : null,
            'createdAt' => (int) ($row['created_at'] ?? 0),
            'updatedAt' => (int) ($row['updated_at'] ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getSystemSettings(): array
    {
        $defaults = [
            'settingId' => 'global',
            'brandName' => 'CASINO ROYALE',
            'logoUrl' => '',
            'maintenanceMode' => false,
            'realMoneyGamingEnabled' => true,
            'licenseStatus' => 'Active UGX Mobile Money Gaming Operations',
            'contactPhone' => '+256 700 482 190',
            'contactEmail' => 'support@casinoroyale.ug',
            'whatsappNumber' => '+256 700 482 190',
            'officeAddress' => 'Kampala, Uganda',
            'matatuRules' => [
                'initialHandSize' => 7,
                'allowStackingTwos' => true,
                'sevenOfDiamondsCutter' => true,
                'jackSkipsTurn' => true,
                'kingReversesDirection' => true,
                'eightPlaysAgain' => true,
                'aceWildOnAnyCard' => true,
                'threeDrawPenalty' => false,
                'allowFinishOnSpecialCard' => false,
                'turnTimeoutSeconds' => 30,
            ],
        ];
        try {
            $stmt = $this->pdo->prepare('SELECT payload_json FROM cr_system_settings WHERE setting_id = ? LIMIT 1');
            $stmt->execute(['global']);
            $row = $stmt->fetch();
            if (is_array($row) && !empty($row['payload_json'])) {
                $parsed = json_decode((string) $row['payload_json'], true);
                if (is_array($parsed)) {
                    $merged = array_merge($defaults, $parsed);
                    if (is_array($parsed['matatuRules'] ?? null)) {
                        $merged['matatuRules'] = array_merge($defaults['matatuRules'], $parsed['matatuRules']);
                    }
                    return $merged;
                }
            }
        } catch (Throwable) {
            // Fall back to defaults
        }
        return $defaults;
    }

    /**
     * @param array<string, mixed> $updates
     * @return array<string, mixed>
     */
    public function updateSystemSettings(array $updates, string $adminUid): array
    {
        $current = $this->getSystemSettings();
        $nowMs = (int) round(microtime(true) * 1000);
        if (isset($updates['brandName']) && is_string($updates['brandName'])) {
            $current['brandName'] = substr(trim($updates['brandName']) ?: 'CASINO ROYALE', 0, 80);
        }
        if (isset($updates['contactPhone']) && is_string($updates['contactPhone'])) {
            $current['contactPhone'] = substr(trim($updates['contactPhone']), 0, 40);
        }
        if (isset($updates['contactEmail']) && is_string($updates['contactEmail'])) {
            $current['contactEmail'] = substr(trim($updates['contactEmail']), 0, 120);
        }
        if (isset($updates['maintenanceMode'])) {
            $current['maintenanceMode'] = (bool) $updates['maintenanceMode'];
        }
        if (isset($updates['matatuRules']) && is_array($updates['matatuRules'])) {
            $current['matatuRules'] = array_merge(
                is_array($current['matatuRules'] ?? null) ? $current['matatuRules'] : [],
                $updates['matatuRules']
            );
        }
        $current['updatedBy'] = $adminUid;
        $current['updatedAt'] = $nowMs;

        $json = (string) json_encode($current);
        $maintInt = !empty($current['maintenanceMode']) ? 1 : 0;
        if ($this->driver === 'pgsql') {
            $stmt = $this->pdo->prepare(
                'INSERT INTO cr_system_settings (setting_id, brand_name, maintenance_mode, contact_phone, contact_email, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (setting_id) DO UPDATE SET brand_name = EXCLUDED.brand_name, maintenance_mode = EXCLUDED.maintenance_mode, contact_phone = EXCLUDED.contact_phone, contact_email = EXCLUDED.contact_email, payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at'
            );
        } else {
            $stmt = $this->pdo->prepare(
                'INSERT INTO cr_system_settings (setting_id, brand_name, maintenance_mode, contact_phone, contact_email, payload_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE brand_name = VALUES(brand_name), maintenance_mode = VALUES(maintenance_mode), contact_phone = VALUES(contact_phone), contact_email = VALUES(contact_email), payload_json = VALUES(payload_json), updated_at = VALUES(updated_at)'
            );
        }
        $stmt->execute([
            'global',
            $current['brandName'],
            $maintInt,
            $current['contactPhone'],
            $current['contactEmail'],
            $json,
            $nowMs,
        ]);

        return $current;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolveSupportTicket(string $ticketId, string $reply, string $adminUid): array
    {
        $stmt = $this->pdo->prepare('SELECT payload_json FROM cr_support_tickets WHERE ticket_id = ? LIMIT 1');
        $stmt->execute([$ticketId]);
        $row = $stmt->fetch();
        if (!is_array($row)) {
            throw new RuntimeException('Ticket not found.');
        }
        $nowMs = (int) round(microtime(true) * 1000);
        $ticket = json_decode((string) ($row['payload_json'] ?? '{}'), true);
        if (!is_array($ticket)) {
            $ticket = ['ticketId' => $ticketId];
        }
        $ticket['status'] = 'Resolved';
        $ticket['adminReply'] = substr($reply, 0, 1000);
        $ticket['reviewedBy'] = $adminUid;
        $ticket['updatedAt'] = $nowMs;

        $upd = $this->pdo->prepare('UPDATE cr_support_tickets SET status = ?, payload_json = ?, updated_at = ? WHERE ticket_id = ?');
        $upd->execute(['Resolved', (string) json_encode($ticket), $nowMs, $ticketId]);
        return $ticket;
    }

    public function exportSqlDump(): string
    {
        $quoteSql = function (mixed $v): string {
            if ($v === null) {
                return 'NULL';
            }
            if (is_int($v) || is_float($v)) {
                return (string) round((float) $v);
            }
            return $this->pdo->quote((string) $v);
        };

        $lines = [
            '-- CASINO ROYALE — Spaceship cPanel SQL Export (PHP Backend)',
            '-- Generated at ' . gmdate('c'),
            '',
        ];

        $uStmt = $this->pdo->query('SELECT uid, player_id, full_name, email, phone, role, kyc_status, account_status, updated_at FROM cr_users');
        foreach ($uStmt ? $uStmt->fetchAll() : [] as $u) {
            $lines[] = sprintf(
                'INSERT IGNORE INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);',
                $quoteSql($u['uid']),
                $quoteSql($u['player_id']),
                $quoteSql($u['full_name']),
                $quoteSql($u['email']),
                $quoteSql($u['phone']),
                $quoteSql($u['role']),
                $quoteSql($u['kyc_status']),
                $quoteSql($u['account_status']),
                $quoteSql('{}'),
                $quoteSql((int) $u['updated_at'])
            );
        }
        $lines[] = '';

        $wStmt = $this->pdo->query('SELECT uid, player_id, currency, available_balance, pending_balance, updated_at FROM cr_wallets');
        foreach ($wStmt ? $wStmt->fetchAll() : [] as $w) {
            $lines[] = sprintf(
                'INSERT IGNORE INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at) VALUES (%s, %s, %s, %s, %s, %s);',
                $quoteSql($w['uid']),
                $quoteSql($w['player_id']),
                $quoteSql($w['currency']),
                $quoteSql((int) $w['available_balance']),
                $quoteSql((int) $w['pending_balance']),
                $quoteSql((int) $w['updated_at'])
            );
        }
        $lines[] = '';

        $tStmt = $this->pdo->query('SELECT * FROM cr_transactions ORDER BY created_at DESC LIMIT 500');
        foreach ($tStmt ? $tStmt->fetchAll() : [] as $t) {
            $lines[] = sprintf(
                'INSERT IGNORE INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, reviewed_by, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);',
                $quoteSql($t['tx_id']),
                $quoteSql($t['uid']),
                $quoteSql($t['player_id']),
                $quoteSql($t['tx_type']),
                $quoteSql($t['provider']),
                $quoteSql($t['phone_number']),
                $quoteSql((int) $t['amount_ugx']),
                $quoteSql((int) $t['fee_ugx']),
                $quoteSql((int) $t['net_payout_ugx']),
                $quoteSql((int) $t['balance_after']),
                $quoteSql($t['status']),
                $quoteSql($t['reference']),
                $quoteSql($t['note']),
                $quoteSql($t['reviewed_by']),
                $quoteSql((int) $t['created_at']),
                $quoteSql((int) $t['updated_at'])
            );
        }

        return implode("\n", $lines);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getPlayerHydration(string $uid): ?array
    {
        $uStmt = $this->pdo->prepare('SELECT * FROM cr_users WHERE uid = ? LIMIT 1');
        $uStmt->execute([$uid]);
        $uRow = $uStmt->fetch();
        if (!is_array($uRow)) {
            return null;
        }

        $userPayload = json_decode((string) ($uRow['payload_json'] ?? '{}'), true);
        if (!is_array($userPayload)) {
            $userPayload = [];
        }
        unset($userPayload['passwordHash']);
        $userObj = array_merge([
            'uid' => (string) $uRow['uid'],
            'playerId' => (string) $uRow['player_id'],
            'fullName' => (string) $uRow['full_name'],
            'email' => (string) $uRow['email'],
            'phone' => (string) ($uRow['phone'] ?? ''),
            'dateOfBirth' => '1995-01-01',
            'termsAccepted' => true,
            'emailVerified' => true,
            'phoneVerified' => false,
            'kycStatus' => (string) ($uRow['kyc_status'] ?? 'Not Submitted'),
            'accountStatus' => (string) ($uRow['account_status'] ?? 'Pending'),
            'role' => (string) ($uRow['role'] ?? 'player'),
            'createdAt' => (int) ($uRow['updated_at'] ?? 0),
            'updatedAt' => (int) ($uRow['updated_at'] ?? 0),
        ], $userPayload);

        $pStmt = $this->pdo->prepare('SELECT * FROM cr_player_profiles WHERE uid = ? LIMIT 1');
        $pStmt->execute([$uid]);
        $pRow = $pStmt->fetch();
        $nowMs = (int) round(microtime(true) * 1000);
        if (is_array($pRow)) {
            $playerProfile = [
                'uid' => (string) $pRow['uid'],
                'playerId' => (string) $pRow['player_id'],
                'displayName' => (string) $pRow['display_name'],
                'kycStatus' => (string) $pRow['kyc_status'],
                'accountStatus' => (string) $pRow['account_status'],
                'totalGames' => (int) $pRow['total_games'],
                'gamesWon' => (int) $pRow['games_won'],
                'gamesLost' => (int) $pRow['games_lost'],
                'winRate' => (float) $pRow['win_rate'],
                'points' => (int) $pRow['points'],
                'createdAt' => (int) ($userObj['createdAt'] ?? $nowMs),
                'updatedAt' => (int) ($pRow['updated_at'] ?? $nowMs),
            ];
        } else {
            $playerProfile = [
                'uid' => $uid,
                'playerId' => (string) $userObj['playerId'],
                'displayName' => substr((string) $userObj['fullName'], 0, 80),
                'kycStatus' => (string) $userObj['kycStatus'],
                'accountStatus' => (string) $userObj['accountStatus'],
                'totalGames' => 0,
                'gamesWon' => 0,
                'gamesLost' => 0,
                'winRate' => 0,
                'points' => 0,
                'createdAt' => (int) ($userObj['createdAt'] ?? $nowMs),
                'updatedAt' => $nowMs,
            ];
        }

        $wStmt = $this->pdo->prepare('SELECT * FROM cr_wallets WHERE uid = ? LIMIT 1');
        $wStmt->execute([$uid]);
        $wRow = $wStmt->fetch();
        $wallet = is_array($wRow)
            ? $this->formatWalletRow($wRow)
            : $this->formatWalletRow([
                'uid' => $uid,
                'player_id' => $userObj['playerId'],
                'currency' => 'UGX',
                'available_balance' => 0,
                'pending_balance' => 0,
                'updated_at' => $nowMs,
            ]);

        $kycStmt = $this->pdo->prepare('SELECT payload_json FROM cr_kyc_records WHERE uid = ? LIMIT 1');
        $kycStmt->execute([$uid]);
        $kRow = $kycStmt->fetch();
        $kycRecord = null;
        if (is_array($kRow) && !empty($kRow['payload_json'])) {
            $decodedKyc = json_decode((string) $kRow['payload_json'], true);
            if (is_array($decodedKyc)) {
                $kycRecord = $decodedKyc;
            }
        }

        $txRows = $this->listTransactions(150, $uid);
        $transactions = array_map(fn(array $r): array => $this->formatTransactionRow($r), $txRows);

        return [
            'user' => $userObj,
            'playerProfile' => $playerProfile,
            'wallet' => $wallet,
            'kycRecord' => $kycRecord,
            'transactions' => $transactions,
            'notifications' => [],
            'systemSettings' => $this->getSystemSettings(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function cancelPendingWithdrawal(string $uid, string $txId): array
    {
        $nowMs = (int) round(microtime(true) * 1000);
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT * FROM cr_transactions WHERE tx_id = ? FOR UPDATE');
            $stmt->execute([$txId]);
            $tx = $stmt->fetch();
            if (!is_array($tx) || (string) $tx['uid'] !== $uid || $tx['tx_type'] !== 'Withdrawal' || $tx['status'] !== 'Pending') {
                throw new RuntimeException('Only your own pending withdrawals can be cancelled.');
            }
            $amount = (int) $tx['amount_ugx'];
            $wallet = $this->lockOrCreateWallet($uid, (string) $tx['player_id'], $nowMs);
            $nextAvail = (int) $wallet['available_balance'] + $amount;
            $nextPending = max(0, (int) $wallet['pending_balance'] - $amount);

            $updW = $this->pdo->prepare('UPDATE cr_wallets SET available_balance = ?, pending_balance = ?, updated_at = ? WHERE uid = ?');
            $updW->execute([$nextAvail, $nextPending, $nowMs, $uid]);

            $updTx = $this->pdo->prepare('UPDATE cr_transactions SET status = ?, updated_at = ? WHERE tx_id = ?');
            $updTx->execute(['Cancelled', $nowMs, $txId]);

            $tx['status'] = 'Cancelled';
            $tx['updated_at'] = $nowMs;
            $wallet['available_balance'] = $nextAvail;
            $wallet['pending_balance'] = $nextPending;
            $wallet['updated_at'] = $nowMs;

            $this->pdo->commit();
            return [
                'tx' => $this->formatTransactionRow($tx),
                'wallet' => $this->formatWalletRow($wallet),
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function recordGameStake(string $uid, string $playerId, int $amountUgx, string $gameLabel): array
    {
        if ($amountUgx < 1000 || $amountUgx > 1000000) {
            throw new InvalidArgumentException('Game entry stake must be between UGX 1,000 and UGX 1,000,000.');
        }
        $nowMs = (int) round(microtime(true) * 1000);
        $txId = 'tx_' . $nowMs . '_' . bin2hex(random_bytes(3));
        $reference = 'CR-ENT-' . random_int(100000, 999999);
        $this->pdo->beginTransaction();
        try {
            $wallet = $this->lockOrCreateWallet($uid, $playerId, $nowMs);
            $avail = (int) $wallet['available_balance'];
            if ($avail < $amountUgx) {
                throw new RuntimeException('Insufficient UGX balance.');
            }
            $nextAvail = $avail - $amountUgx;
            $updW = $this->pdo->prepare('UPDATE cr_wallets SET available_balance = ?, updated_at = ? WHERE uid = ?');
            $updW->execute([$nextAvail, $nowMs, $uid]);

            $ins = $this->pdo->prepare(
                'INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $txId,
                $uid,
                $wallet['player_id'],
                'Game Entry',
                'System',
                $amountUgx,
                $amountUgx,
                $nextAvail,
                'Completed',
                $reference,
                substr($gameLabel, 0, 255),
                $nowMs,
                $nowMs,
            ]);
            $this->pdo->commit();
            $wallet['available_balance'] = $nextAvail;
            $wallet['updated_at'] = $nowMs;
            $txRow = $this->getTransactionById($txId) ?: [];
            return [
                'tx' => $this->formatTransactionRow($txRow),
                'wallet' => $this->formatWalletRow($wallet),
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function recordMatchWin(string $uid, string $playerId, int $amountUgx, string $gameLabel): array
    {
        if ($amountUgx <= 0) {
            throw new InvalidArgumentException('Winnings amount must be positive.');
        }
        $nowMs = (int) round(microtime(true) * 1000);
        $txId = 'tx_' . $nowMs . '_' . bin2hex(random_bytes(3));
        $reference = 'CR-WIN-' . random_int(100000, 999999);
        $this->pdo->beginTransaction();
        try {
            $wallet = $this->lockOrCreateWallet($uid, $playerId, $nowMs);
            $nextAvail = (int) $wallet['available_balance'] + $amountUgx;
            $updW = $this->pdo->prepare('UPDATE cr_wallets SET available_balance = ?, updated_at = ? WHERE uid = ?');
            $updW->execute([$nextAvail, $nowMs, $uid]);

            $ins = $this->pdo->prepare(
                'INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?, ?, ?, ?, ?)'
            );
            $ins->execute([
                $txId,
                $uid,
                $wallet['player_id'],
                'Match Win',
                'System',
                $amountUgx,
                $amountUgx,
                $nextAvail,
                'Completed',
                $reference,
                substr($gameLabel, 0, 255),
                $nowMs,
                $nowMs,
            ]);
            $this->pdo->commit();
            $wallet['available_balance'] = $nextAvail;
            $wallet['updated_at'] = $nowMs;
            $txRow = $this->getTransactionById($txId) ?: [];
            return [
                'tx' => $this->formatTransactionRow($txRow),
                'wallet' => $this->formatWalletRow($wallet),
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdminOverview(): array
    {
        $users = [];
        $uStmt = $this->pdo->query('SELECT * FROM cr_users ORDER BY updated_at DESC');
        foreach ($uStmt ? $uStmt->fetchAll() : [] as $row) {
            $payload = json_decode((string) ($row['payload_json'] ?? '{}'), true);
            $obj = is_array($payload) ? $payload : [];
            unset($obj['passwordHash']);
            $users[(string) $row['uid']] = array_merge([
                'uid' => (string) $row['uid'],
                'playerId' => (string) $row['player_id'],
                'fullName' => (string) $row['full_name'],
                'email' => (string) $row['email'],
                'phone' => (string) ($row['phone'] ?? ''),
                'kycStatus' => (string) $row['kyc_status'],
                'accountStatus' => (string) $row['account_status'],
                'role' => (string) $row['role'],
                'updatedAt' => (int) $row['updated_at'],
            ], $obj);
        }

        $playerProfiles = [];
        $pStmt = $this->pdo->query('SELECT * FROM cr_player_profiles');
        foreach ($pStmt ? $pStmt->fetchAll() : [] as $pRow) {
            $playerProfiles[(string) $pRow['uid']] = [
                'uid' => (string) $pRow['uid'],
                'playerId' => (string) $pRow['player_id'],
                'displayName' => (string) $pRow['display_name'],
                'kycStatus' => (string) $pRow['kyc_status'],
                'accountStatus' => (string) $pRow['account_status'],
                'totalGames' => (int) $pRow['total_games'],
                'gamesWon' => (int) $pRow['games_won'],
                'gamesLost' => (int) $pRow['games_lost'],
                'winRate' => (float) $pRow['win_rate'],
                'points' => (int) $pRow['points'],
                'createdAt' => (int) $pRow['updated_at'],
                'updatedAt' => (int) $pRow['updated_at'],
            ];
        }

        $wallets = [];
        $wStmt = $this->pdo->query('SELECT * FROM cr_wallets');
        foreach ($wStmt ? $wStmt->fetchAll() : [] as $wRow) {
            $wallets[(string) $wRow['uid']] = $this->formatWalletRow($wRow);
        }

        $transactions = [];
        foreach ($this->listTransactions(250) as $txRow) {
            $formatted = $this->formatTransactionRow($txRow);
            $transactions[$formatted['txId']] = $formatted;
        }

        $kycRecords = [];
        $kStmt = $this->pdo->query('SELECT uid, payload_json FROM cr_kyc_records');
        foreach ($kStmt ? $kStmt->fetchAll() : [] as $kRow) {
            $decoded = json_decode((string) ($kRow['payload_json'] ?? '{}'), true);
            if (is_array($decoded)) {
                $kycRecords[(string) $kRow['uid']] = $decoded;
            }
        }

        $tournaments = [];
        $tStmt = $this->pdo->query('SELECT tournament_id, payload_json FROM cr_tournaments');
        foreach ($tStmt ? $tStmt->fetchAll() : [] as $tRow) {
            $decoded = json_decode((string) ($tRow['payload_json'] ?? '{}'), true);
            if (is_array($decoded)) {
                $tournaments[(string) $tRow['tournament_id']] = $decoded;
            }
        }

        $supportTickets = [];
        $sStmt = $this->pdo->query('SELECT ticket_id, payload_json FROM cr_support_tickets');
        foreach ($sStmt ? $sStmt->fetchAll() : [] as $sRow) {
            $decoded = json_decode((string) ($sRow['payload_json'] ?? '{}'), true);
            if (is_array($decoded)) {
                $supportTickets[(string) $sRow['ticket_id']] = $decoded;
            }
        }

        $adminLogs = [];
        $lStmt = $this->pdo->query('SELECT * FROM cr_admin_logs ORDER BY created_at DESC LIMIT 100');
        foreach ($lStmt ? $lStmt->fetchAll() : [] as $lRow) {
            $adminLogs[] = [
                'logId' => (string) $lRow['log_id'],
                'adminUid' => (string) $lRow['admin_uid'],
                'adminEmail' => (string) $lRow['admin_email'],
                'action' => (string) $lRow['action'],
                'targetType' => (string) ($lRow['target_type'] ?? ''),
                'targetId' => (string) ($lRow['target_id'] ?? ''),
                'details' => (string) ($lRow['details'] ?? ''),
                'createdAt' => (int) $lRow['created_at'],
            ];
        }

        $administrators = [];
        $aStmt = $this->pdo->query('SELECT * FROM cr_administrators');
        foreach ($aStmt ? $aStmt->fetchAll() : [] as $aRow) {
            $administrators[(string) $aRow['uid']] = [
                'uid' => (string) $aRow['uid'],
                'email' => (string) $aRow['email'],
                'fullName' => (string) $aRow['full_name'],
                'role' => (string) $aRow['role'],
                'status' => (string) $aRow['status'],
                'createdAt' => (int) $aRow['created_at'],
            ];
        }

        return [
            'users' => $users,
            'playerProfiles' => $playerProfiles,
            'wallets' => $wallets,
            'transactions' => $transactions,
            'kycRecords' => $kycRecords,
            'tournaments' => $tournaments,
            'tournamentEntries' => (object) [],
            'tournamentMatches' => (object) [],
            'supportTickets' => $supportTickets,
            'announcements' => (object) [],
            'adminLogs' => $adminLogs,
            'administrators' => $administrators,
            'systemSettings' => $this->getSystemSettings(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getDiagnostics(): array
    {
        $cfg = cr_get_config();
        $conn = cr_test_connection();
        $driverLabel = $this->driver === 'pgsql' ? 'postgres' : 'mysql';
        return [
            'driver' => $driverLabel,
            'connected' => (bool) ($conn['connected'] ?? false),
            'hostLabel' => (string) ($cfg['db']['host'] ?? 'localhost'),
            'databaseLabel' => (string) ($cfg['db']['database'] ?? 'configured'),
            'latencyMs' => (int) ($conn['latencyMs'] ?? 1),
            'errorMessage' => $conn['error'] ?? '',
            'tables' => $this->getTablesSummary(),
            'paymentSummary' => $this->getPaymentSummary(),
            'envStatus' => [
                'dbDriverSetting' => $driverLabel,
                'hasDatabaseUrl' => !empty($cfg['db']['database_url']),
                'hasDbCredentials' => !empty($cfg['db']['user']) && !empty($cfg['db']['database']),
                'hasCpanelUapi' => !empty($cfg['cpanel']['host']) && !empty($cfg['cpanel']['user']) && !empty($cfg['cpanel']['api_token']),
                'hasEnvAdminPasscode' => !empty($cfg['admin_passcode']),
                'hasMarzPayCredentials' => !empty($cfg['marzpay']['api_key']) && !empty($cfg['marzpay']['api_secret']),
                'hasMarzPayWebhookSecret' => !empty($cfg['marzpay']['webhook_secret']),
            ],
        ];
    }
}
