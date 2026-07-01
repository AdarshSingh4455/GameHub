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
  2: 'rotateX(-90deg) rotateY(0deg)',
  5: 'rotateX(90deg) rotateY(0deg)',
  3: 'rotateX(0deg) rotateY(90deg)',
  4: 'rotateX(0deg) rotateY(-90deg)',
};

const colorMap: Record<PlayerColor, string> = {
  RED: 'linear-gradient(135deg, #ff4b72, #b30022)',
  BLUE: 'linear-gradient(135deg, #549cff, #0047b3)',
  YELLOW: 'linear-gradient(135deg, #ffcc00, #cc8800)',
  GREEN: 'linear-gradient(135deg, #00e676, #007a3d)',
};

const colorGlow: Record<PlayerColor, string> = {
  RED: 'rgba(255, 51, 102, 0.65)',
  BLUE: 'rgba(51, 136, 255, 0.65)',
  YELLOW: 'rgba(255, 170, 0, 0.65)',
  GREEN: 'rgba(0, 204, 102, 0.65)',
};

export const Dice: React.FC<DiceProps> = ({
  value,
  isRolling,
  onRoll,
  disabled,
  playerColor,
}) => {
  const [rotation, setRotation] = useState<string>(faceRotations[value] || faceRotations[1]);
  const [anticipating, setAnticipating] = useState(false);

  useEffect(() => {
    if (isRolling) {
      const randX = (Math.floor(Math.random() * 3) + 4) * 360; 
      const randY = (Math.floor(Math.random() * 3) + 4) * 360;
      setRotation(`rotateX(${randX + 45}deg) rotateY(${randY + 45}deg)`);
    } else {
      setRotation(faceRotations[value] || faceRotations[1]);
    }
  }, [isRolling, value]);

  const handleRollClick = () => {
    if (disabled || isRolling) return;
    setAnticipating(true);
    setTimeout(() => {
      setAnticipating(false);
      onRoll();
    }, 120);
  };

  const getDots = (face: number) => {
    const dotsMap: Record<number, number[]> = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const activeDots = dotsMap[face] || [];
    return Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          backgroundColor: activeDots.includes(i) ? 'white' : 'transparent',
          boxShadow: activeDots.includes(i) ? '0 0.5px 1px rgba(0,0,0,0.5)' : 'none',
          transition: 'background-color 0.2s',
        }}
      />
    ));
  };

  const isPlayable = !disabled && !isRolling;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.4rem',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        width: '54px',
        height: '54px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        position: 'relative',
      }}
    >
      <div
        onClick={handleRollClick}
        style={{
          position: 'relative',
          width: '36px',
          height: '36px',
          cursor: isPlayable ? 'pointer' : 'not-allowed',
          perspective: '400px',
          transform: anticipating ? 'scale(1.15) rotate(10deg)' : isPlayable ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 0.12s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
          zIndex: 5,
        }}
        className={isPlayable ? 'dice-interactive' : ''}
      >
        {/* Glow behind the active dice */}
        {isPlayable && (
          <div
            style={{
              position: 'absolute',
              top: '-3px',
              left: '-3px',
              right: '-3px',
              bottom: '-3px',
              background: colorGlow[playerColor],
              borderRadius: '8px',
              filter: 'blur(10px)',
              zIndex: 0,
              animation: 'active-dice-glow 1.8s infinite ease-in-out',
            }}
          />
        )}

        {/* 3D Cube Wrapper */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            transformStyle: 'preserve-3d',
            transform: rotation,
            transition: isRolling ? 'transform 0.75s cubic-bezier(0.1, 0.8, 0.35, 1)' : 'transform 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
            animation: isRolling ? 'dice-roll-bounce 0.75s ease-in-out infinite' : 'none',
            zIndex: 1,
          }}
        >
          {([1, 6, 2, 5, 3, 4] as const).map((face) => {
            const rot = faceRotations[face];
            const translateZ = '18px'; // half of 36px
            return (
              <div
                key={face}
                style={{
                  position: 'absolute',
                  width: '36px',
                  height: '36px',
                  background: colorMap[playerColor],
                  border: '1.5px solid rgba(255,255,255,0.22)',
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                  padding: '4px',
                  boxSizing: 'border-box',
                  alignItems: 'center',
                  justifyItems: 'center',
                  backfaceVisibility: 'hidden',
                  transform: `${rot} translateZ(${translateZ})`,
                  boxShadow: `inset 0 0 8px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0,0,0,0.35)`,
                }}
              >
                {getDots(face)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic dice roll shadow scaling */}
      <div
        style={{
          position: 'absolute',
          bottom: '2px',
          width: '26px',
          height: '4px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          filter: 'blur(2px)',
          transform: isRolling ? 'scale(0.5)' : 'scale(1)',
          opacity: isRolling ? 0.2 : 0.85,
          transition: 'all 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <style>{`
        @keyframes dice-roll-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-16px); }
        }
        @keyframes active-dice-glow {
          0%, 100% { opacity: 0.5; filter: blur(8px); }
          50% { opacity: 1.0; filter: blur(12px); }
        }
        .dice-interactive:hover {
          transform: scale(1.1) !important;
        }
      `}</style>
    </div>
  );
};
