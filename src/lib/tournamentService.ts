import { getStore, notifyStore, pushNotification } from './localStore';
import { getKampalaDateString } from '../shared/tournamentEngine';
import { ensureWalletExists, MIN_TOURNAMENT_ENTRY_UGX } from './walletService';
import type {
  TableGameType,
  TournamentEntryRecord,
  TournamentMatchRecord,
  TournamentRecord,
} from '../shared/types';

export async function ensureDailyTournamentsExist(_uid?: string): Promise<void> {
  const s = getStore();
  const today = getKampalaDateString();
  const matatuId = `daily_matatu_${today}`;
  if (!s.tournaments[matatuId]) {
    s.tournaments[matatuId] = {
      tournamentId: matatuId,
      title: 'Kampala Nightly Matatu Royale Cup',
      gameType: 'matatu',
      entryFeeUgx: 2000,
      prizePoolUgx: 16000,
      prizeSummary: 'Entry: UGX 2,000 · Winner Takes Championship Cup',
      maxPlayers: 8,
      entryCount: 0,
      registeredCount: 0,
      status: 'Registration Open',
      scheduleDate: today,
      startTimeIso: new Date(Date.now() + 3600000 * 3).toISOString(),
      createdAt: Date.now(),
    };
    notifyStore();
  }
}

