import React from 'react';
import { PlayingCard } from './PlayingCard';
import crownCrestImg from '../assets/images/matatu_crown_crest_1794421555026.jpg';
import type { PlayingCard as PlayingCardType } from '../shared/types';

const HERO_FAN: Array<{ card: PlayingCardType; rotate: string; translateY: string }> = [
  { card: { id: 'hero_as', rank: 'A', suit: 'spades' }, rotate: '-rotate-[16deg]', translateY: 'translate-y-4' },
  { card: { id: 'hero_kh', rank: 'K', suit: 'hearts' }, rotate: '-rotate-[7deg]', translateY: 'translate-y-1' },
  { card: { id: 'hero_qc', rank: 'Q', suit: 'clubs' }, rotate: 'rotate-[2deg]', translateY: 'translate-y-0' },
  { card: { id: 'hero_jd', rank: 'J', suit: 'diamonds' }, rotate: 'rotate-[10deg]', translateY: 'translate-y-1.5' },
  { card: { id: 'hero_10s', rank: '10', suit: 'spades' }, rotate: 'rotate-[18deg]', translateY: 'translate-y-4' },
];

export const HeroCenterpiece: React.FC = () => {
  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Warm Gold & Emerald Felt Spotlight Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-2 bottom-2 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(255,215,106,0.22)_0%,rgba(20,136,78,0.24)_45%,transparent_76%)] blur-xl"
      />

      {/* Fanned Royal Hand */}
      <div className="relative z-10 flex items-end justify-center -space-x-6 sm:-space-x-7 pt-2">
        {HERO_FAN.map((item, idx) => (
          <div
            key={item.card.id}
            style={{ zIndex: 10 + idx }}
            className={`transition-transform duration-300 hover:-translate-y-2 ${item.rotate} ${item.translateY} drop-shadow-[0_14px_24px_rgba(0,0,0,0.85)]`}
          >
            <PlayingCard card={item.card} size="lg" />
          </div>
        ))}
      </div>

      {/* Gold Crown & Chip Plinth Foreground */}
      <div className="relative z-20 -mt-10 flex items-end justify-center gap-3 sm:gap-5">
        {/* Left Emerald & Gold Chip Stack Graphic */}
        <div className="flex flex-col items-center -space-y-2 mb-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3.5 w-11 sm:w-13 rounded-full border border-[#FFD76A]/80 bg-gradient-to-r from-[#042A18] via-[#0E7A48] to-[#042A18] shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
            />
          ))}
        </div>

        {/* Center Bespoke Crown Crest Medallion */}
        <div className="relative flex flex-col items-center">
          <div className="h-18 w-18 sm:h-22 sm:w-22 rounded-full border-2 border-[#FFD76A] bg-[#04180F] p-0.5 shadow-[0_10px_30px_rgba(212,175,55,0.45)] overflow-hidden">
            <img
              src={crownCrestImg}
              alt="CASINO ROYALE Crown Crest"
              className="h-full w-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* Right Gold & Obsidian Chip Stack Graphic */}
        <div className="flex flex-col items-center -space-y-2 mb-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3.5 w-11 sm:w-13 rounded-full border border-[#FFD76A]/90 bg-gradient-to-r from-[#7A5608] via-[#FFD76A] to-[#7A5608] shadow-[0_3px_6px_rgba(0,0,0,0.7)]"
            />
          ))}
        </div>
      </div>

      {/* Felt Oval Plinth Ring */}
      <div className="relative z-10 -mt-3 h-7 w-64 sm:w-80 rounded-[100%] border border-[#D4AF37]/65 bg-gradient-to-b from-[#0A5331]/90 via-[#042717] to-[#02140B] shadow-[0_14px_30px_rgba(0,0,0,0.9)] flex items-center justify-center">
        <span className="text-[10px] font-bold tracking-[0.3em] text-[#FFD76A] uppercase">
          CASINO ROYALE · UGANDA
        </span>
      </div>
    </div>
  );
};
