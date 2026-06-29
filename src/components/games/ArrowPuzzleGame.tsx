'use client'
import { ArrowRightIcon, LockIcon, KeyIcon, LightbulbIcon, HistoryIcon, LogOutIcon, GiftIcon, AwardIcon, ZapIcon } from '@/components/shared/Icons'

import { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import GameHUD from '@/components/layout/GameHUD'

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'

type PieceType =
  | 'LEFT_RIGHT'
  | 'RIGHT_LEFT'
  | 'UP_DOWN'
  | 'DOWN_UP'
  | 'UTURN_LEFT'
  | 'UTURN_RIGHT'
  | 'ZIGZAG_H'
  | 'ZIGZAG_V'
  | 'SPIRAL'
  | 'CORNER_UR'
  | 'CORNER_DR'
  | 'CORNER_DL'
  | 'CORNER_UL'
  | 'NESTED'

interface Arrow {
  id: string
  type: 'arrow'
  dir: Direction
  pieceType: PieceType
  path: [number, number][]
  isLocked: boolean
  isKey: boolean // clearing this unlocks all locked arrows
  isChainRelease: boolean // clearing this triggers adjacent cells
  multiStageCount: number // 1 or 2 (multi-stage releases)
  isClearing: boolean
}

interface Blocker {
  type: 'blocker'
}

interface Gate {
  type: 'gate'
  allowedDir: Direction
}

interface Portal {
  type: 'portal'
  portalId: string
  targetNode: [number, number]
}

interface Modifier {
  type: 'modifier'
  newDir: Direction
}

type NodeContent = Arrow | Blocker | Gate | Portal | Modifier | null
type Grid = NodeContent[][]

interface PortalPair {
  id: string
  nodeA: [number, number]
  nodeB: [number, number]
}

interface PressureNode {
  r: number
  c: number
  isBlocked: boolean
  triggerArrowId: string
}

type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'super-hard'
type GameState = 'setup' | 'playing' | 'gameover'

// Deterministic Seeded Pseudo-Random Number Generator (mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Generate seeded random generator from string
function getSeededRandom(seedStr: string) {
  let h1 = 1779033703,
    h2 = 3024733165,
    h3 = 3362453659,
    h4 = 50249325
  for (let i = 0, k; i < seedStr.length; i++) {
    k = seedStr.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  const seedInt = (h1 ^ h2 ^ h3 ^ h4) >>> 0
  return mulberry32(seedInt)
}

// Trace directional delta coordinates
const getDelta = (dir: Direction): [number, number] => {
  return {
    UP: [-1, 0] as [number, number],
    DOWN: [1, 0] as [number, number],
    LEFT: [0, -1] as [number, number],
    RIGHT: [0, 1] as [number, number],
  }[dir]
}

// Trace the dynamic flight path for an arrow considering portals & modifiers
function traceArrowRoute(
  startR: number,
  startC: number,
  dir: Direction,
  grid: Grid
): [number, number][] {
  const path: [number, number][] = [[startR, startC]]
  let currR = startR
  let currC = startC
  let currDir = dir
  const size = grid.length
  const visited = new Set<string>()

  while (true) {
    visited.add(`${currR},${currC}`)
    const delta = getDelta(currDir)
    if (!delta) break
    const [dr, dc] = delta
    currR += dr
    currC += dc

    if (currR < 0 || currR >= size || currC < 0 || currC >= size) {
      path.push([currR, currC]) // Exit node
      break
    }

    path.push([currR, currC])

    // Infinite loop safeguard
    if (visited.has(`${currR},${currC}`) || path.length > 40) {
      break
    }

    const cell = grid[currR][currC]
    if (!cell) continue

    if (cell.type === 'modifier') {
      currDir = cell.newDir
    } else if (cell.type === 'portal') {
      const [tr, tc] = cell.targetNode
      currR = tr
      currC = tc
      path.push([currR, currC])
    }
  }
  return path
}

// Classify a path sequence into a standard route piece shape
function classifyPath(nodes: [number, number][]): { pieceType: PieceType; dir: Direction } {
  if (nodes.length < 2) {
    return { pieceType: 'LEFT_RIGHT', dir: 'RIGHT' }
  }

  const dirs: Direction[] = []
  for (let i = 0; i < nodes.length - 1; i++) {
    const [r1, c1] = nodes[i]
    const [r2, c2] = nodes[i + 1]
    const dr = r2 - r1
    const dc = c2 - c1
    if (dr === -1) dirs.push('UP')
    else if (dr === 1) dirs.push('DOWN')
    else if (dc === -1) dirs.push('LEFT')
    else if (dc === 1) dirs.push('RIGHT')
  }

  const turns: Direction[] = []
  dirs.forEach(d => {
    if (turns.length === 0 || turns[turns.length - 1] !== d) {
      turns.push(d)
    }
  })

  const firstDir = dirs[0] || 'RIGHT'

  if (turns.length === 1) {
    const typeMap: Record<Direction, PieceType> = {
      RIGHT: 'LEFT_RIGHT',
      LEFT: 'RIGHT_LEFT',
      DOWN: 'UP_DOWN',
      UP: 'DOWN_UP',
    }
    return { pieceType: typeMap[firstDir], dir: firstDir }
  }

  if (turns.length === 2) {
    const d1 = turns[0]
    const d2 = turns[1]
    if ((d1 === 'UP' && d2 === 'RIGHT') || (d1 === 'LEFT' && d2 === 'DOWN')) {
      return { pieceType: 'CORNER_UR', dir: d1 }
    }
    if ((d1 === 'DOWN' && d2 === 'RIGHT') || (d1 === 'LEFT' && d2 === 'UP')) {
      return { pieceType: 'CORNER_DR', dir: d1 }
    }
    if ((d1 === 'DOWN' && d2 === 'LEFT') || (d1 === 'RIGHT' && d2 === 'UP')) {
      return { pieceType: 'CORNER_DL', dir: d1 }
    }
    if ((d1 === 'UP' && d2 === 'LEFT') || (d1 === 'RIGHT' && d2 === 'DOWN')) {
      return { pieceType: 'CORNER_UL', dir: d1 }
    }
    return { pieceType: 'CORNER_DR', dir: d1 }
  }

  if (turns.length === 3) {
    const d1 = turns[0]
    const d3 = turns[2]
    const isOpposite = (a: Direction, b: Direction) => {
      return (a === 'LEFT' && b === 'RIGHT') || (a === 'RIGHT' && b === 'LEFT') || (a === 'UP' && b === 'DOWN') || (a === 'DOWN' && b === 'UP')
    }

    if (isOpposite(d1, d3)) {
      return { pieceType: d1 === 'LEFT' || d1 === 'UP' ? 'UTURN_LEFT' : 'UTURN_RIGHT', dir: d1 }
    } else {
      return { pieceType: d1 === 'LEFT' || d1 === 'RIGHT' ? 'ZIGZAG_H' : 'ZIGZAG_V', dir: d1 }
    }
  }

  if (turns.length === 4) {
    return { pieceType: 'SPIRAL', dir: firstDir }
  }
  return { pieceType: 'NESTED', dir: firstDir }
}

// Path checking along pathway with teleports, gates, modifiers and pressure nodes
function isPathClearOnBoard(
  r: number,
  c: number,
  arrow: Arrow,
  grid: Grid,
  portals: PortalPair[],
  pressureNodes: PressureNode[]
): boolean {
  const path = arrow.path
  if (!path || path.length === 0) return false

  for (let i = 1; i < path.length; i++) {
    const [currR, currC] = path[i]

    if (currR < 0 || currR >= grid.length || currC < 0 || currC >= grid[0].length) {
      continue
    }

    const cell = grid[currR][currC]
    if (cell === null) continue

    if (cell.type === 'arrow') {
      return false
    }

    if (cell.type === 'blocker') {
      const pn = pressureNodes.find(p => p.r === currR && p.c === currC)
      if (pn && pn.isBlocked) {
        return false
      }
      if (!pn) {
        return false
      }
    }

    if (cell.type === 'gate') {
      const prevNode = path[i - 1]
      const dr = currR - prevNode[0]
      const dc = currC - prevNode[1]
      let travelDir: Direction = 'RIGHT'
      if (dr === -1) travelDir = 'UP'
      else if (dr === 1) travelDir = 'DOWN'
      else if (dc === -1) travelDir = 'LEFT'

      if (cell.allowedDir !== travelDir) {
        return false
      }
    }
  }

  return true
}

// Greedy solver validation check
function validateBoardStateSolvable(board: {
  grid: Grid
  portals: PortalPair[]
  pressureNodes: PressureNode[]
}): boolean {
  const gridCopy = board.grid.map(row => row.map(cell => (cell ? { ...cell } : null))) as Grid
  const pnCopy = board.pressureNodes.map(pn => ({ ...pn }))

  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < gridCopy.length; r++) {
      for (let c = 0; c < gridCopy[0].length; c++) {
        const cell = gridCopy[r][c]
        if (cell && cell.type === 'arrow') {
          if (isPathClearOnBoard(r, c, cell, gridCopy, board.portals, pnCopy)) {
            if (cell.isLocked) {
              cell.isLocked = false
              changed = true
            } else if (cell.multiStageCount > 1) {
              cell.multiStageCount--
              changed = true
            } else {
              gridCopy[r][c] = null
              changed = true

              if (cell.isKey) {
                for (let ri = 0; ri < gridCopy.length; ri++) {
                  for (let ci = 0; ci < gridCopy[0].length; ci++) {
                    const other = gridCopy[ri][ci]
                    if (other && other.type === 'arrow' && other.isLocked) {
                      other.isLocked = false
                    }
                  }
                }
              }

              pnCopy.forEach(pn => {
                if (pn.triggerArrowId === cell.id) {
                  pn.isBlocked = false
                  gridCopy[pn.r][pn.c] = null
                }
              })
            }
          }
        }
      }
    }
  }

  for (let r = 0; r < gridCopy.length; r++) {
    for (let c = 0; c < gridCopy[0].length; c++) {
      const cell = gridCopy[r][c]
      if (cell && cell.type === 'arrow') {
        return false
      }
    }
  }
  return true
}

