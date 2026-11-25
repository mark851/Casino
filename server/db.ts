import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { DEFAULT_AI_CONFIG, type AiGovernanceConfig } from '../src/shared/aiPersonas.ts';
import { DEFAULT_MATATU_RULES } from '../src/shared/matatuRules.ts';
import { getKampalaDateString } from '../src/shared/tournamentEngine.ts';
import {
  isMarzPayConfigured,
  marzpayCollectMoney,
  marzpayGetTransaction,
  marzpaySendMoney,
} from './marzpay.ts';
import type {
  AdminLogRecord,
  AdministratorRecord,
  AnnouncementRecord,
  IdentityVerificationRecord,
  KycStatus,
  MobileMoneyProvider,
  NotificationRecord,
  PlayerProfile,
  SupportTicketRecord,
  SystemSettingsRecord,
  TournamentEntryRecord,
  TournamentMatchRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  WalletRecord,
} from '../src/shared/types.ts';

export type DbDriverKind = 'mysql' | 'postgres' | 'local_server_db';

export const BOOTSTRAPPED_ADMIN_EMAILS = ['makaug171@gmail.com', 'markniaras@gmail.com'] as const;
export const BOOTSTRAPPED_ADMIN_EMAIL = BOOTSTRAPPED_ADMIN_EMAILS[0];

export const WITHDRAWAL_FEE_RATE = 0.02;
export const MIN_DEPOSIT_UGX = 1000;
export const MAX_DEPOSIT_UGX = 5000000;
export const MIN_WITHDRAWAL_UGX = 1000;
export const MAX_WITHDRAWAL_UGX = 5000000;
export const MIN_GAME_STAKE_UGX = 1000;
export const MAX_GAME_STAKE_UGX = 1000000;

interface StoredUser extends UserRecord {
  passwordHash?: string;
}

interface PersistedServerState {
  adminCredentialHash: string | null;
  users: Record<string, StoredUser>;
  playerProfiles: Record<string, PlayerProfile>;
  wallets: Record<string, WalletRecord>;
  transactions: Record<string, TransactionRecord>;
  kycRecords: Record<string, IdentityVerificationRecord>;
  tournaments: Record<string, TournamentRecord>;
  tournamentEntries: Record<string, TournamentEntryRecord[]>;
  tournamentMatches: Record<string, TournamentMatchRecord[]>;
  supportTickets: Record<string, SupportTicketRecord>;
  announcements: Record<string, AnnouncementRecord>;
  adminLogs: AdminLogRecord[];
  administrators: Record<string, AdministratorRecord>;
  notifications: Record<string, NotificationRecord[]>;
  systemSettings: SystemSettingsRecord;
  aiConfig: AiGovernanceConfig;
}

export interface TableDiagnosticInfo {
  tableName: string;
  label: string;
  rowCount: number;
  category: 'accounts' | 'payments' | 'compliance' | 'gaming' | 'operations';
}

export interface DatabaseDiagnostics {
  driver: DbDriverKind;
  connected: boolean;
  hostLabel: string;
  databaseLabel: string;
  latencyMs: number;
  errorMessage?: string;
  tables: TableDiagnosticInfo[];
  paymentSummary: {
    verifiedDepositsUgx: number;
    verifiedDepositCount: number;
    pendingWithdrawalsUgx: number;
    pendingWithdrawalCount: number;
    paidWithdrawalsUgx: number;
    paidWithdrawalCount: number;
    totalWalletBalanceUgx: number;
  };
  envStatus: {
    dbDriverSetting: string;
    hasDatabaseUrl: boolean;
    hasDbCredentials: boolean;
    hasCpanelUapi: boolean;
    hasEnvAdminPasscode: boolean;
    hasMarzPayCredentials: boolean;
    hasMarzPayWebhookSecret: boolean;
  };
}

export interface CpanelUapiTestResult {
  configured: boolean;
  connected: boolean;
  host?: string;
  mysqlDatabases: string[];
  postgresDatabases: string[];
  message: string;
}

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'casinoroyale-data')
  : path.resolve(process.cwd(), 'data');
const LOCAL_DB_FILE = path.resolve(DATA_DIR, 'casinoroyale-db.json');

