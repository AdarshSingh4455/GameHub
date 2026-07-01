import { PlayerColor, Coordinate, Token, Move } from './types';

// The 52 track coordinates on the 15x15 grid in clockwise order.
export const TRACK_COORDINATES: Coordinate[] = [
  { x: 6, y: 0 }, { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 }, // Top vertical arm, left lane (going down)
  { x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }, { x: 2, y: 6 }, { x: 1, y: 6 }, { x: 0, y: 6 }, // Left horizontal arm, top lane (going left)
  { x: 0, y: 7 }, // Left corner
  { x: 0, y: 8 }, { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, // Left horizontal arm, bottom lane (going right)
  { x: 6, y: 9 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }, { x: 6, y: 13 }, { x: 6, y: 14 }, // Bottom vertical arm, left lane (going down)
  { x: 7, y: 14 }, // Bottom corner
  { x: 8, y: 14 }, { x: 8, y: 13 }, { x: 8, y: 12 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 8, y: 9 }, // Bottom vertical arm, right lane (going up)
  { x: 9, y: 8 }, { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }, { x: 14, y: 8 }, // Right horizontal arm, bottom lane (going right)
  { x: 14, y: 7 }, // Right corner
  { x: 14, y: 6 }, { x: 13, y: 6 }, { x: 12, y: 6 }, { x: 11, y: 6 }, { x: 10, y: 6 }, { x: 9, y: 6 }, // Right horizontal arm, top lane (going left)
  { x: 8, y: 5 }, { x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 0 }, // Top vertical arm, right lane (going up)
  { x: 7, y: 0 }  // Top corner
];

// Start index in the TRACK_COORDINATES array for each player
export const START_INDICES: Record<PlayerColor, number> = {
  RED: 1,      // { x: 6, y: 1 }
  BLUE: 14,    // { x: 1, y: 8 }
  YELLOW: 27,  // { x: 8, y: 13 }
  GREEN: 40    // { x: 13, y: 6 }
};

// Safe track indices (Star/Start cells where pieces cannot be captured)
export const SAFE_TRACK_INDICES = new Set([1, 8, 14, 21, 27, 34, 40, 47]);

// Home Column coordinates for each player (5 cells per color)
export const HOME_COLUMNS: Record<PlayerColor, Coordinate[]> = {
  RED: [
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }
  ],
  BLUE: [
    { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }
  ],
  YELLOW: [
    { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }
  ],
  GREEN: [
    { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }
  ]
};

// Finish center coordinates for each player color
export const FINISH_COORDINATES: Record<PlayerColor, Coordinate> = {
  RED: { x: 7, y: 6 },
  BLUE: { x: 6, y: 7 },
  YELLOW: { x: 7, y: 8 },
  GREEN: { x: 8, y: 7 }
};

// Base coordinates offsets for rendering 4 tokens inside base yards
export const BASE_OFFSETS: Record<PlayerColor, Coordinate[]> = {
  RED: [
    { x: 2, y: 2 }, { x: 3.5, y: 2 }, { x: 2, y: 3.5 }, { x: 3.5, y: 3.5 }
  ],
  BLUE: [
    { x: 2, y: 11 }, { x: 3.5, y: 11 }, { x: 2, y: 12.5 }, { x: 3.5, y: 12.5 }
  ],
  YELLOW: [
    { x: 11, y: 11 }, { x: 12.5, y: 11 }, { x: 11, y: 12.5 }, { x: 12.5, y: 12.5 }
  ],
  GREEN: [
    { x: 11, y: 2 }, { x: 12.5, y: 2 }, { x: 11, y: 3.5 }, { x: 12.5, y: 3.5 }
  ]
};

/**
 * Get grid coordinates for a token based on its local step position.
 * @param color Player color
 * @param id Token id (0..3)
 * @param step Local step position (0..57)
 */
export function getCoordinate(color: PlayerColor, id: number, step: number): Coordinate {
  if (step === 0) {
    // Yards / Base position
    return BASE_OFFSETS[color][id];
  }
  
  if (step >= 57) {
    // Finished / Home center
    return FINISH_COORDINATES[color];
  }
  
  if (step >= 52) {
    // Home column steps
    const index = step - 52; // 0..4
    return HOME_COLUMNS[color][index];
  }
  
  // Outer track steps
  const startIdx = START_INDICES[color];
  const trackIdx = (startIdx + step - 1) % 52;
  return TRACK_COORDINATES[trackIdx];
}

/**
 * Checks if a token is in a safe zone (base, home column, home center, or safe cells).
 */
export function isSafeCell(color: PlayerColor, step: number): boolean {
  if (step === 0 || step >= 52) {
    return true; // base, home column, and home center are all safe
  }
  const startIdx = START_INDICES[color];
  const trackIdx = (startIdx + step - 1) % 52;
  return SAFE_TRACK_INDICES.has(trackIdx);
}

/**
 * Checks if a token can make a legal move given the dice roll.
 */
export function canMoveToken(token: Token, diceValue: number): boolean {
  if (token.position === 57) {
    return false; // Already finished
  }
  
  if (token.position === 0) {
    // In base: needs a 6 to deploy
    return diceValue === 6;
  }
  
  // Moving on track or home column: must not overshoot home center
  return token.position + diceValue <= 57;
}

/**
 * Calculates all available moves for a list of tokens given the dice value.
 */
export function getAvailableMoves(tokens: Token[], diceValue: number): Move[] {
  const moves: Move[] = [];
  for (const token of tokens) {
    if (canMoveToken(token, diceValue)) {
      moves.push({
        tokenId: token.id,
        fromPosition: token.position,
        toPosition: token.position === 0 ? 1 : token.position + diceValue
      });
    }
  }
  return moves;
}
