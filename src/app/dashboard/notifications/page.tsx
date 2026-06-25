'use client'

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
      case 'ACHIEVEMENT': return '🏆'
      case 'FRIEND_REQUEST': return '👥'
      case 'ROOM_INVITE': return '🎮'
      case 'TOURNAMENT': return '🏅'
      case 'BILLING': return '🪙'
      default: return '🔔'
    }
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h3>🔒 Access Restricted</h3>
        <p style={{ color: 'hsl(220 10% 50%)' }}>Please sign in to view your notification logs.</p>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <PageWrapper className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper" style={{ maxWidth: 700, marginInline: 'auto' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
            🔔 Notification Hub
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)' }}>
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '4rem 2rem', background: 'hsl(222 20% 8% / 0.6)', border: '1px dashed hsl(220 15% 16%)' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
          <h3 style={{ fontWeight: 700, color: 'white', margin: 0 }}>In-box Empty</h3>
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>All clean! No new alert logs compiled.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map(n => (
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
