'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'

interface PartyMember {
  userId: string
  username: string
  socketId: string
  role: 'LEADER' | 'MEMBER'
}

interface PartyState {
  partyCode: string
  members: PartyMember[]
}

interface ChatMessage {
  userId: string
  username: string
  message: string
  timestamp: number
}

export default function PartyPanel() {
  const { socket, isConnected } = useSocket()
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [party, setParty] = useState<PartyState | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [chatMessage, setChatMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Friend invitation states
  const [friends, setFriends] = useState<any[]>([])
  const [showInviteDropdown, setShowInviteDropdown] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!socket || !isConnected) return

    // Listen to party updates
    socket.on('party-updated', (updatedParty: PartyState) => {
      setParty(updatedParty)
    })

    // Listen to party chat messages
    socket.on('party-chat-msg', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg])
    })

    // Listen to party invites received
    socket.on('party-invite-received', ({ partyCode, inviterUsername }: { partyCode: string; inviterUsername: string }) => {
      addToast(
        'info',
        'Party Invitation! 📩',
        `${inviterUsername} invited you to join their party: ${partyCode}`,
        { partyCode }
      )
    })

    // Listen to leader forced matchmaking room synchronization
    socket.on('party-matchmaking-sync', ({ gameSlug, roomCode }: { gameSlug: string; roomCode: string }) => {
      addToast('success', 'Game Starting! 🚀', `Leader starting match: redirecting to lobby...`)
      // Wait 1.5 seconds and redirect
      setTimeout(() => {
        window.location.href = `/dashboard/games/${gameSlug}?roomCode=${roomCode}`
      }, 1500)
    })

    return () => {
      socket.off('party-updated')
      socket.off('party-chat-msg')
      socket.off('party-invite-received')
      socket.off('party-matchmaking-sync')
    }
  }, [socket, isConnected])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchOnlineFriends = async () => {
    try {
      setLoadingFriends(true)
      const res = await fetch('/api/friends')
      if (res.ok) {
        const data = await res.json()
        // Filter only online friends (lastSeenAt was < 60s ago)
        const online = (data.friends || []).filter((f: any) => {
          if (!f.lastSeenAt) return false
          return (Date.now() - new Date(f.lastSeenAt).getTime()) < 60000
        })
        setFriends(online)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingFriends(false)
    }
  }

  const handleCreateParty = () => {
    if (!socket) return
    socket.emit('party-create', (res: any) => {
      if (res.error) {
        addToast('error', 'Error', res.error)
      } else {
        setParty({
          partyCode: res.partyCode,
          members: [{
            userId: user?.id || 'me',
            username: user?.email?.split('@')[0] || 'Player',
            socketId: socket.id || '',
            role: 'LEADER'
          }]
        })
        setMessages([])
        addToast('success', 'Party Created!', `Party room code: ${res.partyCode}`)
      }
    })
  }

  const handleJoinParty = () => {
    if (!socket || !joinCode.trim()) return
    socket.emit('party-join', { partyCode: joinCode.trim() }, (res: any) => {
      if (res.error) {
        addToast('error', 'Error', res.error)
      } else {
        setParty(res.party)
        setMessages([])
        setJoinCode('')
        addToast('success', 'Party Joined!', `Connected to party: ${res.party.partyCode}`)
      }
    })
  }

  const handleLeaveParty = () => {
    if (!socket) return
    socket.emit('party-leave', (res: any) => {
      if (res.error) {
        addToast('error', 'Error', res.error)
      } else {
        setParty(null)
        setMessages([])
        addToast('info', 'Left Party', 'You disconnected from the party.')
      }
    })
  }

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !chatMessage.trim()) return
    socket.emit('party-chat', { message: chatMessage.trim() })
    setChatMessage('')
  }

  const handleInviteFriend = (friendId: string, friendName: string) => {
    if (!socket) return
    socket.emit('party-invite', { targetUserId: friendId }, (res: any) => {
      if (res.error) {
        addToast('error', 'Invite Failed', res.error)
      } else {
        addToast('success', 'Invite Dispatched!', `Party code invitation sent to ${friendName}.`)
        setShowInviteDropdown(false)
      }
    })
  }

  const isLeader = party?.members.find(m => m.userId === user?.id)?.role === 'LEADER'

  if (!user) return null

  return (
    <div
      className="card glass"
      style={{
        borderRadius: 20,
        background: 'linear-gradient(135deg, hsl(222 20% 12%), hsl(222 18% 8%))',
        border: '1px solid hsl(220 15% 18%)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxHeight: 520
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          👥 Active Party Layer {party && <span style={{ fontSize: '0.7rem', background: 'hsl(220 100% 60%)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 4 }}>{party.partyCode}</span>}
        </h3>
        {party && (
          <button
            onClick={handleLeaveParty}
            style={{ background: 'transparent', border: 'none', color: 'hsl(0 80% 60%)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Leave Party
          </button>
        )}
      </div>

      {!party ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '0.5rem 0' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>
            Form a party lobby to chat in real-time, invite online friends, and join multiplayer matches together.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <input
                type="text"
                placeholder="Enter Code..."
                className="input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                style={{
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.82rem',
                  borderRadius: 10,
                  backgroundColor: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-default))',
                  color: 'hsl(var(--text-primary))',
                  flex: 3,
                  minWidth: 0,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleJoinParty}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.82rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 10,
                  flex: 1.2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700
                }}
              >
                Join
              </button>
            </div>
            
            <button
              onClick={handleCreateParty}
              className="btn btn-primary"
              style={{
                width: '100%',
                fontSize: '0.82rem',
                padding: '0.55rem',
                borderRadius: 10,
                fontWeight: 700,
                background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              ➕ Create Party
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
          
          {/* Members List */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Members ({party.members.length}/4)</span>
              
              {/* Invite dropdown anchor */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setShowInviteDropdown(!showInviteDropdown)
                    if (!showInviteDropdown) fetchOnlineFriends()
                  }}
                  style={{ background: 'transparent', border: 'none', color: 'hsl(220 100% 70%)', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                >
                  ✉️ Invite Friend
                </button>

                {showInviteDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '1.25rem',
                      width: 180,
                      background: 'hsl(222 20% 12%)',
                      border: '1px solid hsl(220 15% 22%)',
                      borderRadius: 10,
                      padding: '0.4rem',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)'
                    }}
                  >
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.4rem', borderBottom: '1px solid hsl(220 15% 18%)', color: 'hsl(220 10% 50%)' }}>
                      Online Friends
                    </div>
                    {loadingFriends ? (
                      <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Loading...</div>
                    ) : friends.length === 0 ? (
                      <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>No friends online</div>
                    ) : (
                      friends.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleInviteFriend(f.id, f.username)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '0.75rem',
                            padding: '0.35rem 0.4rem',
                            borderRadius: 6,
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          className="hover-highlight"
                        >
                          🟢 {f.displayName || (f.username.includes('@') ? f.username.split('@')[0] : f.username)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {party.members.map(m => (
                <div
                  key={m.userId}
                  style={{
                    fontSize: '0.72rem',
                    background: m.role === 'LEADER' ? 'hsl(45 100% 60% / 0.12)' : 'hsl(220 15% 15%)',
                    border: m.role === 'LEADER' ? '1px solid hsl(45 100% 60% / 0.3)' : '1px solid hsl(220 15% 20%)',
                    color: m.role === 'LEADER' ? 'hsl(45 100% 65%)' : 'white',
                    padding: '0.25rem 0.6rem',
                    borderRadius: 8,
                    fontWeight: 700
                  }}
                >
                  {m.role === 'LEADER' ? '👑 ' : ''}{m.username.includes('@') ? m.username.split('@')[0] : m.username}
                </div>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 180, background: 'hsl(220 15% 12% / 0.3)', borderRadius: 12, border: '1px solid hsl(220 15% 16%)', padding: '0.6rem' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.2rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'hsl(220 10% 45%)', fontSize: '0.72rem', marginTop: '3rem' }}>
                  Party chat initialized. Send messages to members.
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 800, color: msg.userId === user?.id ? 'hsl(220 100% 70%)' : 'hsl(38 95% 65%)' }}>
                      {msg.username.includes('@') ? msg.username.split('@')[0] : msg.username}:
                    </span>{' '}
                    <span style={{ color: 'hsl(220 10% 85%)' }}>{msg.message}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              <input
                type="text"
                placeholder="Type party message..."
                className="input"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', borderRadius: 8, flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: 8 }}
              >
                Send
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  )
}
