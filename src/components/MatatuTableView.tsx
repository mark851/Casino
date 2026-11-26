import React, { useRef } from 'react';
import { Crown, RotateCcw, RotateCw, Sparkles, Zap } from 'lucide-react';
import { PlayingCard, type CardDeckVariant } from './PlayingCard';
import { ThreeMatatuTable } from './three/ThreeMatatuTable';
import { useGameFullscreen } from '../hooks/useGameFullscreen';
import { SUIT_LABELS, SUIT_SYMBOLS } from '../shared/matatuRules';
import tileMatatuRoyaleImg from '../assets/images/tile_matatu_royale_1794598741250.jpg';
import tileMatatuBlitzImg from '../assets/images/tile_matatu_blitz_1794598742191.jpg';
import type { PlayingCard as PlayingCardType, SanitizedGameState } from '../shared/types';

interface MatatuTableViewProps {
  gameState: SanitizedGameState;
  viewerUid: string;
  isYourTurn: boolean;
  isHost: boolean;
  stakeLocked?: boolean;
  variant?: CardDeckVariant;
  playableCardIds: Set<string>;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onCardClick: (card: PlayingCardType) => void;
  onDrawCard: () => void;
  onStartGame: () => void;
  onCallLastCard: () => void;
}

const RoyalCrownCrestSvg: React.FC = () => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 220 112"
      className="w-36 sm:w-44 h-auto drop-shadow-[0_10px_22px_rgba(0,0,0,0.85)] select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`crownGold_${uid}`} x1="20" y1="8" x2="200" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF4B5" />
          <stop offset="38%" stopColor="#FFD76A" />
          <stop offset="72%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#8B6310" />
        </linearGradient>
        <linearGradient id={`crownRim_${uid}`} x1="36" y1="84" x2="184" y2="102" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9A7116" />
          <stop offset="50%" stopColor="#FFE88A" />
          <stop offset="100%" stopColor="#8C6410" />
        </linearGradient>
      </defs>

      {/* Rear crown prongs */}
      <path d="M55 68 L48 34 L76 54 Z" fill="#9A7218" stroke="#D4AF37" strokeWidth="1" />
      <path d="M165 68 L172 34 L144 54 Z" fill="#9A7218" stroke="#D4AF37" strokeWidth="1" />
      <path d="M84 58 L80 28 L102 48 Z" fill="#B5891C" stroke="#FFD76A" strokeWidth="0.9" />
      <path d="M136 58 L140 28 L118 48 Z" fill="#B5891C" stroke="#FFD76A" strokeWidth="0.9" />

      {/* Main 5-point royal gold crown silhouette */}
      <path
        d="M36 86 L24 34 L62 56 L82 22 L110 46 L138 22 L158 56 L196 34 L184 86 Z"
        fill={`url(#crownGold_${uid})`}
        stroke="#FFF4B8"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Spire finial orbs */}
      <circle cx="24" cy="32" r="4.2" fill="#FFE680" stroke="#7A5608" strokeWidth="1" />
      <circle cx="82" cy="20" r="4.6" fill="#FFE680" stroke="#7A5608" strokeWidth="1" />
      <circle cx="110" cy="14" r="5.5" fill="#FFF2B0" stroke="#7A5608" strokeWidth="1" />
      <circle cx="138" cy="20" r="4.6" fill="#FFE680" stroke="#7A5608" strokeWidth="1" />
      <circle cx="196" cy="32" r="4.2" fill="#FFE680" stroke="#7A5608" strokeWidth="1" />
      <path d="M104 42 L110 17 L116 42 Z" fill={`url(#crownGold_${uid})`} stroke="#FFF4B8" strokeWidth="1" />

      {/* Left Wing Inlay: Ugandan Flag Shield */}
      <g transform="translate(50 56) rotate(-7)">
        <rect x="0" y="0" width="24" height="16.5" rx="2" fill="#0B0B0B" stroke="#7A5608" strokeWidth="1" />
        <rect x="1" y="1" width="22" height="2.4" fill="#111111" />
        <rect x="1" y="3.4" width="22" height="2.4" fill="#FCDC04" />
        <rect x="1" y="5.8" width="22" height="2.4" fill="#D90000" />
        <rect x="1" y="8.2" width="22" height="2.4" fill="#111111" />
        <rect x="1" y="10.6" width="22" height="2.4" fill="#FCDC04" />
        <rect x="1" y="13" width="22" height="2.5" fill="#D90000" />
        <circle cx="12" cy="8.2" r="3" fill="#FFFFFF" />
        <circle cx="12.2" cy="7.5" r="1.2" fill="#111111" />
      </g>

      {/* Center Crest: Royal Black Spade Emblem */}
      <g transform="translate(110 62)">
        <ellipse cx="0" cy="0" rx="14" ry="15.5" fill="#1E1403" stroke="#FFF2AE" strokeWidth="1.5" />
        <path
          d="M0 -10.5 C-4.8 -5 -9.2 -1.2 -9.2 3.1 C-9.2 6.4 -6.4 8.2 -3.4 8.2 C-1.8 8.2 -0.6 7.4 -0.2 6.3 L-2.8 10.6 L2.8 10.6 L0.2 6.3 C0.6 7.4 1.8 8.2 3.4 8.2 C6.4 8.2 9.2 6.4 9.2 3.1 C9.2 -1.2 4.8 -5 0 -10.5 Z"
          fill="#060807"
          stroke="#D4AF37"
          strokeWidth="0.7"
        />
      </g>

      {/* Right Wing Inlay: Crested Crane Emblem */}
      <g transform="translate(147 54) rotate(7)">
        <rect x="0" y="0" width="22" height="18" rx="2.5" fill="#063B24" stroke="#7A5608" strokeWidth="1" />
        {/* Stylized Crested Crane */}
        <path d="M9 14 C8 11 9.5 8 12.5 7.2 C13.8 5.2 14.5 3.6 13.5 2.5" fill="none" stroke="#F8FAFC" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="13.5" cy="2.6" r="1.3" fill="#D90000" />
        <path d="M12.5 1.8 L15.5 1.3 M12.2 1.8 L10.5 0.9" stroke="#FACC15" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M8 12 L15 11.5 L12.5 14 Z" fill="#FACC15" />
        <line x1="11" y1="13.5" x2="11" y2="16.5" stroke="#CBD5E1" strokeWidth="0.9" />
      </g>

      {/* Jeweled Crown Base Band */}
      <rect
        x="35"
        y="83"
        width="150"
        height="15"
        rx="4"
        fill={`url(#crownRim_${uid})`}
        stroke="#5E4206"
        strokeWidth="1.2"
      />
      <line x1="38" y1="86" x2="182" y2="86" stroke="#FFF6C4" strokeOpacity="0.6" strokeWidth="0.8" />
      {/* Faceted Gems: Emerald, Ruby, Gold Diamond */}
      <polygon points="62,86.5 67,90.5 62,94.5 57,90.5" fill="#10B981" stroke="#064E3B" strokeWidth="0.8" />
      <polygon points="110,85.5 116.5,90.5 110,95.5 103.5,90.5" fill="#DC2626" stroke="#7F1D1D" strokeWidth="0.8" />
      <polygon points="158,86.5 163,90.5 158,94.5 153,90.5" fill="#10B981" stroke="#064E3B" strokeWidth="0.8" />
      <circle cx="86" cy="90.5" r="2.2" fill="#FFF3B0" />
      <circle cx="134" cy="90.5" r="2.2" fill="#FFF3B0" />
    </svg>
  );
};

