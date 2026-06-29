'use client'
import { PlaneIcon } from '@/components/shared/Icons'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Bullet {
  x: number
  y: number
  width: number
  height: number
  speed: number
  isMultishot?: boolean
}

interface EnemyBullet {
  x: number
  y: number
  speed: number
  vx?: number
  vy?: number
}

interface Enemy {
  x: number
  y: number
  width: number
  height: number
  speed: number
  type: 'drone' | 'fighter' | 'elite' | 'boss'
  hp: number
  maxHp: number
  direction?: number
  shootTimer?: number | null
  dead?: boolean
  hitFlashTimer?: number // frames remaining for white flash
  zigzagTimer?: number  // for drone zigzag
  zigzagDir?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  decay: number
}

interface Star {
  x: number
  y: number
  size: number
  speed: number
  opacity: number
}

interface Powerup {
  x: number
  y: number
  type: 'shield' | 'multishot'
  speed: number
  pulseTimer: number
}

// ─── WAVE CONFIG ─────────────────────────────────────────────────────────────

interface WaveConfig {
  enemyTypes: ('drone' | 'fighter' | 'elite')[]
  count: number
  isBossWave: boolean
  spawnInterval: number // ms
}

function getWaveConfig(wave: number): WaveConfig {
  const cycle = ((wave - 1) % 9) // 0-8 for non-boss waves, then boss on 10th
  const tier = Math.floor((wave - 1) / 10) // difficulty tier per 10-wave cycle

  if (wave % 10 === 0) {
    return { enemyTypes: [], count: 1, isBossWave: true, spawnInterval: 0 }
  }

  const baseCount = 6 + cycle * 2 + tier * 3
  const baseInterval = Math.max(400, 1200 - cycle * 100 - tier * 50)

  if (cycle < 3) {
    return { enemyTypes: ['drone'], count: baseCount, isBossWave: false, spawnInterval: baseInterval }
  } else if (cycle < 6) {
    return { enemyTypes: ['drone', 'fighter'], count: baseCount, isBossWave: false, spawnInterval: baseInterval }
  } else {
    return { enemyTypes: ['drone', 'fighter', 'elite'], count: baseCount, isBossWave: false, spawnInterval: baseInterval }
  }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function FighterJetGame() {
  const { submitGameResult, isLoading } = useGameSession()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [wave, setWave] = useState(1)
  const [enemiesLeft, setEnemiesLeft] = useState(0)
  const [waveSize, setWaveSize] = useState(0)
  const [bossHp, setBossHp] = useState<number | null>(null)
  const [bossMaxHp, setBossMaxHp] = useState<number>(1)
  const [isBossWave, setIsBossWave] = useState(false)
  const [multishotActive, setMultishotActive] = useState(false)
  const [shieldCount, setShieldCount] = useState(3)
  const [bossWarning, setBossWarning] = useState(false)

  const stateRef = useRef({
    player: { x: 185, y: 500, width: 32, height: 38, speed: 6, lives: 3 },
    bullets: [] as Bullet[],
    enemyBullets: [] as EnemyBullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    stars: [] as Star[],
    powerups: [] as Powerup[],
    score: 0,
    wave: 1,
    waveEnemiesSpawned: 0,
    waveEnemiesKilled: 0,
    waveConfig: getWaveConfig(1),
    spawnTimer: 0,
    bossActive: false,
    bossWarning: false,
    bossWarningTimer: 0,
    multishotActive: false,
    multishotTimer: 0,
    keys: {} as Record<string, boolean>,
    touchStart: { x: 0, y: 0 },
    touchPlayerStart: { x: 0, y: 0 },
    screenShakeX: 0,
    screenShakeY: 0,
    screenShakeTimer: 0,
    lastTime: 0,
    gameDuration: 0,
    enemiesDestroyed: 0,
    bossesDefeated: 0,
    shotsFired: 0,
    shotsHit: 0,
    invincibleTimer: 0, // frames of post-hit invincibility
    gameOver: false,
  })

  // ── START / RESTART ──────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setScore(0)
    setLives(3)
    setWave(1)
    setEnemiesLeft(0)
    setWaveSize(0)
    setBossHp(null)
    setIsBossWave(false)
    setBossWarning(false)
    setMultishotActive(false)
    setShieldCount(3)
    setIsPlaying(true)

    const stars: Star[] = []
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * 400,
        y: Math.random() * 600,
        size: Math.random() * 2 + 0.3,
        speed: Math.random() * 1.8 + 0.3,
        opacity: Math.random() * 0.6 + 0.2,
      })
    }

    const waveConfig = getWaveConfig(1)
    stateRef.current = {
      player: { x: 185, y: 500, width: 32, height: 38, speed: 6, lives: 3 },
      bullets: [],
      enemyBullets: [],
      enemies: [],
      particles: [],
      stars,
      powerups: [],
      score: 0,
      wave: 1,
      waveEnemiesSpawned: 0,
      waveEnemiesKilled: 0,
      waveConfig,
      spawnTimer: 0,
      bossActive: false,
      bossWarning: false,
      bossWarningTimer: 0,
      multishotActive: false,
      multishotTimer: 0,
      keys: {},
      touchStart: { x: 0, y: 0 },
      touchPlayerStart: { x: 0, y: 0 },
      screenShakeX: 0,
      screenShakeY: 0,
      screenShakeTimer: 0,
      lastTime: Date.now(),
      gameDuration: 0,
      enemiesDestroyed: 0,
      bossesDefeated: 0,
      shotsFired: 0,
      shotsHit: 0,
      invincibleTimer: 0,
      gameOver: false,
    }
  }, [])

  // ── KEYBOARD ────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault()
      }
      stateRef.current.keys[e.code] = true
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys[e.code] = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // ── CANVAS DRAW HELPERS ──────────────────────────────────────────────────

  const drawPlayerJet = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, multishotOn: boolean) => {
    const cx = x + w / 2
    ctx.save()

    // Thruster flames (animated, drawn first so jet overlaps)
    const flameH1 = 8 + Math.random() * 10
    const flameH2 = 6 + Math.random() * 8
    // Left engine flame
    const leftEngineX = x + 6
    const rightEngineX = x + w - 10
    const engineY = y + h

    const flameGrad = (ex: number) => {
      const g = ctx.createLinearGradient(ex, engineY, ex, engineY + flameH1)
      g.addColorStop(0, 'rgba(255,160,0,0.95)')
      g.addColorStop(0.5, 'rgba(255,80,0,0.7)')
      g.addColorStop(1, 'rgba(255,60,0,0)')
      return g
    }
    ctx.beginPath()
    ctx.moveTo(leftEngineX, engineY)
    ctx.lineTo(leftEngineX + 4, engineY + flameH1)
    ctx.lineTo(leftEngineX + 8, engineY)
    ctx.fillStyle = flameGrad(leftEngineX + 4)
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(rightEngineX, engineY)
    ctx.lineTo(rightEngineX + 4, engineY + flameH2)
    ctx.lineTo(rightEngineX + 8, engineY)
    ctx.fillStyle = flameGrad(rightEngineX + 4)
    ctx.fill()

    // Main body gradient
    const bodyGrad = ctx.createLinearGradient(x, y, x + w, y)
    bodyGrad.addColorStop(0, 'hsl(142 60% 30%)')
    bodyGrad.addColorStop(0.5, 'hsl(142 70% 50%)')
    bodyGrad.addColorStop(1, 'hsl(142 60% 30%)')

    // Fuselage (tapered body)
    ctx.beginPath()
    ctx.moveTo(cx, y)                            // nose tip
    ctx.lineTo(cx + 6, y + h * 0.35)            // right shoulder
    ctx.lineTo(cx + w * 0.48, y + h * 0.85)     // right engine mount
    ctx.lineTo(cx - w * 0.48, y + h * 0.85)     // left engine mount
    ctx.lineTo(cx - 6, y + h * 0.35)            // left shoulder
    ctx.closePath()
    ctx.fillStyle = bodyGrad
    ctx.fill()
    ctx.strokeStyle = 'hsl(142 80% 65%)'
    ctx.lineWidth = 0.8
    ctx.stroke()

    // Left swept wing
    ctx.beginPath()
    ctx.moveTo(cx - 4, y + h * 0.35)
    ctx.lineTo(x - 14, y + h * 0.72)
    ctx.lineTo(x - 8, y + h * 0.85)
    ctx.lineTo(cx - w * 0.48, y + h * 0.85)
    ctx.closePath()
    const wingGradL = ctx.createLinearGradient(x - 14, y + h * 0.35, cx, y + h * 0.85)
    wingGradL.addColorStop(0, 'hsl(142 60% 22%)')
    wingGradL.addColorStop(1, 'hsl(142 70% 42%)')
    ctx.fillStyle = wingGradL
    ctx.fill()
    ctx.strokeStyle = 'hsl(142 60% 50%)'
    ctx.lineWidth = 0.6
    ctx.stroke()

    // Right swept wing
    ctx.beginPath()
    ctx.moveTo(cx + 4, y + h * 0.35)
    ctx.lineTo(x + w + 14, y + h * 0.72)
    ctx.lineTo(x + w + 8, y + h * 0.85)
    ctx.lineTo(cx + w * 0.48, y + h * 0.85)
    ctx.closePath()
    const wingGradR = ctx.createLinearGradient(x + w + 14, y + h * 0.35, cx, y + h * 0.85)
    wingGradR.addColorStop(0, 'hsl(142 60% 22%)')
    wingGradR.addColorStop(1, 'hsl(142 70% 42%)')
    ctx.fillStyle = wingGradR
    ctx.fill()
    ctx.strokeStyle = 'hsl(142 60% 50%)'
    ctx.lineWidth = 0.6
    ctx.stroke()

    // Cockpit canopy
    ctx.beginPath()
    ctx.ellipse(cx, y + h * 0.28, 4.5, 8, 0, 0, Math.PI * 2)
    const cockpitGrad = ctx.createRadialGradient(cx - 1, y + h * 0.23, 1, cx, y + h * 0.28, 7)
    cockpitGrad.addColorStop(0, 'hsl(195 100% 85%)')
    cockpitGrad.addColorStop(0.6, 'hsl(195 100% 60%)')
    cockpitGrad.addColorStop(1, 'hsl(195 100% 35%)')
    ctx.fillStyle = cockpitGrad
    ctx.fill()

    // Multishot indicator glow ring
    if (multishotOn) {
      ctx.beginPath()
      ctx.ellipse(cx, y + h * 0.28, 7, 11, 0, 0, Math.PI * 2)
      ctx.strokeStyle = 'hsl(45 100% 65%)'
      ctx.lineWidth = 1.5
      ctx.shadowColor = 'hsl(45 100% 65%)'
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  const drawDrone = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const { x, y, w: _w, h: _h, hitFlashTimer = 0 } = { w: enemy.width, h: enemy.height, ...enemy }
    const cx = x + enemy.width / 2
    const cy = y + enemy.height / 2
    ctx.save()
    const color = hitFlashTimer > 0 ? 'white' : 'hsl(185 100% 55%)'
    ctx.fillStyle = color
    ctx.shadowColor = hitFlashTimer > 0 ? 'white' : 'hsl(185 100% 70%)'
    ctx.shadowBlur = hitFlashTimer > 0 ? 12 : 6

    // Teardrop body
    ctx.beginPath()
    ctx.moveTo(cx, y)
    ctx.bezierCurveTo(cx + 8, y + 4, cx + 8, y + enemy.height - 2, cx, y + enemy.height)
    ctx.bezierCurveTo(cx - 8, y + enemy.height - 2, cx - 8, y + 4, cx, y)
    ctx.fill()

    // Side nubs
    ctx.fillRect(x, cy - 2, 4, 4)
    ctx.fillRect(x + enemy.width - 4, cy - 2, 4, 4)
    ctx.restore()
  }

  const drawFighter = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const { x, y, hitFlashTimer = 0 } = enemy
    const w = enemy.width, h = enemy.height
    const cx = x + w / 2
    ctx.save()
    const baseColor = hitFlashTimer > 0 ? 'white' : 'hsl(0 80% 55%)'
    const accentColor = hitFlashTimer > 0 ? 'white' : 'hsl(25 100% 55%)'
    ctx.shadowColor = hitFlashTimer > 0 ? 'white' : 'hsl(0 80% 70%)'
    ctx.shadowBlur = hitFlashTimer > 0 ? 14 : 5

    // Diamond body
    ctx.fillStyle = baseColor
    ctx.beginPath()
    ctx.moveTo(cx, y + h)        // bottom point
    ctx.lineTo(x, y + h * 0.5)  // left mid
    ctx.lineTo(cx, y)            // top point (nose toward player)
    ctx.lineTo(x + w, y + h * 0.5) // right mid
    ctx.closePath()
    ctx.fill()

    // Wing sweeps
    ctx.fillStyle = accentColor
    ctx.beginPath()
    ctx.moveTo(x, y + h * 0.5)
    ctx.lineTo(x - 8, y + h * 0.75)
    ctx.lineTo(x + 4, y + h * 0.8)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(x + w, y + h * 0.5)
    ctx.lineTo(x + w + 8, y + h * 0.75)
    ctx.lineTo(x + w - 4, y + h * 0.8)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  const drawElite = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const { x, y, hitFlashTimer = 0 } = enemy
    const w = enemy.width, h = enemy.height
    const cx = x + w / 2
    ctx.save()
    const baseColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 55%)'
    const glowColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 100% 75%)'
    ctx.shadowColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 70%)'
    ctx.shadowBlur = hitFlashTimer > 0 ? 16 : 8

    // Main swept-wing craft
    ctx.fillStyle = baseColor
    ctx.beginPath()
    ctx.moveTo(cx, y + h)              // bottom tip (faces player, going down)
    ctx.lineTo(x - 6, y + h * 0.6)
    ctx.lineTo(x - 14, y + h * 0.35)  // left wing tip
    ctx.lineTo(x + 4, y + h * 0.1)    // left shoulder
    ctx.lineTo(cx, y)                  // nose
    ctx.lineTo(x + w - 4, y + h * 0.1)
    ctx.lineTo(x + w + 14, y + h * 0.35) // right wing tip
    ctx.lineTo(x + w + 6, y + h * 0.6)
    ctx.closePath()
    ctx.fill()

    // Glowing cannon
    ctx.fillStyle = glowColor
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(cx, y + h * 0.75, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const drawBoss = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
    const { x, y, hitFlashTimer = 0 } = enemy
    const w = enemy.width, h = enemy.height
    const cx = x + w / 2
    ctx.save()
    const baseColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 30%)'
    const accentColor = hitFlashTimer > 0 ? 'white' : 'hsl(0 90% 55%)'
    const glowColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 65%)'
    ctx.shadowColor = hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 60%)'
    ctx.shadowBlur = hitFlashTimer > 0 ? 20 : 14

    // Main hull
    const hullGrad = ctx.createLinearGradient(x, y, x, y + h)
    hullGrad.addColorStop(0, hitFlashTimer > 0 ? 'white' : 'hsl(270 60% 25%)')
    hullGrad.addColorStop(1, hitFlashTimer > 0 ? 'white' : 'hsl(270 80% 40%)')
    ctx.fillStyle = hullGrad
    ctx.beginPath()
    ctx.moveTo(cx, y + h)           // bottom center
    ctx.lineTo(x + 10, y + h * 0.6)
    ctx.lineTo(x, y + h * 0.2)      // left shoulder
    ctx.lineTo(cx - 10, y)          // top left
    ctx.lineTo(cx + 10, y)          // top right
    ctx.lineTo(x + w, y + h * 0.2)  // right shoulder
    ctx.lineTo(x + w - 10, y + h * 0.6)
    ctx.closePath()
    ctx.fill()

    // Left death-wing
    ctx.fillStyle = baseColor
    ctx.beginPath()
    ctx.moveTo(x, y + h * 0.2)
    ctx.lineTo(x - 28, y + h * 0.55)
    ctx.lineTo(x - 18, y + h * 0.7)
    ctx.lineTo(x + 10, y + h * 0.6)
    ctx.closePath()
    ctx.fill()

    // Right death-wing
    ctx.beginPath()
    ctx.moveTo(x + w, y + h * 0.2)
    ctx.lineTo(x + w + 28, y + h * 0.55)
    ctx.lineTo(x + w + 18, y + h * 0.7)
    ctx.lineTo(x + w - 10, y + h * 0.6)
    ctx.closePath()
    ctx.fill()

    // Accent stripe
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 8
    ctx.fillRect(cx - 18, y + h * 0.3, 36, 5)

    // Triple cannon
    ctx.fillStyle = glowColor
    ctx.shadowColor = glowColor
    ctx.shadowBlur = 12
    ;[-12, 0, 12].forEach(offset => {
      ctx.beginPath()
      ctx.arc(cx + offset, y + h * 0.7, 4, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.restore()
  }

  const drawPowerup = (ctx: CanvasRenderingContext2D, pu: Powerup) => {
    const pulse = 0.85 + Math.sin(pu.pulseTimer * 0.15) * 0.15
    const r = 12 * pulse
    ctx.save()
    ctx.shadowBlur = 12
    if (pu.type === 'shield') {
      ctx.shadowColor = 'hsl(195 100% 60%)'
      ctx.fillStyle = 'hsl(195 100% 60% / 0.25)'
      ctx.strokeStyle = 'hsl(195 100% 60%)'
    } else {
      ctx.shadowColor = 'hsl(45 100% 60%)'
      ctx.fillStyle = 'hsl(45 100% 60% / 0.25)'
      ctx.strokeStyle = 'hsl(45 100% 60%)'
    }
    ctx.beginPath()
    ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = pu.type === 'shield' ? 'hsl(195 100% 80%)' : 'hsl(45 100% 80%)'
    ctx.font = `bold ${Math.round(11 * pulse)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(pu.type === 'shield' ? 'S' : 'M', pu.x, pu.y)
    ctx.restore()
  }

  // ── GAME LOOP ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const container = containerRef.current
      if (container) {
        const width = Math.min(container.clientWidth, 440)
        canvas.width = width
        canvas.height = Math.round(width * 1.48)
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let animationFrameId: number
    const V_WIDTH = 400
    const V_HEIGHT = 600

    let shootCooldown = 0

    const spawnEnemy = (type: 'drone' | 'fighter' | 'elite') => {
      const configs: Record<string, { w: number; h: number; hp: number; speed: number }> = {
        drone:   { w: 16, h: 18, hp: 1, speed: 2.8 + Math.random() },
        fighter: { w: 28, h: 22, hp: 2, speed: 1.8 + Math.random() * 0.8 },
        elite:   { w: 38, h: 26, hp: 4, speed: 1.4 + Math.random() * 0.5 },
      }
      const cfg = configs[type]
      stateRef.current.enemies.push({
        x: Math.random() * (V_WIDTH - cfg.w - 20) + 10,
        y: -cfg.h - 5,
        width: cfg.w,
        height: cfg.h,
        speed: cfg.speed,
        type,
        hp: cfg.hp,
        maxHp: cfg.hp,
        direction: 1,
        shootTimer: type === 'elite' ? 0 : null,
        hitFlashTimer: 0,
        zigzagTimer: type === 'drone' ? 0 : undefined,
        zigzagDir: type === 'drone' ? (Math.random() < 0.5 ? 1 : -1) : undefined,
      })
    }

    const spawnBoss = (wave: number) => {
      const tier = Math.floor((wave - 1) / 10)
      const hp = 20 + tier * 15
      stateRef.current.enemies.push({
        x: 150,
        y: -80,
        width: 100,
        height: 52,
        speed: 1.2 + tier * 0.2,
        type: 'boss',
        hp,
        maxHp: hp,
        direction: 1,
        shootTimer: 0,
        hitFlashTimer: 0,
      })
      stateRef.current.bossActive = true
      setBossMaxHp(hp)
      setBossHp(hp)
    }

    const advanceWave = () => {
      const nextWave = stateRef.current.wave + 1
      stateRef.current.wave = nextWave
      stateRef.current.waveEnemiesSpawned = 0
      stateRef.current.waveEnemiesKilled = 0
      stateRef.current.spawnTimer = 0
      stateRef.current.bossActive = false
      const config = getWaveConfig(nextWave)
      stateRef.current.waveConfig = config
      setWave(nextWave)
      setBossHp(null)
      setIsBossWave(config.isBossWave)

      if (config.isBossWave) {
        stateRef.current.bossWarning = true
        stateRef.current.bossWarningTimer = 120 // ~2s at 60fps
        setBossWarning(true)
        setTimeout(() => {
          spawnBoss(nextWave)
          stateRef.current.bossWarning = false
          setBossWarning(false)
        }, 2000)
      }
    }

    const gameLoop = () => {
      if (stateRef.current.gameOver) return
      const s = stateRef.current
      const player = s.player
      const keys = s.keys

      // ── MOVE PLAYER ─────────────────────────────
      let dx = 0, dy = 0
      if (keys['ArrowLeft'] || keys['KeyA']) dx = -player.speed
      if (keys['ArrowRight'] || keys['KeyD']) dx = player.speed
      if (keys['ArrowUp'] || keys['KeyW']) dy = -player.speed
      if (keys['ArrowDown'] || keys['KeyS']) dy = player.speed

      player.x = Math.max(0, Math.min(V_WIDTH - player.width, player.x + dx))
      player.y = Math.max(0, Math.min(V_HEIGHT - player.height, player.y + dy))

      // ── SHOOT ───────────────────────────────────
      if (shootCooldown > 0) {
        shootCooldown -= 16
      } else {
        const cx = player.x + player.width / 2
        if (s.multishotActive) {
          // Triple fire
          ;[-12, 0, 12].forEach(offset => {
            s.bullets.push({ x: cx - 2 + offset, y: player.y - 4, width: 4, height: 14, speed: 10, isMultishot: true })
          })
        } else {
          s.bullets.push({ x: cx - 2, y: player.y - 4, width: 4, height: 14, speed: 10 })
        }
        s.shotsFired++
        shootCooldown = s.multishotActive ? 100 : 140
      }

      // ── STARS ───────────────────────────────────
      s.stars.forEach(star => {
        star.y += star.speed
        if (star.y > V_HEIGHT) {
          star.y = -2
          star.x = Math.random() * V_WIDTH
          star.opacity = Math.random() * 0.6 + 0.2
        }
      })

      // ── MOVE BULLETS ────────────────────────────
      s.bullets.forEach(b => (b.y -= b.speed))
      s.bullets = s.bullets.filter(b => b.y > -20)

      // ── MOVE ENEMY BULLETS ──────────────────────
      s.enemyBullets.forEach(eb => {
        eb.x += eb.vx || 0
        eb.y += eb.vy || eb.speed
      })
      s.enemyBullets = s.enemyBullets.filter(
        eb => eb.y < V_HEIGHT + 20 && eb.x > -20 && eb.x < V_WIDTH + 20
      )

      // ── WAVE / SPAWN MANAGEMENT ─────────────────
      const wc = s.waveConfig
      if (!s.bossActive && !wc.isBossWave) {
        if (s.waveEnemiesSpawned < wc.count) {
          s.spawnTimer += 16
          if (s.spawnTimer >= wc.spawnInterval) {
            s.spawnTimer = 0
            const typePool = wc.enemyTypes
            const type = typePool[Math.floor(Math.random() * typePool.length)]
            spawnEnemy(type)
            s.waveEnemiesSpawned++
          }
        }
        // Advance wave when all enemies from current wave are defeated
        if (s.waveEnemiesSpawned >= wc.count && s.enemies.length === 0) {
          advanceWave()
        }
      } else if (wc.isBossWave && !s.bossActive && !s.bossWarning && s.enemies.length === 0) {
        // Boss was killed → advance wave
        advanceWave()
      }

      setEnemiesLeft(s.enemies.length)
      setWaveSize(wc.count)

      // ── MOVE ENEMIES ─────────────────────────────
      s.enemies.forEach(enemy => {
        if (enemy.dead) return

        // Decrease hit flash
        if ((enemy.hitFlashTimer || 0) > 0) enemy.hitFlashTimer! -= 1

        if (enemy.type === 'boss') {
          if (enemy.y < 80) {
            enemy.y += 1.2
          } else {
            enemy.x += enemy.speed * (enemy.direction ?? 1)
            if (enemy.x <= 10 || enemy.x >= V_WIDTH - enemy.width - 10) {
              enemy.direction = (enemy.direction ?? 1) * -1
            }
            // Boss triple spread firing
            enemy.shootTimer = (enemy.shootTimer ?? 0) + 16
            if (enemy.shootTimer >= 1000) {
              enemy.shootTimer = 0
              const angles = [-0.4, 0, 0.4, 0.8, -0.8, Math.PI / 2 - 0.2, Math.PI / 2 + 0.2]
              angles.forEach(a => {
                s.enemyBullets.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height,
                  speed: 3.5,
                  vx: Math.sin(a) * 3.2,
                  vy: Math.cos(a) * 3.2,
                })
              })
            }
          }
        } else if (enemy.type === 'drone') {
          enemy.y += enemy.speed
          // Zigzag
          enemy.zigzagTimer = (enemy.zigzagTimer || 0) + 1
          if (enemy.zigzagTimer > 25) {
            enemy.zigzagDir = (enemy.zigzagDir || 1) * -1
            enemy.zigzagTimer = 0
          }
          enemy.x = Math.max(0, Math.min(V_WIDTH - enemy.width, enemy.x + (enemy.zigzagDir || 1) * 2.2))
        } else if (enemy.type === 'fighter') {
          enemy.y += enemy.speed
          // Slight weave
          enemy.x += Math.sin(enemy.y * 0.04) * 1.2
        } else if (enemy.type === 'elite') {
          enemy.y += enemy.speed
          // Targeted shots
          enemy.shootTimer = (enemy.shootTimer ?? 0) + 16
          if (enemy.shootTimer >= 1800) {
            enemy.shootTimer = 0
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x)
            s.enemyBullets.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height,
              speed: 4,
              vx: Math.cos(angle) * 3.8,
              vy: Math.sin(angle) * 3.8,
            })
          }
        }
      })

      // Remove off-screen enemies (except boss)
      s.enemies = s.enemies.filter(e => {
        if (e.type === 'boss') return true
        return e.y < V_HEIGHT + 50
      })

      // ── MOVE POWERUPS ────────────────────────────
      s.powerups.forEach(pu => {
        pu.y += pu.speed
        pu.pulseTimer++
      })
      s.powerups = s.powerups.filter(pu => pu.y < V_HEIGHT + 30)

      // ── BULLET → ENEMY COLLISIONS ────────────────
      s.bullets.forEach(bullet => {
        s.enemies.forEach(enemy => {
          if (enemy.dead) return
          if (
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y
          ) {
            bullet.y = -200
            enemy.hp -= 1
            enemy.hitFlashTimer = 4
            s.shotsHit++

            // Spark particles
            for (let i = 0; i < 5; i++) {
              s.particles.push({
                x: bullet.x + bullet.width / 2,
                y: enemy.y + enemy.height * 0.5,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                color: 'hsl(45,100%,65%)',
                size: Math.random() * 2.5 + 1,
                life: 1,
                decay: 0.07,
              })
            }

            if (enemy.hp <= 0) {
              enemy.dead = true
              s.enemiesDestroyed++
              s.waveEnemiesKilled++

              const points = enemy.type === 'boss' ? 1000 : enemy.type === 'elite' ? 150 : enemy.type === 'fighter' ? 60 : 25
              s.score += points
              setScore(s.score)

              if (enemy.type === 'boss') {
                s.bossActive = false
                s.bossesDefeated++
                setBossHp(null)
              } else {
                setBossHp(prev => prev !== null ? Math.max(0, prev) : null)
              }

              // Update boss HP display
              if (enemy.type === 'boss' && enemy.hp > 0) {
                setBossHp(enemy.hp)
              }

              // Fireball explosion
              const count = enemy.type === 'boss' ? 55 : enemy.type === 'elite' ? 22 : enemy.type === 'fighter' ? 14 : 8
              const colors = enemy.type === 'boss'
                ? ['hsl(270,80%,60%)', 'hsl(0,90%,60%)', 'hsl(45,100%,65%)', 'hsl(0,80%,40%)']
                : enemy.type === 'elite'
                  ? ['hsl(270,80%,60%)', 'hsl(45,100%,65%)', 'hsl(0,80%,60%)']
                  : ['hsl(220,100%,65%)', 'hsl(45,100%,65%)', 'hsl(0,80%,60%)']
              for (let i = 0; i < count; i++) {
                const speed = enemy.type === 'boss' ? 6 + Math.random() * 4 : 3 + Math.random() * 3
                s.particles.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  vx: (Math.random() - 0.5) * speed,
                  vy: (Math.random() - 0.5) * speed,
                  color: colors[Math.floor(Math.random() * colors.length)],
                  size: Math.random() * 4 + 2,
                  life: 1,
                  decay: Math.random() * 0.02 + 0.01,
                })
              }
              // Central flash particle
              s.particles.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height / 2,
                vx: 0, vy: 0,
                color: 'rgba(255,220,100,0.9)',
                size: enemy.type === 'boss' ? 30 : 14,
                life: 1, decay: 0.18,
              })

              // Powerup drop
              if (enemy.type !== 'boss' && Math.random() < 0.1) {
                s.powerups.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  type: Math.random() < 0.5 ? 'shield' : 'multishot',
                  speed: 1.5,
                  pulseTimer: 0,
                })
              }
            } else if (enemy.type === 'boss') {
              setBossHp(enemy.hp)
            }
          }
        })
      })

      // Remove dead/offscreen enemies
      s.enemies = s.enemies.filter(e => !e.dead)

      // ── PLAYER COLLISION ─────────────────────────
      if (s.invincibleTimer > 0) {
        s.invincibleTimer--
      } else {
        let playerHit = false

        s.enemyBullets.forEach(eb => {
          if (eb.x > player.x && eb.x < player.x + player.width && eb.y > player.y && eb.y < player.y + player.height) {
            eb.y = V_HEIGHT + 100
            playerHit = true
          }
        })
        s.enemies.forEach(enemy => {
          if (!enemy.dead &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            enemy.dead = true
            if (enemy.type === 'boss') { s.bossActive = false; setBossHp(null) }
            playerHit = true
          }
        })

        if (playerHit) {
          player.lives -= 1
          s.invincibleTimer = 120 // 2s invincibility frames
          setLives(player.lives)
          setShieldCount(player.lives)

          // Screen shake
          s.screenShakeX = (Math.random() - 0.5) * 18
          s.screenShakeY = (Math.random() - 0.5) * 18
          s.screenShakeTimer = 18

          // Player hit explosion
          for (let i = 0; i < 20; i++) {
            s.particles.push({
              x: player.x + player.width / 2,
              y: player.y + player.height / 2,
              vx: (Math.random() - 0.5) * 7,
              vy: (Math.random() - 0.5) * 7,
              color: 'hsl(0,80%,60%)',
              size: Math.random() * 3.5 + 2,
              life: 1,
              decay: 0.04,
            })
          }

          if (player.lives <= 0) {
            s.gameOver = true
            handleGameOver(s.score)
            return
          }
        }
      }

      // ── POWERUP COLLECTION ───────────────────────
      s.powerups = s.powerups.filter(pu => {
        const dist = Math.hypot(pu.x - (player.x + player.width / 2), pu.y - (player.y + player.height / 2))
        if (dist < 22) {
          if (pu.type === 'shield') {
            player.lives = Math.min(3, player.lives + 1)
            setLives(player.lives)
            setShieldCount(player.lives)
          } else {
            s.multishotActive = true
            s.multishotTimer = 480 // ~8s at 60fps
            setMultishotActive(true)
          }
          return false
        }
        return true
      })

      // Multishot timer
      if (s.multishotActive) {
        s.multishotTimer--
        if (s.multishotTimer <= 0) {
          s.multishotActive = false
          setMultishotActive(false)
        }
      }

      // Screen shake decay
      if (s.screenShakeTimer > 0) {
        s.screenShakeTimer--
        s.screenShakeX *= 0.75
        s.screenShakeY *= 0.75
      } else {
        s.screenShakeX = 0
        s.screenShakeY = 0
      }

      // ── UPDATE PARTICLES ─────────────────────────
      s.particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.04 // slight gravity
        p.life -= p.decay
      })
      s.particles = s.particles.filter(p => p.life > 0)

      // ── RENDER ───────────────────────────────────
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()

      const scaleX = canvas.width / V_WIDTH
      const scaleY = canvas.height / V_HEIGHT
      ctx.scale(scaleX, scaleY)

      // Screen shake transform
      if (s.screenShakeTimer > 0) {
        ctx.translate(s.screenShakeX, s.screenShakeY)
      }

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, V_HEIGHT)
      bgGrad.addColorStop(0, 'hsl(220 30% 5%)')
      bgGrad.addColorStop(1, 'hsl(222 25% 8%)')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT)

      // Stars
      s.stars.forEach(star => {
        ctx.fillStyle = `rgba(255,255,255,${star.opacity})`
        ctx.fillRect(star.x, star.y, star.size, star.size)
      })

      // Particles
      s.particles.forEach(p => {
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.shadowColor = p.color
        ctx.shadowBlur = p.size * 1.5
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Powerups
      s.powerups.forEach(pu => drawPowerup(ctx, pu))

      // Enemy bullets (red glowing orbs)
      s.enemyBullets.forEach(eb => {
        ctx.save()
        ctx.shadowColor = 'hsl(0,90%,60%)'
        ctx.shadowBlur = 8
        ctx.fillStyle = 'hsl(0,90%,65%)'
        ctx.beginPath()
        ctx.arc(eb.x, eb.y, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      // Player bullets (neon green lasers)
      s.bullets.forEach(b => {
        ctx.save()
        ctx.shadowColor = b.isMultishot ? 'hsl(45,100%,60%)' : 'hsl(142,100%,55%)'
        ctx.shadowBlur = 10
        const laserGrad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height)
        if (b.isMultishot) {
          laserGrad.addColorStop(0, 'hsl(45,100%,80%)')
          laserGrad.addColorStop(1, 'hsl(45,100%,55%)')
        } else {
          laserGrad.addColorStop(0, 'hsl(142,100%,80%)')
          laserGrad.addColorStop(1, 'hsl(142,100%,50%)')
        }
        ctx.fillStyle = laserGrad
        ctx.fillRect(b.x, b.y, b.width, b.height)
        ctx.restore()
      })

      // Enemies
      s.enemies.forEach(enemy => {
        if (enemy.dead) return
        if (enemy.type === 'drone') drawDrone(ctx, enemy)
        else if (enemy.type === 'fighter') drawFighter(ctx, enemy)
        else if (enemy.type === 'elite') drawElite(ctx, enemy)
        else if (enemy.type === 'boss') drawBoss(ctx, enemy)

        // HP bar for elite/boss
        if (enemy.type === 'elite' || enemy.type === 'boss') {
          const bw = enemy.width + (enemy.type === 'boss' ? 56 : 10)
          const bx = enemy.x + enemy.width / 2 - bw / 2
          const by = enemy.y - 10
          ctx.fillStyle = 'rgba(0,0,0,0.5)'
          ctx.fillRect(bx, by, bw, 5)
          const hpColor = enemy.type === 'boss' ? 'hsl(0,90%,55%)' : 'hsl(270,80%,65%)'
          ctx.fillStyle = hpColor
          ctx.fillRect(bx, by, bw * (enemy.hp / enemy.maxHp), 5)
        }
      })

      // Player (invincible blink)
      if (s.invincibleTimer <= 0 || Math.floor(s.invincibleTimer / 8) % 2 === 0) {
        drawPlayerJet(ctx, player.x, player.y, player.width, player.height, s.multishotActive)
      }

      ctx.restore()

      animationFrameId = requestAnimationFrame(gameLoop)
    }

    animationFrameId = requestAnimationFrame(gameLoop)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  const handleGameOver = (finalScore: number) => {
    setIsPlaying(false)
    const s = stateRef.current
    const bossesDefeated = s.bossesDefeated
    const wavesReached = s.wave
    const isVictory = bossesDefeated >= 1
    const accuracy = s.shotsFired > 0 ? Math.round((s.shotsHit / s.shotsFired) * 100) : 0

    submitGameResult({
      gameSlug: 'fighter',
      result: isVictory ? 'win' : 'loss',
      metadata: {
        score: finalScore,
        customTitle: isVictory ? 'Mission Complete' : 'Ship Destroyed',
        customSubtitle: isVictory
          ? `Defeated the Boss! Wave ${wavesReached}`
          : `Survived to Wave ${wavesReached} • High Score Run`,
        statistics: [
          { label: 'Wave Reached', value: wavesReached, color: '#fbbf24' },
          { label: 'Enemies Destroyed', value: s.enemiesDestroyed, color: 'hsl(220 100% 65%)' },
          { label: 'Bosses Defeated', value: bossesDefeated, color: '#ec4899' },
          { label: 'Accuracy', value: `${accuracy}%`, color: '#10b981' },
        ],
      },
    })
  }

  // ── TOUCH CONTROLS ────────────────────────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPlaying) return
    const touch = e.touches[0]
    stateRef.current.touchStart = { x: touch.clientX, y: touch.clientY }
    stateRef.current.touchPlayerStart = { ...stateRef.current.player }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPlaying) return
    const touch = e.touches[0]
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const deltaX = touch.clientX - stateRef.current.touchStart.x
    const deltaY = touch.clientY - stateRef.current.touchStart.y
    const player = stateRef.current.player
    const startX = stateRef.current.touchPlayerStart.x
    const startY = stateRef.current.touchPlayerStart.y
    player.x = Math.max(0, Math.min(400 - player.width, startX + (deltaX / rect.width) * 400))
    player.y = Math.max(0, Math.min(600 - player.height, startY + (deltaY / rect.height) * 600))
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (!isPlaying) {
    return (
      <div className="card glass" style={{ padding: '2.5rem', textAlign: 'center', margin: '0 auto', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <PlaneIcon size={48} className="text-blue-400" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Fighter Jet</h2>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Survive waves of enemy aircraft. Defeat the boss on Wave 10 to complete the campaign. Power-ups drop from enemies!
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '1.5rem', textAlign: 'left' }}>
          {[
            { icon: '🛸', label: 'Drone', desc: '1 HP · Fast zigzag · Cyan' },
            { icon: '✈️', label: 'Fighter', desc: '2 HP · Weaving descent · Red' },
            { icon: '🔮', label: 'Elite', desc: '4 HP · Targeting shots · Purple' },
            { icon: '💀', label: 'Boss', desc: '20+ HP · Bullet rings · Wave 10' },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{ background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 10, padding: '0.6rem 0.75rem' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>{icon} <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'white' }}>{label}</span></div>
              <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)' }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'hsl(220 20% 7%)', padding: '0.85rem', borderRadius: 12, border: '1px solid hsl(220 20% 14%)', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontWeight: 700, color: 'white', marginBottom: '0.1rem' }}>Power-ups</div>
          <div><span style={{ color: 'hsl(195 100% 60%)' }}>S (Shield)</span> — Restores 1 life (max 3)</div>
          <div><span style={{ color: 'hsl(45 100% 60%)' }}>M (Multishot)</span> — Triple fire for 8 seconds</div>
        </div>

        <div style={{ background: 'hsl(220 20% 7%)', padding: '0.85rem', borderRadius: 12, border: '1px solid hsl(220 20% 14%)', marginBottom: '1.75rem', textAlign: 'left', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontWeight: 700, color: 'white', marginBottom: '0.1rem' }}>Controls</div>
          <div>Desktop: WASD or Arrow Keys to fly · Auto-fire</div>
          <div>Mobile: Drag on canvas to fly · Auto-fire</div>
        </div>

        <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={startGame} style={{ width: '100%' }}>
          Launch Mission
        </button>
      </div>
    )
  }

  const waveProgress = waveSize > 0 ? Math.min(1, stateRef.current.waveEnemiesKilled / waveSize) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%' }}>

      {/* ── HUD ─────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(220 20% 7%)', padding: '0.65rem 1.1rem', borderRadius: 16, border: '1px solid hsl(220 20% 14%)' }}>
        <div>
          <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Score</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{score}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: isBossWave ? 'hsl(0 80% 65%)' : 'hsl(220 100% 70%)', textTransform: 'uppercase' }}>
              {isBossWave ? 'BOSS' : `Wave ${wave}`}
            </span>
            {!isBossWave && (
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>
                {Math.min(stateRef.current.waveEnemiesKilled, waveSize)}/{waveSize}
              </span>
            )}
          </div>
          {!isBossWave && waveSize > 0 && (
            <div style={{ width: 80, height: 4, background: 'hsl(220 20% 14%)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${waveProgress * 100}%`, height: '100%', background: 'hsl(220 100% 60%)', transition: 'width 0.3s ease', borderRadius: 99 }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Shields</span>
            <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.1rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i <= shieldCount ? 'hsl(142 70% 55%)' : 'hsl(220 20% 20%)', boxShadow: i <= shieldCount ? '0 0 6px hsl(142 70% 55%)' : 'none' }} />
              ))}
            </div>
          </div>
          {multishotActive && (
            <div style={{ fontSize: '0.62rem', fontWeight: 800, background: 'hsl(45 100% 55% / 0.2)', border: '1px solid hsl(45 100% 55% / 0.4)', color: 'hsl(45 100% 65%)', padding: '0.2rem 0.45rem', borderRadius: 6, animation: 'pulse 0.8s ease-in-out infinite alternate' }}>
              ⚡ 3x
            </div>
          )}
        </div>
      </div>

      {/* Boss warning banner */}
      {bossWarning && (
        <div style={{ background: 'hsl(0 80% 55% / 0.15)', border: '1px solid hsl(0 80% 55% / 0.4)', borderRadius: 12, padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'pulse 0.4s ease-in-out infinite alternate' }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(0 80% 70%)' }}>BOSS INCOMING — Brace for impact!</span>
        </div>
      )}

      {/* Boss HP bar */}
      {bossHp !== null && (
        <div style={{ padding: '0.5rem 0.85rem', background: 'hsl(0 80% 55% / 0.08)', border: '1px solid hsl(0 80% 55% / 0.25)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(0 80% 70%)', fontWeight: 700 }}>
            <span>BOSS HP</span>
            <span>{bossHp} / {bossMaxHp}</span>
          </div>
          <div style={{ height: 6, background: 'hsl(220 20% 10%)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(bossHp / bossMaxHp) * 100}%`, height: '100%', background: 'linear-gradient(90deg, hsl(0 90% 45%), hsl(0 80% 65%))', transition: 'width 0.12s ease', borderRadius: 99 }} />
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{ background: 'hsl(222 25% 5%)', borderRadius: 16, border: '2px solid hsl(220 15% 18%)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)', maxWidth: '100%' }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => handleGameOver(score)} disabled={isLoading}>
          End Mission
        </button>
      </div>
    </div>
  )
}
