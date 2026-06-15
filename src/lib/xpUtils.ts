// Standalone client-safe library for level and XP progression math

/**
 * Solve 500 * L * (L-1) <= xp  =>  L^2 - L - xp/500 <= 0
 * Positive root: L = (1 + sqrt(1 + 4*xp/500)) / 2 = (1 + sqrt(1 + xp/125)) / 2
 */
export function computeLevel(xp: number): number {
  const safeXP = Math.max(0, xp)
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + safeXP / 125)) / 2))
}

/**
 * Floor cumulative XP required to reach level L.
 */
export function xpRequiredForLevel(level: number): number {
  const safeLevel = Math.max(1, level)
  return 500 * safeLevel * (safeLevel - 1)
}

/**
 * XP required to complete level L and reach level L+1.
 */
export function xpForNextLevel(level: number): number {
  const safeLevel = Math.max(1, level)
  return 1000 * safeLevel
}

export interface LevelProgressInfo {
  level: number
  floorXP: number
  nextFloorXP: number
  levelRange: number
  xpInLevel: number
  progressPercent: number
  xpRemaining: number
}

/**
 * Computes level progress parameters cleanly to avoid negative offsets.
 */
export function getLevelProgress(xp: number): LevelProgressInfo {
  const safeXP = Math.max(0, xp)
  const level = computeLevel(safeXP)
  
  const floorXP = xpRequiredForLevel(level)
  const nextFloorXP = xpRequiredForLevel(level + 1)
  const levelRange = nextFloorXP - floorXP
  
  const xpInLevel = Math.max(0, safeXP - floorXP)
  const progressPercent = Math.min(100, Math.round((xpInLevel / levelRange) * 100))
  const xpRemaining = Math.max(0, nextFloorXP - safeXP)

  return {
    level,
    floorXP,
    nextFloorXP,
    levelRange,
    xpInLevel,
    progressPercent,
    xpRemaining,
  }
}
