'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import { GAMES_REGISTRY } from '@/lib/games'

interface FriendEntry {
  id: string
  userId?: string
  username: string
  displayName?: string | null
  avatarUrl: string | null
  selectedFrame?: string | null
  level: number
  lastSeenAt?: string | null
}

// ─── Elapsed time formatting ─────────────────────────────────────────────────
function formatElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Game name from slug ──────────────────────────────────────────────────────
function gameNameFromSlug(slug?: string): string {
  if (!slug) return 'a game'
  const g = GAMES_REGISTRY.find(x => x.slug === slug)
  return g ? g.name : slug.replace(/-/g, ' ')
}


// ─── Challenge Modal (embedded) ───────────────────────────────────────────────
function ChallengeModal({
  friend,
  onClose,
}: {
  friend: FriendEntry
  onClose: () => void
}) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  const router = useRouter()
  const multiplayerGames = GAMES_REGISTRY.filter(g => g.multiplayer)
  const [selected, setSelected] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const handleSend = () => {
    if (!selected || !socket) return
    setSending(true)
    socket.emit('send-challenge', {
      targetUserId: friend.userId || friend.id,
      gameSlug: selected,
    }, (response: { error?: string; roomCode?: string }) => {
      setSending(false)
      if (response?.error) {
        addToast('error', 'Challenge Failed', response.error)
      } else if (response?.roomCode) {
        addToast('success', 'Challenge Sent! ⚔️', `Challenged ${friend.username}! Setting up room...`)
        onClose()
        setTimeout(() => router.push(`/dashboard/multiplayer?action=join&code=${response.roomCode}`), 800)
      } else {
        addToast('success', 'Challenge Sent! ⚔️', `Challenge issued to ${friend.username}!`)
        onClose()
      }
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'hsl(222 22% 10%)',
          border: '1px solid hsl(220 15% 20%)',
          borderRadius: '20px',
          padding: '1.75rem',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⚔️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'white' }}>
              Challenge {friend.displayName || friend.username}
            </h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'hsl(220 10% 55%)' }}>
              Select a game to challenge them to
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'hsl(220 10% 45%)', fontSize: '1rem', cursor: 'pointer' }}
          >✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {multiplayerGames.map(game => (
            <button
              key={game.slug}
              onClick={() => setSelected(game.slug)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 0.8rem',
                borderRadius: '12px',
                border: `1px solid ${selected === game.slug ? 'hsl(220 100% 60%)' : 'hsl(220 15% 18%)'}`,
                background: selected === game.slug ? 'hsl(220 100% 60% / 0.12)' : 'hsl(222 20% 8%)',
                color: selected === game.slug ? 'hsl(220 100% 78%)' : 'hsl(220 10% 75%)',
                fontFamily: 'inherit',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{game.emoji}</span>
              <span style={{ lineHeight: 1.2 }}>{game.name}</span>
              {selected === game.slug && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>✓</span>}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem' }}>
          <button
            onClick={handleSend}
            disabled={!selected || sending}
            style={{
              flex: 1,
              padding: '0.65rem',
              borderRadius: '12px',
              border: 'none',
              background: selected ? 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' : 'hsl(220 20% 16%)',
              color: selected ? 'white' : 'hsl(220 10% 40%)',
              fontFamily: 'inherit',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: selected ? 'pointer' : 'not-allowed',
              boxShadow: selected ? '0 4px 16px hsl(220 100% 60% / 0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {sending ? 'Sending...' : '⚔️ Send Challenge'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '12px',
              border: '1px solid hsl(220 15% 20%)',
              background: 'transparent',
              color: 'hsl(220 10% 55%)',
              fontFamily: 'inherit',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Drawer Component ────────────────────────────────────────────────────
export default function FriendsActivityDrawer() {
  const { presenceMap } = useSocket()
  const { user } = useGameSession()
  const { addToast } = useToast()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [challengeTarget, setChallengeTarget] = useState<FriendEntry | null>(null)
  const [tick, setTick] = useState(0)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Tick every second for elapsed time counters
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Load friend profiles
  useEffect(() => {
    if (!user) return
    const load = () => {
      fetch('/api/friends')
        .then(r => r.json())
        .then(d => setFriends(d.friends || []))
        .catch(() => {})
    }
    load()
    window.addEventListener('gamehub_friends_update', load)
    return () => window.removeEventListener('gamehub_friends_update', load)
  }, [user])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (isOpen && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // ── Handle lobby invite (defined before early returns for hook order) ─────────
  const handleInvite = useCallback(async (friend: FriendEntry, gameSlug: string) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFriendId: friend.id, gameSlug, roomCode })
      })
      if (res.ok) {
        addToast('success', 'Invite Sent! 🎮', `Room invite created for ${friend.username}. Redirecting...`)
        setIsOpen(false)
        window.location.href = `/dashboard/games/${gameSlug}?roomCode=${roomCode}`
      }
    } catch {
      addToast('error', 'Invite Failed', 'Could not send invite. Try again.')
    }
  }, [addToast])

  if (!user) return null

  // Enrich friends with live presence
  const enriched = friends.map(f => {
    const uid = f.userId || f.id
    const presence = presenceMap[uid]
    return { ...f, uid, presence }
  })

  const online    = enriched.filter(f => f.presence && f.presence.status !== 'OFFLINE' && f.presence.status !== undefined)
  const inGame    = online.filter(f => f.presence?.status === 'IN_GAME')
  const available = online.filter(f => f.presence?.status === 'ONLINE' || f.presence?.status === 'IN_LOBBY')
  const offline   = enriched.filter(f => !f.presence || f.presence.status === 'OFFLINE')

  const onlineCount = online.length


  const renderFriendRow = (f: typeof enriched[0]) => {
    const uid = f.uid
    const presence = f.presence
    const statusLabel =
      presence?.status === 'IN_GAME'  ? 'In Game'  :
      presence?.status === 'IN_LOBBY' ? 'In Lobby' :
      presence?.status === 'IN_CHAT'  ? 'In Chat'  :
      presence?.status === 'AWAY'     ? 'Away'     :
      presence?.status === 'ONLINE'   ? 'Online'   : 'Offline'

    const isOnline = presence && presence.status !== 'OFFLINE'
    const displayName = f.displayName || (f.username?.includes('@') ? f.username.split('@')[0] : f.username)

    return (
      <div
        key={uid}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.6rem 0.75rem',
          borderRadius: '12px',
          background: isOnline ? 'hsl(222 22% 10%)' : 'transparent',
          border: isOnline ? '1px solid hsl(220 15% 16%)' : '1px solid transparent',
          transition: 'background 0.15s',
        }}
      >
        {/* Avatar with status dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar avatarUrl={f.avatarUrl} username={f.username} selectedFrame={f.selectedFrame} size={34} />
          <div style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 9, height: 9, borderRadius: '50%',
            background: presence?.status === 'IN_GAME' ? 'hsl(270 80% 60%)' :
                        presence?.status === 'ONLINE'  ? 'hsl(142 70% 50%)' :
                        presence?.status === 'IN_LOBBY'? 'hsl(220 100% 60%)':
                        'hsl(220 10% 40%)',
            border: '1.5px solid hsl(222 22% 10%)',
            zIndex: 5,
          }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'hsl(220 10% 55%)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {presence?.status === 'IN_GAME'
              ? `🎮 ${gameNameFromSlug(presence.gameSlug)}${presence.startedAt ? ` · ${formatElapsed(Date.now() - presence.startedAt)}` : ''}`
              : statusLabel}
          </div>
        </div>

        {/* Actions */}
        {isOnline && (
          <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
            <button
              onClick={() => {
                // Default invite to their current game if in-game, otherwise cricket
                const gameSlug = presence?.status === 'IN_GAME' && presence.gameSlug
                  ? presence.gameSlug
                  : 'cricket'
                handleInvite(f, gameSlug)
              }}
              title="Invite to game"
              style={{
                background: 'hsl(220 100% 60% / 0.12)',
                border: '1px solid hsl(220 100% 60% / 0.25)',
                borderRadius: '8px',
                color: 'hsl(220 100% 72%)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              Invite
            </button>
            <button
              onClick={() => setChallengeTarget(f)}
              title="Challenge to duel"
              style={{
                background: 'hsl(38 95% 55% / 0.1)',
                border: '1px solid hsl(38 95% 55% / 0.25)',
                borderRadius: '8px',
                color: 'hsl(38 95% 65%)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              ⚔️
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ── Floating Toggle Button ── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        id="friends-activity-toggle"
        aria-label="Friends Activity"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height, 68px) + env(safe-area-inset-bottom, 0px) + 1rem)',
          right: '1rem',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: isOpen
            ? 'hsl(220 20% 18%)'
            : 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
          border: '1px solid hsl(220 15% 24%)',
          color: 'white',
          fontSize: '1.2rem',
          cursor: 'pointer',
          zIndex: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.4)' : '0 4px 20px hsl(220 100% 60% / 0.45)',
          transition: 'all 0.2s ease',
        }}
      >
        {isOpen ? '✕' : '👥'}
        {!isOpen && onlineCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -3,
            right: -3,
            background: 'hsl(142 70% 45%)',
            color: 'white',
            fontSize: '0.6rem',
            fontWeight: 900,
            width: 18,
            height: 18,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid hsl(222 22% 10%)',
          }}>
            {onlineCount > 9 ? '9+' : onlineCount}
          </span>
        )}
      </button>

      {/* ── Drawer ── */}
      {isOpen && (
        <div
          ref={drawerRef}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height, 68px) + env(safe-area-inset-bottom, 0px) + 4.25rem)',
            right: '1rem',
            width: 300,
            maxHeight: '70vh',
            background: 'hsl(222 22% 9%)',
            border: '1px solid hsl(220 15% 18%)',
            borderRadius: '20px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.2s ease',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '1rem 1rem 0.75rem',
            borderBottom: '1px solid hsl(220 15% 15%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>
                Friends Activity
              </h3>
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'hsl(220 10% 50%)' }}>
                {onlineCount > 0 ? `${onlineCount} online now` : 'No friends online'}
              </p>
            </div>
            <button
              onClick={() => { setIsOpen(false); router.push('/dashboard/friends') }}
              style={{
                background: 'hsl(220 20% 14%)',
                border: '1px solid hsl(220 15% 20%)',
                borderRadius: '8px',
                color: 'hsl(220 100% 70%)',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '0.25rem 0.55rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              View All →
            </button>
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'hsl(220 10% 45%)', fontSize: '0.8rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                <div>No friends yet.</div>
                <button
                  onClick={() => { setIsOpen(false); router.push('/dashboard/friends') }}
                  style={{ marginTop: '0.75rem', background: 'hsl(220 100% 60% / 0.12)', border: '1px solid hsl(220 100% 60% / 0.25)', borderRadius: '8px', color: 'hsl(220 100% 70%)', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Find Friends
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {/* In Game */}
                {inGame.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'hsl(270 80% 65%)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.3rem 0.75rem 0.2rem' }}>
                      In Game — {inGame.length}
                    </div>
                    {inGame.map(f => renderFriendRow(f))}
                  </>
                )}

                {/* Available */}
                {available.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'hsl(142 70% 55%)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.3rem 0.75rem 0.2rem', marginTop: inGame.length > 0 ? '0.25rem' : 0 }}>
                      Available — {available.length}
                    </div>
                    {available.map(f => renderFriendRow(f))}
                  </>
                )}

                {/* Offline (up to 5) */}
                {offline.length > 0 && (
                  <>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'hsl(220 10% 40%)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.3rem 0.75rem 0.2rem', marginTop: '0.25rem' }}>
                      Offline — {offline.length}
                    </div>
                    {offline.slice(0, 5).map(f => renderFriendRow(f))}
                    {offline.length > 5 && (
                      <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'hsl(220 10% 40%)', padding: '0.3rem' }}>
                        +{offline.length - 5} more offline
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Challenge Modal */}
      {challengeTarget && (
        <ChallengeModal
          friend={challengeTarget}
          onClose={() => setChallengeTarget(null)}
        />
      )}

      {/* Suppress unused tick warning */}
      {tick > 0 && null}
    </>
  )
}
