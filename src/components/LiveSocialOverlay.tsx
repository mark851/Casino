import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Gamepad2,
  MessageSquare,
  Search,
  Send,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useSocial } from '../lib/socialContext';
import { pairIdForUids } from '../lib/socialService';
import { MAX_GAME_STAKE_UGX, MIN_GAME_STAKE_UGX } from '../lib/walletService';
import { timestampMs } from '../utils/validation';
import { ChatTypingBubble } from './ChatTypingBubble';
import type { GameInviteRecord, TableGameType } from '../shared/types';

const GAME_LABELS: Record<TableGameType, string> = {
  matatu: 'Ugandan Matatu',
  ludo: 'Ludo Master',
  chess: 'Kampala Chess',
  drafts: 'Uganda Drafts',
};

type DrawerFilter = 'all' | 'online' | 'offline' | 'friends';

export const LiveSocialOverlay: React.FC = () => {
  const { firebaseUser } = useAuth();
  const {
    players,
    onlinePlayers,
    offlinePlayers,
    friends,
    incomingPendingInvites,
    messagesByPairId,
    typingByPairId,
    unreadSenders,
    totalUnreadChats,
    activeChatUid,
    setActiveChatUid,
    chatDrawerOpen,
    openChatWith,
    closeChatDrawer,
    loadDirectChat,
    sendDirectMessage,
    acceptPlayInvite,
    declinePlayInvite,
  } = useSocial();

  const myUid = firebaseUser?.uid || '';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState<DrawerFilter>('all');
  const [search, setSearch] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [chatErr, setChatErr] = useState('');
  const [challengeTarget, setChallengeTarget] = useState<{
    uid: string;
    displayName: string;
    playerId: string;
  } | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatDrawerOpen && !activeChatUid) {
      if (onlinePlayers.length > 0) {
        setActiveChatUid(onlinePlayers[0].uid);
      } else if (players.length > 0) {
        setActiveChatUid(players[0].uid);
      }
    }
  }, [chatDrawerOpen, activeChatUid, onlinePlayers, players, setActiveChatUid]);

  useEffect(() => {
    if (chatDrawerOpen && activeChatUid) {
      void loadDirectChat(activeChatUid);
    }
  }, [chatDrawerOpen, activeChatUid, loadDirectChat]);

  const activeChatPartner = useMemo(
    () => players.find((p) => p.uid === activeChatUid) || null,
    [players, activeChatUid]
  );

  const activePairId = activeChatUid && myUid ? pairIdForUids(myUid, activeChatUid) : '';
  const activeMessages = activePairId ? messagesByPairId[activePairId] || [] : [];
  const activeTypingUsers = activePairId ? typingByPairId[activePairId] || [] : [];

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeMessages.length, activeTypingUsers.length, activeChatUid, chatDrawerOpen]);

  const filteredDrawerPlayers = useMemo(() => {
    const base =
      filter === 'online'
        ? onlinePlayers
        : filter === 'offline'
        ? offlinePlayers
        : filter === 'friends'
        ? friends
        : players;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q)
    );
  }, [filter, onlinePlayers, offlinePlayers, friends, players, search]);

  if (!firebaseUser?.emailVerified) {
    return null;
  }

  const latestInvite: GameInviteRecord | null = incomingPendingInvites[0] || null;

  const handleAcceptInvite = async () => {
    if (!latestInvite) return;
    setErrorMsg('');
    setBusyId(latestInvite.inviteId);
    try {
      await acceptPlayInvite(latestInvite);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to join table.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeclineInvite = async () => {
    if (!latestInvite) return;
    setBusyId(latestInvite.inviteId);
    try {
      await declinePlayInvite(latestInvite.inviteId);
    } finally {
      setBusyId(null);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatUid || !chatDraft.trim() || sendingChat) return;
    setChatErr('');
    const text = chatDraft.trim();
    setChatDraft('');
    setSendingChat(true);
    try {
      await sendDirectMessage(activeChatUid, text);
    } catch (err) {
      setChatErr(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <>
      {/* Persistent Floating Live Chat Launcher */}
      {!chatDrawerOpen && (
        <button
          type="button"
          onClick={() => openChatWith(activeChatUid)}
          className={`fixed right-4 z-40 inline-flex items-center gap-2 rounded-full border border-[#FFD76A]/70 bg-[#042416]/95 px-4 py-2.5 text-xs font-bold text-white shadow-[0_12px_32px_rgba(0,0,0,0.75)] hover:bg-[#073A24] cursor-pointer transition-all ${
            latestInvite ? 'bottom-[196px]' : 'bottom-4'
          }`}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-[#9CE800]" />
          <MessageSquare className="h-4 w-4 text-[#FFD76A]" />
          <span>Live Chat</span>
          <span className="rounded-full bg-[#083B23] border border-white/15 px-2 py-0.5 font-mono-tabular text-[11px] text-[#9CE800]">
            {onlinePlayers.length} Online
          </span>
          {totalUnreadChats > 0 && (
            <span className="rounded-full bg-[#FFD76A] px-1.5 py-0.5 font-mono-tabular text-[10px] font-extrabold text-black">
              {totalUnreadChats}
            </span>
          )}
        </button>
      )}

      {/* Slide-Over Accessible Direct Chat & Online/Offline Players Drawer */}
      {chatDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl h-full emerald-card-surface border-l border-[#D4AF37]/45 flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/10 bg-[#03130B]">
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#FFD76A] shrink-0" />
                  <span>Direct Player Chat</span>
                </h2>
                <p className="text-[11px] font-mono-tabular text-neutral-300">
                  <span className="text-[#9CE800] font-semibold">{onlinePlayers.length} Online</span>
                  {' · '}
                  <span className="text-neutral-400">{offlinePlayers.length} Offline</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/friends"
                  onClick={closeChatDrawer}
                  className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/45 bg-[#062E1C] px-3 py-1.5 text-[11px] font-semibold text-[#FFD76A] hover:bg-[#09472B]"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Friends Hub</span>
                </Link>
                <button
                  type="button"
                  onClick={closeChatDrawer}
                  aria-label="Close chat drawer"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-neutral-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Split Roster + Conversation Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-[240px_1fr]">
              {/* Left Player Directory Sidebar */}
              <div className="border-b sm:border-b-0 sm:border-r border-white/10 bg-[#031009] flex flex-col min-h-0 max-h-[220px] sm:max-h-none">
                <div className="p-2.5 space-y-2 border-b border-white/10">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search player…"
                      className="w-full rounded-lg border border-white/15 bg-[#04120B] pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'all' as const, label: `All (${players.length})` },
                      { id: 'online' as const, label: `Online (${onlinePlayers.length})` },
                      { id: 'offline' as const, label: `Offline (${offlinePlayers.length})` },
                      { id: 'friends' as const, label: `Friends (${friends.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold cursor-pointer ${
                          filter === tab.id
                            ? 'bg-[#D4AF37] text-[#041009]'
                            : 'bg-white/5 text-neutral-300 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {filteredDrawerPlayers.length === 0 ? (
                    <p className="text-[11px] text-neutral-500 text-center py-6 px-2">
                      No matching players in this filter.
                    </p>
                  ) : (
                    filteredDrawerPlayers.map((p) => {
                      const selected = activeChatUid === p.uid;
                      const unread = unreadSenders[p.uid] || 0;
                      const statusText = p.isOnline
                        ? p.presence?.status === 'in_game'
                          ? 'In Table'
                          : p.presence?.status === 'away'
                          ? 'Away'
                          : 'Online'
                        : 'Offline';
                      return (
                        <button
                          key={p.uid}
                          type="button"
                          onClick={() => setActiveChatUid(p.uid)}
                          className={`w-full rounded-lg px-2.5 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-[#083B23] border border-[#FFD76A]/65'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                p.isOnline
                                  ? p.presence?.status === 'in_game'
                                    ? 'bg-[#FFD76A]'
                                    : 'bg-[#9CE800]'
                                  : 'bg-neutral-600'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {p.displayName}
                              </p>
                              <p className="text-[10px] font-mono-tabular text-neutral-400 truncate">
                                {statusText} · {p.playerId}
                              </p>
                            </div>
                          </div>
                          {unread > 0 && (
                            <span className="rounded-full bg-[#9CE800] px-1.5 py-0.2 font-mono-tabular text-[10px] font-extrabold text-black shrink-0">
                              {unread}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Active Conversation Pane */}
              <div className="flex flex-col min-h-0 bg-[#041009]">
                {activeChatPartner ? (
                  <>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-[#05180E]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                              activeChatPartner.isOnline ? 'bg-[#9CE800]' : 'bg-neutral-600'
                            }`}
                          />
                          <p className="text-sm font-bold text-white truncate">
                            {activeChatPartner.displayName}
                          </p>
                        </div>
                        <p className="text-[11px] font-mono-tabular text-neutral-400 pl-4">
                          {activeChatPartner.playerId} ·{' '}
                          {activeTypingUsers.length > 0 ? (
                            <span className="text-[#FFD76A] font-sans font-semibold">typing…</span>
                          ) : (
                            <span
                              className={
                                activeChatPartner.isOnline ? 'text-[#9CE800]' : 'text-neutral-500'
                              }
                            >
                              {activeChatPartner.isOnline ? 'Online Now' : 'Offline'}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!activeChatPartner.isOnline}
                        onClick={() =>
                          setChallengeTarget({
                            uid: activeChatPartner.uid,
                            displayName: activeChatPartner.displayName,
                            playerId: activeChatPartner.playerId,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shrink-0 ${
                          activeChatPartner.isOnline
                            ? 'gold-shimmer-btn cursor-pointer'
                            : 'border border-white/10 bg-white/5 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        <Swords className="h-3.5 w-3.5" />
                        <span>{activeChatPartner.isOnline ? 'Invite' : 'Offline'}</span>
                      </button>
                    </div>

                    <div
                      ref={chatScrollRef}
                      className="flex-1 overflow-y-auto p-4 space-y-2.5"
                    >
                      {activeMessages.length === 0 && activeTypingUsers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
                          <MessageSquare className="h-8 w-8 text-[#D4AF37]/50" />
                          <p className="text-xs font-semibold text-neutral-300">
                            Say hello to {activeChatPartner.displayName}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {activeChatPartner.isOnline
                              ? 'Online right now — chat directly or invite them to play together.'
                              : 'Currently offline. Messages are saved in this thread.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {activeMessages.map((m) => {
                            const mine = m.senderUid === myUid;
                            const ms = timestampMs(m.createdAt);
                            return (
                              <div
                                key={m.messageId}
                                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-xs space-y-1 ${
                                    mine
                                      ? 'bg-[#083B23] border border-[#D4AF37]/45 text-white'
                                      : 'bg-[#071B11] border border-white/12 text-neutral-200'
                                  }`}
                                >
                                  <p className="leading-relaxed break-words">{m.text}</p>
                                  <p className="text-[10px] text-neutral-400 text-right font-mono-tabular">
                                    {ms
                                      ? new Date(ms).toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          <ChatTypingBubble typingUsers={activeTypingUsers} variant="dm" />
                        </>
                      )}
                    </div>

                    {chatErr && (
                      <p className="px-4 py-1 text-[11px] text-red-300 bg-red-950/40">{chatErr}</p>
                    )}

                    <form
                      onSubmit={handleSendChat}
                      className="p-3 border-t border-white/10 flex items-center gap-2 bg-[#03130B]"
                    >
                      <input
                        type="text"
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        maxLength={400}
                        placeholder={`Message ${activeChatPartner.displayName}…`}
                        className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingChat || !chatDraft.trim()}
                        className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-45 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 space-y-2">
                    <MessageSquare className="h-9 w-9 text-[#D4AF37]/50" />
                    <p className="text-sm font-bold text-white">Select a Player to Chat</p>
                    <p className="text-xs text-neutral-400">
                      Choose any online or offline player from the list on the left to message them directly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Play Request Card */}
      {latestInvite && (
        <div className="fixed bottom-4 right-4 z-40 w-[min(92vw,390px)] emerald-card-surface rounded-2xl border-2 border-[#FFD76A]/80 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.85)] space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl border border-[#D4AF37]/50 bg-[#073A22] flex items-center justify-center text-[#FFD76A] shrink-0">
                <Swords className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#9CE800]">
                  Play Request ({incomingPendingInvites.length})
                </p>
                <p className="text-sm font-bold text-white truncate">
                  {latestInvite.fromName}{' '}
                  <span className="text-xs font-mono-tabular text-[#FFD76A]">
                    ({latestInvite.fromPlayerId})
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleDeclineInvite()}
              disabled={busyId === latestInvite.inviteId}
              aria-label="Decline invite"
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#04120B] px-3 py-2 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white">
                {GAME_LABELS[latestInvite.gameType] || 'Matatu'} · {latestInvite.maxPlayers}P
              </span>
              <span className="font-mono-tabular font-bold text-[#FFD76A]">
                UGX {latestInvite.entryFeeUgx.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 truncate">
              Table: {latestInvite.roomName} ({latestInvite.roomCode})
            </p>
            {latestInvite.message && (
              <p className="text-[11px] text-neutral-200 italic">“{latestInvite.message}”</p>
            )}
          </div>

          {errorMsg && <p className="text-[11px] text-red-300">{errorMsg}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyId === latestInvite.inviteId}
              onClick={() => void handleAcceptInvite()}
              className="gold-shimmer-btn flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{busyId === latestInvite.inviteId ? 'Joining…' : 'Accept & Play'}</span>
            </button>
            <button
              type="button"
              onClick={() => openChatWith(latestInvite.fromUid)}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#D4AF37]/40 bg-[#062E1C] px-3 py-2 text-xs font-semibold text-[#FFD76A] hover:bg-[#09472B] cursor-pointer"
              title="Chat with challenger"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              disabled={busyId === latestInvite.inviteId}
              onClick={() => void handleDeclineInvite()}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/10 cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {challengeTarget && (
        <SendPlayInviteModal
          target={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </>
  );
};

interface SendPlayInviteModalProps {
  target: { uid: string; displayName: string; playerId: string };
  fixedRoom?: {
    roomId: string;
    roomName: string;
    gameType: TableGameType;
    maxPlayers: number;
    entryFeeUgx: number;
  };
  onClose: () => void;
}

export const SendPlayInviteModal: React.FC<SendPlayInviteModalProps> = ({
  target,
  fixedRoom,
  onClose,
}) => {
  const { sendPlayInvite, closeChatDrawer } = useSocial();
  const [gameType, setGameType] = useState<TableGameType>(fixedRoom?.gameType || 'matatu');
  const [maxPlayers, setMaxPlayers] = useState<number>(fixedRoom?.maxPlayers || 2);
  const [stakeInput, setStakeInput] = useState<string>(
    String(fixedRoom?.entryFeeUgx || MIN_GAME_STAKE_UGX)
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    const parsedStake = Math.round(Number(stakeInput));
    if (
      !fixedRoom &&
      (!Number.isFinite(parsedStake) ||
        parsedStake < MIN_GAME_STAKE_UGX ||
        parsedStake > MAX_GAME_STAKE_UGX)
    ) {
      setErrMsg(
        `Entry stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
      );
      return;
    }

    setBusy(true);
    try {
      await sendPlayInvite({
        toUid: target.uid,
        toName: target.displayName,
        gameType: fixedRoom?.gameType || gameType,
        maxPlayers:
          (fixedRoom?.gameType || gameType) === 'chess' ||
          (fixedRoom?.gameType || gameType) === 'drafts'
            ? 2
            : fixedRoom?.maxPlayers || maxPlayers,
        entryFeeUgx: fixedRoom?.entryFeeUgx || parsedStake,
        roomId: fixedRoom?.roomId,
        roomName: fixedRoom?.roomName,
        message: note.trim() || undefined,
        navigateToTable: !fixedRoom,
      });
      if (!fixedRoom) closeChatDrawer();
      onClose();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to send play request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="emerald-card-surface rounded-2xl border border-[#FFD76A]/65 p-6 max-w-md w-full space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#FFD76A]">
              Send Play Request
            </p>
            <h3 className="font-display text-xl font-bold text-white">
              Challenge {target.displayName}
            </h3>
            <p className="text-xs text-neutral-400 font-mono-tabular">{target.playerId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white cursor-pointer"
            aria-label="Close invite modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {fixedRoom ? (
          <div className="rounded-xl border border-[#D4AF37]/35 bg-[#04120B] p-3.5 text-xs space-y-1">
            <p className="font-bold text-white">{fixedRoom.roomName}</p>
            <p className="text-neutral-300">
              {GAME_LABELS[fixedRoom.gameType]} · {fixedRoom.maxPlayers} Seats ·{' '}
              <span className="text-[#FFD76A] font-mono-tabular font-bold">
                UGX {fixedRoom.entryFeeUgx.toLocaleString()}
              </span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">Game</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as TableGameType)}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
              >
                <option value="matatu">Ugandan Matatu</option>
                <option value="ludo">Ludo Master</option>
                <option value="chess">Kampala Chess</option>
                <option value="drafts">Uganda Drafts</option>
              </select>
            </div>

            {(gameType === 'matatu' || gameType === 'ludo') && (
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Seats</label>
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value={2}>2 Players</option>
                  <option value={3}>3 Players</option>
                  <option value={4}>4 Players</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Entry Stake (UGX · Min 1,000)
              </label>
              <input
                type="number"
                min={MIN_GAME_STAKE_UGX}
                max={MAX_GAME_STAKE_UGX}
                value={stakeInput}
                onChange={(e) => setStakeInput(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 font-mono-tabular text-xs font-bold text-white focus:border-[#FFD76A] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1">
            Message (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={160}
            placeholder="Let's play a round!"
            className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
          />
        </div>

        {errMsg && (
          <p className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {errMsg}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-medium text-neutral-300 hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              {busy
                ? 'Sending…'
                : fixedRoom
                ? 'Send Table Invite'
                : 'Send & Enter Table'}
            </span>
            {!fixedRoom && <Gamepad2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </form>
    </div>
  );
};
