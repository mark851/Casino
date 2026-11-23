import { getStore, notifyStore, subscribeStore } from './localStore';
import type {
  DirectMessageRecord,
  DirectThreadRecord,
  FriendshipRecord,
  GameInviteRecord,
  PlayerPresenceRecord,
  PlayerProfile,
  PresenceStatus,
  TableGameType,
} from '../shared/types';

export interface SocialDirectoryEntry {
  uid: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  gamesWon: number;
  totalGames: number;
  kycStatus?: string;
}

export function pairIdForUids(uidA: string, uidB: string): string {
  return uidA < uidB ? `${uidA}__${uidB}` : `${uidB}__${uidA}`;
}

export function isPresenceOnline(presence: PlayerPresenceRecord | null | undefined, nowMs = Date.now()): boolean {
  if (!presence) return false;
  if (presence.status === 'offline') return false;
  return nowMs - (presence.lastSeenMs || 0) < 120000;
}

export function subscribePublicPlayerProfiles(
  onProfiles: (profiles: PlayerProfile[]) => void
): () => void {
  const emit = () => {
    onProfiles(Object.values(getStore().playerProfiles));
  };
  emit();
  return subscribeStore(emit);
}

export async function publishMyPresence(params: {
  uid: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  status: PresenceStatus;
  currentRoomId?: string;
  currentGameType?: TableGameType;
}): Promise<void> {
  const s = getStore();
  s.presence[params.uid] = {
    uid: params.uid,
    playerId: params.playerId,
    displayName: params.displayName,
    avatarUrl: params.avatarUrl,
    status: params.status,
    currentRoomId: params.currentRoomId,
    currentGameType: params.currentGameType,
    lastSeenMs: Date.now(),
  };
  notifyStore();
}

export async function fetchSocialSnapshot(myUid: string): Promise<{
  presence: PlayerPresenceRecord[];
  directory: SocialDirectoryEntry[];
  friendships: FriendshipRecord[];
  threads: DirectThreadRecord[];
  invites: GameInviteRecord[];
}> {
  const s = getStore();
  const directory: SocialDirectoryEntry[] = Object.values(s.playerProfiles).map((p) => ({
    uid: p.uid,
    playerId: p.playerId,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    gamesWon: p.gamesWon,
    totalGames: p.totalGames,
    kycStatus: p.kycStatus,
  }));
  const friendships = Object.values(s.friendships).filter((f) =>
    f.participantUids.includes(myUid)
  );
  const threads = Object.values(s.directThreads).filter((t) =>
    t.participantUids.includes(myUid)
  );
  const invites = Object.values(s.invites).filter(
    (inv) => inv.toUid === myUid || inv.fromUid === myUid
  );
  return {
    presence: Object.values(s.presence),
    directory,
    friendships,
    threads,
    invites,
  };
}

export async function sendFriendRequestApi(params: {
  myUid: string;
  myName: string;
  myPlayerId: string;
  target: { uid: string; displayName: string; playerId: string };
}): Promise<FriendshipRecord> {
  const s = getStore();
  const pairId = pairIdForUids(params.myUid, params.target.uid);
  const record: FriendshipRecord = {
    pairId,
    participantUids:
      params.myUid < params.target.uid
        ? [params.myUid, params.target.uid]
        : [params.target.uid, params.myUid],
    requesterUid: params.myUid,
    requesterName: params.myName,
    requesterPlayerId: params.myPlayerId,
    recipientUid: params.target.uid,
    recipientName: params.target.displayName,
    recipientPlayerId: params.target.playerId,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  s.friendships[pairId] = record;
  notifyStore();
  return record;
}

export async function respondFriendRequestApi(
  pairId: string,
  action: 'accept' | 'decline' | 'remove'
): Promise<void> {
  const s = getStore();
  if (action === 'remove') {
    delete s.friendships[pairId];
  } else if (s.friendships[pairId]) {
    s.friendships[pairId].status = action === 'accept' ? 'accepted' : 'declined';
    s.friendships[pairId].updatedAt = Date.now();
  }
  notifyStore();
}

export async function fetchDirectChatHistoryApi(pairId: string): Promise<DirectMessageRecord[]> {
  return getStore().directMessages[pairId] || [];
}

export async function sendDirectMessageApi(params: {
  myUid: string;
  myName: string;
  targetUid: string;
  text: string;
}): Promise<DirectMessageRecord> {
  const s = getStore();
  const pairId = pairIdForUids(params.myUid, params.targetUid);
  const participants: [string, string] =
    params.myUid < params.targetUid
      ? [params.myUid, params.targetUid]
      : [params.targetUid, params.myUid];
  const msg: DirectMessageRecord = {
    messageId: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    pairId,
    participantUids: participants,
    senderUid: params.myUid,
    senderName: params.myName,
    text: params.text.trim(),
    createdAt: Date.now(),
  };
  const existing = s.directMessages[pairId] || [];
  s.directMessages[pairId] = [...existing.slice(-79), msg];
  s.directThreads[pairId] = {
    pairId,
    participantUids: participants,
    lastMessageText: msg.text,
    lastSenderUid: msg.senderUid,
    lastSenderName: msg.senderName,
    updatedAtMs: Date.now(),
  };
  notifyStore();
  return msg;
}

export async function sendPlayInviteApi(invite: GameInviteRecord): Promise<GameInviteRecord> {
  const s = getStore();
  s.invites[invite.inviteId] = invite;
  notifyStore();
  return invite;
}

export async function respondToPlayInviteApi(
  inviteId: string,
  status: GameInviteRecord['status']
): Promise<void> {
  const s = getStore();
  if (s.invites[inviteId]) {
    s.invites[inviteId].status = status;
    notifyStore();
  }
}
