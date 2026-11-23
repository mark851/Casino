import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Dices,
  DoorOpen,
  Gamepad2,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Swords,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useSocial } from '../lib/socialContext';
import { subscribeStore } from '../lib/localStore';
import {
  createLocalRoom,
  joinLocalRoomByCode,
  listLocalPublicRooms,
  saveLocalRoomConfig,
} from '../lib/roomFallbackService';
import {
  extractWalletErrorMessage,
  MAX_GAME_STAKE_UGX,
  MIN_GAME_STAKE_UGX,
} from '../lib/walletService';
import { LudoMaster } from '../components/LudoMaster';
import { LobbyLiveChat } from '../components/LobbyLiveChat';
import { PlayerLayout } from '../components/PlayerLayout';
import { SendPlayInviteModal } from '../components/LiveSocialOverlay';
import kampalaLoungeBg from '../assets/images/kampala_lounge_table_1794421557424.jpg';
import tileMatatuRoyaleImg from '../assets/images/tile_matatu_royale_1794598741250.jpg';
import tileMatatuBlitzImg from '../assets/images/tile_matatu_blitz_1794598742191.jpg';
import tilePawaChessImg from '../assets/images/tile_pawa_chess_1794598741991.jpg';
import tileUgandaDraftsImg from '../assets/images/tile_uganda_drafts_1794598743312.jpg';
import tileLudoMasterImg from '../assets/images/classic_ludo_master_1794665262485.jpg';
import type { PublicRoomSummary, TableGameType } from '../shared/types';

