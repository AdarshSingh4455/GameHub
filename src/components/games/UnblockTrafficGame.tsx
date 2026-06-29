'use client'
import { CarIcon, FlaskIcon, LockIcon, TrophyIcon, LightbulbIcon, HistoryIcon, LogOutIcon, GiftIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import GameHUD from '@/components/layout/GameHUD'

type Orientation = 'h' | 'v'
type VehicleType = 'car' | 'suv' | 'truck' | 'van'

interface Vehicle {
  id: string
  row: number
  col: number
  size: number
  orientation: Orientation
  isTarget: boolean
  type: VehicleType
  color: string
  facing: 'right' | 'left' | 'up' | 'down'
  isLocked?: boolean
}

interface OneWayCell {
  row: number
  col: number
  direction: 'right' | 'left' | 'up' | 'down'
}

interface SwitchGateSystem {
  switchRow: number
  switchCol: number
  gateRow: number
  gateCol: number
}

interface KeyholeSystem {
  keyholeRow: number
  keyholeCol: number
}

interface LevelData {
  vehicles: Vehicle[]
  minMoves: number
  gridSize: number
  oneWayCells: OneWayCell[]
  switchGate: SwitchGateSystem | null
  keyhole: KeyholeSystem | null
}

type Difficulty = 'tutorial' | 'beginner' | 'intermediate' | 'advanced' | 'master'

// Harmonious HSL colors for vehicles
const VEHICLE_COLORS = [
  'hsl(215 90% 50%)',   // Blue
  'hsl(142 75% 40%)',   // Green
  'hsl(48 95% 48%)',    // Yellow
  'hsl(270 80% 55%)',   // Purple
  'hsl(28 95% 50%)',    // Orange
  'hsl(175 80% 40%)',   // Teal
  'hsl(330 85% 55%)',   // Pink
]

const TARGET_COLOR = 'hsl(0 85% 50%)' // Crimson Red for escape vehicle

// Seeded Random Number Generator
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getSeededRandom(seedStr: string) {
  let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 50249325
  for (let i = 0, k; i < seedStr.length; i++) {
    k = seedStr.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h4 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  return mulberry32((h1 ^ h2 ^ h3 ^ h4) >>> 0)
}

// Directional and mechanics-aware collision validation
// Directional and mechanics-aware collision validation
function isValidState(
  vehicles: Vehicle[],
  gridSize: number,
  oneWayCells: OneWayCell[] = [],
  switchGate: SwitchGateSystem | null = null,
  keyhole: KeyholeSystem | null = null
): boolean {
  const occupied = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false))

  // Determine if switch is currently occupied
  let isSwitchPressed = false
  if (switchGate) {
    for (const v of vehicles) {
      for (let i = 0; i < v.size; i++) {
        const r = v.row + (v.orientation === 'v' ? i : 0)
        const c = v.col + (v.orientation === 'h' ? i : 0)
        if (r === switchGate.switchRow && c === switchGate.switchCol) {
          isSwitchPressed = true
          break
        }
      }
      if (isSwitchPressed) break
    }
  }

  for (const v of vehicles) {
    for (let i = 0; i < v.size; i++) {
      const r = v.row + (v.orientation === 'v' ? i : 0)
      const c = v.col + (v.orientation === 'h' ? i : 0)

      // Target vehicle can slide past exit borders
      if (v.isTarget) {
        const exitDir = v.facing
        if (exitDir === 'right') {
          if (r < 0 || r >= gridSize || c < 0 || c > gridSize) return false
        } else if (exitDir === 'left') {
          if (r < 0 || r >= gridSize || c < -v.size || c >= gridSize) return false
        } else if (exitDir === 'down') {
          if (r < 0 || r > gridSize || c < 0 || c >= gridSize) return false
        } else if (exitDir === 'up') {
          if (r < -v.size || r >= gridSize || c < 0 || c >= gridSize) return false
        }
      } else {
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return false
      }

      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        if (occupied[r][c]) return false
        occupied[r][c] = true
      }

      // One-way arrows constraint check
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        const oneWay = oneWayCells.find(cell => cell.row === r && cell.col === c)
        if (oneWay && oneWay.direction !== v.facing) {
          return false
        }
      }

      // Gate cell blocker constraint check (solid obstacle if switch NOT pressed)
      if (switchGate && !isSwitchPressed && r === switchGate.gateRow && c === switchGate.gateCol) {
        return false
      }
    }
  }
  return true
}

// BFS Solver for Traffic escape layout
interface TrafficSolverMove {
  vehicleId: string
  newRow: number
  newCol: number
}

function solveTrafficPuzzle(
  vehicles: Vehicle[],
  gridSize: number,
  oneWayCells: OneWayCell[] = [],
  switchGate: SwitchGateSystem | null = null,
  keyhole: KeyholeSystem | null = null
): TrafficSolverMove[] | null {
  const queue: { state: Vehicle[]; path: TrafficSolverMove[] }[] = []
  const visited = new Set<string>()

  function hashState(state: Vehicle[]): string {
    return state.map(v => `${v.id}:${v.row},${v.col}`).join(';')
  }

  queue.push({ state: vehicles, path: [] })
  visited.add(hashState(vehicles))

  const maxIterations = 6000
  let iter = 0

  while (queue.length > 0 && iter < maxIterations) {
    iter++
    const curr = queue.shift()!
    const target = curr.state.find(v => v.isTarget)!
    const exitDir = target.facing

    let reachedExit = false
    if (exitDir === 'right') {
      reachedExit = target.col >= gridSize - 2
    } else if (exitDir === 'left') {
      reachedExit = target.col <= 0
    } else if (exitDir === 'down') {
      reachedExit = target.row >= gridSize - 2
    } else if (exitDir === 'up') {
      reachedExit = target.row <= 0
    }

    if (reachedExit) {
      return curr.path
    }

    // Target vehicle lock state check (requires key to reach keyhole)
    let isTargetUnlocked = true
    if (keyhole) {
      const keyCar = curr.state.find(v => v.id === 'key-vehicle')
      if (keyCar) {
        let keyReached = false
        for (let i = 0; i < keyCar.size; i++) {
          const r = keyCar.row + (keyCar.orientation === 'v' ? i : 0)
          const c = keyCar.col + (keyCar.orientation === 'h' ? i : 0)
          if (r === keyhole.keyholeRow && c === keyhole.keyholeCol) {
            keyReached = true
            break
          }
        }
        isTargetUnlocked = keyReached
      }
    }

    // Generate candidates from tapping each unlocked vehicle once
    for (const v of curr.state) {
      if (v.isLocked) continue
      if (v.isTarget && !isTargetUnlocked) continue

      const stepRow = v.facing === 'down' ? 1 : v.facing === 'up' ? -1 : 0
      const stepCol = v.facing === 'right' ? 1 : v.facing === 'left' ? -1 : 0

      if (stepRow === 0 && stepCol === 0) continue

      // Slide as far as possible in facing direction
      let currRow = v.row
      let currCol = v.col
      let steps = 0

      while (true) {
        const nextRow = currRow + stepRow
        const nextCol = currCol + stepCol

        if (v.orientation === 'h') {
          if (v.isTarget) {
            if (nextCol < -v.size || nextCol + v.size > gridSize + 1) break
          } else {
            if (nextCol < 0 || nextCol + v.size > gridSize) break
          }
        } else {
          if (v.isTarget) {
            if (nextRow < -v.size || nextRow + v.size > gridSize + 1) break
          } else {
            if (nextRow < 0 || nextRow + v.size > gridSize) break
          }
        }

        const candidateState = curr.state.map(item => {
          if (item.id === v.id) return { ...item, row: nextRow, col: nextCol }
          return item
        })

        if (isValidState(candidateState, gridSize, oneWayCells, switchGate, keyhole)) {
          currRow = nextRow
          currCol = nextCol
          steps++
        } else {
          break
        }
      }

      if (steps > 0) {
        const nextState = curr.state.map(item => {
          if (item.id === v.id) return { ...item, row: currRow, col: currCol }
          return item
        })

        const hash = hashState(nextState)
        if (!visited.has(hash)) {
          visited.add(hash)
          queue.push({
            state: nextState,
            path: [...curr.path, { vehicleId: v.id, newRow: currRow, newCol: currCol }],
          })
        }
      }
    }
  }

  return null
}

