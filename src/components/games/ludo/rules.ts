import { PlayerColor, Coordinate, Token, Move } from './types';

// Authentic 52 track coordinates on the 15x15 Indian Ludo Board in clockwise order.
export const TRACK_COORDINATES: Coordinate[] = [
  { x: 0, y: 6 }, // 0: RED home entry cell
  { x: 1, y: 6 }, // 1: RED Starting position
  { x: 2, y: 6 }, // 2
  { x: 3, y: 6 }, // 3
  { x: 4, y: 6 }, // 4
  { x: 5, y: 6 }, // 5
  { x: 6, y: 5 }, // 6
  { x: 6, y: 4 }, // 7
  { x: 6, y: 3 }, // 8
  { x: 6, y: 2 }, // 9: Safe cell (Star)
  { x: 6, y: 1 }, // 10
  { x: 6, y: 0 }, // 11
  { x: 7, y: 0 }, // 12
  { x: 8, y: 0 }, // 13: GREEN home entry cell
  { x: 8, y: 1 }, // 14: GREEN Starting position
  { x: 8, y: 2 }, // 15
  { x: 8, y: 3 }, // 16
  { x: 8, y: 4 }, // 17
  { x: 8, y: 5 }, // 18
  { x: 9, y: 6 }, // 19
  { x: 10, y: 6 }, // 20
  { x: 11, y: 6 }, // 21
  { x: 12, y: 6 }, // 22: Safe cell (Star)
  { x: 13, y: 6 }, // 23
  { x: 14, y: 6 }, // 24
  { x: 14, y: 7 }, // 25
  { x: 14, y: 8 }, // 26: YELLOW home entry cell
  { x: 13, y: 8 }, // 27: YELLOW Starting position
  { x: 12, y: 8 }, // 28
  { x: 11, y: 8 }, // 29
  { x: 10, y: 8 }, // 30
  { x: 9, y: 8 }, // 31
  { x: 8, y: 9 }, // 32
  { x: 8, y: 10 }, // 33
  { x: 8, y: 11 }, // 34
  { x: 8, y: 12 }, // 35: Safe cell (Star)
  { x: 8, y: 13 }, // 36
  { x: 8, y: 14 }, // 37
  { x: 7, y: 14 }, // 38
  { x: 6, y: 14 }, // 39: BLUE home entry cell
  { x: 6, y: 13 }, // 40: BLUE Starting position
  { x: 6, y: 12 }, // 41
  { x: 6, y: 11 }, // 42
  { x: 6, y: 10 }, // 43
  { x: 6, y: 9 }, // 44
  { x: 5, y: 8 }, // 45
  { x: 4, y: 8 }, // 46
  { x: 3, y: 8 }, // 47
  { x: 2, y: 8 }, // 48: Safe cell (Star)
  { x: 1, y: 8 }, // 49
  { x: 0, y: 8 }, // 50
  { x: 0, y: 7 }  // 51
];

// Start index in the TRACK_COORDINATES array for each player color
export const START_INDICES: Record<PlayerColor, number> = {
  RED: 1,      // { x: 1, y: 6 }
  GREEN: 14,   // { x: 8, y: 1 }
  YELLOW: 27,  // { x: 13, y: 8 }
  BLUE: 40     // { x: 6, y: 13 }
};

// Safe track indices (Start positions & Safe Stars in Indian Ludo)
export const SAFE_TRACK_INDICES = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

// Authentic Home Column coordinates leading to center
export const HOME_COLUMNS: Record<PlayerColor, Coordinate[]> = {
  RED: [
    { x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }
  ],
  GREEN: [
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }
  ],
  YELLOW: [
    { x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }
  ],
  BLUE: [
    { x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }
  ]
};

// Finish center coordinates inside the central diamond
export const FINISH_COORDINATES: Record<PlayerColor, Coordinate> = {
  RED: { x: 6, y: 7 },
  GREEN: { x: 7, y: 6 },
  YELLOW: { x: 8, y: 7 },
  BLUE: { x: 7, y: 8 }
};

// Base coordinates offsets for rendering 4 tokens inside base yards
export const BASE_OFFSETS: Record<PlayerColor, Coordinate[]> = {
  RED: [
    { x: 1.6, y: 1.6 }, { x: 3.4, y: 1.6 }, { x: 1.6, y: 3.4 }, { x: 3.4, y: 3.4 }
  ],
  GREEN: [
    { x: 10.6, y: 1.6 }, { x: 12.4, y: 1.6 }, { x: 10.6, y: 3.4 }, { x: 12.4, y: 3.4 }
  ],
  YELLOW: [
    { x: 10.6, y: 10.6 }, { x: 12.4, y: 10.6 }, { x: 10.6, y: 12.4 }, { x: 12.4, y: 12.4 }
  ],
  BLUE: [
    { x: 1.6, y: 10.6 }, { x: 3.4, y: 10.6 }, { x: 1.6, y: 12.4 }, { x: 3.4, y: 12.4 }
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
    return BASE_OFFSETS[color][id];
  }
  
  if (step >= 57) {
    return FINISH_COORDINATES[color];
  }
  
  if (step >= 52) {
    const index = step - 52; // 0..4
    return HOME_COLUMNS[color][index];
  }
  
  const startIdx = START_INDICES[color];
  const trackIdx = (startIdx + step - 1) % 52;
  return TRACK_COORDINATES[trackIdx];
}

/**
 * Checks if a token is in a safe zone (base, home column, home center, or safe cells).
 */
export function isSafeCell(color: PlayerColor, step: number): boolean {
  if (step === 0 || step >= 52) {
    return true;
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
    return false;
  }
  
  if (token.position === 0) {
    return diceValue === 6;
  }
  
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
