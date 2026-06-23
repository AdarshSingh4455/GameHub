'use client'

import React, { useEffect, useState } from 'react'
import Avatar from '@/components/shared/Avatar'

interface Player {
  userId: string
  username: string
  status?: string
  avatarUrl?: string | null
  level?: number
  selectedFrame?: string | null
  selectedTitle?: string | null
}

interface MultiplayerHeaderProps {
  players: Player[]
  currentUserId: string
  currentTurn: string | null
  turnExpiration: string | null
  scores: Record<string, number>
  gameFinished: boolean
}

export default function MultiplayerHeader({
  players,
  currentUserId,
  currentTurn,
  turnExpiration,
  scores,
  gameFinished
}: MultiplayerHeaderProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [disconnectCountdown, setDisconnectCountdown] = useState<Record<string, number>>({})

  // Turn timer tick effect
  useEffect(() => {
    if (!turnExpiration || gameFinished) {
      setTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const expTime = new Date(turnExpiration).getTime()
      const diff = Math.max(0, Math.ceil((expTime - Date.now()) / 1000))
      setTimeLeft(diff)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [turnExpiration, gameFinished])

  // Disconnection countdown effect
  useEffect(() => {
    const disconnectedPlayers = players.filter(p => p.status === 'DISCONNECTED')
    if (disconnectedPlayers.length === 0 || gameFinished) {
      setDisconnectCountdown({})
      return
    }

    // Set initial 60s for any disconnected player if not already tracking
    setDisconnectCountdown(prev => {
      const next = { ...prev }
      disconnectedPlayers.forEach(p => {
        if (next[p.userId] === undefined) {
          next[p.userId] = 60
        }
      })
      return next
    })

    const interval = setInterval(() => {
      setDisconnectCountdown(prev => {
        const next = { ...prev }
        let changed = false
        Object.keys(next).forEach(uid => {
          if (next[uid] > 0) {
            next[uid] -= 1
            changed = true
          }
        })
        return changed ? next : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [players, gameFinished])

  // Split into self and opponent
  const activePlayers = [...players.slice(0, 2)]
  if (activePlayers.length === 1) {
    activePlayers.push({
      userId: 'opponent-placeholder',
      username: 'Waiting for opponent...',
      avatarUrl: null,
      level: 1,
      status: 'LEFT',
      selectedFrame: null,
      selectedTitle: null
    })
  } else if (activePlayers.length === 0) {
    activePlayers.push(
      {
        userId: currentUserId,
        username: 'Player (You)',
        avatarUrl: null,
        level: 1,
        status: 'READY',
        selectedFrame: null,
        selectedTitle: null
      },
      {
        userId: 'opponent-placeholder',
        username: 'Waiting for opponent...',
        avatarUrl: null,
        level: 1,
        status: 'LEFT',
        selectedFrame: null,
        selectedTitle: null
      }
    )
  }

  const renderPlayerBlock = (player: Player, isLeft: boolean) => {
    const isMe = player.userId === currentUserId
    const isTheirTurn = currentTurn === player.userId && !gameFinished
    const isDisconnected = player.status === 'DISCONNECTED'
    const isOffline = player.status === 'OFFLINE' || player.status === 'LEFT'
    
    // Presence color & label
    let presenceDot = '🟢'
    let presenceText = 'Active'
    let presenceColor = 'hsl(142 70% 50%)'

    if (isDisconnected) {
      const count = disconnectCountdown[player.userId] ?? 60
      presenceDot = '🟡'
      presenceText = `Reconnecting (${count}s)`
      presenceColor = 'hsl(45 100% 55%)'
    } else if (isOffline) {
      presenceDot = '⚪'
      presenceText = 'Offline'
      presenceColor = 'hsl(220 10% 45%)'
    }

    const themeColor = isLeft ? 'hsl(210 100% 55%)' : 'hsl(355 100% 55%)'
    const scoreVal = scores[player.userId] ?? 0

    return (
      <div style={{
        flex: 1,
        padding: '0.75rem 1rem',
        borderRadius: 16,
        background: isTheirTurn 
          ? `linear-gradient(135deg, hsl(222 20% 10%), ${isLeft ? 'hsl(210 100% 50% / 0.05)' : 'hsl(355 100% 50% / 0.05)'})` 
          : 'hsl(222 20% 8% / 0.6)',
        border: `1px solid ${isTheirTurn ? themeColor : 'hsl(220 15% 18%)'}`,
        boxShadow: isTheirTurn ? `0 0 15px ${themeColor}15` : 'none',
        display: 'flex',
        flexDirection: isLeft ? 'row' : 'row-reverse',
        alignItems: 'center',
        gap: '0.85rem',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        position: 'relative',
      }}>
        {/* Turn indicator border-glow */}
        {isTheirTurn && (
          <div style={{
            position: 'absolute',
            top: -1, left: -1, right: -1, bottom: -1,
            borderRadius: 16,
            border: `1.5px solid ${themeColor}`,
            pointerEvents: 'none',
            boxShadow: `0 0 12px ${themeColor}33`,
            animation: 'pulse-glow 2s infinite ease-in-out',
            zIndex: 1
          }} />
        )}

        {/* Player Avatar */}
        <Avatar
          avatarUrl={player.avatarUrl}
          username={player.username}
          selectedFrame={player.selectedFrame}
          size={36}
        />

        {/* Player Info Text Column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem',
          flex: 1,
          alignItems: isLeft ? 'flex-start' : 'flex-end',
          textAlign: isLeft ? 'left' : 'right'
        }}>
          {/* Username & Presence status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isLeft && <span style={{ fontSize: '0.75rem', color: presenceColor }}>{presenceDot}</span>}
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isMe ? 'white' : 'hsl(220 10% 85%)' }}>
              {player.username} {isMe && '(You)'}
            </span>
            {!isLeft && <span style={{ fontSize: '0.75rem', color: presenceColor }}>{presenceDot}</span>}
          </div>

          {/* Level / Title */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.7rem', color: isDisconnected ? presenceColor : 'hsl(220 10% 55%)', fontWeight: 600 }}>
            {player.selectedTitle && (
              <span style={{ color: 'hsl(45 100% 55%)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                {player.selectedTitle}
              </span>
            )}
            <span>{isDisconnected ? presenceText : `Lvl ${player.level || 1}`}</span>
          </div>

          {/* Score & Timer section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isLeft ? 'flex-start' : 'flex-end',
            gap: '8px',
            marginTop: '0.1rem'
          }}>
            <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', fontWeight: 700 }}>
              Score: <span style={{ color: themeColor, fontSize: '0.85rem', fontWeight: 900 }}>{scoreVal}</span>
            </div>
            
            <div style={{ borderLeft: '1px solid hsl(220 15% 18%)', height: '10px', margin: '0 2px' }} />

            <div>
              {isTheirTurn ? (
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 900,
                  color: timeLeft !== null && timeLeft < 10 ? 'hsl(355 100% 60%)' : 'white',
                  animation: timeLeft !== null && timeLeft < 10 ? 'pulse-fast 1s infinite' : 'none'
                }}>
                  ⏱ {timeLeft ?? 60}s
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 45%)', fontWeight: 600 }}>
                  Waiting
                </span>
              )}
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes pulse-glow {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          @keyframes pulse-fast {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      width: '100%',
      marginBottom: '0.5rem'
    }}>
      {renderPlayerBlock(activePlayers[0], true)}
      {renderPlayerBlock(activePlayers[1], false)}
    </div>
  )
}