function getFallbackBoard(size: number) {
  const grid: Grid = Array(size).fill(null).map(() => Array(size).fill(null))
  const fArrow: Arrow = {
    id: 'fb1',
    type: 'arrow',
    dir: 'RIGHT',
    pieceType: 'LEFT_RIGHT',
    path: [[0, 0], [0, 1], [0, 2]],
    isLocked: false,
    isKey: false,
    isChainRelease: false,
    multiStageCount: 1,
    isClearing: false
  }
  grid[0][0] = fArrow
  return { grid, portals: [], pressureNodes: [] }
}

// Quadratic corner rounding for curved route SVG drawing
function getBezierPath(path: [number, number][], size: number): string {
  if (path.length === 0) return ''
  const pts = path.map(node => ({
    x: ((node[1] + 0.5) * 100) / size,
    y: ((node[0] + 0.5) * 100) / size
  }))
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  let d = `M ${pts[0].x} ${pts[0].y}`
  const r = 25 / size // Corner radius in SVG viewBox coordinates (out of 100)

  for (let i = 1; i < pts.length - 1; i++) {
    const pPrev = pts[i - 1]
    const pCurr = pts[i]
    const pNext = pts[i + 1]

    const dx1 = pCurr.x - pPrev.x
    const dy1 = pCurr.y - pPrev.y
    const len1 = Math.hypot(dx1, dy1)

    const dx2 = pNext.x - pCurr.x
    const dy2 = pNext.y - pCurr.y
    const len2 = Math.hypot(dx2, dy2)

    const actualR = Math.min(r, len1 / 2, len2 / 2)

    const pStart = {
      x: pCurr.x - (dx1 / len1) * actualR,
      y: pCurr.y - (dy1 / len1) * actualR
    }

    const pEnd = {
      x: pCurr.x + (dx2 / len2) * actualR,
      y: pCurr.y + (dy2 / len2) * actualR
    }

    d += ` L ${pStart.x} ${pStart.y} Q ${pCurr.x} ${pCurr.y} ${pEnd.x} ${pEnd.y}`
  }

  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return d
}

