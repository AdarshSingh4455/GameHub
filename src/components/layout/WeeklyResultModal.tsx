'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface UnclaimedReward {
  id:           string
  weekNumber:   number
  rank:         number
  score:        number
  coinsEarned:  number
  xpEarned:     number
  totalGames:   number
  previousRank: number | null
  createdAt:    string
  startDate?:   string
  endDate?:     string
}

interface Props {
  reward:  UnclaimedReward
  onClose: () => void
}

// ─── Sound Synthesizer ────────────────────────────────────────────────────────

const playCelebrationSound = () => {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    // Play a premium ascending celebratory chord arpeggio: C5 -> E5 -> G5 -> C6 -> E6
    const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51]
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)

      // Soft envelope to make it sound premium and clean
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45)

      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.5)
    })
  } catch (e) {
    console.error('Audio synthesis failed:', e)
  }
}

// ─── Premium SVG Rank Badges ──────────────────────────────────────────────────

function RankBadgeSVG({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 15px rgba(255, 215, 0, 0.6))' }}>
        <path d="M50 5 L85 25 L85 65 L50 95 L15 65 L15 25 Z" fill="url(#goldGrad)" stroke="#FFE259" strokeWidth="3" />
        <path d="M50 12 L78 28 L78 60 L50 85 L22 60 L22 28 Z" fill="none" stroke="#FFD700" strokeWidth="1" strokeDasharray="3 3" />
        {/* Crown */}
        <path d="M32 48 L41 38 L50 48 L59 38 L68 48 L68 58 L32 58 Z" fill="#FFFFFF" />
        <circle cx="41" cy="36" r="2.5" fill="#FFFFFF" />
        <circle cx="50" cy="46" r="2.5" fill="#FFFFFF" />
        <circle cx="59" cy="36" r="2.5" fill="#FFFFFF" />
        {/* Banner with Rank #1 */}
        <rect x="25" y="62" width="50" height="14" rx="4" fill="#1e1b4b" stroke="#FFE259" strokeWidth="1.5" />
        <text x="50" y="72" fill="#FFE259" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Outfit, sans-serif">RANK #1</text>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFA07A" />
            <stop offset="50%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>
      </svg>
    )
  }
  if (rank === 2) {
    return (
      <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 15px rgba(192, 192, 192, 0.5))' }}>
        <path d="M50 5 L85 25 L85 65 L50 95 L15 65 L15 25 Z" fill="url(#silverGrad)" stroke="#E0E0E0" strokeWidth="3" />
        <path d="M50 12 L78 28 L78 60 L50 85 L22 60 L22 28 Z" fill="none" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" />
        {/* Star */}
        <polygon points="50,30 54,42 67,42 56,50 60,62 50,54 40,62 44,50 33,42 46,42" fill="#FFFFFF" />
        {/* Banner with Rank #2 */}
        <rect x="25" y="62" width="50" height="14" rx="4" fill="#1e1b4b" stroke="#E0E0E0" strokeWidth="1.5" />
        <text x="50" y="72" fill="#E0E0E0" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Outfit, sans-serif">RANK #2</text>
        <defs>
          <linearGradient id="silverGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DCDCDC" />
            <stop offset="50%" stopColor="#C0C0C0" />
            <stop offset="100%" stopColor="#808080" />
          </linearGradient>
        </defs>
      </svg>
    )
  }
  if (rank === 3) {
    return (
      <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 15px rgba(205, 127, 50, 0.5))' }}>
        <path d="M50 5 L85 25 L85 65 L50 95 L15 65 L15 25 Z" fill="url(#bronzeGrad)" stroke="#CD7F32" strokeWidth="3" />
        <path d="M50 12 L78 28 L78 60 L50 85 L22 60 L22 28 Z" fill="none" stroke="#FFA07A" strokeWidth="1" strokeDasharray="3 3" />
        {/* Trophy icon */}
        <path d="M38 35 H62 V45 C62 51 57 56 50 56 C43 56 38 51 38 45 Z" fill="#FFFFFF" />
        <path d="M47 56 H53 V61 H47 Z" fill="#FFFFFF" />
        <path d="M42 61 H58 V64 H42 Z" fill="#FFFFFF" />
        {/* Banner with Rank #3 */}
        <rect x="25" y="62" width="50" height="14" rx="4" fill="#1e1b4b" stroke="#CD7F32" strokeWidth="1.5" />
        <text x="50" y="72" fill="#FFA07A" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="Outfit, sans-serif">RANK #3</text>
        <defs>
          <linearGradient id="bronzeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E9967A" />
            <stop offset="50%" stopColor="#CD7F32" />
            <stop offset="100%" stopColor="#8B4513" />
          </linearGradient>
        </defs>
      </svg>
    )
  }
  // Top 10 or generic Rank
  return (
    <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 12px rgba(99, 102, 241, 0.45))' }}>
      <path d="M50 5 L85 25 L85 65 L50 95 L15 65 L15 25 Z" fill="url(#neonGrad)" stroke="#6366F1" strokeWidth="3" />
      <path d="M35 35 L50 25 L65 35 L65 55 L50 65 L35 55 Z" fill="#1e1b4b" stroke="#818CF8" strokeWidth="2" />
      <text x="50" y="49" fill="#FFFFFF" fontSize="14" fontWeight="900" textAnchor="middle" fontFamily="Outfit, sans-serif">{rank <= 10 ? 'TOP' : 'RANK'}</text>
      <text x="50" y="61" fill="#818CF8" fontSize="11" fontWeight="900" textAnchor="middle" fontFamily="Outfit, sans-serif">{rank <= 10 ? '10' : `#${rank}`}</text>
      {/* Banner */}
      <rect x="25" y="72" width="50" height="13" rx="4" fill="#111827" stroke="#6366F1" strokeWidth="1" />
      <text x="50" y="81" fill="#818CF8" fontSize="8" fontWeight="800" textAnchor="middle" fontFamily="Outfit, sans-serif">COMPLETED</text>
      <defs>
        <linearGradient id="neonGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRankMeta(rank: number): { color: string; glowColor: string; title: string; message: string } {
  if (rank === 1) return {
    color:      '#FFD700',
    glowColor:  'rgba(255, 215, 0, 0.4)',
    title:      'Weekly Champion!',
    message:    'Outstanding! You dominated the entire server this week. The Weekly Champion badge is now yours until next reset.'
  }
  if (rank === 2) return {
    color:      '#C0C0C0',
    glowColor:  'rgba(192, 192, 192, 0.4)',
    title:      'Weekly Runner-up!',
    message:    "So close to the top! An incredible performance — can you claim #1 next week? You've earned the Runner-up badge."
  }
  if (rank === 3) return {
    color:      '#CD7F32',
    glowColor:  'rgba(205, 127, 50, 0.35)',
    title:      'Top 3 This Week!',
    message:    "You're among the elite — finishing in the Top 3 is a real achievement. The Top 3 badge is yours for this week!"
  }
  if (rank <= 10) return {
    color:      '#6366F1',
    glowColor:  'rgba(99, 102, 241, 0.35)',
    title:      `Rank #${rank} — Top 10!`,
    message:    'You made it into the Top 10 this week — great work! Keep climbing to reach the podium next week.'
  }
  return {
    color:      '#9CA3AF',
    glowColor:  'rgba(156, 163, 175, 0.2)',
    title:      `Week Complete!`,
    message:    `You finished Rank #${rank} this week! Keep playing to earn coins and climb the leaderboard next time.`
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// ─── Coin Counter Animation ───────────────────────────────────────────────────

function CoinCounter({ target }: { target: number }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const duration  = 1800
    const fps       = 60
    const total     = Math.ceil(duration / (1000 / fps))
    let   frame     = 0
    const timer = setInterval(() => {
      frame++
      const progress = frame / total
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (frame >= total) {
        setCount(target)
        clearInterval(timer)
      }
    }, 1000 / fps)
    return () => clearInterval(timer)
  }, [target])

  return <>{formatNumber(count)}</>
}

