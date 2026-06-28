'use client'

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameSession } from './GameSessionContext'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './ToastContext'
import { useRouter } from 'next/navigation'

export interface UserPresence {
  status: 'ONLINE' | 'OFFLINE' | 'IN_GAME' | 'IN_LOBBY' | 'IN_CHAT' | 'AWAY'
  activity: string
  gameSlug?: string
  gameMode?: string
  startedAt?: number
  lastSeenAt: string
  username?: string
}

export interface ChallengeState {
  id: string
  roomCode: string
  gameSlug: string
  senderName: string
  senderUserId: string
  expiresAt: number
  status: 'pending' | 'accepted' | 'rejected' | 'later' | 'expired'
}

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  reconnectCount: number
  pingLatency: number
  presenceMap: Record<string, UserPresence>
  friendUserIds: Set<string>
  incomingChallenge: ChallengeState | null
  clearIncomingChallenge: () => void
  updateActivity: (
    status: UserPresence['status'],
    activity: string,
    gameSlug?: string,
    gameMode?: string,
    startedAt?: number
  ) => void
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnectCount: 0,
  pingLatency: 0,
  presenceMap: {},
  friendUserIds: new Set(),
  incomingChallenge: null,
  clearIncomingChallenge: () => {},
  updateActivity: () => {}
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useGameSession()
  const { addToast } = useToast()
  const router = useRouter()

  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [pingLatency, setPingLatency] = useState(0)
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({})
  const [friendUserIds, setFriendUserIds] = useState<Set<string>>(new Set())
  const [incomingChallenge, setIncomingChallenge] = useState<ChallengeState | null>(null)

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const presenceMapRef = useRef<Record<string, UserPresence>>({})
  const connectedAtRef = useRef<number>(0)

  // ── Batched "friend online" notifications ────────────────────────────────────
  // Collect names for 3 seconds then fire a single grouped toast
  const pendingOnlineRef = useRef<string[]>([])
  const onlineBatchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Per-friend: last game slug shown in a toast (to avoid re-toasting same game)
  const lastGameToastRef = useRef<Record<string, string>>({})

  const clearIncomingChallenge = useCallback(() => setIncomingChallenge(null), [])

  // Fetch friend IDs so we can identify friend presence events
  useEffect(() => {
    if (!user) return
    const loadFriends = () => {
      fetch('/api/friends')
        .then(res => res.json())
        .then(data => {
          const ids = new Set<string>((data.friends || []).map((f: { userId?: string; id: string }) => f.userId || f.id))
          setFriendUserIds(ids)
        })
        .catch(() => {})
    }
    loadFriends()
    window.addEventListener('gamehub_friends_update', loadFriends)
    return () => window.removeEventListener('gamehub_friends_update', loadFriends)
  }, [user])

  const updateActivity = useCallback((
    status: UserPresence['status'],
    activity: string,
    gameSlug?: string,
    gameMode?: string,
    startedAt?: number
  ) => {
    if (socket && socket.connected) {
      socket.emit('activity-update', { status, activity, gameSlug, gameMode, startedAt })
    }
  }, [socket])

  // Fire the batched "friend online" toast
  const flushOnlineBatch = useCallback(() => {
    const names = pendingOnlineRef.current
    if (names.length === 0) return
    pendingOnlineRef.current = []
    onlineBatchTimerRef.current = null

    if (names.length === 1) {
      addToast('success', 'Friend Online 🟢', `${names[0]} came online`, undefined, undefined, {
        dedupeKey: 'friend-online-batch'
      })
    } else {
      const first = names[0]
      const rest = names.length - 1
      addToast('success', 'Friends Online 🟢', `${first} and ${rest} other${rest > 1 ? 's' : ''} came online`, undefined, undefined, {
        dedupeKey: 'friend-online-batch'
      })
    }
  }, [addToast])

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect()
        setSocket(null)
        setIsConnected(false)
      }
      return
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'
    let socketInstance: Socket
    let pingInterval: NodeJS.Timeout

    const initSocket = async () => {
      let authPayload: Record<string, string> = {}

      const cookies = typeof document !== 'undefined' ? Object.fromEntries(
        document.cookie.split(';').map(c => {
          const eqIdx = c.indexOf('=')
          if (eqIdx === -1) return [c.trim(), '']
          return [c.substring(0, eqIdx).trim(), decodeURIComponent(c.substring(eqIdx + 1).trim())]
        })
      ) : {}

      const isMockMode = cookies['mock_user_id'] !== undefined || user.id.startsWith('mock-')

      if (isMockMode) {
        authPayload = {
          mockUserId: cookies['mock_user_id'] || user.id,
          mockUsername: cookies['mock_username'] || user.user_metadata?.username || 'Guest'
        }
      } else {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        authPayload = { token: session?.access_token ?? '' }
      }

      socketInstance = io(socketUrl, {
        auth: authPayload,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      })

      // ── Connected ──────────────────────────────────────────────────────────
      socketInstance.on('connect', () => {
        setIsConnected(true)
        setReconnectCount(0)
        connectedAtRef.current = Date.now()
        console.log('🔌 Connected to GameHub real-time socket server')

        socketInstance.emit('get-presence-map', (data: Record<string, UserPresence>) => {
          setPresenceMap(data || {})
          presenceMapRef.current = data || {}
        })

        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          socketInstance.emit('heartbeat')
        }, 10000)

        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          const start = Date.now()
          socketInstance.emit('ping-latency', () => { setPingLatency(Date.now() - start) })
        }, 3000)
      })

      socketInstance.on('disconnect', () => {
        setIsConnected(false)
        console.log('❌ Disconnected from real-time socket server')
        if (heartbeatIntervalRef.current) { clearInterval(heartbeatIntervalRef.current); heartbeatIntervalRef.current = null }
        if (pingInterval) clearInterval(pingInterval)
      })

      socketInstance.io.on('reconnect_attempt', (attempt) => setReconnectCount(attempt))
      socketInstance.io.on('reconnect', () => setReconnectCount(0))

      // ── Presence Change ────────────────────────────────────────────────────
      socketInstance.on('presence-change', (data: { userId: string } & UserPresence) => {
        setPresenceMap(prev => {
          const updated = {
            ...prev,
            [data.userId]: {
              status: data.status,
              activity: data.activity,
              gameSlug: data.gameSlug,
              gameMode: data.gameMode,
              startedAt: data.startedAt,
              lastSeenAt: data.lastSeenAt,
              username: data.username
            }
          }

          const isFriend = friendUserIds.has(data.userId)
          const isPostLoad = Date.now() - connectedAtRef.current > 5000
          const prevStatus = presenceMapRef.current[data.userId]

          if (isFriend && isPostLoad) {
            const friendName = data.username || 'A friend'

            // ── Friend came online: batch into grouped toast ────────────────
            if (data.status === 'ONLINE' && (!prevStatus || prevStatus.status === 'OFFLINE')) {
              pendingOnlineRef.current.push(friendName)
              if (onlineBatchTimerRef.current) clearTimeout(onlineBatchTimerRef.current)
              onlineBatchTimerRef.current = setTimeout(flushOnlineBatch, 3000)
            }

            // ── Friend started playing a NEW game: only once per game slug ──
            if (
              data.status === 'IN_GAME' &&
              data.gameSlug &&
              lastGameToastRef.current[data.userId] !== data.gameSlug
            ) {
              lastGameToastRef.current[data.userId] = data.gameSlug
              const gameName = data.activity || data.gameSlug
              addToast('info', 'Friend In Game 🎮', `${friendName} is playing ${gameName}`, undefined, undefined, {
                dedupeKey: `friend-game-${data.userId}`
              })
            }

            // ── Friend went offline: clear their game toast key ────────────
            if (data.status === 'OFFLINE') {
              delete lastGameToastRef.current[data.userId]
            }
          }

          presenceMapRef.current = updated
          return updated
        })
      })

      // ── Lobby Invite ───────────────────────────────────────────────────────
      socketInstance.on('lobby-invite-received', (data: {
        id: string; roomCode: string; gameSlug: string; senderName: string; senderUserId: string
      }) => {
        const gameLabel = data.gameSlug.replace(/-/g, ' ')
        addToast(
          'info',
          'Lobby Invitation ✉️',
          `${data.senderName} invited you to play ${gameLabel}`,
          undefined,
          {
            label: 'Accept & Join',
            onClick: () => {
              router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`)
              window.dispatchEvent(new Event('gamehub_notifications_update'))
            }
          },
          { dedupeKey: `lobby-invite-${data.roomCode}` }
        )
        window.dispatchEvent(new Event('gamehub_notifications_update'))
      })

      // ── Challenge Received ─────────────────────────────────────────────────
      socketInstance.on('challenge-received', (data: {
        id: string; roomCode: string; gameSlug: string; senderName: string; senderUserId: string; expiresAt: number
      }) => {
        const gameLabel = data.gameSlug.replace(/-/g, ' ')

        // Store challenge state for UI access
        setIncomingChallenge({
          ...data,
          status: 'pending'
        })

        addToast(
          'warning',
          '⚔️ Challenge Received!',
          `${data.senderName} challenged you to ${gameLabel}`,
          undefined,
          undefined,
          {
            dedupeKey: `challenge-${data.id}`,
            actions: [
              {
                label: '✓ Accept',
                style: 'primary',
                onClick: () => {
                  socketInstance.emit('challenge-response', { challengeId: data.id, action: 'accept', roomCode: data.roomCode })
                  setIncomingChallenge(prev => prev?.id === data.id ? { ...prev, status: 'accepted' } : prev)
                  router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`)
                  window.dispatchEvent(new Event('gamehub_notifications_update'))
                }
              },
              {
                label: '🕐 Later',
                style: 'secondary',
                onClick: () => {
                  socketInstance.emit('challenge-response', { challengeId: data.id, action: 'later', roomCode: data.roomCode })
                  setIncomingChallenge(prev => prev?.id === data.id ? { ...prev, status: 'later' } : prev)
                }
              },
              {
                label: '✕ Reject',
                style: 'danger',
                onClick: () => {
                  socketInstance.emit('challenge-response', { challengeId: data.id, action: 'reject', roomCode: data.roomCode })
                  setIncomingChallenge(prev => prev?.id === data.id ? { ...prev, status: 'rejected' } : prev)
                }
              }
            ]
          }
        )
        window.dispatchEvent(new Event('gamehub_notifications_update'))
      })

      // ── Challenge Outcome (challenger receives response) ──────────────────
      socketInstance.on('challenge-outcome', (data: {
        action: 'accepted' | 'rejected' | 'later'; responderName: string; roomCode?: string
      }) => {
        if (data.action === 'accepted') {
          addToast('success', 'Challenge Accepted! ⚔️', `${data.responderName} accepted your challenge! Joining room...`, undefined,
            data.roomCode ? {
              label: 'Join Room',
              onClick: () => router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`)
            } : undefined,
            { dedupeKey: `challenge-outcome-${data.responderName}` }
          )
          if (data.roomCode) {
            setTimeout(() => router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`), 1500)
          }
        } else if (data.action === 'rejected') {
          addToast('error', 'Challenge Declined', `${data.responderName} declined your challenge.`, undefined, undefined, {
            dedupeKey: `challenge-outcome-${data.responderName}`
          })
        } else if (data.action === 'later') {
          addToast('info', 'Challenge: Later', `${data.responderName} will play later.`, undefined, undefined, {
            dedupeKey: `challenge-outcome-${data.responderName}`
          })
        }
      })

      // ── Visibility / App Resume ────────────────────────────────────────────
      const handleAppResume = () => {
        if (socketInstance) {
          if (!socketInstance.connected) socketInstance.connect()
          else socketInstance.emit('heartbeat')
        }
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') handleAppResume()
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      const isCapacitor = typeof window !== 'undefined' && (window as unknown as { Capacitor?: unknown }).Capacitor
      let appStateListener: { remove: () => void } | null = null
      if (isCapacitor) {
        import('@capacitor/app').then(({ App }) => {
          App.addListener('appStateChange', (state: { isActive: boolean }) => {
            if (state.isActive) handleAppResume()
          }).then((listener: { remove: () => void }) => {
            appStateListener = listener
          })
        }).catch(err => {
          console.error('[SocketContext] Failed to load @capacitor/app plugin:', err)
        })
      }

      setSocket(socketInstance)

      return () => {
        if (socketInstance) socketInstance.disconnect()
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        if (pingInterval) clearInterval(pingInterval)
        if (onlineBatchTimerRef.current) clearTimeout(onlineBatchTimerRef.current)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        if (appStateListener) appStateListener.remove()
      }
    }

    initSocket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friendUserIds])

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      reconnectCount,
      pingLatency,
      presenceMap,
      friendUserIds,
      incomingChallenge,
      clearIncomingChallenge,
      updateActivity
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
