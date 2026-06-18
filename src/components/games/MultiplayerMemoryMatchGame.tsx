'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHeader from './MultiplayerHeader'
import MatchReactions from './MatchReactions'

function playTurnNotificationSound() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, ctx.currentTime) // E5 note, clean beep
    
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (e) {
    console.warn('[SOUND ERROR]', e)
  }
}

interface Player {
  userId: string
  username: string
  avatarUrl?: string | null
  level?: number
  status?: string
}

interface Props {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

export default function MultiplayerMemoryMatchGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const wasMyTurnRef = useRef(false)

  const gameState = session.gameState || {}
  const { cards = [], flippedIndices = [], playerScores = {}, currentTurn, replayVotes = {}, gridSize = '4x4' } = gameState

  // Trigger sound when turn switches to Me
  useEffect(() => {
    const isMyTurn = currentTurn === currentUserId
    if (isMyTurn && !wasMyTurnRef.current && session.status === 'PLAYING') {
      playTurnNotificationSound()
    }
    wasMyTurnRef.current = isMyTurn
  }, [currentTurn, currentUserId, session.status])

  // Reset submit state on any official state updates
  useEffect(() => {
    setIsSubmitting(false)
  }, [cards, currentTurn, session.status])

  const handleCardClick = (cardIndex: number) => {
    if (session.status === 'FINISHED' || isSubmitting) return
    
    if (currentTurn !== currentUserId) {
      addToast('warning', 'Not Your Turn', 'Please wait for your opponent to play.')
      return
    }

    const card = cards[cardIndex]
    if (!card || card.isMatched || card.isFlipped) {
      return // Already revealed
    }

    if (flippedIndices.length >= 2) {
      return // Wait for server evaluation to complete
    }

    if (!socket) return

    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { cardIndex } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        console.error('[CLIENT handleCardClick ERROR]', res.error)
        addToast('error', 'Flip Error', res.error)
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

  // Layout sizing
  const columnsCount = gridSize === '4x4' ? 4 : 5
  const gridTemplate = `repeat(${columnsCount}, 1fr)`
  const cardEmojiSize = gridSize === '4x4' ? 'clamp(1.2rem, 5.5vw, 2.2rem)' : 'clamp(0.8rem, 3.8vw, 1.6rem)'

  const isPlayer = players.slice(0, 2).some(p => p.userId === currentUserId)
  const isSpectator = !isPlayer

  const activePlayers = players.slice(0, 2)
  const isFinished = session.status === 'FINISHED'
  const winnerId = session.winnerId
  const myScore = playerScores[currentUserId] || 0
  
  const opponent = activePlayers.find(p => p.userId !== currentUserId)
  const opponentScore = opponent ? playerScores[opponent.userId] || 0 : 0

  const getWinnerMessage = () => {
    if (winnerId === 'DRAW') return 'It is a tie game! 🤝'
    if (winnerId === currentUserId) return '🏆 You win the match!'
    const winnerName = players.find(p => p.userId === winnerId)?.username || 'Opponent'
    return `🏆 ${winnerName} wins the match!`
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: 'min(100%, 72vh, 500px)',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}
      id="multiplayer-memory-game"
    >
      <style>{`
        @keyframes trophy-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 15px hsl(45 100% 50% / 0.5);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 25px hsl(45 100% 60% / 0.8);
          }
        }
      `}</style>

      {/* Shared Presence and score header */}
      <MultiplayerHeader
        players={players}
        currentUserId={currentUserId}
        currentTurn={currentTurn}
        turnExpiration={gameState.turnExpiration}
        scores={playerScores}
        gameFinished={isFinished}
      />

      {/* Main Card Grid */}
      <div
        className="card glass"
        style={{
          padding: '10px',
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '8px',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          aspectRatio: '1',
          width: '100%',
          backgroundColor: 'hsl(222 20% 7%)',
          position: 'relative'
        }}
        id="multiplayer-memory-board"
      >
        {cards.map((card: any, cardIndex: number) => {
          const isRevealed = card.isFlipped || card.isMatched
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(cardIndex)}
              id={`multiplayer-memory-card-${cardIndex}`}
              style={{
                width: '100%',
                height: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                cursor: isRevealed || isSpectator || isFinished || isSubmitting ? 'default' : 'pointer',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              {/* Card Back */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, hsl(220 100% 45%), hsl(270 80% 45%))',
                  border: '1px solid hsl(220 100% 60% / 0.3)',
                  boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  backfaceVisibility: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `calc(${cardEmojiSize} * 1.1)`,
                  color: 'white',
                }}
              >
                ❓
              </div>

              {/* Card Front */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: card.isMatched ? 'hsl(220 20% 8%)' : 'hsl(220 20% 16%)',
                  border: card.isMatched ? '1px solid hsl(220 20% 12%)' : '1px solid hsl(220 15% 24%)',
                  borderRadius: '8px',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cardEmojiSize,
                  opacity: card.isMatched ? 0.45 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                {card.emoji}
              </div>
            </div>
          )
        })}
      </div>

      {/* Finished Overlay / Status details */}
      {isFinished && (
        <div
          className="card glass text-center"
          style={{
            padding: '1.5rem',
            borderRadius: 16,
            border: '1px solid hsl(45 100% 45% / 0.3)',
            background: 'linear-gradient(135deg, hsl(222 20% 8%), hsl(45 100% 50% / 0.03))',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center'
          }}
          id="multiplayer-memory-gameover-overlay"
        >
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>
            {getWinnerMessage()}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
            <div>Your score: <strong style={{ color: 'white' }}>{myScore}</strong></div>
            <div style={{ borderLeft: '1px solid hsl(220 15% 20%)', paddingLeft: '1rem' }}>
              Opponent score: <strong style={{ color: 'white' }}>{opponentScore}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.25rem' }}>
            {!isSpectator && (
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 12 }}
                disabled={replayVotes[currentUserId] || isSubmitting}
                onClick={handlePlayAgain}
                id="memory-play-again-btn"
              >
                {replayVotes[currentUserId] ? 'Voted!' : 'Play Again'}
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ flex: isSpectator ? 1 : 1, borderRadius: 12 }}
              onClick={onLeave}
              id="memory-leave-btn"
            >
              Leave Room
            </button>
          </div>

          {Object.keys(replayVotes).length > 0 && !replayVotes[currentUserId] && (
            <div style={{ fontSize: '0.75rem', color: 'hsl(45 100% 55%)', animation: 'pulse 1.5s infinite' }}>
              Opponent wants to play again! Click Play Again to restart.
            </div>
          )}
        </div>
      )}

      {/* Floating emoji reactions */}
      {session.status === 'PLAYING' && (
        <MatchReactions
          socket={socket}
          roomCode={roomCode}
          currentUserId={currentUserId}
          players={players}
        />
      )}
    </div>
  )
}
