'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import Avatar from '@/components/shared/Avatar'
import MatchReactions from './MatchReactions'

interface Player {
  userId: string
  username: string
  avatarUrl?: string | null
  status?: string
  level?: number
  profile?: {
    avatarUrl?: string | null
    level?: number
    selectedTitle?: string | null
    selectedFrame?: string | null
  }
}

interface ChatMessage {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  message: string
  createdAt: string
}

interface Props {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

const WORD_ALIASES: Record<string, string[]> = {
  "Dog": ["puppy", "pup", "canine", "bark"],
  "Cat": ["kitten", "kitty", "feline", "meow"],
  "Tiger": ["tigers", "big cat", "stripes", "feline"],
  "Lion": ["cubs", "cub", "king of jungle"],
  "Elephant": ["trunk", "tusk"],
  "Bear": ["cub", "grizzly"],
  "Apple": ["fruit", "red fruit", "cider"],
  "Banana": ["yellow fruit", "peel"]
}

export default function MultiplayerWhosSpyGame({ roomCode, session, players, currentUserId, onLeave }: Props) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  
  const [clueInput, setClueInput] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [spyGuessInput, setSpyGuessInput] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  
  // Real-time chat messages list
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  
  // Chat mute / cooldown states
  const [chatCooldownLeft, setChatCooldownLeft] = useState(0)
  
  const chatBottomRef = useRef<HTMLDivElement>(null)
  
  const gameState = session?.gameState || {}
  const {
    stage = 'REVEAL', // REVEAL, CLUE, DISCUSSION, VOTING, SPY_GUESS, FINISHED
    category = 'Animals',
    word = '', // Only civilians see the word
    spyId = '',
    dismissedRole = {},
    clues = {},
    clueOrder = [],
    currentTurn = null,
    discussionMessages = [],
    votes = {},
    voteCounts = {},
    eliminatedUserId = '',
    winnerId = null,
    replayVotes = {},
    timerStart = Date.now(),
    timerDuration = 90,
    cooldownUntil = {}
  } = gameState

  const isSpy = spyId === currentUserId
  const isSpectator = !players.some(p => p.userId === currentUserId)
  
  // Initialize discussion messages on mount or sync
  useEffect(() => {
    if (discussionMessages && discussionMessages.length > 0) {
      setChatMessages(discussionMessages)
    }
  }, [discussionMessages])

