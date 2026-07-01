import { PlayerColor, Coordinate, Token, Move, Player } from './types';

// ─── Authentic 52-cell outer track (Indian Ludo, clockwise) ───────────────
export const TRACK_COORDINATES: Coordinate[] = [
  { x: 0, y: 6 }, // 0:  RED entry gate (not a playable step cell)
  { x: 1, y: 6 }, // 1:  RED start — SAFE ★
  { x: 2, y: 6 }, // 2
  { x: 3, y: 6 }, // 3
  { x: 4, y: 6 }, // 4
  { x: 5, y: 6 }, // 5
  { x: 6, y: 5 }, // 6
  { x: 6, y: 4 }, // 7
  { x: 6, y: 3 }, // 8
  { x: 6, y: 2 }, // 9:  SAFE ★
  { x: 6, y: 1 }, // 10
  { x: 6, y: 0 }, // 11
  { x: 7, y: 0 }, // 12
  { x: 8, y: 0 }, // 13: GREEN entry gate
  { x: 8, y: 1 }, // 14: GREEN start — SAFE ★
  { x: 8, y: 2 }, // 15
  { x: 8, y: 3 }, // 16
  { x: 8, y: 4 }, // 17
  { x: 8, y: 5 }, // 18
  { x: 9, y: 6 }, // 19
  { x: 10, y: 6 }, // 20
  { x: 11, y: 6 }, // 21
  { x: 12, y: 6 }, // 22: SAFE ★
  { x: 13, y: 6 }, // 23
  { x: 14, y: 6 }, // 24
  { x: 14, y: 7 }, // 25
  { x: 14, y: 8 }, // 26: YELLOW entry gate
  { x: 13, y: 8 }, // 27: YELLOW start — SAFE ★
  { x: 12, y: 8 }, // 28
  { x: 11, y: 8 }, // 29
  { x: 10, y: 8 }, // 30
  { x: 9, y: 8 },  // 31
  { x: 8, y: 9 },  // 32
  { x: 8, y: 10 }, // 33
  { x: 8, y: 11 }, // 34
  { x: 8, y: 12 }, // 35: SAFE ★
  { x: 8, y: 13 }, // 36
  { x: 8, y: 14 }, // 37
  { x: 7, y: 14 }, // 38
  { x: 6, y: 14 }, // 39: BLUE entry gate
  { x: 6, y: 13 }, // 40: BLUE start — SAFE ★
  { x: 6, y: 12 }, // 41
  { x: 6, y: 11 }, // 42
  { x: 6, y: 10 }, // 43
  { x: 6, y: 9 },  // 44
  { x: 5, y: 8 },  // 45
  { x: 4, y: 8 },  // 46
  { x: 3, y: 8 },  // 47
  { x: 2, y: 8 },  // 48: SAFE ★
  { x: 1, y: 8 },  // 49
  { x: 0, y: 8 },  // 50
  { x: 0, y: 7 },  // 51
];

/**
 * Each player's starting track index (step 1 maps to this track index).
 * Track index = (START_INDICES[color] + step - 1) % 52
 */
export const START_INDICES: Record<PlayerColor, number> = {
  RED:    1,   // (1,6)
  GREEN:  14,  // (8,1)
  YELLOW: 27,  // (13,8)
  BLUE:   40,  // (6,13)
};

/**
 * Safe track indices — token cannot be captured on these.
 * Includes all 4 start positions + 4 mid-track safe stars.
 */
export const SAFE_TRACK_INDICES = new Set([1, 9, 14, 22, 27, 35, 40, 48]);

/** Home column coordinates (step 52 → index 0, step 56 → index 4) */
export const HOME_COLUMNS: Record<PlayerColor, Coordinate[]> = {
  RED:    [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }],
  GREEN:  [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }],
  YELLOW: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }],
  BLUE:   [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }],
};

/** Final finish slot inside the central diamond */
export const FINISH_COORDINATES: Record<PlayerColor, Coordinate> = {
  RED:    { x: 6, y: 7 },
  GREEN:  { x: 7, y: 6 },
  YELLOW: { x: 8, y: 7 },
  BLUE:   { x: 7, y: 8 },
};

/** Base yard slot offsets for the 4 tokens of each player */
export const BASE_OFFSETS: Record<PlayerColor, Coordinate[]> = {
  RED:    [{ x: 1.6, y: 1.6 }, { x: 3.4, y: 1.6 }, { x: 1.6, y: 3.4 }, { x: 3.4, y: 3.4 }],
  GREEN:  [{ x: 10.6, y: 1.6 }, { x: 12.4, y: 1.6 }, { x: 10.6, y: 3.4 }, { x: 12.4, y: 3.4 }],
  YELLOW: [{ x: 10.6, y: 10.6 }, { x: 12.4, y: 10.6 }, { x: 10.6, y: 12.4 }, { x: 12.4, y: 12.4 }],
  BLUE:   [{ x: 1.6, y: 10.6 }, { x: 3.4, y: 10.6 }, { x: 1.6, y: 12.4 }, { x: 3.4, y: 12.4 }],
};

