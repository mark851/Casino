import React from 'react';
import { SUIT_SYMBOLS } from '../shared/matatuRules';
import type { PlayingCard as PlayingCardType, Suit } from '../shared/types';

interface PlayingCardProps {
  card?: PlayingCardType;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  onDoubleClick?: () => void;
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-7 h-10 rounded-[4px] text-[9px]',
  sm: 'w-14 h-20 rounded-lg text-xs',
  md: 'w-[82px] h-[116px] sm:w-[96px] sm:h-[136px] rounded-[10px] text-sm',
  lg: 'w-[100px] h-[142px] sm:w-[118px] sm:h-[168px] rounded-xl text-base',
};

const SUIT_PATHS: Record<Suit, string> = {
  spades:
    'M 0 -8.8 C -3.8 -4.4, -7.8 -1.3, -7.8 2.4 C -7.8 5.2, -5.5 6.8, -3.1 6.8 C -1.7 6.8, -0.7 6.1, -0.3 5.2 L -2.3 8.8 L 2.3 8.8 L 0.3 5.2 C 0.7 6.1, 1.7 6.8, 3.1 6.8 C 5.5 6.8, 7.8 5.2, 7.8 2.4 C 7.8 -1.3, 3.8 -4.4, 0 -8.8 Z',
  hearts:
    'M 0 8.2 C -0.4 7.8, -8.2 2.2, -8.2 -2.6 C -8.2 -5.8, -5.6 -8.0, -2.7 -8.0 C -1.1 -8.0, -0.2 -7.0, 0 -5.6 C 0.2 -7.0, 1.1 -8.0, 2.7 -8.0 C 5.6 -8.0, 8.2 -5.8, 8.2 -2.6 C 8.2 2.2, 0.4 7.8, 0 8.2 Z',
  diamonds:
    'M 0 -8.8 Q 3.2 -3.2 7.4 0 Q 3.2 3.2 0 8.8 Q -3.2 3.2 -7.4 0 Q -3.2 -3.2 0 -8.8 Z',
  clubs:
    'M 0 -8.5 C -2.3 -8.5, -4.0 -6.7, -4.0 -4.5 C -4.0 -3.2, -3.4 -2.1, -2.4 -1.4 C -4.8 -1.7, -7.6 -0.2, -7.6 2.5 C -7.6 4.9, -5.6 6.6, -3.3 6.6 C -1.8 6.6, -0.7 5.7, -0.3 4.6 L -2.1 8.6 L 2.1 8.6 L 0.3 4.6 C 0.7 5.7, 1.8 6.6, 3.3 6.6 C 5.6 6.6, 7.6 4.9, 7.6 2.5 C 7.6 -0.2, 4.8 -1.7, 2.4 -1.4 C 3.4 -2.1, 4.0 -3.2, 4.0 -4.5 C 4.0 -6.7, 2.3 -8.5, 0 -8.5 Z',
};

const SuitVector: React.FC<{ suit: Suit; className?: string }> = ({ suit, className }) => (
  <svg viewBox="-10 -10 20 20" className={className} aria-hidden="true">
    <path d={SUIT_PATHS[suit]} fill="currentColor" />
  </svg>
);

interface PipCoord {
  x: number;
  y: number;
  invert?: boolean;
}

const PIP_LAYOUTS: Record<string, PipCoord[]> = {
  '2': [
    { x: 32, y: 16 },
    { x: 32, y: 80, invert: true },
  ],
  '3': [
    { x: 32, y: 15 },
    { x: 32, y: 48 },
    { x: 32, y: 81, invert: true },
  ],
  '4': [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 16, y: 80, invert: true },
    { x: 48, y: 80, invert: true },
  ],
  '5': [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 32, y: 48 },
    { x: 16, y: 80, invert: true },
    { x: 48, y: 80, invert: true },
  ],
  '6': [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 16, y: 48 },
    { x: 48, y: 48 },
    { x: 16, y: 80, invert: true },
    { x: 48, y: 80, invert: true },
  ],
  '7': [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 32, y: 32 },
    { x: 16, y: 48 },
    { x: 48, y: 48 },
    { x: 16, y: 80, invert: true },
    { x: 48, y: 80, invert: true },
  ],
  '8': [
    { x: 16, y: 16 },
    { x: 48, y: 16 },
    { x: 32, y: 32 },
    { x: 16, y: 48 },
    { x: 48, y: 48 },
    { x: 32, y: 64, invert: true },
    { x: 16, y: 80, invert: true },
    { x: 48, y: 80, invert: true },
  ],
  '9': [
    { x: 16, y: 13 },
    { x: 48, y: 13 },
    { x: 16, y: 36 },
    { x: 48, y: 36 },
    { x: 32, y: 48 },
    { x: 16, y: 60, invert: true },
    { x: 48, y: 60, invert: true },
    { x: 16, y: 83, invert: true },
    { x: 48, y: 83, invert: true },
  ],
  '10': [
    { x: 16, y: 13 },
    { x: 48, y: 13 },
    { x: 32, y: 24 },
    { x: 16, y: 36 },
    { x: 48, y: 36 },
    { x: 16, y: 60, invert: true },
    { x: 48, y: 60, invert: true },
    { x: 32, y: 72, invert: true },
    { x: 16, y: 83, invert: true },
    { x: 48, y: 83, invert: true },
  ],
};

