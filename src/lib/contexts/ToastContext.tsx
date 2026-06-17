'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export interface NotificationEvent {
  id: string
  type: 'achievement_unlocked' | 'daily_reward_claimed' | 'level_up' | 'new_badge' | 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  meta?: Record<string, unknown>
}

interface ToastContextType {
  toasts: NotificationEvent[]
  addToast: (
    type: NotificationEvent['type'],
    title: string,
    message: string,
    meta?: Record<string, unknown>
  ) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<NotificationEvent[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (
      type: NotificationEvent['type'],
      title: string,
      message: string,
      meta?: Record<string, unknown>
    ) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: NotificationEvent = { id, type, title, message, meta }
      
      setToasts((prev) => [...prev, newToast])

      // Auto dismiss after 5 seconds
      setTimeout(() => {
        dismissToast(id)
      }, 5000)
    },
    [dismissToast]
  )

  React.useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        addToast(detail.type, detail.title, detail.message, detail.meta)
      }
    }
    window.addEventListener('gamehub_toast', handleToast)
    return () => {
      window.removeEventListener('gamehub_toast', handleToast)
    }
  }, [addToast])

  const getIcon = (type: NotificationEvent['type']) => {
    switch (type) {
      case 'achievement_unlocked':
        return '🏆'
      case 'daily_reward_claimed':
        return '🎁'
      case 'level_up':
        return '⭐'
      case 'new_badge':
        return '🏅'
      default:
        return '🔔'
    }
  }

  const getBorderColor = (type: NotificationEvent['type']) => {
    switch (type) {
      case 'achievement_unlocked':
        return 'hsl(38 95% 60%)' // Gold
      case 'daily_reward_claimed':
        return 'hsl(220 100% 65%)' // Blue
      case 'level_up':
        return 'hsl(142 70% 55%)' // Green
      default:
        return 'hsl(270 80% 65%)' // Purple
    }
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}

      {/* Floating Toasts Portal Container */}
      <div
        style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxWidth: '360px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-slideInRight"
            style={{
              pointerEvents: 'auto',
              background: 'hsl(220 20% 10% / 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid hsl(220 20% 18%)',
              borderLeft: `4px solid ${getBorderColor(toast.type)}`,
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'start',
              gap: '0.75rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{getIcon(toast.type)}</span>
            <div style={{ flex: 1, paddingRight: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 700, color: 'hsl(220 15% 92%)' }}>
                {toast.title}
              </h4>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'hsl(220 10% 45%)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                padding: '0.1rem 0.25rem',
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
