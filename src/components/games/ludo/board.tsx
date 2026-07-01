import React from 'react';
import { PlayerColor, Coordinate, Token, Move } from './types';
import { getCoordinate, isSafeCell, TRACK_COORDINATES, START_INDICES, HOME_COLUMNS } from './rules';

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
  RED: {
    main: '#ff3366',
    light: '#ffe3e9',
    dark: '#c3002f',
    glow: 'rgba(255, 51, 102, 0.4)',
  },
  BLUE: {
    main: '#3388ff',
    light: '#e3efff',
    dark: '#0052c3',
    glow: 'rgba(51, 136, 255, 0.4)',
  },
  YELLOW: {
    main: '#ffaa00',
    light: '#fff5e0',
    dark: '#b37400',
    glow: 'rgba(255, 170, 0, 0.4)',
  },
  GREEN: {
    main: '#00cc66',
    light: '#e0fcf0',
    dark: '#008f47',
    glow: 'rgba(0, 204, 102, 0.4)',
  },
};

// Render star SVG for safe cells
const StarIcon: React.FC<{ x: number; y: number; color?: string }> = ({ x, y, color = '#b0bec5' }) => (
  <g transform={`translate(${x * 100 + 20}, ${y * 100 + 20}) scale(0.6)`}>
    <polygon
      points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36"
      fill={color}
      stroke="#ffffff"
      strokeWidth="4"
    />
  </g>
);

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
  // Cell size: 100px on a 1500px SVG viewbox

  // Group tokens by their visual coordinate (x,y)
  const getGroupedTokens = () => {
    const groups: Record<string, Token[]> = {};

    tokens.forEach((token) => {
      // If this token is currently in the middle of a slide animation,
      // use the animated coordinate instead of its logical coordinate
      let coord: Coordinate;
      if (isMovingTokenId === token.id && movingTokenColor === token.color && movingCoordinate) {
        coord = movingCoordinate;
      } else {
        coord = getCoordinate(token.color, token.id, token.position);
      }

      // Round coordinate slightly to group tokens on the same grid cell
      const key = `${Math.round(coord.x * 10) / 10},${Math.round(coord.y * 10) / 10}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(token);
    });

    return groups;
  };

  const groupedTokens = getGroupedTokens();

  const renderCellBg = (x: number, y: number): string => {
    // Check if Red starting/home area
    if (x === 6 && y === 1) return colorTheme.RED.main;
    if (x === 7 && y >= 1 && y <= 5) return colorTheme.RED.main;

    // Check if Blue starting/home area
    if (x === 1 && y === 8) return colorTheme.BLUE.main;
    if (y === 7 && x >= 1 && x <= 5) return colorTheme.BLUE.main;

    // Check if Yellow starting/home area
    if (x === 8 && y === 13) return colorTheme.YELLOW.main;
    if (x === 7 && y >= 9 && y <= 13) return colorTheme.YELLOW.main;

    // Check if Green starting/home area
    if (x === 13 && y === 6) return colorTheme.GREEN.main;
    if (y === 7 && x >= 9 && x <= 13) return colorTheme.GREEN.main;

    // Check star cells
    if (
      (x === 6 && y === 2) ||
      (x === 8 && y === 12) ||
      (x === 12 && y === 6) ||
      (x === 2 && y === 8)
    ) {
      return '#eceff1'; // Light grey for star safe cells
    }

    return '#ffffff'; // Default cell color
  };

  const renderStars = () => {
    const starCoordinates = [
      { x: 6, y: 2 },
      { x: 8, y: 12 },
      { x: 12, y: 6 },
      { x: 2, y: 8 },
      // Starting cells are also safe:
      { x: 6, y: 1, color: colorTheme.RED.dark },
      { x: 1, y: 8, color: colorTheme.BLUE.dark },
      { x: 8, y: 13, color: colorTheme.YELLOW.dark },
      { x: 13, y: 6, color: colorTheme.GREEN.dark },
    ];

    return starCoordinates.map((star, idx) => (
      <StarIcon key={idx} x={star.x} y={star.y} color={star.color} />
    ));
  };

  const renderGridLines = () => {
    const cells: React.ReactNode[] = [];

    // Ludo track arms: cols 6,7,8 or rows 6,7,8
    for (let y = 0; y < 15; y++) {
      for (let x = 0; x < 15; x++) {
        // Skip base yards and center finish triangles
        const isBaseRed = x < 6 && y < 6;
        const isBaseGreen = x >= 9 && y < 6;
        const isBaseBlue = x < 6 && y >= 9;
        const isBaseYellow = x >= 9 && y >= 9;
        const isCenter = x >= 6 && x < 9 && y >= 6 && y < 9;

        if (isBaseRed || isBaseGreen || isBaseBlue || isBaseYellow || isCenter) {
          continue;
        }

        const bg = renderCellBg(x, y);

        cells.push(
          <rect
            key={`${x}-${y}`}
            x={x * 100}
            y={y * 100}
            width={100}
            height={100}
            fill={bg}
            stroke="#b0bec5"
            strokeWidth="2"
          />
        );
      }
    }
    return cells;
  };

  // Render player tokens with automatic stacking layout
  const renderTokens = () => {
    return Object.entries(groupedTokens).map(([key, tokensInGroup]) => {
      const [xStr, yStr] = key.split(',');
      const gridX = parseFloat(xStr);
      const gridY = parseFloat(yStr);

      const count = tokensInGroup.length;
      
      return tokensInGroup.map((token, index) => {
        // Calculate offsets inside cell based on stack count
        let dx = 0;
        let dy = 0;
        let scale = 1.0;

        if (count === 2) {
          dx = index === 0 ? -18 : 18;
          scale = 0.8;
        } else if (count === 3) {
          scale = 0.7;
          if (index === 0) {
            dy = -18;
          } else if (index === 1) {
            dx = -18;
            dy = 18;
          } else {
            dx = 18;
            dy = 18;
          }
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

        return (
          <g
            key={`${token.color}-${token.id}`}
            onClick={() => isPlayable && onTokenClick(token.id, token.color)}
            style={{
              cursor: isPlayable ? 'pointer' : 'default',
              transition: 'transform 0.2s',
            }}
            transform={`translate(${cx}, ${cy}) scale(${scale})`}
          >
            {/* Glow / Active Turn Indicator */}
            {isPlayable && (
              <circle
                r="38"
                fill="none"
                stroke={colorTheme[token.color].main}
                strokeWidth="6"
                style={{
                  animation: 'pulse-glow 1.5s infinite',
                }}
              />
            )}

            {/* Token Base Shadow */}
            <circle cx="2" cy="6" r="28" fill="rgba(0,0,0,0.3)" />

            {/* Token Body */}
            <circle
              cx="0"
              cy="0"
              r="26"
              fill={colorTheme[token.color].main}
              stroke="#ffffff"
              strokeWidth="4"
              className={isPlayable ? 'active-token-idle' : ''}
              style={{
                filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.3))',
              }}
            />

            {/* Token Inner Design */}
            <circle
              cx="0"
              cy="0"
              r="14"
              fill={colorTheme[token.color].dark}
              stroke="#ffffff"
              strokeWidth="2"
            />
            
            {/* Center crown or white dot */}
            <circle cx="0" cy="0" r="5" fill="#ffffff" />
          </g>
        );
      });
    });
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%', // Maintain 1:1 Aspect Ratio
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.2)',
        backgroundColor: '#151515',
        border: '4px solid #2e2e2e',
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
        {/* Playable path highlight (rendered underneath cells for subtle backdrop glow) */}
        {highlightedPath.map((cell, idx) => (
          <rect
            key={`highlight-${idx}`}
            x={cell.x * 100}
            y={cell.y * 100}
            width={100}
            height={100}
            fill="rgba(255, 255, 255, 0.08)"
            style={{ animation: 'pulse-bg 2s infinite' }}
          />
        ))}

        {/* 1. Base Yards */}
        {/* Red Base */}
        <rect x="0" y="0" width="600" height="600" fill={colorTheme.RED.main} />
        <rect x="100" y="100" width="400" height="400" fill="#ffffff" rx="20" />
        <circle cx="200" cy="200" r="60" fill={colorTheme.RED.main} stroke="#fff" strokeWidth="4" />
        <circle cx="350" cy="200" r="60" fill={colorTheme.RED.main} stroke="#fff" strokeWidth="4" />
        <circle cx="200" cy="350" r="60" fill={colorTheme.RED.main} stroke="#fff" strokeWidth="4" />
        <circle cx="350" cy="350" r="60" fill={colorTheme.RED.main} stroke="#fff" strokeWidth="4" />

        {/* Green Base */}
        <rect x="900" y="0" width="600" height="600" fill={colorTheme.GREEN.main} />
        <rect x="1000" y="100" width="400" height="400" fill="#ffffff" rx="20" />
        <circle cx="1100" cy="200" r="60" fill={colorTheme.GREEN.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1250" cy="200" r="60" fill={colorTheme.GREEN.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1100" cy="350" r="60" fill={colorTheme.GREEN.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1250" cy="350" r="60" fill={colorTheme.GREEN.main} stroke="#fff" strokeWidth="4" />

        {/* Blue Base */}
        <rect x="0" y="900" width="600" height="600" fill={colorTheme.BLUE.main} />
        <rect x="100" y="1000" width="400" height="400" fill="#ffffff" rx="20" />
        <circle cx="200" cy="1100" r="60" fill={colorTheme.BLUE.main} stroke="#fff" strokeWidth="4" />
        <circle cx="350" cy="1100" r="60" fill={colorTheme.BLUE.main} stroke="#fff" strokeWidth="4" />
        <circle cx="200" cy="1250" r="60" fill={colorTheme.BLUE.main} stroke="#fff" strokeWidth="4" />
        <circle cx="350" cy="1250" r="60" fill={colorTheme.BLUE.main} stroke="#fff" strokeWidth="4" />

        {/* Yellow Base */}
        <rect x="900" y="900" width="600" height="600" fill={colorTheme.YELLOW.main} />
        <rect x="1000" y="1000" width="400" height="400" fill="#ffffff" rx="20" />
        <circle cx="1100" cy="1100" r="60" fill={colorTheme.YELLOW.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1250" cy="1100" r="60" fill={colorTheme.YELLOW.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1100" cy="1250" r="60" fill={colorTheme.YELLOW.main} stroke="#fff" strokeWidth="4" />
        <circle cx="1250" cy="1250" r="60" fill={colorTheme.YELLOW.main} stroke="#fff" strokeWidth="4" />

        {/* 2. Outer Track Cells */}
        {renderGridLines()}

        {/* 3. Star Safe Cells */}
        {renderStars()}

        {/* 4. Center Home Triangles */}
        <g stroke="#ffffff" strokeWidth="4" strokeLinejoin="round">
          {/* Top (Red) */}
          <polygon points="600,600 900,600 750,750" fill={colorTheme.RED.main} />
          {/* Bottom (Yellow) */}
          <polygon points="600,900 900,900 750,750" fill={colorTheme.YELLOW.main} />
          {/* Left (Blue) */}
          <polygon points="600,600 600,900 750,750" fill={colorTheme.BLUE.main} />
          {/* Right (Green) */}
          <polygon points="900,600 900,900 750,750" fill={colorTheme.GREEN.main} />
        </g>
        
        {/* Draw central crown logo */}
        <circle cx="750" cy="750" r="40" fill="#ffffff" stroke="#333" strokeWidth="4" />
        <polygon points="735,760 765,760 760,740 750,750 740,740" fill="#ffaa00" />

        {/* 5. Tokens Layer */}
        {renderTokens()}
      </svg>

      {/* CSS Styles for Board animations */}
      <style>{`
        @keyframes pulse-glow {
          0% { transform: scale(1.0); opacity: 0.6; stroke-width: 6px; }
          50% { transform: scale(1.15); opacity: 1.0; stroke-width: 10px; }
          100% { transform: scale(1.0); opacity: 0.6; stroke-width: 6px; }
        }
        @keyframes pulse-bg {
          0%, 100% { fill: rgba(255, 255, 255, 0.04); }
          50% { fill: rgba(255, 255, 255, 0.16); }
        }
        .active-token-idle {
          animation: float-active 2s ease-in-out infinite;
        }
        @keyframes float-active {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
