// Word Wizard Canvas Particles and Floating Text Effects
// High performance 60fps animations with minimal React rerenders

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  decay: number
  color: string
  spark?: boolean
}

interface FloatingText {
  x: number
  y: number
  text: string
  alpha: number
  color: string
  vy: number
  scale: number
}

export interface ParticlesRef {
  addBurst: (x: number, y: number, color?: string, count?: number) => void
  addTrail: (x: number, y: number, color?: string) => void
  addFloatingText: (x: number, y: number, text: string, color?: string) => void
}

export const WordWizardParticles = forwardRef<ParticlesRef, { containerId?: string }>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particles = useRef<Particle[]>([])
  const texts = useRef<FloatingText[]>([])
  const animationFrameId = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      canvas.width = rect?.width || 600
      canvas.height = rect?.height || 600
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 1. Update and Draw Particles
      const nextParticles: Particle[] = []
      for (const p of particles.current) {
        p.x += p.vx
        p.y += p.vy
        p.alpha -= p.decay

        if (p.alpha > 0) {
          ctx.save()
          ctx.globalAlpha = p.alpha
          ctx.fillStyle = p.color
          ctx.shadowBlur = p.spark ? 10 : 0
          ctx.shadowColor = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          nextParticles.push(p)
        }
      }
      particles.current = nextParticles

      // 2. Update and Draw Floating Texts
      const nextTexts: FloatingText[] = []
      for (const t of texts.current) {
        t.y += t.vy
        t.alpha -= 0.02
        t.scale = Math.min(1.2, t.scale + 0.02)

        if (t.alpha > 0) {
          ctx.save()
          ctx.globalAlpha = t.alpha
          ctx.fillStyle = t.color
          ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
          ctx.shadowBlur = 8
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.translate(t.x, t.y)
          ctx.scale(t.scale, t.scale)
          ctx.fillText(t.text, 0, 0)
          ctx.restore()
          nextTexts.push(t)
        }
      }
      texts.current = nextTexts

      animationFrameId.current = requestAnimationFrame(tick)
    }

    animationFrameId.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [])

  useImperativeHandle(ref, () => ({
    addBurst: (x: number, y: number, color = '#6366f1', count = 15) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 4 + 2
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 2,
          alpha: 1.0,
          decay: Math.random() * 0.03 + 0.015,
          color,
          spark: Math.random() > 0.5,
        })
      }
    },
    addTrail: (x: number, y: number, color = 'rgba(99, 102, 241, 0.4)') => {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 3 + 1.5,
        alpha: 0.8,
        decay: 0.04,
        color,
      })
    },
    addFloatingText: (x: number, y: number, text: string, color = '#fbbf24') => {
      texts.current.push({
        x,
        y,
        text,
        alpha: 1.0,
        color,
        vy: -1.2,
        scale: 0.8,
      })
    },
  }))

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  )
})

WordWizardParticles.displayName = 'WordWizardParticles'
