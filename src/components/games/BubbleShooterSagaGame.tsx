'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import GameIcon from './GameIcon'

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

// Data-Driven level designs (0=Empty, 1-6=Colors, 7=Rainbow, 8=Fireball, 9=Kitten)
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
    objectiveText: "Rescue the 3 trapped kittens!",
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
  const { submitGameResult, isLoading } = useGameSession()
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
  const [gameResult, setGameResult] = useState<'win' | 'loss' | null>(null)

  // Canvas Refs & Game Engine coordinates
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  
  const COLS_COUNT = 8
  const ROWS_COUNT = 11
  const CANVAS_WIDTH = 440
  const CANVAS_HEIGHT = 560
  const BUBBLE_RADIUS = 24
  const HEX_HEIGHT = 41.5 // cell height offset

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
    const startX = isOdd ? BUBBLE_RADIUS * 1.5 : BUBBLE_RADIUS
    const x = startX + col * BUBBLE_RADIUS * 2
    const y = BUBBLE_RADIUS + row * HEX_HEIGHT + stateRef.current.ceilingOffsetY
    return { x, y }
  }, [])

  // Start active game session
  const startGame = useCallback((config: BubbleLevelConfig) => {
    setActiveLevel(config)
    setIsPaused(false)
    setGameResult(null)
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
  }, [getHexCoordinates])

  // Mouse / Touch Aim Handler
  const handleAimMove = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas || isPaused || gameResult) return
    const rect = canvas.getBoundingClientRect()
    
    // Scale aim coordinates relative to virtual size
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT

    stateRef.current.aimTargetX = x
    stateRef.current.aimTargetY = y

    // Calculate angle from launcher bottom center
    const launcherX = CANVAS_WIDTH / 2
    const launcherY = CANVAS_HEIGHT - 45
    const dx = x - launcherX
    const dy = y - launcherY

    // Limit angle so player doesn't shoot backwards/down
    let angle = Math.atan2(dy, dx)
    if (angle > -0.15) angle = -0.15
    if (angle < -Math.PI + 0.15) angle = -Math.PI + 0.15
    stateRef.current.angle = angle
  }, [isPaused, gameResult])

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
    if (engine.isShooting || engine.shot || isPaused || gameResult || engine.localShots <= 0) return

    const launcherX = CANVAS_WIDTH / 2
    const launcherY = CANVAS_HEIGHT - 45
    const speed = 12
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
  }, [activeLevel, isPaused, gameResult, isMuted])

  // Swap Queue Bubble
  const swapBubble = () => {
    const engine = stateRef.current
    if (engine.isShooting || isPaused || gameResult) return
    const temp = engine.nextColorsQueue[0]
    engine.nextColorsQueue[0] = engine.nextColorsQueue[1]
    engine.nextColorsQueue[1] = temp
    playSound('bounce', isMuted)
  }

  // Synthesize popping particles
  const createExplosion = (x: number, y: number, color: string) => {
    const count = 10
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 4
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        radius: 2 + Math.random() * 4,
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
        for (let c = 0; c < COLS_COUNT; c++) {
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
          for (let c = 0; c < COLS_COUNT; c++) {
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
      for (let c = 0; c < COLS_COUNT; c++) {
        const b = engine.grid[r][c]
        if (b && b.state === 'idle' && !connected.has(`${r},${c}`)) {
          b.state = 'falling'
          b.fallVelX = (Math.random() - 0.5) * 4
          b.fallVelY = 2 + Math.random() * 3
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
    if (gameResult) return

    let victory = false
    const config = activeLevel!

    if (config.objective === 'clear') {
      let remaining = false
      for (let r = 0; r < ROWS_COUNT; r++) {
        for (let c = 0; c < COLS_COUNT; c++) {
          const b = engine.grid[r][c]
          if (b && b.state === 'idle') {
            remaining = true
            break
          }
        }
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

    const dangerLineY = CANVAS_HEIGHT - 120
    for (let r = 0; r < ROWS_COUNT; r++) {
      for (let c = 0; c < COLS_COUNT; c++) {
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
  }, [activeLevel, gameResult])

  const handleGameOver = useCallback((isVictory: boolean) => {
    const engine = stateRef.current
    setGameResult(isVictory ? 'win' : 'loss')
    playSound(isVictory ? 'victory' : 'failure', isMuted)

    const finalScore = engine.localScore
    const lvlNum = activeLevel!.level

    let stars = 1
    if (isVictory) {
      if (lvlNum === 1) {
        stars = finalScore > 3500 ? 3 : finalScore > 2000 ? 2 : 1
      } else if (lvlNum === 2) {
        stars = finalScore > 4500 ? 3 : finalScore > 3000 ? 2 : 1
      } else {
        stars = finalScore > 6500 ? 3 : finalScore > 4000 ? 2 : 1
      }
    } else {
      stars = 0
    }

    const updatedUnlocked = [...unlockedLevels]
    if (isVictory && lvlNum === unlockedLevels[unlockedLevels.length - 1] && lvlNum < LEVELS.length) {
      updatedUnlocked.push(lvlNum + 1)
    }

    const updatedScores = { ...bestScores }
    updatedScores[lvlNum] = Math.max(bestScores[lvlNum] || 0, finalScore)

    const updatedStars = { ...starsEarned }
    if (isVictory) {
      updatedStars[lvlNum] = Math.max(starsEarned[lvlNum] || 0, stars)
    }

    saveProgress(updatedUnlocked, updatedScores, updatedStars, engine.comboCount)

    submitGameResult({
      gameSlug: 'bubble-shooter',
      result: isVictory ? 'win' : 'loss',
      metadata: {
        score: finalScore,
        level: lvlNum,
        stars,
        gameMetadata: {
          level: lvlNum,
          stars,
          accuracy: 100,
        },
        statistics: [
          { label: 'Level Reached', value: lvlNum, color: '#fbbf24' },
          { label: 'Score Earned', value: finalScore, color: 'hsl(220 100% 65%)' },
          { label: 'Stars Earned', value: '★'.repeat(stars) || 'None', color: '#ec4899' },
        ],
      },
    })
  }, [activeLevel, bestScores, starsEarned, unlockedLevels, isMuted, submitGameResult])

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

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      ctx.beginPath()
      ctx.arc(80, 100, 3, 0, 2 * Math.PI)
      ctx.arc(320, 180, 2, 0, 2 * Math.PI)
      ctx.arc(140, 260, 4, 0, 2 * Math.PI)
      ctx.arc(380, 80, 3.5, 0, 2 * Math.PI)
      ctx.fill()

      const dangerLineY = CANVAS_HEIGHT - 120
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
            for (let c = 0; c < COLS_COUNT; c++) {
              const target = engine.grid[r][c]
              if (target && target.state === 'idle') {
                const dist = Math.hypot(s.x - target.x, s.y - target.y)
                if (dist < s.radius + target.radius - 4) {
                  hitGrid = true
                  break
                }
              }
            }
          }
        }

        if (hitGrid) {
          let minDistance = Infinity
          for (let r = 0; r < ROWS_COUNT; r++) {
            for (let c = 0; c < COLS_COUNT; c++) {
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

      if (!engine.shot && !isPaused && !gameResult && engine.localShots > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
        ctx.lineWidth = 3
        ctx.setLineDash([4, 6])
        ctx.beginPath()

        const lX = CANVAS_WIDTH / 2
        const lY = CANVAS_HEIGHT - 45
        ctx.moveTo(lX, lY)

        let currX = lX
        let currY = lY
        let aimAngle = engine.angle
        let predVX = Math.cos(aimAngle) * 8
        let predVY = Math.sin(aimAngle) * 8

        for (let step = 0; step < 60; step++) {
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
        for (let c = 0; c < COLS_COUNT; c++) {
          const b = engine.grid[r][c]
          if (!b) continue

          if (b.state === 'popping') {
            engine.isPoppingOrFalling = true
            b.popProgress = (b.popProgress || 0) + 0.08
            if (b.popProgress >= 1) {
              const hexColor = b.colorIndex <= 6 ? BUBBLE_COLORS[b.colorIndex - 1] : '#f59e0b'
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

      const launcherX = CANVAS_WIDTH / 2
      const launcherY = CANVAS_HEIGHT - 45

      ctx.fillStyle = '#1e1b4b'
      ctx.strokeStyle = '#312e81'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(launcherX, launcherY, 36, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(launcherX, launcherY)
      ctx.lineTo(launcherX + Math.cos(engine.angle) * 45, launcherY + Math.sin(engine.angle) * 45)
      ctx.stroke()

      if (engine.nextColorsQueue.length > 0 && !engine.shot) {
        drawBubbleBall(ctx, launcherX, launcherY, engine.nextColorsQueue[0])
      }

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
  }, [screen, activeLevel, isPaused, gameResult, isMuted, getHexCoordinates, checkGameStates])

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
      ctx.shadowColor = '#f472b6'
      ctx.fillStyle = '#f472b6'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      ctx.shadowBlur = 0
      ctx.fillStyle = '#ffffff'
      ctx.font = `${r * 0.9}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐱', x, y)
    }

    ctx.restore()
  }

  return (
    <div
      ref={containerRef}
      className="card glass"
      style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 6%))',
        border: '1px solid hsl(220 20% 18%)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: 590,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          🔮 Bubble Shooter Saga
        </h3>
        <button
          onClick={() => setIsMuted(prev => !prev)}
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', color: 'hsl(220 10% 60%)' }}
        >
          {isMuted ? '🔇 Muted' : '🔊 Sound'}
        </button>
      </div>

      {screen === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', flex: 1, gap: '1.5rem', zIndex: 5 }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'hsl(220 10% 55%)', textAlign: 'center', maxWidth: '300px', lineHeight: 1.4 }}>
            Explore the Whisper Woods and rescue the trapped kittens! Complete the challenges to advance.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              width: '100%',
              background: 'hsl(222 20% 8% / 0.6)',
              border: '1px solid hsl(220 20% 14%)',
              borderRadius: 16,
              padding: '1rem',
              boxSizing: 'border-box'
            }}
          >
            {LEVELS.map((lvl) => {
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
                    padding: '0.75rem 1rem',
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
                      <div style={{ fontSize: '0.68rem', color: 'hsl(45 100% 60%)', marginTop: '0.15rem' }}>
                        Best: {bestScore} pts • {'★'.repeat(stars)}
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
                    }}
                  >
                    {isLvlUnlocked ? 'Play' : 'Locked'}
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
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>Shots Left</span>
              <span style={{ fontSize: '0.98rem', color: shotsLeft <= 5 ? '#ef4444' : '#ffffff', fontWeight: 900 }}>{shotsLeft}</span>
            </div>
            {activeLevel.objective === 'rescue' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>Rescued</span>
                <span style={{ fontSize: '0.98rem', color: '#3b82f6', fontWeight: 900 }}>{rescuesCount} / {activeLevel.targetRescues}</span>
              </div>
            )}
            <button
              onClick={() => setIsPaused(true)}
              className="btn btn-ghost"
              style={{ fontSize: '0.72rem', padding: '0.35rem 0.5rem', border: '1px solid hsl(220 10% 25%)', borderRadius: 8 }}
            >
              ⏸ Pause
            </button>
          </div>

          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: CANVAS_WIDTH,
              aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
              background: '#040209',
              borderRadius: 16,
              border: '2px solid hsl(220 20% 18%)',
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.85)',
              touchAction: 'none',
              overflow: 'hidden'
            }}
            onMouseMove={onMouseMove}
            onTouchMove={onTouchMove}
            onClick={triggerShoot}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />

            {!isPaused && !gameResult && (
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
                  zIndex: 20
                }}
              >
                🔄 Swap
              </button>
            )}
          </div>

          {isPaused && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(5, 3, 10, 0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', borderRadius: 16, zIndex: 100 }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>Game Paused</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '160px' }}>
                <button onClick={() => setIsPaused(false)} className="btn btn-primary" style={{ padding: '0.5rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>Resume</button>
                <button onClick={() => startGame(activeLevel)} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>Restart</button>
                <button onClick={() => setScreen('map')} className="btn btn-ghost" style={{ padding: '0.5rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, color: 'hsl(0 70% 65%)' }}>Quit to Map</button>
              </div>
            </div>
          )}

          {gameResult && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(5, 3, 10, 0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', borderRadius: 16, zIndex: 100 }}>
              <div style={{ fontSize: '3rem' }}>{gameResult === 'win' ? '🏆' : '💀'}</div>
              <h2 style={{ margin: 0, color: gameResult === 'win' ? '#fbbf24' : '#ef4444', fontSize: '1.5rem', fontWeight: 900 }}>
                {gameResult === 'win' ? 'Level Complete!' : 'Game Over'}
              </h2>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', textTransform: 'uppercase', fontWeight: 800 }}>Final Score</div>
                <div style={{ fontSize: '1.8rem', color: 'white', fontWeight: 900 }}>{score}</div>
              </div>

              {gameResult === 'win' && (
                <div style={{ display: 'flex', gap: '0.2rem', fontSize: '1.5rem', color: '#fbbf24' }}>
                  {'★'.repeat(score > (activeLevel.level === 1 ? 3500 : activeLevel.level === 2 ? 4500 : 6500) ? 3 : score > (activeLevel.level === 1 ? 2000 : activeLevel.level === 2 ? 3000 : 4000) ? 2 : 1)}
                  {'☆'.repeat(3 - (score > (activeLevel.level === 1 ? 3500 : activeLevel.level === 2 ? 4500 : 6500) ? 3 : score > (activeLevel.level === 1 ? 2000 : activeLevel.level === 2 ? 3000 : 4000) ? 2 : 1))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.65rem', width: '220px' }}>
                <button onClick={() => startGame(activeLevel)} className="btn btn-primary" style={{ flex: 1, padding: '0.55rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}>Retry</button>
                <button onClick={() => setScreen('map')} className="btn btn-secondary" style={{ flex: 1, padding: '0.55rem', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}>Map</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
