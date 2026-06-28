'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/contexts/ToastContext'
import { Users, Globe, PlusCircle, ArrowRight, Play, Sparkles } from 'lucide-react'
import GameIcon from '@/components/games/GameIcon'

export default function WhosSpyLandingPage() {
  const router = useRouter()
  const { addToast } = useToast()
  
  const [roomCode, setRoomCode] = useState('')
  const [loadingAction, setLoadingAction] = useState<'quick' | 'join' | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleQuickJoin = async () => {
    setLoadingAction('quick')
    setErrorMsg('')
    try {
      const res = await fetch('/api/multiplayer/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameSlug: 'whos-spy' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to quick join')

      addToast('success', data.action === 'created' ? 'Created Lobby' : 'Joined Lobby', `Entered lobby ${data.roomCode}!`)
      router.push(`/dashboard/multiplayer?room=${data.roomCode}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error joining a room')
      addToast('error', 'Quick Join Error', err.message || 'Error joining a room')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleCreateRoom = () => {
    router.push('/dashboard/multiplayer?action=create&game=whos-spy')
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) {
      setErrorMsg('Please enter a room code.')
      return
    }
    setLoadingAction('join')
    setErrorMsg('')
    try {
      const res = await fetch('/api/multiplayer/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: roomCode.trim().toUpperCase() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid or expired room code')

      addToast('success', 'Joined Lobby', `Entered lobby ${data.roomCode}!`)
      router.push(`/dashboard/multiplayer?room=${data.roomCode}`)
    } catch (err: any) {
      setErrorMsg(err.message || 'Error joining room')
      addToast('error', 'Join Error', err.message || 'Error joining room')
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: '2rem auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
      id="whos-spy-landing-container"
    >
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '24px', background: 'hsl(222 20% 10% / 0.8)', border: '1px solid hsl(220 15% 16%)', marginBottom: '1rem' }}>
          <GameIcon slug="whos-spy" size={64} />
        </div>
        <h2 style={{ fontWeight: 900, fontSize: '1.8rem', margin: 0, color: 'white', letterSpacing: '-0.02em' }}>Who&apos;s Spy</h2>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
          A social deduction game of secret words and deception. Identify the spy among you, or deceive the civilians!
        </p>
      </div>

      {errorMsg && (
        <div
          style={{
            background: 'hsl(0 80% 55% / 0.1)',
            border: '1px solid hsl(0 80% 55% / 0.25)',
            borderRadius: 12,
            padding: '0.75rem 1rem',
            color: 'hsl(0 100% 75%)',
            fontSize: '0.82rem',
            textAlign: 'left',
          }}
          id="whos-spy-error-alert"
        >
          <Sparkles size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> {errorMsg}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Quick Join Card */}
        <div
          onClick={loadingAction ? undefined : handleQuickJoin}
          className="card glass hover-card"
          style={{
            padding: '1.25rem',
            borderRadius: 16,
            cursor: loadingAction ? 'not-allowed' : 'pointer',
            border: '1px solid hsl(220 15% 16%)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'all 0.2s ease',
            opacity: loadingAction ? 0.7 : 1
          }}
          id="whos-spy-quick-join-btn"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'hsl(142 70% 50% / 0.15)', color: 'hsl(142 70% 55%)' }}>
            <Globe size={20} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white' }}>Quick Join</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>Match with waiting online players instantly</div>
          </div>
          <ArrowRight size={18} style={{ color: 'hsl(220 10% 40%)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid hsl(220 15% 14%)' }} />
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 40%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>or play with friends</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid hsl(220 15% 14%)' }} />
        </div>

        {/* Create Room Card */}
        <div
          onClick={loadingAction ? undefined : handleCreateRoom}
          className="card glass hover-card"
          style={{
            padding: '1.25rem',
            borderRadius: 16,
            cursor: loadingAction ? 'not-allowed' : 'pointer',
            border: '1px solid hsl(220 15% 16%)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'all 0.2s ease',
            opacity: loadingAction ? 0.7 : 1
          }}
          id="whos-spy-create-room-btn"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'hsl(270 80% 50% / 0.15)', color: 'hsl(270 80% 65%)' }}>
            <PlusCircle size={20} />
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white' }}>Create Private Room</div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>Start a custom lobby and invite friends</div>
          </div>
          <ArrowRight size={18} style={{ color: 'hsl(220 10% 40%)' }} />
        </div>

        {/* Join by Code Input Card */}
        <form
          onSubmit={handleJoinByCode}
          className="card glass"
          style={{
            padding: '1.25rem',
            borderRadius: 16,
            border: '1px solid hsl(220 15% 16%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
          id="whos-spy-join-form"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'hsl(220 20% 12%)', color: 'hsl(220 10% 60%)' }}>
              <Users size={18} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', flex: 1, textAlign: 'left' }}>Enter Room Code</div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="e.g. AB12CD"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().trim())}
              disabled={!!loadingAction}
              maxLength={8}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                borderRadius: 10,
                backgroundColor: 'hsl(222 20% 6%)',
                border: '1px solid hsl(220 15% 18%)',
                color: 'white',
                fontSize: '0.88rem',
                fontWeight: 700,
                outline: 'none',
                transition: 'border-color 0.2s',
                letterSpacing: '0.05em'
              }}
              id="whos-spy-code-input"
            />
            <button
              type="submit"
              disabled={loadingAction === 'join' || !roomCode.trim()}
              className="btn btn-primary"
              style={{
                borderRadius: 10,
                padding: '0 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.85rem'
              }}
              id="whos-spy-submit-code-btn"
            >
              Join <Play size={14} fill="currentColor" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
