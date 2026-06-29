'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
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

interface PartyInvite {
  partyCode: string
  inviterUsername: string
  receivedAt: number
}

type InviteStatus = 'idle' | 'pending' | 'sent' | 'failed'

export default function PartyPanel() {
  const { socket, isConnected } = useSocket()
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [party, setParty] = useState<PartyState | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [receivedInvites, setReceivedInvites] = useState<PartyInvite[]>([])

  const [friends, setFriends] = useState<any[]>([])
  const [showInviteDropdown, setShowInviteDropdown] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InviteStatus>>({})

  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)
  const inviteExpireRef = useRef<NodeJS.Timeout | null>(null)
  const currentUserId = user?.id || ''

  useEffect(() => {
    inviteExpireRef.current = setInterval(() => {
      setReceivedInvites(prev => prev.filter(inv => Date.now() - inv.receivedAt < 60000))
    }, 5000)
    return () => {
      if (inviteExpireRef.current) clearInterval(inviteExpireRef.current)
    }
  }, [])

  useEffect(() => {
    if (!socket || !isConnected) return

    socket.on('party-updated', (updatedParty: PartyState) => {
      setParty(updatedParty)
    })

    socket.on('party-chat-msg', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg])
    })

    socket.on('party-invite-received', ({ partyCode, inviterUsername }: { partyCode: string; inviterUsername: string }) => {
      setReceivedInvites(prev => {
        const filtered = prev.filter(inv => inv.partyCode !== partyCode)
        return [...filtered, { partyCode, inviterUsername, receivedAt: Date.now() }].slice(-5)
      })
    })

    socket.on('party-matchmaking-sync', ({ gameSlug, roomCode }: { gameSlug: string; roomCode: string }) => {
      addToast('success', 'Game Starting!', 'Leader starting match — redirecting...')
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
  }, [socket, isConnected, addToast])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchOnlineFriends = async () => {
    try {
      setLoadingFriends(true)
      const res = await fetch('/api/friends')
      if (res.ok) {
        const data = await res.json()
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
        setReceivedInvites([])
        addToast('success', 'Party Created!', `Code: ${res.partyCode}`)
      }
    })
  }

  const handleJoinParty = (codeOverride?: string) => {
    const code = (codeOverride || joinCode).trim()
    if (!socket || !code) return
    socket.emit('party-join', { partyCode: code }, (res: any) => {
      if (res.error) {
        addToast('error', 'Join Failed', res.error)
      } else {
        setParty(res.party)
        setMessages([])
        setJoinCode('')
        addToast('success', 'Party Joined!', `Connected to party: ${res.party.partyCode}`)
      }
    })
  }

  const handleAcceptInvite = (invite: PartyInvite) => {
    handleJoinParty(invite.partyCode)
    setReceivedInvites(prev => prev.filter(inv => inv.partyCode !== invite.partyCode))
  }

  const handleDeclineInvite = (invite: PartyInvite) => {
    setReceivedInvites(prev => prev.filter(inv => inv.partyCode !== invite.partyCode))
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

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    const input = chatInputRef.current
    if (!socket || !input || !input.value.trim()) return
    socket.emit('party-chat', { message: input.value.trim() })
    input.value = ''
  }, [socket])

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const input = chatInputRef.current
      if (socket && input && input.value.trim()) {
        socket.emit('party-chat', { message: input.value.trim() })
        input.value = ''
      }
    }
  }

  const handleInviteFriend = (friendId: string, friendName: string) => {
    if (!socket) return
    const status = inviteStatuses[friendId]
    if (status === 'pending' || status === 'sent') return
    setInviteStatuses(prev => ({ ...prev, [friendId]: 'pending' }))
    socket.emit('party-invite', { targetUserId: friendId }, (res: any) => {
      if (res.error) {
        setInviteStatuses(prev => ({ ...prev, [friendId]: 'failed' }))
        addToast('error', 'Invite Failed', res.error)
        setTimeout(() => setInviteStatuses(prev => ({ ...prev, [friendId]: 'idle' })), 3000)
      } else {
        setInviteStatuses(prev => ({ ...prev, [friendId]: 'sent' }))
        addToast('success', 'Invite Sent!', `Party invite sent to ${friendName}.`)
        setTimeout(() => setInviteStatuses(prev => ({ ...prev, [friendId]: 'idle' })), 5000)
      }
    })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const displayName = (username: string) =>
    username.includes('@') ? username.split('@')[0] : username

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
        maxHeight: 580,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          Active Party
          {party && <span style={{ fontSize: '0.7rem', background: 'hsl(220 100% 60%)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: 4 }}>{party.partyCode}</span>}
        </h3>
        {party && (
          <button onClick={handleLeaveParty} style={{ background: 'transparent', border: 'none', color: 'hsl(0 80% 60%)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            Leave
          </button>
        )}
      </div>

      {receivedInvites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(45 100% 60%)', marginBottom: '0.1rem' }}>Party Invitations</div>
          {receivedInvites.map(invite => (
            <div key={invite.partyCode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'hsl(45 100% 55% / 0.08)', border: '1px solid hsl(45 100% 55% / 0.25)', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.inviterUsername}</div>
                <div style={{ fontSize: '0.66rem', color: 'hsl(220 10% 55%)' }}>Party: <span style={{ fontFamily: 'monospace', color: 'hsl(220 100% 70%)' }}>{invite.partyCode}</span></div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                <button onClick={() => handleAcceptInvite(invite)} style={{ background: 'hsl(120 60% 40%)', border: 'none', color: 'white', fontSize: '0.7rem', fontWeight: 800, padding: '0.3rem 0.6rem', borderRadius: 7, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => handleDeclineInvite(invite)} style={{ background: 'transparent', border: '1px solid hsl(0 60% 45%)', color: 'hsl(0 70% 65%)', fontSize: '0.7rem', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: 7, cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!party ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: '0.5rem 0' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>Form a party to chat in real-time, invite friends, and join matches together.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', width: '100%', alignItems: 'center' }}>
              <input type="text" placeholder="Enter code..." className="input" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleJoinParty() }} style={{ padding: '0.55rem 0.75rem', fontSize: '0.82rem', borderRadius: 10, backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))', flex: 1, minWidth: 0, outline: 'none' }} />
              <button onClick={() => handleJoinParty()} className="btn btn-secondary" style={{ fontSize: '0.82rem', padding: '0.55rem 0.8rem', borderRadius: 10, fontWeight: 700, flexShrink: 0, width: 'auto', display: 'inline-flex' }}>Join</button>
            </div>
            <button onClick={handleCreateParty} className="btn btn-primary" style={{ width: '100%', fontSize: '0.82rem', padding: '0.55rem', borderRadius: 10, fontWeight: 700, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
              + Create Party
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflow: 'hidden' }}>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', marginBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Members ({party.members.length}/4)</span>
              <div style={{ position: 'relative' }}>
                <button onClick={() => { setShowInviteDropdown(!showInviteDropdown); if (!showInviteDropdown) fetchOnlineFriends() }} style={{ background: 'transparent', border: 'none', color: 'hsl(220 100% 70%)', fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}>Invite Friend</button>
                {showInviteDropdown && (
                  <div style={{ position: 'absolute', right: 0, top: '1.25rem', width: 200, background: 'hsl(222 20% 12%)', border: '1px solid hsl(220 15% 22%)', borderRadius: 10, padding: '0.4rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.4rem', borderBottom: '1px solid hsl(220 15% 18%)', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>Online Friends</div>
                    {loadingFriends ? <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Loading...</div> : friends.length === 0 ? <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>No friends online</div> : friends.map(f => {
                      const st = inviteStatuses[f.id] || 'idle'
                      return (
                        <button key={f.id} onClick={() => handleInviteFriend(f.id, displayName(f.username))} disabled={st === 'pending' || st === 'sent'} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'transparent', border: 'none', color: st === 'sent' ? 'hsl(120 60% 55%)' : st === 'failed' ? 'hsl(0 70% 60%)' : 'white', fontSize: '0.75rem', padding: '0.35rem 0.4rem', borderRadius: 6, cursor: st === 'pending' || st === 'sent' ? 'default' : 'pointer', opacity: st === 'pending' || st === 'sent' ? 0.7 : 1 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(f.username)}</span>
                          <span style={{ fontSize: '0.6rem', flexShrink: 0, marginLeft: '0.3rem', color: 'hsl(220 10% 55%)' }}>{st === 'pending' ? 'Sending...' : st === 'sent' ? 'Sent' : st === 'failed' ? 'Failed' : ''}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {party.members.map(m => (
                <div key={m.userId} style={{ fontSize: '0.72rem', background: m.role === 'LEADER' ? 'hsl(45 100% 60% / 0.12)' : 'hsl(220 15% 15%)', border: m.role === 'LEADER' ? '1px solid hsl(45 100% 60% / 0.3)' : '1px solid hsl(220 15% 20%)', color: m.role === 'LEADER' ? 'hsl(45 100% 65%)' : 'white', padding: '0.25rem 0.6rem', borderRadius: 8, fontWeight: 700 }}>
                  {m.role === 'LEADER' ? '★ ' : ''}{displayName(m.username)}{m.userId === currentUserId ? ' (you)' : ''}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 180, background: 'hsl(220 15% 12% / 0.3)', borderRadius: 12, border: '1px solid hsl(220 15% 16%)', padding: '0.6rem' }}>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', paddingRight: '0.2rem' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'hsl(220 10% 45%)', fontSize: '0.72rem', marginTop: '3rem' }}>Party chat ready. Start the conversation!</div>
              ) : (
                messages.map((msg, i) => {
                  const isOwn = msg.userId === currentUserId
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', gap: '0.15rem' }}>
                      {!isOwn && <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'hsl(38 95% 65%)', paddingLeft: '0.6rem' }}>{displayName(msg.username)}</div>}
                      <div style={{ maxWidth: '82%', background: isOwn ? 'hsl(220 100% 55% / 0.22)' : 'hsl(220 15% 20%)', border: isOwn ? '1px solid hsl(220 100% 60% / 0.35)' : '1px solid hsl(220 15% 24%)', borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '0.35rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 90%)', lineHeight: 1.4, wordBreak: 'break-word' }}>{msg.message}</span>
                        <span style={{ fontSize: '0.58rem', color: 'hsl(220 10% 45%)', alignSelf: isOwn ? 'flex-end' : 'flex-start' }}>{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', alignItems: 'flex-end', width: '100%' }}>
              <textarea ref={chatInputRef} placeholder="Type message... (Enter to send)" className="input" onKeyDown={handleChatKeyDown} rows={1} style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.65rem', fontSize: '0.78rem', borderRadius: 10, resize: 'none', lineHeight: 1.4, maxHeight: 72, overflowY: 'auto', backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', color: 'hsl(var(--text-primary))', outline: 'none' }} />
              <button type="submit" className="btn btn-primary" style={{ flexShrink: 0, fontSize: '0.78rem', padding: '0.45rem 0.75rem', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap', width: 'auto', display: 'inline-flex' }}>Send</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
