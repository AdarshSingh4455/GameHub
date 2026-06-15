'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { incrementDailyChallengeProgress } from '@/lib/dailyChallenges'

// --- Types ---
type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'pro'
type GameState = 'setup' | 'playing' | 'gameover'

interface Dot {
  r: number
  c: number
  color: string
  id: number
}

// --- Seeded PRNG ---
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
  for (let i = 0; i < seedStr.length; i++) {
    const k = seedStr.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h4 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  return mulberry32((h1 ^ h2 ^ h3 ^ h4) >>> 0)
}

const GRID_SIZES: Record<Difficulty, number> = {
  easy: 4,
  medium: 5,
  hard: 6,
  expert: 7,
  pro: 8,
}

// --- Solution-First Level Generator ---
function generateFlowPuzzle(difficulty: Difficulty, levelNum: number): {
  size: number
  colors: string[]
  dots: Dot[]
  solvedPaths: [number, number][][]
} {
  const size = GRID_SIZES[difficulty]
  const rng = getSeededRandom(`wc-flow-${difficulty}-${levelNum}`)
  
  const ALL_COLORS = [
    'hsl(0 100% 50%)',     // Red
    'hsl(215 100% 50%)',   // Blue
    'hsl(142 80% 45%)',    // Green
    'hsl(48 100% 50%)',    // Yellow
    'hsl(280 95% 55%)',    // Purple
    'hsl(28 100% 50%)',    // Orange
    'hsl(180 100% 45%)',   // Cyan
    'hsl(325 100% 50%)',   // Magenta
    'hsl(90 90% 45%)',     // Lime
    'hsl(15 90% 40%)',     // Brown
  ]

  let attempts = 0
  while (attempts < 3000) {
    attempts++
    const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(-1))
    const paths: [number, number][][] = []
    let pathId = 0

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== -1) continue

        const currentPath: [number, number][] = [[r, c]]
        grid[r][c] = pathId
        let curR = r
        let curC = c
        let len = 1

        while (true) {
          const neighbors: [number, number][] = []
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
          for (const [dr, dc] of dirs) {
            const nr = curR + dr
            const nc = curC + dc
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === -1) {
              neighbors.push([nr, nc])
            }
          }

          if (neighbors.length === 0) break
          if (len >= 2 && rng() < 0.22) break // probability to stop growing

          const [nr, nc] = neighbors[Math.floor(rng() * neighbors.length)]
          currentPath.push([nr, nc])
          grid[nr][nc] = pathId
          curR = nr
          curC = nc
          len++
        }

        paths.push(currentPath)
        pathId++
      }
    }

    // Attempt to merge isolated single-cell paths to endpoints of adjacent multi-cell paths
    const len1Paths = paths.filter(p => p.length === 1)
    const validPaths = paths.filter(p => p.length > 1)
    let mergeFailed = false

    for (const p1 of len1Paths) {
      const cell = p1[0]
      let merged = false

      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      const rngNeighbors = dirs.map(([dr, dc]) => [cell[0] + dr, cell[1] + dc])
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)

      for (const [nr, nc] of rngNeighbors) {
        // Find if this neighbor is the endpoint of a valid path
        const parentPath = validPaths.find(p => 
          (p[0][0] === nr && p[0][1] === nc) || 
          (p[p.length - 1][0] === nr && p[p.length - 1][1] === nc)
        )

        if (parentPath) {
          if (parentPath[0][0] === nr && parentPath[0][1] === nc) {
            parentPath.unshift(cell)
          } else {
            parentPath.push(cell)
          }
          merged = true
          break
        }
      }

      if (!merged) {
        mergeFailed = true
        break
      }
    }

    if (!mergeFailed && validPaths.length > 0) {
      // Validate path count match sizing targets
      const minColors = Math.max(3, Math.floor(size * 0.8))
      const maxColors = Math.min(ALL_COLORS.length, Math.floor(size * 1.3))
      if (validPaths.length >= minColors && validPaths.length <= maxColors) {
        const colors = [...ALL_COLORS.slice(0, validPaths.length)]
        for (let i = colors.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [colors[i], colors[j]] = [colors[j], colors[i]]
        }

        const dots: Dot[] = []
        validPaths.forEach((path, idx) => {
          const start = path[0]
          const end = path[path.length - 1]
          const color = colors[idx]
          dots.push({ r: start[0], c: start[1], color, id: idx })
          dots.push({ r: end[0], c: end[1], color, id: idx })
        })

        return { size, colors, dots, solvedPaths: validPaths }
      }
    }
  }

  // Final fallback (horizontal stripes)
  const colors = ALL_COLORS.slice(0, size)
  const dots: Dot[] = []
  const solvedPaths: [number, number][][] = []
  for (let r = 0; r < size; r++) {
    const path: [number, number][] = []
    for (let c = 0; c < size; c++) {
      path.push([r, c])
    }
    solvedPaths.push(path)
    dots.push({ r, c: 0, color: colors[r], id: r })
    dots.push({ r, c: size - 1, color: colors[r], id: r })
  }
  return { size, colors, dots, solvedPaths }
}

