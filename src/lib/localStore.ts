import { DEFAULT_MATATU_RULES } from '../shared/matatuRules';
import { DEFAULT_AI_CONFIG, type AiGovernanceConfig } from '../shared/aiPersonas';
import { getKampalaDateString } from '../shared/tournamentEngine';
import type { RoomChatMessage } from '../shared/chatPresets';
import type {
  AdminLogRecord,
  AdministratorRecord,
  AnnouncementRecord,
  DirectMessageRecord,
  DirectThreadRecord,
  FriendshipRecord,
  GameHistoryRecord,
  GameInviteRecord,
  IdentityVerificationRecord,
  NotificationRecord,
  PlayerPresenceRecord,
  PlayerProfile,
  PublicRoomSummary,
  SupportTicketRecord,
  SystemSettingsRecord,
  TableGameType,
  TournamentEntryRecord,
  TournamentMatchRecord,
  TournamentRecord,
  TransactionRecord,
  UserRecord,
  WalletRecord,
} from '../shared/types';

export interface LocalAuthUser {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  password?: string;
}

export interface LocalRoomConfig {
  roomId: string;
  roomCode: string;
  name: string;
  hostUid: string;
  hostName: string;
  isPrivate: boolean;
  gameType: TableGameType;
  mode: 'multiplayer' | 'bot';
  maxPlayers: number;
  entryFeeUgx: number;
  playerUids: string[];
  aiSeats: Array<{ uid: string; displayName: string; gender?: 'male' | 'female' }>;
  status: 'waiting' | 'in_progress' | 'completed';
  tournamentId?: string;
  tournamentMatchId?: string;
  createdAt: number;
  updatedAt: number;
}

export const BOOTSTRAPPED_ADMIN_EMAILS = ['makaug171@gmail.com', 'markniaras@gmail.com'] as const;
export const BOOTSTRAPPED_ADMIN_EMAIL = BOOTSTRAPPED_ADMIN_EMAILS[0];

const nowMs = Date.now();
const todayStr = getKampalaDateString();

function createInitialSeed() {
  const users: Record<string, UserRecord & { password?: string }> = {
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
      email: 'makaug171@gmail.com',
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
      regulatoryNotice: 'CASINO ROYALE UGX Wallet (Local Arena Mode)',
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
      regulatoryNotice: 'CASINO ROYALE UGX Wallet',
      createdAt: nowMs - 86400000 * 30,
      updatedAt: nowMs - 3600000,
    },
  };

  const administrators: Record<string, AdministratorRecord> = {
    uid_admin_1: {
      uid: 'uid_admin_1',
      email: 'makaug171@gmail.com',
      fullName: 'Royale Admin Operations',
      role: 'Super Admin',
      status: 'Active',
      createdAt: nowMs - 86400000 * 30,
    },
  };

  const systemSettings: SystemSettingsRecord = {
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
  };

  const announcements: Record<string, AnnouncementRecord> = {
    welcome_casinoroyale: {
      announcementId: 'welcome_casinoroyale',
      title: 'Welcome to CASINO ROYALE',
      summary:
        'Daily Matatu Royale, Ludo Master, Kampala Chess, and Uganda Drafts cups are open for verified players.',
      body: 'Complete 18+ identity verification to enter multiplayer tables, manage your UGX wallet, and compete in single-elimination daily brackets.',
      published: true,
      active: true,
      priority: 'Important',
      createdAt: nowMs - 3600000 * 4,
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

  const presence: Record<string, PlayerPresenceRecord> = {
    uid_contender_prossy: {
      uid: 'uid_contender_prossy',
      playerId: 'CR-KMP412',
      displayName: 'Prossy Nabwire',
      status: 'online',
      lastSeenMs: nowMs,
    },
    uid_contender_david: {
      uid: 'uid_contender_david',
      playerId: 'CR-ENT309',
      displayName: 'David Kato',
      status: 'in_game',
      currentGameType: 'matatu',
      lastSeenMs: nowMs,
    },
    uid_contender_sarah: {
      uid: 'uid_contender_sarah',
      playerId: 'CR-KMP204',
      displayName: 'Sarah Namukasa',
      status: 'online',
      lastSeenMs: nowMs,
    },
  };

  const lobbyChat: RoomChatMessage[] = [
    {
      id: 'lchat_seed_1',
      roomId: 'lobby',
      uid: 'system',
      senderName: 'Arena Lounge',
      text: 'Welcome to CASINO ROYALE Kampala Arena Lounge.',
      createdAtMs: nowMs - 120000,
      isSystem: true,
    },
    {
      id: 'lchat_seed_2',
      roomId: 'lobby',
      uid: 'ai_sarah_n',
      senderName: 'Sarah Namukasa',
      text: 'Anyone up for a quick 2-player Matatu or Ludo Master match?',
      createdAtMs: nowMs - 60000,
      isFreeText: true,
      isAi: true,
      senderGender: 'female',
    },
  ];

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
    },
  };

  return {
    currentUid: null as string | null,
    users,
    playerProfiles,
    wallets,
    kycRecords: {} as Record<string, IdentityVerificationRecord>,
    transactions,
    notifications: {} as Record<string, NotificationRecord[]>,
    gameHistory: [] as GameHistoryRecord[],
    tournaments,
    tournamentEntries,
    tournamentMatches: {} as Record<string, TournamentMatchRecord[]>,
    rooms: {} as Record<string, LocalRoomConfig>,
    supportTickets: {} as Record<string, SupportTicketRecord>,
    announcements,
    adminLogs: [] as AdminLogRecord[],
    administrators,
    systemSettings,
    aiConfig: { ...DEFAULT_AI_CONFIG } as AiGovernanceConfig,
    lobbyChat,
    roomChats: {} as Record<string, RoomChatMessage[]>,
    presence,
    friendships: {} as Record<string, FriendshipRecord>,
    directThreads: {} as Record<string, DirectThreadRecord>,
    directMessages: {} as Record<string, DirectMessageRecord[]>,
    invites: {} as Record<string, GameInviteRecord>,
  };
}