const CardCenterFace: React.FC<{ card: PlayingCardType; size: 'xs' | 'sm' | 'md' | 'lg' }> = ({ card, size }) => {
  const courtUid = React.useId();
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const primary = isRed ? '#B91C1C' : '#111827';
  const accent = isRed ? '#D97706' : '#063B24';
  const foilGold = '#C59A2B';

  if (size === 'xs' || size === 'sm') {
    return (
      <div className="flex h-full w-full items-center justify-center" style={{ color: primary }}>
        <SuitVector suit={card.suit} className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-6 w-6'} />
      </div>
    );
  }

  // Aces: Ornate signature centerpiece matching Matatu Royale deck
  if (card.rank === 'A') {
    if (card.suit === 'spades') {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
            <rect
              x="5.5"
              y="5.5"
              width="53"
              height="85"
              rx="4"
              fill="none"
              stroke={foilGold}
              strokeOpacity="0.45"
              strokeWidth="0.95"
            />
            <rect
              x="8"
              y="8"
              width="48"
              height="80"
              rx="3"
              fill="none"
              stroke={foilGold}
              strokeOpacity="0.24"
              strokeWidth="0.6"
              strokeDasharray="1.8 1.4"
            />
            {/* Corner filigree flourishes */}
            <path d="M10 15 Q10 10 15 10 M54 15 Q54 10 49 10 M10 81 Q10 86 15 86 M54 81 Q54 86 49 86" fill="none" stroke={foilGold} strokeWidth="1.1" strokeOpacity="0.7" />
            <circle cx="32" cy="48" r="21.5" fill="none" stroke={foilGold} strokeWidth="1.2" strokeDasharray="2 1.6" />
            <circle cx="32" cy="48" r="18.2" fill="#FBF4DD" stroke={foilGold} strokeWidth="0.85" />
            {/* Ornate Gold-Trimmed Spade */}
            <g transform="translate(32 47.5) scale(1.78)" style={{ color: primary }}>
              <path d={SUIT_PATHS.spades} fill="currentColor" stroke={foilGold} strokeWidth="0.55" />
            </g>
            {/* Inner Gold Filigree Scrollwork on Spade */}
            <path d="M32 38 C29.5 42, 27.5 44.5, 29.5 48 C30.8 49.5, 32 48.2, 32 46.8 C32 48.2, 33.2 49.5, 34.5 48 C36.5 44.5, 34.5 42, 32 38 Z" fill="none" stroke="#F7D56B" strokeWidth="0.7" strokeOpacity="0.85" />
            {/* Gold Crown Crest above Ace of Spades */}
            <path
              d="M25 27.5 L26.5 22.8 L29.5 25.4 L32 21.2 L34.5 25.4 L37.5 22.8 L39 27.5 Z"
              fill={foilGold}
              stroke="#7A5A0F"
              strokeWidth="0.55"
            />
            <text
              x="32"
              y="76.5"
              textAnchor="middle"
              fontSize="4.0"
              fontWeight="800"
              letterSpacing="0.35"
              fill="#7A5A0F"
            >
              CASINO ROYALE
            </text>
          </svg>
        </div>
      );
    }

    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
          <rect
            x="6.5"
            y="6.5"
            width="51"
            height="83"
            rx="3.5"
            fill="none"
            stroke={foilGold}
            strokeOpacity="0.28"
            strokeWidth="0.75"
          />
          <circle cx="32" cy="48" r="18" fill="#FAF5E4" stroke={foilGold} strokeOpacity="0.55" strokeWidth="1" />
          <g transform="translate(32 48) scale(1.7)" style={{ color: primary }}>
            <path d={SUIT_PATHS[card.suit]} fill="currentColor" />
          </g>
        </svg>
      </div>
    );
  }

  // Court Cards (J, Q, K): Double-headed symmetrical Matatu Royale court illustration
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    const topClipId = `court_top_${courtUid}`;
    const botClipId = `court_bot_${courtUid}`;
    const robePrimary = card.rank === 'K' ? '#991B1B' : card.rank === 'Q' ? '#0F172A' : '#1E3A8A';
    const robeSecondary = card.rank === 'K' ? '#D97706' : card.rank === 'Q' ? '#B91C1C' : '#991B1B';
    const renderHalfCourt = (mirrored: boolean) => (
      <g transform={mirrored ? 'translate(64 96) rotate(180)' : undefined}>
        {/* Warm royal tapestry backdrop */}
        <path d="M11.5 9.5 H52.5 V47.5 H11.5 Z" fill="#FCF5E0" />
        <path d="M11.5 9.5 H52.5 V47.5 H11.5 Z" fill={accent} fillOpacity="0.07" />
        {/* Royal Robe & Gold Mantle */}
        <path d="M14 47.5 C15.5 34.5, 48.5 34.5, 50 47.5 Z" fill={robePrimary} stroke={foilGold} strokeWidth="1.05" />
        <path d="M21 47.5 C22.5 38, 41.5 38, 43 47.5 Z" fill={robeSecondary} stroke="#FDE68A" strokeWidth="0.75" />
        {/* Golden Collar & Sash */}
        <path d="M25 36.5 L32 46.5 L39 36.5 Z" fill="#FDE047" stroke="#78530A" strokeWidth="0.65" />
        <circle cx="32" cy="41.5" r="1.5" fill={primary} />

        {/* Sceptre / Royal Staff */}
        <line x1="18.5" y1="22" x2="17" y2="47" stroke={foilGold} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="18.5" cy="21" r="2.1" fill="#FFD76A" stroke="#78530A" strokeWidth="0.6" />

        {/* Royal Headgear: King Crown, Queen Tiara, Jack Cap */}
        {card.rank === 'K' && (
          <g>
            <path
              d="M22.5 25 L23.5 16 L28 21 L32 13.5 L36 21 L40.5 16 L41.5 25 Z"
              fill="#FACC15"
              stroke="#735109"
              strokeWidth="0.9"
            />
            <circle cx="32" cy="22.8" r="1.2" fill="#B91C1C" />
          </g>
        )}
        {card.rank === 'Q' && (
          <g>
            <path d="M23.5 28 C23.5 21, 27 17, 32 17 C37 17, 40.5 21, 40.5 28" fill="#1E293B" />
            <path
              d="M23.5 24.5 C25.5 18, 29 15.8, 32 14.2 C35 15.8, 38.5 18, 40.5 24.5 Z"
              fill="#FACC15"
              stroke="#735109"
              strokeWidth="0.9"
            />
            <circle cx="32" cy="21.5" r="1.1" fill="#059669" />
          </g>
        )}
        {card.rank === 'J' && (
          <g>
            <path
              d="M22.5 25 L25.5 16.5 L32 18.5 L38.5 16.5 L41.5 25 Z"
              fill={robePrimary}
              stroke={foilGold}
              strokeWidth="1"
            />
            <path d="M24 23 H40" stroke="#FFD76A" strokeWidth="1.3" />
          </g>
        )}

        {/* Noble Portrait Head & Hair Details */}
        <circle cx="32" cy="29.8" r="4.9" fill="#F4CFA0" stroke="#7A4E24" strokeWidth="0.85" />
        <circle cx="30.3" cy="29.3" r="0.65" fill="#1F2937" />
        <circle cx="33.7" cy="29.3" r="0.65" fill="#1F2937" />
        <path d="M30.7 31.8 Q32 32.8 33.3 31.8" fill="none" stroke="#7A4E24" strokeWidth="0.65" strokeLinecap="round" />

        {/* Corner Suit Medallions Inside Court Box */}
        <g transform="translate(46.5 17.5) scale(0.46)" style={{ color: primary }}>
          <path d={SUIT_PATHS[card.suit]} fill="currentColor" />
        </g>
      </g>
    );

    return (
      <div className="flex h-full w-full items-center justify-center px-0.5 py-0.5">
        <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
          <defs>
            <clipPath id={topClipId}>
              <rect x="11" y="9" width="42" height="39" rx="2" />
            </clipPath>
            <clipPath id={botClipId}>
              <rect x="11" y="48" width="42" height="39" rx="2" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${topClipId})`}>{renderHalfCourt(false)}</g>
          <g clipPath={`url(#${botClipId})`}>{renderHalfCourt(true)}</g>
          {/* Central Dividing Gold Sash */}
          <line x1="11" y1="48" x2="53" y2="48" stroke={foilGold} strokeWidth="1.3" />
          <polygon points="32,43.5 36.5,48 32,52.5 27.5,48" fill="#FFD76A" stroke="#735109" strokeWidth="0.75" />
          {/* Inner Double-Line Casino Court Frame */}
          <rect
            x="10.5"
            y="8.5"
            width="43"
            height="79"
            rx="3"
            fill="none"
            stroke={foilGold}
            strokeWidth="1.3"
          />
        </svg>
      </div>
    );
  }

  // Standard Number Cards (2–10): Classic Authentic Pip Matrix
  const coords = PIP_LAYOUTS[card.rank] || [{ x: 32, y: 48 }];
  const pipScale = card.rank === '9' || card.rank === '10' ? 0.66 : card.rank === '7' || card.rank === '8' ? 0.72 : 0.8;

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ color: primary }}>
      <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
        {coords.map((p, idx) => (
          <g
            key={`${card.id}_pip_${idx}`}
            transform={`translate(${p.x} ${p.y}) ${p.invert ? 'rotate(180)' : ''} scale(${pipScale})`}
          >
            <path d={SUIT_PATHS[card.suit]} fill="currentColor" />
          </g>
        ))}
      </svg>
    </div>
  );
};

