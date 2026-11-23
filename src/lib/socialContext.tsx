import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './authContext';
import { getStore, subscribeStore } from './localStore';
import {
  fetchDirectChatHistoryApi,
  isPresenceOnline,
  pairIdForUids,
  publishMyPresence,
  respondFriendRequestApi,
  respondToPlayInviteApi,
  sendDirectMessageApi,
  sendFriendRequestApi,
  sendPlayInviteApi,
} from './socialService';
import { createLocalRoom } from './roomFallbackService';
import { generatePlayerId } from '../utils/validation';
import { soundFx } from '../utils/sound';
import type { TypingIndicatorUser } from '../components/ChatTypingBubble';
import type {
  DirectMessageRecord,
  DirectThreadRecord,
  FriendshipRecord,
  GameInviteRecord,
  PlayerPresenceRecord,
  TableGameType,
} from '../shared/types';

export interface CombinedPlayerEntry {
  uid: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  gamesWon: number;
  totalGames: number;
  kycStatus?: string;
  presence: PlayerPresenceRecord | null;
  isOnline: boolean;
  friendship: FriendshipRecord | null;
}

interface SocialContextValue {
  players: CombinedPlayerEntry[];
  onlinePlayers: CombinedPlayerEntry[];
  offlinePlayers: CombinedPlayerEntry[];
  friends: CombinedPlayerEntry[];
  incomingFriendRequests: FriendshipRecord[];
  outgoingFriendRequests: FriendshipRecord[];
  invites: GameInviteRecord[];
  incomingPendingInvites: GameInviteRecord[];
  threadsByPairId: Record<string, DirectThreadRecord>;
  messagesByPairId: Record<string, DirectMessageRecord[]>;
  typingByPairId: Record<string, TypingIndicatorUser[]>;
  unreadSenders: Record<string, number>;
  totalUnreadChats: number;
  onlineCount: number;
  activeChatUid: string | null;
  setActiveChatUid: (uid: string | null) => void;
  chatDrawerOpen: boolean;
  openChatWith: (uid?: string | null) => void;
  closeChatDrawer: () => void;
  refreshSocial: () => Promise<void>;
  sendFriendRequest: (target: { uid: string; displayName: string; playerId: string }) => Promise<void>;
  acceptFriendRequest: (pairId: string) => Promise<void>;
  declineFriendRequest: (pairId: string) => Promise<void>;
  removeFriendOrRequest: (pairId: string) => Promise<void>;
  loadDirectChat: (targetUid: string) => Promise<void>;
  sendDirectMessage: (targetUid: string, text: string) => Promise<void>;
  sendPlayInvite: (params: {
    toUid: string;
    toName: string;
    gameType: TableGameType;
    maxPlayers: number;
    entryFeeUgx: number;
    roomId?: string;
    roomName?: string;
    message?: string;
    navigateToTable?: boolean;
  }) => Promise<{ invite: GameInviteRecord; roomId: string }>;
  acceptPlayInvite: (invite: GameInviteRecord) => Promise<void>;
  declinePlayInvite: (inviteId: string) => Promise<void>;
  cancelPlayInvite: (inviteId: string) => Promise<void>;
}

const SocialContext = createContext<SocialContextValue | null>(null);