export type LocalStoreState = ReturnType<typeof createInitialSeed>;

const storeState: LocalStoreState = createInitialSeed();
const listeners = new Set<() => void>();

export function getStore(): LocalStoreState {
  return storeState;
}

export function notifyStore(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function listPublicRoomsFromStore(): PublicRoomSummary[] {
  return Object.values(storeState.rooms)
    .filter((r) => !r.isPrivate && r.status !== 'completed')
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((r) => ({
      roomId: r.roomId,
      roomCode: r.roomCode,
      name: r.name,
      hostUid: r.hostUid,
      hostName: r.hostName,
      isPrivate: r.isPrivate,
      gameType: r.gameType,
      mode: r.mode,
      maxPlayers: r.maxPlayers,
      playerCount: r.playerUids.length + r.aiSeats.length,
      playerNames: [
        ...r.playerUids.map((uid) => storeState.users[uid]?.fullName || r.hostName),
        ...r.aiSeats.map((a) => a.displayName),
      ],
      entryFeeUgx: r.entryFeeUgx,
      status: r.status,
      createdAt: r.createdAt,
    }));
}

export function pushNotification(
  uid: string,
  notif: Omit<NotificationRecord, 'notificationId' | 'uid' | 'read' | 'createdAt'>
): void {
  const list = storeState.notifications[uid] || [];
  const item: NotificationRecord = {
    notificationId: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    uid,
    title: notif.title,
    message: notif.message,
    category: notif.category || notif.type || 'info',
    type: notif.type || notif.category || 'info',
    read: false,
    createdAt: Date.now(),
  };
  storeState.notifications[uid] = [item, ...list].slice(0, 60);
  notifyStore();
}

export interface ServerPlayerHydration {
  user: UserRecord;
  playerProfile: PlayerProfile | null;
  wallet: WalletRecord;
  kycRecord: IdentityVerificationRecord | null;
  transactions: TransactionRecord[];
  notifications: NotificationRecord[];
  systemSettings?: SystemSettingsRecord;
  aiConfig?: AiGovernanceConfig;
}

export interface ServerAdminOverview {
  users: Record<string, UserRecord>;
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
  systemSettings: SystemSettingsRecord;
  aiConfig: AiGovernanceConfig;
}

export function hydratePlayerFromServer(hydration: ServerPlayerHydration): void {
  const { user, playerProfile, wallet, kycRecord, transactions, notifications, systemSettings, aiConfig } =
    hydration;
  storeState.users[user.uid] = { ...user };
  if (playerProfile) {
    storeState.playerProfiles[user.uid] = { ...playerProfile };
  }
  if (wallet) {
    storeState.wallets[user.uid] = { ...wallet };
  }
  if (kycRecord) {
    storeState.kycRecords[user.uid] = { ...kycRecord };
  }
  if (Array.isArray(transactions)) {
    transactions.forEach((tx) => {
      storeState.transactions[tx.txId] = { ...tx };
    });
  }
  if (Array.isArray(notifications)) {
    storeState.notifications[user.uid] = [...notifications];
  }
  if (systemSettings) {
    storeState.systemSettings = { ...systemSettings };
  }
  if (aiConfig) {
    storeState.aiConfig = { ...aiConfig };
  }
  storeState.currentUid = user.uid;
  storeState.presence[user.uid] = {
    uid: user.uid,
    playerId: user.playerId,
    displayName: user.fullName,
    status: 'online',
    lastSeenMs: Date.now(),
  };
  notifyStore();
}

export function hydrateAdminFromServer(overview: ServerAdminOverview, currentAdminUid?: string): void {
  if (overview.users) storeState.users = { ...overview.users };
  if (overview.playerProfiles) storeState.playerProfiles = { ...overview.playerProfiles };
  if (overview.wallets) storeState.wallets = { ...overview.wallets };
  if (overview.transactions) storeState.transactions = { ...overview.transactions };
  if (overview.kycRecords) storeState.kycRecords = { ...overview.kycRecords };
  if (overview.tournaments) storeState.tournaments = { ...overview.tournaments };
  if (overview.tournamentEntries) storeState.tournamentEntries = { ...overview.tournamentEntries };
  if (overview.tournamentMatches) storeState.tournamentMatches = { ...overview.tournamentMatches };
  if (overview.supportTickets) storeState.supportTickets = { ...overview.supportTickets };
  if (overview.announcements) storeState.announcements = { ...overview.announcements };
  if (Array.isArray(overview.adminLogs)) storeState.adminLogs = [...overview.adminLogs];
  if (overview.administrators) storeState.administrators = { ...overview.administrators };
  if (overview.systemSettings) storeState.systemSettings = { ...overview.systemSettings };
  if (overview.aiConfig) storeState.aiConfig = { ...overview.aiConfig };
  if (currentAdminUid) {
    storeState.currentUid = currentAdminUid;
  }
  notifyStore();
}

export function upsertWalletAndTxFromServer(wallet?: WalletRecord | null, tx?: TransactionRecord | null): void {
  if (wallet) {
    storeState.wallets[wallet.uid] = { ...wallet };
  }
  if (tx) {
    storeState.transactions[tx.txId] = { ...tx };
  }
  notifyStore();
}

