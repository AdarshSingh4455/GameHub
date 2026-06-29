'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'

// ─── CONFIGURATION & DATA STRUCTURES ────────────────────────────────────────

export interface BubbleLevelConfig {
  level: number
  name: string
  objective: 'clear' | 'rescue' | 'score'
  objectiveText: string
  maxShots: number
  targetScore?: number
  targetRescues?: number
  gridColors: string[]
  initialGridLayout: number[][]
}

const BUBBLE_COLORS = [
  '#ef4444', // 1: Red
  '#3b82f6', // 2: Blue
  '#22c55e', // 3: Green
  '#eab308', // 4: Yellow
  '#a855f7', // 5: Purple
  '#06b6d4', // 6: Cyan
]

const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Cyan']

// Handcrafted tutorial levels (Level 1, 2, 3)
const LEVELS: BubbleLevelConfig[] = [
  {
    level: 1,
    name: "Whispering Woods",
    objective: 'clear',
    objectiveText: "Clear all bubbles!",
    maxShots: 20,
    gridColors: ['#ef4444', '#3b82f6', '#22c55e', '#eab308'],
    initialGridLayout: [
      [1, 1, 2, 2, 3, 3, 4, 4],
      [1, 2, 2, 3, 3, 4, 4],
      [0, 0, 7, 0, 0, 8, 0, 0],
      [2, 2, 3, 3, 4, 4, 1],
      [3, 3, 4, 4, 1, 1, 2],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
  {
    level: 2,
    name: "Kitten Rescue",
    objective: 'rescue',
    objectiveText: "Rescue the trapped kittens!",
    maxShots: 25,
    targetRescues: 3,
    gridColors: ['#ef4444', '#3b82f6', '#a855f7', '#06b6d4'],
    initialGridLayout: [
      [3, 9, 3, 4, 9, 4, 5, 9],
      [3, 3, 4, 4, 5, 5, 6],
      [0, 0, 7, 0, 0, 7, 0, 0],
      [5, 5, 6, 6, 3, 3, 4, 4],
      [0, 0, 8, 0, 0, 8, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
  {
    level: 3,
    name: "Mystic Temple",
    objective: 'score',
    objectiveText: "Score 5,000 points!",
    maxShots: 15,
    targetScore: 5000,
    gridColors: ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4'],
    initialGridLayout: [
      [1, 2, 3, 4, 5, 6, 1, 2],
      [8, 8, 0, 0, 0, 8, 8],
      [3, 4, 5, 6, 1, 2, 3, 4],
      [0, 7, 0, 0, 0, 7, 0],
      [5, 6, 1, 2, 3, 4, 5, 6],
      [0, 8, 0, 0, 0, 8, 0],
      [1, 2, 3, 4, 5, 6, 1, 2],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
]

// Procedural Level Generator for Level 4+
export function getLevelConfig(level: number): BubbleLevelConfig {
  if (level <= 3) {
    return LEVELS[level - 1]
  }

  // Linear feedback pseudo-random generator
  const seed = level * 13579
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000
    return x - Math.floor(x)
  }

  const name = `Level ${level}`
  const objectives: ('clear' | 'rescue' | 'score')[] = ['clear', 'rescue', 'score']
  const objective = objectives[(level - 4) % 3]

  // Scale colors and layouts
  const colorCount = Math.min(6, 3 + Math.floor((level - 4) / 3))
  const activeColors = BUBBLE_COLORS.slice(0, colorCount)
  const baseShots = 22
  const maxShots = Math.max(12, baseShots + Math.floor(level / 3) - Math.floor(level / 6) * 2)

  const initialRows = Math.min(11, 5 + Math.floor((level - 4) / 2))
  const initialGridLayout: number[][] = []

  let targetRescues = 0
  let targetScore = 0
  let objectiveText = ''

  if (objective === 'rescue') {
    targetRescues = 2 + Math.floor(level / 4)
    objectiveText = `Rescue the ${targetRescues} trapped kittens!`
  } else if (objective === 'score') {
    targetScore = 4000 + (level - 4) * 800
    objectiveText = `Score ${targetScore.toLocaleString()} points!`
  } else {
    objectiveText = 'Clear all bubbles!'
  }

  let kittenSpotsLeft = targetRescues
  const cols = 8

  for (let r = 0; r < initialRows; r++) {
    const colsInRow = r % 2 === 0 ? cols : cols - 1
    const rowData: number[] = []

    for (let c = 0; c < colsInRow; c++) {
      const randVal = random(r * 100 + c)

      if (objective === 'rescue' && kittenSpotsLeft > 0 && r < 3 && randVal < 0.25) {
        rowData.push(9) // Kitten
        kittenSpotsLeft--
      } else if (randVal < 0.05 + Math.min(0.08, level * 0.004)) {
        // Special bubbles: 7=Rainbow, 8=Fireball
        rowData.push(random(r * 200 + c) < 0.5 ? 7 : 8)
      } else if (randVal < 0.82) {
        const colIdx = 1 + Math.floor(random(r * 300 + c) * colorCount)
        rowData.push(colIdx)
      } else {
        rowData.push(0)
      }
    }
    initialGridLayout.push(rowData)
  }

  // Backup placement for kittens if they weren't fully placed
  if (objective === 'rescue' && kittenSpotsLeft > 0) {
    for (let c = 0; c < cols; c++) {
      if (kittenSpotsLeft > 0 && initialGridLayout[0][c] !== 9) {
        initialGridLayout[0][c] = 9
        kittenSpotsLeft--
      }
    }
  }

  return {
    level,
    name,
    objective,
    objectiveText,
    maxShots,
    targetScore,
    targetRescues,
    gridColors: activeColors,
    initialGridLayout,
  }
}

// Web Audio API Sound Synthesizer
const playSound = (type: string, isMuted: boolean) => {
  if (isMuted || typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime

    switch (type) {
      case 'shoot':
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15)
        gain.gain.setValueAtTime(0.08, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
        osc.start(now)
        osc.stop(now + 0.15)
        break
      case 'bounce':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.setValueAtTime(554, now + 0.05)
        gain.gain.setValueAtTime(0.05, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
        osc.start(now)
        osc.stop(now + 0.1)
        break
      case 'pop':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08)
        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
        osc.start(now)
        osc.stop(now + 0.08)
        break
      case 'combo':
        osc.type = 'sine'
        osc.frequency.setValueAtTime(600, now)
        osc.frequency.setValueAtTime(800, now + 0.05)
        osc.frequency.setValueAtTime(1000, now + 0.1)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.start(now)
        osc.stop(now + 0.25)
        break
      case 'explosion':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(150, now)
        osc.frequency.linearRampToValueAtTime(40, now + 0.4)
        gain.gain.setValueAtTime(0.2, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.4)
        break
      case 'victory':
        const notes = [523.25, 659.25, 783.99, 1046.50]
        notes.forEach((freq, idx) => {
          const oscN = ctx.createOscillator()
          const gainN = ctx.createGain()
          oscN.connect(gainN)
          gainN.connect(ctx.destination)
          oscN.type = 'sine'
          oscN.frequency.setValueAtTime(freq, now + idx * 0.08)
          gainN.gain.setValueAtTime(0.1, now + idx * 0.08)
          gainN.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2)
          oscN.start(now + idx * 0.08)
          oscN.stop(now + idx * 0.08 + 0.2)
        })
        break
      case 'failure':
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, now)
        osc.frequency.linearRampToValueAtTime(110, now + 0.5)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
        osc.start(now)
        osc.stop(now + 0.5)
        break
    }
  } catch (e) {
    console.error('Sound synthesis error:', e)
  }
}

interface Bubble {
  x: number
  y: number
  colorIndex: number // 1-6 normal, 7=rainbow, 8=fireball, 9=kitten
  radius: number
  state: 'idle' | 'popping' | 'falling'
  popProgress?: number
  fallVelX?: number
  fallVelY?: number
}

interface ActiveShot {
  x: number
  y: number
  vx: number
  vy: number
  colorIndex: number
  radius: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  radius: number
  alpha: number
  decay: number
}

interface FloatingText {
  id: string
  text: string
  x: number
  y: number
  color: string
  alpha: number
  life: number
}

export default function BubbleShooterSagaGame() {
  const { submitGameResult } = useGameSession()
  const { addToast } = useToast()

  // Game UI/Screen navigation states
  const [screen, setScreen] = useState<'map' | 'game'>('map')
  const [activeLevel, setActiveLevel] = useState<BubbleLevelConfig | null>(null)
  
  // Game session states
  const [unlockedLevels, setUnlockedLevels] = useState<number[]>([1])
  const [bestScores, setBestScores] = useState<Record<number, number>>({})
  const [starsEarned, setStarsEarned] = useState<Record<number, number>>({})
  const [totalGames, setTotalGames] = useState(0)
  const [highestCombo, setHighestCombo] = useState(0)

  const [score, setScore] = useState(0)
  const [shotsLeft, setShotsLeft] = useState(0)
  const [rescuesCount, setRescuesCount] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Canvas Refs & Game Engine coordinates
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  const COLS_COUNT = 8
  const ROWS_COUNT = 15 // increased height
  const CANVAS_WIDTH = 480 // expanded width
  const CANVAS_HEIGHT = 720 // expanded height
  const BUBBLE_RADIUS = 26
  const HEX_HEIGHT = 45

  // Engine state references (to bypass React rendering overhead)
  const stateRef = useRef({
    grid: [] as (Bubble | null)[][], // Hexagonal grid representation
    shot: null as ActiveShot | null,
    nextColorsQueue: [] as number[], // queue of next bubbles
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    angle: -Math.PI / 2, // launcher angle
    aimTargetX: 0,
    aimTargetY: 0,
    consecutiveMisses: 0, // for ceiling drop mechanic
    comboCount: 0,
    localScore: 0,
    localRescues: 0,
    localShots: 0,
    isPoppingOrFalling: false,
    ceilingOffsetY: 0,
    isShooting: false,
    gameFinishedTriggered: false,
  })

  // Load Saved Game Progress
  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedUnlocked = localStorage.getItem('gamehub_bs_unlocked')
    const savedScores = localStorage.getItem('gamehub_bs_scores')
    const savedStars = localStorage.getItem('gamehub_bs_stars')
    const savedTotalGames = localStorage.getItem('gamehub_bs_total_games')
    const savedHighCombo = localStorage.getItem('gamehub_bs_highest_combo')
    const savedMuted = localStorage.getItem('gamehub_bs_muted')

    if (savedUnlocked) setUnlockedLevels(JSON.parse(savedUnlocked))
    if (savedScores) setBestScores(JSON.parse(savedScores))
    if (savedStars) setStarsEarned(JSON.parse(savedStars))
    if (savedTotalGames) setTotalGames(parseInt(savedTotalGames, 10))
    if (savedHighCombo) setHighestCombo(parseInt(savedHighCombo, 10))
    if (savedMuted) setIsMuted(savedMuted === 'true')
  }, [])

  // Save Progress Helper
  const saveProgress = (newUnlocked: number[], newScores: Record<number, number>, newStars: Record<number, number>, combo: number) => {
    localStorage.setItem('gamehub_bs_unlocked', JSON.stringify(newUnlocked))
    localStorage.setItem('gamehub_bs_scores', JSON.stringify(newScores))
    localStorage.setItem('gamehub_bs_stars', JSON.stringify(newStars))
    localStorage.setItem('gamehub_bs_highest_combo', Math.max(highestCombo, combo).toString())
    localStorage.setItem('gamehub_bs_total_games', (totalGames + 1).toString())
    setUnlockedLevels(newUnlocked)
    setBestScores(newScores)
    setStarsEarned(newStars)
    setTotalGames(prev => prev + 1)
    setHighestCombo(prev => Math.max(prev, combo))
  }

  // Generate color sequence based on level colors
  const getRandomLevelColorIndex = (config: BubbleLevelConfig) => {
    const randomHex = config.gridColors[Math.floor(Math.random() * config.gridColors.length)]
    return BUBBLE_COLORS.indexOf(randomHex) + 1
  }

  // Hex coordinate converter to Pixel x, y
  const getHexCoordinates = useCallback((row: number, col: number) => {
    const isOdd = row % 2 !== 0
    const boardMargin = (CANVAS_WIDTH - (COLS_COUNT * BUBBLE_RADIUS * 2)) / 2
    const startX = boardMargin + (isOdd ? BUBBLE_RADIUS * 1.5 : BUBBLE_RADIUS)
    const x = startX + col * BUBBLE_RADIUS * 2
    const y = BUBBLE_RADIUS + row * HEX_HEIGHT + stateRef.current.ceilingOffsetY
    return { x, y }
  }, [BUBBLE_RADIUS])

  // Start active game session
  const startGame = useCallback((config: BubbleLevelConfig) => {
    setActiveLevel(config)
    setIsPaused(false)
    setScore(0)
    setShotsLeft(config.maxShots)
    setRescuesCount(0)

    const engine = stateRef.current
    engine.localScore = 0
    engine.localRescues = 0
    engine.localShots = config.maxShots
    engine.consecutiveMisses = 0
    engine.comboCount = 0
    engine.particles = []
    engine.floatingTexts = []
    engine.ceilingOffsetY = 0
    engine.shot = null
    engine.isShooting = false
    engine.angle = -Math.PI / 2
    engine.gameFinishedTriggered = false

    // Initialize Grid with Level layout
    const grid: (Bubble | null)[][] = Array(ROWS_COUNT).fill(null).map(() => Array(COLS_COUNT).fill(null))
    for (let r = 0; r < config.initialGridLayout.length; r++) {
      for (let c = 0; c < config.initialGridLayout[r].length; c++) {
        const val = config.initialGridLayout[r][c]
        if (val > 0) {
          const { x, y } = getHexCoordinates(r, c)
          grid[r][c] = {
            x,
            y,
            colorIndex: val,
            radius: BUBBLE_RADIUS,
            state: 'idle',
          }
        }
      }
    }
    engine.grid = grid

    // Set launcher queue
    engine.nextColorsQueue = [
      getRandomLevelColorIndex(config),
      getRandomLevelColorIndex(config),
      getRandomLevelColorIndex(config)
    ]

    setScreen('game')
  }, [getHexCoordinates, BUBBLE_RADIUS])

  // Mouse / Touch Aim Handler
  const handleAimMove = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || isPaused || stateRef.current.gameFinishedTriggered) return
    const rect = canvas.getBoundingClientRect()
    
    // Scale aim coordinates relative to virtual size
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT

    stateRef.current.aimTargetX = x
    stateRef.current.aimTargetY = y

    // Calculate angle from launcher bottom center
    const launcherX = CANVAS_WIDTH / 2
    const launcherY = CANVAS_HEIGHT - 60
    const dx = x - launcherX
    const dy = y - launcherY

    // Limit angle so player doesn't shoot backwards/down
    let angle = Math.atan2(dy, dx)
    if (angle > -0.15) angle = -0.15
    if (angle < -Math.PI + 0.15) angle = -Math.PI + 0.15
    stateRef.current.angle = angle
  }, [isPaused])

  const onMouseMove = (e: React.MouseEvent) => {
    handleAimMove(e.clientX, e.clientY)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleAimMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }

  // Trigger bubble shooting
  const triggerShoot = useCallback(() => {
    const engine = stateRef.current
    if (engine.isShooting || engine.shot || isPaused || engine.gameFinishedTriggered || engine.localShots <= 0) return

    const launcherX = CANVAS_WIDTH / 2
    const launcherY = CANVAS_HEIGHT - 60
    const speed = 13
    const vx = Math.cos(engine.angle) * speed
    const vy = Math.sin(engine.angle) * speed

    // Extract next bubble from queue
    const colorIndex = engine.nextColorsQueue.shift() || 1
    engine.nextColorsQueue.push(getRandomLevelColorIndex(activeLevel!))

    engine.shot = {
      x: launcherX,
      y: launcherY,
      vx,
      vy,
      colorIndex,
      radius: BUBBLE_RADIUS,
    }
    engine.isShooting = true
    engine.localShots--
    setShotsLeft(engine.localShots)

    playSound('shoot', isMuted)
  }, [activeLevel, isPaused, isMuted, BUBBLE_RADIUS])

  // Swap Queue Bubble
  const swapBubble = () => {
    const engine = stateRef.current
    if (engine.isShooting || isPaused || engine.gameFinishedTriggered) return
    const temp = engine.nextColorsQueue[0]
    engine.nextColorsQueue[0] = engine.nextColorsQueue[1]
    engine.nextColorsQueue[1] = temp
    playSound('bounce', isMuted)
  }

  // Synthesize popping particles
  const createExplosion = (x: number, y: number, color: string) => {
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 4.5
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: 2 + Math.random() * 3.5,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02,
      })
    }
  }

  // Add floating text
  const addFloatingText = (text: string, x: number, y: number, color = '#fbbf24') => {
    stateRef.current.floatingTexts.push({
      id: Math.random().toString(),
      text,
      x,
      y,
      color,
      alpha: 1,
      life: 45,
    })
  }

  // Popping cluster logic (Flood-fill)
  const processMatchPops = (hitRow: number, hitCol: number) => {
    const engine = stateRef.current
    const target = engine.grid[hitRow][hitCol]
    if (!target) return

    const color = target.colorIndex
    const isFireball = color === 8
    const isRainbow = color === 7

    const popped = new Set<string>()
    const queue: [number, number][] = []

    if (isFireball) {
      playSound('explosion', isMuted)
      for (let r = Math.max(0, hitRow - 1); r <= Math.min(ROWS_COUNT - 1, hitRow + 1); r++) {
        const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
        for (let c = 0; c < colsInRow; c++) {
          if (engine.grid[r][c]) {
            popped.add(`${r},${c}`)
          }
        }
      }
    } else {
      queue.push([hitRow, hitCol])
      popped.add(`${hitRow},${hitCol}`)

      const neighborsOffsetEven = [
        [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]
      ]
      const neighborsOffsetOdd = [
        [-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]
      ]

      while (queue.length > 0) {
        const [r, c] = queue.shift()!
        const currBubble = engine.grid[r][c]
        if (!currBubble) continue

        const currColor = currBubble.colorIndex
        const offsets = r % 2 === 0 ? neighborsOffsetEven : neighborsOffsetOdd

        for (const [dr, dc] of offsets) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < ROWS_COUNT && nc >= 0 && nc < COLS_COUNT) {
            const neighbor = engine.grid[nr][nc]
            if (neighbor && neighbor.state === 'idle') {
              const key = `${nr},${nc}`
              if (!popped.has(key)) {
                const isMatch = isRainbow || currColor === 7 || neighbor.colorIndex === 7 || neighbor.colorIndex === currColor || neighbor.colorIndex === 9
                if (isMatch) {
                  popped.add(key)
                  if (neighbor.colorIndex !== 9) {
                    queue.push([nr, nc])
                  }
                }
              }
            }
          }
        }
      }
    }

    if (popped.size >= 3 || isFireball) {
      engine.comboCount++
      const comboMult = engine.comboCount
      
      let scoreGained = 0
      let rescuedLocal = 0

      popped.forEach((key) => {
        const [r, c] = key.split(',').map(Number)
        const b = engine.grid[r][c]
        if (b) {
          b.state = 'popping'
          b.popProgress = 0

          if (b.colorIndex === 9) {
            rescuedLocal++
          }

          const basePoints = b.colorIndex === 7 ? 200 : b.colorIndex === 8 ? 250 : 100
          scoreGained += basePoints * comboMult
        }
      })

      engine.localScore += scoreGained
      setScore(engine.localScore)

      if (rescuedLocal > 0) {
        engine.localRescues += rescuedLocal
        setRescuesCount(engine.localRescues)
        addFloatingText(`Rescued +${rescuedLocal}!`, BUBBLE_RADIUS * 8, CANVAS_HEIGHT / 2, '#3b82f6')
      }

      if (comboMult > 1) {
        addFloatingText(`Combo x${comboMult}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40, '#f59e0b')
        playSound('combo', isMuted)
      } else {
        playSound('pop', isMuted)
      }

      setTimeout(() => dropFloatingIslands(), 150)
      engine.consecutiveMisses = 0
    } else {
      engine.comboCount = 0
      engine.consecutiveMisses++

      if (engine.consecutiveMisses >= 4) {
        engine.ceilingOffsetY += BUBBLE_RADIUS * 1.5
        engine.consecutiveMisses = 0
        addFloatingText("Ceiling descends!", CANVAS_WIDTH / 2, 80, '#ef4444')
        playSound('bounce', isMuted)

        for (let r = 0; r < ROWS_COUNT; r++) {
          const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
          for (let c = 0; c < colsInRow; c++) {
            const b = engine.grid[r][c]
            if (b) {
              const { y } = getHexCoordinates(r, c)
              b.y = y
            }
          }
        }
      }
    }
  }

  const dropFloatingIslands = () => {
    const engine = stateRef.current
    const connected = new Set<string>()
    const queue: [number, number][] = []

    for (let c = 0; c < COLS_COUNT; c++) {
      const b = engine.grid[0][c]
      if (b && b.state === 'idle') {
        queue.push([0, c])
        connected.add(`0,${c}`)
      }
    }

    const neighborsOffsetEven = [
      [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]
    ]
    const neighborsOffsetOdd = [
      [-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]
    ]

    while (queue.length > 0) {
      const [r, c] = queue.shift()!
      const offsets = r % 2 === 0 ? neighborsOffsetEven : neighborsOffsetOdd

      for (const [dr, dc] of offsets) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < ROWS_COUNT && nc >= 0 && nc < COLS_COUNT) {
          const neighbor = engine.grid[nr][nc]
          if (neighbor && neighbor.state === 'idle') {
            const key = `${nr},${nc}`
            if (!connected.has(key)) {
              connected.add(key)
              queue.push([nr, nc])
            }
          }
        }
      }
    }

    let dropCount = 0
    for (let r = 0; r < ROWS_COUNT; r++) {
      const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
      for (let c = 0; c < colsInRow; c++) {
        const b = engine.grid[r][c]
        if (b && b.state === 'idle' && !connected.has(`${r},${c}`)) {
          b.state = 'falling'
          b.fallVelX = (Math.random() - 0.5) * 4.5
          b.fallVelY = 2 + Math.random() * 3.5
          dropCount++

          if (b.colorIndex === 9) {
            engine.localRescues++
            setRescuesCount(engine.localRescues)
          }

          engine.localScore += 150
        }
      }
    }

    if (dropCount > 0) {
      setScore(engine.localScore)
      addFloatingText(`Dropped +${dropCount}!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30, '#10b981')
      playSound('pop', isMuted)
    }
  }

  const checkGameStates = useCallback(() => {
    const engine = stateRef.current
    if (engine.gameFinishedTriggered) return

    let victory = false
    const config = activeLevel!

    if (config.objective === 'clear') {
      let remaining = false
      for (let r = 0; r < ROWS_COUNT; r++) {
        const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
        for (let c = 0; c < colsInRow; c++) {
          const b = engine.grid[r][c]
          if (b && b.state === 'idle') {
            remaining = true
            break
          }
        }
        if (remaining) break
      }
      if (!remaining) victory = true
    } else if (config.objective === 'rescue') {
      if (engine.localRescues >= (config.targetRescues || 3)) {
        victory = true
      }
    } else if (config.objective === 'score') {
      if (engine.localScore >= (config.targetScore || 5000)) {
        victory = true
      }
    }

    if (victory) {
      handleGameOver(true)
      return
    }

    const dangerLineY = CANVAS_HEIGHT - 130
    for (let r = 0; r < ROWS_COUNT; r++) {
      const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
      for (let c = 0; c < colsInRow; c++) {
        const b = engine.grid[r][c]
        if (b && b.state === 'idle' && b.y + BUBBLE_RADIUS >= dangerLineY) {
          handleGameOver(false)
          return
        }
      }
    }

    if (engine.localShots <= 0 && !engine.shot && !engine.isPoppingOrFalling) {
      handleGameOver(false)
    }
  }, [activeLevel, BUBBLE_RADIUS])

  const handleGameOver = useCallback((isVictory: boolean) => {
    const engine = stateRef.current
    if (engine.gameFinishedTriggered) return
    engine.gameFinishedTriggered = true

    playSound(isVictory ? 'victory' : 'failure', isMuted)

    const finalScore = engine.localScore
    const lvlNum = activeLevel!.level

    let stars = 1
    if (isVictory) {
      const target = activeLevel!.targetScore || (1500 + lvlNum * 500)
      if (finalScore >= target * 1.5) {
        stars = 3
      } else if (finalScore >= target) {
        stars = 2
      } else {
        stars = 1
      }
    } else {
      stars = 0
    }

    const updatedUnlocked = [...unlockedLevels]
    if (isVictory && !unlockedLevels.includes(lvlNum + 1)) {
      updatedUnlocked.push(lvlNum + 1)
    }

    const updatedScores = { ...bestScores }
    updatedScores[lvlNum] = Math.max(bestScores[lvlNum] || 0, finalScore)

    const updatedStars = { ...starsEarned }
    if (isVictory) {
      updatedStars[lvlNum] = Math.max(starsEarned[lvlNum] || 0, stars)
    }

    saveProgress(updatedUnlocked, updatedScores, updatedStars, engine.comboCount)

    // Redirect screen immediately back to map so when result modal exits, map is shown
    setScreen('map')

    submitGameResult({
      gameSlug: 'bubble-shooter',
      result: isVictory ? 'win' : 'loss',
      metadata: {
        score: finalScore,
        level: lvlNum,
        stars,
        hasNextLevel: true, // Endless progression supports level+1 indefinitely
        gameMetadata: {
          level: lvlNum,
          stars,
          accuracy: 100,
        },
        statistics: [
          { label: 'Level Reached', value: lvlNum, color: '#fbbf24' },
          { label: 'Score Earned', value: finalScore.toLocaleString(), color: 'hsl(220 100% 65%)' },
          { label: 'Stars Earned', value: '★'.repeat(stars) || 'None', color: '#ec4899' },
        ],
      },
    })
  }, [activeLevel, bestScores, starsEarned, unlockedLevels, isMuted, submitGameResult])

  // Listen for platform-wide replay and next-level events from PostGameXPModal
  useEffect(() => {
    const handleReplayEvent = () => {
      if (activeLevel) {
        startGame(activeLevel)
      }
    }
    const handleNextLevelEvent = () => {
      if (activeLevel) {
        const nextLvlConfig = getLevelConfig(activeLevel.level + 1)
        startGame(nextLvlConfig)
      }
    }

    window.addEventListener('gamehub_replay', handleReplayEvent)
    window.addEventListener('gamehub_next_level', handleNextLevelEvent)

    return () => {
      window.removeEventListener('gamehub_replay', handleReplayEvent)
      window.removeEventListener('gamehub_next_level', handleNextLevelEvent)
    }
  }, [activeLevel, startGame])

  useEffect(() => {
    if (screen !== 'game') return
    let animId: number

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const engine = stateRef.current

    const renderLoop = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      grad.addColorStop(0, '#090a16')
      grad.addColorStop(0.5, '#12122b')
      grad.addColorStop(1, '#07050e')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Draw background ambient stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      ctx.beginPath()
      ctx.arc(80, 100, 3, 0, 2 * Math.PI)
      ctx.arc(320, 180, 2, 0, 2 * Math.PI)
      ctx.arc(140, 260, 4, 0, 2 * Math.PI)
      ctx.arc(380, 80, 3.5, 0, 2 * Math.PI)
      ctx.arc(220, 400, 3, 0, 2 * Math.PI)
      ctx.fill()

      const dangerLineY = CANVAS_HEIGHT - 130
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(0, dangerLineY)
      ctx.lineTo(CANVAS_WIDTH, dangerLineY)
      ctx.stroke()
      ctx.setLineDash([])

      if (engine.shot) {
        const s = engine.shot
        s.x += s.vx
        s.y += s.vy

        if (s.x - s.radius <= 0) {
          s.x = s.radius
          s.vx = -s.vx
          playSound('bounce', isMuted)
        } else if (s.x + s.radius >= CANVAS_WIDTH) {
          s.x = CANVAS_WIDTH - s.radius
          s.vx = -s.vx
          playSound('bounce', isMuted)
        }

        let hitGrid = false
        let hitRow = -1
        let hitCol = -1

        if (s.y - s.radius <= engine.ceilingOffsetY) {
          hitGrid = true
        } else {
          for (let r = 0; r < ROWS_COUNT; r++) {
            const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
            for (let c = 0; c < colsInRow; c++) {
              const target = engine.grid[r][c]
              if (target && target.state === 'idle') {
                const dist = Math.hypot(s.x - target.x, s.y - target.y)
                if (dist < s.radius + target.radius - 4) {
                  hitGrid = true
                  break
                }
              }
            }
            if (hitGrid) break
          }
        }

        if (hitGrid) {
          let minDistance = Infinity
          for (let r = 0; r < ROWS_COUNT; r++) {
            const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
            for (let c = 0; c < colsInRow; c++) {
              if (!engine.grid[r][c]) {
                const { x: cellX, y: cellY } = getHexCoordinates(r, c)
                const dist = Math.hypot(s.x - cellX, s.y - cellY)
                if (dist < minDistance) {
                  minDistance = dist
                  hitRow = r
                  hitCol = c
                }
              }
            }
          }

          if (hitRow !== -1 && hitCol !== -1) {
            const { x: snapX, y: snapY } = getHexCoordinates(hitRow, hitCol)
            engine.grid[hitRow][hitCol] = {
              x: snapX,
              y: snapY,
              colorIndex: s.colorIndex,
              radius: BUBBLE_RADIUS,
              state: 'idle',
            }

            processMatchPops(hitRow, hitCol)
          }

          engine.shot = null
          engine.isShooting = false
        }
      }

      // Draw prediction trajectory line
      if (!engine.shot && !isPaused && !engine.gameFinishedTriggered && engine.localShots > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
        ctx.lineWidth = 3
        ctx.setLineDash([4, 6])
        ctx.beginPath()

        const lX = CANVAS_WIDTH / 2
        const lY = CANVAS_HEIGHT - 60
        ctx.moveTo(lX, lY)

        let currX = lX
        let currY = lY
        let aimAngle = engine.angle
        let predVX = Math.cos(aimAngle) * 8
        let predVY = Math.sin(aimAngle) * 8

        for (let step = 0; step < 75; step++) {
          currX += predVX
          currY += predVY

          if (currX - BUBBLE_RADIUS <= 0 || currX + BUBBLE_RADIUS >= CANVAS_WIDTH) {
            predVX = -predVX
          }

          if (currY < 40) {
            break
          }
        }
        ctx.lineTo(currX, currY)
        ctx.stroke()
        ctx.setLineDash([])
      }

      engine.isPoppingOrFalling = false
      for (let r = 0; r < ROWS_COUNT; r++) {
        const colsInRow = r % 2 === 0 ? COLS_COUNT : COLS_COUNT - 1
        for (let c = 0; c < colsInRow; c++) {
          const b = engine.grid[r][c]
          if (!b) continue

          if (b.state === 'popping') {
            engine.isPoppingOrFalling = true
            b.popProgress = (b.popProgress || 0) + 0.08
            if (b.popProgress >= 1) {
              const hexColor = b.colorIndex <= 6 ? BUBBLE_COLORS[b.colorIndex - 1] : '#fbbf24'
              createExplosion(b.x, b.y, hexColor)
              engine.grid[r][c] = null
            } else {
              ctx.save()
              ctx.translate(b.x, b.y)
              ctx.scale(1 - b.popProgress, 1 - b.popProgress)
              drawBubbleBall(ctx, 0, 0, b.colorIndex)
              ctx.restore()
            }
          } else if (b.state === 'falling') {
            engine.isPoppingOrFalling = true
            b.x += b.fallVelX || 0
            b.y += b.fallVelY || 0
            b.fallVelY = (b.fallVelY || 0) + 0.25

            if (b.y > CANVAS_HEIGHT + 30) {
              engine.grid[r][c] = null
            } else {
              drawBubbleBall(ctx, b.x, b.y, b.colorIndex)
            }
          } else {
            drawBubbleBall(ctx, b.x, b.y, b.colorIndex)
          }
        }
      }

      if (engine.shot) {
        drawBubbleBall(ctx, engine.shot.x, engine.shot.y, engine.shot.colorIndex)
      }

      // Draw Cannon launcher body
      const launcherX = CANVAS_WIDTH / 2
      const launcherY = CANVAS_HEIGHT - 60

      ctx.fillStyle = '#1e1b4b'
      ctx.strokeStyle = '#312e81'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(launcherX, launcherY, 36, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Launcher barrel pointer line
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(launcherX, launcherY)
      ctx.lineTo(launcherX + Math.cos(engine.angle) * 45, launcherY + Math.sin(engine.angle) * 45)
      ctx.stroke()

      // Display queued current bubble inside the cannon barrel
      if (engine.nextColorsQueue.length > 0 && !engine.shot) {
        drawBubbleBall(ctx, launcherX, launcherY, engine.nextColorsQueue[0])
      }

      // Preview next bubble in queue
      if (engine.nextColorsQueue.length > 1) {
        drawBubbleBall(ctx, launcherX - 60, launcherY + 12, engine.nextColorsQueue[1], 15)
      }

      for (let i = engine.particles.length - 1; i >= 0; i--) {
        const p = engine.particles[i]
        p.x += p.vx
        p.y += p.vy
        p.alpha -= p.decay

        if (p.alpha <= 0) {
          engine.particles.splice(i, 1)
        } else {
          ctx.save()
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI)
          ctx.fill()
          ctx.restore()
        }
      }

      for (let i = engine.floatingTexts.length - 1; i >= 0; i--) {
        const ft = engine.floatingTexts[i]
        ft.y -= 1.2
        ft.life--

        if (ft.life <= 0) {
          engine.floatingTexts.splice(i, 1)
        } else {
          ctx.save()
          ctx.globalAlpha = Math.min(1, ft.life / 15)
          ctx.fillStyle = ft.color
          ctx.font = 'bold 16px Outfit, sans-serif'
          ctx.textAlign = 'center'
          ctx.shadowBlur = 4
          ctx.shadowColor = 'black'
          ctx.fillText(ft.text, ft.x, ft.y)
          ctx.restore()
        }
      }

      checkGameStates()

      animId = requestAnimationFrame(renderLoop)
    }

    animId = requestAnimationFrame(renderLoop)
    return () => cancelAnimationFrame(animId)
  }, [screen, activeLevel, isPaused, isMuted, getHexCoordinates, checkGameStates, BUBBLE_RADIUS])

  const drawBubbleBall = (ctx: CanvasRenderingContext2D, x: number, y: number, colorIndex: number, radiusOverride?: number) => {
    const r = radiusOverride || BUBBLE_RADIUS
    ctx.save()
    ctx.shadowBlur = 10

    if (colorIndex <= 6) {
      const color = BUBBLE_COLORS[colorIndex - 1]
      ctx.shadowColor = color

      const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, r / 10, x, y, r)
      grad.addColorStop(0, '#ffffff')
      grad.addColorStop(0.3, color)
      grad.addColorStop(1, '#000000')

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
    } else if (colorIndex === 7) {
      // Rainbow wild bubble
      ctx.shadowColor = '#06b6d4'
      const grad = ctx.createLinearGradient(x - r, y - r, x + r, y + r)
      grad.addColorStop(0, '#ef4444')
      grad.addColorStop(0.2, '#f59e0b')
      grad.addColorStop(0.4, '#22c55e')
      grad.addColorStop(0.6, '#3b82f6')
      grad.addColorStop(0.8, '#a855f7')
      grad.addColorStop(1, '#ec4899')

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
    } else if (colorIndex === 8) {
      // Fireball explosion bubble
      ctx.shadowColor = '#f97316'
      const grad = ctx.createRadialGradient(x - r / 3, y - r / 3, r / 8, x, y, r)
      grad.addColorStop(0, '#fef08a')
      grad.addColorStop(0.4, '#f97316')
      grad.addColorStop(1, '#7f1d1d')

      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
    } else if (colorIndex === 9) {
      // Custom Vector Kitten drawn natively on canvas
      ctx.shadowColor = '#f472b6'
      ctx.fillStyle = '#f472b6'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Lighter pink ears
      ctx.shadowBlur = 0
      
      // Draw left ear triangle
      ctx.fillStyle = '#f472b6'
      ctx.beginPath()
      ctx.moveTo(x - r * 0.6, y - r * 0.1)
      ctx.lineTo(x - r * 0.6, y - r * 0.75)
      ctx.lineTo(x - r * 0.1, y - r * 0.4)
      ctx.closePath()
      ctx.fill()

      // Draw right ear triangle
      ctx.beginPath()
      ctx.moveTo(x + r * 0.6, y - r * 0.1)
      ctx.lineTo(x + r * 0.6, y - r * 0.75)
      ctx.lineTo(x + r * 0.1, y - r * 0.4)
      ctx.closePath()
      ctx.fill()

      // Inner lighter ears
      ctx.fillStyle = '#fce7f3'
      ctx.beginPath()
      ctx.moveTo(x - r * 0.5, y - r * 0.25)
      ctx.lineTo(x - r * 0.5, y - r * 0.6)
      ctx.lineTo(x - r * 0.2, y - r * 0.4)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(x + r * 0.5, y - r * 0.25)
      ctx.lineTo(x + r * 0.5, y - r * 0.6)
      ctx.lineTo(x + r * 0.2, y - r * 0.4)
      ctx.closePath()
      ctx.fill()

      // Eyes (black dots)
      ctx.fillStyle = '#1e1b4b'
      ctx.beginPath()
      ctx.arc(x - r * 0.25, y, r * 0.1, 0, 2 * Math.PI)
      ctx.arc(x + r * 0.25, y, r * 0.1, 0, 2 * Math.PI)
      ctx.fill()

      // Nose (tiny pink triangle)
      ctx.fillStyle = '#fca5a5'
      ctx.beginPath()
      ctx.moveTo(x - r * 0.08, y + r * 0.1)
      ctx.lineTo(x + r * 0.08, y + r * 0.1)
      ctx.lineTo(x, y + r * 0.2)
      ctx.closePath()
      ctx.fill()

      // Whiskers (thin white lines)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.beginPath()
      // left whiskers
      ctx.moveTo(x - r * 0.35, y + r * 0.1)
      ctx.lineTo(x - r * 0.7, y + r * 0.05)
      ctx.moveTo(x - r * 0.35, y + r * 0.15)
      ctx.lineTo(x - r * 0.7, y + r * 0.2)
      // right whiskers
      ctx.moveTo(x + r * 0.35, y + r * 0.1)
      ctx.lineTo(x + r * 0.7, y + r * 0.05)
      ctx.moveTo(x + r * 0.35, y + r * 0.15)
      ctx.lineTo(x + r * 0.7, y + r * 0.2)
      ctx.stroke()
    }

    ctx.restore()
  }

  // Generate dynamic list of levels up to highest unlocked level plus one locked level
  const maxUnlockedLevel = Math.max(...unlockedLevels, 1)
  const visibleLevels = Array.from({ length: Math.max(4, maxUnlockedLevel + 1) }, (_, i) => getLevelConfig(i + 1))

  return (
    <div
      ref={containerRef}
      className="card glass"
      style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 6%))',
        border: '1px solid hsl(220 20% 18%)',
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, padding: '0 0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'hsl(220 100% 65%)' }}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          Bubble Shooter Saga
        </h3>
        <button
          onClick={() => setIsMuted(prev => !prev)}
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'hsl(220 10% 60%)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          {isMuted ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>
              Muted
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              Sound
            </>
          )}
        </button>
      </div>

      {screen === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', flex: 1, gap: '1.25rem', zIndex: 5, padding: '0 0.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'hsl(220 10% 55%)', textAlign: 'center', maxWidth: '340px', lineHeight: 1.4 }}>
            Explore Whisper Woods, pop magical bubbles, and rescue trapped kittens! Keep unlocking to play endless procedural levels.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              width: '100%',
              maxHeight: '440px',
              overflowY: 'auto',
              background: 'hsl(222 20% 8% / 0.6)',
              border: '1px solid hsl(220 20% 14%)',
              borderRadius: 16,
              padding: '0.85rem',
              boxSizing: 'border-box'
            }}
          >
            {visibleLevels.map((lvl) => {
              const isLvlUnlocked = unlockedLevels.includes(lvl.level)
              const bestScore = bestScores[lvl.level] || 0
              const stars = starsEarned[lvl.level] || 0

              return (
                <div
                  key={lvl.level}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.8rem',
                    background: isLvlUnlocked ? 'hsl(222 18% 12% / 0.7)' : 'hsl(222 18% 10% / 0.3)',
                    border: isLvlUnlocked ? '1px solid hsl(220 15% 20%)' : '1px solid hsl(220 15% 14%)',
                    borderRadius: 12,
                    padding: '0.65rem 0.85rem',
                    opacity: isLvlUnlocked ? 1 : 0.5,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, background: isLvlUnlocked ? 'hsl(220 100% 60% / 0.2)' : 'transparent', color: 'hsl(220 100% 65%)', border: isLvlUnlocked ? '1px solid hsl(220 100% 60% / 0.3)' : '1px solid hsl(220 10% 25%)', borderRadius: 4, padding: '1px 4px' }}>
                        Lvl {lvl.level}
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 750, color: 'white' }}>{lvl.name}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lvl.objectiveText}
                    </div>
                    {bestScore > 0 && (
                      <div style={{ fontSize: '0.68rem', color: 'hsl(45 100% 60%)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Best: {bestScore} pts</span>
                        <span style={{ color: 'hsl(45 100% 55%)' }}>{'★'.repeat(stars)}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => isLvlUnlocked && startGame(lvl)}
                    disabled={!isLvlUnlocked}
                    className={isLvlUnlocked ? "btn btn-primary" : "btn btn-secondary"}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.45rem 1rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      boxShadow: isLvlUnlocked ? '0 4px 10px hsl(220 100% 60% / 0.2)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {isLvlUnlocked ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Play
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Locked
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {screen === 'game' && activeLevel && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, zIndex: 5, overflow: 'hidden', position: 'relative' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(222 20% 8% / 0.5)', borderRadius: 12, padding: '0.4rem 0.75rem', marginBottom: '0.5rem', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>Score</span>
              <span style={{ fontSize: '0.98rem', color: '#fbbf24', fontWeight: 900 }}>{score}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>Shots</span>
              <span style={{ fontSize: '0.98rem', color: shotsLeft <= 5 ? '#ef4444' : '#ffffff', fontWeight: 900 }}>{shotsLeft}</span>
            </div>
            {activeLevel.objective === 'rescue' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, display: 'inline-flex', alignItems: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f472b6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '3px' }}><path d="M12 5c.67 0 1.35.09 2 .26a8 8 0 1 1-4 0c.65-.17 1.33-.26 2-.26z"/><path d="M2 10s.5-1.5 2-1.5 2 1.5 2 1.5"/><path d="M22 10s-.5-1.5-2-1.5-2 1.5-2 1.5"/></svg>
                  Rescued
                </span>
                <span style={{ fontSize: '0.98rem', color: '#3b82f6', fontWeight: 900 }}>{rescuesCount} / {activeLevel.targetRescues}</span>
              </div>
            )}
            <button
              onClick={() => setIsPaused(true)}
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem', border: '1px solid hsl(220 10% 25%)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
              Pause
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: CANVAS_WIDTH,
              aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
              maxHeight: 'calc(100vh - 200px)',
              background: '#040209',
              borderRadius: 16,
              border: '2px solid hsl(220 20% 18%)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.85)',
              touchAction: 'none',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseMove={onMouseMove}
            onTouchMove={onTouchMove}
            onClick={triggerShoot}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />

            {!isPaused && (
              <button
                onClick={(e) => { e.stopPropagation(); swapBubble() }}
                className="btn btn-secondary"
                style={{
                  position: 'absolute',
                  bottom: 12,
                  right: 12,
                  fontSize: '0.72rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 8,
                  fontWeight: 800,
                  backgroundColor: 'hsl(222 20% 10% / 0.8)',
                  borderColor: 'hsl(220 15% 22% / 0.8)',
                  color: 'white',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                  zIndex: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 16-4 4-4-4"/><path d="M17 20V8a4 4 0 0 0-4-4H3"/><path d="m3 8 4-4-4 4"/><path d="M7 4v12a4 4 0 0 0 4 4h10"/></svg>
                Swap
              </button>
            )}
          </div>

          {isPaused && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(5, 3, 10, 0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', borderRadius: 16, zIndex: 100 }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ color: 'hsl(220 100% 65%)' }}><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
                Game Paused
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '170px' }}>
                <button onClick={() => setIsPaused(false)} className="btn btn-primary" style={{ padding: '0.55rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '6px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Resume
                </button>
                <button onClick={() => startGame(activeLevel)} className="btn btn-secondary" style={{ padding: '0.55rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '6px' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Restart
                </button>
                <button onClick={() => setScreen('map')} className="btn btn-ghost" style={{ padding: '0.55rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, color: 'hsl(0 75% 65%)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '6px' }}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Quit to Map
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