export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userDoc, playerProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [, setStoreTick] = useState(0);
  const [unreadSenders, setUnreadSenders] = useState<Record<string, number>>({});
  const [activeChatUid, setActiveChatUidState] = useState<string | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);

  useEffect(() => {
    return subscribeStore(() => setStoreTick((t) => t + 1));
  }, []);

  const myUid = firebaseUser?.uid || '';
  const myName =
    userDoc?.fullName ||
    playerProfile?.displayName ||
    firebaseUser?.displayName ||
    'Casino Royale Player';
  const myPlayerId =
    userDoc?.playerId || playerProfile?.playerId || (myUid ? generatePlayerId(myUid) : 'PLAYER');

  const currentRouteRoomId = useMemo(() => {
    const match = /^\/(?:game|table)\/([^/]+)/.exec(location.pathname);
    return match ? match[1] : undefined;
  }, [location.pathname]);

  useEffect(() => {
    if (!myUid) return;
    void publishMyPresence({
      uid: myUid,
      playerId: myPlayerId,
      displayName: myName,
      avatarUrl: playerProfile?.avatarUrl,
      status: currentRouteRoomId ? 'in_game' : 'online',
      currentRoomId: currentRouteRoomId,
    });
  }, [myUid, myPlayerId, myName, playerProfile?.avatarUrl, currentRouteRoomId]);

  const setActiveChatUid = useCallback((uid: string | null) => {
    setActiveChatUidState(uid);
    if (uid) {
      setUnreadSenders((prev) => {
        if (!prev[uid]) return prev;
        const copy = { ...prev };
        delete copy[uid];
        return copy;
      });
    }
  }, []);

  const openChatWith = useCallback(
    (uid?: string | null) => {
      if (uid) setActiveChatUid(uid);
      setChatDrawerOpen(true);
    },
    [setActiveChatUid]
  );

  const closeChatDrawer = useCallback(() => {
    setChatDrawerOpen(false);
  }, []);

  const store = getStore();
  const nowMs = Date.now();

  const players: CombinedPlayerEntry[] = useMemo(() => {
    return Object.values(store.playerProfiles)
      .filter((p) => p.uid !== myUid)
      .map((p) => {
        const pres = store.presence[p.uid] || null;
        const pairId = myUid ? pairIdForUids(myUid, p.uid) : '';
        const friendship = pairId ? store.friendships[pairId] || null : null;
        return {
          uid: p.uid,
          playerId: p.playerId,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          gamesWon: p.gamesWon || 0,
          totalGames: p.totalGames || 0,
          kycStatus: p.kycStatus,
          presence: pres,
          isOnline: isPresenceOnline(pres, nowMs),
          friendship,
        };
      })
      .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || b.gamesWon - a.gamesWon);
  }, [store.playerProfiles, store.presence, store.friendships, myUid, nowMs]);

  const onlinePlayers = useMemo(() => players.filter((p) => p.isOnline), [players]);
  const offlinePlayers = useMemo(() => players.filter((p) => !p.isOnline), [players]);
  const friends = useMemo(
    () => players.filter((p) => p.friendship?.status === 'accepted'),
    [players]
  );

  const incomingFriendRequests = useMemo(
    () =>
      Object.values(store.friendships).filter(
        (f) => f.status === 'pending' && f.recipientUid === myUid
      ),
    [store.friendships, myUid]
  );

  const outgoingFriendRequests = useMemo(
    () =>
      Object.values(store.friendships).filter(
        (f) => f.status === 'pending' && f.requesterUid === myUid
      ),
    [store.friendships, myUid]
  );

  const invites = useMemo(
    () =>
      Object.values(store.invites)
        .filter((inv) => inv.toUid === myUid || inv.fromUid === myUid)
        .sort((a, b) => b.createdAtMs - a.createdAtMs),
    [store.invites, myUid]
  );

  const incomingPendingInvites = useMemo(
    () => invites.filter((inv) => inv.toUid === myUid && inv.status === 'pending'),
    [invites, myUid]
  );

  const totalUnreadChats = useMemo(
    () => Object.values(unreadSenders).reduce((sum, n) => sum + n, 0),
    [unreadSenders]
  );

  const refreshSocial = useCallback(async () => {
    setStoreTick((t) => t + 1);
  }, []);

  const sendFriendRequest = useCallback(
    async (target: { uid: string; displayName: string; playerId: string }) => {
      if (!myUid) return;
      await sendFriendRequestApi({ myUid, myName, myPlayerId, target });
    },
    [myUid, myName, myPlayerId]
  );

  const acceptFriendRequest = useCallback(async (pairId: string) => {
    await respondFriendRequestApi(pairId, 'accept');
  }, []);

  const declineFriendRequest = useCallback(async (pairId: string) => {
    await respondFriendRequestApi(pairId, 'decline');
  }, []);

  const removeFriendOrRequest = useCallback(async (pairId: string) => {
    await respondFriendRequestApi(pairId, 'remove');
  }, []);

  const loadDirectChat = useCallback(async (targetUid: string) => {
    if (!myUid) return;
    await fetchDirectChatHistoryApi(pairIdForUids(myUid, targetUid));
  }, [myUid]);

  const sendDirectMessage = useCallback(
    async (targetUid: string, text: string) => {
      if (!myUid || !text.trim()) return;
      await sendDirectMessageApi({ myUid, myName, targetUid, text });
    },
    [myUid, myName]
  );

  const sendPlayInvite = useCallback(
    async (params: {
      toUid: string;
      toName: string;
      gameType: TableGameType;
      maxPlayers: number;
      entryFeeUgx: number;
      roomId?: string;
      roomName?: string;
      message?: string;
      navigateToTable?: boolean;
    }) => {
      if (!myUid) throw new Error('Sign in required to invite players.');
      const room =
        params.roomId && getStore().rooms[params.roomId]
          ? getStore().rooms[params.roomId]
          : await createLocalRoom({
              hostUid: myUid,
              hostName: myName,
              name: params.roomName || `${myName}'s ${params.gameType.toUpperCase()} Table`,
              isPrivate: false,
              gameType: params.gameType,
              mode: 'multiplayer',
              maxPlayers: params.maxPlayers,
              entryFeeUgx: params.entryFeeUgx,
            });
      const invite: GameInviteRecord = {
        inviteId: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        fromUid: myUid,
        fromName: myName,
        fromPlayerId: myPlayerId,
        toUid: params.toUid,
        toName: params.toName,
        gameType: params.gameType,
        maxPlayers: params.maxPlayers,
        entryFeeUgx: params.entryFeeUgx,
        roomId: room.roomId,
        roomCode: room.roomCode,
        roomName: room.name,
        message: params.message,
        status: 'pending',
        createdAtMs: Date.now(),
      };
      await sendPlayInviteApi(invite);
      if (params.navigateToTable) {
        navigate(`/game/${room.roomId}`);
      }
      return { invite, roomId: room.roomId };
    },
    [myUid, myName, myPlayerId, navigate]
  );

  const acceptPlayInvite = useCallback(
    async (invite: GameInviteRecord) => {
      soundFx.play('match');
      await respondToPlayInviteApi(invite.inviteId, 'accepted');
      navigate(`/game/${invite.roomId}`);
    },
    [navigate]
  );

  const declinePlayInvite = useCallback(async (inviteId: string) => {
    await respondToPlayInviteApi(inviteId, 'declined');
  }, []);

  const cancelPlayInvite = useCallback(async (inviteId: string) => {
    await respondToPlayInviteApi(inviteId, 'cancelled');
  }, []);

  return (
    <SocialContext.Provider
      value={{
        players,
        onlinePlayers,
        offlinePlayers,
        friends,
        incomingFriendRequests,
        outgoingFriendRequests,
        invites,
        incomingPendingInvites,
        threadsByPairId: store.directThreads,
        messagesByPairId: store.directMessages,
        typingByPairId: {},
        unreadSenders,
        totalUnreadChats,
        onlineCount: onlinePlayers.length,
        activeChatUid,
        setActiveChatUid,
        chatDrawerOpen,
        openChatWith,
        closeChatDrawer,
        refreshSocial,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        removeFriendOrRequest,
        loadDirectChat,
        sendDirectMessage,
        sendPlayInvite,
        acceptPlayInvite,
        declinePlayInvite,
        cancelPlayInvite,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used inside SocialProvider');
  return ctx;
}