// Procedural Level Generator
function generateSeededLevel(difficulty: Difficulty, levelNum: number) {
  // Arrow Density Scaling based on Campaign Level
  let size = 6
  let numPaths = 4
  let fillPercent = 0.58

  if (levelNum <= 5) {
    size = 5
    numPaths = 3
    fillPercent = 0.42 // Sparse
  } else if (levelNum <= 15) {
    size = 6
    numPaths = 4
    fillPercent = 0.52 // Moderate
  } else if (levelNum <= 30) {
    size = 7
    numPaths = 5
    fillPercent = 0.60 // Dense
  } else if (levelNum <= 40) {
    size = 8
    numPaths = 6
    fillPercent = 0.66 // Heavy
  } else {
    size = 8
    numPaths = 7
    fillPercent = 0.74 // Extreme
  }

  const difficultyNameMap: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    expert: 'Expert',
    'super-hard': 'SuperHard',
  }
  const seed = `${difficultyNameMap[difficulty] || difficulty}-${levelNum}`
  const rand = getSeededRandom(seed)

  let attempts = 0
  while (attempts < 150) {
    attempts++
    const grid: Grid = Array(size).fill(null).map(() => Array(size).fill(null))
    const pathways: [number, number][][] = []
    const portals: PortalPair[] = []
    const pressureNodes: PressureNode[] = []

    const exitPoints: [number, number][] = []
    for (let i = 0; i < size; i++) {
      exitPoints.push([0, i])
      exitPoints.push([size - 1, i])
      if (i > 0 && i < size - 1) {
        exitPoints.push([i, 0])
        exitPoints.push([i, size - 1])
      }
    }

    const shuffledExits = [...exitPoints]
    for (let i = shuffledExits.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [shuffledExits[i], shuffledExits[j]] = [shuffledExits[j], shuffledExits[i]]
    }

    for (let pIdx = 0; pIdx < numPaths && pIdx < shuffledExits.length; pIdx++) {
      const start = shuffledExits[pIdx]
      const nodes: [number, number][] = [start]
      let currR = start[0]
      let currC = start[1]

      const visitedInPath = new Set<string>()
      visitedInPath.add(`${currR},${currC}`)

      const maxLength = {
        easy: 4,
        medium: 6,
        hard: 8,
        expert: 9,
        'super-hard': 10,
      }[difficulty] || 6

      for (let step = 0; step < maxLength; step++) {
        const neighbors: [number, number][] = []
        const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]]
        for (const [dr, dc] of deltas) {
          const nr = currR + dr
          const nc = currC + dc
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && !visitedInPath.has(`${nr},${nc}`)) {
            neighbors.push([nr, nc])
          }
        }

        if (neighbors.length === 0) break
        const nextNode = neighbors[Math.floor(rand() * neighbors.length)]
        nodes.push(nextNode)
        currR = nextNode[0]
        currC = nextNode[1]
        visitedInPath.add(`${currR},${currC}`)
      }

      nodes.reverse()
      pathways.push(nodes)
    }

    if (difficulty !== 'easy') {
      const blockerChance = { medium: 0.08, hard: 0.12, expert: 0.16, 'super-hard': 0.22 }[difficulty]
      for (let r = 1; r < size - 1; r++) {
        for (let c = 1; c < size - 1; c++) {
          if (grid[r][c] === null && rand() < blockerChance) {
            grid[r][c] = { type: 'blocker' }
          }
        }
      }
    }

    if (['hard', 'expert', 'super-hard'].includes(difficulty) && pathways.length >= 2) {
      const numPortals = difficulty === 'super-hard' ? 2 : 1
      for (let p = 0; p < numPortals; p++) {
        const candidates: { r: number; c: number }[] = []
        for (let r = 1; r < size - 1; r++) {
          for (let c = 1; c < size - 1; c++) {
            if (grid[r][c] === null) candidates.push({ r, c })
          }
        }

        if (candidates.length >= 2) {
          const nodeA = candidates[Math.floor(rand() * candidates.length)]
          const filtered = candidates.filter(c => c.r !== nodeA.r || c.c !== nodeA.c)
          if (filtered.length > 0) {
            const nodeB = filtered[Math.floor(rand() * filtered.length)]
            const portalId = `portal-${p}-${nodeA.r}-${nodeA.c}`
            portals.push({ id: portalId, nodeA: [nodeA.r, nodeA.c], nodeB: [nodeB.r, nodeB.c] })

            grid[nodeA.r][nodeA.c] = { type: 'portal', portalId, targetNode: [nodeB.r, nodeB.c] }
            grid[nodeB.r][nodeB.c] = { type: 'portal', portalId, targetNode: [nodeA.r, nodeA.c] }
          }
        }
      }
    }

    if (['hard', 'expert', 'super-hard'].includes(difficulty)) {
      const numModifiers = difficulty === 'super-hard' ? 2 : 1
      for (let m = 0; m < numModifiers; m++) {
        const candidates: { r: number; c: number }[] = []
        for (let r = 1; r < size - 1; r++) {
          for (let c = 1; c < size - 1; c++) {
            if (grid[r][c] === null) candidates.push({ r, c })
          }
        }
        if (candidates.length > 0) {
          const choice = candidates[Math.floor(rand() * candidates.length)]
          const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT']
          const newDir = dirs[Math.floor(rand() * dirs.length)]
          grid[choice.r][choice.c] = { type: 'modifier', newDir }
        }
      }
    }

    if (['expert', 'super-hard'].includes(difficulty)) {
      const numPressure = levelNum >= 25 ? 2 : 1
      for (let p = 0; p < numPressure; p++) {
        const candidates: [number, number][] = []
        for (let r = 1; r < size - 1; r++) {
          for (let c = 1; c < size - 1; c++) {
            if (grid[r][c] === null) candidates.push([r, c])
          }
        }
        if (candidates.length > 0) {
          const [pr, pc] = candidates[Math.floor(rand() * candidates.length)]
          pressureNodes.push({ r: pr, c: pc, isBlocked: true, triggerArrowId: '' })
          grid[pr][pc] = { type: 'blocker' }
        }
      }
    }

    const targetArrows = Math.floor(size * size * fillPercent)
    let arrowsPlaced = 0

    const pathNodes: { path: [number, number][]; nodeIdx: number; r: number; c: number }[] = []
    pathways.forEach(path => {
      for (let i = 0; i < path.length - 1; i++) {
        const [r, c] = path[i]
        pathNodes.push({ path, nodeIdx: i, r, c })
      }
    })

    for (let i = pathNodes.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pathNodes[i], pathNodes[j]] = [pathNodes[j], pathNodes[i]]
    }

    for (const node of pathNodes) {
      if (arrowsPlaced >= targetArrows) break
      if (grid[node.r][node.c] !== null) continue

      const nextNode = node.path[node.nodeIdx + 1]
      const dr = nextNode[0] - node.r
      const dc = nextNode[1] - node.c
      let dir: Direction = 'RIGHT'
      if (dr === -1) dir = 'UP'
      else if (dr === 1) dir = 'DOWN'
      else if (dc === -1) dir = 'LEFT'

      const arrowId = `arrow-${node.r}-${node.c}-${rand()}`

      let isLocked = false
      let isKey = false
      let isChainRelease = false
      let multiStageCount = 1

      if (difficulty !== 'easy') {
        if (rand() < 0.22) {
          isLocked = true
        }
        if (isLocked && rand() < 0.40) {
          isKey = true
        }
        if (['expert', 'super-hard'].includes(difficulty) && rand() < 0.18) {
          multiStageCount = 2
        }
        if (['expert', 'super-hard'].includes(difficulty) && rand() < 0.18) {
          isChainRelease = true
        }
      }

      pressureNodes.forEach(pn => {
        if (pn.triggerArrowId === '') {
          pn.triggerArrowId = arrowId
        }
      })

      const newArrow: Arrow = {
        id: arrowId,
        type: 'arrow',
        dir,
        pieceType: 'LEFT_RIGHT', // classified later
        path: [], // traced later
        isLocked,
        isKey,
        isChainRelease,
        multiStageCount,
        isClearing: false,
      }

      grid[node.r][node.c] = newArrow
      arrowsPlaced++
    }

    if (['medium', 'hard', 'expert', 'super-hard'].includes(difficulty)) {
      pathways.forEach(path => {
        for (let i = 1; i < path.length - 1; i++) {
          const [r, c] = path[i]
          if (grid[r][c] === null && rand() < 0.10) {
            const nextNode = path[i + 1]
            const dr = nextNode[0] - r
            const dc = nextNode[1] - c
            let dir: Direction = 'RIGHT'
            if (dr === -1) dir = 'UP'
            else if (dr === 1) dir = 'DOWN'
            else if (dc === -1) dir = 'LEFT'

            grid[r][c] = { type: 'gate', allowedDir: dir }
          }
        }
      })
    }

    // Dynamic pre-trace & classification of arrow routes
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r][c]
        if (cell && cell.type === 'arrow') {
          const route = traceArrowRoute(r, c, cell.dir, grid)
          const { pieceType, dir } = classifyPath(route)
          cell.path = route
          cell.pieceType = pieceType
          cell.dir = dir
        }
      }
    }

    const boardState = { grid, portals, pressureNodes }
    if (arrowsPlaced >= Math.floor(size * size * 0.3) && validateBoardStateSolvable(boardState)) {
      return boardState
    }
  }

  return getFallbackBoard(size)
}

const levelCounts = {
  easy: 45,
  medium: 50,
  hard: 55,
  expert: 60,
  'super-hard': 65,
}

