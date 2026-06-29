'use client'
import { ZapIcon, TrophyIcon, PlayIcon, LogOutIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

// ─── SRS TETROMINO DEFINITIONS & SRS ROTATION DATA ───────────────────────────
type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J'

interface Tetromino {
  type: TetrominoType
  color: string
  grid: number[][]
}

const TETROMINOES: Record<TetrominoType, Tetromino> = {
  I: {
    type: 'I',
    color: '#06b6d4', // Neon Cyan
    grid: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  O: {
    type: 'O',
    color: '#eab308', // Neon Yellow
    grid: [
      [1, 1],
      [1, 1]
    ]
  },
  T: {
    type: 'T',
    color: '#a855f7', // Neon Purple
    grid: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  S: {
    type: 'S',
    color: '#10b981', // Neon Green
    grid: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  Z: {
    type: 'Z',
    color: '#ef4444', // Neon Red
    grid: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    type: 'L',
    color: '#f97316', // Neon Orange
    grid: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  J: {
    type: 'J',
    color: '#3b82f6', // Neon Blue
    grid: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  }
}

// SRS Wall Kick offsets for 3x3 shapes (T, S, Z, L, J)
// Format: [prevRotation][nextRotation] -> list of [x, y] translations
const KICKS_3X3: Record<number, Record<number, number[][]>> = {
  0: {
    1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    3: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  },
  1: {
    0: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    2: [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  },
  2: {
    1: [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    3: [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  },
  3: {
    2: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    0: [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]
  }
}

// SRS Wall Kick offsets for 4x4 shape (I)
const KICKS_I: Record<number, Record<number, number[][]>> = {
  0: {
    1: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    3: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  },
  1: {
    0: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    2: [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  },
  2: {
    1: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    3: [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]
  },
  3: {
    2: [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    0: [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]
  }
}

// ─── SEEDED PRNG SEQUENCE ────────────────────────────────────────────────────
class SeededRandom {
  private seed: number
  constructor(seed: number) { this.seed = seed }
  next() {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getSeedFromDateStr(dateStr: string): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

// ─── VISUAL EFFECT INTERFACES ───────────────────────────────────────────────
interface Particle {
  id: number
  x: number
  y: number
  color: string
  vx: number
  vy: number
  alpha: number
  size: number
}

interface ComboPopup {
  id: number
  text: string
  x: number
  y: number
}

export default function NeonTetrisGame() {
  const { user, submitGameResult } = useGameSession()

  // ─── GAME STATE MACHINE ───
  const [inGame, setInGame] = useState(false)
  const [mode, setMode] = useState<'classic' | 'daily'>('classic')
  const [dailyVariantName, setDailyVariantName] = useState('')

  // Board cell matrix: 20 rows, 10 cols. Stores color strings or null.
  const [board, setBoard] = useState<(string | null)[][]>(() =>
    Array.from({ length: 20 }, () => Array(10).fill(null))
  )

  // Current falling piece data
  const [currentPiece, setCurrentPiece] = useState<Tetromino | null>(null)
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const [currentRotation, setCurrentRotation] = useState(0) // 0 to 3

  // Next piece queue (5 elements)
  const [nextQueue, setNextQueue] = useState<Tetromino[]>([])
  // Held piece
  const [heldPiece, setHeldPiece] = useState<Tetromino | null>(null)
  const [holdUsedThisPlacement, setHoldUsedThisPlacement] = useState(false)

  // Scoring/Combos/Levels
  const [score, setScore] = useState(0)
  const [linesCleared, setLinesCleared] = useState(0)
  const [level, setLevel] = useState(1)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [piecesPlaced, setPiecesPlaced] = useState(0)
  const [perfectClears, setPerfectClears] = useState(0)
  const [hasTetrisRecord, setHasTetrisRecord] = useState(false)

  const [gameOver, setGameOver] = useState(false)
  const [levelUpBanner, setLevelUpBanner] = useState(false)
  const [perfectClearBanner, setPerfectClearBanner] = useState(false)
  const [isScreenShaking, setIsScreenShaking] = useState(false)

  // Particle Canvas & refs
  const [particles, setParticles] = useState<Particle[]>([])
  const [comboPopups, setComboPopups] = useState<ComboPopup[]>([])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nextParticleId = useRef(0)
  const nextPopupId = useRef(0)
  const lastTapRef = useRef<number>(0)

  // Refs for tracking mutable states in animation loops
  const boardRef = useRef<(string | null)[][]>([])
  const currentPieceRef = useRef<Tetromino | null>(null)
  const currentPosRef = useRef({ x: 0, y: 0 })
  const currentRotationRef = useRef(0)
  const nextQueueRef = useRef<Tetromino[]>([])
  const bagRef = useRef<TetrominoType[]>([])
  const prngRef = useRef<SeededRandom | null>(null)

  // Extra refs for E2E debug API synchronous reads
  const scoreRef = useRef(0)
  const linesClearedRef = useRef(0)
  const levelRef = useRef(1)
  const comboRef = useRef(0)
  const piecesPlacedRef = useRef(0)
  const perfectClearsRef = useRef(0)
  const gameOverRef = useRef(false)
  const heldPieceRef = useRef<Tetromino | null>(null)

  // Sync state to refs
  useEffect(() => { boardRef.current = board }, [board])
  useEffect(() => { currentPieceRef.current = currentPiece }, [currentPiece])
  useEffect(() => { currentPosRef.current = currentPos }, [currentPos])
  useEffect(() => { currentRotationRef.current = currentRotation }, [currentRotation])
  useEffect(() => { nextQueueRef.current = nextQueue }, [nextQueue])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { linesClearedRef.current = linesCleared }, [linesCleared])
  useEffect(() => { levelRef.current = level }, [level])
  useEffect(() => { comboRef.current = combo }, [combo])
  useEffect(() => { piecesPlacedRef.current = piecesPlaced }, [piecesPlaced])
  useEffect(() => { perfectClearsRef.current = perfectClears }, [perfectClears])
  useEffect(() => { gameOverRef.current = gameOver }, [gameOver])
  useEffect(() => { heldPieceRef.current = heldPiece }, [heldPiece])

  // Local stats state
  const [localStats, setLocalStats] = useState({
    classic: { highScore: 0, bestCombo: 0, highestLevel: 1, totalLines: 0, avgLines: 0, perfectClears: 0 },
    daily: { highScore: 0, bestCombo: 0, highestLevel: 1, totalLines: 0, avgLines: 0, perfectClears: 0 },
  })

  // ─── LOAD HIGHEST STATS ────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (user) {
      try {
        const res = await fetch('/api/games/neon-tetris/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.stats) {
            setLocalStats(data.stats)
          }
        }
      } catch (err) {
        console.error('Failed to load DB stats:', err)
      }
    } else {
      // LocalStorage for Guest
      try {
        const stored = localStorage.getItem('gamehub_nt_stats')
        if (stored) {
          setLocalStats(JSON.parse(stored))
        }
      } catch {}
    }
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const saveStats = useCallback(async (finalScore: number, finalLines: number, finalCombo: number, finalLevel: number, finalPCs: number) => {
    const statsCopy = { ...localStats }
    let isNewHigh = false

    const target = mode === 'daily' ? statsCopy.daily : statsCopy.classic
    if (finalScore > target.highScore) {
      target.highScore = finalScore
      isNewHigh = true
    }
    target.bestCombo = Math.max(target.bestCombo, finalCombo)
    target.highestLevel = Math.max(target.highestLevel, finalLevel)
    target.totalLines += finalLines
    target.perfectClears += finalPCs

    setLocalStats(statsCopy)
    if (!user) {
      localStorage.setItem('gamehub_nt_stats', JSON.stringify(statsCopy))
    }
    return isNewHigh
  }, [localStats, mode, user])

  // ─── TETROMINO 7-BAG RANDOMIZER ────────────────────────────────────────────
  const refillBag = useCallback(() => {
    const list: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J']
    const prng = prngRef.current
    if (prng) {
      // Seeded Shuffle
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(prng.next() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    } else {
      // Standard Math.random Shuffle
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    }
    bagRef.current = [...bagRef.current, ...list]
  }, [])

  const getNextTetromino = useCallback((): Tetromino => {
    if (bagRef.current.length < 7) {
      refillBag()
    }
    const type = bagRef.current.shift()!
    return JSON.parse(JSON.stringify(TETROMINOES[type]))
  }, [refillBag])

  // ─── COLLISION & LANDING PROJECTOR ──────────────────────────────────────────
  const checkCollision = useCallback(
    (pieceGrid: number[][], offset: { x: number; y: number }, testBoard: (string | null)[][]): boolean => {
      for (let r = 0; r < pieceGrid.length; r++) {
        for (let c = 0; c < pieceGrid[r].length; c++) {
          if (pieceGrid[r][c] !== 0) {
            const boardX = offset.x + c
            const boardY = offset.y + r

            // Check walls
            if (boardX < 0 || boardX >= 10 || boardY >= 20) {
              return true
            }

            // Check stack collision (ignore above grid index checks)
            if (boardY >= 0) {
              if (testBoard[boardY][boardX] !== null) {
                return true
              }
            }
          }
        }
      }
      return false
    },
    []
  )

  const getGhostY = useCallback((): number => {
    const piece = currentPieceRef.current
    const pos = currentPosRef.current
    // rotation not needed for ghost calculation (ghost uses current piece.grid)
    const currentBoard = boardRef.current

    if (!piece) return 0

    let testY = pos.y
    while (!checkCollision(piece.grid, { x: pos.x, y: testY + 1 }, currentBoard)) {
      testY++
    }
    return testY
  }, [checkCollision])

  // ─── ROTATION TRANSFORMATION ───────────────────────────────────────────────
  const rotateMatrixClockwise = (matrix: number[][]): number[][] => {
    const n = matrix.length
    const result = Array.from({ length: n }, () => Array(n).fill(0))
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c]
      }
    }
    return result
  }

  const rotateMatrixCounterClockwise = (matrix: number[][]): number[][] => {
    const n = matrix.length
    const result = Array.from({ length: n }, () => Array(n).fill(0))
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        result[n - 1 - c][r] = matrix[r][c]
      }
    }
    return result
  }

  // ─── VISUAL EFFECTS PIPELINE ───────────────────────────────────────────────
  const spawnLineParticles = useCallback((row: number, color: string) => {
    const newParticles: Particle[] = []
    const yCenter = row * 24 + 12

    for (let c = 0; c < 10; c++) {
      const xCenter = c * 24 + 12
      // Spawn 4 particles per block in the cleared row
      for (let i = 0; i < 4; i++) {
        newParticles.push({
          id: nextParticleId.current++,
          x: xCenter,
          y: yCenter,
          color,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          alpha: 1.0,
          size: 2 + Math.random() * 4
        })
      }
    }
    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  const triggerScreenShake = () => {
    setIsScreenShaking(true)
    setTimeout(() => setIsScreenShaking(false), 250)
  }

  const handleLevelUpAnimation = () => {
    setLevelUpBanner(true)
    setTimeout(() => setLevelUpBanner(false), 2000)
    // Sound hook
    console.log('[SOUND TRIGGER] LEVEL UP! ⚡')
  }

  const handlePCAnimation = () => {
    setPerfectClearBanner(true)
    triggerScreenShake()
    setTimeout(() => setPerfectClearBanner(false), 2500)
  }

  // Particles rendering loop
  useEffect(() => {
    if (particles.length === 0) return
    const frame = requestAnimationFrame(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            alpha: p.alpha - 0.03,
            size: Math.max(0, p.size - 0.05)
          }))
          .filter((p) => p.alpha > 0 && p.size > 0)
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [particles])

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach((p) => {
      ctx.save()
      ctx.globalAlpha = p.alpha
      ctx.fillStyle = p.color
      ctx.shadowBlur = 8
      ctx.shadowColor = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }, [particles])

  // ─── START & PLAY INITS ───────────────────────────────────────────────────
  const initBoard = (variantId: number, prng: SeededRandom | null): (string | null)[][] => {
    const newBoard = Array.from({ length: 20 }, () => Array(10).fill(null))
    const rand = () => prng ? prng.next() : Math.random()
    
    if (variantId === 1) {
      // 2. Garbage Row Start: 4 rows at the bottom (rows 16-19) with 7 random filled cells each
      const colors = ['#06b6d4', '#eab308', '#a855f7', '#10b981', '#ef4444', '#f97316', '#3b82f6']
      for (let r = 16; r < 20; r++) {
        const holeIndex = Math.floor(rand() * 10)
        for (let c = 0; c < 10; c++) {
          if (c !== holeIndex && rand() < 0.8) {
            newBoard[r][c] = colors[Math.floor(rand() * colors.length)]
          }
        }
      }
    } else if (variantId === 2) {
      // 3. Center Obstacle Start: A cross block of obstacles in rows 11-13
      const obstacleColor = 'hsl(220, 15%, 35%)'
      newBoard[11][5] = obstacleColor
      newBoard[12][4] = obstacleColor
      newBoard[12][5] = obstacleColor
      newBoard[12][6] = obstacleColor
      newBoard[13][5] = obstacleColor
    } else if (variantId === 3) {
      // 4. Combo Challenge Start: Staggered columns
      const colors = ['#06b6d4', '#a855f7', '#f97316']
      for (let r = 14; r < 20; r++) {
        for (let c = 0; c < 10; c++) {
          if ((r + c) % 3 === 0 && c !== 4) {
            newBoard[r][c] = colors[(r + c) % colors.length]
          }
        }
      }
    }
    return newBoard
  }

  const startGame = useCallback(() => {
    // Eager ref resets for synchronous E2E debug reads
    gameOverRef.current = false
    heldPieceRef.current = null
    scoreRef.current = 0
    linesClearedRef.current = 0
    levelRef.current = 1
    comboRef.current = 0
    piecesPlacedRef.current = 0
    perfectClearsRef.current = 0
    bagRef.current = []

    setGameOver(false)
    setHeldPiece(null)
    setHoldUsedThisPlacement(false)
    setScore(0)
    setLinesCleared(0)
    setLevel(1)
    setCombo(0)
    setMaxCombo(0)
    setPiecesPlaced(0)
    setPerfectClears(0)
    setHasTetrisRecord(false)

    let variantId = 0 // 0: Clean Start
    let variantName = 'Clean Board Start'

    if (mode === 'daily') {
      const todayStr = new Date().toISOString().split('T')[0]
      const seed = getSeedFromDateStr(todayStr)
      prngRef.current = new SeededRandom(seed)
      variantId = seed % 4

      if (variantId === 1) variantName = 'Garbage Row Start'
      else if (variantId === 2) variantName = 'Center Obstacle Start'
      else if (variantId === 3) variantName = 'Combo Challenge Start'
    } else {
      prngRef.current = null
    }

    setDailyVariantName(variantName)
    const freshBoard = initBoard(variantId, prngRef.current)
    boardRef.current = freshBoard
    setBoard(freshBoard)

    refillBag()
    const firstActive = getNextTetromino()
    const firstQueue = [
      getNextTetromino(),
      getNextTetromino(),
      getNextTetromino(),
      getNextTetromino(),
      getNextTetromino()
    ]

    // Eager ref updates so waitForFunction resolves immediately when state settles
    currentPieceRef.current = firstActive
    currentRotationRef.current = 0
    currentPosRef.current = { x: 3, y: firstActive.type === 'O' ? 0 : -1 }
    nextQueueRef.current = firstQueue

    setCurrentPiece(firstActive)
    setCurrentRotation(0)
    // Starting spawn position
    setCurrentPos({ x: 3, y: firstActive.type === 'O' ? 0 : -1 })
    setNextQueue(firstQueue)
    setInGame(true)
  }, [mode, getNextTetromino, refillBag])

  // ─── SYSTEM CORE LOCK PLACEMENT ─────────────────────────────────────────────
  const lockPiece = useCallback((piece: Tetromino | null, pos: { x: number; y: number }, _rotation: number) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    if (!piece) return

    const updatedBoard = boardRef.current.map(row => [...row])
    
    // 1. Commit cells to grid
    for (let r = 0; r < piece.grid.length; r++) {
      for (let c = 0; c < piece.grid[r].length; c++) {
        if (piece.grid[r][c] !== 0) {
          const boardY = pos.y + r
          const boardX = pos.x + c
          if (boardY >= 0 && boardY < 20 && boardX >= 0 && boardX < 10) {
            updatedBoard[boardY][boardX] = piece.color
          }
        }
      }
    }

    // 2. Identify full rows
    const rowsToClear: number[] = []
    for (let r = 0; r < 20; r++) {
      if (updatedBoard[r].every(cell => cell !== null && cell !== 'hsl(220, 15%, 35%)')) {
        rowsToClear.push(r)
      }
    }

    const clearCount = rowsToClear.length
    let nextScore = scoreRef.current
    let nextCombo = comboRef.current
    let perfectClearTriggered = false
    let isTetris = false

    // Particle explosions and clear animation
    if (clearCount > 0) {
      rowsToClear.forEach(r => {
        // Find a representative color from the row
        const rowColor = updatedBoard[r].find(c => c !== null) || piece.color
        spawnLineParticles(r, rowColor)
      })

      // Standard Line Clearing Math
      const baseScores = { 1: 100, 2: 300, 3: 500, 4: 800 }
      const lineScore = baseScores[clearCount as 1 | 2 | 3 | 4] || 0
      if (clearCount === 4) {
        isTetris = true
        setHasTetrisRecord(true)
        triggerScreenShake()
      }

      nextCombo += 1
      const comboBonus = nextCombo > 1 ? 50 * (nextCombo - 1) : 0
      nextScore += lineScore + comboBonus

      // Add combo float popup
      if (boardRef.current && nextCombo > 1) {
        setComboPopups(prev => [
          ...prev,
          {
            id: nextPopupId.current++,
            text: `COMBO x${nextCombo}! 🔥`,
            x: 120,
            y: rowsToClear[0] * 24
          }
        ])
      }

      // Remove cleared rows and push empty rows on top
      rowsToClear.forEach(r => {
        updatedBoard.splice(r, 1)
        updatedBoard.unshift(Array(10).fill(null))
      })
    } else {
      nextCombo = 0
    }

    // 3. Perfect Clear checks
    const boardIsEmpty = updatedBoard.every(row => row.every(cell => cell === null))
    if (boardIsEmpty && clearCount > 0) {
      perfectClearTriggered = true
      nextScore += 2000 // Huge bonus
      handlePCAnimation()
    }

    // 4. Calculate Level Up (Every 10 Lines)
    const nextLinesCleared = linesClearedRef.current + clearCount
    const nextLevel = Math.floor(nextLinesCleared / 10) + 1
    if (nextLevel > levelRef.current) {
      levelRef.current = nextLevel
      setLevel(nextLevel)
      handleLevelUpAnimation()
    }

    // 5. Piece Tray Cycle
    const nextQ = [...nextQueueRef.current]
    const nextActive = nextQ.shift()!
    nextQ.push(getNextTetromino())

    // 6. Game Over check
    const isOver = updatedBoard[0].some(cell => cell !== null) || checkCollision(nextActive.grid, { x: 3, y: nextActive.type === 'O' ? 0 : -1 }, updatedBoard)

    boardRef.current = updatedBoard
    setBoard(updatedBoard)

    // Eager ref updates — so E2E tests reading refs synchronously after triggerLockPlacement are correct
    scoreRef.current = nextScore
    linesClearedRef.current = nextLinesCleared
    comboRef.current = nextCombo
    piecesPlacedRef.current = piecesPlacedRef.current + 1
    if (perfectClearTriggered) perfectClearsRef.current += 1

    setScore(nextScore)
    setLinesCleared(nextLinesCleared)
    setCombo(nextCombo)
    setMaxCombo(prev => Math.max(prev, nextCombo))
    setPiecesPlaced(prev => prev + 1)
    setHoldUsedThisPlacement(false)

    if (isOver) {
      gameOverRef.current = true
      setGameOver(true)
      triggerGameOver(nextScore, nextLinesCleared, nextCombo, nextLevel, Math.max(maxCombo, nextCombo), perfectClearTriggered ? 1 : 0, isTetris)
    } else {
      currentPieceRef.current = nextActive
      currentRotationRef.current = 0
      currentPosRef.current = { x: 3, y: nextActive.type === 'O' ? 0 : -1 }
      nextQueueRef.current = nextQ
      setCurrentPiece(nextActive)
      setCurrentRotation(0)
      setCurrentPos({ x: 3, y: nextActive.type === 'O' ? 0 : -1 })
      setNextQueue(nextQ)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getNextTetromino, checkCollision, spawnLineParticles])

  // ─── GAME OVER FINAL REGISTRY ──────────────────────────────────────────────
  const triggerGameOver = useCallback(async (
    finalScore: number,
    finalLines: number,
    finalCombo: number,
    finalLevel: number,
    finalMaxCombo: number,
    pcCount: number,
    isTetris: boolean
  ) => {
    await saveStats(finalScore, finalLines, finalMaxCombo, finalLevel, pcCount)

    submitGameResult({
      gameSlug: 'neon-tetris',
      result: finalScore >= 1500 ? 'win' : 'loss',
      metadata: {
        score: finalScore,
        gameMetadata: {
          mode,
          linesCleared: finalLines,
          level: finalLevel,
          maxCombo: finalMaxCombo,
          perfectClears: pcCount,
          hasTetris: isTetris,
          piecesPlaced: piecesPlaced + 1
        }
      }
    })
  }, [saveStats, submitGameResult, mode, piecesPlaced])

  // ─── PIECE ROTATION WITH SRS WALL KICKS ────────────────────────────────────
  const handleRotate = useCallback(
    (dir: 'cw' | 'ccw') => {
      const piece = currentPieceRef.current
      const pos = currentPosRef.current
      const rotation = currentRotationRef.current
      const currentBoard = boardRef.current

      if (!piece) return

      const rotatedGrid = dir === 'cw'
        ? rotateMatrixClockwise(piece.grid)
        : rotateMatrixCounterClockwise(piece.grid)

      const nextRotation = dir === 'cw'
        ? (rotation + 1) % 4
        : (rotation + 3) % 4

      // Retrieve kicking table offsets
      const kicksTable = piece.type === 'I' ? KICKS_I : KICKS_3X3
      const kickList = kicksTable[rotation]?.[nextRotation] || [[0, 0]]

      // SRS Kick Tests
      for (const kick of kickList) {
        const testPos = {
          x: pos.x + kick[0],
          // In standard Tetris grid coordinates, Wall Kicks use positive/negative y-offsets.
          // Note: board rows go downwards, so invert ykick to match screen layout standard SRS coordinates directions
          y: pos.y - kick[1] 
        }

        if (!checkCollision(rotatedGrid, testPos, currentBoard)) {
          // Eager ref updates for synchronous E2E reads
          currentPieceRef.current = { ...piece, grid: rotatedGrid }
          currentRotationRef.current = nextRotation
          currentPosRef.current = testPos
          setCurrentPiece({ ...piece, grid: rotatedGrid })
          setCurrentRotation(nextRotation)
          setCurrentPos(testPos)
          return
        }
      }
    },
    [checkCollision]
  )

  // ─── STANDARD TRANSLATIONAL MOVEMENT ───────────────────────────────────────
  const handleMove = useCallback(
    (dir: 'left' | 'right' | 'down'): boolean => {
      const piece = currentPieceRef.current
      const pos = currentPosRef.current
      const currentBoard = boardRef.current

      if (!piece) return false

      const nextPos = {
        x: dir === 'left' ? pos.x - 1 : dir === 'right' ? pos.x + 1 : pos.x,
        y: dir === 'down' ? pos.y + 1 : pos.y
      }

      if (!checkCollision(piece.grid, nextPos, currentBoard)) {
        currentPosRef.current = nextPos   // eager ref update for synchronous E2E reads
        setCurrentPos(nextPos)
        if (dir === 'down') {
          // Soft Drop score reward
          scoreRef.current += 1
          setScore((s) => s + 1)
        }
        return true
      }

      if (dir === 'down') {
        // Lock piece if it hits obstacle
        lockPiece(piece, pos, currentRotationRef.current)
      }
      return false
    },
    [checkCollision, lockPiece]
  )

  const handleHardDrop = useCallback(() => {
    const piece = currentPieceRef.current
    const pos = currentPosRef.current
    if (!piece) return

    const ghostY = getGhostY()
    const dropDistance = ghostY - pos.y
    const hardDropScore = dropDistance * 2

    scoreRef.current += hardDropScore
    setScore((s) => s + hardDropScore)
    lockPiece(piece, { x: pos.x, y: ghostY }, currentRotationRef.current)
  }, [getGhostY, lockPiece])

  // ─── HOLD SWAP PIECE MECHANISM ─────────────────────────────────────────────
  const handleHold = useCallback(() => {
    const piece = currentPieceRef.current
    if (!piece || holdUsedThisPlacement) return

    const nextQ = [...nextQueueRef.current]
    let nextActive: Tetromino

    if (heldPiece === null) {
      nextActive = nextQ.shift()!
      nextQ.push(getNextTetromino())
      heldPieceRef.current = piece
      setHeldPiece(piece)
    } else {
      nextActive = heldPiece
      heldPieceRef.current = piece
      setHeldPiece(piece)
    }

    nextQueueRef.current = nextQ
    currentPieceRef.current = nextActive
    currentRotationRef.current = 0
    currentPosRef.current = { x: 3, y: nextActive.type === 'O' ? 0 : -1 }
    setNextQueue(nextQ)
    setCurrentPiece(nextActive)
    setCurrentRotation(0)
    setCurrentPos({ x: 3, y: nextActive.type === 'O' ? 0 : -1 })
    setHoldUsedThisPlacement(true)
  }, [heldPiece, holdUsedThisPlacement, getNextTetromino])

  // Expose debug API for E2E testing — uses refs for synchronous reads after trigger calls
  // IMPORTANT: Must be declared AFTER lockPiece, triggerGameOver, handleRotate, handleMove, handleHardDrop, handleHold
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const api: Record<string, unknown> = {
        // Wrapped setters — eagerly update refs so triggerX calls see correct values immediately
        setBoard: (v: (string | null)[][]) => { boardRef.current = v; setBoard(v) },
        setCurrentPiece: (v: typeof currentPieceRef.current) => { currentPieceRef.current = v; setCurrentPiece(v) },
        setCurrentPos: (v: { x: number; y: number }) => { currentPosRef.current = v; setCurrentPos(v) },
        setNextQueue: (v: typeof nextQueueRef.current) => { nextQueueRef.current = v; setNextQueue(v) },
        setHeldPiece: (v: typeof heldPieceRef.current) => { heldPieceRef.current = v; setHeldPiece(v) },
        setScore: (v: number) => { scoreRef.current = v; setScore(v) },
        setLinesCleared: (v: number) => { linesClearedRef.current = v; setLinesCleared(v) },
        setLevel: (v: number) => { levelRef.current = v; setLevel(v) },
        setCombo: (v: number) => { comboRef.current = v; setCombo(v) },
        setMaxCombo,
        setPiecesPlaced: (v: number) => { piecesPlacedRef.current = v; setPiecesPlaced(v) },
        setPerfectClears: (v: number) => { perfectClearsRef.current = v; setPerfectClears(v) },
        setHasTetrisRecord,
        setHoldUsedThisPlacement,
        setGameOver: (v: boolean) => { gameOverRef.current = v; setGameOver(v) },
        startGame,
        // Trigger actions
        triggerLockPlacement: () => lockPiece(currentPieceRef.current, currentPosRef.current, currentRotationRef.current),
        triggerMove: (dir: 'left' | 'right' | 'down') => handleMove(dir),
        triggerRotate: (dir: 'cw' | 'ccw') => handleRotate(dir),
        triggerHardDrop: () => handleHardDrop(),
        triggerHold: () => handleHold(),
        submitResults: () => triggerGameOver(scoreRef.current, linesClearedRef.current, comboRef.current, levelRef.current, maxCombo, perfectClearsRef.current, hasTetrisRecord)
      }
      // Getter properties — always read from refs for synchronous accuracy
      Object.defineProperties(api, {
        board:            { get: () => boardRef.current,         configurable: true, enumerable: true },
        currentPiece:     { get: () => currentPieceRef.current,  configurable: true, enumerable: true },
        currentPos:       { get: () => currentPosRef.current,    configurable: true, enumerable: true },
        currentRotation:  { get: () => currentRotationRef.current, configurable: true, enumerable: true },
        nextQueue:        { get: () => nextQueueRef.current,     configurable: true, enumerable: true },
        heldPiece:        { get: () => heldPieceRef.current,     configurable: true, enumerable: true },
        score:            { get: () => scoreRef.current,         configurable: true, enumerable: true },
        linesCleared:     { get: () => linesClearedRef.current,  configurable: true, enumerable: true },
        level:            { get: () => levelRef.current,         configurable: true, enumerable: true },
        combo:            { get: () => comboRef.current,         configurable: true, enumerable: true },
        piecesPlaced:     { get: () => piecesPlacedRef.current,  configurable: true, enumerable: true },
        perfectClears:    { get: () => perfectClearsRef.current, configurable: true, enumerable: true },
        gameOver:         { get: () => gameOverRef.current,      configurable: true, enumerable: true },
      })
      ;(window as any).__debug_neon_tetris = api
    }
  }, [startGame, lockPiece, handleMove, handleRotate, handleHardDrop, handleHold, triggerGameOver, maxCombo, hasTetrisRecord])

  // ─── GRAVITY TICK TIMER ───────────────────────────────────────────────────
  useEffect(() => {
    if (!inGame || gameOver) return

    // Calculate falling speed per level definition
    // Level 1 = 1000ms
    // Decrement by 100ms per level up to level 9
    // Max speed limits to 200ms
    const speed = Math.max(200, 1000 - (level - 1) * 100)

    const interval = setInterval(() => {
      handleMove('down')
    }, speed)

    return () => clearInterval(interval)
  }, [inGame, gameOver, level, handleMove])

  // ─── FLOATING COMBO POPUPS TIMER ───
  useEffect(() => {
    if (comboPopups.length === 0) return
    const timer = setTimeout(() => {
      setComboPopups((prev) => prev.slice(1))
    }, 1200)
    return () => clearTimeout(timer)
  }, [comboPopups])

  // ─── KEYBOARD HANDLER ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!inGame || gameOver) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft') { handleMove('left') }
      else if (k === 'arrowright') { handleMove('right') }
      else if (k === 'arrowdown') { handleMove('down') }
      else if (k === ' ') { e.preventDefault(); handleHardDrop() }
      else if (k === 'z') { handleRotate('ccw') }
      else if (k === 'x') { handleRotate('cw') }
      else if (k === 'shift') { e.preventDefault(); handleHold() }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inGame, gameOver, handleMove, handleHardDrop, handleRotate, handleHold])

  // ─── REPLAY HANDLER ───
  useEffect(() => {
    const handleReplay = () => {
      startGame()
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [mode, startGame])

  // ─── RENDERERS ─────────────────────────────────────────────────────────────
  if (!inGame) {
    const targetHigh = mode === 'daily' ? localStats.daily : localStats.classic

    return (
      <div
        className="card glass animate-fadeIn"
        style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: 420,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        id="tetris-setup-menu"
      >
        <div>
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes neonCyanPulse {
              0%, 100% {
                text-shadow: 0 0 4px #fff, 0 0 8px #06b6d4, 0 0 16px #06b6d4, 0 0 24px #0891b2;
              }
              50% {
                text-shadow: 0 0 2px #fff, 0 0 4px #06b6d4, 0 0 8px #06b6d4, 0 0 12px #0891b2;
              }
            }
            @keyframes neonPurplePulse {
              0%, 100% {
                text-shadow: 0 0 4px #fff, 0 0 8px #d946ef, 0 0 16px #d946ef, 0 0 24px #c084fc;
              }
              50% {
                text-shadow: 0 0 2px #fff, 0 0 4px #d946ef, 0 0 8px #d946ef, 0 0 12px #c084fc;
              }
            }
            @keyframes neonFlicker {
              0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
                opacity: 1;
                filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.6));
              }
              20%, 24%, 55% {
                opacity: 0.75;
                filter: drop-shadow(0 0 2px rgba(6, 182, 212, 0.2));
              }
            }
          `}} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', animation: 'neonFlicker 4s infinite' }}><ZapIcon size={48} className="text-yellow-400" /></div>
          <h1 style={{ 
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontWeight: 950, 
            fontSize: '2.5rem', 
            margin: 0, 
            letterSpacing: '0.05em', 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '0.6rem',
            lineHeight: 1.2
          }}>
            <span style={{ color: '#06b6d4', animation: 'neonCyanPulse 2s infinite alternate' }}>NEON</span>
            <span style={{ color: '#d946ef', animation: 'neonPurplePulse 2.5s infinite alternate' }}>TETRIS</span>
          </h1>
          <div style={{ display: 'inline-block', marginTop: '0.6rem', marginBottom: '0.4rem' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 800, 
              color: '#f43f5e', 
              border: '1.5px solid #f43f5e', 
              padding: '2px 10px', 
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              boxShadow: '0 0 10px rgba(244, 63, 94, 0.4)',
              textShadow: '0 0 4px #f43f5e'
            }}>
              Arcade Edition
            </span>
          </div>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.85rem', marginTop: '0.8rem', lineHeight: 1.45 }}>
            Slide, rotate, and drop Tetrominoes. Clear rows to score points, unlock achievements, and climb the Leaderboards!
          </p>
        </div>

        {/* Mode Tab Selection */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'hsl(222 20% 6%)',
            padding: '4px',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'classic' ? 'hsl(220 100% 60%)' : 'transparent',
              color: mode === 'classic' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setMode('classic')}
            id="nt-classic-tab"
          >
            Classic Mode
          </button>
          <button
            style={{
              flex: 1,
              padding: '0.55rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: mode === 'daily' ? 'hsl(220 100% 60%)' : 'transparent',
              color: mode === 'daily' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setMode('daily')}
            id="nt-daily-tab"
          >
            Daily Challenge
          </button>
        </div>

        {/* High stats preview card */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '14px',
            padding: '1rem',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <TrophyIcon size={14} className="inline mr-1 text-yellow-400" /> MODE STATS RECORD
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)' }}>High Score</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 850, color: 'white' }}>
                {targetHigh.highScore.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)' }}>Max Level</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 850, color: 'hsl(270 80% 70%)' }}>
                Lvl {targetHigh.highestLevel}
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={startGame}
          style={{ width: '100%', borderRadius: 12, padding: '0.75rem', fontWeight: 800, boxShadow: '0 0 15px rgba(6, 182, 212, 0.3)' }}
          id="nt-start-btn"
        >
          <PlayIcon size={14} className="inline mr-1" /> Play Mode
        </button>
      </div>
    )
  }

  // Draw board cell style helpers
  const ghostY = getGhostY()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        maxWidth: '520px',
        margin: '0 auto',
        padding: '0.25rem',
        boxSizing: 'border-box',
      }}
      className={`animate-fadeIn ${isScreenShaking ? 'screen-shake' : ''}`}
    >
      {/* ── Top HUD strip ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '0.5rem 1rem',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Score</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }} id="nt-score-hud">{score}</div>
        </div>

        {mode === 'daily' && (
          <div style={{ textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: 800, color: '#06b6d4', border: '1px solid #06b6d4', padding: '2px 8px', borderRadius: '4px' }}>
            📅 {dailyVariantName}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Lines</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#eab308', textAlign: 'center' }}>{linesCleared}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>Level</div>
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#a855f7', textAlign: 'center' }}>{level}</div>
          </div>
        </div>

        <button
          onClick={() => setInGame(false)}
          className="btn btn-secondary"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', borderRadius: '6px' }}
        >
          <LogOutIcon size={14} className="inline mr-1" /> Quit
        </button>
      </div>

      {/* ── Main Layout: Hold + Board + Next Queue ── */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          width: '100%',
          boxSizing: 'border-box',
          alignItems: 'flex-start',
        }}
      >
        {/* Left column: Hold Slot Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '70px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'hsl(220, 10%, 60%)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hold</div>
          <div
            style={{
              aspectRatio: '1',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '2px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxSizing: 'border-box',
              padding: '6px',
            }}
            id="nt-hold-slot"
          >
            {heldPiece ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${heldPiece.grid[0].length}, 1fr)`,
                  gap: '1px',
                  width: '80%',
                  height: '80%',
                }}
              >
                {heldPiece.grid.map((row, r) =>
                  row.map((val, c) => (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        backgroundColor: val === 1 ? heldPiece.color : 'transparent',
                        borderRadius: '1px',
                        aspectRatio: '1',
                        boxShadow: val === 1 ? `0 0 6px ${heldPiece.color}` : 'none',
                      }}
                    />
                  ))
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.55rem', color: 'hsl(220 10% 40%)', fontWeight: 800 }}>EMPTY</span>
            )}
            {holdUsedThisPlacement && heldPiece && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 900, color: '#ef4444' }}>
                LOCKED
              </div>
            )}
          </div>
        </div>

        {/* Center: 10x20 Glass Board */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            aspectRatio: '0.5',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '2px solid rgba(6, 182, 212, 0.25)',
            boxShadow: '0 0 20px rgba(6, 182, 212, 0.1), inset 0 0 15px rgba(255,255,255,0.01)',
            borderRadius: '16px',
            padding: '6px',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        >
          {/* Grid Layout of Cells */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gridTemplateRows: 'repeat(20, 1fr)',
              gap: '2px',
              width: '100%',
              height: '100%',
            }}
            id="nt-board"
          >
            {/* Danger Zone Indicator Warning Line */}
            <div
              style={{
                gridColumn: '1 / 11',
                gridRow: '1',
                height: '2px',
                background: 'linear-gradient(90deg, transparent, #eab308, #f97316, #eab308, transparent)',
                zIndex: 10,
                alignSelf: 'end',
                pointerEvents: 'none',
                animation: 'dangerPulse 1.5s infinite ease-in-out',
                position: 'relative'
              }}
            />
            {board.map((row, r) =>
              row.map((cellColor, c) => {
                // Determine if this cell contains current falling piece
                let activeColor: string | null = null
                if (currentPiece) {
                  const relativeR = r - currentPos.y
                  const relativeC = c - currentPos.x
                  if (
                    relativeR >= 0 &&
                    relativeR < currentPiece.grid.length &&
                    relativeC >= 0 &&
                    relativeC < currentPiece.grid[relativeR].length
                  ) {
                    if (currentPiece.grid[relativeR][relativeC] !== 0) {
                      activeColor = currentPiece.color
                    }
                  }
                }

                // Determine if this cell contains the transparent ghost piece
                let isGhost = false
                if (!activeColor && currentPiece) {
                  const relativeR = r - ghostY
                  const relativeC = c - currentPos.x
                  if (
                    relativeR >= 0 &&
                    relativeR < currentPiece.grid.length &&
                    relativeC >= 0 &&
                    relativeC < currentPiece.grid[relativeR].length
                  ) {
                    if (currentPiece.grid[relativeR][relativeC] !== 0) {
                      isGhost = true
                    }
                  }
                }

                const finalColor = cellColor || activeColor
                const cellStyle: React.CSSProperties = {
                  borderRadius: '3px',
                  aspectRatio: '1',
                  transition: 'all 0.05s ease',
                  boxSizing: 'border-box',
                }

                if (finalColor) {
                  cellStyle.backgroundColor = finalColor
                  cellStyle.boxShadow = `0 0 8px ${finalColor}a0, inset 0 0 4px rgba(255,255,255,0.4)`
                } else if (isGhost && currentPiece) {
                  cellStyle.border = `1.5px dashed ${currentPiece.color}`
                  cellStyle.backgroundColor = `${currentPiece.color}18`
                } else {
                  cellStyle.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                  cellStyle.border = '1px solid rgba(255, 255, 255, 0.03)'
                }

                const handleActiveCellDoubleClick = () => {
                  handleRotate('cw')
                }

                const handleActiveCellTouchStart = (e: React.TouchEvent) => {
                  const now = Date.now()
                  if (now - lastTapRef.current < 300) {
                    e.preventDefault();
                    handleRotate('cw')
                    lastTapRef.current = 0
                  } else {
                    lastTapRef.current = now
                  }
                }

                return (
                  <div
                    key={`${r}-${c}`}
                    style={activeColor ? { ...cellStyle, cursor: 'pointer' } : cellStyle}
                    data-row={r}
                    data-col={c}
                    onDoubleClick={activeColor ? handleActiveCellDoubleClick : undefined}
                    onTouchStart={activeColor ? handleActiveCellTouchStart : undefined}
                  />
                )
              })
            )}
          </div>

          {/* Particles canvas overlay */}
          <canvas
            ref={canvasRef}
            width={240}
            height={480}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              zIndex: 10
            }}
          />

          {/* Combo Popups Overlay */}
          {comboPopups.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: p.x,
                top: p.y,
                color: '#ec4899',
                textShadow: '0 0 10px #ec4899',
                fontSize: '0.85rem',
                fontWeight: 900,
                animation: 'floatUpAndFade 1.2s forwards',
                zIndex: 20
              }}
            >
              {p.text}
            </div>
          ))}

          {/* Level Up Banner Overlay */}
          {levelUpBanner && (
            <div className="banner-alert" style={{ background: 'linear-gradient(90deg, transparent, #a855f7c0, transparent)' }}>
              ⚡ LEVEL UP! ⚡
            </div>
          )}

          {/* Perfect Clear Banner Overlay */}
          {perfectClearBanner && (
            <div className="banner-alert" style={{ background: 'linear-gradient(90deg, transparent, #06b6d4c0, transparent)' }}>
              ✨ PERFECT CLEAR! ✨
            </div>
          )}
        </div>

        {/* Right column: Next Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '70px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.55rem', fontWeight: 900, color: 'hsl(220, 10%, 60%)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {nextQueue.map((piece, idx) => (
              <div
                key={idx}
                style={{
                  aspectRatio: '1',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  padding: '5px',
                  opacity: idx === 0 ? 1.0 : 0.45
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${piece.grid[0].length}, 1fr)`,
                    gap: '1px',
                    width: '75%',
                    height: '75%',
                  }}
                >
                  {piece.grid.map((row, r) =>
                    row.map((val, c) => (
                      <div
                        key={`${r}-${c}`}
                        style={{
                          backgroundColor: val === 1 ? piece.color : 'transparent',
                          borderRadius: '1px',
                          aspectRatio: '1',
                          boxShadow: val === 1 ? `0 0 4px ${piece.color}` : 'none',
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile Action Control drawer ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          width: '100%',
          boxSizing: 'border-box',
          padding: '0 0.5rem',
          marginTop: '0.25rem',
        }}
        className="mobile-controls-panel"
      >
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={handleHold} className="btn-nt-control" id="nt-btn-hold">Hold</button>
          <button onClick={() => handleRotate('ccw')} className="btn-nt-control" id="nt-btn-rot-ccw">↺ Rot</button>
          <button onClick={() => handleRotate('cw')} className="btn-nt-control" id="nt-btn-rot-cw">Rot ↻</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button onClick={() => handleMove('left')} className="btn-nt-control" id="nt-btn-left" style={{ flex: 1 }}>← Left</button>
          <button onClick={() => handleMove('down')} className="btn-nt-control" id="nt-btn-down">↓ Soft</button>
          <button onClick={handleHardDrop} className="btn-nt-control" id="nt-btn-hard">⬇️ Hard</button>
          <button onClick={() => handleMove('right')} className="btn-nt-control" id="nt-btn-right" style={{ flex: 1 }}>Right →</button>
        </div>
      </div>

      {/* Styles */}
      <style jsx global>{`
        @keyframes dangerPulse {
          0%, 100% {
            opacity: 0.6;
            box-shadow: 0 0 6px #f97316, 0 0 12px #eab308;
          }
          50% {
            opacity: 1.0;
            box-shadow: 0 0 16px #ef4444, 0 0 28px #f97316;
          }
        }
        .screen-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        .banner-alert {
          position: absolute;
          top: 40%;
          left: 0;
          right: 0;
          padding: 0.75rem 0;
          text-align: center;
          font-size: 1.25rem;
          font-weight: 950;
          color: white;
          text-shadow: 0 0 12px white;
          z-index: 99;
          animation: bannerIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes bannerIn {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .btn-nt-control {
          background: rgba(30, 41, 59, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          font-weight: 800;
          font-size: 0.8rem;
          padding: 0.5rem 0.85rem;
          border-radius: 8px;
          cursor: pointer;
          min-width: 55px;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          transition: all 0.15s;
        }
        .btn-nt-control:active {
          transform: scale(0.95);
          background: rgba(6, 182, 212, 0.25);
          border-color: #06b6d4;
        }
        @media (min-width: 768px) {
          .mobile-controls-panel {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
