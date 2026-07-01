import { LudoState, PlayerColor, Token, Move, Player, GameLogEntry, Coordinate } from './types';
import { getAvailableMoves, getCoordinate, isSafeCell, START_INDICES } from './rules';
import { ludoAudio } from './audio';

const PLAYER_ORDER: PlayerColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

export const INITIAL_STATE: LudoState = {
  players: [
    { color: 'RED', name: 'Player Red', tokens: createInitialTokens('RED'), isActive: true, isAuto: false },
    { color: 'BLUE', name: 'Player Blue', tokens: createInitialTokens('BLUE'), isActive: false, isAuto: false },
    { color: 'YELLOW', name: 'Player Yellow', tokens: createInitialTokens('YELLOW'), isActive: false, isAuto: false },
    { color: 'GREEN', name: 'Player Green', tokens: createInitialTokens('GREEN'), isActive: false, isAuto: false },
  ],
  currentTurn: 'RED',
  diceValue: 1,
  diceState: 'IDLE',
  phase: 'DICE_ROLL',
  consecutiveSixes: 0,
  hasMovedThisTurn: false,
  extraTurnsRemaining: 0,
  winner: null,
  logs: [],
  availableMoves: [],
  isOffline: true,
};

function createInitialTokens(color: PlayerColor): Token[] {
  return Array.from({ length: 4 }).map((_, i) => ({
    id: i,
    color,
    position: 0, // All start in Base
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

/**
 * pure state transitions for Ludo game engine.
 */
export const ludoEngine = {
  initializeGame(isOffline = true): LudoState {
    return {
      ...INITIAL_STATE,
      isOffline,
      logs: [createLogEntry('Game Hub Ludo Started! Roll dice to begin.')],
    };
  },

  rollDice(state: LudoState): LudoState {
    if (state.phase !== 'DICE_ROLL' || state.diceState === 'ROLLING') {
      return state;
    }

    ludoAudio.playRoll();
    const roll = Math.floor(Math.random() * 6) + 1;
    const currentTurn = state.currentTurn;
    const logs = [...state.logs];

    logs.unshift(createLogEntry(`${currentTurn} rolled a ${roll}!`, currentTurn));

    // Handle 3 consecutive sixes
    let consecutiveSixes = state.consecutiveSixes;
    if (roll === 6) {
      consecutiveSixes += 1;
      if (consecutiveSixes === 3) {
        logs.unshift(createLogEntry(`3 consecutive 6s! ${currentTurn} forfeits turn.`, currentTurn));
        return this.nextTurn({
          ...state,
          logs,
          consecutiveSixes: 0,
          diceValue: roll,
          diceState: 'ROLLED',
        });
      }
    } else {
      consecutiveSixes = 0;
    }

    const player = state.players.find((p) => p.color === currentTurn)!;
    const moves = getAvailableMoves(player.tokens, roll);

    if (moves.length === 0) {
      logs.unshift(createLogEntry(`No legal moves for ${currentTurn}.`, currentTurn));
      return this.nextTurn({
        ...state,
        logs,
        consecutiveSixes,
        diceValue: roll,
        diceState: 'ROLLED',
      });
    }

    return {
      ...state,
      diceValue: roll,
      diceState: 'ROLLED',
      phase: 'TOKEN_MOVE',
      availableMoves: moves,
      consecutiveSixes,
      logs,
    };
  },

  moveToken(state: LudoState, tokenId: number): { nextState: LudoState; animatedPath: Coordinate[] } {
    if (state.phase !== 'TOKEN_MOVE') {
      return { nextState: state, animatedPath: [] };
    }

    const currentTurn = state.currentTurn;
    const diceValue = state.diceValue;
    const players = state.players.map((p) => ({ ...p }));
    const player = players.find((p) => p.color === currentTurn)!;
    const token = player.tokens.find((t) => t.id === tokenId)!;

    const fromPos = token.position;
    const toPos = fromPos === 0 ? 1 : fromPos + diceValue;

    // Generate intermediate path coordinate objects for smooth SVG slide animations
    const animatedPath: Coordinate[] = [];
    if (fromPos === 0) {
      animatedPath.push(getCoordinate(currentTurn, tokenId, 1));
    } else {
      for (let pos = fromPos + 1; pos <= toPos; pos++) {
        animatedPath.push(getCoordinate(currentTurn, tokenId, pos));
      }
    }

    // Update token position
    token.position = toPos;

    let extraTurnAwarded = false;
    const logs = [...state.logs];

    // Check if token finished / arrived Home
    if (toPos === 57) {
      ludoAudio.playHome();
      logs.unshift(createLogEntry(`${currentTurn} token arrived HOME!`, currentTurn));
      extraTurnAwarded = true;
    } else {
      ludoAudio.playMove();
    }

    // Check Capture Opponent Rule
    const finalCoord = getCoordinate(currentTurn, tokenId, toPos);
    let capturedOpponent = false;

    if (!isSafeCell(currentTurn, toPos)) {
      players.forEach((opp) => {
        if (opp.color === currentTurn) return;

        // Group opponents on the landing cell to detect stacks
        const oppTokensOnCell = opp.tokens.filter((t) => {
          if (t.position === 0 || t.position >= 52) return false;
          const coord = getCoordinate(opp.color, t.id, t.position);
          return coord.x === finalCoord.x && coord.y === finalCoord.y;
        });

        // Capture only if it's a single opponent token (stack creates a protective barrier)
        if (oppTokensOnCell.length === 1) {
          const capToken = oppTokensOnCell[0];
          capToken.position = 0; // Send back to base yard
          capturedOpponent = true;
          ludoAudio.playCapture();
          logs.unshift(createLogEntry(`${currentTurn} captured ${opp.color}'s token!`, currentTurn));
          extraTurnAwarded = true;
        }
      });
    }

    // Check Winner Condition
    const allFinished = player.tokens.every((t) => t.position === 57);
    if (allFinished && !state.winner) {
      ludoAudio.playVictory();
      logs.unshift(createLogEntry(`🎉 ${currentTurn} HAS WON THE GAME! 🎉`, currentTurn));
      return {
        nextState: {
          ...state,
          players,
          phase: 'FINISHED',
          winner: currentTurn,
          logs,
        },
        animatedPath,
      };
    }

    // Award extra turn if player rolled 6
    if (diceValue === 6) {
      extraTurnAwarded = true;
      logs.unshift(createLogEntry(`${currentTurn} gets an extra turn for rolling a 6!`, currentTurn));
    }

    const nextState = this.nextTurn({
      ...state,
      players,
      logs,
      extraTurnsRemaining: extraTurnAwarded ? 1 : 0,
    });

    return { nextState, animatedPath };
  },

  nextTurn(state: LudoState): LudoState {
    const logs = [...state.logs];
    
    if (state.extraTurnsRemaining > 0) {
      // Award extra turn to same player
      return {
        ...state,
        phase: 'DICE_ROLL',
        diceState: 'IDLE',
        availableMoves: [],
        extraTurnsRemaining: 0,
      };
    }

    // Switch to next player clockwise
    const currentIndex = PLAYER_ORDER.indexOf(state.currentTurn);
    const nextIndex = (currentIndex + 1) % PLAYER_ORDER.length;
    const nextPlayerColor = PLAYER_ORDER[nextIndex];

    logs.unshift(createLogEntry(`It is now ${nextPlayerColor}'s turn.`));

    return {
      ...state,
      currentTurn: nextPlayerColor,
      phase: 'DICE_ROLL',
      diceState: 'IDLE',
      availableMoves: [],
      consecutiveSixes: 0,
      logs,
    };
  },
};
