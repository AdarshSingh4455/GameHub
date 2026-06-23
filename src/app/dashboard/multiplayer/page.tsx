'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { isRateLimited } from '@/lib/rateLimit'
import { useSocket } from '@/lib/contexts/SocketContext'
import PartyPanel from '@/components/layout/PartyPanel'
import Avatar from '@/components/shared/Avatar'
import SocketDiagnostics from '@/components/layout/SocketDiagnostics'

interface Player {
  id: string
  userId: string
  status: 'READY' | 'NOT_READY' | 'DISCONNECTED' | 'LEFT'
  joinedAt: string
  username: string
  avatarUrl: string | null
  level: number
  lastSeenAt?: string | null
  selectedFrame?: string | null
  selectedTitle?: string | null
}

interface Room {
  id: string
  roomCode: string
  gameSlug: string
  hostUserId: string
  status: 'WAITING' | 'STARTING' | 'PLAYING' | 'FINISHED'
  maxPlayers: number
}

interface Friend {
  id: string
  userId?: string
  username: string
  level: number
  xp: number
  avatarUrl: string | null
  selectedFrame?: string | null
  selectedTitle?: string | null
  lastSeenAt: string | null
}

interface Invite {
  id: string
  roomId: string
  senderId: string
  receiverId: string
  status: string
  createdAt: string
  room: {
    roomCode: string
    gameSlug: string
    status: string
  }
  sender: {
    username: string
    avatarUrl: string | null
    selectedFrame?: string | null
  }
}

interface ChatMessage {
  id: string
  userId: string
  message: string
  createdAt: string
  username: string
  avatarUrl: string | null
}

type Screen = 'MENU' | 'CREATE' | 'JOIN' | 'LOBBY'

const SUPPORTED_MULTIPLAYER_GAMES = [
  { slug: 'cricket', name: 'Hand Cricket', emoji: '🏏', desc: 'Strategic hand cricket duel with turns.' },
  { slug: 'dots-boxes', name: 'Dots & Boxes', emoji: '✏️', desc: 'Classic grid-based territory conquest.' },
  { slug: 'tic-tac-toe', name: 'Tic-Tac-Toe', emoji: '⭕', desc: 'Classic 3×3 noughts-and-crosses.' },
  { slug: 'memory', name: 'Memory Match', emoji: '🃏', desc: 'Flip cards, find pairs. A timeless memory challenge.' },
  { slug: 'rps', name: 'Rock Paper Scissors', emoji: '✊', desc: 'Classic simultaneous choice duel.' },
  { slug: 'number-guessing', name: 'Number Guessing', emoji: '🔢', desc: 'Guess the secret number between 1–100. Hot and cold feedback.' },
  { slug: 'scribble', name: 'Scribble', emoji: '🎨', desc: 'Draw and guess with friends in real time.' },
  { slug: 'hangman', name: 'Hangman', emoji: '🪓', desc: 'Guess the hidden word letter by letter.' }
]

const SESSION_KEY = 'mp_screen'
const SESSION_ROOM_CODE_KEY = 'mp_lobby_room_code'

function getClientUserId(user: any): string {
  if (typeof window !== 'undefined') {
    const cookies = Object.fromEntries(
      document.cookie.split(';').map(c => {
        const eqIdx = c.indexOf('=')
        if (eqIdx === -1) return [c.trim(), '']
        return [c.substring(0, eqIdx).trim(), decodeURIComponent(c.substring(eqIdx + 1).trim())]
      })
    )
    if (cookies['mock_user_id']) return cookies['mock_user_id']
  }
  return user?.id || 'mock-user-id'
}

function getPersistedScreen(): Screen {
  if (typeof window === 'undefined') return 'MENU'
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    if (s === 'CREATE' || s === 'JOIN' || s === 'LOBBY' || s === 'MENU') return s
  } catch {}
  return 'MENU'
}

function getPersistedRoomCode(): string {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(SESSION_ROOM_CODE_KEY) || ''
  } catch {}
  return ''
}

