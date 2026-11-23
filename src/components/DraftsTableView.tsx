import React, { useMemo, useRef, useState } from 'react';
import { Crown, Flag, RotateCw, Zap } from 'lucide-react';
import { ThreeDraftsBoard } from './three/ThreeDraftsBoard';
import { useGameFullscreen } from '../hooks/useGameFullscreen';
import type { DraftsColor, SanitizedDraftsState, SanitizedSeatState } from '../shared/types';

interface DraftsTableViewProps {
  draftsState: SanitizedDraftsState;
  seats: SanitizedSeatState[];
  viewerUid: string;
  isYourTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'completed';
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  onResign: () => void;
}

export const DraftsTableView: React.FC<DraftsTableViewProps> = ({
  draftsState,
  seats,
  viewerUid,
  isYourTurn,
  gameStatus,
  isFullscreen = false,
  onToggleFullscreen,
  onMove,
  onResign,
}) => {
  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const localFs = useGameFullscreen(localContainerRef);
  const effectiveFullscreen = onToggleFullscreen ? isFullscreen : localFs.isFullscreen;
  const handleToggleFullscreen = onToggleFullscreen ?? (() => void localFs.toggleFullscreen());
  const viewerColor: DraftsColor = draftsState.seatColors[viewerUid] || 'red';
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  const orientBlack = viewerColor === 'black' ? !flipped : flipped;

  const activeSelection = draftsState.activeChainSquare || selected;

  const legalTargets = useMemo(() => {
    if (!activeSelection) return [];
    return draftsState.legalMovesBySquare[`${activeSelection.row},${activeSelection.col}`] || [];
  }, [draftsState.legalMovesBySquare, activeSelection]);

  const handleSquareClick = (r: number, c: number) => {
    if (gameStatus !== 'in_progress' || !isYourTurn) return;

    const target = legalTargets.find((t) => t.toRow === r && t.toCol === c);
    if (activeSelection && target) {
      onMove(activeSelection.row, activeSelection.col, r, c);
      setSelected(null);
      return;
    }

    if (draftsState.activeChainSquare) return;

    const piece = draftsState.board[r][c];
    const hasLegalFromHere = Boolean(draftsState.legalMovesBySquare[`${r},${c}`]?.length);
    if (piece && piece.color === viewerColor && draftsState.turn === viewerColor && hasLegalFromHere) {
      if (selected && selected.row === r && selected.col === c) {
        setSelected(null);
      } else {
        setSelected({ row: r, col: c });
      }
    } else {
      setSelected(null);
    }
  };

  const redSeat = seats.find((s) => draftsState.seatColors[s.uid] === 'red');
  const blackSeat = seats.find((s) => draftsState.seatColors[s.uid] === 'black');

  return (
    <div
      ref={localContainerRef}
      className={
        !onToggleFullscreen && localFs.isFullscreen
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto pro-table-bezel bg-[#080705] p-3 sm:p-5'
          : 'relative overflow-hidden rounded-2xl border border-[#D4AF37]/30 pro-table-bezel bg-gradient-to-b from-[#0A0807]/94 to-[#050404]/98 p-4 sm:p-6'
      }
    >
      <div
        className={`relative z-10 grid grid-cols-1 gap-6 items-start ${
          effectiveFullscreen ? '' : '2xl:grid-cols-[minmax(0,1fr)_260px]'
        }`}
      >
        <div className="flex flex-col items-center w-full">
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between gap-3 mb-3 px-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  orientBlack
                    ? 'bg-[#DC2626] border-[#FFD76A]'
                    : 'bg-[#1F242D] border-[#FFD76A]'
                }`}
              />
              <span className="font-semibold text-white">
                {orientBlack ? redSeat?.displayName || 'Red' : blackSeat?.displayName || 'Black'}
              </span>
              <span className="text-neutral-400 font-mono-tabular">
                ({orientBlack ? draftsState.redCount : draftsState.blackCount} pcs)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {draftsState.mustCapture && isYourTurn && gameStatus === 'in_progress' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FFD76A]">
                  <Zap className="h-3.5 w-3.5" />
                  Mandatory Jump
                </span>
              )}
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#12161E] px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:border-[#D4AF37]/50 hover:text-[#FFD76A] cursor-pointer"
              >
                <RotateCw className="h-3 w-3" />
                <span>Flip</span>
              </button>
              {gameStatus === 'in_progress' && (
                <button
                  type="button"
                  onClick={onResign}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-950/35 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-900/50 cursor-pointer"
                >
                  <Flag className="h-3 w-3" />
                  <span>Resign</span>
                </button>
              )}
            </div>
          </div>

          {/* Real-Life 3D Uganda Drafts Board */}
          <ThreeDraftsBoard
            board={draftsState.board}
            orientBlack={orientBlack}
            activeSelection={activeSelection}
            legalTargets={legalTargets}
            lastMove={draftsState.lastMove}
            viewerColor={viewerColor}
            isYourTurn={isYourTurn}
            gameStatus={gameStatus}
            legalMovesBySquare={draftsState.legalMovesBySquare}
            isFullscreen={effectiveFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onSquareClick={handleSquareClick}
          />

          {/* Bottom Bar */}
          <div className="w-full flex items-center justify-between gap-3 mt-3 px-1 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-3.5 w-3.5 rounded-full border ${
                  orientBlack
                    ? 'bg-[#1F242D] border-[#FFD76A]'
                    : 'bg-[#DC2626] border-[#FFD76A]'
                }`}
              />
              <span className="font-semibold text-white">
                {orientBlack ? blackSeat?.displayName || 'Black' : redSeat?.displayName || 'Red'}
              </span>
              <span className="text-neutral-400 font-mono-tabular">
                ({orientBlack ? draftsState.blackCount : draftsState.redCount} pcs)
              </span>
            </div>
            <span className="font-mono-tabular text-[#FFD76A]">
              Captures: Red {draftsState.capturedByRed} · Black {draftsState.capturedByBlack}
            </span>
          </div>
        </div>

        {/* Right Side Notation & Rules */}
        <div className="pro-panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="text-xs font-bold tracking-wide text-[#FFD76A] uppercase flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              <span>Uganda Drafts Log</span>
            </h3>
            <span className="text-[11px] font-mono-tabular text-neutral-400">
              {gameStatus === 'waiting'
                ? 'Stake to start'
                : draftsState.turn === 'red'
                ? 'Red Turn'
                : 'Black Turn'}
            </span>
          </div>

          <p className="text-[11px] text-neutral-300 leading-relaxed">
            Flying Kings & mandatory multi-jump captures are enforced by the server. Reach the opposite back rank to crown your King.
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-[#0B0E14] p-2 space-y-1 font-mono-tabular text-xs">
            {draftsState.moveHistory.length === 0 ? (
              <p className="text-neutral-500 text-center py-4">First diagonal move pending…</p>
            ) : (
              draftsState.moveHistory.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/5">
                  <span className="text-neutral-500">#{m.turn}</span>
                  <span className={m.color === 'red' ? 'text-red-400 font-semibold' : 'text-[#FFD76A] font-semibold'}>
                    {m.color === 'red' ? 'Red' : 'Black'}
                  </span>
                  <span className="text-white">{m.notation}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
