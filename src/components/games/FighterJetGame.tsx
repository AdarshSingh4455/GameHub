'use client'
import { PlaneIcon } from '@/components/shared/Icons'

import React, { useRef, useEffect, useState } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

interface Bullet {
  x: number
  y: number
  width: number
  height: number
  speed: number
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
  type: 'regular' | 'elite' | 'boss'
  hp: number
  maxHp: number
  direction?: number
  shootTimer?: number | null
  dead?: boolean
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
}

export default function FighterJetGame() {
  const { submitGameResult, isLoading } = useGameSession()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [time, setTime] = useState(0)
  const [bossHp, setBossHp] = useState<number | null>(null)
  const [bossMaxHp, setBossMaxHp] = useState<number>(1)

  // Game state references for the loop
  const stateRef = useRef({
    player: { x: 200, y: 500, width: 30, height: 30, speed: 6, lives: 3 },
    bullets: [] as Bullet[],
    enemyBullets: [] as EnemyBullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    stars: [] as Star[],
    score: 0,
    time: 0,
    lastTime: 0,
    enemySpawnTimer: 0,
    bossActive: false,
    keys: {} as Record<string, boolean>,
    touchStart: { x: 0, y: 0 },
    touchPlayerStart: { x: 0, y: 0 },
    gameDuration: 0,
    enemiesDestroyed: 0,
    bossesDefeated: 0,
    shotsFired: 0,
    shotsHit: 0,
  })

  // Start / Restart game
  const startGame = () => {
    setScore(0)
    setLives(3)
    setTime(0)
    setBossHp(null)
    setIsPlaying(true)

    // Initialize stars
    const stars: Star[] = []
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: Math.random() * 400,
        y: Math.random() * 600,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.5,
      })
    }

    stateRef.current = {
      player: { x: 185, y: 500, width: 30, height: 35, speed: 6, lives: 3 },
      bullets: [],
      enemyBullets: [],
      enemies: [],
      particles: [],
      stars,
      score: 0,
      time: 0,
      lastTime: Date.now(),
      enemySpawnTimer: 0,
      bossActive: false,
      keys: {},
      touchStart: { x: 0, y: 0 },
      touchPlayerStart: { x: 0, y: 0 },
      gameDuration: 0,
      enemiesDestroyed: 0,
      bossesDefeated: 0,
      shotsFired: 0,
      shotsHit: 0,
    }
  }

  // Keyboard controls
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

  // Canvas loop and logic
  useEffect(() => {
    if (!isPlaying) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Resize canvas dynamically to fit container
    const resizeCanvas = () => {
      const container = containerRef.current
      if (container) {
        const width = Math.min(container.clientWidth, 450)
        canvas.width = width
        canvas.height = width * 1.5 // 3:4.5 aspect ratio
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    let animationFrameId: number
    const V_WIDTH = 400
    const V_HEIGHT = 600

    let shootCooldown = 0
    let lastTimeUpdate = Date.now()

    const gameLoop = () => {
      const now = Date.now()
      const dt = now - stateRef.current.lastTime
      stateRef.current.lastTime = now

      // Time counter (every second)
      if (now - lastTimeUpdate >= 1000) {
        stateRef.current.time += 1
        setTime(stateRef.current.time)
        lastTimeUpdate = now
      }

      // ── UPDATE LOGIC ──

      // 1. Move Player
      const player = stateRef.current.player
      const keys = stateRef.current.keys
      let dx = 0
      let dy = 0

      if (keys['ArrowLeft'] || keys['KeyA']) dx = -player.speed
      if (keys['ArrowRight'] || keys['KeyD']) dx = player.speed
      if (keys['ArrowUp'] || keys['KeyW']) dy = -player.speed
      if (keys['ArrowDown'] || keys['KeyS']) dy = player.speed

      player.x = Math.max(0, Math.min(V_WIDTH - player.width, player.x + dx))
      player.y = Math.max(0, Math.min(V_HEIGHT - player.height, player.y + dy))

      // 2. Player Firing (automatic or space key)
      if (shootCooldown > 0) {
        shootCooldown -= dt
      } else {
        // Automatically fire or space key
        stateRef.current.bullets.push({
          x: player.x + player.width / 2 - 2,
          y: player.y,
          width: 4,
          height: 12,
          speed: 8,
        })
        stateRef.current.shotsFired++
        shootCooldown = 150 // Shoot every 150ms
      }

      // 3. Move Stars
      stateRef.current.stars.forEach((star) => {
        star.y += star.speed
        if (star.y > V_HEIGHT) {
          star.y = 0
          star.x = Math.random() * V_WIDTH
        }
      })

      // 4. Move Bullets
      stateRef.current.bullets.forEach((b) => (b.y -= b.speed))
      stateRef.current.bullets = stateRef.current.bullets.filter((b) => b.y > -20)

      // 5. Move Enemy Bullets
      stateRef.current.enemyBullets.forEach((eb) => {
        eb.x += eb.vx || 0
        eb.y += eb.vy || eb.speed
      })
      stateRef.current.enemyBullets = stateRef.current.enemyBullets.filter(
        (eb) => eb.y < V_HEIGHT + 20 && eb.x > -20 && eb.x < V_WIDTH + 20
      )

      // 6. Spawn Enemies & Bosses
      const currentScore = stateRef.current.score
      const enemyDifficultyMultiplier = 1 + Math.floor(stateRef.current.time / 30) * 0.15

      // Check if boss should spawn
      const bossThreshold = Math.floor(currentScore / 1000) * 1000
      if (bossThreshold > 0 && bossThreshold % 1000 === 0 && !stateRef.current.bossActive && currentScore >= bossThreshold && stateRef.current.enemies.filter(e => e.type === 'boss').length === 0) {
        // Spawn boss
        const hp = 15 + Math.floor(bossThreshold / 1000) * 10
        stateRef.current.enemies.push({
          x: 150,
          y: -80,
          width: 100,
          height: 50,
          speed: 1.5,
          type: 'boss',
          hp,
          maxHp: hp,
          direction: 1,
          shootTimer: 0,
        })
        stateRef.current.bossActive = true
        setBossMaxHp(hp)
        setBossHp(hp)
      }

      // Normal wave spawn (only if boss is not active)
      stateRef.current.enemySpawnTimer += dt
      if (stateRef.current.enemySpawnTimer >= 1000 && !stateRef.current.bossActive) {
        stateRef.current.enemySpawnTimer = 0
        const isElite = Math.random() < 0.2 + (stateRef.current.time / 120) // higher chance over time
        stateRef.current.enemies.push({
          x: Math.random() * (V_WIDTH - 30),
          y: -40,
          width: isElite ? 40 : 25,
          height: isElite ? 40 : 25,
          speed: (Math.random() * 1.5 + 2) * enemyDifficultyMultiplier,
          type: isElite ? 'elite' : 'regular',
          hp: isElite ? 3 : 1,
          maxHp: isElite ? 3 : 1,
          shootTimer: isElite ? 0 : null,
        })
      }

      // 7. Move Enemies & Enemy AI Firing
      stateRef.current.enemies.forEach((enemy) => {
        if (enemy.type === 'boss') {
          // Boss moves downwards initially, then side-to-side
          if (enemy.y < 80) {
            enemy.y += 1
          } else {
            enemy.x += enemy.speed * (enemy.direction ?? 1)
            if (enemy.x <= 10 || enemy.x >= V_WIDTH - enemy.width - 10) {
              enemy.direction = (enemy.direction ?? 1) * -1
            }

            // Boss firing patterns
            enemy.shootTimer = (enemy.shootTimer ?? 0) + dt
            if (enemy.shootTimer >= 1200) {
              enemy.shootTimer = 0
              // Bullet ring pattern
              const angles = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2] // in radians * PI
              angles.forEach((a) => {
                const angle = a * Math.PI
                stateRef.current.enemyBullets.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height,
                  speed: 3.5,
                  vx: Math.cos(angle) * 3,
                  vy: Math.sin(angle) * 3 + 1,
                })
              })
            }
          }
        } else {
          // Regular / Elite enemies move down
          enemy.y += enemy.speed

          // Elite firing
          if (enemy.type === 'elite') {
            enemy.shootTimer = (enemy.shootTimer ?? 0) + dt
            if (enemy.shootTimer >= 1500) {
              enemy.shootTimer = 0
              // Target player direction
              const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x)
              stateRef.current.enemyBullets.push({
                x: enemy.x + enemy.width / 2,
                y: enemy.y + enemy.height,
                speed: 4,
                vx: Math.cos(angle) * 3.5,
                vy: Math.sin(angle) * 3.5,
              })
            }
          }
        }
      })

      // Filter off-screen enemies
      stateRef.current.enemies = stateRef.current.enemies.filter((e) => {
        if (e.y > V_HEIGHT + 40) {
          // Offscreen penalty? No, just despawn
          return false
        }
        return true
      })

      // 8. Collisions: Player Bullets -> Enemies
      stateRef.current.bullets.forEach((bullet) => {
        stateRef.current.enemies.forEach((enemy) => {
          if (
            bullet.x < enemy.x + enemy.width &&
            bullet.x + bullet.width > enemy.x &&
            bullet.y < enemy.y + enemy.height &&
            bullet.y + bullet.height > enemy.y
          ) {
            // Bullet hit enemy
            bullet.y = -100 // Flag bullet for deletion
            enemy.hp -= 1
            stateRef.current.shotsHit++

            // Spawn spark particles
            for (let i = 0; i < 4; i++) {
              stateRef.current.particles.push({
                x: bullet.x,
                y: bullet.y + 100, // adjust
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: 'hsl(45, 100%, 65%)',
                size: Math.random() * 2 + 1,
                life: 1,
                decay: 0.05,
              })
            }

            if (enemy.hp <= 0) {
              // Destroy enemy!
              enemy.dead = true
              stateRef.current.enemiesDestroyed++

              const points = enemy.type === 'boss' ? 500 : enemy.type === 'elite' ? 100 : 25
              stateRef.current.score += points
              setScore(stateRef.current.score)

              if (enemy.type === 'boss') {
                stateRef.current.bossActive = false
                stateRef.current.bossesDefeated++
                setBossHp(null)
              }

              // Large explosion particles
              for (let i = 0; i < (enemy.type === 'boss' ? 40 : 12); i++) {
                stateRef.current.particles.push({
                  x: enemy.x + enemy.width / 2,
                  y: enemy.y + enemy.height / 2,
                  vx: (Math.random() - 0.5) * (enemy.type === 'boss' ? 8 : 5),
                  vy: (Math.random() - 0.5) * (enemy.type === 'boss' ? 8 : 5),
                  color: enemy.type === 'boss' ? 'hsl(270, 80%, 60%)' : enemy.type === 'elite' ? 'hsl(0, 80%, 60%)' : 'hsl(220, 100%, 65%)',
                  size: Math.random() * 4 + 2,
                  life: 1,
                  decay: Math.random() * 0.02 + 0.015,
                })
              }
            } else if (enemy.type === 'boss') {
              setBossHp(enemy.hp)
            }
          }
        })
      })

      // Filter dead/despawned enemies
      stateRef.current.enemies = stateRef.current.enemies.filter((e) => !e.dead)

      // 9. Collisions: Enemies/Enemy Bullets -> Player
      const checkPlayerHit = () => {
        // Check collision with enemy bullets
        stateRef.current.enemyBullets.forEach((eb) => {
          if (
            eb.x > player.x &&
            eb.x < player.x + player.width &&
            eb.y > player.y &&
            eb.y < player.y + player.height
          ) {
            eb.y = V_HEIGHT + 100 // Flag bullet for deletion
            triggerPlayerDamage()
          }
        })

        // Check collision with enemy body
        stateRef.current.enemies.forEach((enemy) => {
          if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
          ) {
            enemy.dead = true // destroy enemy
            if (enemy.type === 'boss') {
              stateRef.current.bossActive = false
              setBossHp(null)
            }
            triggerPlayerDamage()
          }
        })
      }

      const triggerPlayerDamage = () => {
        player.lives -= 1
        setLives(player.lives)

        // Explosion particles on player
        for (let i = 0; i < 20; i++) {
          stateRef.current.particles.push({
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            color: 'hsl(0, 80%, 60%)',
            size: Math.random() * 3 + 2,
            life: 1,
            decay: 0.03,
          })
        }

        if (player.lives <= 0) {
          handleGameOver(stateRef.current.score)
        }
      }

      checkPlayerHit()

      // 10. Update Particles
      stateRef.current.particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.life -= p.decay
      })
      stateRef.current.particles = stateRef.current.particles.filter((p) => p.life > 0)

      // ── RENDER LOGIC ──
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()

      // Scale to fit virtual dimensions (400 x 600)
      const scaleX = canvas.width / V_WIDTH
      const scaleY = canvas.height / V_HEIGHT
      ctx.scale(scaleX, scaleY)

      // Render Stars
      ctx.fillStyle = 'white'
      stateRef.current.stars.forEach((star) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.4})`
        ctx.fillRect(star.x, star.y, star.size, star.size)
      })

      // Render Particles
      stateRef.current.particles.forEach((p) => {
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.life
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1.0

      // Render Bullets
      ctx.fillStyle = 'hsl(45, 100%, 65%)'
      stateRef.current.bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y, b.width, b.height)
      })

      // Render Enemy Bullets
      ctx.fillStyle = 'hsl(0, 80%, 65%)'
      stateRef.current.enemyBullets.forEach((eb) => {
        ctx.beginPath()
        ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2)
        ctx.fill()
      })

      // Render Enemies
      stateRef.current.enemies.forEach((enemy) => {
        if (enemy.dead) return

        if (enemy.type === 'boss') {
          // Render Boss
          ctx.fillStyle = 'hsl(270, 80%, 55%)'
          ctx.beginPath()
          ctx.moveTo(enemy.x, enemy.y)
          ctx.lineTo(enemy.x + enemy.width, enemy.y)
          ctx.lineTo(enemy.x + enemy.width - 20, enemy.y + enemy.height)
          ctx.lineTo(enemy.x + 20, enemy.y + enemy.height)
          ctx.closePath()
          ctx.fill()

          // Wings/Decals
          ctx.fillStyle = 'hsl(270, 100%, 75%)'
          ctx.fillRect(enemy.x + 20, enemy.y + 10, enemy.width - 40, 8)
          ctx.fillStyle = 'hsl(45, 100%, 60%)'
          ctx.fillRect(enemy.x + enemy.width / 2 - 5, enemy.y, 10, 15)
        } else if (enemy.type === 'elite') {
          // Render Elite Enemy
          ctx.fillStyle = 'hsl(0, 80%, 55%)'
          ctx.beginPath()
          ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height)
          ctx.lineTo(enemy.x, enemy.y)
          ctx.lineTo(enemy.x + enemy.width, enemy.y)
          ctx.closePath()
          ctx.fill()

          ctx.fillStyle = 'hsl(45, 100%, 60%)'
          ctx.beginPath()
          ctx.arc(enemy.x + enemy.width / 2, enemy.y + 10, 4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          // Regular enemy
          ctx.fillStyle = 'hsl(220, 100%, 60%)'
          ctx.beginPath()
          ctx.moveTo(enemy.x + enemy.width / 2, enemy.y + enemy.height)
          ctx.lineTo(enemy.x, enemy.y)
          ctx.lineTo(enemy.x + enemy.width, enemy.y)
          ctx.closePath()
          ctx.fill()
        }
      })

      // Render Player (Fighter Jet)
      ctx.fillStyle = 'hsl(142, 70% 50%)'
      // Draw Nose
      ctx.beginPath()
      ctx.moveTo(player.x + player.width / 2, player.y)
      ctx.lineTo(player.x + player.width, player.y + player.height - 10)
      ctx.lineTo(player.x + player.width - 8, player.y + player.height)
      ctx.lineTo(player.x + 8, player.y + player.height)
      ctx.lineTo(player.x, player.y + player.height - 10)
      ctx.closePath()
      ctx.fill()

      // Cockpit
      ctx.fillStyle = 'hsl(200, 100%, 75%)'
      ctx.beginPath()
      ctx.ellipse(
        player.x + player.width / 2,
        player.y + player.height / 2 - 4,
        4,
        8,
        0,
        0,
        Math.PI * 2
      )
      ctx.fill()

      // Engines / Thrusters
      ctx.fillStyle = `rgba(255, ${100 + Math.random() * 155}, 0, 0.9)`
      ctx.fillRect(player.x + 6, player.y + player.height, 4, 6 + Math.random() * 6)
      ctx.fillRect(player.x + player.width - 10, player.y + player.height, 4, 6 + Math.random() * 6)

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
    const bossesDefeated = stateRef.current.bossesDefeated
    const isVictory = bossesDefeated >= 1
    const apiResult = isVictory ? 'win' : 'loss'
    const customTitle = isVictory ? 'Mission Completed' : 'Ship Destroyed'
    const wavesReached = Math.floor(stateRef.current.time / 20) + 1
    const customSubtitle = isVictory
      ? `Defeated the Alien Boss! Wave ${wavesReached}`
      : `Survived ${wavesReached} Wave${wavesReached !== 1 ? 's' : ''} • High Score Run`

    const accuracy = stateRef.current.shotsFired > 0 
      ? Math.round((stateRef.current.shotsHit / stateRef.current.shotsFired) * 100) 
      : 0
    const distance = Math.floor(stateRef.current.time * 60)

    submitGameResult({
      gameSlug: 'fighter',
      result: apiResult,
      metadata: {
        score: finalScore,
        timeSpent: stateRef.current.time,
        customTitle,
        customSubtitle,
        statistics: [
          { label: 'Wave Reached', value: wavesReached, color: '#fbbf24' },
          { label: 'Enemies Shot', value: stateRef.current.enemiesDestroyed, color: 'hsl(220 100% 65%)' },
          { label: 'Bosses Defeated', value: bossesDefeated, color: '#ec4899' },
          { label: 'Accuracy', value: `${accuracy}%`, color: '#10b981' },
          { label: 'Survival Time', value: `${Math.floor(stateRef.current.time)}s`, color: '#38bdf8' },
          { label: 'Distance', value: `${distance}m`, color: '#a855f7' },
        ]
      },
    })
  }

  // Mobile Touch Controls
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isPlaying) return
    const touch = e.touches[0]
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    // Virtual touch ratios
    stateRef.current.touchStart = { x: touch.clientX, y: touch.clientY }
    stateRef.current.touchPlayerStart = { ...stateRef.current.player }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPlaying) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - stateRef.current.touchStart.x
    const deltaY = touch.clientY - stateRef.current.touchStart.y

    // Scale delta relative to screen size vs virtual coordinate size (400x600)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const virtualDeltaX = (deltaX / rect.width) * 400
    const virtualDeltaY = (deltaY / rect.height) * 600

    const player = stateRef.current.player
    const startX = stateRef.current.touchPlayerStart.x
    const startY = stateRef.current.touchPlayerStart.y

    player.x = Math.max(0, Math.min(400 - player.width, startX + virtualDeltaX))
    player.y = Math.max(0, Math.min(600 - player.height, startY + virtualDeltaY))
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isPlaying) {
    return (
      <div className="card glass" style={{ padding: '2.5rem', textAlign: 'center', margin: '0 auto', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><PlaneIcon size={48} className="text-blue-400" /></div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Fighter Jet</h2>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Dodge enemy ships, shoot them down, and survive waves. Boss battles occur every 1,000 points.
        </p>

        <div style={{ background: 'hsl(220 20% 7%)', padding: '1rem', borderRadius: 12, border: '1px solid hsl(220 20% 14%)', marginBottom: '2rem', textAlign: 'left', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, color: 'white', marginBottom: '0.25rem' }}>Controls:</div>
          <div>💻 Desktop: use <kbd style={{ padding: '0.1rem 0.3rem', background: 'hsl(220 20% 20%)', borderRadius: 4 }}>WASD</kbd> or <kbd style={{ padding: '0.1rem 0.3rem', background: 'hsl(220 20% 20%)', borderRadius: 4 }}>Arrow Keys</kbd> to fly. Automatic firing.</div>
          <div>📱 Mobile: Drag anywhere on the canvas to move. Automatic firing.</div>
        </div>

        <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={startGame} style={{ width: '100%' }}>
          🚀 Start Mission
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Gameplay HUD */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'hsl(220 20% 7%)',
          padding: '0.75rem 1.25rem',
          borderRadius: 16,
          border: '1px solid hsl(220 20% 14%)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Score</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{score}</div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Shields</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: lives === 1 ? 'hsl(0 80% 60%)' : 'hsl(142 70% 55%)' }}>
              {'❤️'.repeat(lives)}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Time</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
              {formatTime(time)}
            </div>
          </div>
        </div>
      </div>

      {/* Boss Health Bar if active */}
      {bossHp !== null && (
        <div className="card animate-fadeIn" style={{ padding: '0.5rem 1rem', background: 'hsl(0 80% 55% / 0.1)', borderColor: 'hsl(0 80% 55% / 0.3)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'hsl(0 80% 70%)', fontWeight: 700 }}>
            <span>⚠️ BOSS INBOUND</span>
            <span>HP: {bossHp} / {bossMaxHp}</span>
          </div>
          <div style={{ height: 6, background: 'hsl(220 20% 10%)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(bossHp / bossMaxHp) * 100}%`, height: '100%', background: 'hsl(0 80% 55%)', transition: 'width 0.1s ease' }} />
          </div>
        </div>
      )}

      {/* Canvas Game Area */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          touchAction: 'none', // Prevents default pinch/scroll on mobile while playing
        }}
      >
        <canvas
          ref={canvasRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            background: 'hsl(222 20% 6%)',
            borderRadius: '16px',
            border: '2px solid hsl(220 15% 18%)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
            maxWidth: '100%',
          }}
        />
      </div>

      {/* Footer controls */}
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => handleGameOver(score)}
          disabled={isLoading}
        >
          🏳️ End Mission
        </button>
      </div>
    </div>
  )
}
