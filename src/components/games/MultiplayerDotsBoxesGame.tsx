'use client'
import { TrophyIcon, UsersIcon, HistoryIcon, FrownIcon, FlagIcon, GamepadIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useSocket } from '@/lib/contexts/SocketContext'
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
  const { socket } = useSocket()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [optimisticLines, setOptimisticLines] = useState<string[]>([])
  
  const [lastMoveLine, setLastMoveLine] = useState<string | null>(null)
  const [showGlow, setShowGlow] = useState(false)
  const wasMyTurnRef = useRef(false)

  const gameState = session.gameState || {}
  const { horizontalLines = [], verticalLines = [], completedBoxes = [], playerScores = {}, currentTurn, replayVotes = {}, dotsSize = 6 } = gameState

  // Synchronize optimisticLines and reset isSubmitting on official state changes
  useEffect(() => {
    setOptimisticLines(prev => prev.filter(l => !horizontalLines.includes(l) && !verticalLines.includes(l)))
    setIsSubmitting(false)
  }, [horizontalLines, verticalLines, currentTurn, session.status])

  // Track lastMove highlight
  useEffect(() => {
    if (session.lastMove?.move?.lineId) {
      setLastMoveLine(session.lastMove.move.lineId)
      setShowGlow(true)
      const timer = setTimeout(() => {
        setShowGlow(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [session.lastMove])

  // Trigger synthesized audio on turn transition to Me
  useEffect(() => {
    const isMyTurn = currentTurn === currentUserId
    if (isMyTurn && !wasMyTurnRef.current && session.status === 'PLAYING') {
      playTurnNotificationSound()
    }
    wasMyTurnRef.current = isMyTurn
  }, [currentTurn, currentUserId, session.status])

  const allHorizontal = Array.from(new Set([...horizontalLines, ...optimisticLines.filter(l => l.startsWith('h-'))]))
  const allVertical = Array.from(new Set([...verticalLines, ...optimisticLines.filter(l => l.startsWith('v-'))]))

  const opponentUserId = players.find(p => p.userId !== currentUserId)?.userId || ''

  const getUsername = (uid: string) => {
    if (!uid) return 'Player'
    const p = players.find(player => player.userId === uid)
    if (p?.username) return p.username
    const index = players.findIndex(player => player.userId === uid)
    if (index === 0) return 'Blue'
    if (index === 1) return 'Red'
    return uid === currentUserId ? 'Blue' : 'Red'
  }

  const getPlayerDetails = (uid: string) => {
    return players.find(p => p.userId === uid)
  }

  const handleLineClick = (lineId: string) => {
    console.log(`[CLIENT handleLineClick] lineId=${lineId} currentTurn=${currentTurn} currentUserId=${currentUserId} isSubmitting=${isSubmitting} status=${session?.status}`)
    if (session?.status === 'FINISHED' || isSubmitting) return
    if (currentTurn !== currentUserId) {
      addToast('warning', "Not Your Turn", "Please wait for your opponent's move.")
      return
    }
    if (horizontalLines.includes(lineId) || verticalLines.includes(lineId) || optimisticLines.includes(lineId)) {
      return // Already claimed
    }
    if (!socket) return

    // Optimistically draw the line locally
    setOptimisticLines(prev => [...prev, lineId])
    setIsSubmitting(true)

    socket.emit('submit-move', { roomCode, move: { lineId } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        console.error('[CLIENT handleLineClick ERROR]', res.error)
        addToast('error', 'Move Error', res.error)
        // Rollback on rejection
        setOptimisticLines(prev => prev.filter(id => id !== lineId))
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

  // Active status styles
  const isMyTurn = currentTurn === currentUserId
  const isFinished = session.status === 'FINISHED'
  const winnerId = session.winnerId

  let turnIcon: React.ReactNode = <GamepadIcon size={14} className="inline mr-1" />
  let turnText = isMyTurn ? 'Your Turn' : `${getUsername(currentTurn)}'s Turn`
  let turnColor = isMyTurn ? 'hsl(210 100% 55%)' : 'hsl(355 100% 55%)'
  let turnBg = isMyTurn ? 'hsl(210 100% 50% / 0.1)' : 'hsl(355 100% 50% / 0.1)'
  let turnBorder = isMyTurn ? 'hsl(210 100% 50% / 0.3)' : 'hsl(355 100% 50% / 0.3)'

  if (isFinished) {
    if (winnerId === 'DRAW' || !winnerId) {
      turnIcon = <UsersIcon size={14} className="inline mr-1" />
      turnText = "It's a Tie!"
      turnColor = 'hsl(45 100% 55%)'
      turnBg = 'hsl(45 100% 50% / 0.1)'
      turnBorder = 'hsl(45 100% 50% / 0.3)'
    } else {
      const didIWin = winnerId === currentUserId
      turnIcon = <TrophyIcon size={14} className="inline mr-1 text-yellow-400" />
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
      
      {/* Polished Multiplayer Header */}
      <MultiplayerHeader
        players={players}
        currentUserId={currentUserId}
        currentTurn={currentTurn}
        turnExpiration={gameState.turnExpiration}
        scores={playerScores}
        gameFinished={isFinished}
      />

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
                    const isClaimed = allHorizontal.includes(lineId)
                    const isOptimistic = optimisticLines.includes(lineId)
                    const owner = gameState.lineOwners?.[lineId]
                    const isMine = owner === currentUserId || isOptimistic

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
                            height: isClaimed ? (lineId === lastMoveLine && showGlow ? 8 : 6) : 3,
                            background: lineId === lastMoveLine && showGlow
                              ? 'hsl(45 100% 55%)'
                              : isClaimed
                                ? isMine
                                  ? 'hsl(210 100% 50%)'
                                  : 'hsl(355 100% 55%)'
                                : 'hsl(220 15% 18%)',
                            boxShadow: lineId === lastMoveLine && showGlow
                              ? '0 0 20px hsl(45 100% 55%), 0 0 8px hsl(45 100% 55%)'
                              : isClaimed
                                ? isMine
                                  ? '0 0 10px hsl(210 100% 50%)'
                                  : '0 0 10px hsl(355 100% 55%)'
                                : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: lineId === lastMoveLine && showGlow
                              ? 1
                              : isClaimed 
                                ? isOptimistic ? 0.6 : 1 
                                : 0.25,
                            border: isOptimistic ? '1px dashed hsl(210 100% 70% / 0.5)' : 'none'
                          }}
                          className={`db-line-inner ${!isClaimed && !isFinished && isMyTurn ? hoverClass : ''}`}
                        />
                      </div>
                    )
                  })()}

                  {renderVertical && (() => {
                    const lineId = `v-${r}-${c}`
                    const isClaimed = allVertical.includes(lineId)
                    const isOptimistic = optimisticLines.includes(lineId)
                    const owner = gameState.lineOwners?.[lineId]
                    const isMine = owner === currentUserId || isOptimistic

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
                            width: isClaimed ? (lineId === lastMoveLine && showGlow ? 8 : 6) : 3,
                            background: lineId === lastMoveLine && showGlow
                              ? 'hsl(45 100% 55%)'
                              : isClaimed
                                ? isMine
                                  ? 'hsl(210 100% 50%)'
                                  : 'hsl(355 100% 55%)'
                                : 'hsl(220 15% 18%)',
                            boxShadow: lineId === lastMoveLine && showGlow
                              ? '0 0 20px hsl(45 100% 55%), 0 0 8px hsl(45 100% 55%)'
                              : isClaimed
                                ? isMine
                                  ? '0 0 10px hsl(210 100% 50%)'
                                  : '0 0 10px hsl(355 100% 55%)'
                                : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: lineId === lastMoveLine && showGlow
                              ? 1
                              : isClaimed 
                                ? isOptimistic ? 0.6 : 1 
                                : 0.25,
                            border: isOptimistic ? '1px dashed hsl(210 100% 70% / 0.5)' : 'none'
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
            {winnerId === currentUserId ? <span>🏆 You Won!</span> : winnerId === 'DRAW' ? <span>🤝 Match Tied!</span> : <span>💀 You Lost</span>}
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
              {replayVotes[currentUserId] ? 'Waiting...' : 'Play Again'}
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
            Leave Match
          </button>
        </div>
      )}

      {/* Live Match reactions triggers & float overlay */}
      {session.status === 'PLAYING' && (
        <MatchReactions
          socket={socket}
          roomCode={roomCode}
          currentUserId={currentUserId}
          players={players}
        />
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
