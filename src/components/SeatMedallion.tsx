import React from 'react';
import { Crown, Wifi, WifiOff } from 'lucide-react';
import type { SanitizedSeatState } from '../shared/types';

interface SeatMedallionProps {
  seat: SanitizedSeatState;
  isCurrentTurn: boolean;
  isYou: boolean;
  isWinner?: boolean;
  labelSuffix?: string;
}

export const SeatMedallion: React.FC<SeatMedallionProps> = ({
  seat,
  isCurrentTurn,
  isYou,
  isWinner = false,
  labelSuffix,
}) => {
  const parts = seat.displayName.trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
      : (seat.displayName.trim().slice(0, 2).toUpperCase() || 'CR');

  const avatarToneClass = isCurrentTurn
    ? 'border-[#9CE800] bg-[#0B2C1A] text-[#9CE800]'
    : seat.gender === 'female'
    ? 'border-amber-300/65 bg-[#1B1220] text-amber-200'
    : 'border-[#D4AF37]/60 bg-[#052416] text-[#FFD76A]';

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-all ${
        isWinner
          ? 'border-[#FFD76A] bg-[#073A22]/95 shadow-[0_0_24px_rgba(255,215,106,0.3)]'
          : isCurrentTurn
          ? 'border-[#9CE800] bg-[#131F16]/95 shadow-[0_0_20px_rgba(156,232,0,0.22)]'
          : 'border-white/10 bg-[#13171F]/90'
      }`}
    >
      {/* Avatar Medallion */}
      <div
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 font-display text-xs font-bold ${avatarToneClass}`}
      >
        {initials}
        {isWinner && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFD76A] text-[#050806]">
            <Crown className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Identity & Hand Count */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span className="truncate">{seat.displayName}</span>
          {isYou && <span className="text-[10px] text-[#FFD76A] shrink-0">(You)</span>}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono-tabular mt-0.5">
          <span>{labelSuffix ? labelSuffix : `${seat.cardCount} cards`}</span>
          {seat.calledLastCard && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#9CE800] font-semibold">Kadi Moja!</span>
            </>
          )}
        </div>
      </div>

      {/* Turn / Connection Indicator */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        {isCurrentTurn ? (
          <span className="text-[10px] font-bold tracking-wider uppercase text-[#9CE800]">
            Active Turn
          </span>
        ) : seat.connected || seat.isBot ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-label="Online" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-neutral-500" aria-label="Disconnected" />
        )}
      </div>
    </div>
  );
};
