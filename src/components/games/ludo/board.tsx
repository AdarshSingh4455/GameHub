import React, { useState, useEffect, useRef } from 'react';
import { PlayerColor, Coordinate, Token, Move, LudoParticle } from './types';
import { getCoordinate, START_INDICES, SAFE_TRACK_INDICES, TRACK_COORDINATES } from './rules';

interface BoardProps {
  tokens: Token[];
  onTokenClick: (tokenId: number, color: PlayerColor) => void;
  availableMoves: Move[];
  currentTurn: PlayerColor;
  isMovingTokenId: number | null;
  movingTokenColor: PlayerColor | null;
  movingCoordinate: Coordinate | null;
  highlightedPath: Coordinate[];
  onYardClick: (color: PlayerColor) => void;
}

const colorTheme: Record<PlayerColor, { main: string; light: string; dark: string; glow: string; border: string }> = {
  RED: { main: '#ff3366', light: '#ffe3e9', dark: '#b30027', glow: 'rgba(255, 51, 102, 0.4)', border: '#ffe6eb' },
  BLUE: { main: '#3388ff', light: '#e3efff', dark: '#0052c3', glow: 'rgba(51, 136, 255, 0.4)', border: '#e6f0ff' },
  YELLOW: { main: '#ffaa00', light: '#fff5e0', dark: '#b37400', glow: 'rgba(255, 170, 0, 0.4)', border: '#fff9e6' },
  GREEN: { main: '#00cc66', light: '#e0fcf0', dark: '#008f47', glow: 'rgba(0, 204, 102, 0.4)', border: '#e6ffe6' },
};

// SVG Safe Star Polygon component
const StarShape: React.FC<{ cx: number; cy: number; color?: string; size?: number }> = ({
  cx,
  cy,
  color = '#455a64',
  size = 46,
}) => {
  const points: string[] = [];
  const spikes = 5;
  const outerRadius = size / 2;
  const innerRadius = size / 4.8;

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
      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
      pointerEvents="none"
    />
  );
};