export default function MultiplayerPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()
  const router = useRouter()
  const { socket } = useSocket()

  const [screen, setScreenState] = useState<Screen>(() => getPersistedScreen())
  const [selectedGame, setSelectedGame] = useState('cricket')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')

  // Room/lobby state
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [hostUserId, setHostUserId] = useState<string | null>(null)
  const [roomStatus, setRoomStatus] = useState<string>('WAITING')
  const [lobbyRoomCode, setLobbyRoomCodeState] = useState<string>(() => getPersistedRoomCode())

  // New social states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [staleRoom, setStaleRoom] = useState<{ roomCode: string; roomId: string } | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const chatPollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const socialPollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const playersRef = useRef<Player[]>([])
  playersRef.current = players
  const roomRef = useRef<Room | null>(null)
  roomRef.current = room

  const currentUserId = getClientUserId(user)

  // Diagnostics / console logs for E2E validation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHostVal = hostUserId === currentUserId
      const allReady = players.length >= 2 && players.every(p => p.status === 'READY')
      const startBtnDisabled = isLoading || !allReady

      const debugObj = {
        pathname: window.location.pathname,
        screen,
        roomCode: lobbyRoomCode,
        roomStatus,
        playerCount: players.length,
        currentUserId,
        hostUserId,
        isHost: isHostVal,
      }
      console.log('[DEBUG MULTIPLAYER]', JSON.stringify(debugObj, null, 2));

      console.log('[LOBBY STATE]', JSON.stringify({
        players: players.map(p => p.userId),
        'ready statuses': players.map(p => `${p.userId}: ${p.status}`),
        isHost: isHostVal,
        startButtonDisabled: startBtnDisabled
      }));

      console.log('[START BUTTON CONDITION]', JSON.stringify({
        isHost: isHostVal,
        playerCount: players.length,
        allReady,
        disabled: startBtnDisabled
      }));

      ;(window as any).__debug_multiplayer = debugObj
    }
  }, [screen, lobbyRoomCode, roomStatus, players, hostUserId, currentUserId, isLoading])

  const setScreen = useCallback((s: Screen) => {
    setScreenState(s)
    try { sessionStorage.setItem(SESSION_KEY, s) } catch {}
  }, [])

  const setLobbyRoomCode = useCallback((code: string) => {
    setLobbyRoomCodeState(code)
    try { sessionStorage.setItem(SESSION_ROOM_CODE_KEY, code) } catch {}
  }, [])

  const leaveRoomCleanup = useCallback(() => {
    setScreen('MENU')
    setRoom(null)
    setPlayers([])
    setHostUserId(null)
    setRoomStatus('WAITING')
    setLobbyRoomCode('')
    setChatMessages([])
    setChatInput('')
    if (pollingIntervalRef.current) clearTimeout(pollingIntervalRef.current)
    if (chatPollingIntervalRef.current) clearTimeout(chatPollingIntervalRef.current)
    try {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_ROOM_CODE_KEY)
    } catch {}
  }, [setScreen, setLobbyRoomCode])

  // 1. Send heartbeat presence update every 15 seconds
  useEffect(() => {
    let active = true
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/profile/heartbeat', { method: 'POST' })
      } catch (err) {
        console.error('Heartbeat failed:', err)
      } finally {
        if (active) {
          heartbeatIntervalRef.current = setTimeout(sendHeartbeat, 15000)
        }
      }
    }
    sendHeartbeat()

    return () => {
      active = false
      if (heartbeatIntervalRef.current) clearTimeout(heartbeatIntervalRef.current)
    }
  }, [])

  // 2. Fetch Dashboard details (friends, invites) & check active room on mount
  useEffect(() => {
    const checkActiveRoomAndInit = async () => {
      try {
        setDashboardLoading(true)
        const res = await fetch('/api/multiplayer/active-room', { cache: 'no-store' })
        if (res.ok) {
          const active = await res.json()
          if (active.roomCode) {
            if (active.status === 'STARTING' || active.status === 'PLAYING') {
              console.log(`[MULTIPLAYER RECONNECT RECOVERY] Active match found: ${active.roomCode}`)
              addToast('success', 'Restored Active Match', 'Restoring match board automatically...')
              router.push(`/dashboard/multiplayer/play/${active.roomCode}`)
              return
            } else if (active.status === 'WAITING') {
              setStaleRoom({ roomCode: active.roomCode, roomId: active.roomId })
            }
          }
        }
      } catch (err) {
        console.error('Active room check failed:', err)
      }

      // Check URL parameters for invites and redirects
      const params = new URLSearchParams(window.location.search)
      const action = params.get('action')
      const game = params.get('game')
      const code = params.get('code') || params.get('room') || params.get('join')

      if (action === 'create' && game) {
        setSelectedGame(game)
        setScreen('CREATE')
      } else if (action === 'join' && code && code.trim() !== '' && code.toLowerCase() !== 'undefined') {
        const normalized = code.toUpperCase().trim()
        setRoomCodeInput(normalized)
        setScreen('JOIN')
        setLobbyRoomCode(normalized)
        setScreen('LOBBY')
      } else if (code && code.toLowerCase() !== 'undefined' && code.trim() !== '') {
        const normalized = code.toUpperCase().trim()
        setRoomCodeInput(normalized)
        setScreen('JOIN')
        setLobbyRoomCode(normalized)
        setScreen('LOBBY')
      }

      // If LOBBY state is currently active, load it
      const savedScreen = getPersistedScreen()
      const savedCode = getPersistedRoomCode()
      if (savedScreen === 'LOBBY' && savedCode) {
        setScreenState('LOBBY')
        setLobbyRoomCodeState(savedCode)
      }

      setDashboardLoading(false)
    }

    checkActiveRoomAndInit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Intercept back button when in lobby
  useEffect(() => {
    if (screen !== 'LOBBY') return

    window.history.pushState(null, '', window.location.href)

    const handlePopState = (e: PopStateEvent) => {
      setShowLeaveConfirm(true)
      window.history.pushState(null, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [screen])

  // 3. Social Polling: Fetch friends & invites list every 4 seconds
  useEffect(() => {
    let active = true
    const fetchSocialData = async () => {
      try {
        const friendsRes = await fetch('/api/friends', { cache: 'no-store' })
        if (!active) return
        if (friendsRes.ok) {
          const data = await friendsRes.json()
          setFriends(data.friends || [])
        }

        const invitesRes = await fetch('/api/multiplayer/invite', { cache: 'no-store' })
        if (!active) return
        if (invitesRes.ok) {
          const data = await invitesRes.json()
          const INVITE_TTL_MS = 10 * 60 * 1000
          const fresh = (data.invites || []).filter((inv: any) => {
            if (!inv.createdAt) return true
            return Date.now() - new Date(inv.createdAt).getTime() < INVITE_TTL_MS
          })
          setInvites(fresh)
        }

        const notifRes = await fetch('/api/multiplayer/notifications', { cache: 'no-store' })
        if (!active) return
        if (notifRes.ok) {
          const data = await notifRes.json()
          setNotifications(data.notifications || [])
        }
      } catch (err) {
        console.error('Failed to poll social data:', err)
      } finally {
        if (active) {
          socialPollingIntervalRef.current = setTimeout(fetchSocialData, 4000)
        }
      }
    }

    fetchSocialData()

    return () => {
      active = false
      if (socialPollingIntervalRef.current) clearTimeout(socialPollingIntervalRef.current)
    }
  }, [])

  // 4. Real-time Socket Lobby updates & Global invite listener
  useEffect(() => {
    if (!socket) return

    // Global invite listener across dashboard
    socket.on('invite-received', (invite: any) => {
      addToast('info', 'Invite Received', `You received a room invite from ${invite.sender?.username || 'a friend'}`)
      const INVITE_TTL_MS = 10 * 60 * 1000
      if (invite.createdAt && Date.now() - new Date(invite.createdAt).getTime() >= INVITE_TTL_MS) return
      setInvites(prev => [invite, ...prev])
    })

    return () => {
      socket.off('invite-received')
    }
  }, [socket, addToast])

  useEffect(() => {
    if (!socket || screen !== 'LOBBY' || !lobbyRoomCode) return

    const joinLobbyRoom = () => {
      if (!socket.connected) {
        addToast('error', 'Diagnostics', 'Server is unreachable. Please check your network connection or try again later.')
        leaveRoomCleanup()
        return
      }

      let attempts = 0
      const maxAttempts = 3

      const attemptJoin = () => {
        attempts++
        setIsLoading(true)
        setLoadingText(`Joining Room (Attempt ${attempts}/${maxAttempts})...`)

        let gotResponse = false
        const timeoutId = setTimeout(() => {
          if (gotResponse) return
          setIsLoading(false)
          setLoadingText('')
          if (attempts < maxAttempts) {
            addToast('warning', 'Timeout', `Join attempt ${attempts} timed out. Retrying...`)
            setTimeout(attemptJoin, 1000)
          } else {
            addToast('error', 'Unreachable', 'Server did not respond to join request after 3 attempts. Please try again.')
            leaveRoomCleanup()
          }
        }, 4000)

        socket.emit('join-room', { roomCode: lobbyRoomCode }, (response: any) => {
          gotResponse = true
          clearTimeout(timeoutId)
          setIsLoading(false)
          setLoadingText('')
          if (response?.error) {
            addToast('error', 'Join Error', response.error)
            leaveRoomCleanup()
          }
        })
      }

      attemptJoin()
    }

    // Join room immediately
    joinLobbyRoom()

    // Re-join on reconnection
    socket.on('connect', joinLobbyRoom)

    const handleRoomUpdate = (data: any) => {
      setRoom(data.room)
      setPlayers(data.players || [])
      setHostUserId(data.room.hostUserId)
      setRoomStatus(data.room.status)

      console.log(`[SOCKET LOBBY UPDATE] Room status: ${data.room.status}`)
      if (data.room.status === 'STARTING' || data.room.status === 'PLAYING') {
        console.log(`[SOCKET LOBBY REDIRECT] Redirecting user to /dashboard/multiplayer/play/${lobbyRoomCode}`)
        router.push(`/dashboard/multiplayer/play/${lobbyRoomCode}`)
      }
    }

    const handleChatMessage = (msg: any) => {
      setChatMessages(prev => [...prev, msg])
    }

    const handlePlayerDisconnected = ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(player => player.userId === userId)
      if (p) {
        addToast('warning', 'Player Disconnected', `${p.username} lost connection. Grace timeout started.`)
      }
    }

    const handlePlayerReconnected = ({ userId }: { userId: string }) => {
      const p = playersRef.current.find(player => player.userId === userId)
      if (p) {
        addToast('success', 'Player Restored', `${p.username} reconnected.`)
      }
    }

    const handleHostTransferred = ({ newHostId, newHostUsername }: { newHostId: string; newHostUsername: string }) => {
      setHostUserId(newHostId)
      if (roomRef.current) {
        setRoom(prev => prev ? { ...prev, hostUserId: newHostId } : null)
      }
      addToast('info', 'Host Transferred', `${newHostUsername} is now the host.`)
    }

    const handleRoomClosed = () => {
      addToast('warning', 'Lobby Closed', 'Your previous room is no longer available.')
      leaveRoomCleanup()
    }

    const handleReconnectFailed = () => {
      addToast('error', 'Reconnection Failed', 'Your previous room is no longer available.')
      leaveRoomCleanup()
      router.push('/dashboard/multiplayer')
    }

    // Room-specific listeners
    socket.on('room-update', handleRoomUpdate)
    socket.on('chat-message', handleChatMessage)
    socket.on('player-disconnected', handlePlayerDisconnected)
    socket.on('player-reconnected', handlePlayerReconnected)
    socket.on('host-transferred', handleHostTransferred)
    socket.on('room-closed', handleRoomClosed)
    socket.on('reconnect-failed', handleReconnectFailed)

    return () => {
      socket.off('connect', joinLobbyRoom)
      const currentStatus = roomRef.current?.status
      if (currentStatus !== 'STARTING' && currentStatus !== 'PLAYING') {
        socket.emit('leave-room', { roomId: roomRef.current?.id })
      }
      socket.off('room-update', handleRoomUpdate)
      socket.off('chat-message', handleChatMessage)
      socket.off('player-disconnected', handlePlayerDisconnected)
      socket.off('player-reconnected', handlePlayerReconnected)
      socket.off('host-transferred', handleHostTransferred)
      socket.off('room-closed', handleRoomClosed)
      socket.off('reconnect-failed', handleReconnectFailed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, screen, lobbyRoomCode, router, addToast])

  const handleEmergencyClearData = useCallback(async () => {
    setIsLoading(true)
    setLoadingText('Clearing match connection data...')
    try {
      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('gamehub_room_recovery_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
        sessionStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(SESSION_ROOM_CODE_KEY)
      }

      await fetch('/api/multiplayer/leave-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceClearAll: true })
      }).catch(() => null)

      addToast('success', 'Recovery State Reset', 'Stuck match data cleared successfully.')
      leaveRoomCleanup()
      window.location.reload()
    } catch (err: any) {
      addToast('error', 'Reset Failed', err.message || 'Failed to clear data')
    } finally {
      setIsLoading(false)
      setLoadingText('')
    }
  }, [addToast, leaveRoomCleanup])

  // Actions
  const handleDiscardStaleRoom = async () => {
    if (!staleRoom) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/multiplayer/leave-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: staleRoom.roomId })
      })
      if (res.ok) {
        addToast('info', 'Room Discarded', 'Your previous room has been cleared.')
        setStaleRoom(null)
      } else {
        const data = await res.json()
        addToast('error', 'Error', data.error || 'Failed to clear stale room.')
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRoom = () => {
    if (!socket) {
      addToast('error', 'Diagnostics', 'Socket not initialized.')
      return
    }
    if (!socket.connected) {
      addToast('error', 'Diagnostics', 'Server is unreachable. Please check your internet connection or server status.')
      return
    }

    let attempts = 0
    const maxAttempts = 3
    
    const attemptCreate = () => {
      attempts++
      setIsLoading(true)
      setLoadingText(`Creating Room (Attempt ${attempts}/${maxAttempts})...`)
      
      let gotResponse = false
      const timeoutId = setTimeout(() => {
        if (gotResponse) return
        setIsLoading(false)
        setLoadingText('')
        if (attempts < maxAttempts) {
          addToast('warning', 'Timeout', `Attempt ${attempts} failed. Retrying...`)
          setTimeout(attemptCreate, 1000)
        } else {
          addToast('error', 'Unreachable', 'Server did not respond after 3 attempts. Please try again.')
        }
      }, 4000)

      socket.emit('create-room', { gameSlug: selectedGame, maxPlayers }, (response: any) => {
        gotResponse = true
        clearTimeout(timeoutId)
        setIsLoading(false)
        setLoadingText('')
        if (response?.error) {
          addToast('error', 'Error', response.error)
        } else if (response?.roomCode) {
          addToast('success', 'Room Created', `Room code ${response.roomCode} created!`)
          setLobbyRoomCode(response.roomCode)
          setScreen('LOBBY')
        }
      })
    }

    attemptCreate()
  }

  const handleJoinRoom = () => {
    const code = roomCodeInput.trim()
    if (!code || code.toLowerCase() === 'undefined') {
      addToast('warning', 'Missing Code', 'Please enter a valid room code.')
      return
    }
    if (!socket) return
    // Just trigger lobby screen, the socket join-room emission will be automatically handled by useEffect
    setLobbyRoomCode(code)
    setScreen('LOBBY')
    setRoomCodeInput('')
  }

  const handleQuickJoin = async (gameSlug: string) => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/multiplayer/quick-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameSlug })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to quick join')

      addToast('success', data.action === 'created' ? 'Created Lobby' : 'Joined Lobby', `Entered lobby ${data.roomCode}!`)
      setLobbyRoomCode(data.roomCode)
      setScreen('LOBBY')
    } catch (err: any) {
      addToast('error', 'Quick Join Error', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleReady = () => {
    if (!socket || !room) return
    socket.emit('toggle-ready', { roomId: room.id })
  }

  const handleLeaveRoom = () => {
    if (!socket || !room) return
    setIsLoading(true)
    socket.emit('leave-room', { roomId: room.id }, (response: any) => {
      setIsLoading(false)
      addToast('info', 'Left Room', 'You have left the lobby.')
      leaveRoomCleanup()
    })
  }

  const handleStartGame = () => {
    if (!socket || !room) return
    setIsLoading(true)
    socket.emit('start-game', { roomId: room.id }, (response: any) => {
      setIsLoading(false)
      if (response?.error) {
        addToast('error', 'Error', response.error)
      } else {
        addToast('success', 'Game Starting', 'Game is launching!')
      }
    })
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !lobbyRoomCode || !socket) return
    const msg = chatInput.trim()
    setChatInput('')

    socket.emit('send-chat', { roomCode: lobbyRoomCode, message: msg }, (response: any) => {
      if (response?.error) {
        addToast('error', 'Chat Error', response.error)
      }
    })
  }

  const handleSendInvite = async (friendUserId: string, friendUsername: string) => {
    try {
      const res = await fetch('/api/multiplayer/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendUserId, roomCode: lobbyRoomCode })
      })
      const data = await res.json()
      if (res.ok) {
        addToast('success', 'Invite Sent', `Sent room invite to ${friendUsername}!`)
      } else {
        addToast('error', 'Invite Failed', data.error || 'Could not invite.')
      }
    } catch (err: any) {
      addToast('error', 'Invite Failed', err.message)
    }
  }

  const handleAcceptInvite = async (invite: Invite) => {
    if (!invite?.room?.roomCode || invite.room.roomCode.toLowerCase() === 'undefined') return
    setIsLoading(true)
    try {
      const res = await fetch('/api/multiplayer/join-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: invite.room.roomCode })
      })
      const data = await res.json()
      if (res.ok) {
        // Clear related notification
        const notifRes = await fetch('/api/multiplayer/notifications', { cache: 'no-store' })
        if (notifRes.ok) {
          const notifData = await notifRes.json()
          const relativeNotif = notifData.notifications.find(
            (n: any) => n.meta && n.meta.roomCode === invite.room.roomCode && !n.isRead
          )
          if (relativeNotif) {
            await fetch('/api/multiplayer/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationId: relativeNotif.id, action: 'read' })
            })
          }
        }

        addToast('success', 'Joined Room', `Lobby ${data.roomCode} joined!`)
        setLobbyRoomCode(data.roomCode)
        setScreen('LOBBY')
      } else {
        addToast('error', 'Join Failed', data.error || 'Could not join room.')
      }
    } catch (err: any) {
      addToast('error', 'Join Failed', err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeclineInvite = async (invite: Invite) => {
    try {
      // First try: decline via notification system
      const notifRes = await fetch('/api/multiplayer/notifications', { cache: 'no-store' })
      let declined = false
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        console.log('[DEBUG DECLINE] notifications list:', JSON.stringify(notifData.notifications, null, 2))
        console.log('[DEBUG DECLINE] searching for roomCode:', invite.room?.roomCode)
        const relativeNotif = notifData.notifications.find(
          (n: any) => {
            let meta = n.meta
            if (typeof n.meta === 'string') {
              try {
                meta = JSON.parse(n.meta)
              } catch (e) {
                meta = null
              }
            }
            return meta && meta.roomCode === invite.room?.roomCode
          }
        )
        console.log('[DEBUG DECLINE] relativeNotif found:', !!relativeNotif)
        if (relativeNotif) {
          const declineRes = await fetch('/api/multiplayer/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationId: relativeNotif.id, action: 'decline' })
          })
          if (declineRes.ok) {
            declined = true
            console.log('[DEBUG DECLINE] Notification decline succeeded')
          } else {
            const errData = await declineRes.json().catch(() => ({}))
            console.error('[DEBUG DECLINE] Notification decline failed:', declineRes.status, JSON.stringify(errData))
          }
        } else {
          console.error('[DEBUG DECLINE] relativeNotif was not found in notifications list!')
        }
      }

      if (!declined) {
        // Fallback: direct invite decline via invite API
        console.log('[DEBUG DECLINE] Trying fallback: direct invite API decline for invite id:', invite.id)
        const directRes = await fetch('/api/multiplayer/invite', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteId: invite.id })
        })
        if (!directRes.ok) {
          const errData = await directRes.json().catch(() => ({}))
          console.error('[DEBUG DECLINE] Direct invite decline also failed:', directRes.status, JSON.stringify(errData))
        } else {
          console.log('[DEBUG DECLINE] Direct invite decline succeeded')
        }
      }

      addToast('info', 'Decline', 'Invite declined.')
      // Refresh list
      const invitesRes = await fetch('/api/multiplayer/invite', { cache: 'no-store' })
      if (invitesRes.ok) {
        const invitesData = await invitesRes.json()
        const INVITE_TTL_MS = 10 * 60 * 1000
        const fresh = (invitesData.invites || []).filter((inv: any) => {
          if (!inv.createdAt) return true
          return Date.now() - new Date(inv.createdAt).getTime() < INVITE_TTL_MS
        })
        setInvites(fresh)
      }
    } catch (err: any) {
      addToast('error', 'Decline Failed', err.message)
    }
  }

  const handleDismissNotification = async (notificationId: string) => {
    try {
      const notif = notifications.find(n => n.id === notificationId)
      const action = notif?.isRead ? 'delete' : 'read'

      const res = await fetch('/api/multiplayer/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, action })
      })
      if (res.ok) {
        if (action === 'delete') {
          setNotifications(prev => prev.filter(n => n.id !== notificationId))
          addToast('info', 'Deleted', 'Notification removed.')
        } else {
          setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n))
          addToast('success', 'Read', 'Notification marked as read.')
        }
      }
    } catch (err) {
      console.error('Failed to handle notification:', err)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobbyRoomCode)
    addToast('success', 'Copied', 'Room code copied to clipboard!')
  }

  const handleInviteLink = () => {
    const inviteUrl = `${window.location.origin}/dashboard/multiplayer?room=${lobbyRoomCode}`
    navigator.clipboard.writeText(inviteUrl)
    addToast('success', 'Invite Link Copied', 'Share link copied to clipboard!')
  }

  const handleCopyDeepLink = () => {
    const deepLink = `gamehub://join?room=${lobbyRoomCode}`
    navigator.clipboard.writeText(deepLink)
    addToast('success', 'Deep Link Copied', `Mobile deep link copied: ${deepLink}`)
  }

  const handleShareAppInvite = () => {
    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://gamehub.app'
    const browserUrl = `${domain}/dashboard/multiplayer/play/${lobbyRoomCode}`
    const deepLink = `gamehub://join?room=${lobbyRoomCode}`
    const shareText = `Join my GameHub room! 🎮\n\nRoom Code: ${lobbyRoomCode}\n\nMobile App: ${deepLink}\nWeb Browser: ${browserUrl}`

    if (navigator.share) {
      navigator.share({
        title: 'Join my GameHub Room!',
        text: shareText,
        url: browserUrl
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareText)
      addToast('success', 'App Invite Copied', 'App invite details copied to clipboard!')
    }
  }

  // Derived presence and ready states
  const isHost = hostUserId === currentUserId
  const myPlayerInfo = players.find(p => p.userId === currentUserId)
  const myReady = myPlayerInfo?.status === 'READY'
  const activePlayers = players.slice(0, 2)
  const allPlayersReady = activePlayers.length >= 2 && activePlayers.every(p => p.status === 'READY')
  const selectedGameInfo = SUPPORTED_MULTIPLAYER_GAMES.find(
    g => g.slug === (room?.gameSlug || selectedGame)
  )

  // Presence helper
  const getFriendIndicatorColor = (friend: Friend) => {
    if (!friend.lastSeenAt) return 'hsl(0, 0%, 40%)' // ⚫
    const seen = new Date(friend.lastSeenAt).getTime()
    const diff = Date.now() - seen
    if (diff < 60000) return 'hsl(142, 70%, 45%)' // 🟢
    if (diff < 180000) return 'hsl(38, 95%, 55%)' // 🟡
    return 'hsl(0, 0%, 40%)' // ⚫
  }

  const getPlayerIndicatorColor = (player: Player) => {
    if (!player.lastSeenAt) return 'hsl(0, 0%, 40%)'
    const seen = new Date(player.lastSeenAt).getTime()
    const diff = Date.now() - seen
    if (diff < 60000) return 'hsl(142, 70%, 45%)'
    if (diff < 180000) return 'hsl(38, 95%, 55%)'
    return 'hsl(0, 0%, 40%)'
  }

  if (dashboardLoading && screen === 'MENU') {
    return (
      <div style={{ maxWidth: 900, margin: '2rem auto', padding: '1.5rem', color: 'hsl(var(--text-primary))', width: '100%' }} className="mobile-centered-wrapper">
        <div className="text-center" style={{ marginBottom: '2.5rem' }}>
          <div style={{ width: 100, height: 16, backgroundColor: 'hsl(var(--bg-elevated))', borderRadius: 8, margin: '0 auto 1rem', animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: 300, height: 40, backgroundColor: 'hsl(var(--bg-elevated))', borderRadius: 8, margin: '0 auto', animation: 'pulse 1.5s infinite' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="card glass" style={{ height: 180, display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', animation: 'pulse 1.5s infinite', backgroundColor: 'hsl(var(--bg-surface) / 0.4)' }}>
              <div style={{ width: 40, height: 40, backgroundColor: 'hsl(var(--bg-elevated))', borderRadius: '50%' }} />
              <div style={{ width: '60%', height: 20, backgroundColor: 'hsl(var(--bg-elevated))', borderRadius: 4 }} />
              <div style={{ width: '90%', height: 15, backgroundColor: 'hsl(var(--bg-elevated))', borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <style jsx global>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.3; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div
      data-screen={screen}
      style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem', width: '100%' }}
      className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper"
    >
      {/* ── Screen: MENU ── */}
      {screen === 'MENU' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '1rem' }}>
            <h1
              style={{ fontSize: 'clamp(2.2rem, 6vw, 3rem)', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}
              className="gradient-text"
            >
              Multiplayer Dashboard 🌐
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1rem' }}>
              Connect with friends, chat in real-time, and challenge opponents!
            </p>
            <button
              className="btn"
              style={{
                marginTop: '1rem',
                fontSize: '0.85rem',
                padding: '0.4rem 1.2rem',
                borderRadius: 20,
                border: '1px solid hsl(var(--danger) / 0.4)',
                color: 'hsl(var(--danger))',
                backgroundColor: 'hsl(var(--danger) / 0.05)',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                margin: '1rem auto 0 auto'
              }}
              onClick={handleEmergencyClearData}
              id="emergency-clear-match-btn"
            >
              ⚠️ Clear Stuck Match Data
            </button>
          </div>

          <div className="multiplayer-grid">
            {/* Left Column: Game list & Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  id="multiplayer-create-room-btn"
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                    color: '#fff',
                    fontWeight: 700
                  }}
                  onClick={() => setScreen('CREATE')}
                >
                  ➕ Create Room
                </button>
                <button
                  id="multiplayer-join-room-btn"
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    backgroundColor: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-primary))',
                    fontWeight: 700
                  }}
                  onClick={() => setScreen('JOIN')}
                >
                  🚪 Enter Code
                </button>
              </div>

              {/* Game Cards list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Game to Play
                </h3>
                {SUPPORTED_MULTIPLAYER_GAMES.map(game => (
                  <div
                    key={game.slug}
                    className="card glass"
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      border: '1px solid hsl(var(--border-subtle))',
                      borderRadius: 16
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.75rem' }}>{game.emoji}</span>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{game.name}</h4>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'hsl(var(--text-muted))', margin: 0, lineHeight: 1.3 }}>{game.desc}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                      <button
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.78rem',
                          backgroundColor: 'hsl(var(--success) / 0.12)',
                          border: '1px solid hsl(var(--success) / 0.25)',
                          color: 'hsl(var(--success))',
                          fontWeight: 700,
                          borderRadius: 10,
                          minHeight: 38
                        }}
                        onClick={() => handleQuickJoin(game.slug)}
                        disabled={isLoading}
                      >
                        ⚡ Quick Join
                      </button>
                      <button
                        className="btn"
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.78rem',
                          backgroundColor: 'hsl(var(--bg-elevated))',
                          border: '1px solid hsl(var(--border-subtle))',
                          fontWeight: 700,
                          borderRadius: 10,
                          minHeight: 38
                        }}
                        onClick={() => {
                          setSelectedGame(game.slug)
                          setScreen('CREATE')
                        }}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Friends & Room Invites */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Active Party System V2 */}
              <PartyPanel />

              {/* Notification Center */}
              <div className="card glass" style={{ padding: '1.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🔔 Notifications Center
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '50%',
                      backgroundColor: 'hsl(var(--brand-primary))',
                      color: '#fff',
                      fontWeight: 700
                    }}>
                      {notifications.filter(n => !n.isRead).length}
                    </span>
                  )}
                </h3>
                {notifications.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                    No recent notifications.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 220, overflowY: 'auto', paddingRight: '0.25rem' }}>
                    {notifications.map(notif => (
                      <div
                        key={notif.id}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: notif.isRead ? 'hsl(var(--bg-surface) / 0.5)' : 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                          opacity: notif.isRead ? 0.7 : 1,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: notif.isRead ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-primary))' }}>
                            {notif.title}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.1rem' }}>
                            {notif.message}
                          </span>
                        </div>
                        <button
                          className="btn"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            backgroundColor: 'hsl(var(--bg-elevated))',
                            border: '1px solid hsl(var(--border-subtle))',
                            color: 'hsl(var(--text-secondary))',
                            minHeight: 32
                          }}
                          onClick={() => handleDismissNotification(notif.id)}
                        >
                          {notif.isRead ? 'Delete' : 'Mark Read'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Room Invites */}
              <div className="card glass" style={{ padding: '1.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📩 Received Invites
                  {invites.length > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '50%',
                      backgroundColor: 'hsl(var(--danger))',
                      color: '#fff',
                      fontWeight: 700
                    }}>
                      {invites.length}
                    </span>
                  )}
                </h3>
                {invites.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                    No pending room invitations.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {invites.map(invite => (
                      <div
                        key={invite.id}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Avatar
                              avatarUrl={invite.sender.avatarUrl}
                              username={invite.sender.username}
                              selectedFrame={invite.sender.selectedFrame}
                              size={24}
                            />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{invite.sender.username}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '0.2rem' }}>
                            Room: {invite.room.roomCode} ({SUPPORTED_MULTIPLAYER_GAMES.find(g => g.slug === invite.room.gameSlug)?.name || invite.room.gameSlug})
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn"
                            id={`accept-invite-btn-${invite.id}`}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.8rem',
                              backgroundColor: 'hsl(var(--success) / 0.15)',
                              color: 'hsl(var(--success))',
                              border: '1px solid hsl(var(--success) / 0.3)',
                              fontWeight: 600,
                              minHeight: 44
                            }}
                            onClick={() => handleAcceptInvite(invite)}
                            disabled={isLoading}
                          >
                            Accept
                          </button>
                          <button
                            className="btn"
                            id={`decline-invite-btn-${invite.id}`}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.8rem',
                              backgroundColor: 'hsl(var(--danger) / 0.15)',
                              color: 'hsl(var(--danger))',
                              border: '1px solid hsl(var(--danger) / 0.3)',
                              fontWeight: 600,
                              minHeight: 44
                            }}
                            onClick={() => handleDeclineInvite(invite)}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Online Friends List */}
              <div className="card glass" style={{ padding: '1.5rem', border: '1px solid hsl(var(--border-subtle))' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                  👥 Friends Presence
                </h3>
                {friends.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
                    No friends found. Add friends using their GH- codes!
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {friends.map(friend => {
                      const color = getFriendIndicatorColor(friend)
                      return (
                        <div
                          key={friend.id}
                          style={{
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'hsl(var(--bg-surface))',
                            border: '1px solid hsl(var(--border-subtle))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ position: 'relative' }}>
                              <Avatar
                                avatarUrl={friend.avatarUrl}
                                username={friend.username}
                                selectedFrame={friend.selectedFrame}
                                size={36}
                              />
                              <span style={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: color,
                                border: '2px solid hsl(var(--bg-surface))',
                                zIndex: 5
                              }} />
                            </div>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                {friend.username}
                                {friend.selectedTitle && (
                                  <span style={{ fontSize: '0.65rem', color: 'hsl(45 100% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>
                                    {friend.selectedTitle}
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Level {friend.level}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: color === 'hsl(142, 70%, 45%)' ? 'hsl(var(--success))' : color === 'hsl(38, 95%, 55%)' ? 'hsl(var(--warning))' : 'hsl(var(--text-muted))'
                          }}>
                            {color === 'hsl(142, 70%, 45%)' ? 'Online' : color === 'hsl(38, 95%, 55%)' ? 'Away' : 'Offline'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Screen: CREATE ── */}
      {screen === 'CREATE' && (
        <div className="card glass" style={{ padding: '2rem', maxWidth: 500, margin: '0 auto', border: '1px solid hsl(var(--border-subtle))' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Host Game Room</h2>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="multiplayer-game-selector"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: '0.5rem' }}
            >
              Select Game
            </label>
            <select
              id="multiplayer-game-selector"
              name="game"
              value={selectedGame}
              onChange={e => setSelectedGame(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-default))',
                color: 'hsl(var(--text-primary))',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: 44
              }}
            >
              {SUPPORTED_MULTIPLAYER_GAMES.map(game => (
                <option key={game.slug} value={game.slug}>
                  {game.emoji} {game.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label
              htmlFor="multiplayer-maxplayers-selector"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', marginBottom: '0.5rem' }}
            >
              Max Players ({maxPlayers})
            </label>
            <input
              type="range"
              id="multiplayer-maxplayers-selector"
              name="maxPlayers"
              min="2"
              max="8"
              value={maxPlayers}
              onChange={e => setMaxPlayers(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'hsl(var(--brand-primary))', cursor: 'pointer', height: 44 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '0.25rem' }}>
              <span>2 Players</span>
              <span>8 Players</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))', minHeight: 48 }}
              onClick={() => setScreen('MENU')}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              id="multiplayer-create-confirm-btn"
              style={{ flex: 2, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))', color: '#fff', fontWeight: 700, minHeight: 48 }}
              onClick={handleCreateRoom}
              disabled={isLoading}
            >
              {isLoading ? (loadingText || 'Creating...') : 'Create Room'}
            </button>
          </div>
        </div>
      )}

      {/* ── Screen: JOIN ── */}
      {screen === 'JOIN' && (
        <div className="card glass" style={{ padding: '2rem', maxWidth: 500, margin: '0 auto', border: '1px solid hsl(var(--border-subtle))' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center' }}>Enter Room Code</h2>

          <div style={{ marginBottom: '2rem' }}>
            <input
              type="text"
              id="multiplayer-room-input"
              name="roomCode"
              placeholder="e.g. AB4XQ2"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.6rem',
                letterSpacing: '0.3em',
                textAlign: 'center',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-default))',
                color: 'hsl(var(--text-primary))',
                outline: 'none',
                fontFamily: 'monospace',
                minHeight: 50
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))', minHeight: 48 }}
              onClick={() => {
                setScreen('MENU')
                setRoomCodeInput('')
              }}
            >
              Back
            </button>
            <button
              className="btn btn-primary"
              id="multiplayer-join-confirm-btn"
              style={{ flex: 2, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))', color: '#fff', fontWeight: 700, minHeight: 48 }}
              onClick={handleJoinRoom}
              disabled={isLoading}
            >
              {isLoading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      )}

      {/* ── Screen: LOBBY ── */}
      {screen === 'LOBBY' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {isLoading && (
            <div style={{
              background: 'linear-gradient(90deg, hsl(210 100% 55% / 0.15), hsl(270 80% 55% / 0.15))',
              border: '1px solid hsl(210 100% 55% / 0.3)',
              borderRadius: 12,
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'hsl(210 100% 70%)'
            }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'hsl(210 100% 55%)', animation: 'spin 0.8s linear infinite' }} />
              {loadingText || 'Syncing...'}
            </div>
          )}
          {/* Lobby Header */}
          <div
            className="card glass"
            style={{
              padding: '1.5rem 2rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1.5rem',
              border: '1px solid hsl(var(--border-subtle))'
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--brand-primary))', display: 'block', marginBottom: '0.25rem' }}>
                Game Lobby
              </span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                {selectedGameInfo?.emoji} {selectedGameInfo?.name}
              </h2>
              <span id="lobby-player-count" style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                Players: {players.length} / {room?.maxPlayers || 4}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                  Room Code
                </span>
                <span
                  id="multiplayer-room-code"
                  style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.05em' }}
                >
                  {lobbyRoomCode}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  id="multiplayer-copy-code-btn"
                  className="btn"
                  onClick={handleCopyCode}
                  style={{ padding: '0.5rem 0.75rem', backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', fontSize: '1.1rem', minHeight: 44 }}
                  title="Copy Room Code"
                >
                  📋
                </button>
                <button
                  id="lobby-invite-btn"
                  className="btn"
                  onClick={handleInviteLink}
                  style={{ padding: '0.5rem 0.75rem', backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', fontSize: '1.1rem', minHeight: 44 }}
                  title="Copy Invite Link"
                >
                  🔗
                </button>
                <button
                  className="btn"
                  onClick={handleCopyDeepLink}
                  style={{ padding: '0.5rem 0.75rem', backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', fontSize: '1.1rem', minHeight: 44 }}
                  title="Copy Mobile Deep Link"
                >
                  📱
                </button>
                <button
                  className="btn"
                  onClick={handleShareAppInvite}
                  style={{ padding: '0.5rem 0.75rem', backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', fontSize: '1.1rem', minHeight: 44 }}
                  title="Share App Invite"
                >
                  📤
                </button>
                <button
                  className="btn"
                  onClick={() => setShowInviteModal(true)}
                  style={{ padding: '0.5rem 1rem', backgroundColor: 'hsl(var(--brand-primary) / 0.1)', border: '1px solid hsl(var(--brand-primary) / 0.3)', color: 'hsl(var(--brand-primary))', fontSize: '0.85rem', fontWeight: 700, minHeight: 44 }}
                >
                  ➕ Invite Friends
                </button>
              </div>
            </div>
          </div>

          {/* Lobby Content: Grid of Players & Chat */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Left Box: Joined Players */}
            <div className="card glass" style={{ padding: '2rem', border: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '0.75rem' }}>
                Joined Players
              </h3>

              <div id="lobby-players-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {players.map(player => {
                  const isPlayerHost = player.userId === hostUserId
                  const isMe = player.userId === currentUserId
                  const seenColor = getPlayerIndicatorColor(player)
                  return (
                    <div
                      key={player.id}
                      data-player-id={player.userId}
                      className="card"
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isMe ? 'hsl(var(--bg-elevated) / 0.6)' : 'hsl(var(--bg-surface))',
                        border: isMe ? '1px solid hsl(var(--brand-primary) / 0.3)' : '1px solid hsl(var(--border-subtle))'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {/* Avatar */}
                        <div style={{ position: 'relative' }}>
                          <Avatar
                            avatarUrl={player.avatarUrl}
                            username={player.username}
                            selectedFrame={player.selectedFrame}
                            size={40}
                          />
                          <span style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: seenColor,
                            border: '2px solid hsl(var(--bg-surface))',
                            zIndex: 5
                          }} />
                          {isPlayerHost && (
                            <span
                              id={`host-badge-${player.userId}`}
                              style={{ position: 'absolute', top: -10, right: -10, fontSize: '1.1rem', zIndex: 5 }}
                              title="Host"
                            >
                              👑
                            </span>
                          )}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{player.username}</span>
                            {player.selectedTitle && (
                              <span style={{ fontSize: '0.68rem', color: 'hsl(45 100% 55%)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {player.selectedTitle}
                              </span>
                            )}
                            {isMe && (
                              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: 4, backgroundColor: 'hsl(var(--brand-primary) / 0.2)', color: 'hsl(var(--brand-primary))', fontWeight: 700 }}>
                                You
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Level {player.level}</span>
                        </div>
                      </div>

                      {/* Ready Badge */}
                      <div>
                        {player.status === 'READY' ? (
                          <span
                            id={`ready-status-${player.userId}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: '99px', backgroundColor: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))' }}
                          >
                            READY
                          </span>
                        ) : (
                          <span
                            id={`ready-status-${player.userId}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: '99px', backgroundColor: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))' }}
                          >
                            NOT READY
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Empty slots */}
                {room &&
                  Array.from({ length: Math.max(0, room.maxPlayers - players.length) }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="card"
                      style={{
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        backgroundColor: 'hsl(var(--bg-surface) / 0.4)',
                        border: '1px dashed hsl(var(--border-subtle))',
                        opacity: 0.5
                      }}
                    >
                      <div style={{ width: 42, height: 42, borderRadius: '50%', border: '2px dashed hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                        👤
                      </div>
                      <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Waiting for player...</span>
                    </div>
                  ))}
              </div>

              {/* Lobby Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '1rem', alignItems: 'center' }}>
                <button
                  id="multiplayer-leave-btn"
                  className="btn"
                  onClick={handleLeaveRoom}
                  disabled={isLoading}
                  style={{ flex: 1, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))', minHeight: 44, fontWeight: 700, borderRadius: 12 }}
                >
                  Leave
                </button>
                <button
                  id="multiplayer-ready-btn"
                  className="btn"
                  onClick={handleToggleReady}
                  disabled={isLoading || !room}
                  style={{
                    flex: 1,
                    backgroundColor: myReady ? 'hsl(var(--warning) / 0.15)' : 'hsl(var(--success) / 0.15)',
                    border: myReady ? '1px solid hsl(var(--warning) / 0.3)' : '1px solid hsl(var(--success) / 0.3)',
                    color: myReady ? 'hsl(var(--warning))' : 'hsl(var(--success))',
                    fontWeight: 700,
                    minHeight: 44,
                    borderRadius: 12
                  }}
                >
                  {myReady ? 'Not Ready' : 'Ready Up'}
                </button>

                {isHost && (
                  <button
                    id="multiplayer-start-btn"
                    className="btn btn-primary"
                    onClick={handleStartGame}
                    disabled={isLoading || !allPlayersReady}
                    style={{
                      flex: 1,
                      background: allPlayersReady ? 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 55%))' : 'hsl(var(--bg-elevated))',
                      color: allPlayersReady ? '#000' : 'hsl(var(--text-muted))',
                      border: allPlayersReady ? 'none' : '1px solid hsl(var(--border-subtle))',
                      fontWeight: 700,
                      minHeight: 44,
                      borderRadius: 12
                    }}
                  >
                    Start Game
                  </button>
                )}
              </div>
            </div>

            {/* Right Box: Chat Panel */}
            <div className="card glass" style={{ padding: '1.5rem', border: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', height: 420 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                💬 Lobby Chat
              </h3>

              {/* Chat Feed */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', paddingRight: '0.25rem' }}>
                {chatMessages.length === 0 ? (
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
                    Send a message to start chatting!
                  </p>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.userId === currentUserId
                    return (
                      <div key={msg.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '90%',
                        alignSelf: isMe ? 'flex-end' : 'flex-start'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                            {msg.username}
                          </span>
                        </div>
                        <div style={{
                          padding: '0.5rem 0.8rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          lineHeight: '1.3',
                          backgroundColor: isMe ? 'hsl(var(--brand-primary) / 0.15)' : 'hsl(var(--bg-elevated))',
                          border: isMe ? '1px solid hsl(var(--brand-primary) / 0.3)' : '1px solid hsl(var(--border-subtle))',
                          color: 'hsl(var(--text-primary))',
                          wordBreak: 'break-word'
                        }}>
                          {msg.message}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Type message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  maxLength={200}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-primary))',
                    outline: 'none',
                    minHeight: 44
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, minHeight: 44 }}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card glass animate-fadeIn" style={{
            maxWidth: 450,
            width: '100%',
            padding: '2rem',
            border: '1px solid hsl(var(--border-subtle))',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.25rem', textAlign: 'center' }}>
              Invite Friends
            </h3>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem', paddingRight: '0.25rem' }}>
              {friends.length === 0 ? (
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem', textAlign: 'center', margin: 'auto' }}>
                  No friends to invite.
                </p>
              ) : (
                friends.map(friend => {
                  const color = getFriendIndicatorColor(friend)
                  return (
                    <div
                      key={friend.id}
                      style={{
                        padding: '0.6rem 0.8rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ position: 'relative' }}>
                          <Avatar
                            avatarUrl={friend.avatarUrl}
                            username={friend.username}
                            selectedFrame={friend.selectedFrame}
                            size={28}
                          />
                          <span style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: '1.5px solid hsl(var(--bg-surface))',
                            zIndex: 5
                          }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{friend.username}</span>
                          {friend.selectedTitle && (
                            <span style={{ fontSize: '0.62rem', color: 'hsl(45 100% 55%)', fontWeight: 800, textTransform: 'uppercase' }}>
                              {friend.selectedTitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        id={`invite-friend-btn-${friend.userId}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, minHeight: 36 }}
                        onClick={() => handleSendInvite(friend.userId || '', friend.username)}
                      >
                        Invite
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', minHeight: 44 }}
              onClick={() => setShowInviteModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay">
          <div className="card glass modal-card">
            <h3>Leave Room?</h3>
            <p>Are you sure you want to leave the multiplayer lobby? Your session will be closed.</p>
            <div className="modal-buttons">
              <button
                className="btn btn-secondary"
                onClick={() => setShowLeaveConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setShowLeaveConfirm(false)
                  handleLeaveRoom()
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stale Room Recovery Modal */}
      {staleRoom && (
        <div className="modal-overlay">
          <div className="card glass modal-card">
            <h3>Active Room Found</h3>
            <p>You have a previous active room lobby (Code: <strong>{staleRoom.roomCode}</strong>). Would you like to resume or discard it?</p>
            <div className="modal-buttons">
              <button
                className="btn btn-secondary"
                onClick={handleDiscardStaleRoom}
                disabled={isLoading}
              >
                Create New
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setLobbyRoomCode(staleRoom.roomCode)
                  setScreen('LOBBY')
                  setStaleRoom(null)
                }}
                disabled={isLoading}
              >
                Resume Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles & Mobile Responsiveness */}
      <style jsx global>{`
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
        }
        .modal-card {
          max-width: 400px;
          width: 100%;
          padding: 2rem;
          border: 1px solid hsl(var(--border-subtle)) !important;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background-color: hsl(var(--bg-surface) / 0.98) !important;
        }
        .modal-card h3 {
          font-size: 1.35rem;
          font-weight: 800;
          color: hsl(var(--text-primary));
          margin: 0;
        }
        .modal-card p {
          font-size: 0.9rem;
          color: hsl(var(--text-secondary));
          line-height: 1.5;
          margin: 0;
        }
        .modal-buttons {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        .modal-buttons button {
          flex: 1;
        }
        .btn-danger {
          background-color: hsl(var(--danger)) !important;
          color: white !important;
        }
        .btn-danger:hover {
          background-color: hsl(var(--danger) / 0.85) !important;
        }

        /* Mobile Responsiveness Rules */
        @media (max-width: 768px) {
          .safe-bottom-padding {
            padding-bottom: 3rem;
          }
          [data-screen="LOBBY"] > div {
            grid-template-columns: 1fr !important;
          }
          [data-screen="LOBBY"] .card.glass {
            padding: 1rem !important;
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          [data-screen="LOBBY"] .card.glass > div {
            width: 100% !important;
          }
          [data-screen="LOBBY"] .card.glass > div:last-child {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 1rem !important;
          }
          [data-screen="LOBBY"] button {
            width: 100% !important;
          }
          .btn {
            width: 100% !important;
          }
        }
      `}</style>
      <SocketDiagnostics
        roomCode={lobbyRoomCode || undefined}
        roomOwner={hostUserId ? (hostUserId === currentUserId ? 'You' : 'Opponent') : undefined}
      />
    </div>
  )
}
