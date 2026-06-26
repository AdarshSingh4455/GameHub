'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useSocket } from '@/lib/contexts/SocketContext'
import MatchReactions from './MatchReactions'
import Avatar from '@/components/shared/Avatar'

interface Player {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
  selectedFrame?: string | null
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

  const [optimisticSelection, setOptimisticSelection] = useState<number | null>(null)
  const [revealState, setRevealState] = useState<'idle' | 'ball' | 'clash' | 'result'>('idle')
  const [showFinalBallReplay, setShowFinalBallReplay] = useState(false)

  const lastBallRef = React.useRef<any>(null)
  const stageRef = React.useRef<string>('')

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

  const lastBall = history[0]

  // Reset submitting state and optimistic selection when state updates from the server
  React.useEffect(() => {
    setIsSubmitting(false)
    setOptimisticSelection(null)
  }, [stage, innings, runs, wickets, balls, session.status])

  // Reset optimistic selection when my move is formally in the moves mapping
  React.useEffect(() => {
    if (moves[currentUserId] !== undefined) {
      setOptimisticSelection(null)
    }
  }, [moves, currentUserId])

  // Clash reveal animation sequence trigger on new ball
  React.useEffect(() => {
    if (lastBall) {
      const isNewBall = !lastBallRef.current || JSON.stringify(lastBall) !== JSON.stringify(lastBallRef.current)
      if (isNewBall) {
        setRevealState('ball')
        const clashTimer = setTimeout(() => setRevealState('clash'), 1000)
        const resultTimer = setTimeout(() => setRevealState('result'), 1800)
        lastBallRef.current = lastBall
        return () => {
          clearTimeout(clashTimer)
          clearTimeout(resultTimer)
        }
      }
    } else {
      setRevealState('idle')
      lastBallRef.current = null
    }
  }, [lastBall])

