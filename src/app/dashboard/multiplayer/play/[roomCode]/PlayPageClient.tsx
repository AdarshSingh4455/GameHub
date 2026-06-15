'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHandCricketGame from '@/components/games/MultiplayerHandCricketGame'
import MultiplayerDotsBoxesGame from '@/components/games/MultiplayerDotsBoxesGame'

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

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [room, setRoom] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])

  const currentUserId = getClientId(user)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let isPollingActive = true

    const fetchGameSession = async () => {
      try {
        const res = await fetch(`/api/multiplayer/game/${roomCode}?t=${Date.now()}`, { cache: 'no-store' })
        if (!isPollingActive) return
        if (!res.ok) {
          if (res.status === 404) {
            console.log(`[PLAY PAGE RECONNECT FAIL] 404 received for roomCode=${roomCode}. Cleaning up...`)
            if (pollingIntervalRef.current) {
              clearTimeout(pollingIntervalRef.current)
            }
            try {
              sessionStorage.removeItem('mp_screen')
              sessionStorage.removeItem('mp_lobby_room_code')
              localStorage.removeItem('mp_screen')
              localStorage.removeItem('mp_lobby_room_code')
            } catch (e) {}
            addToast('warning', 'Previous match expired', 'Previous match expired')
            router.push('/dashboard/multiplayer')
            return
          }
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to fetch game session')
        }
        const data = await res.json()
        if (!isPollingActive) return
        setRoom(data.room)
        setSession(data.gameSession)
        setPlayers(data.players || [])
        setIsLoading(false)
        setError(null)
      } catch (err: any) {
        if (!isPollingActive) return
        console.error('Error polling game session:', err)
        setError(err.message)
        setIsLoading(false)
      } finally {
        if (isPollingActive) {
          pollingIntervalRef.current = setTimeout(fetchGameSession, 1000)
        }
      }
    }

    fetchGameSession()

    return () => {
      isPollingActive = false
      if (pollingIntervalRef.current) {
        clearTimeout(pollingIntervalRef.current)
      }
    }
  }, [roomCode, router, addToast])

  const handleLeaveRoom = async () => {
    if (pollingIntervalRef.current) {
      clearTimeout(pollingIntervalRef.current)
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/multiplayer/leave-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room?.id })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to leave room')
      }
      addToast('info', 'Left Room', 'You have left the match.')
      router.push('/dashboard/multiplayer')
    } catch (err: any) {
      addToast('error', 'Error Leaving', err.message)
      router.push('/dashboard/multiplayer')
    }
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
      <MultiplayerHandCricketGame
        roomCode={roomCode}
        session={session}
        players={players}
        currentUserId={currentUserId}
        onLeave={handleLeaveRoom}
      />
    )
  }

  if (session?.gameSlug === 'dots-boxes') {
    return (
      <MultiplayerDotsBoxesGame
        roomCode={roomCode}
        session={session}
        players={players}
        currentUserId={currentUserId}
        onLeave={handleLeaveRoom}
      />
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
