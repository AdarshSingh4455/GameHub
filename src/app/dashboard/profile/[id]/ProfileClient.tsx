'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/contexts/ToastContext'
import Avatar from '@/components/shared/Avatar'

interface ProfileClientProps {
  profile: {
    id: string
    username: string
    displayName?: string | null
    avatarUrl: string | null
    selectedTitle: string | null
    selectedFrame: string | null
    level: number
    xp: number
    currentStreak: number
    createdAt: string
  }
  stats: {
    rank: number
    totalMatches: number
    wins: number
    losses: number
    draws: number
    winPercent: number
    favoriteGame: string
  }
  badges: Array<{
    slug: string
    name: string
    description: string
    unlockedAt: string
  }>
  activity: Array<{
    type: string
    text: string
    date: string
    amount?: number
  }>
  initialFriendshipStatus: 'none' | 'friends' | 'sent-pending' | 'received-pending' | 'self'
}

export default function ProfileClient({
  profile,
  stats,
  badges,
  activity,
  initialFriendshipStatus
}: ProfileClientProps) {
  const router = useRouter()
  const { addToast } = useToast()
  const [friendshipStatus, setFriendshipStatus] = useState(initialFriendshipStatus)
  const [loading, setLoading] = useState(false)

  const handleFriendAction = async (action: 'send' | 'accept' | 'decline' | 'remove') => {
    setLoading(true)
    try {
      const res = await fetch('/api/friends/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, targetId: profile.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')

      // Update state locally
      if (action === 'send') {
        setFriendshipStatus('sent-pending')
        addToast('new_badge', 'Request Sent', `Friend request sent to ${profile.username}.`)
      } else if (action === 'accept') {
        setFriendshipStatus('friends')
        addToast('level_up', 'Friend Request Accepted', `You are now friends with ${profile.username}!`)
      } else if (action === 'decline' || action === 'remove') {
        setFriendshipStatus('none')
        addToast('new_badge', 'Friendship Updated', `Friendship action completed.`)
      }

      router.refresh()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error executing friend action'
      addToast('new_badge', 'Action Failed', errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fadeIn public-profile-container">
      
      {/* Profile Header Card */}
      <div className="card glass profile-header-container" style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        
        {/* Decorative backdrop glow */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-20%',
          width: '60%',
          height: '140%',
          background: 'radial-gradient(circle, hsl(220 100% 60% / 0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Avatar
                avatarUrl={profile.avatarUrl}
                username={profile.username}
                selectedFrame={profile.selectedFrame}
                size={76}
              />
              <span style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                background: 'hsl(270 80% 60%)',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 900,
                padding: '0.15rem 0.45rem',
                borderRadius: 99,
                border: '2px solid hsl(222 18% 14%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                zIndex: 5
              }}>
                Lv {profile.level}
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', margin: 0 }}>
                  {profile.displayName || (profile.username.includes('@') ? profile.username.split('@')[0] : profile.username)}
                </h1>
                {profile.selectedTitle && (
                  <span className="badge badge-gold" style={{ fontSize: '0.68rem', padding: '0.2rem 0.55rem' }}>
                    {profile.selectedTitle}
                  </span>
                )}
              </div>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem', marginTop: '0.1rem', marginBottom: '0.25rem', margin: 0 }}>
                @{profile.username}
              </p>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.8rem', marginTop: '0.25rem', margin: 0 }}>
                Joined on {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Friendship Relationship Button */}
          {friendshipStatus !== 'self' && (
            <div style={{ zIndex: 2 }}>
              {friendshipStatus === 'none' && (
                <button className="btn btn-primary btn-sm" onClick={() => handleFriendAction('send')} disabled={loading}>
                  {loading ? 'Processing...' : '➕ Send Friend Request'}
                </button>
              )}
              {friendshipStatus === 'friends' && (
                <button className="btn btn-secondary btn-sm" onClick={() => handleFriendAction('remove')} disabled={loading} style={{ color: 'hsl(0 80% 60%)', borderColor: 'hsl(0 80% 40% / 0.2)' }}>
                  {loading ? 'Processing...' : '✕ Remove Friend'}
                </button>
              )}
              {friendshipStatus === 'sent-pending' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'hsl(38 95% 60%)', background: 'hsl(38 95% 50% / 0.1)', padding: '0.4rem 0.75rem', borderRadius: '8px', fontWeight: 700 }}>
                    ⏳ Sent Request Pending
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFriendAction('remove')} disabled={loading} style={{ color: 'hsl(0 80% 60%)' }} title="Cancel Request">
                    ✕
                  </button>
                </div>
              )}
              {friendshipStatus === 'received-pending' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleFriendAction('accept')} disabled={loading}>
                    {loading ? 'Processing...' : 'Accept Request'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleFriendAction('decline')} disabled={loading}>
                    {loading ? 'Processing...' : 'Decline'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        
        {/* Global Rank */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Global Rank</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>#{stats.rank}</div>
        </div>

        {/* Win Rate */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Win Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(142 70% 55%)' }}>{stats.winPercent}%</div>
        </div>

        {/* Total Played */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Total Matches</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white' }}>{stats.totalMatches}</div>
        </div>

        {/* Record (W-L-D) */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Record (W/L/D)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(220 10% 75%)', marginTop: '0.4rem' }}>
            {stats.wins} <span style={{ color: 'hsl(220 10% 40%)' }}>/</span> {stats.losses} <span style={{ color: 'hsl(220 10% 40%)' }}>/</span> {stats.draws}
          </div>
        </div>

        {/* Login Streak */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Current Streak</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(38 95% 55%)' }}>🔥 {profile.currentStreak} d</div>
        </div>

        {/* Favorite Game */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Favorite Game</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'white', marginTop: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stats.favoriteGame}>
            🎮 {stats.favoriteGame}
          </div>
        </div>
      </div>

      {/* Badges / Achievements list */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem', color: 'white' }}>🏆 Badges Unlocked ({badges.length})</h2>
        {badges.length === 0 ? (
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: 0, padding: '1.5rem', textAlign: 'center', background: 'hsl(222 20% 7%)', borderRadius: 12, border: '1px dashed hsl(220 15% 15%)' }}>
            No badges unlocked yet.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {badges.map((b) => (
              <div key={b.slug} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', background: 'hsl(222 20% 8%)', border: '1px solid hsl(220 15% 16%)', borderRadius: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem' }}>🏅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'hsl(45 100% 65%)' }}>{b.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.1rem', lineHeight: 1.3 }}>{b.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Feed */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '1rem', color: 'white' }}>⚡ Recent Activity</h2>
        {activity.length === 0 ? (
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: 0, padding: '1.5rem', textAlign: 'center', background: 'hsl(222 20% 7%)', borderRadius: 12, border: '1px dashed hsl(220 15% 15%)' }}>
            No recent gameplay activity recorded.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activity.map((act, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', background: 'hsl(222 20% 8%)', borderLeft: '3px solid hsl(220 100% 65%)', borderRadius: '4px 12px 12px 4px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white' }}>{act.text}</div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', marginTop: '0.15rem' }}>
                    {new Date(act.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                  </div>
                </div>
                {act.amount !== undefined && (
                  <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>
                    +{act.amount} XP
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
    </div>
  )
}
