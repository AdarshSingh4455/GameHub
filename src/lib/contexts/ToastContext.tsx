'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

export interface NotificationEvent {
  id: string
  type: 'achievement_unlocked' | 'daily_reward_claimed' | 'level_up' | 'new_badge' | 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
  meta?: Record<string, unknown>
  action?: {
    label: string
    onClick: () => void
  }
  /** Secondary actions (e.g. for challenge toasts) */
  actions?: Array<{
    label: string
    style?: 'primary' | 'secondary' | 'danger'
    onClick: () => void
  }>
  /** Deduplication key — if a toast with same key exists, it is updated in-place instead of stacked */
  dedupeKey?: string
}

const MAX_TOASTS = 3

interface ToastContextType {
  toasts: NotificationEvent[]
  addToast: (
    type: NotificationEvent['type'],
    title: string,
    message: string,
    meta?: Record<string, unknown>,
    action?: { label: string; onClick: () => void },
    options?: { dedupeKey?: string; actions?: NotificationEvent['actions'] }
  ) => void
  dismissToast: (id: string) => void
  updateToast: (id: string, patch: Partial<Pick<NotificationEvent, 'title' | 'message' | 'action' | 'actions'>>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<NotificationEvent[]>([])
  const timerMap = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismissToast = useCallback((id: string) => {
    clearTimeout(timerMap.current[id])
    delete timerMap.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, patch: Partial<Pick<NotificationEvent, 'title' | 'message' | 'action' | 'actions'>>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }, [])

  const scheduleAutoDismiss = useCallback((id: string, hasAction: boolean) => {
    const delay = hasAction ? 9000 : 5000
    clearTimeout(timerMap.current[id])
    timerMap.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timerMap.current[id]
    }, delay)
  }, [])

  const addToast = useCallback(
    (
      type: NotificationEvent['type'],
      title: string,
      message: string,
      meta?: Record<string, unknown>,
      action?: { label: string; onClick: () => void },
      options?: { dedupeKey?: string; actions?: NotificationEvent['actions'] }
    ) => {
      const { dedupeKey, actions } = options ?? {}

      setToasts((prev) => {
        // ── Deduplication: update existing toast with same dedupeKey ──────────
        if (dedupeKey) {
          const existingIdx = prev.findIndex(t => t.dedupeKey === dedupeKey)
          if (existingIdx !== -1) {
            const updated = [...prev]
            updated[existingIdx] = { ...updated[existingIdx], title, message, action, actions }
            scheduleAutoDismiss(updated[existingIdx].id, !!(action || actions?.length))
            return updated
          }
        }

        const id = Math.random().toString(36).substring(2, 9)
        const newToast: NotificationEvent = { id, type, title, message, meta, action, actions, dedupeKey }

        scheduleAutoDismiss(id, !!(action || actions?.length))

        // ── Max-3 cap: evict oldest if needed ─────────────────────────────────
        const next = [...prev, newToast]
        if (next.length > MAX_TOASTS) {
          const evicted = next.shift()!
          clearTimeout(timerMap.current[evicted.id])
          delete timerMap.current[evicted.id]
        }
        return next
      })
    },
    [scheduleAutoDismiss]
  )

  // Global gamehub_toast custom event support
  React.useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) {
        addToast(detail.type, detail.title, detail.message, detail.meta)
      }
    }
    window.addEventListener('gamehub_toast', handleToast)
    return () => window.removeEventListener('gamehub_toast', handleToast)
  }, [addToast])

  // ── Style helpers ────────────────────────────────────────────────────────────
  const getIcon = (type: NotificationEvent['type']) => {
    switch (type) {
      case 'achievement_unlocked': return '🏆'
      case 'daily_reward_claimed': return '🎁'
      case 'level_up':             return '⭐'
      case 'new_badge':            return '🏅'
      case 'success':              return '✅'
      case 'error':                return '❌'
      case 'warning':              return '⚠️'
      default:                     return '🔔'
    }
  }

  const getAccentColor = (type: NotificationEvent['type']) => {
    switch (type) {
      case 'achievement_unlocked': return 'hsl(38 95% 60%)'
      case 'daily_reward_claimed': return 'hsl(220 100% 65%)'
      case 'level_up':             return 'hsl(142 70% 55%)'
      case 'new_badge':            return 'hsl(45 100% 60%)'
      case 'success':              return 'hsl(142 70% 55%)'
      case 'error':                return 'hsl(0 80% 60%)'
      case 'warning':              return 'hsl(38 95% 55%)'
      default:                     return 'hsl(270 80% 65%)'
    }
  }

  const getActionButtonStyle = (style?: 'primary' | 'secondary' | 'danger') => {
    switch (style) {
      case 'secondary': return { background: 'hsl(220 20% 20%)', color: 'hsl(220 10% 80%)' }
      case 'danger':    return { background: 'hsl(0 80% 50%)', color: 'white' }
      default:          return { background: 'hsl(220 100% 60%)', color: 'white' }
    }
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast, updateToast }}>
      {children}

      {/* ── Floating Toasts Portal ── */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          maxWidth: '370px',
          width: 'calc(100vw - 2.5rem)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          const accent = getAccentColor(toast.type)
          return (
            <div
              key={toast.id}
              role="alert"
              className="ghtoast-item animate-slideInRight"
              style={{
                pointerEvents: 'auto',
                background: 'hsl(220 22% 9% / 0.95)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid hsl(220 20% 18%)',
                borderLeft: `4px solid ${accent}`,
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                boxShadow: `0 12px 36px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glow tint */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${accent}08 0%, transparent 60%)`,
                pointerEvents: 'none',
                borderRadius: 'inherit',
              }} />

              <span style={{ fontSize: '1.4rem', flexShrink: 0, position: 'relative' }}>
                {getIcon(toast.type)}
              </span>

              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'hsl(220 15% 94%)', lineHeight: 1.3 }}>
                  {toast.title}
                </h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'hsl(220 10% 60%)', lineHeight: 1.45 }}>
                  {toast.message}
                </p>

                {/* Multi-action buttons (for challenges etc.) */}
                {toast.actions && toast.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                    {toast.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => { act.onClick(); dismissToast(toast.id) }}
                        style={{
                          ...getActionButtonStyle(act.style),
                          border: 'none',
                          borderRadius: '7px',
                          padding: '0.32rem 0.7rem',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'filter 0.15s',
                          pointerEvents: 'auto',
                        }}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Single action button */}
                {!toast.actions?.length && toast.action && (
                  <button
                    onClick={() => { toast.action?.onClick(); dismissToast(toast.id) }}
                    style={{
                      marginTop: '0.55rem',
                      padding: '0.32rem 0.75rem',
                      background: 'hsl(220 100% 60%)',
                      border: 'none',
                      borderRadius: '7px',
                      color: 'white',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      pointerEvents: 'auto',
                    }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(220 10% 40%)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  position: 'absolute',
                  top: '0.6rem',
                  right: '0.6rem',
                  lineHeight: 1,
                  transition: 'color 0.15s',
                  pointerEvents: 'auto',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'hsl(220 10% 75%)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'hsl(220 10% 40%)')}
              >
                ✕
              </button>
            </div>
          )
        })}
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
