import { BlockerType } from './LevelGenerator'

export interface BoardCell {
  id: string
  row: number
  col: number
  color: string | null // null means empty space
  special: 'line_horizontal' | 'line_vertical' | 'area' | 'color' | null
  blocker: BlockerType | null
}

export interface SwapCoords {
  r1: number
  c1: number
  r2: number
  c2: number
}

export interface ExplosionImpact {
  explodedCells: { r: number; c: number }[]
  blockersCleared: { r: number; c: number; type: BlockerType }[]
  scoreGained: number
  comboCount: number
}

// Custom LCG for deterministic engine actions (like reshuffling or spawning line bomb direction)
class EngineRandom {
  private seed: number
  constructor(seed: number) {
    this.seed = seed
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280
    return this.seed / 233280
  }
}
const rng = new EngineRandom(42)

/**
 * Returns whether two coordinates are adjacent (Manhattan distance === 1)
 */
export function areAdjacent(r1: number, c1: number, r2: number, c2: number): boolean {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1
}

/**
 * Determines if a cell can be swapped/moved.
 * Locked/Double-locked, Stone, and Crate blocks cannot be moved.
 */
export function isMoveable(cell: BoardCell): boolean {
  if (!cell || cell.color === null) return false
  if (cell.blocker === 'lock' || cell.blocker === 'double_lock' || cell.blocker === 'stone' || cell.blocker === 'crate') {
    return false
  }
  return true
}

/**
 * Clone the board grid to prevent direct mutation
 */
export function cloneGrid(grid: BoardCell[][]): BoardCell[][] {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
    }))
  )
}

/**
 * Helper to generate a unique ID for a cell
 */
export function generateCellId(): string {
  return `cell_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`
}

/**
 * Checks the grid for standard match-3, 4, 5 runs.
 * Returns an array of matched cell coordinates and groups.
 */
