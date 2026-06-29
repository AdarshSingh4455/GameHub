'use client'

import React from 'react'
import GameIcon from '@/components/games/GameIcon'

interface RecoveredSession {
  roomCode: string
  gameSlug: string
  gameDisplayName?: string
  lastActivityAt?: string
}

interface Props {
  session: RecoveredSession
  onContinue: () => void
  onLeave: () => Promise<void> | void
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const GAME_NAMES: Record<string, string> = {
  rps: 'Rock Paper Scissors',
  cricket: 'Hand Cricket',
  'tic-tac-toe': 'Tic-Tac-Toe',
  'dots-boxes': 'Dots & Boxes',
  'four-in-a-row': '4 In A Row',
  memory: 'Memory Match',
  'number-guessing': 'Number Guessing',
  scribble: 'Scribble',
  hangman: 'Hangman',
  'whos-spy': "Who's Spy",
}

export default function SessionRecoveryModal({ session, onContinue, onLeave }: Props) {
  const [isLeaving, setIsLeaving] = React.useState(false)
  const gameName = session.gameDisplayName || GAME_NAMES[session.gameSlug] || session.gameSlug

  const handleLeave = async () => {
    setIsLeaving(true)
    try {
      await onLeave()
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, hsl(222 20% 12%), hsl(222 18% 8%))',
          border: '1px solid hsl(220 15% 22%)',
          borderRadius: 24,
          padding: '2rem',
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'srm-pop 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <style>{`
          @keyframes srm-pop {
            from { opacity: 0; transform: scale(0.88) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Game icon + badge */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              background: 'hsl(222 20% 16%)',
              border: '2px solid hsl(45 100% 55% / 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 24px hsl(45 100% 55% / 0.25)',
            }}
          >
            <GameIcon slug={session.gameSlug} size={48} />
          </div>
          <div
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'hsl(120 70% 45%)',
              border: '2px solid hsl(222 20% 12%)',
              animation: 'pulse 2s infinite',
            }}
          />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>
            Active Match Found
          </h2>
          <p style={{ margin: 0, fontSize: '0.83rem', color: 'hsl(220 10% 60%)', lineHeight: 1.5 }}>
            You have an unfinished match in progress. Would you like to continue where you left off?
          </p>
        </div>

        {/* Session details card */}
        <div
          style={{
            width: '100%',
            background: 'hsl(222 20% 8%)',
            border: '1px solid hsl(220 15% 18%)',
            borderRadius: 14,
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          <DetailRow label="Game" value={gameName} />
          <DetailRow label="Room Code" value={<span style={{ fontFamily: 'monospace', color: 'hsl(220 100% 70%)', fontWeight: 800 }}>{session.roomCode}</span>} />
          {session.lastActivityAt && (
            <DetailRow label="Last Activity" value={timeAgo(session.lastActivityAt)} />
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          <button
            onClick={onContinue}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, hsl(220 100% 55%), hsl(270 80% 60%))',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            id="session-recovery-continue"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Continue Match
          </button>

          <button
            onClick={handleLeave}
            disabled={isLeaving}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: 14,
              border: '1px solid hsl(0 70% 45% / 0.5)',
              background: 'transparent',
              color: 'hsl(0 70% 65%)',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: isLeaving ? 'not-allowed' : 'pointer',
              opacity: isLeaving ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isLeaving) e.currentTarget.style.background = 'hsl(0 70% 45% / 0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            id="session-recovery-leave"
          >
            {isLeaving ? 'Leaving...' : 'Leave Match'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 50%)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', color: 'hsl(220 10% 85%)', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  )
}
