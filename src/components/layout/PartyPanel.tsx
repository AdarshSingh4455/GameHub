'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { 
  Users, 
  Gamepad, 
  Mic, 
  MicOff, 
  Check, 
  Copy, 
  Share2, 
  LogOut, 
  Plus, 
  Crown, 
  Shield, 
  Activity, 
  Volume2, 
  VolumeX 
} from 'lucide-react'

interface PartyMember {
  userId: string
  username: string
  socketId: string
  role: 'LEADER' | 'MEMBER'
  isReady?: boolean
  currentGame?: string
  currentActivity?: string
}

interface PartyState {
  partyCode: string
  members: PartyMember[]
  capacity?: number
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
  const [receivedInvites, setReceivedInvites] = useState<PartyInvite[]>([])

  const [friends, setFriends] = useState<any[]>([])
  const [showInviteDropdown, setShowInviteDropdown] = useState(false)
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [inviteStatuses, setInviteStatuses] = useState<Record<string, InviteStatus>>({})

  // Local Voice State (Muted/Unmuted)
  const [isMuted, setIsMuted] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const inviteExpireRef = useRef<NodeJS.Timeout | null>(null)
  const currentUserId = user?.id || ''

  // Custom Local Extends for the current user
  const [myReadyState, setMyReadyState] = useState(false)
  const [myCurrentGame, setMyCurrentGame] = useState('Idle')
  const [myCurrentActivity, setMyCurrentActivity] = useState('In Lobby')
  const [partyCapacity, setPartyCapacity] = useState(4)

  useEffect(() => {
    inviteExpireRef.current = setInterval(() => {
      setReceivedInvites(prev => prev.filter(inv => Date.now() - inv.receivedAt < 60000))
    }, 5000)
    return () => {
      if (inviteExpireRef.current) clearInterval(inviteExpireRef.current)
    }
  }, [])

  // Sync our local state changes with other party members
  const broadcastMyStatus = useCallback((ready: boolean, game: string, activity: string, capacity: number) => {
    if (!socket || !party) return
    const statusPayload = {
      userId: currentUserId,
      isReady: ready,
      currentGame: game,
      currentActivity: activity,
      capacity: capacity
    }
    socket.emit('party-chat', {
      message: `__SYSTEM_PARTY_UPDATE__:${JSON.stringify(statusPayload)}`
    })
  }, [socket, party, currentUserId])

  // Sync state whenever our local settings change
  useEffect(() => {
    if (party) {
      broadcastMyStatus(myReadyState, myCurrentGame, myCurrentActivity, partyCapacity)
    }
  }, [myReadyState, myCurrentGame, myCurrentActivity, partyCapacity, party ? party.partyCode : null])

