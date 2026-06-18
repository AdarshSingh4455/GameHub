'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MultiplayerHeader from './MultiplayerHeader'
import MatchReactions from './MatchReactions'

interface Player {
  userId: string
  username: string
  avatarUrl: string | null
  level: number
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
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })
  const localLinesRef = useRef<any[]>([])

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

  // 1. Draw existing lines on mount/update (Reconnect Canvas Recovery)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Redraw all lines from server state
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

      drawOnCanvas(ctx, drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.width, drawData.isEraser)
      localLinesRef.current.push(drawData)
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

  // 3. Real-time AFK warning listener
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

  // Canvas helper drawing functions
  const drawOnCanvas = (
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    strokeStyle: string,
    lineWidth: number,
    isEraser: boolean
  ) => {
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = isEraser ? '#0a0b0d' : strokeStyle // match canvas background
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  // 3. Drawing handlers for Mouse / Touch (Mobile optimized)
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    
    // Scale factor to map client rect size to internal canvas resolution (800x600)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 }
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
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
    // e.preventDefault() // prevent scroll on touch devices
    
    isDrawingRef.current = true
    const pos = getCoordinates(e)
    lastPosRef.current = pos
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !isDrawer || stage !== 'DRAWING') return
    if ('touches' in e) {
      e.preventDefault() // prevent scrolling while drawing
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentPos = getCoordinates(e)
    const strokeColor = color
    const strokeWidth = brushSize
    const isEraser = tool === 'eraser'

    // Draw locally
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

    // Emit drawing step immediately to other players
    if (socket) {
      socket.emit('scribble-draw', { roomCode, drawData })
    }

    lastPosRef.current = currentPos
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current || !isDrawer || stage !== 'DRAWING') return
    isDrawingRef.current = false

    // Periodically sync full lines state to server for reconnects
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

    if (socket) {
      socket.emit('scribble-clear', { roomCode })
      socket.emit('submit-move', { roomCode, move: { type: 'clear' } })
    }
  }

  // 4. Pre-game Settings form
  const handleStartMatchWithSettings = (timerVal: number) => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'settings', timerDuration: timerVal } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Setup Error', res.error)
      }
    })
  }

  // 5. Word Selection action
  const handleSelectWord = (word: string) => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'select-word', word } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Select Word Error', res.error)
      }
    })
  }

  // 6. Submit Guess
  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!socket || !guess.trim() || isSubmitting || hasGuessed || isDrawer) return

    setIsSubmitting(true)
    socket.emit('submit-move', { roomCode, move: { type: 'guess', guess: guess.trim() } }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Guess Error', res.error)
      } else {
        setGuess('')
      }
    })
  }

  // Play again votes
  const handlePlayAgain = () => {
    if (!socket) return
    setIsSubmitting(true)
    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Replay Error', res.error)
      } else {
        addToast('success', 'Vote Registered', 'Waiting for others to accept.')
      }
    })
  }

  const getUsername = (uid: string) => {
    return players.find(p => p.userId === uid)?.username || 'Opponent'
  }

  // 7. Timer Remaining Calculations
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

  // Colors Palette
  const colors = [
    '#ffffff', '#000000', '#ef4444', '#22c55e', '#3b82f6', 
    '#eab308', '#f97316', '#a855f7', '#ec4899', '#06b6d4'
  ]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      
      {/* Header Bar */}
      <MultiplayerHeader
        players={players}
        currentUserId={currentUserId}
        currentTurn={drawerId}
        turnExpiration={null} // custom timer used
        scores={playerScores}
        gameFinished={stage === 'FINISHED'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '1rem', width: '100%' }} className="scribble-layout-grid">
        
        {/* Left Column: Canvas & Control Screens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          {/* Main Visual Board */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            background: '#0a0b0d',
            borderRadius: 16,
            border: '1px solid hsl(var(--border-subtle))',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            
            {/* HTML5 drawing canvas */}
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
                width: '100%',
                height: '100%',
                display: stage === 'DRAWING' ? 'block' : 'none',
                cursor: isDrawer && stage === 'DRAWING' ? 'crosshair' : 'default',
                touchAction: 'none' // prevent browser swipe scroll gestures
              }}
            />

            {/* STAGE: LOBBY_SETTINGS Overlay */}
            {stage === 'LOBBY_SETTINGS' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10 }}>
                <span style={{ fontSize: '3rem' }}>🎨</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '0.5rem', marginBottom: '1rem' }}>Pre-game Match Settings</h3>
                {currentUserId === gameState.hostUserId ? (
                  <div>
                    <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Choose the round drawing time for the entire match.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      {[30, 45, 60].map(time => (
                        <button
                          key={time}
                          className="btn btn-primary"
                          onClick={() => handleStartMatchWithSettings(time)}
                          style={{ minWidth: 80, borderRadius: 10 }}
                        >
                          ⏱ {time}s
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
                      Waiting for the host ({getUsername(gameState.hostUserId)}) to select round duration...
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STAGE: WORD_SELECTION Overlay */}
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
                        <button
                          key={word}
                          className="btn btn-primary"
                          onClick={() => handleSelectWord(word)}
                          style={{ padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 700 }}
                        >
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
                      ⏳ Choice timer: {timerRemaining}s
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STAGE: ROUND_SUMMARY Overlay */}
            {stage === 'ROUND_SUMMARY' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10, background: 'rgba(10,11,13,0.95)', position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '3.5rem' }}>🏁</span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginTop: '0.5rem', color: 'hsl(var(--brand-secondary))' }}>
                  Round Over!
                </h3>
                <p style={{ fontSize: '1.1rem', color: 'white', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                  The word was: <strong style={{ textTransform: 'uppercase', color: 'hsl(var(--success))', fontSize: '1.25rem' }}>{selectedWord}</strong>
                </p>

                <div className="glass" style={{ maxWidth: 400, margin: '0 auto', padding: '1rem', borderRadius: 12, width: '100%' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                    Round Standings
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {players.map(p => {
                      const pts = roundScores[p.userId] || 0
                      const guessed = guessedPlayers.includes(p.userId)
                      const isDr = p.userId === drawerId
                      return (
                        <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span>
                            {isDr ? '🎨 ' : guessed ? '✅ ' : '❌ '} {p.username}
                          </span>
                          <span style={{ color: pts > 0 ? 'hsl(var(--success))' : 'white', fontWeight: 700 }}>
                            +{pts} pts
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', marginTop: '1rem' }}>
                  Next round starts in {timerRemaining}s...
                </p>
              </div>
            )}

            {/* STAGE: FINISHED Overlay */}
            {stage === 'FINISHED' && (
              <div style={{ padding: '2rem', textAlign: 'center', zIndex: 10, background: 'rgba(10,11,13,0.95)', position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '4rem' }}>🏆</span>
                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, marginTop: '0.5rem' }}>Match Finished!</h3>
                <p style={{ color: 'hsl(var(--text-secondary))', marginBottom: '1.5rem' }}>
                  Thanks for playing Scribble! Here are the final scores:
                </p>

                <div className="glass" style={{ maxWidth: 400, margin: '0 auto 1.5rem', padding: '1.25rem', borderRadius: 16, width: '100%' }}>
                  {players
                    .sort((a, b) => (playerScores[b.userId] || 0) - (playerScores[a.userId] || 0))
                    .map((p, idx) => (
                      <div key={p.userId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: idx < players.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', fontSize: '0.9rem' }}>
                        <span>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'} {p.username}
                        </span>
                        <strong style={{ color: 'hsl(var(--brand-primary))' }}>{playerScores[p.userId] || 0} pts</strong>
                      </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', maxWidth: 400, margin: '0 auto', width: '100%' }}>
                  <button className="btn btn-secondary" onClick={onLeave} style={{ flex: 1, borderRadius: 12 }}>
                    🚪 Leave Room
                  </button>
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

          {/* Canvas Tools Toolbar (Only shown for Drawer during Drawing) */}
          {stage === 'DRAWING' && isDrawer && (
            <div className="card glass" style={{
              padding: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              borderRadius: 12
            }}>
              {/* Brush Tools */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => setTool('pencil')}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.75rem',
                    minWidth: 'auto',
                    backgroundColor: tool === 'pencil' ? 'hsl(var(--brand-primary) / 0.2)' : 'transparent',
                    border: tool === 'pencil' ? '1px solid hsl(var(--brand-primary))' : '1px solid transparent',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}
                >
                  ✏️ Pencil
                </button>
                <button
                  onClick={() => setTool('eraser')}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.75rem',
                    minWidth: 'auto',
                    backgroundColor: tool === 'eraser' ? 'hsl(var(--brand-primary) / 0.2)' : 'transparent',
                    border: tool === 'eraser' ? '1px solid hsl(var(--brand-primary))' : '1px solid transparent',
                    color: 'white',
                    fontSize: '0.8rem'
                  }}
                >
                  🧽 Eraser
                </button>
              </div>

              {/* Brush Size */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Size:</span>
                {[3, 6, 12, 20].map(sz => (
                  <button
                    key={sz}
                    onClick={() => setBrushSize(sz)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      border: brushSize === sz ? '2px solid white' : '1px solid transparent',
                      background: 'hsl(220 20% 18%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ width: sz / 2 + 2, height: sz / 2 + 2, borderRadius: '50%', background: 'white' }} />
                  </button>
                ))}
              </div>

              {/* Color Palette */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {colors.map(col => (
                  <button
                    key={col}
                    onClick={() => { setColor(col); setTool('pencil'); }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: color === col && tool === 'pencil' ? '2px solid white' : '1px solid rgba(255,255,255,0.1)',
                      background: col,
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>

              {/* Clear Canvas */}
              <button
                className="btn"
                onClick={clearCanvas}
                style={{
                  padding: '0.4rem 0.75rem',
                  minWidth: 'auto',
                  border: '1px solid hsl(var(--danger) / 0.3)',
                  color: 'hsl(var(--danger))',
                  fontSize: '0.8rem',
                  backgroundColor: 'transparent'
                }}
              >
                🗑️ Clear
              </button>
            </div>
          )}

          {/* Hint system strip for spectators, target label for drawer */}
          {stage === 'DRAWING' && (
            <div className="card glass text-center" style={{ padding: '0.75rem', borderRadius: 12 }}>
              {isDrawer ? (
                <div style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                  🎨 DRAW THIS WORD: <span style={{ color: 'hsl(var(--success))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{selectedWord}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 700 }}>
                    Guess the Word ({selectedWord ? selectedWord.length : hintString.replace(/ /g, '').length} letters)
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'monospace' }}>
                    {hintString || '...'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Game Stats, Chat log & Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
          
          {/* Game Stats (Round, Timer) */}
          <div className="card glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'hsl(var(--text-muted))' }}>Round:</span>
              <strong style={{ color: 'white' }}>{round} / {maxRounds}</strong>
            </div>
            
            {stage === 'DRAWING' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Timer:</span>
                  <span style={{ color: timerRemaining <= 10 ? 'hsl(var(--danger))' : 'white', fontWeight: 700 }}>
                    ⏱ {timerRemaining}s
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'hsl(220 20% 16%)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(timerRemaining / timerDuration) * 100}%`,
                    background: timerRemaining <= 10 ? 'hsl(var(--danger))' : 'hsl(var(--brand-primary))',
                    transition: 'width 0.5s linear'
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard panel */}
          <div className="card glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: 12 }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', margin: 0 }}>
              Live Scoreboard
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {players
                .sort((a, b) => (playerScores[b.userId] || 0) - (playerScores[a.userId] || 0))
                .map((p, idx) => {
                  const isCurDrawer = p.userId === drawerId
                  const didGuess = guessedPlayers.includes(p.userId)
                  return (
                    <div
                      key={p.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        padding: '4px 6px',
                        borderRadius: 6,
                        backgroundColor: isCurDrawer ? 'hsl(var(--brand-primary) / 0.1)' : didGuess ? 'hsl(var(--success) / 0.08)' : 'transparent'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span>{isCurDrawer ? '🎨' : didGuess ? '✅' : '👤'}</span>
                        <span style={{ fontWeight: p.userId === currentUserId ? 700 : 400 }}>{p.username}</span>
                      </span>
                      <strong>{playerScores[p.userId] || 0}</strong>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Commentary & Guess feed */}
          <div className="card glass" style={{
            padding: '1rem',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            borderRadius: 12,
            minHeight: 200
          }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', margin: 0 }}>
              Guesses & Feed
            </h4>
            
            <div style={{
              flex: 1,
              maxHeight: 240,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '0.4rem',
              fontSize: '0.8rem',
              paddingRight: '4px'
            }}>
              {commentary.map((line: string, idx: number) => {
                const isGuessSuccess = line.startsWith('✅')
                const isMsg = line.startsWith('💬')
                const isWarning = line.startsWith('⚠️') || line.startsWith('⏰')
                
                let col = 'white'
                let fontWt = 400
                if (isGuessSuccess) { col = 'hsl(var(--success))'; fontWt = 700; }
                else if (isMsg) { col = 'hsl(var(--text-secondary))'; }
                else if (isWarning) { col = 'hsl(var(--warning))'; fontWt = 700; }

                return (
                  <div key={idx} style={{ color: col, fontWeight: fontWt, lineHeight: '1.35' }}>
                    {line}
                  </div>
                )
              })}
            </div>

            {/* Guess input box (only shown for spectators who haven't guessed) */}
            {stage === 'DRAWING' && !isDrawer && (
              <form onSubmit={handleGuessSubmit} style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto' }}>
                <input
                  className="input"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  placeholder={hasGuessed ? "Correct! waiting..." : "Type your guess..."}
                  disabled={hasGuessed || isSubmitting}
                  style={{ flex: 1, fontSize: '0.8rem', minHeight: '38px', padding: '0.4rem 0.75rem' }}
                  maxLength={20}
                  id="scribble-guess-input"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={hasGuessed || !guess.trim() || isSubmitting}
                  style={{ minHeight: '38px', padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: 8 }}
                >
                  Go
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Match reactions triggers & floating reactions layer */}
      {session.status === 'PLAYING' && (
        <MatchReactions
          socket={socket}
          roomCode={roomCode}
          currentUserId={currentUserId}
          players={players}
        />
      )}

      {/* Embedded styles */}
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
