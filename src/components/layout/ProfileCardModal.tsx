'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/lib/contexts/ToastContext'
import { getLevelProgress } from '@/lib/xpUtils'

interface ProfileData {
  profile: {
    id: string
    username: string
    avatarUrl: string | null
    selectedTitle: string | null
    level: number
    xp: number
    coins: number
    currentStreak: number
    longestStreak: number
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
    date: string
    text: string
    amount: number
  }>
  friendshipStatus: 'none' | 'friends' | 'sent-pending' | 'received-pending' | 'self'
}

interface Props {
  profileId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function ProfileCardModal({ profileId, isOpen, onClose }: Props) {
  const { addToast } = useToast()
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!profileId || !isOpen) {
      setData(null)
      return
    }

    setLoading(true)
    fetch(`/api/profile/${profileId}`)
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Failed to fetch profile')
      })
      .then((resData) => {
        setData(resData)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        addToast('error', 'Error', 'Failed to load profile details.')
        setLoading(false)
        onClose()
      })
  }, [profileId, isOpen, onClose, addToast])

  if (!mounted || !isOpen || !profileId) return null

  const handleFriendAction = async (action: 'send' | 'accept' | 'decline' | 'remove') => {
    if (!data) return
    try {
      setActionLoading(true)
      const res = await fetch('/api/friends/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, targetId: data.profile.id })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Action failed')

      // Refresh local data
      let newStatus: typeof data.friendshipStatus = 'none'
      if (action === 'send') {
        newStatus = 'sent-pending'
        addToast('success', 'Request Sent', `Friend request sent to ${data.profile.username}!`)
      } else if (action === 'accept') {
        newStatus = 'friends'
        addToast('success', 'Request Accepted', `You are now friends with ${data.profile.username}!`)
      } else if (action === 'decline' || action === 'remove') {
        newStatus = 'none'
        addToast('info', 'Updated', `Friendship updated.`)
      }

      setData(prev => prev ? { ...prev, friendshipStatus: newStatus } : null)
      window.dispatchEvent(new Event('gamehub_friends_update')) // notify other pages
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Action failed'
      addToast('error', 'Error', errMsg)
    } finally {
      setActionLoading(false)
    }
  }

  const renderFriendshipButton = () => {
    if (!data || data.friendshipStatus === 'self') return null

    switch (data.friendshipStatus) {
      case 'friends':
        return (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleFriendAction('remove')}
            disabled={actionLoading}
            style={{ color: 'hsl(0 80% 65%)', flex: 1 }}
          >
            {actionLoading ? 'Updating...' : 'Unfriend 👥'}
          </button>
        )
      case 'sent-pending':
        return (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => handleFriendAction('remove')}
            disabled={actionLoading}
            style={{ color: 'hsl(38 95% 60%)', flex: 1 }}
          >
            {actionLoading ? 'Updating...' : 'Cancel Request ✕'}
          </button>
        )
      case 'received-pending':
        return (
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleFriendAction('accept')}
              disabled={actionLoading}
              style={{ flex: 1 }}
            >
              {actionLoading ? '...' : 'Accept ✓'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleFriendAction('decline')}
              disabled={actionLoading}
              style={{ flex: 1 }}
            >
              {actionLoading ? '...' : 'Decline'}
            </button>
          </div>
        )
      case 'none':
      default:
        return (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => handleFriendAction('send')}
            disabled={actionLoading}
            style={{ flex: 1 }}
          >
            {actionLoading ? 'Sending...' : 'Add Friend +'}
          </button>
        )
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return 'Recent'
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className="animate-fadeIn"
      onClick={onClose}
    >
      <style>{`
        .profile-card-container {
          background: linear-gradient(185deg, hsl(222 20% 10%), hsl(222 18% 14%));
          border: 1px solid hsl(220 15% 20%);
          box-shadow: 0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(255,255,255,0.02);
          width: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Responsive boundaries: Mobile Drawer vs Desktop Modal */
        @media (max-width: 520px) {
          .profile-card-container {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            max-height: 85vh;
            border-radius: 24px 24px 0 0;
            border-bottom: none;
            animation: slideUpDrawer 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            padding-bottom: calc(env(safe-area-inset-bottom) + 1.25rem);
          }
        }
        @media (min-width: 521px) {
          .profile-card-container {
            max-width: 440px;
            border-radius: 20px;
            max-height: 90vh;
            animation: modalScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
        }

        @keyframes slideUpDrawer {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes modalScaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .scrollable-body::-webkit-scrollbar {
          width: 5px;
        }
        .scrollable-body::-webkit-scrollbar-thumb {
          background: hsl(220 15% 25%);
          border-radius: 99px;
        }
      `}</style>

      <div
        className="profile-card-container"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '1.25rem 1rem' }}
      >
        {/* Pull bar for mobile */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }} className="sm:hidden">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'hsl(220 10% 25%)' }} />
        </div>

        {/* Close Button (Desktop Only) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'hsl(220 15% 18%)',
            border: '1px solid hsl(220 15% 24%)',
            color: 'hsl(220 10% 60%)',
            width: 28,
            height: 28,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700,
          }}
          className="hidden sm:flex"
        >
          ✕
        </button>

        {loading || !data ? (
          <div style={{ padding: '1.25rem 0.5rem' }}>
            <style>{`
              @keyframes pc-shimmer {
                0% { background-position: -500px 0; }
                100% { background-position: 500px 0; }
              }
              .pc-skel {
                background: linear-gradient(90deg, hsl(222 20% 15%) 25%, hsl(222 20% 21%) 50%, hsl(222 20% 15%) 75%);
                background-size: 500px 100%;
                animation: pc-shimmer 1.3s infinite linear;
                border-radius: 6px;
              }
            `}</style>

            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1rem' }}>
              <div className="pc-skel" style={{ width: 68, height: 68, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div className="pc-skel" style={{ height: 15, width: '60%' }} />
                <div className="pc-skel" style={{ height: 12, width: '40%' }} />
                <div className="pc-skel" style={{ height: 10, width: '30%' }} />
              </div>
            </div>

            {/* XP bar */}
            <div className="pc-skel" style={{ height: 8, width: '100%', marginBottom: '1rem', borderRadius: 99 }} />

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              {[1,2,3].map(k => (
                <div key={k} style={{ padding: '0.75rem', background: 'hsl(222 20% 13%)', borderRadius: 10 }}>
                  <div className="pc-skel" style={{ height: 18, width: '60%', marginBottom: 6 }} />
                  <div className="pc-skel" style={{ height: 10, width: '80%' }} />
                </div>
              ))}
            </div>

            {/* Action button area */}
            <div className="pc-skel" style={{ height: 36, width: '100%', borderRadius: 10 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Scrollable Body content */}
            <div className="scrollable-body" style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Profile Header Block */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.6rem',
                    color: 'white',
                    border: '2px solid hsl(220 15% 25%)',
                    overflow: 'hidden',
                  }}>
                    {data.profile.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.profile.avatarUrl} alt={data.profile.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      data.profile.username[0].toUpperCase()
                    )}
                  </div>
                  <div style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    background: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 50%))',
                    color: 'black',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    border: '2px solid hsl(222 20% 10%)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }} title="Global Rank">
                    #{data.stats.rank}
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.profile.username}
                  </h3>
                  {data.profile.selectedTitle && (
                    <div style={{ fontSize: '0.72rem', color: 'hsl(45 100% 60%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.08rem' }}>
                      ⚡ {data.profile.selectedTitle}
                    </div>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                    Joined: {formatDate(data.profile.createdAt)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Strip */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                {renderFriendshipButton()}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                  style={{ flex: 1 }}
                >
                  Close
                </button>
              </div>

              {/* Stats Block - 2 Column Grid */}
              {(() => {
                const prog = getLevelProgress(data.profile.xp);
                const getGameEmoji = (gameName: string) => {
                  const lower = gameName.toLowerCase()
                  if (lower.includes('tic') || lower.includes('tac')) return '⭕'
                  if (lower.includes('memory')) return '🧠'
                  if (lower.includes('rock') || lower.includes('scissors') || lower.includes('paper')) return '✊'
                  if (lower.includes('guess') || lower.includes('number')) return '🔢'
                  if (lower.includes('cricket')) return '🏏'
                  if (lower.includes('fighter') || lower.includes('jet')) return '✈️'
                  if (lower.includes('2048')) return '🔢'
                  return '🎮'
                };

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', background: 'hsl(222 20% 8%)', padding: '0.75rem', borderRadius: 12, border: '1px solid hsl(220 15% 18%)' }}>
                      <div style={{ textAlign: 'center', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Level / XP</span>
                        <strong style={{ fontSize: '0.9rem', color: 'hsl(270 80% 70%)' }}>Lv {data.profile.level} <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', fontWeight: 500 }}>({data.profile.xp.toLocaleString()})</span></strong>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.25rem' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Favorite Game</span>
                        <strong style={{ fontSize: '0.85rem', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block', whiteSpace: 'nowrap' }}>
                          {getGameEmoji(data.stats.favoriteGame)} {data.stats.favoriteGame}
                        </strong>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.25rem', borderTop: '1px solid hsl(220 15% 15%)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Win Rate</span>
                        <strong style={{ fontSize: '0.9rem', color: 'hsl(142 70% 55%)' }}>{data.stats.winPercent}% <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', fontWeight: 500 }}>({data.stats.wins} / {data.stats.totalMatches})</span></strong>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.25rem', borderTop: '1px solid hsl(220 15% 15%)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Max Win Streak</span>
                        <strong style={{ fontSize: '0.9rem', color: 'hsl(38 95% 60%)' }}>🔥 {data.profile.longestStreak} <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', fontWeight: 500 }}>(curr: {data.profile.currentStreak})</span></strong>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.25rem', borderTop: '1px solid hsl(220 15% 15%)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Global Rank</span>
                        <strong style={{ fontSize: '0.9rem', color: 'hsl(45 100% 55%)' }}>#{data.stats.rank}</strong>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.25rem', borderTop: '1px solid hsl(220 15% 15%)' }}>
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Coins Balance</span>
                        <strong style={{ fontSize: '0.9rem', color: 'hsl(45 100% 50%)' }}>🪙 {(data.profile.coins ?? 0).toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Level Progress Bar & % */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.25rem', background: 'hsl(222 20% 8% / 0.5)', padding: '0.75rem', borderRadius: 12, border: '1px solid hsl(220 15% 18%)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <span style={{ color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Level Progress</span>
                        <span style={{ fontWeight: 800, color: 'hsl(220 100% 75%)' }}>{prog.progressPercent}%</span>
                      </div>
                      <div style={{ height: 8, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden', border: '1px solid hsl(220 15% 15%)' }}>
                        <div
                          style={{
                            width: `${prog.progressPercent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                            borderRadius: 99,
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>
                        <span>{prog.xpInLevel.toLocaleString()} / {prog.levelRange.toLocaleString()} XP</span>
                        <span>{prog.xpRemaining.toLocaleString()} XP to Level {data.profile.level + 1}</span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Badges Strip */}
              {data.badges.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.4rem 0' }}>
                    Unlocked Badges ({data.badges.length})
                  </h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {data.badges.map((badge) => (
                      <div
                        key={badge.slug}
                        style={{
                          background: 'hsl(220 20% 8%)',
                          border: '1px solid hsl(220 15% 18%)',
                          borderRadius: 8,
                          padding: '0.35rem 0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        title={`${badge.name}: ${badge.description}`}
                      >
                        <span style={{ fontSize: '0.9rem' }}>🏅</span>
                        <span style={{ fontSize: '0.72rem', color: 'hsl(45 100% 65%)', fontWeight: 700 }}>{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity List */}
              <div>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.4rem 0' }}>
                  Recent Activity
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {data.activity.slice(0, 4).map((act, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.45rem 0.6rem',
                        background: 'hsl(220 20% 7%)',
                        border: '1px solid hsl(220 20% 12%)',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                      }}
                    >
                      <span style={{ color: 'hsl(220 10% 75%)' }}>{act.text}</span>
                      <strong style={{ color: act.amount >= 0 ? 'hsl(220 100% 65%)' : 'hsl(0 80% 60%)' }}>
                        {act.amount >= 0 ? `+${act.amount}` : act.amount} XP
                      </strong>
                    </div>
                  ))}
                  {data.activity.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'hsl(220 10% 40%)', fontSize: '0.75rem', border: '1px dashed hsl(220 15% 16%)', borderRadius: 8 }}>
                      No recent activities.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
