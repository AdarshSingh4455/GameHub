'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHeader from './MultiplayerHeader'
import MatchReactions from './MatchReactions'
import { TrophyIcon, UsersIcon, FrownIcon, TimerIcon, PlayIcon, ArrowRightIcon } from '@/components/shared/Icons'

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

export default function MultiplayerNumberGuessingGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  const [playerGuess, setPlayerGuess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const wasMyTurnRef = useRef(false)

  const gameState = session.gameState || {}
  const {
    minBound = 1,
    maxBound = 100,
    currentTurn,
    guessesHistory = [],
    guessFeedback = 'Guess a secret number between 1 and 100!',
    playerScores = {},
    replayVotes = {}
  } = gameState

  // Trigger sound when turn switches to Me
  useEffect(() => {
    const isMyTurn = currentTurn === currentUserId
    if (isMyTurn && !wasMyTurnRef.current && session.status === 'PLAYING') {
      playTurnNotificationSound()
    }
    wasMyTurnRef.current = isMyTurn
  }, [currentTurn, currentUserId, session.status])

  // Reset local guess and submit states on update
  useEffect(() => {
    setPlayerGuess('')
    setIsSubmitting(false)
  }, [currentTurn, session.status])

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (session.status === 'FINISHED' || isSubmitting) return

    if (currentTurn !== currentUserId) {
      addToast('warning', 'Not Your Turn', 'Please wait for your opponent to guess.')
      return
    }

    const guessVal = parseInt(playerGuess, 10)
    if (isNaN(guessVal) || guessVal < minBound || guessVal > maxBound) {
      addToast('warning', 'Invalid Guess', `Please enter a valid number between ${minBound} and ${maxBound}.`)
      return
    }

    if (!socket) return

    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { guess: guessVal } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        console.error('[CLIENT handleGuessSubmit ERROR]', res.error)
        addToast('error', 'Submit Error', res.error)
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

  const isPlayer = players.slice(0, 2).some(p => p.userId === currentUserId)
  const isSpectator = !isPlayer
  const isFinished = session.status === 'FINISHED'
  const winnerId = session.winnerId

  const activePlayers = players.slice(0, 2)

  const getWinnerMessage = () => {
    if (winnerId === 'DRAW') return 'It is a tie game!'
    if (winnerId === currentUserId) return 'You guessed the number! You win!'
    const winnerName = players.find(p => p.userId === winnerId)?.username || 'Opponent'
    return `${winnerName} guessed the number! Opponent wins!`
  }

  // The secret number guessed correctly at the end of the game
  const finalSecretNumber = guessesHistory[0]?.guess ?? 'Unknown'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: 'min(100%, 72vh, 420px)',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}
      id="multiplayer-numguess-game"
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

      {/* Shared Presence and turn header */}
      <MultiplayerHeader
        players={players}
        currentUserId={currentUserId}
        currentTurn={currentTurn}
        turnExpiration={gameState.turnExpiration}
        scores={playerScores}
        gameFinished={isFinished}
      />

      {/* Secret Number Bounds display */}
      <div
        className="card glass"
        style={{
          padding: '1.25rem',
          textAlign: 'center',
          borderRadius: 16,
          background: 'hsl(222 20% 7%)',
          border: '1px solid hsl(220 15% 18%)',
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', textTransform: 'uppercase', fontWeight: 800 }}>
          Secret Number Range
        </span>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{minBound}</span>
          <span style={{ fontSize: '1.1rem', color: 'hsl(220 10% 40%)', fontWeight: 800 }}>to</span>
          <span style={{ fontSize: '2rem', fontWeight: 900, color: 'hsl(0 80% 60%)' }}>{maxBound}</span>
        </div>
      </div>

      {/* Game status label */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: isFinished ? 'hsl(45 100% 55%)' : 'white',
          minHeight: '24px',
        }}
        id="numguess-status-label"
      >
        {isFinished
          ? getWinnerMessage()
          : currentTurn === currentUserId
            ? 'Your Turn: Submit a Guess!'
            : `Waiting for ${players.find(p => p.userId === currentTurn)?.username || 'opponent'}'s guess...`}
      </div>

      {/* Control Panel card */}
      <div
        className="card glass"
        style={{
          padding: '1.25rem',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          background: 'hsl(222 20% 7%)',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.25rem'
        }}
        id="numguess-control-panel"
      >
        {/* Feedback banner */}
        <div
          style={{
            fontSize: '0.9rem',
            color: 'hsl(45 100% 65%)',
            fontWeight: 700,
            textAlign: 'center',
            background: 'hsl(222 20% 5%)',
            padding: '0.75rem',
            borderRadius: 10,
            border: '1px solid hsl(220 15% 20%)',
          }}
          id="numguess-feedback-banner"
        >
          {guessFeedback}
        </div>

        {/* Input box */}
        {!isFinished && !isSpectator && (
          <div style={{ margin: '0.25rem 0' }}>
            {currentTurn === currentUserId ? (
              <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  placeholder={`Guess (${minBound}-${maxBound})`}
                  min={minBound}
                  max={maxBound}
                  value={playerGuess}
                  onChange={(e) => setPlayerGuess(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.8rem',
                    borderRadius: 10,
                    backgroundColor: 'hsl(222 20% 5%)',
                    border: '1px solid hsl(220 15% 22%)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none',
                  }}
                  id="numguess-input-field"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ borderRadius: 10, fontSize: '0.9rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
                  disabled={isSubmitting || !playerGuess}
                  id="numguess-submit-btn"
                >
                  Guess
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '0.5rem', color: 'hsl(220 10% 50%)', fontSize: '0.85rem' }}>
                Opponent is thinking...
              </div>
            )}
          </div>
        )}

        {/* Gameover state */}
        {isFinished && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>
              Secret Number was <span style={{ color: 'hsl(45 100% 55%)' }}>{finalSecretNumber}</span>
            </div>
          </div>
        )}

        {/* Guess History Logs */}
        <div style={{ flex: 1, maxHeight: 110, overflowY: 'auto' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 55%)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Guesses Logs ({guessesHistory.length})
          </div>
          {guessesHistory.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 45%)', fontStyle: 'italic', padding: '0.25rem 0' }}>
              No guesses yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {guessesHistory.map((h: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    backgroundColor: 'hsl(222 20% 5%)',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid hsl(220 15% 15%)'
                  }}
                >
                  <span style={{ color: 'hsl(220 10% 75%)' }}>
                    <strong>{h.by}</strong> guessed {h.guess}
                  </span>
                  <span style={{ color: h.feedback.includes('Correct') ? 'hsl(145 80% 50%)' : 'hsl(45 100% 55%)', fontWeight: 700 }}>
                    {h.feedback}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Finished Overlay Controls */}
      {isFinished && (
        <div
          className="card glass text-center"
          style={{
            padding: '1.25rem',
            borderRadius: 16,
            border: '1px solid hsl(45 100% 45% / 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'center'
          }}
          id="multiplayer-numguess-gameover-overlay"
        >
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            {!isSpectator && (
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 12 }}
                disabled={replayVotes[currentUserId] || isSubmitting}
                onClick={handlePlayAgain}
                id="numguess-play-again-btn"
              >
                {replayVotes[currentUserId] ? 'Voted!' : 'Play Again'}
              </button>
            )}
            <button
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12 }}
              onClick={onLeave}
              id="numguess-leave-btn"
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
      {!isFinished && (
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