// ─── Erupting Floating Coins Animation ────────────────────────────────────────

interface CoinParticle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotSpeed: number
  scale: number
}

function FloatingCoinsCelebration({ count = 24 }: { count?: number }) {
  const [coins, setCoins] = useState<CoinParticle[]>([])

  useEffect(() => {
    const arr: CoinParticle[] = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 6 + 4
      arr.push({
        id:       i,
        x:        50, // relative percentage center
        y:        35, // relative percentage center
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed - 2, // slightly upward bias
        rotation: Math.random() * 360,
        rotSpeed: Math.random() * 15 - 7.5,
        scale:    Math.random() * 0.4 + 0.8
      })
    }
    setCoins(arr)

    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      if (elapsed > 2000) {
        clearInterval(timer)
        return
      }

      setCoins((prev) =>
        prev.map((c) => ({
          ...c,
          x:        c.x + c.vx * 0.25,
          y:        c.y + c.vy * 0.25,
          vy:       c.vy + 0.35, // gravity pulls them down
          rotation: c.rotation + c.rotSpeed
        }))
      )
    }, 16)

    return () => clearInterval(timer)
  }, [count])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
      {coins.map((c) => (
        <div
          key={c.id}
          style={{
            position:  'absolute',
            left:      `${c.x}%`,
            top:       `${c.y}%`,
            width:     '20px',
            height:    '20px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFE259, #FFA751)',
            border:    '1.5px solid #FFFFFF',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3), 0 0 8px rgba(255,215,0,0.6)',
            transform: `translate(-50%, -50%) rotate(${c.rotation}deg) scale(${c.scale})`,
            display:   'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize:  '10px',
            fontWeight: 'bold',
            color:     '#D4AF37',
            opacity:   1,
            transition: 'opacity 0.2s'
          }}
        >
          $
        </div>
      ))}
    </div>
  )
}