export function findMatches(grid: BoardCell[][]): {
  matchedCoords: { r: number; c: number }[]
  matchGroups: { r: number; c: number }[][]
  specialSpawns: { r: number; c: number; type: 'line_horizontal' | 'line_vertical' | 'area' | 'color'; color: string }[]
} {
  const R = grid.length
  const C = grid[0].length
  const matchedGrid = Array(R).fill(null).map(() => Array(C).fill(false))
  const matchGroups: { r: number; c: number }[][] = []

  // Track horizontal matches
  for (let r = 0; r < R; r++) {
    let matchLen = 1
    let startCol = 0
    for (let c = 1; c <= C; c++) {
      const prevCell = grid[r][c - 1]
      const curCell = c < C ? grid[r][c] : null

      if (
        curCell &&
        prevCell.color &&
        curCell.color === prevCell.color &&
        // Blockers like stone/crate don't have matching colors
        prevCell.blocker !== 'stone' &&
        prevCell.blocker !== 'crate' &&
        curCell.blocker !== 'stone' &&
        curCell.blocker !== 'crate'
      ) {
        matchLen++
      } else {
        if (matchLen >= 3) {
          const group: { r: number; c: number }[] = []
          for (let i = startCol; i < startCol + matchLen; i++) {
            matchedGrid[r][i] = true
            group.push({ r, c: i })
          }
          matchGroups.push(group)
        }
        matchLen = 1
        startCol = c
      }
    }
  }

  // Track vertical matches
  for (let c = 0; c < C; c++) {
    let matchLen = 1
    let startRow = 0
    for (let r = 1; r <= R; r++) {
      const prevCell = grid[r - 1][c]
      const curCell = r < R ? grid[r][c] : null

      if (
        curCell &&
        prevCell.color &&
        curCell.color === prevCell.color &&
        prevCell.blocker !== 'stone' &&
        prevCell.blocker !== 'crate' &&
        curCell.blocker !== 'stone' &&
        curCell.blocker !== 'crate'
      ) {
        matchLen++
      } else {
        if (matchLen >= 3) {
          const group: { r: number; c: number }[] = []
          for (let i = startRow; i < startRow + matchLen; i++) {
            matchedGrid[i][c] = true
            group.push({ r: i, c })
          }
          matchGroups.push(group)
        }
        matchLen = 1
        startRow = r
      }
    }
  }

  // Collect all coordinates that matched
  const matchedCoords: { r: number; c: number }[] = []
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (matchedGrid[r][c]) {
        matchedCoords.push({ r, c })
      }
    }
  }

  // Determine Special Spawns (Match-4, Match-5, or Cross-Matches)
  const specialSpawns: { r: number; c: number; type: 'line_horizontal' | 'line_vertical' | 'area' | 'color'; color: string }[] = []

  // Check intersections of horizontal and vertical groups for L/T Cross Area Bombs
  // Or check size of single groups for Line / Color bombs.
  const processedGroups = new Set<number>()

  for (let i = 0; i < matchGroups.length; i++) {
    if (processedGroups.has(i)) continue
    const groupA = matchGroups[i]

    // Find any intersecting group
    let intersectedGroupIdx = -1
    let intersectionCoord: { r: number; c: number } | null = null

    for (let j = i + 1; j < matchGroups.length; j++) {
      if (processedGroups.has(j)) continue
      const groupB = matchGroups[j]

      // Check for intersection
      for (const coordA of groupA) {
        for (const coordB of groupB) {
          if (coordA.r === coordB.r && coordA.c === coordB.c) {
            intersectedGroupIdx = j
            intersectionCoord = coordA
            break
          }
        }
        if (intersectionCoord) break
      }
      if (intersectionCoord) break
    }

    if (intersectionCoord && intersectedGroupIdx !== -1) {
      // 1. Cross Match: Spawn Area Bomb at intersection
      processedGroups.add(i)
      processedGroups.add(intersectedGroupIdx)
      const color = grid[intersectionCoord.r][intersectionCoord.c].color!
      specialSpawns.push({
        r: intersectionCoord.r,
        c: intersectionCoord.c,
        type: 'area',
        color,
      })
    } else {
      // Check length of this single group
      processedGroups.add(i)
      const color = grid[groupA[0].r][groupA[0].c].color!

      if (groupA.length >= 5) {
        // 2. Match 5: Spawn Color Bomb
        // Spawn at center of match group
        const spawnCell = groupA[Math.floor(groupA.length / 2)]
        specialSpawns.push({
          r: spawnCell.r,
          c: spawnCell.c,
          type: 'color',
          color,
        })
      } else if (groupA.length === 4) {
        // 3. Match 4: Spawn Line Bomb
        // Vertical or Horizontal depends on orientation
        const isHorizontal = groupA[0].r === groupA[1].r
        const spawnCell = groupA[Math.floor(groupA.length / 2)]
        specialSpawns.push({
          r: spawnCell.r,
          c: spawnCell.c,
          type: isHorizontal ? 'line_vertical' : 'line_horizontal', // horizontal match creates vertical blast line, and vice-versa
          color,
        })
      }
    }
  }

  return {
    matchedCoords,
    matchGroups,
    specialSpawns,
  }
}

/**
 * Checks if the grid has any matches. Reusable helper.
 */
export function hasMatches(grid: BoardCell[][]): boolean {
  const { matchedCoords } = findMatches(grid)
  return matchedCoords.length > 0
}

/**
 * Scans the board for any valid swaps that result in a match, or if any adjacent cells are special bombs.
 */
