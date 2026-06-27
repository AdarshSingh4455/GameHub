'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { useRouter } from 'next/navigation'
import { validateAndSuggest } from '@/lib/wordValidation'
import WordValidationModal from '@/components/shared/WordValidationModal'
import { LOCAL_CATEGORIES, WORD_CATEGORIES } from '../../../server/src/games/words'

type Difficulty = 'easy' | 'medium' | 'hard'

interface LocalStats {
  wordsSolved: number
  wins: number
  losses: number
  correctGuesses: number
  incorrectGuesses: number
  fastestSolve: number | null
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

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
]

export default function HangmanGame() {
  const router = useRouter()
  const { user, submitGameResult } = useGameSession()
  const { addToast } = useToast()

  // Game UI stages: 'LOBBY' | 'PLAYING'
  const [stage, setStage] = useState<'LOBBY' | 'PLAYING'>('LOBBY')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  // Gameplay State
  const [word, setWord] = useState('')
  const [category, setCategory] = useState('')
  const [guessedLetters, setGuessedLetters] = useState<string[]>([])
  const [maxLives, setMaxLives] = useState(8)
  const [lives, setLives] = useState(8)
  const [hintsLeft, setHintsLeft] = useState(1)
  const [startTime, setStartTime] = useState<number>(0)
  
  // Category Selection Intro State
  const [introStage, setIntroStage] = useState<'IDLE' | 'SELECTING' | 'REVEALING' | 'DONE'>('IDLE')
  const [tickerCategory, setTickerCategory] = useState('Selecting Category...')

  // Full Guess State
  const [fullGuessInput, setFullGuessInput] = useState('')
  const [showGuessModal, setShowGuessModal] = useState(false)
  const [fullGuessesLeft, setFullGuessesLeft] = useState(2)
  const [wordSuggestion, setWordSuggestion] = useState<{ original: string; corrected: string } | null>(null)

  // Local Statistics
  const [stats, setStats] = useState<LocalStats>(DEFAULT_STATS)
  const hasSubmittedResult = useRef(false)

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

  // Word selection based on difficulty & prevention of immediate repetition
  const selectRandomWord = (diff: Difficulty): { word: string; category: string } => {
    // 1. Pick a random category
    const randomCat = WORD_CATEGORIES[Math.floor(Math.random() * WORD_CATEGORIES.length)]
    const words = LOCAL_CATEGORIES[randomCat] || []

    // 2. Fetch previously used words for this category from localStorage
    const usedWordsKey = `gamehub_hangman_used_${randomCat.toLowerCase()}`
    let usedWords: string[] = []
    try {
      usedWords = JSON.parse(localStorage.getItem(usedWordsKey) || '[]')
    } catch {
      usedWords = []
    }

    // 3. Filter words matching length / difficulty bounds
    let lengthFiltered = words
    if (diff === 'easy') {
      lengthFiltered = words.filter(w => w.length <= 5)
    } else if (diff === 'medium') {
      lengthFiltered = words.filter(w => w.length >= 6 && w.length <= 7)
    } else {
      lengthFiltered = words.filter(w => w.length >= 8)
    }
    if (lengthFiltered.length === 0) lengthFiltered = words

    // 4. Exclude previously used words
    let availableWords = lengthFiltered.filter(w => !usedWords.includes(w.toLowerCase()))

    // 5. If all words in category consumed, reset the history
    if (availableWords.length === 0) {
      usedWords = []
      localStorage.removeItem(usedWordsKey)
      availableWords = lengthFiltered
    }

    // 6. Select random word
    const selected = availableWords[Math.floor(Math.random() * availableWords.length)].toUpperCase()

    // 7. Update used list
    usedWords.push(selected.toLowerCase())
    localStorage.setItem(usedWordsKey, JSON.stringify(usedWords))

    return { word: selected, category: randomCat }
  }

  // Start a new game with selection intro sequence
  const startNewGameFlow = () => {
    hasSubmittedResult.current = false
    setGuessedLetters([])
    setFullGuessesLeft(2)
    setFullGuessInput('')
    setShowGuessModal(false)

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

    // Trigger Category Intro Ticker
    setStage('PLAYING')
    setIntroStage('SELECTING')
    setTickerCategory('🎲 Selecting Category...')

    let tickerInterval: NodeJS.Timeout
    let counter = 0
    tickerInterval = setInterval(() => {
      setTickerCategory(WORD_CATEGORIES[counter % WORD_CATEGORIES.length])
      counter++
    }, 100)

    const { word: newWord, category: newCat } = selectRandomWord(difficulty)

    setTimeout(() => {
      clearInterval(tickerInterval)
      setCategory(newCat)
      setTickerCategory(`🐾 ${newCat}`)
      setIntroStage('REVEALING')

      setTimeout(() => {
        setWord(newWord)
        setIntroStage('DONE')
        setStartTime(Date.now())
      }, 900)
    }, 700)
  }

  // Listen to global replay triggers
  useEffect(() => {
    const handleReplay = () => {
      startNewGameFlow()
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [difficulty])

  // Guess Letter
  const handleLetterGuess = (letter: string) => {
    if (guessedLetters.includes(letter) || stage !== 'PLAYING' || introStage !== 'DONE') return

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
    if (hintsLeft <= 0 || stage !== 'PLAYING' || introStage !== 'DONE') return

    // Find letters in the word that haven't been guessed yet
    const unrevealed = word.split('').filter(char => !guessedLetters.includes(char))
    if (unrevealed.length === 0) return

    // Pick a random unrevealed letter
    const randomLetter = unrevealed[Math.floor(Math.random() * unrevealed.length)]
    
    setHintsLeft(prev => prev - 1)
    handleLetterGuess(randomLetter)
  }

  // Guess Word Submission
  const handleFullWordGuess = (overrideWord?: string) => {
    const raw = overrideWord || fullGuessInput
    const guess = raw.trim().toUpperCase()
    if (!guess) return

    // Only validate if this is not an override
    if (!overrideWord) {
      const suggestion = validateAndSuggest(guess)
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
    if (hasSubmittedResult.current) return
    hasSubmittedResult.current = true

    const endTime = Date.now()
    const timeTaken = Math.round((endTime - startTime) / 1000)

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
    const correctCount = word.split('').filter(c => guessedLetters.includes(c)).length
    const incorrectCount = maxLives - lives
    submitGameResult({
      gameSlug: 'hangman',
      result: isWin ? 'win' : 'loss',
      metadata: {
        score: isWin ? 100 : 0,
        gameMetadata: {
          difficulty,
          level: stats.wordsSolved + 1,
          timeSpent: timeTaken,
          incorrectGuesses: incorrectCount,
          correctGuesses: correctCount,
          isFullGuessWin: isWin && fullGuessesLeft < 2
        }
      }
    })
  }

  // Keyboard layout inputs
  useEffect(() => {
    const handlePhysicalKeyDown = (e: KeyboardEvent) => {
      if (stage !== 'PLAYING' || introStage !== 'DONE' || showGuessModal) return
      const key = e.key.toUpperCase()
      if (/^[A-Z]$/.test(key)) {
        handleLetterGuess(key)
      }
    }
    window.addEventListener('keydown', handlePhysicalKeyDown)
    return () => window.removeEventListener('keydown', handlePhysicalKeyDown)
  }, [guessedLetters, word, stage, introStage, showGuessModal])

  // Rendering Hangman SVG illustration with dynamic neon paths and animations
  const renderHangmanSVG = () => {
    const errorCount = maxLives - lives

    const alwaysDrawBase = maxLives <= 8
    const alwaysDrawPost = maxLives <= 8
    const alwaysDrawBeam = maxLives <= 6
    const alwaysDrawRope = maxLives <= 6

    return (
      <svg width="120" height="120" viewBox="0 0 100 100" style={{ margin: '0 auto', display: 'block' }}>
        {/* Base line */}
        {(alwaysDrawBase || errorCount >= 1) && (
          <line x1="10" y1="90" x2="90" y2="90" stroke="white" strokeWidth="4" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Vertical post */}
        {(alwaysDrawPost || errorCount >= 2) && (
          <line x1="30" y1="90" x2="30" y2="10" stroke="white" strokeWidth="4" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Horizontal beam */}
        {(alwaysDrawBeam || errorCount >= 3) && (
          <line x1="30" y1="10" x2="70" y2="10" stroke="white" strokeWidth="4" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Rope */}
        {(alwaysDrawRope || errorCount >= 4) && (
          <line x1="70" y1="10" x2="70" y2="25" stroke="hsl(38, 95%, 55%)" strokeWidth="2.5" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Head */}
        {((maxLives === 10 && errorCount >= 5) || (maxLives === 8 && errorCount >= 5) || (maxLives === 6 && errorCount >= 1)) && (
          <circle cx="70" cy="33" r="8" stroke="white" strokeWidth="3" fill="none" className="hangman-part" />
        )}
        {/* Torso */}
        {((maxLives === 10 && errorCount >= 6) || (maxLives === 8 && errorCount >= 6) || (maxLives === 6 && errorCount >= 2)) && (
          <line x1="70" y1="41" x2="70" y2="60" stroke="white" strokeWidth="3" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Left arm */}
        {((maxLives === 10 && errorCount >= 7) || (maxLives === 8 && errorCount >= 7) || (maxLives === 6 && errorCount >= 3)) && (
          <line x1="70" y1="48" x2="58" y2="43" stroke="white" strokeWidth="3" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Right arm */}
        {((maxLives === 10 && errorCount >= 8) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 4)) && (
          <line x1="70" y1="48" x2="82" y2="43" stroke="white" strokeWidth="3" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Left leg */}
        {((maxLives === 10 && errorCount >= 9) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 5)) && (
          <line x1="70" y1="60" x2="58" y2="75" stroke="white" strokeWidth="3" strokeLinecap="round" className="hangman-part" />
        )}
        {/* Right leg */}
        {((maxLives === 10 && errorCount >= 10) || (maxLives === 8 && errorCount >= 8) || (maxLives === 6 && errorCount >= 6)) && (
          <line x1="70" y1="60" x2="82" y2="75" stroke="white" strokeWidth="3" strokeLinecap="round" className="hangman-part" />
        )}
      </svg>
    )
  }

  const calcAccuracy = () => {
    const total = stats.correctGuesses + stats.incorrectGuesses
    if (total === 0) return 0
    return Math.round((stats.correctGuesses / total) * 100)
  }

  const isGameOver = lives <= 0 || !!(word && word.split('').every(char => guessedLetters.includes(char)))

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 1rem' }} className="animate-fadeIn">
      
      {/* Styles Injection */}
      <style>{`
        @keyframes hangman-draw {
          from { stroke-dashoffset: 120; }
          to { stroke-dashoffset: 0; }
        }
        .hangman-part {
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: hangman-draw 0.5s ease-out forwards;
          filter: drop-shadow(0 0 4px rgba(255,255,255,0.4));
        }
        .key-btn {
          height: 44px;
          border: 1px solid hsl(220 15% 18%);
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          background-color: hsl(220 20% 7%);
          color: hsl(220 10% 75%);
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }
        .key-btn:hover:not(:disabled) {
          background-color: hsl(220 20% 12%);
          border-color: hsl(220 10% 40%);
          transform: translateY(-2px);
        }
        .key-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
        @keyframes shake-wrong {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .wrong-shake {
          animation: shake-wrong 0.4s ease;
        }
        @keyframes category-bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); text-shadow: 0 0 15px hsl(270 80% 70% / 0.4); }
        }
        .cat-intro-text {
          animation: category-bounce 1s ease-in-out infinite;
        }
      `}</style>

      {stage === 'LOBBY' ? (
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

          <button onClick={startNewGameFlow} className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', borderRadius: 12, fontWeight: 700, fontSize: '1rem' }}>
            Start Solo Game 🚀
          </button>
        </div>
      ) : (
        <div className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: 16 }}>
          
          {introStage !== 'DONE' ? (
            /* Cool category intro spinner/reveal */
            <div style={{ padding: '4rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontSize: '3rem', animation: 'spin-slow 2s linear infinite' }}>🎲</div>
              <div
                className="cat-intro-text"
                style={{
                  fontSize: '1.8rem',
                  fontWeight: 950,
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {tickerCategory}
              </div>
              <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.85rem' }}>
                {introStage === 'SELECTING' ? 'Selecting Category...' : 'Prepare to Guess!'}
              </p>
            </div>
          ) : (
            /* Active Gameplay Board */
            <>
              {/* HUD / Indicators */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>🏷️ Category</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, textTransform: 'uppercase', color: 'hsl(270 80% 75%)' }}>
                    {category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.4rem 0.75rem', background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 10, fontSize: '0.8rem' }}>
                    ❤️ Lives: <strong style={{ color: lives <= 2 ? 'hsl(350 90% 60%)' : 'hsl(142 70% 50%)' }}>{lives}</strong>
                  </div>
                  {difficulty !== 'hard' && !isGameOver && (
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

              {/* Drawing Gallows */}
              <div style={{ padding: '0.75rem', background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12 }}>
                {renderHangmanSVG()}
              </div>

              {/* Word Display Board */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.35rem', flexWrap: 'wrap', margin: '0.4rem 0' }}>
                {word.split('').map((char, index) => {
                  const isRevealed = guessedLetters.includes(char) || lives <= 0
                  const isLostChar = !guessedLetters.includes(char) && lives <= 0
                  return (
                    <div
                      key={index}
                      style={{
                        width: 30, height: 40, borderBottom: '3px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.4rem', fontWeight: 900, 
                        color: isLostChar ? 'hsl(350 90% 60%)' : 'white',
                        borderColor: isRevealed ? (isLostChar ? 'hsl(350 90% 60%)' : 'hsl(220 100% 60%)') : 'hsl(220 15% 25%)',
                        transition: 'color 0.3s ease, border-color 0.3s ease',
                      }}
                    >
                      {isRevealed ? char : ''}
                    </div>
                  )
                })}
              </div>

              {/* Options buttons */}
              {!isGameOver && (
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
              )}

              {/* Keyboard Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                {KEYBOARD_ROWS.map((row, rIdx) => (
                  <div key={rIdx} style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem' }}>
                    {row.map(letter => {
                      const isGuessed = guessedLetters.includes(letter)
                      const isCorrect = isGuessed && word.includes(letter)

                      let bg = 'hsl(220 20% 7%)'
                      let text = 'hsl(220 10% 75%)'
                      let border = '1px solid hsl(220 15% 18%)'

                      if (isGuessed) {
                        bg = isCorrect ? 'hsl(142 70% 45% / 0.2)' : 'hsl(350 90% 60% / 0.15)'
                        text = isCorrect ? 'hsl(142 70% 55%)' : 'hsl(350 90% 65%)'
                        border = isCorrect ? '1px solid hsl(142 70% 45%)' : '1px solid hsl(350 90% 60%)'
                      }

                      return (
                        <button
                          key={letter}
                          onClick={() => handleLetterGuess(letter)}
                          disabled={isGuessed || isGameOver}
                          className="key-btn"
                          style={{
                            width: 'calc(10% - 2.5px)',
                            maxWidth: '46px',
                            backgroundColor: bg,
                            color: text,
                            border: border,
                            opacity: isGuessed ? 0.7 : 1,
                          }}
                        >
                          {letter}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
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
