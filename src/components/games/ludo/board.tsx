import React, { useState, useEffect, useRef } from 'react';
import { PlayerColor, Coordinate, Token, Move, LudoParticle } from './types';
import { getCoordinate, isSafeCell } from './rules';

interface BoardProps {
  tokens: Token[];
  onTokenClick: (tokenId: number, color: PlayerColor) => void;
  availableMoves: Move[];
  currentTurn: PlayerColor;
  isMovingTokenId: number | null;
  movingTokenColor: PlayerColor | null;
  movingCoordinate: Coordinate | null;
  highlightedPath: Coordinate[];
}

const colorTheme: Record<PlayerColor, { main: string; light: string; dark: string; glow: string }> = {
  RED: { main: '#ff3366', light: '#ffe3e9', dark: '#b30027', glow: 'rgba(255, 51, 102, 0.4)' },
  BLUE: { main: '#3388ff', light: '#e3efff', dark: '#0052c3', glow: 'rgba(51, 136, 255, 0.4)' },
  YELLOW: { main: '#ffaa00', light: '#fff5e0', dark: '#b37400', glow: 'rgba(255, 170, 0, 0.4)' },
  GREEN: { main: '#00cc66', light: '#e0fcf0', dark: '#008f47', glow: 'rgba(0, 204, 102, 0.4)' },
};

// Sleek Star path rendering
const StarShape: React.FC<{ cx: number; cy: number; color?: string; size?: number }> = ({
  cx,
  cy,
  color = '#cfd8dc',
  size = 50,
}) => {
  const points: string[] = [];
  const spikes = 5;
  const outerRadius = size / 2;
  const innerRadius = size / 5;

  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;

  for (let i = 0; i < spikes; i++) {
    points.push(`${cx + Math.cos(rot) * outerRadius},${cy + Math.sin(rot) * outerRadius}`);
    rot += step;
    points.push(`${cx + Math.cos(rot) * innerRadius},${cy + Math.sin(rot) * innerRadius}`);
    rot += step;
  }

  return (
    <polygon
      points={points.join(' ')}
      fill={color}
      stroke="#ffffff"
      strokeWidth="2.5"
      strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
    />
  );
};

