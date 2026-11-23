import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { soundFx } from '../utils/sound';

export const GlobalSoundToggle: React.FC<{ variant?: 'compact' | 'pill' }> = ({
  variant = 'pill',
}) => {
  const [muted, setMuted] = useState<boolean>(() => soundFx.isMuted());

  const handleToggle = () => {
    const nextMuted = soundFx.toggleMuted();
    setMuted(nextMuted);
    if (!nextMuted) {
      soundFx.play('card-flip');
    }
  };

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={muted ? 'Unmute table sound effects' : 'Mute table sound effects'}
        title={muted ? 'Unmute Sound' : 'Mute Sound'}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D4AF37]/35 bg-[#063B24]/60 text-[#FFD76A] hover:bg-[#084D2F] transition-colors cursor-pointer shrink-0"
      >
        {muted ? <VolumeX className="h-4 w-4 text-neutral-400" /> : <Volume2 className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={muted ? 'Unmute table sound effects' : 'Mute table sound effects'}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/35 bg-[#041D11] px-3 py-1.5 text-xs font-semibold text-[#FFD76A] hover:bg-[#07331E] transition-colors cursor-pointer whitespace-nowrap shrink-0"
    >
      {muted ? <VolumeX className="h-3.5 w-3.5 text-neutral-400" /> : <Volume2 className="h-3.5 w-3.5" />}
      <span>{muted ? 'Audio Off' : 'Audio On'}</span>
    </button>
  );
};