// ─── Particle Trail Effect ────────────────────────────────────────────────────

function Particles({ color }: { color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    interface Particle {
      x: number; y: number; vx: number; vy: number
      alpha: number; size: number; hue: number
    }

    const particles: Particle[] = []
    for (let i = 0; i < 45; i++) {
      particles.push({
        x:     Math.random() * canvas.width,
        y:     canvas.height + 10,
        vx:    (Math.random() - 0.5) * 3,
        vy:    -(Math.random() * 3 + 1.5),
        alpha: 1,
        size:  Math.random() * 5 + 2,
        hue:   Math.random() * 60 - 30
      })
    }

    let animId: number
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        p.x     += p.vx
        p.y     += p.vy
        p.vy    += 0.05
        p.alpha -= 0.007
        if (p.alpha <= 0) {
          p.x     = Math.random() * canvas.width
          p.y     = canvas.height + 10
          p.vx    = (Math.random() - 0.5) * 3
          p.vy    = -(Math.random() * 3 + 1.5)
          p.alpha = 1
        }
        ctx.save()
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.fillStyle   = color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [color])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:  'absolute', inset: 0,
        width:     '100%',     height: '100%',
        pointerEvents: 'none', zIndex: 0
      }}
    />
  )
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function WeeklyResultModal({ reward, onClose }: Props) {
  const router   = useRouter()
  const meta     = getRankMeta(reward.rank)
  const [visible, setVisible] = useState(false)
  const claimed  = useRef(false)

  // ── Rank Movement Text ──
  const getMovementTag = () => {
    if (reward.previousRank === null) {
      return { label: 'New Entry', color: 'hsl(142 70% 45%)', bg: 'hsl(142 70% 45% / 0.15)', border: '1px solid hsl(142 70% 45% / 0.3)' }
    }
    const diff = reward.previousRank - reward.rank
    if (diff > 0) {
      return { label: `↑ ${diff} Positions`, color: 'hsl(142 70% 45%)', bg: 'hsl(142 70% 45% / 0.15)', border: '1px solid hsl(142 70% 45% / 0.3)' }
    }
    if (diff < 0) {
      return { label: `↓ ${Math.abs(diff)} Positions`, color: 'hsl(0 70% 55%)', bg: 'hsl(0 70% 55% / 0.15)', border: '1px solid hsl(0 70% 55% / 0.3)' }
    }
    return { label: 'Same Rank', color: 'hsl(220 10% 60%)', bg: 'hsl(220 10% 60% / 0.12)', border: '1px solid hsl(220 10% 60% / 0.25)' }
  }

  const movement = getMovementTag()

  // Format Dates safely
  const dateRangeStr = reward.startDate && reward.endDate
    ? `${new Date(reward.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(reward.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''

  useEffect(() => {
    // Play celebratory ascending sound arpeggio on mount
    playCelebrationSound()

    // Trigger local client coin update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('gamehub_xp_update'))
    }

    const t = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleClose = useCallback(async () => {
    if (claimed.current) return
    claimed.current = true
    setVisible(false)

    // Trigger profile refresh event to smoothly reconcile navbar coins
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('gamehub_xp_update'))
    }

    // Fire-and-forget server claim (idempotent)
    fetch('/api/leaderboard/claim-reward', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rewardId: reward.id })
    }).catch(() => null)

    setTimeout(onClose, 350)
  }, [reward.id, onClose])

  const handleViewLeaderboard = useCallback(() => {
    handleClose()
    router.push('/dashboard/leaderboard?tab=weeklyHistory')
  }, [handleClose, router])

  const handleContinuePlaying = useCallback(() => {
    handleClose()
  }, [handleClose])

  return (
    <div
      style={{
        position:        'fixed', inset: 0, zIndex: 9000,
        display:         'flex',  alignItems: 'center', justifyContent: 'center',
        background:      'rgba(0,0,0,0.85)',
        backdropFilter:  'blur(15px)',
        transition:      'opacity 0.35s ease',
        opacity:          visible ? 1 : 0,
        padding:         '1rem'
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position:     'relative',
          width:        '100%',
          maxWidth:     460,
          background:   'linear-gradient(145deg, hsl(222 28% 10%), hsl(222 22% 7%))',
          border:       `1px solid ${meta.color}45`,
          borderRadius: 28,
          overflow:     'hidden',
          boxShadow:    `0 0 80px ${meta.glowColor}, 0 20px 60px rgba(0,0,0,0.75)`,
          transform:     visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.95)',
          transition:   'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Celebration Erupting Coins & Particles */}
        {visible && <FloatingCoinsCelebration count={24} />}
        {reward.rank <= 3 && <Particles color={meta.color} />}

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position:   'absolute', top: 16, right: 16, zIndex: 30,
            width:       32,        height: 32,
            borderRadius: '50%',
            background:  'rgba(255,255,255,0.08)',
            border:      '1px solid rgba(255,255,255,0.12)',
            color:       'white', fontSize: 20, lineHeight: '30px', textAlign: 'center',
            cursor:      'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition:  'all 0.2s',
          }}
          className="hover:bg-white/15"
        >
          ×
        </button>

        {/* Top gradient glow indicator */}
        <div style={{
          position:   'absolute', top: 0, left: 0, right: 0, height: 4,
          background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
          zIndex:     1
        }} />

        <div style={{ position: 'relative', zIndex: 2, padding: '2.5rem 2rem 2rem' }}>

          {/* Week & Date Label */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              fontSize:     '0.72rem',
              fontWeight:   800,
              letterSpacing: '0.12em',
              color:        'hsl(220 10% 50%)',
              textTransform: 'uppercase',
            }}>
              Week #{reward.weekNumber}
            </div>
            {dateRangeStr && (
              <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 40%)', marginTop: '0.15rem', fontWeight: 600 }}>
                {dateRangeStr}
              </div>
            )}
          </div>

          {/* Premium Vector SVG Badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', position: 'relative' }}>
            <RankBadgeSVG rank={reward.rank} />
          </div>

          {/* Title & Celebration Label */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{
              margin:       0,
              fontSize:     'clamp(1.3rem, 3vw, 1.7rem)',
              fontWeight:   900,
              color:        meta.color,
              letterSpacing: '-0.02em',
              textShadow:   `0 0 30px ${meta.color}50`
            }}>
              {meta.title}
            </h2>
            {/* Rank Movement comparative tag */}
            <div style={{ display: 'inline-flex', marginTop: '0.5rem' }}>
              <span style={{
                fontSize: '0.75rem', fontWeight: 750,
                color: movement.color, background: movement.bg, border: movement.border,
                padding: '0.2rem 0.65rem', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.02em'
              }}>
                {movement.label}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{
            display:      'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap:          '0.75rem',
            marginBottom: '1.5rem'
          }}>
            {/* Coins earned */}
            <div style={{
              background:   `linear-gradient(135deg, ${meta.color}15, ${meta.color}05)`,
              border:       `1px solid ${meta.color}25`,
              borderRadius: 16,
              padding:      '1rem 0.5rem',
              textAlign:    'center',
              boxShadow:    '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.15rem' }}>🪙</div>
              <div style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.35rem)', fontWeight: 900, color: meta.color }}>
                +<CoinCounter target={reward.coinsEarned} />
              </div>
              <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 48%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                Coins Won
              </div>
            </div>

            {/* Weekly score */}
            <div style={{
              background:   'hsl(222 20% 11%)',
              border:       '1px solid hsl(220 15% 18%)',
              borderRadius: 16,
              padding:      '1rem 0.5rem',
              textAlign:    'center',
              boxShadow:    '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.15rem' }}>📊</div>
              <div style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.35rem)', fontWeight: 900, color: 'white' }}>
                {formatNumber(reward.score)}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 48%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                Final Score
              </div>
            </div>

            {/* XP bonus */}
            <div style={{
              background:   'hsl(222 20% 11%)',
              border:       '1px solid hsl(220 15% 18%)',
              borderRadius: 16,
              padding:      '1rem 0.5rem',
              textAlign:    'center',
              boxShadow:    '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: '1.25rem', marginBottom: '0.15rem' }}>⚡</div>
              <div style={{ fontSize: 'clamp(0.95rem, 2.5vw, 1.35rem)', fontWeight: 900, color: 'hsl(142 70% 55%)' }}>
                +{formatNumber(reward.xpEarned)}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 48%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                XP Bonus
              </div>
            </div>
          </div>

          {/* Games played */}
          <div style={{
            background:   'hsl(222 20% 9%)',
            border:       '1px solid hsl(220 15% 15%)',
            borderRadius: 14,
            padding:      '0.75rem 1.1rem',
            display:      'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>
              Games Played
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>
              {reward.totalGames} {reward.totalGames === 1 ? 'game' : 'games'}
            </span>
          </div>

          {/* Description Message */}
          <p style={{
            margin:       '0 0 1.75rem',
            fontSize:     '0.82rem',
            color:        'hsl(220 10% 58%)',
            lineHeight:   1.6,
            textAlign:    'center'
          }}>
            {meta.message}
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleViewLeaderboard}
              style={{
                flex:         1,
                padding:      '0.8rem',
                borderRadius: 14,
                border:       `1px solid ${meta.color}50`,
                background:   `${meta.color}15`,
                color:        meta.color,
                fontWeight:   700,
                fontSize:     '0.85rem',
                cursor:       'pointer',
                transition:   'all 0.2s',
                boxShadow:    '0 4px 10px rgba(0,0,0,0.15)'
              }}
            >
              View Leaderboard
            </button>
            <button
              onClick={handleContinuePlaying}
              style={{
                flex:         1,
                padding:      '0.8rem',
                borderRadius: 14,
                border:       'none',
                background:   meta.color,
                color:        '#000',
                fontWeight:   800,
                fontSize:     '0.85rem',
                cursor:       'pointer',
                transition:   'all 0.2s',
                boxShadow:    `0 4px 12px ${meta.color}35`
              }}
            >
              Continue Playing
            </button>
          </div>

        </div>

        <style>{`
          @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        `}</style>
      </div>
    </div>
  )
}