// Procedural Level Generator
function generateTrafficLevel(difficulty: Difficulty, levelNum: number): LevelData {
  const seed = `traffic-level-${difficulty}-${levelNum}`
  const rng = getSeededRandom(seed)

  // Configure grid sizes and progression mechanics based on tier ranges
  let gridSize = 6
  let oneWayCells: OneWayCell[] = []
  let switchGate: SwitchGateSystem | null = null
  let keyhole: KeyholeSystem | null = null

  if (levelNum > 40) {
    gridSize = 8
  } else if (levelNum > 20) {
    gridSize = 7
  }

  const targetRow = Math.floor(gridSize / 2) - (gridSize % 2 === 0 ? 1 : 0)
  const targetCol = Math.floor(gridSize / 2) - (gridSize % 2 === 0 ? 1 : 0)

  // Randomize exit direction based on seed
  // exitDir options: 'right', 'left', 'down', 'up'
  const exitDir = (['right', 'left', 'down', 'up'] as const)[(levelNum - 1) % 4]

  if (levelNum > 40) {
    // Keyhole system: position blocker on the exit path
    if (exitDir === 'right') {
      keyhole = { keyholeRow: targetRow, keyholeCol: gridSize - 2 }
    } else if (exitDir === 'left') {
      keyhole = { keyholeRow: targetRow, keyholeCol: 1 }
    } else if (exitDir === 'down') {
      keyhole = { keyholeRow: gridSize - 2, keyholeCol: targetCol }
    } else {
      keyhole = { keyholeRow: 1, keyholeCol: targetCol }
    }
  } else if (levelNum > 20) {
    if (levelNum > 30) {
      // Switch-gate system
      if (exitDir === 'right') {
        switchGate = {
          switchRow: 0,
          switchCol: gridSize - 1,
          gateRow: targetRow,
          gateCol: gridSize - 2,
        }
      } else if (exitDir === 'left') {
        switchGate = {
          switchRow: 0,
          switchCol: 0,
          gateRow: targetRow,
          gateCol: 1,
        }
      } else if (exitDir === 'down') {
        switchGate = {
          switchRow: gridSize - 1,
          switchCol: 0,
          gateRow: gridSize - 2,
          gateCol: targetCol,
        }
      } else {
        switchGate = {
          switchRow: 0,
          switchCol: 0,
          gateRow: 1,
          gateCol: targetCol,
        }
      }
    } else {
      // One-way cells: place dynamic arrows
      if (exitDir === 'right' || exitDir === 'left') {
        oneWayCells = [
          { row: 1, col: 2, direction: 'down' },
          { row: gridSize - 2, col: 3, direction: exitDir },
        ]
      } else {
        oneWayCells = [
          { row: 2, col: 1, direction: 'right' },
          { row: 3, col: gridSize - 2, direction: exitDir },
        ]
      }
    }
  }

  // targetVehicles formula (Level 1: 10, Level 50: 20)
  const targetVehicles = 10 + Math.round((levelNum - 1) * 2 / 10)

  let attempts = 0
  while (attempts < 300) {
    attempts++
    const list: Vehicle[] = []

    // Place Target Red Vehicle
    let tRow = targetRow
    let tCol = 0
    let tOrient: Orientation = 'h'
    let tFacing: 'right' | 'left' | 'up' | 'down' = 'right'

    if (exitDir === 'right') {
      tRow = targetRow
      tCol = 0
      tOrient = 'h'
      tFacing = 'right'
    } else if (exitDir === 'left') {
      tRow = targetRow
      tCol = gridSize - 2
      tOrient = 'h'
      tFacing = 'left'
    } else if (exitDir === 'down') {
      tRow = 0
      tCol = targetCol
      tOrient = 'v'
      tFacing = 'down'
    } else if (exitDir === 'up') {
      tRow = gridSize - 2
      tCol = targetCol
      tOrient = 'v'
      tFacing = 'up'
    }

    list.push({
      id: 'target',
      row: tRow,
      col: tCol,
      size: 2,
      orientation: tOrient,
      isTarget: true,
      type: 'car',
      color: TARGET_COLOR,
      facing: tFacing,
    })

    // Place Key Vehicle if keyhole level
    if (keyhole) {
      let kRow = targetRow === 3 ? 1 : 4
      let kCol = 0
      let kOrient: Orientation = 'h'
      let kFacing: 'right' | 'left' | 'up' | 'down' = 'right'

      if (exitDir === 'right' || exitDir === 'left') {
        kRow = targetRow === 3 ? 1 : 4
        kCol = 0
        kOrient = 'h'
        kFacing = 'right'
      } else {
        kRow = 0
        kCol = targetCol === 3 ? 1 : 4
        kOrient = 'v'
        kFacing = 'down'
      }

      list.push({
        id: 'key-vehicle',
        row: kRow,
        col: kCol,
        size: 2,
        orientation: kOrient,
        isTarget: false,
        type: 'car',
        color: 'hsl(48 95% 48%)', // Golden Key Vehicle
        facing: kFacing,
      })
    }

    // Fill layout with blocking traffic
    let placed = keyhole ? 2 : 1
    let fillAttempts = 0

    while (placed < targetVehicles && fillAttempts < 150) {
      fillAttempts++
      const size = rng() < 0.25 ? 3 : 2
      const orientation = rng() < 0.5 ? 'h' : 'v'
      const row = Math.floor(rng() * gridSize)
      const col = Math.floor(rng() * gridSize)

      // Prevent blocking the main exit lane/corridor directly at start
      if (exitDir === 'right' || exitDir === 'left') {
        if (orientation === 'h' && row === targetRow) continue
      } else {
        if (orientation === 'v' && col === targetCol) continue
      }

      if (switchGate) {
        if (row === switchGate.switchRow && col === switchGate.switchCol) continue
        if (row === switchGate.gateRow && col === switchGate.gateCol) continue
      }
      if (keyhole) {
        if (row === keyhole.keyholeRow && col === keyhole.keyholeCol) continue
      }

      const vehicleId = `v-${placed}-${attempts}`
      const type: VehicleType = size === 3 ? (rng() < 0.5 ? 'truck' : 'van') : (rng() < 0.5 ? 'car' : 'suv')
      const color = VEHICLE_COLORS[Math.floor(rng() * VEHICLE_COLORS.length)]

      let facing: 'right' | 'left' | 'up' | 'down' = 'right'
      if (orientation === 'h') {
        facing = rng() < 0.5 ? 'right' : 'left'
      } else {
        facing = rng() < 0.5 ? 'down' : 'up'
      }

      // Progression: Locked vehicle obstacles (Levels 11-20)
      const isLocked = levelNum > 10 && levelNum <= 20 && (placed === 2 || placed === 5)

      const candidate: Vehicle = {
        id: vehicleId,
        row,
        col,
        size,
        orientation,
        isTarget: false,
        type,
        color,
        facing,
        isLocked,
      }

      if (isValidState([...list, candidate], gridSize, oneWayCells, switchGate, keyhole)) {
        list.push(candidate)
        placed++
      }
    }

    // Verify Solvability & Min Moves
    const solution = solveTrafficPuzzle(list, gridSize, oneWayCells, switchGate, keyhole)
    if (solution && solution.length >= 3) {
      return {
        vehicles: list,
        minMoves: solution.length,
        gridSize,
        oneWayCells,
        switchGate,
        keyhole,
      }
    }
  }

  // Solvability fallback if search space gets too congested
  let fRow = targetRow
  let fCol = 0
  let fFacing: 'right' | 'left' | 'up' | 'down' = 'right'
  let fOrient: Orientation = 'h'

  if (exitDir === 'right') {
    fRow = targetRow; fCol = 0; fOrient = 'h'; fFacing = 'right'
  } else if (exitDir === 'left') {
    fRow = targetRow; fCol = gridSize - 2; fOrient = 'h'; fFacing = 'left'
  } else if (exitDir === 'down') {
    fRow = 0; fCol = targetCol; fOrient = 'v'; fFacing = 'down'
  } else {
    fRow = gridSize - 2; fCol = targetCol; fOrient = 'v'; fFacing = 'up'
  }

  const fallbackList: Vehicle[] = [
    { id: 'target', row: fRow, col: fCol, size: 2, orientation: fOrient, isTarget: true, type: 'car', color: TARGET_COLOR, facing: fFacing },
    {
      id: 'v-fallback',
      row: exitDir === 'right' || exitDir === 'left' ? (targetRow === 2 ? 0 : 1) : 2,
      col: exitDir === 'right' || exitDir === 'left' ? 2 : (targetCol === 2 ? 0 : 1),
      size: 2,
      orientation: exitDir === 'right' || exitDir === 'left' ? 'v' : 'h',
      isTarget: false,
      type: 'suv',
      color: VEHICLE_COLORS[0],
      facing: exitDir === 'right' || exitDir === 'left' ? 'down' : 'right'
    },
  ]
  return {
    vehicles: fallbackList,
    minMoves: 2,
    gridSize,
    oneWayCells: [],
    switchGate: null,
    keyhole: null,
  }
}