export function hasPossibleMoves(grid: BoardCell[][]): boolean {
  const R = grid.length
  const C = grid[0].length

  const tempGrid = cloneGrid(grid)

  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell1 = tempGrid[r][c]
      if (!isMoveable(cell1)) continue

      // Test swap right
      if (c + 1 < C) {
        const cell2 = tempGrid[r][c + 1]
        if (isMoveable(cell2)) {
          // If both are specials, it's a valid swap (triggers special combination)
          if (cell1.special && cell2.special) return true

          // Otherwise test match
          tempGrid[r][c] = { ...cell2, row: r, col: c }
          tempGrid[r][c + 1] = { ...cell1, row: r, col: c + 1 }

          if (hasMatches(tempGrid)) {
            return true
          }
          // Restore
          tempGrid[r][c] = cell1
          tempGrid[r][c + 1] = cell2
        }
      }

      // Test swap down
      if (r + 1 < R) {
        const cell2 = tempGrid[r + 1][c]
        if (isMoveable(cell2)) {
          if (cell1.special && cell2.special) return true

          tempGrid[r][c] = { ...cell2, row: r, col: c }
          tempGrid[r + 1][c] = { ...cell1, row: r + 1, col: c }

          if (hasMatches(tempGrid)) {
            return true
          }
          tempGrid[r][c] = cell1
          tempGrid[r + 1][c] = cell2
        }
      }
    }
  }
  return false
}

/**
 * Reshuffles the board grid with new colors while keeping blockers in place.
 * Ensures the resulting board has at least one possible swap AND no immediate matches.
 */
export function reshuffleGrid(grid: BoardCell[][], candyTypes: string[]): BoardCell[][] {
  const R = grid.length
  const C = grid[0].length
  const newGrid = cloneGrid(grid)

  let attempts = 0
  const maxAttempts = 100

  while (attempts < maxAttempts) {
    attempts++

    // Collect all cells that can be shuffled (color is not null, not stone/crate/locked)
    const shuffleableCells: { r: number; c: number }[] = []
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        const cell = newGrid[r][c]
        if (cell.color && cell.blocker !== 'stone' && cell.blocker !== 'crate' && cell.blocker !== 'lock' && cell.blocker !== 'double_lock') {
          shuffleableCells.push({ r, c })
        }
      }
    }

    // Assign randomized colors to these cells
    for (const coord of shuffleableCells) {
      const randomColor = candyTypes[Math.floor(Math.random() * candyTypes.length)]
      newGrid[coord.r][coord.c].color = randomColor
      // Reset specials on reshuffled cells if they make it too complex
    }

    // Verify board has moves, and doesn't start with pre-matched conditions
    if (!hasMatches(newGrid) && hasPossibleMoves(newGrid)) {
      break
    }
  }

  return newGrid
}

/**
 * Detonates a single cell bomb, returns all cells impacted.
 */