function ensureConfinedPath(targetPath: string, baseDir: string): string {
  const resolved = path.resolve(targetPath);
  const normalizedBase = path.resolve(baseDir);
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('Blocked unsafe file path outside data directory.');
  }
  return resolved;
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string | undefined | null): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function verifyTimingSafeSecret(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function makeRef(prefix: string): string {
  return `CR-${prefix}-${crypto.randomInt(100000, 999999)}`;
}

export function calculateWithdrawalBreakdown(grossAmountUgx: number) {
  const grossUgx = Math.max(0, Math.round(grossAmountUgx));
  const feeUgx = Math.round(grossUgx * WITHDRAWAL_FEE_RATE);
  const netPayoutUgx = Math.max(0, grossUgx - feeUgx);
  return { grossUgx, feeUgx, netPayoutUgx };
}

function createInitialServerSeed(): PersistedServerState {
  const nowMs = Date.now();
  const todayStr = getKampalaDateString();

  const users: Record<string, StoredUser> = {
    uid_demo_player: {
      uid: 'uid_demo_player',
      playerId: 'CR-KMP001',
      fullName: 'Samuel Musoke',
      email: 'player@casinoroyale.ug',
      phone: '+256772100200',
      dateOfBirth: '1997-05-14',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'player',
      createdAt: nowMs - 86400000 * 14,
      updatedAt: nowMs - 3600000,
    },
    uid_admin_1: {
      uid: 'uid_admin_1',
      playerId: 'CR-ADM001',
      fullName: 'Royale Admin Operations',
      email: BOOTSTRAPPED_ADMIN_EMAIL,
      phone: '+256700112233',
      dateOfBirth: '1992-01-10',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'admin',
      createdAt: nowMs - 86400000 * 30,
      updatedAt: nowMs - 3600000,
    },
    uid_contender_sarah: {
      uid: 'uid_contender_sarah',
      playerId: 'CR-KMP204',
      fullName: 'Sarah Namukasa',
      email: 'sarah.n@casinoroyale.ug',
      phone: '+256774204111',
      dateOfBirth: '1998-03-22',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'player',
      createdAt: nowMs - 86400000 * 10,
      updatedAt: nowMs - 7200000,
    },
    uid_contender_david: {
      uid: 'uid_contender_david',
      playerId: 'CR-ENT309',
      fullName: 'David Kato',
      email: 'david.k@casinoroyale.ug',
      phone: '+256752309444',
      dateOfBirth: '1995-08-19',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'player',
      createdAt: nowMs - 86400000 * 9,
      updatedAt: nowMs - 5400000,
    },
    uid_contender_prossy: {
      uid: 'uid_contender_prossy',
      playerId: 'CR-KMP412',
      fullName: 'Prossy Nabwire',
      email: 'prossy.n@casinoroyale.ug',
      phone: '+256782412999',
      dateOfBirth: '1996-11-04',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'player',
      createdAt: nowMs - 86400000 * 7,
      updatedAt: nowMs - 1800000,
    },
  };

  const playerProfiles: Record<string, PlayerProfile> = {
    uid_demo_player: {
      uid: 'uid_demo_player',
      playerId: 'CR-KMP001',
      displayName: 'Samuel Musoke',
      kycStatus: 'Approved',
      accountStatus: 'Active',
      totalGames: 24,
      gamesWon: 17,
      gamesLost: 7,
      winRate: 71,
      points: 1840,
      createdAt: nowMs - 86400000 * 14,
      updatedAt: nowMs - 3600000,
    },
    uid_contender_prossy: {
      uid: 'uid_contender_prossy',
      playerId: 'CR-KMP412',
      displayName: 'Prossy Nabwire',
      kycStatus: 'Approved',
      accountStatus: 'Active',
      totalGames: 48,
      gamesWon: 36,
      gamesLost: 12,
      winRate: 75,
      points: 2420,
      createdAt: nowMs - 86400000 * 7,
      updatedAt: nowMs - 1800000,
    },
    uid_contender_david: {
      uid: 'uid_contender_david',
      playerId: 'CR-ENT309',
      displayName: 'David Kato',
      kycStatus: 'Approved',
      accountStatus: 'Active',
      totalGames: 41,
      gamesWon: 29,
      gamesLost: 12,
      winRate: 71,
      points: 2180,
      createdAt: nowMs - 86400000 * 9,
      updatedAt: nowMs - 5400000,
    },
    uid_contender_sarah: {
      uid: 'uid_contender_sarah',
      playerId: 'CR-KMP204',
      displayName: 'Sarah Namukasa',
      kycStatus: 'Approved',
      accountStatus: 'Active',
      totalGames: 32,
      gamesWon: 22,
      gamesLost: 10,
      winRate: 69,
      points: 1960,
      createdAt: nowMs - 86400000 * 10,
      updatedAt: nowMs - 7200000,
    },
  };

  const wallets: Record<string, WalletRecord> = {
    uid_demo_player: {
      uid: 'uid_demo_player',
      playerId: 'CR-KMP001',
      currency: 'UGX',
      availableBalance: 45000,
      pendingBalance: 0,
      realMoneyEnabled: true,
      regulatoryNotice: 'CASINO ROYALE UGX Wallet (Server DB)',
      createdAt: nowMs - 86400000 * 14,
      updatedAt: nowMs - 3600000,
    },
    uid_admin_1: {
      uid: 'uid_admin_1',
      playerId: 'CR-ADM001',
      currency: 'UGX',
      availableBalance: 250000,
      pendingBalance: 0,
      realMoneyEnabled: true,
      regulatoryNotice: 'CASINO ROYALE UGX Wallet (Server DB)',
      createdAt: nowMs - 86400000 * 30,
      updatedAt: nowMs - 3600000,
    },
  };

  const transactions: Record<string, TransactionRecord> = {
    tx_seed_dep_1: {
      txId: 'tx_seed_dep_1',
      transactionId: 'tx_seed_dep_1',
      uid: 'uid_demo_player',
      playerId: 'CR-KMP001',
      type: 'Deposit',
      provider: 'MTN Mobile Money',
      phoneNumber: '+256772100200',
      amountUgx: 50000,
      feeUgx: 0,
      netAmountUgx: 50000,
      netPayoutUgx: 50000,
      balanceAfter: 50000,
      status: 'Verified',
      reference: 'CR-DEP-88210',
      description: 'Initial MTN Mobile Money wallet deposit',
      createdAt: nowMs - 86400000 * 2,
      updatedAt: nowMs - 86400000 * 2,
    },
  };

  const administrators: Record<string, AdministratorRecord> = {
    uid_admin_1: {
      uid: 'uid_admin_1',
      email: BOOTSTRAPPED_ADMIN_EMAIL,
      fullName: 'Royale Admin Operations',
      role: 'Super Admin',
      status: 'Active',
      createdAt: nowMs - 86400000 * 30,
    },
  };

  const tournaments: Record<string, TournamentRecord> = {
    [`daily_matatu_${todayStr}`]: {
      tournamentId: `daily_matatu_${todayStr}`,
      title: 'Kampala Nightly Matatu Royale Cup',
      gameType: 'matatu',
      entryFeeUgx: 2000,
      prizePoolUgx: 16000,
      prizeSummary: 'Entry: UGX 2,000 · Winner Takes Championship Cup & Pot',
      maxPlayers: 8,
      entryCount: 3,
      registeredCount: 3,
      status: 'Registration Open',
      scheduleDate: todayStr,
      startTimeIso: new Date(nowMs + 3600000 * 3).toISOString(),
      championPointsPrize: 250,
      runnerUpPointsPrize: 100,
      createdAt: nowMs - 3600000,
    },
    [`daily_ludo_${todayStr}`]: {
      tournamentId: `daily_ludo_${todayStr}`,
      title: 'Ludo Master Premier Club Cup',
      gameType: 'ludo',
      entryFeeUgx: 2000,
      prizePoolUgx: 16000,
      prizeSummary: 'Entry: UGX 2,000 · Club Crest Championship Series',
      maxPlayers: 8,
      entryCount: 2,
      registeredCount: 2,
      status: 'Registration Open',
      scheduleDate: todayStr,
      startTimeIso: new Date(nowMs + 3600000 * 5).toISOString(),
      championPointsPrize: 250,
      runnerUpPointsPrize: 100,
      createdAt: nowMs - 3600000,
    },
    [`daily_chess_${todayStr}`]: {
      tournamentId: `daily_chess_${todayStr}`,
      title: 'Kampala Grandmaster Chess Open',
      gameType: 'chess',
      entryFeeUgx: 5000,
      prizePoolUgx: 40000,
      prizeSummary: 'Entry: UGX 5,000 · FIDE Rapid Bracket',
      maxPlayers: 8,
      entryCount: 2,
      registeredCount: 2,
      status: 'Registration Open',
      scheduleDate: todayStr,
      startTimeIso: new Date(nowMs + 3600000 * 6).toISOString(),
      championPointsPrize: 300,
      runnerUpPointsPrize: 120,
      createdAt: nowMs - 3600000,
    },
    [`daily_drafts_${todayStr}`]: {
      tournamentId: `daily_drafts_${todayStr}`,
      title: 'Uganda Drafts Flying-King Knockout',
      gameType: 'drafts',
      entryFeeUgx: 1000,
      prizePoolUgx: 8000,
      prizeSummary: 'Entry: UGX 1,000 · Mandatory Jump Championship',
      maxPlayers: 8,
      entryCount: 2,
      registeredCount: 2,
      status: 'Registration Open',
      scheduleDate: todayStr,
      startTimeIso: new Date(nowMs + 3600000 * 7).toISOString(),
      championPointsPrize: 200,
      runnerUpPointsPrize: 80,
      createdAt: nowMs - 3600000,
    },
  };

  const tournamentEntries: Record<string, TournamentEntryRecord[]> = {
    [`daily_matatu_${todayStr}`]: [
      { uid: 'uid_contender_prossy', playerId: 'CR-KMP412', displayName: 'Prossy Nabwire', seed: 1, status: 'Confirmed', joinedAt: nowMs - 1800000 },
      { uid: 'uid_contender_david', playerId: 'CR-ENT309', displayName: 'David Kato', seed: 2, status: 'Confirmed', joinedAt: nowMs - 1500000 },
      { uid: 'uid_contender_sarah', playerId: 'CR-KMP204', displayName: 'Sarah Namukasa', seed: 3, status: 'Confirmed', joinedAt: nowMs - 1200000 },
    ],
    [`daily_ludo_${todayStr}`]: [
      { uid: 'uid_contender_sarah', playerId: 'CR-KMP204', displayName: 'Sarah Namukasa', seed: 1, status: 'Confirmed', joinedAt: nowMs - 1400000 },
      { uid: 'uid_contender_david', playerId: 'CR-ENT309', displayName: 'David Kato', seed: 2, status: 'Confirmed', joinedAt: nowMs - 1100000 },
    ],
    [`daily_chess_${todayStr}`]: [
      { uid: 'uid_contender_prossy', playerId: 'CR-KMP412', displayName: 'Prossy Nabwire', seed: 1, status: 'Confirmed', joinedAt: nowMs - 1400000 },
      { uid: 'uid_contender_david', playerId: 'CR-ENT309', displayName: 'David Kato', seed: 2, status: 'Confirmed', joinedAt: nowMs - 1100000 },
    ],
    [`daily_drafts_${todayStr}`]: [
      { uid: 'uid_contender_sarah', playerId: 'CR-KMP204', displayName: 'Sarah Namukasa', seed: 1, status: 'Confirmed', joinedAt: nowMs - 1400000 },
      { uid: 'uid_contender_prossy', playerId: 'CR-KMP412', displayName: 'Prossy Nabwire', seed: 2, status: 'Confirmed', joinedAt: nowMs - 1100000 },
    ],
  };

  return {
    adminCredentialHash: null,
    users,
    playerProfiles,
    wallets,
    transactions,
    kycRecords: {},
    tournaments,
    tournamentEntries,
    tournamentMatches: {},
    supportTickets: {},
    announcements: {
      welcome_casinoroyale: {
        announcementId: 'welcome_casinoroyale',
        title: 'Welcome to CASINO ROYALE',
        summary: 'Daily Matatu Royale, Ludo Master, Kampala Chess, and Uganda Drafts cups are open.',
        body: 'Complete 18+ identity verification to enter multiplayer tables, manage your UGX wallet, and compete in single-elimination brackets.',
        published: true,
        active: true,
        priority: 'Important',
        createdAt: nowMs - 3600000 * 4,
      },
    },
    adminLogs: [],
    administrators,
    notifications: {},
    systemSettings: {
      settingId: 'global',
      brandName: 'CASINO ROYALE',
      logoUrl: '',
      maintenanceMode: false,
      realMoneyGamingEnabled: true,
      licenseStatus: 'Active UGX Mobile Money Gaming Operations',
      contactPhone: '+256 700 482 190',
      contactEmail: 'support@casinoroyale.ug',
      whatsappNumber: '+256 700 482 190',
      officeAddress: 'Kampala, Uganda',
      matatuRules: { ...DEFAULT_MATATU_RULES },
      updatedAt: nowMs,
    },
    aiConfig: { ...DEFAULT_AI_CONFIG },
  };
}

function detectDatabaseConfig(): {
  driver: DbDriverKind;
  connectionUrl: string;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} {
  const requested = (process.env.DB_DRIVER || 'auto').trim().toLowerCase();
  const databaseUrl = (
    process.env.DATABASE_URL ||
    process.env.MYSQL_URL ||
    process.env.POSTGRES_URL ||
    ''
  ).trim();
  const host = (process.env.DB_HOST || process.env.CPANEL_DB_HOST || 'localhost').trim();
  const user = (process.env.DB_USER || process.env.CPANEL_DB_USER || '').trim();
  const password = (process.env.DB_PASSWORD || process.env.CPANEL_DB_PASSWORD || '').trim();
  const database = (process.env.DB_NAME || process.env.CPANEL_DB_NAME || '').trim();
  const envPort = Number(process.env.DB_PORT || 0);

  if (requested === 'local') {
    return { driver: 'local_server_db', connectionUrl: '', host: 'localhost', port: 0, user: '', password: '', database: 'casinoroyale-db.json' };
  }

  if (
    requested === 'postgres' ||
    requested === 'postgresql' ||
    /^postgres(ql)?:\/\//i.test(databaseUrl)
  ) {
    return {
      driver: 'postgres',
      connectionUrl: databaseUrl,
      host,
      port: envPort || 5432,
      user,
      password,
      database: database || 'casinoroyale',
    };
  }

  if (
    requested === 'mysql' ||
    requested === 'mariadb' ||
    /^mysql2?:\/\//i.test(databaseUrl) ||
    (user && database)
  ) {
    return {
      driver: 'mysql',
      connectionUrl: databaseUrl,
      host,
      port: envPort || 3306,
      user,
      password,
      database,
    };
  }

  return {
    driver: 'local_server_db',
    connectionUrl: '',
    host: 'local-server',
    port: 0,
    user: '',
    password: '',
    database: 'data/casinoroyale-db.json',
  };
}

let cachedState: PersistedServerState | null = null;
let mysqlPool: mysql.Pool | null = null;
let pgPool: pg.Pool | null = null;
let activeDriver: DbDriverKind = 'local_server_db';
let lastSqlError = '';

function sanitizeUser(u: StoredUser): UserRecord {
  const { passwordHash: _omitted, ...safe } = u;
  return safe;
}

function loadLocalDiskState(): PersistedServerState {
  try {
    const file = ensureConfinedPath(LOCAL_DB_FILE, DATA_DIR);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedServerState>;
      const seed = createInitialServerSeed();
      return {
        ...seed,
        ...parsed,
        users: { ...seed.users, ...(parsed.users || {}) },
        playerProfiles: { ...seed.playerProfiles, ...(parsed.playerProfiles || {}) },
        wallets: { ...seed.wallets, ...(parsed.wallets || {}) },
        transactions: { ...seed.transactions, ...(parsed.transactions || {}) },
        administrators: { ...seed.administrators, ...(parsed.administrators || {}) },
        tournaments: { ...seed.tournaments, ...(parsed.tournaments || {}) },
        tournamentEntries: { ...seed.tournamentEntries, ...(parsed.tournamentEntries || {}) },
        tournamentMatches: { ...seed.tournamentMatches, ...(parsed.tournamentMatches || {}) },
        kycRecords: parsed.kycRecords || {},
        supportTickets: parsed.supportTickets || {},
        announcements: { ...seed.announcements, ...(parsed.announcements || {}) },
        adminLogs: parsed.adminLogs || [],
        notifications: parsed.notifications || {},
        systemSettings: parsed.systemSettings || seed.systemSettings,
        aiConfig: parsed.aiConfig || seed.aiConfig,
      };
    }
  } catch {
    // Fall back to fresh initial seed
  }
  return createInitialServerSeed();
}

