'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'

interface Player {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
}

interface CricketGameProps {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

export default function MultiplayerHandCricketGame({
  roomCode,
  session,
  players,
  currentUserId,
  onLeave
}: CricketGameProps) {
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const gameState = session.gameState || {}
  const { stage, tossWinnerId, battingUserId, bowlingUserId, innings, runs, wickets, balls, maxOvers, maxWickets, target, moves = {}, history = [], commentary = [], replayVotes = {} } = gameState

  // Helper to map user ID to username
  const getUsername = (uid: string) => {
    const p = players.find(player => player.userId === uid)
    return p ? p.username : 'Player'
  }

  const getPlayerDetails = (uid: string) => {
    return players.find(p => p.userId === uid)
  }

  // Handle Toss Selection
  const handleTossChoice = async (choice: 'BAT' | 'BOWL') => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/multiplayer/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          move: { type: 'toss', choice }
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit toss choice')
      }
    } catch (err: any) {
      addToast('error', 'Toss Error', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Play Ball Selection
  const handlePlayBall = async (number: number) => {
    if (moves[currentUserId] !== undefined) return // Already submitted
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/multiplayer/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          move: { type: 'play', number }
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit move')
      }
    } catch (err: any) {
      addToast('error', 'Play Error', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Vote Play Again
  const handlePlayAgain = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/multiplayer/game/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to vote play again')
      }
      addToast('success', 'Vote Registered', 'Waiting for opponent to accept play again.')
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatOvers = (bCount: number) => {
    const ov = Math.floor(bCount / 6)
    const b = bCount % 6
    return `${ov}.${b}`
  }

  const isMeTossWinner = tossWinnerId === currentUserId
  const isMeBatting = battingUserId === currentUserId
  const isMeBowling = bowlingUserId === currentUserId
  const myMoveSubmitted = moves[currentUserId] !== undefined && moves[currentUserId] !== null

  const opponentUserId = players.find(p => p.userId !== currentUserId)?.userId || ''
  const opponentMoveSubmitted = moves[opponentUserId] !== undefined && moves[opponentUserId] !== null

  // Extract last ball details
  const lastBall = history[0]
  let myLastMove = null
  let opponentLastMove = null
  let lastBallResult = ''

  if (lastBall) {
    const wasMeBatting = (lastBall.innings === 1 && battingUserId === currentUserId) || (lastBall.innings === 2 && battingUserId === currentUserId)
    // Wait, history saves batMove and bowlMove.
    if (wasMeBatting) {
      myLastMove = lastBall.batMove
      opponentLastMove = lastBall.bowlMove
    } else {
      myLastMove = lastBall.bowlMove
      opponentLastMove = lastBall.batMove
    }
    lastBallResult = lastBall.isOut ? '🔴 OUT!' : `🏏 +${lastBall.runs} runs`
  }

  // Render sub-screens based on game stage
  return (
    <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* ── STAGE: TOSS ── */}
      {stage === 'TOSS' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '3rem 2rem', border: '1px solid hsl(var(--brand-primary) / 0.2)' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🪙</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>The Coin Toss</h2>
          
          {isMeTossWinner ? (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: 'hsl(var(--success))', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                🎉 You won the toss! Choose your role:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: 400, margin: '0 auto' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleTossChoice('BAT')}
                  disabled={isSubmitting}
                  style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
                >
                  🏏 Bat First
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleTossChoice('BOWL')}
                  disabled={isSubmitting}
                  style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, hsl(142 70% 45%), hsl(160 80% 45%))' }}
                >
                  🎯 Bowl First
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem', marginBottom: '1.5rem' }}>
                Opponent (<strong style={{ color: 'white' }}>{getUsername(tossWinnerId)}</strong>) won the toss.
              </p>
              <div className="glass" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1.5rem', borderRadius: 99 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'hsl(var(--warning))', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                  Waiting for role selection...
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STAGE: FIRST_INNINGS & SECOND_INNINGS ── */}
      {(stage === 'FIRST_INNINGS' || stage === 'SECOND_INNINGS') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fadeIn">
          
          {/* Main Live Scorecard */}
          <div className="card glass" style={{ padding: '1.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.6rem',
                  borderRadius: 6,
                  backgroundColor: isMeBatting ? 'hsl(var(--brand-primary) / 0.15)' : 'hsl(var(--danger) / 0.15)',
                  color: isMeBatting ? 'hsl(var(--brand-primary))' : 'hsl(var(--danger))',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {isMeBatting ? '🏏 You are Batting' : '🎯 You are Bowling'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
                {stage === 'FIRST_INNINGS' ? 'FIRST INNINGS' : 'SECOND INNINGS'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600 }}>
                  {isMeBatting ? 'Your Score' : `${getUsername(battingUserId)}'s Score`}
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1 }}>
                  {runs} <span style={{ fontSize: '1.75rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {wickets}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600 }}>
                  Overs
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                  {formatOvers(balls)} <span style={{ fontSize: '1rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {maxOvers}</span>
                </div>
              </div>
            </div>

            {stage === 'SECOND_INNINGS' && target && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsl(var(--bg-elevated) / 0.5)',
                border: '1px solid hsl(var(--border-default))',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.9rem',
                fontWeight: 600
              }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>
                  Target: <strong style={{ color: 'white' }}>{target}</strong> runs
                </span>
                <span style={{ color: 'hsl(var(--brand-secondary))' }}>
                  Need {target - runs} runs from {maxOvers * 6 - balls} balls
                </span>
              </div>
            )}
          </div>

          {/* Reveal / Matchup Area */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '1rem', alignItems: 'center' }}>
            {/* Left Card: You */}
            <div className="card glass text-center" style={{ padding: '1.5rem 1rem' }}>
              <img
                src={getPlayerDetails(currentUserId)?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${getUsername(currentUserId)}`}
                alt="You"
                style={{ width: 50, height: 50, borderRadius: '50%', margin: '0 auto 0.75rem', border: '2px solid hsl(var(--border-default))' }}
              />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>You</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>
                {isMeBatting ? 'Batsman' : 'Bowler'}
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                width: 60,
                height: 60,
                lineHeight: '60px',
                borderRadius: 12,
                backgroundColor: 'hsl(var(--bg-elevated))',
                margin: '0 auto',
                border: myMoveSubmitted ? '2px solid hsl(var(--success))' : '1px solid hsl(var(--border-subtle))',
                color: myMoveSubmitted ? 'hsl(var(--success))' : 'hsl(var(--text-muted))'
              }}>
                {myMoveSubmitted ? '✓' : '?'}
              </div>
            </div>

            {/* Middle: VS / Last Outcome */}
            <div className="text-center">
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                vs
              </span>
              {lastBall && (
                <div style={{
                  padding: '0.5rem',
                  borderRadius: 8,
                  backgroundColor: lastBall.isOut ? 'hsl(var(--danger) / 0.15)' : 'hsl(var(--success) / 0.15)',
                  border: lastBall.isOut ? '1px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--success) / 0.3)'
                }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: lastBall.isOut ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
                    {lastBallResult}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                    Bat: {lastBall.batMove} | Bowl: {lastBall.bowlMove}
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Opponent */}
            <div className="card glass text-center" style={{ padding: '1.5rem 1rem' }}>
              <img
                src={getPlayerDetails(opponentUserId)?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${getUsername(opponentUserId)}`}
                alt="Opponent"
                style={{ width: 50, height: 50, borderRadius: '50%', margin: '0 auto 0.75rem', border: '2px solid hsl(var(--border-default))' }}
              />
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{getUsername(opponentUserId)}</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginBottom: '0.75rem' }}>
                {!isMeBatting ? 'Batsman' : 'Bowler'}
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                width: 60,
                height: 60,
                lineHeight: '60px',
                borderRadius: 12,
                backgroundColor: 'hsl(var(--bg-elevated))',
                margin: '0 auto',
                border: opponentMoveSubmitted ? '2px solid hsl(var(--success))' : '1px solid hsl(var(--border-subtle))',
                color: opponentMoveSubmitted ? 'hsl(var(--success))' : 'hsl(var(--text-muted))'
              }}>
                {opponentMoveSubmitted ? '✓' : '?'}
              </div>
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="card glass text-center" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'hsl(var(--text-secondary))' }}>
              {myMoveSubmitted ? 'Waiting for opponent to submit move...' : 'Choose a number to play:'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', maxWidth: 450, margin: '0 auto' }}>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <button
                  key={num}
                  id={`cricket-btn-${num}`}
                  disabled={myMoveSubmitted || isSubmitting}
                  onClick={() => handlePlayBall(num)}
                  style={{
                    padding: '1rem 0',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border-default))',
                    backgroundColor: myMoveSubmitted ? 'hsl(var(--bg-elevated) / 0.3)' : 'hsl(var(--bg-elevated))',
                    color: 'white',
                    cursor: myMoveSubmitted ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  className={!myMoveSubmitted ? 'card-hover' : ''}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Commentary Log */}
          <div className="card glass" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '0.75rem', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '0.5rem' }}>
              Commentary Feed 📻
            </h3>
            <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {commentary.map((line: string, i: number) => (
                <div key={i} style={{ fontSize: '0.85rem', color: i === 0 ? 'white' : 'hsl(var(--text-secondary))', fontWeight: i === 0 ? 600 : 400 }}>
                  {line}
                </div>
              ))}
              {commentary.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))', fontStyle: 'italic' }}>
                  No match activity yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: FINISHED ── */}
      {stage === 'FINISHED' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '3rem 2rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>
            {session.winnerId === currentUserId ? '🏆' : session.winnerId === 'DRAW' ? '🤝' : '💀'}
          </div>
          
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            {session.winnerId === currentUserId ? 'Match Won!' : session.winnerId === 'DRAW' ? "It's a Draw!" : 'Match Lost'}
          </h2>
          
          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem', fontSize: '1.05rem' }}>
            {session.winnerId === currentUserId 
              ? 'Congratulations! You outperformed your opponent.' 
              : session.winnerId === 'DRAW'
              ? 'What a close match! Points shared.'
              : `Opponent ${getUsername(session.winnerId)} won this match.`}
          </p>

          <div className="glass" style={{ maxWidth: 400, margin: '0 auto 2.5rem', padding: '1.5rem', borderRadius: 16 }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Final Scorecard
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '1rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>You</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {battingUserId === currentUserId ? gameState.innings1Score : gameState.innings2Score}
                </div>
              </div>
              <div style={{ color: 'hsl(var(--text-muted))', fontWeight: 700 }}>vs</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{getUsername(opponentUserId)}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {battingUserId !== currentUserId ? gameState.innings1Score : gameState.innings2Score}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', maxWidth: 400, margin: '0 auto' }}>
            <button
              className="btn"
              onClick={onLeave}
              style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
            >
              🚪 Leave Room
            </button>
            <button
              className="btn btn-primary"
              id="multiplayer-replay-btn"
              disabled={replayVotes[currentUserId] || isSubmitting}
              onClick={handlePlayAgain}
              style={{ flex: 2, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
            >
              {replayVotes[currentUserId] ? '⏳ Voted' : '🔄 Play Again'}
            </button>
          </div>
          
          {replayVotes[opponentUserId] && !replayVotes[currentUserId] && (
            <p style={{ color: 'hsl(var(--brand-secondary))', fontSize: '0.85rem', fontWeight: 600, marginTop: '1rem' }}>
              Opponent wants to play again! Click Play Again to restart.
            </p>
          )}
        </div>
      )}
      
    </div>
  )
}
