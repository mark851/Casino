import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

interface FullscreenToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

export const FullscreenToggleButton: React.FC<FullscreenToggleButtonProps> = ({
  isFullscreen,
  onToggle,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Play in Full Screen'}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 min-h-[36px] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD76A] ${
        isFullscreen
          ? 'border-[#FFD76A] bg-[#0B4128] text-[#FFD76A] hover:bg-[#0F5635]'
          : 'border-[#D4AF37]/45 bg-[#072617] text-[#FFD76A] hover:bg-[#0B3923] hover:border-[#FFD76A]/80'
      } ${className}`}
    >
      {isFullscreen ? (
        <>
          <Minimize2 className="h-3.5 w-3.5 shrink-0" />
          <span>Exit Full Screen</span>
        </>
      ) : (
        <>
          <Maximize2 className="h-3.5 w-3.5 shrink-0" />
          <span>Full Screen</span>
        </>
      )}
    </button>
  );
};
