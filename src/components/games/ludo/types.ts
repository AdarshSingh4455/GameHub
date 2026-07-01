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

// Particle type for visual effects like capture explosions
export interface LudoParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

// --- Future Extension Hooks & Interfaces (Sprint 2 Preparation Only) ---

export interface LudoAIStrategy {
  name: string;
  selectMove(tokens: Token[], diceValue: number, availableMoves: Move[]): Promise<Move | null>;
}

export interface LudoMultiplayerAdapter {
  onStateChange: (state: LudoState) => void;
  sendRollDice: () => Promise<void>;
  sendMoveToken: (tokenId: number) => Promise<void>;
  joinRoom: (roomCode: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

export interface LudoSpectatorManager {
  spectators: string[];
  onSpectatorJoin: (userId: string) => void;
  onSpectatorLeave: (userId: string) => void;
}

export interface LudoReplaySystem {
  recordState: (state: LudoState) => void;
  playReplay: (states: LudoState[]) => void;
}

export interface LudoTournamentHooks {
  onMatchComplete: (winnerId: string, score: number) => void;
  onRewardClaim: (rewardId: string) => void;
}

