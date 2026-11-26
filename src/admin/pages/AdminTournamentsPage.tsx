import React, { useEffect, useState } from 'react';
import { Plus, Trophy, Users } from 'lucide-react';
import { useAuth } from '../../lib/authContext';
import { getStore, subscribeStore } from '../../lib/localStore';
import { AdminLayout } from '../components/AdminLayout';
import { BracketTree } from '../../components/BracketTree';
import {
  createAdminCustomTournament,
  generateTournamentBracket,
  recordMatchResultAndAdvance,
} from '../../lib/tournamentService';
import { getKampalaDateString } from '../../shared/tournamentEngine';
import { writeAdminLog } from '../adminHelpers';
import type {
  TableGameType,
  TournamentEntryRecord,
  TournamentMatchRecord,
  TournamentRecord,
} from '../../shared/types';

export const AdminTournamentsPage: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentMatchRecord[]>([]);
  const [entries, setEntries] = useState<TournamentEntryRecord[]>([]);

  const [title, setTitle] = useState('Kampala Weekend Royale Cup');
  const [gameType, setGameType] = useState<TableGameType>('matatu');
  const [maxPlayers, setMaxPlayers] = useState<4 | 8 | 16>(8);
  const [entryFeeUgx, setEntryFeeUgx] = useState(1000);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const sync = () => {
      const s = getStore();
      const list = Object.values(s.tournaments)
        .filter((t) => t.maxPlayers >= 4)
        .sort((a, b) => (b.startTimeIso || '').localeCompare(a.startTimeIso || ''));
      setTournaments(list);
      const activeId = selectedId && s.tournaments[selectedId] ? selectedId : list[0]?.tournamentId || null;
      if (!selectedId && activeId) {
        setSelectedId(activeId);
      }
      if (activeId) {
        setMatches(
          [...(s.tournamentMatches[activeId] || [])].sort(
            (a, b) => a.roundNumber - b.roundNumber
          )
        );
        setEntries(
          [...(s.tournamentEntries[activeId] || [])].sort((a, b) => a.seed - b.seed)
        );
      } else {
        setMatches([]);
        setEntries([]);
      }
    };
    sync();
    return subscribeStore(sync);
  }, [selectedId]);

  const selectedTournament = tournaments.find((t) => t.tournamentId === selectedId) || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setBusy(true);
    setFeedback('');
    try {
      const date = getKampalaDateString();
      const safeFee = Math.max(1000, Math.round(Number(entryFeeUgx) || 1000));
      const id = await createAdminCustomTournament({
        title,
        gameType,
        scheduleDate: date,
        startTimeIso: `${date}T21:00:00+03:00`,
        maxPlayers,
        entryFeeUgx: safeFee,
        championPointsPrize: 0,
        runnerUpPointsPrize: 0,
        prizeSummary: `Entry: UGX ${safeFee.toLocaleString()} · Winner Takes Championship Cup`,
        createdByUid: firebaseUser.uid,
      });
      await writeAdminLog({
        adminUid: firebaseUser.uid,
        adminEmail: firebaseUser.email || 'admin',
        action: 'CREATE_TOURNAMENT',
        targetType: 'tournament',
        targetId: id,
        details: `${title} (${gameType}, ${maxPlayers} players)`,
      });
      setSelectedId(id);
      setFeedback('Tournament created.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to create tournament.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceWinner = async (
    match: TournamentMatchRecord,
    winnerUid: string,
    winnerName: string
  ) => {
    if (!selectedTournament || !firebaseUser) return;
    await recordMatchResultAndAdvance({
      tournament: selectedTournament,
      matches,
      match,
      winnerUid,
      winnerName,
    });
    await writeAdminLog({
      adminUid: firebaseUser.uid,
      adminEmail: firebaseUser.email || 'admin',
      action: 'ADVANCE_BRACKET',
      targetType: 'tournament_match',
      targetId: `${selectedTournament.tournamentId}/${match.matchId}`,
      details: `Winner set to ${winnerName}`,
    });
  };

  return (
    <AdminLayout title="Tournament Operations">
      <div className="space-y-6">
        {feedback && (
          <div className="rounded-xl border border-[#D4AF37]/40 bg-[#052315] px-4 py-2.5 text-xs text-[#FFD76A]">
            {feedback}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Plus className="h-5 w-5 text-[#FFD76A]" />
            <span>Create Custom Tournament Cup</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cup Title"
              className="lg:col-span-2 rounded-xl border border-white/15 bg-[#04120B] px-3.5 py-2 text-sm text-white focus:border-[#FFD76A] focus:outline-none"
            />
            <select
              value={gameType}
              onChange={(e) => setGameType(e.target.value as TableGameType)}
              className="rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-sm text-white"
            >
              <option value="matatu">Matatu</option>
              <option value="ludo">Ludo Master</option>
              <option value="chess">Chess</option>
              <option value="drafts">Drafts</option>
            </select>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value) as 4 | 8 | 16)}
              className="rounded-xl border border-white/15 bg-[#04120B] px-3 py-2 text-sm text-white"
            >
              <option value={4}>4 Players</option>
              <option value={8}>8 Players</option>
              <option value={16}>16 Players</option>
            </select>
            <button
              type="submit"
              disabled={busy}
              className="gold-shimmer-btn rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
            >
              Launch Cup
            </button>
          </div>
          <div className="max-w-xs text-xs">
            <label className="space-y-1 block">
              <span className="text-neutral-400">Entry Fee (UGX · Min 1,000)</span>
              <input
                type="number"
                min={1000}
                step={500}
                value={entryFeeUgx}
                onChange={(e) => setEntryFeeUgx(Number(e.target.value))}
                className="w-full rounded-lg border border-white/15 bg-[#04120B] px-3 py-1.5 font-mono-tabular text-white"
              />
            </label>
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {tournaments.map((t) => (
            <button
              key={t.tournamentId}
              type="button"
              onClick={() => setSelectedId(t.tournamentId)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold border cursor-pointer ${
                selectedId === t.tournamentId
                  ? 'gold-shimmer-btn text-[#050806] border-transparent font-bold'
                  : 'border-white/15 bg-[#04150D] text-neutral-200 hover:border-[#FFD76A]'
              }`}
            >
              {t.title} ({t.entryCount}/{t.maxPlayers})
            </button>
          ))}
        </div>

        {selectedTournament && (
          <div className="emerald-card-surface rounded-2xl border border-[#D4AF37]/30 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#FFD76A]" />
                  <span>{selectedTournament.title}</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Status: {selectedTournament.status} · Entry Fee:{' '}
                  <span className="font-mono-tabular text-[#FFD76A] font-semibold">
                    UGX {(selectedTournament.entryFeeUgx || 1000).toLocaleString()}
                  </span>{' '}
                  · {selectedTournament.prizeSummary}
                </p>
              </div>
              {selectedTournament.status === 'Registration Open' &&
                selectedTournament.entryCount >= 2 && (
                  <button
                    type="button"
                    onClick={() => void generateTournamentBracket(selectedTournament)}
                    className="gold-shimmer-btn rounded-full px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Generate Bracket
                  </button>
                )}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#03130B]/80 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#FFD76A]" />
                  <span>
                    Joined Players ({entries.length}/{selectedTournament.maxPlayers})
                  </span>
                </span>
              </div>
              {entries.length === 0 ? (
                <p className="text-xs text-neutral-400">No players have joined this tournament yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {entries.map((entry) => (
                    <div
                      key={entry.uid}
                      className="rounded-lg border border-white/10 bg-[#051B11] px-3 py-2 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">
                          #{entry.seed} {entry.displayName}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-neutral-400 truncate">
                          {entry.playerId}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#FFD76A] font-medium shrink-0">
                        {entry.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <BracketTree
              matches={matches}
              adminMode={true}
              onAdminAdvanceWinner={handleAdvanceWinner}
            />
          </div>
        )}
      </div>
    </AdminLayout>
  );
};
