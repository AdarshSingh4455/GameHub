'use client'
import { GamepadIcon, PlayIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

type Board = number[][]

export default function Game2048() {
  const { submitGameResult, isLoading } = useGameSession()

  const [board, setBoard] = useState<Board>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ])
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(0)
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'gameover'>('setup')
  const [hasReached2048, setHasReached2048] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize game
  const startGame = () => {
    setScore(0)
    setTimer(0)
    setHasReached2048(false)
    setGameState('playing')

    // Empty board
    const newBoard = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]

    // Add two random tiles
    addRandomTile(newBoard)
    addRandomTile(newBoard)
    setBoard(newBoard)
  }

  // Timer loop
  useEffect(() => {
    if (gameState !== 'playing') return

    timerRef.current = setInterval(() => {
      setTimer((prev) => prev + 1)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameState])

  // Spawn random tile
  const addRandomTile = (currentBoard: Board) => {
    const emptyCells: { r: number; c: number }[] = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCells.push({ r, c })
        }
      }
    }

    if (emptyCells.length > 0) {
      const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)]
      currentBoard[r][c] = Math.random() < 0.9 ? 2 : 4
    }
  }

  // Check if any moves are possible
  const checkGameOver = (currentBoard: Board): boolean => {
    // Check for empty spaces
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) return false
      }
    }

    // Check adjacent matches horizontally and vertically
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = currentBoard[r][c]
        if (r < 3 && val === currentBoard[r + 1][c]) return false
        if (c < 3 && val === currentBoard[r][c + 1]) return false
      }
    }

    return true
  }

  // Slide/Merge direction logics
  const slideRowLeft = (row: number[]): { newRow: number[]; gainedScore: number } => {
    // 1. Filter out zeros
    const filtered = row.filter((val) => val !== 0)
    let gainedScore = 0
    const newRow: number[] = []

    // 2. Merge adjacent identical values
    for (let i = 0; i < filtered.length; i++) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        const mergedVal = filtered[i] * 2
        newRow.push(mergedVal)
        gainedScore += mergedVal
        i++ // skip next element
      } else {
        newRow.push(filtered[i])
      }
    }

    // 3. Pad with zeros
    while (newRow.length < 4) {
      newRow.push(0)
    }

    return { newRow, gainedScore }
  }

  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return

    const currentBoard = board.map((row) => [...row])
    let totalGainedScore = 0
    let moved = false

    if (direction === 'left') {
      for (let r = 0; r < 4; r++) {
        const { newRow, gainedScore } = slideRowLeft(currentBoard[r])
        if (JSON.stringify(currentBoard[r]) !== JSON.stringify(newRow)) {
          moved = true
        }
        currentBoard[r] = newRow
        totalGainedScore += gainedScore
      }
    } else if (direction === 'right') {
      for (let r = 0; r < 4; r++) {
        // Reverse row, slide left, reverse back
        const reversed = [...currentBoard[r]].reverse()
        const { newRow, gainedScore } = slideRowLeft(reversed)
        const finalRow = newRow.reverse()
        if (JSON.stringify(currentBoard[r]) !== JSON.stringify(finalRow)) {
          moved = true
        }
        currentBoard[r] = finalRow
        totalGainedScore += gainedScore
      }
    } else if (direction === 'up') {
      // Rotate column to row, slide left, rotate back
      for (let c = 0; c < 4; c++) {
        const col = [currentBoard[0][c], currentBoard[1][c], currentBoard[2][c], currentBoard[3][c]]
        const { newRow, gainedScore } = slideRowLeft(col)
        
        let colChanged = false
        for (let r = 0; r < 4; r++) {
          if (currentBoard[r][c] !== newRow[r]) {
            colChanged = true
            currentBoard[r][c] = newRow[r]
          }
        }
        if (colChanged) moved = true
        totalGainedScore += gainedScore
      }
    } else if (direction === 'down') {
      for (let c = 0; c < 4; c++) {
        const col = [currentBoard[3][c], currentBoard[2][c], currentBoard[1][c], currentBoard[0][c]]
        const { newRow, gainedScore } = slideRowLeft(col)
        
        let colChanged = false
        // Fill from bottom up
        for (let r = 0; r < 4; r++) {
          const rowIdx = 3 - r
          if (currentBoard[rowIdx][c] !== newRow[r]) {
            colChanged = true
            currentBoard[rowIdx][c] = newRow[r]
          }
        }
        if (colChanged) moved = true
        totalGainedScore += gainedScore
      }
    }

    if (moved) {
      addRandomTile(currentBoard)
      setBoard(currentBoard)
      
      const newScore = score + totalGainedScore
      setScore(newScore)

      // Check for 2048 tile win condition
      let reaches2048 = false
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (currentBoard[r][c] === 2048) reaches2048 = true
        }
      }

      if (reaches2048 && !hasReached2048) {
        setHasReached2048(true)
        // Submit victory, but let user continue playing!
        submitGameResult({
          gameSlug: '2048',
          result: 'win',
          metadata: { score: newScore, timeSpent: timer }
        })
      }

      // Check Game Over
      if (checkGameOver(currentBoard)) {
        setGameState('gameover')
        if (timerRef.current) clearInterval(timerRef.current)
        
        // If not already submitted as a win, submit as loss
        if (!reaches2048 && !hasReached2048) {
          submitGameResult({
            gameSlug: '2048',
            result: 'loss',
            metadata: { score: newScore, timeSpent: timer }
          })
        }
      }
    }
  }

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return

      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault()
        move('up')
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault()
        move('down')
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        move('left')
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        move('right')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, gameState, score, timer])

  // Mobile Touch Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing') return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y

    const threshold = 40 // minimum swipe distance in px

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) move('right')
        else move('left')
      }
    } else {
      // Vertical swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) move('down')
        else move('up')
      }
    }
    touchStartRef.current = null
  }

  // Map tile values to premium GameHub colors
  const getTileColors = (value: number) => {
    const colors: Record<number, { bg: string; color: string; border: string; glow?: string }> = {
      2: { bg: 'hsl(220 20% 18%)', color: 'hsl(220 15% 92%)', border: 'hsl(220 15% 24%)' },
      4: { bg: 'hsl(220 20% 24%)', color: 'hsl(220 15% 95%)', border: 'hsl(220 15% 30%)' },
      8: { bg: 'hsl(220 100% 60% / 0.15)', color: 'hsl(220 100% 70%)', border: 'hsl(220 100% 60% / 0.4)' },
      16: { bg: 'hsl(220 100% 60% / 0.3)', color: 'hsl(220 100% 80%)', border: 'hsl(220 100% 60% / 0.6)' },
      32: { bg: 'hsl(270 80% 60% / 0.2)', color: 'hsl(270 80% 70%)', border: 'hsl(270 80% 60% / 0.4)' },
      64: { bg: 'hsl(270 80% 60% / 0.4)', color: 'hsl(270 80% 80%)', border: 'hsl(270 80% 60% / 0.6)' },
      128: { bg: 'hsl(45 100% 55% / 0.15)', color: 'hsl(45 100% 65%)', border: 'hsl(45 100% 55% / 0.4)' },
      256: { bg: 'hsl(45 100% 55% / 0.3)', color: 'hsl(45 100% 75%)', border: 'hsl(45 100% 55% / 0.6)', glow: '0 0 10px hsl(45 100% 55% / 0.3)' },
      512: { bg: 'hsl(45 100% 55% / 0.45)', color: 'hsl(45 100% 85%)', border: 'hsl(45 100% 55% / 0.7)', glow: '0 0 15px hsl(45 100% 55% / 0.5)' },
      1024: { bg: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 50%))', color: 'hsl(20 100% 8%)', border: 'hsl(45 100% 60%)', glow: '0 0 20px hsl(45 100% 55% / 0.6)' },
      2048: { bg: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(270 80% 60%))', color: 'white', border: 'hsl(45 100% 60%)', glow: '0 0 25px hsl(270 80% 60% / 0.8)' },
    }

    // Default for higher than 2048
    if (value > 2048) {
      return {
        bg: 'linear-gradient(135deg, hsl(270 80% 60%), hsl(220 100% 60%))',
        color: 'white',
        border: 'hsl(270 80% 70%)',
        glow: '0 0 30px hsl(220 100% 60% / 0.8)',
      }
    }

    return colors[value] || { bg: 'hsl(222 18% 12%)', color: 'transparent', border: 'hsl(222 18% 12%)' }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (gameState === 'setup') {
    return (
      <div className="card glass" style={{ padding: '2.5rem', textAlign: 'center', margin: '0 auto', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><GamepadIcon size={48} className="text-blue-400" /></div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>2048</h2>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          Slide tiles and merge matching numbers to reach 2048! Can you build the ultimate tile?
        </p>

        <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={startGame} style={{ width: '100%' }}>
          <PlayIcon size={14} className="inline mr-1" /> Play Game
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
      {/* Gameplay HUD */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'hsl(220 20% 7%)',
          padding: '0.75rem 1.25rem',
          borderRadius: 16,
          border: '1px solid hsl(220 20% 14%)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Score</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{score}</div>
        </div>

        {hasReached2048 && (
          <div style={{ background: 'hsl(45 100% 55% / 0.15)', border: '1px solid hsl(45 100% 55% / 0.3)', color: 'hsl(45 100% 60%)', padding: '0.2rem 0.6rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800 }}>
            🏆 2048 Reached!
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Lives</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
              1
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Timer</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
              {formatTime(timer)}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="card glass"
        style={{
          padding: '1rem',
          background: 'hsl(222 18% 12%)',
          border: '1px solid hsl(220 15% 20%)',
          borderRadius: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 'clamp(6px, 2vw, 12px)',
          aspectRatio: '1',
          maxWidth: '450px',
          margin: '0 auto',
          width: '100%',
          touchAction: 'none', // Disable browser scroll on swipes
        }}
      >
        {board.map((row, rIdx) =>
          row.map((val, cIdx) => {
            const tileStyle = getTileColors(val)
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={val > 0 ? 'animate-slideUp' : ''}
                style={{
                  background: val > 0 ? tileStyle.bg : 'hsl(222 20% 7%)',
                  border: val > 0 ? `1px solid ${tileStyle.border}` : '1px solid hsl(222 20% 10%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: val > 1000 ? 'clamp(1rem, 4vw, 1.4rem)' : 'clamp(1.2rem, 5vw, 1.8rem)',
                  fontWeight: 800,
                  color: tileStyle.color,
                  boxShadow: tileStyle.glow || 'none',
                  transition: 'all 0.15s ease',
                  aspectRatio: '1',
                  userSelect: 'none',
                }}
              >
                {val > 0 ? val : ''}
              </div>
            )
          })
        )}
      </div>

      {/* Footer controls */}
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current)
            setGameState('setup')
          }}
          disabled={isLoading}
        >
          🏳️ Reset Game
        </button>
      </div>
    </div>
  )
}