export const LudoBoard: React.FC<BoardProps> = ({
  tokens,
  onTokenClick,
  availableMoves,
  currentTurn,
  isMovingTokenId,
  movingTokenColor,
  movingCoordinate,
  highlightedPath,
}) => {
  const [particles, setParticles] = useState<LudoParticle[]>([]);
  const prevTokensRef = useRef<Token[]>([]);
  const requestRef = useRef<number | null>(null);

  // Particle physics animation loop
  useEffect(() => {
    const updateParticles = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.15, // gravity effect
            alpha: Math.max(0, p.alpha - 0.025),
            life: p.life + 1,
          }))
          .filter((p) => p.life < p.maxLife && p.alpha > 0)
      );
      requestRef.current = requestAnimationFrame(updateParticles);
    };

    requestRef.current = requestAnimationFrame(updateParticles);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Detect captures to trigger particle explosion burst
  useEffect(() => {
    const prevTokens = prevTokensRef.current;
    if (prevTokens.length > 0 && tokens.length > 0) {
      tokens.forEach((token) => {
        const prev = prevTokens.find((t) => t.id === token.id && t.color === token.color);
        // If a token's position drops back to 0, it means it got captured!
        if (prev && prev.position > 0 && token.position === 0) {
          const coord = getCoordinate(prev.color, prev.id, prev.position);
          spawnCaptureParticles(coord.x * 100 + 50, coord.y * 100 + 50, colorTheme[prev.color].main);
        }
      });
    }
    prevTokensRef.current = tokens.map((t) => ({ ...t }));
  }, [tokens]);

  const spawnCaptureParticles = (cx: number, cy: number, color: string) => {
    const newParticles: LudoParticle[] = Array.from({ length: 16 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 4;
      return {
        id: Math.random().toString(36).substring(2, 9),
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // blast upwards slightly
        color,
        size: Math.random() * 8 + 6,
        alpha: 1.0,
        life: 0,
        maxLife: 40 + Math.floor(Math.random() * 20),
      };
    });
    setParticles((prev) => [...prev, ...newParticles]);
  };

  const getGroupedTokens = () => {
    const groups: Record<string, Token[]> = {};
    tokens.forEach((token) => {
      let coord: Coordinate;
      if (isMovingTokenId === token.id && movingTokenColor === token.color && movingCoordinate) {
        coord = movingCoordinate;
      } else {
        coord = getCoordinate(token.color, token.id, token.position);
      }

      const key = `${Math.round(coord.x * 10) / 10},${Math.round(coord.y * 10) / 10}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(token);
    });
    return groups;
  };

  const groupedTokens = getGroupedTokens();

  const getCellFill = (x: number, y: number): string => {
    // Red Exit and Home column
    if (x === 6 && y === 1) return 'url(#redExitGrad)';
    if (x === 7 && y >= 1 && y <= 5) return 'url(#redHomeColGrad)';

    // Blue Exit and Home column
    if (x === 1 && y === 8) return 'url(#blueExitGrad)';
    if (y === 7 && x >= 1 && x <= 5) return 'url(#blueHomeColGrad)';

    // Yellow Exit and Home column
    if (x === 8 && y === 13) return 'url(#yellowExitGrad)';
    if (x === 7 && y >= 9 && y <= 13) return 'url(#yellowHomeColGrad)';

    // Green Exit and Home column
    if (x === 13 && y === 6) return 'url(#greenExitGrad)';
    if (y === 7 && x >= 9 && x <= 13) return 'url(#greenHomeColGrad)';

    return '#ffffff';
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.4)',
        border: '6px solid #28282b',
        backgroundColor: '#16161a',
      }}
    >
      <svg
        viewBox="0 0 1500 1500"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        {/* PREMIUM GRADIENT DEFINITIONS */}
        <defs>
          {/* Red Gradients */}
          <linearGradient id="redBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4b72" />
            <stop offset="100%" stopColor="#b30022" />
          </linearGradient>
          <linearGradient id="redExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4b72" />
            <stop offset="100%" stopColor="#d9002b" />
          </linearGradient>
          <linearGradient id="redHomeColGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff3b6b" />
            <stop offset="100%" stopColor="#c20025" />
          </linearGradient>
          
          {/* Blue Gradients */}
          <linearGradient id="blueBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#549cff" />
            <stop offset="100%" stopColor="#0047b3" />
          </linearGradient>
          <linearGradient id="blueExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#549cff" />
            <stop offset="100%" stopColor="#0058e6" />
          </linearGradient>
          <linearGradient id="blueHomeColGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4592ff" />
            <stop offset="100%" stopColor="#004ebf" />
          </linearGradient>

          {/* Yellow Gradients */}
          <linearGradient id="yellowBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#cc8800" />
          </linearGradient>
          <linearGradient id="yellowExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd21f" />
            <stop offset="100%" stopColor="#e09000" />
          </linearGradient>
          <linearGradient id="yellowHomeColGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#cc8800" />
          </linearGradient>

          {/* Green Gradients */}
          <linearGradient id="greenBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e676" />
            <stop offset="100%" stopColor="#007a3d" />
          </linearGradient>
          <linearGradient id="greenExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f57e" />
            <stop offset="100%" stopColor="#00994d" />
          </linearGradient>
          <linearGradient id="greenHomeColGrad" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#00e676" />
            <stop offset="100%" stopColor="#008040" />
          </linearGradient>

          {/* Token Gloss Highlight */}
          <linearGradient id="glossGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          {/* Sleek Diamond Center Gradients */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e1e24" />
            <stop offset="70%" stopColor="#0f0f12" />
            <stop offset="100%" stopColor="#050507" />
          </radialGradient>
        </defs>

        {/* 1. Track Highlights for active playable paths */}
        {highlightedPath.map((cell, idx) => (
          <rect
            key={`highlight-${idx}`}
            x={cell.x * 100 + 4}
            y={cell.y * 100 + 4}
            width={92}
            height={92}
            rx={8}
            fill="none"
            stroke="url(#yellowBaseGrad)"
            strokeWidth="6"
            style={{ animation: 'pulse-path 1.5s infinite' }}
          />
        ))}

        {/* 2. Base Yards */}
        {/* Red Base */}
        <rect x="0" y="0" width="600" height="600" fill="url(#redBaseGrad)" stroke="#1a1a1a" strokeWidth="4" />
        <rect x="80" y="80" width="440" height="440" fill="#121214" rx="28" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        {[[190, 190], [390, 190], [190, 390], [390, 390]].map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy} r="65" fill="#1a1a1e" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="45" fill="url(#redBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
            <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossGrad)" />
          </g>
        ))}

        {/* Green Base */}
        <rect x="900" y="0" width="600" height="600" fill="url(#greenBaseGrad)" stroke="#1a1a1a" strokeWidth="4" />
        <rect x="980" y="80" width="440" height="440" fill="#121214" rx="28" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        {[[1090, 190], [1290, 190], [1090, 390], [1290, 390]].map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy} r="65" fill="#1a1a1e" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="45" fill="url(#greenBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
            <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossGrad)" />
          </g>
        ))}

        {/* Blue Base */}
        <rect x="0" y="900" width="600" height="600" fill="url(#blueBaseGrad)" stroke="#1a1a1a" strokeWidth="4" />
        <rect x="80" y="980" width="440" height="440" fill="#121214" rx="28" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        {[[190, 1090], [390, 1090], [190, 1290], [390, 1290]].map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy} r="65" fill="#1a1a1e" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="45" fill="url(#blueBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
            <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossGrad)" />
          </g>
        ))}

        {/* Yellow Base */}
        <rect x="900" y="900" width="600" height="600" fill="url(#yellowBaseGrad)" stroke="#1a1a1a" strokeWidth="4" />
        <rect x="980" y="980" width="440" height="440" fill="#121214" rx="28" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        {[[1090, 1090], [1290, 1090], [1090, 1290], [1290, 1290]].map(([cx, cy], idx) => (
          <g key={idx}>
            <circle cx={cx} cy={cy} r="65" fill="#1a1a1e" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="45" fill="url(#yellowBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }} />
            <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossGrad)" />
          </g>
        ))}

        {/* 3. Grid Cells */}
        {(() => {
          const cells: React.ReactNode[] = [];
          for (let y = 0; y < 15; y++) {
            for (let x = 0; x < 15; x++) {
              const isBaseRed = x < 6 && y < 6;
              const isBaseGreen = x >= 9 && y < 6;
              const isBaseBlue = x < 6 && y >= 9;
              const isBaseYellow = x >= 9 && y >= 9;
              const isCenter = x >= 6 && x < 9 && y >= 6 && y < 9;

              if (isBaseRed || isBaseGreen || isBaseBlue || isBaseYellow || isCenter) {
                continue;
              }

              const fill = getCellFill(x, y);
              cells.push(
                <rect
                  key={`cell-${x}-${y}`}
                  x={x * 100 + 2}
                  y={y * 100 + 2}
                  width={96}
                  height={96}
                  rx={8}
                  fill={fill}
                  stroke="#efefef"
                  strokeWidth="1.5"
                  style={{
                    filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.1))',
                  }}
                />
              );
            }
          }
          return cells;
        })()}

        {/* 4. Safe Star Cell Indicators */}
        {/* Star icons on safe cells */}
        {[[6, 2], [8, 12], [12, 6], [2, 8]].map(([x, y], idx) => (
          <StarShape key={`star-${idx}`} cx={x * 100 + 50} cy={y * 100 + 50} size={50} />
        ))}
        {/* Color-themed exit starts */}
        <StarShape cx={6 * 100 + 50} cy={1 * 100 + 50} color={colorTheme.RED.dark} size={55} />
        <StarShape cx={1 * 100 + 50} cy={8 * 100 + 50} color={colorTheme.BLUE.dark} size={55} />
        <StarShape cx={8 * 100 + 50} cy={13 * 100 + 50} color={colorTheme.YELLOW.dark} size={55} />
        <StarShape cx={13 * 100 + 50} cy={6 * 100 + 50} color={colorTheme.GREEN.dark} size={55} />

        {/* 5. Central Home Diamond */}
        <rect x="600" y="600" width="300" height="300" fill="url(#centerGlow)" stroke="#222" strokeWidth="4" />
        <g stroke="#ffffff" strokeWidth="3" strokeLinejoin="round">
          <polygon points="600,600 900,600 750,750" fill="url(#redHomeColGrad)" />
          <polygon points="600,900 900,900 750,750" fill="url(#yellowHomeColGrad)" />
          <polygon points="600,600 600,900 750,750" fill="url(#blueHomeColGrad)" />
          <polygon points="900,600 900,900 750,750" fill="url(#greenHomeColGrad)" />
        </g>
        
        {/* Gold victory ring in the very center */}
        <circle cx="750" cy="750" r="35" fill="#151515" stroke="url(#yellowBaseGrad)" strokeWidth="4" />
        <StarShape cx={750} cy={750} color="url(#yellowBaseGrad)" size={35} />

        {/* 6. Active Dynamic Particles Layer */}
        {particles.map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.size}
            fill={p.color}
            opacity={p.alpha}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
          />
        ))}

        {/* 7. Glossy Tokens Layer */}
        {Object.entries(groupedTokens).map(([key, tokensInGroup]) => {
          const [xStr, yStr] = key.split(',');
          const gridX = parseFloat(xStr);
          const gridY = parseFloat(yStr);
          const count = tokensInGroup.length;

          return tokensInGroup.map((token, index) => {
            let dx = 0;
            let dy = 0;
            let scale = 1.0;

            if (count === 2) {
              dx = index === 0 ? -18 : 18;
              scale = 0.8;
            } else if (count === 3) {
              scale = 0.72;
              if (index === 0) dy = -16;
              else if (index === 1) { dx = -18; dy = 16; }
              else { dx = 18; dy = 16; }
            } else if (count >= 4) {
              scale = 0.6;
              const r = index % 4;
              if (r === 0) { dx = -20; dy = -20; }
              else if (r === 1) { dx = 20; dy = -20; }
              else if (r === 2) { dx = -20; dy = 20; }
              else { dx = 20; dy = 20; }
            }

            const cx = gridX * 100 + 50 + dx;
            const cy = gridY * 100 + 50 + dy;

            const isPlayable = availableMoves.some(
              (m) => m.tokenId === token.id && token.color === currentTurn
            );

            // Slightly animate hop between cells if active moving token
            const isMoving = isMovingTokenId === token.id && movingTokenColor === token.color;
            const hopOffset = isMoving ? -14 : 0;

            return (
              <g
                key={`${token.color}-${token.id}`}
                onClick={() => isPlayable && onTokenClick(token.id, token.color)}
                style={{
                  cursor: isPlayable ? 'pointer' : 'default',
                  transition: isMoving ? 'none' : 'transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                }}
                transform={`translate(${cx}, ${cy + hopOffset}) scale(${scale})`}
                className={isPlayable ? 'active-token-hover' : ''}
              >
                {/* Active pulse glow ring */}
                {isPlayable && (
                  <circle
                    r="40"
                    fill="none"
                    stroke={colorTheme[token.color].main}
                    strokeWidth="4.5"
                    style={{ animation: 'active-ring-pulse 1.6s infinite ease-in-out' }}
                  />
                )}

                {/* Token Soft Shadow */}
                <circle cx="2" cy="7" r="28" fill="rgba(0,0,0,0.35)" />

                {/* Glossy Token Body */}
                <circle
                  cx="0"
                  cy="0"
                  r="26"
                  fill={`url(#${token.color.toLowerCase()}BaseGrad)`}
                  stroke="#ffffff"
                  strokeWidth="3.5"
                  style={{
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
                    animation: isPlayable ? 'token-breathing 2s infinite ease-in-out' : 'none',
                  }}
                />

                {/* Inner Highlight Ring */}
                <circle
                  cx="0"
                  cy="0"
                  r="16"
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="2.5"
                />

                {/* Center Core */}
                <circle
                  cx="0"
                  cy="0"
                  r="10"
                  fill={colorTheme[token.color].dark}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <circle cx="-3" cy="-3" r="3" fill="#ffffff" opacity="0.8" />

                {/* 3D Gloss reflection Overlay */}
                <path
                  d="M -18 -10 A 20 20 0 0 1 18 -10 A 20 12 0 0 0 -18 -10 Z"
                  fill="url(#glossGrad)"
                  pointerEvents="none"
                />
              </g>
            );
          });
        })}
      </svg>

      {/* Styled board animation utilities */}
      <style>{`
        @keyframes active-ring-pulse {
          0% { transform: scale(0.96); opacity: 0.8; stroke-width: 4px; }
          50% { transform: scale(1.18); opacity: 0.3; stroke-width: 7px; }
          100% { transform: scale(0.96); opacity: 0.8; stroke-width: 4px; }
        }
        @keyframes pulse-path {
          0%, 100% { opacity: 0.4; stroke-width: 4px; }
          50% { opacity: 1.0; stroke-width: 8px; }
        }
        @keyframes token-breathing {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.05); }
        }
        .active-token-hover:hover {
          transform: scale(1.15) !important;
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
};
