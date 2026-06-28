'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getFourInARowMove } from '@/lib/gameAI'

type Player = 'X' | 'O' // X = Red (Player), O = Yellow (AI/Player 2)
type BoardState = (Player | null)[]
type GameMode = 'vs-ai' | 'local-pvp'
type Difficulty = 'easy' | 'moderate' | 'hard'

const ROWS = 6
const COLS = 7

// Web Audio API Synthesis Helper
function playSynthSound(type: 'click' | 'drop' | 'win' | 'draw' | 'rematch') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    if (type === 'click') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'drop') {
      // Sloped pitch drop
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(350, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'win') {
      // Arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25] // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const oscNode = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscNode.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscNode.type = 'sine'
        oscNode.frequency.setValueAtTime(freq, now + idx * 0.1)
        gainNode.gain.setValueAtTime(0.2, now + idx * 0.1)
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.25)

        oscNode.start(now + idx * 0.1)
        oscNode.stop(now + idx * 0.1 + 0.3)
      })
    } else if (type === 'draw') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, now)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      osc.start(now)
      osc.stop(now + 0.45)
    } else if (type === 'rematch') {
      // Rising chime
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch (err) {
    console.warn('[AUDIO SYNTH FAILED]', err)
  }
}

function checkWinner(board: BoardState): { winner: Player; line: number[] } | null {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const i1 = r * COLS + c
      const i2 = r * COLS + c + 1
      const i3 = r * COLS + c + 2
      const i4 = r * COLS + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as Player, line: [i1, i2, i3, i4] }
      }
    }
  }
  // Vertical
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS; c++) {
      const i1 = r * COLS + c
      const i2 = (r + 1) * COLS + c
      const i3 = (r + 2) * COLS + c
      const i4 = (r + 3) * COLS + c
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as Player, line: [i1, i2, i3, i4] }
      }
    }
  }
  // Diagonal Down-Right
  for (let r = 0; r < ROWS - 3; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const i1 = r * COLS + c
      const i2 = (r + 1) * COLS + c + 1
      const i3 = (r + 2) * COLS + c + 2
      const i4 = (r + 3) * COLS + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as Player, line: [i1, i2, i3, i4] }
      }
    }
  }
  // Diagonal Up-Right
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c < COLS - 3; c++) {
      const i1 = r * COLS + c
      const i2 = (r - 1) * COLS + c + 1
      const i3 = (r - 2) * COLS + c + 2
      const i4 = (r - 3) * COLS + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as Player, line: [i1, i2, i3, i4] }
      }
    }
  }
  return null
}