  // Delay match end transition to show final ball replay
  React.useEffect(() => {
    if (stage === 'FINISHED' && stageRef.current !== 'FINISHED') {
      setShowFinalBallReplay(true)
      const timer = setTimeout(() => {
        setShowFinalBallReplay(false)
      }, 2500)
      stageRef.current = 'FINISHED'
      return () => clearTimeout(timer)
    }
    if (stage !== 'FINISHED') {
      stageRef.current = stage
      setShowFinalBallReplay(false)
    }
  }, [stage])

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
    setOptimisticSelection(number)
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'play', number } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        setOptimisticSelection(null)
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
  const myMoveSubmitted = (moves[currentUserId] !== undefined && moves[currentUserId] !== null) || optimisticSelection !== null
  const currentSelection = moves[currentUserId] !== undefined && moves[currentUserId] !== null ? moves[currentUserId] : optimisticSelection

  // Check if I am active (playing this ball)
  const isMeActive = isMeBatting || isMeBowling
  const activeBattingTeamName = battingTeam === 'BLUE' ? 'Blue Team' : 'Green Team'
  const activeBowlingTeamName = bowlingTeam === 'BLUE' ? 'Blue Team' : 'Green Team'

  // Extract last ball details
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

  const batsmanHasMoved = moves[battingUserId] !== undefined || (battingUserId === currentUserId && optimisticSelection !== null)
  const bowlerHasMoved = moves[bowlingUserId] !== undefined || (bowlingUserId === currentUserId && optimisticSelection !== null)
  
  const isBatsmanFlipped = !!(lastBall && (revealState === 'result' || (revealState === 'idle' && !batsmanHasMoved && !bowlerHasMoved)))
  const isBowlerFlipped = !!(lastBall && (revealState === 'result' || (revealState === 'idle' && !batsmanHasMoved && !bowlerHasMoved)))

  const activeBattingColor = getTeamColor(battingTeam)
  const activeBattingBg = getTeamBg(battingTeam)
  const activeBattingBorder = getTeamBorder(battingTeam)

  return (
    <div style={{ maxWidth: 650, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }} className="cricket-container">
      <style>{`
        @keyframes spin-ball {
          0% { transform: translate(-40px, 0) rotate(0deg); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate(40px, 0) rotate(720deg); opacity: 0; }
        }

        @keyframes shake-impact {
          0% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-4px, 4px) scale(1.1); }
          40% { transform: translate(4px, -4px) scale(1.1); }
          60% { transform: translate(-4px, -4px) scale(1.05); }
          80% { transform: translate(4px, 4px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }

        @keyframes zoom-result {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes bounce-trophy {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        @keyframes subtle-sparkle {
          0%, 100% { transform: scale(0.6); opacity: 0.2; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        .flip-card {
          background-color: transparent;
          width: 44px;
          height: 44px;
          perspective: 1000px;
          margin: 0 auto;
        }

        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          transform-style: preserve-3d;
        }

        .flip-card.flipped .flip-card-inner {
          transform: rotateY(180deg);
        }

        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.25rem;
        }

        .flip-card-front {
          background-color: hsl(var(--bg-elevated));
          color: hsl(var(--text-muted));
          border: 1px solid rgba(255,255,255,0.06);
        }

        .flip-card-front.submitted {
          border: 2px solid hsl(var(--success));
          color: hsl(var(--success));
        }

        .flip-card-back {
          background-color: hsl(var(--bg-elevated));
          color: white;
          transform: rotateY(180deg);
          border: 2px solid hsl(var(--brand-primary));
        }

        .cricket-keypad-btn {
          height: 56px !important;
          font-size: 1.25rem !important;
          font-weight: 900 !important;
          border-radius: 12px !important;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
        }

        .cricket-keypad-btn:active:not(:disabled) {
          transform: scale(0.9) !important;
        }

        @media (hover: hover) {
          .cricket-keypad-btn:hover:not(:disabled) {
            transform: translateY(-2px) scale(1.05);
            background-color: hsl(220 20% 16%) !important;
            border-color: rgba(255, 255, 255, 0.2) !important;
          }
        }

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
            id="cricket-leave-room-btn"
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
                id="cricket-join-blue-btn"
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
                id="cricket-join-green-btn"
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
                id="cricket-start-team-match-btn"
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
                  id="cricket-toss-bat-btn"
                  className="btn btn-primary"
                  onClick={() => handleTossChoice('BAT')}
                  disabled={isSubmitting}
                  style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
                >
                  🏏 Bat First
                </button>
                <button
                  id="cricket-toss-bowl-btn"
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

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <button
              id="cricket-batting-lineup-btn"
              onClick={() => setShowBattingModal(true)}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.5rem', borderRadius: 10, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              🏏 Batting Lineup ▼
            </button>
            <button
              id="cricket-bowling-rotation-btn"
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
                <button id="cricket-close-batting-modal-btn" className="btn btn-secondary" onClick={() => setShowBattingModal(false)} style={{ width: '100%', marginTop: '1.5rem', borderRadius: 10 }}>Close</button>
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
                <button id="cricket-close-bowling-modal-btn" className="btn btn-secondary" onClick={() => setShowBowlingModal(false)} style={{ width: '100%', marginTop: '1.5rem', borderRadius: 10 }}>Close</button>
              </div>
            </div>
          )}

          {/* Real-time Matchup Reveal */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: '1rem', alignItems: 'center' }}>
            {/* Active Batsman block */}
            <div className="card glass text-center" style={{ padding: '1.25rem 0.75rem', border: isMeBatting ? `1px solid ${activeBattingColor}` : '1px solid transparent', background: isMeBatting ? activeBattingBg : 'hsl(222 20% 8% / 0.6)' }}>
              <div style={{ margin: '0 auto 0.5rem', display: 'inline-flex', borderRadius: '50%', border: `2px solid ${activeBattingColor}` }}>
                <Avatar
                  avatarUrl={getPlayerDetails(battingUserId)?.avatarUrl}
                  username={getUsername(battingUserId)}
                  selectedFrame={getPlayerDetails(battingUserId)?.selectedFrame}
                  size={40}
                />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isMeBatting ? activeBattingColor : 'white' }}>
                {getUsername(battingUserId)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }}>
                Active Batsman {isMeBatting && '(You)'}
              </div>
              <div className={`flip-card ${isBatsmanFlipped ? 'flipped' : ''} ${lastBall?.isOut && revealState === 'result' ? 'shake-out' : ''}`}>
                <div className="flip-card-inner">
                  <div className={`flip-card-front ${batsmanHasMoved ? 'submitted' : ''}`}>
                    {batsmanHasMoved ? '✓' : '?'}
                  </div>
                  <div className="flip-card-back">
                    {lastBall?.batMove || '?'}
                  </div>
                </div>
              </div>
            </div>

            {/* Ball resolved indicator */}
            <div className="text-center" style={{ minWidth: '110px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(var(--text-muted))', display: 'block', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                vs
              </span>
              {lastBall && (
                <>
                  {revealState === 'ball' && (
                    <div style={{ position: 'relative', height: 44, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: '1.75rem', animation: 'spin-ball 1s linear infinite' }}>🏏⚾</div>
                    </div>
                  )}
                  {revealState === 'clash' && (
                    <div style={{ display: 'inline-block', animation: 'shake-impact 0.8s ease-in-out', color: 'hsl(var(--warning))', fontSize: '0.9rem', fontWeight: 900 }}>
                      ⚡ CLASH! ⚡
                    </div>
                  )}
                  {(revealState === 'result' || revealState === 'idle') && (
                    <div style={{
                      padding: '0.4rem',
                      borderRadius: 8,
                      backgroundColor: lastBall.isOut ? 'hsl(var(--danger) / 0.15)' : 'hsl(var(--success) / 0.15)',
                      border: lastBall.isOut ? '1px solid hsl(var(--danger) / 0.3)' : '1px solid hsl(var(--success) / 0.3)',
                      animation: 'zoom-result 0.3s ease-out'
                    }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: lastBall.isOut ? 'hsl(var(--danger))' : 'hsl(var(--success))' }}>
                        {lastBallResult}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
                        Bat: {lastBall.batMove} | Bowl: {lastBall.bowlMove}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Active Bowler block */}
            <div className="card glass text-center" style={{ padding: '1.25rem 0.75rem', border: isMeBowling ? `1px solid ${getTeamColor(bowlingTeam)}` : '1px solid transparent', background: isMeBowling ? getTeamBg(bowlingTeam) : 'hsl(222 20% 8% / 0.6)' }}>
              <div style={{ margin: '0 auto 0.5rem', display: 'inline-flex', borderRadius: '50%', border: `2px solid ${getTeamColor(bowlingTeam)}` }}>
                <Avatar
                  avatarUrl={getPlayerDetails(bowlingUserId)?.avatarUrl}
                  username={getUsername(bowlingUserId)}
                  selectedFrame={getPlayerDetails(bowlingUserId)?.selectedFrame}
                  size={40}
                />
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isMeBowling ? getTeamColor(bowlingTeam) : 'white' }}>
                {getUsername(bowlingUserId)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginBottom: '0.5rem' }}>
                Active Bowler {isMeBowling && '(You)'}
              </div>
              <div className={`flip-card ${isBowlerFlipped ? 'flipped' : ''}`}>
                <div className="flip-card-inner">
                  <div className={`flip-card-front ${bowlerHasMoved ? 'submitted' : ''}`}>
                    {bowlerHasMoved ? '✓' : '?'}
                  </div>
                  <div className="flip-card-back">
                    {lastBall?.bowlMove || '?'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active play buttons panel (only active batsman/bowler see) */}
          {isMeActive ? (
            <div className="card glass text-center animate-pulse-slow" style={{ padding: '1.25rem', border: `1px solid ${isMeBatting ? activeBattingColor : getTeamColor(bowlingTeam)}` }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                {currentSelection !== null
                  ? `Selected: ${currentSelection} - Waiting...`
                  : (isMeBatting ? '🏏 SUBMIT YOUR BAT SCORE' : '🎯 SUBMIT YOUR BOWL GUESSTIMATE')}
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem', maxWidth: 400, margin: '0 auto' }}>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => handlePlayBall(num)}
                    disabled={myMoveSubmitted || isSubmitting}
                    style={{
                      backgroundColor: currentSelection === num
                        ? 'hsl(142 75% 50% / 0.2)'
                        : 'hsl(220 20% 12%)',
                      border: currentSelection === num
                        ? '2px solid hsl(142 75% 50%)'
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: currentSelection === num
                        ? '0 0 15px hsl(142 75% 50% / 0.5)'
                        : 'none',
                      color: 'white',
                      cursor: myMoveSubmitted || isSubmitting ? 'default' : 'pointer',
                      opacity: currentSelection !== null && currentSelection !== num ? 0.35 : 1
                    }}
                    className={`cricket-keypad-btn ${!myMoveSubmitted ? 'card-hover' : ''}`}
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.85)',
          backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  fontSize: '1.5rem',
                  left: `${15 + i * 15}%`,
                  top: `${20 + (i % 3) * 20}%`,
                  animation: 'subtle-sparkle 2s infinite ease-in-out',
                  animationDelay: `${i * 0.3}s`
                }}
              >
                ✨
              </div>
            ))}
          </div>
          
          <div className="card glass text-center animate-fadeIn" style={{
            maxWidth: 450, width: '100%', padding: '3.5rem 2rem', borderRadius: 24,
            border: '2px solid hsl(var(--brand-primary) / 0.5)',
            background: 'linear-gradient(135deg, hsl(222 20% 10%), hsl(222 20% 5%))',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <div style={{ fontSize: '6rem', marginBottom: '1rem', animation: 'bounce-trophy 2s infinite ease-in-out' }}>
              {session.winnerId === myTeamKey ? '🏆' : session.winnerId === 'DRAW' ? '🤝' : '💀'}
            </div>
            
            <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', color: 'white' }}>
              {session.winnerId === myTeamKey ? 'Your Team Won!' : session.winnerId === 'DRAW' ? "It's a Draw!" : 'Your Team Lost'}
            </h2>
            
            <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '2.5rem', fontSize: '1.05rem' }}>
              {session.winnerId === myTeamKey 
                ? 'Outstanding performance! Victory for your side.' 
                : session.winnerId === 'DRAW'
                ? 'Incredible tie! Scorecard is perfectly balanced.'
                : `Opponent Team (${session.winnerId === 'BLUE' ? 'Blue' : 'Green'}) took this match.`}
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                id="cricket-leave-room-btn"
                className="btn btn-secondary"
                onClick={onLeave}
                style={{ flex: 1, borderRadius: 12 }}
              >
                🚪 Leave Room
              </button>
              <button
                className="btn btn-primary"
                id="multiplayer-replay-btn"
                disabled={replayVotes[currentUserId] || isSubmitting}
                onClick={handlePlayAgain}
                style={{ flex: 2, borderRadius: 12, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
              >
                {replayVotes[currentUserId] ? '⏳ Voted' : '🔄 Play Again'}
              </button>
            </div>
            
            {Object.keys(replayVotes).length > 0 && !replayVotes[currentUserId] && (
              <p style={{ color: 'hsl(var(--brand-secondary))', fontSize: '0.85rem', fontWeight: 600, marginTop: '1.25rem' }}>
                Other players want to play again! Click Play Again to restart.
              </p>
            )}
          </div>
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

      {showFinalBallReplay && lastBall && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5, 8, 16, 0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem',
          backdropFilter: 'blur(8px)', animation: 'fadeIn 0.25s ease-out'
        }}>
          <div className="card glass text-center animate-fadeIn" style={{
            maxWidth: 450, width: '100%', padding: '2.5rem 2rem', borderRadius: 20,
            border: '2px solid hsl(var(--brand-primary) / 0.5)',
            background: 'linear-gradient(135deg, hsl(222 20% 10%), hsl(222 20% 5%))',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 900, color: 'hsl(var(--brand-secondary))', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              ⚡ Final Ball Replay ⚡
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', marginBottom: '1.5rem' }}>
              {lastBall.isOut ? '🔴 BATTER OUT!' : `🏏 +${lastBall.runs} RUNS`}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: 12 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Batter chose</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'hsl(210 100% 65%)' }}>{lastBall.batMove}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Bowler chose</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'hsl(142 70% 55%)' }}>{lastBall.bowlMove}</div>
              </div>
            </div>
            <div style={{ fontSize: '1rem', color: 'white', fontWeight: 700 }}>
              {lastBall.isOut ? 'The final wicket fell!' : 'Match completed!'}
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}
