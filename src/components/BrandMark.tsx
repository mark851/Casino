import React, { useId } from 'react';

interface BrandMarkProps {
  brandName?: string;
  logoUrl?: string;
  compact?: boolean;
  subtitle?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({
  brandName = 'CASINO ROYALE',
  logoUrl,
  compact = false,
  subtitle,
}) => {
  const gradId = useId().replace(/:/g, '');
  const parts = brandName.trim().split(/\s+/);
  const primaryWord = parts[0] || 'CASINO';
  const secondaryWord = parts.slice(1).join(' ') || 'ROYALE';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          referrerPolicy="no-referrer"
          className="h-9 w-9 rounded-lg object-cover border border-[#D4AF37]/50 shrink-0"
        />
      ) : (
        <span className="inline-flex flex-col items-center justify-center shrink-0">
          <svg
            width="38"
            height="28"
            viewBox="0 0 48 34"
            fill="none"
            aria-hidden="true"
            className="drop-shadow-[0_2px_6px_rgba(212,175,55,0.45)]"
          >
            <defs>
              <linearGradient id={`crown_${gradId}`} x1="4" y1="2" x2="44" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF5BE" />
                <stop offset="42%" stopColor="#FFD76A" />
                <stop offset="78%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#9A7218" />
              </linearGradient>
            </defs>
            {/* Crown spires & balls */}
            <circle cx="8" cy="8.5" r="2.2" fill="#FFD76A" />
            <circle cx="24" cy="4" r="2.6" fill="#FFF3B0" />
            <circle cx="40" cy="8.5" r="2.2" fill="#FFD76A" />
            <circle cx="15.5" cy="11.5" r="1.7" fill="#D4AF37" />
            <circle cx="32.5" cy="11.5" r="1.7" fill="#D4AF37" />
            {/* Main Crown Body */}
            <path
              d="M7 24L8.6 10.5L15.6 17.5L24 6.5L32.4 17.5L39.4 10.5L41 24H7Z"
              fill={`url(#crown_${gradId})`}
              stroke="#FFF2B2"
              strokeWidth="0.9"
              strokeLinejoin="round"
            />
            {/* Crown Band */}
            <rect x="6.5" y="25" width="35" height="3.2" rx="1.6" fill={`url(#crown_${gradId})`} />
            {/* Center Spade Accent */}
            <path
              d="M24 14.2C22.2 16.5 21 17.9 21 19.3C21 20.4 21.8 21.1 22.8 21.1C23.3 21.1 23.7 20.9 24 20.6C24.3 20.9 24.7 21.1 25.2 21.1C26.2 21.1 27 20.4 27 19.3C27 17.9 25.8 16.5 24 14.2Z"
              fill="#07190F"
            />
          </svg>
          {/* Micro Suit Row underneath Crown */}
          <span className="flex items-center gap-1 text-[9px] leading-none tracking-normal -mt-0.5 select-none" aria-hidden="true">
            <span className="text-[#FFD76A]">♠</span>
            <span className="text-[#E04F4F]">♥</span>
            <span className="text-[#D4AF37]">♣</span>
            <span className="text-[#E04F4F]">♦</span>
          </span>
        </span>
      )}

      {!compact && (
        <span className="flex flex-col items-center leading-none whitespace-nowrap shrink-0">
          <span className="font-casino text-xl sm:text-[1.55rem] font-extrabold tracking-[0.07em] gold-text-gradient uppercase">
            {primaryWord}
          </span>
          {subtitle ? (
            <span className="text-[10px] font-medium tracking-wide text-neutral-300 mt-0.5">
              {subtitle}
            </span>
          ) : (
            <span className="mt-0.5 flex items-center gap-1.5 w-full justify-center">
              <span className="h-[1px] flex-1 min-w-3 bg-gradient-to-r from-transparent to-[#D4AF37]" />
              <span className="text-[9px] sm:text-[10px] font-bold tracking-[0.28em] text-[#FFD76A] uppercase">
                {secondaryWord}
              </span>
              <span className="h-[1px] flex-1 min-w-3 bg-gradient-to-l from-transparent to-[#D4AF37]" />
            </span>
          )}
        </span>
      )}
    </span>
  );
};
