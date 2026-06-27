'use client'

import React, { useState, useEffect } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MatchReactions from './MatchReactions'

type PlayerSymbol = 'X' | 'O'
type BoardState = (PlayerSymbol | null)[]

interface Player {
  userId: string
  username: string
}

interface Props {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

const ROWS = 6
const COLS = 7

// Web Audio API Synthesis Helper
function playSynthSound(type: 'click' | 'drop' | 'win' | 'draw' | 'rematch') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    if (type === 'click') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'drop') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(350, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'win') {
      const notes = [261.63, 329.63, 392.00, 523.25]
      notes.forEach((freq, idx) => {
        const oscNode = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscNode.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscNode.type = 'sine'
        oscNode.frequency.setValueAtTime(freq, now + idx * 0.1)
        gainNode.gain.setValueAtTime(0.2, now + idx * 0.1)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.25)

        oscNode.start(now + idx * 0.1)
        oscNode.stop(now + idx * 0.1 + 0.3)
      })
    } else if (type === 'draw') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, now)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.45)
    } else if (type === 'rematch') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch (err) {
    console.warn('[AUDIO SYNTH FAILED]', err)
  }
}

export default function MultiplayerFourInARowGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const gameState = session.gameState || {}
  const { board = Array(42).fill(null), currentTurn, replayVotes = {}, winningLine = [], turnExpiration, winnerId } = gameState

  // Local state to track differences and animate disc drops
  const [prevBoard, setPrevBoard] = useState<BoardState>(board)
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  // Determine player symbols and identities
  const activePlayers = players.slice(0, 2)
  const activePlayerIds = activePlayers.map(p => p.userId)
  const isSpectator = !activePlayerIds.includes(currentUserId)
  const isP1 = activePlayerIds[0] === currentUserId
  const mySymbol = isP1 ? 'X' : 'O'
  const opponentUserId = activePlayerIds.find(id => id !== currentUserId) || ''
  const isFinished = session.status === 'FINISHED'

  const getUsername = (uid: string) => {
    const p = players.find(player => player.userId === uid)
    return p ? p.username : 'Player'
  }

  // Detect board updates to play sound and set last dropped cell
  useEffect(() => {
    let diffIndex = -1
    for (let i = 0; i < 42; i++) {
      if (board[i] !== prevBoard[i] && board[i] !== null) {
        diffIndex = i
        break
      }
    }
    if (diffIndex !== -1) {
      setLastMoveIndex(diffIndex)
      playSynthSound('drop')
    }
    setPrevBoard(board)
    setIsSubmitting(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board])

  // Play win/draw sound when game transitions to FINISHED
  useEffect(() => {
    if (isFinished) {
      if (winnerId === 'DRAW') {
        playSynthSound('draw')
      } else {
        playSynthSound('win')
      }
    }
  }, [isFinished, winnerId])

  // Turn Timer countdown effect
  useEffect(() => {
    if (!turnExpiration || isFinished) {
      setTimeLeft(null)
      return
    }

    const calculateTimeLeft = () => {
      const expirationTime = new Date(turnExpiration).getTime()
      const diff = Math.max(0, Math.ceil((expirationTime - Date.now()) / 1000))
      setTimeLeft(diff)
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [turnExpiration, isFinished])

  // Helper to find lowest empty row in col
  const getLowestRowInCol = (col: number): number => {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r * COLS + col] === null) return r
    }
    return -1
  }

  // Submit drop action
  const handleDropDisc = (col: number) => {
    if (isSpectator) return
    if (isFinished || isSubmitting) return
    if (currentTurn !== currentUserId) {
      addToast('warning', 'Not Your Turn', 'Please wait for your opponent to make their move.')
      return
    }

    const row = getLowestRowInCol(col)
    if (row === -1) {
      addToast('error', 'Column Full', 'This column is already completely full.')
      return
    }

    if (!socket) return

    setIsSubmitting(true)

    socket.emit('submit-move', { roomCode, move: { column: col } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        console.error('[CLIENT handleDropDisc ERROR]', res.error)
        addToast('error', 'Move Error', res.error)
      }
    })
  }

  const handlePlayAgain = () => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    playSynthSound('click')
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Replay Error', res.error)
      }
    })
  }

  // Winning line coordinates for SVG line drawing
  const getLineCoordinates = () => {
    if (!isFinished || !winningLine || winningLine.length < 4) return null
    const [i1, , , i4] = winningLine

    const r1 = Math.floor(i1 / COLS)
    const c1 = i1 % COLS
    const r2 = Math.floor(i4 / COLS)
    const c2 = i4 % COLS

    const x1 = `${(c1 * 100) / COLS + 50 / COLS}%`
    const y1 = `${(r1 * 100) / ROWS + 50 / ROWS}%`
    const x2 = `${(c2 * 100) / COLS + 50 / COLS}%`
    const y2 = `${(r2 * 100) / ROWS + 50 / ROWS}%`

    return { x1, y1, x2, y2 }
  }

  const lineCoords = getLineCoordinates()

  const isMyTurn = currentTurn === currentUserId
  let turnIcon = '❌'
  let turnText = isMyTurn ? 'Your Turn' : `${getUsername(currentTurn)}'s Turn`
  let turnColor = isMyTurn ? 'hsl(220 100% 65%)' : 'hsl(270 80% 65%)'
  let turnBg = isMyTurn ? 'hsl(220 100% 50% / 0.1)' : 'hsl(270 80% 50% / 0.1)'
  let turnBorder = isMyTurn ? 'hsl(220 100% 50% / 0.3)' : 'hsl(270 80% 50% / 0.3)'

  if (isSpectator) {
    turnIcon = '👁️'
    turnText = `Spectating Match: ${getUsername(currentTurn)}'s Turn`
    turnColor = 'hsl(142 70% 50%)'
    turnBg = 'hsl(142 70% 50% / 0.1)'
    turnBorder = 'hsl(142 70% 50% / 0.3)'
  } else if (isFinished) {
    if (winnerId === 'DRAW' || !winnerId) {
      turnIcon = '🤝'
      turnText = "It's a Tie!"
      turnColor = 'hsl(45 100% 55%)'
      turnBg = 'hsl(45 100% 50% / 0.1)'
      turnBorder = 'hsl(45 100% 50% / 0.3)'
    } else {
      const didIWin = winnerId === currentUserId
      turnIcon = '🏆'
      turnText = didIWin ? 'You Won!' : `${getUsername(winnerId)} Won!`
      turnColor = didIWin ? 'hsl(220 100% 65%)' : 'hsl(270 80% 65%)'
      turnBg = didIWin ? 'hsl(220 100% 50% / 0.15)' : 'hsl(270 80% 50% / 0.15)'
      turnBorder = didIWin ? 'hsl(220 100% 50% / 0.4)' : 'hsl(270 80% 50% / 0.4)'
    }
  }

  return (
    <div style={{ maxWidth: 450, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Scoreboard HUD */}
      {!isSpectator && (
        <div className="card glass" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center', borderRadius: 16 }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(355 85% 55%)' }}>🔴</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
              You (Red)
            </div>
          </div>
          <div style={{ borderLeft: '1px solid hsl(var(--border-subtle))', paddingLeft: '1.5rem' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(45 95% 50%)' }}>🟡</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
              {getUsername(opponentUserId)} (Yellow)
            </div>
          </div>
        </div>
      )}

      {/* Turn Indicator HUD Banner */}
      <div id="four-turn-banner" style={{
        textAlign: 'center',
        fontWeight: 900,
        fontSize: '1.05rem',
        color: turnColor,
        backgroundColor: turnBg,
        border: `1px solid ${turnBorder}`,
        padding: '0.65rem 1.25rem',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        boxShadow: `0 0 15px ${turnColor}22`,
        textShadow: `0 0 8px ${turnColor}44`,
        animation: !isFinished ? 'pulse-slow 2s infinite ease-in-out' : 'none',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        position: 'relative'
      }}>
        <span>{turnIcon}</span>
        <span>{turnText}</span>
        {timeLeft !== null && timeLeft > 0 && (
          <span style={{
            position: 'absolute',
            right: '12px',
            background: timeLeft < 10 ? 'hsl(355 100% 50% / 0.2)' : 'hsl(220 15% 15%)',
            border: `1px solid ${timeLeft < 10 ? 'hsl(355 100% 50% / 0.5)' : 'hsl(220 15% 25%)'}`,
            color: timeLeft < 10 ? 'hsl(355 100% 60%)' : 'hsl(220 10% 80%)',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800
          }}>
            {timeLeft}s
          </span>
        )}
      </div>

      {/* Drop Columns arrow headers */}
      {!isFinished && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', padding: '0 0.5rem' }}>
          {Array(7).fill(null).map((_, col) => {
            const isFull = getLowestRowInCol(col) === -1
            return (
              <button
                key={col}
                disabled={isFull || isSubmitting || !isMyTurn || isSpectator}
                onMouseEnter={() => !isFull && setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => { setHoverCol(null); handleDropDisc(col) }}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: hoverCol === col
                    ? (mySymbol === 'X' ? 'hsl(355 85% 55% / 0.2)' : 'hsl(45 95% 50% / 0.2)')
                    : 'hsl(220 20% 12% / 0.4)',
                  cursor: isFull || !isMyTurn || isSpectator ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  color: hoverCol === col
                    ? (mySymbol === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)')
                    : 'hsl(220 10% 40%)',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                ▼
              </button>
            )
          })}
        </div>
      )}

      {/* Connect Four grid board */}
      <div
        className="card glass"
        style={{
          padding: '0.75rem',
          borderRadius: 24,
          backgroundColor: 'hsl(222 30% 10% / 0.85)',
          border: '1px solid hsl(220 20% 18%)',
          position: 'relative',
          aspectRatio: '7 / 6',
          width: '100%'
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          gap: '0.4rem',
          height: '100%',
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}>
          {board.map((cell, idx) => {
            const isWinningCell = winningLine.includes(idx)
            const isLastDropped = lastMoveIndex === idx

            return (
              <div
                key={idx}
                style={{
                  borderRadius: '50%',
                  aspectRatio: '1 / 1',
                  background: 'hsl(222 20% 6%)',
                  border: '1px solid hsl(220 15% 15%)',
                  position: 'relative',
                  overflow: 'visible',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6)'
                }}
              >
                {cell && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '4%',
                      borderRadius: '50%',
                      background: cell === 'X'
                        ? 'radial-gradient(circle at 35% 35%, hsl(355 90% 60%), hsl(355 80% 45%))'
                        : 'radial-gradient(circle at 35% 35%, hsl(45 95% 58%), hsl(45 95% 42%))',
                      boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.4)',
                      animation: isWinningCell
                        ? 'winPulse 1.2s infinite ease-in-out'
                        : isLastDropped
                          ? 'discDrop 0.45s cubic-bezier(0.25, 1, 0.5, 1.2) forwards'
                          : 'none',
                      '--glow-color': cell === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)'
                    } as React.CSSProperties}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Winning line highlight overlay */}
        {isFinished && lineCoords && (
          <svg
            style={{
              position: 'absolute',
              inset: '0.75rem',
              width: 'calc(100% - 1.5rem)',
              height: 'calc(100% - 1.5rem)',
              pointerEvents: 'none',
              zIndex: 2
            }}
          >
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              className="winning-line-glowing"
            />
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={winnerId === activePlayerIds[0] ? 'hsl(355 95% 60%)' : 'hsl(45 95% 50%)'}
              strokeWidth="3"
              strokeLinecap="round"
              className="winning-line-base"
            />
          </svg>
        )}
      </div>

      {/* Finished Game Overlay / Controls */}
      {isFinished ? (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '1.5rem', marginTop: '0.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            {winnerId === currentUserId ? '🏆 You Won!' : winnerId === 'DRAW' ? "🤝 Match Tied!" : isSpectator ? '🏁 Match Over' : '💀 You Lost'}
          </h3>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {winnerId === 'DRAW' ? 'Board is fully completed.' : `Winner: ${getUsername(winnerId)}`}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              onClick={onLeave}
              style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
            >
              Leave Room
            </button>
            {!isSpectator && (
              <button
                className="btn btn-primary"
                id="multiplayer-replay-btn"
                disabled={replayVotes[currentUserId] || isSubmitting}
                onClick={handlePlayAgain}
                style={{ flex: 2, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
              >
                {replayVotes[currentUserId] ? '⏳ Waiting...' : '🔄 Play Again'}
              </button>
            )}
          </div>
          {!isSpectator && replayVotes[opponentUserId] && !replayVotes[currentUserId] && (
            <p style={{ color: 'hsl(var(--brand-secondary))', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem' }}>
              Opponent wants to play again!
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
          <button
            className="btn btn-secondary"
            style={{ width: '100%', borderRadius: 12 }}
            onClick={onLeave}
          >
            🏳️ Leave Match
          </button>
        </div>
      )}

      {/* In-Game Reactions */}
      <MatchReactions
        socket={socket}
        roomCode={roomCode}
        currentUserId={currentUserId}
        players={players}
      />

      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.75; }
        }

        @keyframes discDrop {
          0% { transform: translateY(-380px); }
          75% { transform: translateY(5px); }
          90% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }

        @keyframes winPulse {
          0% {
            box-shadow: 0 0 10px #fff, 0 0 20px var(--glow-color);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 15px #fff, 0 0 35px var(--glow-color);
            transform: scale(1.08);
          }
          100% {
            box-shadow: 0 0 10px #fff, 0 0 20px var(--glow-color);
            transform: scale(1);
          }
        }

        .winning-line-glowing {
          opacity: 0.8;
          filter: drop-shadow(0 0 6px #fff);
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: drawLine 0.5s ease-out forwards;
        }

        .winning-line-base {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: drawLine 0.5s ease-out forwards;
        }

        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}