const CardBackArtwork: React.FC<{ size: 'xs' | 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const uid = React.useId();
  const patternId = `amatatu_lattice_${uid}`;
  const compact = size === 'xs' || size === 'sm';
  const innerRadius =
    size === 'xs'
      ? 'rounded-[2px]'
      : size === 'sm'
      ? 'rounded-[5px]'
      : size === 'md'
      ? 'rounded-[6px]'
      : 'rounded-[8px]';

  return (
    <div className="h-full w-full rounded-[inherit] bg-gradient-to-b from-[#FFFEFB] to-[#EFE8D5] p-[3px] sm:p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div
        className={`relative h-full w-full overflow-hidden ${innerRadius} border border-[#C99B27]/80 bg-gradient-to-br from-[#08452A] via-[#042818] to-[#02140B] flex items-center justify-center`}
      >
        <svg viewBox="0 0 64 92" className="h-full w-full" aria-hidden="true">
          <defs>
            <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 4 0 L 8 4 L 4 8 L 0 4 Z" fill="none" stroke="#D4AF37" strokeOpacity="0.24" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect
            x="2"
            y="2"
            width="60"
            height="88"
            rx="3"
            fill={`url(#${patternId})`}
            stroke="#E6C45A"
            strokeWidth="1"
            strokeOpacity="0.72"
          />
          {!compact && (
            <rect
              x="5"
              y="5"
              width="54"
              height="82"
              rx="2"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="0.6"
              strokeOpacity="0.55"
            />
          )}
          {/* Center Emerald & Foil Gold Medallion */}
          <circle cx="32" cy="46" r={compact ? 12 : 15} fill="#032114" stroke="#F4D36A" strokeWidth="1.1" />
          <circle
            cx="32"
            cy="46"
            r={compact ? 9 : 11.5}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="0.6"
            strokeDasharray="2 1.5"
          />
          {/* Miniature Gold Crown */}
          <path
            d="M25 50 L23.5 42.5 L28 46 L32 40.5 L36 46 L40.5 42.5 L39 50 Z"
            fill="#FFD76A"
            stroke="#8C640E"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </div>
  );
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  selected = false,
  playable = false,
  dimmed = false,
  interactive = false,
  disabled = false,
  size = 'md',
  onClick,
  onDoubleClick,
  label,
  className = '',
}) => {
  if (faceDown || !card) {
    const Wrapper = onClick ? 'button' : 'div';
    return (
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        disabled={onClick ? disabled : undefined}
        aria-label={label || 'Face-down playing card'}
        className={`${SIZE_CLASSES[size]} ${
          onClick && !disabled ? 'cursor-pointer transition-transform duration-150 ease-out hover:-translate-y-1.5' : ''
        } relative overflow-hidden border border-[#CFC4A8] shadow-[0_10px_24px_rgba(0,0,0,0.68),0_2px_6px_rgba(0,0,0,0.45)] select-none shrink-0 ${className}`}
      >
        <CardBackArtwork size={size} />
      </Wrapper>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitTextColor = isRed ? 'text-[#C81E1E]' : 'text-[#0F172A]';
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  const interactiveClasses = onClick
    ? disabled
      ? 'cursor-default'
      : 'cursor-pointer hover:-translate-y-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7AE000]'
    : interactive
    ? 'transition-transform duration-150 ease-out hover:-translate-y-2'
    : '';

  const stateClasses = selected
    ? 'ring-2 ring-[#F5B800] -translate-y-4 shadow-[0_20px_34px_rgba(0,0,0,0.75),0_0_22px_rgba(245,184,0,0.45)] border-[#F5B800]'
    : playable
    ? 'ring-2 ring-[#7AE000] -translate-y-2 border-[#7AE000] shadow-[0_14px_26px_rgba(0,0,0,0.65),0_0_18px_rgba(122,224,0,0.34)]'
    : dimmed
    ? 'opacity-65 hover:opacity-95 border-[#CBD5E1] shadow-[0_8px_16px_rgba(0,0,0,0.45)]'
    : 'border-[#D7CCB2] shadow-[0_12px_24px_rgba(0,0,0,0.62),0_2px_6px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.95)]';

  const Tag = onClick ? 'button' : 'div';
  const indexPadding = size === 'xs' ? 'p-1' : size === 'sm' ? 'p-1.5' : 'px-1.5 py-1.5 sm:px-2 sm:py-2';
  const centerInset =
    size === 'xs' || size === 'sm'
      ? 'inset-x-2 inset-y-2.5'
      : 'inset-x-3.5 sm:inset-x-4 inset-y-2.5 sm:inset-y-3';
  const innerLineRadius =
    size === 'xs'
      ? 'rounded-[2px]'
      : size === 'sm'
      ? 'rounded-[5px]'
      : size === 'md'
      ? 'rounded-[7px]'
      : 'rounded-[9px]';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={onClick ? disabled : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={`${card.rank} of ${card.suit} (${suitSymbol})${playable ? ' — Playable' : ''}${selected ? ' — Selected' : ''}`}
      className={`${SIZE_CLASSES[size]} ${interactiveClasses} ${stateClasses} relative bg-gradient-to-b from-[#FFFFFF] via-[#FDFBF7] to-[#F4EFE0] ${indexPadding} text-left transition-[transform,box-shadow,opacity] duration-150 ease-out border select-none shrink-0 ${className}`}
    >
      {/* Subtle Paper Edge Hairline */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[3px] ${innerLineRadius} border border-[#E5DEC9]/80`}
      />

      {/* Top-Left Casino Index */}
      <div className={`relative z-10 flex flex-col items-center leading-none w-fit ${suitTextColor}`}>
        <span className="font-casino font-extrabold tracking-tight text-[1.15em] leading-[0.95]">{card.rank}</span>
        <SuitVector
          suit={card.suit}
          className={size === 'xs' ? 'h-2 w-2 mt-0.5' : size === 'sm' ? 'h-2.5 w-2.5 mt-0.5' : size === 'lg' ? 'h-3.5 w-3.5 mt-0.5' : 'h-3 w-3 mt-0.5'}
        />
      </div>

      {/* Interior Precision Pip / Court / Ace Canvas */}
      <div aria-hidden="true" className={`pointer-events-none absolute ${centerInset}`}>
        <CardCenterFace card={card} size={size} />
      </div>

      {/* Bottom-Right Mirrored Casino Index */}
      {size !== 'xs' && (
        <div className={`absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10 flex flex-col items-center leading-none w-fit rotate-180 ${suitTextColor}`}>
          <span className="font-casino font-extrabold tracking-tight text-[1.15em] leading-[0.95]">{card.rank}</span>
          <SuitVector
            suit={card.suit}
            className={size === 'sm' ? 'h-2.5 w-2.5 mt-0.5' : size === 'lg' ? 'h-3.5 w-3.5 mt-0.5' : 'h-3 w-3 mt-0.5'}
          />
        </div>
      )}
    </Tag>
  );
};
