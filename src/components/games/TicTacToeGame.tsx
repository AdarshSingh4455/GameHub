'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import GameHUD from '@/components/layout/GameHUD'
import { getTTTMove } from '@/lib/gameAI'

type Cell = 'X' | 'O' | null
type GameMode = 'vs-ai' | 'local-pvp' | 'lobby-sim'
type Difficulty = 'moderate' | 'hard'

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function checkWinner(board: Cell[]): { winner: 'X' | 'O'; line: number[] } | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line: [a, b, c] }
    }
  }
  return null
}

export default function TicTacToeGame() {
  const { submitGameResult } = useGameSession()
  
  // Menu Navigation State
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline')
  const [inGame, setInGame] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate')
  
  // Game Play State
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X')
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null)
  const [winningLine, setWinningLine] = useState<number[]>([])
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 })
  const [isThinking, setIsThinking] = useState(false)

  // Room Lobby simulation state
  const [roomCode, setRoomCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)

  const boardRef = useRef(board)
  boardRef.current = board
  const difficultyRef = useRef(difficulty)
  difficultyRef.current = difficulty
  const watchdogRef = useRef<NodeJS.Timeout | null>(null)

  // Submit result on game over
  useEffect(() => {
    if (!winner) return

    let resultPayload: 'win' | 'loss' | 'draw'
    if (winner === 'draw') {
      resultPayload = 'draw'
    } else if (gameMode === 'vs-ai') {
      resultPayload = winner === 'X' ? 'win' : 'loss'
    } else {
      // PVP: X is P1, O is P2. P1 win counts as 'win', P2 win also registers as 'win' locally
      resultPayload = 'win'
    }

    submitGameResult({
      gameSlug: 'tic-tac-toe',
      result: resultPayload,
      metadata: {
        score: resultPayload === 'win' ? 100 : resultPayload === 'draw' ? 50 : 10,
        opponentScore: resultPayload === 'loss' ? 100 : resultPayload === 'draw' ? 50 : 10,
        gameMetadata: {
          mode: gameMode,
          difficulty: gameMode === 'vs-ai' ? difficulty : undefined,
          winner,
        },
      },
    })
  }, [winner, gameMode, difficulty, submitGameResult])

  const startNewGame = (mode: GameMode) => {
    setGameMode(mode)
    setBoard(Array(9).fill(null))
    setCurrentTurn('X')
    setWinner(null)
    setWinningLine([])
    setIsThinking(false)
    setInGame(true)
  }

  // Listen to global replay event
  useEffect(() => {
    const handleReplay = () => {
      startNewGame(gameMode)
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [gameMode])

  // AI Turn handling with watchdog protection
  useEffect(() => {
    if (!inGame || gameMode !== 'vs-ai' || currentTurn !== 'O' || winner) return

    setIsThinking(true)

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
    }

    const makeAIMove = (moveIndex: number) => {
      const boardCopy = [...boardRef.current]
      boardCopy[moveIndex] = 'O'
      setBoard(boardCopy)
      setIsThinking(false)
      setCurrentTurn('X')

      const aiCheckWin = checkWinner(boardCopy)
      if (aiCheckWin) {
        setWinningLine(aiCheckWin.line)
        setWinner(aiCheckWin.winner)
        setScores(prev => ({ ...prev, O: prev.O + 1 }))
      } else if (boardCopy.every(Boolean)) {
        setWinner('draw')
        setScores(prev => ({ ...prev, draws: prev.draws + 1 }))
      }
    }

    const executeFallbackMove = () => {
      const currentBoard = boardRef.current
      // Find first empty cell
      const firstEmpty = currentBoard.findIndex(cell => cell === null)
      if (firstEmpty !== -1) {
        makeAIMove(firstEmpty)
      } else {
        setIsThinking(false)
        setCurrentTurn('X')
      }
    }

    // Start 2000ms watchdog
    watchdogRef.current = setTimeout(() => {
      console.warn('AI turn timed out in TicTacToe. Forcing fallback move.')
      executeFallbackMove()
    }, 2000)

    // AI thinking delay (600ms, within 500-1000ms)
    const aiTimer = setTimeout(() => {
      clearWatchdog() // completed normally
      const boardCopy = [...boardRef.current]
      const bestMoveIndex = getTTTMove(boardCopy, difficultyRef.current)
      
      if (bestMoveIndex !== -1) {
        makeAIMove(bestMoveIndex)
      } else {
        executeFallbackMove()
      }
    }, 600)

    return () => {
      clearTimeout(aiTimer)
      clearWatchdog()
    }
  }, [currentTurn, inGame, gameMode, winner])

  const handleCellClick = (index: number) => {
    if (board[index] || winner || isThinking || !inGame) return

    const updatedBoard = [...board]
    updatedBoard[index] = currentTurn
    
    // Check if current player won
    const checkWin = checkWinner(updatedBoard)
    if (checkWin) {
      setBoard(updatedBoard)
      setWinningLine(checkWin.line)
      setWinner(checkWin.winner)
      setScores(prev => ({ ...prev, [checkWin.winner]: prev[checkWin.winner] + 1 }))
      return
    }

    // Check for draw
    if (updatedBoard.every(Boolean)) {
      setBoard(updatedBoard)
      setWinner('draw')
      setScores(prev => ({ ...prev, draws: prev.draws + 1 }))
      return
    }

    // Pass turn
    setBoard(updatedBoard)
    if (gameMode === 'vs-ai') {
      setCurrentTurn('O')
    } else {
      // Local PVP: Alternate turn
      setCurrentTurn(currentTurn === 'X' ? 'O' : 'X')
    }
  }

  const handleReset = () => {
    setBoard(Array(9).fill(null))
    setCurrentTurn('X')
    setWinner(null)
    setWinningLine([])
    setIsThinking(false)
  }

  const handleQuit = () => {
    setInGame(false)
    handleReset()
  }

  const handleLobbyAction = (action: 'create' | 'join') => {
    if (action === 'join' && !roomCode) {
      setLobbyError('Please enter a valid room code.')
      return
    }
    setLobbyError(`Rooms & sync are Coming Soon in Sprint 4! Play offline in the meantime.`)
  }

  // --- RENDERING SETUP MENU ---
  if (!inGame) {
    return (
      <div
        className="card glass"
        style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: 390, // Mobile First Viewport Rule
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        id="ttt-setup-menu"
      >
        <div>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>⭕</div>
          <h2 style={{ fontWeight: 900, fontSize: '1.5rem', margin: 0, color: 'white' }}>Tic-Tac-Toe</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Get 3 in a row. Play locally vs a friend or challenge the AI.
          </p>
        </div>

        {/* Tab navigation */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'hsl(222 20% 6%)',
            padding: '4px',
            borderRadius: 12,
            border: '1px solid hsl(220 15% 18%)',
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'offline' ? 'hsl(220 100% 60%)' : 'transparent',
              color: activeTab === 'offline' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => {
              setActiveTab('offline')
              setLobbyError(null)
            }}
            id="ttt-offline-tab"
          >
            Offline Modes
          </button>
          <button
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'online' ? 'hsl(220 100% 60%)' : 'transparent',
              color: activeTab === 'online' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            onClick={() => setActiveTab('online')}
            id="ttt-online-tab"
          >
            Play with Friends
            <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: 4, background: 'hsl(270 80% 50%)', color: 'white' }}>CS</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'offline' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Play vs AI Section */}
            <div
              style={{
                background: 'hsl(222 20% 7% / 0.5)',
                border: '1px solid hsl(220 15% 18%)',
                padding: '1rem',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ textAlign: 'left', fontSize: '0.8rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>
                🤖 PLAY VS AI
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: difficulty === 'moderate' ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                    backgroundColor: difficulty === 'moderate' ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                    color: difficulty === 'moderate' ? 'hsl(220 100% 70%)' : 'hsl(220 10% 60%)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDifficulty('moderate')}
                  id="ttt-ai-moderate"
                >
                  Moderate
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '0.4rem',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: difficulty === 'hard' ? 'hsl(0 80% 55%)' : 'hsl(220 15% 22%)',
                    backgroundColor: difficulty === 'hard' ? 'hsl(0 80% 55% / 0.15)' : 'transparent',
                    color: difficulty === 'hard' ? 'hsl(0 80% 70%)' : 'hsl(220 10% 60%)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDifficulty('hard')}
                  id="ttt-ai-hard"
                >
                  Hard (Minimax)
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startNewGame('vs-ai')}
                style={{ width: '100%', borderRadius: 10 }}
                id="ttt-start-ai"
              >
                Launch vs AI Game
              </button>
            </div>

            {/* Play vs Local Friend */}
            <div
              style={{
                background: 'hsl(222 20% 7% / 0.5)',
                border: '1px solid hsl(220 15% 18%)',
                padding: '1rem',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>
                👥 LOCAL SAME-DEVICE
              </div>
              <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', textAlign: 'left', margin: '0 0 0.5rem 0' }}>
                Pass the device and play turn-based matches face-to-face.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => startNewGame('local-pvp')}
                style={{ width: '100%', borderRadius: 10 }}
                id="ttt-start-pvp"
              >
                Start Local Dual Player
              </button>
            </div>
          </div>
        ) : (
          /* Play with Friends Coming Soon Lobby */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'hsl(222 20% 7% / 0.5)',
              border: '1px solid hsl(220 15% 18%)',
              padding: '1.25rem',
              borderRadius: 16,
            }}
            id="ttt-lobby-simulator"
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(270 80% 70%)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Online Lobby Setup
              </div>
              <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                Enter room code to join an active friend's board, or spin up a new room code to invite others.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 75%)' }}>Lobby Room Code</label>
              <input
                type="text"
                placeholder="e.g. TTT44"
                maxLength={5}
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase())
                  setLobbyError(null)
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 8,
                  backgroundColor: 'hsl(222 20% 5%)',
                  border: '1px solid hsl(220 15% 22%)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
                id="ttt-room-code-input"
              />
            </div>

            {lobbyError && (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'hsl(38 95% 60%)',
                  background: 'hsl(38 95% 50% / 0.1)',
                  border: '1px solid hsl(38 95% 50% / 0.2)',
                  padding: '0.5rem',
                  borderRadius: 8,
                  textAlign: 'left',
                }}
                id="lobby-feedback-alert"
              >
                ⚠️ {lobbyError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem' }}
                onClick={() => handleLobbyAction('join')}
                id="ttt-join-room-btn"
              >
                Join Board
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem' }}
                onClick={() => handleLobbyAction('create')}
                id="ttt-create-room-btn"
              >
                Create Room
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- RENDERING GAME BOARD ---
  const statusMsg = winner
    ? winner === 'draw'
      ? "It's a draw! 🤝"
      : winner === 'X'
        ? gameMode === 'vs-ai' ? '🏆 You Win!' : '🏆 Player X Wins!'
        : gameMode === 'vs-ai' ? '🤖 AI Wins!' : '🏆 Player O Wins!'
    : isThinking
      ? '🤖 AI is analyzing…'
      : gameMode === 'vs-ai'
        ? 'Your turn (X)'
        : `Turn: Player ${currentTurn}`

  return (
    <div
      style={{
        maxWidth: 390, // Mobile First Viewport Rule
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
      id="ttt-active-game"
    >
      {/* scoreboard */}
      <GameHUD id="ttt-scoreboard-hud" style={{ justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{scores.X}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>X (P1)</div>
        </div>
        <div style={{ borderLeft: '1px solid hsl(220 15% 20%)', borderRight: '1px solid hsl(220 15% 20%)', padding: '0 1.5rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 10% 50%)' }}>{scores.draws}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>Draws</div>
        </div>
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(270 80% 65%)' }}>{scores.O}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>O {gameMode === 'vs-ai' ? '(AI)' : '(P2)'}</div>
        </div>
      </GameHUD>

      {/* Info Status Indicator */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: winner ? 'hsl(45 100% 55%)' : 'white',
          minHeight: '20px',
        }}
        id="ttt-status-label"
      >
        {statusMsg}
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          background: 'hsl(222 20% 7%)',
          padding: '10px',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          aspectRatio: '1',
        }}
        id="ttt-board-grid"
      >
        {board.map((cell, i) => {
          const isWinningCell = winningLine.includes(i)
          return (
            <button
              key={i}
              onClick={() => handleCellClick(i)}
              id={`ttt-cell-${i}`}
              style={{
                aspectRatio: '1',
                borderRadius: 12,
                border: isWinningCell ? '2px solid hsl(45 100% 55%)' : '1px solid hsl(220 15% 22%)',
                background: isWinningCell
                  ? 'linear-gradient(135deg, hsl(45 100% 55% / 0.2), hsl(38 95% 50% / 0.2))'
                  : cell
                    ? 'hsl(222 20% 12%)'
                    : 'hsl(222 20% 9%)',
                fontSize: '2.5rem',
                fontWeight: 900,
                color: cell === 'X' ? 'hsl(220 100% 65%)' : 'hsl(270 80% 65%)',
                cursor: cell || winner || isThinking ? 'default' : 'pointer',
                transition: 'all 0.2s',
                outline: 'none',
                boxShadow: isWinningCell ? '0 0 15px hsl(45 100% 55% / 0.15)' : 'none',
              }}
            >
              {cell}
            </button>
          )
        })}
      </div>

      {/* Action panel */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          className="btn btn-primary"
          style={{ flex: 2, borderRadius: 12 }}
          onClick={handleReset}
          id="ttt-play-again-btn"
        >
          🔄 Restart Board
        </button>
        <button
          className="btn btn-secondary"
          style={{ flex: 1, borderRadius: 12 }}
          onClick={handleQuit}
          id="ttt-quit-btn"
        >
          🏳️ Menu
        </button>
      </div>
    </div>
  )
}
