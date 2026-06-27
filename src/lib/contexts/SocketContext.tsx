'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
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

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  reconnectCount: number
  pingLatency: number
  presenceMap: Record<string, UserPresence>
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
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Keep a mutable ref of presenceMap and connection duration to prevent toaster spam during page load/sync
  const presenceMapRef = useRef<Record<string, UserPresence>>({})
  const connectedAtRef = useRef<number>(0)

  // Fetch friends list once connected to identify friend IDs for toaster alerts
  useEffect(() => {
    if (user) {
      const loadFriends = () => {
        fetch('/api/friends')
          .then(res => res.json())
          .then(data => {
            const ids = new Set<string>((data.friends || []).map((f: any) => f.userId || f.id))
            setFriendUserIds(ids)
          })
          .catch(() => {})
      }
      loadFriends()
      window.addEventListener('gamehub_friends_update', loadFriends)
      return () => window.removeEventListener('gamehub_friends_update', loadFriends)
    }
  }, [user])

  const updateActivity = (
    status: UserPresence['status'],
    activity: string,
    gameSlug?: string,
    gameMode?: string,
    startedAt?: number
  ) => {
    if (socket && socket.connected) {
      socket.emit('activity-update', { status, activity, gameSlug, gameMode, startedAt })
    }
  }

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
      let authPayload: Record<string, any> = {}

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
        authPayload = {
          token: session?.access_token
        }
      }

      socketInstance = io(socketUrl, {
        auth: authPayload,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      })

      socketInstance.on('connect', () => {
        setIsConnected(true)
        setReconnectCount(0)
        connectedAtRef.current = Date.now()
        console.log('🔌 Connected to GameHub real-time socket server')
        
        // Fetch current presence mapping for all active users
        socketInstance.emit('get-presence-map', (data: Record<string, UserPresence>) => {
          setPresenceMap(data || {})
          presenceMapRef.current = data || {}
        })

        // Heartbeat keepalive every 10 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          socketInstance.emit('heartbeat')
        }, 10000)

        // Latency checker every 3 seconds
        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          const start = Date.now()
          socketInstance.emit('ping-latency', () => {
            setPingLatency(Date.now() - start)
          })
        }, 3000)
      })

      socketInstance.on('disconnect', () => {
        setIsConnected(false)
        console.log('❌ Disconnected from real-time socket server')
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        if (pingInterval) {
          clearInterval(pingInterval)
        }
      })

      socketInstance.io.on('reconnect_attempt', (attempt) => {
        setReconnectCount(attempt)
      })

      socketInstance.io.on('reconnect', () => {
        setReconnectCount(0)
      })

      // Presence change listener
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
          
          // Toast alert for friends presence updates (throttle on initial connection)
          const isFriend = friendUserIds.has(data.userId)
          const isPostLoad = Date.now() - connectedAtRef.current > 5000
          const prevStatus = presenceMapRef.current[data.userId]

          if (isFriend && isPostLoad) {
            const friendName = data.username || 'A friend'
            if (!prevStatus || prevStatus.status === 'OFFLINE' || prevStatus.status === undefined) {
              if (data.status === 'ONLINE') {
                addToast('success', 'Friend Online 🟢', `${friendName} came online`)
              }
            } else if (data.status === 'IN_GAME' && prevStatus.status !== 'IN_GAME' && data.activity) {
              addToast('info', 'Friend In Game 🎮', `${friendName} started playing ${data.activity}`)
            }
          }

          presenceMapRef.current = updated
          return updated
        })
      })

      // Lobby Invite socket event listener
      socketInstance.on('lobby-invite-received', (data: {
        id: string
        roomCode: string
        gameSlug: string
        senderName: string
        senderUserId: string
      }) => {
        const gameLabel = data.gameSlug.replace('-', ' ').toUpperCase()
        addToast(
          'info',
          'Lobby Invitation ✉️',
          `${data.senderName} invited you to play a match of ${gameLabel}!`,
          undefined,
          {
            label: 'Accept & Join',
            onClick: () => {
              router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`)
              window.dispatchEvent(new Event('gamehub_notifications_update'))
            }
          }
        )
        window.dispatchEvent(new Event('gamehub_notifications_update'))
      })

      // Direct Challenge socket event listener
      socketInstance.on('challenge-received', (data: {
        id: string
        roomCode: string
        gameSlug: string
        senderName: string
        senderUserId: string
        expiresAt: number
      }) => {
        const gameLabel = data.gameSlug.replace('-', ' ').toUpperCase()
        addToast(
          'warning',
          'Direct Challenge ⚔️',
          `${data.senderName} has challenged you to a duel of ${gameLabel}!`,
          undefined,
          {
            label: 'Accept Duel',
            onClick: () => {
              router.push(`/dashboard/multiplayer?action=join&code=${data.roomCode}`)
              window.dispatchEvent(new Event('gamehub_notifications_update'))
            }
          }
        )
        window.dispatchEvent(new Event('gamehub_notifications_update'))
      })

      // visibility change events
      const handleAppResume = () => {
        if (socketInstance) {
          if (!socketInstance.connected) {
            socketInstance.connect()
          } else {
            socketInstance.emit('heartbeat')
          }
        }
      }

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          handleAppResume()
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor
      let appStateListener: any = null
      if (isCapacitor) {
        import('@capacitor/app').then(({ App }) => {
          App.addListener('appStateChange', (state: any) => {
            if (state.isActive) {
              handleAppResume()
            }
          }).then(listener => {
            appStateListener = listener
          })
        }).catch(err => {
          console.error('[SocketContext] Failed to load @capacitor/app plugin:', err)
        })
      }

      setSocket(socketInstance)

      return () => {
        if (socketInstance) {
          socketInstance.disconnect()
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
        }
        if (pingInterval) {
          clearInterval(pingInterval)
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        if (appStateListener) {
          appStateListener.remove()
        }
      }
    }

    initSocket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friendUserIds])

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnectCount, pingLatency, presenceMap, updateActivity }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
