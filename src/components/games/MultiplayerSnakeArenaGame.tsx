'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import MatchReactions from './MatchReactions'
import GameIcon from './GameIcon'
import type { Position, SnakePlayer, FoodItem, PowerupItem, SnakeArenaState } from '@/lib/snakeArenaTypes'

interface MultiplayerSnakeArenaGameProps {
  session: {
    roomCode: string
    status: string
    winnerId: string | null
    gameState: SnakeArenaState
  }
  players: any[]
  currentUserId: string
}

// Audio Synthesis Helpers
function playSynthSound(type: 'countdown' | 'food' | 'golden' | 'powerup' | 'death' | 'victory' | 'start') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    if (type === 'countdown') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'start') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    } else if (type === 'food') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.12)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (type === 'golden') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.2)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    } else if (type === 'powerup') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.linearRampToValueAtTime(900, now + 0.25)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'death') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.linearRampToValueAtTime(100, now + 0.4)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.4)
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.50] // C E G C
      notes.forEach((freq, idx) => {
        const noteOsc = ctx.createOscillator()
        const noteGain = ctx.createGain()
        noteOsc.connect(noteGain)
        noteGain.connect(ctx.destination)
        noteOsc.type = 'sine'
        noteOsc.frequency.setValueAtTime(freq, now + idx * 0.1)
        noteGain.gain.setValueAtTime(0.1, now + idx * 0.1)
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.15)
        noteOsc.start(now + idx * 0.1)
        noteOsc.stop(now + idx * 0.1 + 0.15)
      })
    }
  } catch (e) {
    console.error('Audio Synthesis Error:', e)
  }
}

