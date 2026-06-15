'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getNumberGuess } from '@/lib/gameAI'

type GameMode = 'vs-ai' | 'local-pvp' | 'lobby-sim'
type Difficulty = 'moderate' | 'hard'
type GameState = 'setup' | 'playing' | 'gameover'

export default function NumberGuessingGame() {
  const { submitGameResult } = useGameSession()

  // Menu / setup navigation
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline')
  const [gameState, setGameState] = useState<GameState>('setup')
  const [gameMode, setGameMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate')

  // Lobby simulator states
  const [roomCode, setRoomCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)

  // Gameplay states
  const [secretNumber, setSecretNumber] = useState<number>(0)
  const [currentTurn, setCurrentTurn] = useState<'Player 1' | 'Player 2' | 'AI'>('Player 1')
  const [winner, setWinner] = useState<string | null>(null)
  
  // Bounds tracking
  const [minBound, setMinBound] = useState(1)
  const [maxBound, setMaxBound] = useState(100)
  
  // Guesses history
  const [guessesHistory, setGuessesHistory] = useState<{ guess: number; by: string; feedback: string }[]>([])
  
  // Input guess state
  const [playerGuess, setPlayerGuess] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [guessFeedback, setGuessFeedback] = useState('')

  const minBoundRef = useRef(minBound)
  minBoundRef.current = minBound
  const maxBoundRef = useRef(maxBound)
  maxBoundRef.current = maxBound
  const difficultyRef = useRef<Difficulty>(difficulty)
  difficultyRef.current = difficulty
  const watchdogRef = useRef<NodeJS.Timeout | null>(null)

  // Start a new game session
  const startNewGame = (mode: GameMode) => {
    setGameMode(mode)
    const secret = Math.floor(Math.random() * 100) + 1
    setSecretNumber(secret)
    setCurrentTurn('Player 1')
    setWinner(null)
    setMinBound(1)
    setMaxBound(100)
    setGuessesHistory([])
    setPlayerGuess('')
    setIsThinking(false)
    setGuessFeedback('Guess a secret number between 1 and 100!')
    setGameState('playing')
  }

  // Handle a guess submission
  const handleGuessSubmit = (guessVal: number) => {
    if (gameState !== 'playing' || isThinking) return
    if (isNaN(guessVal) || guessVal < 1 || guessVal > 100) {
      setGuessFeedback('Please enter a valid number between 1 and 100.')
      return
    }

    let feedback = ''
    let isCorrect = false

    if (guessVal === secretNumber) {
      feedback = 'Correct! 🎉'
      isCorrect = true
    } else if (guessVal > secretNumber) {
      feedback = 'Too High! 📉'
      if (guessVal < maxBound) {
        setMaxBound(guessVal - 1)
      }
    } else {
      feedback = 'Too Low! 📈'
      if (guessVal > minBound) {
        setMinBound(guessVal + 1)
      }
    }

    const byWho = currentTurn === 'Player 1' ? 'Player 1' : currentTurn === 'Player 2' ? 'Player 2' : 'AI'
    const newHistory = [{ guess: guessVal, by: byWho, feedback }, ...guessesHistory]
    setGuessesHistory(newHistory)
    setGuessFeedback(`${byWho} guessed ${guessVal}: ${feedback}`)

    if (isCorrect) {
      triggerGameOver(byWho, newHistory.length)
      return
    }

    // Switch turns
    if (gameMode === 'vs-ai') {
      setCurrentTurn(currentTurn === 'Player 1' ? 'AI' : 'Player 1')
    } else {
      setCurrentTurn(currentTurn === 'Player 1' ? 'Player 2' : 'Player 1')
    }

    setPlayerGuess('')
  }

  // AI Turn Logic with watchdog protection
  useEffect(() => {
    if (gameState !== 'playing' || gameMode !== 'vs-ai' || currentTurn !== 'AI') return

    setIsThinking(true)

    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
    }

    const executeFallbackMove = () => {
      const currentMin = minBoundRef.current
      const currentMax = maxBoundRef.current
      const currentDiff = difficultyRef.current
      const aiGuess = getNumberGuess(currentMin, currentMax, currentDiff)
      
      setIsThinking(false)
      handleGuessSubmit(aiGuess)
    }

    // Start 2000ms watchdog
    watchdogRef.current = setTimeout(() => {
      console.warn('AI turn timed out in Number Guessing. Forcing fallback guess.');
      executeFallbackMove()
    }, 2000)

    // AI Guess timer (600ms, within 500-1000ms)
    const aiTimer = setTimeout(() => {
      clearWatchdog() // completed normally

      const currentMin = minBoundRef.current
      const currentMax = maxBoundRef.current
      const currentDiff = difficultyRef.current

      const aiGuess = getNumberGuess(currentMin, currentMax, currentDiff)

      setIsThinking(false)
      handleGuessSubmit(aiGuess)
    }, 600)

    return () => {
      clearTimeout(aiTimer)
      clearWatchdog()
    }
  }, [currentTurn, gameState, gameMode])

  // Listen to global replay event
  useEffect(() => {
    const handleReplay = () => {
      startNewGame(gameMode)
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [gameMode])

  // End Game
  const triggerGameOver = (winnerName: string, totalGuesses: number) => {
    setWinner(winnerName)
    setGameState('gameover')

    let outcome: 'win' | 'loss' | 'draw'
    if (gameMode === 'vs-ai') {
      outcome = winnerName === 'Player 1' ? 'win' : 'loss'
    } else {
      outcome = 'win' // Local dual player winner always wins
    }

    // Submit results
    submitGameResult({
      gameSlug: 'number-guessing',
      result: outcome,
      metadata: {
        score: Math.max(10, 110 - totalGuesses * 10), // Fewer guesses yields higher score!
        opponentScore: totalGuesses * 10,
        gameMetadata: {
          mode: gameMode,
          difficulty: gameMode === 'vs-ai' ? difficulty : undefined,
          winner: winnerName,
          totalGuesses,
          secretNumber
        }
      }
    })
  }

  const handleLobbyAction = (action: 'create' | 'join') => {
    if (action === 'join' && !roomCode) {
      setLobbyError('Please enter a valid room code.')
      return
    }
    setLobbyError('Rooms & sync are Coming Soon in Sprint 4! Play offline in the meantime.')
  }

  // --- RENDERING MENU SETUP ---
  if (gameState === 'setup') {
    return (
      <div
        className="card glass"
        style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: 390,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        id="numguess-setup-menu"
      >
        <div>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>🔢</div>
          <h2 style={{ fontWeight: 900, fontSize: '1.5rem', margin: 0, color: 'white' }}>Number Guessing</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Compete to find a secret number between 1 and 100. Get instant high/low feedback!
          </p>
        </div>

        {/* Tab selector */}
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
            id="numguess-offline-tab"
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
            id="numguess-online-tab"
          >
            Play with Friends
            <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: 4, background: 'hsl(270 80% 50%)', color: 'white' }}>CS</span>
          </button>
        </div>

        {activeTab === 'offline' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Play vs AI Setup */}
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
                  id="numguess-ai-moderate"
                >
                  Moderate AI
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
                  id="numguess-ai-hard"
                >
                  Hard (Binary Search)
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startNewGame('vs-ai')}
                style={{ width: '100%', borderRadius: 10 }}
                id="numguess-start-ai"
              >
                Launch vs AI Game
              </button>
            </div>

            {/* Local PVP Setup */}
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
                Compete turn-based to guess the secret system number. First to land it wins!
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => startNewGame('local-pvp')}
                style={{ width: '100%', borderRadius: 10 }}
                id="numguess-start-pvp"
              >
                Start Local Dual Player
              </button>
            </div>
          </div>
        ) : (
          /* Lobby Simulator */
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
            id="numguess-lobby-simulator"
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(270 80% 70%)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Online Lobby Setup
              </div>
              <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                Enter room code to challenge a friend online in real time.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 75%)' }}>Lobby Room Code</label>
              <input
                type="text"
                placeholder="e.g. FIND3"
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
                id="numguess-room-code-input"
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
                id="numguess-join-room-btn"
              >
                Join Board
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem' }}
                onClick={() => handleLobbyAction('create')}
                id="numguess-create-room-btn"
              >
                Create Room
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- RENDERING ACTIVE GAMEBOARD ---
  const currentTurnText = winner
    ? `🏆 Match Over! ${winner} Wins!`
    : isThinking
      ? '🤖 AI is analyzing bounds…'
      : `Current Turn: ${currentTurn}`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: 390,
        margin: '0 auto',
        width: '100%',
      }}
      id="numguess-active-game"
    >
      {/* Bounds Status display */}
      <div
        className="card glass"
        style={{
          padding: '1rem',
          textAlign: 'center',
          borderRadius: 16,
          background: 'hsl(222 20% 7%)',
          border: '1px solid hsl(220 15% 18%)',
        }}
      >
        <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', textTransform: 'uppercase', fontWeight: 800 }}>
          Secret Number Range
        </span>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{minBound}</span>
          <span style={{ fontSize: '1rem', color: 'hsl(220 10% 40%)', fontWeight: 800 }}>to</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(0 80% 60%)' }}>{maxBound}</span>
        </div>
      </div>

      {/* Turn indicator */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: winner ? 'hsl(45 100% 55%)' : 'white',
          minHeight: '20px',
        }}
        id="numguess-status-label"
      >
        {currentTurnText}
      </div>

      {/* Interaction display card */}
      <div
        className="card glass"
        style={{
          padding: '1.25rem',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          background: 'hsl(222 20% 7%)',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        id="numguess-control-panel"
      >
        {/* Feedback message banner */}
        <div
          style={{
            fontSize: '0.9rem',
            color: 'hsl(45 100% 65%)',
            fontWeight: 700,
            textAlign: 'center',
            background: 'hsl(222 20% 5%)',
            padding: '0.6rem',
            borderRadius: 10,
            border: '1px solid hsl(220 15% 20%)',
          }}
          id="numguess-feedback-banner"
        >
          {guessFeedback}
        </div>

        {/* Input box / thinking spinner */}
        {gameState === 'playing' && (
          <div style={{ margin: '1rem 0' }}>
            {currentTurn !== 'AI' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleGuessSubmit(parseInt(playerGuess, 10))
                }}
                style={{ display: 'flex', gap: '0.5rem' }}
              >
                <input
                  type="number"
                  placeholder="Guess (1-100)"
                  min={minBound}
                  max={maxBound}
                  value={playerGuess}
                  onChange={(e) => setPlayerGuess(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0.8rem',
                    borderRadius: 10,
                    backgroundColor: 'hsl(222 20% 5%)',
                    border: '1px solid hsl(220 15% 22%)',
                    color: 'white',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  id="numguess-input-field"
                  disabled={isThinking}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ borderRadius: 10, fontSize: '0.85rem' }}
                  disabled={isThinking || !playerGuess}
                  id="numguess-submit-btn"
                >
                  Guess
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '0.5rem', color: 'hsl(220 10% 60%)', fontSize: '0.85rem' }}>
                🤖 AI is analyzing the bounds...
              </div>
            )}
          </div>
        )}

        {/* Gameover state */}
        {gameState === 'gameover' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>Secret Number was {secretNumber}</div>
          </div>
        )}

        {/* Guess History Logs list */}
        <div style={{ flex: 1, maxHeight: 110, overflowY: 'auto', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'hsl(220 10% 55%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Guesses Logs ({guessesHistory.length})
          </div>
          {guessesHistory.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 45%)', fontStyle: 'italic', padding: '0.25rem 0' }}>
              No guesses yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {guessesHistory.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                    backgroundColor: 'hsl(222 20% 5%)',
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  <span style={{ color: 'hsl(220 10% 70%)' }}>
                    <strong>{h.by}</strong> guessed {h.guess}
                  </span>
                  <span style={{ color: 'hsl(45 100% 55%)', fontWeight: 700 }}>{h.feedback}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Setup Back controls */}
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', borderRadius: 12 }}
          onClick={() => setGameState('setup')}
          id="numguess-quit-btn"
        >
          🏳️ Back to Setup Menu
        </button>
      </div>
    </div>
  )
}