export async function createAdminCustomTournament(params: {
  title: string;
  gameType: TableGameType;
  scheduleDate: string;
  startTimeIso: string;
  maxPlayers: number;
  entryFeeUgx: number;
  championPointsPrize: number;
  runnerUpPointsPrize: number;
  prizeSummary: string;
  createdByUid: string;
}): Promise<string> {
  const s = getStore();
  const tournamentId = `cup_${Date.now().toString(36)}`;
  const fee = Math.max(MIN_TOURNAMENT_ENTRY_UGX, Math.round(params.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX));
  s.tournaments[tournamentId] = {
    tournamentId,
    title: params.title.trim() || 'CASINO ROYALE Cup',
    gameType: params.gameType,
    entryFeeUgx: fee,
    prizePoolUgx: fee * params.maxPlayers,
    prizeSummary: params.prizeSummary,
    maxPlayers: params.maxPlayers,
    entryCount: 0,
    registeredCount: 0,
    status: 'Registration Open',
    scheduleDate: params.scheduleDate,
    startTimeIso: params.startTimeIso,
    championPointsPrize: params.championPointsPrize,
    runnerUpPointsPrize: params.runnerUpPointsPrize,
    createdByUid: params.createdByUid,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  s.tournamentEntries[tournamentId] = [];
  s.tournamentMatches[tournamentId] = [];
  notifyStore();
  return tournamentId;
}

export async function registerForTournament(params: {
  tournament: TournamentRecord;
  uid: string;
  playerId: string;
  displayName: string;
}): Promise<{ entryFeeUgx: number; reference: string }> {
  const s = getStore();
  const t = s.tournaments[params.tournament.tournamentId];
  if (!t) throw new Error('Tournament not found.');
  if (t.status !== 'Registration Open' && t.status !== 'open') {
    throw new Error('Registration is closed for this bracket.');
  }
  const entries = s.tournamentEntries[t.tournamentId] || [];
  if (entries.some((e) => e.uid === params.uid)) {
    throw new Error('You are already registered in this tournament.');
  }
  if (entries.length >= t.maxPlayers) {
    throw new Error('This tournament bracket is already full.');
  }

  const fee = Math.max(MIN_TOURNAMENT_ENTRY_UGX, Math.round(t.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX));
  const wallet = await ensureWalletExists(params.uid, params.playerId);
  if (wallet.availableBalance < fee) {
    throw new Error(
      `Insufficient UGX balance (UGX ${wallet.availableBalance.toLocaleString()}). Deposit at least UGX ${fee.toLocaleString()} to enter.`
    );
  }
  wallet.availableBalance -= fee;
  wallet.updatedAt = Date.now();

  const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const reference = `CR-TRN-${Math.floor(100000 + Math.random() * 899999)}`;
  s.transactions[txId] = {
    txId,
    transactionId: txId,
    uid: params.uid,
    playerId: params.playerId,
    type: 'Tournament Entry',
    provider: 'System',
    amountUgx: fee,
    feeUgx: 0,
    netAmountUgx: fee,
    netPayoutUgx: fee,
    balanceAfter: wallet.availableBalance,
    status: 'Completed',
    reference,
    description: `${t.title} Entry Fee`,
    relatedId: t.tournamentId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const entry: TournamentEntryRecord = {
    uid: params.uid,
    playerId: params.playerId,
    displayName: params.displayName,
    seed: entries.length + 1,
    status: 'Confirmed',
    joinedAt: Date.now(),
  };
  s.tournamentEntries[t.tournamentId] = [...entries, entry];
  t.entryCount = s.tournamentEntries[t.tournamentId].length;
  t.registeredCount = t.entryCount;
  t.updatedAt = Date.now();

  pushNotification(params.uid, {
    title: 'Tournament Entry Confirmed',
    message: `You are seeded #${entry.seed} in ${t.title}.`,
    category: 'tournament',
  });
  notifyStore();
  return { entryFeeUgx: fee, reference };
}

function roundLabelFor(roundNum: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundNum;
  if (fromEnd === 0) return 'Grand Final';
  if (fromEnd === 1) return 'Semi-Finals';
  if (fromEnd === 2) return 'Quarter-Finals';
  return `Round ${roundNum}`;
}

export async function generateTournamentBracket(tournament: TournamentRecord): Promise<void> {
  const s = getStore();
  const t = s.tournaments[tournament.tournamentId];
  if (!t) throw new Error('Tournament not found.');
  const entries = [...(s.tournamentEntries[t.tournamentId] || [])].sort((a, b) => a.seed - b.seed);
  if (entries.length < 2) {
    throw new Error('At least 2 seeded players are required to draw a bracket.');
  }

  let size = 2;
  while (size < entries.length) size *= 2;
  const totalRounds = Math.round(Math.log2(size));
  const matches: TournamentMatchRecord[] = [];

  const round1Count = size / 2;
  for (let i = 0; i < round1Count; i += 1) {
    const p1 = entries[i * 2] || null;
    const p2 = entries[i * 2 + 1] || null;
    const isBye = Boolean((p1 && !p2) || (!p1 && p2));
    matches.push({
      matchId: `r1_m${i + 1}`,
      roundNumber: 1,
      roundLabel: roundLabelFor(1, totalRounds),
      matchIndex: i,
      player1Uid: p1?.uid || null,
      player1Name: p1?.displayName || null,
      player1Seed: p1?.seed,
      player2Uid: p2?.uid || null,
      player2Name: p2?.displayName || null,
      player2Seed: p2?.seed,
      winnerUid: isBye ? p1?.uid || p2?.uid || null : null,
      winnerName: isBye ? p1?.displayName || p2?.displayName || null : null,
      isBye,
      status: isBye ? 'bye' : p1 && p2 ? 'ready' : 'pending',
    });
  }

  for (let r = 2; r <= totalRounds; r += 1) {
    const count = size / Math.pow(2, r);
    for (let i = 0; i < count; i += 1) {
      const prevA = matches.find((m) => m.roundNumber === r - 1 && m.matchIndex === i * 2);
      const prevB = matches.find((m) => m.roundNumber === r - 1 && m.matchIndex === i * 2 + 1);
      const p1Uid = prevA?.winnerUid || null;
      const p1Name = prevA?.winnerName || null;
      const p2Uid = prevB?.winnerUid || null;
      const p2Name = prevB?.winnerName || null;
      matches.push({
        matchId: `r${r}_m${i + 1}`,
        roundNumber: r,
        roundLabel: roundLabelFor(r, totalRounds),
        matchIndex: i,
        player1Uid: p1Uid,
        player1Name: p1Name,
        player2Uid: p2Uid,
        player2Name: p2Name,
        status: p1Uid && p2Uid ? 'ready' : 'pending',
      });
    }
  }

  s.tournamentMatches[t.tournamentId] = matches;
  t.status = 'Bracket Active';
  t.updatedAt = Date.now();
  notifyStore();
}

export async function linkMatchRoom(params: {
  tournamentId: string;
  matchId: string;
  roomId: string;
  roomCode: string;
}): Promise<void> {
  const s = getStore();
  const list = s.tournamentMatches[params.tournamentId] || [];
  const target = list.find((m) => m.matchId === params.matchId);
  if (target) {
    target.roomId = params.roomId;
    target.roomCode = params.roomCode;
    target.status = 'in_progress';
    notifyStore();
  }
}

export async function recordMatchResultAndAdvance(params: {
  tournament: TournamentRecord;
  matches: TournamentMatchRecord[];
  match: TournamentMatchRecord;
  winnerUid: string;
  winnerName: string;
}): Promise<void> {
  const s = getStore();
  const list = s.tournamentMatches[params.tournament.tournamentId] || [...params.matches];
  const cur = list.find((m) => m.matchId === params.match.matchId);
  if (!cur) return;

  cur.winnerUid = params.winnerUid;
  cur.winnerName = params.winnerName;
  cur.status = 'completed';

  const nextRound = cur.roundNumber + 1;
  const nextIndex = Math.floor(cur.matchIndex / 2);
  const nextMatch = list.find((m) => m.roundNumber === nextRound && m.matchIndex === nextIndex);

  if (nextMatch) {
    if (cur.matchIndex % 2 === 0) {
      nextMatch.player1Uid = params.winnerUid;
      nextMatch.player1Name = params.winnerName;
    } else {
      nextMatch.player2Uid = params.winnerUid;
      nextMatch.player2Name = params.winnerName;
    }
    if (nextMatch.player1Uid && nextMatch.player2Uid) {
      nextMatch.status = 'ready';
    }
  } else {
    const t = s.tournaments[params.tournament.tournamentId];
    if (t) {
      t.status = 'Completed';
      t.winnerUid = params.winnerUid;
      t.winnerName = params.winnerName;
      t.updatedAt = Date.now();
      const totalPot = Math.max(t.entryFeeUgx || 1000, (t.entryFeeUgx || 1000) * Math.max(2, t.entryCount));
      const wallet = await ensureWalletExists(params.winnerUid);
      wallet.availableBalance += totalPot;
      wallet.updatedAt = Date.now();
      const txId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      s.transactions[txId] = {
        txId,
        transactionId: txId,
        uid: params.winnerUid,
        playerId: wallet.playerId,
        type: 'Tournament Prize',
        provider: 'System',
        amountUgx: totalPot,
        feeUgx: 0,
        netAmountUgx: totalPot,
        netPayoutUgx: totalPot,
        balanceAfter: wallet.availableBalance,
        status: 'Completed',
        reference: `CR-PRZ-${Math.floor(100000 + Math.random() * 899999)}`,
        description: `${t.title} Champion Prize`,
        relatedId: t.tournamentId,
        createdAt: Date.now(),
      };
      pushNotification(params.winnerUid, {
        title: 'Championship Cup Won!',
        message: `Congratulations! You won ${t.title} and received UGX ${totalPot.toLocaleString()}.`,
        category: 'tournament',
      });
    }
  }

  s.tournamentMatches[params.tournament.tournamentId] = [...list];
  notifyStore();
}
