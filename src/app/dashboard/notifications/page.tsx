'use client'
import { TrophyIcon, UsersIcon, GamepadIcon, AwardIcon, CoinsIcon, BellIcon, InboxIcon, LockIcon } from '@/components/shared/Icons'

import React, { useEffect, useState } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/layout/Card'

interface Notification {
  id: string
  type: 'ACHIEVEMENT' | 'FRIEND_REQUEST' | 'ROOM_INVITE' | 'TOURNAMENT' | 'SYSTEM' | 'BILLING'
  title: string
  message: string
  linkUrl: string | null
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const getTournamentCategory = (title: string, message: string): 'registration' | 'match' | 'walkover' | 'result' | 'other' => {
    const text = `${title} ${message}`.toLowerCase()
    if (text.includes('walkover') || text.includes('disqualified') || text.includes('inactivity') || text.includes('missed')) {
      return 'walkover'
    }
    if (text.includes('winner') || text.includes('defeated') || text.includes('eliminated') || text.includes('completed') || text.includes('first place') || text.includes('advanced') || text.includes('won by')) {
      return 'result'
    }
    if (text.includes('match') || text.includes('opponent') || text.includes('lobby') || text.includes('ready') || text.includes('joined')) {
      return 'match'
    }
    if (text.includes('register') || text.includes('registration') || text.includes('waiting list') || text.includes('waitlist') || text.includes('bracket generated') || text.includes('announcement')) {
      return 'registration'
    }
    return 'other'
  }

  const getTabNotifications = (tab: string) => {
    return notifications.filter(n => {
      if (tab === 'all') return true
      if (n.type !== 'TOURNAMENT') {
        return tab === 'other'
      }
      const cat = getTournamentCategory(n.title, n.message)
      return cat === tab
    })
  }

  const getUnreadCount = (tab: string) => {
    return getTabNotifications(tab).filter(n => !n.isRead).length
  }

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/notifications')
      if (!res.ok) throw new Error('Failed to load notifications')
      const data = await res.json()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error(err)
      addToast('error', 'Error', 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchNotifications()
    }
  }, [user])

  const handleMarkRead = async (id: string) => {
    try {
      setActionLoadingId(id)
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', id })
      })
      if (!res.ok) throw new Error()
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      addToast('success', 'Marked Read', 'Notification marked as read.')
    } catch {
      addToast('error', 'Error', 'Failed to update notification')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' })
      })
      if (!res.ok) throw new Error()

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      addToast('success', 'Success', 'All notifications marked as read.')
    } catch {
      addToast('error', 'Error', 'Failed to update notifications')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      setActionLoadingId(id)
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id })
      })
      if (!res.ok) throw new Error()

      setNotifications(prev => prev.filter(n => n.id !== id))
      addToast('info', 'Deleted', 'Notification removed.')
    } catch {
      addToast('error', 'Error', 'Failed to delete notification')
    } finally {
      setActionLoadingId(null)
    }
  }

  const getEmojiForType = (type: string) => {
    switch (type) {
      case 'ACHIEVEMENT': return <TrophyIcon size={18} className="text-yellow-400" />
      case 'FRIEND_REQUEST': return <UsersIcon size={18} className="text-blue-400" />
      case 'ROOM_INVITE': return <GamepadIcon size={18} className="text-purple-400" />
      case 'TOURNAMENT': return <AwardIcon size={18} className="text-yellow-400" />
      case 'BILLING': return <CoinsIcon size={18} className="text-yellow-400" />
      default: return <BellIcon size={18} className="text-gray-400" />
    }
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3><LockIcon size={20} className="inline mr-2 text-red-500" /> Access Restricted</h3>
        <p style={{ color: 'hsl(220 10% 50%)' }}>Please sign in to view your notification logs.</p>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const filteredNotifications = getTabNotifications(activeTab)

  return (
    <PageWrapper className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper" style={{ maxWidth: 700, marginInline: 'auto' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
            <BellIcon size={20} className="inline mr-2 text-blue-400" /> Notification Hub
          </h1>
          <p style={{ color: 'hsl(220 10% 55%)', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
            Stay updated on achievements, friend requests, room invitations, and tournament brackets.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', margin: '1.5rem 0 1rem' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'registration', label: 'Registration' },
          { id: 'match', label: 'Matches' },
          { id: 'walkover', label: 'Walkovers' },
          { id: 'result', label: 'Results' },
          { id: 'other', label: 'Others' }
        ].map(tab => {
          const count = getUnreadCount(tab.id)
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: 'none',
                background: isActive ? 'hsl(220 100% 60%)' : 'hsl(222 18% 10%)',
                color: isActive ? 'white' : 'hsl(220 10% 75%)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    background: isActive ? 'white' : 'hsl(340 85% 55%)',
                    color: isActive ? 'hsl(220 100% 60%)' : 'white',
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    minWidth: '18px',
                    textAlign: 'center'
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)' }}>
          Loading notifications...
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '4rem 2rem', background: 'hsl(222 20% 8% / 0.6)', border: '1px dashed hsl(220 15% 16%)' }}>
          <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><InboxIcon size={48} className="text-muted-foreground" /></span>
          <h3 style={{ fontWeight: 700, color: 'white', margin: 0 }}>In-box Empty</h3>
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>All clean! No alerts found in this category.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredNotifications.map(n => (
            <Card
              key={n.id}
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                background: n.isRead ? 'hsl(222 18% 10% / 0.7)' : 'linear-gradient(135deg, hsl(222 18% 12%), hsl(222 18% 10%))',
                border: n.isRead ? '1px solid hsl(220 15% 15%)' : '1px solid hsl(220 100% 60% / 0.25)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.4rem', marginTop: '0.1rem' }}>
                  {getEmojiForType(n.type)}
                </span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {n.title}
                    {!n.isRead && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'hsl(340 85% 55%)' }} />
                    )}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0.35rem', fontSize: '0.8rem', color: 'hsl(220 10% 65%)', lineHeight: 1.4 }}>
                    {n.message}
                  </p>
                  <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 45%)' }}>
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                {!n.isRead && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}
                    onClick={() => handleMarkRead(n.id)}
                    disabled={actionLoadingId === n.id}
                  >
                    Read
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem', color: 'hsl(0 80% 60%)' }}
                  onClick={() => handleDelete(n.id)}
                  disabled={actionLoadingId === n.id}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

    </PageWrapper>
  )
}
