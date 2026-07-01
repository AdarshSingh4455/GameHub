// ─── Core Token & Board Types ──────────────────────────────────────────────

export type PlayerColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';

export interface Token {
  id: number;       // 0, 1, 2, 3
  color: PlayerColor;
  position: number; // 0=Base, 1..51=Outer Track, 52..56=Home Column, 57=Finished
}

export interface Player {
  color: PlayerColor;
  name: string;
  tokens: Token[];
  isActive: boolean;  // false for NONE-role (not playing this game)
  isAuto: boolean;    // true for AI-controlled
  role: PlayerRole;
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

// ─── Game Configuration (Pre-game Setup) ──────────────────────────────────

export type PlayerRole = 'HUMAN' | 'AI' | 'NONE';
export type GameMode = 'LOCAL' | 'VS_AI' | 'ONLINE';

export interface PlayerConfig {
  color: PlayerColor;
  role: PlayerRole;
  name: string;
}

export interface GameConfig {
  mode: GameMode;
  playerConfigs: PlayerConfig[];
  /** Ordered list of colors that are actually playing (excludes NONE) */
  activeColors: PlayerColor[];
}

// ─── Full Game State ───────────────────────────────────────────────────────

export interface LudoState {
  players: Player[];

  /** Single immutable dice value for the current turn — the one source of truth */
  diceValue: number;
  diceState: 'IDLE' | 'ROLLING' | 'ROLLED';

  currentTurn: PlayerColor;
  phase: GamePhase;

  /** Only colors that are participating in this game session */
  activeColors: PlayerColor[];
  gameMode: GameMode;

  consecutiveSixes: number;
  hasMovedThisTurn: boolean;
  extraTurnsRemaining: number;

  winner: PlayerColor | null;
  /** All finished colors in order (for ranking) */
  finishOrder: PlayerColor[];

  logs: GameLogEntry[];
  availableMoves: Move[];
  isOffline: boolean;
}

export interface Coordinate {
  x: number; // 0..14 grid x
  y: number; // 0..14 grid y
}

// ─── Particle Effects ─────────────────────────────────────────────────────

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

// ─── Future Extension Hooks (Sprint 3+) ───────────────────────────────────

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
