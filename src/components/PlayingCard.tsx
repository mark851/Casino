import React from 'react';
import { SUIT_SYMBOLS } from '../shared/matatuRules';
import type { PlayingCard as PlayingCardType, Suit } from '../shared/types';

export type CardDeckVariant = 'royale' | 'blitz' | 'classic';

interface PlayingCardProps {
  card?: PlayingCardType;
  faceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: CardDeckVariant;
  onClick?: () => void;
  onDoubleClick?: () => void;
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-7 h-10 rounded-[4px] text-[9px]',
  sm: 'w-14 h-20 rounded-lg text-xs',
  md: 'w-[84px] h-[120px] sm:w-[98px] sm:h-[140px] rounded-[10px] text-sm',
  lg: 'w-[104px] h-[148px] sm:w-[122px] sm:h-[174px] rounded-xl text-base',
};

const SUIT_PATHS: Record<Suit, string> = {
  spades:
    'M 0 -8.8 C -3.8 -4.4, -7.8 -1.3, -7.8 2.4 C -7.8 5.2, -5.5 6.8, -3.1 6.8 C -1.7 6.8, -0.7 6.1, -0.3 5.2 L -2.3 8.8 L 2.3 8.8 L 0.3 5.2 C 0.7 6.1, 1.7 6.8, 3.1 6.8 C 5.5 6.8, 7.8 5.2, 7.8 2.4 C 7.8 -1.3, 3.8 -4.4, 0 -8.8 Z',
  hearts:
    'M 0 8.2 C -0.4 7.8, -8.2 2.2, -8.2 -2.6 C -8.2 -5.8, -5.6 -8.0, -2.7 -8.0 C -1.1 -8.0, -0.2 -7.0, 0 -5.6 C 0.2 -7.0, 1.1 -8.0, 2.7 -8.0 C 5.6 -8.0, 8.2 -5.8, 8.2 -2.6 C 8.2 2.2, 0.4 7.8, 0 8.2 Z',
  diamonds:
    'M 0 -9.0 L 6.8 0 L 0 9.0 L -6.8 0 Z',
  clubs:
    'M 0 -8.5 C -2.3 -8.5, -4.0 -6.7, -4.0 -4.5 C -4.0 -3.2, -3.4 -2.1, -2.4 -1.4 C -4.8 -1.7, -7.6 -0.2, -7.6 2.5 C -7.6 4.9, -5.6 6.6, -3.3 6.6 C -1.8 6.6, -0.7 5.7, -0.3 4.6 L -2.1 8.6 L 2.1 8.6 L 0.3 4.6 C 0.7 5.7, 1.8 6.6, 3.3 6.6 C 5.6 6.6, 7.6 4.9, 7.6 2.5 C 7.6 -0.2, 4.8 -1.7, 2.4 -1.4 C 3.4 -2.1, 4.0 -3.2, 4.0 -4.5 C 4.0 -6.7, 2.3 -8.5, 0 -8.5 Z',
};

const SuitVector: React.FC<{
  suit: Suit;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
}> = ({ suit, className, strokeColor, strokeWidth = 0 }) => (
  <svg viewBox="-10 -10 20 20" className={className} aria-hidden="true">
    <path
      d={SUIT_PATHS[suit]}
      fill="currentColor"
      stroke={strokeColor}
      strokeWidth={strokeWidth || undefined}
      strokeLinejoin="round"
    />
  </svg>
);

interface PipCoord {
  x: number;
  y: number;
  invert?: boolean;
}

