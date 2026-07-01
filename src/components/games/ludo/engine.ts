import { LudoState, PlayerColor, Token, Move, Player, GameLogEntry, Coordinate, GameConfig, PlayerRole } from './types';
import { getAvailableMoves, getCoordinate, isSafeCell } from './rules';

// ─── Clockwise turn order (matches the track direction) ───────────────────
// RED(top-left) → GREEN(top-right) → YELLOW(bottom-right) → BLUE(bottom-left)
const CLOCKWISE_ORDER: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

// ─── Helpers ───────────────────────────────────────────────────────────────

function createInitialTokens(color: PlayerColor): Token[] {
  return Array.from({ length: 4 }).map((_, i) => ({
    id: i,
    color,
    position: 0,
  }));
}

export function createLogEntry(message: string, color?: PlayerColor): GameLogEntry {
  return {
    id: Math.random().toString(36).substring(2, 9),
    message,
    color,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

// ─── Default 4-player config (used when no config provided) ───────────────
const DEFAULT_CONFIG: GameConfig = {
  mode: 'LOCAL',
  activeColors: ['RED', 'GREEN', 'YELLOW', 'BLUE'],
  playerConfigs: [
    { color: 'RED',    role: 'HUMAN', name: 'Player Red'    },
    { color: 'GREEN',  role: 'HUMAN', name: 'Player Green'  },
    { color: 'YELLOW', role: 'HUMAN', name: 'Player Yellow' },
    { color: 'BLUE',   role: 'HUMAN', name: 'Player Blue'   },
  ],
};

// ─── Engine ───────────────────────────────────────────────────────────────
export const ludoEngine = {

  /**
   * Create a fresh game state from the given config.
   * Only colors with role !== 'NONE' participate; inactive colors get empty
   * token arrays and are skipped in turn rotation.
   */
  initializeGame(config: GameConfig = DEFAULT_CONFIG): LudoState {
    // Build ordered active colors (clockwise, subset of all 4)
    const activeColors = CLOCKWISE_ORDER.filter(c =>
      config.playerConfigs.find(pc => pc.color === c)?.role !== 'NONE'
    );

    const players: Player[] = CLOCKWISE_ORDER.map(color => {
      const pc = config.playerConfigs.find(p => p.color === color) ?? {
        color,
        role: 'NONE' as PlayerRole,
        name: `Player ${color}`,
      };
      const isActive = pc.role !== 'NONE';
      return {
        color,
        name: pc.name,
        role: pc.role,
        tokens: isActive ? createInitialTokens(color) : [],
        isActive,
        isAuto: pc.role === 'AI',
      };
    });

    const firstPlayer = activeColors[0];

    return {
      players,
      activeColors,
      gameMode: config.mode,
      currentTurn: firstPlayer,
      diceValue: 1,
      diceState: 'IDLE',
      phase: 'DICE_ROLL',
      consecutiveSixes: 0,
      hasMovedThisTurn: false,
      extraTurnsRemaining: 0,
      winner: null,
      finishOrder: [],
      logs: [createLogEntry(`Ludo started — ${activeColors.length} players. ${firstPlayer} goes first!`)],
      availableMoves: [],
      isOffline: config.mode !== 'ONLINE',
    };
  },

  // ── Roll dice ───────────────────────────────────────────────────────────
  /**
   * Consume a dice roll for the current player.
   * This is the SINGLE place where randomness is introduced.
   * The resulting `diceValue` is the authoritative value used for everything
   * (UI, movement, logs, animations, replay).
   */
  rollDice(state: LudoState): LudoState {
    if (state.phase !== 'DICE_ROLL' || state.diceState === 'ROLLING') {
      return state;
    }

    // ── Single random call — immutable for this turn ──
    const roll = Math.floor(Math.random() * 6) + 1;
    const currentTurn = state.currentTurn;
    const logs = [...state.logs];

    logs.unshift(createLogEntry(`${currentTurn} rolled a ${roll}!`, currentTurn));

    // ── Triple-six: forfeit turn immediately ──────────────────────────────
    let consecutiveSixes = state.consecutiveSixes;
    if (roll === 6) {
      consecutiveSixes += 1;
      if (consecutiveSixes === 3) {
        logs.unshift(createLogEntry(`Three 6s in a row — ${currentTurn} forfeits the turn!`, currentTurn));
        return this.nextTurn({
          ...state,
          logs,
          diceValue: roll,
          diceState: 'ROLLED',
          consecutiveSixes: 0,
          extraTurnsRemaining: 0, // ← critical: clear any pending extra turn
        });
      }
    } else {
      consecutiveSixes = 0;
    }

    // ── Compute legal moves with full barrier awareness ───────────────────
    const player = state.players.find(p => p.color === currentTurn)!;
    const moves = getAvailableMoves(player.tokens, roll, state.players);

    // ── No legal moves → auto-pass ────────────────────────────────────────
    if (moves.length === 0) {
      logs.unshift(createLogEntry(`No legal moves for ${currentTurn} — turn passes.`, currentTurn));
      return this.nextTurn({
        ...state,
        logs,
        diceValue: roll,
        diceState: 'ROLLED',
        consecutiveSixes,
        extraTurnsRemaining: 0,
      });
    }

    return {
      ...state,
      diceValue: roll,  // ← single source of truth
      diceState: 'ROLLED',
      phase: 'TOKEN_MOVE',
      availableMoves: moves,
      consecutiveSixes,
      logs,
    };
  },

  // ── Move token ──────────────────────────────────────────────────────────
  /**
   * Apply the chosen token move.  Returns both the new state AND the
   * intermediate coordinate path so the UI can animate step-by-step.
   *
   * State is only updated AFTER the caller signals animation completion —
   * callers must NOT commit the nextState until their animation finishes.
   */
  moveToken(
    state: LudoState,
    tokenId: number,
  ): { nextState: LudoState; animatedPath: Coordinate[] } {
    if (state.phase !== 'TOKEN_MOVE') {
      return { nextState: state, animatedPath: [] };
    }

    const currentTurn = state.currentTurn;
    const diceValue = state.diceValue; // ← always uses the single-source dice

    // Deep-clone players so we don't mutate state
    const players: Player[] = state.players.map(p => ({
      ...p,
      tokens: p.tokens.map(t => ({ ...t })),
    }));
    const player = players.find(p => p.color === currentTurn)!;
    const token = player.tokens.find(t => t.id === tokenId)!;

    const fromPos = token.position;
    const toPos = fromPos === 0 ? 1 : fromPos + diceValue;

    // ── Build animated path ───────────────────────────────────────────────
    const animatedPath: Coordinate[] = [];
    if (fromPos === 0) {
      animatedPath.push(getCoordinate(currentTurn, tokenId, 1));
    } else {
      for (let pos = fromPos + 1; pos <= toPos; pos++) {
        animatedPath.push(getCoordinate(currentTurn, tokenId, pos));
      }
    }

    // ── Apply move ────────────────────────────────────────────────────────
    token.position = toPos;
    const logs = [...state.logs];
    let extraTurnAwarded = false;

    // ── Home arrival ──────────────────────────────────────────────────────
    if (toPos === 57) {
      logs.unshift(createLogEntry(`${currentTurn} moved a token home!`, currentTurn));
      extraTurnAwarded = true;
    }

    // ── Capture check ─────────────────────────────────────────────────────
    const finalCoord = getCoordinate(currentTurn, tokenId, toPos);
    let capturedOpponent = false;

    if (!isSafeCell(currentTurn, toPos)) {
      players.forEach(opp => {
        if (opp.color === currentTurn) return;

        // Count opponent tokens on the landing cell
        const oppOnCell = opp.tokens.filter(t => {
          if (t.position === 0 || t.position >= 52) return false;
          const c = getCoordinate(opp.color, t.id, t.position);
          return c.x === finalCoord.x && c.y === finalCoord.y;
        });

        // Only capture a SINGLE token; 2+ forms a barrier (should have been blocked by rules, but guard anyway)
        if (oppOnCell.length === 1) {
          const capToken = oppOnCell[0];
          capToken.position = 0;
          capturedOpponent = true;
          extraTurnAwarded = true;
          logs.unshift(createLogEntry(`${currentTurn} captured ${opp.color}'s token!`, currentTurn));
        }
      });
    }

    // ── Rolling 6 = extra turn ────────────────────────────────────────────
    if (diceValue === 6) {
      extraTurnAwarded = true;
      if (toPos !== 57 && !capturedOpponent) {
        // Only log the extra-turn message if it's not already implied by home/capture
        logs.unshift(createLogEntry(`${currentTurn} rolled 6 — bonus turn!`, currentTurn));
      }
    }

    // ── Victory check ─────────────────────────────────────────────────────
    const allFinished = player.tokens.every(t => t.position === 57);
    const finishOrder = [...state.finishOrder];

    if (allFinished && !finishOrder.includes(currentTurn)) {
      finishOrder.push(currentTurn);
      logs.unshift(createLogEntry(`🎉 ${currentTurn} finished all tokens!`, currentTurn));

      // Check if only one active player remains
      const remainingActive = state.activeColors.filter(c => !finishOrder.includes(c));
      if (remainingActive.length <= 1) {
        // Game over
        if (remainingActive.length === 1) finishOrder.push(remainingActive[0]);
        logs.unshift(createLogEntry(`🏆 Game over! Winner: ${finishOrder[0]}`, finishOrder[0]));
        return {
          nextState: {
            ...state,
            players,
            phase: 'FINISHED',
            winner: finishOrder[0],
            finishOrder,
            logs,
          },
          animatedPath,
        };
      }

      // Player finished but game continues — they exit the turn rotation
      const newActiveColors = state.activeColors.filter(c => c !== currentTurn);
      return {
        nextState: this.nextTurn({
          ...state,
          players,
          logs,
          finishOrder,
          activeColors: newActiveColors,
          extraTurnsRemaining: 0, // finisher does not get extra turn
        }),
        animatedPath,
      };
    }

    const nextState = this.nextTurn({
      ...state,
      players,
      logs,
      finishOrder,
      extraTurnsRemaining: extraTurnAwarded ? 1 : 0,
    });

    return { nextState, animatedPath };
  },

  // ── Advance turn ────────────────────────────────────────────────────────
  nextTurn(state: LudoState): LudoState {
    const logs = [...state.logs];

    // Same player gets another roll (extra turn)
    if (state.extraTurnsRemaining > 0) {
      return {
        ...state,
        phase: 'DICE_ROLL',
        diceState: 'IDLE',
        availableMoves: [],
        extraTurnsRemaining: 0,
        hasMovedThisTurn: false,
        logs,
      };
    }

    // ── Advance to next active player (clockwise) ─────────────────────────
    const activeColors = state.activeColors;
    const currentIndex = activeColors.indexOf(state.currentTurn);
    // If current player just finished they may have been removed; default to 0
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + 1) % activeColors.length;
    const nextColor = activeColors[nextIndex];

    logs.unshift(createLogEntry(`${nextColor}'s turn.`));

    return {
      ...state,
      currentTurn: nextColor,
      phase: 'DICE_ROLL',
      diceState: 'IDLE',
      availableMoves: [],
      consecutiveSixes: 0,
      hasMovedThisTurn: false,
      extraTurnsRemaining: 0,
      logs,
    };
  },
};