  useEffect(() => {
    if (!socket || !isConnected) return

    // Socket listeners
    socket.on('party-updated', (updatedParty: PartyState) => {
      setParty(prev => {
        // Preserve any custom synced states from members if the basic members match
        const newMembers = updatedParty.members.map(nm => {
          const prevMem = prev?.members.find(pm => pm.userId === nm.userId)
          return {
            ...nm,
            isReady: prevMem?.isReady ?? (nm.userId === currentUserId ? myReadyState : false),
            currentGame: prevMem?.currentGame ?? (nm.userId === currentUserId ? myCurrentGame : 'Idle'),
            currentActivity: prevMem?.currentActivity ?? (nm.userId === currentUserId ? myCurrentActivity : 'In Lobby')
          }
        })
        return {
          ...updatedParty,
          members: newMembers,
          capacity: prev?.capacity ?? updatedParty.capacity ?? partyCapacity
        }
      })
    })

    socket.on('party-chat-msg', (msg: ChatMessage) => {
      // Check if message is a system update
      if (msg.message.startsWith('__SYSTEM_PARTY_UPDATE__:')) {
        try {
          const payloadStr = msg.message.substring('__SYSTEM_PARTY_UPDATE__:'.length)
          const payload = JSON.parse(payloadStr)
          
          setParty(prev => {
            if (!prev) return null
            const updatedMembers = prev.members.map(m => {
              if (m.userId === payload.userId) {
                return {
                  ...m,
                  isReady: payload.isReady,
                  currentGame: payload.currentGame,
                  currentActivity: payload.currentActivity
                }
              }
              return m
            })
            
            // If the sender is the leader, also sync party capacity
            const senderIsLeader = prev.members.find(m => m.userId === payload.userId)?.role === 'LEADER'
            const newCapacity = senderIsLeader ? payload.capacity : (prev.capacity ?? partyCapacity)

            return {
              ...prev,
              members: updatedMembers,
              capacity: newCapacity
            }
          })
        } catch (e) {
          console.error('Failed to parse party system update:', e)
        }
      }
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
  }, [socket, isConnected, addToast, currentUserId, myReadyState, myCurrentGame, myCurrentActivity, partyCapacity])

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
          capacity: partyCapacity,
          members: [{
            userId: user?.id || 'me',
            username: user?.email?.split('@')[0] || 'Player',
            socketId: socket.id || '',
            role: 'LEADER',
            isReady: myReadyState,
            currentGame: myCurrentGame,
            currentActivity: myCurrentActivity
          }]
        })
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
        setMyReadyState(false)
        addToast('info', 'Left Party', 'You disconnected from the party.')
      }
    })
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

  const copyInviteCode = () => {
    if (!party) return
    navigator.clipboard.writeText(party.partyCode)
    setCopiedCode(true)
    addToast('success', 'Copied!', 'Party code copied to clipboard.')
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyShareLink = () => {
    if (!party) return
    const link = `${window.location.origin}/dashboard/multiplayer?join=${party.partyCode}`
    navigator.clipboard.writeText(link)
    setCopiedLink(true)
    addToast('success', 'Copied Link!', 'Party invite link copied to clipboard.')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const toggleReady = () => {
    const nextReady = !myReadyState
    setMyReadyState(nextReady)
    addToast('info', nextReady ? 'Ready!' : 'Not Ready', nextReady ? 'You are ready to match.' : 'You marked yourself as not ready.')
  }

  const toggleMute = () => {
    const nextMute = !isMuted
    setIsMuted(nextMute)
    addToast('info', nextMute ? 'Muted' : 'Unmuted', nextMute ? 'Microphone muted.' : 'Microphone active.')
  }

  const changeCapacity = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCap = parseInt(e.target.value, 10)
    setPartyCapacity(nextCap)
  }

  const displayName = (username: string) =>
    username.includes('@') ? username.split('@')[0] : username

  if (!user) return null

  const isLeader = party?.members.find(m => m.userId === currentUserId)?.role === 'LEADER'
  const maxCapacity = party?.capacity ?? partyCapacity
  const isFull = party ? party.members.length >= maxCapacity : false
  const partyStatus = !party ? 'Not in Party' : isFull ? 'Party Full' : 'In Party'

  return (
    <div
      className="card glass party-glow-animation"
      style={{
        borderRadius: 24,
        background: 'linear-gradient(135deg, hsl(222 24% 10%), hsl(222 22% 6%))',
        border: '1px solid hsl(220 15% 18%)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {/* CSS Styles for Party Redesign Animations */}
      <style>{`
        .party-glow-animation:hover {
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15);
          border-color: hsl(220 100% 60% / 0.2) !important;
        }
        .copied-scale {
          transform: scale(1.15);
          color: hsl(142 70% 50%) !important;
        }
        .member-enter-anim {
          animation: memberSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes memberSlideIn {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 768px) {
          .party-layout-container {
            flex-direction: column !important;
          }
          .party-members-scroll {
            flex-direction: row !important;
            overflow-x: auto;
            white-space: nowrap;
            padding-bottom: 0.5rem;
            margin-bottom: 0.25rem;
            scrollbar-width: none;
          }
          .party-members-scroll::-webkit-scrollbar {
            display: none;
          }
          .party-btn-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.5rem !important;
          }
          .party-btn-grid button, .party-btn-grid div {
            width: 100% !important;
          }
        }
      `}</style>

      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 850, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={16} className="text-indigo-400" />
          Active Party
        </h3>

        {/* Party Status Badge */}
        <span 
          style={{ 
            fontSize: '0.68rem', 
            background: partyStatus === 'Not in Party' ? 'hsl(220 10% 20%)' : partyStatus === 'Party Full' ? 'hsl(38 92% 50% / 0.18)' : 'hsl(220 100% 60% / 0.18)', 
            color: partyStatus === 'Not in Party' ? 'hsl(220 10% 65%)' : partyStatus === 'Party Full' ? 'hsl(38 95% 60%)' : 'hsl(220 100% 65%)', 
            border: partyStatus === 'Not in Party' ? '1px solid hsl(220 10% 25%)' : partyStatus === 'Party Full' ? '1px solid hsl(38 95% 50% / 0.3)' : '1px solid hsl(220 100% 60% / 0.3)', 
            padding: '0.15rem 0.5rem', 
            borderRadius: 6,
            fontWeight: 800,
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}
        >
          {partyStatus}
        </span>
      </div>

      {/* Received Invites Notification strip */}
      {receivedInvites.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'hsl(222 25% 12%)', borderRadius: 14, padding: '0.6rem', border: '1px dashed hsl(220 15% 20%)' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(45 100% 60%)', marginBottom: '0.1rem' }}>Party Invites ({receivedInvites.length})</div>
          {receivedInvites.map(invite => (
            <div key={invite.partyCode} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', background: 'hsl(45 100% 55% / 0.06)', border: '1px solid hsl(45 100% 55% / 0.15)', borderRadius: 10, padding: '0.4rem 0.6rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invite.inviterUsername}</div>
                <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Code: <span style={{ fontFamily: 'monospace', color: 'hsl(220 100% 70%)' }}>{invite.partyCode}</span></div>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                <button onClick={() => handleAcceptInvite(invite)} style={{ background: 'hsl(142 70% 45%)', border: 'none', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: 6, cursor: 'pointer' }}>Accept</button>
                <button onClick={() => handleDeclineInvite(invite)} style={{ background: 'transparent', border: '1px solid hsl(0 60% 45%)', color: 'hsl(0 75% 65%)', fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 6, cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EMPTY STATE (Not in Party) ── */}
      {!party ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1rem 0.5rem', gap: '0.85rem' }}>
          <div 
            style={{ 
              width: 54, 
              height: 54, 
              borderRadius: 16, 
              background: 'linear-gradient(135deg, hsl(220 100% 60% / 0.12), hsl(270 80% 60% / 0.12))', 
              border: '1.5px solid hsl(220 15% 20%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 15px rgba(255,255,255,0.05)',
              color: 'hsl(220 100% 70%)'
            }}
          >
            <Gamepad size={28} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'white', fontWeight: 750 }}>No Active Party</h4>
            <p style={{ margin: 0, fontSize: '0.72rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4, maxWidth: 290 }}>
              Form a party to coordinate with friends, toggle ready states, and jump into matches together.
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', marginTop: '0.25rem' }} className="party-btn-grid">
            <div style={{ display: 'flex', gap: '0.4rem', width: '100%', alignItems: 'center' }}>
              <input 
                type="text" 
                placeholder="Enter Invite Code..." 
                className="input" 
                value={joinCode} 
                onChange={e => {
                  const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6)
                  setJoinCode(cleaned)
                }} 
                onKeyDown={e => { 
                  if (e.key === 'Enter' && joinCode.length === 6) {
                    handleJoinParty() 
                  }
                }} 
                style={{ 
                  padding: '0.5rem 0.7rem', 
                  fontSize: '0.78rem', 
                  borderRadius: 10, 
                  backgroundColor: 'hsl(222 25% 10%)', 
                  border: '1px solid hsl(220 15% 16%)', 
                  color: 'white', 
                  flex: 1, 
                  minWidth: 0, 
                  outline: 'none',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
                  letterSpacing: joinCode.length > 0 ? '0.1em' : 'normal',
                  fontFamily: joinCode.length > 0 ? 'monospace' : 'inherit'
                }} 
              />
              <button 
                onClick={() => joinCode.length === 6 && handleJoinParty()} 
                disabled={joinCode.length !== 6}
                className="btn btn-secondary" 
                style={{ 
                  fontSize: '0.78rem', 
                  padding: '0.5rem 0.8rem', 
                  borderRadius: 10, 
                  fontWeight: 800, 
                  flexShrink: 0, 
                  width: 'auto',
                  opacity: joinCode.length === 6 ? 1 : 0.4,
                  cursor: joinCode.length === 6 ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s ease'
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
                fontSize: '0.78rem', 
                padding: '0.55rem', 
                borderRadius: 10, 
                fontWeight: 800, 
                background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))', 
                color: 'white', 
                border: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '0.4rem',
                cursor: 'pointer',
                boxShadow: '0 4px 15px hsl(220 100% 60% / 0.25)'
              }}
            >
              <Plus size={14} strokeWidth={2.5} /> Create Party
            </button>
          </div>
        </div>
      ) : (
        /* ── ACTIVE PARTY STATE (In Party) ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          {/* Party Card Details */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              background: 'hsl(222 25% 8% / 0.7)', 
              borderRadius: 16, 
              padding: '0.65rem 0.8rem', 
              border: '1px solid hsl(220 15% 15%)' 
            }}
          >
            {/* Pulsing Avatar */}
            <div 
              style={{ 
                width: 42, 
                height: 42, 
                borderRadius: 12, 
                background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: 'white',
                boxShadow: '0 0 10px hsl(220 100% 60% / 0.35)',
                flexShrink: 0
              }}
            >
              <Gamepad size={20} />
            </div>

            {/* Title & Status */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Squad #{party.partyCode}
                </span>
                
                {/* Invite Code click-to-copy */}
                <button 
                  onClick={copyInviteCode} 
                  style={{ background: 'transparent', border: 'none', padding: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'hsl(220 10% 55%)' }}
                  title="Copy Invite Code"
                >
                  <Copy size={11} className={`transition-transform ${copiedCode ? 'copied-scale' : 'hover:text-white'}`} />
                </button>
              </div>

              {/* Dynamic Capacity & Member list count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.68rem', color: 'hsl(220 10% 55%)' }}>
                <span>Capacity:</span>
                {isLeader ? (
                  <select 
                    value={maxCapacity} 
                    onChange={changeCapacity}
                    style={{ 
                      background: 'hsl(222 25% 12%)', 
                      border: '1px solid hsl(220 15% 20%)', 
                      color: 'white', 
                      borderRadius: 4, 
                      fontSize: '0.65rem',
                      fontWeight: 700, 
                      padding: '1px 4px', 
                      outline: 'none',
                      cursor: 'pointer' 
                    }}
                  >
                    {[2, 3, 4, 5, 6, 7, 8].map(num => (
                      <option key={num} value={num}>{party.members.length}/{num}</option>
                    ))}
                  </select>
                ) : (
                  <strong style={{ color: 'white' }}>{party.members.length}/{maxCapacity}</strong>
                )}
              </div>
            </div>

            {/* Voice Mute / Speaker Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <button 
                onClick={toggleMute}
                style={{ 
                  width: 32, 
                  height: 32, 
                  borderRadius: 8, 
                  background: isMuted ? 'hsl(0 80% 55% / 0.12)' : 'hsl(220 100% 60% / 0.12)', 
                  border: isMuted ? '1px solid hsl(0 80% 55% / 0.3)' : '1px solid hsl(220 100% 60% / 0.3)', 
                  color: isMuted ? 'hsl(0 85% 65%)' : 'hsl(220 100% 70%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
          </div>

          {/* Quick game/activity update selectors for host/you */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'hsl(222 25% 8% / 0.3)', border: '1px dashed hsl(220 15% 16%)', borderRadius: 12, padding: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
              <label style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Game Activity</label>
              <select 
                value={myCurrentGame} 
                onChange={e => setMyCurrentGame(e.target.value)}
                style={{ background: 'hsl(222 25% 10%)', border: '1px solid hsl(220 15% 18%)', color: 'white', borderRadius: 6, fontSize: '0.72rem', padding: '0.2rem 0.4rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Idle">💤 Idle</option>
                <option value="Tic-Tac-Toe">⭕ Tic-Tac-Toe</option>
                <option value="Bubble Shooter">🔮 Bubble Shooter</option>
                <option value="Hand Cricket">🏏 Hand Cricket</option>
                <option value="Who's Spy">🕵️ Who's Spy</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 }}>
              <label style={{ fontSize: '0.6rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Match Status</label>
              <select 
                value={myCurrentActivity} 
                onChange={e => setMyCurrentActivity(e.target.value)}
                style={{ background: 'hsl(222 25% 10%)', border: '1px solid hsl(220 15% 18%)', color: 'white', borderRadius: 6, fontSize: '0.72rem', padding: '0.2rem 0.4rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="In Lobby">🏠 In Lobby</option>
                <option value="In Queue">⏱️ In Queue</option>
                <option value="In Game">⚔️ In Game</option>
              </select>
            </div>
          </div>

          {/* Members list (horizontal/vertical list) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Members ({party.members.length}/{maxCapacity})</span>
              
              {/* Online Friends dropdown trigger */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => { setShowInviteDropdown(!showInviteDropdown); if (!showInviteDropdown) fetchOnlineFriends() }} 
                  style={{ background: 'transparent', border: 'none', color: 'hsl(220 100% 70%)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                >
                  <Plus size={11} /> Invite Friend
                </button>
                
                {showInviteDropdown && (
                  <div style={{ position: 'absolute', right: 0, top: '1.25rem', width: 190, background: 'hsl(222 24% 12%)', border: '1px solid hsl(220 15% 22%)', borderRadius: 10, padding: '0.4rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, padding: '0.2rem 0.4rem', borderBottom: '1px solid hsl(220 15% 18%)', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>Online Friends</div>
                    {loadingFriends ? (
                      <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Loading...</div>
                    ) : friends.length === 0 ? (
                      <div style={{ padding: '0.4rem', fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>No friends online</div>
                    ) : (
                      friends.map(f => {
                        const st = inviteStatuses[f.id] || 'idle'
                        return (
                          <button 
                            key={f.id} 
                            onClick={() => handleInviteFriend(f.id, displayName(f.username))} 
                            disabled={st === 'pending' || st === 'sent'} 
                            style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', background: 'transparent', border: 'none', color: st === 'sent' ? 'hsl(142 70% 50%)' : st === 'failed' ? 'hsl(0 80% 60%)' : 'white', fontSize: '0.75rem', padding: '0.35rem 0.4rem', borderRadius: 6, cursor: st === 'pending' || st === 'sent' ? 'default' : 'pointer', opacity: st === 'pending' || st === 'sent' ? 0.7 : 1 }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(f.username)}</span>
                            <span style={{ fontSize: '0.65rem', flexShrink: 0, marginLeft: '0.3rem', color: 'hsl(220 10% 55%)' }}>{st === 'pending' ? '...' : st === 'sent' ? 'Sent' : st === 'failed' ? 'Failed' : 'Invite'}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Horizontal scroll on mobile / vertical stack on desktop */}
            <div 
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}
              className="party-members-scroll"
            >
              {party.members.map(m => {
                const isMe = m.userId === currentUserId
                return (
                  <div 
                    key={m.userId} 
                    className="member-enter-anim"
                    style={{ 
                      fontSize: '0.72rem', 
                      background: m.isReady ? 'hsl(142 70% 45% / 0.08)' : 'hsl(222 25% 10% / 0.6)', 
                      border: m.isReady ? '1px solid hsl(142 70% 45% / 0.25)' : '1px solid hsl(220 15% 18%)', 
                      borderRadius: 12, 
                      padding: '0.5rem 0.7rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      minWidth: 160,
                      flexShrink: 0
                    }}
                  >
                    {/* User Avatar Circle */}
                    <div style={{ position: 'relative', width: 28, height: 28, borderRadius: '50%', background: m.role === 'LEADER' ? 'hsl(45 100% 60% / 0.15)' : 'hsl(220 15% 20%)', border: m.role === 'LEADER' ? '1.5px solid #fbbf24' : '1.5px solid hsl(220 10% 30%)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontWeight: 900, color: m.role === 'LEADER' ? '#fbbf24' : 'white', fontSize: '0.75rem' }}>
                      {m.username.substring(0, 1).toUpperCase()}
                      {/* Online dot */}
                      <span style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: '#10b981', border: '1.5px solid #000' }} />
                    </div>

                    {/* Member Information */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {displayName(m.username)}
                        </span>
                        {isMe && <span style={{ fontSize: '0.62rem', color: 'hsl(220 100% 70%)', fontWeight: 700 }}>(you)</span>}
                        {m.role === 'LEADER' && <Crown size={11} className="text-yellow-400 fill-yellow-400" />}
                      </div>
                      
                      {/* Separate Game & Activity */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '1px' }}>
                        <span>🎮 {m.currentGame || 'Idle'}</span>
                        <span>•</span>
                        <span>{m.currentActivity || 'In Lobby'}</span>
                      </div>
                    </div>

                    {/* Ready state checkbox / indicator */}
                    <div>
                      {isMe ? (
                        <button 
                          onClick={toggleReady}
                          style={{ 
                            background: myReadyState ? 'hsl(142 70% 45%)' : 'transparent', 
                            border: myReadyState ? 'none' : '1.5px solid hsl(220 10% 30%)', 
                            color: 'white', 
                            width: 18, 
                            height: 18, 
                            borderRadius: 5, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            cursor: 'pointer' 
                          }}
                        >
                          {myReadyState && <Check size={11} strokeWidth={3} />}
                        </button>
                      ) : (
                        <div 
                          style={{ 
                            background: m.isReady ? 'hsl(142 70% 45% / 0.2)' : 'transparent', 
                            border: m.isReady ? '1.5px solid hsl(142 70% 45%)' : '1.5px solid hsl(220 10% 25%)', 
                            color: 'hsl(142 75% 65%)', 
                            width: 18, 
                            height: 18, 
                            borderRadius: 5, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}
                        >
                          {m.isReady ? <Check size={10} strokeWidth={3.5} /> : <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 40%)' }}>...</span>}
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}

              {/* Waiting for players placeholder slot */}
              {party.members.length < maxCapacity && (
                <div 
                  style={{ 
                    fontSize: '0.7rem', 
                    background: 'transparent', 
                    border: '1.5px dashed hsl(220 15% 15%)', 
                    borderRadius: 12, 
                    padding: '0.5rem 0.7rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'hsl(220 10% 45%)',
                    fontWeight: 600,
                    height: 40,
                    flexShrink: 0
                  }}
                >
                  ⏳ Waiting for {maxCapacity - party.members.length} players...
                </div>
              )}
            </div>
          </div>

          {/* Action buttons (2-column layout on mobile) */}
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.25rem' }} className="party-btn-grid">
            <button 
              onClick={copyShareLink} 
              className="btn btn-secondary" 
              style={{ flex: 1.2, fontSize: '0.78rem', padding: '0.5rem', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <Share2 size={13} /> {copiedLink ? 'Copied!' : 'Share Invite'}
            </button>

            <button 
              onClick={handleLeaveParty} 
              className="btn btn-ghost" 
              style={{ flex: 0.8, fontSize: '0.78rem', padding: '0.5rem', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'hsl(0 75% 65%)', border: '1px solid hsl(0 60% 45% / 0.2)' }}
            >
              <LogOut size={13} /> Leave
            </button>
          </div>

        </div>
      )}

    </div>
  )
}
