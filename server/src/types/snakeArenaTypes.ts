/**
 * Shared Snake Arena types (Server Copy)
 */

export interface Position {
  x: number
  y: number
}

export interface SnakePlayer {
  userId: string
  username: string
  body: Position[]
  direction: Position
  length: number
  score: number
  eliminations: number
  survivalTime: number
  status: 'ACTIVE' | 'ELIMINATED'
  color: string
  spawnProtectedUntil: number
  activePowerups: { type: string; expiresAt: number }[]
}

export interface FoodItem {
  id: string
  x: number
  y: number
  type: 'normal' | 'golden' | 'giant' | 'dead'
  value: number
  expiresAt?: number
}

export interface PowerupItem {
  id: string
  x: number
  y: number
  type: 'speed' | 'shield' | 'ghost' | 'magnet' | 'freeze' | 'double'
  expiresAt: number
}

export interface SnakeArenaState {
  cols: number
  rows: number
  snakes: Record<string, SnakePlayer>
  foods: FoodItem[]
  powerups: PowerupItem[]
  tickCount: number
  status: 'PLAYING' | 'FINISHED'
  winnerId: string | null
  replayVotes: Record<string, boolean>
  spectators: string[]
  startTime: number
  mapTheme: 'classic' | 'ice' | 'lava' | 'maze' | 'neon'
}
