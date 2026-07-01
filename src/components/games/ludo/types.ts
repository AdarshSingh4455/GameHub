export type PlayerColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';

export interface Token {
  id: number; // 0, 1, 2, 3
  color: PlayerColor;
  position: number; // 0 = Base, 1..51 = Outer Track steps, 52..56 = Home Column steps, 57 = Home/Finished
  // We track "step" (0 to 57) because it's local to the token, making movement logic trivial.
  // We can compute the actual (x, y) coordinates of the board based on the step.
}

export interface Player {
  color: PlayerColor;
  name: string;
  tokens: Token[];
  isActive: boolean;
  isAuto: boolean; // For auto-moves if timed out or local play settings
}

export interface Move {
  tokenId: number;
  fromPosition: number;
  toPosition: number;
}

export type GamePhase = 'WAITING' | 'DICE_ROLL' | 'TOKEN_MOVE' | 'FINISHED';

export interface GameLogEntry {
  id: string;
  message: string;
  color?: PlayerColor;
  timestamp: string;
}

export interface LudoState {
  players: Player[];
  currentTurn: PlayerColor;
  diceValue: number;
  diceState: 'IDLE' | 'ROLLING' | 'ROLLED';
  phase: GamePhase;
  consecutiveSixes: number;
  hasMovedThisTurn: boolean;
  extraTurnsRemaining: number;
  winner: PlayerColor | null;
  logs: GameLogEntry[];
  availableMoves: Move[];
  isOffline: boolean;
}

export interface Coordinate {
  x: number; // 0..14 grid x
  y: number; // 0..14 grid y
}
