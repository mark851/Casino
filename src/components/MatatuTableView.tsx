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
          ? 'fixed inset-0 z-50 h-dvh w-screen overflow-y-auto bg-[#5B3310] p-1.5 sm:p-2.5'
          : `relative overflow-hidden rounded-[22px] border-[2px] ${
              isBlitz ? 'border-[#C58A28]/75' : 'border-[#9B6226]/75'
            } bg-[#683C12] p-1 sm:p-1.5 shadow-[0_24px_52px_rgba(0,0,0,0.72)]`
      }
    >
      {/* Warm Wooden Matatu Frame */}
      <div className="relative overflow-hidden rounded-[18px] border border-[#9E642A]/40 bg-gradient-to-b from-[#7E4A1A] via-[#6B3E15] to-[#58320F]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 rounded-[14px] border border-[#C88F42]/15"
        />

        <div
          className={`relative z-10 flex flex-col justify-between ${
            effectiveFullscreen ? 'px-2 py-2 sm:px-3.5 sm:py-2.5 gap-2' : 'px-2.5 py-2.5 sm:px-4 sm:py-3.5 gap-2.5'
          }`}
        >
          {/* Compact Title Header */}
          <div className="flex items-center justify-center gap-2.5 text-center">
            <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-r from-transparent to-[#F2C46D]/75" />
            <div className="flex items-center gap-2.5">
              <img
                src={isBlitz ? tileMatatuBlitzImg : tileMatatuRoyaleImg}
                alt={isBlitz ? 'Matatu Blitz HD Emblem' : 'Matatu Royale HD Emblem'}
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-lg object-cover border border-[#F2C46D]/80 shadow-md shrink-0"
              />
              <span className="font-casino text-sm sm:text-lg font-black tracking-[0.14em] gold-text-gradient uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] whitespace-nowrap">
                {isBlitz ? 'MATATU BLITZ · TURBO' : 'UGANDAN MATATU ROYALE'}
              </span>
              {isBlitz ? (
                <Zap className="h-4 w-4 text-[#FBBF24] shrink-0" aria-hidden="true" />
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
            <span className="h-[1px] w-6 sm:w-12 bg-gradient-to-l from-transparent to-[#F2C46D]/75" />
          </div>

          {/* Interactive 3D Wooden Matatu Board */}
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
            <div className="mx-auto text-center space-y-2.5 bg-[#291506]/95 rounded-2xl border border-[#E5A93B]/45 px-6 py-4 max-w-md shadow-xl">
              <div className="flex items-center justify-center gap-1.5 text-[#FFD76A]">
                <Crown className="h-4 w-4" />
                <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                  {stakeLocked
                    ? 'Table Preview — Stake Required'
                    : `Waiting for Players (${gameState.seats.length}/${gameState.maxPlayers})`}
                </h2>
              </div>
              <p className="text-xs text-amber-100/80">
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
                  className="gold-shimmer-btn rounded-full px-6 py-2.5 text-xs font-extrabold uppercase tracking-wide cursor-pointer whitespace-nowrap"
                >
                  {stakeLocked ? 'Stake & Deal Cards' : 'Deal Cards Now'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#2A1506]/90 border border-[#D49B4B]/40 px-4 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {primaryOpponent && (
                  <span className="font-semibold text-amber-50">
                    <span>{primaryOpponent.displayName}</span>
                    <span className="mx-1.5 text-[#FFD76A]" aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#FFD76A]">{primaryOpponent.cardCount} cards</span>
                    {opponentSeats.length > 1 && (
                      <span className="ml-1.5 text-amber-200/70">+{opponentSeats.length - 1} rivals</span>
                    )}
                  </span>
                )}
                <span className="text-amber-300/40 hidden sm:inline" aria-hidden="true">|</span>
                <span className="text-amber-100/85 font-medium">
                  Active Suit{' '}
                  <span className={`font-bold ml-1 ${isRedActiveSuit ? 'text-red-300' : 'text-[#FFD76A]'}`}>
                    {SUIT_SYMBOLS[gameState.activeSuit]} {SUIT_LABELS[gameState.activeSuit]}
                  </span>
                </span>
                <span className="text-amber-300/40" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-amber-100/85">
                  {reversed ? <RotateCcw className="h-3 w-3 text-[#FFD76A]" /> : <RotateCw className="h-3 w-3 text-[#FFD76A]" />}
                  <span>{reversed ? 'Reversed' : 'Clockwise'}</span>
                </span>
                <span className="text-amber-300/40 hidden md:inline" aria-hidden="true">·</span>
                <span className="hidden md:inline text-amber-100/85">
                  Stake{' '}
                  <span className="font-mono-tabular font-bold text-[#FFD76A]">
                    UGX {(gameState.entryFeeUgx || 1000).toLocaleString()}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2.5 ml-auto">
                {gameState.pendingDrawCount > 0 && (
                  <span className="font-bold text-red-300 whitespace-nowrap">
                    Penalty +{gameState.pendingDrawCount}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!isYourTurn}
                  onClick={onDrawCard}
                  className={`text-xs font-bold px-4 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                    gameState.pendingDrawCount > 0
                      ? 'border-red-400/75 bg-red-950/90 text-red-100 hover:bg-red-900 cursor-pointer'
                      : isYourTurn
                      ? 'border-[#FFD76A]/80 bg-[#784A1E] text-[#FFD76A] hover:bg-[#935A24] cursor-pointer'
                      : 'border-white/15 bg-black/45 text-amber-100/45 cursor-not-allowed'
                  }`}
                >
                  {gameState.pendingDrawCount > 0
                    ? `Take +${gameState.pendingDrawCount}`
                    : `Draw (${gameState.deckCount})`}
                </button>
                <span className="text-[11px] font-semibold text-amber-100/85 whitespace-nowrap">
                  Discard · <span className="font-mono-tabular text-[#FFD76A]">{gameState.discardCount}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Integrated Player Hand Apron Directly Onboard (Classic Clean Cards) */}
      {gameState.status !== 'waiting' && (
        <div className="mt-1.5 rounded-[16px] border border-[#C98A3A]/35 bg-gradient-to-b from-[#3A200B] to-[#261406] px-4 py-4 sm:px-6 sm:py-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-white">Your Hand ({gameState.yourHand.length})</span>
              {isYourTurn ? (
                <span className="text-[#86EFAC] font-bold">· Your Turn to Play</span>
              ) : gameState.status === 'in_progress' ? (
                <span className="text-amber-100/70">· Opponent Thinking</span>
              ) : null}
            </div>

            {gameState.yourHand.length <= 2 &&
              gameState.status === 'in_progress' &&
              !mySeat?.calledLastCard && (
                <button
                  type="button"
                  onClick={onCallLastCard}
                  className="pro-gold-btn inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap"
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
                  variant="classic"
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