const PIP_LAYOUTS: Record<string, PipCoord[]> = {
  '2': [
    { x: 32, y: 17 },
    { x: 32, y: 79, invert: true },
  ],
  '3': [
    { x: 32, y: 15 },
    { x: 32, y: 48 },
    { x: 32, y: 81, invert: true },
  ],
  '4': [
    { x: 17, y: 17 },
    { x: 47, y: 17 },
    { x: 17, y: 79, invert: true },
    { x: 47, y: 79, invert: true },
  ],
  '5': [
    { x: 17, y: 17 },
    { x: 47, y: 17 },
    { x: 32, y: 48 },
    { x: 17, y: 79, invert: true },
    { x: 47, y: 79, invert: true },
  ],
  '6': [
    { x: 17, y: 16 },
    { x: 47, y: 16 },
    { x: 17, y: 48 },
    { x: 47, y: 48 },
    { x: 17, y: 80, invert: true },
    { x: 47, y: 80, invert: true },
  ],
  '7': [
    { x: 17, y: 16 },
    { x: 47, y: 16 },
    { x: 32, y: 32 },
    { x: 17, y: 48 },
    { x: 47, y: 48 },
    { x: 17, y: 80, invert: true },
    { x: 47, y: 80, invert: true },
  ],
  '8': [
    { x: 17, y: 16 },
    { x: 47, y: 16 },
    { x: 32, y: 32 },
    { x: 17, y: 48 },
    { x: 47, y: 48 },
    { x: 32, y: 64, invert: true },
    { x: 17, y: 80, invert: true },
    { x: 47, y: 80, invert: true },
  ],
  '9': [
    { x: 17, y: 13 },
    { x: 47, y: 13 },
    { x: 17, y: 36 },
    { x: 47, y: 36 },
    { x: 32, y: 48 },
    { x: 17, y: 60, invert: true },
    { x: 47, y: 60, invert: true },
    { x: 17, y: 83, invert: true },
    { x: 47, y: 83, invert: true },
  ],
  '10': [
    { x: 17, y: 13 },
    { x: 47, y: 13 },
    { x: 32, y: 24 },
    { x: 17, y: 36 },
    { x: 47, y: 36 },
    { x: 17, y: 60, invert: true },
    { x: 47, y: 60, invert: true },
    { x: 32, y: 72, invert: true },
    { x: 17, y: 83, invert: true },
    { x: 47, y: 83, invert: true },
  ],
};

