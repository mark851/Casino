import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  Gamepad2,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  Zap,
  BarChart3,
  Star,
  ArrowRight,
  Swords,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { getStore, subscribeStore } from '../lib/localStore';
import { isPresenceOnline } from '../lib/socialService';
import { HeroCenterpiece } from '../components/HeroCenterpiece';
import { PlayingCard } from '../components/PlayingCard';
import heroTableBg from '../assets/images/hero_matatu_table_1794421555126.jpg';
import crownCrestImg from '../assets/images/matatu_crown_crest_1794421555026.jpg';
import kampalaPlayersImg from '../assets/images/kampala_players_showcase_1794598743984.jpg';
import championshipBannerImg from '../assets/images/uganda_championship_banner_1794598744478.jpg';
import ugandaEmblemImg from '../assets/images/uganda_flag_emblem_1794598745119.jpg';
import cardBackImg from '../assets/images/card_back_pattern_1794421555249.jpg';
import tileMatatuRoyaleImg from '../assets/images/tile_matatu_royale_1794598741250.jpg';
import tileMatatuBlitzImg from '../assets/images/tile_matatu_blitz_1794598742191.jpg';
import tilePawaChessImg from '../assets/images/tile_pawa_chess_1794598741991.jpg';
import tileUgandaDraftsImg from '../assets/images/tile_uganda_drafts_1794598743312.jpg';
import tileArenaCupImg from '../assets/images/tile_arena_cup_1794588653136.jpg';
import tileChessGmImg from '../assets/images/tile_chess_grandmaster_1794588653351.jpg';
import tileLudoMasterImg from '../assets/images/classic_ludo_master_1794665262485.jpg';
import type { PlayerProfile } from '../shared/types';

interface PublicEngineStats {
  onlinePlayers: number;
  activeRooms: number;
  activeGames: number;
}

