import { getStore, listPublicRoomsFromStore, notifyStore, type LocalRoomConfig } from './localStore';
import { MIN_GAME_STAKE_UGX } from './walletService';
import type { PublicRoomSummary, TableGameType } from '../shared/types';

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function saveLocalRoomConfig(cfg: LocalRoomConfig): Promise<void> {
  const s = getStore();
  s.rooms[cfg.roomId] = { ...cfg, updatedAt: Date.now() };
  notifyStore();
}

export async function loadLocalRoomConfig(roomId: string): Promise<LocalRoomConfig | null> {
  const s = getStore();
  return s.rooms[roomId] || null;
}

export async function createLocalRoom(params: {
  roomIdOverride?: string;
  hostUid: string;
  hostName: string;
  name: string;
  isPrivate: boolean;
  gameType: TableGameType;
  mode: 'multiplayer' | 'bot';
  maxPlayers: number;
  entryFeeUgx?: number;
  tournamentId?: string;
  tournamentMatchId?: string;
}): Promise<LocalRoomConfig> {
  const s = getStore();
  const roomId =
    params.roomIdOverride ||
    `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const existing = s.rooms[roomId];
  if (existing) return existing;

  const cfg: LocalRoomConfig = {
    roomId,
    roomCode: makeRoomCode(),
    name: params.name.trim() || 'Kampala Royale Table',
    hostUid: params.hostUid,
    hostName: params.hostName,
    isPrivate: Boolean(params.isPrivate),
    gameType: params.gameType,
    mode: params.mode,
    maxPlayers: Math.max(2, Math.min(4, params.maxPlayers || 2)),
    entryFeeUgx: Math.max(MIN_GAME_STAKE_UGX, Math.round(params.entryFeeUgx || MIN_GAME_STAKE_UGX)),
    playerUids: [params.hostUid],
    aiSeats: [],
    status: 'waiting',
    tournamentId: params.tournamentId,
    tournamentMatchId: params.tournamentMatchId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  s.rooms[roomId] = cfg;
  notifyStore();
  return cfg;
}

export async function joinLocalRoomByCode(
  codeInput: string,
  uid: string
): Promise<LocalRoomConfig> {
  const s = getStore();
  const code = codeInput.trim().toUpperCase();
  const found = Object.values(s.rooms).find((r) => r.roomCode.toUpperCase() === code);
  if (!found) {
    throw new Error(`No active table found with code "${code}".`);
  }
  if (!found.playerUids.includes(uid)) {
    found.playerUids = [...found.playerUids, uid];
    found.updatedAt = Date.now();
    notifyStore();
  }
  return found;
}

export async function listLocalPublicRooms(): Promise<PublicRoomSummary[]> {
  return listPublicRoomsFromStore();
}
