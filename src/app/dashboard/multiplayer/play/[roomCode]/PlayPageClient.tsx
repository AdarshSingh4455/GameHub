'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHandCricketGame from '@/components/games/MultiplayerHandCricketGame'
import MultiplayerScribbleGame from '@/components/games/MultiplayerScribbleGame'
import MultiplayerDotsBoxesGame from '@/components/games/MultiplayerDotsBoxesGame'
import MultiplayerTicTacToeGame from '@/components/games/MultiplayerTicTacToeGame'
import MultiplayerMemoryMatchGame from '@/components/games/MultiplayerMemoryMatchGame'
import MultiplayerRockPaperScissorsGame from '@/components/games/MultiplayerRockPaperScissorsGame'
import MultiplayerNumberGuessingGame from '@/components/games/MultiplayerNumberGuessingGame'
import MultiplayerHangmanGame from '@/components/games/MultiplayerHangmanGame'
import MultiplayerWhosSpyGame from '@/components/games/MultiplayerWhosSpyGame'
import { useSocket } from '@/lib/contexts/SocketContext'
import SocketDiagnostics from '@/components/layout/SocketDiagnostics'

const SESSION_KEY = 'mp_screen'
const SESSION_ROOM_CODE_KEY = 'mp_lobby_room_code'

interface PlayPageClientProps {
  roomCode: string
}

function getClientId(user: any) {
  if (typeof window !== 'undefined') {
    const cookies = Object.fromEntries(
      document.cookie.split(';').map(c => {
        const eqIdx = c.indexOf('=')
        if (eqIdx === -1) return [c.trim(), '']
        return [c.substring(0, eqIdx).trim(), decodeURIComponent(c.substring(eqIdx + 1).trim())]
      })
    )
    if (cookies['mock_user_id']) return cookies['mock_user_id']
  }
  return user?.id || 'mock-user-id'
}

function clearReconnectState(code?: string) {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_ROOM_CODE_KEY)
    if (code) {
      localStorage.removeItem(`gamehub_room_recovery_${code}`)
    }
  } catch {}
}