  // Scroll to bottom of chat whenever new messages arrive
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, stage])

  // Listen for realtime chat events
  useEffect(() => {
    if (!socket) return

    const handleSpyChatMessage = (msg: ChatMessage) => {
      setChatMessages(prev => {
        // Prevent duplicates
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    socket.on('spy-chat-message', handleSpyChatMessage)
    return () => {
      socket.off('spy-chat-message', handleSpyChatMessage)
    }
  }, [socket])

  // Chat cooldown tick timer
  useEffect(() => {
    const cooldownEnd = cooldownUntil[currentUserId]
    if (cooldownEnd && cooldownEnd > Date.now()) {
      const interval = setInterval(() => {
        const left = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000))
        setChatCooldownLeft(left)
        if (left === 0) clearInterval(interval)
      }, 1000)
      return () => clearInterval(interval)
    } else {
      setChatCooldownLeft(0)
    }
  }, [cooldownUntil, currentUserId])

  // Get active countdown timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  useEffect(() => {
    if (stage !== 'DISCUSSION' && stage !== 'VOTING' && stage !== 'REVOTE' && stage !== 'SPY_GUESS') {
      setTimeLeft(null)
      return
    }

    const updateTimer = () => {
      const diffMs = Date.now() - timerStart
      const remaining = Math.max(0, Math.ceil(timerDuration - diffMs / 1000))
      setTimeLeft(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [timerStart, timerDuration, stage])

  // Local word blocking helper
  const checkLocalBlock = (text: string): boolean => {
    if (!word) return false
    const cleanMsg = text.toLowerCase().trim()
    const cleanWord = word.toLowerCase().trim()
    
    const variations = new Set<string>()
    variations.add(cleanWord)
    
    // Plural / singular simple variations
    if (cleanWord.endsWith('s')) {
      variations.add(cleanWord.slice(0, -1))
    } else {
      variations.add(cleanWord + 's')
    }
    if (cleanWord.endsWith('y')) {
      variations.add(cleanWord.slice(0, -1) + 'ies')
    } else if (cleanWord.endsWith('ies')) {
      variations.add(cleanWord.slice(0, -3) + 'y')
    }
    if (cleanWord.endsWith('x') || cleanWord.endsWith('ch') || cleanWord.endsWith('sh')) {
      variations.add(cleanWord + 'es')
    }
    
    // Possessives
    variations.add(cleanWord + "'s")
    variations.add(cleanWord + "s'")
    
    // Add registered aliases
    const aliases = WORD_ALIASES[word] || []
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().trim()
      variations.add(cleanAlias)
      if (cleanAlias.endsWith('s')) {
        variations.add(cleanAlias.slice(0, -1))
      } else {
        variations.add(cleanAlias + 's')
      }
      variations.add(cleanAlias + "'s")
    }
    
    for (const variant of variations) {
      const escapedVariant = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
      const regex = new RegExp(`\\b${escapedVariant}\\b`, 'i')
      if (regex.test(cleanMsg)) {
        return true
      }
    }
    
    return false
  }

  // Handle Card Reveal / Dismissal
  const handleRevealDismiss = () => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'reveal-dismiss' }
    }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Submit Error', res.error)
      } else {
        addToast('success', 'Role Acknowledged', 'Waiting for other players...')
      }
    })
  }

  // Handle Clue Submission
  const handleClueSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || isSubmitting || !clueInput.trim()) return

    if (checkLocalBlock(clueInput)) {
      addToast('error', 'Word Blocked', '⚠️ Your message reveals too much about the secret word. Try giving a subtler clue.')
      return
    }

    setIsSubmitting(true)
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'clue', clue: clueInput.trim() }
    }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Blocked Clue', res.error)
      } else {
        setClueInput('')
        addToast('success', 'Clue Submitted', 'Your clue has been locked in!')
      }
    })
  }

  // Handle Chat Message Sending
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || isSubmitting || !chatInput.trim()) return

    if (chatCooldownLeft > 0) {
      addToast('warning', 'Muted', `Please wait ${chatCooldownLeft}s before sending.`)
      return
    }

    if (checkLocalBlock(chatInput)) {
      addToast('error', 'Word Blocked', '⚠️ Your message reveals too much about the secret word. Try giving a subtler clue.')
      return
    }

    setIsSubmitting(true)
    socket.emit('send-spy-chat', {
      roomCode,
      message: chatInput.trim()
    }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Message Rejected', res.error)
      } else {
        setChatInput('')
      }
    })
  }

  // Handle Vote Submission
  const handleVoteSubmit = (targetPlayerId: string) => {
    if (!socket || isSubmitting) return
    if (targetPlayerId === currentUserId) {
      addToast('warning', 'Self Vote', 'You cannot vote for yourself.')
      return
    }

    setIsSubmitting(true)
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'vote', targetUserId: targetPlayerId }
    }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Vote Error', res.error)
      } else {
        addToast('success', 'Vote casted', 'Your secret vote is recorded.')
      }
    })
  }

  // Handle Spy Guess Submission
  const handleSpyGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || isSubmitting || !spyGuessInput.trim()) return

    setIsSubmitting(true)
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'spy-guess', guess: spyGuessInput.trim() }
    }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Guess Error', res.error)
      } else {
        addToast('success', 'Guess locked in', 'Validating secret word...')
      }
    })
  }

  // Handle Vote Replay (Rematch)
  const handlePlayAgain = () => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Replay Error', res.error)
      } else {
        addToast('success', 'Vote Registered', 'Waiting for all players to accept rematch.')
      }
    })
  }

  // Helpers to get player name and info
  const getPlayerName = (uid: string) => {
    return players.find(p => p.userId === uid)?.username || 'Unknown Player'
  }

  const getPlayerAvatar = (uid: string) => {
    return players.find(p => p.userId === uid)?.profile?.avatarUrl || null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        maxWidth: '560px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
        color: 'white',
        minHeight: '80vh',
        padding: '0.5rem'
      }}
      id="multiplayer-whos-spy-game"
    >
      {/* CSS Animations */}
      <style>{`
        @keyframes flip-card {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(180deg); }
        }
        @keyframes pulse-border {
          0%, 100% { border-color: hsl(220 15% 20%); }
          50% { border-color: hsl(220 100% 50% / 0.5); }
        }
        @keyframes reveal-animation {
          0% { filter: blur(8px); opacity: 0; }
          100% { filter: blur(0); opacity: 1; }
        }
        .reveal-box {
          animation: reveal-animation 0.5s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>

      {/* HEADER SECTION */}
      <div
        className="card glass"
        style={{
          padding: '1rem',
          borderRadius: 16,
          background: 'hsl(222 20% 7% / 0.8)',
          border: '1px solid hsl(220 15% 18%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', textTransform: 'uppercase', fontWeight: 800 }}>
            Who&apos;s Spy Multiplayer
          </span>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: 0 }}>
            {stage === 'REVEAL' && '🕵️ Role Cards'}
            {stage === 'CLUE' && '🐾 Submit Clues'}
            {stage === 'DISCUSSION' && '💬 Group Discussion'}
            {stage === 'VOTING' && '🗳️ Vote the Spy'}
            {stage === 'REVOTE' && '⚖️ Tie Revote'}
            {stage === 'SPY_GUESS' && '🕵️ Spy Guess'}
            {stage === 'FINISHED' && '🏆 Game Over'}
          </h2>
        </div>

        {timeLeft !== null && (
          <div
            style={{
              background: timeLeft < 15 ? 'linear-gradient(135deg, hsl(0 80% 45%), hsl(0 75% 35%))' : 'hsl(222 20% 5%)',
              padding: '0.5rem 0.85rem',
              borderRadius: 12,
              border: `1px solid ${timeLeft < 15 ? 'hsl(0 80% 50%)' : 'hsl(220 15% 22%)'}`,
              textAlign: 'center',
              boxShadow: timeLeft < 15 ? '0 0 10px rgba(255,0,0,0.2)' : 'none',
              animation: timeLeft < 15 ? 'pulse-border 1s infinite' : 'none'
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)', fontWeight: 700, textTransform: 'uppercase' }}>Time Left</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: timeLeft < 15 ? '#ff4d4d' : 'hsl(45 100% 55%)' }}>
              {timeLeft}s
            </div>
          </div>
        )}
      </div>

      {/* 1. ROLE REVEAL STAGE */}
      {stage === 'REVEAL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
          {dismissedRole[currentUserId] ? (
            <div
              className="card glass text-center"
              style={{
                width: '100%',
                padding: '3rem 2rem',
                borderRadius: 24,
                background: 'hsl(222 20% 7%)',
                border: '1px solid hsl(220 15% 18%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
              }}
            >
              <div style={{ fontSize: '4rem', animation: 'spin 4s linear infinite' }}>⏳</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Role Confirmed</h3>
              <p style={{ color: 'hsl(220 10% 60%)', maxWidth: '300px', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Waiting for all other players to view and acknowledge their roles. Keep yours secret!
              </p>
              
              {/* Ready check list */}
              <div style={{ width: '100%', marginTop: '1rem', borderTop: '1px solid hsl(220 15% 15%)', paddingTop: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, marginBottom: '0.75rem' }}>
                  Awaiting Players
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                  {players.map(p => {
                    const isReady = dismissedRole[p.userId] === true
                    return (
                      <div
                        key={p.userId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isReady ? 'hsl(142 70% 10% / 0.4)' : 'hsl(222 20% 5%)',
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: `1px solid ${isReady ? 'hsl(142 70% 30% / 0.5)' : 'hsl(220 15% 15%)'}`,
                          fontSize: '0.8rem'
                        }}
                      >
                        <span style={{ color: isReady ? 'hsl(142 70% 50%)' : 'hsl(220 10% 40%)' }}>
                          {isReady ? '✓' : '•'}
                        </span>
                        <span style={{ fontWeight: 600 }}>{p.username}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '380px', perspective: 1000 }}>
              <div
                style={{
                  width: '100%',
                  minHeight: '340px',
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: isCardFlipped ? 'rotateY(180deg)' : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setIsCardFlipped(!isCardFlipped)}
              >
                {/* CARD FRONT (Face down) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: 24,
                    background: 'linear-gradient(135deg, hsl(222 20% 12%), hsl(222 20% 6%))',
                    border: '2px solid hsl(220 15% 25%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1rem',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
                    padding: '2rem'
                  }}
                >
                  <div
                    style={{
                      width: '70px',
                      height: '70px',
                      borderRadius: '50%',
                      background: 'hsl(220 15% 18%)',
                      border: '1px solid hsl(220 15% 25%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem'
                    }}
                  >
                    🕵️
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Tap to Reveal Role</h3>
                  <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>
                    Do not let other players see your screen. Your identity is classified.
                  </p>
                </div>

                {/* CARD BACK (Revealed) */}
                <div
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: 24,
                    background: isSpy 
                      ? 'linear-gradient(135deg, hsl(0 60% 12%), hsl(222 20% 6%))' 
                      : 'linear-gradient(135deg, hsl(210 60% 12%), hsl(222 20% 6%))',
                    border: isSpy ? '2px solid hsl(0 60% 40%)' : '2px solid hsl(210 60% 40%)',
                    transform: 'rotateY(180deg)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: isSpy ? '0 15px 35px hsl(0 60% 30% / 0.15)' : '0 15px 35px hsl(210 60% 30% / 0.15)',
                    padding: '2rem',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <span
                      style={{
                        background: isSpy ? 'hsl(0 80% 15% / 0.8)' : 'hsl(210 80% 15% / 0.8)',
                        color: isSpy ? 'hsl(0 100% 70%)' : 'hsl(210 100% 70%)',
                        border: `1px solid ${isSpy ? 'hsl(0 80% 35%)' : 'hsl(210 80% 35%)'}`,
                        padding: '4px 12px',
                        borderRadius: 20,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {isSpy ? 'Spy Identity' : 'Civilian Identity'}
                    </span>
                  </div>

                  <div className="reveal-box" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                    {isSpy ? (
                      <>
                        <div style={{ fontSize: '3.5rem' }}>🕵️</div>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(0 100% 65%)', margin: 0 }}>You are the Spy</h3>
                        <p style={{ color: 'hsl(220 10% 70%)', fontSize: '0.85rem', margin: 0, maxWidth: '280px', lineHeight: 1.4 }}>
                          Blend in with the Civilians. You do not know the word. Find it before they catch you!
                        </p>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '3.5rem' }}>🐾</div>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'hsl(210 100% 65%)', margin: 0 }}>Civilian</h3>
                        <div style={{ fontSize: '0.9rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem' }}>
                          Category: <strong style={{ color: 'white' }}>{category}</strong>
                        </div>
                        <div
                          style={{
                            background: 'hsl(222 20% 5%)',
                            padding: '0.75rem 1.75rem',
                            borderRadius: 12,
                            border: '1px solid hsl(220 15% 20%)',
                            fontSize: '1.6rem',
                            fontWeight: 900,
                            letterSpacing: '0.04em',
                            color: 'hsl(45 100% 55%)',
                            marginTop: '0.5rem',
                            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)'
                          }}
                        >
                          {word}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      borderRadius: 12,
                      background: isSpy ? 'linear-gradient(135deg, hsl(0 80% 50%), hsl(0 70% 40%))' : 'linear-gradient(135deg, hsl(210 80% 50%), hsl(210 70% 40%))',
                      border: 'none'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRevealDismiss()
                    }}
                    id="acknowledge-role-btn"
                  >
                    Dismiss & Lock In
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. CLUE PHASE STAGE */}
      {stage === 'CLUE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Active submission panel */}
          <div
            className="card glass"
            style={{
              padding: '1.25rem',
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
          >
            {currentTurn === currentUserId ? (
              <form onSubmit={handleClueSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 800, fontSize: '0.95rem' }}>✍️ Your Turn: Submit Clue</h4>
                  <p style={{ margin: 0, color: 'hsl(220 10% 60%)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    Submit exactly one word or short clue. Be careful: leaking the secret word will block the submission!
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Enter clue..."
                    value={clueInput}
                    onChange={(e) => setClueInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      backgroundColor: 'hsl(222 20% 5%)',
                      border: '1px solid hsl(220 15% 22%)',
                      color: 'white',
                      fontSize: '0.95rem',
                      outline: 'none'
                    }}
                    id="clue-input-field"
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ borderRadius: 10 }}
                    disabled={isSubmitting || !clueInput.trim()}
                    id="clue-submit-btn"
                  >
                    Lock Clue
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', padding: '0.5rem' }}>
                <div
                  style={{
                    width: 20, height: 20,
                    border: '2px solid hsl(var(--border-subtle))',
                    borderTop: '2px solid hsl(var(--brand-primary))',
                    borderRadius: '50%', animation: 'spin 1s linear infinite'
                  }}
                />
                <span style={{ fontSize: '0.9rem', color: 'hsl(220 10% 65%)' }}>
                  Waiting for <strong>{getPlayerName(currentTurn || '')}</strong> to submit their clue...
                </span>
              </div>
            )}
          </div>

          {/* Clues Board */}
          <div
            className="card glass"
            style={{
              padding: '1.25rem',
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              flex: 1
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, marginBottom: '0.75rem' }}>
              Submission Order
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clueOrder.map((userId: string, idx: number) => {
                const isPlayerTurn = currentTurn === userId
                const playerClue = clues[userId]
                const name = getPlayerName(userId)
                
                return (
                  <div
                    key={userId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isPlayerTurn ? 'hsl(220 100% 50% / 0.05)' : 'hsl(222 20% 5%)',
                      padding: '0.75rem 1rem',
                      borderRadius: 12,
                      border: `1px solid ${isPlayerTurn ? 'hsl(220 100% 50% / 0.4)' : 'hsl(220 15% 15%)'}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar
                        avatarUrl={getPlayerAvatar(userId)}
                        username={name}
                        size={32}
                      />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          {name} {userId === currentUserId && '(You)'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 45%)' }}>
                          Turn #{idx + 1}
                        </div>
                      </div>
                    </div>

                    <div>
                      {playerClue ? (
                        <span
                          style={{
                            background: 'hsl(222 20% 12%)',
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            color: 'hsl(45 100% 55%)',
                            border: '1px solid hsl(220 15% 20%)'
                          }}
                        >
                          {playerClue}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'hsl(220 10% 40%)' }}>
                          {isPlayerTurn ? 'Writing...' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. DISCUSSION PHASE */}
      {stage === 'DISCUSSION' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: '62vh' }}>
          {/* Clues Summary Drawer */}
          <div
            className="card glass"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 16,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800 }}>
              Submitted Clues
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {clueOrder.map((uid: string) => (
                <div
                  key={uid}
                  style={{
                    background: 'hsl(222 20% 5%)',
                    border: '1px solid hsl(220 15% 15%)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: '0.78rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span style={{ color: 'hsl(220 10% 55%)' }}>{getPlayerName(uid)}:</span>
                  <strong style={{ color: 'hsl(45 100% 55%)' }}>{clues[uid] || '?'}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Group Discussion Chat Panel */}
          <div
            className="card glass"
            style={{
              flex: 1,
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: '360px'
            }}
          >
            {/* Messages box */}
            <div
              className="custom-scrollbar"
              style={{
                flex: 1,
                padding: '1.25rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '380px'
              }}
            >
              {chatMessages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'hsl(220 10% 45%)', fontSize: '0.85rem' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>💬</span>
                  Chat is active. Start discussing clues to expose the Spy!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isSelf = msg.userId === currentUserId
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: isSelf ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        maxWidth: '85%',
                        alignSelf: isSelf ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <Avatar
                        avatarUrl={msg.avatarUrl}
                        username={msg.username}
                        size={28}
                      />
                      <div>
                        {!isSelf && (
                          <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginBottom: '2px', fontWeight: 600 }}>
                            {msg.username}
                          </div>
                        )}
                        <div
                          style={{
                            background: isSelf ? 'hsl(220 100% 50% / 0.15)' : 'hsl(222 20% 12%)',
                            border: `1px solid ${isSelf ? 'hsl(220 100% 50% / 0.3)' : 'hsl(220 15% 20%)'}`,
                            padding: '0.5rem 0.85rem',
                            borderRadius: isSelf ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                            fontSize: '0.88rem',
                            color: 'white',
                            lineHeight: 1.4,
                            wordBreak: 'break-word'
                          }}
                        >
                          {msg.message}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form */}
            {!isSpectator && (
              <form
                onSubmit={handleSendChat}
                style={{
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid hsl(220 15% 15%)',
                  background: 'hsl(222 20% 5%)',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  placeholder={chatCooldownLeft > 0 ? `Muted: wait ${chatCooldownLeft}s...` : "Discuss clues..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.65rem 0.85rem',
                    borderRadius: 10,
                    backgroundColor: 'hsl(222 20% 8%)',
                    border: '1px solid hsl(220 15% 20%)',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  id="discussion-chat-input"
                  disabled={isSubmitting || chatCooldownLeft > 0}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ borderRadius: 10, padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                  disabled={isSubmitting || !chatInput.trim() || chatCooldownLeft > 0}
                  id="discussion-chat-send-btn"
                >
                  Send
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 4. VOTING STAGE */}
      {(stage === 'VOTING' || stage === 'REVOTE') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            className="card glass text-center"
            style={{
              padding: '1.25rem',
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)'
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              {stage === 'REVOTE' ? '⚖️ Tie Revote' : '🕵️ Cast Secret Spy Vote'}
            </h3>
            <p style={{ margin: 0, color: 'hsl(220 10% 60%)', fontSize: '0.85rem', lineHeight: 1.4 }}>
              {stage === 'REVOTE'
                ? 'A tie has occurred! You can only vote for the tied players listed below.'
                : 'Choose the player you suspect of being the Spy. The player with the most votes is eliminated.'}
            </p>
          </div>

          {stage === 'REVOTE' && (
            <div
              style={{
                background: 'hsl(38 95% 12% / 0.8)',
                border: '1px solid hsl(38 95% 40%)',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: '0.85rem',
                color: 'hsl(38 100% 65%)',
                fontWeight: 700,
                textAlign: 'center'
              }}
            >
              ⚖️ Tie Vote Revote: 30 seconds remaining!
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem'
            }}
          >
            {players.map((p) => {
              const hasVotedTarget = votes[currentUserId] !== undefined
              const isTargetVotedByMe = votes[currentUserId] === p.userId
              const hasThisPlayerVoted = votes[p.userId] !== undefined
              const isSelfPlayer = p.userId === currentUserId
              
              const isTied = gameState.tiedPlayers?.includes(p.userId)
              const canVoteForThisPlayer = stage !== 'REVOTE' || isTied
              
              return (
                <div
                  key={p.userId}
                  style={{
                    background: 'hsl(222 20% 7%)',
                    border: `1px solid ${isTargetVotedByMe ? 'hsl(0 80% 50%)' : (stage === 'REVOTE' && isTied) ? 'hsl(38 95% 45%)' : 'hsl(220 15% 18%)'}`,
                    borderRadius: 16,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    position: 'relative',
                    boxShadow: isTargetVotedByMe ? '0 0 15px hsl(0 80% 50% / 0.15)' : (stage === 'REVOTE' && isTied) ? '0 0 10px hsl(38 95% 45% / 0.15)' : 'none',
                    opacity: isSelfPlayer ? 0.7 : canVoteForThisPlayer ? 1 : 0.4
                  }}
                >
                  <Avatar
                    avatarUrl={getPlayerAvatar(p.userId)}
                    username={p.username}
                    size={46}
                  />
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{p.username}</div>
                    <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '2px' }}>
                      {isSelfPlayer ? 'You' : hasThisPlayerVoted ? '✓ Voted' : '⏳ Thinking'}
                    </div>
                  </div>

                  {!isSelfPlayer && !hasVotedTarget && !isSpectator && canVoteForThisPlayer && (
                    <button
                      className="btn"
                      style={{
                        width: '100%',
                        borderRadius: 10,
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.78rem',
                        background: 'linear-gradient(135deg, hsl(0 80% 55%), hsl(0 75% 45%))',
                        border: 'none',
                        color: 'white',
                        fontWeight: 700
                      }}
                      onClick={() => handleVoteSubmit(p.userId)}
                    >
                      Suspect
                    </button>
                  )}

                  {!isSelfPlayer && !hasVotedTarget && !isSpectator && !canVoteForThisPlayer && (
                    <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 40%)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                      Safe (No Tie)
                    </span>
                  )}

                  {isTargetVotedByMe && (
                    <div
                      style={{
                        width: '100%',
                        borderRadius: 10,
                        padding: '0.4rem 0.5rem',
                        fontSize: '0.78rem',
                        background: 'hsl(0 80% 15%)',
                        border: '1px solid hsl(0 80% 40%)',
                        color: 'hsl(0 100% 65%)',
                        fontWeight: 700,
                        textAlign: 'center'
                      }}
                    >
                      Selected
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. SPY GUESS STAGE */}
      {stage === 'SPY_GUESS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          {isSpy ? (
            <div
              className="card glass text-center"
              style={{
                width: '100%',
                padding: '2rem 1.5rem',
                borderRadius: 24,
                background: 'hsl(222 20% 7%)',
                border: '1px solid hsl(220 15% 18%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
              }}
            >
              <div style={{ fontSize: '3rem' }}>🕵️</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(0 100% 65%)', margin: 0 }}>
                You were Eliminated!
              </h3>
              <p style={{ color: 'hsl(220 10% 65%)', fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4, margin: 0 }}>
                The civilians successfully voted you out. However, you can still win! Guess the secret word.
              </p>
              
              <div
                style={{
                  background: 'hsl(222 20% 5%)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  border: '1px solid hsl(220 15% 15%)'
                }}
              >
                Category: <strong>{category}</strong>
              </div>

              <form onSubmit={handleSpyGuessSubmit} style={{ width: '100%', display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Guess the word..."
                  value={spyGuessInput}
                  onChange={(e) => setSpyGuessInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    backgroundColor: 'hsl(222 20% 5%)',
                    border: '1px solid hsl(220 15% 22%)',
                    color: 'white',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                  id="spy-guess-input-field"
                  disabled={isSubmitting}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ borderRadius: 10, background: 'linear-gradient(135deg, hsl(0 80% 55%), hsl(0 75% 45%))', border: 'none' }}
                  disabled={isSubmitting || !spyGuessInput.trim()}
                  id="spy-guess-submit-btn"
                >
                  Submit
                </button>
              </form>
            </div>
          ) : (
            <div
              className="card glass text-center"
              style={{
                width: '100%',
                padding: '3rem 2rem',
                borderRadius: 24,
                background: 'hsl(222 20% 7%)',
                border: '1px solid hsl(220 15% 18%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.5rem'
              }}
            >
              <div style={{ fontSize: '4rem', animation: 'spin 4s linear infinite' }}>⏳</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Spy Guessing...</h3>
              <p style={{ color: 'hsl(220 10% 60%)', maxWidth: '300px', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                You successfully voted out the Spy! Now waiting for the Spy to submit their guess for the secret word.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 6. FINISHED STAGE (RESULTS) */}
      {stage === 'FINISHED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Winner banner */}
          <div
            className="card glass text-center"
            style={{
              padding: '2rem 1.5rem',
              borderRadius: 24,
              border: `2px solid ${winnerId === spyId ? 'hsl(0 80% 40%)' : 'hsl(210 80% 40%)'}`,
              background: winnerId === spyId 
                ? 'linear-gradient(180deg, hsl(0 80% 12% / 0.8), hsl(222 20% 6%))' 
                : 'linear-gradient(180deg, hsl(210 80% 12% / 0.8), hsl(222 20% 6%))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              boxShadow: winnerId === spyId ? '0 10px 30px hsl(0 80% 40% / 0.15)' : '0 10px 30px hsl(210 80% 40% / 0.15)'
            }}
          >
            <div style={{ fontSize: '3.5rem' }}>
              {winnerId === spyId ? '🕵️' : '🐾'}
            </div>
            
            <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', margin: 0 }}>
              {winnerId === spyId ? 'Spy Wins!' : 'Civilians Win!'}
            </h3>
            
            <p style={{ color: 'hsl(220 10% 70%)', fontSize: '0.9rem', maxWidth: '340px', lineHeight: 1.4, margin: 0 }}>
              {winnerId === spyId
                ? 'The Spy successfully deceived the civilians or guessed the secret word!'
                : 'The Civilians successfully voted out the Spy and protected the secret word!'}
            </p>

            <div
              style={{
                marginTop: '0.5rem',
                fontSize: '0.82rem',
                color: 'hsl(220 10% 50%)',
                background: 'hsl(222 20% 4%)',
                padding: '6px 16px',
                borderRadius: 20,
                border: '1px solid hsl(220 15% 15%)'
              }}
            >
              Secret Word was: <strong style={{ color: 'hsl(45 100% 55%)' }}>{word}</strong> (Category: {category})
            </div>
          </div>

          {/* XP & Rewards distributed */}
          <div
            className="card glass"
            style={{
              padding: '1.25rem',
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800 }}>
              XP & Coins Rewards Distributed
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {players.map((p) => {
                const isPlayerSpy = p.userId === spyId
                const isSpyWin = winnerId === spyId
                const wonRewards = isSpyWin ? isPlayerSpy : !isPlayerSpy
                
                const xpEarned = isSpyWin ? (isPlayerSpy ? 150 : 30) : (isPlayerSpy ? 20 : 100)
                const coinsEarned = isSpyWin ? (isPlayerSpy ? 30 : 5) : (isPlayerSpy ? 5 : 20)

                return (
                  <div
                    key={p.userId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'hsl(222 20% 5%)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid hsl(220 15% 15%)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar
                        avatarUrl={getPlayerAvatar(p.userId)}
                        username={p.username}
                        size={28}
                      />
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.username}</span>
                        <span style={{ fontSize: '0.7rem', color: isPlayerSpy ? 'hsl(0 100% 70%)' : 'hsl(210 100% 70%)', marginLeft: '6px' }}>
                          {isPlayerSpy ? '• Spy' : '• Civilian'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', fontWeight: 700 }}>
                      <span style={{ color: 'hsl(142 70% 45%)' }}>+{xpEarned} XP</span>
                      <span style={{ color: 'hsl(45 100% 50%)' }}>+{coinsEarned} Coins</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rematch Controller */}
          <div
            className="card glass text-center"
            style={{
              padding: '1.25rem',
              borderRadius: 20,
              background: 'hsl(222 20% 7%)',
              border: '1px solid hsl(220 15% 18%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              {!isSpectator && (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, borderRadius: 12 }}
                  disabled={replayVotes[currentUserId] || isSubmitting}
                  onClick={handlePlayAgain}
                  id="rematch-btn"
                >
                  {replayVotes[currentUserId] ? 'Voted for Rematch!' : 'Request Rematch'}
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 12 }}
                onClick={onLeave}
                id="leave-match-btn"
              >
                Leave Room
              </button>
            </div>

            {Object.keys(replayVotes).length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'hsl(45 100% 55%)' }}>
                Rematch Votes: {Object.keys(replayVotes).length} / {players.length} accepted
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating emoji reactions */}
      {stage !== 'FINISHED' && (
        <MatchReactions
          socket={socket}
          roomCode={roomCode}
          currentUserId={currentUserId}
          players={players}
        />
      )}
    </div>
  )
}