// SVG directional path arrows
const DirectionArrow: React.FC<{ cx: number; cy: number; dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'; color: string }> = ({
  cx,
  cy,
  dir,
  color,
}) => {
  let points = '';
  if (dir === 'RIGHT') {
    points = `${cx - 20},${cy - 12} ${cx + 15},${cy} ${cx - 20},${cy + 12}`;
  } else if (dir === 'DOWN') {
    points = `${cx - 12},${cy - 20} ${cx},${cy + 15} ${cx + 12},${cy - 20}`;
  } else if (dir === 'LEFT') {
    points = `${cx + 20},${cy - 12} ${cx - 15},${cy} ${cx + 20},${cy + 12}`;
  } else {
    points = `${cx - 12},${cy + 20} ${cx},${cy - 15} ${cx + 12},${cy + 20}`;
  }

  return (
    <polygon
      points={points}
      fill={color}
      opacity="0.85"
      stroke="#ffffff"
      strokeWidth="1.5"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
      pointerEvents="none"
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
  onYardClick,
}) => {
  const [particles, setParticles] = useState<LudoParticle[]>([]);
  const prevTokensRef = useRef<Token[]>([]);
  const requestRef = useRef<number | null>(null);

  // Landing bounce animation trigger state
  const [landingToken, setLandingToken] = useState<{ color: PlayerColor; id: number } | null>(null);
  const prevMovingIdRef = useRef<number | null>(null);
  const prevMovingColorRef = useRef<PlayerColor | null>(null);

  useEffect(() => {
    if (prevMovingIdRef.current !== null && isMovingTokenId === null && prevMovingColorRef.current !== null) {
      const color = prevMovingColorRef.current;
      const id = prevMovingIdRef.current;
      setLandingToken({ color, id });
      const timer = setTimeout(() => {
        setLandingToken(null);
      }, 180);
      return () => clearTimeout(timer);
    }
    prevMovingIdRef.current = isMovingTokenId;
    prevMovingColorRef.current = movingTokenColor;
  }, [isMovingTokenId, movingTokenColor]);

  // Particle physics animation loop
  useEffect(() => {
    const updateParticles = () => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.16, // gravity
            alpha: Math.max(0, p.alpha - 0.024),
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

  // Detect captures to spawn particle explosion
  useEffect(() => {
    const prevTokens = prevTokensRef.current;
    if (prevTokens.length > 0 && tokens.length > 0) {
      tokens.forEach((token) => {
        const prev = prevTokens.find((t) => t.id === token.id && t.color === token.color);
        if (prev && prev.position > 0 && token.position === 0) {
          const coord = getCoordinate(prev.color, prev.id, prev.position);
          spawnCaptureParticles(coord.x * 100 + 50, coord.y * 100 + 50, colorTheme[prev.color].main);
        }
      });
    }
    prevTokensRef.current = tokens.map((t) => ({ ...t }));
  }, [tokens]);

  const spawnCaptureParticles = (cx: number, cy: number, color: string) => {
    const newParticles: LudoParticle[] = Array.from({ length: 18 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 4;
      return {
        id: Math.random().toString(36).substring(2, 9),
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        color,
        size: Math.random() * 8 + 5,
        alpha: 1.0,
        life: 0,
        maxLife: 35 + Math.floor(Math.random() * 20),
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

      // Keep coordinates to 1 decimal place to bundle overlaps correctly
      const key = `${Math.round(coord.x * 10) / 10},${Math.round(coord.y * 10) / 10}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(token);
    });
    return groups;
  };

  const groupedTokens = getGroupedTokens();

  // Return the background color/gradient for each specific cell coordinate
  const getCellFill = (x: number, y: number): string => {
    // Red Start & Home column
    if (x === 1 && y === 6) return 'url(#redExitGrad)';
    if (y === 7 && x >= 1 && x <= 5) return 'url(#redHomeColGrad)';

    // Green Start & Home column
    if (x === 8 && y === 1) return 'url(#greenExitGrad)';
    if (x === 7 && y >= 1 && y <= 5) return 'url(#greenHomeColGrad)';

    // Yellow Start & Home column
    if (x === 13 && y === 8) return 'url(#yellowExitGrad)';
    if (y === 7 && x >= 9 && x <= 13) return 'url(#yellowHomeColGrad)';

    // Blue Start & Home column
    if (x === 6 && y === 13) return 'url(#blueExitGrad)';
    if (x === 7 && y >= 9 && y <= 13) return 'url(#blueHomeColGrad)';

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
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45), inset 0 0 35px rgba(0, 0, 0, 0.35)',
        border: '6px solid #1a1a1d',
        backgroundColor: '#111115',
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
        {/* PREMIUM GRADIENTS & SHADOW DEFINITIONS */}
        <defs>
          {/* Metallic rims */}
          <linearGradient id="silverRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#9e9e9e" />
            <stop offset="100%" stopColor="#424242" />
          </linearGradient>
          <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffee55" />
            <stop offset="50%" stopColor="#b38f00" />
            <stop offset="100%" stopColor="#665200" />
          </linearGradient>

          {/* Red Gradients */}
          <linearGradient id="redBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4d79" />
            <stop offset="100%" stopColor="#c2002f" />
          </linearGradient>
          <linearGradient id="redExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff4d79" />
            <stop offset="100%" stopColor="#b30027" />
          </linearGradient>
          <linearGradient id="redHomeColGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff3366" />
            <stop offset="100%" stopColor="#990022" />
          </linearGradient>
          
          {/* Blue Gradients */}
          <linearGradient id="blueBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4d94ff" />
            <stop offset="100%" stopColor="#0047b3" />
          </linearGradient>
          <linearGradient id="blueExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4d94ff" />
            <stop offset="100%" stopColor="#003d99" />
          </linearGradient>
          <linearGradient id="blueHomeColGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3388ff" />
            <stop offset="100%" stopColor="#002b80" />
          </linearGradient>

          {/* Yellow Gradients */}
          <linearGradient id="yellowBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#b38600" />
          </linearGradient>
          <linearGradient id="yellowExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffcc00" />
            <stop offset="100%" stopColor="#997300" />
          </linearGradient>
          <linearGradient id="yellowHomeColGrad" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ffaa00" />
            <stop offset="100%" stopColor="#805500" />
          </linearGradient>

          {/* Green Gradients */}
          <linearGradient id="greenBaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e676" />
            <stop offset="100%" stopColor="#006633" />
          </linearGradient>
          <linearGradient id="greenExitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e676" />
            <stop offset="100%" stopColor="#00592d" />
          </linearGradient>
          <linearGradient id="greenHomeColGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#00cc66" />
            <stop offset="100%" stopColor="#004d26" />
          </linearGradient>

          {/* Dark Metallic Center */}
          <radialGradient id="centerDiamondGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#25252b" />
            <stop offset="60%" stopColor="#131317" />
            <stop offset="100%" stopColor="#08080a" />
          </radialGradient>

          {/* Gloss overlay */}
          <linearGradient id="glossHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 1. Playable Path Glow Highlights */}
        {highlightedPath.map((cell, idx) => (
          <rect
            key={`highlight-${idx}`}
            x={cell.x * 100 + 4}
            y={cell.y * 100 + 4}
            width={92}
            height={92}
            rx={10}
            fill="none"
            stroke="url(#goldRim)"
            strokeWidth="5"
            style={{ animation: 'active-path-pulse 1.3s infinite ease-in-out' }}
          />
        ))}

        {/* 2. Base Yards (Interactive) */}
        {/* Red Base (Top-Left) */}
        <g onClick={() => onYardClick('RED')} style={{ cursor: 'pointer' }}>
          <rect x="0" y="0" width="600" height="600" fill="url(#redBaseGrad)" stroke="#1a1a1d" strokeWidth="4" />
          <rect x="80" y="80" width="440" height="440" fill="#131316" rx="24" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          {[[190, 190], [390, 190], [190, 390], [390, 390]].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy} r="65" fill="#1b1b22" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="45" fill="url(#redBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }} />
              <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossHighlight)" />
            </g>
          ))}
        </g>

        {/* Green Base (Top-Right) */}
        <g onClick={() => onYardClick('GREEN')} style={{ cursor: 'pointer' }}>
          <rect x="900" y="0" width="600" height="600" fill="url(#greenBaseGrad)" stroke="#1a1a1d" strokeWidth="4" />
          <rect x="980" y="80" width="440" height="440" fill="#131316" rx="24" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          {[[1090, 190], [1290, 190], [1090, 390], [1290, 390]].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy} r="65" fill="#1b1b22" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="45" fill="url(#greenBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }} />
              <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossHighlight)" />
            </g>
          ))}
        </g>

        {/* Yellow Base (Bottom-Right) */}
        <g onClick={() => onYardClick('YELLOW')} style={{ cursor: 'pointer' }}>
          <rect x="900" y="900" width="600" height="600" fill="url(#yellowBaseGrad)" stroke="#1a1a1d" strokeWidth="4" />
          <rect x="980" y="980" width="440" height="440" fill="#131316" rx="24" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          {[[1090, 1090], [1290, 1090], [1090, 1290], [1290, 1290]].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy} r="65" fill="#1b1b22" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="45" fill="url(#yellowBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }} />
              <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossHighlight)" />
            </g>
          ))}
        </g>

        {/* Blue Base (Bottom-Left) */}
        <g onClick={() => onYardClick('BLUE')} style={{ cursor: 'pointer' }}>
          <rect x="0" y="900" width="600" height="600" fill="url(#blueBaseGrad)" stroke="#1a1a1d" strokeWidth="4" />
          <rect x="80" y="980" width="440" height="440" fill="#131316" rx="24" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          {[[190, 1090], [390, 1090], [190, 1290], [390, 1290]].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle cx={cx} cy={cy} r="65" fill="#1b1b22" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx={cx} cy={cy} r="45" fill="url(#blueBaseGrad)" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }} />
              <circle cx={cx} cy={cy - 10} r="25" fill="url(#glossHighlight)" />
            </g>
          ))}
        </g>

        {/* 3. Grid Cells Track */}
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
                  stroke="#dedede"
                  strokeWidth="1.5"
                  style={{
                    filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.08))',
                  }}
                />
              );
            }
          }
          return cells;
        })()}

        {/* 4. Directional Arrows for exit/spawns */}
        <DirectionArrow cx={1 * 100 + 50} cy={6 * 100 + 50} dir="RIGHT" color={colorTheme.RED.main} />
        <DirectionArrow cx={8 * 100 + 50} cy={1 * 100 + 50} dir="DOWN" color={colorTheme.GREEN.main} />
        <DirectionArrow cx={13 * 100 + 50} cy={8 * 100 + 50} dir="LEFT" color={colorTheme.YELLOW.main} />
        <DirectionArrow cx={6 * 100 + 50} cy={13 * 100 + 50} dir="UP" color={colorTheme.BLUE.main} />

        {/* 5. Safe Star Cell Indicators */}
        {/* Star icons on safe cells */}
        {[[6, 2], [12, 6], [8, 12], [2, 8]].map(([x, y], idx) => (
          <StarShape key={`star-${idx}`} cx={x * 100 + 50} cy={y * 100 + 50} size={50} />
        ))}
        {/* Color-themed exit starts */}
        <StarShape cx={1 * 100 + 50} cy={6 * 100 + 50} color={colorTheme.RED.dark} size={55} />
        <StarShape cx={8 * 100 + 50} cy={1 * 100 + 50} color={colorTheme.GREEN.dark} size={55} />
        <StarShape cx={13 * 100 + 50} cy={8 * 100 + 50} color={colorTheme.YELLOW.dark} size={55} />
        <StarShape cx={6 * 100 + 50} cy={13 * 100 + 50} color={colorTheme.BLUE.dark} size={55} />

        {/* 6. Authentic Central Home Diamond (Redesigned colors/orientation matching Indian Ludo) */}
        <rect x="600" y="600" width="300" height="300" fill="url(#centerDiamondGrad)" stroke="#1a1a1d" strokeWidth="4" />
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round">
          <polygon points="600,600 600,900 750,750" fill="url(#redHomeColGrad)" />
          <polygon points="600,600 900,600 750,750" fill="url(#greenHomeColGrad)" />
          <polygon points="900,600 900,900 750,750" fill="url(#yellowHomeColGrad)" />
          <polygon points="600,900 900,900 750,750" fill="url(#blueHomeColGrad)" />
        </g>
        
        {/* Centered gold compass/ring */}
        <circle cx="750" cy="750" r="30" fill="#121214" stroke="url(#goldRim)" strokeWidth="3" />
        <StarShape cx={750} cy={750} color="url(#goldRim)" size={32} />

        {/* 7. Particles Layer */}
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

        {/* 8. 3D Glossy Premium Tokens Layer */}
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

            const isMoving = isMovingTokenId === token.id && movingTokenColor === token.color;
            const hopOffset = isMoving ? -18 : 0;
            const isLanding = landingToken?.color === token.color && landingToken?.id === token.id;

            return (
              <g
                key={`${token.color}-${token.id}`}
                onClick={() => isPlayable && onTokenClick(token.id, token.color)}
                style={{
                  cursor: isPlayable ? 'pointer' : 'default',
                  transition: isMoving ? 'transform 0.16s linear' : 'transform 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                  animation: isLanding
                    ? 'token-landing-bounce 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
                    : isPlayable
                      ? 'token-breathing 2s infinite ease-in-out'
                      : 'none',
                }}
                transform={`translate(${cx}, ${cy + hopOffset}) scale(${scale})`}
                className={isPlayable ? 'active-token-hover' : ''}
              >
                {/* Active pulse glow halo */}
                {isPlayable && (
                  <circle
                    r="44"
                    fill="none"
                    stroke={colorTheme[token.color].main}
                    strokeWidth="5"
                    style={{ animation: 'active-ring-pulse 1.4s infinite ease-in-out' }}
                  />
                )}

                {/* Token Soft Shadow (Offset downward) */}
                <circle cx="0" cy="9" r="29" fill="rgba(0,0,0,0.4)" />

                {/* Metallic Gold/Silver outer rim */}
                <circle
                  cx="0"
                  cy="0"
                  r="28"
                  fill="url(#silverRim)"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Token Primary resin body */}
                <circle
                  cx="0"
                  cy="0"
                  r="24"
                  fill={`url(#${token.color.toLowerCase()}BaseGrad)`}
                  stroke={colorTheme[token.color].border}
                  strokeWidth="2"
                  style={{
                    filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.3))',
                    animation: isPlayable ? 'token-breathing 2s infinite ease-in-out' : 'none',
                  }}
                />

                {/* Secondary inner ring */}
                <circle
                  cx="0"
                  cy="0"
                  r="15"
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="2"
                />

                {/* Core gem */}
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill={colorTheme[token.color].dark}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Spot reflection highlights */}
                <circle cx="-4" cy="-4" r="3.5" fill="#ffffff" opacity="0.85" />
                <path
                  d="M -16 -8 A 18 18 0 0 1 16 -8 A 18 10 0 0 0 -16 -8 Z"
                  fill="url(#glossHighlight)"
                  pointerEvents="none"
                />
              </g>
            );
          });
        })}
      </svg>

      <style>{`
        @keyframes active-ring-pulse {
          0% { transform: scale(0.95); opacity: 0.9; stroke-width: 4px; }
          50% { transform: scale(1.2); opacity: 0.2; stroke-width: 7px; }
          100% { transform: scale(0.95); opacity: 0.9; stroke-width: 4px; }
        }
        @keyframes active-path-pulse {
          0%, 100% { opacity: 0.45; stroke-width: 4px; }
          50% { opacity: 1.0; stroke-width: 7px; }
        }
        @keyframes token-breathing {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.06); }
        }
        @keyframes token-landing-bounce {
          0% { transform: scale(1.22) translateY(-12px); filter: brightness(1.2) drop-shadow(0 12px 18px rgba(0,0,0,0.45)); }
          45% { transform: scale(0.85) translateY(2px); filter: brightness(1.0); }
          75% { transform: scale(1.06) translateY(-2px); }
          100% { transform: scale(1.0) translateY(0); }
        }
        .active-token-hover:hover {
          transform: scale(1.22) !important;
          filter: brightness(1.15) contrast(1.05);
        }
      `}</style>
    </div>
  );
};
