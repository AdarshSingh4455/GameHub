'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import GameIcon from './GameIcon'
import { getSnakeAIMove } from '@/lib/snakeAI'
import { PowerupBadge } from '@/components/shared/PowerupBadge'
import { LightbulbIcon } from '@/components/shared/Icons'
import type { Position, SnakePlayer, FoodItem, PowerupItem, SnakeArenaState } from '@/lib/snakeArenaTypes'
import { SnakeEffectManager } from '@/lib/SnakeEffectManager'

type Difficulty = 'easy' | 'medium' | 'hard' | 'nightmare'
type MapTheme = 'classic' | 'ice' | 'lava' | 'maze' | 'neon'

// Audio Synthesis Helpers
function playSynthSound(type: 'countdown' | 'food' | 'golden' | 'powerup' | 'death' | 'victory' | 'start') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    if (type === 'countdown') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'start') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    } else if (type === 'food') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.12)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (type === 'golden') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.2)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    } else if (type === 'powerup') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.linearRampToValueAtTime(900, now + 0.25)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'death') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.linearRampToValueAtTime(100, now + 0.4)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.4)
    } else if (type === 'victory') {
      // Arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50] // C E G C
      notes.forEach((freq, idx) => {
        const noteOsc = ctx.createOscillator()
        const noteGain = ctx.createGain()
        noteOsc.connect(noteGain)
        noteGain.connect(ctx.destination)
        noteOsc.type = 'sine'
        noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1)
        noteGain.gain.setValueAtTime(0.1, now + idx * 0.1)
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15)
        noteOsc.start(now + idx * 0.1)
        noteOsc.stop(now + idx * 0.1 + 0.15)
      })
    }
  } catch (e) {
    console.error('Audio Synthesis Error:', e)
  }
}