export function executeExplosion(
  grid: BoardCell[][],
  startR: number,
  startC: number,
  specialType: 'line_horizontal' | 'line_vertical' | 'area' | 'color',
  triggerColor: string | null
): {
  explodedCells: { r: number; c: number }[]
  blockersCleared: { r: number; c: number; type: BlockerType }[]
  scoreGained: number
} {
  const R = grid.length
  const C = grid[0].length

  const explodedSet = new Set<string>()
  const queue: { r: number; c: number }[] = []

  // Add the primary cell
  queue.push({ r: startR, c: startC })
  explodedSet.add(`${startR},${startC}`)

  const blockersImpacted: { r: number; c: number; type: BlockerType }[] = []
  let scoreGained = 0

  const addExplosion = (r: number, c: number) => {
    if (r >= 0 && r < R && c >= 0 && c < C) {
      const key = `${r},${c}`
      if (!explodedSet.has(key)) {
        explodedSet.add(key)
        queue.push({ r, c })
      }
    }
  }

  // Iterate over explosion trigger queue (allows chained bomb detonations)
  let headIdx = 0
  while (headIdx < queue.length) {
    const { r, c } = queue[headIdx]
    headIdx++

    const cell = grid[r][c]
    const bombType = cell.special || (r === startR && c === startC ? specialType : null)

    scoreGained += 50 // Base score per exploded cell

    if (bombType === 'line_horizontal') {
      // Clear row
      scoreGained += 150
      for (let i = 0; i < C; i++) {
        addExplosion(r, i)
      }
    } else if (bombType === 'line_vertical') {
      // Clear col
      scoreGained += 150
      for (let i = 0; i < R; i++) {
        addExplosion(i, c)
      }
    } else if (bombType === 'area') {
      // Explode 3x3 surrounding
      scoreGained += 250
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          addExplosion(r + dr, c + dc)
        }
      }
    } else if (bombType === 'color') {
      // Clear all of selected color
      scoreGained += 500
      const targetColor = cell.color || triggerColor
      if (targetColor) {
        for (let i = 0; i < R; i++) {
          for (let j = 0; j < C; j++) {
            if (grid[i][j].color === targetColor) {
              addExplosion(i, j)
            }
          }
        }
      }
    }

    // Process blockers directly on this cell
    if (cell.blocker === 'ice') {
      blockersImpacted.push({ r, c, type: 'ice' })
    }
  }

  // Process blockers adjacent to all exploded cells (clearing stone/crate/locks)
  const explodedCoords = Array.from(explodedSet).map((key) => {
    const [r, c] = key.split(',').map(Number)
    return { r, c }
  })

  // Set of blocker coordinates processed to avoid duplicates
  const processedBlockers = new Set<string>()

  for (const { r, c } of explodedCoords) {
    // Check adjacent for stone/crate/locks
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: 0 }, // Itself
    ]

    for (const { dr, dc } of directions) {
      const nr = r + dr
      const nc = c + dc

      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const key = `${nr},${nc}`
        if (processedBlockers.has(key)) continue

        const cell = grid[nr][nc]
        if (cell.blocker) {
          processedBlockers.add(key)
          blockersImpacted.push({ r: nr, c: nc, type: cell.blocker })
        }
      }
    }
  }

  return {
    explodedCells: explodedCoords,
    blockersCleared: blockersImpacted,
    scoreGained,
  }
}

/**
 * Handle direct swap special candy combo interactions!
 */
