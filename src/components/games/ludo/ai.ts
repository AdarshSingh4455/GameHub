import { LudoState, Move, Token, Player, PlayerColor } from './types';
import { getAvailableMoves, getCoordinate, isSafeCell, canMoveToken, getBarrierCells } from './rules';

// Heuristical weights for Hard/Expert AI
const WEIGHTS = {
  HOME_FINISH: 5000,
  IMMEDIATE_CAPTURE: 4000,
  ESCAPE_RISK: 1500,
  SAFE_CELL_ARRIVAL: 1200,
  DEPLOY_TOKEN: 1000,
  CREATE_BARRIER: 800,
  FUTURE_CAPTURE_THREAT: 600,
  BALANCED_PROGRESSION: 300,
  BREAK_BARRIER_PENALTY: -600,
  LEAVE_SAFE_ZONE_PENALTY: -800,
  INTO_DANGER_PENALTY: -1000,
};

/**
 * Returns the grid coordinate key format: "x,y"
 */
function getCoordKey(color: PlayerColor, id: number, step: number): string {
  const coord = getCoordinate(color, id, step);
  return `${coord.x},${coord.y}`;
}

/**
 * Checks if a token at a given position is vulnerable to immediate capture
 * by any opponent token located behind it (within standard dice range 1..6).
 */
