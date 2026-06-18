'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getMemoryMatchMoves } from '@/lib/gameAI'

const EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞'
]

interface Card {
  id: number
  emoji: string
  isFlipped: boolean
  isMatched: boolean
}

type GameMode = 'vs-ai' | 'local-pvp' | 'lobby-sim'
type Difficulty = 'easy' | 'moderate' | 'hard'
type GridSize = '4x4' | '5x5'

const pruneMemory = (
  currentCards: Card[],
  currentDifficulty: Difficulty,
  order: number[],
  memory: Record<number, string>
) => {
  const capacity = currentDifficulty === 'easy' ? 2 : currentDifficulty === 'moderate' ? 3 : 5
  const activeOrder = order.filter(idx => currentCards[idx] && !currentCards[idx].isMatched)
  const allowedIndices = activeOrder.slice(-capacity)
  
  const prunedMemory: Record<number, string> = {}
  allowedIndices.forEach(idx => {
    if (memory[idx] !== undefined) {
      prunedMemory[idx] = memory[idx]
    }
  })
  return { prunedOrder: activeOrder, prunedMemory }
}

export default function MemoryMatchGame() {
  const { submitGameResult } = useGameSession()

  // Navigation / Menu states
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline')
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'gameover'>('setup')
  const [gameMode, setGameMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [gridSize, setGridSize] = useState<GridSize>('4x4')

  // Lobby simulator states
  const [roomCode, setRoomCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)

  // Playing states
  const [cards, setCards] = useState<Card[]>([])
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [scores, setScores] = useState({ p1: 0, p2: 0 })
  const [currentTurn, setCurrentTurn] = useState<'Player 1' | 'Player 2' | 'AI'>('Player 1')
  const [winner, setWinner] = useState<string | null>(null)
  
  // AI Session Memory
  const [seenMemory, setSeenMemory] = useState<Record<number, string>>({})
  const [revealOrder, setRevealOrder] = useState<number[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [aiMoveTrigger, setAiMoveTrigger] = useState(0)

  const clickLockRef = useRef(false)
  const cardsRef = useRef<Card[]>([])
  cardsRef.current = cards
  const seenMemoryRef = useRef<Record<number, string>>({})
  seenMemoryRef.current = seenMemory
  const revealOrderRef = useRef<number[]>([])
  revealOrderRef.current = revealOrder
  const difficultyRef = useRef<Difficulty>(difficulty)
  difficultyRef.current = difficulty
  const watchdogRef = useRef<NodeJS.Timeout | null>(null)

  // Start a new match
  const startNewGame = useCallback((mode: GameMode) => {
    setGameMode(mode)
    setScores({ p1: 0, p2: 0 })
    setCurrentTurn('Player 1')
    setFlippedIndices([])
    setWinner(null)
    setSeenMemory({})
    setRevealOrder([])
    setIsThinking(false)
    clickLockRef.current = false

    const pairsCount = gridSize === '4x4' ? 8 : 12
    const selectedEmojis = EMOJIS.slice(0, pairsCount)
    const cardList: Card[] = []
    
    selectedEmojis.forEach((emoji, index) => {
      cardList.push({ id: index * 2, emoji, isFlipped: false, isMatched: false })
      cardList.push({ id: index * 2 + 1, emoji, isFlipped: false, isMatched: false })
    })

    // Shuffle
    for (let i = cardList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardList[i], cardList[j]] = [cardList[j], cardList[i]]
    }

    setCards(cardList)
    setGameState('playing')
  }, [gridSize])

  // Handle Player card click
  const handleCardClick = (index: number) => {
    if (
      clickLockRef.current ||
      isThinking ||
      cards[index].isFlipped ||
      cards[index].isMatched ||
      gameState !== 'playing' ||
      currentTurn === 'AI'
    ) return

    flipCard(index)
  }

  // Common flip card utility
  const flipCard = (index: number) => {
    // Reveal card in local view
    setCards(prev => {
      const updated = [...prev]
      updated[index].isFlipped = true
      return updated
    })

    // Update revealOrder and seenMemory with capacity limit
    const newOrder = [...revealOrderRef.current.filter(idx => idx !== index), index]
    const newMemory = { ...seenMemoryRef.current, [index]: cards[index].emoji }
    const { prunedOrder, prunedMemory } = pruneMemory(cards, difficulty, newOrder, newMemory)
    
    setRevealOrder(prunedOrder)
    setSeenMemory(prunedMemory)

    const newFlipped = [...flippedIndices, index]
    setFlippedIndices(newFlipped)

    if (newFlipped.length === 2) {
      clickLockRef.current = true
      evaluateMatch(newFlipped)
    }
  }

  // Evaluate card pair
  const evaluateMatch = (flipped: number[]) => {
    const [firstIdx, secondIdx] = flipped

    if (cards[firstIdx].emoji === cards[secondIdx].emoji) {
      // MATCH FOUND
      setTimeout(() => {
        setCards(prev => {
          const updated = [...prev]
          updated[firstIdx].isMatched = true
          updated[secondIdx].isMatched = true
          
          // Check win condition
          const allMatched = updated.every(c => c.isMatched)
          if (allMatched) {
            setTimeout(() => triggerGameOver(updated), 300)
          }
          return updated
        })

        // Remove matched indices from memory
        setRevealOrder(prev => prev.filter(idx => idx !== firstIdx && idx !== secondIdx))
        setSeenMemory(prev => {
          const updated = { ...prev }
          delete updated[firstIdx]
          delete updated[secondIdx]
          return updated
        })

        // Increment current player score
        setScores(prev => {
          const updatedScores = { ...prev }
          if (currentTurn === 'Player 1') {
            updatedScores.p1 += 1
          } else {
            updatedScores.p2 += 1
          }
          return updatedScores
        })

        setFlippedIndices([])
        clickLockRef.current = false

        if (currentTurn === 'AI' && gameMode === 'vs-ai') {
          setAiMoveTrigger(prev => prev + 1)
        }
      }, 250)
    } else {
      // NO MATCH
      setTimeout(() => {
        setCards(prev => {
          const updated = [...prev]
          updated[firstIdx].isFlipped = false
          updated[secondIdx].isFlipped = false
          return updated
        })

        // Pass turn
        setFlippedIndices([])
        clickLockRef.current = false

        if (gameMode === 'vs-ai') {
          setCurrentTurn(currentTurn === 'Player 1' ? 'AI' : 'Player 1')
        } else {
          setCurrentTurn(currentTurn === 'Player 1' ? 'Player 2' : 'Player 1')
        }
      }, 500)
    }
  }

  // Trigger AI move on turn change
  useEffect(() => {
    if (gameState === 'playing' && gameMode === 'vs-ai' && currentTurn === 'AI') {
      setAiMoveTrigger(prev => prev + 1)
    }
  }, [currentTurn, gameState, gameMode])

  // AI Turn handling with watchdog protection
  useEffect(() => {
    if (gameState !== 'playing' || gameMode !== 'vs-ai' || currentTurn !== 'AI') return

    setIsThinking(true)

    // Helper to clear watchdog
    const clearWatchdog = () => {
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current)
        watchdogRef.current = null
      }
    }

    // Force fallback move if watchdog fires (>2000ms)
    const executeFallbackMove = () => {
      const currentCards = cardsRef.current
      const unmatched = currentCards
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !c.isMatched)
        .map(({ i }) => i)

      if (unmatched.length < 2) {
        setIsThinking(false)
        return
      }

      // Force first two unmatched cards
      const firstIdx = unmatched[0]
      const secondIdx = unmatched[1]

      setCards(prev => {
        const updated = [...prev]
        updated[firstIdx].isFlipped = true
        updated[secondIdx].isFlipped = true
        return updated
      })

      // Update memory for watchdog flips
      const orderAfterFlip1 = [...revealOrderRef.current.filter(idx => idx !== firstIdx), firstIdx]
      const memoryAfterFlip1 = { ...seenMemoryRef.current, [firstIdx]: currentCards[firstIdx].emoji }
      const prune1 = pruneMemory(currentCards, difficultyRef.current, orderAfterFlip1, memoryAfterFlip1)

      const orderAfterFlip2 = [...prune1.prunedOrder.filter(idx => idx !== secondIdx), secondIdx]
      const memoryAfterFlip2 = { ...prune1.prunedMemory, [secondIdx]: currentCards[secondIdx].emoji }
      const prune2 = pruneMemory(currentCards, difficultyRef.current, orderAfterFlip2, memoryAfterFlip2)
      setRevealOrder(prune2.prunedOrder)
      setSeenMemory(prune2.prunedMemory)

      setFlippedIndices([firstIdx, secondIdx])

      setTimeout(() => {
        if (currentCards[firstIdx].emoji === currentCards[secondIdx].emoji) {
          // AI Matches
          setCards(prev => {
            const updated = [...prev]
            updated[firstIdx].isMatched = true
            updated[secondIdx].isMatched = true
            const allMatched = updated.every(c => c.isMatched)
            if (allMatched) {
              setTimeout(() => triggerGameOver(updated), 300)
            }
            return updated
          })

          // Remove matched indices from memory
          setRevealOrder(prev => prev.filter(idx => idx !== firstIdx && idx !== secondIdx))
          setSeenMemory(prev => {
            const updated = { ...prev }
            delete updated[firstIdx]
            delete updated[secondIdx]
            return updated
          })

          setScores(prev => ({ ...prev, p2: prev.p2 + 1 }))
          setFlippedIndices([])
          setIsThinking(false)
          setAiMoveTrigger(prev => prev + 1)
        } else {
          // AI Fails
          setCards(prev => {
            const updated = [...prev]
            updated[firstIdx].isFlipped = false
            updated[secondIdx].isFlipped = false
            return updated
          })
          setFlippedIndices([])
          setCurrentTurn('Player 1')
          setIsThinking(false)
        }
      }, 500)
    }

    // Start watchdog timer
    watchdogRef.current = setTimeout(() => {
      console.warn('AI turn execution timed out (>3000ms). Forcing fallback move.');
      executeFallbackMove()
    }, 3000)

    // Delay before AI starts moving (random 800-1500ms to simulate thinking)
    const aiThinkDelay = 800 + Math.floor(Math.random() * 700)
    const aiActionTimer = setTimeout(() => {
      const currentCards = cardsRef.current
      const currentMemory = seenMemoryRef.current
      const currentDiff = difficultyRef.current

      const aiMoves = getMemoryMatchMoves(currentCards, currentMemory, currentDiff)
      const [firstIdx, secondIdx] = aiMoves

      // AI Flips Card 1
      setCards(prev => {
        const updated = [...prev]
        updated[firstIdx].isFlipped = true
        return updated
      })

      // Update local memory and revealOrder for flip 1
      const orderAfterFlip1 = [...revealOrderRef.current.filter(idx => idx !== firstIdx), firstIdx]
      const memoryAfterFlip1 = { ...seenMemoryRef.current, [firstIdx]: currentCards[firstIdx].emoji }
      const prune1 = pruneMemory(currentCards, currentDiff, orderAfterFlip1, memoryAfterFlip1)
      setRevealOrder(prune1.prunedOrder)
      setSeenMemory(prune1.prunedMemory)
      setFlippedIndices([firstIdx])

      // AI Flips Card 2 after delay (600ms)
      setTimeout(() => {
        setCards(prev => {
          const updated = [...prev]
          updated[secondIdx].isFlipped = true
          return updated
        })

        // Update local memory and revealOrder for flip 2
        const orderAfterFlip2 = [...prune1.prunedOrder.filter(idx => idx !== secondIdx), secondIdx]
        const memoryAfterFlip2 = { ...prune1.prunedMemory, [secondIdx]: currentCards[secondIdx].emoji }
        const prune2 = pruneMemory(currentCards, currentDiff, orderAfterFlip2, memoryAfterFlip2)
        setRevealOrder(prune2.prunedOrder)
        setSeenMemory(prune2.prunedMemory)
        
        const nextFlipped = [firstIdx, secondIdx]
        setFlippedIndices(nextFlipped)

        // Evaluate AI match after delay (600ms)
        setTimeout(() => {
          clearWatchdog() // Clear watchdog since we completed normally

          if (currentCards[firstIdx].emoji === currentCards[secondIdx].emoji) {
            // AI Matches
            setCards(prev => {
              const updated = [...prev]
              updated[firstIdx].isMatched = true
              updated[secondIdx].isMatched = true
              const allMatched = updated.every(c => c.isMatched)
              if (allMatched) {
                setTimeout(() => triggerGameOver(updated), 300)
              }
              return updated
            })

            // Remove matched indices from memory
            setRevealOrder(prev => prev.filter(idx => idx !== firstIdx && idx !== secondIdx))
            setSeenMemory(prev => {
              const updated = { ...prev }
              delete updated[firstIdx]
              delete updated[secondIdx]
              return updated
            })

            setScores(prev => ({ ...prev, p2: prev.p2 + 1 }))
            setFlippedIndices([])
            setIsThinking(false)
            setAiMoveTrigger(prev => prev + 1)
          } else {
            // AI Fails
            setCards(prev => {
              const updated = [...prev]
              updated[firstIdx].isFlipped = false
              updated[secondIdx].isFlipped = false
              return updated
            })
            setFlippedIndices([])
            setCurrentTurn('Player 1')
            setIsThinking(false)
          }
        }, 600)
      }, 600)
    }, aiThinkDelay)

    return () => {
      clearTimeout(aiActionTimer)
      clearWatchdog()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMoveTrigger])

  // Listen to global replay event
  useEffect(() => {
    const handleReplay = () => {
      startNewGame(gameMode)
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [gameMode, startNewGame])

  // End game
  const triggerGameOver = (_finalCards: Card[]) => {
    setGameState('gameover')
    
    let outcome: 'win' | 'loss' | 'draw'
    let winnerName = ''

    const p1Score = scores.p1
    const p2Score = scores.p2

    // Check winner
    if (p1Score > p2Score) {
      outcome = 'win'
      winnerName = 'Player 1'
    } else if (p2Score > p1Score) {
      outcome = gameMode === 'vs-ai' ? 'loss' : 'win'
      winnerName = gameMode === 'vs-ai' ? 'AI' : 'Player 2'
    } else {
      outcome = 'draw'
      winnerName = 'draw'
    }

    setWinner(winnerName)

    submitGameResult({
      gameSlug: 'memory',
      result: outcome,
      metadata: {
        score: p1Score * 100,
        opponentScore: p2Score * 100,
        gameMetadata: {
          mode: gameMode,
          difficulty: gameMode === 'vs-ai' ? difficulty : undefined,
          p1Matches: p1Score,
          p2Matches: p2Score,
          winner: winnerName
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

  // --- SETUP MENU RENDER ---
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
        id="memory-setup-menu"
      >
        <div>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>🃏</div>
          <h2 style={{ fontWeight: 900, fontSize: '1.5rem', margin: 0, color: 'white' }}>Memory Match</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            Flip cards to match identical emoji pairs. Keep matching to build combos.
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
            id="memory-offline-tab"
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
            id="memory-online-tab"
          >
            Play with Friends
            <span style={{ fontSize: '0.6rem', padding: '2px 5px', borderRadius: 4, background: 'hsl(270 80% 50%)', color: 'white' }}>CS</span>
          </button>
        </div>

        {activeTab === 'offline' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Grid Size choice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-start' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>GRID SIZE</label>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: gridSize === '4x4' ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                    backgroundColor: gridSize === '4x4' ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                    color: gridSize === '4x4' ? 'white' : 'hsl(220 10% 60%)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setGridSize('4x4')}
                  id="memory-grid-4x4"
                >
                  4 × 4 Grid (8 pairs)
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: gridSize === '5x5' ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                    backgroundColor: gridSize === '5x5' ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                    color: gridSize === '5x5' ? 'white' : 'hsl(220 10% 60%)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setGridSize('5x5')}
                  id="memory-grid-5x5"
                >
                  5 × 5 Grid (12 pairs)
                </button>
              </div>
            </div>

            {/* AI Settings panel */}
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
                    borderColor: difficulty === 'easy' ? 'hsl(142 70% 45%)' : 'hsl(220 15% 22%)',
                    backgroundColor: difficulty === 'easy' ? 'hsl(142 70% 45% / 0.15)' : 'transparent',
                    color: difficulty === 'easy' ? 'hsl(142 70% 65%)' : 'hsl(220 10% 60%)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setDifficulty('easy')}
                  id="memory-ai-easy"
                >
                  Easy AI
                </button>
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
                  id="memory-ai-moderate"
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
                  id="memory-ai-hard"
                >
                  Hard AI
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startNewGame('vs-ai')}
                style={{ width: '100%', borderRadius: 10 }}
                id="memory-start-ai"
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
                Alternate card flips face-to-face. Matches grant bonus turns.
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => startNewGame('local-pvp')}
                style={{ width: '100%', borderRadius: 10 }}
                id="memory-start-pvp"
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
            id="memory-lobby-simulator"
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(270 80% 70%)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Online Lobby Setup
              </div>
              <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem', marginBottom: '1rem', lineHeight: 1.4 }}>
                Setup a shared board session. Invite friends using the generated room key code.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 75%)' }}>Lobby Room Code</label>
              <input
                type="text"
                placeholder="e.g. CARD8"
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
                id="memory-room-code-input"
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
                id="memory-join-room-btn"
              >
                Join Board
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem' }}
                onClick={() => handleLobbyAction('create')}
                id="memory-create-room-btn"
              >
                Create Room
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- ACTIVE GAME BOARD RENDER ---
  const columnsCount = gridSize === '4x4' ? 4 : 5
  const gridTemplate = `repeat(${columnsCount}, 1fr)`
  
  // Responsive card sizes
  const cardEmojiSize = gridSize === '4x4' ? 'clamp(1.2rem, 5.5vw, 2.2rem)' : 'clamp(0.8rem, 3.8vw, 1.6rem)'

  const turnMessage = winner
    ? winner === 'draw'
      ? "It's a tie game! 🤝"
      : `🏆 ${winner} wins the Match!`
    : isThinking
      ? '🤖 AI is recalling matches…'
      : `Turn: ${currentTurn}`

  const totalSlots = gridSize === '4x4' ? 16 : 25
  const slots = Array.from({ length: totalSlots }, (_, i) => i)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: 'min(100%, 72vh, 500px)',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}
      id="memory-active-game"
    >
      <style>{`
        @keyframes trophy-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 15px hsl(45 100% 50% / 0.5);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 25px hsl(45 100% 60% / 0.8);
          }
        }
      `}</style>

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
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 100% 65%)' }}>{scores.p1}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>P1 matches</div>
        </div>
        <div style={{ borderLeft: '1px solid hsl(220 15% 20%)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(270 80% 65%)' }}>{scores.p2}</div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
            {gameMode === 'vs-ai' ? 'AI matches' : 'P2 matches'}
          </div>
        </div>
      </div>

      {/* Turn indicator banner */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.95rem',
          color: winner ? 'hsl(45 100% 55%)' : 'white',
          minHeight: '20px',
        }}
        id="memory-status-label"
      >
        {turnMessage}
      </div>

      {/* Interactive Card Board Grid */}
      <div
        className="card glass"
        style={{
          padding: '10px',
          display: 'grid',
          gridTemplateColumns: gridTemplate,
          gap: '8px',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          aspectRatio: '1',
          width: '100%',
          backgroundColor: 'hsl(222 20% 7%)',
        }}
        id="memory-grid-board"
      >
        {slots.map((slotIndex) => {
          if (gridSize === '5x5' && slotIndex === 12) {
            // Render center trophy tile (purely decorative, no hover/pointer events)
            return (
              <div
                key="center-trophy"
                style={{
                  width: '100%',
                  height: '100%',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, hsl(45 100% 40%), hsl(45 100% 20%))',
                  border: '2px solid hsl(45 100% 50%)',
                  boxShadow: '0 0 15px hsl(45 100% 50% / 0.5)',
                  pointerEvents: 'none',
                  animation: 'trophy-pulse 2s ease-in-out infinite',
                }}
                id="memory-trophy-tile"
              >
                <div style={{ fontSize: `calc(${cardEmojiSize} * 1.25)` }}>🏆</div>
              </div>
            )
          }

          const cardIndex = gridSize === '5x5' && slotIndex > 12 ? slotIndex - 1 : slotIndex
          const card = cards[cardIndex]
          if (!card) return null

          const isRevealed = card.isFlipped || card.isMatched
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(cardIndex)}
              id={`memory-card-${cardIndex}`}
              style={{
                width: '100%',
                height: '100%',
                aspectRatio: '1',
                borderRadius: '8px',
                cursor: isRevealed || isThinking || gameState !== 'playing' ? 'default' : 'pointer',
                position: 'relative',
                transformStyle: 'preserve-3d',
                transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
            >
              {/* Card Back */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, hsl(220 100% 45%), hsl(270 80% 45%))',
                  border: '1px solid hsl(220 100% 60% / 0.3)',
                  boxShadow: 'inset 0 0 10px rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  backfaceVisibility: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: `calc(${cardEmojiSize} * 1.1)`,
                  color: 'white',
                }}
              >
                ❓
              </div>

              {/* Card Front */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: card.isMatched ? 'hsl(220 20% 8%)' : 'hsl(220 20% 16%)',
                  border: card.isMatched ? '1px solid hsl(220 20% 12%)' : '1px solid hsl(220 15% 24%)',
                  borderRadius: '8px',
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: cardEmojiSize,
                  opacity: card.isMatched ? 0.45 : 1,
                  transition: 'opacity 0.3s ease',
                }}
              >
                {card.emoji}
              </div>
            </div>
          )
        })}
      </div>

      {/* Control Quit Button */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', borderRadius: 12 }}
          onClick={() => setGameState('setup')}
          id="memory-quit-btn"
        >
          🏳️ Back to Setup Menu
        </button>
      </div>
    </div>
  )
}