export default function FourInARowGame() {
  const { submitGameResult } = useGameSession()

  const [mode, setMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate')
  const [board, setBoard] = useState<BoardState>(Array(42).fill(null))
  const [turn, setTurn] = useState<Player>('X') // 'X' = Player 1/Red, 'O' = AI/Player 2/Yellow
  const [winnerInfo, setWinnerInfo] = useState<{ winner: Player | 'DRAW'; line?: number[] } | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const [isRanked, setIsRanked] = useState(false)
  const [opponentName, setOpponentName] = useState('ApexBot')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'ranked') {
        setIsRanked(true)
        setMode('vs-ai')
        setDifficulty('hard')
        if (params.get('opponent')) {
          setOpponentName(params.get('opponent')!)
        }
      }
    }
  }, [])

  // Track match start time for duration analytics
  const startTimeRef = useRef<number>(Date.now())

  // Reset helper
  const handleReset = (isRematchVote = false) => {
    setBoard(Array(42).fill(null))
    setTurn('X')
    setWinnerInfo(null)
    setIsAiThinking(false)
    setLastMoveIndex(null)
    setHoverCol(null)
    startTimeRef.current = Date.now()
    playSynthSound(isRematchVote ? 'rematch' : 'click')
  }

  // Effect to listen to replay requests from global gamehub resets
  useEffect(() => {
    const handleReplayEvent = () => handleReset(true)
    window.addEventListener('gamehub_replay', handleReplayEvent)
    return () => window.removeEventListener('gamehub_replay', handleReplayEvent)
  }, [])

  // Find lowest empty row in col
  const getLowestRowInCol = (col: number, currentBoard: BoardState = board): number => {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (currentBoard[r * COLS + col] === null) return r
    }
    return -1
  }

  // Handle disk drop in column
  const dropDisc = (col: number) => {
    if (winnerInfo || isAiThinking) return
    const row = getLowestRowInCol(col)
    if (row === -1) return // Column is full

    const idx = row * COLS + col
    const nextBoard = [...board]
    nextBoard[idx] = turn
    setBoard(nextBoard)
    setLastMoveIndex(idx)
    playSynthSound('drop')

    // Evaluate result
    const checkWin = checkWinner(nextBoard)
    if (checkWin) {
      setWinnerInfo({ winner: checkWin.winner, line: checkWin.line })
      playSynthSound('win')
      handleMatchFinish(checkWin.winner, nextBoard)
    } else if (nextBoard.every(cell => cell !== null)) {
      setWinnerInfo({ winner: 'DRAW' })
      playSynthSound('draw')
      handleMatchFinish('DRAW', nextBoard)
    } else {
      setTurn(turn === 'X' ? 'O' : 'X')
    }
  }

  // AI turn automation
  useEffect(() => {
    if (mode !== 'vs-ai' || turn !== 'O' || winnerInfo || isAiThinking) return

    setIsAiThinking(true)

    // CPU delay for natural feel
    const timer = setTimeout(() => {
      const aiMoveCol = getFourInARowMove(board, difficulty, 'O')
      if (aiMoveCol !== -1) {
        const row = getLowestRowInCol(aiMoveCol)
        const idx = row * COLS + aiMoveCol
        const nextBoard = [...board]
        nextBoard[idx] = 'O'
        setBoard(nextBoard)
        setLastMoveIndex(idx)
        playSynthSound('drop')

        const checkWin = checkWinner(nextBoard)
        if (checkWin) {
          setWinnerInfo({ winner: checkWin.winner, line: checkWin.line })
          playSynthSound('win')
          handleMatchFinish('O', nextBoard)
        } else if (nextBoard.every(cell => cell !== null)) {
          setWinnerInfo({ winner: 'DRAW' })
          playSynthSound('draw')
          handleMatchFinish('DRAW', nextBoard)
        } else {
          setTurn('X')
        }
      }
      setIsAiThinking(false)
    }, 600)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, board, mode, difficulty, winnerInfo])

  // Handles result submission for XP and achievements
  const handleMatchFinish = (resultWinner: Player | 'DRAW', finalBoard: BoardState) => {
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
    let resultOutcome: 'win' | 'loss' | 'draw' = 'draw'

    if (resultWinner !== 'DRAW') {
      if (mode === 'vs-ai') {
        resultOutcome = resultWinner === 'X' ? 'win' : 'loss'
      } else {
        resultOutcome = 'win' // Local PvP wins are treated as wins
      }
    }

    submitGameResult({
      gameSlug: 'four-in-a-row',
      result: resultOutcome,
      metadata: {
        score: resultOutcome === 'win' ? 100 : resultOutcome === 'draw' ? 50 : 10,
        opponentScore: resultOutcome === 'loss' ? 100 : resultOutcome === 'draw' ? 50 : 10,
        durationSecs: duration,
        gameMetadata: {
          mode: isRanked ? 'ranked' : mode,
          difficulty: mode === 'vs-ai' ? difficulty : 'local',
          board: finalBoard,
          duration,
        }
      }
    })

    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultOutcome,
          opponentName: opponentName
        })
      }).catch(err => console.error('Failed to submit ranked stats:', err))
    }
  }

  // Get line SVG coords for the winning overlay
  const getLineCoordinates = () => {
    if (!winnerInfo || !winnerInfo.line) return null
    const [i1, , , i4] = winnerInfo.line

    const r1 = Math.floor(i1 / COLS)
    const c1 = i1 % COLS
    const r2 = Math.floor(i4 / COLS)
    const c2 = i4 % COLS

    // Translate grid positions to percentages for SVG pathing
    const x1 = `${(c1 * 100) / COLS + 50 / COLS}%`
    const y1 = `${(r1 * 100) / ROWS + 50 / ROWS}%`
    const x2 = `${(c2 * 100) / COLS + 50 / COLS}%`
    const y2 = `${(r2 * 100) / ROWS + 50 / ROWS}%`

    return { x1, y1, x2, y2 }
  }

  const lineCoords = getLineCoordinates()

  return (
    <div style={{ maxWidth: 450, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Game Mode Setup Selector */}
      {board.every(cell => cell === null) && !winnerInfo && (
        <div className="card glass text-center" style={{ padding: '0.75rem 1rem', borderRadius: 16 }}>
          {isRanked && (
            <div style={{
              background: 'linear-gradient(90deg, #e11d48, #9f1239)',
              border: '1px solid #f43f5e',
              color: 'white',
              padding: '0.45rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              animation: 'pulse 1.5s infinite'
            }}>
              ⚔️ Competitive Ranked Session
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={() => { playSynthSound('click'); setMode('vs-ai') }}
              className={`btn btn-sm ${mode === 'vs-ai' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 10, flex: 1, cursor: isRanked ? 'not-allowed' : 'pointer' }}
              disabled={isRanked}
            >
              🤖 VS AI
            </button>
            <button
              onClick={() => { playSynthSound('click'); setMode('local-pvp') }}
              className={`btn btn-sm ${mode === 'local-pvp' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 10, flex: 1, cursor: isRanked ? 'not-allowed' : 'pointer' }}
              disabled={isRanked}
            >
              👥 Local PVP
            </button>
          </div>

          {mode === 'vs-ai' && (
            <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-secondary))', fontWeight: 700 }}>Difficulty:</span>
              {(['easy', 'moderate', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => { playSynthSound('click'); setDifficulty(d) }}
                  className={`btn btn-sm`}
                  disabled={isRanked}
                  style={{
                    borderRadius: 8,
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    border: '1px solid',
                    borderColor: difficulty === d ? 'hsl(var(--primary))' : 'transparent',
                    backgroundColor: difficulty === d ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                    color: difficulty === d ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                    cursor: isRanked ? 'not-allowed' : 'pointer'
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Turn HUD Indicator */}
      <div className="card glass text-center" style={{
        padding: '0.6rem 1rem',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}>
        {winnerInfo ? (
          winnerInfo.winner === 'DRAW' ? (
            <span style={{ fontWeight: 800, color: 'hsl(45 90% 55%)' }}>🤝 It&apos;s a Draw!</span>
          ) : (
            <span style={{ fontWeight: 800, color: winnerInfo.winner === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)' }}>
              🏆 {winnerInfo.winner === 'X' ? 'Red' : 'Yellow'} Wins!
            </span>
          )
        ) : (
          <>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: turn === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)',
              boxShadow: `0 0 8px ${turn === 'X' ? 'hsl(355 85% 55% / 0.8)' : 'hsl(45 95% 50% / 0.8)'}`
            }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>
              {turn === 'X'
                ? 'Red Player Turn'
                : mode === 'vs-ai' ? 'CPU is Thinking...' : 'Yellow Player Turn'}
            </span>
          </>
        )}
      </div>

      {/* Interactive Drop Headers */}
      {!winnerInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', padding: '0 0.5rem' }}>
          {Array(7).fill(null).map((_, col) => {
            const isFull = getLowestRowInCol(col) === -1
            const isMyTurn = mode !== 'vs-ai' || turn === 'X'
            return (
              <button
                key={col}
                disabled={isFull || isAiThinking || !isMyTurn}
                onMouseEnter={() => !isFull && setHoverCol(col)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => { setHoverCol(null); dropDisc(col) }}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: hoverCol === col
                    ? (turn === 'X' ? 'hsl(355 85% 55% / 0.2)' : 'hsl(45 95% 50% / 0.2)')
                    : 'hsl(220 20% 12% / 0.4)',
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.9rem',
                  color: hoverCol === col
                    ? (turn === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)')
                    : 'hsl(220 10% 40%)',
                  transition: 'background 0.15s, color 0.15s'
                }}
              >
                ▼
              </button>
            )
          })}
        </div>
      )}

      {/* Main Connect Four Board */}
      <div
        className="card glass"
        style={{
          padding: '0.75rem',
          borderRadius: 24,
          backgroundColor: 'hsl(222 30% 10% / 0.85)',
          border: '1px solid hsl(220 20% 18%)',
          position: 'relative',
          aspectRatio: '7 / 6',
          width: '100%'
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: 'repeat(6, 1fr)',
          gap: '0.4rem',
          height: '100%',
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}>
          {board.map((cell, idx) => {
            const isWinningCell = winnerInfo?.line?.includes(idx)
            const isLastDropped = lastMoveIndex === idx

            return (
              <div
                key={idx}
                style={{
                  borderRadius: '50%',
                  aspectRatio: '1 / 1',
                  background: 'hsl(222 20% 6%)',
                  border: '1px solid hsl(220 15% 15%)',
                  position: 'relative',
                  overflow: 'visible',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.6)'
                }}
              >
                {cell && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '4%',
                      borderRadius: '50%',
                      background: cell === 'X'
                        ? 'radial-gradient(circle at 35% 35%, hsl(355 90% 60%), hsl(355 80% 45%))'
                        : 'radial-gradient(circle at 35% 35%, hsl(45 95% 58%), hsl(45 95% 42%))',
                      boxShadow: '0 3px 6px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.4)',
                      animation: isWinningCell
                        ? 'winPulse 1.2s infinite ease-in-out'
                        : isLastDropped
                          ? 'discDrop 0.45s cubic-bezier(0.25, 1, 0.5, 1.2) forwards'
                          : 'none',
                      '--glow-color': cell === 'X' ? 'hsl(355 85% 55%)' : 'hsl(45 95% 50%)'
                    } as React.CSSProperties}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Winning line highlight overlay */}
        {winnerInfo && lineCoords && (
          <svg
            style={{
              position: 'absolute',
              inset: '0.75rem',
              width: 'calc(100% - 1.5rem)',
              height: 'calc(100% - 1.5rem)',
              pointerEvents: 'none',
              zIndex: 2
            }}
          >
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              className="winning-line-glowing"
            />
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={winnerInfo.winner === 'X' ? 'hsl(355 95% 60%)' : 'hsl(45 95% 50%)'}
              strokeWidth="3"
              strokeLinecap="round"
              className="winning-line-base"
            />
          </svg>
        )}
      </div>

      {/* Manual Game Control Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
        <button
          className="btn btn-secondary"
          onClick={() => handleReset(false)}
          style={{ flex: 1, borderRadius: 12, padding: '0.5rem' }}
        >
          🔄 Restart Game
        </button>
      </div>

      <style jsx>{`
        @keyframes discDrop {
          0% { transform: translateY(-380px); }
          75% { transform: translateY(5px); }
          90% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }

        @keyframes winPulse {
          0% {
            box-shadow: 0 0 10px #fff, 0 0 20px var(--glow-color);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 15px #fff, 0 0 35px var(--glow-color);
            transform: scale(1.08);
          }
          100% {
            box-shadow: 0 0 10px #fff, 0 0 20px var(--glow-color);
            transform: scale(1);
          }
        }

        .winning-line-glowing {
          opacity: 0.8;
          filter: drop-shadow(0 0 6px #fff);
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: drawLine 0.5s ease-out forwards;
        }

        .winning-line-base {
          stroke-dasharray: 500;
          stroke-dashoffset: 500;
          animation: drawLine 0.5s ease-out forwards;
        }

        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  )
}
