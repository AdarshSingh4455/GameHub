export interface CanvasParticle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  decay: number
}

export interface KillNotification {
  message: string
  color: string
  timer: number
  maxTimer: number
}

export class SnakeEffectManager {
  particles: CanvasParticle[] = []
  spawnTimes: Record<string, number> = {}
  notifications: KillNotification[] = []
  
  prevFoodIds: { id: string; x: number; y: number; type: string }[] = []
  prevPowerupIds: { id: string; x: number; y: number }[] = []
  prevSnakesState: Record<string, 'ACTIVE' | 'ELIMINATED'> = {}

  spawnExplosion(x: number, y: number, color: string, count = 15, baseSpeed = 2.5) {
    for (let p = 0; p < count; p++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * baseSpeed + 1
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3.5 + 1.5,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02
      })
    }
  }

  updateAndDrawParticles(ctx: CanvasRenderingContext2D) {
    ctx.save()
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= p.decay
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.life
      ctx.arc(p.x, p.y, p.size * p.life, 0, 2 * Math.PI)
      ctx.fill()
    }
    ctx.restore()
  }

  addNotification(message: string, color: string, duration = 120) {
    this.notifications.push({
      message,
      color,
      timer: duration,
      maxTimer: duration
    })
  }

  drawNotifications(ctx: CanvasRenderingContext2D, width: number, cellHeight: number) {
    ctx.save()
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const n = this.notifications[i]
      n.timer--
      if (n.timer <= 0) {
        this.notifications.splice(i, 1)
        continue
      }

      const alpha = Math.min(1, n.timer / 30)
      ctx.fillStyle = n.color
      ctx.globalAlpha = alpha
      ctx.font = `bold ${cellHeight * 0.85}px sans-serif`
      ctx.textAlign = 'center'
      ctx.shadowBlur = 6
      ctx.shadowColor = 'rgba(0,0,0,0.6)'
      
      const slideY = 40 + (1 - Math.min(1, (n.maxTimer - n.timer) / 10)) * 20
      ctx.fillText(n.message, width / 2, slideY)
    }
    ctx.restore()
  }

  getSpawnScale(id: string, duration = 400): number {
    if (!this.spawnTimes[id]) {
      this.spawnTimes[id] = Date.now()
    }
    const age = Date.now() - this.spawnTimes[id]
    return Math.min(1, age / duration)
  }

  drawBackgroundPolish(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    const time = Date.now() * 0.05
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 127 + time) % width)
      const sy = ((i * 397) % height)
      ctx.fillRect(sx, sy, 1.5, 1.5)
    }
    ctx.restore()
  }
}