export const PlayLobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, wallet } = useAuth();
  const {
    onlinePlayers,
    offlinePlayers,
    friends,
    players,
    sendFriendRequest,
    openChatWith,
  } = useSocial();

  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [roomName, setRoomName] = useState('Kampala Royal Table');
  const [gameType, setGameType] = useState<TableGameType>('matatu');
  const [mode, setMode] = useState<'multiplayer' | 'bot'>('multiplayer');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [stakeInput, setStakeInput] = useState<string>(String(MIN_GAME_STAKE_UGX));
  const [isPrivate, setIsPrivate] = useState(false);
  const [waitForFriends, setWaitForFriends] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [showLobbyLudo, setShowLobbyLudo] = useState(true);
  const [challengeTarget, setChallengeTarget] = useState<{
    uid: string;
    displayName: string;
    playerId: string;
  } | null>(null);
  const [friendReqBusyUid, setFriendReqBusyUid] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerStatusFilter, setPlayerStatusFilter] = useState<'all' | 'online' | 'offline'>('all');

  const parsedStakeInput = Math.round(Number(stakeInput));
  const stakeUgx = Number.isFinite(parsedStakeInput) ? parsedStakeInput : 0;
  const availableBalance = Number(wallet?.availableBalance ?? 0);

  const fetchRooms = useCallback(async () => {
    try {
      const list = await listLocalPublicRooms();
      setRooms(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
    return subscribeStore(() => {
      void fetchRooms();
    });
  }, [fetchRooms]);

  const createRoom = async (opts?: {
    overrideName?: string;
    overrideGame?: TableGameType;
    overrideMode?: 'multiplayer' | 'bot';
    overridePlayers?: number;
    overrideStakeUgx?: number;
  }) => {
    setError('');
    if (!firebaseUser) {
      setError('Sign in to play at CASINO ROYALE tables.');
      return;
    }
    const gType = opts?.overrideGame || gameType;
    const effectiveName = opts?.overrideName || roomName.trim() || 'Kampala Royal Table';
    const effectiveMode = opts?.overrideMode || mode;
    const effectiveMaxPlayers =
      gType === 'matatu' || gType === 'ludo' ? opts?.overridePlayers || maxPlayers : 2;
    const effectiveStake = Math.round(Number(opts?.overrideStakeUgx ?? stakeUgx));

    if (!Number.isFinite(effectiveStake) || effectiveStake < MIN_GAME_STAKE_UGX || effectiveStake > MAX_GAME_STAKE_UGX) {
      setError(
        `Table entry stake must be between UGX ${MIN_GAME_STAKE_UGX.toLocaleString()} and UGX ${MAX_GAME_STAKE_UGX.toLocaleString()}.`
      );
      return;
    }

    setBusy(true);
    try {
      const created = await createLocalRoom({
        hostUid: firebaseUser.uid,
        hostName: userDoc?.fullName || firebaseUser.displayName || 'Matatu Player',
        name: effectiveName,
        isPrivate,
        gameType: gType,
        mode: effectiveMode,
        maxPlayers: effectiveMaxPlayers,
        entryFeeUgx: effectiveStake,
      });
      navigate(`/game/${created.roomId}`);
    } catch (err) {
      setError(extractWalletErrorMessage(err, 'Unable to create room.'));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firebaseUser) {
      setError('Sign in to join a table.');
      return;
    }
    const code = inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter the 6-character invite code shared by your host.');
      return;
    }
    setBusy(true);
    try {
      const found = await joinLocalRoomByCode(code, firebaseUser.uid);
      navigate(`/game/${found.roomId}`);
    } catch (err) {
      setError(extractWalletErrorMessage(err, 'No active table found with that code.'));
    } finally {
      setBusy(false);
    }
  };

  const handleEnterPublicRoom = async (r: PublicRoomSummary) => {
    setError('');
    if (!firebaseUser) {
      setError('Sign in to open a table.');
      return;
    }
    await saveLocalRoomConfig({
      roomId: r.roomId,
      roomCode: r.roomCode,
      name: r.name,
      hostUid: r.hostUid,
      hostName: r.hostName,
      isPrivate: r.isPrivate,
      gameType: r.gameType || 'matatu',
      mode: r.mode,
      maxPlayers: r.maxPlayers,
      entryFeeUgx: r.entryFeeUgx || MIN_GAME_STAKE_UGX,
      playerUids: [r.hostUid, firebaseUser.uid].filter((v, i, arr) => arr.indexOf(v) === i),
      aiSeats: [],
      status: r.status || 'waiting',
      createdAt: r.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    navigate(`/game/${r.roomId}`);
  };

  const quickTiles = [
    {
      title: 'Matatu Royale',
      caption: `Quick Match · 2P · Entry UGX ${stakeUgx.toLocaleString()}`,
      img: tileMatatuRoyaleImg,
      onClick: () =>
        void createRoom({
          overrideName: 'Matatu Royale Arena',
          overrideGame: 'matatu',
          overrideMode: 'bot',
          overridePlayers: 2,
          overrideStakeUgx: stakeUgx,
        }),
    },
    {
      title: 'Matatu Blitz',
      caption: `4P Table · Quick Match · Entry UGX ${stakeUgx.toLocaleString()}`,
      img: tileMatatuBlitzImg,
      onClick: () =>
        void createRoom({
          overrideName: 'Matatu Blitz 4P',
          overrideGame: 'matatu',
          overrideMode: 'bot',
          overridePlayers: 4,
          overrideStakeUgx: stakeUgx,
        }),
    },
    {
      title: 'Kampala Chess',
      caption: `1v1 Quick Match · Entry UGX ${stakeUgx.toLocaleString()}`,
      img: tilePawaChessImg,
      onClick: () =>
        void createRoom({
          overrideName: 'Kampala Chess Arena',
          overrideGame: 'chess',
          overrideMode: 'bot',
          overridePlayers: 2,
          overrideStakeUgx: stakeUgx,
        }),
    },
    {
      title: 'Uganda Drafts',
      caption: `1v1 Quick Match · Entry UGX ${stakeUgx.toLocaleString()}`,
      img: tileUgandaDraftsImg,
      onClick: () =>
        void createRoom({
          overrideName: 'Uganda Drafts Classic',
          overrideGame: 'drafts',
          overrideMode: 'bot',
          overridePlayers: 2,
          overrideStakeUgx: stakeUgx,
        }),
    },
    {
      title: 'Ludo Master',
      caption: `4P Table · Quick Match · Entry UGX ${stakeUgx.toLocaleString()}`,
      img: tileLudoMasterImg,
      onClick: () =>
        void createRoom({
          overrideName: 'Ludo Master Arena',
          overrideGame: 'ludo',
          overrideMode: 'bot',
          overridePlayers: 4,
          overrideStakeUgx: stakeUgx,
        }),
    },
  ];

  const playerPool =
    playerStatusFilter === 'online'
      ? onlinePlayers
      : playerStatusFilter === 'offline'
      ? offlinePlayers
      : players;

  const filteredLobbyPlayers = playerPool
    .filter((p) => {
      const q = playerSearch.trim().toLowerCase();
      if (!q) return true;
      return p.displayName.toLowerCase().includes(q) || p.playerId.toLowerCase().includes(q);
    })
    .slice(0, 16);

  return (
    <PlayerLayout title="Game Lobby & Tables">
      <div className="space-y-7">
        {/* Top Lounge Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
          <img
            src={kampalaLoungeBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#02120B]/95 via-[#031F13]/88 to-[#021009]/85"
          />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-xl">
              <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" />
                <span>Royale Kampala Arena</span>
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Choose Your Table or Open a Room
              </h2>
              <p className="text-xs sm:text-sm text-neutral-300">
                Open any 3D game table right away to inspect the arena, choose your seat, and chat — lock your UGX stake (Min UGX {MIN_GAME_STAKE_UGX.toLocaleString()}) inside the table when ready to play.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto shrink-0">
              <div className="rounded-xl border border-[#D4AF37]/40 bg-[#04140C]/90 px-4 py-2 text-xs">
                <p className="text-neutral-400">Wallet Available</p>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-tabular text-sm font-extrabold text-[#FFD76A]">
                    UGX {availableBalance.toLocaleString()}
                  </span>
                  <Link to="/wallet?tab=deposit" className="text-emerald-400 font-bold hover:underline">
                    Deposit →
                  </Link>
                </div>
              </div>
              <Link
                to="/tournaments"
                className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shrink-0"
              >
                <Trophy className="h-4 w-4" />
                <span>Daily Cups &amp; Brackets</span>
              </Link>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200 flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            {/deposit|insufficient/i.test(error) && (
              <Link
                to="/wallet?tab=deposit"
                className="font-bold text-[#FFD76A] hover:underline whitespace-nowrap"
              >
                Deposit UGX (Min 1,000) →
              </Link>
            )}
          </div>
        )}

        {/* Live Online & Offline Players Directory Strip */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#9CE800] inline-block" />
                <span>Players Online &amp; Offline</span>
                <span className="text-xs font-mono-tabular font-semibold text-[#9CE800]">
                  ({onlinePlayers.length} Online · {offlinePlayers.length} Offline · {friends.length} Friends)
                </span>
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5">
                See who is online or offline right now, open live 1-on-1 chat, or invite online players to play together.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all' as const, label: `All (${players.length})` },
                { id: 'online' as const, label: `Online (${onlinePlayers.length})` },
                { id: 'offline' as const, label: `Offline (${offlinePlayers.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlayerStatusFilter(tab.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${
                    playerStatusFilter === tab.id
                      ? 'gold-shimmer-btn'
                      : 'border border-white/15 bg-[#04120B] text-neutral-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  placeholder="Search players…"
                  className="w-44 rounded-full border border-white/15 bg-[#04120B] pl-8 pr-3 py-1.5 text-xs text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>
              <Link
                to="/friends"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#06321E] px-4 py-2 text-xs font-bold text-[#FFD76A] hover:bg-[#0A4A2D] whitespace-nowrap"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Browse All ({players.length}) →</span>
              </Link>
            </div>
          </div>

          {filteredLobbyPlayers.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#04140C] px-4 py-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-300">
                {playerStatusFilter === 'online'
                  ? 'No other players are currently online. Check Offline or All Players to message someone.'
                  : 'No matching players found.'}
              </p>
              <Link
                to="/friends"
                className="text-xs font-bold text-[#FFD76A] hover:underline whitespace-nowrap"
              >
                Open Friends Hub →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredLobbyPlayers.map((p) => {
                const isFriend = p.friendship?.status === 'accepted';
                const isPending = p.friendship?.status === 'pending';
                return (
                  <div
                    key={p.uid}
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      p.isOnline
                        ? 'border-white/15 bg-[#04140C]'
                        : 'border-white/10 bg-[#030C08]/80 opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              p.isOnline
                                ? p.presence?.status === 'away'
                                  ? 'bg-amber-400'
                                  : 'bg-[#9CE800]'
                                : 'bg-neutral-600'
                            }`}
                          />
                          <p className="text-xs font-bold text-white truncate">{p.displayName}</p>
                        </div>
                        <p className="text-[11px] font-mono-tabular text-neutral-400 truncate pl-3.5">
                          {p.playerId} ·{' '}
                          <span className={p.isOnline ? 'text-[#9CE800]' : 'text-neutral-500'}>
                            {p.isOnline
                              ? p.presence?.status === 'in_game'
                                ? 'In Table'
                                : p.presence?.status === 'away'
                                ? 'Away'
                                : 'Online'
                              : 'Offline'}
                          </span>
                        </p>
                      </div>
                      {isFriend && (
                        <span className="text-[10px] font-bold text-[#FFD76A] shrink-0">
                          Friend
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
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
                        className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ${
                          p.isOnline
                            ? 'gold-shimmer-btn cursor-pointer'
                            : 'border border-white/10 bg-white/5 text-neutral-500 cursor-not-allowed'
                        }`}
                      >
                        <Swords className="h-3 w-3" />
                        <span>{p.isOnline ? 'Play' : 'Offline'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openChatWith(p.uid)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-neutral-200 hover:bg-white/10 cursor-pointer"
                        title="Chat"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Chat</span>
                      </button>
                      {!isFriend && !isPending && (
                        <button
                          type="button"
                          disabled={friendReqBusyUid === p.uid}
                          onClick={async () => {
                            setFriendReqBusyUid(p.uid);
                            try {
                              await sendFriendRequest({
                                uid: p.uid,
                                displayName: p.displayName,
                                playerId: p.playerId,
                              });
                            } finally {
                              setFriendReqBusyUid(null);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-lg border border-[#D4AF37]/40 bg-[#062E1C] p-1.5 text-[#FFD76A] hover:bg-[#09472B] cursor-pointer disabled:opacity-50"
                          title="Add Friend"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick-Launch Bespoke Game Tiles */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold text-white">
              Instant Play Modes <span className="text-xs font-normal text-neutral-400">(Min Stake UGX 1,000)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-400 mr-1">Table Stake:</span>
              {[1000, 2000, 5000, 10000, 25000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStakeInput(String(amt))}
                  className={`rounded-lg border px-2.5 py-1 font-mono-tabular text-xs font-bold cursor-pointer transition-colors ${
                    stakeUgx === amt
                      ? 'border-[#FFD76A] bg-[#0B4128] text-[#FFD76A]'
                      : 'border-white/15 bg-[#04120B] text-neutral-300 hover:border-white/35'
                  }`}
                >
                  UGX {amt.toLocaleString()}
                </button>
              ))}
              <div className="flex items-center gap-1 rounded-lg border border-[#D4AF37]/45 bg-[#04120B] px-2.5 py-1">
                <span className="text-[11px] font-semibold text-[#FFD76A]">UGX</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_GAME_STAKE_UGX}
                  max={MAX_GAME_STAKE_UGX}
                  step={1}
                  aria-label="Custom table stake in UGX"
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  className="w-24 bg-transparent font-mono-tabular text-xs font-bold text-white focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickTiles.map((tile) => (
              <button
                key={tile.title}
                type="button"
                disabled={busy}
                onClick={tile.onClick}
                className="group relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 hover:border-[#FFD76A] bg-[#0B110E] text-left transition-all hover:-translate-y-0.5 cursor-pointer shadow-lg"
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={tile.img}
                    alt={tile.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3.5 pt-8">
                  <p className="text-sm font-bold text-white group-hover:text-[#FFD76A]">
                    {tile.title}
                  </p>
                  <p className="text-[11px] text-neutral-300 mt-0.5">{tile.caption}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Interactive LudoMaster Lobby Table */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Dices className="h-5 w-5 text-[#FFD76A]" />
                <span>Ludo Master — Instant Lobby Board</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Roll the dice, deploy pawns, and play a live 2–4 player match against active Kampala arena contenders directly from the lobby.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLobbyLudo((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/45 bg-[#062919] px-3 py-2 text-xs font-semibold text-[#FFD76A] hover:bg-[#0A3C26] cursor-pointer whitespace-nowrap shrink-0"
            >
              {showLobbyLudo ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>Minimize Board</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>Open LudoMaster</span>
                </>
              )}
            </button>
          </div>

          {showLobbyLudo && (
            <LudoMaster
              initialPlayerCount={4}
              playerName={userDoc?.fullName || firebaseUser?.displayName || 'You'}
              launchingFullMatch={busy}
              onLaunchFullMatch={(count, customStakeUgx) =>
                void createRoom({
                  overrideName: `Ludo Master ${count}P`,
                  overrideGame: 'ludo',
                  overrideMode: 'bot',
                  overridePlayers: count,
                  overrideStakeUgx: customStakeUgx ?? stakeUgx,
                })
              }
            />
          )}
        </section>

        {/* Live Arena Chat with Joined Users & Active Contenders */}
        <LobbyLiveChat />

        {/* Create Room + Join by Invite Code */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#FFD76A]" />
              <span>Create Custom Table</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Table Name</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Game Discipline</label>
                <select
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value as TableGameType)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="matatu">Ugandan Matatu (Cards)</option>
                  <option value="ludo">Ludo Master (2–4 Players)</option>
                  <option value="chess">Kampala Chess (1v1)</option>
                  <option value="drafts">Uganda Drafts (1v1)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">Opponents</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'multiplayer' | 'bot')}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                >
                  <option value="multiplayer">Live Multiplayer (Open Table + Friends)</option>
                  <option value="bot">Instant Match vs Online Contenders</option>
                </select>
              </div>

              {(gameType === 'matatu' || gameType === 'ludo') && (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Table Seats</label>
                  <select
                    value={maxPlayers}
                    onChange={(e) => setMaxPlayers(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                  >
                    <option value={2}>2 Players</option>
                    <option value={3}>3 Players</option>
                    <option value={4}>4 Players</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Entry Stake (UGX · Min 1,000)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_GAME_STAKE_UGX}
                  max={MAX_GAME_STAKE_UGX}
                  step={1}
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 font-mono-tabular text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                />
                {stakeUgx < MIN_GAME_STAKE_UGX && (
                  <p className="text-[11px] text-amber-300 mt-1">
                    Minimum table price is UGX {MIN_GAME_STAKE_UGX.toLocaleString()}.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="h-4 w-4 accent-[#D4AF37]"
                  />
                  <Lock className="h-3.5 w-3.5 text-[#FFD76A]" />
                  <span>Private Invite-Only Room</span>
                </label>

                {mode === 'multiplayer' && (
                  <label className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={waitForFriends}
                      onChange={(e) => setWaitForFriends(e.target.checked)}
                      className="h-4 w-4 accent-[#9CE800]"
                    />
                    <Users className="h-3.5 w-3.5 text-[#9CE800]" />
                    <span>Wait for Invited Friends Only</span>
                  </label>
                )}
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void createRoom()}
                className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                <Gamepad2 className="h-4 w-4" />
                <span>{busy ? 'Opening Table…' : 'Open Table'}</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={handleJoinByCode}
            className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#FFD76A]" />
                <span>Join via Invite Code</span>
              </h3>
              <p className="text-xs text-neutral-300">
                Have a 6-character table code from a friend? Enter it below to take your seat immediately.
              </p>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. KMP7X2"
                maxLength={8}
                className="w-full rounded-xl border border-white/15 bg-[#04120B] px-4 py-3 text-center font-mono-tabular text-base font-bold tracking-[0.25em] text-[#FFD76A] uppercase focus:border-[#FFD76A] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full border border-[#D4AF37]/60 bg-[#063B24] py-2.5 text-xs font-bold text-[#FFD76A] hover:bg-[#095333] transition-colors cursor-pointer"
            >
              Join Private Table
            </button>
          </form>
        </div>

        {/* Open Public Tables */}
        <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-[#FFD76A]" />
              <span>Open Public Tables</span>
            </h3>
            <button
              type="button"
              onClick={() => void fetchRooms()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FFD76A] hover:text-white cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-neutral-400 py-4">Loading live tables…</p>
          ) : rooms.length === 0 ? (
            <p className="text-xs text-neutral-400 py-4">
              No public tables waiting right now. Open a custom table or click one of the instant play tiles above.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {rooms.map((r) => (
                <div
                  key={r.roomId}
                  className="rounded-xl border border-white/10 bg-[#04140C] p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white truncate">{r.name}</span>
                      <span className="text-[11px] font-mono-tabular text-[#FFD76A]">
                        {r.roomCode}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 flex items-center gap-2">
                      <span className="capitalize">{r.gameType || 'matatu'}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {r.playerCount}/{r.maxPlayers}
                      </span>
                      <span>·</span>
                      <span className="font-mono-tabular text-[#FFD76A] font-semibold">
                        UGX {(r.entryFeeUgx || MIN_GAME_STAKE_UGX).toLocaleString()}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{r.status.replace('_', ' ')}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleEnterPublicRoom(r)}
                    className="gold-shimmer-btn rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    Open Table
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
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