function getThemeConfig(levelNum: number, gridSize: number, targetRow: number, targetCol: number) {
  const themes = ['beach', 'mall', 'stadium', 'airport', 'downtown', 'neon']
  const activeTheme = themes[(levelNum - 1) % themes.length]

  switch (activeTheme) {
    case 'mall':
      return {
        id: 'traffic-mall-parking-wrapper',
        name: 'Mall Parking',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #495057 0%, #212529 100%)',
          border: '2px solid hsl(210 100% 65% / 0.3)',
          boxShadow: '0 0 20px hsl(210 100% 60% / 0.15)',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>🛒🏢🛒</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>🚨</div>,
        curbStyle: '8px solid #202429',
        stallColor: 'rgba(56, 189, 248, 0.15)',
      }
    case 'stadium':
      return {
        id: 'traffic-stadium-parking-wrapper',
        name: 'Stadium Parking',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #1e4620 0%, #3a7d44 100%)',
          border: '2px solid hsl(142 75% 50% / 0.3)',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>⚽🏟️⚽</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>📣</div>,
        curbStyle: '8px solid #3e4e41',
        stallColor: 'rgba(255, 255, 255, 0.12)',
      }
    case 'airport':
      return {
        id: 'traffic-airport-parking-wrapper',
        name: 'Airport Runway',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #4b5563 0%, #9ca3af 100%)',
          border: '2px solid hsl(48 95% 50% / 0.3)',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>✈️🛫🏢</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>🛬</div>,
        curbStyle: '8px solid #374151',
        stallColor: 'rgba(234, 179, 8, 0.15)',
      }
    case 'downtown':
      return {
        id: 'traffic-downtown-parking-wrapper',
        name: 'Downtown Block',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #111827 0%, #374151 100%)',
          border: '2px solid #4b5563',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>🏢🏙️🚕</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>🚦</div>,
        curbStyle: '8px solid #1f2937',
        stallColor: 'rgba(255,255,255,0.08)',
      }
    case 'neon':
      return {
        id: 'traffic-neon-parking-wrapper',
        name: 'Night Neon Parking',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #0f051d 0%, #2c0b4e 100%)',
          border: '2px solid hsl(320 100% 60% / 0.4)',
          boxShadow: '0 0 25px hsl(320 100% 50% / 0.25)',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>🌌🌟👾</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>⚡</div>,
        curbStyle: '8px solid #18082c',
        stallColor: 'rgba(236, 72, 153, 0.18)',
      }
    case 'beach':
    default:
      return {
        id: 'traffic-beach-parking-wrapper',
        name: 'Beach Parking',
        wrapperStyle: {
          background: 'linear-gradient(135deg, #f4a261 0%, #e9c46a 100%)',
          border: '1px solid rgba(255,255,255,0.25)',
        },
        emojis: <div style={{ position: 'absolute', top: 6, left: 14, fontSize: '1.4rem', pointerEvents: 'none' }}>🏖️⛱️🏖️</div>,
        decorRight: <div style={{ position: 'absolute', top: 6, right: 18, fontSize: '1.4rem', pointerEvents: 'none' }}>🌳</div>,
        curbStyle: '8px solid #343a40',
        stallColor: 'rgba(255, 255, 255, 0.15)',
      }
  }
}

