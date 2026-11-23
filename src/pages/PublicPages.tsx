import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Crown,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { fetchApiJson, getApiAuthToken } from '../lib/apiClient';
import { useAuth } from '../lib/authContext';
import { getStore, notifyStore, subscribeStore } from '../lib/localStore';
import { PlayingCard } from '../components/PlayingCard';
import { clampStr } from '../utils/validation';
import kampalaPlayersImg from '../assets/images/kampala_players_showcase_1794598743984.jpg';
import ugandaEmblemImg from '../assets/images/uganda_flag_emblem_1794598745119.jpg';
import tileArenaCupImg from '../assets/images/tile_arena_cup_1794588653136.jpg';
import cardBackImg from '../assets/images/card_back_pattern_1794421555249.jpg';
import type { AnnouncementRecord, PlayerProfile, SupportTicketRecord } from '../shared/types';

export const HowToPlayPage: React.FC = () => {
  const { systemSettings } = useAuth();
  const rules = systemSettings.matatuRules;

  return (
    <div className="hero-arena-bg py-10 px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        {/* Header with Kampala Showcase Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6 items-center">
          <div className="space-y-2.5">
            <p className="text-xs font-bold tracking-[0.22em] text-[#FFD76A] uppercase">
              Official Rulebook
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold text-white text-balance">
              How to Play Ugandan Matatu
            </h1>
            <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
              Matatu is Uganda&apos;s beloved shedding card game played with a standard 52-card deck. The goal is simple: be the first player to empty your hand while navigating tactical power cards.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 shadow-[0_20px_48px_rgba(0,0,0,0.8)] aspect-[16/9]">
            <img
              src={kampalaPlayersImg}
              alt="Ugandan Matatu table gameplay in Kampala"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
        </div>

        {/* 3 Core Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: 'Step 01',
              title: 'The Deal',
              body: `Each player is dealt ${rules.initialHandSize} cards. One neutral starter card is placed face-up in the center battle zone.`,
            },
            {
              step: 'Step 02',
              title: 'Matching Suit or Rank',
              body: 'On your turn, play a card matching either the active suit or the rank of the top card, or draw one card from the deck if you have no valid play.',
            },
            {
              step: 'Step 03',
              title: 'Calling Last Card',
              body: 'When down to your final cards, signal "Last Card!" and shed your final card (must be a non-special card).',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-2"
            >
              <p className="text-xs font-bold text-[#FFD76A]">{item.step}</p>
              <h2 className="font-display text-xl font-bold text-white">{item.title}</h2>
              <p className="text-sm text-neutral-300 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {/* Active Power Card Configuration */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/35 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <h2 className="font-display text-2xl font-bold text-white">
              Active Platform Power Card Configuration
            </h2>
            <div className="flex items-center gap-3">
              <img
                src={cardBackImg}
                alt="CASINO ROYALE Card Back"
                className="h-12 w-9 rounded border border-[#D4AF37]/50 object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs text-[#FFD76A] font-medium">Official Matatu Ruleset</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_2s', rank: '2', suit: 'spades' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Two (Draw +2)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Next player draws 2 cards.{' '}
                  {rules.allowStackingTwos
                    ? 'Stacking is active: playing another 2 passes +4/+6 forward.'
                    : 'Stacking is currently disabled.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_7d', rank: '7', suit: 'diamonds' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Seven of Diamonds (Matatu Cutter)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  {rules.sevenOfDiamondsCutter
                    ? 'Active: Can be played to cut and neutralize a pending Draw-2 penalty.'
                    : 'Standard 7 of Diamonds match.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_jh', rank: 'J', suit: 'hearts' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Jack (Skip Turn)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Skips the next player in turn order (grants another turn in 2-player duels).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_8c', rank: '8', suit: 'clubs' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Eight (Play Again)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Grants you another immediate turn to follow up.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_kd', rank: 'K', suit: 'diamonds' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">King (Reverse)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Reverses play direction in 3-4 player tables and skips in 2-player tables.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <PlayingCard card={{ id: 'rule_as', rank: 'A', suit: 'spades' }} size="sm" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Ace (Wild Suit Selector)</h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                  Playable on any non-penalty turn to declare the next active suit.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-neutral-400">
              Ready to play? Verification takes only minutes and unlocks multiplayer rooms &amp; daily cups.
            </p>
            <Link
              to="/play"
              className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold"
            >
              <span>Enter Matatu Lobby</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LeaderboardPage: React.FC = () => {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const sync = () => {
      const sorted = Object.values(getStore().playerProfiles).sort(
        (a, b) => (b.gamesWon || 0) - (a.gamesWon || 0) || (b.winRate || 0) - (a.winRate || 0)
      );
      setPlayers(sorted);
    };
    sync();
    return subscribeStore(sync);
  }, []);

  const filtered = players.filter((p) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      p.displayName.toLowerCase().includes(term) ||
      p.playerId.toLowerCase().includes(term)
    );
  });

  const first = players[0] || null;
  const second = players[1] || null;
  const third = players[2] || null;

  return (
    <div className="hero-arena-bg py-10 px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] space-y-8">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <img
              src={ugandaEmblemImg}
              alt="National Leaderboard Crest"
              className="hidden sm:block h-16 w-16 rounded-2xl border border-[#FFD76A]/60 object-cover shadow-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase">
                Official Standings
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
                National Matatu Leaderboard
              </h1>
              <p className="text-sm text-neutral-300 mt-1">
                Live verified rankings synced directly from completed arena matches.
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D4AF37]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or Player ID..."
              className="w-full rounded-full border border-[#D4AF37]/35 bg-[#04180F] pl-10 pr-4 py-2.5 text-sm text-white placeholder-neutral-400 focus:border-[#FFD76A] focus:outline-none"
            />
          </div>
        </div>

        {/* 3-Seat Podium */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
          {/* 2nd Place */}
          <div className="order-2 md:order-1 emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 text-center space-y-3">
            <p className="text-xs font-bold tracking-wider text-neutral-300 uppercase flex items-center justify-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-neutral-300" />
              <span>2nd Place</span>
            </p>
            <div className="h-14 w-14 mx-auto rounded-full border-2 border-neutral-400/70 bg-[#052315] flex items-center justify-center font-display text-xl font-bold text-white">
              {second ? second.displayName.slice(0, 1).toUpperCase() : '2'}
            </div>
            {second ? (
              <>
                <h2 className="font-display text-lg font-bold text-white">{second.displayName}</h2>
                <p className="text-xs font-mono-tabular text-neutral-400">{second.playerId}</p>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#04130B] p-3 text-xs">
                  <div>
                    <p className="text-neutral-400">Matches</p>
                    <p className="font-mono-tabular font-bold text-[#FFD76A]">{second.totalGames}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400">Wins</p>
                    <p className="font-mono-tabular font-bold text-white">{second.gamesWon}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400">Win %</p>
                    <p className="font-mono-tabular font-bold text-emerald-400">{Math.round(second.winRate)}%</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-lg font-bold text-white">Open Podium Seat</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Complete verified Matatu matches to claim rank #2 on the national board.
                </p>
              </>
            )}
          </div>

          {/* 1st Place */}
          <div className="order-1 md:order-2 relative overflow-hidden emerald-card-surface rounded-2xl border-2 border-[#FFD76A]/80 p-7 text-center space-y-3.5 shadow-[0_20px_50px_rgba(212,175,55,0.2)]">
            <img
              src={tileArenaCupImg}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
            />
            <div className="relative z-10 space-y-3">
              <p className="text-xs font-bold tracking-wider text-[#FFD76A] uppercase flex items-center justify-center gap-1.5">
                <Crown className="h-4 w-4" />
                <span>National Leader</span>
              </p>
              <div className="h-16 w-16 mx-auto rounded-full border-2 border-[#FFD76A] bg-[#063B24] flex items-center justify-center font-display text-2xl font-bold text-[#FFD76A] shadow-[0_0_24px_rgba(255,215,106,0.35)]">
                {first ? first.displayName.slice(0, 1).toUpperCase() : '1'}
              </div>
              {first ? (
                <>
                  <h2 className="font-display text-xl font-bold text-white">{first.displayName}</h2>
                  <p className="text-xs font-mono-tabular text-neutral-300">{first.playerId}</p>
                  <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#03140C]/90 p-3 text-xs">
                    <div>
                      <p className="text-neutral-400">Matches</p>
                      <p className="font-mono-tabular font-bold text-[#FFD76A]">{first.totalGames}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Wins</p>
                      <p className="font-mono-tabular font-bold text-white">{first.gamesWon}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400">Win %</p>
                      <p className="font-mono-tabular font-bold text-emerald-400">{Math.round(first.winRate)}%</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold text-white">Open National Crown</h2>
                  <p className="text-xs text-neutral-300">Win ranked matches to claim the #1 seat.</p>
                </>
              )}
            </div>
          </div>

          {/* 3rd Place */}
          <div className="order-3 emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 text-center space-y-3">
            <p className="text-xs font-bold tracking-wider text-[#D4AF37] uppercase flex items-center justify-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              <span>3rd Place</span>
            </p>
            <div className="h-14 w-14 mx-auto rounded-full border-2 border-[#D4AF37]/80 bg-[#052315] flex items-center justify-center font-display text-xl font-bold text-[#FFD76A]">
              {third ? third.displayName.slice(0, 1).toUpperCase() : '3'}
            </div>
            {third ? (
              <>
                <h2 className="font-display text-lg font-bold text-white">{third.displayName}</h2>
                <p className="text-xs font-mono-tabular text-neutral-400">{third.playerId}</p>
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#04130B] p-3 text-xs">
                  <div>
                    <p className="text-neutral-400">Matches</p>
                    <p className="font-mono-tabular font-bold text-[#FFD76A]">{third.totalGames}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400">Wins</p>
                    <p className="font-mono-tabular font-bold text-white">{third.gamesWon}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400">Win %</p>
                    <p className="font-mono-tabular font-bold text-emerald-400">{Math.round(third.winRate)}%</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-lg font-bold text-white">Open Podium Seat</h2>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Complete verified Matatu matches to claim rank #3 on the national board.
                </p>
              </>
            )}
          </div>
        </div>

        {/* Full Standings Table */}
        <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/25 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-[#03140B] text-xs text-neutral-400">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Rank</th>
                  <th className="px-5 py-3.5 font-medium">Player</th>
                  <th className="px-5 py-3.5 font-medium">Player ID</th>
                  <th className="px-5 py-3.5 font-medium text-right">Games</th>
                  <th className="px-5 py-3.5 font-medium text-right">Won</th>
                  <th className="px-5 py-3.5 font-medium text-right">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-neutral-400 text-xs">
                      No matching players found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr key={p.uid} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3.5 font-mono-tabular font-bold text-[#FFD76A]">
                        #{idx + 1}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#D4AF37]/50 bg-[#063B24] text-xs font-bold text-[#FFD76A]">
                            {p.displayName.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="font-semibold text-white">{p.displayName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono-tabular text-xs text-neutral-400">
                        {p.playerId}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-neutral-200">
                        {p.totalGames}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-neutral-200">
                        {p.gamesWon}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-tabular text-emerald-400">
                        {p.winRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SupportPage: React.FC = () => {
  const { firebaseUser, userDoc, systemSettings } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketRecord['category']>('General Support');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const sync = () => {
      const s = getStore();
      setAnnouncements(
        Object.values(s.announcements)
          .filter((a) => a.published || a.active)
          .slice(0, 10)
      );
      if (firebaseUser) {
        setTickets(
          Object.values(s.supportTickets)
            .filter((t) => t.uid === firebaseUser.uid)
            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
            .slice(0, 20)
        );
      } else {
        setTickets([]);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [firebaseUser]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    if (!firebaseUser || !userDoc) {
      setError('Please sign in first to submit a tracked support ticket.');
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 10) {
      setError('Provide a brief subject and a detailed description (min 10 characters).');
      return;
    }
    setBusy(true);
    try {
      const s = getStore();
      if (getApiAuthToken()) {
        const res = await fetchApiJson<{ ticket: SupportTicketRecord }>('/api/support/tickets', {
          method: 'POST',
          body: JSON.stringify({
            subject: clampStr(subject, 120),
            category,
            message: clampStr(message, 1500),
          }),
        });
        if (res.ticket) {
          s.supportTickets[res.ticket.ticketId] = res.ticket;
        }
      } else {
        const ticketId = `tkt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        s.supportTickets[ticketId] = {
          ticketId,
          uid: firebaseUser.uid,
          playerId: userDoc.playerId,
          playerName: clampStr(userDoc.fullName, 80),
          name: clampStr(userDoc.fullName, 80),
          email: userDoc.email || '',
          subject: clampStr(subject, 120),
          category,
          message: clampStr(message, 1500),
          status: 'Open',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      notifyStore();
      setSubject('');
      setMessage('');
      setFeedback('Support ticket submitted. Our Kampala operations team will reply shortly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit support ticket.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero-arena-bg py-10 px-4 sm:px-8">
      <div className="mx-auto max-w-[1150px] space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase">
              24/7 Help Desk
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1">
              Player Support &amp; Announcements
            </h1>
            <p className="text-sm text-neutral-300 mt-1">
              Get help with 18+ KYC verification, table rules, or tournament brackets.
            </p>
          </div>
          <a
            href={`https://wa.me/${(systemSettings.whatsappNumber || '256700412890').replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold whitespace-nowrap self-start"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Support Desk</span>
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ticket Form */}
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Headphones className="h-5 w-5 text-[#FFD76A]" />
              <span>Open a Support Ticket</span>
            </h2>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/50 px-4 py-3 text-xs text-red-200">
                {error}
              </div>
            )}
            {feedback && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-3 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            {firebaseUser ? (
              <form onSubmit={handleSubmitTicket} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupportTicketRecord['category'])}
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
                  >
                    <option value="Account & KYC">Account &amp; KYC</option>
                    <option value="Game Bug / Report">Game Bug / Report</option>
                    <option value="Fair Play / Cheating">Fair Play / Cheating</option>
                    <option value="General Support">General Support</option>
                    <option value="Complaint">Complaint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of your question"
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">Message</label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Include room code, match ID, or KYC details if relevant..."
                    className="w-full rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-[#FFD76A] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{busy ? 'Sending…' : 'Submit Ticket'}</span>
                </button>
              </form>
            ) : (
              <div className="rounded-xl border border-white/10 bg-[#04140C] p-5 space-y-3">
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Sign in to file an encrypted support ticket tracked against your Player ID, or reach us directly via WhatsApp or email.
                </p>
                <Link
                  to="/login"
                  className="gold-shimmer-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold"
                >
                  <span>Sign In to Open Ticket</span>
                </Link>
              </div>
            )}
          </div>

          {/* Announcements & My Tickets */}
          <div className="space-y-6">
            <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4">
              <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#FFD76A]" />
                <span>Platform Announcements</span>
              </h2>
              {announcements.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  All systems nominal. Daily Matatu, Ludo Master, Chess, and Uganda Drafts cups open every evening EAT.
                </p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div key={a.announcementId} className="rounded-xl border border-white/10 bg-[#04140C] p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#FFD76A]">{a.title}</h3>
                        <span className="text-[11px] text-neutral-400">{a.priority}</span>
                      </div>
                      <p className="text-xs text-neutral-200">{a.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {firebaseUser && (
              <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-3">
                <h2 className="font-display text-lg font-bold text-white">Your Recent Tickets</h2>
                {tickets.length === 0 ? (
                  <p className="text-xs text-neutral-400">No support tickets submitted yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {tickets.map((t) => (
                      <div key={t.ticketId} className="rounded-xl border border-white/10 bg-[#04140C] p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-white">{t.subject}</span>
                          <span className="text-[#FFD76A] font-medium">{t.status}</span>
                        </div>
                        <p className="text-xs text-neutral-400 line-clamp-2">{t.message}</p>
                        {t.adminReply && (
                          <p className="text-xs text-emerald-300 pt-1 border-t border-white/10">
                            Reply: {t.adminReply}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { systemSettings } = useAuth();
  const cleanWhatsapp = (systemSettings.whatsappNumber || '256700412890').replace(/[^\d]/g, '');

  return (
    <div className="hero-arena-bg py-10 px-4 sm:px-8">
      <div className="mx-auto max-w-[1000px] space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <img
            src={ugandaEmblemImg}
            alt="CASINO ROYALE Emblem"
            className="h-20 w-20 rounded-2xl border border-[#FFD76A]/60 object-cover shadow-lg shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase">Kampala Headquarters</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-0.5">
              Contact CASINO ROYALE
            </h1>
            <p className="text-sm text-neutral-300 mt-1">
              Reach our compliance, player verification, and tournament operations desk.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-2">
            <Phone className="h-6 w-6 text-[#FFD76A]" />
            <h2 className="font-display text-lg font-bold text-white">Telephone &amp; WhatsApp</h2>
            <p className="text-sm text-neutral-300 font-mono-tabular">{systemSettings.contactPhone}</p>
            <a
              href={`https://wa.me/${cleanWhatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFD76A] hover:underline pt-1"
            >
              <span>Message on WhatsApp</span>
            </a>
          </div>

          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-2">
            <Mail className="h-6 w-6 text-[#FFD76A]" />
            <h2 className="font-display text-lg font-bold text-white">Official Email</h2>
            <p className="text-sm text-neutral-300">{systemSettings.contactEmail}</p>
            <Link to="/support" className="inline-block text-xs font-semibold text-[#FFD76A] hover:underline pt-1">
              Open Player Ticket
            </Link>
          </div>

          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-2">
            <MapPin className="h-6 w-6 text-[#FFD76A]" />
            <h2 className="font-display text-lg font-bold text-white">Office Location</h2>
            <p className="text-sm text-neutral-300">
              {systemSettings.officeAddress || 'Kampala, Uganda'}
            </p>
            <p className="text-xs text-neutral-400">Mon – Sun · 08:00 – 22:00 EAT</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const LegalTemplate: React.FC<{
  kicker: string;
  title: string;
  sections: Array<{ heading: string; body: string }>;
}> = ({ kicker, title, sections }) => (
  <div className="hero-arena-bg py-10 px-4 sm:px-8">
    <div className="mx-auto max-w-4xl emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 sm:p-10 space-y-6">
      <div className="flex items-center gap-3 border-b border-white/10 pb-5">
        <ShieldCheck className="h-7 w-7 text-[#FFD76A] shrink-0" />
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#FFD76A] uppercase">{kicker}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">{title}</h1>
        </div>
      </div>
      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.heading} className="space-y-1.5">
            <h2 className="font-display text-lg font-bold text-[#FFD76A]">{s.heading}</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  </div>
);

export const TermsPage: React.FC = () => (
  <LegalTemplate
    kicker="Platform Governance"
    title="Terms & Conditions"
    sections={[
      {
        heading: '1. Regulated Real-Money & Skill Gaming',
        body: 'CASINO ROYALE operates verified UGX wagering, tournament entries, and Mobile Money wallet settlements across Uganda. All players must maintain an active verified account to deposit, stake, and withdraw winnings.',
      },
      {
        heading: '2. Eligibility & 18+ Identity Verification',
        body: 'Participation is restricted to individuals aged 18 years or older. Players must submit accurate legal information and valid government-issued photo identification before accessing live multiplayer rooms or tournament brackets.',
      },
      {
        heading: '3. Fair Play & Rule-Enforced Gameplay',
        body: 'All card shuffles, turn clocks, move validations, and tournament pairings are computed authoritatively. Automation scripts, collusion, or multi-accounting result in permanent suspension.',
      },
    ]}
  />
);

export const PrivacyPage: React.FC = () => (
  <LegalTemplate
    kicker="Data Protection"
    title="Privacy & KYC Notice"
    sections={[
      {
        heading: '1. Confidential KYC Document Handling',
        body: 'Uploaded National ID, Passport, and Driving Permit images are reviewed solely by authorised KYC Compliance Officers for 18+ age and identity verification.',
      },
      {
        heading: '2. Zero Public PII Exposure',
        body: 'Public leaderboards and game tables display only your chosen display name, generated Player ID, and match statistics. Email addresses, phone numbers, dates of birth, and KYC images are never exposed publicly.',
      },
      {
        heading: '3. Audit Logging',
        body: 'Every administrative KYC review decision is recorded in a verification audit trail to ensure regulatory accountability.',
      },
    ]}
  />
);

export const ResponsibleGamingPage: React.FC = () => (
  <LegalTemplate
    kicker="Player Safeguards"
    title="Responsible Gaming & 18+ Policy"
    sections={[
      {
        heading: '1. Age Restriction Enforcement',
        body: 'Strict 18+ date-of-birth checks and manual ID verification prevent underage access to all multiplayer card and board arenas.',
      },
      {
        heading: '2. Healthy Play Habits',
        body: 'Matatu, Ludo Master, Chess, and Uganda Drafts are games of skill and enjoyment. Take regular breaks, respect turn etiquette in table chat, and contact our 24/7 support desk if you wish to pause or close your account.',
      },
      {
        heading: '3. Mobile Money Wallet & Payout Protection',
        body: 'MTN Mobile Money and Airtel Money deposits and withdrawal requests are logged with unique transaction references, verified balance checks, and transparent administrative settlement oversight.',
      },
    ]}
  />
);
