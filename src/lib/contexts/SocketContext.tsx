'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameSession } from './GameSessionContext'
import { createClient } from '@/lib/supabase/client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
  reconnectCount: number
  pingLatency: number
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  reconnectCount: 0,
  pingLatency: 0
})

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useGameSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const [pingLatency, setPingLatency] = useState(0)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

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

      // Check if we are using mock auth
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
        transports: ['websocket'], // Restrict to WebSocket for scaling
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      })

      socketInstance.on('connect', () => {
        setIsConnected(true)
        setReconnectCount(0)
        console.log('🔌 Connected to GameHub real-time socket server')
        
        // Start presence keepalive heartbeat every 10 seconds
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

      setSocket(socketInstance)
    }

    initSocket()

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnectCount, pingLatency }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