function saveLocalDiskState(state: PersistedServerState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const target = ensureConfinedPath(LOCAL_DB_FILE, DATA_DIR);
  const tmpTarget = ensureConfinedPath(`${LOCAL_DB_FILE}.tmp`, DATA_DIR);
  fs.writeFileSync(tmpTarget, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpTarget, target);
}

async function ensureMysqlSchema(pool: mysql.Pool): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS cr_users (
      uid VARCHAR(128) PRIMARY KEY,
      player_id VARCHAR(64) NOT NULL,
      full_name VARCHAR(160) NOT NULL,
      email VARCHAR(190) NOT NULL,
      phone VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'player',
      kyc_status VARCHAR(48) NOT NULL DEFAULT 'Not Submitted',
      account_status VARCHAR(32) NOT NULL DEFAULT 'Pending',
      payload_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_player_profiles (
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
    )`,
    `CREATE TABLE IF NOT EXISTS cr_wallets (
      uid VARCHAR(128) PRIMARY KEY,
      player_id VARCHAR(64) NOT NULL,
      currency VARCHAR(16) NOT NULL DEFAULT 'UGX',
      available_balance BIGINT NOT NULL DEFAULT 0,
      pending_balance BIGINT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_transactions (
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
    )`,
    `CREATE TABLE IF NOT EXISTS cr_kyc_records (
      uid VARCHAR(128) PRIMARY KEY,
      verification_id VARCHAR(128) NOT NULL,
      player_id VARCHAR(64) NOT NULL,
      legal_name VARCHAR(160) NOT NULL,
      verification_status VARCHAR(48) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_tournaments (
      tournament_id VARCHAR(128) PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      game_type VARCHAR(32) NOT NULL,
      entry_fee_ugx BIGINT NOT NULL,
      status VARCHAR(48) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_support_tickets (
      ticket_id VARCHAR(128) PRIMARY KEY,
      uid VARCHAR(128) NULL,
      subject VARCHAR(200) NOT NULL,
      status VARCHAR(32) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_admin_logs (
      log_id VARCHAR(128) PRIMARY KEY,
      admin_uid VARCHAR(128) NOT NULL,
      admin_email VARCHAR(190) NOT NULL,
      action VARCHAR(80) NOT NULL,
      target_type VARCHAR(64) NULL,
      target_id VARCHAR(128) NULL,
      details TEXT NULL,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_kv_state (
      state_key VARCHAR(64) PRIMARY KEY,
      state_json LONGTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }
}

async function ensurePostgresSchema(pool: pg.Pool): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS cr_users (
      uid TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      kyc_status TEXT NOT NULL DEFAULT 'Not Submitted',
      account_status TEXT NOT NULL DEFAULT 'Pending',
      payload_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_player_profiles (
      uid TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      kyc_status TEXT NOT NULL DEFAULT 'Not Submitted',
      account_status TEXT NOT NULL DEFAULT 'Pending',
      total_games INT NOT NULL DEFAULT 0,
      games_won INT NOT NULL DEFAULT 0,
      games_lost INT NOT NULL DEFAULT 0,
      win_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
      points INT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_wallets (
      uid TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'UGX',
      available_balance BIGINT NOT NULL DEFAULT 0,
      pending_balance BIGINT NOT NULL DEFAULT 0,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_transactions (
      tx_id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      player_id TEXT NOT NULL,
      tx_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      phone_number TEXT,
      amount_ugx BIGINT NOT NULL,
      fee_ugx BIGINT NOT NULL DEFAULT 0,
      net_payout_ugx BIGINT NOT NULL DEFAULT 0,
      balance_after BIGINT NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      reference TEXT NOT NULL,
      note TEXT,
      reviewed_by TEXT,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_kyc_records (
      uid TEXT PRIMARY KEY,
      verification_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      legal_name TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_tournaments (
      tournament_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      game_type TEXT NOT NULL,
      entry_fee_ugx BIGINT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_support_tickets (
      ticket_id TEXT PRIMARY KEY,
      uid TEXT,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_admin_logs (
      log_id TEXT PRIMARY KEY,
      admin_uid TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      created_at BIGINT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS cr_kv_state (
      state_key TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
  ];

  for (const sql of statements) {
    await pool.query(sql);
  }
}

async function syncRelationalTablesToMysql(pool: mysql.Pool, state: PersistedServerState): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const now = Date.now();

    for (const u of Object.values(state.users)) {
      await conn.query(
        `INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           player_id = VALUES(player_id),
           full_name = VALUES(full_name),
           email = VALUES(email),
           phone = VALUES(phone),
           role = VALUES(role),
           kyc_status = VALUES(kyc_status),
           account_status = VALUES(account_status),
           payload_json = VALUES(payload_json),
           updated_at = VALUES(updated_at)`,
        [
          u.uid,
          u.playerId,
          u.fullName,
          u.email,
          u.phone || '',
          u.role,
          u.kycStatus,
          u.accountStatus,
          JSON.stringify(u),
          Number(u.updatedAt || now),
        ]
      );
    }

    for (const p of Object.values(state.playerProfiles)) {
      await conn.query(
        `INSERT INTO cr_player_profiles (uid, player_id, display_name, kyc_status, account_status, total_games, games_won, games_lost, win_rate, points, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           player_id = VALUES(player_id),
           display_name = VALUES(display_name),
           kyc_status = VALUES(kyc_status),
           account_status = VALUES(account_status),
           total_games = VALUES(total_games),
           games_won = VALUES(games_won),
           games_lost = VALUES(games_lost),
           win_rate = VALUES(win_rate),
           points = VALUES(points),
           updated_at = VALUES(updated_at)`,
        [
          p.uid,
          p.playerId,
          p.displayName,
          p.kycStatus,
          p.accountStatus,
          Math.round(p.totalGames || 0),
          Math.round(p.gamesWon || 0),
          Math.round(p.gamesLost || 0),
          Number(p.winRate || 0),
          Math.round(p.points || 0),
          Number(p.updatedAt || now),
        ]
      );
    }

    for (const w of Object.values(state.wallets)) {
      await conn.query(
        `INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           player_id = VALUES(player_id),
           available_balance = VALUES(available_balance),
           pending_balance = VALUES(pending_balance),
           updated_at = VALUES(updated_at)`,
        [
          w.uid,
          w.playerId,
          w.currency,
          Math.round(w.availableBalance || 0),
          Math.round(w.pendingBalance || 0),
          Number(w.updatedAt || now),
        ]
      );
    }

    for (const tx of Object.values(state.transactions)) {
      await conn.query(
        `INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, reviewed_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           balance_after = VALUES(balance_after),
           reviewed_by = VALUES(reviewed_by),
           updated_at = VALUES(updated_at)`,
        [
          tx.txId,
          tx.uid,
          tx.playerId,
          tx.type,
          tx.provider,
          tx.phoneNumber || null,
          Math.round(tx.amountUgx || 0),
          Math.round(tx.feeUgx || 0),
          Math.round(tx.netPayoutUgx || tx.amountUgx || 0),
          Math.round(tx.balanceAfter || 0),
          tx.status,
          tx.reference,
          tx.note || null,
          tx.reviewedBy || null,
          Number(tx.createdAt || now),
          Number(tx.updatedAt || now),
        ]
      );
    }

    for (const kyc of Object.values(state.kycRecords)) {
      await conn.query(
        `INSERT INTO cr_kyc_records (uid, verification_id, player_id, legal_name, verification_status, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           verification_status = VALUES(verification_status),
           payload_json = VALUES(payload_json),
           updated_at = VALUES(updated_at)`,
        [
          kyc.uid,
          kyc.verification_id,
          kyc.player_id,
          kyc.legal_name,
          kyc.verification_status,
          JSON.stringify(kyc),
          Number(kyc.updatedAt || now),
        ]
      );
    }

    for (const t of Object.values(state.tournaments)) {
      await conn.query(
        `INSERT INTO cr_tournaments (tournament_id, title, game_type, entry_fee_ugx, status, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           payload_json = VALUES(payload_json),
           updated_at = VALUES(updated_at)`,
        [t.tournamentId, t.title, t.gameType, t.entryFeeUgx, t.status, JSON.stringify(t), now]
      );
    }

    for (const ticket of Object.values(state.supportTickets)) {
      await conn.query(
        `INSERT INTO cr_support_tickets (ticket_id, uid, subject, status, payload_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           payload_json = VALUES(payload_json),
           updated_at = VALUES(updated_at)`,
        [
          ticket.ticketId,
          ticket.uid || null,
          ticket.subject,
          ticket.status,
          JSON.stringify(ticket),
          Number(ticket.updatedAt || now),
        ]
      );
    }

    for (const log of state.adminLogs.slice(0, 100)) {
      await conn.query(
        `INSERT INTO cr_admin_logs (log_id, admin_uid, admin_email, action, target_type, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE details = VALUES(details)`,
        [
          log.logId,
          log.adminUid,
          log.adminEmail,
          log.action,
          log.targetType || null,
          log.targetId || null,
          log.details || null,
          Number(log.createdAt || now),
        ]
      );
    }

    await conn.query(
      `INSERT INTO cr_kv_state (state_key, state_json, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), updated_at = VALUES(updated_at)`,
      ['full_state', JSON.stringify(state), now]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function syncRelationalTablesToPostgres(pool: pg.Pool, state: PersistedServerState): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const now = Date.now();

    for (const u of Object.values(state.users)) {
      await client.query(
        `INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, payload_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (uid) DO UPDATE SET
           player_id = EXCLUDED.player_id,
           full_name = EXCLUDED.full_name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           role = EXCLUDED.role,
           kyc_status = EXCLUDED.kyc_status,
           account_status = EXCLUDED.account_status,
           payload_json = EXCLUDED.payload_json,
           updated_at = EXCLUDED.updated_at`,
        [
          u.uid,
          u.playerId,
          u.fullName,
          u.email,
          u.phone || '',
          u.role,
          u.kycStatus,
          u.accountStatus,
          JSON.stringify(u),
          Number(u.updatedAt || now),
        ]
      );
    }

    for (const p of Object.values(state.playerProfiles)) {
      await client.query(
        `INSERT INTO cr_player_profiles (uid, player_id, display_name, kyc_status, account_status, total_games, games_won, games_lost, win_rate, points, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (uid) DO UPDATE SET
           player_id = EXCLUDED.player_id,
           display_name = EXCLUDED.display_name,
           kyc_status = EXCLUDED.kyc_status,
           account_status = EXCLUDED.account_status,
           total_games = EXCLUDED.total_games,
           games_won = EXCLUDED.games_won,
           games_lost = EXCLUDED.games_lost,
           win_rate = EXCLUDED.win_rate,
           points = EXCLUDED.points,
           updated_at = EXCLUDED.updated_at`,
        [
          p.uid,
          p.playerId,
          p.displayName,
          p.kycStatus,
          p.accountStatus,
          Math.round(p.totalGames || 0),
          Math.round(p.gamesWon || 0),
          Math.round(p.gamesLost || 0),
          Number(p.winRate || 0),
          Math.round(p.points || 0),
          Number(p.updatedAt || now),
        ]
      );
    }

    for (const w of Object.values(state.wallets)) {
      await client.query(
        `INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (uid) DO UPDATE SET
           player_id = EXCLUDED.player_id,
           available_balance = EXCLUDED.available_balance,
           pending_balance = EXCLUDED.pending_balance,
           updated_at = EXCLUDED.updated_at`,
        [
          w.uid,
          w.playerId,
          w.currency,
          Math.round(w.availableBalance || 0),
          Math.round(w.pendingBalance || 0),
          Number(w.updatedAt || now),
        ]
      );
    }

    for (const tx of Object.values(state.transactions)) {
      await client.query(
        `INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, reviewed_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         ON CONFLICT (tx_id) DO UPDATE SET
           status = EXCLUDED.status,
           balance_after = EXCLUDED.balance_after,
           reviewed_by = EXCLUDED.reviewed_by,
           updated_at = EXCLUDED.updated_at`,
        [
          tx.txId,
          tx.uid,
          tx.playerId,
          tx.type,
          tx.provider,
          tx.phoneNumber || null,
          Math.round(tx.amountUgx || 0),
          Math.round(tx.feeUgx || 0),
          Math.round(tx.netPayoutUgx || tx.amountUgx || 0),
          Math.round(tx.balanceAfter || 0),
          tx.status,
          tx.reference,
          tx.note || null,
          tx.reviewedBy || null,
          Number(tx.createdAt || now),
          Number(tx.updatedAt || now),
        ]
      );
    }

    for (const kyc of Object.values(state.kycRecords)) {
      await client.query(
        `INSERT INTO cr_kyc_records (uid, verification_id, player_id, legal_name, verification_status, payload_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (uid) DO UPDATE SET
           verification_status = EXCLUDED.verification_status,
           payload_json = EXCLUDED.payload_json,
           updated_at = EXCLUDED.updated_at`,
        [
          kyc.uid,
          kyc.verification_id,
          kyc.player_id,
          kyc.legal_name,
          kyc.verification_status,
          JSON.stringify(kyc),
          Number(kyc.updatedAt || now),
        ]
      );
    }

    for (const t of Object.values(state.tournaments)) {
      await client.query(
        `INSERT INTO cr_tournaments (tournament_id, title, game_type, entry_fee_ugx, status, payload_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tournament_id) DO UPDATE SET
           status = EXCLUDED.status,
           payload_json = EXCLUDED.payload_json,
           updated_at = EXCLUDED.updated_at`,
        [t.tournamentId, t.title, t.gameType, t.entryFeeUgx, t.status, JSON.stringify(t), now]
      );
    }

    for (const ticket of Object.values(state.supportTickets)) {
      await client.query(
        `INSERT INTO cr_support_tickets (ticket_id, uid, subject, status, payload_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (ticket_id) DO UPDATE SET
           status = EXCLUDED.status,
           payload_json = EXCLUDED.payload_json,
           updated_at = EXCLUDED.updated_at`,
        [
          ticket.ticketId,
          ticket.uid || null,
          ticket.subject,
          ticket.status,
          JSON.stringify(ticket),
          Number(ticket.updatedAt || now),
        ]
      );
    }

    for (const log of state.adminLogs.slice(0, 100)) {
      await client.query(
        `INSERT INTO cr_admin_logs (log_id, admin_uid, admin_email, action, target_type, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (log_id) DO UPDATE SET details = EXCLUDED.details`,
        [
          log.logId,
          log.adminUid,
          log.adminEmail,
          log.action,
          log.targetType || null,
          log.targetId || null,
          log.details || null,
          Number(log.createdAt || now),
        ]
      );
    }

    await client.query(
      `INSERT INTO cr_kv_state (state_key, state_json, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (state_key) DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = EXCLUDED.updated_at`,
      ['full_state', JSON.stringify(state), now]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initServerDatabase(): Promise<PersistedServerState> {
  if (cachedState) return cachedState;

  const cfg = detectDatabaseConfig();
  lastSqlError = '';

  if (cfg.driver === 'mysql') {
    try {
      const useSsl = /^(1|true|yes)$/i.test((process.env.DB_SSL || '').trim());
      mysqlPool = cfg.connectionUrl
        ? mysql.createPool(cfg.connectionUrl)
        : mysql.createPool({
            host: cfg.host,
            port: cfg.port,
            user: cfg.user,
            password: cfg.password,
            database: cfg.database,
            waitForConnections: true,
            connectionLimit: process.env.VERCEL ? 3 : 10,
            connectTimeout: 8000,
            ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
          });
      await ensureMysqlSchema(mysqlPool);
      const [rows] = await mysqlPool.query(
        'SELECT state_json FROM cr_kv_state WHERE state_key = ? LIMIT 1',
        ['full_state']
      );
      const rowList = Array.isArray(rows) ? (rows as Array<{ state_json?: string }>) : [];
      if (rowList.length > 0 && rowList[0].state_json) {
        cachedState = JSON.parse(rowList[0].state_json) as PersistedServerState;
      } else {
        cachedState = loadLocalDiskState();
        await syncRelationalTablesToMysql(mysqlPool, cachedState);
      }
      activeDriver = 'mysql';
      return cachedState;
    } catch (err) {
      lastSqlError = err instanceof Error ? err.message : 'MySQL connection failed';
      mysqlPool = null;
    }
  } else if (cfg.driver === 'postgres') {
    try {
      pgPool = cfg.connectionUrl
        ? new pg.Pool({ connectionString: cfg.connectionUrl })
        : new pg.Pool({
            host: cfg.host,
            port: cfg.port,
            user: cfg.user,
            password: cfg.password,
            database: cfg.database,
            max: 10,
          });
      await ensurePostgresSchema(pgPool);
      const res = await pgPool.query(
        'SELECT state_json FROM cr_kv_state WHERE state_key = $1 LIMIT 1',
        ['full_state']
      );
      if (res.rows.length > 0 && res.rows[0].state_json) {
        cachedState = JSON.parse(String(res.rows[0].state_json)) as PersistedServerState;
      } else {
        cachedState = loadLocalDiskState();
        await syncRelationalTablesToPostgres(pgPool, cachedState);
      }
      activeDriver = 'postgres';
      return cachedState;
    } catch (err) {
      lastSqlError = err instanceof Error ? err.message : 'PostgreSQL connection failed';
      pgPool = null;
    }
  }

  activeDriver = 'local_server_db';
  cachedState = loadLocalDiskState();
  saveLocalDiskState(cachedState);
  return cachedState;
}

async function persistState(state: PersistedServerState): Promise<void> {
  cachedState = state;
  saveLocalDiskState(state);
  if (activeDriver === 'mysql' && mysqlPool) {
    await syncRelationalTablesToMysql(mysqlPool, state);
  } else if (activeDriver === 'postgres' && pgPool) {
    await syncRelationalTablesToPostgres(pgPool, state);
  }
}

export async function getServerState(): Promise<PersistedServerState> {
  return initServerDatabase();
}

export function getAdminAuthStatus(state: PersistedServerState) {
  const envPasscodeActive = Boolean((process.env.ADMIN_PASSCODE || '').trim());
  const hasStoredHash = Boolean(state.adminCredentialHash);
  return {
    adminConfigured: envPasscodeActive || hasStoredHash,
    envPasscodeActive,
    bootstrappedEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  };
}

export async function dbClaimAdminPassword(emailInput: string, password: string): Promise<UserRecord> {
  const state = await getServerState();
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode || state.adminCredentialHash) {
    throw new Error('Administrator credentials are already configured on the server.');
  }
  const email = emailInput.trim().toLowerCase() || BOOTSTRAPPED_ADMIN_EMAIL;
  if (!(BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(email)) {
    throw new Error(`First-run setup must use an authorized admin email (${BOOTSTRAPPED_ADMIN_EMAIL}).`);
  }
  if (password.length < 8) {
    throw new Error('Choose an administrator password with at least 8 characters.');
  }

  const hash = hashPasswordScrypt(password);
  state.adminCredentialHash = hash;

  let adminUser = Object.values(state.users).find((u) => u.email.toLowerCase() === email);
  const now = Date.now();
  if (!adminUser) {
    const uid = `uid_admin_${now.toString(36)}`;
    adminUser = {
      uid,
      playerId: 'CR-ADM001',
      fullName: 'Royale Admin Operations',
      email,
      phone: '+256700112233',
      dateOfBirth: '1992-01-10',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'admin',
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    };
    state.users[uid] = adminUser;
  } else {
    adminUser.role = 'admin';
    adminUser.accountStatus = 'Active';
    adminUser.emailVerified = true;
    adminUser.passwordHash = hash;
    adminUser.updatedAt = now;
  }

  state.administrators[adminUser.uid] = {
    uid: adminUser.uid,
    email: adminUser.email,
    fullName: adminUser.fullName,
    role: 'Super Admin',
    status: 'Active',
    createdAt: adminUser.createdAt || now,
  };

  if (!state.wallets[adminUser.uid]) {
    state.wallets[adminUser.uid] = {
      uid: adminUser.uid,
      playerId: adminUser.playerId,
      currency: 'UGX',
      availableBalance: 250000,
      pendingBalance: 0,
      realMoneyEnabled: true,
      regulatoryNotice: 'CASINO ROYALE UGX Wallet (Server DB)',
      createdAt: now,
      updatedAt: now,
    };
  }

  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}`,
    adminUid: adminUser.uid,
    adminEmail: adminUser.email,
    action: 'ADMIN_CREDENTIALS_CLAIMED',
    targetType: 'administrator',
    targetId: adminUser.uid,
    details: 'Administrator password claimed via one-time setup',
    createdAt: now,
  });

  await persistState(state);
  return sanitizeUser(adminUser);
}

export async function dbVerifyAdminLogin(emailInput: string, password: string): Promise<UserRecord> {
  const state = await getServerState();
  const email = emailInput.trim().toLowerCase();
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  const isBootEmail = (BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(email);

  let adminUser = Object.values(state.users).find((u) => u.email.toLowerCase() === email);
  const isKnownAdmin = Boolean(adminUser && (adminUser.role === 'admin' || state.administrators[adminUser.uid]?.status === 'Active'));
  if (!isBootEmail && !isKnownAdmin) {
    throw new Error('This email does not have active administrator permissions.');
  }

  let verified = false;
  if (envPasscode) {
    verified = verifyTimingSafeSecret(password, envPasscode);
  }
  if (!verified && state.adminCredentialHash && isBootEmail) {
    verified = verifyPasswordScrypt(password, state.adminCredentialHash);
  }
  if (!verified && adminUser?.passwordHash) {
    verified = verifyPasswordScrypt(password, adminUser.passwordHash);
  }

  if (!verified) {
    if (!envPasscode && !state.adminCredentialHash) {
      throw new Error('Set your first-run administrator password using the setup form below.');
    }
    throw new Error('Invalid administrator email or passcode.');
  }

  const now = Date.now();
  if (!adminUser) {
    const uid = `uid_admin_${now.toString(36)}`;
    adminUser = {
      uid,
      playerId: 'CR-ADM001',
      fullName: 'Royale Admin Operations',
      email,
      phone: '+256700112233',
      dateOfBirth: '1992-01-10',
      termsAccepted: true,
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'Approved',
      accountStatus: 'Active',
      role: 'admin',
      createdAt: now,
      updatedAt: now,
    };
    state.users[uid] = adminUser;
    state.administrators[uid] = {
      uid,
      email,
      fullName: adminUser.fullName,
      role: 'Super Admin',
      status: 'Active',
      createdAt: now,
    };
    await persistState(state);
  }

  return sanitizeUser(adminUser);
}

export async function dbRegisterPlayer(params: {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  password: string;
}): Promise<UserRecord> {
  const state = await getServerState();
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
  if (params.password.length < 8) throw new Error('Password must be at least 8 characters.');

  if (Object.values(state.users).some((u) => u.email.toLowerCase() === email)) {
    throw new Error('An account with that email already exists. Please sign in instead.');
  }

  const now = Date.now();
  const uid = `uid_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const playerId = `CR-${uid.slice(-6).toUpperCase()}`;
  const cleanName = params.fullName.trim().slice(0, 120) || 'Kampala Contender';

  const newUser: StoredUser = {
    uid,
    playerId,
    fullName: cleanName,
    email,
    phone: params.phone.trim().slice(0, 40) || '+256700000000',
    dateOfBirth: params.dateOfBirth || '1995-01-01',
    termsAccepted: true,
    emailVerified: true,
    phoneVerified: false,
    kycStatus: 'Not Submitted',
    accountStatus: 'Pending',
    role: 'player',
    passwordHash: hashPasswordScrypt(params.password),
    createdAt: now,
    updatedAt: now,
  };

  state.users[uid] = newUser;
  state.playerProfiles[uid] = {
    uid,
    playerId,
    displayName: cleanName.slice(0, 80),
    kycStatus: 'Not Submitted',
    accountStatus: 'Pending',
    totalGames: 0,
    gamesWon: 0,
    gamesLost: 0,
    winRate: 0,
    points: 0,
    createdAt: now,
    updatedAt: now,
  };
  state.wallets[uid] = {
    uid,
    playerId,
    currency: 'UGX',
    availableBalance: 0,
    pendingBalance: 0,
    realMoneyEnabled: true,
    regulatoryNotice: '18+ Identity-Verified UGX Mobile Money Gaming Account.',
    createdAt: now,
    updatedAt: now,
  };

  await persistState(state);
  return sanitizeUser(newUser);
}

export async function dbLoginPlayer(emailInput: string, password: string): Promise<UserRecord> {
  const state = await getServerState();
  const email = emailInput.trim().toLowerCase();
  const found = Object.values(state.users).find((u) => u.email.toLowerCase() === email);
  if (!found) {
    throw new Error('No account found for that email address.');
  }
  if (found.role === 'admin' || (BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(email)) {
    return dbVerifyAdminLogin(email, password);
  }
  if (!found.passwordHash || !verifyPasswordScrypt(password, found.passwordHash)) {
    throw new Error('Incorrect password for this account.');
  }
  if (found.accountStatus === 'Suspended') {
    throw new Error('This account has been suspended by operations.');
  }
  return sanitizeUser(found);
}

export async function dbGetDemoPlayer(): Promise<UserRecord> {
  const state = await getServerState();
  const demo = state.users['uid_demo_player'];
  if (!demo) throw new Error('Demo player profile unavailable.');
  return sanitizeUser(demo);
}

export async function dbEnsureWallet(uid: string): Promise<WalletRecord> {
  const state = await getServerState();
  if (!state.wallets[uid]) {
    const user = state.users[uid];
    state.wallets[uid] = {
      uid,
      playerId: user?.playerId || `CR-${uid.slice(-6).toUpperCase()}`,
      currency: 'UGX',
      availableBalance: 0,
      pendingBalance: 0,
      realMoneyEnabled: true,
      regulatoryNotice: '18+ Identity-Verified UGX Mobile Money Gaming Account.',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await persistState(state);
  }
  return state.wallets[uid];
}

export async function dbSubmitDeposit(params: {
  uid: string;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amountUgx: number;
  note?: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_UGX || amount > MAX_DEPOSIT_UGX) {
    throw new Error(
      `Deposit must be between UGX ${MIN_DEPOSIT_UGX.toLocaleString()} and UGX ${MAX_DEPOSIT_UGX.toLocaleString()}.`
    );
  }

  const state = await getServerState();
  await dbEnsureWallet(params.uid);
  const wallet = state.wallets[params.uid];
  const now = Date.now();
  const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
  const reference = makeRef('DEP');
  const cleanPhone = params.phoneNumber.trim().slice(0, 32);

  let depositStatus: 'Verified' | 'Pending' = 'Verified';
  let externalRef: string | undefined;
  let gateway: 'marzpay' | 'local' = 'local';
  let normalizedPhone = cleanPhone;

  if (isMarzPayConfigured()) {
    const mp = await marzpayCollectMoney({
      amountUgx: amount,
      phoneNumber: cleanPhone,
      reference,
      description: `CASINO ROYALE Deposit (${wallet.playerId})`,
      metadata: [{ uid: params.uid, playerId: wallet.playerId }],
    });
    if (mp.status === 'failed') {
      throw new Error(mp.message || 'MarzPay collection request was declined.');
    }
    gateway = 'marzpay';
    externalRef = mp.uuid;
    normalizedPhone = mp.phoneNumber;
    depositStatus = mp.status === 'completed' ? 'Verified' : 'Pending';
  }

  const nextBal =
    depositStatus === 'Verified'
      ? Number(wallet.availableBalance || 0) + amount
      : Number(wallet.availableBalance || 0);

  if (depositStatus === 'Verified') {
    wallet.availableBalance = nextBal;
    wallet.updatedAt = now;
  }

  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Deposit',
    provider: params.provider,
    phoneNumber: normalizedPhone,
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: nextBal,
    status: depositStatus,
    reference,
    externalRef,
    gateway,
    description: `${params.provider} Deposit${gateway === 'marzpay' ? ' (MarzPay)' : ''}`,
    note: (params.note || '').trim().slice(0, 200),
    createdAt: now,
    updatedAt: now,
  };
  state.transactions[txId] = tx;

  const notifs = state.notifications[params.uid] || [];
  state.notifications[params.uid] = [
    {
      notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
      uid: params.uid,
      title: depositStatus === 'Verified' ? 'Deposit Credited' : 'Approve MoMo PIN Prompt',
      message:
        depositStatus === 'Verified'
          ? `UGX ${amount.toLocaleString()} via ${params.provider} (Ref ${reference}) added to your wallet.`
          : `Confirm the UGX ${amount.toLocaleString()} MarzPay prompt on ${normalizedPhone} (Ref ${reference}).`,
      category: 'wallet' as const,
      type: 'wallet' as const,
      read: false,
      createdAt: now,
    },
    ...notifs,
  ].slice(0, 60);

  await persistState(state);
  return { tx, wallet };
}

export async function dbVerifyMarzPayDeposit(params: {
  txId: string;
  requesterUid: string;
  isAdmin: boolean;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const state = await getServerState();
  const tx = state.transactions[params.txId];
  if (!tx || tx.type !== 'Deposit') {
    throw new Error('Deposit transaction not found.');
  }
  if (!params.isAdmin && tx.uid !== params.requesterUid) {
    throw new Error('You do not have permission to check this deposit.');
  }
  await dbEnsureWallet(tx.uid);
  const wallet = state.wallets[tx.uid];

  if (tx.status === 'Verified') {
    return { tx, wallet };
  }
  if (tx.status !== 'Pending' || !tx.externalRef) {
    throw new Error('This deposit does not have a pending MarzPay transaction.');
  }

  const remote = await marzpayGetTransaction(tx.externalRef);
  const now = Date.now();
  if (remote.status === 'completed') {
    wallet.availableBalance = Number(wallet.availableBalance || 0) + Number(tx.amountUgx || 0);
    wallet.updatedAt = now;
    tx.status = 'Verified';
    tx.balanceAfter = wallet.availableBalance;
    tx.updatedAt = now;

    const notifs = state.notifications[tx.uid] || [];
    state.notifications[tx.uid] = [
      {
        notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
        uid: tx.uid,
        title: 'Deposit Credited',
        message: `UGX ${tx.amountUgx.toLocaleString()} MarzPay deposit (Ref ${tx.reference}) confirmed and added to your wallet.`,
        category: 'wallet' as const,
        type: 'wallet' as const,
        read: false,
        createdAt: now,
      },
      ...notifs,
    ].slice(0, 60);

    await persistState(state);
  } else if (remote.status === 'failed') {
    tx.status = 'Failed';
    tx.updatedAt = now;
    await persistState(state);
  }

  return { tx, wallet };
}

export async function dbReconcileMarzPayWebhook(params: {
  uuid: string;
  reference?: string;
}): Promise<{ matched: boolean; txId?: string; status?: string }> {
  if (!params.uuid || !isMarzPayConfigured()) {
    return { matched: false };
  }
  // Always verify directly against MarzPay API with server Basic Auth credentials
  const remote = await marzpayGetTransaction(params.uuid);
  const state = await getServerState();

  const tx = Object.values(state.transactions).find(
    (t) =>
      t.externalRef === params.uuid ||
      t.externalRef === remote.uuid ||
      (params.reference && t.reference === params.reference)
  );
  if (!tx) {
    return { matched: false };
  }

  await dbEnsureWallet(tx.uid);
  const wallet = state.wallets[tx.uid];
  const now = Date.now();

  if (tx.type === 'Deposit' && tx.status === 'Pending') {
    if (remote.status === 'completed') {
      wallet.availableBalance = Number(wallet.availableBalance || 0) + Number(tx.amountUgx || 0);
      wallet.updatedAt = now;
      tx.status = 'Verified';
      tx.balanceAfter = wallet.availableBalance;
      tx.updatedAt = now;

      const notifs = state.notifications[tx.uid] || [];
      state.notifications[tx.uid] = [
        {
          notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
          uid: tx.uid,
          title: 'Deposit Credited',
          message: `UGX ${tx.amountUgx.toLocaleString()} MarzPay deposit (Ref ${tx.reference}) verified.`,
          category: 'wallet' as const,
          type: 'wallet' as const,
          read: false,
          createdAt: now,
        },
        ...notifs,
      ].slice(0, 60);
      await persistState(state);
    } else if (remote.status === 'failed') {
      tx.status = 'Failed';
      tx.updatedAt = now;
      await persistState(state);
    }
  } else if (tx.type === 'Withdrawal' && tx.status === 'Pending' && remote.status === 'completed') {
    wallet.pendingBalance = Math.max(0, Number(wallet.pendingBalance || 0) - Number(tx.amountUgx || 0));
    wallet.updatedAt = now;
    tx.status = 'Paid';
    tx.updatedAt = now;
    await persistState(state);
  }

  return { matched: true, txId: tx.txId, status: tx.status };
}

export async function dbSubmitWithdrawal(params: {
  uid: string;
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amountUgx: number;
  note?: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_UGX || amount > MAX_WITHDRAWAL_UGX) {
    throw new Error(
      `Withdrawal must be between UGX ${MIN_WITHDRAWAL_UGX.toLocaleString()} and UGX ${MAX_WITHDRAWAL_UGX.toLocaleString()}.`
    );
  }

  const state = await getServerState();
  await dbEnsureWallet(params.uid);
  const wallet = state.wallets[params.uid];
  if (Number(wallet.availableBalance || 0) < amount) {
    throw new Error(
      `Insufficient UGX available balance (UGX ${Number(wallet.availableBalance || 0).toLocaleString()}).`
    );
  }

  const { feeUgx, netPayoutUgx } = calculateWithdrawalBreakdown(amount);
  const now = Date.now();
  const nextAvail = Number(wallet.availableBalance) - amount;
  wallet.availableBalance = nextAvail;
  wallet.pendingBalance = Number(wallet.pendingBalance || 0) + amount;
  wallet.updatedAt = now;

  const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
  const reference = makeRef('WDR');
  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Withdrawal',
    provider: params.provider,
    phoneNumber: params.phoneNumber.trim().slice(0, 32),
    amountUgx: amount,
    feeUgx,
    netAmountUgx: netPayoutUgx,
    netPayoutUgx,
    balanceAfter: nextAvail,
    status: 'Pending',
    reference,
    description: `${params.provider} Payout Request`,
    note: (params.note || '').trim().slice(0, 200),
    createdAt: now,
    updatedAt: now,
  };
  state.transactions[txId] = tx;

  const notifs = state.notifications[params.uid] || [];
  state.notifications[params.uid] = [
    {
      notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
      uid: params.uid,
      title: 'Withdrawal Requested',
      message: `UGX ${amount.toLocaleString()} withdrawal (${reference}) is pending payout settlement.`,
      category: 'wallet' as const,
      type: 'wallet' as const,
      read: false,
      createdAt: now,
    },
    ...notifs,
  ].slice(0, 60);

  await persistState(state);
  return { tx, wallet };
}

export async function dbCancelWithdrawal(uid: string, txId: string): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const state = await getServerState();
  const existing = state.transactions[txId];
  if (!existing || existing.uid !== uid || existing.type !== 'Withdrawal' || existing.status !== 'Pending') {
    throw new Error('Only your own pending withdrawals can be cancelled.');
  }
  await dbEnsureWallet(uid);
  const wallet = state.wallets[uid];
  const now = Date.now();
  wallet.availableBalance += existing.amountUgx;
  wallet.pendingBalance = Math.max(0, Number(wallet.pendingBalance || 0) - existing.amountUgx);
  wallet.updatedAt = now;

  existing.status = 'Cancelled';
  existing.updatedAt = now;

  await persistState(state);
  return { tx: existing, wallet };
}

export async function dbAdminSettleWithdrawal(params: {
  txId: string;
  decision: 'Paid' | 'Rejected';
  adminUid: string;
  adminEmail: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const state = await getServerState();
  const existing = state.transactions[params.txId];
  if (!existing || existing.type !== 'Withdrawal' || existing.status !== 'Pending') {
    throw new Error('This withdrawal has already been settled.');
  }
  await dbEnsureWallet(existing.uid);
  const wallet = state.wallets[existing.uid];
  const now = Date.now();
  const playerPhone = existing.phoneNumber || state.users[existing.uid]?.phone || '';
  const netPayout = existing.netPayoutUgx ?? calculateWithdrawalBreakdown(existing.amountUgx).netPayoutUgx;

  if (params.decision === 'Paid' && isMarzPayConfigured()) {
    if (!playerPhone) {
      throw new Error('Player Mobile Money phone number is required for MarzPay payout.');
    }
    const mpPayout = await marzpaySendMoney({
      amountUgx: netPayout,
      phoneNumber: playerPhone,
      reference: existing.reference,
      description: `CASINO ROYALE Payout ${existing.reference}`,
      metadata: [{ uid: existing.uid, playerId: existing.playerId, txId: existing.txId }],
    });
    if (mpPayout.status === 'failed') {
      throw new Error(mpPayout.message || 'MarzPay disbursement request failed.');
    }
    existing.externalRef = mpPayout.uuid;
    existing.gateway = 'marzpay';
  }

  wallet.pendingBalance = Math.max(0, Number(wallet.pendingBalance || 0) - existing.amountUgx);
  if (params.decision === 'Rejected') {
    wallet.availableBalance += existing.amountUgx;
  }
  wallet.updatedAt = now;

  existing.status = params.decision;
  existing.reviewedBy = params.adminUid;
  existing.updatedAt = now;

  const notifs = state.notifications[existing.uid] || [];
  state.notifications[existing.uid] = [
    {
      notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
      uid: existing.uid,
      title: params.decision === 'Paid' ? 'Withdrawal Paid' : 'Withdrawal Refunded',
      message:
        params.decision === 'Paid'
          ? `Your withdrawal ${existing.reference} (UGX ${(existing.netPayoutUgx || existing.amountUgx).toLocaleString()} net) has been marked Paid.`
          : `Your withdrawal ${existing.reference} was declined and UGX ${existing.amountUgx.toLocaleString()} was returned to available balance.`,
      category: 'wallet' as const,
      type: 'wallet' as const,
      read: false,
      createdAt: now,
    },
    ...notifs,
  ].slice(0, 60);

  const playerName = state.users[existing.uid]?.fullName || existing.playerId;
  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: params.decision === 'Paid' ? 'APPROVE_WITHDRAWAL' : 'REJECT_WITHDRAWAL',
    targetType: 'transaction',
    targetId: existing.txId,
    details: `${params.decision} withdrawal ${existing.reference} (UGX ${existing.amountUgx.toLocaleString()}) for ${playerName}${
      existing.gateway === 'marzpay' ? ` via MarzPay (${existing.externalRef})` : ''
    }`,
    createdAt: now,
  });

  await persistState(state);
  return { tx: existing, wallet };
}

export async function dbAdminManualDepositOrAdjustment(params: {
  targetUid: string;
  amountUgx: number;
  kind: 'Deposit' | 'Admin Adjustment';
  provider: MobileMoneyProvider;
  note: string;
  adminUid: string;
  adminEmail: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_UGX || amount > MAX_DEPOSIT_UGX) {
    throw new Error(`Amount must be between UGX ${MIN_DEPOSIT_UGX.toLocaleString()} and UGX ${MAX_DEPOSIT_UGX.toLocaleString()}.`);
  }
  const state = await getServerState();
  const user = state.users[params.targetUid];
  if (!user) throw new Error('Target player account not found in database.');
  await dbEnsureWallet(params.targetUid);
  const wallet = state.wallets[params.targetUid];
  const now = Date.now();
  wallet.availableBalance = Number(wallet.availableBalance || 0) + amount;
  wallet.updatedAt = now;

  const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
  const reference = makeRef(params.kind === 'Deposit' ? 'DEP' : 'ADJ');
  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.targetUid,
    playerId: wallet.playerId,
    type: params.kind,
    provider: params.provider,
    phoneNumber: user.phone || '',
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: wallet.availableBalance,
    status: 'Verified',
    reference,
    description: `${params.kind} credited from Spaceship cPanel`,
    note: params.note.trim().slice(0, 200),
    reviewedBy: params.adminUid,
    createdAt: now,
    updatedAt: now,
  };
  state.transactions[txId] = tx;

  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: 'CPANEL_WALLET_CREDIT',
    targetType: 'transaction',
    targetId: txId,
    details: `Credited ${params.kind} UGX ${amount.toLocaleString()} (${reference}) to ${user.fullName}`,
    createdAt: now,
  });

  await persistState(state);
  return { tx, wallet };
}

export async function dbPayGameEntryStake(params: {
  uid: string;
  amountUgx: number;
  gameLabel: string;
  relatedId?: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount < MIN_GAME_STAKE_UGX || amount > MAX_GAME_STAKE_UGX) {
    throw new Error(
      `Game entry stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
    );
  }
  const state = await getServerState();
  await dbEnsureWallet(params.uid);
  const wallet = state.wallets[params.uid];
  if (wallet.availableBalance < amount) {
    throw new Error(`Insufficient UGX balance (UGX ${wallet.availableBalance.toLocaleString()}).`);
  }
  const now = Date.now();
  wallet.availableBalance -= amount;
  wallet.updatedAt = now;

  const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
  const reference = makeRef('ENT');
  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Game Entry',
    provider: 'System',
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: wallet.availableBalance,
    status: 'Completed',
    reference,
    description: params.gameLabel,
    note: params.gameLabel,
    relatedId: params.relatedId,
    createdAt: now,
    updatedAt: now,
  };
  state.transactions[txId] = tx;
  await persistState(state);
  return { tx, wallet };
}

export async function dbCreditMatchWinnings(params: {
  uid: string;
  amountUgx: number;
  gameLabel: string;
  relatedId?: string;
}): Promise<{ tx: TransactionRecord; wallet: WalletRecord }> {
  const amount = Math.round(Number(params.amountUgx));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Winnings amount must be positive.');
  }
  const state = await getServerState();
  await dbEnsureWallet(params.uid);
  const wallet = state.wallets[params.uid];
  const now = Date.now();
  wallet.availableBalance += amount;
  wallet.updatedAt = now;

  const txId = `tx_${now}_${crypto.randomBytes(3).toString('hex')}`;
  const reference = makeRef('WIN');
  const tx: TransactionRecord = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: wallet.playerId,
    type: 'Match Win',
    provider: 'System',
    amountUgx: amount,
    feeUgx: 0,
    netAmountUgx: amount,
    netPayoutUgx: amount,
    balanceAfter: wallet.availableBalance,
    status: 'Completed',
    reference,
    description: params.gameLabel,
    note: params.gameLabel,
    relatedId: params.relatedId,
    createdAt: now,
    updatedAt: now,
  };
  state.transactions[txId] = tx;
  await persistState(state);
  return { tx, wallet };
}

export async function dbSubmitKyc(uid: string, payload: IdentityVerificationRecord): Promise<void> {
  const state = await getServerState();
  const now = Date.now();
  state.kycRecords[uid] = { ...payload, uid, updatedAt: now };
  if (state.users[uid]) {
    state.users[uid].fullName = payload.legal_name;
    state.users[uid].kycStatus = 'Pending Verification';
    state.users[uid].updatedAt = now;
  }
  if (state.playerProfiles[uid]) {
    state.playerProfiles[uid].kycStatus = 'Pending Verification';
    state.playerProfiles[uid].updatedAt = now;
  }
  await persistState(state);
}

export async function dbReviewKyc(params: {
  targetUid: string;
  status: KycStatus;
  reason?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<IdentityVerificationRecord> {
  const state = await getServerState();
  const rec = state.kycRecords[params.targetUid];
  if (!rec) throw new Error('KYC record not found.');
  const now = Date.now();
  const accountStatus =
    params.status === 'Approved' ? 'Active' : params.status === 'Suspended' ? 'Suspended' : 'Pending';

  const updated: IdentityVerificationRecord = {
    ...rec,
    verification_status: params.status,
    reviewed_at: new Date(now).toISOString(),
    reviewed_by: params.adminUid,
    rejection_reason: params.reason?.trim() ? params.reason.trim().slice(0, 500) : rec.rejection_reason,
    updatedAt: now,
  };
  state.kycRecords[params.targetUid] = updated;
  if (state.users[params.targetUid]) {
    state.users[params.targetUid].kycStatus = params.status;
    state.users[params.targetUid].accountStatus = accountStatus;
    state.users[params.targetUid].updatedAt = now;
  }
  if (state.playerProfiles[params.targetUid]) {
    state.playerProfiles[params.targetUid].kycStatus = params.status;
    state.playerProfiles[params.targetUid].accountStatus = accountStatus;
    state.playerProfiles[params.targetUid].updatedAt = now;
  }

  const notifs = state.notifications[params.targetUid] || [];
  state.notifications[params.targetUid] = [
    {
      notificationId: `notif_${now}_${crypto.randomBytes(2).toString('hex')}`,
      uid: params.targetUid,
      title: `KYC Verification ${params.status}`,
      message:
        params.status === 'Approved'
          ? 'Your 18+ identity verification is approved. Live tables and withdrawals are unlocked.'
          : `Your verification status changed to ${params.status}. ${params.reason || ''}`,
      category: 'kyc' as const,
      type: 'kyc' as const,
      read: false,
      createdAt: now,
    },
    ...notifs,
  ].slice(0, 60);

  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: `KYC_${params.status.toUpperCase()}`,
    targetType: 'identity_verification',
    targetId: updated.verification_id,
    details: `${updated.legal_name} (${updated.player_id}) -> ${params.status}`,
    createdAt: now,
  });

  await persistState(state);
  return updated;
}

export async function dbTogglePlayerStatus(params: {
  targetUid: string;
  accountStatus: 'Active' | 'Suspended';
  adminUid: string;
  adminEmail: string;
}): Promise<UserRecord> {
  const state = await getServerState();
  const u = state.users[params.targetUid];
  if (!u) throw new Error('User not found.');
  const now = Date.now();
  u.accountStatus = params.accountStatus;
  u.updatedAt = now;
  if (state.playerProfiles[params.targetUid]) {
    state.playerProfiles[params.targetUid].accountStatus = params.accountStatus;
    state.playerProfiles[params.targetUid].updatedAt = now;
  }
  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: `ACCOUNT_${params.accountStatus.toUpperCase()}`,
    targetType: 'user',
    targetId: u.uid,
    details: `${u.fullName} (${u.playerId}) set to ${params.accountStatus}`,
    createdAt: now,
  });
  await persistState(state);
  return sanitizeUser(u);
}

export async function dbSubmitSupportTicket(ticket: SupportTicketRecord): Promise<void> {
  const state = await getServerState();
  state.supportTickets[ticket.ticketId] = ticket;
  await persistState(state);
}

export async function dbResolveSupportTicket(params: {
  ticketId: string;
  reply: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const state = await getServerState();
  const existing = state.supportTickets[params.ticketId];
  if (!existing) throw new Error('Ticket not found.');
  const now = Date.now();
  state.supportTickets[params.ticketId] = {
    ...existing,
    status: 'Resolved',
    adminReply: params.reply.slice(0, 1000),
    reviewedBy: params.adminUid,
    updatedAt: now,
  };
  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid: params.adminUid,
    adminEmail: params.adminEmail,
    action: 'RESOLVE_TICKET',
    targetType: 'support_ticket',
    targetId: params.ticketId,
    details: `Resolved ticket from ${existing.playerName || existing.name}`,
    createdAt: now,
  });
  await persistState(state);
}

export async function dbUpdateSystemSettings(
  patch: Partial<SystemSettingsRecord>,
  adminUid: string,
  adminEmail: string
): Promise<SystemSettingsRecord> {
  const state = await getServerState();
  const now = Date.now();
  state.systemSettings = {
    ...state.systemSettings,
    ...patch,
    updatedBy: adminUid,
    updatedAt: now,
  };
  state.adminLogs.unshift({
    logId: `log_${now.toString(36)}_${crypto.randomBytes(2).toString('hex')}`,
    adminUid,
    adminEmail,
    action: 'UPDATE_SYSTEM_SETTINGS',
    targetType: 'system_settings',
    targetId: 'global',
    details: `Updated platform settings (${state.systemSettings.brandName})`,
    createdAt: now,
  });
  await persistState(state);
  return state.systemSettings;
}

export async function dbGetPlayerHydration(uid: string) {
  const state = await getServerState();
  const user = state.users[uid];
  if (!user) return null;
  return {
    user: sanitizeUser(user),
    playerProfile: state.playerProfiles[uid] || null,
    wallet: state.wallets[uid] || (await dbEnsureWallet(uid)),
    kycRecord: state.kycRecords[uid] || null,
    transactions: Object.values(state.transactions).filter((t) => t.uid === uid),
    notifications: state.notifications[uid] || [],
    systemSettings: state.systemSettings,
    aiConfig: state.aiConfig,
  };
}

export async function dbGetAdminOverview() {
  const state = await getServerState();
  const safeUsers: Record<string, UserRecord> = {};
  for (const [k, v] of Object.entries(state.users)) {
    safeUsers[k] = sanitizeUser(v);
  }
  return {
    users: safeUsers,
    playerProfiles: state.playerProfiles,
    wallets: state.wallets,
    transactions: state.transactions,
    kycRecords: state.kycRecords,
    tournaments: state.tournaments,
    tournamentEntries: state.tournamentEntries,
    tournamentMatches: state.tournamentMatches,
    supportTickets: state.supportTickets,
    announcements: state.announcements,
    adminLogs: state.adminLogs,
    administrators: state.administrators,
    systemSettings: state.systemSettings,
    aiConfig: state.aiConfig,
  };
}

export async function getDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const start = Date.now();
  const state = await getServerState();
  const cfg = detectDatabaseConfig();
  let connected = true;
  let errorMessage = lastSqlError || undefined;

  if (activeDriver === 'mysql' && mysqlPool) {
    try {
      await mysqlPool.query('SELECT 1');
    } catch (err) {
      connected = false;
      errorMessage = err instanceof Error ? err.message : 'MySQL ping failed';
    }
  } else if (activeDriver === 'postgres' && pgPool) {
    try {
      await pgPool.query('SELECT 1');
    } catch (err) {
      connected = false;
      errorMessage = err instanceof Error ? err.message : 'PostgreSQL ping failed';
    }
  }

  const latencyMs = Math.max(1, Date.now() - start);
  const allTx = Object.values(state.transactions);
  const deposits = allTx.filter((t) => t.type === 'Deposit' && t.status === 'Verified');
  const pendingWd = allTx.filter((t) => t.type === 'Withdrawal' && t.status === 'Pending');
  const paidWd = allTx.filter((t) => t.type === 'Withdrawal' && t.status === 'Paid');

  const tables: TableDiagnosticInfo[] = [
    { tableName: 'cr_users', label: 'Registered Players & Admins', rowCount: Object.keys(state.users).length, category: 'accounts' },
    { tableName: 'cr_player_profiles', label: 'Player Profiles & Points', rowCount: Object.keys(state.playerProfiles).length, category: 'accounts' },
    { tableName: 'cr_wallets', label: 'UGX Player Wallets', rowCount: Object.keys(state.wallets).length, category: 'payments' },
    { tableName: 'cr_transactions', label: 'Deposits, Withdrawals & Game Ledger', rowCount: allTx.length, category: 'payments' },
    { tableName: 'cr_kyc_records', label: '18+ ID Verification Vault', rowCount: Object.keys(state.kycRecords).length, category: 'compliance' },
    { tableName: 'cr_tournaments', label: 'Daily & Custom Tournaments', rowCount: Object.keys(state.tournaments).length, category: 'gaming' },
    { tableName: 'cr_support_tickets', label: 'Support Inbox Tickets', rowCount: Object.keys(state.supportTickets).length, category: 'operations' },
    { tableName: 'cr_admin_logs', label: 'Administrative Audit Logs', rowCount: state.adminLogs.length, category: 'operations' },
    { tableName: 'cr_administrators', label: 'Authorised Officers', rowCount: Object.keys(state.administrators).length, category: 'compliance' },
    { tableName: 'cr_system_settings', label: 'Platform Rules & cPanel Config', rowCount: 1, category: 'operations' },
  ];

  return {
    driver: activeDriver,
    connected,
    hostLabel: activeDriver === 'local_server_db' ? 'App Server Storage' : cfg.host,
    databaseLabel: activeDriver === 'local_server_db' ? 'data/casinoroyale-db.json' : cfg.database || 'configured',
    latencyMs,
    errorMessage,
    tables,
    paymentSummary: {
      verifiedDepositsUgx: deposits.reduce((s, t) => s + Number(t.amountUgx || 0), 0),
      verifiedDepositCount: deposits.length,
      pendingWithdrawalsUgx: pendingWd.reduce((s, t) => s + Number(t.amountUgx || 0), 0),
      pendingWithdrawalCount: pendingWd.length,
      paidWithdrawalsUgx: paidWd.reduce((s, t) => s + Number(t.amountUgx || 0), 0),
      paidWithdrawalCount: paidWd.length,
      totalWalletBalanceUgx: Object.values(state.wallets).reduce((s, w) => s + Number(w.availableBalance || 0), 0),
    },
    envStatus: {
      dbDriverSetting: (process.env.DB_DRIVER || 'auto').trim(),
      hasDatabaseUrl: Boolean(cfg.connectionUrl),
      hasDbCredentials: Boolean(cfg.user && cfg.database),
      hasCpanelUapi: Boolean(process.env.CPANEL_HOST && process.env.CPANEL_USER && process.env.CPANEL_API_TOKEN),
      hasEnvAdminPasscode: Boolean((process.env.ADMIN_PASSCODE || '').trim()),
      hasMarzPayCredentials: isMarzPayConfigured(),
      hasMarzPayWebhookSecret: Boolean((process.env.MARZPAY_WEBHOOK_SECRET || '').trim()),
    },
  };
}

export async function syncSchemaNow(): Promise<DatabaseDiagnostics> {
  const state = await getServerState();
  await persistState(state);
  return getDatabaseDiagnostics();
}

function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v)) : '0';
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v).replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${s}'`;
}

export async function generateSqlDump(): Promise<string> {
  const state = await getServerState();
  const lines: string[] = [
    '-- CASINO ROYALE — Spaceship cPanel MySQL / MariaDB / PostgreSQL Export',
    `-- Generated at ${new Date().toISOString()}`,
    '',
    'CREATE TABLE IF NOT EXISTS cr_users (uid VARCHAR(128) PRIMARY KEY, player_id VARCHAR(64), full_name VARCHAR(160), email VARCHAR(190), phone VARCHAR(64), role VARCHAR(32), kyc_status VARCHAR(48), account_status VARCHAR(32), updated_at BIGINT);',
    'CREATE TABLE IF NOT EXISTS cr_wallets (uid VARCHAR(128) PRIMARY KEY, player_id VARCHAR(64), currency VARCHAR(16), available_balance BIGINT, pending_balance BIGINT, updated_at BIGINT);',
    'CREATE TABLE IF NOT EXISTS cr_transactions (tx_id VARCHAR(128) PRIMARY KEY, uid VARCHAR(128), player_id VARCHAR(64), tx_type VARCHAR(48), provider VARCHAR(64), phone_number VARCHAR(64), amount_ugx BIGINT, fee_ugx BIGINT, net_payout_ugx BIGINT, balance_after BIGINT, status VARCHAR(32), reference VARCHAR(80), note VARCHAR(255), created_at BIGINT);',
    '',
  ];

  for (const u of Object.values(state.users)) {
    lines.push(
      `INSERT INTO cr_users (uid, player_id, full_name, email, phone, role, kyc_status, account_status, updated_at) VALUES (${sqlVal(u.uid)}, ${sqlVal(u.playerId)}, ${sqlVal(u.fullName)}, ${sqlVal(u.email)}, ${sqlVal(u.phone)}, ${sqlVal(u.role)}, ${sqlVal(u.kycStatus)}, ${sqlVal(u.accountStatus)}, ${sqlVal(Number(u.updatedAt || Date.now()))});`
    );
  }
  lines.push('');
  for (const w of Object.values(state.wallets)) {
    lines.push(
      `INSERT INTO cr_wallets (uid, player_id, currency, available_balance, pending_balance, updated_at) VALUES (${sqlVal(w.uid)}, ${sqlVal(w.playerId)}, ${sqlVal(w.currency)}, ${sqlVal(w.availableBalance)}, ${sqlVal(w.pendingBalance)}, ${sqlVal(Number(w.updatedAt || Date.now()))});`
    );
  }
  lines.push('');
  for (const tx of Object.values(state.transactions)) {
    lines.push(
      `INSERT INTO cr_transactions (tx_id, uid, player_id, tx_type, provider, phone_number, amount_ugx, fee_ugx, net_payout_ugx, balance_after, status, reference, note, created_at) VALUES (${sqlVal(tx.txId)}, ${sqlVal(tx.uid)}, ${sqlVal(tx.playerId)}, ${sqlVal(tx.type)}, ${sqlVal(tx.provider)}, ${sqlVal(tx.phoneNumber)}, ${sqlVal(tx.amountUgx)}, ${sqlVal(tx.feeUgx || 0)}, ${sqlVal(tx.netPayoutUgx || tx.amountUgx)}, ${sqlVal(tx.balanceAfter || 0)}, ${sqlVal(tx.status)}, ${sqlVal(tx.reference)}, ${sqlVal(tx.note)}, ${sqlVal(Number(tx.createdAt || Date.now()))});`
    );
  }
  return lines.join('\n');
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h === '::1') return true;
  if (net.isIP(h)) {
    if (h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) {
      return true;
    }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
    if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  }
  return false;
}

export async function testCpanelUapiConnection(): Promise<CpanelUapiTestResult> {
  const rawHost = (process.env.CPANEL_HOST || '').trim();
  const cpanelUser = (process.env.CPANEL_USER || '').trim();
  const cpanelToken = (process.env.CPANEL_API_TOKEN || '').trim();
  const cpanelPort = Math.min(65535, Math.max(1, Number(process.env.CPANEL_PORT || 2083)));

  if (!rawHost || !cpanelUser || !cpanelToken) {
    return {
      configured: false,
      connected: false,
      mysqlDatabases: [],
      postgresDatabases: [],
      message:
        'Optional Spaceship cPanel UAPI variables (CPANEL_HOST, CPANEL_USER, CPANEL_API_TOKEN) are not set in server environment yet.',
    };
  }

  let parsed: URL;
  try {
    const withProto = /^https?:\/\//i.test(rawHost) ? rawHost : `https://${rawHost}`;
    parsed = new URL(withProto);
  } catch {
    return {
      configured: true,
      connected: false,
      mysqlDatabases: [],
      postgresDatabases: [],
      message: 'CPANEL_HOST is not a valid hostname.',
    };
  }

  if (parsed.protocol !== 'https:' || isPrivateOrBlockedHost(parsed.hostname)) {
    return {
      configured: true,
      connected: false,
      mysqlDatabases: [],
      postgresDatabases: [],
      message: 'CPANEL_HOST must be a public HTTPS cPanel hostname.',
    };
  }

  const baseOrigin = `https://${parsed.hostname}:${cpanelPort}`;
  const headers = {
    Authorization: `cpanel ${cpanelUser}:${cpanelToken}`,
    Accept: 'application/json',
  };

  try {
    const [mysqlRes, pgRes] = await Promise.all([
      fetch(`${baseOrigin}/execute/Mysql/list_databases`, { headers }),
      fetch(`${baseOrigin}/execute/Postgresql/list_databases`, { headers }).catch(() => null),
    ]);

    if (!mysqlRes.ok) {
      return {
        configured: true,
        connected: false,
        host: parsed.hostname,
        mysqlDatabases: [],
        postgresDatabases: [],
        message: `cPanel UAPI returned HTTP ${mysqlRes.status}. Verify CPANEL_USER and CPANEL_API_TOKEN.`,
      };
    }

    const mysqlJson = (await mysqlRes.json()) as { data?: Array<{ database?: string }> };
    const mysqlDatabases = Array.isArray(mysqlJson.data)
      ? mysqlJson.data.map((d) => String(d.database || '')).filter(Boolean)
      : [];

    let postgresDatabases: string[] = [];
    if (pgRes && pgRes.ok) {
      const pgJson = (await pgRes.json()) as { data?: Array<{ database?: string }> };
      postgresDatabases = Array.isArray(pgJson.data)
        ? pgJson.data.map((d) => String(d.database || '')).filter(Boolean)
        : [];
    }

    return {
      configured: true,
      connected: true,
      host: parsed.hostname,
      mysqlDatabases,
      postgresDatabases,
      message: `Connected to Spaceship cPanel (${parsed.hostname}). Discovered ${mysqlDatabases.length} MySQL and ${postgresDatabases.length} PostgreSQL database(s).`,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      host: parsed.hostname,
      mysqlDatabases: [],
      postgresDatabases: [],
      message: err instanceof Error ? err.message : 'Unable to reach Spaceship cPanel UAPI.',
    };
  }
}