// ─── Coordinate helpers ────────────────────────────────────────────────────

/**
 * Convert a token's local step position (0..57) to board grid coordinates.
 */
export function getCoordinate(color: PlayerColor, id: number, step: number): Coordinate {
  if (step === 0)   return BASE_OFFSETS[color][id];
  if (step >= 57)   return FINISH_COORDINATES[color];
  if (step >= 52)   return HOME_COLUMNS[color][step - 52]; // index 0..4
  const trackIdx = (START_INDICES[color] + step - 1) % 52;
  return TRACK_COORDINATES[trackIdx];
}

/**
 * Returns true when the step is a safe zone where captures are not allowed.
 * Safe zones: base yard (0), home column (52-57), and the 8 safe-star cells.
 */
export function isSafeCell(color: PlayerColor, step: number): boolean {
  if (step === 0 || step >= 52) return true;
  const trackIdx = (START_INDICES[color] + step - 1) % 52;
  return SAFE_TRACK_INDICES.has(trackIdx);
}

// ─── Barrier Rule ──────────────────────────────────────────────────────────

/**
 * Build a set of coordinate keys that are BARRIERS from the perspective of
 * the moving color.  A barrier is formed when any single opponent color has
 * ≥ 2 tokens on the SAME outer-track cell (step 1..51).
 *
 * Barrier semantics:
 *  - Moving token cannot LAND on a barrier cell.
 *  - Moving token cannot PASS THROUGH a barrier cell.
 *  - Own tokens never form a barrier against self.
 */
export function getBarrierCells(players: Player[], movingColor: PlayerColor): Set<string> {
  const barriers = new Set<string>();

  players.forEach(player => {
    if (player.color === movingColor) return; // own tokens irrelevant

    // Count how many of this player's tokens share the same outer-track cell
    const cellCount = new Map<string, number>();
    player.tokens.forEach(token => {
      if (token.position < 1 || token.position > 51) return;
      const coord = getCoordinate(player.color, token.id, token.position);
      const key = `${coord.x},${coord.y}`;
      cellCount.set(key, (cellCount.get(key) ?? 0) + 1);
    });

    cellCount.forEach((count, key) => {
      if (count >= 2) barriers.add(key);
    });
  });

  return barriers;
}

/**
 * Check whether the path from fromPos→toPos is clear of barriers.
 * Only outer-track cells (steps 1..51) are checked; home-column cells
 * are color-exclusive so barriers cannot exist there.
 */
function isPathClear(
  color: PlayerColor,
  tokenId: number,
  fromPos: number,
  toPos: number,
  barriers: Set<string>,
): boolean {
  const startStep = fromPos === 0 ? 1 : fromPos + 1;
  for (let step = startStep; step <= toPos; step++) {
    if (step > 51) break; // entered home column — no barriers possible
    const coord = getCoordinate(color, tokenId, step);
    if (barriers.has(`${coord.x},${coord.y}`)) return false;
  }
  return true;
}

// ─── Move Legality ─────────────────────────────────────────────────────────

/**
 * Checks whether a specific token can legally move given:
 *  - The dice value
 *  - The pre-computed barrier set (pass undefined to skip barrier check)
 *
 * Rules enforced:
 *  1. Finished token (57) can never move.
 *  2. Base token (0) needs exactly a 6 to deploy.
 *  3. No overshooting past home (position + dice must be ≤ 57).
 *  4. Path must not cross an opponent barrier.
 */
export function canMoveToken(token: Token, diceValue: number, barriers?: Set<string>): boolean {
  if (token.position === 57) return false;

  if (token.position === 0) {
    if (diceValue !== 6) return false;
    // Deployment cell (step 1): barriers can still block it
    if (barriers) {
      const deployCoord = getCoordinate(token.color, token.id, 1);
      const key = `${deployCoord.x},${deployCoord.y}`;
      if (barriers.has(key)) return false;
    }
    return true;
  }

  const toPos = token.position + diceValue;
  if (toPos > 57) return false; // Exact home required — no overshooting

  if (barriers) {
    return isPathClear(token.color, token.id, token.position, toPos, barriers);
  }
  return true;
}

/**
 * Returns all legal moves for the active player's tokens.
 * Pass `allPlayers` to enable barrier checking (recommended).
 */
export function getAvailableMoves(
  tokens: Token[],
  diceValue: number,
  allPlayers?: Player[],
): Move[] {
  const movingColor = tokens[0]?.color;
  const barriers = allPlayers && movingColor
    ? getBarrierCells(allPlayers, movingColor)
    : undefined;

  const moves: Move[] = [];
  for (const token of tokens) {
    if (canMoveToken(token, diceValue, barriers)) {
      moves.push({
        tokenId: token.id,
        fromPosition: token.position,
        toPosition: token.position === 0 ? 1 : token.position + diceValue,
      });
    }
  }
  return moves;
}
