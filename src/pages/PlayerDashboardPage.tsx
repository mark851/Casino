import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Gamepad2,
  Wallet,
  Bell,
  Trophy,
  ArrowRight,
  Crown,
  Target,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { getStore, listPublicRoomsFromStore, subscribeStore } from '../lib/localStore';
import { PlayerLayout } from '../components/PlayerLayout';
import { PlayingCard } from '../components/PlayingCard';
import { timestampMs } from '../utils/validation';
import kampalaLoungeBg from '../assets/images/kampala_lounge_table_1794421557424.jpg';
import type { GameHistoryRecord, NotificationRecord, PublicRoomSummary } from '../shared/types';

function getLeagueTier(gamesWon: number): string {
  if (gamesWon >= 50) return 'Grand Champion';
  if (gamesWon >= 20) return 'Matatu Master';
  if (gamesWon >= 5) return 'Table Tactician';
  return 'Kampala Contender';
}

export const PlayerDashboardPage: React.FC = () => {
  const { firebaseUser, userDoc, playerProfile, wallet, isApprovedPlayer } = useAuth();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [recentGames, setRecentGames] = useState<GameHistoryRecord[]>([]);
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const sync = () => {
      const s = getStore();
      const notifs = [...(s.notifications[firebaseUser.uid] || [])]
        .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
        .slice(0, 5);
      setNotifications(notifs);

      const history = s.gameHistory
        .filter((g) => g.playerUids.includes(firebaseUser.uid))
        .sort((a, b) => timestampMs(b.createdAt) - timestampMs(a.createdAt))
        .slice(0, 5);
      setRecentGames(history);

      if (isApprovedPlayer) {
        setRooms(listPublicRoomsFromStore());
      } else {
        setRooms([]);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [firebaseUser, isApprovedPlayer]);

  const kycStatus = userDoc?.kycStatus || 'Not Submitted';
  const displayName = userDoc?.fullName || firebaseUser?.displayName || 'Player';
  const initial = displayName.trim().slice(0, 1).toUpperCase() || 'M';
  const gamesWon = playerProfile?.gamesWon ?? 0;
  const leagueTier = getLeagueTier(gamesWon);

  return (
    <PlayerLayout title="Player Dashboard">
      <div className="space-y-8">
        {/* Welcome & Player Medallion Hero Banner */}
        <section className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 shadow-[0_20px_50px_rgba(0,0,0,0.75)]">
          <img
            src={kampalaLoungeBg}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-[#02130B]/95 via-[#031E12]/90 to-[#02120B]/80"
          />
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {/* Circular Matatu Medallion Portrait */}
              <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-[#FFD76A] bg-[#063B24] flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_24px_rgba(212,175,55,0.35)]">
                {playerProfile?.avatarUrl ? (
                  <img
                    src={playerProfile.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[#FFD76A]">
                    {initial}
                  </span>
                )}
                <span className="absolute bottom-0.5 right-0.5 h-6 w-6 rounded-full bg-[#021D12] border border-[#FFD76A] flex items-center justify-center">
                  <Crown className="h-3.5 w-3.5 text-[#FFD76A]" />
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#FFD76A]">{leagueTier}</span>
                  <span className="text-neutral-500" aria-hidden="true">·</span>
                  <span className="text-neutral-300 font-mono-tabular">
                    ID: {userDoc?.playerId || 'Pending Registration'}
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1 truncate">
                  Welcome, {displayName}
                </h2>
                <p className="text-xs text-neutral-300 mt-1.5">
                  Account:{' '}
                  <span className="text-white font-medium">{userDoc?.accountStatus || 'Pending'}</span>
                  <span className="mx-2 text-neutral-500" aria-hidden="true">·</span>
                  Identity Check:{' '}
                  <span
                    className={`font-semibold ${
                      kycStatus === 'Approved' ? 'text-emerald-400' : 'text-[#FFD76A]'
                    }`}
                  >
                    {kycStatus}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-5 shrink-0">
              {/* Decorative Mini Card Fan on Desktop */}
              <div className="hidden xl:flex items-center -space-x-5 pr-2" aria-hidden="true">
                <div className="-rotate-12 translate-y-1">
                  <PlayingCard card={{ id: 'dash_7d', rank: '7', suit: 'diamonds' }} size="sm" />
                </div>
                <div className="rotate-6">
                  <PlayingCard card={{ id: 'dash_as', rank: 'A', suit: 'spades' }} size="sm" />
                </div>
              </div>

              {isApprovedPlayer ? (
                <Link
                  to="/play"
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold whitespace-nowrap"
                >
                  <Gamepad2 className="h-4 w-4" />
                  <span>Enter Game Lobby</span>
                </Link>
              ) : (
                <Link
                  to="/verification-status"
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold whitespace-nowrap"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>{kycStatus === 'Not Submitted' ? 'Complete ID Verification' : 'View KYC Status'}</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* KYC Pending / Action Notice */}
        {!isApprovedPlayer && (
          <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#FFD76A]">
                {kycStatus === 'Pending Verification'
                  ? 'Your account is awaiting identity verification. Our verification team will review your documents.'
                  : 'Complete Identity Verification to Unlock Gameplay'}
              </p>
              <p className="text-xs text-neutral-300">
                Gameplay rooms and tournaments remain restricted until your 18+ identity verification is approved.
              </p>
            </div>
            <Link
              to="/verification-status"
              className="rounded-full border border-[#D4AF37]/50 bg-[#063B24]/80 px-5 py-2 text-xs font-semibold text-[#FFD76A] hover:bg-[#094D30] whitespace-nowrap shrink-0"
            >
              Open Verification Portal
            </Link>
          </div>
        )}

        {/* Match & Arena Stats Grid */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-xl font-bold text-white">Match &amp; Arena Statistics</h3>
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/30 bg-[#063B24]/60 px-3.5 py-1.5 text-xs text-[#FFD76A] hover:border-[#FFD76A]"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span>
                Standings · <span className="font-mono-tabular font-bold">{gamesWon} Wins</span>
              </span>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-400">Total Games</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono-tabular text-white mt-1">
                  {playerProfile?.totalGames ?? 0}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full border border-[#D4AF37]/35 bg-[#031B10] flex items-center justify-center shrink-0">
                <Gamepad2 className="h-5 w-5 text-[#FFD76A]" />
              </div>
            </div>

            <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-400">Games Won</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono-tabular text-emerald-400 mt-1">
                  {playerProfile?.gamesWon ?? 0}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full border border-emerald-400/35 bg-[#031B10] flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-emerald-400" />
              </div>
            </div>

            <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-400">Games Lost</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono-tabular text-neutral-200 mt-1">
                  {playerProfile?.gamesLost ?? 0}
                </p>
              </div>
              <div className="h-11 w-11 rounded-full border border-white/15 bg-[#031B10] flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-neutral-300" />
              </div>
            </div>

            <div className="emerald-card-surface rounded-xl border border-[#D4AF37]/25 p-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-neutral-400">Win Rate</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono-tabular text-[#FFD76A] mt-1">
                  {(playerProfile?.winRate ?? 0).toFixed(1)}%
                </p>
              </div>
              <div className="h-11 w-11 rounded-full border border-[#D4AF37]/45 bg-[#031B10] flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-[#FFD76A]" />
              </div>
            </div>
          </div>
        </section>

        {/* Separate UGX Wallet Card + Available Game Rooms */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4 shadow-[0_14px_30px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-[#FFD76A]">
                <div className="h-9 w-9 rounded-full border border-[#D4AF37]/40 bg-[#063B24] flex items-center justify-center">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-white leading-tight">
                    UGX Wallet
                  </h3>
                  <p className="text-[11px] text-emerald-300 font-medium">
                    MTN &amp; Airtel Mobile Money
                  </p>
                </div>
              </div>
              <Link to="/wallet" className="text-xs font-semibold text-[#FFD76A] hover:underline">
                Manage Wallet
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-[#020A06] px-4 py-3.5">
                <p className="text-[11px] text-neutral-400">Available Balance</p>
                <p className="text-xl font-bold font-mono-tabular text-white mt-0.5">
                  UGX {(wallet?.availableBalance ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#020A06] px-4 py-3.5">
                <p className="text-[11px] text-neutral-400">Pending Withdrawals</p>
                <p className="text-xl font-bold font-mono-tabular text-[#FFD76A] mt-0.5">
                  UGX {(wallet?.pendingBalance ?? 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <Link
                to="/wallet?tab=deposit"
                className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>Deposit</span>
              </Link>
              <Link
                to="/wallet?tab=withdraw"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#063B24]/80 px-4 py-2 text-xs font-semibold text-[#FFD76A] hover:bg-[#094D30]"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Withdraw</span>
              </Link>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#03130B]/80 px-4 py-2 text-xs font-medium text-neutral-200 hover:border-[#D4AF37]/40 hover:text-white"
              >
                <History className="h-3.5 w-3.5" />
                <span>History</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 emerald-card-surface rounded-2xl border border-[#D4AF37]/25 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#D4AF37]" />
                <h3 className="font-display text-lg font-bold text-white">Available Public Game Rooms</h3>
              </div>
              <Link to="/rooms" className="text-xs font-semibold text-[#FFD76A] hover:underline inline-flex items-center gap-1">
                <span>Browse All</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {!isApprovedPlayer ? (
              <div className="rounded-xl border border-white/10 bg-[#03130B]/80 p-5 text-sm text-neutral-400">
                Available multiplayer tables unlock automatically once your identity verification is approved.
              </div>
            ) : rooms.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-[#03130B]/80 p-5 text-sm text-neutral-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span>No open public tables right now. Host a new table or practice against contenders.</span>
                <Link
                  to="/play"
                  className="gold-shimmer-btn rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap shrink-0 text-center"
                >
                  Open Lobby
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {rooms.slice(0, 4).map((r) => (
                  <div key={r.roomId} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{r.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-medium text-[#FFE999]">
                          {r.gameType === 'chess'
                            ? 'Chess'
                            : r.gameType === 'drafts'
                            ? 'Drafts'
                            : r.gameType === 'ludo'
                            ? 'Ludo Master'
                            : 'Matatu'}
                        </span>
                        <span className="text-xs text-neutral-400 truncate">Host: {r.hostName}</span>
                        <div className="flex items-center gap-1" title={`${r.playerCount} of ${r.maxPlayers} seats filled`}>
                          {Array.from({ length: r.maxPlayers }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`h-2.5 w-2.5 rounded-full border ${
                                idx < r.playerCount
                                  ? 'bg-[#FFD76A] border-[#FFD76A]'
                                  : 'bg-transparent border-white/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <Link
                      to={`/game/${r.roomId}`}
                      className="rounded-full border border-[#D4AF37]/50 bg-[#063B24] px-4 py-1.5 text-xs font-semibold text-[#FFD76A] hover:bg-[#094D30] shrink-0"
                    >
                      Join Table
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Game History & Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="emerald-card-surface rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white">Recent Game History</h3>
              <Link to="/game-history" className="text-xs font-semibold text-[#FFD76A] hover:underline">
                View All
              </Link>
            </div>
            {recentGames.length === 0 ? (
              <p className="text-sm text-neutral-400">No completed matches recorded yet.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {recentGames.map((g) => (
                  <div key={g.historyId} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium text-white">
                        {g.winnerUid === firebaseUser?.uid ? 'Victory' : `Winner: ${g.winnerName}`}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {g.mode === 'bot' ? 'Quick Match' : 'Multiplayer'} ·{' '}
                        <span className="font-mono-tabular">{g.durationSeconds}s</span>
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        g.winnerUid === firebaseUser?.uid
                          ? 'border-emerald-400/40 bg-emerald-950/60 text-emerald-300'
                          : 'border-white/15 bg-black/30 text-neutral-300'
                      }`}
                    >
                      {g.winnerUid === firebaseUser?.uid ? 'Won' : 'Finished'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="emerald-card-surface rounded-2xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#D4AF37]" />
                <h3 className="font-display text-lg font-bold text-white">Notifications</h3>
              </div>
              <Link to="/notifications" className="text-xs font-semibold text-[#FFD76A] hover:underline">
                View All
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-neutral-400">No notifications at this time.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map((n) => (
                  <div key={n.notificationId} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{n.title}</span>
                      {!n.read && <span className="text-[#FFD76A] font-medium">Unread</span>}
                    </div>
                    <p className="text-xs text-neutral-300">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PlayerLayout>
  );
};
