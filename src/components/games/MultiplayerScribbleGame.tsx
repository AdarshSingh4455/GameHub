'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import ProfileCardModal from '@/components/layout/ProfileCardModal'

interface Player {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
  profileId?: string
}

interface ScribbleProps {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

export default function MultiplayerScribbleGame({
  roomCode,
  session,
  players,
  currentUserId,
  onLeave
}: ScribbleProps) {
  const { socket } = useSocket()
  const { addToast } = useToast()
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [guess, setGuess] = useState('')
  const [color, setColor] = useState('#ffffff')
  const [brushSize, setBrushSize] = useState(4)
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil')
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const localLinesRef = useRef<any[]>([])
  
  // Draw batching buffer
  const pendingDrawRef = useRef<any[]>([])
  const drawFlushIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const gameState = session.gameState || {}
  const {
    stage = 'LOBBY_SETTINGS',
    drawerId = '',
    wordsToSelect = [],
    selectedWord = '',
    guessedPlayers = [],
    playerScores = {},
    roundScores = {},
    hintString = '',
    timerDuration = 45,
    timerStart = 0,
    canvasLines = [],
    replayVotes = {},
    commentary = [],
    round = 1,
    maxRounds = 3
  } = gameState

  const isDrawer = drawerId === currentUserId
  const hasGuessed = guessedPlayers.includes(currentUserId)

  // Sort players by score descending (live)
  const sortedPlayers = [...players].sort((a, b) => (playerScores[b.userId] || 0) - (playerScores[a.userId] || 0))
  const leaderId = sortedPlayers[0]?.userId

  // 1. Draw existing lines on mount/update (Reconnect Canvas Recovery)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const lines = canvasLines || []
    lines.forEach((line: any) => {
      drawOnCanvas(ctx, line.x0, line.y0, line.x1, line.y1, line.color, line.width, line.isEraser)
    })
    localLinesRef.current = [...lines]
  }, [canvasLines, stage])

  // 2. Real-time draw socket listener for Spectators
  useEffect(() => {
    if (!socket || isDrawer) return

    const handleRemoteDraw = ({ drawData }: { drawData: any }) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Support both single object and batched array
      const draws = Array.isArray(drawData) ? drawData : [drawData]
      draws.forEach((d: any) => {
        drawOnCanvas(ctx, d.x0, d.y0, d.x1, d.y1, d.color, d.width, d.isEraser)
        localLinesRef.current.push(d)
      })
    }

    const handleRemoteClear = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      localLinesRef.current = []
    }

    socket.on('scribble-draw', handleRemoteDraw)
    socket.on('scribble-clear', handleRemoteClear)

    return () => {
      socket.off('scribble-draw', handleRemoteDraw)
      socket.off('scribble-clear', handleRemoteClear)
    }
  }, [socket, isDrawer])

  // Draw batching flush interval — emit buffered strokes every 33ms
  useEffect(() => {
    if (!isDrawer || stage !== 'DRAWING') return

    drawFlushIntervalRef.current = setInterval(() => {
      if (pendingDrawRef.current.length === 0 || !socket) return
      const batch = pendingDrawRef.current.splice(0)
      socket.emit('scribble-draw', { roomCode, drawData: batch })
    }, 33)

    return () => {
      if (drawFlushIntervalRef.current) clearInterval(drawFlushIntervalRef.current)
    }
  }, [isDrawer, stage, socket, roomCode])

  // 3. AFK warning listener
  useEffect(() => {
    if (!socket) return

    const handleAfkWarning = ({ drawerId: afkDrawerId }: { drawerId: string }) => {
      const isMe = afkDrawerId === currentUserId
      if (isMe) {
        addToast('warning', 'Inactivity Warning', 'You have not drawn anything for 10 seconds. Draw something now to avoid being skipped!')
      } else {
        addToast('info', 'Inactivity Warning', `${getUsername(afkDrawerId)} has been inactive for 10 seconds and might be skipped soon.`)
      }
    }

    socket.on('scribble-afk-warning', handleAfkWarning)
    return () => {
      socket.off('scribble-afk-warning', handleAfkWarning)
    }
  }, [socket, currentUserId, drawerId, players])

  const drawOnCanvas = (
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, x1: number, y1: number,
    strokeStyle: string, lineWidth: number, isEraser: boolean
  ) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = isEraser ? '#0a0b0d' : strokeStyle
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // Touch/Mouse coordinate helper — FIXED: changedTouches fallback
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      // Use changedTouches[0] as fallback when touches is empty (touchend event)
      const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches?.[0]
      if (!touch) return lastPosRef.current // return last known position on release
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawer || stage !== 'DRAWING') return
    isDrawingRef.current = true
    const pos = getCoordinates(e)
    lastPosRef.current = pos
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || stage !== 'DRAWING') return
    if ('touches' in e) {
      e.preventDefault()
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentPos = getCoordinates(e)
    const strokeColor = color
    const strokeWidth = brushSize
    const isEraser = tool === 'eraser'

    drawOnCanvas(ctx, lastPosRef.current.x, lastPosRef.current.y, currentPos.x, currentPos.y, strokeColor, strokeWidth, isEraser)

    const drawData = {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: currentPos.x,
      y1: currentPos.y,
      color: strokeColor,
      width: strokeWidth,
      isEraser
    }

    localLinesRef.current.push(drawData)
    // Buffer for batch emission instead of immediate per-stroke emit
    pendingDrawRef.current.push(drawData)

    lastPosRef.current = currentPos
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current || !isDrawer || stage !== 'DRAWING') return
    isDrawingRef.current = false

    // Flush remaining buffer immediately on stroke end
    if (pendingDrawRef.current.length > 0 && socket) {
      const batch = pendingDrawRef.current.splice(0)
      socket.emit('scribble-draw', { roomCode, drawData: batch })
    }

    // Sync full canvas state to server for reconnect recovery
    if (socket) {
      socket.emit('submit-move', { roomCode, move: { type: 'draw', lines: localLinesRef.current } })
    }
  }

  const clearCanvas = () => {
    if (!isDrawer || stage !== 'DRAWING') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    localLinesRef.current = []
    pendingDrawRef.current = []

    if (socket) {
      socket.emit('scribble-clear', { roomCode })
      socket.emit('submit-move', { roomCode, move: { type: 'clear' } })
    }
  }

  const handleStartMatchWithSettings = (timerVal: number) => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'settings', timerDuration: timerVal } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) addToast('error', 'Setup Error', res.error)
    })
  }

  const handleSelectWord = (word: string) => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'select-word', word } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) addToast('error', 'Select Word Error', res.error)
    })
  }

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !guess.trim() || isSubmitting || hasGuessed || isDrawer) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'guess', guess: guess.trim() } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) addToast('error', 'Guess Error', res.error)
      else setGuess('')
    })
  }

  const handlePlayAgain = () => {
    if (!socket) return
    setIsSubmitting(true)
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) addToast('error', 'Replay Error', res.error)
      else addToast('success', 'Vote Registered', 'Waiting for others to accept.')
    })
  }

  const getUsername = (uid: string) => players.find(p => p.userId === uid)?.username || 'Opponent'

  // Timer
  const [timerRemaining, setTimerRemaining] = useState(0)
  useEffect(() => {
    if (stage === 'FINISHED' || stage === 'LOBBY_SETTINGS') return
    const limit = stage === 'WORD_SELECTION' ? 15 : stage === 'ROUND_SUMMARY' ? 8 : timerDuration
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - timerStart) / 1000)
      setTimerRemaining(Math.max(0, limit - elapsed))
    }
    updateTimer()
    const interval = setInterval(updateTimer, 500)
    return () => clearInterval(interval)
  }, [stage, timerStart, timerDuration])

  const timerPercent = stage === 'DRAWING' ? (timerRemaining / timerDuration) * 100 : 100

  const colors = [
    '#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6',
    '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4'
  ]

  // Word hint display
  const wordDisplay = isDrawer
    ? (selectedWord ? selectedWord.toUpperCase() : null)
    : (hintString || (selectedWord ? '_'.repeat(selectedWord.length).split('').join(' ') : null))
  const wordLength = selectedWord ? selectedWord.length : hintString.replace(/ /g, '').replace(/_/g, '').length || hintString.split(' ').filter(Boolean).length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>

      {/* ── Compact 3-Zone Header ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        background: 'hsl(222 20% 10%)',
        border: '1px solid hsl(220 15% 18%)',
        borderRadius: 14,
      }}>
        {/* LEFT: Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
            <svg width="36" height="36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(220 20% 18%)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="14" fill="none"
                stroke={timerRemaining <= 10 ? 'hsl(0 80% 55%)' : 'hsl(220 100% 60%)'}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 14}`}
                strokeDashoffset={`${2 * Math.PI * 14 * (1 - timerPercent / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <span style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem', fontWeight: 800,
              color: timerRemaining <= 10 ? 'hsl(0 80% 65%)' : 'white'
            }}>
              {stage === 'DRAWING' || stage === 'WORD_SELECTION' || stage === 'ROUND_SUMMARY' ? timerRemaining : '—'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)' }}>
            <div style={{ fontWeight: 700, color: 'white', fontSize: '0.8rem' }}>Round {round}/{maxRounds}</div>
            <div>{stage === 'DRAWING' ? 'Drawing' : stage === 'WORD_SELECTION' ? 'Choosing' : stage === 'ROUND_SUMMARY' ? 'Summary' : stage}</div>
          </div>
        </div>

        {/* CENTER: Word Reveal */}
        <div style={{ textAlign: 'center', minWidth: 0 }}>
          {stage === 'DRAWING' && (
            <>
              {isDrawer ? (
                <div style={{ fontSize: '0.7rem', color: 'hsl(142 70% 55%)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✏️ Draw: <span style={{ color: 'hsl(142 70% 65%)', fontSize: '0.9rem' }}>{selectedWord}</span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.18em', fontFamily: 'monospace', color: 'white' }}>
                    {wordDisplay || '...'}
                  </div>
                  {wordLength > 0 && (
                    <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '1px' }}>
                      {wordLength} letters
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {stage === 'WORD_SELECTION' && (
            <div style={{ fontSize: '0.75rem', color: 'hsl(38 95% 60%)', fontWeight: 700 }}>
              🤔 {isDrawer ? 'Choose your word!' : `${getUsername(drawerId)} is choosing...`}
            </div>
          )}
          {stage === 'LOBBY_SETTINGS' && (
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>
              🎨 Scribble
            </div>
          )}
          {stage === 'ROUND_SUMMARY' && (
            <div style={{ fontSize: '0.75rem', color: 'hsl(142 70% 55%)', fontWeight: 700 }}>
              🏁 Round Over — <span style={{ color: 'white' }}>{selectedWord?.toUpperCase()}</span>
            </div>
          )}
          {stage === 'FINISHED' && (
            <div style={{ fontSize: '0.75rem', color: 'hsl(45 100% 60%)', fontWeight: 700 }}>🏆 Match Finished</div>
          )}
        </div>

        {/* RIGHT: Leave button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={onLeave}
            id="scribble-leave-btn"
            style={{
              padding: '0.35rem 0.8rem', fontSize: '0.78rem', borderRadius: 10,
              border: '1px solid hsl(0 80% 40% / 0.5)', color: 'hsl(0 80% 65%)',
              background: 'hsl(0 80% 50% / 0.08)', minWidth: 'auto', fontWeight: 700
            }}
          >
            🚪 Leave
          </button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: '0.75rem', width: '100%' }} className="scribble-layout-grid">
        
        {/* Left: Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          {/* Canvas board */}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '4/3',
            background: '#0a0b0d', borderRadius: 16,
            border: '1px solid hsl(var(--border-subtle))',
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                width: '100%', height: '100%',
                display: stage === 'DRAWING' ? 'block' : 'none',
                cursor: isDrawer && stage === 'DRAWING' ? 'crosshair' : 'default',
                touchAction: 'none'
              }}
            />

            {/* LOBBY_SETTINGS */}
            {stage === 'LOBBY_SETTINGS' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '3rem' }}>🎨</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '1rem' }}>Match Settings</h3>
                {currentUserId === gameState.hostUserId ? (
                  <div>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Choose the round drawing time for the entire match.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      {[30, 45, 60].map(time => (
                        <button key={time} className="btn btn-primary" onClick={() => handleStartMatchWithSettings(time)} style={{ minWidth: 80, borderRadius: 10 }}>
                          ⏱ {time}s
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                    Waiting for the host ({getUsername(gameState.hostUserId)}) to select round duration...
                  </p>
                )}
              </div>
            )}

            {/* WORD_SELECTION */}
            {stage === 'WORD_SELECTION' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '3rem', animation: 'bounce 1s infinite' }}>🤔</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '0.5rem' }}>Word Selection</h3>
                {isDrawer ? (
                  <div>
                    <p style={{ color: 'hsl(var(--brand-primary))', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Choose a word to draw! ({timerRemaining}s left)
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxWidth: 360, margin: '0 auto' }}>
                      {(wordsToSelect as string[]).map((word: string) => (
                        <button key={word} className="btn btn-primary" onClick={() => handleSelectWord(word)} style={{ padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700 }}>
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
                      <strong style={{ color: 'white' }}>{getUsername(drawerId)}</strong> is choosing a word...
                    </p>
                    <div className="glass" style={{ display: 'inline-flex', padding: '0.5rem 1rem', borderRadius: 99, marginTop: '1rem', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                      ⏳ {timerRemaining}s remaining
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ROUND_SUMMARY */}
            {stage === 'ROUND_SUMMARY' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10, background: 'rgba(10,11,13,0.95)', position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '3.5rem' }}>🏁</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem', color: 'hsl(var(--brand-secondary))' }}>Round Over!</h3>
                <p style={{ fontSize: '1.1rem', color: 'white', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                  The word was: <strong style={{ textTransform: 'uppercase', color: 'hsl(var(--success))', fontSize: '1.25rem' }}>{selectedWord}</strong>
                </p>
                <div className="glass" style={{ maxWidth: 400, margin: '0 auto', padding: '1rem', borderRadius: 12, width: '100%' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Round Standings</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {players.map(p => {
                      const pts = roundScores[p.userId] || 0
                      const guessed = guessedPlayers.includes(p.userId)
                      const isDr = p.userId === drawerId
                      return (
                        <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>{isDr ? '🎨 ' : guessed ? '✅ ' : '❌ '} {p.username}</span>
                          <span style={{ color: pts > 0 ? 'hsl(var(--success))' : 'white', fontWeight: 700 }}>+{pts} pts</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '1rem' }}>Next round in {timerRemaining}s...</p>
              </div>
            )}

            {/* FINISHED overlay */}
            {stage === 'FINISHED' && (
              <div style={{
                padding: '2rem', textAlign: 'center', zIndex: 10,
                background: 'rgba(10,11,13,0.94)', backdropFilter: 'blur(4px)',
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'
              }}>
                <span style={{ fontSize: '4rem' }}>🏆</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>Match Finished!</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>Final Standings</p>

                <div className="glass" style={{ maxWidth: 400, margin: '0 auto 1.5rem', padding: '1.25rem', borderRadius: 16, width: '100%' }}>
                  {sortedPlayers.map((p, idx) => (
                    <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: idx < sortedPlayers.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', fontSize: '0.9rem' }}>
                      <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'} {p.username}</span>
                      <strong style={{ color: 'hsl(var(--brand-primary))' }}>{playerScores[p.userId] || 0} pts</strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                  <button className="btn btn-secondary" onClick={onLeave} style={{ flex: 1, borderRadius: 12 }}>🚪 Leave Room</button>
                  <button
                    className="btn btn-primary"
                    onClick={handlePlayAgain}
                    disabled={replayVotes[currentUserId] || isSubmitting}
                    style={{ flex: 1, borderRadius: 12, background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' }}
                  >
                    {replayVotes[currentUserId] ? '⏳ Voted' : '🔄 Play Again'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Canvas Toolbar */}
          {stage === 'DRAWING' && isDrawer && (
            <div className="card glass" style={{ padding: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', borderRadius: 12 }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {(['pencil', 'eraser'] as const).map(t => (
                  <button key={t} onClick={() => setTool(t)} className="btn" style={{ padding: '0.4rem 0.75rem', minWidth: 'auto', backgroundColor: tool === t ? 'hsl(var(--brand-primary) / 0.2)' : 'transparent', border: tool === t ? '1px solid hsl(var(--brand-primary))' : '1px solid transparent', color: 'white', fontSize: '0.8rem' }}>
                    {t === 'pencil' ? '✏️ Pencil' : '🧽 Eraser'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Size:</span>
                {[3, 6, 12, 20].map(sz => (
                  <button key={sz} onClick={() => setBrushSize(sz)} style={{ width: 24, height: 24, borderRadius: '50%', border: brushSize === sz ? '2px solid white' : '1px solid transparent', background: 'hsl(220 20% 18%)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <div style={{ width: sz / 2 + 2, height: sz / 2 + 2, borderRadius: '50%', background: 'white' }} />
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {colors.map(col => (
                  <button key={col} onClick={() => { setColor(col); setTool('pencil') }} style={{ width: 20, height: 20, borderRadius: '50%', border: color === col && tool === 'pencil' ? '2px solid white' : '1px solid rgba(255,255,255,0.1)', background: col, cursor: 'pointer' }} />
                ))}
              </div>
              <button className="btn" onClick={clearCanvas} style={{ padding: '0.4rem 0.75rem', minWidth: 'auto', border: '1px solid hsl(var(--danger) / 0.3)', color: 'hsl(var(--danger))', fontSize: '0.8rem', backgroundColor: 'transparent' }}>
                🗑️ Clear
              </button>
            </div>
          )}

          {/* Word hint strip (only during drawing, for spectators) */}
          {stage === 'DRAWING' && !isDrawer && (
            <div className="card glass text-center" style={{ padding: '0.6rem', borderRadius: 12 }}>
              <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  className="input"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  placeholder={hasGuessed ? 'Correct! ✅ Waiting...' : 'Type your guess...'}
                  disabled={hasGuessed || isSubmitting}
                  style={{ flex: 1, fontSize: '0.85rem', minHeight: '40px', padding: '0.4rem 0.75rem' }}
                  maxLength={24}
                  id="scribble-guess-input"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={hasGuessed || !guess.trim() || isSubmitting}
                  style={{ minHeight: '40px', padding: '0.4rem 0.9rem', fontSize: '0.85rem', borderRadius: 8 }}
                >
                  Guess
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Scoreboard + Commentary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>

          {/* Live Scoreboard */}
          <div className="card glass" style={{ padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: 12 }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Live Scoreboard
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sortedPlayers.map((p, idx) => {
                const isCurDrawer = p.userId === drawerId
                const didGuess = guessedPlayers.includes(p.userId)
                const isLeader = p.userId === leaderId && (playerScores[p.userId] || 0) > 0
                const isMe = p.userId === currentUserId
                return (
                  <div
                    key={p.userId}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: '0.78rem', padding: '5px 6px', borderRadius: 8,
                      backgroundColor: isCurDrawer
                        ? 'hsl(var(--brand-primary) / 0.12)'
                        : didGuess ? 'hsl(var(--success) / 0.1)'
                        : isMe ? 'hsl(220 20% 16%)' : 'transparent',
                      border: isMe ? '1px solid hsl(220 15% 22%)' : '1px solid transparent'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.8rem' }}>
                        {isCurDrawer ? '✏️' : isLeader ? '👑' : didGuess ? '✅' : '👤'}
                      </span>
                      <button
                        onClick={() => p.profileId && setSelectedProfileId(p.profileId)}
                        style={{
                          background: 'none', border: 'none', padding: 0, cursor: p.profileId ? 'pointer' : 'default',
                          color: isMe ? 'hsl(220 100% 75%)' : 'white',
                          fontWeight: isMe ? 700 : 400, fontSize: '0.78rem',
                          textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
                          maxWidth: 110, textAlign: 'left'
                        }}
                        title={p.username}
                      >
                        {p.username}
                      </button>
                    </span>
                    <strong style={{ color: (playerScores[p.userId] || 0) > 0 ? 'hsl(var(--brand-primary))' : 'hsl(220 10% 50%)', flexShrink: 0 }}>
                      {playerScores[p.userId] || 0}
                    </strong>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Commentary Feed */}
          <div className="card glass" style={{ padding: '0.875rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: 12, minHeight: 160 }}>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Guesses & Feed
            </h4>
            <div style={{ flex: 1, maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: '0.3rem', fontSize: '0.78rem', paddingRight: '2px' }}>
              {commentary.map((line: string, idx: number) => {
                const isSuccess = line.startsWith('✅') || line.startsWith('⭐')
                const isMsg = line.startsWith('💬')
                const isWarning = line.startsWith('⚠️') || line.startsWith('⏰')
                let col = 'hsl(220 10% 70%)'
                let fontWt = 400
                if (isSuccess) { col = 'hsl(var(--success))'; fontWt = 700 }
                else if (isMsg) { col = 'hsl(220 10% 55%)' }
                else if (isWarning) { col = 'hsl(var(--warning))'; fontWt = 700 }
                return (
                  <div key={idx} style={{ color: col, fontWeight: fontWt, lineHeight: '1.35' }}>
                    {line}
                  </div>
                )
              })}
            </div>

            {/* Guess input for drawing stage (spectators — also shown in right column on mobile) */}
            {stage === 'DRAWING' && !isDrawer && (
              <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '0.35rem', marginTop: 'auto' }}>
                <input
                  className="input"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  placeholder={hasGuessed ? '✅ Correct!' : 'Your guess...'}
                  disabled={hasGuessed || isSubmitting}
                  style={{ flex: 1, fontSize: '0.78rem', minHeight: '36px', padding: '0.3rem 0.6rem' }}
                  maxLength={24}
                  id="scribble-guess-sidebar"
                  autoComplete="off"
                />
                <button type="submit" className="btn btn-primary" disabled={hasGuessed || !guess.trim() || isSubmitting} style={{ minHeight: '36px', padding: '0.3rem 0.7rem', fontSize: '0.78rem', borderRadius: 8 }}>
                  Go
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Profile Preview Modal */}
      <ProfileCardModal
        profileId={selectedProfileId}
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
      />

      <style jsx>{`
        @media (max-width: 768px) {
          .scribble-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