export default function WaterConnectGame() {
  const { user, submitGameResult } = useGameSession()
  const { addToast } = useToast()
  const toastCompat = (id: string, title: string, message: string) => {
    addToast(id as any, title, message)
  }

  // --- States ---
  const [gameState, setGameState] = useState<GameState>('setup')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [playMode, setPlayMode] = useState<'easy' | 'challenge'>('challenge')
  const [level, setLevel] = useState<number>(1)
  const [size, setSize] = useState<number>(4)
  const [dots, setDots] = useState<Dot[]>([])
  const [playerPaths, setPlayerPaths] = useState<Record<number, [number, number][]>>({})
  
  // Stats
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [shakeActive, setShakeActive] = useState(false)
  
  // Targets
  const [goldTime, setGoldTime] = useState(30)
  const [silverTime, setSilverTime] = useState(50)
  const [bronzeTime, setBronzeTime] = useState(75)

  // Interactive drawing states
  const [activeColorId, setActiveColorId] = useState<number | null>(null)
  const [drawingPath, setDrawingPath] = useState<[number, number][]>([])

  // Modal / Preview Overlay
  const [showPreview, setShowPreview] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [victoryCelebration, setVictoryCelebration] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const winHandledRef = useRef(false)

  // --- Seeding & Progression ---
  const progressKey = user ? `gamehub_waterconnect_progress_${user.id}` : 'gamehub_waterconnect_progress_guest'
  const [completedLevelsCount, setCompletedLevelsCount] = useState<number>(0)

  useEffect(() => {
    const savedLvl = localStorage.getItem(progressKey)
    if (savedLvl) {
      setCompletedLevelsCount(parseInt(savedLvl, 10))
    }
  }, [progressKey])

  // --- Timer ---
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  // --- Start Level ---
  const startLevel = useCallback((diff: Difficulty, lvl: number) => {
    const puzzle = generateFlowPuzzle(diff, lvl)
    setSize(puzzle.size)
    setDots(puzzle.dots)
    setPlayerPaths({})
    setDrawingPath([])
    setActiveColorId(null)
    setMoveCount(0)
    setTimeElapsed(0)
    setHintsUsed(0)
    setVictoryCelebration(false)
    winHandledRef.current = false

    // Config gold/silver targets based on grid sizes
    const gt = puzzle.size * 8
    const st = Math.round(gt * 1.6)
    const bt = Math.round(st * 1.5)
    setGoldTime(gt)
    setSilverTime(st)
    setBronzeTime(bt)

    setDifficulty(diff)
    setLevel(lvl)
    setShowPreview(true)
    setTimerRunning(false)
    setGameState('playing')
  }, [])

  // Listen to Global Replay / Next events from global GameSessionContext modal
  useEffect(() => {
    const handleReplay = () => {
      if (gameState === 'playing' || gameState === 'gameover') {
        startLevel(difficulty, level)
      }
    }
    const handleNext = () => {
      if (level < 50) {
        const nextLvl = level + 1
        let nextDiff = difficulty
        if (nextLvl <= 10) nextDiff = 'easy'
        else if (nextLvl <= 20) nextDiff = 'medium'
        else if (nextLvl <= 30) nextDiff = 'hard'
        else if (nextLvl <= 40) nextDiff = 'expert'
        else nextDiff = 'pro'
        startLevel(nextDiff, nextLvl)
      } else {
        setGameState('setup')
      }
    }

    window.addEventListener('gamehub_replay', handleReplay)
    window.addEventListener('gamehub_next_level', handleNext)
    return () => {
      window.removeEventListener('gamehub_replay', handleReplay)
      window.removeEventListener('gamehub_next_level', handleNext)
    }
  }, [level, difficulty, gameState, startLevel])

  // --- Win Check ---
  useEffect(() => {
    if (gameState !== 'playing' || dots.length === 0 || winHandledRef.current) return

    // 1. All colors must have complete paths connecting their dots
    const uniqueColorIds = Array.from(new Set(dots.map(d => d.id)))
    const allConnected = uniqueColorIds.every(cid => {
      const path = playerPaths[cid]
      if (!path || path.length < 2) return false
      
      const startCell = path[0]
      const endCell = path[path.length - 1]
      
      const d1 = dots.find(d => d.id === cid && d.r === startCell[0] && d.c === startCell[1])
      const d2 = dots.find(d => d.id === cid && d.r === endCell[0] && d.c === endCell[1])
      
      const alternativeStart = dots.find(d => d.id === cid && d.r === endCell[0] && d.c === endCell[1])
      const alternativeEnd = dots.find(d => d.id === cid && d.r === startCell[0] && d.c === startCell[1])

      return (d1 && d2) || (alternativeStart && alternativeEnd)
    })

    if (!allConnected) return

    if (playMode === 'easy') {
      triggerVictory()
    } else {
      // 2. Challenge Mode: The entire grid must be fully filled
      const totalFilledCells = Object.values(playerPaths).reduce((sum, p) => sum + p.length, 0)
      const boardFullyFilled = totalFilledCells === size * size

      if (boardFullyFilled) {
        triggerVictory()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPaths, dots, size, gameState, playMode])

  const triggerVictory = () => {
    if (winHandledRef.current) return
    winHandledRef.current = true
    setTimerRunning(false)
    setVictoryCelebration(true)

    // Calculate score, with penalty for hints used
    const hintPenalty = hintsUsed * 150
    const calculatedScore = Math.max(50, 1000 - timeElapsed * 10 - moveCount * 5 - hintPenalty)
    let finalStars = 1
    if (hintsUsed === 0) {
      if (timeElapsed <= goldTime) finalStars = 3
      else if (timeElapsed <= silverTime) finalStars = 2
    } else if (hintsUsed === 1) {
      // Max 2 stars if 1 hint used
      if (timeElapsed <= silverTime) finalStars = 2
    } else {
      // Max 1 star if multiple hints used
      finalStars = 1
    }

    // Save campaign progression
    if (level > completedLevelsCount && completedLevelsCount < 50) {
      localStorage.setItem(progressKey, level.toString())
      setCompletedLevelsCount(level)
    }

    // Increment Daily Challenges
    incrementDailyChallengeProgress('wc_complete_3', 1, user, toastCompat)
    if (timeElapsed <= goldTime) {
      incrementDailyChallengeProgress('wc_speed_run', 1, user, toastCompat)
    }
    if (hintsUsed === 0) {
      incrementDailyChallengeProgress('wc_no_hints', 1, user, toastCompat)
    }

    // Achievements unlock will be verified on backend via routes.
    // If guest, simulate achievements unlocked callback
    if (!user) {
      const unlocked = JSON.parse(localStorage.getItem('gamehub_guest_achievements') || '[]') as string[]
      const newlyUnlocked: string[] = []
      
      if (!unlocked.includes('wc-first-flow')) {
        newlyUnlocked.push('wc-first-flow')
        unlocked.push('wc-first-flow')
      }
      if (level >= 5 && !unlocked.includes('wc-apprentice')) {
        newlyUnlocked.push('wc-apprentice')
        unlocked.push('wc-apprentice')
      }
      if (level >= 25 && !unlocked.includes('wc-master')) {
        newlyUnlocked.push('wc-master')
        unlocked.push('wc-master')
      }
      if (level >= 25 && !unlocked.includes('wc-25-completed')) {
        newlyUnlocked.push('wc-25-completed')
        unlocked.push('wc-25-completed')
      }

      if (newlyUnlocked.length > 0) {
        localStorage.setItem('gamehub_guest_achievements', JSON.stringify(unlocked))
        newlyUnlocked.forEach(slug => {
          const name = slug === 'wc-first-flow' ? 'First Flow' : slug === 'wc-apprentice' ? 'Puzzle Apprentice' : 'Puzzle Master'
          const xp = slug === 'wc-first-flow' ? 50 : slug === 'wc-apprentice' ? 100 : 250
          addToast('achievement_unlocked', 'Achievement Unlocked! 🏆', `${name} (+${xp} XP)`)
        })
      }
    }

    setTimeout(() => {
      submitGameResult({
        gameSlug: 'water-connect',
        result: 'win',
        metadata: {
          score: calculatedScore,
          gameMetadata: {
            difficulty,
            level,
            mode: playMode,
            moves: moveCount,
            timeSecs: timeElapsed,
            stars: finalStars,
            goldTime,
            silverTime,
          }
        }
      })
    }, 1500) // 1.5s delay to let flow visual complete
  }

  // --- Hint System ---
  const handleHintClick = () => {
    if (gameState !== 'playing' || victoryCelebration) return

    // Find the correct solved path path for any color that isn't connected correctly
    const puzzle = generateFlowPuzzle(difficulty, level)
    const solvedPaths = puzzle.solvedPaths

    // Find first color index that is either not connected or does not match solution path
    let targetColorId = -1
    for (let idx = 0; idx < solvedPaths.length; idx++) {
      const solution = solvedPaths[idx]
      const playerPath = playerPaths[idx]

      if (!playerPath || playerPath.length !== solution.length) {
        targetColorId = idx
        break
      }

      // Check coordinates matching
      const matches = solution.every((cell, cidx) => 
        (playerPath[cidx][0] === cell[0] && playerPath[cidx][1] === cell[1]) ||
        (playerPath[playerPath.length - 1 - cidx][0] === cell[0] && playerPath[playerPath.length - 1 - cidx][1] === cell[1])
      )

      if (!matches) {
        targetColorId = idx
        break
      }
    }

    if (targetColorId === -1) {
      addToast('info', 'All Correct! 💡', 'You already have the correct path layout, just cover the rest of the cells.')
      return
    }

    // Draw the entire solution path for this target color
    setHintsUsed(prev => prev + 1)
    const correctPath = solvedPaths[targetColorId]

    // Clear any overlapping other player paths and set the hint path
    setPlayerPaths(prev => {
      const next = { ...prev }
      const cellsToOverWrite = new Set(correctPath.map(([r, c]) => `${r},${c}`))
      
      // Clean up overlapping cells in other paths
      Object.keys(next).forEach(cidStr => {
        const cid = parseInt(cidStr, 10)
        if (cid !== targetColorId && next[cid]) {
          next[cid] = next[cid].filter(([r, c]) => !cellsToOverWrite.has(`${r},${c}`))
          if (next[cid].length < 2) {
            delete next[cid]
          }
        }
      })
      
      // Set the correct solved path for the target color
      next[targetColorId] = correctPath
      return next
    })

    addToast('info', 'Path Hint Revealed! 💡', 'A matching connection is solved for you.')
  }

  const triggerShake = () => {
    setShakeActive(true)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80)
    }
    setTimeout(() => {
      setShakeActive(false)
    }, 500)
  }

  // --- Touch/Mouse Draw Handling ---
  const handleCellStart = (e: React.MouseEvent | React.TouchEvent, r: number, c: number) => {
    if (gameState !== 'playing' || victoryCelebration || showPreview) return

    // Prevent text selection / default drag behavior
    e.preventDefault()

    const dot = dots.find(d => d.r === r && d.c === c)
    if (dot) {
      setActiveColorId(dot.id)
      setDrawingPath([[r, c]])
      setMoveCount(prev => prev + 1)

      // Clear existing path of this color
      setPlayerPaths(prev => {
        const next = { ...prev }
        delete next[dot.id]
        return next
      })
    } else {
      // Find if this cell is part of an existing player path
      let colorId: number | null = null
      let truncatedPath: [number, number][] = []

      for (const [cidStr, path] of Object.entries(playerPaths)) {
        const idx = path.findIndex(cell => cell[0] === r && cell[1] === c)
        if (idx !== -1) {
          colorId = parseInt(cidStr, 10)
          // Truncate path up to this cell
          truncatedPath = path.slice(0, idx + 1)
          break
        }
      }

      if (colorId !== null) {
        setActiveColorId(colorId)
        setDrawingPath(truncatedPath)
        setMoveCount(prev => prev + 1)

        setPlayerPaths(prev => ({
          ...prev,
          [colorId!]: truncatedPath
        }))
      }
    }
  }

  const handleCellEnter = (r: number, c: number) => {
    if (activeColorId === null) return

    const last = drawingPath[drawingPath.length - 1]
    if (last[0] === r && last[1] === c) return // same cell

    // Adjacency check
    const diffR = Math.abs(last[0] - r)
    const diffC = Math.abs(last[1] - c)
    const isAdjacent = (diffR === 1 && diffC === 0) || (diffR === 0 && diffC === 1)

    if (!isAdjacent) {
      // Ignore non-adjacent transitions silently during quick drags
      return
    }

    // Check if entering a dot
    const dot = dots.find(d => d.r === r && d.c === c)

    if (dot) {
      if (dot.id !== activeColorId) {
        // Block crossing other color dot
        triggerShake()
        return
      }

      // Matching dot! Complete path connection.
      if (drawingPath.length >= 1) {
        const finalPath = [...drawingPath, [r, c]] as [number, number][]
        setPlayerPaths(prev => ({
          ...prev,
          [activeColorId]: finalPath
        }))
        // Reset drawing state
        setActiveColorId(null)
        setDrawingPath([])
        return
      }
    }

    // Check if dragged backward (truncate path)
    const prevIndex = drawingPath.findIndex(cell => cell[0] === r && cell[1] === c)
    if (prevIndex !== -1) {
      const truncated = drawingPath.slice(0, prevIndex + 1)
      setDrawingPath(truncated)
      setPlayerPaths(prev => ({
        ...prev,
        [activeColorId]: truncated
      }))
      return
    }

    // Check if this cell intersects another color's path (crossing path warning)
    let intersectsOther = false
    Object.entries(playerPaths).forEach(([cidStr, path]) => {
      const cid = parseInt(cidStr, 10)
      if (cid === activeColorId) return
      if (path.some(cell => cell[0] === r && cell[1] === c)) {
        intersectsOther = true
      }
    })
    if (intersectsOther) {
      triggerShake()
    }

    // Clear and truncate any overlapping other colors (paths cannot cross)
    setPlayerPaths(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(cidStr => {
        const cid = parseInt(cidStr, 10)
        if (cid === activeColorId) return
        if (next[cid]) {
          const intersectIdx = next[cid].findIndex(cell => cell[0] === r && cell[1] === c)
          if (intersectIdx !== -1) {
            // Truncate the crossed path up to the intersection cell to avoid straight gaps
            const truncated = next[cid].slice(0, intersectIdx)
            if (truncated.length < 2) {
              delete next[cid]
            } else {
              next[cid] = truncated
            }
          }
        }
      })
      return next
    })

    // Update active drawing path
    const nextPath = [...drawingPath, [r, c]] as [number, number][]
    setDrawingPath(nextPath)
    
    // Save current drawing state temporarily in playerPaths so it renders live
    setPlayerPaths(prev => ({
      ...prev,
      [activeColorId]: nextPath
    }))
  }

  const handleDrawEnd = () => {
    setActiveColorId(null)
    setDrawingPath([])
  }

  // Touch handlers for mobile
  const handleTouchMove = (e: React.TouchEvent) => {
    if (activeColorId === null) return
    const touch = e.touches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    if (element) {
      const cellElement = element.closest('[data-cell-id]')
      if (cellElement) {
        const cellId = cellElement.getAttribute('data-cell-id')
        if (cellId) {
          const [r, c] = cellId.split('-').map(Number)
          handleCellEnter(r, c)
        }
      }
    }
  }

  const getValidAdjacentCells = useCallback(() => {
    if (activeColorId === null || drawingPath.length === 0) return []
    const [r, c] = drawingPath[drawingPath.length - 1]
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    const valid: [number, number][] = []
    
    for (const [dr, dc] of dirs) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        // Check if it contains a dot of a different color
        const dot = dots.find(d => d.r === nr && d.c === nc)
        if (!dot || dot.id === activeColorId) {
          valid.push([nr, nc])
        }
      }
    }
    return valid
  }, [activeColorId, drawingPath, size, dots])

  const getSvgPathData = (path: [number, number][]) => {
    if (path.length === 0) return ''
    return path.map((cell, idx) => {
      const r = cell[0]
      const c = cell[1]
      const x = ((c + 0.5) / size) * 100
      const y = ((r + 0.5) / size) * 100
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  // --- Renders ---
  if (gameState === 'setup') {
    return (
      <div
        className="card glass animate-fadeIn"
        style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: 390,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        id="waterconnect-setup-menu"
      >
        <div>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>💧</div>
          <h2 style={{ fontWeight: 900, fontSize: '1.55rem', margin: 0, color: 'white', letterSpacing: '-0.02em' }}>Water Connect</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.3rem', lineHeight: 1.45 }}>
            Redesigned flow puzzle game! Connect all matching color nodes to cover the entire grid. Paths cannot cross!
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em', textAlign: 'left' }}>
            Game Mode
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setPlayMode('easy')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: 10,
                border: '1px solid',
                borderColor: playMode === 'easy' ? 'hsl(215 90% 50%)' : 'hsl(220 15% 18%)',
                background: playMode === 'easy' ? 'hsl(215 90% 50% / 0.15)' : 'hsl(222 18% 10%)',
                color: playMode === 'easy' ? 'white' : 'hsl(220 10% 60%)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              id="waterconnect-mode-easy"
            >
              🟢 Easy Mode
            </button>
            <button
              onClick={() => setPlayMode('challenge')}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: 10,
                border: '1px solid',
                borderColor: playMode === 'challenge' ? 'hsl(215 90% 50%)' : 'hsl(220 15% 18%)',
                background: playMode === 'challenge' ? 'hsl(215 90% 50% / 0.15)' : 'hsl(222 18% 10%)',
                color: playMode === 'challenge' ? 'white' : 'hsl(220 10% 60%)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              id="waterconnect-mode-challenge"
            >
              🔥 Challenge Mode
            </button>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', textAlign: 'left', lineHeight: 1.35, marginTop: '2px' }}>
            {playMode === 'easy' 
              ? '🟢 Easy Mode: Connect all matching color pairs. Grid fill does not matter.' 
              : '🔥 Challenge Mode: Connect all matching pairs AND fill 100% of grid cells.'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em', textAlign: 'left' }}>
            Choose Campaign Level
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '6px',
              background: 'hsl(222 20% 8%)',
              borderRadius: 12,
              border: '1px solid hsl(220 15% 15%)',
            }}
          >
            {Array.from({ length: 50 }).map((_, idx) => {
              const lvlNum = idx + 1
              const isCompleted = completedLevelsCount >= lvlNum
              const isPlayable = lvlNum <= completedLevelsCount + 1

              let difficultyColor = 'hsl(220 10% 40%)'
              let lvlDiff: Difficulty = 'easy'
              
              if (lvlNum <= 10) { lvlDiff = 'easy'; difficultyColor = 'hsl(142 80% 45%)' }
              else if (lvlNum <= 20) { lvlDiff = 'medium'; difficultyColor = 'hsl(215 90% 50%)' }
              else if (lvlNum <= 30) { lvlDiff = 'hard'; difficultyColor = 'hsl(48 95% 48%)' }
              else if (lvlNum <= 40) { lvlDiff = 'expert'; difficultyColor = 'hsl(280 80% 55%)' }
              else { lvlDiff = 'pro'; difficultyColor = 'hsl(0 85% 50%)' }

              return (
                <button
                  key={`lvl-${lvlNum}`}
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
                  {isPlayable ? lvlNum : '🔒'}
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
                        background: difficultyColor,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Dimensions setup for the responsive layout
  const gridTemplate = `repeat(${size}, 1fr)`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: 'min(100%, 75vh, 480px)',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
      }}
      className="animate-fadeIn"
      id="waterconnect-active-game"
      onMouseUp={handleDrawEnd}
      onMouseLeave={handleDrawEnd}
    >
      {/* 1. Level Start Preview Overlay */}
      {showPreview && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 500,
            background: 'hsl(222 20% 6% / 0.98)',
            borderRadius: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            padding: '2rem 1.5rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          }}
          id="waterconnect-level-preview"
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.8rem', marginBottom: '0.25rem' }}>💧</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', margin: 0 }}>
              Water Connect
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'hsl(220 10% 55%)', marginTop: '0.2rem' }}>
              Level {level} — {playMode === 'easy' ? 'Easy Mode' : 'Challenge Mode'} (Board: {size}x{size})
            </div>
          </div>

          <div
            style={{
              background: 'hsl(222 18% 12%)',
              borderRadius: 16,
              padding: '1.25rem 1.5rem',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              border: '1px solid hsl(220 15% 18%)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'center', letterSpacing: '0.08em' }}>
              Completion Targets
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem' }}>🥇</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(45 100% 55%)' }}>{goldTime}s</div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Gold</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem' }}>🥈</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(210 70% 65%)' }}>{silverTime}s</div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Silver</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem' }}>🥉</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(28 80% 60%)' }}>{bronzeTime}s</div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Bronze</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setShowPreview(false)
              setTimerRunning(true)
            }}
            style={{
              background: 'hsl(215 90% 50%)',
              border: 'none',
              borderRadius: 14,
              padding: '0.85rem 3rem',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 20px hsl(215 90% 50% / 0.4)',
              letterSpacing: '0.02em',
            }}
            id="waterconnect-preview-play-btn"
          >
            ▶️ Connect Flows!
          </button>
        </div>
      )}

      {/* 2. Top Stats HUD */}
      <div
        style={{
          padding: '0.6rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'hsl(222 18% 13%)',
          borderRadius: 14,
          border: '1px solid hsl(220 15% 16%)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }} id="waterconnect-mode-label">
            {playMode === 'easy' ? 'Easy Mode' : 'Challenge Mode'}
          </span>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }} id="waterconnect-board-label">
            Board: {size}x{size}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.55rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Moves</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white' }}>{moveCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.55rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Time</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>
              {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.55rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Target</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(220 10% 60%)' }}>🥇{goldTime}s</span>
          </div>
        </div>
      </div>

      {/* 3. The Grid Canvas Board */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gridTemplateRows: gridTemplate,
          gap: '4px',
          background: 'hsl(222 20% 7%)',
          padding: '6px',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          aspectRatio: '1',
          width: '100%',
          position: 'relative',
          touchAction: 'none', // Prevents scrolling while drag drawing on mobile
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        className={shakeActive ? 'wc-shake-grid' : ''}
        id="waterconnect-grid"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleDrawEnd}
      >
        {/* Continuous SVG pipes overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
            overflow: 'visible',
          }}
          viewBox="0 0 100 100"
        >
          <defs>
            {Array.from(new Map(dots.map(d => [d.id, d])).values()).map(d => (
              <filter key={`wc-glow-filter-${d.id}`} id={`wc-glow-filter-${d.id}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>
          {Object.entries(playerPaths).map(([cidStr, path]) => {
            const cid = parseInt(cidStr, 10)
            const dot = dots.find(d => d.id === cid)
            if (!dot || path.length < 1) return null

            const isPathCompleted = playerPaths[cid] && playerPaths[cid].length >= 2 && 
              ((dots.find(d => d.id === cid && d.r === path[0][0] && d.c === path[0][1]) &&
                dots.find(d => d.id === cid && d.r === path[path.length - 1][0] && d.c === path[path.length - 1][1])) ||
               (dots.find(d => d.id === cid && d.r === path[path.length - 1][0] && d.c === path[path.length - 1][1]) &&
                dots.find(d => d.id === cid && d.r === path[0][0] && d.c === path[0][1])))

            return (
              <g key={`path-group-${cid}`}>
                {/* 1. Outer Soft Glow Pipe */}
                <path
                  d={getSvgPathData(path)}
                  fill="none"
                  stroke={dot.color}
                  strokeWidth={(100 / size) * 0.45}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.35}
                  filter={`url(#wc-glow-filter-${cid})`}
                  style={{
                    transition: 'stroke-width 0.1s ease',
                  }}
                />
                {/* 2. Thick Neon Main Pipe */}
                <path
                  d={getSvgPathData(path)}
                  fill="none"
                  stroke={dot.color}
                  strokeWidth={(100 / size) * 0.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.95}
                  style={{
                    transition: 'stroke-width 0.1s ease',
                  }}
                />
                {/* 3. Completed Flow Animation (Bright Inner Core) */}
                {isPathCompleted && (
                  <path
                    d={getSvgPathData(path)}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={(100 / size) * 0.08}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.7}
                    strokeDasharray="12 24"
                    style={{
                      animation: 'wc-water-flow 1.5s linear infinite',
                    }}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {Array.from({ length: size }).map((_, r) =>
          Array.from({ length: size }).map((_, c) => {
            const dot = dots.find(d => d.r === r && d.c === c)
            
            // Check if dot is connected completely
            const isDotCompleted = dot
              ? playerPaths[dot.id] && playerPaths[dot.id].length >= 2 && 
                (playerPaths[dot.id][0][0] === r && playerPaths[dot.id][0][1] === c ||
                 playerPaths[dot.id][playerPaths[dot.id].length - 1][0] === r && playerPaths[dot.id][playerPaths[dot.id].length - 1][1] === c)
              : false

            const validAdjacents = getValidAdjacentCells()
            const isActiveAdjacent = activeColorId !== null &&
              validAdjacents.some(([ar, ac]) => ar === r && ac === c)
            
            const activeColorDot = activeColorId !== null ? dots.find(d => d.id === activeColorId) : null
            const activeColor = activeColorDot ? activeColorDot.color : ''

            return (
              <div
                key={`${r}-${c}`}
                data-cell-id={`${r}-${c}`}
                onMouseDown={(e) => handleCellStart(e, r, c)}
                onMouseEnter={() => handleCellEnter(r, c)}
                onTouchStart={(e) => handleCellStart(e, r, c)}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  background: 'hsl(222 18% 10% / 0.8)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'visible',
                  cursor: dot ? 'pointer' : 'default',
                  border: isActiveAdjacent ? `2.5px dashed ${activeColor}` : '1px solid hsl(220 15% 14%)',
                  boxShadow: isActiveAdjacent ? `0 0 10px ${activeColor}bb, inset 0 0 10px rgba(0,0,0,0.4)` : 'inset 0 0 10px rgba(0,0,0,0.4)',
                  animation: isActiveAdjacent ? 'wc-pulse 1.2s infinite ease-in-out' : 'none',
                  transition: 'border 0.2s ease, box-shadow 0.2s ease',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                {/* Dot node */}
                {dot && (
                  <div
                    style={{
                      width: 'clamp(14px, 4.5vw, 24px)',
                      height: 'clamp(14px, 4.5vw, 24px)',
                      borderRadius: '50%',
                      backgroundColor: dot.color,
                      zIndex: 2,
                      boxShadow: `0 0 16px ${dot.color}, inset 0 0 6px white`,
                      transform: activeColorId === dot.id ? 'scale(1.35)' : 'scale(1)',
                      animation: isDotCompleted 
                        ? 'none' 
                        : activeColorId === dot.id
                        ? 'none'
                        : 'colorsort-splash-ripple 1.8s ease-in-out infinite',
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {/* 4. Action Control Panel */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 1.5, borderRadius: 12 }}
          onClick={handleHintClick}
          id="waterconnect-hint-btn"
        >
          💡 Solve Path Hint
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, borderRadius: 12 }}
          onClick={() => {
            setGameState('setup')
            setTimerRunning(false)
          }}
          id="waterconnect-quit-btn"
        >
          🏳️ Setup
        </button>
      </div>

      {/* Confetti celebration overlay */}
      {victoryCelebration && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '3rem',
            animation: 'fadeIn 0.5s ease-out',
            background: 'rgba(5, 8, 16, 0.45)',
            backdropFilter: 'blur(4px)',
            borderRadius: 20
          }}
        >
          <div style={{ textAlign: 'center', color: 'hsl(45 100% 55%)', textShadow: '0 0 10px hsl(45 100% 55% / 0.5)', fontWeight: 900 }}>
            🎉 FLOW COMPLETE!
          </div>
        </div>
      )}

      {/* Dynamic CSS Inject for Water Connect */}
      <style jsx global>{`
        @keyframes wc-water-flow {
          from {
            stroke-dashoffset: 24;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes wc-pulse {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.02); opacity: 1; }
        }
        @keyframes wc-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .wc-shake-grid {
          animation: wc-shake 0.4s ease-in-out !important;
          border-color: hsl(0 100% 50% / 0.6) !important;
          box-shadow: 0 0 25px hsl(0 100% 50% / 0.4) !important;
        }
      `}</style>
    </div>
  )
}
