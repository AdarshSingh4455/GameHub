'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { GameResultPayload } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress, xpRequiredForLevel, xpForNextLevel } from '@/lib/xpUtils'
import { GAMES_REGISTRY } from '@/lib/games'
import SinglePlayerXPModal from './SinglePlayerXPModal'

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

interface Props {
  data: GameResultPayload
  onClose: (action?: 'replay' | 'next') => void
}

export default function PostGameXPModal({ data, onClose }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
    currentStreak,
    unlockedAchievements,
    nextAchievement,
    isGuest,
    metadata = {},
  } = data

  const oldProg = getLevelProgress(oldXP)
  const newProg = getLevelProgress(newXP)

  const [barPercent, setBarPercent] = useState(oldProg.progressPercent)
  const [levelDisplay, setLevelDisplay] = useState(oldLevel)
  const [celebrateLevelUp, setCelebrateLevelUp] = useState(false)

  // Count-up states
  const [xpDisplay, setXpDisplay] = useState(0)
  const [coinsDisplay, setCoinsDisplay] = useState(0)

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

  const outcomeConfigs = {
    win: {
      bg: 'linear-gradient(135deg, hsl(45 100% 6% / 0.95), hsl(222 20% 9% / 0.95))',
      border: '1px solid hsl(45 100% 55% / 0.35)',
      text: 'hsl(45 100% 65%)',
      emoji: '🏆',
      emojiClass: 'trophy-bounce-animation',
      title: 'Victory!',
      glow: '0 0 40px hsl(45 100% 55% / 0.15)',
    },
    loss: {
      bg: 'linear-gradient(135deg, hsl(0 80% 6% / 0.95), hsl(222 20% 9% / 0.95))',
      border: '1px solid hsl(0 80% 55% / 0.35)',
      text: 'hsl(0 80% 65%)',
      emoji: '💀',
      emojiClass: 'skull-shake-animation',
      title: 'Defeat',
      glow: '0 0 40px hsl(0 80% 55% / 0.15)',
    },
    draw: {
      bg: 'linear-gradient(135deg, hsl(222 20% 9% / 0.95), hsl(222 18% 13% / 0.95))',
      border: '1px solid hsl(220 15% 22%)',
      text: 'hsl(220 10% 75%)',
      emoji: '🤝',
      emojiClass: 'animate-float',
      title: 'Draw Match',
      glow: 'none',
    },
  }

  const currentOutcome = outcomeConfigs[result]

  function handleBackToDashboard() {
    onClose()
    router.push('/dashboard')
  }

  function handleNextGame() {
    onClose()
    router.push(`/dashboard/games/${nextGame.slug}`)
  }

  const game = GAMES_REGISTRY.find(g => g.slug === gameSlug)
  const isSinglePlayerPuzzle = (game ? (game.category.toLowerCase() === 'puzzle' && !game.multiplayer) : false) ||
    ['arrow-puzzle', 'color-sort', 'water-sort', '2048', 'unblock-me', 'unblock-traffic', 'pipe-connect'].includes(gameSlug)

  if (!mounted) return null

  if (isSinglePlayerPuzzle) {
    return <SinglePlayerXPModal data={data} onClose={onClose} />
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.88)',
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
        .trophy-bounce-animation {
          animation: trophy-bounce 2s ease-in-out infinite;
        }
        .skull-shake-animation {
          animation: skull-shake 1.2s ease-in-out;
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
          width: '100%',
          maxWidth: 480,
          maxHeight: '94dvh',
          overflowY: 'auto',
          background: currentOutcome.bg,
          border: currentOutcome.border,
          padding: 'clamp(1.25rem, 5vw, 2.25rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: `0 20px 50px rgba(0, 0, 0, 0.65), ${currentOutcome.glow}`,
          borderRadius: 24,
          position: 'relative',
          zIndex: 100002,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
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

        {/* Modal Header: Result Emoji & Title */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 950,
              color: currentOutcome.text,
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span>{currentOutcome.emoji}</span>
            <span>{currentOutcome.title.toUpperCase()}</span>
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'hsl(220 10% 50%)', marginTop: '0.3rem' }}>
            Finished playing {gameSlug.replace('-', ' ')}
          </p>
        </div>

        {/* Rewards Summary Strip */}
        <div
          style={{
            background: 'hsl(222 20% 7% / 0.7)',
            borderRadius: 18,
            border: '1px solid hsl(220 15% 16%)',
            padding: '1.25rem',
            display: 'flex',
            position: 'relative',
            zIndex: 1,
            gap: '0.5rem',
          }}
        >
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>
              +{xpDisplay}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>XP Earned</div>
          </div>
          {coinsGained > 0 && (
            <div style={{ flex: 1, borderLeft: '1px solid hsl(220 15% 16%)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>
                +{coinsDisplay}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>Coins Won</div>
            </div>
          )}
          {currentStreak > 0 && (
            <div style={{ flex: 1, borderLeft: '1px solid hsl(220 15% 16%)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(38 95% 60%)' }}>
                🔥 {currentStreak}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>Streak</div>
            </div>
          )}
        </div>

        {/* Level Up Celebration State */}
        {celebrateLevelUp && (
          <div
            className="animate-slideUp"
            style={{
              background: 'linear-gradient(135deg, hsl(270 80% 60% / 0.22), hsl(220 100% 60% / 0.22))',
              border: '1px solid hsl(270 80% 50% / 0.5)',
              borderRadius: 16,
              padding: '1rem 0.5rem',
              textAlign: 'center',
              boxShadow: 'var(--shadow-glow-primary)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.15rem', color: 'white' }}>🎉 LEVEL UP! 🎉</div>
            <div style={{ fontSize: '0.85rem', color: 'hsl(220 10% 85%)' }}>
              You reached <strong style={{ color: 'hsl(270 80% 70%)' }}>Level {levelDisplay}</strong>!
            </div>
          </div>
        )}

        {/* Level Progress Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
            <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level {levelDisplay}</span>
            <span style={{ fontWeight: 700, color: 'hsl(220 100% 75%)' }}>
              {Math.max(0, (levelDisplay === oldLevel ? oldXP : newXP) - xpRequiredForLevel(levelDisplay))} / {xpForNextLevel(levelDisplay)} XP ({barPercent}%)
            </span>
            <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level {levelDisplay + 1}</span>
          </div>
          <div className="xp-bar" style={{ height: 10, background: 'hsl(220 20% 9%)', borderRadius: 99 }}>
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
          {/* Next Level Unlock Preview */}
          <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', background: 'hsl(220 20% 7% / 0.5)', padding: '0.5rem 0.75rem', borderRadius: 10, border: '1px dashed hsl(220 15% 15%)', textAlign: 'left', marginTop: '0.25rem' }}>
            <strong style={{ color: 'hsl(270 80% 65%)', display: 'block', marginBottom: '0.35rem' }}>🎁 Reward Preview: Next Level Unlocks:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {['Coins', 'Badge', 'Achievement Progress'].map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    background: 'hsl(220 20% 12%)',
                    color: 'hsl(220 100% 80%)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 6,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    border: '1px solid hsl(220 15% 18%)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>



        {/* Next Achievement Progress */}
        {nextAchievement && unlockedAchievements.length === 0 && (
          <div
            style={{
              background: 'hsl(222 20% 11% / 0.4)',
              borderRadius: 12,
              border: '1px solid hsl(220 15% 18%)',
              padding: '0.75rem 1rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
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

        {/* Offline Mode Banner or Guest Warning Banner */}
        {metadata?.offline ? (
          <div
            style={{
              background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.08), hsl(38 95% 55% / 0.08))',
              border: '1px solid hsl(38 95% 50% / 0.25)',
              borderRadius: 16,
              padding: '0.85rem 1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 900, color: 'hsl(38 95% 65%)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Offline Session
            </div>
            <div style={{ fontSize: '0.8rem', color: 'white', fontWeight: 700, margin: '0.2rem 0' }}>
              You earned:<br />
              <span style={{ color: 'hsl(220 100% 70%)', fontSize: '0.95rem' }}>+{xpGained} XP</span><br />
              <span style={{ color: 'hsl(45 100% 55%)', fontSize: '0.95rem' }}>+{coinsGained} Coins</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 65%)', lineHeight: 1.4, margin: 0 }}>
              Connect to the internet to save your progress.
            </p>
          </div>
        ) : isGuest ? (
          <div
            className="animate-pulse-glow"
            style={{
              background: 'linear-gradient(135deg, hsl(0 80% 55% / 0.08), hsl(38 95% 55% / 0.08))',
              border: '1px solid hsl(38 95% 50% / 0.25)',
              borderRadius: 16,
              padding: '0.85rem 1rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'hsl(38 95% 65%)' }}>
              ⚠️ Guest Progress is Not Saved!
            </div>
            <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 65%)', lineHeight: 1.4, margin: 0 }}>
              Register for a free account to sync your XP, keep your {levelDisplay} levels, unlock achievements, and enter global leaderboards!
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose()
                  router.push('/register')
                }}
                style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
              >
                Sign Up
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose()
                  router.push('/login')
                }}
                style={{ fontSize: '0.72rem', padding: '0.35rem 0.65rem' }}
              >
                Sign In
              </button>
            </div>
          </div>
        ) : null}

        {/* Actions Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => onClose('replay')}
              style={{ flex: 1, borderRadius: 12 }}
              id="modal-replay-btn"
            >
              Play Again
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleBackToDashboard}
              style={{ flex: 1, borderRadius: 12 }}
              id="modal-dashboard-btn"
            >
              Dashboard
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleNextGame}
            style={{
              width: '100%',
              borderRadius: 12,
              background: 'linear-gradient(135deg, hsl(220 100% 60% / 0.1), hsl(270 80% 60% / 0.1))',
              borderColor: 'hsl(220 100% 60% / 0.25)',
              color: 'hsl(220 100% 80%)',
            }}
            id="modal-nextgame-btn"
          >
            Next Game: {nextGame.name}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
