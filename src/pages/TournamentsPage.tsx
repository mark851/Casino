import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Crown,
  Play,
  ShieldAlert,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { getStore, subscribeStore } from '../lib/localStore';
import { useAuth } from '../lib/authContext';
import { createLocalRoom } from '../lib/roomFallbackService';
import { PublicLayout } from '../components/PublicLayout';
import { BracketTree } from '../components/BracketTree';
import {
  ensureDailyTournamentsExist,
  generateTournamentBracket,
  linkMatchRoom,
  registerForTournament,
} from '../lib/tournamentService';
import { extractWalletErrorMessage, MIN_TOURNAMENT_ENTRY_UGX } from '../lib/walletService';
import { formatTournamentStartTime, getCountdownLabel } from '../shared/tournamentEngine';
import championshipBannerImg from '../assets/images/uganda_championship_banner_1794598744478.jpg';
import tileArenaCupImg from '../assets/images/tile_arena_cup_1794588653136.jpg';
import tileChessGmImg from '../assets/images/tile_chess_grandmaster_1794588653351.jpg';
import tileUgandaDraftsImg from '../assets/images/tile_uganda_drafts_1794598743312.jpg';
import tileLudoMasterImg from '../assets/images/classic_ludo_master_1794665262485.jpg';
import type {
  TableGameType,
  TournamentMatchRecord,
  TournamentRecord,
} from '../shared/types';

function getTournamentArt(gameType: TableGameType): string {
  if (gameType === 'chess') return tileChessGmImg;
  if (gameType === 'drafts') return tileUgandaDraftsImg;
  if (gameType === 'ludo') return tileLudoMasterImg;
  return tileArenaCupImg;
}