export default function SnakeArenaGame() {
  const { submitGameResult } = useGameSession()
  const { addToast } = useToast()

  const [isRanked, setIsRanked] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'ranked') {
        setIsRanked(true)
        setDifficulty('nightmare')
      }
    }
  }, [])

  // Game setup states
  const [playingState, setPlayingState] = useState<'lobby' | 'countdown' | 'playing' | 'finished'>('lobby')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [mapTheme, setMapTheme] = useState<MapTheme>('classic')
  const [countdown, setCountdown] = useState<number>(3)
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(true)

  // authorative logic ticks states
  const [gameState, setGameState] = useState<SnakeArenaState | null>(null)
  
  const effectManagerRef = useRef<SnakeEffectManager | null>(null)
  if (!effectManagerRef.current) {
    effectManagerRef.current = new SnakeEffectManager()
  }
  
  // Stats tracking
  const [longestLength, setLongestLength] = useState<number>(3)
  const [foodsCollected, setFoodsCollected] = useState<number>(0)
  const [eliminations, setEliminations] = useState<number>(0)

  // Pre-load Powerup SVGs as images
  const powerupImagesRef = useRef<Record<string, HTMLImageElement>>({})
  useEffect(() => {
    if (typeof window === 'undefined') return
    const svgs: Record<string, string> = {
      magnet: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11V6a5 5 0 0 0-10 0v5"/><path d="M17 11a3 3 0 0 0-6 0V6a1 1 0 0 1 2 0v5a1 1 0 0 0 2 0V6a3 3 0 0 0-6 0v5a7 7 0 0 0 14 0Z"/></svg>`,
      speed: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2322c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
      shield: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%233b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      double: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23ec4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><text x="50%" y="53%" dominant-baseline="central" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="9" fill="%23ec4899">2x</text></svg>`,
      ghost: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10a10 10 0 0 1 20 0v11l-3-2-3 2-3-2-3 2-3-2-5 3v-11z"/><path d="M9 10h.01"/><path d="M15 10h.01"/></svg>`,
      freeze: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2306b6d4" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="12" x2="4" y2="4"/><line x1="12" y1="12" x2="20" y2="20"/><line x1="12" y1="12" x2="20" y2="4"/><line x1="12" y1="12" x2="4" y2="20"/></svg>`
    }

    const imgs: Record<string, HTMLImageElement> = {}
    Object.entries(svgs).forEach(([key, value]) => {
      const img = new Image()
      img.src = value
      imgs[key] = img
    })
    powerupImagesRef.current = imgs
  }, [])

  // Listen to Universal Result Modal actions
  useEffect(() => {
    const handleReplay = () => {
      startGame()
    }
    const handleLobby = () => {
      setPlayingState('lobby')
    }
    window.addEventListener('gamehub_replay', handleReplay)
    window.addEventListener('gamehub_snake_lobby', handleLobby)
    return () => {
      window.removeEventListener('gamehub_replay', handleReplay)
      window.removeEventListener('gamehub_snake_lobby', handleLobby)
    }
  }, [])

  // Disable pull-to-refresh, overscroll, and body scrolling during active gameplay
  useEffect(() => {
    const isActiveGameplay = playingState === 'playing' || playingState === 'countdown';

    if (isActiveGameplay) {
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';

      const preventDefaultTouch = (e: TouchEvent) => {
        if (e.cancelable) {
          e.preventDefault();
        }
      };
      
      window.addEventListener('touchmove', preventDefaultTouch, { passive: false });

      return () => {
        document.body.style.overflow = '';
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overflow = '';
        document.documentElement.style.overscrollBehavior = '';
        window.removeEventListener('touchmove', preventDefaultTouch);
      };
    }
  }, [playingState]);

  // References for tick loops
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<SnakeArenaState | null>(null)
  const lastTickTimeRef = useRef<number>(0)
  const playerDirRef = useRef<Position>({ x: 1, y: 0 })
  const startTimeRef = useRef<number>(0)

  // Mobile Swipes refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Keyboard steer key listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (playingState !== 'playing') return
      
      const key = e.key.toLowerCase()
      let dir: Position | null = null

      if (key === 'arrowup' || key === 'w') dir = { x: 0, y: -1 }
      else if (key === 'arrowdown' || key === 's') dir = { x: 0, y: 1 }
      else if (key === 'arrowleft' || key === 'a') dir = { x: -1, y: 0 }
      else if (key === 'arrowright' || key === 'd') dir = { x: 1, y: 0 }

      if (dir && stateRef.current) {
        const currentDir = playerDirRef.current
        const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
        if (!isOpposite) {
          playerDirRef.current = dir
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playingState])

  // Countdown timer hook
  useEffect(() => {
    if (playingState !== 'countdown') return

    playSynthSound('countdown')
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setPlayingState('playing')
          playSynthSound('start')
          startGameEngine()
          return 0
        }
        playSynthSound('countdown')
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [playingState])

  // Initializing local game session
  const startGame = () => {
    setCountdown(3)
    setPlayingState('countdown')
    setLongestLength(3)
    setFoodsCollected(0)
    setEliminations(0)
    playerDirRef.current = { x: 1, y: 0 }
    startTimeRef.current = Date.now()
  }

  const startGameEngine = () => {
    // Generate initial offline state
    const cols = 60
    const rows = 40

    const initialSnakes: Record<string, SnakePlayer> = {
      'player-human': {
        userId: 'player-human',
        username: 'You',
        body: [
          { x: 10, y: 20 },
          { x: 9, y: 20 },
          { x: 8, y: 20 }
        ],
        direction: { x: 1, y: 0 },
        length: 3,
        score: 0,
        eliminations: 0,
        survivalTime: 0,
        status: 'ACTIVE',
        color: '#10b981', // Emerald green
        spawnProtectedUntil: Date.now() + 2000,
        activePowerups: []
      }
    }

    // Spawn 5 CPU AI snakes
    const cpuDifficulties: Difficulty[] = ['easy', 'medium', 'hard', 'nightmare']
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']
    
    for (let i = 0; i < 5; i++) {
      const cpuId = `cpu-${i}`
      const startY = 5 + i * 6
      const startX = 40
      initialSnakes[cpuId] = {
        userId: cpuId,
        username: `Bot ${i + 1} (${difficulty.toUpperCase()})`,
        body: [
          { x: startX, y: startY },
          { x: startX + 1, y: startY },
          { x: startX + 2, y: startY }
        ],
        direction: { x: -1, y: 0 },
        length: 3,
        score: 0,
        eliminations: 0,
        survivalTime: 0,
        status: 'ACTIVE',
        color: colors[i % colors.length],
        spawnProtectedUntil: Date.now() + 2000,
        activePowerups: []
      }
    }

    const foods: FoodItem[] = []
    for (let i = 0; i < 6; i++) {
      foods.push({
        id: `food-${Math.random().toString(36).substring(2, 9)}`,
        x: Math.floor(Math.random() * (cols - 4) + 2),
        y: Math.floor(Math.random() * (rows - 4) + 2),
        type: 'normal',
        value: 10
      })
    }

    const state: SnakeArenaState = {
      cols,
      rows,
      snakes: initialSnakes,
      foods,
      powerups: [],
      tickCount: 0,
      status: 'PLAYING',
      winnerId: null,
      replayVotes: {},
      spectators: [],
      startTime: Date.now(),
      mapTheme
    }

    setGameState(state)
    stateRef.current = state
    lastTickTimeRef.current = Date.now()
  }

  // Authoritative Offline Game Engine Loop
  useEffect(() => {
    if (playingState !== 'playing') return

    let timeoutId: NodeJS.Timeout

    const tick = () => {
      const state = stateRef.current
      if (!state || state.status !== 'PLAYING') return

      // Update player steer direction
      const human = state.snakes['player-human']
      if (human && human.status === 'ACTIVE') {
        human.direction = playerDirRef.current
      }

      // Update AI steering pathing
      for (const sId in state.snakes) {
        if (sId !== 'player-human' && state.snakes[sId].status === 'ACTIVE') {
          const aiMove = getSnakeAIMove(sId, state, difficulty)
          state.snakes[sId].direction = aiMove
        }
      }

      // Run local authoritative game step
      const nextTickState = simulateServerTick(state)

      setGameState(nextTickState)
      stateRef.current = nextTickState
      lastTickTimeRef.current = Date.now()

      // Track statistics increments
      const updatedHuman = nextTickState.snakes['player-human']
      if (updatedHuman) {
        setLongestLength(prev => Math.max(prev, updatedHuman.body.length))
        setFoodsCollected(Math.max(0, Math.floor(updatedHuman.score / 10)))
        setEliminations(updatedHuman.eliminations)
      }

      // Check Game Over
      if (nextTickState.status === 'FINISHED') {
        handleFinished(nextTickState)
      } else {
        // Calculate dynamic tick interval: starts at 135ms, decreases to 90ms max over survival time
        const elapsedSeconds = (Date.now() - nextTickState.startTime) / 1000
        const currentInterval = Math.max(90, 135 - (elapsedSeconds / 3.0)) // speed up 1ms every 3 seconds
        timeoutId = setTimeout(tick, currentInterval)
      }
    }

    // Start recursive loop
    timeoutId = setTimeout(tick, 135)

    return () => clearTimeout(timeoutId)
  }, [playingState, difficulty])

  const simulateServerTick = (state: SnakeArenaState): SnakeArenaState => {
    const nextState = { ...state }
    const now = Date.now()
    nextState.tickCount++

    // Despawn expired foods & powerups
    nextState.foods = nextState.foods.filter(f => !f.expiresAt || f.expiresAt > now)
    nextState.powerups = nextState.powerups.filter(p => p.expiresAt > now)

    // Golden / Giant Food spawning
    if (nextState.tickCount % 50 === 0 && nextState.foods.filter(f => f.type !== 'normal').length < 3) {
      const x = Math.floor(Math.random() * (nextState.cols - 4) + 2)
      const y = Math.floor(Math.random() * (nextState.rows - 4) + 2)
      const fType = Math.random() > 0.5 ? 'golden' : 'giant'
      nextState.foods.push({
        id: `food-${Math.random().toString(36).substring(2, 9)}`,
        x,
        y,
        type: fType as any,
        value: fType === 'golden' ? 30 : 20,
        expiresAt: now + 8000
      })
    }

    // Powerups spawning
    if (nextState.tickCount % 80 === 0 && nextState.powerups.length < 3) {
      const types: PowerupItem['type'][] = ['speed', 'shield', 'ghost', 'magnet', 'freeze', 'double']
      nextState.powerups.push({
        id: `powerup-${Math.random().toString(36).substring(2, 9)}`,
        x: Math.floor(Math.random() * (nextState.cols - 4) + 2),
        y: Math.floor(Math.random() * (nextState.rows - 4) + 2),
        type: types[Math.floor(Math.random() * types.length)],
        expiresAt: now + 10000
      })
    }

    const active = Object.values(nextState.snakes).filter(s => s.status === 'ACTIVE')

    // Freeze powerup check
    const freezer = active.find(s => s.activePowerups.some(p => p.type === 'freeze'))

    // 1. Move bodies
    const nextBodies: Record<string, Position[]> = {}
    for (const snake of active) {
      if (freezer && freezer.userId !== snake.userId && nextState.tickCount % 2 === 0) {
        nextBodies[snake.userId] = [...snake.body]
        continue
      }

      const hasSpeed = snake.activePowerups.some(p => p.type === 'speed')
      const steps = hasSpeed ? 2 : 1
      let tempBody = [...snake.body]

      for (let s = 0; s < steps; s++) {
        if (tempBody.length === 0) break
        const head = tempBody[0]
        const dir = snake.direction
        const nextHead = { x: head.x + dir.x, y: head.y + dir.y }
        tempBody.unshift(nextHead)
        tempBody.pop()
      }
      nextBodies[snake.userId] = tempBody
      snake.survivalTime = Math.round((now - nextState.startTime) / 1000)
    }

    // 2. Collision checking
    const dead: string[] = []
    const elimLog: { deadId: string; killerId: string | null }[] = []

    for (const snake of active) {
      const body = nextBodies[snake.userId]
      if (!body || body.length === 0) continue
      const head = body[0]

      // Wall collision
      if (head.x < 0 || head.x >= nextState.cols || head.y < 0 || head.y >= nextState.rows) {
        dead.push(snake.userId)
        elimLog.push({ deadId: snake.userId, killerId: null })
        if (snake.userId === 'player-human') playSynthSound('death')
        continue
      }

      const isProtected = snake.spawnProtectedUntil > now

      // Self collision
      let hitSelf = false
      for (let i = 1; i < body.length; i++) {
        if (body[i].x === head.x && body[i].y === head.y) {
          hitSelf = true
          break
        }
      }
      if (hitSelf && !isProtected) {
        dead.push(snake.userId)
        elimLog.push({ deadId: snake.userId, killerId: null })
        if (snake.userId === 'player-human') playSynthSound('death')
        continue
      }

      // Other body collision
      let hitOther = false
      let killerId: string | null = null
      const hasGhost = snake.activePowerups.some(p => p.type === 'ghost')
      const hasShield = snake.activePowerups.some(p => p.type === 'shield')

      if (!isProtected && !hasGhost) {
        for (const other of active) {
          if (other.userId === snake.userId) continue
          if (other.spawnProtectedUntil > now) continue
          const otherBody = nextBodies[other.userId] || other.body
          for (let i = 1; i < otherBody.length; i++) {
            if (otherBody[i].x === head.x && otherBody[i].y === head.y) {
              hitOther = true
              killerId = other.userId
              break
            }
          }
          if (hitOther) break
        }
      }

      if (hitOther) {
        if (hasShield) {
          snake.activePowerups = snake.activePowerups.filter(p => p.type !== 'shield')
        } else {
          dead.push(snake.userId)
          elimLog.push({ deadId: snake.userId, killerId })
          if (snake.userId === 'player-human') playSynthSound('death')
        }
      }
    }

    // Head-to-head collisions
    const headLocs: Record<string, string[]> = {}
    for (const snake of active) {
      if (dead.includes(snake.userId)) continue
      const body = nextBodies[snake.userId]
      if (!body || body.length === 0) continue
      const head = body[0]
      const key = `${head.x},${head.y}`
      if (!headLocs[key]) headLocs[key] = []
      headLocs[key].push(snake.userId)
    }

    for (const key in headLocs) {
      const colliding = headLocs[key]
      if (colliding.length > 1) {
        let maxLen = -1
        for (const id of colliding) {
          const l = nextState.snakes[id].body.length
          if (l > maxLen) maxLen = l
        }
        const winners = colliding.filter(id => nextState.snakes[id].body.length === maxLen)
        if (winners.length > 1) {
          for (const id of colliding) {
            if (!dead.includes(id)) {
              dead.push(id)
              elimLog.push({ deadId: id, killerId: null })
              if (id === 'player-human') playSynthSound('death')
            }
          }
        } else {
          const winnerId = winners[0]
          for (const id of colliding) {
            if (id !== winnerId && !dead.includes(id)) {
              dead.push(id)
              elimLog.push({ deadId: id, killerId: winnerId })
              if (id === 'player-human') playSynthSound('death')
            }
          }
        }
      }
    }

    // Convert dead bodies to scattered foods
    for (const log of elimLog) {
      const s = nextState.snakes[log.deadId]
      s.status = 'ELIMINATED'

      s.body.forEach(seg => {
        const dx = Math.floor(Math.random() * 3) - 1
        const dy = Math.floor(Math.random() * 3) - 1
        nextState.foods.push({
          id: `food-${Math.random().toString(36).substring(2, 9)}`,
          x: Math.max(1, Math.min(nextState.cols - 2, seg.x + dx)),
          y: Math.max(1, Math.min(nextState.rows - 2, seg.y + dy)),
          type: 'dead',
          value: 15,
          expiresAt: now + 10000
        })
      })

      if (log.killerId) {
        const killer = nextState.snakes[log.killerId]
        if (killer) {
          killer.eliminations++
          killer.score += 50
        }
      }
    }

    // 3. Process food eating and powerups
    for (const snake of active) {
      if (dead.includes(snake.userId)) continue
      const body = nextBodies[snake.userId]
      if (!body || body.length === 0) continue
      const head = body[0]
      snake.body = body

      snake.activePowerups = snake.activePowerups.filter(p => p.expiresAt > now)

      // Collect powerup
      const pIdx = nextState.powerups.findIndex(p => p.x === head.x && p.y === head.y)
      if (pIdx !== -1) {
        const picked = nextState.powerups[pIdx]
        nextState.powerups.splice(pIdx, 1)
        snake.activePowerups = snake.activePowerups.filter(p => p.type !== picked.type)
        snake.activePowerups.push({ type: picked.type, expiresAt: now + 8000 })
        if (snake.userId === 'player-human') playSynthSound('powerup')
      }

      // Magnet pull
      const hasMagnet = snake.activePowerups.some(p => p.type === 'magnet')
      if (hasMagnet) {
        for (const f of nextState.foods) {
          const dist = Math.max(Math.abs(f.x - head.x), Math.abs(f.y - head.y))
          if (dist <= 2 && dist > 0) {
            f.x = head.x
            f.y = head.y
          }
        }
      }

      // Collect food
      const eatenIdxs: number[] = []
      nextState.foods.forEach((food, idx) => {
        if (food.x === head.x && food.y === head.y) {
          eatenIdxs.push(idx)
        }
      })

      if (eatenIdxs.length > 0) {
        for (const idx of eatenIdxs) {
          const food = nextState.foods[idx]
          const isDouble = snake.activePowerups.some(p => p.type === 'double')
          let grow = food.type === 'giant' ? 3 : 1
          if (isDouble) grow *= 2

          for (let g = 0; g < grow; g++) {
            const tail = snake.body[snake.body.length - 1] || head
            snake.body.push({ ...tail })
          }

          snake.score += isDouble ? food.value * 2 : food.value
          snake.length = snake.body.length

          if (snake.userId === 'player-human') {
            playSynthSound(food.type === 'golden' ? 'golden' : 'food')
          }
        }
        nextState.foods = nextState.foods.filter((_, idx) => !eatenIdxs.includes(idx))
        eatenIdxs.forEach(() => {
          nextState.foods.push({
            id: `food-${Math.random().toString(36).substring(2, 9)}`,
            x: Math.floor(Math.random() * (nextState.cols - 4) + 2),
            y: Math.floor(Math.random() * (nextState.rows - 4) + 2),
            type: 'normal',
            value: 10
          })
        })
      }
    }

    // 4. Verify game completion
    const survivors = Object.values(nextState.snakes).filter(s => s.status === 'ACTIVE')
    const humanAlive = nextState.snakes['player-human']?.status === 'ACTIVE'
    
    // Game ends if either the player is dead or all bot snakes are dead
    const botsAlive = survivors.filter(s => s.userId !== 'player-human').length > 0
    if (!humanAlive || !botsAlive) {
      nextState.status = 'FINISHED'
      nextState.winnerId = humanAlive ? 'player-human' : (survivors[0]?.userId || null)
    }

    return nextState
  }

  const handleFinished = (finalState: SnakeArenaState) => {
    setPlayingState('finished')
    
    const isWin = finalState.winnerId === 'player-human'
    if (isWin) {
      playSynthSound('victory')
    }

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    const resultOutcome = isWin ? 'win' : 'loss'

    const leaderboard = Object.values(finalState.snakes).sort((a, b) => b.score - a.score)
    const finalRank = leaderboard.findIndex(s => s.userId === 'player-human') + 1
    const finalLength = finalState.snakes['player-human']?.body.length ?? 3

    const customTitle = isWin ? 'Victory!' : 'Game Over'
    const customSubtitle = `Rank #${finalRank} • ${isWin ? 'Arena Master' : 'Arena Elimination'}`

    submitGameResult({
      gameSlug: 'snake-arena',
      result: resultOutcome,
      metadata: {
        score: finalState.snakes['player-human']?.score ?? 0,
        opponentScore: 0,
        durationSecs: duration,
        customTitle,
        customSubtitle,
        statistics: [
          { label: 'Rank', value: `#${finalRank}`, color: finalRank === 1 ? '#fbbf24' : 'white' },
          { label: 'Final Length', value: finalLength, color: '#10b981' },
          { label: 'Food Collected', value: foodsCollected, color: '#ec4899' },
          { label: 'Eliminations', value: eliminations, color: 'hsl(0 80% 65%)' },
          { label: 'Survival Time', value: `${duration}s`, color: '#38bdf8' },
        ],
        gameMetadata: {
          mode: isRanked ? 'ranked' : 'vs-ai',
          difficulty,
          foodsCollected,
          longestLength,
          eliminations,
          survivalTime: duration
        }
      }
    })

    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultOutcome,
          opponentName: 'ApexBot',
          gameSlug: 'snake-arena'
        })
      }).catch(err => console.error('Failed to submit ranked stats:', err))
    }
  }

  // Smooth Canvas coordinate interpolation drawing hook
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animFrame: number
    const em = effectManagerRef.current

    const render = () => {
      if (!gameState || !em) return
      
      const width = canvas.width
      const height = canvas.height
      const cols = gameState.cols
      const rows = gameState.rows
      const cellWidth = width / cols
      const cellHeight = height / rows

      // Clear Canvas with MapTheme palettes
      ctx.fillStyle = mapTheme === 'ice' ? 'hsl(200 40% 6%)' : mapTheme === 'lava' ? 'hsl(10 30% 5%)' : 'hsl(222 25% 6%)'
      ctx.fillRect(0, 0, width, height)

      // Draw Background Polish (drifting stars)
      em.drawBackgroundPolish(ctx, width, height)

      // Draw Grid lines
      ctx.strokeStyle = mapTheme === 'ice' ? 'rgba(100,200,255,0.04)' : mapTheme === 'lava' ? 'rgba(255,100,50,0.04)' : 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(c * cellWidth, 0)
        ctx.lineTo(c * cellWidth, height)
        ctx.stroke()
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath()
        ctx.moveTo(0, r * cellHeight)
        ctx.lineTo(width, r * cellHeight)
        ctx.stroke()
      }

      // Detection logic for food, powerups, and deaths
      const currentFoods = gameState.foods
      const currentPowerups = gameState.powerups
      const currentSnakes = gameState.snakes

      // Detect food eats
      for (const pf of em.prevFoodIds) {
        if (!currentFoods.some(cf => cf.id === pf.id)) {
          const fx = (pf.x + 0.5) * cellWidth
          const fy = (pf.y + 0.5) * cellHeight
          let color = '#10b981'
          if (pf.type === 'golden') color = '#fbbf24'
          else if (pf.type === 'giant') color = '#f97316'
          else if (pf.type === 'dead') color = '#ef4444'
          em.spawnExplosion(fx, fy, color, pf.type === 'giant' ? 18 : 10)
        }
      }
      em.prevFoodIds = currentFoods.map(f => ({ id: f.id, x: f.x, y: f.y, type: f.type })) as any

      // Detect powerups
      for (const pp of em.prevPowerupIds) {
        if (!currentPowerups.some(cp => cp.id === pp.id)) {
          const px = (pp.x + 0.5) * cellWidth
          const py = (pp.y + 0.5) * cellHeight
          em.spawnExplosion(px, py, '#8b5cf6', 22, 3.5)
        }
      }
      em.prevPowerupIds = currentPowerups.map(p => ({ id: p.id, x: p.x, y: p.y })) as any

      // Detect eliminations
      for (const sId in currentSnakes) {
        const cs = currentSnakes[sId]
        const prevState = em.prevSnakesState[sId]
        if (prevState === 'ACTIVE' && cs.status === 'ELIMINATED') {
          const head = cs.body[0] || { x: 20, y: 20 }
          const hx = (head.x + 0.5) * cellWidth
          const hy = (head.y + 0.5) * cellHeight
          em.spawnExplosion(hx, hy, cs.color, 35, 4.0)

          if (sId === 'player-human') {
            em.addNotification('💥 WASTED - YOU CRASHED!', '#ef4444', 150)
          } else {
            const human = currentSnakes['player-human']
            const wasKilledByHuman = cs.body.some(seg => {
              const hHead = human?.body[0]
              return hHead && Math.abs(seg.x - hHead.x) <= 1 && Math.abs(seg.y - hHead.y) <= 1
            })
            if (wasKilledByHuman) {
              em.addNotification(`🎯 ELIMINATED ${cs.username.toUpperCase()} (+50)`, '#fbbf24', 120)
            } else {
              em.addNotification(`💀 ${cs.username.toUpperCase()} CRASHED`, '#94a3b8', 95)
            }
          }
        }
      }

      // Sync active state map
      const nextSnakesState: Record<string, 'ACTIVE' | 'ELIMINATED'> = {}
      for (const sId in currentSnakes) {
        nextSnakesState[sId] = currentSnakes[sId].status
      }
      em.prevSnakesState = nextSnakesState

      // Interpolation progress factor
      const progress = Math.min(1, (Date.now() - lastTickTimeRef.current) / 100)

      // 1. Draw Food Items
      for (const food of gameState.foods) {
        ctx.beginPath()
        let pulse = 1 + Math.sin(Date.now() / 150) * 0.15
        const scale = em.getSpawnScale(food.id)
        let radius = (cellWidth / 1.8) * pulse * scale
        let color = '#10b981' // Green normal

        if (food.type === 'golden') {
          color = '#fbbf24' // Yellow gold
          ctx.shadowBlur = 18 // Glow
          ctx.shadowColor = '#fbbf24'
        } else if (food.type === 'giant') {
          color = '#f97316' // Orange giant
          radius = (cellWidth / 1.25) * pulse * scale
          ctx.shadowBlur = 15 // Glow
          ctx.shadowColor = '#f97316'
        } else if (food.type === 'dead') {
          color = '#ef4444' // Dotted red scattered
          radius = (cellWidth / 3.0) * scale
        }

        ctx.fillStyle = color
        ctx.arc((food.x + 0.5) * cellWidth, (food.y + 0.5) * cellHeight, radius, 0, 2 * Math.PI)
        ctx.fill()
        
        // Reset shadows
        ctx.shadowBlur = 0
      }

      // 2. Draw Powerups
      for (const powerup of gameState.powerups) {
        const x = (powerup.x + 0.5) * cellWidth
        const y = (powerup.y + 0.5) * cellHeight
        const pulse = 1 + Math.sin(Date.now() / 120) * 0.12
        const scale = em.getSpawnScale(powerup.id)
        const radius = (cellWidth / 1.6) * pulse * scale

        ctx.shadowBlur = 14
        ctx.shadowColor = '#8b5cf6'
        ctx.fillStyle = 'rgba(139, 92, 246, 0.25)'
        ctx.strokeStyle = '#8b5cf6'
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()

        // Draw SVG representation in powerup box
        const img = powerupImagesRef.current[powerup.type]
        if (img && img.complete) {
          const iconSize = radius * 1.25
          ctx.drawImage(img, x - iconSize / 2, y - iconSize / 2, iconSize, iconSize)
        } else {
          ctx.shadowBlur = 0
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${cellHeight * 0.7}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const label = powerup.type === 'double' ? '2x' : powerup.type.substring(0, 1).toUpperCase()
          ctx.fillText(label, x, y)
        }
      }

      // 3. Draw Snakes with smooth coordinate interpolation
      for (const sId in gameState.snakes) {
        const snake = gameState.snakes[sId]
        if (snake.status !== 'ACTIVE' || snake.body.length === 0) continue

        const isProtected = snake.spawnProtectedUntil > Date.now()
        // Spawn protection visual flashing
        if (isProtected && Math.floor(Date.now() / 100) % 2 === 0) continue

        ctx.lineWidth = cellWidth * 0.95 // Snake thickness
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = snake.color
        
        ctx.shadowBlur = 16 // Glow visibility
        ctx.shadowColor = snake.color

        // Draw body segments
        ctx.beginPath()
        
        // Interpolate head segment coordinates
        const head = snake.body[0]
        const dir = snake.direction
        const renderHeadX = head.x - dir.x * (1 - progress)
        const renderHeadY = head.y - dir.y * (1 - progress)
        
        ctx.moveTo((renderHeadX + 0.5) * cellWidth, (renderHeadY + 0.5) * cellHeight)

        for (let i = 0; i < snake.body.length; i++) {
          const seg = snake.body[i]
          ctx.lineTo((seg.x + 0.5) * cellWidth, (seg.y + 0.5) * cellHeight)
        }
        ctx.stroke()

        // Draw eyes on head
        ctx.shadowBlur = 0
        ctx.fillStyle = '#ffffff'
        const eyeRadius = cellWidth * 0.15
        const eyeOffset = cellWidth * 0.25
        
        const headX = (renderHeadX + 0.5) * cellWidth
        const headY = (renderHeadY + 0.5) * cellHeight

        // Left eye
        ctx.beginPath()
        ctx.arc(headX - eyeOffset * dir.y, headY - eyeOffset * dir.x, eyeRadius, 0, 2 * Math.PI)
        ctx.fill()
        // Right eye
        ctx.beginPath()
        ctx.arc(headX + eyeOffset * dir.y, headY + eyeOffset * dir.x, eyeRadius, 0, 2 * Math.PI)
        ctx.fill()

        // Shield powerup visual indicator ring
        const hasShield = snake.activePowerups.some(p => p.type === 'shield')
        if (hasShield) {
          ctx.strokeStyle = 'hsl(200 100% 60% / 0.5)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(headX, headY, cellWidth * 1.5, 0, 2 * Math.PI)
          ctx.stroke()
        }

        // Draw subtle radial glow behind local player's snake head
        if (sId === 'player-human') {
          ctx.save()
          ctx.beginPath()
          
          const pulseFactor = isProtected ? (1.35 + Math.sin(Date.now() / 100) * 0.25) : 1.1
          const glowRadius = cellWidth * pulseFactor
          const glowGrad = ctx.createRadialGradient(headX, headY, cellWidth * 0.2, headX, headY, glowRadius)
          
          const colorCenter = isProtected ? 'rgba(255, 255, 255, 0.95)' : `${snake.color}66`
          const colorEdge = isProtected ? 'rgba(251, 191, 36, 0)' : `${snake.color}00`
          
          glowGrad.addColorStop(0, colorCenter)
          if (isProtected) {
            glowGrad.addColorStop(0.3, `${snake.color}cc`)
          }
          glowGrad.addColorStop(1, colorEdge)
          
          ctx.fillStyle = glowGrad
          ctx.arc(headX, headY, glowRadius, 0, 2 * Math.PI)
          ctx.fill()

          if (isProtected) {
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 3
            ctx.shadowBlur = 10
            ctx.shadowColor = '#fbbf24'
            ctx.beginPath()
            ctx.arc(headX, headY, cellWidth * (0.85 + Math.sin(Date.now() / 120) * 0.15), 0, 2 * Math.PI)
            ctx.stroke()
          }

          ctx.restore()
        }

        // Draw floating player identifier above head
        ctx.fillStyle = sId === 'player-human' ? '#fbbf24' : '#ffffff'
        ctx.font = `bold ${cellHeight * 0.55}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        
        // Text outline/shadow for readability
        ctx.shadowBlur = 4
        ctx.shadowColor = 'rgba(0,0,0,0.85)'
        
        const labelText = sId === 'player-human' ? 'YOU' : snake.username
        ctx.fillText(labelText, headX, headY - cellHeight * 0.75)
        ctx.shadowBlur = 0 // reset shadow
      }

      // Draw collection particles
      em.updateAndDrawParticles(ctx)

      // Draw active kill notifications
      em.drawNotifications(ctx, width, cellHeight)

      animFrame = requestAnimationFrame(render)
    }

    animFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrame)
  }, [gameState, mapTheme])

  // Swipe gesture listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || playingState !== 'playing') return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    if (Math.max(absX, absY) < 30) return // Swipe threshold 30px

    let dir: Position | null = null
    if (absX > absY) {
      dir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 }
    } else {
      dir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }
    }

    if (dir) {
      const currentDir = playerDirRef.current
      const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
      if (!isOpposite) {
        playerDirRef.current = dir
      }
    }
    touchStartRef.current = null
  }

  // Active powerups calculation for HUD countdowns
  const humanSnake = gameState?.snakes['player-human']
  const myActivePowerups = humanSnake?.activePowerups || []

  // Leaderboard sorting
  const leaderboard = gameState
    ? Object.values(gameState.snakes).sort((a, b) => b.score - a.score)
    : []

  return (
    <div
      className="snake-arena-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Lobby Setup Screen */}
      {playingState === 'lobby' && (
        <div className="setup-panel animate-scaleUp">
          <div className="setup-header">
            <GameIcon slug="snake-arena" size={64} />
            <h2 className="text-hero" style={{ marginTop: '1rem' }}>Snake Arena</h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Solo vs AI Practice Arena</p>
          </div>

          <div className="setup-form">
            {isRanked && (
              <div style={{
                background: 'linear-gradient(90deg, #e11d48, #9f1239)',
                border: '1px solid #f43f5e',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 800,
                textAlign: 'center',
                marginBottom: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                animation: 'pulse 1.5s infinite'
              }}>
                ⚔️ Competitive Ranked Session
              </div>
            )}

            <div className="form-group">
              <label>AI Difficulty</label>
              <div className="difficulty-grid">
                {(['easy', 'medium', 'hard', 'nightmare'] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    className={`btn-diff ${difficulty === d ? 'active' : ''}`}
                    onClick={() => !isRanked && setDifficulty(d)}
                    disabled={isRanked}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label>Arena Map Theme</label>
              <div className="difficulty-grid">
                {(['classic', 'ice', 'lava', 'maze', 'neon'] as MapTheme[]).map(theme => (
                  <button
                    key={theme}
                    className={`btn-diff ${mapTheme === theme ? 'active' : ''}`}
                    onClick={() => setMapTheme(theme)}
                  >
                    {theme.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={startGame}>
              Start Solo Game
            </button>
          </div>
        </div>
      )}

      {/* 2. Start Countdown overlay */}
      {playingState === 'countdown' && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}

      {/* 3. Gameplay arena */}
      {(playingState === 'playing' || playingState === 'finished') && gameState && (
        <div className="arena-layout">
          <div className="arena-grid-wrapper">
            {/* Compact Horizontal Scoreboard Status Bar */}
            <div className="hud-status-bar">
              <div className="hud-status-item">
                <span className="hud-status-label">Score:</span>
                <span className="hud-status-value">{humanSnake?.score || 0}</span>
              </div>
              <div className="hud-status-item">
                <span className="hud-status-label">Kills:</span>
                <span className="hud-status-value text-red">{eliminations}</span>
              </div>
              <div className="hud-status-item">
                <span className="hud-status-label">Rank:</span>
                <span className="hud-status-value">#{leaderboard.findIndex(s => s.userId === 'player-human') + 1}</span>
              </div>
              <div className="hud-status-item flex-grow-right" style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <span className="hud-status-label" style={{ marginRight: '0.5rem' }}>Power:</span>
                <div className="hud-status-powerups" style={{ display: 'flex', gap: '0.35rem' }}>
                  {myActivePowerups.length === 0 ? (
                    <span className="hud-status-value-muted">None</span>
                  ) : (
                    myActivePowerups.map(p => {
                      const timeLeft = Math.max(0, Math.round((p.expiresAt - Date.now()) / 1000))
                      return (
                        <PowerupBadge key={p.type} type={p.type as any} timeLeft={timeLeft} />
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                width={960}
                height={640}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  border: '2px solid hsl(220 20% 18%)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
                }}
              />
            </div>
            <p className="mobile-controls-tip" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <LightbulbIcon size={14} style={{ color: 'hsl(45 100% 55%)' }} />
              <span>Swipe on the screen to change direction.</span>
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        .snake-arena-container {
          width: 100%;
          min-height: calc(100vh - 120px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .setup-panel {
          width: 100%;
          max-width: 480px;
          padding: 2.5rem 2rem;
          border-radius: 24px;
          border: 1px solid hsl(220 20% 18%);
          background: linear-gradient(135deg, hsl(222 22% 9% / 0.8), hsl(222 18% 12% / 0.8));
          backdrop-filter: blur(12px);
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          text-align: center;
        }

        .setup-form {
          margin-top: 2rem;
          text-align: left;
        }

        .form-group label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: hsl(220 10% 55%);
          text-transform: uppercase;
          margin-bottom: 0.5rem;
          letter-spacing: 0.05em;
        }

        .difficulty-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .btn-diff {
          background: hsl(220 20% 12%);
          border: 1px solid hsl(220 15% 18%);
          color: hsl(220 10% 70%);
          padding: 0.6rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-diff:hover {
          border-color: hsl(220 100% 65% / 0.3);
          color: white;
        }

        .btn-diff.active {
          background: hsl(220 100% 65% / 0.15);
          border-color: hsl(220 100% 65%);
          color: hsl(220 100% 65%);
        }

        .countdown-overlay {
          font-size: 7rem;
          font-weight: 900;
          color: #ffffff;
          animation: pulse 1s infinite;
        }

        .arena-layout {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 100%;
        }

        .hud-status-bar {
          display: flex;
          align-items: center;
          width: 100%;
          background: linear-gradient(135deg, hsl(222 22% 8% / 0.7), hsl(222 18% 10% / 0.7));
          border: 1px solid hsl(220 20% 15%);
          border-radius: 12px;
          padding: 0.6rem 1rem;
          gap: 1.5rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .hud-status-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .hud-status-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: hsl(220 10% 50%);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .hud-status-value {
          font-size: 0.95rem;
          font-weight: 800;
          color: #ffffff;
        }

        .hud-status-value.text-red {
          color: hsl(355 85% 65%);
        }

        .hud-status-value-muted {
          font-size: 0.8rem;
          font-weight: 600;
          color: hsl(220 10% 40%);
        }

        .hud-status-powerups {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .powerup-pill {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .powerup-pill.badge-speed {
          background: hsl(142 70% 45% / 0.15);
          border: 1px solid hsl(142 70% 45% / 0.4);
          color: hsl(142 70% 55%);
        }

        .powerup-pill.badge-shield {
          background: hsl(217 91% 60% / 0.15);
          border: 1px solid hsl(217 91% 60% / 0.4);
          color: hsl(217 91% 70%);
        }

        .powerup-pill.badge-ghost {
          background: hsl(271 91% 65% / 0.15);
          border: 1px solid hsl(271 91% 65% / 0.4);
          color: hsl(271 91% 75%);
        }

        .powerup-pill.badge-magnet {
          background: hsl(45 93% 47% / 0.15);
          border: 1px solid hsl(45 93% 47% / 0.4);
          color: hsl(45 93% 57%);
        }

        .powerup-pill.badge-freeze {
          background: hsl(190 90% 50% / 0.15);
          border: 1px solid hsl(190 90% 50% / 0.4);
          color: hsl(190 90% 60%);
        }

        .powerup-pill.badge-double {
          background: hsl(320 90% 50% / 0.15);
          border: 1px solid hsl(320 90% 50% / 0.4);
          color: hsl(320 90% 60%);
        }

        .arena-grid-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .canvas-container {
          position: relative;
          width: 100%;
        }

        .mobile-controls-tip {
          display: none;
          font-size: 0.78rem;
          color: hsl(220 10% 50%);
          margin-top: 0.25rem;
        }

        .leaderboard-panel {
          background: linear-gradient(135deg, hsl(222 22% 8% / 0.7), hsl(222 18% 10% / 0.7));
          border: 1px solid hsl(220 20% 15%);
          border-radius: 16px;
          padding: 1.25rem 1rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .leaderboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 800;
          color: #ffffff;
        }

        .collapsible-arrow {
          display: none;
          font-size: 0.8rem;
          color: hsl(220 10% 50%);
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.75rem;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
          font-size: 0.8rem;
          color: hsl(220 10% 80%);
        }

        .leaderboard-item.highlight {
          background: hsl(220 100% 65% / 0.08);
          color: #ffffff;
          font-weight: 700;
        }

        .dead-tag {
          font-size: 0.6rem;
          font-weight: 800;
          color: hsl(355 85% 55%);
          background: hsl(355 85% 55% / 0.12);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
        }

        .lobby-actions-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1rem;
        }

        .actions-card {
          width: 100%;
          max-width: 400px;
          background: hsl(222 25% 8%);
          border: 2px solid hsl(220 20% 18%);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 1.5rem;
        }

        .summary-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          color: hsl(220 10% 50%);
          text-transform: uppercase;
        }

        .summary-val {
          display: block;
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          margin-top: 0.25rem;
        }

        @media (max-width: 1024px) {
          .snake-arena-container {
            padding: 0.25rem;
          }
          .arena-layout {
            width: 100%;
            gap: 1rem;
          }
          .mobile-controls-tip {
            display: block;
          }
          .collapsible-arrow {
            display: block;
            cursor: pointer;
          }
        }

        @media (max-width: 767px) and (orientation: portrait) {
          .snake-arena-container {
            padding: 0.15rem !important;
          }
          .arena-layout {
            gap: 0.5rem !important;
          }
          .arena-grid-wrapper {
            width: 100% !important;
            gap: 0.4rem !important;
          }
          .hud-status-bar {
            padding: 0.4rem 0.6rem !important;
            gap: 0.5rem !important;
            margin-bottom: 0.4rem !important;
          }
          .canvas-container {
            height: 55vh !important;
            min-height: 350px !important;
            max-height: 500px !important;
            width: 100% !important;
          }
          .canvas-container canvas {
            width: 100% !important;
            height: 100% !important;
            aspect-ratio: auto !important;
          }
        }

        @media (max-width: 950px) and (orientation: landscape) {
          .canvas-container {
            height: 62vh !important;
            width: auto !important;
            margin: 0 auto !important;
            display: flex !important;
            justify-content: center !important;
          }
          .canvas-container canvas {
            height: 100% !important;
            width: auto !important;
            aspect-ratio: 960 / 640 !important;
          }
          .hud-status-bar {
            padding: 0.4rem 0.6rem !important;
            gap: 0.8rem !important;
            margin-bottom: 0.4rem !important;
          }
        }
      `}</style>
    </div>
  )
}
