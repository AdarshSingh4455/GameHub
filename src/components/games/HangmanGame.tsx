'use client'

import React, { useState, useEffect } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { CATEGORIES } from '@/lib/wordWizardDictionary'
import { validateAndSuggest } from '@/lib/wordValidation'
import WordValidationModal from '@/components/shared/WordValidationModal'
import { useRouter } from 'next/navigation'

type Difficulty = 'easy' | 'medium' | 'hard'

interface LocalStats {
  wordsSolved: number
  wins: number
  losses: number
  correctGuesses: number
  incorrectGuesses: number
  fastestSolve: number | null // in seconds
  currentStreak: number
  bestStreak: number
}

const DEFAULT_STATS: LocalStats = {
  wordsSolved: 0,
  wins: 0,
  losses: 0,
  correctGuesses: 0,
  incorrectGuesses: 0,
  fastestSolve: null,
  currentStreak: 0,
  bestStreak: 0,
}

export default function HangmanGame() {
  const router = useRouter()
  const { user, submitGameResult } = useGameSession()
  const { addToast } = useToast()

  // Game UI stages: 'LOBBY' | 'PLAYING' | 'GAMEOVER'
  const [stage, setStage] = useState<'LOBBY' | 'PLAYING' | 'GAMEOVER'>('LOBBY')
  const [activeMode, setActiveMode] = useState<'single' | 'multi'>('single')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  // Gameplay State
  const [word, setWord] = useState('')
  const [category, setCategory] = useState('')
  const [guessedLetters, setGuessedLetters] = useState<string[]>([])
  const [maxLives, setMaxLives] = useState(8)
  const [lives, setLives] = useState(8)
  const [hintsLeft, setHintsLeft] = useState(1)
  const [startTime, setStartTime] = useState<number>(0)
  const [endTime, setEndTime] = useState<number>(0)
  
  // Full Guess State
  const [fullGuessInput, setFullGuessInput] = useState('')
  const [showGuessModal, setShowGuessModal] = useState(false)
  const [fullGuessesLeft, setFullGuessesLeft] = useState(2)
  const [wordSuggestion, setWordSuggestion] = useState<{ original: string; corrected: string } | null>(null)

  // Local Statistics
  const [stats, setStats] = useState<LocalStats>(DEFAULT_STATS)

  // Multiplayer Lobby room state
  const [joinCode, setJoinCode] = useState('')
  const [lobbyLoading, setLobbyLoading] = useState(false)

  // Load local stats
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gamehub_hangman_stats')
      if (saved) {
        setStats(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load local Hangman stats', e)
    }
  }, [])

  // Word selection based on difficulty
  const selectRandomWord = (diff: Difficulty): { word: string; category: string } => {
    const allCategories = Object.keys(CATEGORIES)
    const randomCat = allCategories[Math.floor(Math.random() * allCategories.length)]
    const words = CATEGORIES[randomCat]

    // Filter words by length
    let filtered = words
    if (diff === 'easy') {
      filtered = words.filter(w => w.length <= 5)
    } else if (diff === 'medium') {
      filtered = words.filter(w => w.length >= 6 && w.length <= 7)
    } else {
      filtered = words.filter(w => w.length >= 8)
    }

    // Fallback if no words match filter
    if (filtered.length === 0) {
      filtered = words
    }

    const selectedWord = filtered[Math.floor(Math.random() * filtered.length)].toUpperCase()
    return { word: selectedWord, category: randomCat }
  }

  // Start a new game
  const startGame = () => {
    const { word: newWord, category: newCat } = selectRandomWord(difficulty)
    setWord(newWord)
    setCategory(newCat)
    setGuessedLetters([])
    
    let initialLives = 8
    let initialHints = 1
    if (difficulty === 'easy') {
      initialLives = 10
      initialHints = 2
    } else if (difficulty === 'hard') {
      initialLives = 6
      initialHints = 0
    }

    setMaxLives(initialLives)
    setLives(initialLives)
    setHintsLeft(initialHints)
    setFullGuessesLeft(2)
    setFullGuessInput('')
    setShowGuessModal(false)
    setStartTime(Date.now())
    setStage('PLAYING')
  }

  // Guess Letter
  const handleLetterGuess = (letter: string) => {
    if (guessedLetters.includes(letter) || stage !== 'PLAYING') return

    const newGuessed = [...guessedLetters, letter]
    setGuessedLetters(newGuessed)

    const isCorrect = word.includes(letter)

    // Update stats
    setStats(prev => {
      const updated = {
        ...prev,
        correctGuesses: prev.correctGuesses + (isCorrect ? 1 : 0),
        incorrectGuesses: prev.incorrectGuesses + (isCorrect ? 0 : 1)
      }
      localStorage.setItem('gamehub_hangman_stats', JSON.stringify(updated))
      return updated
    })

    if (!isCorrect) {
      const newLives = lives - 1
      setLives(newLives)
      if (newLives <= 0) {
        handleGameOver(false)
      }
    } else {
      // Check if all letters are solved
      const isSolved = word.split('').every(char => newGuessed.includes(char))
      if (isSolved) {
        handleGameOver(true)
      }
    }
  }

  // Hint execution
  const triggerHint = () => {
    if (hintsLeft <= 0 || stage !== 'PLAYING') return

    // Find letters in the word that haven't been guessed yet
    const unrevealed = word.split('').filter(char => !guessedLetters.includes(char))
    if (unrevealed.length === 0) return

    // Pick a random unrevealed letter
    const randomLetter = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    
    setHintsLeft(prev => prev - 1)
    handleLetterGuess(randomLetter)
  }

  // Guess Word Submission with optional corrected word
  const handleFullWordGuess = (overrideWord?: string) => {
    const raw = overrideWord || fullGuessInput
    const guess = raw.trim().toUpperCase()
    if (!guess) return

    // Only validate if this is not an override (i.e., not coming from the suggestion modal)
    if (!overrideWord) {
      const suggestion = validateAndSuggest(guess)
      // suggestion is a string (the corrected word) or null (valid / no suggestion)
      if (suggestion && suggestion.toUpperCase() !== guess) {
        setWordSuggestion({ original: guess, corrected: suggestion })
        return
      }
    }

    const isCorrect = guess === word
    const newGuessesLeft = fullGuessesLeft - 1
    setFullGuessesLeft(newGuessesLeft)
    setShowGuessModal(false)
    setWordSuggestion(null)

    if (isCorrect) {
      handleGameOver(true)
    } else {
      addToast('error', 'Wrong Guess ❌', `"${guess}" is not the secret word.`)
      if (newGuessesLeft <= 0) {
        handleGameOver(false)
      }
    }
    setFullGuessInput('')
  }

  // Game End Logic
  const handleGameOver = (isWin: boolean) => {
    const end = Date.now()
    setEndTime(end)
    setStage('GAMEOVER')

    const timeTaken = Math.round((end - startTime) / 1000)

    // Calculate update stats locally
    setStats(prev => {
      const isFastest = isWin && (prev.fastestSolve === null || timeTaken < prev.fastestSolve)
      const currentStreak = isWin ? prev.currentStreak + 1 : 0
      const bestStreak = Math.max(prev.bestStreak, currentStreak)
      const updated: LocalStats = {
        ...prev,
        wins: prev.wins + (isWin ? 1 : 0),
        losses: prev.losses + (isWin ? 0 : 1),
        wordsSolved: prev.wordsSolved + (isWin ? 1 : 0),
        fastestSolve: isFastest ? timeTaken : prev.fastestSolve,
        currentStreak,
        bestStreak
      }
      localStorage.setItem('gamehub_hangman_stats', JSON.stringify(updated))
      return updated
    })

    // Submit Game results to server
    if (user) {
      const correctCount = word.split('').filter(c => guessedLetters.includes(c)).length
      const incorrectCount = maxLives - lives
      submitGameResult({
        gameSlug: 'hangman',
        result: isWin ? 'win' : 'loss',
        metadata: {
          difficulty,
          score: isWin ? 100 : 0,
          timeTakenSecs: timeTaken,
          incorrectGuesses: incorrectCount,
          correctGuesses: correctCount,
          isFullGuessWin: isWin && fullGuessesLeft < 2
        }
      }).catch(err => console.error('Failed to submit Hangman SP results', err))
    }
  }

  // Rendering Hangman SVG illustration based on remaining lives
  const renderHangmanSVG = () => {
    // We map out the maximum lines or segments of the drawing
    const errorCount = maxLives - lives

    // Easy (10 lives), Medium (8 lives), Hard (6 lives)
    // Draw base, vertical post, beam, and rope based on starting lives count
    const alwaysDrawBase = maxLives <= 8
    const alwaysDrawPost = maxLives <= 8
    const alwaysDrawBeam = maxLives <= 6
    const alwaysDrawRope = maxLives <= 6

    return (
      <svg width="120" height="120" viewBox="0 0 100 100" style={{ margin: '0 auto', display: 'block' }}>
        {/* Base line */}
        {(alwaysDrawBase || errorCount >= 1) && (
          <line x1="10" y1="90" x2="90" y2="90" stroke="white" strokeWidth="4" strokeLinecap="round" />
        )}
        {/* Vertical post */}
        {(alwaysDrawPost || errorCount >= 2) && (
          <line x1="30" y1="90" x2="30" y2="10" stroke="white" strokeWidth="4" strokeLinecap="round" />
        )}
        {/* Horizontal beam */}
        {(alwaysDrawBeam || errorCount >= 3) && (
          <line x1="30" y1="10" x2="70" y2="10" stroke="white" strokeWidth="4" strokeLinecap="round" />
        )}
        {/* Rope */}
        {(alwaysDrawRope || errorCount >= 4) && (
          <line x1="70" y1="10" x2="70" y2="25" stroke="white" strokeWidth="2" strokeLinecap="round" />
        )}
        {/* Head */}
        {((maxLives === 10 && errorCount >= 5) || (maxLives === 8 && errorCount >= 5) || (maxLives === 6 && errorCount >= 1)) && (
          <circle cx="70" cy="33" r="8" stroke="white" strokeWidth="3" fill="none" />
        )}
        {/* Torso */}
        {((maxLives === 10 && errorCount >= 6) || (maxLives === 8 && errorCount >= 6) || (maxLives === 6 && errorCount >= 2)) && (
          <line x1="70" y1="41" x2="70" y2="60" stroke="white" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* Left arm */}
        {((maxLives === 10 && errorCount >= 7) || (maxLives === 8 && errorCount >= 7) || (maxLives === 6 && errorCount >= 3)) && (
          <line x1="70" y1="48" x2="58" y2="43" stroke="white" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* Right arm */}
        {((maxLives === 10 && errorCount >= 8) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 4)) && (
          <line x1="70" y1="48" x2="82" y2="43" stroke="white" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* Left leg */}
        {((maxLives === 10 && errorCount >= 9) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 5)) && (
          <line x1="70" y1="60" x2="58" y2="75" stroke="white" strokeWidth="3" strokeLinecap="round" />
        )}
        {/* Right leg */}
        {((maxLives === 10 && errorCount >= 10) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 6)) && (
          <line x1="70" y1="60" x2="82" y2="75" stroke="white" strokeWidth="3" strokeLinecap="round" />
        )}
      </svg>
    )
  }

  // Multiplayer Actions
  const createOnlineRoom = () => {
    setLobbyLoading(true)
    router.push('/dashboard/multiplayer?action=create&game=hangman')
  }

  const joinOnlineRoom = () => {
    if (!joinCode.trim()) {
      addToast('warning', 'Missing Code', 'Please enter a room code.')
      return
    }
    router.push(`/dashboard/multiplayer?action=join&game=hangman&code=${joinCode.trim().toUpperCase()}`)
  }

  // Accuracy Calculation helper
  const calcAccuracy = () => {
    const total = stats.correctGuesses + stats.incorrectGuesses
    if (total === 0) return 0
    return Math.round((stats.correctGuesses / total) * 100)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }} className="animate-fadeIn">
      {/* Mode Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'hsl(220 20% 7%)', padding: '0.25rem', borderRadius: 12, border: '1px solid hsl(220 15% 15%)' }}>
        <button
          onClick={() => setActiveMode('single')}
          style={{
            flex: 1, padding: '0.6rem', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            backgroundColor: activeMode === 'single' ? 'hsl(220 100% 60%)' : 'transparent',
            color: activeMode === 'single' ? 'white' : 'hsl(220 10% 60%)',
            transition: 'all 0.2s'
          }}
        >
          Solo Practice
        </button>
        <button
          onClick={() => setActiveMode('multi')}
          style={{
            flex: 1, padding: '0.6rem', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            backgroundColor: activeMode === 'multi' ? 'hsl(220 100% 60%)' : 'transparent',
            color: activeMode === 'multi' ? 'white' : 'hsl(220 10% 60%)',
            transition: 'all 0.2s'
          }}
        >
          Multiplayer PvP
        </button>
      </div>

      {activeMode === 'single' ? (
        <>
          {stage === 'LOBBY' && (
            <div className="card glass text-center" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: 16 }}>
              <div>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>🪓</span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Hangman Classic</h2>
                <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                  Guess the hidden word before running out of attempts!
                </p>
              </div>

              {/* Difficulty Selection */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Select Difficulty
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {(['easy', 'medium', 'hard'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        padding: '0.6rem', border: '1px solid', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer',
                        borderColor: difficulty === d ? 'hsl(220 100% 65%)' : 'hsl(220 15% 20%)',
                        backgroundColor: difficulty === d ? 'hsl(220 100% 60% / 0.15)' : 'hsl(220 20% 8%)',
                        color: difficulty === d ? 'white' : 'hsl(220 10% 60%)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats Card */}
              <div style={{ background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12, padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{stats.wins}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)' }}>Wins</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{stats.losses}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)' }}>Losses</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{calcAccuracy()}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)' }}>Accuracy</div>
                </div>
              </div>

              <button onClick={startGame} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', borderRadius: 12, fontWeight: 700, fontSize: '1rem' }}>
                Start Game 🚀
              </button>
            </div>
          )}

          {stage === 'PLAYING' && (
            <div className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: 16 }}>
              {/* HUD / Indicators */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Category</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'capitalize', color: 'hsl(270 80% 75%)' }}>
                    {category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.4rem 0.75rem', background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 10, fontSize: '0.8rem' }}>
                    ❤️ Lives: <strong style={{ color: 'hsl(350 90% 60%)' }}>{lives}</strong>
                  </div>
                  {difficulty !== 'hard' && (
                    <button
                      onClick={triggerHint}
                      disabled={hintsLeft <= 0}
                      className={`btn btn-sm ${hintsLeft > 0 ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ borderRadius: 10, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                    >
                      💡 Hint ({hintsLeft})
                    </button>
                  )}
                </div>
              </div>

              {/* SVG drawing */}
              <div style={{ padding: '1rem', background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12 }}>
                {renderHangmanSVG()}
              </div>

              {/* Secret Word board representation */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
                {word.split('').map((char, index) => {
                  const isRevealed = guessedLetters.includes(char)
                  return (
                    <div
                      key={index}
                      style={{
                        width: 32, height: 42, borderBottom: '3px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem', fontWeight: 800, color: 'white',
                        borderColor: isRevealed ? 'hsl(220 100% 60%)' : 'hsl(220 15% 25%)',
                      }}
                    >
                      {isRevealed ? char : ''}
                    </div>
                  )
                })}
              </div>

              {/* Options */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowGuessModal(true)}
                  className="btn btn-secondary"
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.82rem', padding: '0.5rem' }}
                >
                  💡 Guess Word ({fullGuessesLeft} left)
                </button>
                <button
                  onClick={() => handleGameOver(false)}
                  className="btn btn-ghost"
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.82rem', padding: '0.5rem', border: '1px solid hsl(220 15% 18%)' }}
                >
                  🏳️ Give Up
                </button>
              </div>

              {/* Interactive Virtual Keyboard */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
                    const isGuessed = guessedLetters.includes(letter)
                    const isCorrect = isGuessed && word.includes(letter)
                    
                    let bg = 'hsl(220 20% 9%)'
                    let text = 'hsl(220 10% 70%)'
                    if (isGuessed) {
                      bg = isCorrect ? 'hsl(142 70% 45% / 0.15)' : 'hsl(350 90% 60% / 0.12)'
                      text = isCorrect ? 'hsl(142 70% 55%)' : 'hsl(350 90% 65%)'
                    }

                    return (
                      <button
                        key={letter}
                        onClick={() => handleLetterGuess(letter)}
                        disabled={isGuessed}
                        style={{
                          height: 38, border: '1px solid hsl(220 15% 18%)', borderRadius: 8, fontSize: '0.9rem', fontWeight: 800, cursor: isGuessed ? 'default' : 'pointer',
                          backgroundColor: bg,
                          color: text,
                          borderColor: isGuessed ? 'transparent' : 'hsl(220 15% 18%)',
                          opacity: isGuessed ? 0.6 : 1,
                          transition: 'all 0.15s'
                        }}
                      >
                        {letter}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {stage === 'GAMEOVER' && (
            <div className="card glass text-center" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: 16 }}>
              {lives > 0 ? (
                <div>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(142 70% 50%)' }}>Word Solved!</h2>
                  <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    Congratulations! You correctly guessed the word.
                  </p>
                </div>
              ) : (
                <div>
                  <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>💀</span>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'hsl(350 90% 55%)' }}>Defeated</h2>
                  <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    You ran out of lives! Better luck next time.
                  </p>
                </div>
              )}

              <div style={{ background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'hsl(220 10% 55%)' }}>Correct Word:</span>
                  <strong style={{ color: 'white', letterSpacing: '0.05em' }}>{word}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'hsl(220 10% 55%)' }}>Solve Time:</span>
                  <strong style={{ color: 'white' }}>{Math.round((endTime - startTime) / 1000)}s</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'hsl(220 10% 55%)' }}>Streak:</span>
                  <strong style={{ color: 'hsl(45 100% 55%)' }}>🔥 {stats.currentStreak}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={startGame} className="btn btn-primary" style={{ flex: 2, padding: '0.75rem', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem' }}>
                  Play Again 🔄
                </button>
                <button onClick={() => setStage('LOBBY')} className="btn btn-secondary" style={{ flex: 1, padding: '0.75rem', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem' }}>
                  Lobby
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Multiplayer Setup View */
        <div className="card glass text-center" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: 16 }}>
          <div>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>⚔️</span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Hangman Showdown</h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Create a room, invite a friend, and take turns guessing each other&apos;s secret word!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button onClick={createOnlineRoom} disabled={lobbyLoading} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem' }}>
              {lobbyLoading ? 'Creating Room...' : 'Create Multiplayer Room 🔑'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(220 15% 15%)' }} />
              <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 45%)', textTransform: 'uppercase', fontWeight: 700 }}>Or Join Code</span>
              <div style={{ flex: 1, height: 1, backgroundColor: 'hsl(220 15% 15%)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                maxLength={6}
                placeholder="ROOM CODE"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{
                  flex: 2, padding: '0.75rem', borderRadius: 12, backgroundColor: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 18%)',
                  color: 'white', fontWeight: 800, textAlign: 'center', letterSpacing: '0.1em', fontSize: '1.1rem', outline: 'none'
                }}
              />
              <button onClick={joinOnlineRoom} className="btn btn-secondary" style={{ flex: 1, borderRadius: 12, fontWeight: 700, fontSize: '0.9rem' }}>
                Join Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Guess Modal Overlay */}
      {showGuessModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card glass" style={{ background: 'hsl(222 18% 12% / 0.95)', border: '1px solid hsl(220 15% 22%)', borderRadius: 20, padding: '2rem', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="text-center">
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.25rem' }}>💡</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Guess the Entire Word</h3>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                Warning: If you run out of guess attempts ({fullGuessesLeft} left), you will immediately lose the match!
              </p>
            </div>
            
            <input
              type="text"
              placeholder="ENTER FULL WORD"
              value={fullGuessInput}
              onChange={e => setFullGuessInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 12, backgroundColor: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 18%)',
                color: 'white', fontWeight: 800, textAlign: 'center', letterSpacing: '0.05em', outline: 'none', fontSize: '1.2rem'
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => handleFullWordGuess()} className="btn btn-primary" style={{ flex: 2, padding: '0.65rem', borderRadius: 10, fontWeight: 700 }}>
                Submit Guess 🚀
              </button>
              <button onClick={() => setShowGuessModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem', borderRadius: 10, fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Word Validation / Spelling Suggestion Modal */}
      {wordSuggestion && (
        <WordValidationModal
          isOpen={!!wordSuggestion}
          originalWord={wordSuggestion.original}
          suggestedWord={wordSuggestion.corrected}
          onUseSuggestion={() => {
            const corrected = wordSuggestion.corrected.toUpperCase()
            setWordSuggestion(null)
            setFullGuessInput(corrected)
            handleFullWordGuess(corrected)
          }}
          onKeepOriginal={() => {
            const original = wordSuggestion.original
            setWordSuggestion(null)
            handleFullWordGuess(original)
          }}
        />
      )}
    </div>
  )
}
