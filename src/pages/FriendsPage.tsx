import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Clock,
  Gamepad2,
  MessageSquare,
  Search,
  Send,
  Swords,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useSocial, type CombinedPlayerEntry } from '../lib/socialContext';
import { pairIdForUids } from '../lib/socialService';
import { PlayerLayout } from '../components/PlayerLayout';
import { SendPlayInviteModal } from '../components/LiveSocialOverlay';
import { ChatTypingBubble } from '../components/ChatTypingBubble';
import { timestampMs } from '../utils/validation';

type FriendsTab = 'online' | 'offline' | 'discover' | 'friends' | 'requests';

const GAME_NAME: Record<string, string> = {
  matatu: 'Matatu',
  ludo: 'Ludo Master',
  chess: 'Kampala Chess',
  drafts: 'Uganda Drafts',
};

export const FriendsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const {
    players,
    onlinePlayers,
    offlinePlayers,
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    invites,
    messagesByPairId,
    typingByPairId,
    unreadSenders,
    activeChatUid,
    setActiveChatUid,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriendOrRequest,
    loadDirectChat,
    sendDirectMessage,
    acceptPlayInvite,
    declinePlayInvite,
    cancelPlayInvite,
  } = useSocial();

  const myUid = firebaseUser?.uid || '';
  const [tab, setTab] = useState<FriendsTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [challengeTarget, setChallengeTarget] = useState<{
    uid: string;
    displayName: string;
    playerId: string;
  } | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeChatUid && onlinePlayers.length > 0) {
      setActiveChatUid(onlinePlayers[0].uid);
    } else if (!activeChatUid && friends.length > 0) {
      setActiveChatUid(friends[0].uid);
    }
  }, [activeChatUid, friends, onlinePlayers, setActiveChatUid]);

  useEffect(() => {
    if (activeChatUid) {
      void loadDirectChat(activeChatUid);
    }
  }, [activeChatUid, loadDirectChat]);

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
  }, [activeMessages.length, activeTypingUsers.length, activeChatUid]);

  const filteredList = useMemo(() => {
    const base =
      tab === 'online'
        ? onlinePlayers
        : tab === 'offline'
        ? offlinePlayers
        : tab === 'friends'
        ? friends
        : players;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.playerId.toLowerCase().includes(q)
    );
  }, [tab, onlinePlayers, offlinePlayers, friends, players, searchQuery]);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setErrorMsg('');
    setActionBusy(key);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatUid || !chatDraft.trim()) return;
    const text = chatDraft.trim();
    setChatDraft('');
    await runAction(`chat_${activeChatUid}`, () => sendDirectMessage(activeChatUid, text));
  };

  const renderStatusBadge = (p: CombinedPlayerEntry) => {
    if (!p.isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400">
          <span className="h-2 w-2 rounded-full bg-neutral-600" />
          Offline
        </span>
      );
    }
    if (p.presence?.status === 'in_game') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FFD76A]">
          <span className="h-2 w-2 rounded-full bg-[#FFD76A] animate-pulse" />
          In Game{p.presence.currentGameType ? ` · ${GAME_NAME[p.presence.currentGameType]}` : ''}
        </span>
      );
    }
    if (p.presence?.status === 'away') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          Away
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#9CE800]">
        <span className="h-2 w-2 rounded-full bg-[#9CE800]" />
        Online Now
      </span>
    );
  };

  const renderFriendControl = (p: CombinedPlayerEntry) => {
    const f = p.friendship;
    if (!f || f.status === 'declined') {
      return (
        <button
          type="button"
          disabled={actionBusy === `fr_${p.uid}`}
          onClick={() =>
            void runAction(`fr_${p.uid}`, () =>
              sendFriendRequest({
                uid: p.uid,
                displayName: p.displayName,
                playerId: p.playerId,
              })
            )
          }
          className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/45 bg-[#062919] px-2.5 py-1.5 text-xs font-semibold text-[#FFD76A] hover:bg-[#0B4229] cursor-pointer disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Add Friend</span>
        </button>
      );
    }
    if (f.status === 'pending' && f.recipientUid === myUid) {
      return (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={actionBusy === `acc_${f.pairId}`}
            onClick={() =>
              void runAction(`acc_${f.pairId}`, () => acceptFriendRequest(f.pairId))
            }
            className="inline-flex items-center gap-1 rounded-lg bg-[#0D4D2F] border border-[#9CE800]/50 px-2.5 py-1.5 text-xs font-bold text-[#9CE800] hover:bg-[#13663E] cursor-pointer"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Accept</span>
          </button>
          <button
            type="button"
            disabled={actionBusy === `dec_${f.pairId}`}
            onClick={() =>
              void runAction(`dec_${f.pairId}`, () => declineFriendRequest(f.pairId))
            }
            className="inline-flex items-center rounded-lg border border-white/15 px-2 py-1.5 text-xs text-neutral-300 hover:bg-white/10 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }
    if (f.status === 'pending') {
      return (
        <button
          type="button"
          disabled={actionBusy === `rem_${f.pairId}`}
          onClick={() =>
            void runAction(`rem_${f.pairId}`, () => removeFriendOrRequest(f.pairId))
          }
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-red-300 cursor-pointer"
          title="Cancel friend request"
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Requested</span>
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={actionBusy === `rem_${f.pairId}`}
        onClick={() =>
          void runAction(`rem_${f.pairId}`, () => removeFriendOrRequest(f.pairId))
        }
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:border-red-400/40 hover:text-red-300 cursor-pointer"
        title="Click to unfriend"
      >
        <UserCheck className="h-3.5 w-3.5" />
        <span>Friend</span>
      </button>
    );
  };

  const pendingInvitesCount = invites.filter((i) => i.status === 'pending').length;

  return (
    <PlayerLayout title="Online Players & Friends">
      <div className="space-y-6">
        {/* Top Metrics Bar */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Online Right Now</p>
            <p className="font-mono-tabular text-2xl font-extrabold text-[#9CE800] mt-1">
              {onlinePlayers.length + 1}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {onlinePlayers.length} other player{onlinePlayers.length === 1 ? '' : 's'} active now
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">My Friends</p>
            <p className="font-mono-tabular text-2xl font-extrabold text-[#FFD76A] mt-1">
              {friends.length}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {friends.filter((f) => f.isOnline).length} online now
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Friend Requests</p>
            <p className="font-mono-tabular text-2xl font-extrabold text-white mt-1">
              {incomingFriendRequests.length}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {outgoingFriendRequests.length} outgoing sent
            </p>
          </div>
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/30 p-4">
            <p className="text-[11px] uppercase tracking-wider text-neutral-400">Play Invites</p>
            <p className="font-mono-tabular text-2xl font-extrabold text-[#FFD76A] mt-1">
              {pendingInvitesCount}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Active match requests</p>
          </div>
        </section>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-2.5 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Main Split Layout: Directory/Friends/Requests + Live Direct Chat */}
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
          {/* Left Column */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'online' as const, label: `Online (${onlinePlayers.length})` },
                  { id: 'offline' as const, label: `Offline (${offlinePlayers.length})` },
                  { id: 'discover' as const, label: `All Players (${players.length})` },
                  { id: 'friends' as const, label: `Friends (${friends.length})` },
                  {
                    id: 'requests' as const,
                    label: `Requests (${incomingFriendRequests.length + pendingInvitesCount})`,
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                      tab === item.id
                        ? 'gold-shimmer-btn'
                        : 'border border-white/10 bg-[#04120B] text-neutral-300 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {tab !== 'requests' && (
              <div className="relative">
                <Search className="h-4 w-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find friends by name or Player ID (e.g. CR-...)…"
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
            )}

            {tab === 'requests' ? (
              <div className="space-y-5">
                {/* Incoming Friend Requests */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD76A]">
                    Incoming Friend Requests ({incomingFriendRequests.length})
                  </h3>
                  {incomingFriendRequests.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-2">
                      No pending friend requests right now.
                    </p>
                  ) : (
                    incomingFriendRequests.map((req) => (
                      <div
                        key={req.pairId}
                        className="rounded-xl border border-[#D4AF37]/30 bg-[#04140C] p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{req.requesterName}</p>
                          <p className="text-[11px] font-mono-tabular text-[#FFD76A]">
                            {req.requesterPlayerId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(`acc_${req.pairId}`, () =>
                                acceptFriendRequest(req.pairId)
                              )
                            }
                            className="gold-shimmer-btn rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(`dec_${req.pairId}`, () =>
                                declineFriendRequest(req.pairId)
                              )
                            }
                            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10 cursor-pointer"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Play Together Invites */}
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFD76A]">
                    Play Together Requests ({invites.length})
                  </h3>
                  {invites.length === 0 ? (
                    <p className="text-xs text-neutral-400 py-2">
                      No match invites yet. Click “Play Together” next to any online friend!
                    </p>
                  ) : (
                    invites.slice(0, 20).map((inv) => {
                      const incoming = inv.toUid === myUid;
                      return (
                        <div
                          key={inv.inviteId}
                          className="rounded-xl border border-white/10 bg-[#04140C] p-3.5 flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-white">
                              {incoming
                                ? `From ${inv.fromName}`
                                : `To ${inv.toName}`}{' '}
                              ·{' '}
                              <span className="text-[#FFD76A]">
                                {GAME_NAME[inv.gameType] || inv.gameType} ({inv.maxPlayers}P)
                              </span>
                            </p>
                            <p className="text-[11px] text-neutral-400">
                              Table {inv.roomCode} · Stake UGX {inv.entryFeeUgx.toLocaleString()} ·{' '}
                              <span className="capitalize font-semibold text-neutral-200">
                                {inv.status}
                              </span>
                            </p>
                            {inv.message && (
                              <p className="text-[11px] text-neutral-300 italic">“{inv.message}”</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {inv.status === 'pending' && incoming && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(`inv_acc_${inv.inviteId}`, () =>
                                      acceptPlayInvite(inv)
                                    )
                                  }
                                  className="gold-shimmer-btn rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                                >
                                  Accept &amp; Play
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(`inv_dec_${inv.inviteId}`, () =>
                                      declinePlayInvite(inv.inviteId)
                                    )
                                  }
                                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/10 cursor-pointer"
                                >
                                  Decline
                                </button>
                              </>
                            )}
                            {inv.status === 'pending' && !incoming && (
                              <>
                                <Link
                                  to={`/game/${inv.roomId}`}
                                  className="rounded-lg border border-[#D4AF37]/45 bg-[#062E1C] px-3 py-1.5 text-xs font-bold text-[#FFD76A] hover:bg-[#0A472B]"
                                >
                                  Open Table
                                </Link>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(`inv_can_${inv.inviteId}`, () =>
                                      cancelPlayInvite(inv.inviteId)
                                    )
                                  }
                                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-neutral-300 hover:text-red-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            {inv.status === 'accepted' && (
                              <Link
                                to={`/game/${inv.roomId}`}
                                className="gold-shimmer-btn rounded-lg px-3.5 py-1.5 text-xs font-bold"
                              >
                                Join Table →
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Outgoing Friend Requests */}
                {outgoingFriendRequests.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Sent Friend Requests ({outgoingFriendRequests.length})
                    </h3>
                    {outgoingFriendRequests.map((req) => (
                      <div
                        key={req.pairId}
                        className="rounded-xl border border-white/10 bg-[#04140C] p-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-white">{req.recipientName}</span>{' '}
                          <span className="font-mono-tabular text-neutral-400">
                            ({req.recipientPlayerId})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(`rem_${req.pairId}`, () =>
                              removeFriendOrRequest(req.pairId)
                            )
                          }
                          className="inline-flex items-center gap-1 text-neutral-400 hover:text-red-300 cursor-pointer"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : filteredList.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#04120B] p-8 text-center space-y-2">
                <Users className="h-8 w-8 text-[#D4AF37]/60 mx-auto" />
                <p className="text-sm font-semibold text-white">
                  {tab === 'online'
                    ? 'No other players are currently online'
                    : tab === 'friends'
                    ? 'No friends added yet'
                    : 'No matching players found'}
                </p>
                <p className="text-xs text-neutral-400">
                  {tab === 'online'
                    ? 'Browse all players to find friends, chat, or challenge someone to a match.'
                    : 'Search registered players by name or Player ID to add friends and invite them to play.'}
                </p>
                {tab === 'online' && players.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab('discover')}
                    className="mt-2 rounded-xl border border-[#D4AF37]/50 bg-[#063B24] px-4 py-2 text-xs font-bold text-[#FFD76A] cursor-pointer"
                  >
                    Browse All Players ({players.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredList.map((p) => {
                  const unread = unreadSenders[p.uid] || 0;
                  const isChatSelected = activeChatUid === p.uid;
                  return (
                    <div
                      key={p.uid}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isChatSelected
                          ? 'border-[#FFD76A]/70 bg-[#072617]'
                          : 'border-white/10 bg-[#04140C] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-10 w-10 rounded-full border border-[#D4AF37]/60 bg-[#063B24] flex items-center justify-center shrink-0 overflow-hidden">
                          {p.avatarUrl ? (
                            <img
                              src={p.avatarUrl}
                              alt={p.displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="font-display text-sm font-bold text-[#FFD76A]">
                              {p.displayName.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#04140C] ${
                              !p.isOnline
                                ? 'bg-neutral-600'
                                : p.presence?.status === 'in_game'
                                ? 'bg-[#FFD76A]'
                                : 'bg-[#9CE800]'
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{p.displayName}</p>
                            <span className="text-[11px] font-mono-tabular text-[#FFD76A]">
                              {p.playerId}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {renderStatusBadge(p)}
                            {p.gamesWon > 0 && (
                              <span className="text-[11px] text-neutral-400">
                                · {p.gamesWon} Wins
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {renderFriendControl(p)}
                        <button
                          type="button"
                          onClick={() => setActiveChatUid(p.uid)}
                          className="relative inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:border-[#FFD76A]/60 cursor-pointer"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-[#FFD76A]" />
                          <span>Chat</span>
                          {unread > 0 && (
                            <span className="ml-0.5 rounded-full bg-[#9CE800] px-1.5 py-0.2 text-[10px] font-extrabold text-black">
                              {unread}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={!p.isOnline}
                          onClick={() =>
                            setChallengeTarget({
                              uid: p.uid,
                              displayName: p.displayName,
                              playerId: p.playerId,
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-extrabold ${
                            p.isOnline
                              ? 'gold-shimmer-btn cursor-pointer'
                              : 'border border-white/10 bg-white/5 text-neutral-500 cursor-not-allowed'
                          }`}
                        >
                          <Swords className="h-3.5 w-3.5" />
                          <span>{p.isOnline ? 'Play Together' : 'Offline'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Live 1-on-1 Direct Chat */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 flex flex-col h-[620px]">
            {activeChatPartner ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          activeChatPartner.isOnline ? 'bg-[#9CE800]' : 'bg-neutral-600'
                        }`}
                      />
                      <h3 className="font-display text-base font-bold text-white truncate">
                        {activeChatPartner.displayName}
                      </h3>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-mono-tabular">
                      {activeChatPartner.playerId} ·{' '}
                      {activeTypingUsers.length > 0 ? (
                        <span className="text-[#FFD76A] font-sans font-semibold">typing…</span>
                      ) : activeChatPartner.isOnline ? (
                        'Live Online'
                      ) : (
                        'Offline (messages saved in thread)'
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
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold shrink-0 ${
                      activeChatPartner.isOnline
                        ? 'gold-shimmer-btn cursor-pointer'
                        : 'border border-white/10 bg-white/5 text-neutral-500 cursor-not-allowed'
                    }`}
                  >
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <span>{activeChatPartner.isOnline ? 'Invite to Play' : 'Offline'}</span>
                  </button>
                </div>

                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1"
                >
                  {activeMessages.length === 0 && activeTypingUsers.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6 space-y-2">
                      <MessageSquare className="h-8 w-8 text-[#D4AF37]/50" />
                      <p className="text-xs font-semibold text-neutral-300">
                        Start chatting with {activeChatPartner.displayName}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Say hello or send a Play Request to open a table together in Matatu, Ludo, Chess, or Drafts.
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
                                  : 'bg-[#04140C] border border-white/12 text-neutral-200'
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

                <form
                  onSubmit={handleSendChat}
                  className="pt-3 border-t border-white/10 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    maxLength={400}
                    placeholder={`Message ${activeChatPartner.displayName}…`}
                    className="flex-1 min-w-0 rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!chatDraft.trim()}
                    className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-extrabold cursor-pointer disabled:opacity-45 shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 space-y-2">
                <MessageSquare className="h-10 w-10 text-[#D4AF37]/50" />
                <p className="font-display text-lg font-bold text-white">Direct Player Chat</p>
                <p className="text-xs text-neutral-400">
                  Select any friend or online player on the left to chat directly and challenge them to a live match.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {challengeTarget && (
        <SendPlayInviteModal
          target={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      )}
    </PlayerLayout>
  );
};