const CardCenterFace: React.FC<{
  card: PlayingCardType;
  size: 'xs' | 'sm' | 'md' | 'lg';
  variant: CardDeckVariant;
}> = ({ card, size, variant }) => {
  const courtUid = React.useId().replace(/:/g, '');
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isBlitz = variant === 'blitz';
  const isBlitzObsidian = isBlitz && !isRed;

  const primary = isRed ? (isBlitz ? '#C8141C' : '#B91C1C') : isBlitzObsidian ? '#0D1310' : '#111827';
  const foilGold = isBlitz ? '#E7B941' : '#C59A2B';
  const brightGold = '#FFE074';
  const robeCrimson = '#9E1B1E';
  const robeNavy = '#172554';

  if (variant === 'classic') {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`classicRed_${courtUid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F52222" />
              <stop offset="55%" stopColor="#DC1414" />
              <stop offset="100%" stopColor="#A60B0B" />
            </linearGradient>
            <linearGradient id={`classicBlack_${courtUid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#262626" />
              <stop offset="60%" stopColor="#0D0D0D" />
              <stop offset="100%" stopColor="#020202" />
            </linearGradient>
          </defs>
          <g transform="translate(32 48) scale(2.15)">
            <path
              d={SUIT_PATHS[card.suit]}
              fill={isRed ? `url(#classicRed_${courtUid})` : `url(#classicBlack_${courtUid})`}
            />
          </g>
        </svg>
      </div>
    );
  }

  if (size === 'xs' || size === 'sm') {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ color: isBlitzObsidian ? '#101914' : primary }}
      >
        <SuitVector
          suit={card.suit}
          className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-6 w-6'}
          strokeColor={isBlitzObsidian ? '#EAB948' : undefined}
          strokeWidth={isBlitzObsidian ? 0.9 : 0}
        />
      </div>
    );
  }

  // Aces: Ornate signature centerpiece matching Matatu Royale & Blitz icons
  if (card.rank === 'A') {
    if (card.suit === 'spades') {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
            <defs>
              <radialGradient id={`spadeAura_${courtUid}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={isBlitz ? '#4D3C0E' : '#FFFDF2'} stopOpacity="0.95" />
                <stop offset="70%" stopColor={isBlitz ? '#131C16' : '#FBF2D8'} stopOpacity="0.88" />
                <stop offset="100%" stopColor={isBlitz ? '#080F0B' : '#F3E7C4'} stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect
              x="5.5"
              y="5.5"
              width="53"
              height="85"
              rx="4"
              fill="none"
              stroke={foilGold}
              strokeOpacity={isBlitz ? '0.72' : '0.45'}
              strokeWidth="1"
            />
            <rect
              x="8.2"
              y="8.2"
              width="47.6"
              height="79.6"
              rx="3"
              fill="none"
              stroke={foilGold}
              strokeOpacity="0.28"
              strokeWidth="0.65"
              strokeDasharray="2 1.4"
            />
            {/* Corner filigree flourishes */}
            <path
              d="M10 15 Q10 10 15 10 M54 15 Q54 10 49 10 M10 81 Q10 86 15 86 M54 81 Q54 86 49 86"
              fill="none"
              stroke={foilGold}
              strokeWidth="1.2"
              strokeOpacity="0.82"
            />
            <circle cx="32" cy="48" r="22.5" fill={`url(#spadeAura_${courtUid})`} />
            <circle cx="32" cy="48" r="21.5" fill="none" stroke={foilGold} strokeWidth="1.25" strokeDasharray="2.1 1.6" />
            <circle
              cx="32"
              cy="48"
              r="18.2"
              fill={isBlitz ? '#0B1610' : '#FBF4DD'}
              stroke={foilGold}
              strokeWidth="0.95"
            />
            {/* Ornate Gold-Trimmed Ace Spade */}
            <g transform="translate(32 48.5) scale(1.88)" style={{ color: isBlitz ? '#060A08' : '#0F172A' }}>
              <path d={SUIT_PATHS.spades} fill="currentColor" stroke={brightGold} strokeWidth="0.62" />
            </g>
            {/* Inner Gold Filigree Scrollwork on Spade */}
            <path
              d="M32 37.5 C28.8 42.2, 26.5 45.2, 28.8 49.2 C30.4 51, 32 49.4, 32 47.6 C32 49.4, 33.6 51, 35.2 49.2 C37.5 45.2, 35.2 42.2, 32 37.5 Z"
              fill="none"
              stroke="#FFE074"
              strokeWidth="0.78"
              strokeOpacity="0.92"
            />
            <circle cx="32" cy="44.2" r="1.2" fill="#FFE074" />
            {/* Gold Crown Crest above Ace of Spades */}
            <path
              d="M24.5 27.5 L26.2 22.3 L29.4 25.2 L32 20.5 L34.6 25.2 L37.8 22.3 L39.5 27.5 Z"
              fill={brightGold}
              stroke="#7A5A0F"
              strokeWidth="0.6"
            />
            <text
              x="32"
              y="77"
              textAnchor="middle"
              fontSize="3.9"
              fontWeight="800"
              letterSpacing="0.4"
              fill={isBlitz ? '#FFD76A' : '#7A5A0F'}
            >
              {isBlitz ? 'MATATU BLITZ' : 'MATATU ROYALE'}
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
            strokeOpacity={isBlitz ? '0.68' : '0.32'}
            strokeWidth="0.9"
          />
          <circle
            cx="32"
            cy="48"
            r="19"
            fill={isBlitzObsidian ? '#0D1712' : '#FAF5E4'}
            stroke={foilGold}
            strokeOpacity="0.65"
            strokeWidth="1.05"
          />
          <g transform="translate(32 48) scale(1.75)" style={{ color: primary }}>
            <path
              d={SUIT_PATHS[card.suit]}
              fill="currentColor"
              stroke={isBlitz ? foilGold : undefined}
              strokeWidth={isBlitz ? 0.48 : 0}
            />
          </g>
          {isRed && (
            <path
              d="M27.5 42.5 L31.2 45.2 L29.2 48.2 Z"
              fill="#FCA5A5"
              fillOpacity="0.45"
            />
          )}
        </svg>
      </div>
    );
  }

  // Court Cards (J, Q, K): Detailed Double-Headed Illustrated Royal Portraits
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') {
    const topClipId = `court_top_${courtUid}`;
    const botClipId = `court_bot_${courtUid}`;
    const robePrimary =
      card.rank === 'K' ? (isRed ? robeCrimson : robeNavy) : card.rank === 'Q' ? (isRed ? '#881337' : '#0F172A') : isRed ? '#991B1B' : '#1E3A8A';
    const robeSecondary = card.rank === 'K' ? '#D97706' : card.rank === 'Q' ? '#B91C1C' : '#047857';
    const courtBg = isBlitzObsidian ? '#101B15' : '#FCF4DD';
    const inkStroke = isBlitzObsidian ? '#D4AF37' : '#3B2810';

    const renderHalfCourt = (mirrored: boolean) => (
      <g transform={mirrored ? 'translate(64 96) rotate(180)' : undefined}>
        {/* Royal Tapestry Field + Filigree Arc */}
        <rect x="10.5" y="9" width="43" height="39" fill={courtBg} />
        <path
          d="M11 47 C18 35, 46 35, 53 47"
          fill={isBlitzObsidian ? '#1C2E24' : '#F3E3B8'}
          fillOpacity="0.55"
        />
        <circle
          cx="32"
          cy="27"
          r="15"
          fill="none"
          stroke={foilGold}
          strokeOpacity="0.25"
          strokeWidth="0.6"
          strokeDasharray="1.5 1.5"
        />

        {/* Flowing Shoulder Cape + Robes */}
        <path
          d="M11.5 47.5 C12.5 34.5, 22 33.5, 32 34.2 C42 33.5, 51.5 34.5, 52.5 47.5 Z"
          fill={robePrimary}
          stroke={foilGold}
          strokeWidth="1"
        />
        {/* Ermine White Collar Trim with Dark Dots */}
        <path
          d="M21 36.2 Q32 39.2 43 36.2 L40.5 41.5 Q32 43.2 23.5 41.5 Z"
          fill="#FFFDF5"
          stroke={foilGold}
          strokeWidth="0.65"
        />
        <circle cx="25.5" cy="39" r="0.65" fill="#1F2937" />
        <circle cx="32" cy="40.2" r="0.65" fill="#1F2937" />
        <circle cx="38.5" cy="39" r="0.65" fill="#1F2937" />

        {/* Inner Tunic + Golden Brocade */}
        <path d="M24 47.5 L26.2 40.5 L32 45.2 L37.8 40.5 L40 47.5 Z" fill={robeSecondary} stroke="#FDE68A" strokeWidth="0.6" />
        <path d="M28 41.2 L32 46.8 L36 41.2" fill="none" stroke="#FDE047" strokeWidth="0.9" />
        <circle cx="32" cy="44" r="1.3" fill={isRed ? '#EF4444' : '#10B981'} stroke="#FDE047" strokeWidth="0.45" />

        {/* Royal Weapon / Sceptre on Left Side */}
        <line x1="17.2" y1="19" x2="15.8" y2="47.2" stroke={foilGold} strokeWidth="1.45" strokeLinecap="round" />
        <circle cx="17.2" cy="18.2" r="2.2" fill={brightGold} stroke="#78530A" strokeWidth="0.55" />
        {card.rank === 'K' && (
          <path d="M17.2 14.5 V18.2 M15.3 16.3 H19.1" stroke="#FFF4B8" strokeWidth="0.7" />
        )}

        {/* Hair Back Locks */}
        {card.rank === 'Q' ? (
          <path
            d="M24.2 31 C23 23.5, 26.5 18.2, 32 18.2 C37.5 18.2, 41 23.5, 39.8 31 C39.5 34.5, 37.5 35.5, 36.2 35 L27.8 35 C26.5 35.5, 24.5 34.5, 24.2 31 Z"
            fill="#451A03"
          />
        ) : (
          <path
            d="M25.5 31.5 C25 24, 27.5 19.5, 32 19.5 C36.5 19.5, 39 24, 38.5 31.5 Z"
            fill={card.rank === 'K' ? '#78350F' : '#292524'}
          />
        )}

        {/* Detailed Royal Face with Eyes, Nose, Brows, Beard/Lips */}
        <ellipse cx="32" cy="29.4" rx="5.1" ry="5.6" fill="#F2C794" stroke="#7A4E24" strokeWidth="0.7" />
        {/* Eyebrows */}
        <path d="M28.6 27.2 Q30 26.5 31.2 27.2 M32.8 27.2 Q34 26.5 35.4 27.2" fill="none" stroke="#451A03" strokeWidth="0.55" strokeLinecap="round" />
        {/* Eyes */}
        <circle cx="30" cy="28.6" r="0.68" fill="#1F2937" />
        <circle cx="34" cy="28.6" r="0.68" fill="#1F2937" />
        {/* Nose & Cheek Shading */}
        <path d="M32 28.5 L31.5 30.8 L32.6 31" fill="none" stroke="#B47644" strokeWidth="0.5" strokeLinecap="round" />
        {card.rank === 'K' ? (
          <>
            {/* King Royal Beard & Moustache */}
            <path
              d="M27.3 31 C27.8 34.8, 30 36.2, 32 36.4 C34 36.2, 36.2 34.8, 36.7 31.2 C35 32.4, 33.4 31.8, 32 31.8 C30.6 31.8, 29 32.4, 27.3 31 Z"
              fill="#5C2D0C"
            />
            <path d="M29.4 32.1 Q32 31.1 34.6 32.1" fill="none" stroke="#3B1A06" strokeWidth="0.6" strokeLinecap="round" />
          </>
        ) : card.rank === 'Q' ? (
          <>
            <path d="M30.5 32.5 Q32 33.4 33.5 32.5" fill="none" stroke="#B91C1C" strokeWidth="0.8" strokeLinecap="round" />
            <circle cx="26.8" cy="31.5" r="0.8" fill="#FDE047" />
            <circle cx="37.2" cy="31.5" r="0.8" fill="#FDE047" />
          </>
        ) : (
          <>
            <path d="M29.8 32 Q32 31.2 34.2 32" fill="none" stroke="#3B1A06" strokeWidth="0.65" strokeLinecap="round" />
            <path d="M30.8 33.1 Q32 33.7 33.2 33.1" fill="none" stroke="#9A3412" strokeWidth="0.55" strokeLinecap="round" />
          </>
        )}

        {/* Royal Headgear */}
        {card.rank === 'K' && (
          <g>
            <path
              d="M23.5 24.4 L24.5 16.2 L28.2 20.5 L32 13.8 L35.8 20.5 L39.5 16.2 L40.5 24.4 Z"
              fill="#FACC15"
              stroke="#735109"
              strokeWidth="0.8"
            />
            <rect x="23.5" y="23.2" width="17" height="2.2" rx="0.6" fill="#D97706" stroke="#735109" strokeWidth="0.5" />
            <circle cx="32" cy="24.2" r="1.05" fill="#DC2626" />
            <circle cx="27.2" cy="24.2" r="0.8" fill="#10B981" />
            <circle cx="36.8" cy="24.2" r="0.8" fill="#10B981" />
          </g>
        )}
        {card.rank === 'Q' && (
          <g>
            <path
              d="M24.2 24 C25.8 17.5, 29 15.2, 32 14 C35 15.2, 38.2 17.5, 39.8 24 Z"
              fill="#FDE047"
              stroke="#735109"
              strokeWidth="0.75"
            />
            <circle cx="32" cy="20.4" r="1.15" fill="#059669" />
            <circle cx="28" cy="21.8" r="0.75" fill="#DC2626" />
            <circle cx="36" cy="21.8" r="0.75" fill="#DC2626" />
          </g>
        )}
        {card.rank === 'J' && (
          <g>
            <path
              d="M23.5 24.2 C24.5 17.2, 28 15.5, 32 15.5 C36 15.5, 39.5 17.2, 40.5 24.2 Z"
              fill={robePrimary}
              stroke={foilGold}
              strokeWidth="0.85"
            />
            <path d="M36.5 18 C40 15.2, 43.5 16, 44.5 19" fill="none" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M23.5 22.8 H40.5" stroke="#FFD76A" strokeWidth="1.4" />
          </g>
        )}

        {/* Corner Suit Medallion Inside Portrait Frame */}
        <g transform="translate(46.5 16.5) scale(0.46)" style={{ color: isBlitzObsidian ? '#FDE047' : primary }}>
          <path d={SUIT_PATHS[card.suit]} fill="currentColor" stroke={inkStroke} strokeWidth="0.35" />
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
          <line x1="10.5" y1="48" x2="53.5" y2="48" stroke={foilGold} strokeWidth="1.35" />
          <polygon points="32,43.5 36.5,48 32,52.5 27.5,48" fill="#FFD76A" stroke="#735109" strokeWidth="0.75" />
          {/* Inner Double-Line Casino Court Frame */}
          <rect
            x="10.2"
            y="8.4"
            width="43.6"
            height="79.2"
            rx="3"
            fill="none"
            stroke={foilGold}
            strokeWidth="1.4"
          />
          <rect
            x="8.2"
            y="6.6"
            width="47.6"
            height="82.8"
            rx="3.8"
            fill="none"
            stroke={foilGold}
            strokeOpacity="0.35"
            strokeWidth="0.65"
          />
        </svg>
      </div>
    );
  }

  // Number Cards (2–10): Classic Pip Matrix (with Blitz Obsidian-Gold & Faceted Ruby finish)
  const coords = PIP_LAYOUTS[card.rank] || [{ x: 32, y: 48 }];
  const pipScale =
    card.rank === '9' || card.rank === '10' ? 0.68 : card.rank === '7' || card.rank === '8' ? 0.74 : 0.84;

  return (
    <div className="flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 64 96" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={`rubyFacet_${courtUid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="45%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7F1D1D" />
          </linearGradient>
          <linearGradient id={`obsidianPip_${courtUid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1F2937" />
            <stop offset="50%" stopColor="#080D0A" />
            <stop offset="100%" stopColor="#020403" />
          </linearGradient>
        </defs>

        {isBlitz && (
          <>
            <rect
              x="7.5"
              y="7.5"
              width="49"
              height="81"
              rx="3"
              fill="none"
              stroke={foilGold}
              strokeOpacity="0.48"
              strokeWidth="0.85"
            />
            {isRed ? (
              /* Filigree Scroll Crest matching the 7 of Diamonds in Matatu Blitz Icon */
              <g opacity="0.52" stroke={foilGold} fill="none" strokeWidth="0.75">
                <circle cx="32" cy="52" r="10.5" strokeDasharray="1.8 1.4" />
                <path d="M23 52 Q32 41 41 52 Q32 63 23 52 Z" />
              </g>
            ) : (
              /* Electric Gold Star Glint matching the 2 of Spades in Matatu Blitz Icon */
              <g opacity="0.85">
                <path
                  d="M32 39 L33.6 46.2 L40.8 48 L33.6 49.8 L32 57 L30.4 49.8 L23.2 48 L30.4 46.2 Z"
                  fill="#FFE27A"
                  fillOpacity="0.72"
                />
                <circle cx="32" cy="48" r="1.8" fill="#FFFBEB" />
              </g>
            )}
          </>
        )}

        {coords.map((p, idx) => (
          <g
            key={`${card.id}_pip_${idx}`}
            transform={`translate(${p.x} ${p.y}) ${p.invert ? 'rotate(180)' : ''} scale(${pipScale})`}
          >
            <path
              d={SUIT_PATHS[card.suit]}
              fill={
                isBlitz
                  ? isRed
                    ? `url(#rubyFacet_${courtUid})`
                    : `url(#obsidianPip_${courtUid})`
                  : primary
              }
              stroke={isBlitz ? (isRed ? '#D99B26' : '#F3CA52') : undefined}
              strokeWidth={isBlitz ? (isRed ? 0.52 : 0.95) : 0}
              strokeLinejoin="round"
            />
            {isBlitz && isRed && card.suit === 'diamonds' && (
              <path d="M0 -8.2 L3.2 0 L0 8.2 L-3.2 0 Z" fill="#FCA5A5" fillOpacity="0.28" />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};

const CardBackArtwork: React.FC<{ size: 'xs' | 'sm' | 'md' | 'lg'; variant: CardDeckVariant }> = ({
  size,
  variant,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const patternId = `matatu_lattice_${uid}`;
  const compact = size === 'xs' || size === 'sm';
  const isBlitz = variant === 'blitz';
  const innerRadius =
    size === 'xs'
      ? 'rounded-[2px]'
      : size === 'sm'
      ? 'rounded-[5px]'
      : size === 'md'
      ? 'rounded-[6px]'
      : 'rounded-[8px]';

  if (variant === 'classic') {
    const innerRadiusClassic =
      size === 'xs' ? 'rounded-[2px]' : size === 'sm' ? 'rounded-[4px]' : 'rounded-[6px]';
    return (
      <div className="h-full w-full rounded-[inherit] bg-[#F8FAFC] p-[3px] shadow-[inset_0_1px_0_#FFFFFF]">
        <div
          className={`relative h-full w-full overflow-hidden ${innerRadiusClassic} border border-[#5B6878] bg-gradient-to-br from-[#8896A6] via-[#677688] to-[#4D5B6D] flex items-center justify-center`}
        >
          <svg viewBox="0 0 64 92" className="h-full w-full" aria-hidden="true">
            <defs>
              <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 5 0 Q 10 5 5 10 Q 0 5 5 0 Z"
                  fill="none"
                  stroke="#E2E8F0"
                  strokeOpacity="0.45"
                  strokeWidth="0.7"
                />
                <circle cx="5" cy="5" r="1.2" fill="#E2E8F0" fillOpacity="0.35" />
              </pattern>
            </defs>
            <rect
              x="2.5"
              y="2.5"
              width="59"
              height="87"
              rx="2.5"
              fill={`url(#${patternId})`}
              stroke="#E2E8F0"
              strokeWidth="1.1"
              strokeOpacity="0.85"
            />
            <rect
              x="6"
              y="6"
              width="52"
              height="80"
              rx="2"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
            {/* Symmetric Bicycle-style Scrollwork Medallions */}
            <circle cx="32" cy="27" r="10.5" fill="#5A697B" stroke="#E2E8F0" strokeWidth="1" />
            <circle cx="32" cy="65" r="10.5" fill="#5A697B" stroke="#E2E8F0" strokeWidth="1" />
            <circle cx="32" cy="46" r="12.5" fill="#475569" stroke="#F1F5F9" strokeWidth="1.1" />
            <circle cx="32" cy="46" r="7.5" fill="none" stroke="#E2E8F0" strokeWidth="0.8" strokeDasharray="1.8 1.3" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-full w-full rounded-[inherit] p-[3px] sm:p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${
        isBlitz
          ? 'bg-gradient-to-b from-[#FDE68A] via-[#D4AF37] to-[#8C6410]'
          : 'bg-gradient-to-b from-[#FFFEFB] to-[#EFE8D5]'
      }`}
    >
      <div
        className={`relative h-full w-full overflow-hidden ${innerRadius} border ${
          isBlitz
            ? 'border-[#FFD76A]/85 bg-gradient-to-br from-[#0F1813] via-[#050A07] to-[#020503]'
            : 'border-[#C99B27]/80 bg-gradient-to-br from-[#08452A] via-[#042818] to-[#02140B]'
        } flex items-center justify-center`}
      >
        <svg viewBox="0 0 64 92" className="h-full w-full" aria-hidden="true">
          <defs>
            <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
              <path
                d="M 4 0 L 8 4 L 4 8 L 0 4 Z"
                fill="none"
                stroke={isBlitz ? '#FFD76A' : '#D4AF37'}
                strokeOpacity={isBlitz ? '0.32' : '0.24'}
                strokeWidth="0.65"
              />
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
            strokeWidth="1.05"
            strokeOpacity="0.82"
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
              strokeWidth="0.65"
              strokeOpacity="0.6"
            />
          )}
          <circle
            cx="32"
            cy="46"
            r={compact ? 12 : 15}
            fill={isBlitz ? '#09110D' : '#032114'}
            stroke="#F4D36A"
            strokeWidth="1.15"
          />
          <circle
            cx="32"
            cy="46"
            r={compact ? 9 : 11.5}
            fill="none"
            stroke={isBlitz ? '#9CE800' : '#D4AF37'}
            strokeOpacity={isBlitz ? '0.75' : '0.9'}
            strokeWidth="0.65"
            strokeDasharray="2 1.5"
          />
          {isBlitz ? (
            <path
              d="M34 37.5 L27.5 47 H32.2 L30 54.5 L36.8 44.8 H32.1 Z"
              fill="#FFD76A"
              stroke="#7A5608"
              strokeWidth="0.45"
            />
          ) : (
            <path
              d="M25 50 L23.5 42.5 L28 46 L32 40.5 L36 46 L40.5 42.5 L39 50 Z"
              fill="#FFD76A"
              stroke="#8C640E"
              strokeWidth="0.5"
            />
          )}
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
  variant = 'royale',
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
        <CardBackArtwork size={size} variant={variant} />
      </Wrapper>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isClassic = variant === 'classic';
  const isBlitzObsidian = variant === 'blitz' && !isRed;
  const suitTextColor = isRed
    ? isClassic
      ? 'text-[#DC1414]'
      : 'text-[#C81E1E]'
    : isBlitzObsidian
    ? 'text-[#FFD96E]'
    : 'text-[#111111]';
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
    ? isClassic
      ? 'ring-2 ring-[#16A34A] -translate-y-2 border-[#1F2937] shadow-[0_12px_22px_rgba(0,0,0,0.45),0_0_14px_rgba(22,163,74,0.42)]'
      : 'ring-2 ring-[#7AE000] -translate-y-2 border-[#7AE000] shadow-[0_14px_26px_rgba(0,0,0,0.65),0_0_18px_rgba(122,224,0,0.34)]'
    : dimmed
    ? 'opacity-65 hover:opacity-95 border-[#CBD5E1] shadow-[0_8px_16px_rgba(0,0,0,0.45)]'
    : isClassic
    ? 'border-[#2D2D2D] shadow-[0_6px_14px_rgba(0,0,0,0.42)]'
    : isBlitzObsidian
    ? 'border-[#D4AF37]/85 shadow-[0_14px_28px_rgba(0,0,0,0.76),inset_0_1px_0_rgba(255,215,106,0.35)]'
    : 'border-[#D7CCB2] shadow-[0_12px_24px_rgba(0,0,0,0.62),0_2px_6px_rgba(0,0,0,0.38),inset_0_1px_0_rgba(255,255,255,0.95)]';

  const cardBgClass = isClassic
    ? 'bg-[#FFFFFF]'
    : isBlitzObsidian
    ? 'bg-gradient-to-b from-[#17231C] via-[#0B120E] to-[#050806]'
    : variant === 'blitz'
    ? 'bg-gradient-to-b from-[#FFFDF7] via-[#FBF5E4] to-[#EFE2C1]'
    : 'bg-gradient-to-b from-[#FFFFFF] via-[#FDFBF7] to-[#F4EFE0]';

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
      className={`${SIZE_CLASSES[size]} ${interactiveClasses} ${stateClasses} relative ${cardBgClass} ${indexPadding} text-left transition-[transform,box-shadow,opacity] duration-150 ease-out border select-none shrink-0 ${className}`}
    >
      {/* Subtle Paper / Foil Edge Hairline */}
      {!isClassic && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-[3px] ${innerLineRadius} border ${
            variant === 'blitz' ? 'border-[#D4AF37]/55' : 'border-[#E5DEC9]/80'
          }`}
        />
      )}

      {/* Top-Left Casino Index */}
      <div className={`relative z-10 flex flex-col items-center leading-none w-fit ${suitTextColor}`}>
        <span
          className={`font-casino font-extrabold leading-[0.95] ${
            isClassic && card.rank === '10'
              ? 'tracking-[-0.09em] text-[1.02em]'
              : 'tracking-tight text-[1.15em]'
          }`}
        >
          {card.rank}
        </span>
        <SuitVector
          suit={card.suit}
          className={
            size === 'xs'
              ? 'h-2 w-2 mt-0.5'
              : size === 'sm'
              ? 'h-2.5 w-2.5 mt-0.5'
              : size === 'lg'
              ? 'h-3.5 w-3.5 mt-0.5'
              : 'h-3 w-3 mt-0.5'
          }
          strokeColor={isBlitzObsidian ? '#A37B1A' : undefined}
          strokeWidth={isBlitzObsidian ? 0.5 : 0}
        />
      </div>

      {/* Interior Precision Pip / Court / Ace Canvas */}
      <div aria-hidden="true" className={`pointer-events-none absolute ${centerInset}`}>
        <CardCenterFace card={card} size={size} variant={variant} />
      </div>

      {/* Bottom-Right Mirrored Casino Index */}
      {size !== 'xs' && (
        <div
          className={`absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 z-10 flex flex-col items-center leading-none w-fit rotate-180 ${suitTextColor}`}
        >
          <span
            className={`font-casino font-extrabold leading-[0.95] ${
              isClassic && card.rank === '10'
                ? 'tracking-[-0.09em] text-[1.02em]'
                : 'tracking-tight text-[1.15em]'
            }`}
          >
            {card.rank}
          </span>
          <SuitVector
            suit={card.suit}
            className={size === 'sm' ? 'h-2.5 w-2.5 mt-0.5' : size === 'lg' ? 'h-3.5 w-3.5 mt-0.5' : 'h-3 w-3 mt-0.5'}
            strokeColor={isBlitzObsidian ? '#A37B1A' : undefined}
            strokeWidth={isBlitzObsidian ? 0.5 : 0}
          />
        </div>
      )}
    </Tag>
  );
};