export default function MultiplayerSnakeArenaGame({ session, players, currentUserId }: MultiplayerSnakeArenaGameProps) {
  const { socket } = useSocket()
  const { addToast } = useToast()

  const roomCode = session.roomCode
  const gameState = session.gameState || {}
  const { cols = 60, rows = 40, snakes = {}, foods = [], powerups = [], mapTheme = 'classic' } = gameState

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(true)

  // Spectator focus states
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastTickTimeRef = useRef<number>(Date.now())
  const prevBoardStateRef = useRef<SnakeArenaState | null>(null)
  const playerDirRef = useRef<Position>({ x: 1, y: 0 })

  // Touch swipe helper refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Check state update differences to play audio effects
  useEffect(() => {
    if (!gameState) return
    const prev = prevBoardStateRef.current
    if (prev) {
      // Check if food counts dropped (eaten)
      if (foods.length !== prev.foods.length) {
        // Find if local player ate
        const curScore = snakes[currentUserId]?.score || 0
        const prevScore = prev.snakes[currentUserId]?.score || 0
        if (curScore > prevScore) {
          const diff = curScore - prevScore
          playSynthSound(diff >= 30 ? 'golden' : 'food')
        }
      }

      // Check if local player died
      const curStatus = snakes[currentUserId]?.status
      const prevStatus = prev.snakes[currentUserId]?.status
      if (curStatus === 'ELIMINATED' && prevStatus === 'ACTIVE') {
        playSynthSound('death')
      }
    }
    prevBoardStateRef.current = gameState
    lastTickTimeRef.current = Date.now()
  }, [gameState, foods, snakes, currentUserId])

  // Keyboard steer keys listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (session.status !== 'PLAYING') return
      
      const key = e.key.toLowerCase()
      let dir: Position | null = null

      if (key === 'arrowup' || key === 'w') dir = { x: 0, y: -1 }
      else if (key === 'arrowdown' || key === 's') dir = { x: 0, y: 1 }
      else if (key === 'arrowleft' || key === 'a') dir = { x: -1, y: 0 }
      else if (key === 'arrowright' || key === 'd') dir = { x: 1, y: 0 }

      if (dir && socket) {
        const mySnake = snakes[currentUserId]
        if (!mySnake || mySnake.status !== 'ACTIVE') return

        const currentDir = mySnake.direction
        const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
        
        if (!isOpposite && (dir.x !== currentDir.x || dir.y !== currentDir.y)) {
          playerDirRef.current = dir
          socket.emit('snake-steer', { roomCode, direction: dir })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [session.status, snakes, currentUserId, socket, roomCode])

  // Auto-focus camera on survivors when eliminated
  useEffect(() => {
    const mySnake = snakes[currentUserId]
    if (mySnake && mySnake.status === 'ELIMINATED' && !spectateTargetId) {
      // Find first survivor bot or other player
      const survivor = Object.values(snakes).find(s => s.status === 'ACTIVE')
      if (survivor) {
        setSpectateTargetId(survivor.userId)
      }
    }
  }, [snakes, currentUserId, spectateTargetId])

  // Canvas interpolation rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animFrame: number

    const render = () => {
      const width = canvas.width
      const height = canvas.height
      const cellWidth = width / cols
      const cellHeight = height / rows

      // Clear canvas with themes
      ctx.fillStyle = mapTheme === 'ice' ? 'hsl(200 40% 6%)' : mapTheme === 'lava' ? 'hsl(10 30% 5%)' : 'hsl(222 25% 6%)'
      ctx.fillRect(0, 0, width, height)

      // Draw Grid lines
      ctx.strokeStyle = mapTheme === 'ice' ? 'rgba(100,200,255,0.04)' : mapTheme === 'lava' ? 'rgba(255,100,50,0.04)' : 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(c * cellWidth, 0)
        ctx.lineTo(c * cellWidth, height)
        ctx.stroke()
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath()
        ctx.moveTo(0, r * cellHeight)
        ctx.lineTo(width, r * cellHeight)
        ctx.stroke()
      }

      // Progress factor calculation
      const progress = Math.min(1, (Date.now() - lastTickTimeRef.current) / 100)

      // Pan camera if spectating or centering local player
      ctx.save()
      const focusUserId = spectateTargetId || currentUserId
      const focusSnake = snakes[focusUserId]
      
      if (focusSnake && focusSnake.body.length > 0 && focusSnake.status === 'ACTIVE') {
        const head = focusSnake.body[0]
        const dir = focusSnake.direction
        const renderHeadX = head.x - dir.x * (1 - progress)
        const renderHeadY = head.y - dir.y * (1 - progress)
        
        // Translate grid to center focused head in viewport
        const camX = width / 2 - (renderHeadX + 0.5) * cellWidth
        const camY = height / 2 - (renderHeadY + 0.5) * cellHeight
        ctx.translate(camX, camY)
      }

      // 1. Draw Food
      for (const food of foods) {
        ctx.beginPath()
        let pulse = 1 + Math.sin(Date.now() / 150) * 0.15
        let radius = (cellWidth / 2.2) * pulse
        let color = '#10b981'

        if (food.type === 'golden') {
          color = '#fbbf24'
          ctx.shadowBlur = 15
          ctx.shadowColor = '#fbbf24'
        } else if (food.type === 'giant') {
          color = '#f97316'
          radius = (cellWidth / 1.5) * pulse
          ctx.shadowBlur = 12
          ctx.shadowColor = '#f97316'
        } else if (food.type === 'dead') {
          color = '#ef4444'
          radius = cellWidth / 3.5
        }

        ctx.fillStyle = color
        ctx.arc((food.x + 0.5) * cellWidth, (food.y + 0.5) * cellHeight, radius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // 2. Draw Powerups
      for (const powerup of powerups) {
        const x = (powerup.x + 0.5) * cellWidth
        const y = (powerup.y + 0.5) * cellHeight
        const pulse = 1 + Math.sin(Date.now() / 120) * 0.12
        const radius = (cellWidth / 1.6) * pulse

        ctx.shadowBlur = 14
        ctx.shadowColor = '#8b5cf6'
        ctx.fillStyle = 'rgba(139, 92, 246, 0.25)'
        ctx.strokeStyle = '#8b5cf6'
        ctx.lineWidth = 2

        ctx.beginPath()
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${cellHeight * 0.8}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const letter = powerup.type.substring(0, 1).toUpperCase()
        ctx.fillText(letter, x, y)
      }

      // 3. Draw Snakes
      for (const sId in snakes) {
        const snake = snakes[sId]
        if (snake.status !== 'ACTIVE' || snake.body.length === 0) continue

        const isProtected = snake.spawnProtectedUntil > Date.now()
        if (isProtected && Math.floor(Date.now() / 100) % 2 === 0) continue

        ctx.lineWidth = cellWidth * 0.8
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = snake.color
        
        ctx.shadowBlur = 8
        ctx.shadowColor = snake.color

        ctx.beginPath()
        const head = snake.body[0]
        const dir = snake.direction
        const renderHeadX = head.x - dir.x * (1 - progress)
        const renderHeadY = head.y - dir.y * (1 - progress)
        ctx.moveTo((renderHeadX + 0.5) * cellWidth, (renderHeadY + 0.5) * cellHeight)

        for (let i = 0; i < snake.body.length; i++) {
          const seg = snake.body[i]
          ctx.lineTo((seg.x + 0.5) * cellWidth, (seg.y + 0.5) * cellHeight)
        }
        ctx.stroke()

        // Draw eyes
        ctx.shadowBlur = 0
        ctx.fillStyle = '#ffffff'
        const eyeRadius = cellWidth * 0.15
        const eyeOffset = cellWidth * 0.25
        const headX = (renderHeadX + 0.5) * cellWidth
        const headY = (renderHeadY + 0.5) * cellHeight

        ctx.beginPath()
        ctx.arc(headX - eyeOffset * dir.y, headY - eyeOffset * dir.x, eyeRadius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(headX + eyeOffset * dir.y, headY + eyeOffset * dir.x, eyeRadius, 0, 2 * Math.PI)
        ctx.fill()

        const hasShield = snake.activePowerups.some(p => p.type === 'shield')
        if (hasShield) {
          ctx.strokeStyle = 'hsl(200 100% 60% / 0.5)'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(headX, headY, cellWidth * 1.5, 0, 2 * Math.PI)
          ctx.stroke()
        }
      }

      ctx.restore()
      animFrame = requestAnimationFrame(render)
    }

    animFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animFrame)
  }, [gameState, spectateTargetId, currentUserId])

  // Touch swipes controls for mobile multiplayer steering
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || session.status !== 'PLAYING') return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    if (Math.max(absX, absY) < 30) return

    let dir: Position | null = null
    if (absX > absY) {
      dir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 }
    } else {
      dir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }
    }

    if (dir && socket) {
      const mySnake = snakes[currentUserId]
      if (!mySnake || mySnake.status !== 'ACTIVE') return

      const currentDir = mySnake.direction
      const isOpposite = (dir.x !== 0 && dir.x === -currentDir.x) || (dir.y !== 0 && dir.y === -currentDir.y)
      
      if (!isOpposite && (dir.x !== currentDir.x || dir.y !== currentDir.y)) {
        playerDirRef.current = dir
        socket.emit('snake-steer', { roomCode, direction: dir })
      }
    }
    touchStartRef.current = null
  }

  const handlePlayAgain = () => {
    if (!socket || isSubmitting) return
    setIsSubmitting(true)

    socket.emit('vote-replay', { roomCode }, (res: any) => {
      setIsSubmitting(false)
      if (res?.error) {
        addToast('error', 'Replay Error', res.error)
      }
    })
  }

  const mySnake = snakes[currentUserId]
  const isSpectating = mySnake?.status === 'ELIMINATED'

  const leaderboard = Object.values(snakes).sort((a, b) => b.score - a.score)
  const survivors = leaderboard.filter(s => s.status === 'ACTIVE')

  const cycleSpectatorTarget = (direction: 'next' | 'prev') => {
    if (survivors.length === 0) return
    const idx = survivors.findIndex(s => s.userId === spectateTargetId)
    let nextIdx = 0
    if (direction === 'next') {
      nextIdx = (idx + 1) % survivors.length
    } else {
      nextIdx = (idx - 1 + survivors.length) % survivors.length
    }
    setSpectateTargetId(survivors[nextIdx].userId)
  }

  return (
    <div className="snake-arena-container">
      {session.status === 'PLAYING' && (
        <div className="arena-layout">
          {/* HUD Metric Dashboard */}
          <div className="hud-panel">
            <div className="hud-metric">
              <span className="metric-label">Status</span>
              <span className={`metric-value ${isSpectating ? 'text-red' : 'text-green'}`}>
                {isSpectating ? '👀 SPECTATING' : '🎮 ALIVE'}
              </span>
            </div>
            <div className="hud-metric">
              <span className="metric-label">Rank</span>
              <span className="metric-value">#{leaderboard.findIndex(s => s.userId === currentUserId) + 1}</span>
            </div>
            <div className="hud-metric">
              <span className="metric-label">Score</span>
              <span className="metric-value">{mySnake?.score || 0}</span>
            </div>
            <div className="hud-metric">
              <span className="metric-label">Remaining Players</span>
              <span className="metric-value">{survivors.length} / {leaderboard.length}</span>
            </div>
            
            {isSpectating && (
              <div className="hud-metric" style={{ marginTop: '1rem' }}>
                <span className="metric-label">Spectating</span>
                <span className="metric-value" style={{ fontSize: '1rem' }}>
                  {snakes[spectateTargetId || '']?.username || 'None'}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn-diff" onClick={() => cycleSpectatorTarget('prev')} style={{ padding: '0.4rem' }}>◀ Prev</button>
                  <button className="btn-diff" onClick={() => cycleSpectatorTarget('next')} style={{ padding: '0.4rem' }}>Next ▶</button>
                </div>
              </div>
            )}
          </div>

          {/* Core Arena canvas */}
          <div className="arena-grid-wrapper">
            <div
              className="canvas-container"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <canvas
                ref={canvasRef}
                width={720}
                height={480}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  border: '2px solid hsl(220 20% 18%)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
                }}
              />
            </div>
            <p className="mobile-controls-tip">💡 Swipe on the screen to change direction.</p>
            <MatchReactions
              socket={socket}
              roomCode={roomCode}
              currentUserId={currentUserId}
              players={players}
            />
          </div>

          {/* Collapsible live leaderboard */}
          <div className="leaderboard-panel">
            <div className="leaderboard-header" onClick={() => setShowLeaderboard(!showLeaderboard)}>
              <h3>🏆 Standings</h3>
              <span className="collapsible-arrow">{showLeaderboard ? '▼' : '▲'}</span>
            </div>

            {showLeaderboard && (
              <div className="leaderboard-list">
                {leaderboard.map((s, idx) => (
                  <div
                    key={s.userId}
                    className={`leaderboard-item ${s.userId === currentUserId ? 'highlight' : ''}`}
                    style={{ borderLeft: `4px solid ${s.color}` }}
                  >
                    <span className="player-rank">#{idx + 1}</span>
                    <span className="player-name">{s.username}</span>
                    <span className="player-score">{s.score} pts</span>
                    {s.status === 'ELIMINATED' && <span className="dead-tag">DEAD</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {session.status === 'FINISHED' && (
        <div className="lobby-actions-overlay">
          <div className="actions-card animate-scaleUp">
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '1rem' }}>
              {session.winnerId === currentUserId ? '🏆 Victory!' : '💀 Match Over'}
            </h3>
            <div className="summary-grid">
              <div>
                <span className="summary-label">Your Score</span>
                <span className="summary-val">{mySnake?.score || 0}</span>
              </div>
              <div>
                <span className="summary-label">Longest Length</span>
                <span className="summary-val">{mySnake?.length || 3}</span>
              </div>
              <div>
                <span className="summary-label">Eliminations</span>
                <span className="summary-val">{mySnake?.eliminations || 0}</span>
              </div>
            </div>

            <div className="rematch-votes" style={{ marginTop: '1.5rem', color: 'hsl(220 10% 60%)', fontSize: '0.85rem' }}>
              Replay votes: {Object.keys(session.gameState?.replayVotes || {}).length} / {players.length}
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '2rem' }}
              onClick={handlePlayAgain}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Vote Rematch'}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .snake-arena-container {
          width: 100%;
          min-height: calc(100vh - 120px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .arena-layout {
          display: grid;
          grid-template-columns: 240px 1fr 280px;
          gap: 1.5rem;
          width: 100%;
          max-width: 1300px;
          align-items: start;
        }

        .hud-panel {
          background: linear-gradient(135deg, hsl(222 22% 8% / 0.7), hsl(222 18% 10% / 0.7));
          border: 1px solid hsl(220 20% 15%);
          border-radius: 16px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .hud-metric {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .metric-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: hsl(220 10% 50%);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
        }

        .metric-value.text-green {
          color: #10b981;
        }

        .metric-value.text-red {
          color: #ef4444;
        }

        .arena-grid-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .canvas-container {
          position: relative;
          width: 100%;
        }

        .mobile-controls-tip {
          display: none;
          font-size: 0.78rem;
          color: hsl(220 10% 50%);
          margin-top: 0.25rem;
        }

        .leaderboard-panel {
          background: linear-gradient(135deg, hsl(222 22% 8% / 0.7), hsl(222 18% 10% / 0.7));
          border: 1px solid hsl(220 20% 15%);
          border-radius: 16px;
          padding: 1.25rem 1rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .leaderboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 800;
          color: #ffffff;
        }

        .collapsible-arrow {
          display: none;
          font-size: 0.8rem;
          color: hsl(220 10% 50%);
        }

        .leaderboard-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .leaderboard-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.65rem 0.75rem;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
          font-size: 0.8rem;
          color: hsl(220 10% 80%);
        }

        .leaderboard-item.highlight {
          background: hsl(220 100% 65% / 0.08);
          color: #ffffff;
          font-weight: 700;
        }

        .dead-tag {
          font-size: 0.6rem;
          font-weight: 800;
          color: hsl(355 85% 55%);
          background: hsl(355 85% 55% / 0.12);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
        }

        .lobby-actions-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 1rem;
        }

        .actions-card {
          width: 100%;
          max-width: 400px;
          background: hsl(222 25% 8%);
          border: 2px solid hsl(220 20% 18%);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 1.5rem;
        }

        .summary-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          color: hsl(220 10% 50%);
          text-transform: uppercase;
        }

        .summary-val {
          display: block;
          font-size: 1.25rem;
          font-weight: 800;
          color: #ffffff;
          margin-top: 0.25rem;
        }

        .btn-diff {
          background: hsl(220 20% 12%);
          border: 1px solid hsl(220 15% 18%);
          color: hsl(220 10% 70%);
          padding: 0.4rem;
          border-radius: 6px;
          font-weight: 700;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-diff:hover {
          border-color: hsl(220 100% 65% / 0.3);
          color: white;
        }

        @media (max-width: 1024px) {
          .arena-layout {
            grid-template-columns: 1fr;
          }
          .mobile-controls-tip {
            display: block;
          }
          .collapsible-arrow {
            display: block;
            cursor: pointer;
          }
        }
      `}</style>
    </div>
  )
}
