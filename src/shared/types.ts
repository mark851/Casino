export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export interface PlayingCard {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type TableGameType = 'matatu' | 'ludo' | 'chess' | 'drafts';

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';
export type ChessColor = 'w' | 'b';
export type ChessPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type DraftsColor = 'red' | 'black';

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
  hasMoved?: boolean;
}

export interface ChessLegalMoveTarget {
  toRow: number;
  toCol: number;
  isCapture?: boolean;
  isCastle?: boolean;
  isEnPassant?: boolean;
  isPromotion?: boolean;
}

export interface ChessMoveRecord {
  san: string;
  color?: ChessColor;
  from?: { row: number; col: number };
  to?: { row: number; col: number };
}

export interface SanitizedChessState {
  board: (ChessPiece | null)[][];
  turn: ChessColor;
  seatColors: Record<string, ChessColor>;
  legalMovesBySquare: Record<string, ChessLegalMoveTarget[]>;
  inCheckColor: ChessColor | null;
  lastMove?: {
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null;
  moveHistory: ChessMoveRecord[];
  capturedByWhite: ChessPieceType[];
  capturedByBlack: ChessPieceType[];
  materialAdvantageWhite: number;
  resultReason?: string;
}

export interface DraftsPiece {
  color: DraftsColor;
  king: boolean;
}

export interface DraftsLegalMoveTarget {
  toRow: number;
  toCol: number;
  isCapture?: boolean;
  capturedRow?: number;
  capturedCol?: number;
}

export interface DraftsMoveRecord {
  turn: number;
  color: DraftsColor;
  notation: string;
}

export interface SanitizedDraftsState {
  board: (DraftsPiece | null)[][];
  turn: DraftsColor;
  seatColors: Record<string, DraftsColor>;
  legalMovesBySquare: Record<string, DraftsLegalMoveTarget[]>;
  activeChainSquare: { row: number; col: number } | null;
  mustCapture: boolean;
  lastMove?: {
    from: { row: number; col: number };
    to: { row: number; col: number };
  } | null;
  moveCount: number;
  redRemaining: number;
  blackRemaining: number;
  redCount: number;
  blackCount: number;
  capturedByRed: number;
  capturedByBlack: number;
  moveHistory: DraftsMoveRecord[];
  resultReason?: string;
}

export interface LudoMoveRecord {
  turn: number;
  text: string;
}

export interface SanitizedLudoState {
  activeColors: LudoColor[];
  seatColors: Record<string, LudoColor>;
  turnColor: LudoColor;
  phase: 'roll' | 'move';
  diceValue: number | null;
  legalTokenIndices: number[];
  movableTokenIndices: number[];
  consecutiveSixes: number;
  doubleSixUnlocked?: boolean;
  tokensByColor: Record<LudoColor, number[]>;
  finishedCountByColor: Record<LudoColor, number>;
  winnerColor: LudoColor | null;
  moveHistory: LudoMoveRecord[];
  lastEventText?: string;
}

export interface SanitizedSeatState {
  uid: string;
  playerId: string;
  displayName: string;
  seatIndex: number;
  connected: boolean;
  isBot: boolean;
  gender?: 'male' | 'female';
  cardCount: number;
  calledLastCard: boolean;
  score?: number;
  hand?: PlayingCard[];
}

export interface MatatuRulesConfig {
  initialHandSize: number;
  allowStackingTwos: boolean;
  sevenOfDiamondsCutter: boolean;
  jackSkipsTurn: boolean;
  kingReversesDirection: boolean;
  eightPlaysAgain: boolean;
  aceWildOnAnyCard: boolean;
  threeDrawPenalty: boolean;
  allowFinishOnSpecialCard: boolean;
  turnTimeoutSeconds: number;
}

export interface SanitizedGameState {
  roomId: string;
  roomCode: string;
  roomName: string;
  gameId: string;
  gameType: TableGameType;
  mode: 'multiplayer' | 'bot';
  status: 'waiting' | 'in_progress' | 'completed';
  isPrivate: boolean;
  hostUid: string;
  maxPlayers: number;
  entryFeeUgx: number;
  tournamentId?: string;
  tournamentMatchId?: string;
  seats: SanitizedSeatState[];
  currentTurnUid: string | null;
  direction: 1 | -1;
  turnDirection: 1 | -1;
  turnDeadlineMs: number;
  turnCount: number;
  deckCount: number;
  drawPileCount: number;
  discardCount: number;
  topDiscard: PlayingCard | null;
  topDiscardCard: PlayingCard | null;
  yourHand: PlayingCard[];
  activeSuit: Suit;
  pendingDrawCount: number;
  pendingCutCard: PlayingCard | null;
  cutterSuit?: Suit | null;
  winnerUid: string | null;
  winnerName: string | null;
  winReason?: string;
  lastActionText: string;
  rules: MatatuRulesConfig;
  ludoState?: SanitizedLudoState;
  chessState?: SanitizedChessState;
  draftsState?: SanitizedDraftsState;
}

export interface PublicRoomSummary {
  roomId: string;
  roomCode: string;
  name: string;
  hostUid: string;
  hostName: string;
  isPrivate: boolean;
  gameType: TableGameType;
  mode: 'multiplayer' | 'bot';
  maxPlayers: number;
  playerCount: number;
  playerNames?: string[];
  entryFeeUgx: number;
  status: 'waiting' | 'in_progress' | 'completed';
  createdAt?: number;
}

export type KycStatus =
  | 'Not Submitted'
  | 'Pending Verification'
  | 'Approved'
  | 'Rejected'
  | 'Resubmission Required'
  | 'Suspended';

export type AccountStatus = 'Pending' | 'Active' | 'Suspended';

export interface UserRecord {
  uid: string;
  playerId: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  termsAccepted: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  role: 'player' | 'admin';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlayerProfile {
  uid: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  kycStatus: KycStatus;
  accountStatus: AccountStatus;
  totalGames: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  points: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IdentityVerificationRecord {
  verification_id: string;
  uid: string;
  player_id: string;
  legal_name: string;
  date_of_birth: string;
  id_type: 'National ID' | 'Passport' | 'Driving Permit';
  id_number_reference?: string;
  front_image_storage_path: string;
  back_image_storage_path: string;
  verification_status: KycStatus;
  rejection_reason?: string;
  reviewed_by?: string;
  reviewed_at?: unknown;
  submitted_at?: unknown;
  resubmission_count: number;
  updatedAt?: unknown;
}

export interface WalletRecord {
  uid: string;
  playerId: string;
  currency: 'UGX';
  availableBalance: number;
  pendingBalance: number;
  realMoneyEnabled: boolean;
  regulatoryNotice?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type MobileMoneyProvider =
  | 'MTN Mobile Money'
  | 'Airtel Money'
  | 'MTN'
  | 'Airtel'
  | 'System';

export type TransactionStatus =
  | 'Completed'
  | 'Pending'
  | 'Verified'
  | 'Paid'
  | 'Failed'
  | 'Cancelled'
  | 'Approved'
  | 'Rejected';

export type TransactionType =
  | 'Deposit'
  | 'Withdrawal'
  | 'Game Entry'
  | 'Match Win'
  | 'Game Entry Stake'
  | 'Match Winnings'
  | 'Tournament Entry'
  | 'Tournament Prize'
  | 'Admin Adjustment';

export interface TransactionRecord {
  txId: string;
  transactionId?: string;
  uid: string;
  playerId: string;
  type: TransactionType;
  provider: MobileMoneyProvider;
  phoneNumber?: string;
  amountUgx: number;
  feeUgx?: number;
  netAmountUgx?: number;
  netPayoutUgx?: number;
  balanceAfter?: number;
  status: TransactionStatus;
  reference: string;
  externalRef?: string;
  gateway?: 'marzpay' | 'local';
  description?: string;
  note?: string;
  relatedId?: string;
  adminNote?: string;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdministratorRecord {
  uid: string;
  email: string;
  fullName: string;
  role: 'Super Admin' | 'Compliance Officer' | 'Operations Manager';
  status: 'Active' | 'Disabled';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SystemSettingsRecord {
  settingId: string;
  brandName: string;
  logoUrl: string;
  maintenanceMode: boolean;
  realMoneyGamingEnabled: boolean;
  licenseStatus: string;
  contactPhone: string;
  contactEmail: string;
  whatsappNumber: string;
  officeAddress: string;
  matatuRules: MatatuRulesConfig;
  updatedBy?: string;
  updatedAt?: unknown;
}

export type TournamentStatus =
  | 'Registration Open'
  | 'Bracket Active'
  | 'Completed'
  | 'open'
  | 'in_progress'
  | 'completed';

export interface TournamentRecord {
  tournamentId: string;
  title: string;
  gameType: TableGameType;
  entryFeeUgx: number;
  prizePoolUgx?: number;
  prizeSummary: string;
  maxPlayers: number;
  entryCount: number;
  registeredCount?: number;
  status: TournamentStatus;
  scheduleDate?: string;
  startTimeIso: string;
  championPointsPrize?: number;
  runnerUpPointsPrize?: number;
  winnerUid?: string;
  winnerName?: string;
  createdByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TournamentEntryRecord {
  uid: string;
  playerId: string;
  displayName: string;
  seed: number;
  status?: string;
  joinedAt?: unknown;
}

export interface TournamentMatchRecord {
  matchId: string;
  roundNumber: number;
  roundLabel: string;
  matchIndex: number;
  player1Uid?: string | null;
  player1Name?: string | null;
  player1Seed?: number;
  player2Uid?: string | null;
  player2Name?: string | null;
  player2Seed?: number;
  winnerUid?: string | null;
  winnerName?: string | null;
  isBye?: boolean;
  roomId?: string;
  roomCode?: string;
  status: 'pending' | 'ready' | 'in_progress' | 'completed' | 'bye';
}

export interface GameHistoryRecord {
  historyId: string;
  gameId: string;
  roomId: string;
  mode: 'multiplayer' | 'bot';
  playerUids: string[];
  winnerUid: string | null;
  winnerName: string;
  durationSeconds: number;
  summary: string;
  createdAt?: unknown;
}

export interface NotificationRecord {
  notificationId: string;
  uid: string;
  title: string;
  message: string;
  category?: 'info' | 'kyc' | 'wallet' | 'tournament' | 'support' | 'system';
  type?: 'info' | 'kyc' | 'wallet' | 'tournament' | 'support' | 'system';
  read: boolean;
  createdAt?: unknown;
}

export interface SupportTicketRecord {
  ticketId: string;
  uid?: string;
  playerId?: string;
  playerName?: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: 'Open' | 'In Review' | 'Resolved';
  adminReply?: string;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AnnouncementRecord {
  announcementId: string;
  title: string;
  summary?: string;
  body: string;
  published: boolean;
  active?: boolean;
  priority?: string;
  authorUid?: string;
  createdAt?: unknown;
}

export interface AdminLogRecord {
  logId: string;
  adminUid: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: string;
  createdAt?: unknown;
}

export type PresenceStatus = 'online' | 'in_game' | 'away' | 'offline';

export interface PlayerPresenceRecord {
  uid: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
  currentRoomId?: string;
  currentGameType?: TableGameType;
  lastSeenMs: number;
}

export interface FriendshipRecord {
  pairId: string;
  participantUids: [string, string];
  requesterUid: string;
  requesterName: string;
  requesterPlayerId: string;
  recipientUid: string;
  recipientName: string;
  recipientPlayerId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DirectThreadRecord {
  pairId: string;
  participantUids: [string, string];
  lastMessageText: string;
  lastSenderUid: string;
  lastSenderName: string;
  updatedAtMs: number;
}

export interface DirectMessageRecord {
  messageId: string;
  pairId: string;
  participantUids: [string, string];
  senderUid: string;
  senderName: string;
  text: string;
  createdAt: unknown;
}

export interface GameInviteRecord {
  inviteId: string;
  fromUid: string;
  fromName: string;
  fromPlayerId: string;
  toUid: string;
  toName: string;
  gameType: TableGameType;
  maxPlayers: number;
  entryFeeUgx: number;
  roomId: string;
  roomCode: string;
  roomName: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAtMs: number;
}
