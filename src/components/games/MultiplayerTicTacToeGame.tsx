'use client'

import React, { useState, useEffect } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'

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

export default function MultiplayerTicTacToeGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null)
  
  // Turn Timer State
  const [timeLeft, setTimeLeft] = useState<number | null>(null)

  const gameState = session.gameState || {}
  const { board = Array(9).fill(null), currentTurn, replayVotes = {}, winningLine = [], turnExpiration } = gameState

  // Determine player symbols and identities
  const activePlayers = players.slice(0, 2)
  const activePlayerIds = activePlayers.map(p => p.userId)
  const isSpectator = !activePlayerIds.includes(currentUserId)
  const isP1 = activePlayerIds[0] === currentUserId
  const mySymbol = isP1 ? 'X' : 'O'
  const opponentSymbol = isP1 ? 'O' : 'X'
  const opponentUserId = activePlayerIds.find(id => id !== currentUserId) || ''

  const getUsername = (uid: string) => {
    const p = players.find(player => player.userId === uid)
    return p ? p.username : 'Player'
  }

  // Clear optimistic index and reset submitting state when authoritative server state is received
  useEffect(() => {
    if (optimisticIndex !== null && board[optimisticIndex] !== null) {
      setOptimisticIndex(null)
    }
    setIsSubmitting(false)
  }, [board, optimisticIndex, currentTurn, session.status])

  // Turn Timer countdown effect
  useEffect(() => {
    if (!turnExpiration || session.status === 'FINISHED') {
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
  }, [turnExpiration, session.status])

  const handleCellClick = (index: number) => {
    if (isSpectator) return
    if (session.status === 'FINISHED' || isSubmitting) return
    if (currentTurn !== currentUserId) {
      addToast('warning', 'Not Your Turn', 'Please wait for your opponent to make a move.')
      return
    }
    if (board[index] !== null || optimisticIndex !== null) {
      return // Cell already claimed or move in-flight
    }
    if (!socket) return

    // Optimistically claim cell locally
    setOptimisticIndex(index)
    setIsSubmitting(true)

    socket.emit('submit-move', { roomCode, move: { index } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        console.error('[CLIENT handleCellClick ERROR]', res.error)
        addToast('error', 'Move Error', res.error)
        // Rollback on rejection
        setOptimisticIndex(null)
      }
    })
  }

  const handlePlayAgain = () => {
    if (!socket) return
    setIsSubmitting(true)
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Replay Error', res.error)
      } else {
        addToast('success', 'Vote Registered', 'Waiting for opponent to accept play again.')
      }
    })
  }

  // Active status details
  const isMyTurn = currentTurn === currentUserId
  const isFinished = session.status === 'FINISHED'
  const winnerId = session.winnerId

  let turnIcon = '❌'
  let turnText = isMyTurn ? 'Your Turn' : `${getUsername(currentTurn)}'s Turn`
  let turnColor = isMyTurn ? 'hsl(220 100% 65%)' : 'hsl(270 80% 65%)'
  let turnBg = isMyTurn ? 'hsl(220 100% 50% / 0.1)' : 'hsl(270 80% 50% / 0.1)'
  let turnBorder = isMyTurn ? 'hsl(220 100% 50% / 0.3)' : 'hsl(270 80% 50% / 0.3)'

  if (isSpectator) {
    turnIcon = '👁️'
    turnText = `Spectating match: ${getUsername(currentTurn)}'s Turn`
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
    <div style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Spectator Warning Banner */}
      {isSpectator && (
        <div style={{
          backgroundColor: 'hsl(142 70% 45% / 0.15)',
          border: '1px solid hsl(142 70% 45% / 0.3)',
          borderRadius: 12,
          padding: '0.5rem 1rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'hsl(142 75% 65%)',
          fontWeight: 700
        }}>
          👁️ You are currently spectating this match
        </div>
      )}

      {/* Scoreboard HUD */}
      {!isSpectator && (
        <div className="card glass" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center', borderRadius: 16 }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{mySymbol}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
              You
            </div>
          </div>
          <div style={{ borderLeft: '1px solid hsl(var(--border-subtle))', paddingLeft: '1.5rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(270 80% 65%)' }}>{opponentSymbol}</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
              {getUsername(opponentUserId)}
            </div>
          </div>
        </div>
      )}

      {/* Turn Indicator Banner & Timer */}
      <div id="ttt-turn-banner" style={{
        textAlign: 'center',
        fontWeight: 900,
        fontSize: '1.1rem',
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

      {/* Responsive Board */}
      <div style={{
        background: 'hsl(222 20% 7%)',
        borderRadius: 18,
        border: '1px solid hsl(var(--border-subtle))',
        aspectRatio: '1',
        width: '100%',
        boxSizing: 'border-box',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        padding: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
      }} id="ttt-board-grid">
        {Array(9).fill(null).map((_, i) => {
          const isWinningCell = winningLine.includes(i)
          const dbCell = board[i]
          const isOptimistic = !dbCell && optimisticIndex === i
          const cellValue = dbCell || (isOptimistic ? mySymbol : null)
          const cellColor = cellValue === 'X' ? 'hsl(220 100% 65%)' : 'hsl(270 80% 65%)'
          
          return (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              disabled={isSpectator || cellValue !== null || isFinished || isSubmitting}
              id={`ttt-cell-${i}`}
              style={{
                aspectRatio: '1',
                borderRadius: 12,
                border: isWinningCell 
                  ? '2px solid hsl(45 100% 55%)' 
                  : isOptimistic 
                    ? '2px dashed hsl(210 100% 70% / 0.5)' 
                    : '1px solid hsl(220 15% 22%)',
                background: isWinningCell
                  ? 'linear-gradient(135deg, hsl(45 100% 55% / 0.2), hsl(38 95% 50% / 0.2))'
                  : cellValue
                    ? 'hsl(222 20% 12%)'
                    : 'hsl(222 20% 9%)',
                fontSize: '2.5rem',
                fontWeight: 900,
                color: cellColor,
                cursor: cellValue || isFinished || isSpectator ? 'default' : 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none',
                opacity: isOptimistic ? 0.6 : 1,
                boxShadow: isWinningCell ? '0 0 15px hsl(45 100% 55% / 0.15)' : 'none',
              }}
            >
              {cellValue}
            </button>
          )
        })}
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

      {/* Style overrides */}
      <style jsx global>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.75; }
        }
      `}</style>
    </div>
  )
}
