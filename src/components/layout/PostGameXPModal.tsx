'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { GameResultPayload } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress, xpRequiredForLevel, xpForNextLevel } from '@/lib/xpUtils'
import { GAMES_REGISTRY } from '@/lib/games'
import { GameIcon } from '@/components/games/GameIcon'

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

interface Props {
  data: GameResultPayload
  onClose: (action?: 'replay' | 'next' | 'lobby') => void
}

export default function PostGameXPModal({ data, onClose }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mounted, setMounted] = useState(false)

  const {
    gameSlug,
    result,
    xpGained,
    coinsGained,
    oldXP,
    newXP,
    oldLevel,
    newLevel,
    leveledUp,
    currentStreak = 0,
    unlockedAchievements = [],
    nextAchievement,
    isGuest,
    highScore = 0,
    metadata = {},
  } = data

  useEffect(() => {
    setMounted(true)
    const isRankedMatch = metadata?.mode === 'ranked' || metadata?.gameMetadata?.mode === 'ranked' || (metadata?.gameMetadata as any)?.mode === 'ranked'
    if (isRankedMatch) {
      window.dispatchEvent(new CustomEvent('gamehub_ranked_match_complete'))
    }
  }, [metadata])

  const oldProg = getLevelProgress(oldXP)
  const newProg = getLevelProgress(newXP)

  const [barPercent, setBarPercent] = useState(oldProg.progressPercent)
  const [levelDisplay, setLevelDisplay] = useState(oldLevel)
  const [celebrateLevelUp, setCelebrateLevelUp] = useState(false)

  // Count-up states
  const [xpDisplay, setXpDisplay] = useState(0)
  const [coinsDisplay, setCoinsDisplay] = useState(0)

  // Extract game specific metadata with fallbacks
  const gameMetadata = metadata?.gameMetadata || {}
  const currentLvl = gameMetadata?.level ?? metadata?.level ?? 1
  const moves = gameMetadata?.moves ?? 0
  const timeSecs = gameMetadata?.timeSecs ?? gameMetadata?.timeSpent ?? metadata?.timeSpent ?? 0
  const starsCount = gameMetadata?.stars ?? (result === 'win' ? 3 : 0)
  const score = (metadata?.score as number) ?? (highScore as number) ?? 0

  // Local storage best time tracking for level games
  const bestTimeKey = `gamehub_${gameSlug}_level_${currentLvl}_best_time`
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false)

  useEffect(() => {
    if (result !== 'win') return
    const saved = localStorage.getItem(bestTimeKey)
    const currentBest = saved ? parseInt(saved, 10) : null

    if (timeSecs > 0) {
      if (currentBest === null || timeSecs < currentBest) {
        localStorage.setItem(bestTimeKey, timeSecs.toString())
        setPersonalBest(timeSecs)
        if (currentBest !== null) {
          setIsNewPersonalBest(true)
        }
      } else {
        setPersonalBest(currentBest)
      }
    }
  }, [gameSlug, currentLvl, timeSecs, result, bestTimeKey])

  // Find next game slug in registry
  const currentGameIndex = GAMES_REGISTRY.findIndex(g => g.slug === gameSlug)
  const nextGame = currentGameIndex !== -1 && currentGameIndex < GAMES_REGISTRY.length - 1
    ? GAMES_REGISTRY[currentGameIndex + 1]
    : GAMES_REGISTRY[0]

  // Count up animation
  useEffect(() => {
    const duration = 1000 // 1 second
    const intervalTime = 25
    const steps = duration / intervalTime
    const xpStep = xpGained / steps
    const coinsStep = coinsGained / steps
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      if (currentStep >= steps) {
        setXpDisplay(xpGained)
        setCoinsDisplay(coinsGained)
        clearInterval(timer)
      } else {
        setXpDisplay(Math.floor(xpStep * currentStep))
        setCoinsDisplay(Math.floor(coinsStep * currentStep))
      }
    }, intervalTime)

    return () => clearInterval(timer)
  }, [xpGained, coinsGained])

  // Progress bar fill animation
  useEffect(() => {
    const timer1 = setTimeout(() => {
      if (leveledUp) {
        setBarPercent(100)
        const timer2 = setTimeout(() => {
          setCelebrateLevelUp(true)
          setLevelDisplay(newLevel)
          setBarPercent(0)
          const timer3 = setTimeout(() => {
            setBarPercent(newProg.progressPercent)
          }, 150)
          return () => clearTimeout(timer3)
        }, 850)
        return () => clearTimeout(timer2)
      } else {
        setBarPercent(newProg.progressPercent)
      }
    }, 300)

    return () => clearTimeout(timer1)
  }, [leveledUp, newLevel, newProg.progressPercent, oldProg.progressPercent])

  // Canvas confetti animation on Victory
  useEffect(() => {
    if (result !== 'win' || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const colors = ['#FFD700', '#FFA500', '#FF5722', '#00E5FF', '#76FF03', '#E040FB', '#FF1744']
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.05 + 0.02,
      tiltAngle: 0,
      speed: Math.random() * 3 + 2,
    }))

    const drawConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental
        p.y += p.speed
        p.x += Math.sin(p.tiltAngle) * 0.5

        ctx.beginPath()
        ctx.lineWidth = p.r
        ctx.strokeStyle = p.color
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y)
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2)
        ctx.stroke()

        if (p.y > canvas.height) {
          particles[idx] = {
            ...p,
            x: Math.random() * canvas.width,
            y: -10,
            tilt: Math.random() * 10 - 5,
            tiltAngle: 0,
          }
        }
      })
      animationId = requestAnimationFrame(drawConfetti)
    }

    drawConfetti()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [result])

  if (!mounted) return null

  // Determine game type and category
  let layoutType: 'level' | 'endless' | 'puzzle' | 'multiplayer' = 'puzzle'
  if (metadata?.multiplayer || gameSlug.startsWith('multiplayer-') || ['scribble', 'cricket'].includes(gameSlug)) {
    layoutType = 'multiplayer'
  } else if (['arrow-puzzle', 'color-sort', 'water-sort', 'unblock-traffic', 'unblock-me', 'water-connect', 'candy-blast', 'ai-infinite-candy-crush', 'pipe-connect', 'bubble-shooter'].includes(gameSlug)) {
    layoutType = 'level'
  } else if (['2048', 'snake', 'fighter-jet', 'fighter', 'neontetris', 'blockblast', 'snake-arena'].includes(gameSlug)) {
    layoutType = 'endless'
  }

  const outcomeConfigs = {
    win: {
      bg: gameSlug === 'snake-arena' ? 'linear-gradient(135deg, hsl(142 80% 6% / 0.96), hsl(222 20% 9% / 0.96))' : 'linear-gradient(135deg, hsl(45 100% 6% / 0.96), hsl(222 20% 9% / 0.96))',
      border: gameSlug === 'snake-arena' ? '1px solid hsl(142 80% 55% / 0.35)' : '1px solid hsl(45 100% 55% / 0.35)',
      text: gameSlug === 'snake-arena' ? 'hsl(142 80% 65%)' : 'hsl(45 100% 65%)',
      emoji: gameSlug === 'snake-arena' ? '🐍' : '🏆',
      emojiClass: 'trophy-bounce-animation',
      title: gameSlug === 'snake-arena' ? 'Match Complete' : (layoutType === 'level' ? 'Level Cleared!' : 'Victory!'),
      glow: gameSlug === 'snake-arena' ? '0 0 40px hsl(142 80% 55% / 0.15)' : '0 0 40px hsl(45 100% 55% / 0.15)',
    },
    loss: {
      bg: gameSlug === 'snake-arena' ? 'linear-gradient(135deg, hsl(142 80% 6% / 0.96), hsl(222 20% 9% / 0.96))' : 'linear-gradient(135deg, hsl(0 80% 6% / 0.96), hsl(222 20% 9% / 0.96))',
      border: gameSlug === 'snake-arena' ? '1px solid hsl(142 80% 55% / 0.35)' : '1px solid hsl(0 80% 55% / 0.35)',
      text: gameSlug === 'snake-arena' ? 'hsl(142 80% 65%)' : 'hsl(0 80% 65%)',
      emoji: gameSlug === 'snake-arena' ? '🐍' : '💀',
      emojiClass: 'skull-shake-animation',
      title: gameSlug === 'snake-arena' ? 'Game Over' : (layoutType === 'level' ? 'Level Failed' : 'Defeat'),
      glow: gameSlug === 'snake-arena' ? '0 0 40px hsl(142 80% 55% / 0.15)' : '0 0 40px hsl(0 80% 55% / 0.15)',
    },
    draw: {
      bg: 'linear-gradient(135deg, hsl(222 20% 9% / 0.96), hsl(222 18% 13% / 0.96))',
      border: '1px solid hsl(220 15% 22%)',
      text: 'hsl(220 10% 75%)',
      emoji: '🤝',
      emojiClass: 'animate-float',
      title: 'Draw Match',
      glow: 'none',
    },
  }

  const currentOutcome = outcomeConfigs[result] || outcomeConfigs.draw

  const modalTitle = (metadata as any)?.customTitle || currentOutcome.title
  const modalSubtitle = (metadata as any)?.customSubtitle || 
    (layoutType === 'level' 
      ? `Level ${currentLvl} • ${result === 'win' ? 'Completed' : 'Failed'}` 
      : `${GAMES_REGISTRY.find(g => g.slug === gameSlug)?.name || gameSlug.replace('-', ' ')} Match`)

  const starText = {
    3: 'Excellent!',
    2: 'Good Job!',
    1: 'Completed!',
    0: 'Try Again!'
  }[starsCount as 0 | 1 | 2 | 3] || 'Completed!'

  function handleBackToDashboard() {
    onClose()
    router.push('/dashboard')
  }

  function handleBackToLobby() {
    onClose('lobby')
    window.dispatchEvent(new Event('gamehub_snake_lobby'))
  }

  const formatSurvivalTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      className="animate-fadeIn animate-modal-backdrop"
      id="post-game-modal-backdrop"
    >
      {/* CSS injection for VictoryConfetti and shake/bounce keyframes */}
      <style>{`
        @keyframes trophy-bounce {
          0%, 100% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.15) translateY(-14px); }
        }
        @keyframes skull-shake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-10deg) scale(1.05) translateX(-4px); }
          30% { transform: rotate(10deg) scale(1.05) translateX(4px); }
          45% { transform: rotate(-8deg) translateX(-3px); }
          60% { transform: rotate(8deg) translateX(3px); }
          75% { transform: rotate(-4deg) translateX(-1px); }
          90% { transform: rotate(4deg) translateX(1px); }
        }
        @keyframes star-pop {
          0% { transform: scale(0); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .trophy-bounce-animation {
          animation: trophy-bounce 2s ease-in-out infinite;
        }
        .skull-shake-animation {
          animation: skull-shake 1.2s ease-in-out;
        }
        .star-pop-animation {
          animation: star-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .achievement-stagger-1 { animation-delay: 0.1s; }
        .achievement-stagger-2 { animation-delay: 0.2s; }
        .achievement-stagger-3 { animation-delay: 0.3s; }
      `}</style>

      {/* Confetti canvas on victory */}
      {result === 'win' && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 100001,
            width: '100vw',
            height: '100vh',
          }}
        />
      )}

      <div
        className="card glass animate-slideUp"
        style={{
          width: '92%',
          maxWidth: 400,
          maxHeight: 'min(75vh, 600px)',
          overflowY: 'auto',
          background: currentOutcome.bg,
          border: currentOutcome.border,
          padding: '1.1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          boxShadow: `0 20px 50px rgba(0, 0, 0, 0.65), ${currentOutcome.glow}`,
          borderRadius: 24,
          position: 'relative',
          zIndex: 100002,
          boxSizing: 'border-box',
          scrollbarWidth: 'thin',
        }}
        id="post-game-modal-body"
      >
        {/* Leveled Up Glow Background */}
        {celebrateLevelUp && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, hsl(270 80% 60% / 0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
              animation: 'spin-slow 20s linear infinite',
              zIndex: 0,
            }}
          />
        )}

        {/* Modal Header: Game Icon, Result Title & Subtitle */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.1rem' }}>
            <div style={{
              padding: '8px',
              borderRadius: '12px',
              background: 'hsl(222 20% 7% / 0.7)',
              border: '1px solid hsl(220 15% 20%)',
              boxShadow: `0 0 15px ${result === 'win' ? 'hsl(45 100% 55% / 0.15)' : result === 'loss' ? 'hsl(0 80% 55% / 0.15)' : 'hsl(220 100% 65% / 0.15)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <GameIcon slug={gameSlug} size={42} />
            </div>
          </div>

          {/* Hero Image (Optional) */}
          {(metadata as any)?.heroImage && (
            <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: '0.25rem', border: '1px solid hsl(220 15% 20%)', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }}>
              <img src={(metadata as any).heroImage} alt="Mission Outcome" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )}

          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 950,
              color: currentOutcome.text,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem'
            }}
          >
            <span className={currentOutcome.emojiClass}>{currentOutcome.emoji}</span>
            <span>{modalTitle}</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'white', opacity: 0.9, marginTop: 0, fontWeight: 700, letterSpacing: '-0.01em' }}>
            {modalSubtitle}
          </p>
        </div>

        {/* Level Stars Rating Display */}
        {layoutType === 'level' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', position: 'relative', zIndex: 1 }} id="modal-star-rating-container">
            <div style={{ display: 'flex', gap: '0.35rem', fontSize: '1.8rem', justifyContent: 'center' }}>
              {[1, 2, 3].map((star) => {
                const isActive = star <= starsCount
                return (
                  <span
                    key={star}
                    className={isActive ? 'star-pop-animation' : ''}
                    style={{
                      color: isActive ? 'hsl(45 100% 55%)' : 'hsl(220 10% 20%)',
                      opacity: isActive ? 1 : 0.2,
                      display: 'inline-block',
                      animationDelay: isActive ? `${(star - 1) * 0.12}s` : '0s',
                    }}
                  >
                    ★
                  </span>
                )
              })}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>
              {starText}
            </div>
          </div>
        )}

        {/* New Personal Best Toast Banner */}
        {isNewPersonalBest && (
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'center',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'linear-gradient(90deg, hsl(45 100% 55%), hsl(38 95% 45%))',
              color: 'black',
              fontWeight: 900,
              fontSize: '0.62rem',
              padding: '2px 10px',
              borderRadius: '9999px',
              boxShadow: '0 4px 10px rgba(230, 170, 0, 0.35)',
              letterSpacing: '0.03em',
              margin: '0 auto',
              position: 'relative',
              zIndex: 1,
            }}
            id="new-personal-best-badge"
          >
            🏆 <span>NEW PERSONAL BEST TIME!</span>
          </div>
        )}

        {/* Game Stats Information Layout */}
        {metadata?.statistics && Array.isArray(metadata.statistics) && metadata.statistics.length > 0 ? (
          <div
            style={{
              background: 'hsl(222 20% 7% / 0.8)',
              border: '1px solid hsl(220 15% 18%)',
              borderRadius: 16,
              padding: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              position: 'relative',
              zIndex: 1,
              boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
            }}
            id="custom-statistics-card"
          >
            {score > 0 && !metadata.statistics.some((s: any) => s.label.toLowerCase() === 'score' || s.label.toLowerCase() === 'final score' || s.label.toLowerCase() === 'total score') && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(220 15% 16%)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)', textTransform: 'uppercase' }}>Final Score</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#fbbf24', fontFamily: 'monospace' }}>
                  {score.toLocaleString()}
                </span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px', paddingTop: '2px', textAlign: 'left' }}>
              {metadata.statistics.map((stat: any, idx: number) => (
                <div key={idx} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: stat.color || 'white', fontFamily: 'monospace', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          gameSlug === 'snake-arena' ? (
            <div
              style={{
                background: 'hsl(222 20% 7% / 0.8)',
                border: '1px solid hsl(220 15% 18%)',
                borderRadius: 16,
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                zIndex: 1,
                boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(220 15% 16%)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)', textTransform: 'uppercase' }}>Final Score</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#fbbf24', fontFamily: 'monospace' }}>
                  {score.toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px', paddingTop: '2px', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Eliminations</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'hsl(355 85% 65%)', fontFamily: 'monospace', marginTop: '1px' }}>
                    {gameMetadata.eliminations ?? 0}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Longest Length</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '1px' }}>
                    {gameMetadata.longestLength ?? 3}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Survival Time</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace', marginTop: '1px' }}>
                    {formatSurvivalTime(timeSecs || gameMetadata.survivalTime || 0)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            (layoutType === 'level' || layoutType === 'endless') && (
              <div
                style={{
                  background: 'hsl(222 20% 7% / 0.8)',
                  border: '1px solid hsl(220 15% 18%)',
                  borderRadius: 16,
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  zIndex: 1,
                  boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                }}
              >
                {score > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(220 15% 16%)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)', textTransform: 'uppercase' }}>Score</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 950, color: '#fbbf24', fontFamily: 'monospace' }}>
                      {score.toLocaleString()}
                    </span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px', paddingTop: '2px', textAlign: 'left' }}>
                  {layoutType === 'endless' && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>High Score</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace', marginTop: '1px' }}>
                        {Math.max(highScore, score).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {layoutType === 'level' && moves > 0 && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Moves</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '1px' }}>
                        {moves}
                      </div>
                    </div>
                  )}

                  {timeSecs > 0 && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Time</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '1px' }}>
                        {timeSecs}s
                      </div>
                    </div>
                  )}

                  {layoutType === 'level' && result === 'win' && personalBest !== null && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Best Time</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#fbbf24', fontFamily: 'monospace', marginTop: '1px' }}>
                        {personalBest}s
                      </div>
                    </div>
                  )}

                  {gameMetadata.linesCleared !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Lines Cleared</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '1px' }}>
                        {gameMetadata.linesCleared}
                      </div>
                    </div>
                  )}
                  {gameMetadata.wordsFound !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Words Found</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '1px' }}>
                        {gameMetadata.wordsFound}
                      </div>
                    </div>
                  )}
                  {gameMetadata.maxCombo !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Max Combo</div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#ec4899', fontFamily: 'monospace', marginTop: '1px' }}>
                        x{gameMetadata.maxCombo}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}

        {/* Rewards Summary Strip */}
        <div
          style={{
            background: 'hsl(222 20% 7% / 0.7)',
            borderRadius: 16,
            border: '1px solid hsl(220 15% 16%)',
            padding: '0.75rem 1rem',
            display: 'flex',
            position: 'relative',
            zIndex: 1,
            gap: '0.4rem',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60px',
          }}
        >
          {/* Subtle Background Sync Indicator */}
          {(metadata as any)?.syncing && (
            <div style={{
              position: 'absolute',
              top: '6px',
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.6rem',
              color: 'hsl(220 10% 50%)',
              fontWeight: 600,
            }} id="rewards-syncing-indicator">
              <span className="animate-spin" style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                border: '1.2px solid hsl(220 100% 65% / 0.2)',
                borderTopColor: 'hsl(220 100% 65%)',
                borderRadius: '50%',
              }} />
              <span>Saving...</span>
            </div>
          )}

          <>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>
                +{xpDisplay}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>XP Earned</div>
            </div>
            {coinsGained > 0 && (
              <div style={{ flex: 1, borderLeft: '1px solid hsl(220 15% 16%)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>
                  +{coinsDisplay}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>Coins Won</div>
              </div>
            )}
            {currentStreak > 0 && (
              <div style={{ flex: 1, borderLeft: '1px solid hsl(220 15% 16%)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(38 95% 60%)' }}>
                  🔥 {currentStreak}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>Streak</div>
              </div>
            )}
          </>
        </div>

        {/* Level Up Celebration State */}
        {celebrateLevelUp && (
          <div
            className="animate-slideUp"
            style={{
              background: 'linear-gradient(135deg, hsl(270 80% 60% / 0.22), hsl(220 100% 60% / 0.22))',
              border: '1px solid hsl(270 80% 50% / 0.5)',
              borderRadius: 12,
              padding: '0.65rem 0.4rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-glow-primary)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.1rem', color: 'white' }}>🎉 LEVEL UP! 🎉</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 85%)' }}>
              You reached <strong style={{ color: 'hsl(270 80% 70%)' }}>Level {levelDisplay}</strong>!
            </div>
          </div>
        )}

        {/* Level Progress Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
            <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level {levelDisplay}</span>
            <span style={{ fontWeight: 700, color: 'hsl(220 100% 75%)' }}>
              {Math.max(0, (levelDisplay === oldLevel ? oldXP : newXP) - xpRequiredForLevel(levelDisplay))} / {xpForNextLevel(levelDisplay)} XP ({barPercent}%)
            </span>
            <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level {levelDisplay + 1}</span>
          </div>
          <div className="xp-bar" style={{ height: 8, background: 'hsl(220 20% 9%)', borderRadius: 99 }}>
            <div
              className="xp-bar-fill"
              style={{
                width: `${barPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                borderRadius: 99,
                transition: 'width 0.8s cubic-bezier(0.1, 0.8, 0.25, 1.0)',
              }}
            />
          </div>
          
          {/* Compact Next Unlock Preview widget */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'hsl(270 80% 50% / 0.08)', border: '1px solid hsl(270 80% 50% / 0.22)', borderRadius: 10, padding: '0.4rem 0.65rem', textAlign: 'left', marginTop: '0.15rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'hsl(270 80% 60% / 0.15)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🎁</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'white' }}>Next Unlock Preview</div>
              <div style={{ fontSize: '0.58rem', color: 'hsl(220 10% 60%)' }}>
                {xpForNextLevel(levelDisplay) - Math.max(0, (levelDisplay === oldLevel ? oldXP : newXP) - xpRequiredForLevel(levelDisplay))} XP remaining for next Reward Chest!
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Unlocked Achievements Section */}
        {unlockedAchievements && unlockedAchievements.length > 0 && (
          <details 
            style={{ 
              background: 'linear-gradient(135deg, hsl(45 100% 50% / 0.08), hsl(35 90% 50% / 0.08))', 
              border: '1px solid hsl(45 100% 55% / 0.25)', 
              borderRadius: 12, 
              padding: '0.45rem 0.75rem',
              position: 'relative',
              zIndex: 1
            }}
            className="group"
          >
            <summary style={{ fontSize: '0.72rem', fontWeight: 900, color: 'hsl(45 100% 55%)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}>
              <span>🏅 Badges Unlocked ({unlockedAchievements.length})</span>
              <span style={{ fontSize: '0.55rem', transition: 'transform 0.2s ease' }} className="group-open:rotate-180">▼</span>
            </summary>
            <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {unlockedAchievements.map((ach: any, idx: number) => (
                <div key={idx} style={{ textAlign: 'left', borderTop: idx > 0 ? '1px solid hsl(45 100% 55% / 0.15)' : 'none', paddingTop: idx > 0 ? '4px' : 0 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'white' }}>{ach.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 75%)', marginTop: '1px' }}>{ach.description}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Next badge progress widget (if no badges unlocked this match) */}
        {(!unlockedAchievements || unlockedAchievements.length === 0) && nextAchievement && (
          <div
            style={{
              background: 'hsl(222 20% 11% / 0.4)',
              borderRadius: 10,
              border: '1px solid hsl(220 15% 18%)',
              padding: '0.5rem 0.75rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'hsl(220 10% 50%)' }}>Next Badge: <strong>{nextAchievement.name}</strong></span>
              <span style={{ color: 'hsl(220 10% 65%)', fontWeight: 700 }}>{nextAchievement.current} / {nextAchievement.target}</span>
            </div>
            <div style={{ height: 4, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${nextAchievement.progress}%`,
                  height: '100%',
                  background: 'hsl(45 100% 55%)',
                  borderRadius: 99,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Collapsible Offline Mode or Guest Warning Section */}
        {metadata?.offline ? (
          <div
            style={{
              background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.08), hsl(38 95% 55% / 0.08))',
              border: '1px solid hsl(38 95% 50% / 0.25)',
              borderRadius: 12,
              padding: '0.6rem 0.8rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 900, color: 'hsl(38 95% 65%)', textTransform: 'uppercase' }}>
              Offline Session
            </div>
            <div style={{ fontSize: '0.72rem', color: 'white', fontWeight: 700 }}>
              XP Gained: <span style={{ color: 'hsl(220 100% 70%)' }}>+{xpGained}</span> | Coins: <span style={{ color: 'hsl(45 100% 55%)' }}>+{coinsGained}</span>
            </div>
          </div>
        ) : isGuest ? (
          <details
            style={{
              background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.04), hsl(38 95% 55% / 0.04))',
              border: '1px solid hsl(38 95% 50% / 0.2)',
              borderRadius: 12,
              padding: '0.45rem 0.75rem',
              position: 'relative',
              zIndex: 1
            }}
            className="group"
          >
            <summary style={{ fontSize: '0.72rem', fontWeight: 900, color: 'hsl(38 95% 65%)', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', outline: 'none' }}>
              <span>⚠️ Guest Progress Warning</span>
              <span style={{ fontSize: '0.55rem' }}>▼</span>
            </summary>
            <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.68rem', color: 'hsl(220 10% 70%)', margin: 0, lineHeight: 1.45 }}>
                Register for a free account to sync your XP, save your {levelDisplay} levels, unlock achievements, and climb local leaderboards!
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    onClose()
                    router.push('/register')
                  }}
                  style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem' }}
                >
                  Sign Up
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onClose()
                    router.push('/login')
                  }}
                  style={{ fontSize: '0.68rem', padding: '0.25rem 0.5rem' }}
                >
                  Sign In
                </button>
              </div>
            </div>
          </details>
        ) : null}

        {/* Optional Game-Specific Footer */}
        {(metadata as any)?.gameSpecificFooter && (
          <div
            style={{
              fontSize: '0.68rem',
              color: 'hsl(220 10% 65%)',
              textAlign: 'center',
              padding: '0.4rem 0.65rem',
              borderRadius: 10,
              background: 'hsl(222 20% 7% / 0.5)',
              border: '1px solid hsl(220 15% 18%)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {(metadata as any).gameSpecificFooter}
          </div>
        )}

        {/* Actions Footer - entrance slide-in animated */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.15rem', position: 'relative', zIndex: 1 }} className="btn-entrance-anim">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {gameSlug === 'snake-arena' ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => onClose('replay')}
                  style={{ flex: 1.3, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                  id="modal-replay-btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  Play Again
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleBackToLobby}
                  style={{ flex: 1, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                  id="modal-lobby-btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                  Lobby
                </button>
              </>
            ) : (
              <>
                {/* Primary Action Button (Level vs Endless vs Puzzle) */}
                {layoutType === 'level' && result === 'win' && (metadata?.hasNextLevel ?? gameMetadata?.hasNextLevel ?? true) ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => onClose('next')}
                    style={{ flex: 1.3, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                    id="modal-next-btn"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    Next Level
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => onClose('replay')}
                    style={{ flex: 1.3, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                    id="modal-replay-btn"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    {layoutType === 'endless' ? 'Continue' : 'Play Again'}
                  </button>
                )}

                {/* Replay option for level games if won */}
                {layoutType === 'level' && result === 'win' && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => onClose('replay')}
                    style={{ flex: 1, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                    id="modal-replay-btn-level-win"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    Replay
                  </button>
                )}

                {/* Home fallback */}
                <button
                  className="btn btn-secondary"
                  onClick={handleBackToDashboard}
                  style={{ flex: 1, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.45rem' }}
                  id="modal-dashboard-btn"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '4px' }}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Home
                </button>
              </>
            )}
          </div>

          {/* Multiplayer buttons compatibility */}
          {layoutType === 'multiplayer' && (
            <button
              className="btn btn-secondary"
              onClick={() => onClose('replay')}
              style={{
                width: '100%',
                borderRadius: 10,
                background: 'linear-gradient(135deg, hsl(220 100% 60% / 0.15), hsl(270 80% 60% / 0.15))',
                borderColor: 'hsl(220 100% 60% / 0.3)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.45rem'
              }}
              id="modal-rematch-btn"
            >
              ⚡ Rematch Request
            </button>
          )}

          {/* layoutType !== 'multiplayer' and not snake-arena */}
          {layoutType !== 'multiplayer' && gameSlug !== 'snake-arena' && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                onClose()
                router.push(`/dashboard/games/${nextGame.slug}`)
              }}
              style={{
                width: '100%',
                borderRadius: 10,
                background: 'linear-gradient(135deg, hsl(220 100% 60% / 0.1), hsl(270 80% 60% / 0.1))',
                borderColor: 'hsl(220 100% 60% / 0.25)',
                color: 'hsl(220 100% 80%)',
                fontSize: '0.78rem',
                padding: '0.45rem'
              }}
              id="modal-nextgame-btn"
            >
              Next Game: {nextGame.name}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