export default function PlayPageClient({ roomCode }: PlayPageClientProps) {
  const { user, triggerAd } = useGameSession()
  const { addToast } = useToast()
  const router = useRouter()
  const { socket } = useSocket()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(true)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [recoveryTimedOut, setRecoveryTimedOut] = useState(false)
  const [adTriggered, setAdTriggered] = useState(false)

  const playersRef = useRef<any[]>([])
  playersRef.current = players
  const roomRef = useRef<any>(null)
  roomRef.current = room
  const joinedRef = useRef(false)
  const sessionRef = useRef<any>(null)
  sessionRef.current = session
  const recoveryTimerRef = useRef<NodeJS.Timeout | null>(null)
  const abandonmentTimerRef = useRef<NodeJS.Timeout | null>(null)

  const currentUserId = getClientId(user)

  console.log('[PLAY PAGE CLIENT RENDER]', { socket: !!socket, roomCode, currentUserId })

  // Global handler for stale/missing rooms
  const handleGlobalError = useCallback((errMsg: string) => {
    const isStaleError = ['ROOM_NOT_FOUND', 'SESSION_NOT_FOUND', 'PLAYER_NOT_IN_ROOM', 'Room not found', 'Not authorized to access this match'].includes(errMsg)
    if (isStaleError) {
      addToast('error', 'Match Unavailable', `Redirecting: ${errMsg}`)
      clearReconnectState(roomCode)
      fetch('/api/multiplayer/leave-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode })
      }).catch(() => null)
      router.push('/dashboard/multiplayer')
    }
  }, [roomCode, addToast, router])

  // 1. Recover room state from local storage on mount (non-blocking)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`gamehub_room_recovery_${roomCode}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Ensure cache is not older than 10 minutes
        if (Date.now() - parsed.timestamp < 600000) {
          console.log('[PLAY PAGE CLIENT LOCAL RECOVERY SUCCESS]', parsed)
          setRoom(parsed.room)
          setSession(parsed.session)
          setPlayers(parsed.players)
          setIsLoading(false)
          addToast('success', 'Rejoined Match', 'Rejoined match session successfully!')
        }
      }
    } catch (e) {
      console.error('[PLAY PAGE CLIENT LOCAL RECOVERY FAILED]', e)
    }
  }, [roomCode, addToast])

  // 2. Start 5-second recovery timeout
  useEffect(() => {
    if (isLoading) {
      recoveryTimerRef.current = setTimeout(() => {
        setRecoveryTimedOut(true)
      }, 5000)
    } else {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current)
      }
      setRecoveryTimedOut(false)
    }
    return () => {
      if (recoveryTimerRef.current) {
        clearTimeout(recoveryTimerRef.current)
      }
    }
  }, [isLoading])

  // 3. Client-side abandonment backup check (60s timer if active players <= 1)
  useEffect(() => {
    const isPlaying = session?.status === 'PLAYING'
    const activePlayersCount = players.filter(p => p.status !== 'LEFT' && p.status !== 'OFFLINE').length

    if (isPlaying && activePlayersCount <= 1) {
      if (!abandonmentTimerRef.current) {
        console.log('[PLAY PAGE CLIENT] Opponent missing. Starting 60s abandonment timer...')
        abandonmentTimerRef.current = setTimeout(() => {
          console.warn('[PLAY PAGE CLIENT] 60s abandonment timeout reached. Exiting stale match.')
          addToast('warning', 'Match Abandoned', 'The match has been abandoned due to insufficient players.')
          clearReconnectState(roomCode)
          fetch('/api/multiplayer/leave-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomCode })
          }).catch(() => null)
          router.push('/dashboard/multiplayer')
        }, 60000)
      }
    } else {
      if (abandonmentTimerRef.current) {
        console.log('[PLAY PAGE CLIENT] Opponent returned. Clearing abandonment timer.')
        clearTimeout(abandonmentTimerRef.current)
        abandonmentTimerRef.current = null
      }
    }

    return () => {
      if (abandonmentTimerRef.current) {
        clearTimeout(abandonmentTimerRef.current)
        abandonmentTimerRef.current = null
      }
    }
  }, [players, session?.status, roomCode, router, addToast])

  // 4. Intercept browser back navigation
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)

    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState(null, '', window.location.href)
      setShowLeaveConfirm(true)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    console.log('[PLAY PAGE CLIENT EFFECT RUN]', { socket: !!socket, roomCode })
    if (!socket) return

    joinedRef.current = false

    const joinGameRoom = () => {
      if (joinedRef.current) return
      joinedRef.current = true
      console.log('[PLAY PAGE CLIENT JOIN GAME EMIT]', { roomCode })
      socket.emit('join-game', { roomCode }, (response: any) => {
        console.log('[PLAY PAGE CLIENT JOIN GAME CALLBACK]', { response })
        if (response?.error) {
          setError(response.error)
          setIsLoading(false)
          handleGlobalError(response.error)
        }
      })
    }

    joinGameRoom()

    const handleReconnect = () => {
      setIsConnected(true)
      joinedRef.current = false
      joinGameRoom()
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    socket.on('connect', handleReconnect)
    socket.on('disconnect', handleDisconnect)
    setIsConnected(socket.connected)

    socket.on('game-state', (data: any) => {
      console.log('[PLAY PAGE CLIENT GAME STATE RECEIVED]', { gameSlug: data.gameSession?.gameSlug, status: data.gameSession?.status })
      const sessionData = data.gameSession ? {
        ...data.gameSession,
        clockOffset: data.serverTime ? Date.now() - data.serverTime : 0,
        serverTime: data.serverTime || null
      } : null
      setSession(sessionData)
      setRoom(data.room)
      setPlayers(data.players || [])
      setIsLoading(false)
      setError(null)

      // Sync active playing match to local recovery cache
      if (data.room && data.room.status === 'PLAYING') {
        localStorage.setItem(`gamehub_room_recovery_${roomCode}`, JSON.stringify({
          room: data.room,
          session: sessionData,
          players: data.players || [],
          timestamp: Date.now()
        }))
      }
    })

    socket.on('game-update', (data: any) => {
      setSession((prev: any) => {
        if (!prev) return null
        const updated = {
          ...prev,
          gameState: data.gameState,
          winnerId: data.winnerId,
          status: data.gameFinished ? 'FINISHED' : 'PLAYING',
          lastMove: data.lastMove,
          clockOffset: data.serverTime ? Date.now() - data.serverTime : (prev.clockOffset || 0),
          serverTime: data.serverTime || prev.serverTime || null
        }
        // Auto-clear reconnect state when match is definitively finished
        if (data.gameFinished) {
          clearReconnectState(roomCode)
        } else {
          // Sync update to cache
          localStorage.setItem(`gamehub_room_recovery_${roomCode}`, JSON.stringify({
            room: roomRef.current,
            session: updated,
            players: playersRef.current,
            timestamp: Date.now()
          }))
        }
        return updated
      })
    })

    socket.on('player-disconnected', ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(p => p.userId === userId)
      const name = p ? p.username : 'Opponent'
      addToast('warning', 'Opponent Disconnected', `${name} disconnected. Match will forfeit in 60s.`)
      setPlayers(prev => prev.map(pl => pl.userId === userId ? { ...pl, status: 'DISCONNECTED' } : pl))
    })

    socket.on('player-reconnected', ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(p => p.userId === userId)
      const name = p ? p.username : 'Opponent'
      addToast('success', 'Opponent Returned', `${name} reconnected. Match resuming.`)
      setPlayers(prev => prev.map(pl => pl.userId === userId ? { ...pl, status: 'READY' } : pl))
    })

    return () => {
      socket.off('connect', handleReconnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('game-state')
      socket.off('game-update')
      socket.off('player-disconnected')
      socket.off('player-reconnected')
    }
  }, [socket, roomCode, addToast])

  // Trigger multiplayer ad before showing final result screen
  useEffect(() => {
    if (session) {
      if (session.status === 'FINISHED') {
        if (!adTriggered) {
          setAdTriggered(true)
          console.log('[PLAY PAGE CLIENT] Triggering ad fail-safe before results.')
          triggerAd(session.gameSlug, () => {
            console.log('[PLAY PAGE CLIENT] Multiplayer ad complete.')
          })
        }
      } else if (session.status === 'PLAYING') {
        setAdTriggered(false)
      }
    }
  }, [session?.status, adTriggered, triggerAd, session?.gameSlug])

  const handleLeaveRoom = useCallback(() => {
    setShowLeaveConfirm(true)
  }, [])

  const handleRetryRecovery = useCallback(() => {
    setError(null)
    setRecoveryTimedOut(false)
    setIsLoading(true)
    joinedRef.current = false

    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
    recoveryTimerRef.current = setTimeout(() => {
      setRecoveryTimedOut(true)
    }, 5000)

    if (socket) {
      socket.emit('join-game', { roomCode }, (response: any) => {
        if (response?.error) {
          setError(response.error)
          setIsLoading(false)
          handleGlobalError(response.error)
        }
      })
    }
  }, [socket, roomCode, handleGlobalError])

  const confirmLeave = useCallback(() => {
    setIsLeaving(true)
    const cleanup = () => {
      clearReconnectState(roomCode)
      addToast('info', 'Left Room', 'You have left the match.')
      router.push('/dashboard/multiplayer')
    }

    // Call POST API as fallback first
    fetch('/api/multiplayer/leave-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode })
    }).catch(() => null)

    if (socket && room?.id) {
      socket.emit('leave-room', { roomId: room.id }, () => {
        cleanup()
      })
    } else {
      cleanup()
    }
  }, [socket, room, router, addToast, roomCode])

  // Leave confirm modal
  const LeaveConfirmModal = () => {
    if (!showLeaveConfirm) return null
    const isMatchFinished = session?.status === 'FINISHED'
    return (
      <div
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(5,8,16,0.85)',
          backdropFilter: 'blur(8px)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}
        onClick={() => !isLeaving && setShowLeaveConfirm(false)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'linear-gradient(185deg, hsl(222 20% 10%), hsl(222 18% 14%))',
            border: '1px solid hsl(220 15% 22%)',
            borderRadius: 20, padding: '2rem', maxWidth: 400, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚪</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>
            {isMatchFinished ? 'Leave Match?' : 'Forfeit & Leave?'}
          </h3>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {isMatchFinished
              ? 'The match is over. Ready to head back to the lobby?'
              : 'Leaving now will count as a forfeit and your opponent wins the match.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12 }}
              onClick={() => setShowLeaveConfirm(false)}
              disabled={isLeaving}
            >
              Cancel
            </button>
            <button
              className="btn"
              style={{
                flex: 1, borderRadius: 12,
                background: 'linear-gradient(135deg, hsl(0 80% 50%), hsl(0 70% 40%))',
                color: 'white', border: 'none', fontWeight: 700
              }}
              onClick={confirmLeave}
              disabled={isLeaving}
              id="confirm-leave-match-btn"
            >
              {isLeaving ? 'Leaving...' : 'Leave'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && recoveryTimedOut) {
    return (
      <div className="card glass text-center" style={{ maxWidth: 500, margin: '4rem auto', padding: '2.5rem' }}>
        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>⏱️</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'hsl(var(--warning))' }}>Room could not be restored</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          The connection timed out while trying to restore the match.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, borderRadius: 12 }}
            onClick={handleRetryRecovery}
          >
            Retry
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, borderRadius: 12 }}
            onClick={confirmLeave}
            disabled={isLeaving}
          >
            {isLeaving ? 'Leaving...' : 'Leave Room'}
          </button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', color: 'hsl(var(--text-primary))'
      }}>
        <div style={{
          width: 50, height: 50,
          border: '4px solid hsl(var(--border-subtle))',
          borderTop: '4px solid hsl(var(--brand-primary))',
          borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1.5rem'
        }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Match session...</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Connecting to room {roomCode}...
        </p>
        <button
          className="btn btn-secondary"
          style={{ marginTop: '2rem', padding: '0.5rem 2rem', borderRadius: 12 }}
          onClick={confirmLeave}
          disabled={isLeaving}
        >
          {isLeaving ? 'Leaving...' : 'Leave Room'}
        </button>
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card glass text-center" style={{ maxWidth: 500, margin: '4rem auto', padding: '2.5rem' }}>
        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>⚠️</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'hsl(var(--danger))' }}>Connection Error</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          {error}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1, borderRadius: 12 }}
            onClick={() => router.push('/dashboard/multiplayer')}
          >
            Back to Lobby
          </button>
          <button
            className="btn btn-secondary"
            style={{ flex: 1, borderRadius: 12 }}
            onClick={confirmLeave}
            disabled={isLeaving}
          >
            {isLeaving ? 'Leaving...' : 'Leave Room'}
          </button>
        </div>
      </div>
    )
  }

  const isPlayer = players.some(p => p.userId === currentUserId)
  if (!isPlayer) {
    return (
      <div className="card glass text-center" style={{ maxWidth: 500, margin: '4rem auto', padding: '2.5rem' }}>
        <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>🚫</span>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: 'hsl(var(--warning))' }}>Access Denied</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          You are not registered as a player in this room.
        </p>
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => router.push('/dashboard/multiplayer')}
        >
          Back to Lobby
        </button>
      </div>
    )
  }

  const gameProps = { roomCode, session, players, currentUserId, onLeave: handleLeaveRoom }

  return (
    <>
      {/* Disconnect Banner */}
      {!isConnected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, hsl(38 95% 50%), hsl(38 95% 40%))',
          color: 'hsl(220 20% 10%)', textAlign: 'center', padding: '0.6rem 1rem',
          fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '0.5rem'
        }}>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: '1rem' }}>⚡</span>
          Connection lost — attempting to reconnect...
        </div>
      )}

      <LeaveConfirmModal />

      {session?.gameSlug === 'cricket' && (
        <div className="game-safe-bottom">
          <MultiplayerHandCricketGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'dots-boxes' && (
        <div className="game-safe-bottom">
          <MultiplayerDotsBoxesGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'tic-tac-toe' && (
        <div className="game-safe-bottom">
          <MultiplayerTicTacToeGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'memory' && (
        <div className="game-safe-bottom">
          <MultiplayerMemoryMatchGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'rps' && (
        <div className="game-safe-bottom">
          <MultiplayerRockPaperScissorsGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'number-guessing' && (
        <div className="game-safe-bottom">
          <MultiplayerNumberGuessingGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'scribble' && (
        <div className="game-safe-bottom">
          <MultiplayerScribbleGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'hangman' && (
        <div className="game-safe-bottom">
          <MultiplayerHangmanGame {...gameProps} />
        </div>
      )}

      {session?.gameSlug === 'whos-spy' && (
        <div className="game-safe-bottom">
          <MultiplayerWhosSpyGame {...gameProps} />
        </div>
      )}

      {session && !['cricket','dots-boxes','tic-tac-toe','memory','rps','number-guessing','scribble','hangman','whos-spy'].includes(session.gameSlug) && (
        <div className="card glass text-center" style={{ maxWidth: 500, margin: '4rem auto', padding: '2.5rem' }}>
          <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>❓</span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Unknown Game Mode</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            The game mode &quot;{session?.gameSlug}&quot; is not currently supported in multiplayer.
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLeaveRoom}>
            Leave Match
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <SocketDiagnostics
        roomCode={roomCode}
        roomOwner={room?.hostUserId ? (room.hostUserId === currentUserId ? 'You' : 'Opponent') : undefined}
      />
    </>
  )
}