export default function UnblockTrafficGame() {
  const { user, submitGameResult } = useGameSession()

  // Navigation & Level State
  const [stage, setStage] = useState<'setup' | 'playing' | 'endless_lab' | 'gameover'>('setup')
  const [difficulty, setDifficulty] = useState<Difficulty>('tutorial')
  const [level, setLevel] = useState<number>(1)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [initialVehicles, setInitialVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<Vehicle[][]>([])

  // Dynamic grid configuration states
  const [gridSize, setGridSize] = useState<number>(6)
  const [oneWayCells, setOneWayCells] = useState<OneWayCell[]>([])
  const [switchGate, setSwitchGate] = useState<SwitchGateSystem | null>(null)
  const [keyhole, setKeyhole] = useState<KeyholeSystem | null>(null)

  // Endless Lab States
  const [labSeed, setLabSeed] = useState<string>('54321')
  const [labDifficulty, setLabDifficulty] = useState<Difficulty>('intermediate')
  const [labBestRun, setLabBestRun] = useState<number>(0)

  // Gameplay metrics
  const [movesCount, setMovesCount] = useState<number>(0)
  const [timeElapsed, setTimeElapsed] = useState<number>(0)
  const [minMovesNeeded, setMinMovesNeeded] = useState<number>(5)
  const [hintsUsed, setHintsUsed] = useState<number>(0)
  const [hintMessage, setHintMessage] = useState<string | null>(null)
  const [hintHighlight, setHintHighlight] = useState<{ vehicleId: string; direction: 'prev' | 'next' } | null>(null)



  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const progressKey = user ? `gamehub_traffic_progress_${user.id}` : 'gamehub_traffic_progress_guest'
  const bestRunKey = user ? `gamehub_traffic_lab_best_${user.id}` : 'gamehub_traffic_lab_best_guest'

  const [completedLevelsCount, setCompletedLevelsCount] = useState<number>(0)

  // Ad simulation modal
  const [adModalOpen, setAdModalOpen] = useState(false)
  const [adCountdown, setAdCountdown] = useState(0)

  useEffect(() => {
    const savedLvl = localStorage.getItem(progressKey)
    if (savedLvl) setCompletedLevelsCount(parseInt(savedLvl, 10))
    const savedBest = localStorage.getItem(bestRunKey)
    if (savedBest) setLabBestRun(parseInt(savedBest, 10))
  }, [progressKey, bestRunKey])

  // Timer Effect
  useEffect(() => {
    if (stage === 'playing') {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stage])

  // Listen for replay/next level global events from modal
  useEffect(() => {
    const handleReplay = () => {
      if (stage === 'gameover' || stage === 'playing') {
        startLevel(difficulty, level)
      }
    }

    const handleNext = () => {
      if (level < 50) {
        const nextLevelNum = level + 1
        let nextDiff = difficulty
        if (nextLevelNum <= 10) nextDiff = 'tutorial'
        else if (nextLevelNum <= 20) nextDiff = 'beginner'
        else if (nextLevelNum <= 30) nextDiff = 'intermediate'
        else if (nextLevelNum <= 40) nextDiff = 'advanced'
        else nextDiff = 'master'

        setLevel(nextLevelNum)
        setDifficulty(nextDiff)
        startLevel(nextDiff, nextLevelNum)
      } else {
        setStage('endless_lab')
      }
    }

    window.addEventListener('gamehub_replay', handleReplay)
    window.addEventListener('gamehub_next_level', handleNext)
    return () => {
      window.removeEventListener('gamehub_replay', handleReplay)
      window.removeEventListener('gamehub_next_level', handleNext)
    }
  }, [level, difficulty, stage])

  // Start Level
  const startLevel = (diff: Difficulty, lvlNum: number) => {
    const data = generateTrafficLevel(diff, lvlNum)
    setVehicles(data.vehicles)
    setInitialVehicles(data.vehicles.map(v => ({ ...v })))
    setGridSize(data.gridSize)
    setOneWayCells(data.oneWayCells)
    setSwitchGate(data.switchGate)
    setKeyhole(data.keyhole)
    setMinMovesNeeded(data.minMoves)
    setUndoStack([])
    setSelectedVehicleId(null)
    setMovesCount(0)
    setTimeElapsed(0)
    setHintsUsed(0)
    setHintMessage(null)
    setHintHighlight(null)
    setDifficulty(diff)
    setLevel(lvlNum)
    setStage('playing')
  }

  // Endless Lab level
  const startLabLevel = () => {
    const rng = getSeededRandom(`traffic-lab-${labSeed}`)
    
    // Grid sizes based on lab complexity selection
    const size = { tutorial: 6, beginner: 6, intermediate: 6, advanced: 7, master: 8 }[labDifficulty]
    
    let oneWay: OneWayCell[] = []
    let gateSystem: SwitchGateSystem | null = null
    let keySys: KeyholeSystem | null = null

    if (labDifficulty === 'master') {
      keySys = { keyholeRow: Math.floor(size / 2) - 1, keyholeCol: size - 2 }
    } else if (labDifficulty === 'advanced') {
      oneWay = [{ row: 1, col: 2, direction: 'down' }]
    }

    const targetR = Math.floor(size / 2) - (size % 2 === 0 ? 1 : 0)
    const targetV = { tutorial: 10, beginner: 10, intermediate: 11, advanced: 14, master: 18 }[labDifficulty]

    let attempts = 0
    let levelVehicles: Vehicle[] = []
    let minM = 5

    while (attempts < 150) {
      attempts++
      const list: Vehicle[] = [
        { id: 'target', row: targetR, col: 0, size: 2, orientation: 'h', isTarget: true, type: 'car', color: TARGET_COLOR, facing: 'right' }
      ]

      if (keySys) {
        list.push({
          id: 'key-vehicle',
          row: targetR === 3 ? 1 : 4,
          col: 0,
          size: 2,
          orientation: 'h',
          isTarget: false,
          type: 'car',
          color: 'hsl(48 95% 48%)', // Golden Key Vehicle
          facing: 'right'
        })
      }

      let placed = keySys ? 2 : 1
      let fills = 0

      while (placed < targetV && fills < 80) {
        fills++
        const vSize = rng() < 0.25 ? 3 : 2
        const orientation = rng() < 0.5 ? 'h' : 'v'
        const row = Math.floor(rng() * size)
        const col = Math.floor(rng() * size)

        if (orientation === 'h' && row === targetR) continue

        let facing: 'right' | 'left' | 'up' | 'down' = 'right'
        if (orientation === 'h') {
          facing = rng() < 0.5 ? 'right' : 'left'
        } else {
          facing = rng() < 0.5 ? 'down' : 'up'
        }

        const candidate: Vehicle = {
          id: `lab-v-${placed}-${attempts}`,
          row,
          col,
          size: vSize,
          orientation,
          isTarget: false,
          type: vSize === 3 ? (rng() < 0.5 ? 'truck' : 'van') : (rng() < 0.5 ? 'car' : 'suv'),
          color: VEHICLE_COLORS[Math.floor(rng() * VEHICLE_COLORS.length)],
          facing
        }

        if (isValidState([...list, candidate], size, oneWay, gateSystem, keySys)) {
          list.push(candidate)
          placed++
        }
      }

      const solution = solveTrafficPuzzle(list, size, oneWay, gateSystem, keySys)
      if (solution && solution.length >= 4) {
        levelVehicles = list
        minM = solution.length
        break
      }
    }

    if (levelVehicles.length === 0) {
      levelVehicles = [
        { id: 'target', row: targetR, col: 0, size: 2, orientation: 'h', isTarget: true, type: 'car', color: TARGET_COLOR, facing: 'right' },
        { id: 'v-fallback', row: targetR === 2 ? 0 : 1, col: 2, size: 2, orientation: 'v', isTarget: false, type: 'suv', color: VEHICLE_COLORS[0], facing: 'down' }
      ]
      minM = 2
    }

    setVehicles(levelVehicles)
    setInitialVehicles(levelVehicles.map(v => ({ ...v })))
    setGridSize(size)
    setOneWayCells(oneWay)
    setSwitchGate(gateSystem)
    setKeyhole(keySys)
    setMinMovesNeeded(minM)
    setUndoStack([])
    setSelectedVehicleId(null)
    setMovesCount(0)
    setTimeElapsed(0)
    setHintsUsed(0)
    setHintMessage(null)
    setHintHighlight(null)
    setStage('playing')
  }

  const playSynthSound = (type: 'tire' | 'click' | 'unlock') => {
    if (typeof window === 'undefined') return
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      
      if (type === 'tire') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(120, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.25)
        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.25)
      } else if (type === 'click') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(700, ctx.currentTime)
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.06)
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.06)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.06)
      } else if (type === 'unlock') {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc1.type = 'sine'
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
        osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25) // G5
        
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.25) // C6
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        
        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)
        
        osc1.start()
        osc2.start()
        osc1.stop(ctx.currentTime + 0.3)
        osc2.stop(ctx.currentTime + 0.3)
      }
    } catch (e) {
      // Fallback
    }
  }

  const playTireSound = () => {
    console.log('[Audio Hook] Soft tire movement sound triggered')
    playSynthSound('tire')
  }
  const playParkClick = () => {
    console.log('[Audio Hook] Parking click sound triggered')
    playSynthSound('click')
  }
  const playGateUnlock = () => {
    console.log('[Audio Hook] Gate unlock sound triggered')
    playSynthSound('unlock')
  }

  const checkSwitchPressed = (state: Vehicle[]) => {
    if (!switchGate) return false
    return state.some(v => {
      for (let i = 0; i < v.size; i++) {
        const r = v.row + (v.orientation === 'v' ? i : 0)
        const c = v.col + (v.orientation === 'h' ? i : 0)
        if (r === switchGate.switchRow && c === switchGate.switchCol) return true
      }
      return false
    })
  }

  // NEW ONE-TAP SYSTEM: Slide vehicle all the way in its facing direction until blocked
  const handleVehicleTap = (v: Vehicle) => {
    if (stage !== 'playing' || v.isLocked) return

    // Target vehicle lock state check (requires key to reach keyhole)
    let isTargetUnlocked = true
    if (keyhole) {
      const keyCar = vehicles.find(item => item.id === 'key-vehicle')
      if (keyCar) {
        let keyReached = false
        for (let i = 0; i < keyCar.size; i++) {
          const r = keyCar.row + (keyCar.orientation === 'v' ? i : 0)
          const c = keyCar.col + (keyCar.orientation === 'h' ? i : 0)
          if (r === keyhole.keyholeRow && c === keyhole.keyholeCol) {
            keyReached = true
            break
          }
        }
        isTargetUnlocked = keyReached
      }
    }

    if (v.isTarget && !isTargetUnlocked) {
      setHintMessage("Unlock the Target vehicle first by moving the Golden Key vehicle to the keyhole!")
      return
    }

    const stepRow = v.facing === 'down' ? 1 : v.facing === 'up' ? -1 : 0
    const stepCol = v.facing === 'right' ? 1 : v.facing === 'left' ? -1 : 0

    if (stepRow === 0 && stepCol === 0) return

    let currRow = v.row
    let currCol = v.col
    let steps = 0

    while (true) {
      const nextRow = currRow + stepRow
      const nextCol = currCol + stepCol

      if (v.orientation === 'h') {
        if (v.isTarget) {
          const exitDir = v.facing
          if (exitDir === 'right') {
            if (nextCol < 0 || nextCol + v.size > gridSize + 1) break
          } else if (exitDir === 'left') {
            if (nextCol < -v.size || nextCol + v.size > gridSize + 1) break
          } else {
            if (nextCol < 0 || nextCol + v.size > gridSize) break
          }
        } else {
          if (nextCol < 0 || nextCol + v.size > gridSize) break
        }
      } else {
        if (v.isTarget) {
          const exitDir = v.facing
          if (exitDir === 'down' || exitDir === 'up') {
            if (nextRow < -v.size || nextRow + v.size > gridSize + 1) break
          } else {
            if (nextRow < 0 || nextRow + v.size > gridSize) break
          }
        } else {
          if (nextRow < 0 || nextRow + v.size > gridSize) break
        }
      }

      const candidateState = vehicles.map(item => {
        if (item.id === v.id) return { ...item, row: nextRow, col: nextCol }
        return item
      })

      if (isValidState(candidateState, gridSize, oneWayCells, switchGate, keyhole)) {
        currRow = nextRow
        currCol = nextCol
        steps++
      } else {
        break
      }
    }

    if (steps > 0) {
      playTireSound()

      // Save state for undo
      setUndoStack(prev => [...prev, vehicles.map(x => ({ ...x }))])

      // Trigger achievement hook: First Move
      if (movesCount === 0 && user) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'traffic-first-escape' }),
        }).catch(() => {})
      }

      const nextState = vehicles.map(item => {
        if (item.id === v.id) return { ...item, row: currRow, col: currCol }
        return item
      })

      // Gate switch activation sound check
      const wasSwitchPressed = checkSwitchPressed(vehicles)
      const isNowSwitchPressed = checkSwitchPressed(nextState)
      if (!wasSwitchPressed && isNowSwitchPressed) {
        playGateUnlock()
      }

      setVehicles(nextState)
      setMovesCount(prev => prev + 1)
      setHintHighlight(null)
      setHintMessage(null)

      // Play park click sound
      setTimeout(() => {
        playParkClick()
      }, 350)

      // Instantly check win if target successfully escapes
      let escaped = false
      if (v.isTarget) {
        if (v.facing === 'right' && currCol >= gridSize - v.size) escaped = true
        if (v.facing === 'left' && currCol <= 0) escaped = true
        if (v.facing === 'down' && currRow >= gridSize - v.size) escaped = true
        if (v.facing === 'up' && currRow <= 0) escaped = true
      }

      if (escaped) {
        setTimeout(() => {
          triggerVictory()
        }, 250)
      }
    }
  }

  // Trigger Hint Solver
  const handleHintClick = () => {
    if (stage !== 'playing') return

    const solution = solveTrafficPuzzle(vehicles, gridSize, oneWayCells, switchGate, keyhole)
    if (!solution || solution.length === 0) {
      setHintMessage('Unsolvable from here! Try restarting or undoing.')
      return
    }

    const next = solution[0]
    const vehicle = vehicles.find(x => x.id === next.vehicleId)!

    let direction: 'prev' | 'next' = 'next'
    if (vehicle.orientation === 'h') {
      direction = next.newCol > vehicle.col ? 'next' : 'prev'
    } else {
      direction = next.newRow > vehicle.row ? 'next' : 'prev'
    }

    const triggerHintHighlight = () => {
      setHintHighlight({ vehicleId: next.vehicleId, direction })
      setHintMessage(`Hint: Tap ${vehicle.isTarget ? 'Red Car' : vehicle.type.toUpperCase()} to clear the path.`)
    }

    if (hintsUsed === 0) {
      setHintsUsed(1)
      triggerHintHighlight()
    } else {
      setAdCountdown(4)
      setAdModalOpen(true)
    }
  }

  const claimRewardedHint = () => {
    setAdModalOpen(false)
    setHintsUsed(prev => prev + 1)
    const solution = solveTrafficPuzzle(vehicles, gridSize, oneWayCells, switchGate, keyhole)
    if (solution && solution.length > 0) {
      const next = solution[0]
      const vehicle = vehicles.find(x => x.id === next.vehicleId)!
      let direction: 'prev' | 'next' = 'next'
      if (vehicle.orientation === 'h') {
        direction = next.newCol > vehicle.col ? 'next' : 'prev'
      } else {
        direction = next.newRow > vehicle.row ? 'next' : 'prev'
      }
      setHintHighlight({ vehicleId: next.vehicleId, direction })
      setHintMessage(`Hint: Tap ${vehicle.isTarget ? 'Red Car' : vehicle.type.toUpperCase()}`)
    }
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setVehicles(prev)
    setUndoStack(prevStack => prevStack.slice(0, -1))
    setMovesCount(prev => prev + 1)
    setHintHighlight(null)
    setHintMessage(null)
  }

  // Trigger Escape Victory
  const triggerVictory = () => {
    setStage('gameover')
    if (timerRef.current) clearInterval(timerRef.current)

    // Stars rating
    let finalStars = 1
    const optimalMargin = movesCount - minMovesNeeded
    if (hintsUsed === 0 && optimalMargin <= 4 && timeElapsed < 150) {
      finalStars = 3
    } else if (hintsUsed === 0 || optimalMargin <= 10) {
      finalStars = 2
    }

    const calculatedScore = Math.max(10, 1200 - (movesCount - minMovesNeeded) * 20 - (hintsUsed * 120) - timeElapsed)

    // Save progression
    if (level > completedLevelsCount && completedLevelsCount < 50) {
      localStorage.setItem(progressKey, level.toString())
      setCompletedLevelsCount(level)
    }

    if (stage === 'playing' && level > 50) {
      if (calculatedScore > labBestRun) {
        localStorage.setItem(bestRunKey, calculatedScore.toString())
        setLabBestRun(calculatedScore)
      }
    }

    // Unlocking achievements
    if (user) {
      const completions = Math.max(level, completedLevelsCount)
      if (completions >= 5) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'traffic-officer' }),
        }).catch(() => {})
      }
      if (completions >= 25) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'traffic-grid-master' }),
        }).catch(() => {})
      }
      if (hintsUsed === 0) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'traffic-no-hint' }),
        }).catch(() => {})
      }
      if (finalStars === 3) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'traffic-legend' }),
        }).catch(() => {})
      }
    }

    // Auto-advance target vehicle off-board visual
    setVehicles(currentList =>
      currentList.map(v => {
        if (!v.isTarget) return v
        if (v.facing === 'right') return { ...v, col: gridSize }
        if (v.facing === 'left') return { ...v, col: -v.size }
        if (v.facing === 'down') return { ...v, row: gridSize }
        if (v.facing === 'up') return { ...v, row: -v.size }
        return v
      })
    )

    submitGameResult({
      gameSlug: 'unblock-traffic',
      result: 'win',
      metadata: {
        score: calculatedScore,
        gameMetadata: {
          difficulty,
          level,
          moves: movesCount,
          timeSecs: timeElapsed,
          stars: finalStars,
        },
      },
    })
  }

  useEffect(() => {
    (window as any).triggerTrafficWin = () => {
      triggerVictory()
    }
  }, [vehicles, difficulty, level, movesCount, timeElapsed, minMovesNeeded, hintsUsed, gridSize])

  // Draw styled vehicles inside absolute boxes
  const renderVehicleSVG = (v: Vehicle) => {
    const isH = v.orientation === 'h'
    const color = v.color

    // Render Red Sports Target Car
    if (v.isTarget) {
      return (
        <svg
          viewBox={isH ? "0 0 100 50" : "0 0 50 100"}
          style={{
            width: '100%',
            height: '100%',
            filter: `drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))`,
            pointerEvents: 'none',
          }}
        >
          {isH ? (
            <g transform={v.facing === 'left' ? "rotate(180 50 25)" : ""}>
              {/* Soft Red Underglow shadow */}
              <rect x="5" y="5" width="90" height="40" rx="8" fill="rgba(255, 0, 0, 0.35)" filter="blur(2px)" />
              {/* Wheels */}
              <rect x="15" y="42" width="16" height="8" rx="2" fill="#111" />
              <rect x="68" y="42" width="16" height="8" rx="2" fill="#111" />
              <rect x="15" y="0" width="16" height="8" rx="2" fill="#111" />
              <rect x="68" y="0" width="16" height="8" rx="2" fill="#111" />
              {/* Body shape */}
              <path d="M 5 25 C 5 12, 12 8, 30 8 L 75 8 C 88 8, 95 12, 95 25 C 95 38, 88 42, 75 42 L 30 42 C 12 42, 5 38, 5 25 Z" fill="hsl(0 85% 45%)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              {/* Spoiler */}
              <path d="M 5 12 L 15 8 L 15 42 L 5 38 Z" fill="hsl(0 95% 30%)" />
              <rect x="3" y="10" width="4" height="30" rx="1" fill="#222" />
              {/* Racing Stripes */}
              <rect x="30" y="20" width="55" height="3" fill="hsl(48 95% 55%)" />
              <rect x="30" y="27" width="55" height="3" fill="hsl(48 95% 55%)" />
              {/* Windshield */}
              <path d="M 72 13 L 85 25 L 72 37 Z" fill="rgba(0,0,0,0.65)" />
              <path d="M 74 15 L 83 25 L 74 35 Z" fill="rgba(200,240,255,0.25)" />
              {/* Side windows */}
              <rect x="32" y="11" width="36" height="28" rx="3" fill="rgba(0,0,0,0.45)" />
              <rect x="35" y="13" width="14" height="24" rx="2" fill="rgba(200,240,255,0.2)" />
              <rect x="52" y="13" width="14" height="24" rx="2" fill="rgba(200,240,255,0.2)" />
              {/* Headlights and glowing beam */}
              <circle cx="94" cy="14" r="3" fill="yellow" />
              <circle cx="94" cy="36" r="3" fill="yellow" />
              <polygon points="94,14 110,6 110,22" fill="rgba(255,255,0,0.3)" filter="blur(2px)" />
              <polygon points="94,36 110,28 110,44" fill="rgba(255,255,0,0.3)" filter="blur(2px)" />
              {/* Corner Indicators */}
              <rect x="91" y="8" width="3" height="4" rx="1" fill="orange" />
              <rect x="91" y="38" width="3" height="4" rx="1" fill="orange" />
              {/* Tail Lights */}
              <rect x="4" y="14" width="2" height="6" fill="red" />
              <rect x="4" y="30" width="2" height="6" fill="red" />
            </g>
          ) : (
            <g transform={v.facing === 'up' ? "rotate(180 25 50)" : ""}>
              {/* Soft Red Underglow shadow */}
              <rect x="5" y="5" width="40" height="90" rx="8" fill="rgba(255, 0, 0, 0.35)" filter="blur(2px)" />
              {/* Wheels */}
              <rect x="42" y="15" width="8" height="16" rx="2" fill="#111" />
              <rect x="42" y="68" width="8" height="16" rx="2" fill="#111" />
              <rect x="0" y="15" width="8" height="16" rx="2" fill="#111" />
              <rect x="0" y="68" width="8" height="16" rx="2" fill="#111" />
              {/* Body shape */}
              <path d="M 25 5 C 12 5, 8 12, 8 30 L 8 75 C 8 88, 12 95, 25 95 C 38 95, 42 88, 42 75 L 42 30 C 42 12, 38 5, 25 5 Z" fill="hsl(0 85% 45%)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
              {/* Spoiler */}
              <path d="M 12 5 L 8 15 L 42 15 L 38 5 Z" fill="hsl(0 95% 30%)" />
              <rect x="10" y="3" width="30" height="4" rx="1" fill="#222" />
              {/* Racing Stripes */}
              <rect x="20" y="30" width="3" height="55" fill="hsl(48 95% 55%)" />
              <rect x="27" y="30" width="3" height="55" fill="hsl(48 95% 55%)" />
              {/* Windshield */}
              <path d="M 13 72 L 25 85 L 37 72 Z" fill="rgba(0,0,0,0.65)" />
              <path d="M 15 74 L 25 83 L 35 74 Z" fill="rgba(200,240,255,0.25)" />
              {/* Side windows */}
              <rect x="11" y="32" width="28" height="36" rx="3" fill="rgba(0,0,0,0.45)" />
              <rect x="13" y="35" width="24" height="14" rx="2" fill="rgba(200,240,255,0.2)" />
              <rect x="13" y="52" width="24" height="14" rx="2" fill="rgba(200,240,255,0.2)" />
              {/* Headlights and glowing beam */}
              <circle cx="14" cy="94" r="3" fill="yellow" />
              <circle cx="36" cy="94" r="3" fill="yellow" />
              <polygon points="14,94 6,110 22,110" fill="rgba(255,255,0,0.3)" filter="blur(2px)" />
              <polygon points="36,94 28,110 44,110" fill="rgba(255,255,0,0.3)" filter="blur(2px)" />
              {/* Corner Indicators */}
              <rect x="8" y="91" width="4" height="3" rx="1" fill="orange" />
              <rect x="38" y="91" width="4" height="3" rx="1" fill="orange" />
              {/* Tail Lights */}
              <rect x="14" y="4" width="6" height="2" fill="red" />
              <rect x="30" y="4" width="6" height="2" fill="red" />
            </g>
          )}
        </svg>
      )
    }

    // Render Golden Key Car
    if (v.id === 'key-vehicle') {
      return (
        <svg
          viewBox="0 0 100 50"
          style={{
            width: '100%',
            height: '100%',
            filter: `drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45))`,
            pointerEvents: 'none',
          }}
        >
          <g transform={v.facing === 'left' ? "rotate(180 50 25)" : ""}>
            {/* Wheels */}
            <rect x="15" y="42" width="16" height="8" rx="2" fill="#111" />
            <rect x="68" y="42" width="16" height="8" rx="2" fill="#111" />
            <rect x="15" y="0" width="16" height="8" rx="2" fill="#111" />
            <rect x="68" y="0" width="16" height="8" rx="2" fill="#111" />
            {/* Body */}
            <rect x="5" y="6" width="90" height="38" rx="8" fill="hsl(48 95% 48%)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
            <rect x="25" y="10" width="45" height="30" rx="6" fill="rgba(0,0,0,0.35)" />
            {/* Windshield */}
            <path d="M 68 12 L 78 18 L 78 32 L 68 38 Z" fill="rgba(255,255,255,0.15)" />
            {/* Key Emblem on Roof */}
            <circle cx="45" cy="25" r="5" fill="none" stroke="#fff" strokeWidth="2" />
            <rect x="49" y="24" width="10" height="2" fill="#fff" />
            <rect x="54" y="26" width="2" height="3" fill="#fff" />
            <rect x="57" y="26" width="2" height="3" fill="#fff" />
            {/* Lights */}
            <circle cx="92" cy="14" r="3" fill="yellow" />
            <circle cx="92" cy="36" r="3" fill="yellow" />
            <polygon points="92,14 105,8 105,20" fill="rgba(255,255,0,0.25)" filter="blur(1px)" />
            <polygon points="92,36 105,30 105,42" fill="rgba(255,255,0,0.25)" filter="blur(1px)" />
            <rect x="90" y="8" width="2" height="4" fill="orange" />
            <rect x="90" y="38" width="2" height="4" fill="orange" />
            <rect x="5" y="12" width="2" height="6" fill="red" />
            <rect x="5" y="32" width="2" height="6" fill="red" />
          </g>
        </svg>
      )
    }

    return (
      <svg
        viewBox={isH ? "0 0 100 50" : "0 0 50 100"}
        style={{
          width: '100%',
          height: '100%',
          filter: `drop-shadow(0 4px 6px rgba(0, 0, 0, 0.45))`,
          pointerEvents: 'none',
        }}
      >
        {isH ? (
          <g transform={v.facing === 'left' ? "rotate(180 50 25)" : ""}>
            {/* Wheels */}
            <rect x="15" y="42" width="16" height="8" rx="2" fill="#111" />
            <rect x="70" y="42" width="16" height="8" rx="2" fill="#111" />
            <rect x="15" y="0" width="16" height="8" rx="2" fill="#111" />
            <rect x="70" y="0" width="16" height="8" rx="2" fill="#111" />

            {/* Vehicle Base Body */}
            <rect x="5" y="6" width="90" height="38" rx="8" fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Windshield / Cab / Windows */}
            {v.type === 'truck' ? (
              <g>
                <rect x="42" y="8" width="50" height="34" rx="4" fill="rgba(0,0,0,0.35)" />
                <rect x="8" y="10" width="30" height="30" rx="3" fill="#333" />
                <rect x="14" y="14" width="12" height="22" rx="2" fill="rgba(255,255,255,0.2)" />
              </g>
            ) : v.type === 'suv' ? (
              <g>
                <rect x="20" y="8" width="55" height="34" rx="4" fill="rgba(0,0,0,0.4)" />
                <path d="M 72 10 L 84 16 L 84 34 L 72 40 Z" fill="rgba(255,255,255,0.15)" />
                {/* Roof Rack */}
                <rect x="35" y="10" width="25" height="2" fill="#222" />
                <rect x="35" y="38" width="25" height="2" fill="#222" />
                <rect x="40" y="12" width="2" height="26" fill="#222" />
                <rect x="50" y="12" width="2" height="26" fill="#222" />
              </g>
            ) : v.type === 'van' ? (
              <g>
                <rect x="15" y="9" width="60" height="32" rx="3" fill="rgba(0,0,0,0.4)" />
                <path d="M 72 11 L 86 17 L 86 33 L 72 39 Z" fill="rgba(255,255,255,0.18)" />
              </g>
            ) : (
              <g>
                <rect x="25" y="10" width="45" height="30" rx="6" fill="rgba(0,0,0,0.35)" />
                <path d="M 68 12 L 78 18 L 78 32 L 68 38 Z" fill="rgba(255,255,255,0.15)" />
                <rect x="30" y="14" width="14" height="22" rx="2" fill="rgba(255,255,255,0.2)" />
                <rect x="48" y="14" width="14" height="22" rx="2" fill="rgba(255,255,255,0.2)" />
              </g>
            )}

            {/* Lights */}
            <circle cx="92" cy="14" r="3" fill="yellow" opacity="0.95" />
            <circle cx="92" cy="36" r="3" fill="yellow" opacity="0.95" />
            <rect x="90" y="8" width="2" height="4" fill="orange" />
            <rect x="90" y="38" width="2" height="4" fill="orange" />
            <rect x="5" y="12" width="2" height="6" fill="red" />
            <rect x="5" y="32" width="2" height="6" fill="red" />
          </g>
        ) : (
          <g transform={v.facing === 'up' ? "rotate(180 25 50)" : ""}>
            {/* Wheels */}
            <rect x="0" y="15" width="8" height="16" rx="2" fill="#111" />
            <rect x="0" y="70" width="8" height="16" rx="2" fill="#111" />
            <rect x="42" y="15" width="8" height="16" rx="2" fill="#111" />
            <rect x="42" y="70" width="8" height="16" rx="2" fill="#111" />

            {/* Vehicle Base Body */}
            <rect x="6" y="5" width="38" height="90" rx="8" fill={color} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

            {/* Windshield / Cab / Windows */}
            {v.type === 'truck' ? (
              <g>
                <rect x="8" y="8" width="34" height="50" rx="4" fill="rgba(0,0,0,0.35)" />
                <rect x="10" y="62" width="30" height="30" rx="3" fill="#333" />
                <rect x="14" y="70" width="22" height="12" rx="2" fill="rgba(255,255,255,0.2)" />
              </g>
            ) : v.type === 'suv' ? (
              <g>
                <rect x="8" y="20" width="34" height="55" rx="4" fill="rgba(0,0,0,0.4)" />
                <path d="M 10 72 L 16 84 L 34 84 L 40 72 Z" fill="rgba(255,255,255,0.15)" />
                {/* Roof Rack */}
                <rect x="10" y="35" width="2" height="25" fill="#222" />
                <rect x="38" y="35" width="2" height="25" fill="#222" />
                <rect x="12" y="40" width="26" height="2" fill="#222" />
                <rect x="12" y="50" width="26" height="2" fill="#222" />
              </g>
            ) : v.type === 'van' ? (
              <g>
                <rect x="9" y="15" width="32" height="60" rx="3" fill="rgba(0,0,0,0.4)" />
                <path d="M 11 72 L 17 86 L 33 86 L 39 72 Z" fill="rgba(255,255,255,0.18)" />
              </g>
            ) : (
              <g>
                <rect x="10" y="25" width="30" height="45" rx="6" fill="rgba(0,0,0,0.35)" />
                <path d="M 12 68 L 18 78 L 32 78 L 38 68 Z" fill="rgba(255,255,255,0.15)" />
                <rect x="14" y="30" width="22" height="14" rx="2" fill="rgba(255,255,255,0.2)" />
                <rect x="14" y="48" width="22" height="14" rx="2" fill="rgba(255,255,255,0.2)" />
              </g>
            )}

            {/* Lights */}
            <circle cx="14" cy="92" r="3" fill="yellow" opacity="0.95" />
            <circle cx="36" cy="92" r="3" fill="yellow" opacity="0.95" />
            <rect x="8" y="90" width="4" height="2" fill="orange" />
            <rect x="38" y="90" width="4" height="2" fill="orange" />
            <rect x="12" y="5" width="6" height="2" fill="red" />
            <rect x="32" y="5" width="6" height="2" fill="red" />
          </g>
        )}
      </svg>
    )
  }

  const getDifficultyColor = (diff: Difficulty) => {
    return {
      tutorial: 'hsl(142 70% 45%)',
      beginner: 'hsl(215 90% 50%)',
      intermediate: 'hsl(270 80% 55%)',
      advanced: 'hsl(28 95% 50%)',
      master: 'hsl(0 85% 50%)',
    }[diff]
  }

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId)

  const targetRow = Math.floor(gridSize / 2) - (gridSize % 2 === 0 ? 1 : 0)
  const targetCol = Math.floor(gridSize / 2) - (gridSize % 2 === 0 ? 1 : 0)

  const targetVehicle = vehicles.find(v => v.isTarget)
  const exitDir = targetVehicle ? targetVehicle.facing : 'right'
  const themeConfig = getThemeConfig(level, gridSize, targetRow, targetCol)

  // Determine if switch is currently pressed
  let isSwitchPressed = false
  if (switchGate) {
    for (const v of vehicles) {
      for (let i = 0; i < v.size; i++) {
        const r = v.row + (v.orientation === 'v' ? i : 0)
        const c = v.col + (v.orientation === 'h' ? i : 0)
        if (r === switchGate.switchRow && c === switchGate.switchCol) {
          isSwitchPressed = true
          break
        }
      }
      if (isSwitchPressed) break
    }
  }

  // Determine if target is unlocked (by keyhole system)
  let isTargetUnlocked = true
  if (keyhole) {
    const keyCar = vehicles.find(item => item.id === 'key-vehicle')
    if (keyCar) {
      let keyReached = false
      for (let i = 0; i < keyCar.size; i++) {
        const r = keyCar.row + (keyCar.orientation === 'v' ? i : 0)
        const c = keyCar.col + (keyCar.orientation === 'h' ? i : 0)
        if (r === keyhole.keyholeRow && c === keyhole.keyholeCol) {
          keyReached = true
          break
        }
      }
      isTargetUnlocked = keyReached
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
      id="unblock-traffic-root"
    >
      {/* 1. SETUP STAGE */}
      {stage === 'setup' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(222 18% 12% / 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          id="unblock-traffic-setup-screen"
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><CarIcon size={48} className="text-blue-400" /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>Unblock Traffic</h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
              Clear a path to guide the red car to the Exit gate. Slide horizontal cars left/right, and vertical cars up/down.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em' }}>
              Levels 1 - 50 Campaign
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '4px',
                background: 'hsl(222 20% 8%)',
                borderRadius: 12,
                border: '1px solid hsl(220 15% 15%)',
              }}
              id="traffic-level-grid"
            >
              {Array.from({ length: 50 }).map((_, idx) => {
                const lvlNum = idx + 1
                const isCompleted = completedLevelsCount >= lvlNum
                const isPlayable = lvlNum <= completedLevelsCount + 1

                let diffColor = 'hsl(220 10% 40%)'
                let lvlDiff: Difficulty = 'tutorial'
                if (lvlNum <= 10) { lvlDiff = 'tutorial'; diffColor = getDifficultyColor('tutorial') }
                else if (lvlNum <= 20) { lvlDiff = 'beginner'; diffColor = getDifficultyColor('beginner') }
                else if (lvlNum <= 30) { lvlDiff = 'intermediate'; diffColor = getDifficultyColor('intermediate') }
                else if (lvlNum <= 40) { lvlDiff = 'advanced'; diffColor = getDifficultyColor('advanced') }
                else { lvlDiff = 'master'; diffColor = getDifficultyColor('master') }

                return (
                  <button
                    key={`traffic-lvl-${lvlNum}`}
                    disabled={!isPlayable}
                    onClick={() => startLevel(lvlDiff, lvlNum)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isCompleted
                        ? 'hsl(142 70% 45% / 0.4)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.3)'
                        : 'transparent',
                      background: isCompleted
                        ? 'hsl(142 70% 45% / 0.12)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.05)'
                        : 'hsl(222 18% 10%)',
                      color: isCompleted
                        ? 'hsl(142 70% 55%)'
                        : isPlayable
                        ? 'white'
                        : 'hsl(220 10% 35%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: isPlayable ? 'pointer' : 'not-allowed',
                      position: 'relative',
                    }}
                    title={`${lvlDiff.toUpperCase()} Level`}
                  >
                    {isPlayable ? lvlNum : <LockIcon size={12} className="mx-auto" />}
                    {isPlayable && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: diffColor,
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {completedLevelsCount >= 50 ? (
              <button
                onClick={() => setStage('endless_lab')}
                className="btn btn-primary"
                style={{
                  borderRadius: 14,
                  padding: '0.85rem',
                  background: 'linear-gradient(90deg, hsl(270 80% 55%), hsl(220 100% 50%))',
                  border: 'none',
                  boxShadow: '0 0 15px hsl(270 80% 55% / 0.35)',
                }}
                id="traffic-enter-lab-btn"
              >
                <FlaskIcon size={14} className="inline mr-1 text-purple-400" /> Enter Endless Lab
              </button>
            ) : (
              <div
                style={{
                  background: 'hsl(222 20% 7%)',
                  border: '1px dashed hsl(220 15% 15%)',
                  borderRadius: 14,
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'hsl(220 10% 45%)',
                }}
              >
                <LockIcon size={14} className="inline mr-1 text-red-500" /> Endless Lab Mode unlocks after Level 50
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ENDLESS LAB STAGE */}
      {stage === 'endless_lab' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(222 18% 12% / 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          id="traffic-endless-lab-screen"
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'flex', justifyContent: 'center' }}><FlaskIcon size={36} className="text-purple-400" /></span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 950, color: 'white', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
              TRAFFIC ENDLESS LAB
            </h2>
            <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
              Procedural deterministic generation of traffic jams.
            </p>
          </div>

          <div
            style={{
              background: 'hsl(222 20% 7% / 0.7)',
              borderRadius: 14,
              padding: '0.85rem',
              border: '1px dashed hsl(220 15% 16%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>
              Lab Best Run (Score)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(48 95% 50%)', marginTop: '0.15rem' }}>
              <TrophyIcon size={14} className="inline mr-1 text-yellow-400" /> {labBestRun || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'hsl(220 10% 60%)', fontWeight: 700 }}>Deterministic Seed</label>
              <input
                type="text"
                value={labSeed}
                onChange={e => setLabSeed(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                maxLength={10}
                style={{
                  background: 'hsl(222 20% 7%)',
                  border: '1px solid hsl(220 15% 20%)',
                  borderRadius: 10,
                  padding: '0.5rem 0.75rem',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
                id="traffic-lab-seed-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'hsl(220 10% 60%)', fontWeight: 700 }}>Complexity Rating</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {(['intermediate', 'advanced', 'master'] as Difficulty[]).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setLabDifficulty(diff)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: labDifficulty === diff ? getDifficultyColor(diff) : 'hsl(220 15% 18%)',
                      background: labDifficulty === diff ? `${getDifficultyColor(diff)}20` : 'hsl(222 18% 10%)',
                      color: labDifficulty === diff ? 'white' : 'hsl(220 10% 60%)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                    id={`traffic-lab-diff-${diff}`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={startLabLevel}
              className="btn btn-primary"
              style={{ flex: 1.5, borderRadius: 12, padding: '0.65rem' }}
              id="traffic-lab-launch-btn"
            >
              <CarIcon size={14} className="inline mr-1" /> Launch Escape Run
            </button>
            <button
              onClick={() => setStage('setup')}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12, padding: '0.65rem' }}
            >
              ⬅️ Back
            </button>
          </div>
        </div>
      )}

      {/* 3. PLAYING STAGE */}
      {stage === 'playing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            width: '100%',
          }}
          id="unblock-traffic-board-container"
        >
          {/* Header Stats */}
          <GameHUD
            id="traffic-header-hud"
            style={{
              padding: '0.6rem 0.85rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Mode</span>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', textTransform: 'capitalize' }}>
                {level > 50 ? 'Endless Lab' : `${difficulty} (Lvl ${level})`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.85rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Moves</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white' }} id="traffic-moves">{movesCount}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Time</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'hsl(48 95% 50%)' }}>
                  {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </GameHUD>

          {/* dynamically themed premium wrapper */}
          <div
            style={{
              position: 'relative',
              borderRadius: 28,
              padding: '2.5rem 1.25rem 1.25rem 1.25rem',
              boxShadow: '0 12px 30px rgba(0,0,0,0.4), inset 0 2px 5px rgba(255,255,255,0.4)',
              overflow: 'hidden',
              ...themeConfig.wrapperStyle,
            }}
            id={themeConfig.id}
          >
            {/* Theme title in the background */}
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.75rem',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              {themeConfig.name}
            </div>
            {themeConfig.emojis}
            {themeConfig.decorRight}

            {/* Grid Asphalt Board Area */}
            <div
              style={{
                width: '100%',
                aspectRatio: 1,
                maxWidth: 400,
                margin: '0 auto',
                background: 'linear-gradient(180deg, #2c302e 0%, #202322 100%)',
                border: themeConfig.curbStyle, // concrete themed sidewalk curb border
                borderRadius: 16,
                position: 'relative',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                overflow: 'visible',
              }}
              id="traffic-asphalt-grid"
            >
              {/* Grid cell lines simulation & parking stalls */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                  pointerEvents: 'none',
                }}
              >
                {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                  const row = Math.floor(i / gridSize)
                  const col = i % gridSize
                  
                  // Render parking slot lines: dashed borders except for the exit corridor
                  const isExitCorridorCell = (exitDir === 'right' || exitDir === 'left')
                    ? (row === targetRow)
                    : (col === targetCol)
                  
                  return (
                    <div
                      key={`cell-${i}`}
                      style={{
                        border: '1px solid rgba(255,255,255,0.06)',
                        boxSizing: 'border-box',
                        position: 'relative',
                        // Add dashed lines between parking spaces, avoiding the exit corridor
                        borderLeft: !isExitCorridorCell && col > 0 && col < gridSize - 1 ? `1.5px dashed ${themeConfig.stallColor}` : '1px solid rgba(255,255,255,0.06)',
                        borderRight: !isExitCorridorCell && col > 0 && col < gridSize - 2 ? `1.5px dashed ${themeConfig.stallColor}` : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* T-shape markings at the top of parking stalls */}
                      {!isExitCorridorCell && row > 0 && (
                        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: 1.5, background: 'rgba(255,255,255,0.25)' }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* One-way arrow tiles */}
              {oneWayCells.map((cell, idx) => (
                <div
                  key={`oneway-${idx}`}
                  style={{
                    position: 'absolute',
                    top: `${(cell.row / gridSize) * 100}%`,
                    left: `${(cell.col / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '1.2rem',
                      color: 'hsl(190 100% 50% / 0.45)',
                      textShadow: '0 0 5px hsl(190 100% 50% / 0.8)',
                      transform: `rotate(${
                        cell.direction === 'right' ? '0deg' :
                        cell.direction === 'left' ? '180deg' :
                        cell.direction === 'down' ? '90deg' : '270deg'
                      })`,
                      fontWeight: 'bold',
                    }}
                  >
                    ➔
                  </span>
                </div>
              ))}

              {/* Switch Plate */}
              {switchGate && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${(switchGate.switchRow / gridSize) * 100}%`,
                    left: `${(switchGate.switchCol / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '70%',
                      height: '70%',
                      borderRadius: '50%',
                      border: `2px solid ${isSwitchPressed ? 'hsl(142 75% 50%)' : 'hsl(0 85% 50%)'}`,
                      background: isSwitchPressed ? 'hsl(142 75% 15% / 0.8)' : 'hsl(0 85% 15% / 0.8)',
                      boxShadow: `inset 0 0 8px ${isSwitchPressed ? 'hsl(142 75% 50%)' : 'hsl(0 85% 50%)'}, 0 0 10px ${isSwitchPressed ? 'hsl(142 75% 50% / 0.6)' : 'hsl(0 85% 50% / 0.6)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSwitchPressed ? 'hsl(142 75% 50%)' : 'hsl(0 85% 50%)',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                    }}
                  >
                    🔘
                  </div>
                </div>
              )}

              {/* Gate barrier */}
              {switchGate && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${(switchGate.gateRow / gridSize) * 100}%`,
                    left: `${(switchGate.gateCol / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '90%',
                      height: '90%',
                      borderRadius: 6,
                      border: `2px solid ${isSwitchPressed ? 'hsl(142 75% 40%)' : 'hsl(38 95% 50%)'}`,
                      background: isSwitchPressed ? 'hsl(142 75% 10% / 0.6)' : 'hsl(38 95% 10% / 0.9)',
                      boxShadow: `0 0 10px ${isSwitchPressed ? 'hsl(142 75% 40% / 0.5)' : 'hsl(38 95% 50% / 0.5)'}`,
                      backgroundImage: isSwitchPressed
                        ? 'none'
                        : 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(230,170,0,0.2) 5px, rgba(230,170,0,0.2) 10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSwitchPressed ? 'hsl(142 75% 50%)' : 'hsl(38 95% 50%)',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                    }}
                  >
                    {isSwitchPressed ? '🔓 OPEN' : '🚧 GATE'}
                  </div>
                </div>
              )}

              {/* Keyhole slot */}
              {keyhole && (
                <div
                  style={{
                    position: 'absolute',
                    top: `${(keyhole.keyholeRow / gridSize) * 100}%`,
                    left: `${(keyhole.keyholeCol / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '80%',
                      height: '80%',
                      borderRadius: 8,
                      border: `2px dashed ${isTargetUnlocked ? 'hsl(190 100% 50%)' : 'hsl(48 95% 48%)'}`,
                      background: isTargetUnlocked ? 'hsl(190 100% 10% / 0.8)' : 'hsl(48 95% 10% / 0.8)',
                      boxShadow: `0 0 12px ${isTargetUnlocked ? 'hsl(190 100% 50% / 0.7)' : 'hsl(48 95% 48% / 0.7)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isTargetUnlocked ? 'hsl(190 100% 50%)' : 'hsl(48 95% 50%)',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                    }}
                  >
                    🔑
                    <span style={{ fontSize: '0.45rem', marginTop: 1 }}>LOCK</span>
                  </div>
                </div>
              )}

              {/* Dynamic exit neon gate */}
              <div
                style={
                  exitDir === 'left' ? {
                    position: 'absolute',
                    left: -32,
                    top: `${(targetRow / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    width: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    pointerEvents: 'none',
                  } : exitDir === 'down' ? {
                    position: 'absolute',
                    bottom: -32,
                    left: `${(targetCol / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    pointerEvents: 'none',
                  } : exitDir === 'up' ? {
                    position: 'absolute',
                    top: -32,
                    left: `${(targetCol / gridSize) * 100}%`,
                    width: `${(1 / gridSize) * 100}%`,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    pointerEvents: 'none',
                  } : {
                    position: 'absolute',
                    right: -32,
                    top: `${(targetRow / gridSize) * 100}%`,
                    height: `${(1 / gridSize) * 100}%`,
                    width: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                    pointerEvents: 'none',
                  }
                }
              >
                <div
                  style={{
                    background: 'hsl(142 75% 10% / 0.9)',
                    border: '1.5px solid hsl(142 75% 50%)',
                    borderRadius: 4,
                    padding: '2px 4px',
                    fontSize: '0.55rem',
                    fontWeight: 900,
                    color: 'hsl(142 75% 55%)',
                    textTransform: 'uppercase',
                    boxShadow: '0 0 10px hsl(142 75% 50% / 0.8)',
                    whiteSpace: 'nowrap',
                    animation: 'exit-neon-glow 1.5s infinite alternate ease-in-out',
                  }}
                >
                  {exitDir === 'left' ? '⬅️ EXIT' : exitDir === 'down' ? 'EXIT ⬇️' : exitDir === 'up' ? '⬆️ EXIT' : 'EXIT ➡️'}
                </div>
              </div>

              {/* Vehicles Layer */}
              {vehicles.map(v => {
                const isH = v.orientation === 'h'

                // Size mapping in percentage based on active gridSize
                const width = isH ? `${(v.size / gridSize) * 100}%` : `${(1 / gridSize) * 100}%`
                const height = isH ? `${(1 / gridSize) * 100}%` : `${(v.size / gridSize) * 100}%`

                const top = `${(v.row / gridSize) * 100}%`
                const left = `${(v.col / gridSize) * 100}%`

                // Hint Arrow Overlays
                const isHinted = hintHighlight?.vehicleId === v.id
                const hintDirection = hintHighlight?.direction

                return (
                  <div
                    key={v.id}
                    onClick={() => handleVehicleTap(v)}
                    style={{
                      position: 'absolute',
                      width,
                      height,
                      top,
                      left,
                      padding: '2px',
                      boxSizing: 'border-box',
                      cursor: v.isLocked ? 'not-allowed' : 'pointer',
                      zIndex: 2,
                      touchAction: 'none',
                      borderRadius: 12,
                      transition: 'top 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.15), left 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.15)',
                    }}
                    id={`traffic-vehicle-${v.id}`}
                  >
                    {renderVehicleSVG(v)}

                    {/* Padlock / Chain overlay for locked obstacle vehicles */}
                    {v.isLocked && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          border: '2px solid hsl(0, 85%, 50%)',
                          zIndex: 5,
                          pointerEvents: 'none',
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 5px red)', animation: 'pulse-lock 1.5s infinite alternate ease-in-out' }}>
                          🔒
                        </span>
                      </div>
                    )}

                    {/* Padlock overlay on target vehicle if key is not yet in keyhole */}
                    {v.isTarget && !isTargetUnlocked && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          border: '2px dashed hsl(48, 95%, 50%)',
                          zIndex: 5,
                          pointerEvents: 'none',
                        }}
                      >
                        <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 5px hsl(48, 95% 50%))', animation: 'pulse-lock 1.5s infinite alternate ease-in-out' }}>
                          🔒
                        </span>
                      </div>
                    )}

                    {/* Hint indicator arrow inside the vehicle */}
                    {isHinted && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: '1.2rem',
                            background: 'hsl(142 70% 45%)',
                            color: 'white',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 8px hsl(142 70% 45%)',
                            animation: 'pulse-exit 0.8s infinite',
                          }}
                        >
                          {isH
                            ? hintDirection === 'next' ? '➡️' : '⬅️'
                            : hintDirection === 'next' ? '⬇️' : '⬆️'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Action Controls */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleHintClick}
              className="btn btn-secondary"
              style={{ flex: 1.2, borderRadius: 12 }}
              id="traffic-hint-btn"
            >
              <LightbulbIcon size={14} className="inline mr-1 text-yellow-400" /> Hint ({hintsUsed === 0 ? 'Free' : 'Ad'})
            </button>
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12, opacity: undoStack.length === 0 ? 0.45 : 1 }}
              id="traffic-undo-btn"
            >
              ↩️ Undo
            </button>
            <button
              onClick={() => {
                if (level > 50) startLabLevel()
                else startLevel(difficulty, level)
              }}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12 }}
              id="traffic-restart-btn"
            >
              <HistoryIcon size={14} className="inline mr-1" /> Restart
            </button>
            <button
              onClick={() => {
                setSelectedVehicleId(null)
                setStage(level > 50 ? 'endless_lab' : 'setup')
              }}
              className="btn btn-ghost"
              style={{ flex: 0.8, borderRadius: 12 }}
              id="traffic-exit-gameplay-btn"
            >
              <LogOutIcon size={14} className="inline mr-1" /> Exit
            </button>
          </div>
        </div>
      )}

      {/* Sponsored Ad simulation overlay */}
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
          id="traffic-ad-popup"
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
              <div style={{ fontSize: '0.62rem', fontWeight: 900, color: 'hsl(48 95% 50%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.25rem' }}>
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
                id="traffic-claim-ad-reward-btn"
              >
                <GiftIcon size={14} className="inline mr-1 text-pink-400" /> Claim Extra Hint
              </button>
            )}
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes pulse-exit {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.18); opacity: 1; filter: drop-shadow(0 0 5px ${TARGET_COLOR}); }
        }
      `}</style>
    </div>
  )
}