export function executeSpecialCombo(
  grid: BoardCell[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): {
  explodedCells: { r: number; c: number }[]
  blockersCleared: { r: number; c: number; type: BlockerType }[]
  scoreGained: number
  isComboTriggered: boolean
} {
  const cell1 = grid[r1][c1]
  const cell2 = grid[r2][c2]

  const R = grid.length
  const C = grid[0].length

  if (!cell1.special || !cell2.special) {
    return { explodedCells: [], blockersCleared: [], scoreGained: 0, isComboTriggered: false }
  }

  const s1 = cell1.special
  const s2 = cell2.special

  const explodedSet = new Set<string>()
  const blockersCleared: { r: number; c: number; type: BlockerType }[] = []
  let scoreGained = 1000 // Huge bonus for triggering special combo

  const addExploded = (r: number, c: number) => {
    if (r >= 0 && r < R && c >= 0 && c < C) {
      explodedSet.add(`${r},${c}`)
    }
  }

  // 1. Color Bomb + Color Bomb: Clears everything
  if (s1 === 'color' && s2 === 'color') {
    scoreGained += 5000
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < C; c++) {
        addExploded(r, c)
      }
    }
  }
  // 2. Color Bomb + Line Bomb: Turns all of that color into random Line Bombs, then triggers them
  else if ((s1 === 'color' && (s2 === 'line_horizontal' || s2 === 'line_vertical')) || (s2 === 'color' && (s1 === 'line_horizontal' || s1 === 'line_vertical'))) {
    scoreGained += 3000
    const colorToConvert = s1 === 'color' ? cell2.color : cell1.color
    if (colorToConvert) {
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          if (grid[r][c].color === colorToConvert) {
            grid[r][c].special = rng.next() > 0.5 ? 'line_horizontal' : 'line_vertical'
            addExploded(r, c)
          }
        }
      }
    }
    // Explode all converted ones
    addExploded(r1, c1)
    addExploded(r2, c2)
  }
  // 3. Color Bomb + Area Bomb: Turns all of that color into Area Bombs, then triggers them
  else if ((s1 === 'color' && s2 === 'area') || (s2 === 'color' && s1 === 'area')) {
    scoreGained += 3500
    const colorToConvert = s1 === 'color' ? cell2.color : cell1.color
    if (colorToConvert) {
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          if (grid[r][c].color === colorToConvert) {
            grid[r][c].special = 'area'
            addExploded(r, c)
          }
        }
      }
    }
    addExploded(r1, c1)
    addExploded(r2, c2)
  }
  // 4. Line Bomb + Line Bomb: Clears both row and col cross
  else if ((s1 === 'line_horizontal' || s1 === 'line_vertical') && (s2 === 'line_horizontal' || s2 === 'line_vertical')) {
    scoreGained += 1500
    for (let i = 0; i < C; i++) {
      addExploded(r1, i)
      addExploded(r2, i)
    }
    for (let i = 0; i < R; i++) {
      addExploded(i, c1)
      addExploded(i, c2)
    }
  }
  // 5. Line Bomb + Area Bomb: Giant 3-row / 3-col clear
  else if (((s1 === 'line_horizontal' || s1 === 'line_vertical') && s2 === 'area') || (s2 === 'line_horizontal' || s2 === 'line_vertical' && s1 === 'area')) {
    scoreGained += 2500
    const centerR = r2
    const centerC = c2
    // Clear 3 columns centered at centerC
    for (let r = 0; r < R; r++) {
      for (let dc = -1; dc <= 1; dc++) {
        addExploded(r, centerC + dc)
      }
    }
    // Clear 3 rows centered at centerR
    for (let c = 0; c < C; c++) {
      for (let dr = -1; dr <= 1; dr++) {
        addExploded(centerR + dr, c)
      }
    }
  }
  // 6. Area Bomb + Area Bomb: Giant 5x5 explosion
  else if (s1 === 'area' && s2 === 'area') {
    scoreGained += 2000
    const centerR = r2
    const centerC = c2
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        addExploded(centerR + dr, centerC + dc)
      }
    }
  }

  // Deduce final unique list of exploded cells
  const explodedCells = Array.from(explodedSet).map((key) => {
    const [r, c] = key.split(',').map(Number)
    return { r, c }
  })

  // Update blockers adjacent or on these cells
  const processedBlockers = new Set<string>()
  for (const { r, c } of explodedCells) {
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
      { dr: 0, dc: 0 },
    ]
    for (const { dr, dc } of directions) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const key = `${nr},${nc}`
        if (processedBlockers.has(key)) continue
        const cell = grid[nr][nc]
        if (cell.blocker) {
          processedBlockers.add(key)
          blockersCleared.push({ r: nr, c: nc, type: cell.blocker })
        }
      }
    }
  }

  // Reset specials so they don't loop
  grid[r1][c1].special = null
  grid[r2][c2].special = null

  return {
    explodedCells,
    blockersCleared,
    scoreGained,
    isComboTriggered: true,
  }
}

/**
 * Selects a color from candyTypes that does not form a match-3 horizontally or vertically at (r, c).
 */
export function getNonMatchingColor(
  grid: BoardCell[][],
  r: number,
  c: number,
  candyTypes: string[],
  rng?: { choice: <T>(arr: T[]) => T }
): string {
  const R = grid.length
  const C = grid[0].length
  const forbiddenColors = new Set<string>()

  // Check left: (r, c-1) & (r, c-2)
  if (c >= 2) {
    const c1 = grid[r][c - 1]?.color
    const c2 = grid[r][c - 2]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }
  // Check right: (r, c+1) & (r, c+2)
  if (c < C - 2) {
    const c1 = grid[r][c + 1]?.color
    const c2 = grid[r][c + 2]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }
  // Check middle horizontal: (r, c-1) & (r, c+1)
  if (c >= 1 && c < C - 1) {
    const c1 = grid[r][c - 1]?.color
    const c2 = grid[r][c + 1]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }

  // Check above: (r-1, c) & (r-2, c)
  if (r >= 2) {
    const c1 = grid[r - 1][c]?.color
    const c2 = grid[r - 2][c]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }
  // Check below: (r+1, c) & (r+2, c)
  if (r < R - 2) {
    const c1 = grid[r + 1][c]?.color
    const c2 = grid[r + 2][c]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }
  // Check middle vertical: (r-1, c) & (r+1, c)
  if (r >= 1 && r < R - 1) {
    const c1 = grid[r - 1][c]?.color
    const c2 = grid[r + 1][c]?.color
    if (c1 && c1 === c2) forbiddenColors.add(c1)
  }

  const allowedColors = candyTypes.filter((color) => !forbiddenColors.has(color))
  if (allowedColors.length > 0) {
    return rng ? rng.choice(allowedColors) : allowedColors[Math.floor(Math.random() * allowedColors.length)]
  }
  return rng ? rng.choice(candyTypes) : candyTypes[Math.floor(Math.random() * candyTypes.length)]
}

