'use client'

import React, { useEffect, useState } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'

interface SocketDiagnosticsProps {
  roomCode?: string
  roomOwner?: string
}

export default function SocketDiagnostics({ roomCode, roomOwner }: SocketDiagnosticsProps) {
  const { socket, isConnected, reconnectCount, pingLatency } = useSocket()
  const [isDebug, setIsDebug] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setIsDebug(params.get('debug') === 'true')
    }
  }, [])

  if (!isDebug) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1.5px dashed #ff007f',
        borderRadius: '12px',
        padding: '1rem',
        color: '#f8fafc',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        zIndex: 99999,
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        maxWidth: '320px',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{ fontWeight: 900, color: '#ff007f', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.35rem', marginBottom: '0.35rem', letterSpacing: '0.05em' }}>
        🛠 DEV SOCKET DIAGNOSTICS
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Status:</span>
        <span style={{ color: isConnected ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <span>Socket ID:</span>
        <span style={{ color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
          {socket?.id || 'none'}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Room Code:</span>
        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{roomCode || 'none'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Room Owner:</span>
        <span style={{ color: '#c084fc' }}>{roomOwner || 'none'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Reconnects:</span>
        <span style={{ color: reconnectCount > 0 ? '#ef4444' : '#f8fafc', fontWeight: 'bold' }}>
          {reconnectCount}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Ping Latency:</span>
        <span style={{ color: pingLatency < 80 ? '#22c55e' : pingLatency < 200 ? '#fbbf24' : '#ef4444', fontWeight: 'bold' }}>
          {pingLatency}ms
        </span>
      </div>
    </div>
  )
}
