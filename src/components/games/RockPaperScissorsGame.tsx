'use client'

import { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getRPSMove, RPSMove } from '@/lib/gameAI'
import { RockVector, PaperVector, ScissorsVector } from '@/components/games/RockPaperScissorsAssets'
import { BotIcon, FlagIcon } from '@/components/shared/Icons'

const MOVE_ICONS: Record<RPSMove, (props: { size?: number; style?: React.CSSProperties }) => React.ReactNode> = {
  rock: (props) => <RockVector {...props} />,
  paper: (props) => <PaperVector {...props} />,
  scissors: (props) => <ScissorsVector {...props} />,
}

type GameMode = 'vs-ai' | 'local-pvp' | 'lobby-sim'
type Difficulty = 'moderate' | 'hard'
type GameState = 'setup' | 'playing' | 'round-reveal' | 'gameover'

const RPS_RULES: Record<RPSMove, RPSMove> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
}

export default function RockPaperScissorsGame() {
  const { submitGameResult } = useGameSession()

  // Menu / Navigation states
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline')
  const [gameState, setGameState] = useState<GameState>('setup')
  const [gameMode, setGameMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate')

  // Lobby simulator states
  const [roomCode, setRoomCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)

  // Gameplay states
  const [p1Score, setP1Score] = useState(0)
  const [p2Score, setP2Score] = useState(0)
  const [roundsPlayed, setRoundsPlayed] = useState(0)
  
  // Current selections
  const [p1Choice, setP1Choice] = useState<RPSMove | null>(null)
  const [p2Choice, setP2Choice] = useState<RPSMove | null>(null)
  
  // PVP Hidden Input State
  const [pvpTurn, setPvpTurn] = useState<'p1' | 'p2'>('p1')

  // History for Markov AI (Session-scoped)
  const [playerHistory, setPlayerHistory] = useState<RPSMove[]>([])
  
  const [roundResultText, setRoundResultText] = useState('')
  const [winner, setWinner] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)

  const watchdogRef = useRef<NodeJS.Timeout | null>(null)
  const playerHistoryRef = useRef<RPSMove[]>([])
  playerHistoryRef.current = playerHistory
  const difficultyRef = useRef<Difficulty>(difficulty)
  difficultyRef.current = difficulty

  // Start new game
  const startNewGame = (mode: GameMode) => {
    setGameMode(mode)
    setP1Score(0)
    setP2Score(0)
    setRoundsPlayed(0)
    setP1Choice(null)
    setP2Choice(null)
    setPvpTurn('p1')
    setPlayerHistory([])
    setWinner(null)
    setIsThinking(false)
    setGameState('playing')
  }

  // Listen to global replay event
  useEffect(() => {
    const handleReplay = () => {
      startNewGame(gameMode)
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [gameMode])

  // Cleanup watchdog on unmount
  useEffect(() => {
    return () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
      }
    }
  }, [])

  // Handle move selection
  const handleSelectMove = (move: RPSMove) => {
    if (gameMode === 'vs-ai') {
      if (isThinking) return
      setIsThinking(true)
      setP1Choice(move)

      // Record player move in history
      const nextHistory = [...playerHistory, move]
      setPlayerHistory(nextHistory)

      const clearWatchdog = () => {
        if (watchdogRef.current) {
          clearTimeout(watchdogRef.current)
          watchdogRef.current = null
        }
      }

      const executeFallbackMove = () => {
        const moves: RPSMove[] = ['rock', 'paper', 'scissors']
        const randomChoice = moves[Math.floor(Math.random() * 3)]
        setP2Choice(randomChoice)
        setIsThinking(false)
        evaluateRound(move, randomChoice)
      }

      // Start 2000ms watchdog
      watchdogRef.current = setTimeout(() => {
        console.warn('AI turn timed out in Rock Paper Scissors. Forcing fallback choice.')
        executeFallbackMove()
      }, 2000)

      // Artificial thinking delay (600ms, within 500-1000ms)
      setTimeout(() => {
        if (!watchdogRef.current) return // already handled by watchdog fallback
        clearWatchdog()

        const aiChoice = getRPSMove(playerHistoryRef.current, difficultyRef.current)
        setP2Choice(aiChoice)
        setIsThinking(false)
        evaluateRound(move, aiChoice)
      }, 600)
    } else {
      // Local PVP
      if (pvpTurn === 'p1') {
        setP1Choice(move)
        setPvpTurn('p2')
      } else {
        setP2Choice(move)
        evaluateRound(p1Choice!, move)
      }
    }
  }

  // Determine round outcome
  const evaluateRound = (choice1: RPSMove, choice2: RPSMove) => {
    let outcome = ''
    let roundWinner: 'p1' | 'p2' | 'tie' = 'tie'

    if (choice1 === choice2) {
      outcome = "It's a tie!"
      roundWinner = 'tie'
    } else if (RPS_RULES[choice1] === choice2) {
      outcome = gameMode === 'vs-ai' ? 'You win the round! 🎉' : 'Player 1 wins the round! 🎉'
      roundWinner = 'p1'
    } else {
      outcome = gameMode === 'vs-ai' ? 'AI wins the round! 🤖' : 'Player 2 wins the round! 🏆'
      roundWinner = 'p2'
    }

    setRoundResultText(outcome)
    setGameState('round-reveal')

    // Update stats after delay
    setTimeout(() => {
      let nextP1Score = p1Score
      let nextP2Score = p2Score

      if (roundWinner === 'p1') {
        nextP1Score += 1
        setP1Score(nextP1Score)
      } else if (roundWinner === 'p2') {
        nextP2Score += 1
        setP2Score(nextP2Score)
      }

      const nextRounds = roundsPlayed + 1
      setRoundsPlayed(nextRounds)

      // Best of 3 check (first to 2 wins, or 3 rounds done)
      if (nextP1Score >= 2 || nextP2Score >= 2 || nextRounds >= 3) {
        let finalWinner = ''
        let gameResult: 'win' | 'loss' | 'draw'

        if (nextP1Score > nextP2Score) {
          finalWinner = 'Player 1'
          gameResult = 'win'
        } else if (nextP2Score > nextP1Score) {
          finalWinner = gameMode === 'vs-ai' ? 'AI' : 'Player 2'
          gameResult = gameMode === 'vs-ai' ? 'loss' : 'win'
        } else {
          finalWinner = 'draw'
          gameResult = 'draw'
        }

        setWinner(finalWinner)
        setGameState('gameover')

        // Submit to API
        submitGameResult({
          gameSlug: 'rps',
          result: gameResult,
          metadata: {
            score: nextP1Score * 50,
            opponentScore: nextP2Score * 50,
            gameMetadata: {
              mode: gameMode,
              difficulty: gameMode === 'vs-ai' ? difficulty : undefined,
              p1Score: nextP1Score,
              p2Score: nextP2Score,
              roundsPlayed: nextRounds,
              winner: finalWinner,
            }
          }
        })
      } else {
        // Continue to next round
        setP1Choice(null)
        setP2Choice(null)
        setPvpTurn('p1')
        setGameState('playing')
      }
    }, 2200)
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
        id="rps-setup-menu"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RockVector size={64} style={{ marginBottom: '0.5rem' }} />
          <h2 style={{ fontWeight: 900, fontSize: '1.5rem', margin: 0, color: 'white' }}>Rock Paper Scissors</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Classic showdown. Best of 3 rounds wins. Predict your opponent's tendencies!
          </p>
        </div>

        {/* Tab Selection */}
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
            id="rps-offline-tab"
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
            id="rps-online-tab"
          >
            Play with Friends
            <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: 4, background: 'hsl(270 80% 50%)', color: 'white' }}>CS</span>
          </button>
        </div>

        {activeTab === 'offline' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Play vs AI */}
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
                  id="rps-ai-moderate"
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
                  id="rps-ai-hard"
                >
                  Hard (Markov Chain)
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startNewGame('vs-ai')}
                style={{ width: '100%', borderRadius: 10 }}
                id="rps-start-ai"
              >
                Launch vs AI Game
              </button>
            </div>

            {/* Local PVP */}
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
                Enter moves secretly on the same device. Showdown on reveal!
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => startNewGame('local-pvp')}
                style={{ width: '100%', borderRadius: 10 }}
                id="rps-start-pvp"
              >
                Start Local Dual Player
              </button>
            </div>
          </div>
        ) : (
          /* Lobby Sim */
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
            id="rps-lobby-simulator"
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
                placeholder="e.g. SHOW5"
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
                id="rps-room-code-input"
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
                id="rps-join-room-btn"
              >
                Join Board
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem' }}
                onClick={() => handleLobbyAction('create')}
                id="rps-create-room-btn"
              >
                Create Room
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- RENDERING ACTIVE GAME BOARD ---
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
      id="rps-active-game"
    >
      {/* scoreboard HUD */}
      <div
        className="card glass"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-around',
          textAlign: 'center',
          borderRadius: 16,
        }}
      >
        <div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{p1Score}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>P1 Score</div>
        </div>
        <div style={{ borderLeft: '1px solid hsl(220 15% 20%)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(270 80% 65%)' }}>{p2Score}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
            {gameMode === 'vs-ai' ? 'AI Score' : 'P2 Score'}
          </div>
        </div>
      </div>

      {/* Main interaction window */}
      <div
        className="card glass"
        style={{
          padding: '1.5rem',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          textAlign: 'center',
          minHeight: 280,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'hsl(222 20% 7%)',
        }}
        id="rps-interaction-panel"
      >
        {gameState === 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'center', flex: 1 }}>
            {gameMode === 'vs-ai' ? (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {isThinking && <BotIcon size={16} style={{ color: 'hsl(270 80% 70%)', animation: 'pulse 1.5s infinite' }} />}
                  <span>{isThinking ? 'AI is choosing...' : 'Make Your Choice'}</span>
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', margin: 0 }}>Round {roundsPlayed + 1} of 3</p>
              </div>
            ) : (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white', margin: '0 0 0.5rem 0' }}>
                  {pvpTurn === 'p1' ? '👤 Player 1 Turn' : '👤 Player 2 Turn'}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', margin: 0 }}>
                  Select your move secretly!
                </p>
              </div>
            )}

            {/* Selection Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              {(['rock', 'paper', 'scissors'] as RPSMove[]).map((move) => (
                <button
                  key={move}
                  onClick={() => handleSelectMove(move)}
                  disabled={isThinking}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    border: '1px solid hsl(220 15% 22%)',
                    background: 'hsl(222 20% 9%)',
                    cursor: isThinking ? 'default' : 'pointer',
                    transition: 'all 0.15s',
                    outline: 'none',
                    opacity: isThinking ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  id={`rps-btn-${move}`}
                  onMouseEnter={(e) => {
                    if (!isThinking) e.currentTarget.style.borderColor = 'hsl(220 100% 60%)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isThinking) e.currentTarget.style.borderColor = 'hsl(220 15% 22%)'
                  }}
                >
                  {MOVE_ICONS[move]({ size: 40 })}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameState === 'round-reveal' && p1Choice && p2Choice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
                  {MOVE_ICONS[p1Choice]({ size: 64 })}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)', fontWeight: 700, marginTop: '0.4rem' }}>
                  Player 1
                </div>
              </div>

              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 10% 40%)' }}>vs</div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))' }}>
                  {MOVE_ICONS[p2Choice]({ size: 64 })}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)', fontWeight: 700, marginTop: '0.4rem' }}>
                  {gameMode === 'vs-ai' ? 'AI' : 'Player 2'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(45 100% 55%)', marginTop: '0.5rem' }}>
              {roundResultText}
            </div>
          </div>
        )}

        {gameState === 'gameover' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: 0 }}>
                {winner === 'draw' ? 'Draw Match!' : `${winner} Wins!`}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', marginTop: '0.25rem', marginBottom: 0 }}>
                Final score: {p1Score} - {p2Score}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Back to Setup Controls */}
      <div style={{ textAlign: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          onClick={() => setGameState('setup')}
          id="rps-quit-btn"
        >
          <FlagIcon size={14} />
          <span>Back to Setup Menu</span>
        </button>
      </div>
    </div>
  )
}
