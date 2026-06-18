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

interface ActiveReaction {
  id: string
  emoji: string
  senderId: string
  senderName: string
  animationType: 'float' | 'bounce' | 'pulse'
  leftOffset: number // random drift percentage
}

export default function MatchReactions({ socket, roomCode, currentUserId, players }: MatchReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [reactions, setReactions] = useState<ActiveReaction[]>([])
  const pickerRef = useRef<HTMLDivElement>(null)

  const emojis = ['😀', '😂', '😎', '🔥', '👍', '🎯', '😱', '❤️', '👏', '🤣']

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Listen for socket reaction events
  useEffect(() => {
    if (!socket) return

    const handleIncomingReaction = ({ userId, emoji }: { userId: string; emoji: string }) => {
      const sender = players.find(p => p.userId === userId)
      const senderName = sender ? sender.username : 'Opponent'
      
      triggerReactionLocally(emoji, userId, senderName)
    };

    socket.on('match-reaction', handleIncomingReaction)
    return () => {
      socket.off('match-reaction', handleIncomingReaction)
    }
  }, [socket, players])

  const triggerReactionLocally = (emoji: string, senderId: string, senderName: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    
    // Choose animation based on emoji as requested
    let animationType: 'float' | 'bounce' | 'pulse' = 'float'
    if (emoji === '🔥') {
      animationType = 'float'
    } else if (emoji === '😂' || emoji === '🤣') {
      animationType = 'bounce'
    } else if (emoji === '❤️') {
      animationType = 'pulse'
    } else {
      // Default to float with some variety
      animationType = Math.random() > 0.5 ? 'float' : 'pulse'
    }

    const newReact: ActiveReaction = {
      id,
      emoji,
      senderId,
      senderName,
      animationType,
      leftOffset: Math.floor(Math.random() * 20) - 10 // random drift -10% to 10%
    }

    setReactions(prev => [...prev, newReact])

    // Auto cleanup after 2.5 seconds
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== id))
    }, 2500)
  }

  const lastReactionTimeRef = useRef<number>(0)

  const sendReaction = (emoji: string) => {
    if (!socket) return
    const now = Date.now()
    if (now - lastReactionTimeRef.current < 2000) {
      return // Cooldown active (2 seconds)
    }
    lastReactionTimeRef.current = now
    
    // Emit to server
    socket.emit('match-reaction', { roomCode, emoji })

    // Trigger locally for self
    const myName = players.find(p => p.userId === currentUserId)?.username || 'You'
    triggerReactionLocally(emoji, currentUserId, myName)
    
    setShowPicker(false)
  }

  return (
    <>
      {/* Floating Reaction Overlay Container */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden'
      }}>
        {reactions.map((r) => {
          const isMe = r.senderId === currentUserId
          // Render float on right for me, left for opponent
          const baseLeft = isMe ? 75 : 25
          const leftPos = baseLeft + r.leftOffset

          return (
            <div
              key={r.id}
              className={`reaction-bubble anim-${r.animationType}`}
              style={{
                position: 'absolute',
                bottom: '80px',
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
              {/* Emoji element */}
              <span>{r.emoji}</span>
              
              {/* Sender label */}
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
                {r.senderName}
              </span>
            </div>
          )
        })}
      </div>

      {/* Floating Reaction Panel Button */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 101
      }} ref={pickerRef}>
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
          onClick={() => setShowPicker(!showPicker)}
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

      <style jsx global>{`
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
          animation: float-up 2.2s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
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
          animation: bounce-react 2.4s ease-out forwards;
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
          animation: pulse-react 2.2s ease-in-out forwards;
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
          transform: scale(1.15);
        }

        .reaction-trigger-btn:hover {
          transform: scale(1.08);
        }
      `}</style>
    </>
  )
}