/**
 * Collapses the board: clears matched/exploded cells, damages blockers, and shifts cells downward.
 * Generates new cells from the top.
 * Returns { grid, score, blockersCleared, matchesRemaining }
 */
export function processMatchesAndCascades(
  grid: BoardCell[][],
  candyTypes: string[],
  comboCount: number = 0,
  rng?: { choice: <T>(arr: T[]) => T }
): {
  grid: BoardCell[][]
  scoreGained: number
  blockersCleared: { r: number; c: number; type: BlockerType }[]
  cascadeGrid: BoardCell[][] // Grid state reflecting final fallen slots
} {
  const R = grid.length
  const C = grid[0].length

  const currentGrid = cloneGrid(grid)

  // 1. Identify matches
  const { matchedCoords, specialSpawns } = findMatches(currentGrid)

  // If no matches, return early
  if (matchedCoords.length === 0) {
    return { grid: currentGrid, scoreGained: 0, blockersCleared: [], cascadeGrid: currentGrid }
  }

  // 2. Identify all cells that will explode due to bombs inside matched areas
  const explodedSet = new Set<string>()
  const blockersClearedList: { r: number; c: number; type: BlockerType }[] = []
  let scoreAccumulated = 0

  // Trigger any bombs present inside matched coordinates
  for (const { r, c } of matchedCoords) {
    const cell = currentGrid[r][c]
    if (cell.special) {
      const { explodedCells, blockersCleared, scoreGained } = executeExplosion(
        currentGrid,
        r,
        c,
        cell.special,
        cell.color
      )
      explodedCells.forEach(({ r: er, c: ec }) => explodedSet.add(`${er},${ec}`))
      blockersCleared.forEach((bc) => blockersClearedList.push(bc))
      scoreAccumulated += scoreGained
    } else {
      explodedSet.add(`${r},${c}`)
    }
  }

  // Add standard score for simple matched cells
  matchedCoords.forEach(() => {
    scoreAccumulated += 60
  })

  // Identify blockers directly matched or hit by explosions
  // Locks/Double locks: single lock becomes unlocked, single matches directly
  // Stone/Crate: Adjacent clearance
  const processedMatchesList = Array.from(explodedSet).map((key) => {
    const [r, c] = key.split(',').map(Number)
    return { r, c }
  })

  // We will process blocker damage
  const cellsToClear = new Set<string>()
  for (const { r, c } of processedMatchesList) {
    const cell = currentGrid[r][c]

    if (cell.blocker) {
      // Direct matches on blockers
      if (cell.blocker === 'lock') {
        currentGrid[r][c].blocker = null
        blockersClearedList.push({ r, c, type: 'lock' })
        // Clear locked candy is now moveable, but keep color for this turn
      } else if (cell.blocker === 'double_lock') {
        currentGrid[r][c].blocker = 'lock'
        blockersClearedList.push({ r, c, type: 'double_lock' })
      } else if (cell.blocker === 'ice') {
        currentGrid[r][c].blocker = null
        blockersClearedList.push({ r, c, type: 'ice' })
        cellsToClear.add(`${r},${c}`)
      } else if (cell.blocker === 'crate') {
        currentGrid[r][c].blocker = null
        blockersClearedList.push({ r, c, type: 'crate' })
        cellsToClear.add(`${r},${c}`)
      } else if (cell.blocker === 'stone') {
        currentGrid[r][c].blocker = null
        blockersClearedList.push({ r, c, type: 'stone' })
        cellsToClear.add(`${r},${c}`)
      }
    } else {
      cellsToClear.add(`${r},${c}`)
    }
  }

  // Also check adjacency clearance of stone and crate blockers from standard matches
  for (const { r, c } of matchedCoords) {
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ]
    for (const { dr, dc } of directions) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < R && nc >= 0 && nc < C) {
        const adjacentCell = currentGrid[nr][nc]
        if (adjacentCell.blocker === 'stone') {
          currentGrid[nr][nc].blocker = null
          blockersClearedList.push({ r: nr, c: nc, type: 'stone' })
          cellsToClear.add(`${nr},${nc}`)
        } else if (adjacentCell.blocker === 'crate') {
          currentGrid[nr][nc].blocker = null
          blockersClearedList.push({ r: nr, c: nc, type: 'crate' })
          cellsToClear.add(`${nr},${nc}`)
        }
      }
    }
  }

  // Spawn special candies at appropriate positions
  for (const spawn of specialSpawns) {
    // If the spawn coordinate is in cellsToClear, we do NOT clear it, we assign it the special status
    const key = `${spawn.r},${spawn.c}`
    cellsToClear.delete(key)
    currentGrid[spawn.r][spawn.c] = {
      ...currentGrid[spawn.r][spawn.c],
      color: spawn.color,
      special: spawn.type,
      blocker: null,
    }
  }

  // Clear colors on cells marked for deletion
  for (const key of Array.from(cellsToClear)) {
    const [r, c] = key.split(',').map(Number)
    currentGrid[r][c].color = null
    currentGrid[r][c].special = null
  }

  // 3. Cascade/Falling down logic
  // Loop column-by-column, from bottom to top
  const cascadeGrid = cloneGrid(currentGrid)
  for (let c = 0; c < C; c++) {
    // Find empty spots and pull non-empty cells down
    let writeRow = R - 1
    for (let r = R - 1; r >= 0; r--) {
      const cell = cascadeGrid[r][c]
      // Stone and crate blockers are solid obstacles and do not fall
      if (cell.blocker === 'stone' || cell.blocker === 'crate') {
        // Find if there's cells above that can slide down?
        // For simplicity: stone/crates are completely impassable columns, they don't fall, and elements above them slide over or stay.
        // Let's implement standard gravity: stone/crate blocker stays, writeRow moves.
        writeRow = r - 1
        continue
      }

      if (cell.color !== null) {
        if (writeRow !== r) {
          cascadeGrid[writeRow][c].color = cell.color
          cascadeGrid[writeRow][c].special = cell.special
          cascadeGrid[writeRow][c].blocker = cell.blocker
          cascadeGrid[r][c].color = null
          cascadeGrid[r][c].special = null
        }
        writeRow--
      }
    }

    // Fill remaining empty spots at the top of the column with new candies
    for (let r = writeRow; r >= 0; r--) {
      if (cascadeGrid[r][c].blocker !== 'stone' && cascadeGrid[r][c].blocker !== 'crate') {
        const chosenColor = comboCount >= 2
          ? getNonMatchingColor(cascadeGrid, r, c, candyTypes, rng)
          : (rng ? rng.choice(candyTypes) : candyTypes[Math.floor(Math.random() * candyTypes.length)])
        cascadeGrid[r][c].color = chosenColor
        cascadeGrid[r][c].special = null
        cascadeGrid[r][c].blocker = null
        cascadeGrid[r][c].id = generateCellId() // Assign fresh ID for slide-down animation keying
      }
    }
  }

  return {
    grid: cascadeGrid,
    scoreGained: scoreAccumulated,
    blockersCleared: blockersClearedList,
    cascadeGrid,
  }
}
