import React, { useEffect, useRef, useState } from 'react';

interface RealisticLudoDieProps {
  value: number | null;
  isRolling: boolean;
  canRoll: boolean;
  onRoll?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

const FACE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

// Target Euler angles (in degrees) that bring face N to the front (+Z)
const FACE_TARGET_ANGLES: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: 0, ry: -90 },
  3: { rx: -90, ry: 0 },
  4: { rx: 90, ry: 0 },
  5: { rx: 0, ry: 90 },
  6: { rx: 0, ry: 180 },
};

export const RealisticLudoDie: React.FC<RealisticLudoDieProps> = ({
  value,
  isRolling,
  canRoll,
  onRoll,
  size = 'md',
}) => {
  const displayFace = value && value >= 1 && value <= 6 ? value : 6;
  const [spinCount, setSpinCount] = useState(0);
  const wasRollingRef = useRef(false);

  useEffect(() => {
    if (isRolling && !wasRollingRef.current) {
      setSpinCount((c) => c + 1);
    }
    wasRollingRef.current = isRolling;
  }, [isRolling]);

  const target = FACE_TARGET_ANGLES[displayFace] || FACE_TARGET_ANGLES[6];
  const cubeRx = target.rx + spinCount * 360;
  const cubeRy = target.ry + spinCount * 360;

  const cubePx = size === 'lg' ? 76 : size === 'sm' ? 46 : 64;
  const halfPx = cubePx / 2;
  const pipSize = size === 'lg' ? 'h-3 w-3' : size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const facePad = size === 'sm' ? 'p-1.5 rounded-[10px]' : 'p-2.5 rounded-[14px]';

  const faceTransforms: Array<{ face: number; transform: string }> = [
    { face: 1, transform: `rotateY(0deg) translateZ(${halfPx}px)` },
    { face: 6, transform: `rotateY(180deg) translateZ(${halfPx}px)` },
    { face: 2, transform: `rotateY(90deg) translateZ(${halfPx}px)` },
    { face: 5, transform: `rotateY(-90deg) translateZ(${halfPx}px)` },
    { face: 3, transform: `rotateX(90deg) translateZ(${halfPx}px)` },
    { face: 4, transform: `rotateX(-90deg) translateZ(${halfPx}px)` },
  ];

  const cubeEl = (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: `${cubePx + 18}px`,
        height: `${cubePx + 18}px`,
        perspective: '520px',
      }}
    >
      {/* Realistic tabletop contact shadow */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-1 rounded-full bg-black/75 blur-[6px] transition-all duration-300 ${
          isRolling ? 'w-11 h-3 opacity-50 scale-90' : 'w-14 h-3.5 opacity-85 scale-100'
        }`}
      />

      {/* Tilted 3D viewing rig so front, top, and side faces show simultaneously */}
      <div
        className="transition-transform duration-300 ease-out"
        style={{
          width: `${cubePx}px`,
          height: `${cubePx}px`,
          transformStyle: 'preserve-3d',
          transform: isRolling
            ? 'translateY(-10px) rotateX(-28deg) rotateY(-32deg) scale(1.06)'
            : 'translateY(0px) rotateX(-20deg) rotateY(-24deg) scale(1)',
        }}
      >
        {/* Inner tumbling 6-faced die */}
        <div
          className="relative w-full h-full motion-reduce:transition-none"
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 420ms cubic-bezier(0.2, 0.9, 0.3, 1.08)',
            transform: `rotateX(${cubeRx}deg) rotateY(${cubeRy}deg)`,
          }}
        >
          {faceTransforms.map(({ face, transform }) => {
            const pips = FACE_PIPS[face] || [];
            return (
              <div
                key={face}
                style={{
                  transform,
                  backfaceVisibility: 'hidden',
                }}
                className={`absolute inset-0 ${facePad} border border-[#8E9EFF]/55 bg-gradient-to-br from-[#5668FF] via-[#2B31C8] to-[#12116A] grid grid-cols-3 grid-rows-3 gap-0.5 place-items-center shadow-[inset_0_2px_5px_rgba(255,255,255,0.45),inset_0_-4px_8px_rgba(6,8,48,0.65)]`}
              >
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`${pipSize} rounded-full ${
                      pips.includes(idx)
                        ? 'bg-gradient-to-b from-white via-[#F1F5FF] to-[#CBD8FF] shadow-[inset_0_1.5px_2px_rgba(15,23,60,0.45),0_1px_1px_rgba(255,255,255,0.5)]'
                        : 'bg-transparent'
                    }`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (onRoll) {
    return (
      <button
        type="button"
        disabled={!canRoll}
        onClick={onRoll}
        aria-label={
          isRolling
            ? 'Dice rolling'
            : value
            ? `Dice showing ${value}. ${canRoll ? 'Click to roll' : ''}`
            : 'Roll Ludo dice'
        }
        className={`relative rounded-xl p-1 transition-transform ${
          canRoll
            ? 'cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD76A]'
            : 'cursor-default'
        }`}
      >
        {cubeEl}
      </button>
    );
  }

  return cubeEl;
};
