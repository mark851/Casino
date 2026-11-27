-- ============================================================================
-- CASINO ROYALE — Complete MySQL / MariaDB SQL Schema & Starter Data
-- Compatible with Spaceship cPanel phpMyAdmin, Node.js (mysql2), and PHP (PDO)
-- ============================================================================

SET NAMES utf8mb4;
SET time_zone = '+03:00';

-- ----------------------------------------------------------------------------
-- 1. Registered Players & Administrators
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_users` (
  `uid` VARCHAR(128) NOT NULL,
  `player_id` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(64) NOT NULL DEFAULT '',
  `role` VARCHAR(32) NOT NULL DEFAULT 'player',
  `kyc_status` VARCHAR(48) NOT NULL DEFAULT 'Not Submitted',
  `account_status` VARCHAR(32) NOT NULL DEFAULT 'Pending',
  `payload_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uniq_cr_users_email` (`email`),
  KEY `idx_cr_users_player_id` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. Player Arena Profiles & Leaderboard Rankings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_player_profiles` (
  `uid` VARCHAR(128) NOT NULL,
  `player_id` VARCHAR(64) NOT NULL,
  `display_name` VARCHAR(120) NOT NULL,
  `kyc_status` VARCHAR(48) NOT NULL DEFAULT 'Not Submitted',
  `account_status` VARCHAR(32) NOT NULL DEFAULT 'Pending',
  `total_games` INT NOT NULL DEFAULT 0,
  `games_won` INT NOT NULL DEFAULT 0,
  `games_lost` INT NOT NULL DEFAULT 0,
  `win_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `points` INT NOT NULL DEFAULT 0,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `idx_cr_profiles_points` (`points`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. UGX Mobile Money Wallets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_wallets` (
  `uid` VARCHAR(128) NOT NULL,
  `player_id` VARCHAR(64) NOT NULL,
  `currency` VARCHAR(16) NOT NULL DEFAULT 'UGX',
  `available_balance` BIGINT NOT NULL DEFAULT 0,
  `pending_balance` BIGINT NOT NULL DEFAULT 0,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `idx_cr_wallets_player_id` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Deposits, Withdrawals & Match Stake Ledger
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_transactions` (
  `tx_id` VARCHAR(128) NOT NULL,
  `uid` VARCHAR(128) NOT NULL,
  `player_id` VARCHAR(64) NOT NULL,
  `tx_type` VARCHAR(48) NOT NULL,
  `provider` VARCHAR(64) NOT NULL,
  `phone_number` VARCHAR(64) NULL,
  `amount_ugx` BIGINT NOT NULL,
  `fee_ugx` BIGINT NOT NULL DEFAULT 0,
  `net_payout_ugx` BIGINT NOT NULL DEFAULT 0,
  `balance_after` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL,
  `reference` VARCHAR(80) NOT NULL,
  `note` VARCHAR(255) NULL,
  `reviewed_by` VARCHAR(128) NULL,
  `created_at` BIGINT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`tx_id`),
  KEY `idx_cr_tx_uid` (`uid`),
  KEY `idx_cr_tx_type_status` (`tx_type`, `status`),
  KEY `idx_cr_tx_reference` (`reference`),
  KEY `idx_cr_tx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. 18+ Identity Verification (KYC Vault)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_kyc_records` (
  `uid` VARCHAR(128) NOT NULL,
  `verification_id` VARCHAR(128) NOT NULL,
  `player_id` VARCHAR(64) NOT NULL,
  `legal_name` VARCHAR(160) NOT NULL,
  `verification_status` VARCHAR(48) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `idx_cr_kyc_status` (`verification_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Daily & Custom Tournaments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_tournaments` (
  `tournament_id` VARCHAR(128) NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `game_type` VARCHAR(32) NOT NULL,
  `entry_fee_ugx` BIGINT NOT NULL DEFAULT 0,
  `status` VARCHAR(48) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`tournament_id`),
  KEY `idx_cr_tournaments_game` (`game_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Player Support Inbox Tickets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_support_tickets` (
  `ticket_id` VARCHAR(128) NOT NULL,
  `uid` VARCHAR(128) NULL,
  `subject` VARCHAR(200) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `payload_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`ticket_id`),
  KEY `idx_cr_tickets_uid_status` (`uid`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. Administrative Audit Trail Logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_admin_logs` (
  `log_id` VARCHAR(128) NOT NULL,
  `admin_uid` VARCHAR(128) NOT NULL,
  `admin_email` VARCHAR(190) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(64) NULL,
  `target_id` VARCHAR(128) NULL,
  `details` TEXT NULL,
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`log_id`),
  KEY `idx_cr_logs_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Authorised Governance Administrators
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_administrators` (
  `uid` VARCHAR(128) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `full_name` VARCHAR(160) NOT NULL,
  `role` VARCHAR(64) NOT NULL DEFAULT 'Super Admin',
  `status` VARCHAR(32) NOT NULL DEFAULT 'Active',
  `created_at` BIGINT NOT NULL,
  PRIMARY KEY (`uid`),
  UNIQUE KEY `uniq_cr_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. System Settings & Platform Rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_system_settings` (
  `setting_id` VARCHAR(64) NOT NULL,
  `brand_name` VARCHAR(120) NOT NULL DEFAULT 'CASINO ROYALE',
  `maintenance_mode` TINYINT(1) NOT NULL DEFAULT 0,
  `contact_phone` VARCHAR(64) NOT NULL DEFAULT '+256 700 482 190',
  `contact_email` VARCHAR(190) NOT NULL DEFAULT 'support@casinoroyale.ug',
  `payload_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`setting_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. Full Application Key-Value State Snapshot (Node.js Sync Bridge)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cr_kv_state` (
  `state_key` VARCHAR(64) NOT NULL,
  `state_json` LONGTEXT NOT NULL,
  `updated_at` BIGINT NOT NULL,
  PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Starter Seed Records (Safe Idempotent Inserts — No Plaintext Passwords)
-- ============================================================================

INSERT IGNORE INTO `cr_users`
  (`uid`, `player_id`, `full_name`, `email`, `phone`, `role`, `kyc_status`, `account_status`, `payload_json`, `updated_at`)
VALUES
  (
    'uid_admin_1',
    'CR-ADM001',
    'Royale Admin Operations',
    'makaug171@gmail.com',
    '+256700112233',
    'admin',
    'Approved',
    'Active',
    '{"uid":"uid_admin_1","playerId":"CR-ADM001","fullName":"Royale Admin Operations","email":"makaug171@gmail.com","phone":"+256700112233","dateOfBirth":"1992-01-10","termsAccepted":true,"emailVerified":true,"phoneVerified":true,"kycStatus":"Approved","accountStatus":"Active","role":"admin"}',
    UNIX_TIMESTAMP() * 1000
  ),
  (
    'uid_demo_player',
    'CR-KMP001',
    'Samuel Musoke',
    'player@casinoroyale.ug',
    '+256772100200',
    'player',
    'Approved',
    'Active',
    '{"uid":"uid_demo_player","playerId":"CR-KMP001","fullName":"Samuel Musoke","email":"player@casinoroyale.ug","phone":"+256772100200","dateOfBirth":"1997-05-14","termsAccepted":true,"emailVerified":true,"phoneVerified":true,"kycStatus":"Approved","accountStatus":"Active","role":"player"}',
    UNIX_TIMESTAMP() * 1000
  );

INSERT IGNORE INTO `cr_player_profiles`
  (`uid`, `player_id`, `display_name`, `kyc_status`, `account_status`, `total_games`, `games_won`, `games_lost`, `win_rate`, `points`, `updated_at`)
VALUES
  ('uid_demo_player', 'CR-KMP001', 'Samuel Musoke', 'Approved', 'Active', 24, 17, 7, 71.00, 1840, UNIX_TIMESTAMP() * 1000);

INSERT IGNORE INTO `cr_wallets`
  (`uid`, `player_id`, `currency`, `available_balance`, `pending_balance`, `updated_at`)
VALUES
  ('uid_admin_1', 'CR-ADM001', 'UGX', 250000, 0, UNIX_TIMESTAMP() * 1000),
  ('uid_demo_player', 'CR-KMP001', 'UGX', 45000, 0, UNIX_TIMESTAMP() * 1000);

INSERT IGNORE INTO `cr_transactions`
  (`tx_id`, `uid`, `player_id`, `tx_type`, `provider`, `phone_number`, `amount_ugx`, `fee_ugx`, `net_payout_ugx`, `balance_after`, `status`, `reference`, `note`, `reviewed_by`, `created_at`, `updated_at`)
VALUES
  (
    'tx_seed_dep_1',
    'uid_demo_player',
    'CR-KMP001',
    'Deposit',
    'MTN Mobile Money',
    '+256772100200',
    50000,
    0,
    50000,
    50000,
    'Verified',
    'CR-DEP-88210',
    'Initial MTN Mobile Money wallet deposit',
    'system',
    UNIX_TIMESTAMP() * 1000,
    UNIX_TIMESTAMP() * 1000
  );

INSERT IGNORE INTO `cr_administrators`
  (`uid`, `email`, `full_name`, `role`, `status`, `created_at`)
VALUES
  ('uid_admin_1', 'makaug171@gmail.com', 'Royale Admin Operations', 'Super Admin', 'Active', UNIX_TIMESTAMP() * 1000);

INSERT IGNORE INTO `cr_system_settings`
  (`setting_id`, `brand_name`, `maintenance_mode`, `contact_phone`, `contact_email`, `payload_json`, `updated_at`)
VALUES
  (
    'global',
    'CASINO ROYALE',
    0,
    '+256 700 482 190',
    'support@casinoroyale.ug',
    '{"settingId":"global","brandName":"CASINO ROYALE","maintenanceMode":false,"realMoneyGamingEnabled":true,"licenseStatus":"Active UGX Mobile Money Gaming Operations","contactPhone":"+256 700 482 190","contactEmail":"support@casinoroyale.ug","whatsappNumber":"+256 700 482 190","officeAddress":"Kampala, Uganda"}',
    UNIX_TIMESTAMP() * 1000
  );
