'use client'

import { useState } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'

type Phase = 'lobby' | 'room'

export default function ScribbleLobby() {
  const [phase, setPhase]       = useState<Phase>('lobby')
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function createRoom() {
    if (!username.trim()) { setError('Enter a username first'); return }
    setLoading(true)
    setError('')

    const socket = io(SOCKET_URL)
    socket.emit('create-room', { username, gameSlug: 'scribble', settings: {} }, (code: string) => {
      setRoomCode(code)
      setPhase('room')
      setLoading(false)
    })
  }

  async function joinRoom() {
    if (!username.trim()) { setError('Enter a username first'); return }
    if (!joinCode.trim()) { setError('Enter a room code');      return }
    setLoading(true)
    setError('')

    const socket = io(SOCKET_URL)
    socket.emit('join-room', { username, roomCode: joinCode.toUpperCase() }, (res: { success?: boolean; error?: string }) => {
      if (res.error) { setError(res.error); setLoading(false); return }
      setRoomCode(joinCode.toUpperCase())
      setPhase('room')
      setLoading(false)
    })
  }

  if (phase === 'room') {
    return (
      <div className="card animate-slideUp" style={{ padding: '2rem', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.5rem' }}>Room Created!</h2>
        <p style={{ color: 'hsl(220 10% 55%)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Share this code with your friends. Full Scribble gameplay UI is launching in Phase 2!
        </p>
        <div style={{ background: 'hsl(222 18% 16%)', border: '2px dashed hsl(220 100% 60% / 0.4)', borderRadius: 12, padding: '1rem 2rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginBottom: '0.25rem' }}>Room Code</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.15em' }} className="gradient-text">{roomCode}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => { setPhase('lobby'); setRoomCode('') }}>Back to Lobby</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '2rem', maxWidth: 440, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎨</div>
        <h2 style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '0.25rem' }}>Scribble</h2>
        <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem' }}>Draw & guess with your friends in real time</p>
      </div>

      {error && (
        <div style={{ background: 'hsl(0 80% 55% / 0.1)', border: '1px solid hsl(0 80% 55% / 0.3)', borderRadius: 8, padding: '0.6rem 0.9rem', color: 'hsl(0 80% 65%)', fontSize: '0.8rem', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}>Your Name</label>
          <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" id="scribble-username" />
        </div>

        <button className="btn btn-primary" onClick={createRoom} disabled={loading} id="scribble-create">
          🎨 Create Room
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <hr className="divider" style={{ flex: 1 }} />
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 40%)' }}>or join</span>
          <hr className="divider" style={{ flex: 1 }} />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            className="input"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room code"
            maxLength={6}
            id="scribble-joincode"
            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.1em' }}
          />
          <button className="btn btn-secondary" onClick={joinRoom} disabled={loading} id="scribble-join" style={{ flexShrink: 0 }}>
            Join
          </button>
        </div>
      </div>
    </div>
  )
}