const ARENA_TILES = [
  {
    id: 'matatu-royale',
    title: 'Matatu Royale',
    subtitle: 'Classic 52-Card Ugandan Shedding',
    image: tileMatatuRoyaleImg,
    to: '/play',
    accent: 'border-[#D4AF37]/50 hover:border-[#FFD76A]',
  },
  {
    id: 'matatu-blitz',
    title: 'Matatu Blitz',
    subtitle: 'Stacking +2 · 7♦ Cut · Fast Turns',
    image: tileMatatuBlitzImg,
    to: '/play',
    accent: 'border-[#9CE800]/40 hover:border-[#9CE800]',
  },
  {
    id: 'pawa-chess',
    title: 'Kampala Chess',
    subtitle: '1v1 & Grandmaster Contenders Arena',
    image: tilePawaChessImg,
    to: '/play',
    accent: 'border-emerald-500/40 hover:border-emerald-400',
  },
  {
    id: 'uganda-drafts',
    title: 'Uganda Drafts',
    subtitle: 'Flying Kings & Mandatory Jumps',
    image: tileUgandaDraftsImg,
    to: '/play',
    accent: 'border-amber-500/40 hover:border-amber-400',
  },
  {
    id: 'ludo-master',
    title: 'Ludo Master',
    subtitle: 'Classic Dice Race · 2-Button Blockades',
    image: tileLudoMasterImg,
    to: '/play',
    accent: 'border-sky-500/40 hover:border-sky-400',
  },
  {
    id: 'arena-cup',
    title: 'Daily Royal Cup',
    subtitle: 'Single-Elimination Brackets',
    image: tileArenaCupImg,
    to: '/tournaments',
    accent: 'border-[#D4AF37]/50 hover:border-[#FFD76A]',
  },
  {
    id: 'chess-gm',
    title: 'Grandmaster Duel',
    subtitle: 'Verified National Standings',
    image: tileChessGmImg,
    to: '/tournaments',
    accent: 'border-red-500/40 hover:border-red-400',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    firebaseUser,
    userDoc,
    playerProfile,
    isApprovedPlayer,
    signInWithEmail,
    signInWithGoogle,
    signInDemoPlayer,
    sendPasswordReset,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const [topPlayers, setTopPlayers] = useState<PlayerProfile[]>([]);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [liveStats, setLiveStats] = useState<PublicEngineStats>({
    onlinePlayers: 0,
    activeRooms: 0,
    activeGames: 0,
  });

  useEffect(() => {
    const syncFromStore = () => {
      const s = getStore();
      const list = Object.values(s.playerProfiles).sort(
        (a, b) => (b.gamesWon || 0) - (a.gamesWon || 0) || (b.winRate || 0) - (a.winRate || 0)
      );
      setTopPlayers(list.slice(0, 4));
      setTotalRegistered(list.length);
      setTotalWins(list.reduce((sum, p) => sum + (p.gamesWon || 0), 0));

      const now = Date.now();
      const onlineHumanEntries = Object.values(s.presence).filter((p) => isPresenceOnline(p, now));
      const onlineNames = new Set(
        onlineHumanEntries.map((p) => p.displayName.trim().toLowerCase())
      );
      const additionalVirtualOnline = s.aiConfig.aiEnabled
        ? s.aiConfig.roster.filter(
            (p) => p.enabled && !onlineNames.has(p.name.trim().toLowerCase())
          ).length
        : 0;
      const rooms = Object.values(s.rooms).filter((r) => r.status !== 'completed');
      setLiveStats({
        onlinePlayers: onlineHumanEntries.length + additionalVirtualOnline,
        activeRooms: rooms.length,
        activeGames: rooms.filter((r) => r.status === 'in_progress').length,
      });
    };

    syncFromStore();
    return subscribeStore(syncFromStore);
  }, []);

  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setResetMessage('');
    if (!email.trim() || !password) {
      setLoginError('Enter your email address and password.');
      return;
    }
    setLoginBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleDemoSignIn = async () => {
    setLoginError('');
    setResetMessage('');
    setLoginBusy(true);
    try {
      await signInDemoPlayer();
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError('');
    setResetMessage('');
    setLoginBusy(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoginError('');
    setResetMessage('');
    if (!email.trim()) {
      setLoginError('Enter your account email above to receive a password reset link.');
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      setResetMessage('Password reset instructions prepared for your account email.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Unable to process reset.');
    }
  };

  const podiumRows = [0, 1, 2, 3].map((idx) => topPlayers[idx] || null);

  return (
    <div className="bg-[#050806] text-white">
      {/* 1. Primary Obsidian-Emerald Hero Arena */}
      <section className="relative overflow-hidden border-b border-[#D4AF37]/25 hero-arena-bg">
        {/* Background Table Texture */}
        <img
          src={heroTableBg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-lighten"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020E08]/92 via-[#041D12]/65 to-[#020A06]/92"
        />
        {/* Ugandan Flag Left Edge Accent Ribbon */}
        <div
          aria-hidden="true"
          className="pointer-events-none hidden sm:flex flex-col absolute left-0 top-10 bottom-10 w-2 opacity-85 shadow-[0_0_24px_rgba(255,215,106,0.25)]"
        >
          <span className="flex-1 bg-black" />
          <span className="flex-1 bg-[#FCDC04]" />
          <span className="flex-1 bg-[#D90000]" />
          <span className="flex-1 bg-black" />
          <span className="flex-1 bg-[#FCDC04]" />
          <span className="flex-1 bg-[#D90000]" />
        </div>

        <div className="relative mx-auto max-w-[1400px] px-4 sm:px-8 py-8 lg:py-11">
          <div className="grid grid-cols-1 lg:grid-cols-[1.08fr_1.1fr_0.92fr] gap-8 items-center">
            {/* Left Proposition Column */}
            <div className="space-y-5 text-center lg:text-left">
              <div className="space-y-2">
                <h1 className="font-casino text-4xl sm:text-5xl xl:text-[3.4rem] font-extrabold tracking-[0.04em] gold-text-gradient uppercase leading-[0.98] text-balance">
                  CASINO ROYALE
                </h1>
                <p className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight text-balance">
                  Play. <span className="italic text-[#FFD76A]">Win.</span> Rise.
                </p>
              </div>

              <p className="text-sm sm:text-base text-neutral-200 italic leading-relaxed max-w-xl mx-auto lg:mx-0">
                Uganda&apos;s premier Matatu, Ludo, Chess &amp; Drafts club! Compete for real UGX stakes, deposit via Mobile Money &amp; climb national standings —{' '}
                <span className="text-[#FFD76A] font-semibold not-italic">
                  Instant UGX Deposits &amp; Verified Payouts.
                </span>
              </p>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-1">
                <Link
                  to={firebaseUser ? '/play' : '/register'}
                  className="gold-shimmer-btn inline-flex items-center gap-2.5 rounded-full px-8 py-3.5 text-sm sm:text-base font-extrabold tracking-wide uppercase transition-transform hover:scale-[1.02] whitespace-nowrap"
                >
                  <span>PLAY NOW</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/tournaments"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/50 bg-[#052315]/85 px-5 py-3.5 text-xs sm:text-sm font-semibold text-[#FFD76A] hover:bg-[#093D25] transition-colors whitespace-nowrap"
                >
                  <Trophy className="h-4 w-4" />
                  <span>Daily Cups</span>
                </Link>
              </div>

              {/* Trust Markers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-[11px] sm:text-xs text-neutral-200 max-w-xl mx-auto lg:mx-0">
                <div className="flex items-center justify-center lg:justify-start gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#FFD76A] shrink-0" />
                  <span>Secure &amp; Trusted</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-1.5">
                  <Zap className="h-4 w-4 text-[#FFD76A] shrink-0" />
                  <span>Instant Play</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-1.5">
                  <Smartphone className="h-4 w-4 text-[#FFD76A] shrink-0" />
                  <span>Mobile Friendly</span>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-1.5">
                  <Trophy className="h-4 w-4 text-[#FFD76A] shrink-0" />
                  <span>Fair Standings</span>
                </div>
              </div>
            </div>

            {/* Centerpiece Royal Hand & Crown */}
            <div className="flex justify-center">
              <HeroCenterpiece />
            </div>

            {/* Right Login / Authenticated Player Card */}
            <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/45 p-5 sm:p-6">
              {firebaseUser ? (
                <div className="space-y-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#FFD76A]">
                    <Crown className="h-5 w-5" />
                    <h2 className="font-display text-xl font-bold">Welcome Back!</h2>
                  </div>
                  <p className="text-xs text-neutral-300">
                    Signed in as{' '}
                    <span className="text-white font-semibold">
                      {userDoc?.fullName || firebaseUser.displayName || firebaseUser.email}
                    </span>
                  </p>
                  <div className="rounded-xl border border-white/10 bg-[#04180F] p-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[11px] text-neutral-400">Matches</p>
                      <p className="font-mono-tabular text-base font-bold text-[#FFD76A]">
                        {playerProfile?.totalGames ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400">Wins</p>
                      <p className="font-mono-tabular text-base font-bold text-white">
                        {playerProfile?.gamesWon ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-neutral-400">KYC</p>
                      <p
                        className={`text-xs font-bold mt-1 ${
                          isApprovedPlayer ? 'text-emerald-400' : 'text-[#FFD76A]'
                        }`}
                      >
                        {userDoc?.kycStatus || 'Pending'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2.5 pt-1">
                    <Link
                      to={isApprovedPlayer ? '/play' : '/verification-status'}
                      className="gold-shimmer-btn w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      <span>{isApprovedPlayer ? 'Enter Live Tables' : 'Complete Verification'}</span>
                    </Link>
                    <Link
                      to="/dashboard"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37]/45 bg-[#06321D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#094729] transition-colors"
                    >
                      <span>Open Player Dashboard</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleQuickLogin} className="space-y-3.5">
                  <div className="text-center space-y-1">
                    <h2 className="font-display text-xl font-bold text-[#FFD76A] flex items-center justify-center gap-2">
                      <Crown className="h-4 w-4" />
                      <span>Welcome Back!</span>
                    </h2>
                    <p className="text-xs text-neutral-300">Login to continue playing</p>
                  </div>

                  {loginError && (
                    <div className="rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
                      {loginError}
                    </div>
                  )}
                  {resetMessage && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-xs text-emerald-200">
                      {resetMessage}
                    </div>
                  )}

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address"
                      autoComplete="email"
                      className="w-full rounded-lg border border-white/15 bg-[#05140D] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-neutral-400 focus:border-[#FFD76A] focus:outline-none"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-white/15 bg-[#05140D] pl-10 pr-10 py-2.5 text-sm text-white placeholder-neutral-400 focus:border-[#FFD76A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#FFD76A] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loginBusy}
                    className="gold-shimmer-btn w-full rounded-full py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
                  >
                    {loginBusy ? 'Signing In…' : 'Login'}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-[#FFD76A] hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                    <span className="h-[1px] flex-1 bg-white/15" />
                    <span>or</span>
                    <span className="h-[1px] flex-1 bg-white/15" />
                  </div>

                  <Link
                    to="/register"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-[#D4AF37]/50 bg-[#06351F] py-2.5 text-sm font-semibold text-white hover:bg-[#0A4D2D] transition-colors"
                  >
                    <span>Create Account</span>
                  </Link>

                  <button
                    type="button"
                    disabled={loginBusy}
                    onClick={handleDemoSignIn}
                    className="w-full rounded-full border border-emerald-500/35 bg-[#041D12] py-2 text-xs font-semibold text-emerald-300 hover:text-[#FFD76A] transition-colors cursor-pointer"
                  >
                    Quick Demo Player Sign-In
                  </button>

                  <button
                    type="button"
                    disabled={loginBusy}
                    onClick={handleGoogleSignIn}
                    className="w-full text-center text-xs font-medium text-neutral-200 hover:text-[#FFD76A] py-1 transition-colors cursor-pointer"
                  >
                    Continue with Instant Member Profile
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Five-Column Platform Feature Strip */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Link
            to="/play"
            className="emerald-card-surface group rounded-xl border border-[#D4AF37]/30 hover:border-[#FFD76A] p-4 flex flex-col items-center text-center transition-all"
          >
            <div className="flex items-center -space-x-3 mb-2.5">
              <div className="-rotate-12 scale-90">
                <PlayingCard card={{ id: 'strip_7h', rank: '7', suit: 'hearts' }} size="xs" />
              </div>
              <div className="rotate-6 scale-90">
                <PlayingCard card={{ id: 'strip_as', rank: 'A', suit: 'spades' }} size="xs" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-[#FFD76A] group-hover:text-white transition-colors">
              Matatu Game
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">Classic &amp; Exciting</p>
          </Link>

          <Link
            to="/play"
            className="emerald-card-surface group rounded-xl border border-[#D4AF37]/30 hover:border-[#FFD76A] p-4 flex flex-col items-center justify-center text-center transition-all"
          >
            <Users className="h-8 w-8 text-[#FFD76A] mb-2.5 group-hover:scale-105 transition-transform" />
            <h3 className="text-sm font-bold text-[#FFD76A] group-hover:text-white transition-colors">
              Multiplayer
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">Play with Players Online</p>
          </Link>

          <Link
            to="/wallet"
            className="emerald-card-surface group rounded-xl border border-[#D4AF37]/30 hover:border-[#FFD76A] p-4 flex flex-col items-center justify-center text-center transition-all"
          >
            <Wallet className="h-8 w-8 text-[#FFD76A] mb-2.5 group-hover:scale-105 transition-transform" />
            <h3 className="text-sm font-bold text-[#FFD76A] group-hover:text-white transition-colors">
              UGX Wallet
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">MTN &amp; Airtel Mobile Money</p>
          </Link>

          <Link
            to="/leaderboard"
            className="emerald-card-surface group rounded-xl border border-[#D4AF37]/30 hover:border-[#FFD76A] p-4 flex flex-col items-center justify-center text-center transition-all"
          >
            <Trophy className="h-8 w-8 text-[#FFD76A] mb-2.5 group-hover:scale-105 transition-transform" />
            <h3 className="text-sm font-bold text-[#FFD76A] group-hover:text-white transition-colors">
              Leaderboards
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">Top Players &amp; Win Rates</p>
          </Link>

          <Link
            to="/support"
            className="col-span-2 sm:col-span-1 emerald-card-surface group rounded-xl border border-[#D4AF37]/30 hover:border-[#FFD76A] p-4 flex flex-col items-center justify-center text-center transition-all"
          >
            <Headphones className="h-8 w-8 text-[#FFD76A] mb-2.5 group-hover:scale-105 transition-transform" />
            <h3 className="text-sm font-bold text-[#FFD76A] group-hover:text-white transition-colors">
              24/7 Support
            </h3>
            <p className="text-[11px] text-neutral-300 mt-0.5">We&apos;re Always Here</p>
          </Link>
        </div>
      </section>

      {/* 3. Rich Bespoke Arena Game Tiles Gallery */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.2em] text-[#FFD76A] uppercase">
              Kampala Championship Tables
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
              Featured Arena Modes &amp; Cups
            </h2>
          </div>
          <Link
            to="/play"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFD76A] hover:text-white transition-colors whitespace-nowrap"
          >
            <span>Explore All Tables</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
          {ARENA_TILES.map((tile) => (
            <Link
              key={tile.id}
              to={tile.to}
              className={`group relative overflow-hidden rounded-2xl border ${tile.accent} bg-[#0B120E] transition-all hover:-translate-y-0.5 shadow-[0_14px_30px_rgba(0,0,0,0.7)]`}
            >
              <div className="aspect-square w-full overflow-hidden">
                <img
                  src={tile.image}
                  alt={tile.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-3 pt-8">
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#FFD76A] transition-colors truncate">
                  {tile.title}
                </h3>
                <p className="text-[10px] text-neutral-300 truncate mt-0.5">{tile.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Three-Column How to Play / Live Stats / Top Players */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* How to Play */}
          <div className="relative overflow-hidden emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 sm:p-6 flex flex-col justify-between">
            <img
              src={crownCrestImg}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-2 bottom-2 h-36 w-36 rounded-full object-cover opacity-15"
            />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-[#FFD76A]" />
                  <span>How to Play</span>
                </h3>
                <span className="text-xs text-neutral-400">Official Rules</span>
              </div>

              <div className="flex items-end justify-between gap-4">
                <ol className="space-y-2.5 text-xs sm:text-sm text-neutral-200">
                  {[
                    'Register or Login to your account',
                    'Complete 18+ KYC identity verification',
                    'Deposit via Mobile Money (Min UGX 1,000)',
                    'Enter any table or cup (Min UGX 1,000) to win',
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[11px] font-extrabold text-[#050806]">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="hidden sm:flex items-center -space-x-5 shrink-0 pr-1" aria-hidden="true">
                  <div className="-rotate-12">
                    <PlayingCard card={{ id: 'htp_7h', rank: '7', suit: 'hearts' }} size="sm" />
                  </div>
                  <div className="rotate-6">
                    <PlayingCard card={{ id: 'htp_as', rank: 'A', suit: 'spades' }} size="sm" />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 pt-4">
              <Link
                to="/how-to-play"
                className="gold-shimmer-btn inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold"
              >
                <span>Learn More</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Live Stats */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#FFD76A]" />
                <span>Live Stats</span>
              </h3>
              <span className="text-xs text-neutral-400">Real-Time Platform</span>
            </div>

            <div className="grid grid-cols-3 gap-3 py-5 text-center">
              <div>
                <Users className="h-5 w-5 text-[#FFD76A] mx-auto mb-1.5" />
                <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#FFD76A]">
                  {totalRegistered}
                </p>
                <p className="text-[11px] text-neutral-300 mt-1">Registered Players</p>
              </div>
              <div>
                <Gamepad2 className="h-5 w-5 text-[#FFD76A] mx-auto mb-1.5" />
                <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#FFD76A]">
                  {totalWins}
                </p>
                <p className="text-[11px] text-neutral-300 mt-1">Verified Wins</p>
              </div>
              <div>
                <Trophy className="h-5 w-5 text-[#FFD76A] mx-auto mb-1.5" />
                <p className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-[#FFD76A]">
                  {liveStats.activeRooms}
                </p>
                <p className="text-[11px] text-neutral-300 mt-1">Active Tables</p>
              </div>
            </div>

            <div className="rounded-full border border-emerald-500/35 bg-[#042314] px-4 py-2 text-center text-xs font-medium text-emerald-300 font-mono-tabular">
              Online Now: {liveStats.onlinePlayers} Players · {liveStats.activeRooms} Active Tables
            </div>
          </div>

          {/* Top Players */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#FFD76A]" />
                <span>Top Players</span>
              </h3>
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FFD76A] hover:text-white"
              >
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-white/10">
              {podiumRows.map((player, idx) => {
                if (!player) {
                  return (
                    <div key={idx} className="flex items-center justify-between py-2.5 text-xs">
                      <div className="flex items-center gap-2.5 text-neutral-500">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[11px] font-mono-tabular">
                          {idx + 1}
                        </span>
                        <span>Open Championship Seat</span>
                      </div>
                      <span className="text-neutral-500">Play to Rank</span>
                    </div>
                  );
                }
                const initial = player.displayName.trim().slice(0, 1).toUpperCase() || 'M';
                return (
                  <div key={player.uid} className="flex items-center justify-between py-2.5 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#FFD76A]/60 bg-[#063B24] text-[11px] font-bold text-[#FFD76A]">
                        {initial}
                      </span>
                      <span className="font-semibold text-white truncate">
                        #{idx + 1} {player.displayName}
                      </span>
                    </div>
                    <span className="font-mono-tabular font-bold text-emerald-400 shrink-0">
                      {player.gamesWon} Wins · {Math.round(player.winRate || 0)}% Win
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Kampala Visual Culture, Championship Banner & Card Craft Showcase */}
      <section className="mx-auto max-w-[1400px] px-4 sm:px-8 pt-2 pb-10 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 items-stretch">
          {/* Championship Arena Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-[#04140C] min-h-[260px] flex flex-col justify-end shadow-[0_20px_48px_rgba(0,0,0,0.8)]">
            <img
              src={championshipBannerImg}
              alt="CASINO ROYALE Championship Arena Cup"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent"
            />
            <div className="relative z-10 p-6 sm:p-8 space-y-2.5">
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#FFD76A] uppercase flex items-center gap-1.5">
                <Swords className="h-3.5 w-3.5" />
                <span>National Knock-Out Cups</span>
              </p>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-white text-balance">
                Daily Kampala Royal Cups &amp; Live Brackets
              </h3>
              <p className="text-xs sm:text-sm text-neutral-200 max-w-lg leading-relaxed">
                Compete in automated single-elimination tournaments across Matatu, Ludo Master, Kampala Chess, and Uganda Drafts for cash prizes, Royal Cup titles, and verified rankings.
              </p>
              <div className="pt-1">
                <Link
                  to="/tournaments"
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>View Live Brackets</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Kampala Social Lounge Visual Card */}
          <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-[#04140C] min-h-[260px] flex flex-col justify-end shadow-[0_20px_48px_rgba(0,0,0,0.8)]">
            <img
              src={kampalaPlayersImg}
              alt="Ugandan friends playing Matatu cards at a Kampala lounge table"
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent"
            />
            <div className="relative z-10 p-6 sm:p-8 space-y-2.5">
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#9CE800] uppercase flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Kampala Lounge Craft</span>
              </p>
              <h3 className="font-display text-2xl font-bold text-white text-balance">
                Authentic Local Rules, Verified Fair Play
              </h3>
              <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed">
                Create invite-only private tables with your 6-character code or challenge tactical contenders in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Ugandan Heritage Emblem & Custom Deck Craft Strip */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-5 sm:p-7 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-6">
          <div className="flex items-center gap-4">
            <img
              src={ugandaEmblemImg}
              alt="Ugandan Heritage Crested Crane Emblem"
              className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border border-[#FFD76A]/60 object-cover shadow-[0_10px_28px_rgba(212,175,55,0.28)] shrink-0"
              referrerPolicy="no-referrer"
            />
            <img
              src={cardBackImg}
              alt="CASINO ROYALE Custom Luxury Card Back"
              className="h-20 w-14 sm:h-24 sm:w-18 rounded-xl border border-[#FFD76A]/55 object-cover shadow-lg shrink-0"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold tracking-[0.18em] text-[#FFD76A] uppercase">
              Heritage &amp; Governance
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
              Built for Uganda&apos;s Card &amp; Board Game Community
            </h3>
            <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-2xl">
              Every player completes 18+ KYC verification, every deck shuffle is rule-enforced, and audited Mobile Money banking keeps deposits, stakes, and payouts secure across Uganda.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              to="/register"
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs sm:text-sm font-bold whitespace-nowrap"
            >
              <span>Join Now</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
