'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { GameResultPayload } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress, xpRequiredForLevel, xpForNextLevel } from '@/lib/xpUtils'

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

interface Props {
  data: GameResultPayload
  onClose: (action?: 'replay' | 'next') => void
}

export default function SinglePlayerXPModal({ data, onClose }: Props) {
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
    unlockedAchievements,
    isGuest,
    highScore = 0,
    metadata = {}
  } = data

  // Extract game specific metadata with fallbacks
  const gameMetadata = metadata?.gameMetadata || {}
  const currentLvl = gameMetadata?.level ?? 1
  const moves = gameMetadata?.moves ?? 0
  const timeSecs = gameMetadata?.timeSecs ?? 0
  const starsCount = gameMetadata?.stars ?? (result === 'win' ? 3 : 0)

  // Local storage best time tracking
  const bestTimeKey = `gamehub_${gameSlug}_level_${currentLvl}_best_time`
  const [personalBest, setPersonalBest] = useState<number | null>(null)
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false)

  useEffect(() => {
    if (result !== 'win') return
    const saved = localStorage.getItem(bestTimeKey)
    const currentBest = saved ? parseInt(saved, 10) : null

    if (currentBest === null || timeSecs < currentBest) {
      localStorage.setItem(bestTimeKey, timeSecs.toString())
      setPersonalBest(timeSecs)
      if (currentBest !== null) {
        setIsNewPersonalBest(true)
      }
    } else {
      setPersonalBest(currentBest)
    }
  }, [gameSlug, currentLvl, timeSecs, result])

  const oldProg = getLevelProgress(oldXP)
  const newProg = getLevelProgress(newXP)

  const [barPercent, setBarPercent] = useState(oldProg.progressPercent)
  const [levelDisplay, setLevelDisplay] = useState(oldLevel)
  const [celebrateLevelUp, setCelebrateLevelUp] = useState(false)

  const [xpDisplay, setXpDisplay] = useState(0)
  const [coinsDisplay, setCoinsDisplay] = useState(0)

  // Count up animation
  useEffect(() => {
    const duration = 800
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

  // Level progress bar fill animation
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

  // Confetti on win
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
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.05 + 0.02,
      tiltAngle: 0,
      speed: Math.random() * 2.5 + 1.5,
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

  const starText = {
    3: 'Excellent!',
    2: 'Good Job!',
    1: 'Completed!',
    0: 'Try Again!'
  }[starsCount as 0 | 1 | 2 | 3] || 'Completed!'

  if (!mounted) return null

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
      className="animate-fadeIn"
      id="single-player-modal-backdrop"
    >
      {/* Canvas confetti on victory */}
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
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'linear-gradient(135deg, hsl(222 20% 9% / 0.95), hsl(222 18% 13% / 0.95))',
          border: '1px solid hsl(220 100% 60% / 0.25)',
          padding: '2rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px hsl(220 100% 60% / 0.1)',
          borderRadius: 24,
          position: 'relative',
          zIndex: 100002,
          textAlign: 'center',
        }}
        id="single-player-modal-body"
      >
        {/* Keyframe animations injection — active stars use globals.css star-pop-bounce; inactive use a simple fade-in at 25% opacity */}
        <style>{`
          @keyframes star-fade-in {
            0% { transform: scale(0); opacity: 0; }
            100% { transform: scale(1); opacity: 0.25; }
          }
        `}</style>

        {/* Level Up Celebration Glow */}
        {celebrateLevelUp && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, hsl(270 80% 60% / 0.18) 0%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}

              {/* Scoreboard Header & Layout */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: 950,
              color: 'hsl(45 100% 60%)',
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
              margin: 0,
              textShadow: '0 0 20px rgba(251, 191, 36, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            id="sp-modal-title"
          >
            <span>🏆</span>
            <span>SESSION COMPLETE</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 55%)', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {gameSlug.replace('-', ' ')} • LEVEL {currentLvl}
          </p>
        </div>

        {isNewPersonalBest && (
          <div
            style={{
              display: 'inline-flex',
              alignSelf: 'center',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'linear-gradient(90deg, hsl(45 100% 55%), hsl(38 95% 45%))',
              color: 'black',
              fontWeight: 900,
              fontSize: '0.7rem',
              padding: '4px 14px',
              borderRadius: '9999px',
              boxShadow: '0 4px 14px rgba(230, 170, 0, 0.45)',
              animation: 'pulse-pb 1s ease-in-out infinite',
              letterSpacing: '0.04em',
              margin: '0 auto',
            }}
            id="new-personal-best-badge"
          >
            🏆 <span style={{ color: 'black' }}>NEW PERSONAL BEST</span>
          </div>
        )}

        {/* Scoreboard stats details */}
        <div
          style={{
            background: 'hsl(222 20% 7% / 0.8)',
            border: '1.5px solid hsl(220 15% 20%)',
            borderRadius: 20,
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            position: 'relative',
            zIndex: 1,
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
          }}
          id="sp-modal-stats"
        >
          {/* Main Score Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(220 15% 16%)', paddingBottom: '12px' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'hsl(220 10% 60%)', textTransform: 'uppercase' }}>Score</span>
            <span style={{ fontSize: '2rem', fontWeight: 950, color: '#fbbf24', fontFamily: 'monospace' }} id="modal-session-score">
              {(metadata?.score ?? highScore).toLocaleString()}
            </span>
          </div>

          {/* Dynamic Details Rows */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', paddingTop: '4px', textAlign: 'left' }}>
            {/* 1. Words Found (Word Wizard) */}
            {gameSlug === 'word-wizard' && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Words Found</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-words-found">
                  {gameMetadata.wordsFound ?? 0}
                </div>
              </div>
            )}

            {/* 2. Lines Cleared (Neon Tetris, Block Blast) */}
            {(gameSlug === 'neon-tetris' || gameSlug === 'block-blast') && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Lines Cleared</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-lines-cleared">
                  {gameMetadata.linesCleared ?? 0}
                </div>
              </div>
            )}

            {/* 3. Best Combo (Word Wizard, Neon Tetris, Block Blast) */}
            {(gameSlug === 'word-wizard' || gameSlug === 'neon-tetris' || gameSlug === 'block-blast') && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Best Combo</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#db2777', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-best-combo">
                  {gameMetadata.maxCombo ? `x${gameMetadata.maxCombo}` : 'x0'}
                </div>
              </div>
            )}

            {/* 4. Moves (Arrow Puzzle, Color Sort, Unblock Traffic, Water Connect etc.) */}
            {moves > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Moves</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-moves">
                  {moves}
                </div>
              </div>
            )}

            {/* 5. Time (all puzzle games) */}
            {timeSecs > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Time</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-time">
                  {timeSecs}s
                </div>
              </div>
            )}

            {/* 6. Best Time (personal best) */}
            {result === 'win' && personalBest !== null && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Best Time</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(45 100% 55%)', fontFamily: 'monospace', marginTop: '2px' }} id="modal-stat-best-time">
                  {personalBest}s
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rewards Row */}
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
        </div>

        {/* Level Progress */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level {levelDisplay}</span>
            <span style={{ fontWeight: 700, color: 'hsl(220 100% 75%)' }}>
              {Math.max(0, (levelDisplay === oldLevel ? oldXP : newXP) - xpRequiredForLevel(levelDisplay))} / {xpForNextLevel(levelDisplay)} XP ({barPercent}%)
            </span>
          </div>
          <div style={{ height: 8, background: 'hsl(220 20% 8%)', borderRadius: 99 }}>
            <div
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
          <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', background: 'hsl(220 20% 7% / 0.5)', padding: '0.45rem 0.75rem', borderRadius: 10, border: '1px dashed hsl(220 15% 15%)', textAlign: 'left', marginTop: '0.25rem' }}>
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



        {/* Offline Mode Banner or Guest Warning */}
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
            style={{
              background: 'hsl(0 80% 55% / 0.05)',
              border: '1px solid hsl(38 95% 50% / 0.25)',
              borderRadius: 14,
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 70%)', lineHeight: 1.4, margin: 0 }}>
              Sign up to sync your Level {levelDisplay} stats & achievements!
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose()
                  router.push('/register')
                }}
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
              >
                Sign Up
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onClose()
                  router.push('/login')
                }}
                style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
              >
                Sign In
              </button>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => onClose('replay')}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12, padding: '0.65rem' }}
              id="single-modal-replay-btn"
            >
              🔄 Replay
            </button>
            {result === 'win' && (
              <button
                onClick={() => onClose('next')}
                className="btn btn-primary"
                style={{ flex: 1.2, borderRadius: 12, padding: '0.65rem' }}
                id="single-modal-next-btn"
              >
                ➡️ Next Level
              </button>
            )}
          </div>
          <button
            onClick={() => {
              onClose()
              router.push('/dashboard')
            }}
            className="btn btn-ghost"
            style={{ width: '100%', borderRadius: 12, padding: '0.6rem' }}
            id="single-modal-exit-btn"
          >
            🚪 Exit to Dashboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