export const TournamentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, userDoc, wallet, isApprovedPlayer } = useAuth();

  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyTournamentId, setBusyTournamentId] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    return subscribeStore(() => setTick((t) => t + 1));
  }, []);

  useEffect(() => {
    if (!isApprovedPlayer || !firebaseUser) return;
    void ensureDailyTournamentsExist(firebaseUser.uid).catch(() => {});
  }, [isApprovedPlayer, firebaseUser]);

  const tournaments = useMemo(() => {
    return Object.values(getStore().tournaments)
      .filter((t) => t.maxPlayers >= 4)
      .sort((a, b) => (b.startTimeIso || '').localeCompare(a.startTimeIso || ''));
  }, []);

  useEffect(() => {
    if (!selectedId && tournaments.length > 0) {
      setSelectedId(tournaments[0].tournamentId);
    }
  }, [selectedId, tournaments]);

  const entries = useMemo(() => {
    if (!selectedId) return [];
    return [...(getStore().tournamentEntries[selectedId] || [])].sort(
      (a, b) => (a.seed || 0) - (b.seed || 0)
    );
  }, [selectedId]);

  const matches = useMemo(() => {
    if (!selectedId) return [];
    return [...(getStore().tournamentMatches[selectedId] || [])].sort(
      (a, b) => (a.roundNumber || 0) - (b.roundNumber || 0)
    );
  }, [selectedId]);

  const selectedTournament = tournaments.find((t) => t.tournamentId === selectedId) || null;
  const isRegisteredInSelected = Boolean(
    firebaseUser && entries.some((e) => e.uid === firebaseUser.uid)
  );

  const handleRegister = async (t: TournamentRecord) => {
    setError('');
    setNotice('');
    if (!firebaseUser || !userDoc || !isApprovedPlayer) {
      setError('Approved 18+ KYC verification is required to enter official tournaments.');
      return;
    }
    setBusyTournamentId(t.tournamentId);
    try {
      const res = await registerForTournament({
        tournament: t,
        uid: firebaseUser.uid,
        playerId: userDoc.playerId,
        displayName: userDoc.fullName || firebaseUser.displayName || 'Contender',
      });
      setSelectedId(t.tournamentId);
      setNotice(
        `Registered for ${t.title}! UGX ${res.entryFeeUgx.toLocaleString()} entry fee debited (Ref: ${res.reference}).`
      );
    } catch (err) {
      setError(extractWalletErrorMessage(err, 'Unable to register.'));
    } finally {
      setBusyTournamentId(null);
    }
  };

  const handleDrawBracket = async (t: TournamentRecord) => {
    setError('');
    setNotice('');
    setBusyTournamentId(t.tournamentId);
    try {
      await generateTournamentBracket(t);
      setNotice(`Single-elimination bracket generated for ${t.title}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to draw bracket.');
    } finally {
      setBusyTournamentId(null);
    }
  };

  const handleLaunchMatch = async (match: TournamentMatchRecord) => {
    if (!selectedTournament || !match.player1Uid || !match.player2Uid || !firebaseUser) return;
    setError('');
    setBusyMatchId(match.matchId);
    try {
      const room = await createLocalRoom({
        roomIdOverride: `tourn_${selectedTournament.tournamentId}_${match.matchId}`,
        hostUid: firebaseUser.uid,
        hostName: userDoc?.fullName || firebaseUser.displayName || 'Contender',
        name: `${selectedTournament.title} · ${match.roundLabel}`,
        isPrivate: true,
        gameType: selectedTournament.gameType,
        mode: 'bot',
        maxPlayers: 2,
        entryFeeUgx: selectedTournament.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX,
        tournamentId: selectedTournament.tournamentId,
        tournamentMatchId: match.matchId,
      });
      await linkMatchRoom({
        tournamentId: selectedTournament.tournamentId,
        matchId: match.matchId,
        roomId: room.roomId,
        roomCode: room.roomCode,
      });
      navigate(`/game/${room.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch match.');
    } finally {
      setBusyMatchId(null);
    }
  };

  return (
    <PublicLayout>
      <div className="hero-arena-bg py-8 px-4 sm:px-8">
        <div className="mx-auto max-w-[1320px] space-y-8">
          {/* Championship Hero Banner */}
          <section className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 min-h-[230px] flex flex-col justify-end shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
            <img
              src={championshipBannerImg}
              alt="CASINO ROYALE Championship Arena"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/35"
            />
            <div className="relative z-10 p-6 sm:p-9 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <p className="text-xs font-bold tracking-[0.22em] text-[#FFD76A] uppercase flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />
                  <span>Daily Single-Elimination Cups</span>
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
                  Kampala National Tournament Brackets
                </h1>
                <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                  Verified 18+ contenders compete nightly in Matatu, Ludo Master, Kampala Chess, and Uganda Drafts. Minimum tournament entry starts at UGX 1,000.
                </p>
              </div>
              {firebaseUser && isApprovedPlayer ? (
                <div className="rounded-xl border border-[#D4AF37]/40 bg-[#04140C]/90 px-4 py-2.5 text-xs shrink-0 space-y-1">
                  <p className="text-neutral-400">Wallet Available</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-sm font-extrabold text-[#FFD76A]">
                      UGX {Number(wallet?.availableBalance ?? 0).toLocaleString()}
                    </span>
                    <Link to="/wallet?tab=deposit" className="text-emerald-400 font-bold hover:underline">
                      Deposit →
                    </Link>
                  </div>
                </div>
              ) : !isApprovedPlayer ? (
                <Link
                  to={firebaseUser ? '/verification-status' : '/register'}
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold whitespace-nowrap shrink-0"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>{firebaseUser ? 'Verify KYC to Compete' : 'Register to Compete'}</span>
                </Link>
              ) : null}
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
          {notice && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200">
              {notice}
            </div>
          )}

          {/* Tournament Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tournaments.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-4 emerald-card-surface rounded-2xl border border-[#D4AF37]/25 p-8 text-center text-sm text-neutral-300">
                Daily Kampala cups open automatically once verified players enter the arena.
              </div>
            ) : (
              tournaments.slice(0, 6).map((t) => {
                const isSelected = selectedId === t.tournamentId;
                return (
                  <div
                    key={t.tournamentId}
                    onClick={() => setSelectedId(t.tournamentId)}
                    className={`group relative overflow-hidden rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#FFD76A] emerald-card-surface shadow-[0_16px_40px_rgba(212,175,55,0.2)]'
                        : 'border-white/10 bg-[#04140C]/90 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <div className="h-32 w-full overflow-hidden relative">
                      <img
                        src={getTournamentArt(t.gameType)}
                        alt={t.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#04140C] via-[#04140C]/45 to-transparent" />
                      <span className="absolute top-3 right-3 text-[11px] font-bold text-[#FFD76A] bg-black/75 px-2.5 py-1 rounded-md border border-[#D4AF37]/40">
                        {t.status}
                      </span>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#FFD76A]">
                          {t.gameType} · {getCountdownLabel(t)}
                        </p>
                        <h2 className="font-display text-lg font-bold text-white mt-0.5 truncate">
                          {t.title}
                        </h2>
                      </div>

                      <div className="flex items-center justify-between text-xs text-neutral-300 font-mono-tabular">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[#D4AF37]" />
                          {formatTournamentStartTime(t.startTimeIso)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-[#D4AF37]" />
                          {t.entryCount}/{t.maxPlayers}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">Entry Fee</span>
                        <span className="font-mono-tabular font-bold text-[#FFD76A]">
                          UGX {(t.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-400 line-clamp-2">{t.prizeSummary}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Bracket View */}
          {selectedTournament && (
            <section className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-5 sm:p-7 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#FFD76A]">
                    <Crown className="h-4 w-4" />
                    <span className="font-bold uppercase tracking-wider">{selectedTournament.gameType} Bracket</span>
                    <span className="text-neutral-500">·</span>
                    <span>{selectedTournament.status}</span>
                    <span className="text-neutral-500">·</span>
                    <span className="font-mono-tabular font-bold text-emerald-400">
                      Entry: UGX {(selectedTournament.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX).toLocaleString()}
                    </span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    {selectedTournament.title}
                  </h2>
                  <p className="text-xs text-neutral-300">{selectedTournament.prizeSummary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {selectedTournament.status === 'Registration Open' &&
                    isApprovedPlayer &&
                    !isRegisteredInSelected && (
                      <button
                        type="button"
                        disabled={busyTournamentId === selectedTournament.tournamentId}
                        onClick={() => void handleRegister(selectedTournament)}
                        className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        <Swords className="h-4 w-4" />
                        <span>
                          Pay UGX {(selectedTournament.entryFeeUgx || MIN_TOURNAMENT_ENTRY_UGX).toLocaleString()} &amp; Enter
                        </span>
                      </button>
                    )}

                  {selectedTournament.status === 'Registration Open' &&
                    isApprovedPlayer &&
                    entries.length >= 2 && (
                      <button
                        type="button"
                        disabled={busyTournamentId === selectedTournament.tournamentId}
                        onClick={() => void handleDrawBracket(selectedTournament)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/60 bg-[#063B24] px-5 py-2.5 text-xs font-bold text-[#FFD76A] hover:bg-[#095333] cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Draw Bracket</span>
                      </button>
                    )}
                </div>
              </div>

              {/* Registered Contenders */}
              {entries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-neutral-300">
                    Seeded Contenders ({entries.length}/{selectedTournament.maxPlayers})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {entries.map((e) => (
                      <span
                        key={e.uid}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#04140C] px-3 py-1.5 text-xs text-white"
                      >
                        <span className="font-mono-tabular text-[#FFD76A] font-bold">#{e.seed}</span>
                        <span>{e.displayName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <BracketTree
                matches={matches}
                currentUid={firebaseUser?.uid}
                busyMatchId={busyMatchId}
                onLaunchMatch={handleLaunchMatch}
              />
            </section>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};
