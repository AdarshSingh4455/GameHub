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
  RED: 'rgba(255, 51, 102, 0.5)',
  BLUE: 'rgba(51, 136, 255, 0.5)',
  YELLOW: 'rgba(255, 170, 0, 0.5)',
  GREEN: 'rgba(0, 204, 102, 0.5)',
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
      // Rapid multiple rotations (inertia)
      const randX = (Math.floor(Math.random() * 3) + 4) * 360; // 1440, 1800, etc.
      const randY = (Math.floor(Math.random() * 3) + 4) * 360;
      setRotation(`rotateX(${randX + 45}deg) rotateY(${randY + 45}deg)`);
    } else {
      // Snap to target face
      setRotation(faceRotations[value] || faceRotations[1]);
    }
  }, [isRolling, value]);

  const handleRollClick = () => {
    if (disabled || isRolling) return;
    
    // Trigger roll anticipation effect
    setAnticipating(true);
    setTimeout(() => {
      setAnticipating(false);
      onRoll();
    }, 150);
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
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: activeDots.includes(i) ? 'white' : 'transparent',
          boxShadow: activeDots.includes(i) ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(16px)',
        minWidth: '130px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      <div
        onClick={handleRollClick}
        style={{
          position: 'relative',
          width: '60px',
          height: '60px',
          cursor: isPlayable ? 'pointer' : 'not-allowed',
          perspective: '600px',
          transform: anticipating ? 'scale(1.2) rotate(15deg)' : isPlayable ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        }}
        className={isPlayable ? 'dice-interactive' : ''}
      >
        {/* Glow behind the active dice */}
        {isPlayable && (
          <div
            style={{
              position: 'absolute',
              top: '-5px',
              left: '-5px',
              right: '-5px',
              bottom: '-5px',
              background: colorGlow[playerColor],
              borderRadius: '12px',
              filter: 'blur(12px)',
              zIndex: 0,
              animation: 'active-dice-glow 2s infinite ease-in-out',
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
            transition: isRolling ? 'transform 0.8s cubic-bezier(0.1, 0.8, 0.35, 1)' : 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
            animation: isRolling ? 'dice-roll-bounce 0.8s ease-in-out infinite' : 'none',
            zIndex: 1,
          }}
        >
          {([1, 6, 2, 5, 3, 4] as const).map((face) => {
            const rot = faceRotations[face];
            const translateZ = '30px';
            return (
              <div
                key={face}
                style={{
                  position: 'absolute',
                  width: '60px',
                  height: '60px',
                  background: colorMap[playerColor],
                  border: '2px solid rgba(255,255,255,0.25)',
                  borderRadius: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                  padding: '7px',
                  boxSizing: 'border-box',
                  alignItems: 'center',
                  justifyItems: 'center',
                  backfaceVisibility: 'hidden',
                  transform: `${rot} translateZ(${translateZ})`,
                  boxShadow: `inset 0 0 12px rgba(0, 0, 0, 0.4), 0 4px 10px rgba(0,0,0,0.3)`,
                }}
              >
                {getDots(face)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Styled shadow beneath dice */}
      <div
        style={{
          width: '50px',
          height: '6px',
          background: 'rgba(0,0,0,0.5)',
          borderRadius: '50%',
          marginTop: '18px',
          filter: 'blur(3px)',
          transform: isRolling ? 'scale(0.55)' : 'scale(1)',
          opacity: isRolling ? 0.25 : 0.8,
          transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />

      {/* Instructions label */}
      <span
        style={{
          fontSize: '0.72rem',
          color: isPlayable ? '#fff' : 'rgba(255,255,255,0.4)',
          marginTop: '12px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textAlign: 'center',
          textShadow: isPlayable ? `0 0 8px ${colorGlow[playerColor]}` : 'none',
          animation: isPlayable ? 'text-glow 1.5s infinite alternate' : 'none',
        }}
      >
        {isRolling ? 'Rolling...' : disabled ? `${playerColor}'s Turn` : 'Tap to Roll'}
      </span>

      {/* Keyframe animations */}
      <style>{`
        @keyframes dice-roll-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-24px); }
        }
        @keyframes active-dice-glow {
          0%, 100% { opacity: 0.4; filter: blur(10px); }
          50% { opacity: 0.9; filter: blur(14px); }
        }
        @keyframes text-glow {
          0% { opacity: 0.8; }
          100% { opacity: 1.0; }
        }
        .dice-interactive:hover {
          transform: scale(1.12) !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
};
