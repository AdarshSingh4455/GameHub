'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useGameSession } from './GameSessionContext'
import { createClient } from '@/lib/supabase/client'

interface SocketContextType {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketContextType>({ socket: null, isConnected: false })

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useGameSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
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
        console.log('🔌 Connected to GameHub real-time socket server')
        
        // Start presence keepalive heartbeat every 10 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          socketInstance.emit('heartbeat')
        }, 10000)
      })

      socketInstance.on('disconnect', () => {
        setIsConnected(false)
        console.log('❌ Disconnected from real-time socket server')
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
