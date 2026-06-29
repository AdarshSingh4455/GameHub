'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RockIllustration, PaperIllustration, ScissorsIllustration } from './RockPaperScissorsAssets'

export type RPSMove = 'rock' | 'paper' | 'scissors'
type AnimPhase = 'idle' | 'slide-in' | 'clash' | 'result' | 'done'

interface Props {
  p1Move: RPSMove
  p2Move: RPSMove
  /** 'p1' | 'p2' | 'draw' */
  winner: 'p1' | 'p2' | 'draw'
  p1Label?: string
  p2Label?: string
  onAnimationComplete?: () => void
  /** If true, clicking anywhere on arena skips to done */
  skippable?: boolean
}

const MOVE_CONFIG: Record<RPSMove, { color: string; glow: string }> = {
  rock:     { color: 'hsl(355 85% 65%)', glow: '0 0 32px hsl(355 85% 55% / 0.75)' },
  paper:    { color: 'hsl(220 100% 68%)', glow: '0 0 32px hsl(220 100% 60% / 0.75)' },
  scissors: { color: 'hsl(45 100% 60%)',  glow: '0 0 32px hsl(45 100% 55% / 0.75)' },
}

const ILLUSTRATIONS: Record<RPSMove, React.FC<{ size: number }>> = {
  rock:     RockIllustration,
  paper:    PaperIllustration,
  scissors: ScissorsIllustration,
}

const MATCHUP_LINES: Record<string, string> = {
  'rock-scissors':     'Rock crushes Scissors!',
  'scissors-paper':    'Scissors cuts Paper!',
  'paper-rock':        'Paper covers Rock!',
  'scissors-rock':     'Rock crushes Scissors!',
  'paper-scissors':    'Scissors cuts Paper!',
  'rock-paper':        'Paper covers Rock!',
  'rock-rock':         "It's a Draw!",
  'paper-paper':       "It's a Draw!",
  'scissors-scissors': "It's a Draw!",
}

export default function RPSBattleArena({
  p1Move,
  p2Move,
  winner,
  p1Label = 'You',
  p2Label = 'Opponent',
  onAnimationComplete,
  skippable = false,
}: Props) {
  const [phase, setPhase] = useState<AnimPhase>('idle')
  const [skipped, setSkipped] = useState(false)
  const timersRef = useRef<NodeJS.Timeout[]>([])

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
    return t
  }

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const skipToEnd = () => {
    if (!skippable || skipped || phase === 'done') return
    setSkipped(true)
    clearTimers()
    setPhase('done')
    onAnimationComplete?.()
  }

  useEffect(() => {
    clearTimers()
    setPhase('idle')
    setSkipped(false)

    addTimer(() => setPhase('slide-in'), 80)
    addTimer(() => setPhase('clash'), 480)
    addTimer(() => setPhase('result'), 800)
    addTimer(() => {
      setPhase('done')
      onAnimationComplete?.()
    }, 1400)

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p1Move, p2Move, winner])

  const isDraw = winner === 'draw'
  const p1Wins = winner === 'p1'
  const p2Wins = winner === 'p2'

  const matchupKey = `${p1Move}-${p2Move}`
  const resultLine = MATCHUP_LINES[matchupKey] || (isDraw ? "It's a Draw!" : '')

  const P1Illus = ILLUSTRATIONS[p1Move]
  const P2Illus = ILLUSTRATIONS[p2Move]

  const p1Cfg = MOVE_CONFIG[p1Move]
  const p2Cfg = MOVE_CONFIG[p2Move]

  // Phase-based animation values
  const getP1Style = (): React.CSSProperties => {
    const base: React.CSSProperties = { transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)' }
    if (phase === 'idle') return { ...base, opacity: 0, transform: 'translateX(-80px) scale(0.7)' }
    if (phase === 'slide-in') return { ...base, opacity: 1, transform: 'translateX(0) scale(1)' }
    if (phase === 'clash') return { ...base, opacity: 1, transform: 'translateX(18px) scale(1.08)', transition: 'all 0.22s ease' }
    if (phase === 'result') {
      if (p1Wins) return { ...base, opacity: 1, transform: 'translateX(0) scale(1.12)', filter: `drop-shadow(${p1Cfg.glow})` }
      if (p2Wins) return { ...base, opacity: 0.35, transform: 'translateX(0) scale(0.88)', filter: 'grayscale(0.7)' }
      return { ...base, opacity: 1, transform: 'translateX(0) scale(1)', filter: 'grayscale(0.3)' }
    }
    return base
  }

  const getP2Style = (): React.CSSProperties => {
    const base: React.CSSProperties = { transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)' }
    if (phase === 'idle') return { ...base, opacity: 0, transform: 'translateX(80px) scale(0.7)' }
    if (phase === 'slide-in') return { ...base, opacity: 1, transform: 'translateX(0) scale(1)' }
    if (phase === 'clash') return { ...base, opacity: 1, transform: 'translateX(-18px) scale(1.08)', transition: 'all 0.22s ease' }
    if (phase === 'result') {
      if (p2Wins) return { ...base, opacity: 1, transform: 'translateX(0) scale(1.12)', filter: `drop-shadow(${p2Cfg.glow})` }
      if (p1Wins) return { ...base, opacity: 0.35, transform: 'translateX(0) scale(0.88)', filter: 'grayscale(0.7)' }
      return { ...base, opacity: 1, transform: 'translateX(0) scale(1)', filter: 'grayscale(0.3)' }
    }
    return base
  }

  const resultVisible = phase === 'result' || phase === 'done'

  return (
    <div
      onClick={skippable ? skipToEnd : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '1.5rem 1rem',
        cursor: skippable && phase !== 'done' ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes rps-clash-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        @keyframes rps-draw-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes rps-result-fadein {
          from { opacity: 0; transform: translateY(8px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rps-winner-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Arena row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          width: '100%',
          animation: phase === 'clash' ? 'rps-clash-shake 0.3s ease' : undefined,
        }}
      >
        {/* P1 side */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <div style={getP1Style()}>
            <P1Illus size={76} />
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: phase === 'result' && p1Wins ? p1Cfg.color : 'hsl(220 10% 55%)',
              transition: 'color 0.3s',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {p1Label}
          </div>
        </div>

        {/* VS divider */}
        <div
          style={{
            fontSize: '1.1rem',
            fontWeight: 900,
            color: phase === 'clash' ? 'hsl(45 100% 55%)' : 'hsl(220 10% 35%)',
            transition: 'color 0.2s',
            minWidth: 28,
            textAlign: 'center',
          }}
        >
          {phase === 'clash' ? '⚡' : 'vs'}
        </div>

        {/* P2 side */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ ...getP2Style(), transform: `${(getP2Style().transform || '')} scaleX(-1)` }}>
            <P2Illus size={76} />
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: phase === 'result' && p2Wins ? p2Cfg.color : 'hsl(220 10% 55%)',
              transition: 'color 0.3s',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {p2Label}
          </div>
        </div>
      </div>

      {/* Result text */}
      <div
        style={{
          minHeight: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {resultVisible && (
          <div
            style={{
              fontSize: '1rem',
              fontWeight: 900,
              color: isDraw ? 'hsl(220 10% 70%)' : winner === 'p1' ? p1Cfg.color : p2Cfg.color,
              animation: 'rps-result-fadein 0.35s ease both',
              textAlign: 'center',
            }}
          >
            {resultLine}
          </div>
        )}
      </div>

      {skippable && phase !== 'done' && (
        <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 35%)', marginTop: '-0.5rem' }}>
          Tap to skip
        </div>
      )}
    </div>
  )
}
