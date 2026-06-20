// Seed-based PRNG using Linear Congruential Generator
export class SeededRandom {
  private seed: number

  constructor(seed: number) {
    // Ensure the seed is a positive integer and never 0
    this.seed = Math.abs(Math.floor(seed)) || 1
  }

  // Returns [0, 1)
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296
    return this.seed / 4294967296
  }

  // Returns an integer between [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  // Chooses a random element from an array
  choice<T>(arr: T[]): T {
    const idx = this.nextInt(0, arr.length - 1)
    return arr[idx]
  }

  // Shuffles an array in place deterministically
  shuffle<T>(arr: T[]): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i)
      const temp = copy[i]
      copy[i] = copy[j]
      copy[j] = temp
    }
    return copy
  }
}

export type BlockerType = 'ice' | 'stone' | 'lock' | 'double_lock' | 'crate'
export type ObjectiveType = 'score' | 'clear_color' | 'clear_blockers' | 'combo'

export interface LevelObjective {
  type: ObjectiveType
  target: number
  current: number
  color?: string // For clear_color
  blockerType?: BlockerType // For clear_blockers
}

export interface LevelData {
  levelNumber: number
  boardSize: number
  candyTypes: string[]
  blockersGrid: (BlockerType | null)[][]
  targetScore: number
  moveLimit: number
  difficultyTier: string
  objectives: LevelObjective[]
}

export const ALL_CANDIES = ['red', 'blue', 'green', 'yellow', 'purple', 'cyan', 'orange']

