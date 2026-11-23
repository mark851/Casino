import React from 'react';
import { Crown, Play, ShieldCheck, Swords, UserCheck } from 'lucide-react';
import type { TournamentMatchRecord } from '../shared/types';

interface BracketTreeProps {
  matches: TournamentMatchRecord[];
  currentUid?: string;
  adminMode?: boolean;
  busyMatchId?: string | null;
  onLaunchMatch?: (match: TournamentMatchRecord) => void;
  onAdminAdvanceWinner?: (match: TournamentMatchRecord, winnerUid: string, winnerName: string) => void;
}

export const BracketTree: React.FC<BracketTreeProps> = ({
  matches,
  currentUid,
  adminMode = false,
  busyMatchId,
  onLaunchMatch,
  onAdminAdvanceWinner,
}) => {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#04140C]/80 p-8 text-center space-y-2">
        <Swords className="h-8 w-8 text-[#D4AF37]/70 mx-auto" />
        <p className="text-sm font-semibold text-white">Automated Bracket Not Yet Drawn</p>
        <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
          Once at least 2 verified players sign up and the scheduled start time arrives (or the bracket reaches capacity), single-elimination pairings and BYEs generate automatically.
        </p>
      </div>
    );
  }

  const roundsMap = new Map<number, TournamentMatchRecord[]>();
  for (const m of matches) {
    const arr = roundsMap.get(m.roundNumber) || [];
    arr.push(m);
    roundsMap.set(m.roundNumber, arr);
  }

  const roundNumbers = Array.from(roundsMap.keys()).sort((a, b) => a - b);
  for (const r of roundNumbers) {
    roundsMap.get(r)?.sort((a, b) => a.matchIndex - b.matchIndex);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid gap-6 min-w-[680px]"
        style={{
          gridTemplateColumns: `repeat(${roundNumbers.length}, minmax(220px, 1fr))`,
        }}
      >
        {roundNumbers.map((roundNum, rIdx) => {
          const roundMatches = roundsMap.get(roundNum) || [];
          const label = roundMatches[0]?.roundLabel || `Round ${roundNum}`;
          const isFinalRound = rIdx === roundNumbers.length - 1;

          return (
            <div key={roundNum} className="flex flex-col">
              <div className="mb-3 flex items-center justify-between border-b border-[#D4AF37]/25 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FFD76A] flex items-center gap-1.5">
                  {isFinalRound && <Crown className="h-3.5 w-3.5 text-[#FFD76A]" />}
                  <span>{label}</span>
                </span>
                <span className="text-[11px] text-neutral-400 font-mono-tabular">
                  {roundMatches.length} {roundMatches.length === 1 ? 'Match' : 'Matches'}
                </span>
              </div>

              <div className="flex-1 flex flex-col justify-around gap-4">
                {roundMatches.map((m) => {
                  const isMyMatch =
                    Boolean(currentUid) &&
                    (m.player1Uid === currentUid || m.player2Uid === currentUid);
                  const canPlayMatch =
                    !adminMode &&
                    isMyMatch &&
                    (m.status === 'ready' || m.status === 'in_progress') &&
                    Boolean(m.player1Uid && m.player2Uid);
                  const canAdminResolve =
                    adminMode &&
                    (m.status === 'ready' || m.status === 'in_progress') &&
                    Boolean(m.player1Uid && m.player2Uid);

                  return (
                    <div
                      key={m.matchId}
                      className={`rounded-xl border p-3.5 transition-all space-y-2.5 ${
                        isMyMatch
                          ? 'border-[#FFD76A]/80 bg-gradient-to-b from-[#083923] to-[#03190E] shadow-[0_0_24px_rgba(212,175,55,0.2)]'
                          : isFinalRound && m.status === 'completed'
                          ? 'border-[#D4AF37] bg-[#062919]'
                          : 'border-white/12 bg-[#04140D]/90'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="font-mono-tabular font-semibold text-neutral-400 uppercase">
                          {label} #{m.matchIndex + 1}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            m.status === 'completed'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/35'
                              : m.status === 'in_progress'
                              ? 'bg-amber-950 text-[#FFD76A] border border-[#D4AF37]/50'
                              : m.status === 'ready'
                              ? 'bg-[#083B24] text-emerald-200 border border-emerald-400/40'
                              : m.status === 'bye'
                              ? 'bg-white/5 text-neutral-400 border border-white/10'
                              : 'bg-white/5 text-neutral-400 border border-white/10'
                          }`}
                        >
                          {m.status === 'in_progress'
                            ? 'Live Table'
                            : m.status === 'ready'
                            ? 'Ready'
                            : m.status === 'completed'
                            ? 'Completed'
                            : m.status === 'bye'
                            ? 'BYE Advance'
                            : 'Awaiting'}
                        </span>
                      </div>

                      {/* Slot 1 & Slot 2 */}
                      <div className="space-y-1.5">
                        {[
                          { uid: m.player1Uid, name: m.player1Name, slot: 1 },
                          { uid: m.player2Uid, name: m.player2Name, slot: 2 },
                        ].map((p) => {
                          const isWinner = Boolean(p.uid && m.winnerUid === p.uid);
                          const isLoser =
                            Boolean(p.uid && m.winnerUid && m.winnerUid !== p.uid);
                          const isMe = Boolean(currentUid && p.uid === currentUid);

                          return (
                            <div
                              key={p.slot}
                              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs border ${
                                isWinner
                                  ? 'border-[#D4AF37]/70 bg-[#0A492C] text-[#FFD76A] font-bold'
                                  : isMe
                                  ? 'border-emerald-400/50 bg-[#052918] text-white font-semibold'
                                  : isLoser
                                  ? 'border-white/5 bg-black/30 text-neutral-500 line-through'
                                  : 'border-white/10 bg-[#030D08] text-neutral-200'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isWinner ? (
                                  <Crown className="h-3.5 w-3.5 text-[#FFD76A] shrink-0" />
                                ) : isMe ? (
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                ) : null}
                                <span className="truncate">
                                  {p.name || (m.isBye ? '— BYE —' : 'TBD')}
                                </span>
                              </div>
                              {isWinner && (
                                <span className="text-[10px] uppercase tracking-wider shrink-0">
                                  Adv
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Player Live Match Launch CTA */}
                      {canPlayMatch && onLaunchMatch && (
                        <button
                          type="button"
                          disabled={busyMatchId === m.matchId}
                          onClick={() => onLaunchMatch(m)}
                          className="gold-shimmer-btn w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>
                            {busyMatchId === m.matchId
                              ? 'Opening Match Table...'
                              : m.status === 'in_progress'
                              ? 'Rejoin Match Table'
                              : 'Enter Match Table'}
                          </span>
                        </button>
                      )}

                      {/* Admin Match Governance Override */}
                      {canAdminResolve && onAdminAdvanceWinner && (
                        <div className="pt-1 border-t border-white/10 space-y-1.5">
                          <p className="text-[10px] text-neutral-400 flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-[#D4AF37]" />
                            <span>Admin Match Resolution / Walkover:</span>
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              disabled={busyMatchId === m.matchId}
                              onClick={() =>
                                onAdminAdvanceWinner(m, m.player1Uid!, m.player1Name || 'Player 1')
                              }
                              className="rounded border border-[#D4AF37]/40 bg-[#052919] hover:bg-[#084228] px-2 py-1 text-[10px] font-semibold text-[#FFD76A] truncate cursor-pointer disabled:opacity-50"
                            >
                              Win: {m.player1Name || 'P1'}
                            </button>
                            <button
                              type="button"
                              disabled={busyMatchId === m.matchId}
                              onClick={() =>
                                onAdminAdvanceWinner(m, m.player2Uid!, m.player2Name || 'Player 2')
                              }
                              className="rounded border border-[#D4AF37]/40 bg-[#052919] hover:bg-[#084228] px-2 py-1 text-[10px] font-semibold text-[#FFD76A] truncate cursor-pointer disabled:opacity-50"
                            >
                              Win: {m.player2Name || 'P2'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
