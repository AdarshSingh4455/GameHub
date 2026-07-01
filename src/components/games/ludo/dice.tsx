import React, { useState, useEffect } from 'react';
import { PlayerColor } from './types';

interface DiceProps {
  value: number;
  isRolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  playerColor: PlayerColor;
}

const faceRotations: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateX(180deg) rotateY(0deg)',
  2: 'rotateX(90deg) rotateY(0deg)',
  5: 'rotateX(-90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(-90deg)',
  4: 'rotateX(0deg) rotateY(90deg)',
};

const colorGradient: Record<PlayerColor, { face: string; glow: string; dot: string }> = {
  RED:    { face: 'linear-gradient(135deg, #ff5580 0%, #cc0033 100%)', glow: 'rgba(255, 51, 102, 0.7)',  dot: '#fff' },
  BLUE:   { face: 'linear-gradient(135deg, #5599ff 0%, #0044bb 100%)', glow: 'rgba(51, 136, 255, 0.7)',  dot: '#fff' },
  YELLOW: { face: 'linear-gradient(135deg, #ffdd33 0%, #cc8800 100%)', glow: 'rgba(255, 170, 0, 0.7)',   dot: '#fff' },
  GREEN:  { face: 'linear-gradient(135deg, #33ee88 0%, #006633 100%)', glow: 'rgba(0, 204, 102, 0.7)',   dot: '#fff' },
};

// Dot positions for each face value using a 3x3 grid (index 0..8, row-major)
const DOT_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SIZE = 58; // px — dice face size

export const Dice: React.FC<DiceProps> = ({ value, isRolling, onRoll, disabled, playerColor }) => {
  const [rotation, setRotation] = useState<string>(faceRotations[value] || faceRotations[1]);
  const [pressing, setPressing] = useState(false);

  useEffect(() => {
    if (isRolling) {
      const rx = (Math.floor(Math.random() * 3) + 4) * 360 + Math.random() * 90;
      const ry = (Math.floor(Math.random() * 3) + 4) * 360 + Math.random() * 90;
      setRotation(`rotateX(${rx}deg) rotateY(${ry}deg)`);
    } else {
      setRotation(faceRotations[value] || faceRotations[1]);
    }
  }, [isRolling, value]);

  const handleClick = () => {
    if (disabled || isRolling) return;
    setPressing(true);
    setTimeout(() => {
      setPressing(false);
      onRoll();
    }, 110);
  };

  const { face, glow, dot } = colorGradient[playerColor];
  const isPlayable = !disabled && !isRolling;

  const renderFace = (faceNum: number) => {
    const rot = faceRotations[faceNum];
    const activeDots = DOT_POSITIONS[faceNum] || [];
    return (
      <div
        key={faceNum}
        style={{
          position: 'absolute',
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          background: face,
          border: '2px solid rgba(255,255,255,0.18)',
          borderRadius: '12px',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          padding: '8px',
          gap: '2px',
          alignItems: 'center',
          justifyItems: 'center',
          backfaceVisibility: 'hidden',
          transform: `${rot} translateZ(${SIZE / 2}px)`,
          boxShadow: `inset 0 2px 8px rgba(255,255,255,0.12), inset 0 -3px 8px rgba(0,0,0,0.35)`,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              width: activeDots.includes(i) ? '8px' : '0px',
              height: activeDots.includes(i) ? '8px' : '0px',
              borderRadius: '50%',
              background: dot,
              boxShadow: activeDots.includes(i) ? '0 1px 3px rgba(0,0,0,0.5), 0 0 4px rgba(255,255,255,0.4)' : 'none',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'relative',
        width: `${SIZE}px`,
        height: `${SIZE}px`,
        perspective: '500px',
        cursor: isPlayable ? 'pointer' : disabled ? 'not-allowed' : 'default',
        flexShrink: 0,
      }}
    >
      {/* Glow halo when it's your turn */}
      {isPlayable && (
        <div
          style={{
            position: 'absolute',
            inset: '-8px',
            borderRadius: '20px',
            background: glow,
            filter: 'blur(14px)',
            opacity: 0.6,
            pointerEvents: 'none',
            animation: 'diceGlow 1.6s infinite ease-in-out',
            zIndex: 0,
          }}
        />
      )}

      {/* 3D cube */}
      <div
        style={{
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: rotation,
          transition: isRolling
            ? 'transform 0.78s cubic-bezier(0.1, 0.85, 0.35, 1)'
            : 'transform 0.38s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
          animation: isRolling ? 'diceBounce 0.78s ease-in-out' : 'none',
          scale: pressing ? '0.9' : isPlayable ? '1' : '0.92',
          zIndex: 1,
        }}
      >
        {([1, 6, 2, 5, 3, 4] as const).map(renderFace)}
      </div>

      {/* Ground shadow */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: `${SIZE * 0.7}px`,
          height: '6px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          filter: 'blur(3px)',
          opacity: isRolling ? 0.2 : 0.7,
          scale: isRolling ? '0.5' : '1',
          transition: 'all 0.4s ease',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes diceGlow {
          0%, 100% { opacity: 0.45; filter: blur(12px); }
          50% { opacity: 0.8; filter: blur(18px); }
        }
        @keyframes diceBounce {
          0% { transform: translateY(0); }
          30% { transform: translateY(-20px); }
          60% { transform: translateY(-8px); }
          80% { transform: translateY(-4px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
