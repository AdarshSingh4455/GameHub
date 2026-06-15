'use client'

import React, { useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'

interface Player {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
}

interface DotsBoxesProps {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

export default function MultiplayerDotsBoxesGame({
  roomCode,
  session,
  players,
  currentUserId,
  onLeave
}: DotsBoxesProps) {
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const gameState = session.gameState || {}
  const { horizontalLines = [], verticalLines = [], completedBoxes = [], playerScores = {}, currentTurn, replayVotes = {}, dotsSize = 6 } = gameState

  const opponentUserId = players.find(p => p.userId !== currentUserId)?.userId || ''

  const getUsername = (uid: string) => {
    const p = players.find(player => player.userId === uid)
    return p ? p.username : 'Player'
  }

  const getPlayerDetails = (uid: string) => {
    return players.find(p => p.userId === uid)
  }

  const handleLineClick = async (lineId: string) => {
    console.log(`[CLIENT handleLineClick] lineId=${lineId} currentTurn=${currentTurn} currentUserId=${currentUserId} isSubmitting=${isSubmitting} status=${session?.status}`)
    if (session?.status === 'FINISHED' || isSubmitting) return
    if (currentTurn !== currentUserId) {
      addToast('warning', "Not Your Turn", "Please wait for your opponent's move.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/multiplayer/game/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          move: { lineId }
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to draw line')
      }
    } catch (err: any) {
      console.error('[CLIENT handleLineClick ERROR]', err)
      addToast('error', 'Move Error', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

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
        throw new Error(data.error || 'Failed to request play again')
      }
      addToast('success', 'Vote Registered', 'Waiting for opponent to accept play again.')
    } catch (err: any) {
      addToast('error', 'Replay Error', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Active status styles
  const isMyTurn = currentTurn === currentUserId
  const isFinished = session.status === 'FINISHED'
  const winnerId = session.winnerId

  let turnIcon = '🔵'
  let turnText = isMyTurn ? 'Your Turn' : `${getUsername(currentTurn)}'s Turn`
  let turnColor = isMyTurn ? 'hsl(210 100% 55%)' : 'hsl(355 100% 55%)'
  let turnBg = isMyTurn ? 'hsl(210 100% 50% / 0.1)' : 'hsl(355 100% 50% / 0.1)'
  let turnBorder = isMyTurn ? 'hsl(210 100% 50% / 0.3)' : 'hsl(355 100% 50% / 0.3)'

  if (isFinished) {
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
      turnColor = didIWin ? 'hsl(210 100% 55%)' : 'hsl(355 100% 55%)'
      turnBg = didIWin ? 'hsl(210 100% 50% / 0.15)' : 'hsl(355 100% 50% / 0.15)'
      turnBorder = didIWin ? 'hsl(210 100% 50% / 0.4)' : 'hsl(355 100% 50% / 0.4)'
    }
  }

  const myScore = playerScores[currentUserId] || 0
  const opponentScore = playerScores[opponentUserId] || 0

  return (
    <div style={{ maxWidth: 450, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      
      {/* Scoreboard HUD */}
      <div className="card glass" style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center', borderRadius: 16 }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(210 100% 55%)' }}>{myScore}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
            You (Blue)
          </div>
        </div>
        <div style={{ borderLeft: '1px solid hsl(var(--border-subtle))', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(355 100% 55%)' }}>{opponentScore}</div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>
            {getUsername(opponentUserId)} (Red)
          </div>
        </div>
      </div>

      {/* Turn Indicator Banner */}
      <div id="dots-boxes-turn-banner" style={{
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
      }}>
        <span>{turnIcon}</span>
        <span>{turnText}</span>
      </div>

      {/* Responsive Board */}
      <div style={{
        background: 'hsl(222 20% 7%)',
        borderRadius: 18,
        border: '1px solid hsl(var(--border-subtle))',
        aspectRatio: '1',
        width: '100%',
        position: 'relative',
        padding: '24px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          
          {/* 1. Claimed boxes */}
          {Array.from({ length: dotsSize - 1 }).map((_, r) =>
            Array.from({ length: dotsSize - 1 }).map((_, c) => {
              const box = completedBoxes.find((b: any) => b.r === r && b.c === c)
              if (!box) return null

              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent
              const isMine = box.owner === currentUserId

              return (
                <div
                  key={`box-${r}-${c}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${widthPercent}%`,
                    height: `${widthPercent}%`,
                    padding: '8px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: isMine
                        ? 'linear-gradient(135deg, hsl(210 100% 50% / 0.25), hsl(210 100% 40% / 0.15))'
                        : 'linear-gradient(135deg, hsl(355 100% 55% / 0.25), hsl(355 100% 45% / 0.15))',
                      border: isMine
                        ? '1px solid hsl(210 100% 50% / 0.4)'
                        : '1px solid hsl(355 100% 55% / 0.4)',
                      borderRadius: 6,
                      boxShadow: isMine
                        ? '0 0 10px hsl(210 100% 50% / 0.15)'
                        : '0 0 10px hsl(355 100% 55% / 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(0.6rem, 3vw, 0.95rem)',
                      fontWeight: 900,
                      color: isMine ? 'hsl(210 100% 70%)' : 'hsl(355 100% 75%)',
                    }}
                  >
                    {isMine ? 'YOU' : 'OPP'}
                  </div>
                </div>
              )
            })
          )}

          {/* 2. Interactive SVG lines overlay */}
          {Array.from({ length: dotsSize }).map((_, r) =>
            Array.from({ length: dotsSize }).map((_, c) => {
              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent

              const renderHorizontal = c < dotsSize - 1
              const renderVertical = r < dotsSize - 1

              return (
                <React.Fragment key={`lines-${r}-${c}`}>
                  {renderHorizontal && (() => {
                    const lineId = `h-${r}-${c}`
                    const isClaimed = horizontalLines.includes(lineId)
                    const owner = gameState.lineOwners?.[lineId]
                    const isMine = owner === currentUserId

                    const hoverClass = isMyTurn ? 'hover-h-p1' : 'hover-h-p2'

                    return (
                      <div
                        id={`db-line-${lineId}`}
                        onClick={() => handleLineClick(lineId)}
                        style={{
                          position: 'absolute',
                          top: `calc(${top}% - 6px)`,
                          left: `${left}%`,
                          width: `${widthPercent}%`,
                          height: 12,
                          cursor: isClaimed || isFinished || !isMyTurn ? 'default' : 'pointer',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <div
                          style={{
                            width: '100%',
                            height: isClaimed ? 6 : 3,
                            background: isClaimed
                              ? isMine
                                ? 'hsl(210 100% 50%)'
                                : 'hsl(355 100% 55%)'
                              : 'hsl(220 15% 18%)',
                            boxShadow: isClaimed
                              ? isMine
                                ? '0 0 10px hsl(210 100% 50%)'
                                : '0 0 10px hsl(355 100% 55%)'
                              : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: isClaimed ? 1 : 0.25,
                          }}
                          className={`db-line-inner ${!isClaimed && !isFinished && isMyTurn ? hoverClass : ''}`}
                        />
                      </div>
                    )
                  })()}

                  {renderVertical && (() => {
                    const lineId = `v-${r}-${c}`
                    const isClaimed = verticalLines.includes(lineId)
                    const owner = gameState.lineOwners?.[lineId]
                    const isMine = owner === currentUserId

                    const hoverClass = isMyTurn ? 'hover-v-p1' : 'hover-v-p2'

                    return (
                      <div
                        id={`db-line-${lineId}`}
                        onClick={() => handleLineClick(lineId)}
                        style={{
                          position: 'absolute',
                          top: `${top}%`,
                          left: `calc(${left}% - 6px)`,
                          width: 12,
                          height: `${widthPercent}%`,
                          cursor: isClaimed || isFinished || !isMyTurn ? 'default' : 'pointer',
                          zIndex: 10,
                          display: 'flex',
                          justifyContent: 'center'
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: isClaimed ? 6 : 3,
                            background: isClaimed
                              ? isMine
                                ? 'hsl(210 100% 50%)'
                                : 'hsl(355 100% 55%)'
                              : 'hsl(220 15% 18%)',
                            boxShadow: isClaimed
                              ? isMine
                                ? '0 0 10px hsl(210 100% 50%)'
                                : '0 0 10px hsl(355 100% 55%)'
                              : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: isClaimed ? 1 : 0.25,
                          }}
                          className={`db-line-inner ${!isClaimed && !isFinished && isMyTurn ? hoverClass : ''}`}
                        />
                      </div>
                    )
                  })()}
                </React.Fragment>
              )
            })
          )}

          {/* 3. Dot Nodes grid */}
          {Array.from({ length: dotsSize }).map((_, r) =>
            Array.from({ length: dotsSize }).map((_, c) => {
              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent

              return (
                <div
                  key={`dot-${r}-${c}`}
                  style={{
                    position: 'absolute',
                    top: `calc(${top}% - 5px)`,
                    left: `calc(${left}% - 5px)`,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    zIndex: 20,
                    boxShadow: '0 0 8px white, inset 0 0 2px black',
                    pointerEvents: 'none'
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Finished Game Overlay / Controls */}
      {isFinished ? (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '1.5rem', marginTop: '0.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            {winnerId === currentUserId ? '🏆 You Won!' : winnerId === 'DRAW' ? "🤝 Match Tied!" : '💀 You Lost'}
          </h3>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Final Score: {myScore} - {opponentScore}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              onClick={onLeave}
              style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))' }}
            >
              Leave Room
            </button>
            <button
              className="btn btn-primary"
              id="multiplayer-replay-btn"
              disabled={replayVotes[currentUserId] || isSubmitting}
              onClick={handlePlayAgain}
              style={{ flex: 2, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
            >
              {replayVotes[currentUserId] ? '⏳ Waiting...' : '🔄 Play Again'}
            </button>
          </div>
          {replayVotes[opponentUserId] && !replayVotes[currentUserId] && (
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

      {/* Style overrides for hover line triggers */}
      <style jsx global>{`
        .hover-h-p1:hover {
          background: hsl(210 100% 50% / 0.5) !important;
          height: 6px !important;
          box-shadow: 0 0 8px hsl(210 100% 50% / 0.5) !important;
          opacity: 0.8 !important;
        }
        .hover-h-p2:hover {
          background: hsl(355 100% 55% / 0.5) !important;
          height: 6px !important;
          box-shadow: 0 0 8px hsl(355 100% 55% / 0.5) !important;
          opacity: 0.8 !important;
        }
        .hover-v-p1:hover {
          background: hsl(210 100% 50% / 0.5) !important;
          width: 6px !important;
          box-shadow: 0 0 8px hsl(210 100% 50% / 0.5) !important;
          opacity: 0.8 !important;
        }
        .hover-v-p2:hover {
          background: hsl(355 100% 55% / 0.5) !important;
          width: 6px !important;
          box-shadow: 0 0 8px hsl(355 100% 55% / 0.5) !important;
          opacity: 0.8 !important;
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.95; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  )
}
