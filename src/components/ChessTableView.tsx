import React, { useMemo, useRef, useState } from 'react';
import { Crown, Flag, RotateCw, ShieldAlert } from 'lucide-react';
import { ChessPieceSvg } from './ChessPiecesSvg';
import { ThreeChessBoard } from './three/ThreeChessBoard';
import { useGameFullscreen } from '../hooks/useGameFullscreen';
import type { ChessColor, ChessPieceType, SanitizedChessState, SanitizedSeatState } from '../shared/types';

interface ChessTableViewProps {
  chessState: SanitizedChessState;
  seats: SanitizedSeatState[];
  viewerUid: string;
  isYourTurn: boolean;
  gameStatus: 'waiting' | 'in_progress' | 'completed';
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onMove: (
    fromRow: number,
    fromCol: number,
    toRow: number,
    toCol: number,
    promotion?: ChessPieceType
  ) => void;
  onResign: () => void;
}

export const ChessTableView: React.FC<ChessTableViewProps> = ({
  chessState,
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
  const viewerColor: ChessColor = chessState.seatColors[viewerUid] || 'w';
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null>(null);

  const orientBlack = viewerColor === 'b' ? !flipped : flipped;

  const legalTargets = useMemo(() => {
    if (!selected) return [];
    return chessState.legalMovesBySquare[`${selected.row},${selected.col}`] || [];
  }, [chessState.legalMovesBySquare, selected]);

  const handleSquareClick = (r: number, c: number) => {
    if (gameStatus !== 'in_progress' || !isYourTurn) return;

    const target = legalTargets.find((t) => t.toRow === r && t.toCol === c);
    if (selected && target) {
      if (target.isPromotion) {
        setPendingPromotion({
          fromRow: selected.row,
          fromCol: selected.col,
          toRow: r,
          toCol: c,
        });
      } else {
        onMove(selected.row, selected.col, r, c);
        setSelected(null);
      }
      return;
    }

    const piece = chessState.board[r][c];
    if (piece && piece.color === viewerColor && chessState.turn === viewerColor) {
      if (selected && selected.row === r && selected.col === c) {
        setSelected(null);
      } else {
        setSelected({ row: r, col: c });
      }
    } else {
      setSelected(null);
    }
  };

  const whiteSeat = seats.find((s) => chessState.seatColors[s.uid] === 'w');
  const blackSeat = seats.find((s) => chessState.seatColors[s.uid] === 'b');

  return (
    <div
      ref={localContainerRef}
      className={
        !onToggleFullscreen && localFs.isFullscreen
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto pro-table-bezel bg-[#050A08] p-3 sm:p-5'
          : 'relative overflow-hidden rounded-2xl border border-[#D4AF37]/30 pro-table-bezel bg-gradient-to-b from-[#070E0A]/94 to-[#040706]/98 p-4 sm:p-6'
      }
    >
      <div
        className={`relative z-10 grid grid-cols-1 gap-6 items-start ${
          effectiveFullscreen ? '' : '2xl:grid-cols-[minmax(0,1fr)_260px]'
        }`}
      >
        {/* Main Chessboard Stage */}
        <div className="flex flex-col items-center w-full">
          {/* Top Opponent Bar */}
          <div className="w-full flex items-center justify-between gap-3 mb-3 px-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-3 w-3 rounded-full border ${
                  orientBlack
                    ? 'bg-[#F9F3DF] border-[#7A5608]'
                    : 'bg-[#161B22] border-[#D4AF37]'
                }`}
              />
              <span className="font-semibold text-white">
                {orientBlack ? whiteSeat?.displayName || 'White' : blackSeat?.displayName || 'Black'}
              </span>
              {chessState.inCheckColor === (orientBlack ? 'w' : 'b') && (
                <span className="inline-flex items-center gap-1 text-red-400 font-bold">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  CHECK
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#12161E] px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:border-[#D4AF37]/50 hover:text-[#FFD76A] cursor-pointer"
              >
                <RotateCw className="h-3 w-3" />
                <span>Flip Board</span>
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

          {/* Real-Life 3D Staunton Chessboard */}
          <ThreeChessBoard
            board={chessState.board}
            orientBlack={orientBlack}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={chessState.lastMove}
            inCheckColor={chessState.inCheckColor}
            isYourTurn={isYourTurn}
            gameStatus={gameStatus}
            isFullscreen={effectiveFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onSquareClick={handleSquareClick}
          />

          {/* Bottom Player Bar */}
          <div className="w-full flex items-center justify-between gap-3 mt-3 px-1">
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-3 w-3 rounded-full border ${
                  orientBlack
                    ? 'bg-[#161B22] border-[#D4AF37]'
                    : 'bg-[#F9F3DF] border-[#7A5608]'
                }`}
              />
              <span className="font-semibold text-white">
                {orientBlack ? blackSeat?.displayName || 'Black' : whiteSeat?.displayName || 'White'}
              </span>
              {chessState.turn === viewerColor && gameStatus === 'in_progress' && (
                <span className="text-[11px] font-bold text-[#9CE800]">· Your Move</span>
              )}
            </div>
            <div className="text-xs font-mono-tabular text-[#FFD76A]">
              Material:{' '}
              {chessState.materialAdvantageWhite === 0
                ? 'Even'
                : chessState.materialAdvantageWhite > 0
                ? `White +${chessState.materialAdvantageWhite}`
                : `Black +${Math.abs(chessState.materialAdvantageWhite)}`}
            </div>
          </div>
        </div>

        {/* Right Side Move Ledger & Captured Pieces */}
        <div className="pro-panel-card rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <h3 className="text-xs font-bold tracking-wide text-[#FFD76A] uppercase flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              <span>Championship Ledger</span>
            </h3>
            <span className="text-[11px] font-mono-tabular text-neutral-400">
              {gameStatus === 'waiting'
                ? 'Stake to start'
                : chessState.turn === 'w'
                ? 'White to move'
                : 'Black to move'}
            </span>
          </div>

          {/* Captured Pieces */}
          <div className="space-y-2 text-[11px]">
            <div>
              <p className="text-neutral-400 mb-1">Captured by White</p>
              <div className="flex flex-wrap gap-1 min-h-6 rounded-lg bg-[#0D1117] px-2 py-1 border border-white/5">
                {chessState.capturedByWhite.length === 0 ? (
                  <span className="text-neutral-600">None</span>
                ) : (
                  chessState.capturedByWhite.map((p, i) => (
                    <div key={i} className="h-5 w-5">
                      <ChessPieceSvg color="b" type={p} />
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-neutral-400 mb-1">Captured by Black</p>
              <div className="flex flex-wrap gap-1 min-h-6 rounded-lg bg-[#0D1117] px-2 py-1 border border-white/5">
                {chessState.capturedByBlack.length === 0 ? (
                  <span className="text-neutral-600">None</span>
                ) : (
                  chessState.capturedByBlack.map((p, i) => (
                    <div key={i} className="h-5 w-5">
                      <ChessPieceSvg color="w" type={p} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Algebraic Move History */}
          <div>
            <p className="text-[11px] text-neutral-400 mb-1.5">Move Notation</p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#0B0E14] p-2 space-y-1 font-mono-tabular text-xs">
              {chessState.moveHistory.length === 0 ? (
                <p className="text-neutral-500 text-center py-4">Opening move pending…</p>
              ) : (
                Array.from({ length: Math.ceil(chessState.moveHistory.length / 2) }).map((_, pairIdx) => {
                  const wMove = chessState.moveHistory[pairIdx * 2];
                  const bMove = chessState.moveHistory[pairIdx * 2 + 1];
                  return (
                    <div
                      key={pairIdx}
                      className="grid grid-cols-[28px_1fr_1fr] gap-2 px-1.5 py-0.5 rounded hover:bg-white/5"
                    >
                      <span className="text-neutral-500">{pairIdx + 1}.</span>
                      <span className="text-white">{wMove?.san || ''}</span>
                      <span className="text-neutral-300">{bMove?.san || ''}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pawn Promotion Selector Modal */}
      {pendingPromotion && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-[#FFD76A]/60 bg-[#051B11] p-6 max-w-xs w-full space-y-4 text-center shadow-2xl">
            <h4 className="font-display text-lg font-bold text-[#FFD76A]">Promote Pawn</h4>
            <p className="text-xs text-neutral-300">Select the replacement piece on the promotion rank.</p>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as ChessPieceType[]).map((promo) => (
                <button
                  key={promo}
                  type="button"
                  onClick={() => {
                    onMove(
                      pendingPromotion.fromRow,
                      pendingPromotion.fromCol,
                      pendingPromotion.toRow,
                      pendingPromotion.toCol,
                      promo
                    );
                    setPendingPromotion(null);
                    setSelected(null);
                  }}
                  className="rounded-xl border border-[#D4AF37]/40 bg-[#0A301F] p-2 hover:border-[#FFD76A] hover:bg-[#10472E] cursor-pointer"
                >
                  <div className="h-10 w-10 mx-auto">
                    <ChessPieceSvg color={viewerColor} type={promo} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
