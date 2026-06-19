'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Socket } from 'socket.io-client'

interface Player {
  userId: string
  username: string
}

interface MatchReactionsProps {
  socket: Socket | null
  roomCode: string
  currentUserId: string
  players: Player[]
}

interface ActiveBubble {
  id: string
  content: string // emoji or text
  type: 'emoji' | 'chat'
  senderId: string
  senderName: string
  isPremium?: boolean
  animationType?: 'float' | 'bounce' | 'pulse'
  leftOffset: number
}

export default function MatchReactions({ socket, roomCode, currentUserId, players }: MatchReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [showChatPicker, setShowChatPicker] = useState(false)
  const [bubbles, setBubbles] = useState<ActiveBubble[]>([])
  const [ownedPacks, setOwnedPacks] = useState<any[]>([])
  const [activePackId, setActivePackId] = useState<string>('item-chat-basic')

  const pickerRef = useRef<HTMLDivElement>(null)
  const chatPickerRef = useRef<HTMLDivElement>(null)

  const emojis = ['😀', '😂', '😎', '🔥', '👍', '🎯', '😱', '❤️', '👏', '🤣']

  const defaultPack = {
    id: 'item-chat-basic',
    name: 'Basic Pack',
    type: 'CHAT_PACK',
    priceCoins: 0,
    metadata: {
      messages: ['Hello! 👋', 'Good Luck! 🍀', 'Thanks! 🙏', 'GG! 🎮']
    }
  }

  // Load owned chat packs from inventory
  useEffect(() => {
    fetch('/api/profile/details')
      .then(res => res.json())
      .then(data => {
        if (data.profile?.inventory) {
          const packs = data.profile.inventory
            .filter((inv: any) => inv.cosmeticItem?.type === 'CHAT_PACK')
            .map((inv: any) => inv.cosmeticItem)
          setOwnedPacks(packs)
        }
      })
      .catch(console.error)
  }, [])

  const allPacks = [defaultPack, ...ownedPacks]
  const currentPack = allPacks.find(p => p.id === activePackId) || defaultPack

  // Close pickers when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
      if (chatPickerRef.current && !chatPickerRef.current.contains(event.target as Node)) {
        setShowChatPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Listen for socket events (reactions and chat pack messages)
  useEffect(() => {
    if (!socket) return

    const handleIncomingReaction = ({ userId, emoji }: { userId: string; emoji: string }) => {
      const sender = players.find(p => p.userId === userId)
      const senderName = sender ? sender.username : 'Opponent'
      triggerBubbleLocally(emoji, 'emoji', userId, senderName, false)
    }

    const handleIncomingChatPackMessage = ({ playerId, message, packId }: { playerId: string; message: string; packId: string }) => {
      const sender = players.find(p => p.userId === playerId)
      const senderName = sender ? sender.username : 'Opponent'
      const isPremium = packId !== 'item-chat-basic'
      triggerBubbleLocally(message, 'chat', playerId, senderName, isPremium)
    }

    socket.on('match-reaction', handleIncomingReaction)
    socket.on('chat-pack-message', handleIncomingChatPackMessage)

    return () => {
      socket.off('match-reaction', handleIncomingReaction)
      socket.off('chat-pack-message', handleIncomingChatPackMessage)
    }
  }, [socket, players])

  const triggerBubbleLocally = (
    content: string,
    type: 'emoji' | 'chat',
    senderId: string,
    senderName: string,
    isPremium: boolean
  ) => {
    const id = Math.random().toString(36).substring(2, 9)

    let animationType: 'float' | 'bounce' | 'pulse' = 'float'
    if (type === 'emoji') {
      if (content === '🔥') animationType = 'float'
      else if (content === '😂' || content === '🤣') animationType = 'bounce'
      else if (content === '❤️') animationType = 'pulse'
      else animationType = Math.random() > 0.5 ? 'float' : 'pulse'
    }

    const newBubble: ActiveBubble = {
      id,
      content,
      type,
      senderId,
      senderName,
      isPremium,
      animationType,
      leftOffset: Math.floor(Math.random() * 20) - 10 // random drift -10% to 10%
    }

    setBubbles(prev => [...prev, newBubble])

    // Emojis clean up after 2 seconds, text chats clean up after 5 seconds
    const duration = type === 'emoji' ? 2000 : 5000
    setTimeout(() => {
      setBubbles(prev => prev.filter(b => b.id !== id))
    }, duration)
  }

  const lastReactionTimeRef = useRef<number>(0)
  const lastChatTimeRef = useRef<number>(0)

  const sendReaction = (emoji: string) => {
    if (!socket) return
    const now = Date.now()
    if (now - lastReactionTimeRef.current < 2000) return // 2s cooldown
    lastReactionTimeRef.current = now

    socket.emit('match-reaction', { roomCode, emoji })

    const myName = players.find(p => p.userId === currentUserId)?.username || 'You'
    triggerBubbleLocally(emoji, 'emoji', currentUserId, myName, false)
    setShowPicker(false)
  }

  const sendChatPackMessage = (message: string) => {
    if (!socket) return
    const now = Date.now()
    if (now - lastChatTimeRef.current < 1500) return // 1.5s chat cooldown
    lastChatTimeRef.current = now

    socket.emit('chat-pack-message', { roomCode, message, packId: activePackId })

    const myName = players.find(p => p.userId === currentUserId)?.username || 'You'
    const isPremium = activePackId !== 'item-chat-basic'
    triggerBubbleLocally(message, 'chat', currentUserId, myName, isPremium)
    setShowChatPicker(false)
  }

  return (
    <>
      {/* Floating Reaction & Chat Speech Bubble Overlay */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 100000,
        overflow: 'hidden'
      }}>
        {bubbles.map((b) => {
          const isMe = b.senderId === currentUserId
          const baseLeft = isMe ? 75 : 25
          const leftPos = baseLeft + b.leftOffset

          if (b.type === 'emoji') {
            return (
              <div
                key={b.id}
                className={`reaction-bubble anim-${b.animationType}`}
                style={{
                  position: 'absolute',
                  bottom: '100px',
                  left: `${leftPos}%`,
                  transform: 'translateX(-50%)',
                  fontSize: '2.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                  userSelect: 'none'
                }}
              >
                <span>{b.content}</span>
                <span style={{
                  fontSize: '0.65rem',
                  color: 'white',
                  background: 'rgba(0,0,0,0.6)',
                  padding: '2px 6px',
                  borderRadius: 8,
                  marginTop: '4px',
                  fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.1)',
                  whiteSpace: 'nowrap'
                }}>
                  {b.senderName}
                </span>
              </div>
            )
          } else {
            // Chat speech bubble
            return (
              <div
                key={b.id}
                className="chat-speech-bubble"
                style={{
                  position: 'absolute',
                  bottom: '120px',
                  left: `${leftPos}%`,
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, hsl(222 25% 15%), hsl(222 20% 10%))',
                  border: b.isPremium ? '2px solid hsl(210 100% 55%)' : '1px solid rgba(255,255,255,0.15)',
                  borderRadius: isMe ? '16px 16px 0 16px' : '16px 16px 16px 0',
                  padding: '10px 16px',
                  color: 'white',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxWidth: '240px',
                  wordBreak: 'break-word',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  userSelect: 'none'
                }}
              >
                <div style={{
                  fontSize: '0.7rem',
                  color: b.isPremium ? 'hsl(210 100% 65%)' : 'hsl(var(--text-muted))',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {b.isPremium && <span>🔵</span>}
                  {b.senderName}
                </div>
                <div style={{ color: 'white', lineHeight: 1.3 }}>{b.content}</div>
              </div>
            )
          }
        })}
      </div>

      {/* Floating Reaction & Chat Trigger Buttons */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 101000,
        display: 'flex',
        gap: '10px'
      }}>
        {/* Chat Pack Picker */}
        <div ref={chatPickerRef} style={{ position: 'relative' }}>
          {showChatPicker && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              right: 0,
              background: 'hsl(222 20% 12%)',
              border: '1px solid hsl(220 15% 22%)',
              borderRadius: 16,
              padding: '0.75rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '240px',
              animation: 'slideUp-quick 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}>
              {/* Pack Selector */}
              <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {allPacks.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActivePackId(p.id)}
                    style={{
                      fontSize: '0.7rem',
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: activePackId === p.id ? 'hsl(210 100% 55%)' : 'hsl(222 20% 18%)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontWeight: 700
                    }}
                  >
                    {p.priceCoins > 0 && '🔵 '}{p.name.replace(' Chat Pack', '').replace(' Pack', '')}
                  </button>
                ))}
              </div>

              {/* Messages Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                {currentPack.metadata?.messages?.map((msg: string) => (
                  <button
                    key={msg}
                    onClick={() => sendChatPackMessage(msg)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: 'hsl(222 20% 16%)',
                      border: 'none',
                      borderRadius: 8,
                      color: 'white',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      transition: 'background 0.1s'
                    }}
                    className="hover-bg-glow"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setShowChatPicker(!showChatPicker); setShowPicker(false) }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(270 80% 50%), hsl(300 80% 50%))',
              border: 'none',
              color: 'white',
              fontSize: '1.25rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px hsl(270 80% 50% / 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease'
            }}
            className="reaction-trigger-btn"
          >
            💬
          </button>
        </div>

        {/* Emoji Reactions Picker */}
        <div ref={pickerRef} style={{ position: 'relative' }}>
          {showPicker && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              right: 0,
              background: 'hsl(222 20% 12%)',
              border: '1px solid hsl(220 15% 22%)',
              borderRadius: 16,
              padding: '0.6rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '6px',
              width: '210px',
              animation: 'slideUp-quick 0.15s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}>
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  style={{
                    fontSize: '1.5rem',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: '6px 0',
                    borderRadius: 8,
                    transition: 'background 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="hover-bg-glow"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => { setShowPicker(!showPicker); setShowChatPicker(false) }}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, hsl(210 100% 55%), hsl(270 80% 60%))',
              border: 'none',
              color: 'white',
              fontSize: '1.4rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px hsl(210 100% 50% / 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.15s ease'
            }}
            className="reaction-trigger-btn"
          >
            ☺
          </button>
        </div>
      </div>

      <style jsx global>{`
        /* Bubble slide and fade animations */
        .chat-speech-bubble {
          animation: chat-bubble-in 5s ease-in-out forwards;
        }

        @keyframes chat-bubble-in {
          0% {
            transform: translate(-50%, 20px) scale(0.85);
            opacity: 0;
          }
          6% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
          90% {
            transform: translate(-50%, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -30px) scale(0.9);
            opacity: 0;
          }
        }

        /* Reaction animation styles */
        .reaction-bubble {
          opacity: 1;
        }

        /* Float upward animation */
        @keyframes float-up {
          0% {
            transform: translate(-50%, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, -60px) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + 20px), -280px) scale(0.85);
            opacity: 0;
          }
        }
        .anim-float {
          animation: float-up 2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
        }

        /* Bouncing animation */
        @keyframes bounce-react {
          0% {
            transform: translate(-50%, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            transform: translate(-50%, -80px) scale(1.1);
            opacity: 1;
          }
          30% {
            transform: translate(-50%, -50px) scale(1);
          }
          45% {
            transform: translate(-50%, -75px) scale(1.05);
          }
          60% {
            transform: translate(-50%, -60px) scale(1);
          }
          100% {
            transform: translate(-50%, -240px) scale(0.8);
            opacity: 0;
          }
        }
        .anim-bounce {
          animation: bounce-react 2s ease-out forwards;
        }

        /* Pulsing expansion animation */
        @keyframes pulse-react {
          0% {
            transform: translate(-50%, -40px) scale(0.5);
            opacity: 0;
          }
          20% {
            transform: translate(-50%, -80px) scale(1.4);
            opacity: 1;
          }
          40% {
            transform: translate(-50%, -100px) scale(1.1);
          }
          60% {
            transform: translate(-50%, -120px) scale(1.3);
          }
          100% {
            transform: translate(-50%, -180px) scale(0.7);
            opacity: 0;
          }
        }
        .anim-pulse {
          animation: pulse-react 2s ease-in-out forwards;
        }

        @keyframes slideUp-quick {
          from {
            transform: translateY(15px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .hover-bg-glow:hover {
          background: rgba(255, 255, 255, 0.15) !important;
          transform: scale(1.05);
        }

        .reaction-trigger-btn:hover {
          transform: scale(1.08);
        }
      `}</style>
    </>
  )
}
