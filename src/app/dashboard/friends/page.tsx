'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import ProfileCardModal from '@/components/layout/ProfileCardModal'
import { useToast } from '@/lib/contexts/ToastContext'

interface ProfileSummary {
  id: string
  username: string
  level: number
  xp: number
  avatarUrl: string | null
  friendCode?: string | null
  lastSeenAt?: string | null
  friendshipStatus?: string
}

const MULTIPLAYER_GAMES = [
  { slug: 'cricket', name: 'Hand Cricket' },
  { slug: 'dots-boxes', name: 'Dots & Boxes' },
  { slug: 'scribble', name: 'Scribble' },
  { slug: 'dumb-charades', name: 'Dumb Charades' },
  { slug: 'whos-spy', name: "Who's Spy" }
]

export default function FriendsPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()
  
  const [activeTab, setActiveTab] = useState<'friends' | 'pending' | 'add' | 'recent'>('friends')
  const [friends, setFriends] = useState<ProfileSummary[]>([])
  const [pendingIncoming, setPendingIncoming] = useState<ProfileSummary[]>([])
  const [pendingOutgoing, setPendingOutgoing] = useState<ProfileSummary[]>([])
  const [recentPlayers, setRecentPlayers] = useState<ProfileSummary[]>([])
  
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileSummary[]>([])
  
  const [myProfile, setMyProfile] = useState<{ friendCode: string | null } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Invite Modal States
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [selectedFriendForInvite, setSelectedFriendForInvite] = useState<ProfileSummary | null>(null)

  // 1. Live presence heartbeat updates every 30 seconds
  useEffect(() => {
    if (!user) return
    const pingHeartbeat = () => {
      fetch('/api/profile/heartbeat', { method: 'POST' }).catch(() => {})
    }
    pingHeartbeat()
    const interval = setInterval(pingHeartbeat, 30000)
    return () => clearInterval(interval)
  }, [user])

  // 2. Fetch friends, pending lists, and current user profile details
  const fetchFriendsData = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      
      // Fetch friends lists
      const friendsRes = await fetch('/api/friends')
      if (!friendsRes.ok) throw new Error('Failed to load friends')
      const friendsData = await friendsRes.json()
      setFriends(friendsData.friends || [])
      setPendingIncoming(friendsData.pendingIncoming || [])
      setPendingOutgoing(friendsData.pendingOutgoing || [])

      // Fetch user profile for friend code display
      const profileRes = await fetch('/api/profile/details')
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        setMyProfile(profileData.profile)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error loading friends list'
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  // 3. Fetch recent players
  const fetchRecentPlayers = async () => {
    if (!user) return
    try {
      const res = await fetch('/api/friends/recent')
      if (res.ok) {
        const data = await res.json()
        setRecentPlayers(data.recentPlayers || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchFriendsData()
    fetchRecentPlayers()

    const handleFriendsUpdate = () => {
      fetchFriendsData()
      fetchRecentPlayers()
    }
    window.addEventListener('gamehub_friends_update', handleFriendsUpdate)
    return () => {
      window.removeEventListener('gamehub_friends_update', handleFriendsUpdate)
    }
  }, [user])

  // Refresh friends and recent list when tabs switch
  useEffect(() => {
    if (activeTab === 'recent') {
      fetchRecentPlayers()
    } else {
      fetchFriendsData()
    }
  }, [activeTab])

  // 4. Handle Friend Search (debounced)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      try {
        setSearchLoading(true)
        const res = await fetch(`/api/friends?search=${encodeURIComponent(searchQuery.trim())}`)
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch (err: unknown) {
        console.error(err)
      } finally {
        setSearchLoading(false)
      }
    }, 400)

    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  // 5. Friend Request action handler
  const handleAction = async (targetId: string, action: 'send' | 'accept' | 'decline' | 'remove') => {
    if (!user) return
    try {
      setActionLoadingId(targetId)
      setError(null)
      const res = await fetch('/api/friends/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Action failed')

      addToast(
        action === 'send' ? 'info' : 'success',
        action === 'send' ? 'Request Sent' : action === 'accept' ? 'Friend Accepted' : 'Friendship Updated',
        action === 'send' ? 'Friend request sent successfully!' : action === 'accept' ? 'You are now friends!' : 'Friendship list updated.'
      )

      await fetchFriendsData()
      await fetchRecentPlayers()

      if (searchQuery.trim().length >= 2) {
        setSearchResults(prev => prev.map(p => {
          if (p.id === targetId) {
            let nextStatus = 'none'
            if (action === 'send') nextStatus = 'sent-pending'
            else if (action === 'accept') nextStatus = 'friends'
            else if (action === 'decline' || action === 'remove') nextStatus = 'none'
            return { ...p, friendshipStatus: nextStatus }
          }
          return p
        }))
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error performing action'
      setError(errMsg)
    } finally {
      setActionLoadingId(null)
    }
  }

  // 6. Online Status calculation rules
  const getOnlinePresence = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return { label: 'Offline', color: 'hsl(220 10% 45%)', dot: 'hsl(220 10% 40%)' }
    
    const diffMs = Date.now() - new Date(lastSeenAt).getTime()
    const diffSecs = diffMs / 1000

    if (diffSecs < 60) {
      return { label: 'Online', color: 'hsl(142 70% 55%)', dot: 'hsl(142 70% 50%)' }
    } else if (diffSecs < 300) {
      return { label: 'Idle', color: 'hsl(38 95% 60%)', dot: 'hsl(38 95% 55%)' }
    }
    return { label: 'Offline', color: 'hsl(220 10% 45%)', dot: 'hsl(220 10% 40%)' }
  }

  // 7. Invite Room dispatch
  const handleInviteToRoom = async (gameSlug: string) => {
    if (!selectedFriendForInvite) return
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    try {
      const res = await fetch('/api/friends/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetFriendId: selectedFriendForInvite.id,
          gameSlug,
          roomCode
        })
      })

      if (res.ok) {
        addToast(
          'success',
          'Invite Dispatched! 🎮',
          `Room invite created for ${selectedFriendForInvite.username}. Redirecting you to lobby...`
        )
        setInviteModalOpen(false)
        // Redirect host to multiplayer lobby
        window.location.href = `/dashboard/games/${gameSlug}?roomCode=${roomCode}`
      } else {
        throw new Error()
      }
    } catch {
      addToast('error', 'Invite Failed', 'Could not send room invitation. Please try again.')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fadeIn safe-bottom-padding">
      
      {/* Header and Friend Code info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 850, margin: 0, letterSpacing: '-0.02em', color: 'white' }}>
            👥 Social Progression
          </h1>
          <p style={{ color: 'hsl(220 10% 55%)', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
            Add players using friend codes, monitor online presence, and send game room invites.
          </p>
        </div>

        {/* Friend Code Display Widget */}
        {user && myProfile && (
          <div
            className="card"
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: 16,
              background: 'linear-gradient(135deg, hsl(220 20% 12%), hsl(220 20% 8%))',
              border: '1px solid hsl(220 15% 18%)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', letterSpacing: '0.05em' }}>
              Your Friend Code
            </div>
            <div
              style={{
                fontSize: '1.05rem',
                fontWeight: 900,
                color: 'hsl(220 100% 70%)',
                marginTop: '0.15rem',
                fontFamily: 'monospace',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (myProfile.friendCode) {
                  navigator.clipboard.writeText(myProfile.friendCode)
                  addToast('success', 'Code Copied!', 'Friend code copied to clipboard!')
                }
              }}
              title="Click to copy Friend Code"
            >
              {myProfile.friendCode || 'GH-GENERATE'} 📋
            </div>
          </div>
        )}
      </div>

      {/* Guest Mode Restriction Warning */}
      {!user && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, hsl(38 95% 60% / 0.1), hsl(220 100% 60% / 0.1))',
            border: '1px solid hsl(38 95% 55% / 0.3)',
            padding: '1.25rem',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'hsl(38 95% 65%)' }}>
              🔒 Social Access Restricted
            </div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(220 10% 65%)', marginTop: '0.2rem' }}>
              Social progression, heartbeats, and invites are disabled for Guest sessions. Join today to create friendships!
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            <Link href="/login" className="btn btn-secondary btn-sm">Sign In</Link>
          </div>
        </div>
      )}

      {/* Tabs Menu selection */}
      {user && (
        <div style={{ display: 'flex', borderBottom: '1px solid hsl(220 15% 18%)', gap: '1rem', paddingBottom: '0.25rem' }}>
          {[
            { id: 'friends', label: 'My Friends', badge: friends.length },
            { id: 'pending', label: 'Pending', badge: pendingIncoming.length + pendingOutgoing.length },
            { id: 'add', label: 'Find Players', badge: null },
            { id: 'recent', label: 'Recent Opponents', badge: recentPlayers.length }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                background: 'transparent',
                border: 'none',
                color: activeTab === t.id ? 'hsl(220 100% 70%)' : 'hsl(220 10% 50%)',
                fontWeight: 700,
                fontSize: '0.92rem',
                padding: '0.5rem 0.25rem 0.75rem',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap'
              }}
              id={`friends-tab-${t.id}`}
            >
              {t.label}
              {t.badge !== null && t.badge > 0 && (
                <span style={{
                  background: t.id === 'pending' ? 'hsl(38 95% 50%)' : 'hsl(220 100% 60%)',
                  color: 'white',
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '99px',
                  fontWeight: 800
                }}>
                  {t.badge}
                </span>
              )}
              {activeTab === t.id && (
                <div style={{
                  position: 'absolute',
                  bottom: -1,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'hsl(220 100% 60%)',
                  boxShadow: '0 0 8px hsl(220 100% 60%)'
                }} />
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'hsl(0 80% 55% / 0.1)', border: '1px solid hsl(0 80% 55% / 0.3)', borderRadius: 12, padding: '0.75rem 1rem', color: 'hsl(0 80% 65%)', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Tab content loading and display */}
      {user && (
        <div>
          {loading && searchQuery === '' ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)' }}>
              Loading social hub...
            </div>
          ) : (
            <div className="stagger">
              
              {/* TAB 1: FRIENDS LIST */}
              {activeTab === 'friends' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {friends.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'hsl(222 20% 8% / 0.6)', border: '1px solid hsl(220 15% 15%)', borderRadius: 18 }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>👋</span>
                      <h3 style={{ fontWeight: 700, color: 'white', margin: 0 }}>No Friends Added</h3>
                      <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0.5rem 0 1.25rem' }}>Start finding players to compile your Friends list.</p>
                      <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('add')}>Find Players</button>
                    </div>
                  ) : (
                    friends.map(friend => {
                      const presence = getOnlinePresence(friend.lastSeenAt)
                      const isOnline = presence.label === 'Online'
                      
                      return (
                        <div
                          key={friend.id}
                          className="card"
                          style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            background: 'linear-gradient(135deg, hsl(222 18% 12%), hsl(222 18% 9%))',
                            border: '1px solid hsl(220 15% 15%)',
                            borderRadius: 16
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {/* Avatar with live status dot */}
                            <div style={{ position: 'relative' }}>
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: 'white' }}>
                                {friend.username[0].toUpperCase()}
                              </div>
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: presence.dot,
                                  border: '2px solid hsl(222 18% 12%)',
                                  boxShadow: `0 0 6px ${presence.dot}`
                                }}
                              />
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <button
                                  onClick={() => setSelectedProfileId(friend.id)}
                                  style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 750, fontSize: '0.92rem', color: 'white', cursor: 'pointer' }}
                                  className="hover-underline"
                                >
                                  {friend.username}
                                </button>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: presence.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  {presence.label}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                                Level {friend.level} · {friend.xp.toLocaleString()} XP
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {/* Invite button only for online friends */}
                            {isOnline && (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedFriendForInvite(friend)
                                  setInviteModalOpen(true)
                                }}
                              >
                                🎮 Invite
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleAction(friend.id, 'remove')}
                              disabled={actionLoadingId === friend.id}
                              style={{ color: 'hsl(0 80% 60%)', borderColor: 'hsl(0 80% 40% / 0.1)', padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                            >
                              {actionLoadingId === friend.id ? 'Removing...' : 'Unfriend'}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* TAB 2: PENDING REQUESTS */}
              {activeTab === 'pending' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Incoming */}
                  <div>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 750, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                      Received Requests ({pendingIncoming.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {pendingIncoming.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: 'hsl(220 10% 45%)', padding: '1rem', background: 'hsl(222 20% 7%)', borderRadius: 12, border: '1px dashed hsl(220 15% 15%)', margin: 0 }}>
                          No incoming friend requests.
                        </p>
                      ) : (
                        pendingIncoming.map(req => (
                          <div key={req.id} className="card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)', borderRadius: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>
                                {req.username[0].toUpperCase()}
                              </div>
                              <div>
                                <button
                                  onClick={() => setSelectedProfileId(req.id)}
                                  style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 700, fontSize: '0.88rem', color: 'white', cursor: 'pointer' }}
                                  className="hover-underline"
                                >
                                  {req.username}
                                </button>
                                <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)' }}>Level {req.level}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => handleAction(req.id, 'accept')} disabled={actionLoadingId === req.id} style={{ padding: '0.35rem 0.75rem' }}>Accept</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleAction(req.id, 'decline')} disabled={actionLoadingId === req.id} style={{ padding: '0.35rem 0.75rem', color: 'hsl(220 10% 70%)' }}>Decline</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Outgoing */}
                  <div>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 750, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', marginBottom: '0.75rem', letterSpacing: '0.04em' }}>
                      Sent Requests ({pendingOutgoing.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {pendingOutgoing.length === 0 ? (
                        <p style={{ fontSize: '0.82rem', color: 'hsl(220 10% 45%)', padding: '1rem', background: 'hsl(222 20% 7%)', borderRadius: 12, border: '1px dashed hsl(220 15% 15%)', margin: 0 }}>
                          No sent pending requests.
                        </p>
                      ) : (
                        pendingOutgoing.map(req => (
                          <div key={req.id} className="card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)', borderRadius: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(220 15% 20%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(220 10% 60%)' }}>
                                {req.username[0].toUpperCase()}
                              </div>
                              <div>
                                <button
                                  onClick={() => setSelectedProfileId(req.id)}
                                  style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 700, fontSize: '0.88rem', color: 'hsl(220 10% 80%)', cursor: 'pointer' }}
                                  className="hover-underline"
                                >
                                  {req.username}
                                </button>
                                <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)' }}>Level {req.level}</div>
                              </div>
                            </div>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleAction(req.id, 'remove')} disabled={actionLoadingId === req.id} style={{ padding: '0.35rem 0.75rem', color: 'hsl(0 80% 60%)' }}>Cancel</button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FIND / SEARCH FRIENDS */}
              {activeTab === 'add' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Search player usernames or Paste Friend Code (e.g. GH-7QF2K8A1)..."
                      className="input"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ paddingRight: '2.5rem', borderRadius: 14 }}
                      id="friends-search-input"
                    />
                    {searchLoading && (
                      <div style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'hsl(220 10% 55%)' }}>
                        ⌛
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {searchQuery.trim().length >= 2 ? (
                      searchResults.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'hsl(220 10% 50%)', fontSize: '0.88rem' }}>
                          No players found matching &quot;{searchQuery}&quot;.
                        </div>
                      ) : (
                        searchResults.map(p => (
                          <div key={p.id} className="card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)', borderRadius: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>
                                {p.username[0].toUpperCase()}
                              </div>
                              <div>
                                <button
                                  onClick={() => setSelectedProfileId(p.id)}
                                  style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 700, fontSize: '0.88rem', color: 'white', cursor: 'pointer' }}
                                  className="hover-underline"
                                >
                                  {p.username}
                                </button>
                                <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)' }}>
                                  Level {p.level} · {p.xp.toLocaleString()} XP
                                </div>
                              </div>
                            </div>
                            
                            {/* Actions mapping */}
                            {p.friendshipStatus === 'friends' && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(142 70% 55%)', background: 'hsl(142 70% 50% / 0.12)', padding: '0.35rem 0.65rem', borderRadius: 8 }}>
                                ✓ Friends
                              </span>
                            )}
                            {p.friendshipStatus === 'sent-pending' && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(38 95% 60%)', background: 'hsl(38 95% 50% / 0.12)', padding: '0.35rem 0.65rem', borderRadius: 8 }}>
                                Sent Pending
                              </span>
                            )}
                            {p.friendshipStatus === 'received-pending' && (
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button className="btn btn-primary btn-sm" onClick={() => handleAction(p.id, 'accept')} disabled={actionLoadingId === p.id} style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>Accept</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleAction(p.id, 'decline')} disabled={actionLoadingId === p.id} style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}>Decline</button>
                              </div>
                            )}
                            {p.friendshipStatus === 'none' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleAction(p.id, 'send')}
                                disabled={actionLoadingId === p.id}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                              >
                                {actionLoadingId === p.id ? 'Sending...' : 'Add Friend'}
                              </button>
                            )}
                          </div>
                        ))
                      )
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'hsl(220 10% 40%)', fontSize: '0.82rem', border: '1px dashed hsl(220 15% 15%)', borderRadius: 18 }}>
                        Type at least 2 characters or paste a Friend Code to search other players.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: RECENT PLAYERS */}
              {activeTab === 'recent' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {recentPlayers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'hsl(222 20% 8% / 0.6)', border: '1px solid hsl(220 15% 15%)', borderRadius: 18 }}>
                      <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🎮</span>
                      <h3 style={{ fontWeight: 700, color: 'white', margin: 0 }}>No Recent Players</h3>
                      <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>Opponents from your recent ranked matches will appear here.</p>
                    </div>
                  ) : (
                    recentPlayers.map(player => (
                      <div
                        key={player.id}
                        className="card"
                        style={{
                          padding: '1rem 1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          background: 'hsl(222 18% 12%)',
                          border: '1px solid hsl(220 15% 15%)',
                          borderRadius: 16
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>
                            {player.username[0].toUpperCase()}
                          </div>
                          <div>
                            <button
                              onClick={() => setSelectedProfileId(player.id)}
                              style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 750, fontSize: '0.9rem', color: 'white', cursor: 'pointer' }}
                              className="hover-underline"
                            >
                              {player.username}
                            </button>
                            <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.1rem' }}>
                              Level {player.level} · {player.xp.toLocaleString()} XP
                            </div>
                          </div>
                        </div>

                        {player.friendshipStatus === 'none' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAction(player.id, 'send')}
                            disabled={actionLoadingId === player.id}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}
                          >
                            {actionLoadingId === player.id ? 'Adding...' : 'Add Friend'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(38 95% 60%)', background: 'hsl(38 95% 50% / 0.12)', padding: '0.35rem 0.65rem', borderRadius: 8 }}>
                            {player.friendshipStatus === 'sent-pending' ? 'Request Sent' : 'Pending Action'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* Invite Modal Popover */}
      {inviteModalOpen && selectedFriendForInvite && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className="card glass"
            style={{
              width: '100%',
              maxWidth: 380,
              background: 'linear-gradient(135deg, hsl(222 20% 10%), hsl(222 18% 13%))',
              border: '1px solid hsl(220 15% 20%)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
              borderRadius: 20
            }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 850, color: 'white' }}>
                🎮 Invite {selectedFriendForInvite.username}
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'hsl(220 10% 55%)' }}>
                Select a game to generate a lobby invite code.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {MULTIPLAYER_GAMES.map(game => (
                <button
                  key={game.slug}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    borderRadius: 12,
                    fontSize: '0.88rem',
                    padding: '0.75rem 1rem',
                    background: 'hsl(220 20% 8%)',
                    borderColor: 'hsl(220 15% 15%)',
                    color: 'white',
                    fontWeight: 600
                  }}
                  onClick={() => handleInviteToRoom(game.slug)}
                >
                  🚀 Play {game.name}
                </button>
              ))}
            </div>

            <button
              className="btn btn-ghost"
              style={{ width: '100%', borderRadius: 10, fontSize: '0.82rem', padding: '0.4rem', color: 'hsl(220 10% 50%)' }}
              onClick={() => setInviteModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <ProfileCardModal
        profileId={selectedProfileId}
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
      />
    </div>
  )
}
