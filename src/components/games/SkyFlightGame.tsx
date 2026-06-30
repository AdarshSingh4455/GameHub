'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useSearchParams } from 'next/navigation'
import {
  generateSkyFlightLayout,
  generateItemsForRange,
  getSkyFlightDifficulty,
  WeatherType,
  ObstacleInstance,
  CollectibleInstance,
  PowerupType,
  WEATHER_THEMES
} from '@/lib/skyFlightEngine'
import { audioSynth } from '@/lib/audioSynth'

type GameState = 'menu' | 'playing' | 'gameover' | 'paused'

export default function SkyFlightGame() {
  const { submitGameResult } = useGameSession()
  const searchParams = useSearchParams()

  // Game params
  const mode = searchParams.get('mode') || 'practice'
  const isRanked = mode === 'ranked'
  const targetScore = parseInt(searchParams.get('targetScore') || '1000', 10)
  const opponentName = searchParams.get('opponent') || 'ApexBot'

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [gameState, setGameState] = useState<GameState>('menu')
  const [isSoundMuted, setIsSoundMuted] = useState(false)

  // Scores & HUD states (kept in React for header overlay)
  const [score, setScore] = useState(0)
  const [distance, setDistance] = useState(0)
  const [coins, setCoins] = useState(0)
  const [activePowerup, setActivePowerup] = useState<PowerupType | null>(null)
  const [powerupTimeLeft, setPowerupTimeLeft] = useState(0)

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  
  // Game state reference for loop
  const stateRef = useRef({
    seed: 0,
    gameState: 'menu' as GameState,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    playerLane: 1, // 0=left, 1=center, 2=right
    playerX: 0.5,  // interpolated position (0.0 to 1.0)
    playerY: 0.85, // vertical position (fixed)
    shieldActive: false,
    magnetActive: false,
    turboActive: false,
    doubleActive: false,
    slowmoActive: false,
    powerupTimer: 0,
    powerupType: null as PowerupType | null,
    
    score: 0,
    distance: 0,
    coins: 0,
    collisions: 0,
    
    speed: 5,
    maxSpeed: 25,
    distanceTraveled: 0,
    
    obstacles: [] as ObstacleInstance[],
    collectibles: [] as CollectibleInstance[],
    weather: 'sunny' as WeatherType,
    skyGradient: [] as string[],
    
    lastTime: Date.now(),
    nextGenerateDistance: 0,
    
    // Visual assets/variables
    bgOffset: 0,
    particles: [] as { x: number; y: number; speed: number; size: number }[],
    clouds: [] as { x: number; y: number; scale: number; speed: number }[],
    
    keys: {} as Record<string, boolean>
  })

  // Toggle sound
  const handleToggleSound = () => {
    const nextMute = !isSoundMuted
    setIsSoundMuted(nextMute)
    localStorage.setItem('gamehub_audio_muted', nextMute ? 'true' : 'false')
    if (nextMute) {
      audioSynth.stopBgm()
    } else {
      audioSynth.startBgm('flight')
    }
  }

  // Load sound setting
  useEffect(() => {
    const isMuted = localStorage.getItem('gamehub_audio_muted') === 'true'
    setIsSoundMuted(isMuted)
  }, [])

  // Start new run
  const startGame = useCallback((nextDifficulty: 'easy' | 'medium' | 'hard') => {
    const querySeed = searchParams.get('seed')
    const seed = querySeed ? parseInt(querySeed, 10) : Math.floor(Math.random() * 1000000)

    const layout = generateSkyFlightLayout(seed, nextDifficulty)
    
    // Setup state
    const state = stateRef.current
    state.seed = seed
    state.gameState = 'playing'
    state.difficulty = nextDifficulty
    state.playerLane = 1
    state.playerX = 0.5
    state.shieldActive = false
    state.magnetActive = false
    state.turboActive = false
    state.doubleActive = false
    state.slowmoActive = false
    state.powerupTimer = 0
    state.powerupType = null
    state.score = 0
    state.distance = 0
    state.coins = 0
    state.collisions = 0
    state.speed = layout.baseSpeed
    state.distanceTraveled = 0
    state.weather = layout.weather
    state.skyGradient = layout.skyGradient
    state.nextGenerateDistance = 0
    state.obstacles = []
    state.collectibles = []
    
    // Generate initial obstacles
    const initialItems = generateItemsForRange(seed, nextDifficulty, 0, 3000)
    state.obstacles = initialItems.obstacles
    state.collectibles = initialItems.collectibles
    state.nextGenerateDistance = 3000
    
    // Weather particles
    state.particles = []
    const particleCount = layout.weather === 'rain' ? 80 : layout.weather === 'snow' ? 50 : 20
    for (let i = 0; i < particleCount; i++) {
      state.particles.push({
        x: Math.random(),
        y: Math.random(),
        speed: Math.random() * 4 + 4,
        size: Math.random() * 2 + 1
      })
    }

    // Clouds for parallax background
    state.clouds = []
    for (let i = 0; i < 6; i++) {
      state.clouds.push({
        x: Math.random(),
        y: Math.random() * 0.4,
        scale: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 0.05 + 0.05
      })
    }

    setScore(0)
    setDistance(0)
    setCoins(0)
    setActivePowerup(null)
    setGameState('playing')

    // Music
    audioSynth.stopBgm()
    audioSynth.startBgm('flight')
    
    state.lastTime = Date.now()
  }, [searchParams])

  // Move controls
  const moveLeft = () => {
    const state = stateRef.current
    if (state.gameState !== 'playing') return
    if (state.playerLane > 0) {
      state.playerLane--
      audioSynth.playTick()
    }
  }

  const moveRight = () => {
    const state = stateRef.current
    if (state.gameState !== 'playing') return
    if (state.playerLane < 2) {
      state.playerLane++
      audioSynth.playTick()
    }
  }

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        moveLeft()
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        moveRight()
      } else if (e.code === 'Space') {
        e.preventDefault()
        // Pause trigger
        const state = stateRef.current
        if (state.gameState === 'playing') {
          state.gameState = 'paused'
          setGameState('paused')
          audioSynth.stopBgm()
        } else if (state.gameState === 'paused') {
          state.gameState = 'playing'
          setGameState('playing')
          audioSynth.startBgm('flight')
          state.lastTime = Date.now()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Touch Swipe support
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
      if (dx < 0) {
        moveLeft()
      } else {
        moveRight()
      }
    }
    touchStartRef.current = null
  }

  // End Game
  const triggerGameOver = useCallback((finalScore: number, finalResult: 'win' | 'loss') => {
    const state = stateRef.current
    state.gameState = 'gameover'
    setGameState('gameover')
    audioSynth.stopBgm()
    
    if (finalResult === 'win') {
      audioSynth.playSuccess()
    } else {
      audioSynth.playExplosion()
    }

    // Submit Game Result
    submitGameResult({
      gameSlug: 'sky-flight',
      result: finalResult,
      metadata: {
        score: finalScore,
        customTitle: finalResult === 'win' ? 'Target Reached!' : 'Airship Crashed',
        customSubtitle: `Distance: ${Math.round(state.distanceTraveled)}m • Coins: ${state.coins}`,
        statistics: [
          { label: 'Score', value: finalScore, color: '#38bdf8' },
          { label: 'Distance', value: `${Math.round(state.distanceTraveled)}m`, color: '#10b981' },
          { label: 'Coins', value: state.coins, color: '#eab308' },
          { label: 'Collisions', value: state.collisions, color: '#ef4444' }
        ],
        gameMetadata: {
          difficulty: state.difficulty,
          distance: Math.round(state.distanceTraveled),
          coinsCollected: state.coins,
          isRanked,
          targetScore: isRanked ? targetScore : undefined
        }
      }
    })

    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: finalResult,
          opponentName
        })
      }).catch(err => console.error('Failed to submit ranked stats:', err))
    }
  }, [isRanked, targetScore, opponentName, submitGameResult])

  // Canvas Main Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    
    // Draw elements
    const draw = () => {
      const state = stateRef.current
      const width = canvas.width
      const height = canvas.height

      // ── Background Sky Gradient ──
      const grad = ctx.createLinearGradient(0, 0, 0, height)
      grad.addColorStop(0, state.skyGradient[0] || '#0284c7')
      grad.addColorStop(0.5, state.skyGradient[1] || '#38bdf8')
      grad.addColorStop(1, state.skyGradient[2] || '#bae6fd')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)

      // ── Parallax Background (Clouds & Sun/Moon) ──
      // Draw Weather-specific sun/moon
      if (state.weather === 'night') {
        // Moon
        ctx.fillStyle = '#f1f5f9'
        ctx.beginPath()
        ctx.arc(width * 0.75, height * 0.2, 25, 0, Math.PI * 2)
        ctx.fill()
        // Crater overlay
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.arc(width * 0.73, height * 0.18, 5, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // Sun
        ctx.fillStyle = state.weather === 'sunset' ? '#f97316' : state.weather === 'goldenhour' ? '#fbbf24' : '#fef08a'
        ctx.beginPath()
        ctx.arc(width * 0.75, height * 0.2, 35, 0, Math.PI * 2)
        ctx.fill()
      }

      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      state.clouds.forEach(c => {
        ctx.beginPath()
        const cx = c.x * width
        const cy = c.y * height
        const s = c.scale * 30
        ctx.arc(cx, cy, s, 0, Math.PI * 2)
        ctx.arc(cx - s * 0.8, cy + s * 0.2, s * 0.8, 0, Math.PI * 2)
        ctx.arc(cx + s * 0.8, cy + s * 0.2, s * 0.8, 0, Math.PI * 2)
        ctx.fill()
      })

      // ── Lanes ──
      const laneWidth = width / 3
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 2
      for (let i = 1; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(i * laneWidth, 0)
        ctx.lineTo(i * laneWidth, height)
        ctx.stroke()
      }

      // Lane indicators at the bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)'
      ctx.fillRect(state.playerLane * laneWidth, 0, laneWidth, height)

      // ── Obstacles & Collectibles ──
      // Obstacle styles & textures
      const drawObstacle = (obs: ObstacleInstance) => {
        const lx = obs.lane * laneWidth + laneWidth / 2
        const ly = height - (obs.distance - state.distanceTraveled)
        
        if (ly < -100 || ly > height + 100) return

        ctx.save()
        ctx.translate(lx, ly)
        
        switch (obs.type) {
          case 'bird':
            // Draw simple flapping bird silhouette
            ctx.fillStyle = '#1e293b'
            ctx.beginPath()
            ctx.moveTo(-15, 0)
            ctx.quadraticCurveTo(0, -10, 15, 0)
            ctx.quadraticCurveTo(0, 10, -15, 0)
            ctx.fill()
            break
          case 'cloud':
            ctx.fillStyle = 'rgba(241, 245, 249, 0.9)'
            ctx.strokeStyle = '#cbd5e1'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(0, 0, 20, 0, Math.PI * 2)
            ctx.arc(-15, 5, 15, 0, Math.PI * 2)
            ctx.arc(15, 5, 15, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
            break
          case 'lightning':
            ctx.fillStyle = '#facc15'
            ctx.beginPath()
            ctx.moveTo(0, -25)
            ctx.lineTo(-10, 5)
            ctx.lineTo(2, 5)
            ctx.lineTo(-5, 25)
            ctx.lineTo(12, -3)
            ctx.lineTo(2, -3)
            ctx.closePath()
            ctx.fill()
            break
          case 'plane':
            ctx.fillStyle = '#f43f5e'
            ctx.beginPath()
            ctx.moveTo(0, -20)
            ctx.lineTo(-25, 10)
            ctx.lineTo(-5, 10)
            ctx.lineTo(0, 20)
            ctx.lineTo(5, 10)
            ctx.lineTo(25, 10)
            ctx.closePath()
            ctx.fill()
            break
          case 'balloon':
            ctx.fillStyle = '#a855f7'
            ctx.beginPath()
            ctx.arc(0, -10, 15, 0, Math.PI * 2)
            ctx.fill()
            // Basket
            ctx.fillStyle = '#b45309'
            ctx.fillRect(-4, 12, 8, 8)
            // Strings
            ctx.strokeStyle = '#d1d5db'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(-4, 5)
            ctx.lineTo(-4, 12)
            ctx.moveTo(4, 5)
            ctx.lineTo(4, 12)
            ctx.stroke()
            break
          case 'windmill':
            ctx.strokeStyle = '#475569'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.moveTo(0, 25)
            ctx.lineTo(0, -10)
            ctx.stroke()
            // Blades
            const rot = (Date.now() / 150) % (Math.PI * 2)
            ctx.translate(0, -10)
            ctx.rotate(rot)
            ctx.fillStyle = '#94a3b8'
            for (let b = 0; b < 3; b++) {
              ctx.rotate((Math.PI * 2) / 3)
              ctx.fillRect(-3, 0, 6, 25)
            }
            break
        }
        ctx.restore()
      }

      state.obstacles.forEach(drawObstacle)

      // Collectibles (Coins & Powerups)
      const drawCollectible = (item: CollectibleInstance) => {
        const lx = item.lane * laneWidth + laneWidth / 2
        const ly = height - (item.distance - state.distanceTraveled)

        if (ly < -100 || ly > height + 100) return

        ctx.save()
        ctx.translate(lx, ly)

        if (item.type === 'coin') {
          // Spin rotation effect
          const scaleX = Math.abs(Math.sin(Date.now() / 150))
          ctx.scale(scaleX, 1)
          
          ctx.fillStyle = '#facc15'
          ctx.strokeStyle = '#ca8a04'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(0, 0, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          
          ctx.fillStyle = '#ca8a04'
          ctx.font = 'bold 10px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('$', 0, 0)
        } else {
          // Powerups
          const colors: Record<PowerupType, string> = {
            shield: '#3b82f6',
            slowmo: '#10b981',
            magnet: '#ec4899',
            turbo: '#ea580c',
            double: '#a855f7'
          }
          ctx.fillStyle = colors[item.type] || '#fff'
          ctx.beginPath()
          ctx.arc(0, 0, 14, 0, Math.PI * 2)
          ctx.fill()

          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()

          // Symbol
          ctx.fillStyle = '#fff'
          ctx.font = '11px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const labels: Record<PowerupType, string> = {
            shield: '🛡️',
            slowmo: '⏱️',
            magnet: '🧲',
            turbo: '⚡',
            double: '2x'
          }
          ctx.fillText(labels[item.type] || 'P', 0, 0)
        }

        ctx.restore()
      }

      state.collectibles.forEach(drawCollectible)

      // ── Player Airplane ──
      // Lane center X coordinates
      const laneCenters = [laneWidth / 2, laneWidth + laneWidth / 2, 2 * laneWidth + laneWidth / 2]
      const targetPlayerX = laneCenters[state.playerLane]
      // Smooth interpolation for fluid movement
      state.playerX += (targetPlayerX - state.playerX) * 0.22
      
      const px = state.playerX
      const py = state.playerY * height

      ctx.save()
      ctx.translate(px, py)
      
      // Roll tilt animation based on lane switching offset
      const tilt = (targetPlayerX - state.playerX) * 0.05
      ctx.rotate(tilt)

      // Turbo exhaust tail flame
      if (state.turboActive) {
        ctx.fillStyle = '#ff7a00'
        ctx.beginPath()
        ctx.moveTo(-6, 20)
        ctx.lineTo(0, 35 + Math.random() * 15)
        ctx.lineTo(6, 20)
        ctx.closePath()
        ctx.fill()
        
        ctx.fillStyle = '#ffd600'
        ctx.beginPath()
        ctx.moveTo(-3, 20)
        ctx.lineTo(0, 28 + Math.random() * 8)
        ctx.lineTo(3, 20)
        ctx.closePath()
        ctx.fill()
      }

      // Draw Jet Plane Body (Neon design)
      ctx.strokeStyle = state.turboActive ? '#ea580c' : state.shieldActive ? '#60a5fa' : '#a855f7'
      ctx.lineWidth = 3
      ctx.fillStyle = '#1e1b4b'

      // Left Wing
      ctx.beginPath()
      ctx.moveTo(-25, 10)
      ctx.lineTo(-8, -5)
      ctx.lineTo(-5, 15)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Right Wing
      ctx.beginPath()
      ctx.moveTo(25, 10)
      ctx.lineTo(8, -5)
      ctx.lineTo(5, 15)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Fuselage (Main Body)
      ctx.beginPath()
      ctx.moveTo(0, -25)
      ctx.lineTo(-6, 12)
      ctx.lineTo(6, 12)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Canopy Glass
      ctx.fillStyle = '#60a5fa'
      ctx.beginPath()
      ctx.moveTo(0, -14)
      ctx.lineTo(-3, 2)
      ctx.lineTo(3, 2)
      ctx.closePath()
      ctx.fill()

      // Active Shield Bubble
      if (state.shieldActive) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, -3, 30, 0, Math.PI * 2)
        ctx.stroke()
        // Shield glow fill
        ctx.fillStyle = 'rgba(96, 165, 250, 0.08)'
        ctx.fill()
      }

      ctx.restore()

      // ── Weather Particles (Rain / Snow / Dust) ──
      ctx.fillStyle = state.weather === 'rain' ? '#60a5fa' : state.weather === 'snow' ? '#ffffff' : 'rgba(255,255,255,0.2)'
      state.particles.forEach(p => {
        const px = p.x * width
        const py = p.y * height
        if (state.weather === 'rain') {
          ctx.fillRect(px, py, 1.5, p.speed * 1.5)
        } else {
          ctx.beginPath()
          ctx.arc(px, py, p.size, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }

    // Main Update Function
    const update = () => {
      const state = stateRef.current
      if (state.gameState !== 'playing') return

      const now = Date.now()
      const dt = (now - state.lastTime) / 1000
      state.lastTime = now

      // Increase speed progression
      const diffConfig = getSkyFlightDifficulty(state.difficulty)
      const currentSpeedCoeff = state.slowmoActive ? 0.45 : state.turboActive ? 2.2 : 1.0
      state.speed = Math.min(
        state.maxSpeed,
        diffConfig.baseSpeed + (state.distanceTraveled * diffConfig.speedIncrement) / 500
      )
      
      const frameSpeed = state.speed * currentSpeedCoeff * 70 * dt
      state.distanceTraveled += frameSpeed * 0.1
      setDistance(Math.round(state.distanceTraveled))

      // Scoring formula: ticks distance x multiplier
      const scoreGain = frameSpeed * 0.25 * diffConfig.scoreMultiplier * (state.doubleActive ? 2.0 : 1.0)
      state.score += scoreGain
      setScore(Math.round(state.score))

      // Seed-based procedural chunks loading
      if (state.distanceTraveled + 2000 > state.nextGenerateDistance) {
        const nextItems = generateItemsForRange(
          state.seed,
          state.difficulty,
          state.nextGenerateDistance,
          state.nextGenerateDistance + 2000
        )
        state.obstacles.push(...nextItems.obstacles)
        state.collectibles.push(...nextItems.collectibles)
        state.nextGenerateDistance += 2000
      }

      // Filter out passed objects to save memory
      state.obstacles = state.obstacles.filter(obs => obs.distance > state.distanceTraveled - 100)
      state.collectibles = state.collectibles.filter(item => item.distance > state.distanceTraveled - 100)

      // Active powerup timers countdown
      if (state.powerupTimer > 0) {
        state.powerupTimer -= dt
        setPowerupTimeLeft(Math.max(0, Math.round(state.powerupTimer)))
        if (state.powerupTimer <= 0) {
          // Deactivate
          state.shieldActive = false
          state.magnetActive = false
          state.turboActive = false
          state.doubleActive = false
          state.slowmoActive = false
          state.powerupType = null
          setActivePowerup(null)
        }
      }

      // Parallax objects updates
      state.clouds.forEach(c => {
        c.x -= c.speed * dt
        if (c.x < -0.2) c.x = 1.2
      })

      state.particles.forEach(p => {
        p.y += p.speed * dt * (state.slowmoActive ? 0.5 : 1.0)
        if (p.y > 1.0) {
          p.y = -0.1
          p.x = Math.random()
        }
      })

      // Magnet logic: pull coins towards player
      if (state.magnetActive) {
        state.collectibles.forEach(item => {
          if (item.type === 'coin') {
            const dy = item.distance - state.distanceTraveled
            // If close vertically
            if (dy < 600) {
              const laneX = item.lane * (canvas.width / 3) + (canvas.width / 6)
              const dx = state.playerX - laneX
              // pull coordinates
              if (Math.abs(dx) > 10) {
                // pull item closer horizontally
                if (dx > 0) {
                  item.lane = state.playerLane // snap
                }
              }
            }
          }
        })
      }

      // ── Collisions & Collects checking ──
      const playerLane = state.playerLane
      // Player vertical bounds: 0.85 * canvasHeight
      // Let's project player bounds into distance unit coords:
      const playerDistPos = state.distanceTraveled

      // check collectible grabs
      state.collectibles.forEach((item, idx) => {
        if (item.lane === playerLane) {
          // If Y position of player matches item
          const distDiff = Math.abs(item.distance - playerDistPos)
          // height of item is 40-50, checking offset overlap
          if (distDiff < 45) {
            // Picked up!
            audioSynth.playPop()
            // Remove from list
            state.collectibles.splice(idx, 1)

            if (item.type === 'coin') {
              state.coins++
              setCoins(state.coins)
              state.score += 50 * diffConfig.scoreMultiplier
              setScore(Math.round(state.score))
            } else {
              // Powerup
              audioSynth.playPowerup()
              state.powerupType = item.type
              setActivePowerup(item.type)
              state.powerupTimer = 8 // 8 seconds duration
              
              // reset all
              state.shieldActive = false
              state.magnetActive = false
              state.turboActive = false
              state.doubleActive = false
              state.slowmoActive = false

              if (item.type === 'shield') state.shieldActive = true
              else if (item.type === 'magnet') state.magnetActive = true
              else if (item.type === 'turbo') state.turboActive = true
              else if (item.type === 'double') state.doubleActive = true
              else if (item.type === 'slowmo') state.slowmoActive = true
            }
          }
        }
      })

      // Check obstacle collisions
      if (!state.turboActive) {
        state.obstacles.forEach((obs, idx) => {
          if (obs.lane === playerLane) {
            const distDiff = Math.abs(obs.distance - playerDistPos)
            // height of obstacle is 80, checking overlap
            if (distDiff < 55) {
              // Collided!
              state.obstacles.splice(idx, 1)
              state.collisions++

              if (state.shieldActive) {
                // Break shield
                state.shieldActive = false
                state.powerupTimer = 0
                setActivePowerup(null)
                audioSynth.playBuzzer()
              } else {
                // Game Over!
                triggerGameOver(Math.round(state.score), 'loss')
              }
            }
          }
        })
      }

      // Check early ranked win criteria
      if (isRanked && state.score >= targetScore) {
        triggerGameOver(Math.round(state.score), 'win')
      }
    }

    // Animation Tick
    const tick = () => {
      const state = stateRef.current
      if (state.gameState === 'playing') {
        update()
        draw()
      }
      animId = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [startGame, triggerGameOver, isRanked, targetScore])

  // Start run automatically in ranked mode
  useEffect(() => {
    if (isRanked) {
      startGame(difficulty)
    }
    return () => {
      audioSynth.stopBgm()
    }
  }, [isRanked, startGame, difficulty])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'hsl(222 24% 7%)',
        borderRadius: '16px',
        padding: '1.25rem',
        color: '#f8fafc',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* HUD Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '380px',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          zIndex: 5
        }}
      >
        <div>
          <span style={{ color: '#94a3b8' }}>Score: </span>
          <span style={{ fontWeight: 700, color: '#a855f7' }}>{score}</span>
          {isRanked && (
            <span style={{ color: '#475569', marginLeft: '0.4rem' }}>/ {targetScore}</span>
          )}
        </div>
        <div>
          <span style={{ color: '#94a3b8' }}>Distance: </span>
          <span style={{ fontWeight: 700 }}>{distance}m</span>
        </div>
        <div>
          <span style={{ color: '#facc15' }}>🪙 {coins}</span>
        </div>
      </div>

      {/* Sound Mute */}
      <button
        onClick={handleToggleSound}
        style={{
          position: 'absolute',
          top: '2.8rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          padding: '0.35rem 0.6rem',
          borderRadius: '6px',
          color: '#f8fafc',
          cursor: 'pointer',
          fontSize: '0.75rem',
          zIndex: 10
        }}
      >
        {isSoundMuted ? '🔇 Muted' : '🔊 Sound'}
      </button>

      {/* ── Active Powerup Banner ── */}
      {activePowerup && (
        <div
          style={{
            position: 'absolute',
            top: '3rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(168,85,247,0.25)',
            border: '1px solid #a855f7',
            padding: '0.3rem 1rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            zIndex: 10,
            animation: 'pulse 1s infinite'
          }}
        >
          <span>
            {activePowerup === 'shield' && '🛡️ Shield Active'}
            {activePowerup === 'slowmo' && '⏱️ Slow-Mo Active'}
            {activePowerup === 'magnet' && '🧲 Magnet Active'}
            {activePowerup === 'turbo' && '⚡ Turbo Speed!'}
            {activePowerup === 'double' && '✨ Double Score (2x)'}
          </span>
          <span style={{ color: '#e2e8f0' }}>({powerupTimeLeft}s)</span>
        </div>
      )}

      {/* Main Canvas View */}
      {gameState === 'menu' ? (
        <div style={{ textAlign: 'center', maxWidth: '380px', padding: '2rem 1rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginBottom: '1rem' }}>
            Sky Flight
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '2rem' }}>
            Steer your airplane. Dodge birds, storm clouds, and lightning while gathering coins and turbo powerups!
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
            {(['easy', 'medium', 'hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: difficulty === d ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                  background: difficulty === d ? '#38bdf8' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => startGame(difficulty)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px' }}
          >
            Take Off
          </button>
        </div>
      ) : (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ position: 'relative', width: '100%', maxWidth: '380px', height: '480px' }}
        >
          <canvas
            ref={canvasRef}
            width={380}
            height={480}
            style={{
              display: 'block',
              background: '#0284c7',
              borderRadius: '12px',
              width: '100%',
              height: '100%'
            }}
          />

          {/* Pause overlay */}
          {gameState === 'paused' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.6)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px'
              }}
            >
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Game Paused</h3>
              <button
                className="btn btn-primary"
                onClick={() => {
                  stateRef.current.gameState = 'playing'
                  setGameState('playing')
                  audioSynth.startBgm('flight')
                  stateRef.current.lastTime = Date.now()
                }}
              >
                Resume Flight
              </button>
            </div>
          )}

          {/* Game Over overlay */}
          {gameState === 'gameover' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px'
              }}
            >
              <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', marginBottom: '0.5rem' }}>
                Game Over
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
                Score: {score} • Coins: {coins}
              </p>
              <button
                className="btn btn-primary"
                onClick={() => startGame(difficulty)}
                style={{ padding: '0.6rem 1.5rem' }}
              >
                Fly Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* Controls description for Desktop / Buttons for Mobile */}
      {gameState === 'playing' && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', width: '100%', maxWidth: '380px' }}>
          <button
            onClick={moveLeft}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '1.25rem',
              cursor: 'pointer'
            }}
          >
            ◀ Left
          </button>
          <button
            onClick={moveRight}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '1.25rem',
              cursor: 'pointer'
            }}
          >
            Right ▶
          </button>
        </div>
      )}
      {gameState === 'playing' && (
        <span style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.5rem' }}>
          Desktop: Use Arrow keys / A D to steer. Space to pause.
        </span>
      )}
    </div>
  )
}
