'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useSocket } from '@/lib/contexts/SocketContext'
import MatchReactions from './MatchReactions'

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
  const { socket } = useSocket()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showBattingModal, setShowBattingModal] = useState(false)
  const [showBowlingModal, setShowBowlingModal] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    addToast('success', 'Copied', 'Room code copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const gameState = session.gameState || {}
  const {
    stage = 'TEAM_SETUP',
    tossWinnerId = '',
    tossChoice = '',
    battingUserId = '',
    bowlingUserId = '',
    battingTeam = '',
    bowlingTeam = '',
    innings = 1,
    runs = 0,
    wickets = 0,
    balls = 0,
    maxOvers = 2,
    maxWickets = 1,
    target = null,
    moves = {},
    history = [],
    commentary = [],
    replayVotes = {},
    teams = {
      'BLUE': { players: [], captain: null },
      'GREEN': { players: [], captain: null }
    },
    playerRuns = {},
    currentPartnership = 0,
    quickChat = []
  } = gameState

  // Reset submitting state when state updates from the server
  React.useEffect(() => {
    setIsSubmitting(false)
  }, [stage, innings, runs, wickets, balls, session.status])

  // Helper to map user ID to username
  const getUsername = (uid: string) => {
    const p = players.find(player => player.userId === uid)
    return p ? p.username : 'Player'
  }

  const getPlayerDetails = (uid: string) => {
    return players.find(p => p.userId === uid)
  }

  // Handle Team Joins
  const handleJoinTeam = (teamName: 'BLUE' | 'GREEN') => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'join-team', team: teamName } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Join Team Error', res.error)
      }
    })
  }

  // Handle Start Match (balanced Blue/Green, host only)
  const handleStartMatch = () => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'start-match' } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Start Error', res.error)
      }
    })
  }

  // Handle Toss Selection
  const handleTossChoice = (choice: 'BAT' | 'BOWL') => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'toss', choice } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Toss Error', res.error)
      }
    })
  }

  // Handle Play Ball Selection
  const handlePlayBall = (number: number) => {
    if (!socket || moves[currentUserId] !== undefined || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'play', number } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Play Error', res.error)
      }
    })
  }

  // Send Quick Chat
  const handleQuickChat = (message: string) => {
    if (!socket) return
    socket.emit('submit-move', { roomCode, move: { type: 'quick-chat', message } })
  }

  // Handle Vote Play Again
  const handlePlayAgain = () => {
    if (!socket) return
    setIsSubmitting(true)
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Error', res.error)
      } else {
        addToast('success', 'Vote Registered', 'Waiting for others to accept.')
      }
    })
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

  // Check if I am active (playing this ball)
  const isMeActive = isMeBatting || isMeBowling
  const activeBattingTeamName = battingTeam === 'BLUE' ? 'Blue Team' : 'Green Team'
  const activeBowlingTeamName = bowlingTeam === 'BLUE' ? 'Blue Team' : 'Green Team'

  // Extract last ball details
  const lastBall = history[0]
  let myLastMove = null
  let opponentLastMove = null
  let lastBallResult = ''

  if (lastBall) {
    const wasMeBatting = lastBall.batsmanId === currentUserId
    const wasMeBowling = lastBall.bowlerId === currentUserId
    
    if (wasMeBatting) {
      myLastMove = lastBall.batMove
      opponentLastMove = lastBall.bowlMove
    } else if (wasMeBowling) {
      myLastMove = lastBall.bowlMove
      opponentLastMove = lastBall.batMove
    } else {
      // Spectator
      myLastMove = lastBall.batMove
      opponentLastMove = lastBall.bowlMove
    }
    lastBallResult = lastBall.isOut ? '🔴 OUT!' : `🏏 +${lastBall.runs} runs`
  }

  // Get opposing Captain name
  const isBlueCaptain = teams['BLUE'].captain === currentUserId
  const myTeamKey = teams['BLUE'].players.includes(currentUserId) ? 'BLUE' : 'GREEN'
  const opponentTeamKey = myTeamKey === 'BLUE' ? 'GREEN' : 'BLUE'
  const opponentCaptainId = teams[opponentTeamKey].captain || ''
  const myCaptainId = teams[myTeamKey].captain || ''

  // Visual Colors Mapping
  const getTeamColor = (tName: string) => {
    return tName === 'BLUE' ? 'hsl(210 100% 55%)' : 'hsl(142 70% 45%)'
  }
  const getTeamBg = (tName: string) => {
    return tName === 'BLUE' ? 'hsl(210 100% 50% / 0.15)' : 'hsl(142 70% 50% / 0.15)'
  }
  const getTeamBorder = (tName: string) => {
    return tName === 'BLUE' ? 'hsl(210 100% 50% / 0.4)' : 'hsl(142 70% 50% / 0.4)'
  }

  const activeBattingColor = getTeamColor(battingTeam)
  const activeBattingBg = getTeamBg(battingTeam)
  const activeBattingBorder = getTeamBorder(battingTeam)

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }} className="cricket-container">
      <style>{`
        @media (max-width: 480px) {
          .cricket-container .card {
            padding: 0.85rem !important;
          }
          .cricket-container button {
            padding: 0.4rem 0.6rem !important;
            font-size: 0.75rem !important;
          }
          .cricket-container .btn {
            padding: 0.4rem 0.6rem !important;
            font-size: 0.75rem !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div className="card glass" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.25rem' }}>🏏</span>
          <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Hand Cricket</span>
          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', backgroundColor: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>
            Room: {roomCode}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: 8, minWidth: 'auto' }}
          >
            {copied ? '✅ Copied' : '📋 Copy Code'}
          </button>
          <button
            onClick={onLeave}
            className="btn btn-secondary"
            style={{
              padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: 8, minWidth: 'auto',
              border: '1px solid hsl(0 80% 40% / 0.5)', color: 'hsl(0 80% 65%)',
              background: 'hsl(0 80% 50% / 0.08)'
            }}
          >
            🚪 Leave
          </button>
        </div>
      </div>
      
      {/* ── STAGE: TEAM_SETUP ── */}
      {stage === 'TEAM_SETUP' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '2rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '1rem' }}>Team Selection 🏏</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Choose your side for this Team Hand Cricket match!
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }} className="team-setup-grid">
            
            {/* Blue Team Box */}
            <div className="card" style={{
              padding: '1.5rem 1rem',
              backgroundColor: 'hsl(210 100% 50% / 0.05)',
              border: '1px solid hsl(210 100% 50% / 0.3)',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <h3 style={{ color: 'hsl(210 100% 65%)', fontWeight: 800, fontSize: '1.15rem' }}>🔵 Blue Team</h3>
              <div style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                {teams['BLUE'].players.map((id: string) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: id === currentUserId ? 700 : 400 }}>
                    <span>{id === teams['BLUE'].captain ? '👑' : '👤'}</span>
                    <span>{getUsername(id)} {id === currentUserId && '(You)'}</span>
                  </div>
                ))}
                {teams['BLUE'].players.length === 0 && (
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem', fontStyle: 'italic', margin: 'auto' }}>Empty slot</span>
                )}
              </div>
              <button
                className="btn"
                onClick={() => handleJoinTeam('BLUE')}
                disabled={teams['BLUE'].players.includes(currentUserId) || isSubmitting}
                style={{
                  background: 'hsl(210 100% 55%)',
                  color: 'white',
                  borderRadius: 10,
                  fontSize: '0.85rem'
                }}
              >
                Join Blue
              </button>
            </div>

            {/* Green Team Box */}
            <div className="card" style={{
              padding: '1.5rem 1rem',
              backgroundColor: 'hsl(142 70% 50% / 0.05)',
              border: '1px solid hsl(142 70% 50% / 0.3)',
              borderRadius: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <h3 style={{ color: 'hsl(142 70% 55%)', fontWeight: 800, fontSize: '1.15rem' }}>🟢 Green Team</h3>
              <div style={{ minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                {teams['GREEN'].players.map((id: string) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: id === currentUserId ? 700 : 400 }}>
                    <span>{id === teams['GREEN'].captain ? '👑' : '👤'}</span>
                    <span>{getUsername(id)} {id === currentUserId && '(You)'}</span>
                  </div>
                ))}
                {teams['GREEN'].players.length === 0 && (
                  <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem', fontStyle: 'italic', margin: 'auto' }}>Empty slot</span>
                )}
              </div>
              <button
                className="btn"
                onClick={() => handleJoinTeam('GREEN')}
                disabled={teams['GREEN'].players.includes(currentUserId) || isSubmitting}
                style={{
                  background: 'hsl(142 70% 45%)',
                  color: 'white',
                  borderRadius: 10,
                  fontSize: '0.85rem'
                }}
              >
                Join Green
              </button>
            </div>
          </div>

          {currentUserId === gameState.hostUserId ? (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleStartMatch}
                disabled={isSubmitting || players.length % 2 !== 0}
                style={{
                  width: '100%',
                  maxWidth: 300,
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))'
                }}
              >
                🚀 Start Team Match
              </button>
              {players.length % 2 !== 0 && (
                <p style={{ color: 'hsl(var(--warning))', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                  ⚠️ Enforced: Team Cricket requires an EVEN number of players to start (2, 4, 6 players).
                </p>
              )}
            </div>
          ) : (
            <div className="glass" style={{ display: 'inline-flex', padding: '0.5rem 1.5rem', borderRadius: 99, fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              ⏳ Waiting for the Host to start...
            </div>
          )}
        </div>
      )}

      {/* ── STAGE: TOSS ── */}
      {stage === 'TOSS' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '3rem 2rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>🪙</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem' }}>The Coin Toss</h2>
          
          <div style={{ marginBottom: '1.5rem', fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
            🔵 Blue Captain: <strong style={{ color: 'white' }}>{getUsername(teams['BLUE'].captain)}</strong> | 🟢 Green Captain: <strong style={{ color: 'white' }}>{getUsername(teams['GREEN'].captain)}</strong>
          </div>

          {isMeTossWinner ? (
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ color: 'hsl(var(--success))', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                🎉 You won the toss as Captain! Choose your team's role:
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
                Captain <strong style={{ color: 'white' }}>{getUsername(tossWinnerId)}</strong> ({tossWinnerId === teams['BLUE'].captain ? 'Blue' : 'Green'}) won the toss.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-fadeIn">
          
          {/* Main Live Scorecard (Consistent Team Colors) */}
          <div className="card" style={{
            padding: '1.5rem',
            background: activeBattingBg,
            border: `1px solid ${activeBattingBorder}`,
            borderRadius: 18,
            boxShadow: `inset 0 0 20px ${activeBattingBorder}22`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 900,
                  padding: '0.25rem 0.65rem',
                  borderRadius: 6,
                  backgroundColor: activeBattingColor,
                  color: 'black',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {battingTeam === 'BLUE' ? '🔵 Blue Team Batting' : '🟢 Green Team Batting'}
                </span>
                
                {isMeActive ? (
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white' }}>
                    {isMeBatting ? '🏏 You are Batting!' : '🎯 You are Bowling!'}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                    👀 Spectating
                  </span>
                )}
              </div>
              
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>
                {stage === 'FIRST_INNINGS' ? '1ST INNINGS' : '2ND INNINGS'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>
                  {activeBattingTeamName} Score
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>
                  {runs} <span style={{ fontSize: '1.75rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {wickets}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>
                  Overs
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
                  {formatOvers(balls)} <span style={{ fontSize: '1rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>/ {maxOvers}</span>
                </div>
              </div>
            </div>

            {/* Partnership details & bowler */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
              <div>
                🏏 Partnership: <strong style={{ color: 'white' }}>{currentPartnership}</strong> runs
                <div style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem', marginTop: '2px' }}>
                  Current Batter: <span style={{ color: activeBattingColor, fontWeight: 700 }}>{getUsername(battingUserId)}</span> ({playerRuns[battingUserId] || 0} runs)
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                🎯 Bowler: <span style={{ color: getTeamColor(bowlingTeam), fontWeight: 700 }}>{getUsername(bowlingUserId)}</span>
              </div>
            </div>

            {stage === 'SECOND_INNINGS' && target && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 12,
                backgroundColor: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                fontWeight: 600
              }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>
                  Target: <strong style={{ color: 'white' }}>{target}</strong> runs
                </span>
                <span style={{ color: activeBattingColor }}>
                  Need {target - runs} runs from {maxOvers * 6 - balls} balls
                </span>
              </div>
            )}
          </div>

          {/* Lineup & Rotations Trackers */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <button
              onClick={() => setShowBattingModal(true)}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.5rem', borderRadius: 10, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              🏏 Batting Lineup ▼
            </button>
            <button
              onClick={() => setShowBowlingModal(true)}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.5rem', borderRadius: 10, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              🎯 Bowling Rotation ▼
            </button>
          </div>

          {/* Batting Lineup Modal */}
          {showBattingModal && teams[battingTeam] && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
            }} onClick={() => setShowBattingModal(false)}>
              <div className="card glass" style={{
                maxWidth: 400, width: '100%', padding: '1.25rem', borderRadius: 16,
                backgroundColor: 'hsl(222 20% 8%)', border: '1px solid rgba(255, 255, 255, 0.1)'
              }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>🏏 Batting Lineup</h3>
                  <button onClick={() => setShowBattingModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {teams[battingTeam].players.map((id: string, idx: number) => {
                    const isBatterOut = idx < wickets
                    const isBatterActive = id === battingUserId
                    return (
                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', textDecoration: isBatterOut ? 'line-through' : 'none', opacity: isBatterOut ? 0.45 : 1 }}>
                        <span style={{ color: isBatterActive ? activeBattingColor : 'white', fontWeight: isBatterActive ? 700 : 400 }}>
                          {idx + 1}. {getUsername(id)} {id === myCaptainId && '👑'}
                        </span>
                        <strong style={{ color: 'hsl(var(--text-secondary))' }}>{playerRuns[id] || 0} runs</strong>
                      </div>
                    )
                  })}
                </div>
                <button className="btn btn-secondary" onClick={() => setShowBattingModal(false)} style={{ width: '100%', marginTop: '1.5rem', borderRadius: 10 }}>Close</button>
              </div>
            </div>
          )}

          {/* Bowling Rotation Modal */}
          {showBowlingModal && teams[bowlingTeam] && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem'
            }} onClick={() => setShowBowlingModal(false)}>
              <div className="card glass" style={{
                maxWidth: 400, width: '100%', padding: '1.25rem', borderRadius: 16,
                backgroundColor: 'hsl(222 20% 8%)', border: '1px solid rgba(255, 255, 255, 0.1)'
              }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>🎯 Bowling Rotation</h3>
                  <button onClick={() => setShowBowlingModal(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {teams[bowlingTeam].players.map((id: string, idx: number) => {
                    const isBowlerActive = id === bowlingUserId
                    return (
                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                        <span style={{ color: isBowlerActive ? getTeamColor(bowlingTeam) : 'white', fontWeight: isBowlerActive ? 700 : 400 }}>
                          Over {idx + 1}: {getUsername(id)} {id === teams[bowlingTeam].captain && '👑'}
                        </span>
                        <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>
                          {isBowlerActive ? 'Bowling' : 'Waiting'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <button className="btn btn-secondary" onClick={() => setShowBowlingModal(false)} style={{ width: '100%', marginTop: '1.5rem', borderRadius: 10 }}>Close</button>
              </div>
            </div>
          )}

          {/* Real-time Matchup Reveal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '1rem', alignItems: 'center' }}>
            {/* Active Batsman block */}
            <div className="card glass text-center" style={{ padding: '1.25rem 0.75rem', border: isMeBatting ? `1px solid ${activeBattingColor}` : '1px solid transparent', background: isMeBatting ? activeBattingBg : 'hsl(222 20% 8% / 0.6)' }}>
              <img
                src={getPlayerDetails(battingUserId)?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${getUsername(battingUserId)}`}
                alt="Batsman"
                style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto 0.5rem', border: `2px solid ${activeBattingColor}` }}
              />
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isMeBatting ? activeBattingColor : 'white' }}>
                {getUsername(battingUserId)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }}>
                Active Batsman {isMeBatting && '(You)'}
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                width: 44,
                height: 44,
                lineHeight: '44px',
                borderRadius: 10,
                backgroundColor: 'hsl(var(--bg-elevated))',
                margin: '0 auto',
                border: moves[battingUserId] !== undefined ? '2px solid hsl(var(--success))' : '1px solid rgba(255,255,255,0.06)',
                color: moves[battingUserId] !== undefined ? 'hsl(var(--success))' : 'hsl(var(--text-muted))'
              }}>
                {moves[battingUserId] !== undefined ? '✓' : '?'}
              </div>
            </div>

            {/* Ball resolved indicator */}
            <div className="text-center">
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                vs
              </span>
              {lastBall && (
                <div style={{
                  padding: '0.4rem',
                  borderRadius: 8,
                  backgroundColor: lastBall.isOut ? 'hsl(var(--danger) / 0.15)' : 'hsl(var(--success) / 0.15)',
                  border: lastBall.isOut ? '1px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--success) / 0.3)'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: lastBall.isOut ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
                    {lastBallResult}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                    Bat: {lastBall.batMove} | Bowl: {lastBall.bowlMove}
                  </div>
                </div>
              )}
            </div>

            {/* Active Bowler block */}
            <div className="card glass text-center" style={{ padding: '1.25rem 0.75rem', border: isMeBowling ? `1px solid ${getTeamColor(bowlingTeam)}` : '1px solid transparent', background: isMeBowling ? getTeamBg(bowlingTeam) : 'hsl(222 20% 8% / 0.6)' }}>
              <img
                src={getPlayerDetails(bowlingUserId)?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${getUsername(bowlingUserId)}`}
                alt="Bowler"
                style={{ width: 44, height: 44, borderRadius: '50%', margin: '0 auto 0.5rem', border: `2px solid ${getTeamColor(bowlingTeam)}` }}
              />
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isMeBowling ? getTeamColor(bowlingTeam) : 'white' }}>
                {getUsername(bowlingUserId)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }}>
                Active Bowler {isMeBowling && '(You)'}
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                width: 44,
                height: 44,
                lineHeight: '44px',
                borderRadius: 10,
                backgroundColor: 'hsl(var(--bg-elevated))',
                margin: '0 auto',
                border: moves[bowlingUserId] !== undefined ? '2px solid hsl(var(--success))' : '1px solid rgba(255,255,255,0.06)',
                color: moves[bowlingUserId] !== undefined ? 'hsl(var(--success))' : 'hsl(var(--text-muted))'
              }}>
                {moves[bowlingUserId] !== undefined ? '✓' : '?'}
              </div>
            </div>
          </div>

          {/* Active play buttons panel (only active batsman/bowler see) */}
          {isMeActive ? (
            <div className="card glass text-center animate-pulse-slow" style={{ padding: '1.25rem', border: `1px solid ${isMeBatting ? activeBattingColor : getTeamColor(bowlingTeam)}` }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                {isMeBatting ? '🏏 SUBMIT YOUR BAT SCORE' : '🎯 SUBMIT YOUR BOWL GUESSTIMATE'}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', maxWidth: 400, margin: '0 auto' }}>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePlayBall(num)}
                    disabled={myMoveSubmitted || isSubmitting}
                    style={{
                      height: 48,
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      borderRadius: 10,
                      backgroundColor: myMoveSubmitted && moves[currentUserId] === num
                        ? 'hsl(var(--success))'
                        : 'hsl(var(--bg-elevated))',
                      border: myMoveSubmitted && moves[currentUserId] === num
                        ? '1px solid hsl(var(--success))'
                        : '1px solid rgba(255,255,255,0.05)',
                      color: 'white',
                      cursor: myMoveSubmitted || isSubmitting ? 'default' : 'pointer',
                      opacity: myMoveSubmitted && moves[currentUserId] !== num ? 0.35 : 1,
                      transition: 'all 0.15s ease'
                    }}
                    className={!myMoveSubmitted ? 'card-hover' : ''}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="card glass text-center" style={{ padding: '1rem', color: 'hsl(var(--text-secondary))', fontSize: '0.85rem' }}>
              ⏳ Waiting for batsman <strong style={{ color: 'white' }}>{getUsername(battingUserId)}</strong> and bowler <strong style={{ color: 'white' }}>{getUsername(bowlingUserId)}</strong> to submit...
            </div>
          )}

          {/* Quick Chat Buttons (Team Cricket specific) */}
          <div className="card glass" style={{ padding: '0.75rem', borderRadius: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
              {["Nice Shot!", "Well Played!", "Bowl Tight!", "Great Ball!", "Let's Win!"].map(msg => (
                <button
                  key={msg}
                  onClick={() => handleQuickChat(msg)}
                  className="btn"
                  style={{
                    padding: '0.35rem 0.65rem',
                    minWidth: 'auto',
                    fontSize: '0.75rem',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    color: 'white',
                    borderRadius: 8
                  }}
                >
                  💬 {msg}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Chat Logs & Commentary Logs */}
          <div className="card glass" style={{ padding: '1rem', borderRadius: 12 }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
              Match Commentary & Chat 📻
            </h4>

            {/* Quick chat bubbles display */}
            {quickChat && quickChat.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.5rem' }}>
                {quickChat.slice(-3).map((chat: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: getTeamColor(chat.team), fontWeight: 700 }}>
                      [{chat.team === 'BLUE' ? 'Blue' : 'Green'}] {chat.username}:
                    </span>
                    <span style={{ color: 'white', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                      {chat.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {commentary.map((line: string, i: number) => (
                <div key={i} style={{ fontSize: '0.8rem', color: i === 0 ? 'white' : 'hsl(var(--text-secondary))', fontWeight: i === 0 ? 600 : 400 }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE: FINISHED ── */}
      {stage === 'FINISHED' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '3.5rem 2rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>
            {session.winnerId === myTeamKey ? '🏆' : session.winnerId === 'DRAW' ? '🤝' : '💀'}
          </div>
          
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem' }}>
            {session.winnerId === myTeamKey ? 'Your Team Won!' : session.winnerId === 'DRAW' ? "It's a Draw!" : 'Your Team Lost'}
          </h2>
          
          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2rem', fontSize: '1.05rem' }}>
            {session.winnerId === myTeamKey 
              ? 'Outstanding performance! Victory for your side.' 
              : session.winnerId === 'DRAW'
              ? 'Incredible tie! Scorecard is perfectly balanced.'
              : `Opponent Team (${session.winnerId === 'BLUE' ? 'Blue' : 'Green'}) took this match.`}
          </p>

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
          
          {Object.keys(replayVotes).length > 0 && !replayVotes[currentUserId] && (
            <p style={{ color: 'hsl(var(--brand-secondary))', fontSize: '0.85rem', fontWeight: 600, marginTop: '1rem' }}>
              Other players want to play again! Click Play Again to restart.
            </p>
          )}
        </div>
      )}

      {/* Floating Reactions overlay */}
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