export function generateLevel(levelNumber: number): LevelData {
  const rng = new SeededRandom(levelNumber)

  // 1. Determine Board Size
  let boardSize = 10
  if (levelNumber >= 101 && levelNumber <= 400) {
    boardSize = 11
  } else if (levelNumber > 400) {
    boardSize = 12
  }

  // 2. Determine Candy Variety
  let candyCount = 4
  if (levelNumber >= 21 && levelNumber <= 100) {
    candyCount = 5
  } else if (levelNumber >= 101 && levelNumber <= 500) {
    candyCount = 6
  } else if (levelNumber > 500) {
    candyCount = 7
  }
  const candyTypes = ALL_CANDIES.slice(0, candyCount)

  // 3. Determine Difficulty Tier
  let difficultyTier = 'Easy'
  if (levelNumber <= 5) difficultyTier = 'Easy'
  else if (levelNumber <= 20) difficultyTier = 'Easy+'
  else if (levelNumber <= 50) difficultyTier = 'Medium-'
  else if (levelNumber <= 150) difficultyTier = 'Medium'
  else if (levelNumber <= 300) difficultyTier = 'Medium+'
  else if (levelNumber <= 500) difficultyTier = 'Hard-'
  else if (levelNumber <= 750) difficultyTier = 'Hard'
  else if (levelNumber <= 1000) difficultyTier = 'Very Hard'
  else if (levelNumber <= 1200) difficultyTier = 'Extreme'
  else difficultyTier = `Extreme ${Math.floor((levelNumber - 1200) / 100) + 1}`

  // 4. Generate Blocker Density and Grid
  const blockersGrid: (BlockerType | null)[][] = Array(boardSize)
    .fill(null)
    .map(() => Array(boardSize).fill(null))

  let blockerCount = 0
  const totalCells = boardSize * boardSize

  if (levelNumber > 5) {
    // Blocker count scaling
    let basePct = 0.05
    if (levelNumber > 20) basePct = 0.08
    if (levelNumber > 50) basePct = 0.12
    if (levelNumber > 150) basePct = 0.16
    if (levelNumber > 400) basePct = 0.20
    if (levelNumber > 800) basePct = 0.25

    // Add some random scaling
    const pct = basePct + rng.next() * 0.05
    blockerCount = Math.floor(totalCells * pct)
  }

  // Collect potential blocker cell coordinates (avoiding the exact center cells to keep starting swaps open)
  const candidateCoords: { r: number; c: number }[] = []
  const half = Math.floor(boardSize / 2)
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const isCenter = Math.abs(r - half) <= 1 && Math.abs(c - half) <= 1
      if (!isCenter) {
        candidateCoords.push({ r, c })
      }
    }
  }

  const shuffledCoords = rng.shuffle(candidateCoords)
  const activeBlockersCount = Math.min(blockerCount, shuffledCoords.length)

  // Select blocker types available
  const allowedBlockers: BlockerType[] = ['lock']
  if (levelNumber > 15) allowedBlockers.push('ice')
  if (levelNumber > 40) allowedBlockers.push('stone')
  if (levelNumber > 80) allowedBlockers.push('double_lock')
  if (levelNumber > 120) allowedBlockers.push('crate')

  for (let i = 0; i < activeBlockersCount; i++) {
    const { r, c } = shuffledCoords[i]
    blockersGrid[r][c] = rng.choice(allowedBlockers)
  }

  // Count types of blockers placed to guide objective creation
  const blockerCountsMap: Record<BlockerType, number> = {
    ice: 0,
    stone: 0,
    lock: 0,
    double_lock: 0,
    crate: 0,
  }

  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const b = blockersGrid[r][c]
      if (b) blockerCountsMap[b]++
    }
  }

  // 5. Target Score and Move constraints
  // Moves count generally stays between 25 and 45.
  const baseMoves = 30 + (boardSize - 10) * 5
  // Harder levels restrict moves
  const movePenalty = Math.min(10, Math.floor(levelNumber / 100))
  const moveLimit = Math.max(18, baseMoves - movePenalty + rng.nextInt(-3, 3))

  // Base score scaling
  const targetScore = Math.floor(1500 + levelNumber * 350 + rng.nextInt(-2, 2) * 50)

  // 6. Generate Objectives
  const objectives: LevelObjective[] = []

  // Always require reaching a fraction of the target score, or make score a standalone objective
  objectives.push({
    type: 'score',
    target: targetScore,
    current: 0,
  })

  // Add random sub-objectives based on level
  const totalSubObjectives = levelNumber <= 10 ? 1 : levelNumber <= 50 ? 2 : 3
  const objectivesAdded = new Set<string>(['score'])

  const availableObjectiveTypes: ObjectiveType[] = ['clear_color']
  const totalBlockers = Object.values(blockerCountsMap).reduce((sum, count) => sum + count, 0)
  if (totalBlockers > 0) {
    availableObjectiveTypes.push('clear_blockers')
  }
  if (levelNumber > 15) {
    availableObjectiveTypes.push('combo')
  }

  let attempts = 0
  while (objectives.length < totalSubObjectives && attempts < 10) {
    attempts++
    const oType = rng.choice(availableObjectiveTypes)

    if (oType === 'clear_color') {
      const color = rng.choice(candyTypes)
      const key = `clear_color_${color}`
      if (!objectivesAdded.has(key)) {
        objectivesAdded.add(key)
        // Scale count with level
        const multiplier = levelNumber <= 20 ? 1.5 : levelNumber <= 100 ? 2.5 : 3.5
        const targetCount = Math.floor(20 + rng.next() * 10 + levelNumber * multiplier)
        objectives.push({
          type: 'clear_color',
          target: targetCount,
          current: 0,
          color,
        })
      }
    } else if (oType === 'clear_blockers') {
      // Find a blocker type that actually spawned
      const activeBlockerTypes = (Object.keys(blockerCountsMap) as BlockerType[]).filter(
        (bt) => blockerCountsMap[bt] > 0
      )
      if (activeBlockerTypes.length > 0) {
        const bType = rng.choice(activeBlockerTypes)
        const key = `clear_blockers_${bType}`
        if (!objectivesAdded.has(key)) {
          objectivesAdded.add(key)
          objectives.push({
            type: 'clear_blockers',
            target: blockerCountsMap[bType],
            current: 0,
            blockerType: bType,
          })
        }
      }
    } else if (oType === 'combo') {
      const key = 'combo'
      if (!objectivesAdded.has(key)) {
        objectivesAdded.add(key)
        // Combos target (e.g. reach a 3x, 4x, or 5x cascade chain)
        const maxTarget = levelNumber <= 50 ? 3 : levelNumber <= 300 ? 4 : 5
        const targetVal = rng.nextInt(3, maxTarget)
        objectives.push({
          type: 'combo',
          target: targetVal,
          current: 0,
        })
      }
    }
  }

  return {
    levelNumber,
    boardSize,
    candyTypes,
    blockersGrid,
    targetScore,
    moveLimit,
    difficultyTier,
    objectives,
  }
}
