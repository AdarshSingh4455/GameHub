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
  RED: 'hsl(0, 80%, 50%)',
  BLUE: 'hsl(210, 85%, 50%)',
  YELLOW: 'hsl(45, 95%, 45%)',
  GREEN: 'hsl(140, 75%, 40%)',
};

const colorGlow: Record<PlayerColor, string> = {
  RED: 'rgba(255, 0, 0, 0.4)',
  BLUE: 'rgba(0, 100, 255, 0.4)',
  YELLOW: 'rgba(255, 200, 0, 0.4)',
  GREEN: 'rgba(0, 200, 50, 0.4)',
};

export const Dice: React.FC<DiceProps> = ({
  value,
  isRolling,
  onRoll,
  disabled,
  playerColor,
}) => {
  const [rotation, setRotation] = useState<string>(faceRotations[value] || faceRotations[1]);

  useEffect(() => {
    if (isRolling) {
      // Create a rapid, high-spin random rotation while rolling
      const randX = Math.floor(Math.random() * 3 + 3) * 360; // 1080, 1440, etc.
      const randY = Math.floor(Math.random() * 3 + 3) * 360;
      setRotation(`rotateX(${randX + 45}deg) rotateY(${randY + 45}deg)`);
    } else {
      // Snap to final face after rolling completes
      setRotation(faceRotations[value] || faceRotations[1]);
    }
  }, [isRolling, value]);

  const handleDiceClick = () => {
    if (!disabled && !isRolling) {
      onRoll();
    }
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
          transition: 'background-color 0.2s',
        }}
      />
    ));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(8px)',
        minWidth: '120px',
      }}
    >
      <div
        onClick={handleDiceClick}
        style={{
          position: 'relative',
          width: '60px',
          height: '60px',
          cursor: disabled || isRolling ? 'not-allowed' : 'pointer',
          perspective: '600px',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: disabled || isRolling ? 'none' : 'scale(1.05)',
        }}
      >
        {/* Dice Container with animations */}
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            transformStyle: 'preserve-3d',
            transform: rotation,
            transition: isRolling ? 'transform 0.8s cubic-bezier(0.1, 0.8, 0.3, 1)' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
            animation: isRolling ? 'dice-bounce 0.8s ease-in-out infinite' : 'none',
          }}
        >
          {/* Render 6 faces */}
          {([1, 6, 2, 5, 3, 4] as const).map((face) => {
            const rot = faceRotations[face];
            const translateZ = '30px'; // Half of cube size (60px)
            return (
              <div
                key={face}
                style={{
                  position: 'absolute',
                  width: '60px',
                  height: '60px',
                  background: colorMap[playerColor],
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                  padding: '6px',
                  boxSizing: 'border-box',
                  alignItems: 'center',
                  justifyItems: 'center',
                  backfaceVisibility: 'hidden',
                  transform: `${rot} translateZ(${translateZ})`,
                  boxShadow: `inset 0 0 10px rgba(0, 0, 0, 0.4), 0 0 15px ${colorGlow[playerColor]}`,
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
          background: 'rgba(0,0,0,0.6)',
          borderRadius: '50%',
          marginTop: '16px',
          filter: 'blur(4px)',
          transform: isRolling ? 'scale(0.6)' : 'scale(1)',
          opacity: isRolling ? 0.3 : 0.8,
          transition: 'all 0.4s ease-in-out',
        }}
      />

      {/* Instructions label */}
      <span
        style={{
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.5)',
          marginTop: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textAlign: 'center',
        }}
      >
        {isRolling ? 'Rolling...' : disabled ? `${playerColor}'s Turn` : 'Tap to Roll'}
      </span>

      {/* Inject custom dice-bounce animation */}
      <style>{`
        @keyframes dice-bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
};