export const MatatuTableView: React.FC<MatatuTableViewProps> = ({
  gameState,
  viewerUid,
  isYourTurn,
  isHost,
  stakeLocked = false,
  variant,
  playableCardIds,
  isFullscreen = false,
  onToggleFullscreen,
  onCardClick,
  onDrawCard,
  onStartGame,
  onCallLastCard,
}) => {
  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const localFs = useGameFullscreen(localContainerRef);
  const effectiveFullscreen = onToggleFullscreen ? isFullscreen : localFs.isFullscreen;
  const handleToggleFullscreen = onToggleFullscreen ?? (() => void localFs.toggleFullscreen());

  const activeVariant: CardDeckVariant =
    variant ?? (/\bblitz\b/i.test(gameState.roomName || '') ? 'blitz' : 'royale');
  const isBlitz = activeVariant === 'blitz';

  const mySeat = gameState.seats.find((s) => s.uid === viewerUid);
  const opponentSeats = gameState.seats.filter((s) => s.uid !== viewerUid);
  const primaryOpponent = opponentSeats[0];
  const isRedActiveSuit = gameState.activeSuit === 'hearts' || gameState.activeSuit === 'diamonds';
  const reversed = gameState.direction === -1;

  return (
    <div
      ref={localContainerRef}
      className={
        !onToggleFullscreen && localFs.isFullscreen
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto bg-[#050C08] p-3 sm:p-4'
          : `relative overflow-hidden rounded-[26px] border-[3px] ${
              isBlitz ? 'border-[#FFD76A]/90' : 'border-[#C99B27]/85'
            } bg-[#120B05] p-1.5 sm:p-2 shadow-[0_30px_70px_rgba(0,0,0,0.92)]`
      }
    >
      {/* Clean Architectural Studio Frame */}
      <div className="relative overflow-hidden rounded-[20px] border border-[#FFD76A]/45 bg-gradient-to-b from-[#06130C]/92 via-[#040D08]/95 to-[#030805]/98">
        {/* Subtle Inner Casino Trim Rail */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2.5 sm:inset-3.5 rounded-[14px] border border-[#FFD76A]/25"
        />

        {/* Foreground Felt Content */}
        <div
          className={`relative z-10 flex flex-col justify-between ${
            effectiveFullscreen ? 'px-3 py-3 sm:px-5 sm:py-4 gap-3' : 'px-4 py-5 sm:px-7 sm:py-6 gap-4'
          }`}
        >
          {/* Top Signature Banner: UGANDAN MATATU ROYALE / MATATU BLITZ + HD Crest */}
          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="flex items-center gap-2.5">
              <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-r from-transparent to-[#FFD76A]/80" />
              <div className="flex items-center gap-2.5">
                <img
                  src={isBlitz ? tileMatatuBlitzImg : tileMatatuRoyaleImg}
                  alt={isBlitz ? 'Matatu Blitz HD Emblem' : 'Matatu Royale HD Emblem'}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover border border-[#FFD76A]/80 shadow-md shrink-0"
                />
                <span className="font-casino text-sm sm:text-lg font-black tracking-[0.14em] gold-text-gradient uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] whitespace-nowrap">
                  {isBlitz ? 'MATATU BLITZ · TURBO' : 'UGANDAN MATATU ROYALE'}
                </span>
                {isBlitz ? (
                  <Zap className="h-4 w-4 text-[#9CE800] shrink-0" aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-flex flex-col h-3 w-4.5 overflow-hidden rounded-[2px] border border-[#FFD76A]/70 shadow-sm shrink-0"
                  >
                    <span className="flex-1 bg-black" />
                    <span className="flex-1 bg-[#FCDC04]" />
                    <span className="flex-1 bg-[#D90000]" />
                    <span className="flex-1 bg-black" />
                    <span className="flex-1 bg-[#FCDC04]" />
                    <span className="flex-1 bg-[#D90000]" />
                  </span>
                )}
              </div>
              <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-l from-transparent to-[#FFD76A]/80" />
            </div>

            {!effectiveFullscreen && <RoyalCrownCrestSvg />}
          </div>

          {/* Real-Life 3D Octagonal Matatu Casino Table */}
          <ThreeMatatuTable
            gameState={gameState}
            viewerUid={viewerUid}
            isYourTurn={isYourTurn}
            playableCardIds={playableCardIds}
            variant={activeVariant}
            isFullscreen={effectiveFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onCardClick={onCardClick}
            onDrawCard={onDrawCard}
          />

          {gameState.status === 'waiting' ? (
            <div className="mx-auto text-center space-y-2.5 bg-[#031B10]/90 rounded-2xl border border-[#FFD76A]/40 px-6 py-4 max-w-md shadow-xl">
              <div className="flex items-center justify-center gap-1.5 text-[#FFD76A]">
                <Crown className="h-4 w-4" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  {stakeLocked
                    ? 'Table Preview — Stake Required'
                    : `Waiting for Players (${gameState.seats.length}/${gameState.maxPlayers})`}
                </h2>
              </div>
              <p className="text-xs text-neutral-300">
                {stakeLocked ? (
                  <>
                    Lock your UGX stake above (table code{' '}
                    <span className="font-mono-tabular font-bold text-[#FFD76A]">{gameState.roomCode}</span>
                    ) to deal cards and begin playing.
                  </>
                ) : (
                  <>
                    Share table code{' '}
                    <span className="font-mono-tabular font-bold text-[#FFD76A]">{gameState.roomCode}</span>{' '}
                    or deal the deck once seats are ready.
                  </>
                )}
              </p>
              {(stakeLocked || (isHost && gameState.seats.length >= 2)) && (
                <button
                  type="button"
                  onClick={onStartGame}
                  className="gold-shimmer-btn rounded-full px-6 py-2.5 text-xs font-extrabold uppercase tracking-wide cursor-pointer"
                >
                  {stakeLocked ? 'Stake & Deal Cards' : 'Deal Cards Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#031A0F]/85 border border-[#FFD76A]/35 px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {primaryOpponent && (
                  <span className="font-semibold text-neutral-200">
                    <span>{primaryOpponent.displayName}</span>
                    <span className="mx-1.5 text-[#FFD76A]" aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#FFD76A]">{primaryOpponent.cardCount} cards</span>
                    {opponentSeats.length > 1 && (
                      <span className="ml-1.5 text-neutral-400">+{opponentSeats.length - 1} rivals</span>
                    )}
                  </span>
                )}
                <span className="text-neutral-500 hidden sm:inline" aria-hidden="true">|</span>
                <span className="text-neutral-300 font-medium">
                  Active Suit{' '}
                  <span className={`font-bold ml-1 ${isRedActiveSuit ? 'text-red-400' : 'text-[#FFD76A]'}`}>
                    {SUIT_SYMBOLS[gameState.activeSuit]} {SUIT_LABELS[gameState.activeSuit]}
                  </span>
                </span>
                <span className="text-neutral-500" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-neutral-300">
                  {reversed ? <RotateCcw className="h-3 w-3 text-[#FFD76A]" /> : <RotateCw className="h-3 w-3 text-[#FFD76A]" />}
                  <span>{reversed ? 'Reversed' : 'Clockwise'}</span>
                </span>
                <span className="text-neutral-500 hidden md:inline" aria-hidden="true">·</span>
                <span className="hidden md:inline text-neutral-300">
                  Stake{' '}
                  <span className="font-mono-tabular font-bold text-[#FFD76A]">
                    UGX {(gameState.entryFeeUgx || 1000).toLocaleString()}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                {gameState.pendingDrawCount > 0 && (
                  <span className="font-bold text-red-300">
                    Penalty +{gameState.pendingDrawCount}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!isYourTurn}
                  onClick={onDrawCard}
                  className={`text-xs font-bold px-4 py-1.5 rounded-full border transition-colors ${
                    gameState.pendingDrawCount > 0
                      ? 'border-red-400/75 bg-red-950/90 text-red-100 hover:bg-red-900 cursor-pointer'
                      : isYourTurn
                      ? 'border-[#FFD76A]/75 bg-[#083822] text-[#FFD76A] hover:bg-[#0D4D30] cursor-pointer'
                      : 'border-white/15 bg-black/55 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  {gameState.pendingDrawCount > 0
                    ? `Take +${gameState.pendingDrawCount}`
                    : `Draw (${gameState.deckCount})`}
                </button>
                <span className="text-[11px] font-semibold text-neutral-300">
                  Discard · <span className="font-mono-tabular text-[#FFD76A]">{gameState.discardCount}</span>
                </span>
              </div>
            </div>
          )}

          {/* Bottom Promo Emblem Strip: THE HIGH ROLLER CARD BATTLE */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <span className="h-[1px] flex-1 max-w-20 bg-gradient-to-r from-transparent to-[#D4AF37]/65" />
            <p className="font-casino text-[10px] sm:text-xs font-extrabold tracking-[0.26em] gold-text-gradient uppercase text-center">
              THE HIGH ROLLER CARD BATTLE
            </p>
            <span className="h-[1px] flex-1 max-w-20 bg-gradient-to-l from-transparent to-[#D4AF37]/65" />
          </div>
        </div>
      </div>

      {/* Integrated Player Hand Apron Directly Onboard */}
      {gameState.status !== 'waiting' && (
        <div className="mt-1.5 rounded-[16px] border border-[#D4AF37]/30 bg-gradient-to-b from-[#09120E] to-[#060B09] px-4 py-4 sm:px-6 sm:py-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-white">Your Hand ({gameState.yourHand.length})</span>
              {isYourTurn ? (
                <span className="text-[#9CE800] font-bold">· Your Turn to Play</span>
              ) : gameState.status === 'in_progress' ? (
                <span className="text-neutral-400">· Opponent Thinking</span>
              ) : null}
            </div>

            {gameState.yourHand.length <= 2 &&
              gameState.status === 'in_progress' &&
              !mySeat?.calledLastCard && (
                <button
                  type="button"
                  onClick={onCallLastCard}
                  className="pro-gold-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Call Last Card (Kadi Moja)</span>
                </button>
              )}
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-2.5 pt-1">
            {gameState.yourHand.map((card) => {
              const playable = playableCardIds.has(card.id);
              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  variant={activeVariant}
                  playable={playable}
                  disabled={!playable}
                  onClick={playable ? () => onCardClick(card) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