function isVulnerable(players: Player[], color: PlayerColor, token: Token, position: number): boolean {
  if (isSafeCell(color, position)) return false;

  const targetCoord = getCoordinate(color, token.id, position);
  const targetKey = `${targetCoord.x},${targetCoord.y}`;

  // Check all opponent active tokens
  for (const opp of players) {
    if (opp.color === color) continue;

    for (const oppToken of opp.tokens) {
      if (oppToken.position === 0 || oppToken.position >= 52) continue;

      // Check if opponent is behind and can reach within 6 steps
      const oppCoord = getCoordinate(opp.color, oppToken.id, oppToken.position);
      // We can scan the track coordinates to see if target is within 6 steps from opponent
      for (let dice = 1; dice <= 6; dice++) {
        if (canMoveToken(oppToken, dice)) {
          const nextOppCoord = getCoordinate(opp.color, oppToken.id, oppToken.position + dice);
          if (`${nextOppCoord.x},${nextOppCoord.y}` === targetKey) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Evaluates the board state for a hypothetical move and returns a score.
 */
function evaluateMove(
  state: LudoState,
  move: Move,
  movingColor: PlayerColor,
): number {
  const player = state.players.find(p => p.color === movingColor)!;
  const token = player.tokens.find(t => t.id === move.tokenId)!;
  const fromPos = move.fromPosition;
  const toPos = move.toPosition;

  let score = 0;

  // 1. Reaching Home (57)
  if (toPos === 57) {
    score += WEIGHTS.HOME_FINISH;
  }

  // 2. Entering Home Lane (steps 52-56)
  if (toPos >= 52 && toPos < 57 && fromPos < 52) {
    score += WEIGHTS.SAFE_CELL_ARRIVAL;
  }

  // 3. Immediate Capture
  const targetCoord = getCoordinate(movingColor, token.id, toPos);
  const targetKey = `${targetCoord.x},${targetCoord.y}`;
  let isCapture = false;

  if (!isSafeCell(movingColor, toPos)) {
    for (const opp of state.players) {
      if (opp.color === movingColor) continue;

      const oppTokensOnCell = opp.tokens.filter(t => {
        if (t.position === 0 || t.position >= 52) return false;
        const c = getCoordinate(opp.color, t.id, t.position);
        return `${c.x},${c.y}` === targetKey;
      });

      // Capture is possible if there is exactly 1 opponent token (barriers are handled by rules)
      if (oppTokensOnCell.length === 1) {
        score += WEIGHTS.IMMEDIATE_CAPTURE;
        isCapture = true;
        break;
      }
    }
  }

  // 4. Escape Risk (moving a token that is currently at risk to safety)
  const currentlyAtRisk = isVulnerable(state.players, movingColor, token, fromPos);
  const willBeAtRisk = isVulnerable(state.players, movingColor, token, toPos);

  if (currentlyAtRisk && !willBeAtRisk) {
    score += WEIGHTS.ESCAPE_RISK;
  }
  if (!currentlyAtRisk && willBeAtRisk) {
    score += WEIGHTS.INTO_DANGER_PENALTY;
  }

  // 5. Safe Cell Prioritization
  const startsSafe = isSafeCell(movingColor, fromPos);
  const endsSafe = isSafeCell(movingColor, toPos);

  if (!startsSafe && endsSafe) {
    score += WEIGHTS.SAFE_CELL_ARRIVAL;
  }
  if (startsSafe && !endsSafe && !isCapture && toPos < 52) {
    score += WEIGHTS.LEAVE_SAFE_ZONE_PENALTY;
  }

  // 6. Deploying vs Advancing (on 6)
  if (state.diceValue === 6 && fromPos === 0) {
    // If all other active tokens are safe/finished, deploy is highly favored
    const hasActiveTokens = player.tokens.some(t => t.position > 0 && t.position < 57);
    if (!hasActiveTokens) {
      score += WEIGHTS.DEPLOY_TOKEN * 2.5;
    } else {
      score += WEIGHTS.DEPLOY_TOKEN;
    }
  }

  // 7. Barrier Creation vs Breaking
  const barriers = getBarrierCells(state.players, movingColor);
  const fromKey = getCoordKey(movingColor, token.id, fromPos);

  // Check if moving creates a new barrier at target location
  const sameColorOnTarget = player.tokens.some(t =>
    t.id !== token.id &&
    t.position > 0 &&
    t.position < 52 &&
    getCoordKey(movingColor, t.id, t.position) === targetKey
  );
  if (sameColorOnTarget) {
    score += WEIGHTS.CREATE_BARRIER;
  }

  // Check if moving breaks an existing barrier
  const wasBarrier = barriers.has(fromKey);
  if (wasBarrier) {
    score += WEIGHTS.BREAK_BARRIER_PENALTY;
  }

  // 8. Future Capture Threats (Aggressive Tracking)
  // Check if moving places this token 1-6 steps behind an opponent
  if (!endsSafe) {
    for (const opp of state.players) {
      if (opp.color === movingColor) continue;

      for (const oppToken of opp.tokens) {
        if (oppToken.position === 0 || oppToken.position >= 52) continue;

        const oppCoord = getCoordinate(opp.color, oppToken.id, oppToken.position);
        for (let nextDice = 1; nextDice <= 6; nextDice++) {
          const nextCoord = getCoordinate(movingColor, token.id, toPos + nextDice);
          if (`${nextCoord.x},${nextCoord.y}` === `${oppCoord.x},${oppCoord.y}`) {
            score += WEIGHTS.FUTURE_CAPTURE_THREAT;
            break;
          }
        }
      }
    }
  }

  // 9. Balanced Progression (favor moving tokens that are furthest behind)
  // Helps ensure tokens advance together rather than leaving one trailing
  const stepsFromStart = fromPos;
  score += (57 - stepsFromStart) * 5; // higher score for tokens further behind

  return score;
}

/**
 * Standard Ludo AI Decision Maker
 */
export const ludoAI = {
  /**
   * Selects the best move index for the active player color.
   * Guranteed to run within 250ms via safeguard performance loop.
   */
  selectMove(state: LudoState, difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'): Move | null {
    const moves = state.availableMoves;
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const turnColor = state.currentTurn;

    // ── EASY MODE: 85% Random, 15% Heuristic (makes obvious mistakes) ──────
    if (difficulty === 'EASY') {
      if (Math.random() > 0.15) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
    }

    const startTime = performance.now();
    let bestMove = moves[0];
    let maxScore = -Infinity;

    for (let i = 0; i < moves.length; i++) {
      // ── AI Timeout Protection: 250ms Safeguard ──
      if (performance.now() - startTime > 250) {
        break; // immediate fallback to highest evaluated move so far
      }

      const move = moves[i];
      let score = 0;

      if (difficulty === 'MEDIUM') {
        // Medium AI: Simple weighted check for capture/finish/exit
        const player = state.players.find(p => p.color === turnColor)!;
        const token = player.tokens.find(t => t.id === move.tokenId)!;
        
        if (move.toPosition === 57) score += 3000;
        if (move.fromPosition === 0) score += 1000;
        if (isSafeCell(turnColor, move.toPosition)) score += 500;

        // Check capture
        const targetCoord = getCoordinate(turnColor, token.id, move.toPosition);
        const targetKey = `${targetCoord.x},${targetCoord.y}`;
        const hasCapture = state.players.some(opp =>
          opp.color !== turnColor &&
          opp.tokens.some(t => t.position > 0 && t.position < 52 && `${getCoordinate(opp.color, t.id, t.position).x},${getCoordinate(opp.color, t.id, t.position).y}` === targetKey)
        );
        if (hasCapture && !isSafeCell(turnColor, move.toPosition)) score += 2000;

        // Add small random noise to keep it natural
        score += Math.random() * 200;
      } else {
        // Hard & Expert Mode: Full lookahead heuristics evaluation
        score = evaluateMove(state, move, turnColor);

        // Hard AI: Slightly less optimal due to small random noise factor
        if (difficulty === 'HARD') {
          score += Math.random() * 500;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }
};
