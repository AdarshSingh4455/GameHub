'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHandCricketGame from '@/components/games/MultiplayerHandCricketGame'
import MultiplayerDotsBoxesGame from '@/components/games/MultiplayerDotsBoxesGame'
import MultiplayerTicTacToeGame from '@/components/games/MultiplayerTicTacToeGame'
import { useSocket } from '@/lib/contexts/SocketContext'

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

export default function PlayPageClient({ roomCode }: PlayPageClientProps) {
  const { user } = useGameSession()
  const { addToast } = useToast()
  const router = useRouter()
  const { socket } = useSocket()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])

  const playersRef = useRef<any[]>([])
  playersRef.current = players
  // Guard: prevent emitting join-game twice when socket fires both the
  // immediate call AND the 'connect' event during an initial connection.
  const joinedRef = useRef(false)

  const currentUserId = getClientId(user)

  console.log('[PLAY PAGE CLIENT RENDER]', { socket: !!socket, roomCode, currentUserId })

  useEffect(() => {
    console.log('[PLAY PAGE CLIENT EFFECT RUN]', { socket: !!socket, roomCode })
    if (!socket) return

    // Reset join guard when effect re-runs (new socket instance or roomCode)
    joinedRef.current = false

    const joinGameRoom = () => {
      if (joinedRef.current) return  // Suppress duplicate emits on the same connection
      joinedRef.current = true
      console.log('[PLAY PAGE CLIENT JOIN GAME EMIT]', { roomCode })
      socket.emit('join-game', { roomCode }, (response: any) => {
        console.log('[PLAY PAGE CLIENT JOIN GAME CALLBACK]', { response })
        if (response?.error) {
          setError(response.error)
          setIsLoading(false)
        }
      })
    }

    // Join game room immediately
    joinGameRoom()

    // Re-join on reconnection (reset guard first so the re-join is allowed)
    const handleReconnect = () => {
      joinedRef.current = false
      joinGameRoom()
    }
    socket.on('connect', handleReconnect)

    // Set up event listeners
    socket.on('game-state', (data: any) => {
      console.log('[PLAY PAGE CLIENT GAME STATE RECEIVED]', { gameSlug: data.gameSession?.gameSlug, status: data.gameSession?.status })
      setSession((prev: any) => {
        // Never overwrite a FINISHED session with stale PLAYING data
        if (prev?.status === 'FINISHED' && data.gameSession?.status !== 'FINISHED') {
          return prev
        }
        return data.gameSession
      })
      setRoom(data.room)
      setPlayers(data.players || [])
      setIsLoading(false)
      setError(null)
    })

    socket.on('game-update', (data: any) => {
      // Update session state locally
      setSession((prev: any) => {
        if (!prev) return null
        return {
          ...prev,
          gameState: data.gameState,
          winnerId: data.winnerId,
          status: data.gameFinished ? 'FINISHED' : prev.status
        }
      })
    })

    socket.on('player-disconnected', ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(p => p.userId === userId)
      const name = p ? p.username : 'Opponent'
      addToast('warning', 'Opponent Disconnected', `${name} disconnected. Match will forfeit in 30s.`)
    })

    socket.on('player-reconnected', ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(p => p.userId === userId)
      const name = p ? p.username : 'Opponent'
      addToast('success', 'Opponent Returned', `${name} reconnected. Match resuming.`)
    })

    return () => {
      socket.off('connect', handleReconnect)
      socket.off('game-state')
      socket.off('game-update')
      socket.off('player-disconnected')
      socket.off('player-reconnected')
    }
  }, [socket, roomCode, addToast])

  const handleLeaveRoom = () => {
    if (!socket || !room) {
      router.push('/dashboard/multiplayer')
      return
    }
    setIsLoading(true)
    socket.emit('leave-room', { roomId: room.id }, (response: any) => {
      setIsLoading(false)
      addToast('info', 'Left Room', 'You have left the match.')
      router.push('/dashboard/multiplayer')
    })
  }

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'hsl(var(--text-primary))'
      }}>
        <div style={{
          width: 50,
          height: 50,
          border: '4px solid hsl(var(--border-subtle))',
          borderTop: '4px solid hsl(var(--brand-primary))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1.5rem'
        }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading Match session...</h2>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Connecting to room {roomCode}...
        </p>
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
        <button
          className="btn btn-primary"
          style={{ width: '100%' }}
          onClick={() => router.push('/dashboard/multiplayer')}
        >
          Back to Multiplayer Lobby
        </button>
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

  if (session?.gameSlug === 'cricket') {
    return (
      <div className="game-safe-bottom">
        <MultiplayerHandCricketGame
          roomCode={roomCode}
          session={session}
          players={players}
          currentUserId={currentUserId}
          onLeave={handleLeaveRoom}
        />
      </div>
    )
  }

  if (session?.gameSlug === 'dots-boxes') {
    return (
      <div className="game-safe-bottom">
        <MultiplayerDotsBoxesGame
          roomCode={roomCode}
          session={session}
          players={players}
          currentUserId={currentUserId}
          onLeave={handleLeaveRoom}
        />
      </div>
    )
  }

  if (session?.gameSlug === 'tic-tac-toe') {
    return (
      <div className="game-safe-bottom">
        <MultiplayerTicTacToeGame
          roomCode={roomCode}
          session={session}
          players={players}
          currentUserId={currentUserId}
          onLeave={handleLeaveRoom}
        />
      </div>
    )
  }

  return (
    <div className="card glass text-center" style={{ maxWidth: 500, margin: '4rem auto', padding: '2.5rem' }}>
      <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '1rem' }}>❓</span>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>Unknown Game Mode</h2>
      <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        The game mode &quot;{session?.gameSlug}&quot; is not currently supported in multiplayer.
      </p>
      <button
        className="btn btn-primary"
        style={{ width: '100%' }}
        onClick={handleLeaveRoom}
      >
        Leave Match
      </button>
    </div>
  )
}
