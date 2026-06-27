import type { Position, SnakePlayer, FoodItem } from './snakeArenaTypes'

const DIRECTIONS: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
]

function getDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

// Checks if a candidate head coordinate collides with walls or any snake bodies
function isColliding(
  pos: Position,
  cols: number,
  rows: number,
  snakes: Record<string, SnakePlayer>
): boolean {
  if (pos.x < 0 || pos.x >= cols || pos.y < 0 || pos.y >= rows) return true

  for (const sId in snakes) {
    const s = snakes[sId]
    if (s.status === 'ACTIVE') {
      const isProtected = s.spawnProtectedUntil > Date.now()
      if (isProtected) continue

      for (const segment of s.body) {
        if (segment.x === pos.x && segment.y === pos.y) return true
      }
    }
  }
  return false
}

// Simple BFS to find the shortest clear path to food
function findShortestPath(
  start: Position,
  targets: Position[],
  cols: number,
  rows: number,
  snakes: Record<string, SnakePlayer>
): Position | null {
  const queue: { pos: Position; firstMove: Position }[] = []
  const visited = new Set<string>()

  // Initialize queue with valid immediate directions
  for (const dir of DIRECTIONS) {
    const nextPos = { x: start.x + dir.x, y: start.y + dir.y }
    if (!isColliding(nextPos, cols, rows, snakes)) {
      queue.push({ pos: nextPos, firstMove: dir })
      visited.add(`${nextPos.x},${nextPos.y}`)
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!
    
    // Check if we reached any target food
    if (targets.some(t => t.x === curr.pos.x && t.y === curr.pos.y)) {
      return curr.firstMove
    }

    // Traverse neighbors
    for (const dir of DIRECTIONS) {
      const nextPos = { x: curr.pos.x + dir.x, y: curr.pos.y + dir.y }
      const key = `${nextPos.x},${nextPos.y}`

      if (!visited.has(key) && !isColliding(nextPos, cols, rows, snakes)) {
        queue.push({ pos: nextPos, firstMove: curr.firstMove })
        visited.add(key)
      }
    }
  }

  return null
}

export function getSnakeAIMove(
  aiUserId: string,
  state: {
    cols: number
    rows: number
    snakes: Record<string, SnakePlayer>
    foods: FoodItem[]
  },
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare'
): Position {
  const snake = state.snakes[aiUserId]
  if (!snake || snake.status !== 'ACTIVE' || snake.body.length === 0) {
    return { x: 1, y: 0 }
  }

  const head = snake.body[0]
  const currentDir = snake.direction

  // Easy AI behaves 40% randomly and has simple avoidance
  if (difficulty === 'easy' && Math.random() < 0.4) {
    const safeDirs = DIRECTIONS.filter(dir => {
      const nextPos = { x: head.x + dir.x, y: head.y + dir.y }
      const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
      return !isOpposite && !isColliding(nextPos, state.cols, state.rows, state.snakes)
    })
    if (safeDirs.length > 0) {
      return safeDirs[Math.floor(Math.random() * safeDirs.length)]
    }
  }

  // Get list of targets sorted by distance
  const targets = state.foods.map(f => ({ x: f.x, y: f.y }))
  targets.sort((a, b) => getDistance(head, a) - getDistance(head, b))

  // Find clear path using BFS
  const pathMove = findShortestPath(head, targets, state.cols, state.rows, state.snakes)
  if (pathMove) {
    return pathMove
  }

  // Fallback: Pick any direction that doesn't cause immediate collision
  const fallbackDirs = DIRECTIONS.filter(dir => {
    const nextPos = { x: head.x + dir.x, y: head.y + dir.y }
    const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
    return !isOpposite && !isColliding(nextPos, state.cols, state.rows, state.snakes)
  })

  // Nightmare difficulty will choose the direction that maximizes survival space (BFS check for max visited spaces)
  if (difficulty === 'nightmare' && fallbackDirs.length > 1) {
    let maxSpace = -1
    let bestDir = fallbackDirs[0]

    for (const dir of fallbackDirs) {
      const nextPos = { x: head.x + dir.x, y: head.y + dir.y }
      // Measure reachable grid space (flood fill count)
      const reachableCount = floodFillCount(nextPos, state.cols, state.rows, state.snakes)
      if (reachableCount > maxSpace) {
        maxSpace = reachableCount
        bestDir = dir
      }
    }
    return bestDir
  }

  if (fallbackDirs.length > 0) {
    return fallbackDirs[Math.floor(Math.random() * fallbackDirs.length)]
  }

  // Double fallback: just continue straight
  return currentDir
}

// Helper to count available reachable grid space (to avoid traps)
function floodFillCount(
  start: Position,
  cols: number,
  rows: number,
  snakes: Record<string, SnakePlayer>
): number {
  const queue: Position[] = [start]
  const visited = new Set<string>()
  visited.add(`${start.x},${start.y}`)
  let count = 0

  while (queue.length > 0 && count < 50) { // Cap search depth to preserve performance
    const curr = queue.shift()!
    count++

    for (const dir of DIRECTIONS) {
      const nextPos = { x: curr.x + dir.x, y: curr.y + dir.y }
      const key = `${nextPos.x},${nextPos.y}`

      if (!visited.has(key) && !isColliding(nextPos, cols, rows, snakes)) {
        queue.push(nextPos)
        visited.add(key)
      }
    }
  }

  return count
}