export default function ArrowPuzzleGame() {
  const { user, submitGameResult } = useGameSession()

  // Game setup & navigation
  const [gameState, setGameState] = useState<GameState>('setup')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [level, setLevel] = useState<number>(1)
  const [activeLevelSelectDiff, setActiveLevelSelectDiff] = useState<Difficulty | null>(null)
  const [goldTime, setGoldTime] = useState<number>(30)
  const [silverTime, setSilverTime] = useState<number>(50)
  const [bronzeTime, setBronzeTime] = useState<number>(85)

  // Level preview (shown before timer starts)
  const [showPreview, setShowPreview] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)

  // Progression progress
  const [unlockedModes, setUnlockedModes] = useState<Record<Difficulty, boolean>>({
    easy: true,
    medium: false,
    hard: false,
    expert: false,
    'super-hard': false,
  })
  const [completedLevels, setCompletedLevels] = useState<Record<Difficulty, number[]>>({
    easy: [],
    medium: [],
    hard: [],
    expert: [],
    'super-hard': [],
  })

  // Gameplay Grid States
  const [grid, setGrid] = useState<Grid>([])
  const [portals, setPortals] = useState<PortalPair[]>([])
  const [pressureNodes, setPressureNodes] = useState<PressureNode[]>([])

  // Stats / Timers
  const [score, setScore] = useState(0)
  const [movesCount, setMovesCount] = useState(0)
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [initialArrowCount, setInitialArrowCount] = useState(0)
  const [lockedArrowCount, setLockedArrowCount] = useState(0)
  const [stars, setStars] = useState(1)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Hint Solver highlights
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintHighlight, setHintHighlight] = useState<{ r: number; c: number } | null>(null)
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null)

  // Ad simulation modal
  const [adModalOpen, setAdModalOpen] = useState(false)
  const [adCountdown, setAdCountdown] = useState(0)

  // Feedback effects
  const [shakeCell, setShakeCell] = useState<{ r: number; c: number } | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Load progress tied to user profile
  const progressKey = user ? `gamehub_arrow_progress_${user.id}` : 'gamehub_arrow_progress_guest'
  const analyticsKey = 'gamehub_arrow_analytics'

  // Load saved progression
  useEffect(() => {
    const saved = localStorage.getItem(progressKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.completedLevels) {
          setCompletedLevels(parsed.completedLevels)
          const easyWins = parsed.completedLevels.easy?.length || 0
          const medWins = parsed.completedLevels.medium?.length || 0
          const hardWins = parsed.completedLevels.hard?.length || 0
          const expWins = parsed.completedLevels.expert?.length || 0

          setUnlockedModes({
            easy: true,
            medium: easyWins >= 2 || easyWins >= levelCounts.easy,
            hard: easyWins >= 2 || medWins >= levelCounts.medium,
            expert: easyWins >= 2 || hardWins >= levelCounts.hard,
            'super-hard': easyWins >= 2 || expWins >= levelCounts.expert,
          })
        }
      } catch (err) {
        console.error('Failed to parse progression storage:', err)
      }
    } else {
      setUnlockedModes({
        easy: true,
        medium: false,
        hard: false,
        expert: false,
        'super-hard': false,
      })
      setCompletedLevels({
        easy: [],
        medium: [],
        hard: [],
        expert: [],
        'super-hard': [],
      })
    }
  }, [progressKey, gameState])

  // Start playing level
  const startPlaying = (diff: Difficulty, lvl: number) => {
    setDifficulty(diff)
    setLevel(lvl)
    setHasSubmitted(false)

    const savedAnalytics = JSON.parse(localStorage.getItem(analyticsKey) || '{}')
    const key = `${diff}-${lvl}`
    if (!savedAnalytics[key]) {
      savedAnalytics[key] = { attempts: 0, completions: 0, totalTime: 0, hintsUsed: 0, restarts: 0, abandoned: 0 }
    }
    savedAnalytics[key].attempts += 1
    localStorage.setItem(analyticsKey, JSON.stringify(savedAnalytics))

    const board = generateSeededLevel(diff, lvl)
    setGrid(board.grid)
    setPortals(board.portals)
    setPressureNodes(board.pressureNodes)

    let arrows = 0
    let locked = 0
    for (let r = 0; r < board.grid.length; r++) {
      for (let c = 0; c < board.grid[0].length; c++) {
        const cell = board.grid[r][c]
        if (cell && cell.type === 'arrow') {
          arrows++
          if (cell.isLocked) locked++
        }
      }
    }

    setInitialArrowCount(arrows)
    setLockedArrowCount(locked)
    setMovesCount(0)
    setTimeElapsed(0)
    setScore(0)
    setHintsUsed(0)
    setHintHighlight(null)

    // Calculate dynamic targets based on arrow count
    const gold = Math.max(12, Math.round(arrows * 4.5 + 8))
    const silver = Math.round(gold * 1.7)
    const bronze = Math.round(silver * 1.5)
    setGoldTime(gold)
    setSilverTime(silver)
    setBronzeTime(bronze)
    setStars(1)

    // Show preview before starting timer
    setTimerRunning(false)
    setShowPreview(true)
    setGameState('playing')
  }

  // Timer runner - only runs when timerRunning is true
  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  // Monitor grid state for win/loss conditions
  useEffect(() => {
    if (gameState !== 'playing' || grid.length === 0) return

    let remaining = 0
    grid.forEach(row => {
      row.forEach(col => {
        if (col && col.type === 'arrow') remaining++
      })
    })

    if (remaining === 0) {
      triggerVictory()
    } else {
      // Check if any removable arrows remain
      let movesExist = false
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          const cell = grid[r][c]
          if (cell && cell.type === 'arrow') {
            if (isPathClearOnBoard(r, c, cell, grid, portals, pressureNodes)) {
              movesExist = true
              break
            }
          }
        }
        if (movesExist) break
      }

      if (!movesExist) {
        triggerGameOverLoss()
      }
    }
  }, [grid, gameState])

  // Listen to gamehub replay/next events
  useEffect(() => {
    const handleReplay = () => {
      startPlaying(difficulty, level)
    }
    const handleNextLevel = () => {
      const nextLvl = level < levelCounts[difficulty] ? level + 1 : level
      setLevel(nextLvl)
      startPlaying(difficulty, nextLvl)
    }

    window.addEventListener('gamehub_replay', handleReplay)
    window.addEventListener('gamehub_next_level', handleNextLevel)
    return () => {
      window.removeEventListener('gamehub_replay', handleReplay)
      window.removeEventListener('gamehub_next_level', handleNextLevel)
    }
  }, [difficulty, level])

  const getRemainingArrowCount = (): number => {
    let count = 0
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell && cell.type === 'arrow') count++
      })
    })
    return count
  }

  // Handle cell clicks
  const handleCellClick = (r: number, c: number) => {
    if (gameState !== 'playing') return

    const cell = grid[r][c]
    if (!cell || cell.type !== 'arrow' || cell.isClearing) return

    setMovesCount(prev => prev + 1)
    setHintHighlight(null)

    if (!isPathClearOnBoard(r, c, cell, grid, portals, pressureNodes)) {
      setShakeCell({ r, c })
      setTimeout(() => setShakeCell(null), 400)
      return
    }

    if (cell.isLocked) {
      setGrid(prev =>
        prev.map((row, idxR) =>
          row.map((col, idxC) => (idxR === r && idxC === c && col && col.type === 'arrow' ? { ...col, isLocked: false } : col))
        )
      )
      setScore(prev => prev + 50)
      return
    }

    if (cell.multiStageCount > 1) {
      setGrid(prev =>
        prev.map((row, idxR) =>
          row.map((col, idxC) => (idxR === r && idxC === c && col && col.type === 'arrow' ? { ...col, multiStageCount: col.multiStageCount - 1 } : col))
        )
      )
      setScore(prev => prev + 50)
      return
    }

    // Clear arrow & fly animation
    setGrid(prev =>
      prev.map((row, idxR) =>
        row.map((col, idxC) => (idxR === r && idxC === c && col && col.type === 'arrow' ? { ...col, isClearing: true } : col))
      )
    )
    setScore(prev => prev + 100)

    setTimeout(() => {
      setGrid(currentGrid => {
        const updated = currentGrid.map((row, idxR) =>
          row.map((col, idxC) => (idxR === r && idxC === c ? null : col))
        )

        if (cell.isKey) {
          for (let ri = 0; ri < updated.length; ri++) {
            for (let ci = 0; ci < updated[0].length; ci++) {
              const other = updated[ri][ci]
              if (other && other.type === 'arrow' && other.isLocked) {
                updated[ri][ci] = { ...other, isLocked: false }
              }
            }
          }
        }

        pressureNodes.forEach(pn => {
          if (pn.triggerArrowId === cell.id) {
            pn.isBlocked = false
            updated[pn.r][pn.c] = null
          }
        })

        if (cell.isChainRelease) {
          const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]]
          deltas.forEach(([dr, dc]) => {
            const nr = r + dr
            const nc = c + dc
            if (nr >= 0 && nr < updated.length && nc >= 0 && nc < updated[0].length) {
              const adj = updated[nr][nc]
              if (adj && adj.type === 'arrow' && !adj.isLocked && !adj.isClearing) {
                setTimeout(() => handleCellClick(nr, nc), 100)
              }
            }
          })
        }

        return updated
      })
    }, 300)
  }

  // Win Level
  const triggerVictory = () => {
    if (hasSubmitted) return
    setHasSubmitted(true)
    setGameState('gameover')

    const baseScore = initialArrowCount * 100 + lockedArrowCount * 50
    const perfectMoves = initialArrowCount + lockedArrowCount
    const movesScore = Math.max(0, 1000 - (movesCount - perfectMoves) * 35)
    const generousTimeLimit = initialArrowCount * 12
    const timeScore = Math.max(0, (generousTimeLimit - timeElapsed) * 15)

    const finalScore = baseScore + movesScore + timeScore
    setScore(finalScore)

    let finalStars = 1
    if (timeElapsed <= goldTime) {
      finalStars = 3
    } else if (timeElapsed <= silverTime) {
      finalStars = 2
    }
    setStars(finalStars)

    const nextCompleted = { ...completedLevels }
    if (!nextCompleted[difficulty].includes(level)) {
      nextCompleted[difficulty].push(level)
    }

    localStorage.setItem(
      progressKey,
      JSON.stringify({
        completedLevels: nextCompleted,
      })
    )
    setCompletedLevels(nextCompleted)

    const savedAnalytics = JSON.parse(localStorage.getItem(analyticsKey) || '{}')
    const key = `${difficulty}-${level}`
    if (savedAnalytics[key]) {
      savedAnalytics[key].completions += 1
      savedAnalytics[key].totalTime += timeElapsed
      savedAnalytics[key].hintsUsed += hintsUsed
    }
    localStorage.setItem(analyticsKey, JSON.stringify(savedAnalytics))

    submitGameResult({
      gameSlug: 'arrow-puzzle',
      result: 'win',
      metadata: {
        score: finalScore,
        gameMetadata: {
          difficulty,
          level,
          moves: movesCount,
          timeSecs: timeElapsed,
          stars: finalStars,
          goldTime,
          silverTime,
        },
      },
    })
  }

  // Lose Level
  const triggerGameOverLoss = () => {
    if (hasSubmitted) return
    setHasSubmitted(true)
    setGameState('gameover')
    setStars(0)

    const savedAnalytics = JSON.parse(localStorage.getItem(analyticsKey) || '{}')
    const key = `${difficulty}-${level}`
    if (savedAnalytics[key]) {
      savedAnalytics[key].abandoned += 1
    }
    localStorage.setItem(analyticsKey, JSON.stringify(savedAnalytics))

    submitGameResult({
      gameSlug: 'arrow-puzzle',
      result: 'loss',
      metadata: {
        score: Math.max(10, score),
        gameMetadata: {
          difficulty,
          level,
          moves: movesCount,
          timeSecs: timeElapsed,
          stars: 0,
        },
      },
    })
  }

  const handleRestart = () => {
    const savedAnalytics = JSON.parse(localStorage.getItem(analyticsKey) || '{}')
    const key = `${difficulty}-${level}`
    if (savedAnalytics[key]) {
      savedAnalytics[key].restarts += 1
    }
    localStorage.setItem(analyticsKey, JSON.stringify(savedAnalytics))

    startPlaying(difficulty, level)
  }

  const handleHintClick = () => {
    if (gameState !== 'playing') return

    const validMoves: { r: number; c: number }[] = []
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        const cell = grid[r][c]
        if (cell && cell.type === 'arrow') {
          if (isPathClearOnBoard(r, c, cell, grid, portals, pressureNodes)) {
            validMoves.push({ r, c })
          }
        }
      }
    }

    if (validMoves.length === 0) return

    const selectedMove = validMoves[0]

    if (hintsUsed === 0) {
      setHintsUsed(1)
      setHintHighlight(selectedMove)
    } else {
      setAdCountdown(4)
      setAdModalOpen(true)
    }
  }

  useEffect(() => {
    if (!adModalOpen || adCountdown <= 0) return
    const timer = setTimeout(() => {
      setAdCountdown(prev => prev - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [adModalOpen, adCountdown])

  const claimRewardedHint = () => {
    setAdModalOpen(false)
    setHintsUsed(prev => prev + 1)
    const validMoves: { r: number; c: number }[] = []
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        const cell = grid[r][c]
        if (cell && cell.type === 'arrow') {
          if (isPathClearOnBoard(r, c, cell, grid, portals, pressureNodes)) {
            validMoves.push({ r, c })
          }
        }
      }
    }
    if (validMoves.length > 0) {
      setHintHighlight(validMoves[0])
    }
  }

  const handleExit = () => {
    if (gameState === 'playing') {
      const savedAnalytics = JSON.parse(localStorage.getItem(analyticsKey) || '{}')
      const key = `${difficulty}-${level}`
      if (savedAnalytics[key]) {
        savedAnalytics[key].abandoned += 1
      }
      localStorage.setItem(analyticsKey, JSON.stringify(savedAnalytics))
    }
    setGameState('setup')
  }

  const size = grid.length

  const isFullUnlocked = (diff: Difficulty): boolean => {
    if (diff === 'easy') return true
    const easyWins = completedLevels.easy?.length || 0
    const medWins = completedLevels.medium?.length || 0
    const hardWins = completedLevels.hard?.length || 0
    const expWins = completedLevels.expert?.length || 0

    if (diff === 'medium') return easyWins >= levelCounts.easy
    if (diff === 'hard') return medWins >= levelCounts.medium
    if (diff === 'expert') return hardWins >= levelCounts.hard
    if (diff === 'super-hard') return expWins >= levelCounts.expert
    return false
  }

  // Draw turn piece SVG icon inside transparent buttons
  const renderPieceIcon = (type: PieceType, color: string) => {
    const svgProps = {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: color,
      strokeWidth: '2.8',
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      style: { width: '80%', height: '80%', filter: `drop-shadow(0 0 3px ${color} / 0.4)` }
    }

    switch (type) {
      case 'LEFT_RIGHT':
        return (
          <svg {...svgProps}>
            <line x1="2" y1="12" x2="22" y2="12" />
            <polyline points="15 5 22 12 15 19" />
          </svg>
        )
      case 'RIGHT_LEFT':
        return (
          <svg {...svgProps}>
            <line x1="22" y1="12" x2="2" y2="12" />
            <polyline points="9 5 2 12 9 19" />
          </svg>
        )
      case 'UP_DOWN':
        return (
          <svg {...svgProps}>
            <line x1="12" y1="2" x2="12" y2="22" />
            <polyline points="5 15 12 22 5 19" style={{ transform: 'none' }} />
            <path d="M 5 15 L 12 22 L 19 15" />
          </svg>
        )
      case 'DOWN_UP':
        return (
          <svg {...svgProps}>
            <line x1="12" y1="22" x2="12" y2="2" />
            <path d="M 5 9 L 12 2 L 19 9" />
          </svg>
        )
      case 'CORNER_UR':
        return (
          <svg {...svgProps}>
            <path d="M 12 22 L 12 12 A 10 10 0 0 1 22 12" />
            <polyline points="16 5 22 12 16 19" />
          </svg>
        )
      case 'CORNER_DR':
        return (
          <svg {...svgProps}>
            <path d="M 12 2 L 12 12 A 10 10 0 0 0 22 12" />
            <polyline points="16 5 22 12 16 19" />
          </svg>
        )
      case 'CORNER_DL':
        return (
          <svg {...svgProps}>
            <path d="M 12 2 L 12 12 A 10 10 0 0 1 2 12" />
            <polyline points="8 5 2 12 8 19" />
          </svg>
        )
      case 'CORNER_UL':
        return (
          <svg {...svgProps}>
            <path d="M 12 22 L 12 12 A 10 10 0 0 0 2 12" />
            <polyline points="8 5 2 12 8 19" />
          </svg>
        )
      case 'UTURN_LEFT':
        return (
          <svg {...svgProps}>
            <path d="M 22 7 L 11 7 A 5 5 0 0 0 11 17 L 22 17" />
            <polyline points="16 12 22 17 16 22" />
          </svg>
        )
      case 'UTURN_RIGHT':
        return (
          <svg {...svgProps}>
            <path d="M 2 7 L 13 7 A 5 5 0 0 1 13 17 L 2 17" />
            <polyline points="8 12 2 17 8 22" />
          </svg>
        )
      case 'ZIGZAG_H':
        return (
          <svg {...svgProps}>
            <path d="M 2 7 L 10 7 C 12 7, 12 17, 14 17 L 22 17" />
            <polyline points="16 12 22 17 16 22" />
          </svg>
        )
      case 'ZIGZAG_V':
        return (
          <svg {...svgProps}>
            <path d="M 7 2 L 7 10 C 7 12, 17 12, 17 14 L 17 22" />
            <polyline points="12 17 17 22 22 17" />
          </svg>
        )
      case 'SPIRAL':
        return (
          <svg {...svgProps}>
            <path d="M 12 2 C 18 2, 18 10, 12 10 C 8 10, 8 16, 12 16 C 18 16, 18 22, 12 22" />
            <polyline points="7 17 12 22 17 17" />
          </svg>
        )
      case 'NESTED':
        return (
          <svg {...svgProps}>
            <path d="M 2 17 L 8 17 A 5 5 0 0 1 13 12 A 5 5 0 0 0 18 7 L 22 7" />
            <polyline points="16 2 22 7 16 12" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0.5rem',
      }}
      className="animate-fadeIn"
      id="arrow-puzzle-root"
    >
      {gameState === 'setup' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(222 18% 12% / 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          id="arrow-puzzle-setup"
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><ArrowRightIcon size={48} className="text-blue-400" /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>Arrow Puzzle</h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
              Clear the board by releasing arrows along their neon tracks. Connect, unlock, and plan your exit paths!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em' }}>
              Select Mode
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {(['easy', 'medium', 'hard', 'expert', 'super-hard'] as Difficulty[]).map(diff => {
                const colors = {
                  easy: 'hsl(142 70% 45%)',
                  medium: 'hsl(220 100% 60%)',
                  hard: 'hsl(270 80% 60%)',
                  expert: 'hsl(38 95% 55%)',
                  'super-hard': 'hsl(0 80% 55%)',
                }[diff]

                const isUnlocked = unlockedModes[diff]
                const maxLevel = levelCounts[diff]
                const wins = completedLevels[diff]?.length || 0

                return (
                  <div
                    key={diff}
                    className="card"
                    style={{
                      background: 'hsl(222 18% 14%)',
                      border: '1px solid',
                      borderColor: isUnlocked ? 'hsl(220 15% 18%)' : 'hsl(220 15% 15%)',
                      borderRadius: 14,
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isUnlocked ? 1 : 0.45,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: colors, textTransform: 'capitalize' }}>
                        {diff.replace('-', ' ')} Mode
                      </span>
                      <div style={{ fontSize: '0.68rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                        Progress: {wins} / {maxLevel} Completed
                      </div>
                    </div>
                    {isUnlocked ? (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          onClick={() => {
                            const isFullUnl = isFullUnlocked(diff)
                            const playableLvl = isFullUnl ? Math.min(maxLevel, wins + 1) : 1
                            startPlaying(diff, playableLvl)
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ borderRadius: 8 }}
                          id={`play-${diff}`}
                        >
                          🚀 Play
                        </button>
                        <button
                          onClick={() => setActiveLevelSelectDiff(diff)}
                          className="btn btn-secondary btn-sm"
                          style={{ borderRadius: 8, padding: '0.3rem 0.5rem' }}
                          id={`levels-${diff}`}
                        >
                          🌐 Levels
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}><LockIcon size={14} className="text-red-500" /> <span>Locked</span></span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
              Easy Progression (1 - 45)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }} id="easy-progression">
              {Array.from({ length: 9 }).map((_, idx) => {
                const lvlNum = idx + 1
                const isCompleted = completedLevels.easy.includes(lvlNum)
                const isPlayable = lvlNum <= completedLevels.easy.length + 1
                return (
                  <button
                    key={`easy-lvl-${lvlNum}`}
                    disabled={!isPlayable}
                    onClick={() => startPlaying('easy', lvlNum)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isCompleted
                        ? 'hsl(142 70% 45% / 0.4)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.3)'
                        : 'hsl(220 15% 15%)',
                      background: isCompleted
                        ? 'hsl(142 70% 45% / 0.12)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.05)'
                        : 'hsl(222 18% 14%)',
                      color: isCompleted
                        ? 'hsl(142 70% 55%)'
                        : isPlayable
                        ? 'hsl(220 10% 80%)'
                        : 'hsl(220 10% 40%)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: isPlayable ? 'pointer' : 'not-allowed',
                    }}
                    id={`easy-btn-${lvlNum}`}
                  >
                    {lvlNum}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%',
            position: 'relative',
          }}
          id="arrow-puzzle-board"
        >
          {/* Level Preview Overlay */}
          {showPreview && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(10,12,20,0.92)',
                backdropFilter: 'blur(8px)',
                borderRadius: 24,
              }}
              id="level-preview-overlay"
            >
              <div
                style={{
                  background: 'hsl(222 18% 13%)',
                  border: '1px solid hsl(220 15% 22%)',
                  borderRadius: 20,
                  padding: '2rem 1.75rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  maxWidth: 320,
                  width: '90%',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}><ArrowRightIcon size={36} className="text-blue-400" /></div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'white', margin: 0 }}>Arrow Puzzle</h3>
                  <p style={{ fontSize: '0.78rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem' }}>
                    {difficulty.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} · Level {level}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em' }}>Time Targets</div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(45 100% 55%)' }} /></div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(45 100% 60%)' }}>≤ {goldTime}s</div>
                      <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)' }}>Gold</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(220 10% 75%)' }} /></div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(220 10% 75%)' }}>≤ {silverTime}s</div>
                      <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)' }}>Silver</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(35 60% 50%)' }} /></div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(28 80% 60%)' }}>≤ {bronzeTime}s</div>
                      <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)' }}>Bronze</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { setShowPreview(false); setTimerRunning(true) }}
                  className="btn btn-primary"
                  style={{ borderRadius: 14, fontSize: '1rem', fontWeight: 800, padding: '0.75rem' }}
                  id="preview-play-btn"
                >
                  ▶ Play Level
                </button>
              </div>
            </div>
          )}
          {/* Header Stats Bar */}
          <GameHUD
            id="arrow-header-hud"
            style={{
              padding: '0.6rem 0.85rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Difficulty</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', textTransform: 'capitalize' }}>
                {difficulty.replace('-', ' ')} (Lvl {level})
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Targets</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(45 100% 55%)' }}>
                  <span>Gold: {goldTime}s · Silver: {silverTime}s · Bronze: {bronzeTime}s</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Moves</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white' }} id="arrow-moves">{movesCount}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Time</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'hsl(38 95% 55%)' }}>
                  {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Left</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }} id="arrow-left-count">{getRemainingArrowCount()}</span>
              </div>
            </div>
          </GameHUD>

          {/* Redesigned Dark Board, No Cell Grids */}
          <div
            style={{
              position: 'relative',
              borderRadius: 24,
              width: '100%',
              aspectRatio: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              background: 'hsl(222 20% 8%)',
              border: '1px solid hsl(220 15% 15%)',
            }}
            id="route-puzzle-container"
          >
            {/* SVG Interactive Corridors Overlay */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
              }}
              viewBox="0 0 100 100"
              id="svg-tracks-layer"
            >
              <defs>
                <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="currentColor" />
                </marker>
                <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Subtle tech node dots in the background to show path coordinate alignment */}
              {Array.from({ length: size }).map((_, r) =>
                Array.from({ length: size }).map((_, c) => (
                  <circle
                    key={`node-dot-${r}-${c}`}
                    cx={((c + 0.5) * 100) / size}
                    cy={((r + 0.5) * 100) / size}
                    r={0.6}
                    fill="hsl(220 15% 15%)"
                  />
                ))
              )}

              {/* Render corridors for active arrows */}
              {grid.flatMap((row, rIdx) =>
                row.map((cell, cIdx) => {
                  if (!cell || cell.type !== 'arrow' || !cell.path || cell.path.length === 0) return null

                  // Generate curved path
                  const d = getBezierPath(cell.path, size)

                  const isClear = isPathClearOnBoard(rIdx, cIdx, cell, grid, portals, pressureNodes)
                  const isHovered = hoverCell?.r === rIdx && hoverCell?.c === cIdx

                  let color = 'hsl(220 10% 28%)'
                  let opacity = 0.25
                  let glow = 'none'

                  if (cell.isLocked) {
                    color = 'hsl(45 100% 60%)'
                    opacity = 0.45
                  } else if (cell.isKey) {
                    color = 'hsl(220 100% 65%)'
                    opacity = 0.55
                  } else if (isClear) {
                    color = 'hsl(142 70% 55%)'
                    opacity = isHovered ? 0.95 : 0.75
                    glow = 'url(#neon-glow)'
                  }

                  if (isHovered && !isClear) {
                    color = 'hsl(0 80% 60%)'
                    opacity = 0.8
                    glow = 'url(#neon-glow)'
                  }

                  // Scale tube widths relative to grid size so they always fit beautifully
                  const caseWidth = 100 / size * 0.32
                  const neonWidth = 100 / size * 0.16
                  const coreWidth = 100 / size * 0.05

                  return (
                    <g key={`corridor-group-${cell.id}`} style={{ transition: 'all 0.25s ease' }}>
                      {/* 1. Outer Dark Corridor Tube Casing */}
                      <path
                        d={d}
                        fill="none"
                        stroke="hsl(222 20% 6%)"
                        strokeWidth={caseWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.9 }}
                      />
                      {/* 2. Neon glow tube */}
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={neonWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          opacity: opacity * 0.4,
                          filter: 'blur(3px)',
                          transition: 'stroke 0.25s, opacity 0.25s',
                        }}
                      />
                      {/* 3. Inner Glowing Core Route Wire */}
                      <path
                        d={d}
                        fill="none"
                        stroke={color}
                        strokeWidth={coreWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd="url(#arrowhead)"
                        style={{
                          opacity,
                          color,
                          filter: glow,
                          transition: 'stroke 0.25s, opacity 0.25s, filter 0.25s',
                        }}
                      />
                      {/* 4. Animated flow dashes for clearable paths */}
                      {isClear && (
                        <path
                          d={d}
                          fill="none"
                          stroke={color}
                          strokeWidth={coreWidth * 0.7}
                          strokeLinecap="round"
                          strokeDasharray={`${4 / size} ${8 / size}`}
                          style={{
                            opacity: 0.65,
                            animation: 'arrow-flow-dash 1.2s linear infinite',
                          }}
                        />
                      )}
                      {/* 5. Interactive Transparent Hit Area (Wide for easy tapping) */}
                      <path
                        d={d}
                        fill="none"
                        stroke="rgba(255,255,255,0.01)"
                        strokeWidth={100 / size * 0.75}
                        pointerEvents="visibleStroke"
                        cursor="pointer"
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        onMouseEnter={() => setHoverCell({ r: rIdx, c: cIdx })}
                        onMouseLeave={() => setHoverCell(null)}
                      />
                    </g>
                  )
                })
              )}
            </svg>

            {/* Absolute Overlay Layer for blockades, gates, portals and floating start buttons */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
              {grid.flatMap((row, rIdx) =>
                row.map((cell, cIdx) => {
                  if (!cell) return null

                  const isShaking = shakeCell?.r === rIdx && shakeCell?.c === cIdx
                  const isHinted = hintHighlight?.r === rIdx && hintHighlight?.c === cIdx
                  const isHovered = hoverCell?.r === rIdx && hoverCell?.c === cIdx

                  // Grid cell styling positioning
                  const stylePos: React.CSSProperties = {
                    position: 'absolute',
                    top: `${(rIdx / size) * 100}%`,
                    left: `${(cIdx / size) * 100}%`,
                    width: `${(1 / size) * 100}%`,
                    height: `${(1 / size) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'auto',
                  }

                  if (cell.type === 'blocker') {
                    const isPressure = pressureNodes.some(p => p.r === rIdx && p.c === cIdx)
                    return (
                      <div key={`blocker-${rIdx}-${cIdx}`} style={stylePos}>
                        <div
                          style={{
                            width: '45%',
                            height: '45%',
                            background: isPressure
                              ? 'repeating-linear-gradient(45deg, hsl(38 95% 40%), hsl(38 95% 40%) 4px, hsl(38 95% 50%) 4px, hsl(38 95% 50%) 8px)'
                              : 'repeating-linear-gradient(45deg, hsl(220 15% 15%), hsl(220 15% 15%) 4px, hsl(220 15% 20%) 4px, hsl(220 15% 20%) 8px)',
                            border: '1px solid',
                            borderColor: isPressure ? 'hsl(38 95% 55% / 0.4)' : 'hsl(220 15% 25%)',
                            borderRadius: 6,
                            boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                          }}
                          title={isPressure ? 'Pressure Blocker Node' : 'Blocker Node'}
                        />
                      </div>
                    )
                  }

                  if (cell.type === 'gate') {
                    const rot = { UP: '0deg', RIGHT: '90deg', DOWN: '180deg', LEFT: '270deg' }[cell.allowedDir]
                    return (
                      <div key={`gate-${rIdx}-${cIdx}`} style={stylePos}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          style={{ width: '40%', height: '40%', transform: `rotate(${rot})`, color: 'hsl(270 80% 60% / 0.45)', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                        >
                          <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )
                  }

                  if (cell.type === 'modifier') {
                    const rot = { UP: '0deg', RIGHT: '90deg', DOWN: '180deg', LEFT: '270deg' }[cell.newDir]
                    return (
                      <div key={`modifier-${rIdx}-${cIdx}`} style={stylePos}>
                        <div
                          style={{
                            width: '50%',
                            height: '50%',
                            borderRadius: '50%',
                            background: 'hsl(38 95% 55% / 0.12)',
                            border: '1.5px dashed hsl(38 95% 55%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'hsl(38 95% 55%)',
                          }}
                          title={`Direction Modifier to ${cell.newDir}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            style={{ width: '60%', height: '60%', transform: `rotate(${rot})` }}
                          >
                            <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    )
                  }

                  if (cell.type === 'portal') {
                    return (
                      <div key={`portal-${rIdx}-${cIdx}`} style={stylePos}>
                        <div
                          style={{
                            width: '50%',
                            height: '50%',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, hsl(38 95% 55%), hsl(270 80% 55%))',
                            boxShadow: '0 0 8px hsl(38 95% 55% / 0.5)',
                            animation: 'spin-slow 5s linear infinite',
                          }}
                        />
                      </div>
                    )
                  }

                  if (cell.type === 'arrow') {
                    let transformFlight = 'none'
                    if (cell.isClearing) {
                      const travelDist = '600px'
                      transformFlight = {
                        UP: `translateY(-${travelDist}) scale(0.1)`,
                        DOWN: `translateY(${travelDist}) scale(0.1)`,
                        LEFT: `translateX(-${travelDist}) scale(0.1)`,
                        RIGHT: `translateX(${travelDist}) scale(0.1)`,
                      }[cell.dir]
                    }

                    const clearPath = isPathClearOnBoard(rIdx, cIdx, cell, grid, portals, pressureNodes)

                    const pieceColor = cell.isLocked
                      ? 'hsl(45 100% 60%)'
                      : cell.isKey
                      ? 'hsl(220 100% 65%)'
                      : clearPath
                      ? 'hsl(142 70% 55%)'
                      : 'hsl(220 10% 40%)'

                    // Glowing neon shadow when clean/clearing
                    const neonShadow = clearPath
                      ? `0 0 15px ${pieceColor}bb, inset 0 0 8px ${pieceColor}88`
                      : isHovered
                      ? `0 0 12px hsl(0 80% 60% / 0.8), inset 0 0 6px hsl(0 80% 60% / 0.5)`
                      : 'none'

                    return (
                      <button
                        key={cell.id}
                        onClick={() => handleCellClick(rIdx, cIdx)}
                        onMouseEnter={() => setHoverCell({ r: rIdx, c: cIdx })}
                        onMouseLeave={() => setHoverCell(null)}
                        style={{
                          ...stylePos,
                          background: isHovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                          border: isHinted ? '2px solid hsl(142 70% 55%)' : `1.5px solid ${pieceColor}`,
                          borderRadius: '50%',
                          outline: 'none',
                          boxShadow: isHinted ? '0 0 20px hsl(142 70% 55%), inset 0 0 10px hsl(142 70% 55%)' : neonShadow,
                          transition: cell.isClearing ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.35s' : 'all 0.2s ease',
                          transform: isShaking
                            ? 'translateX(0px)'
                            : cell.isClearing
                            ? transformFlight
                            : isHovered
                            ? 'scale(1.15)'
                            : 'none',
                          opacity: cell.isClearing ? 0 : 1,
                          animation: isShaking ? 'shake 0.35s ease-in-out' : 'none',
                          boxSizing: 'border-box',
                          padding: 0,
                          width: `${(0.82 / size) * 100}%`,
                          height: `${(0.82 / size) * 100}%`,
                          margin: `${(0.09 / size) * 100}%`,
                        }}
                        id={`arrow-tile-${rIdx}-${cIdx}`}
                      >
                        {/* Render piece icon arrow vector inside start button */}
                        {renderPieceIcon(cell.pieceType, pieceColor)}

                        {/* Locked Padlock Badge */}
                        {cell.isLocked && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '8%',
                              right: '8%',
                              fontSize: size >= 7 ? '0.55rem' : '0.7rem',
                              background: 'hsl(222 20% 8%)',
                              borderRadius: '4px',
                              padding: '1px 2px',
                            }}
                          >
                            {cell.isKey ? <KeyIcon size={10} style={{ color: 'hsl(45 100% 55%)' }} /> : <LockIcon size={10} style={{ color: 'hsl(355 85% 55%)' }} />}
                          </div>
                        )}

                        {/* Multi stage releases dot count */}
                        {cell.multiStageCount > 1 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8%',
                              right: '8%',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'hsl(220 100% 65%)',
                            }}
                          />
                        )}

                        {/* Chain Release Indicator */}
                        {cell.isChainRelease && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '8%',
                              left: '8%',
                              fontSize: '0.55rem',
                            }}
                          >
                            <ZapIcon size={14} className="text-yellow-400" />
                          </div>
                        )}
                      </button>
                    )
                  }

                  return null
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleHintClick} className="btn btn-secondary" style={{ flex: 1.2, borderRadius: 12 }} id="hint-btn">
              <LightbulbIcon size={14} className="inline mr-1 text-yellow-400" /> Hint ({hintsUsed === 0 ? 'Free' : 'Ad'})
            </button>
            <button onClick={handleRestart} className="btn btn-secondary" style={{ flex: 1, borderRadius: 12 }} id="arrow-restart-btn">
              <HistoryIcon size={14} className="inline mr-1" /> Restart
            </button>
            <button onClick={handleExit} className="btn btn-ghost" style={{ flex: 1, borderRadius: 12 }} id="arrow-exit-gameplay-btn">
              <LogOutIcon size={14} className="inline mr-1" /> Exit
            </button>
          </div>
        </div>
      )}

      {/* Rewarded Ad popup simulation */}
      {adModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          id="sponsored-ad-popup"
        >
          <div
            className="card"
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              background: 'hsl(222 18% 12%)',
              maxWidth: 360,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 900, color: 'hsl(45 100% 65%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.25rem' }}>
                SPONSORED ADVERTISEMENT
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>Unlock Next Hint</h3>
            </div>

            <div
              style={{
                width: '100%',
                aspectRatio: 1.6,
                background: 'hsl(222 20% 8%)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid hsl(220 15% 18%)',
                color: 'hsl(220 10% 50%)',
                fontSize: '0.8rem',
              }}
            >
              📺 Playing Ad Video...
            </div>

            {adCountdown > 0 ? (
              <button
                disabled
                className="btn btn-secondary"
                style={{ width: '100%', borderRadius: 10, opacity: 0.5, cursor: 'not-allowed' }}
              >
                Claim reward in {adCountdown}s
              </button>
            ) : (
              <button
                onClick={claimRewardedHint}
                className="btn btn-gold"
                style={{ width: '100%', borderRadius: 10 }}
                id="claim-ad-reward-btn"
              >
                <GiftIcon size={14} className="inline mr-1 text-pink-400" /> Claim Extra Hint
              </button>
            )}
          </div>
        </div>
      )}

      {/* Level Selector Modal */}
      {activeLevelSelectDiff !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          id="level-selector-modal"
        >
          <div
            className="card animate-fadeIn"
            style={{
              padding: '1.5rem',
              background: 'hsl(222 18% 12%)',
              maxWidth: 420,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', textTransform: 'capitalize' }}>
                {activeLevelSelectDiff.replace('-', ' ')} Levels
              </h3>
              <button
                onClick={() => setActiveLevelSelectDiff(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(220 10% 60%)',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                }}
                id="close-level-selector"
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                padding: '0.5rem 0',
              }}
              id="level-grid-container"
            >
              {Array.from({ length: levelCounts[activeLevelSelectDiff] }).map((_, idx) => {
                const lvlNum = idx + 1
                const isCompleted = completedLevels[activeLevelSelectDiff]?.includes(lvlNum)
                const isFullUnl = isFullUnlocked(activeLevelSelectDiff)

                const winsCount = completedLevels[activeLevelSelectDiff]?.length || 0
                const isPlayable = activeLevelSelectDiff === 'easy'
                  ? lvlNum <= winsCount + 1
                  : (isFullUnl ? lvlNum <= winsCount + 1 : lvlNum === 1)

                return (
                  <button
                    key={`level-btn-${lvlNum}`}
                    disabled={!isPlayable}
                    onClick={() => {
                      setActiveLevelSelectDiff(null)
                      startPlaying(activeLevelSelectDiff, lvlNum)
                    }}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isCompleted
                        ? 'hsl(142 70% 45% / 0.4)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.3)'
                        : 'hsl(220 15% 16%)',
                      background: isCompleted
                        ? 'hsl(142 70% 45% / 0.12)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.05)'
                        : 'hsl(222 18% 14%)',
                      color: isCompleted
                        ? 'hsl(142 70% 55%)'
                        : isPlayable
                        ? 'hsl(220 10% 80%)'
                        : 'hsl(220 10% 40%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: isPlayable ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    id={`btn-select-level-${activeLevelSelectDiff}-${lvlNum}`}
                  >
                    {isPlayable ? lvlNum : <LockIcon size={12} className="mx-auto" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid styles injection */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-5.5px); }
          40%, 80% { transform: translateX(5.5px); }
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes arrow-flow-dash {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -24; }
        }

        .spin-slow {
          animation: spin-slow 8s linear infinite;
        }

        button:focus {
          outline: none !important;
        }
      `}</style>
    </div>
  )
}
