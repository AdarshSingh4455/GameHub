'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHeader from './MultiplayerHeader'
import MatchReactions from './MatchReactions'
import RPSChoiceCard from '@/components/games/RPSChoiceCard'
import RPSBattleArena from '@/components/games/RPSBattleArena'

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
    osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5 note, clean beep
    
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
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

// MOVE_EMOJIS removed

export default function MultiplayerRockPaperScissorsGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const myMoveMadeRef = useRef(false)

  const gameState = session.gameState || {}
  const { round = 1, moves = {}, playerScores = {}, history = [], commentary = [], stage = 'PLAYING', revealRoundResult = false } = gameState

  const isFinished = session.status === 'FINISHED' || stage === 'FINISHED'
  const winnerId = session.winnerId
  
  const activePlayers = players.slice(0, 2)
  const isPlayer = activePlayers.some(p => p.userId === currentUserId)
  const isSpectator = !isPlayer
  const opponent = activePlayers.find(p => p.userId !== currentUserId)
  const opponentId = opponent?.userId || ''

  const myChoice = moves[currentUserId]
  const opponentChoice = moves[opponentId]

  // Play a sound when the round shifts or when it's time to choose
  useEffect(() => {
    if (isPlayer && !isFinished && !myChoice) {
      playTurnNotificationSound()
    }
  }, [round, isFinished, myChoice, isPlayer])

  const handleSelectMove = (choice: 'rock' | 'paper' | 'scissors') => {
    if (isFinished || isSubmitting || isSpectator) return
    if (myChoice) {
      addToast('warning', 'Already Chosen', 'You have already made a choice for this round.')
      return
    }
    if (!socket) return

    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { choice } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Move Error', res.error)
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

  const getWinnerMessage = () => {
    if (winnerId === 'DRAW') return 'It is a tie game! 🤝'
    if (winnerId === currentUserId) return '🏆 You win the match!'
    const winnerName = players.find(p => p.userId === winnerId)?.username || 'Opponent'
    return `🏆 ${winnerName} wins the match!`
  }

  // Display status message
  let statusMessage = 'Make Your Choice!'
  if (isFinished) {
    statusMessage = 'Game Over!'
  } else if (revealRoundResult) {
    statusMessage = 'Showdown!'
  } else if (myChoice && opponentChoice === 'hidden') {
    statusMessage = 'Waiting for opponent...'
  } else if (opponentChoice === 'hidden') {
    statusMessage = 'Opponent has made their move!'
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: 390,
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}
      id="multiplayer-rps-game"
    >
      {/* Shared score and presence header */}
      <MultiplayerHeader
        players={players}
        currentUserId={currentUserId}
        currentTurn={null} // RPS has simultaneous moves, no currentTurn highlight
        turnExpiration={gameState.turnExpiration}
        scores={playerScores}
        gameFinished={isFinished}
      />

      {/* Main Game Interface */}
      <div
        className="card glass"
        style={{
          padding: '1.5rem',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          textAlign: 'center',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'hsl(222 20% 7%)',
        }}
        id="rps-board"
      >
        {!isFinished && !revealRoundResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center', flex: 1 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: '0 0 0.5rem 0' }}>
                {statusMessage}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', margin: 0 }}>Round {round} of 3</p>
            </div>

            {/* Choice selection — premium cards */}
            {isPlayer && !myChoice ? (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {(['rock', 'paper', 'scissors'] as const).map((choice) => (
                  <RPSChoiceCard
                    key={choice}
                    move={choice}
                    disabled={isSubmitting}
                    onClick={() => handleSelectMove(choice)}
                  />
                ))}
              </div>
            ) : isPlayer ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <RPSChoiceCard
                  move={myChoice as 'rock' | 'paper' | 'scissors'}
                  selected={true}
                  disabled={true}
                />
                <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginTop: '0.25rem' }}>
                  Waiting for opponent...
                </div>
              </div>
            ) : (
              <div style={{ color: 'hsl(220 10% 50%)', fontSize: '0.85rem' }}>
                Spectating Round {round}
              </div>
            )}
          </div>
        )}

        {/* Reveal Results with animation */}
        {revealRoundResult && myChoice && opponentChoice && opponentChoice !== 'hidden' && (() => {
          const p1 = myChoice as 'rock' | 'paper' | 'scissors'
          const p2 = opponentChoice as 'rock' | 'paper' | 'scissors'
          const beats: Record<string, string> = { rock: 'scissors', paper: 'rock', scissors: 'paper' }
          const rw = p1 === p2 ? 'draw' : beats[p1] === p2 ? 'p1' : 'p2'
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <RPSBattleArena
                p1Move={p1}
                p2Move={p2}
                winner={rw as 'p1' | 'p2' | 'draw'}
                p1Label="You"
                p2Label={opponent?.username || 'Opponent'}
                skippable={false}
              />
            </div>
          )
        })()}

        {/* GameOver View */}
        {isFinished && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(45 100% 55%)', margin: 0 }}>
                {getWinnerMessage()}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', marginTop: '0.25rem', marginBottom: 0 }}>
                Final Score: {playerScores[currentUserId] || 0} - {opponent ? playerScores[opponent.userId] || 0 : 0}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              {isPlayer && (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, borderRadius: 12 }}
                  disabled={gameState.replayVotes?.[currentUserId] || isSubmitting}
                  onClick={handlePlayAgain}
                  id="rps-play-again-btn"
                >
                  {gameState.replayVotes?.[currentUserId] ? 'Voted!' : 'Play Again'}
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 12 }}
                onClick={onLeave}
                id="rps-leave-btn"
              >
                Leave Room
              </button>
            </div>

            {gameState.replayVotes && Object.keys(gameState.replayVotes).length > 0 && !gameState.replayVotes[currentUserId] && (
              <div style={{ fontSize: '0.75rem', color: 'hsl(45 100% 55%)', animation: 'pulse 1.5s infinite' }}>
                Opponent wants to play again! Click Play Again to restart.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commentary log history list */}
      {commentary.length > 0 && (
        <div
          className="card glass"
          style={{
            padding: '1rem',
            borderRadius: 16,
            maxHeight: 120,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            textAlign: 'left',
            fontSize: '0.75rem',
            background: 'hsl(222 20% 5%)',
            border: '1px solid hsl(220 15% 15%)'
          }}
          id="rps-logs"
        >
          <div style={{ color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
            Round Log History
          </div>
          {commentary.map((log: string, i: number) => (
            <div key={i} style={{ color: i === 0 ? 'white' : 'hsl(220 10% 60%)', lineHeight: 1.3 }}>
              {log}
            </div>
          ))}
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
