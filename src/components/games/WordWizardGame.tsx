import { HeartIcon, BotIcon, GiftIcon, TargetIcon, GlobeIcon, FlaskIcon, PlayIcon, CarIcon, FileTextIcon, SparklesIcon, TrophyIcon, CalendarIcon, TimerIcon, HelpIcon } from '@/components/shared/Icons'
// Word Wizard Premium Game Component
// Implements Boggle/Word Hunt gameplay with Magic Library theme, full state orchestration, daily modifiers, and GameSession integration

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import {
  generateBoard,
  findAllWords,
  calculateScore,
  findWordPath
} from '@/lib/wordWizardEngine'
import { isValidWord, getWordCategory, CATEGORIES } from '@/lib/wordWizardDictionary'
import { getDailyModifier, getDailySeed, getModifierDescription, DailyModifier } from '@/lib/wordWizardDaily'
import WordWizardBoard from './WordWizardBoard'
import WordWizardHUD from './WordWizardHUD'
import { WordWizardParticles, ParticlesRef } from './WordWizardParticles'

const QUEST_CATEGORIES = ['nature', 'animals', 'food', 'sports', 'countries', 'science', 'movies', 'vehicles']

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'nature': return <HeartIcon size={14} style={{ color: 'hsl(142 70% 55%)' }} className="inline mr-1" />
    case 'animals': return <BotIcon size={14} style={{ color: 'hsl(270 80% 65%)' }} className="inline mr-1" />
    case 'food': return <GiftIcon size={14} style={{ color: 'hsl(350 80% 55%)' }} className="inline mr-1" />
    case 'sports': return <TargetIcon size={14} style={{ color: 'hsl(220 100% 65%)' }} className="inline mr-1" />
    case 'countries': return <GlobeIcon size={14} style={{ color: 'hsl(180 70% 50%)' }} className="inline mr-1" />
    case 'science': return <FlaskIcon size={14} style={{ color: 'hsl(280 80% 60%)' }} className="inline mr-1" />
    case 'movies': return <PlayIcon size={14} style={{ color: 'hsl(340 85% 60%)' }} className="inline mr-1" />
    case 'vehicles': return <CarIcon size={14} style={{ color: 'hsl(45 100% 55%)' }} className="inline mr-1" />
    default: return <FileTextIcon size={14} className="inline mr-1" />
  }
}

export default function WordWizardGame() {
  const { submitGameResult, isLoading } = useGameSession()
  const particlesRef = useRef<ParticlesRef | null>(null)

  // Game setup states
  const [gameState, setGameState] = useState<'SETUP' | 'PLAYING' | 'GAMEOVER'>('SETUP')
  const [mode, setMode] = useState<'classic' | 'endless' | 'daily'>('classic')
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal')

  // Board and puzzle states
  const [board, setBoard] = useState<string[][]>([])
  const [specialTiles, setSpecialTiles] = useState<Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'>>({})
  const [allValidWords, setAllValidWords] = useState<Set<string>>(new Set())
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set())
  const [wordPath, setWordPath] = useState<[number, number][]>([])

  // HUD stats
  const [score, setScore] = useState<number>(0)
  const [combo, setCombo] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(60)
  const [maxTime, setMaxTime] = useState<number>(60)
  const [hintsRemaining, setHintsRemaining] = useState<number>(3)
  const [activeModifier, setActiveModifier] = useState<DailyModifier | null>(null)

  // Objective-based target states
  const [targetCategory, setTargetCategory] = useState<string>('nature')
  const [targetWords, setTargetWords] = useState<string[]>([])
  const [foundTargetWords, setFoundTargetWords] = useState<Set<string>>(new Set())
  const [objectiveCompleted, setObjectiveCompleted] = useState<boolean>(false)
  const [activeHint, setActiveHint] = useState<{ word: string; level: number } | null>(null)

  // Game over stats
  const [finalScore, setFinalScore] = useState<number>(0)
  const [maxComboReached, setMaxComboReached] = useState<number>(0)

  // Refs for tracking score/combo timings
  const lastWordTime = useRef<number>(0)
  const maxComboRef = useRef<number>(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)

  const foundWordsRef = useRef<Set<string>>(new Set())
  const allWordsRef = useRef<Set<string>>(new Set())
  const targetCategoryRef = useRef<string>('nature')
  const targetWordsRef = useRef<string[]>([])
  const foundTargetWordsRef = useRef<Set<string>>(new Set())
  const objectiveCompletedRef = useRef<boolean>(false)
  const totalAttemptsRef = useRef(0)
  const correctAttemptsRef = useRef(0)
  const activeHintRef = useRef<{ word: string; level: number } | null>(null)
  const boardRef = useRef<string[][]>([])
  const scoreRef = useRef<number>(0)

  useEffect(() => { foundWordsRef.current = foundWords }, [foundWords])
  useEffect(() => { allWordsRef.current = allValidWords }, [allValidWords])
  useEffect(() => { targetCategoryRef.current = targetCategory }, [targetCategory])
  useEffect(() => { targetWordsRef.current = targetWords }, [targetWords])
  useEffect(() => { foundTargetWordsRef.current = foundTargetWords }, [foundTargetWords])
  useEffect(() => { objectiveCompletedRef.current = objectiveCompleted }, [objectiveCompleted])
  useEffect(() => { activeHintRef.current = activeHint }, [activeHint])
  useEffect(() => { boardRef.current = board }, [board])
  useEffect(() => { scoreRef.current = score }, [score])

  // Start a fresh game
  const startGame = useCallback(() => {
    totalAttemptsRef.current = 0
    correctAttemptsRef.current = 0
    let localDifficulty = difficulty
    let selectedModifier: DailyModifier | null = null
    let seed = Math.floor(Math.random() * 1000000)

    if (mode === 'daily') {
      const mod = getDailyModifier()
      selectedModifier = mod
      seed = getDailySeed()
      if (mod === 'giant_board') {
        localDifficulty = 'hard'
        setDifficulty('hard')
      } else {
        localDifficulty = 'normal'
        setDifficulty('normal')
      }
    }

    const chosenCategory = mode === 'daily' ? 'countries' : QUEST_CATEGORIES[Math.floor(Math.random() * QUEST_CATEGORIES.length)]
    
    const size = localDifficulty === 'easy' ? 4 : localDifficulty === 'normal' ? 5 : 6
    const targetCount = localDifficulty === 'hard' ? 8 : 4
    
    // Choose target words first!
    const minLength = 3
    const maxLength = localDifficulty === 'easy' ? 5 : localDifficulty === 'normal' ? 6 : 7

    const catWords = (CATEGORIES[chosenCategory] || []).filter(
      w => w.length >= minLength && w.length <= maxLength
    )

    let selectedTargets: string[] = []
    let boardData: any = null
    let validWords = new Set<string>()

    let found = false
    for (let attempt = 0; attempt < 100; attempt++) {
      const shuffledCatWords = [...catWords].sort(() => Math.random() - 0.5)
      selectedTargets = shuffledCatWords.slice(0, targetCount)
      
      if (selectedTargets.length < targetCount) {
        const remaining = targetCount - selectedTargets.length
        const otherWords = (CATEGORIES[chosenCategory] || []).filter(w => !selectedTargets.includes(w))
        selectedTargets.push(...otherWords.slice(0, remaining))
      }

      const attemptSeed = seed + attempt * 12345
      const tempBoard = generateBoard(size, localDifficulty, attemptSeed, selectedModifier || undefined, selectedTargets)
      const tempValid = findAllWords(tempBoard.grid)

      const allTraceable = selectedTargets.every(w => findWordPath(w, tempBoard.grid) !== null)
      if (allTraceable) {
        boardData = tempBoard
        validWords = tempValid
        found = true
        break
      }
    }

    if (!found || !boardData) {
      const shuffledCatWords = [...catWords].sort(() => Math.random() - 0.5)
      selectedTargets = shuffledCatWords.slice(0, targetCount)
      boardData = generateBoard(size, localDifficulty, seed, selectedModifier || undefined, selectedTargets)
      validWords = findAllWords(boardData.grid)
    }

    console.log('[WW TARGET COUNT] ' + JSON.stringify({
      difficulty: localDifficulty,
      targetCount: selectedTargets.length,
      targetWords: selectedTargets
    }))

    setBoard(boardData.grid)
    setSpecialTiles(boardData.specialTiles)
    setAllValidWords(validWords)
    setFoundWords(new Set())
    setWordPath([])

    // Set Objective targets
    setTargetCategory(chosenCategory)
    setTargetWords(selectedTargets)
    setFoundTargetWords(new Set())
    setObjectiveCompleted(false)
    setActiveHint(null)

    // Set Time limit
    let initialTime = 60
    if (selectedModifier === 'time_attack') {
      initialTime = 40
    }
    
    setTimeLeft(mode === 'endless' ? null : initialTime)
    setMaxTime(initialTime)

    // Reset scores/combos
    setScore(0)
    setCombo(0)
    setHintsRemaining(selectedModifier === 'no_hints' ? 0 : 3)
    setActiveModifier(selectedModifier)

    lastWordTime.current = 0
    maxComboRef.current = 0
    
    setGameState('PLAYING')
  }, [difficulty, mode])

  // Handle word submission
  const handleSubmitWord = useCallback((word: string, path: [number, number][]) => {
    setWordPath([]) // Reset line drawing

    const lowerWord = word.toLowerCase()
    
    // 1. Validation
    if (lowerWord.length < 3) return
    totalAttemptsRef.current++

    if (!isValidWord(lowerWord)) {
      particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 150, 'Not a Word', '#ef4444')
      return
    }

    if (foundWords.has(lowerWord)) {
      particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 150, 'Already Found', '#9ca3af')
      return
    }

    correctAttemptsRef.current++

    // 2. Score calculation
    const scoreResult = calculateScore(lowerWord, path, specialTiles)
    
    // Combo math (4-second decay window)
    const now = Date.now()
    let newCombo = 1
    if (now - lastWordTime.current < 4000) {
      newCombo = combo + 1
    }
    lastWordTime.current = now
    setCombo(newCombo)
    if (newCombo > maxComboRef.current) {
      maxComboRef.current = newCombo
    }

    // Combo Frenzy gives double combo multipliers
    const comboFactor = activeModifier === 'combo_frenzy' ? 0.4 : 0.2
    const finalScoreIncrease = Math.floor(scoreResult.totalBeforeCombo * (1 + (newCombo - 1) * comboFactor))

    // Target Words objective check
    let isTarget = false
    if (targetWords.includes(lowerWord) && !foundTargetWords.has(lowerWord)) {
      isTarget = true
      setFoundTargetWords((prev) => {
        const next = new Set(prev)
        next.add(lowerWord)
        
        // Check Category Completion
        if (next.size === targetWords.length) {
          setObjectiveCompleted(true)
          setScore((s) => s + 1000) // Score bonus +1000
          
          // Trigger particle celebration
          for (let i = 0; i < 6; i++) {
            setTimeout(() => {
              particlesRef.current?.addBurst(
                window.innerWidth / 2 + (Math.random() - 0.5) * 200,
                window.innerHeight / 2 - 150 + (Math.random() - 0.5) * 100,
                '#fbbf24',
                22
              )
            }, i * 200)
          }
        }
        return next
      })
    }

    setScore((prev) => prev + finalScoreIncrease)
    setFoundWords((prev) => {
      const next = new Set(prev)
      next.add(lowerWord)
      return next
    })

    // Special tiles side effects
    for (const [r, c] of path) {
      const key = `${r},${c}`
      const type = specialTiles[key]
      if (type === 'freeze' && mode !== 'endless') {
        // Freeze timer (add 5s)
        setTimeLeft((prev) => (prev !== null ? Math.min(maxTime, prev + 5) : null))
        particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 180, 'Freeze +5s!', '#22d3ee')
      } else if (type === 'arcane' && activeModifier !== 'no_hints') {
        // Grant extra hint
        setHintsRemaining((prev) => prev + 1)
        particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 180, 'Extra Hint!', '#a78bfa')
      }
    }

    // Time Attack daily modifier grants +3s per word found
    if (activeModifier === 'time_attack') {
      setTimeLeft((prev) => (prev !== null ? Math.min(maxTime, prev + 3) : null))
    }

    // Success bursts and float text
    particlesRef.current?.addBurst(window.innerWidth / 2, window.innerHeight / 2 - 100, isTarget ? '#fef08a' : '#34d399', 18)
    particlesRef.current?.addFloatingText(
      window.innerWidth / 2 - 100,
      window.innerHeight / 2 - 150,
      `+${finalScoreIncrease} ${isTarget ? 'Target! ✨' : ''}`,
      isTarget ? '#fef08a' : '#34d399'
    )
  }, [foundWords, specialTiles, combo, activeModifier, targetWords, foundTargetWords, mode, maxTime])

  // Trigger hint (Progressive level upgrade)
  const handleUseHint = () => {
    if (hintsRemaining <= 0 || activeModifier === 'no_hints') return

    // Find target words that have not been found yet
    const unfoundTargets = targetWords.filter((w) => !foundTargetWords.has(w))
    if (unfoundTargets.length === 0) {
      particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 150, 'All targets found!', '#fbbf24')
      return
    }

    let hintWord = activeHint?.word || ''
    let nextLevel = 1

    if (!hintWord || foundTargetWords.has(hintWord)) {
      hintWord = unfoundTargets[Math.floor(Math.random() * unfoundTargets.length)]
      nextLevel = 1
    } else {
      if (activeHint && activeHint.level < 3) {
        nextLevel = activeHint.level + 1
      } else {
        const otherUnfound = unfoundTargets.filter(w => w !== hintWord)
        if (otherUnfound.length > 0) {
          hintWord = otherUnfound[Math.floor(Math.random() * otherUnfound.length)]
          nextLevel = 1
        } else {
          particlesRef.current?.addFloatingText(window.innerWidth / 2 - 100, window.innerHeight / 2 - 150, 'Max hints reached!', '#fbbf24')
          return
        }
      }
    }

    setHintsRemaining((prev) => prev - 1)
    setActiveHint({ word: hintWord, level: nextLevel })

    let message = ''
    if (nextLevel === 1) {
      message = 'Hint 1: A hidden word starts here'
    } else if (nextLevel === 2) {
      message = `Hint 2: Word Length: ${hintWord.length}`
    } else if (nextLevel === 3) {
      message = 'Hint 3: Full path glow'
    }

    particlesRef.current?.addFloatingText(
      window.innerWidth / 2 - 100,
      window.innerHeight / 2 - 150,
      message,
      '#a78bfa'
    )
  }

  // End the game
  const endGame = useCallback(() => {
    console.log('[E2E LOG] game over triggered')
    setGameState('SETUP')
    setFinalScore(score)
    setMaxComboReached(maxComboRef.current)

    // Submit score to database using session context
    const gameSlug = 'word-wizard'
    const result = score >= 1000 ? 'win' : 'loss'
    
    // Save metadata
    const rareWordsCount = Array.from(foundWords).filter(w => 
      w.split('').some(char => 'jqxzkvwyfhpb'.includes(char))
    ).length
    const maxWordLength = foundWords.size > 0 
      ? Math.max(...Array.from(foundWords).map(w => w.length)) 
      : 0

    const totalAttempts = totalAttemptsRef.current
    const correctAttempts = correctAttemptsRef.current
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

    const longestWord = foundWords.size > 0
      ? Array.from(foundWords).reduce((a, b) => a.length > b.length ? a : b, '')
      : 'None'

    const customTitle = result === 'win' ? 'Victory!' : 'Game Over'
    const customSubtitle = `Found ${foundWords.size} Word${foundWords.size !== 1 ? 's' : ''} • Accuracy: ${accuracy}%`

    const metadata = {
      score,
      customTitle,
      customSubtitle,
      statistics: [
        { label: 'Words Found', value: foundWords.size, color: '#fbbf24' },
        { label: 'Longest Word', value: longestWord, color: '#10b981' },
        { label: 'Accuracy', value: `${accuracy}%`, color: '#ec4899' },
        { label: 'Combo', value: `x${maxComboRef.current}`, color: '#a855f7' },
        { label: 'Total Score', value: score, color: '#38bdf8' },
      ],
      gameMetadata: {
        mode: mode,
        difficulty: difficulty,
        maxCombo: maxComboRef.current,
        wordsFound: foundWords.size,
        modifier: activeModifier,
        hintsUsed: activeModifier === 'no_hints' ? 0 : 3 - hintsRemaining,
        rareWordsCount,
        maxWordLength,
      }
    }

    console.log('[E2E LOG] submitGameResult called')
    submitGameResult({
      gameSlug,
      result,
      metadata
    }).then(() => {
      console.log('[E2E LOG] submitGameResult resolved')
    }).catch((err) => console.error('[SUBMIT MATCH ERROR]', err))
  }, [score, foundWords, difficulty, mode, hintsRemaining, activeModifier, submitGameResult])

  // Main game tick loop (updates timers, handles combo decay only)
  useEffect(() => {
    if (gameState !== 'PLAYING') return
    if (mode === 'endless') return

    timerInterval.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(timerInterval.current!)
          return 0
        }
        
        // Decay combo if 4 seconds passed since last word
        if (Date.now() - lastWordTime.current > 4000) {
          setCombo(0)
        }

        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [gameState, mode])

  // Watch timeLeft for endGame to prevent rendering-phase state updates in React (Critical Warning Fix)
  useEffect(() => {
    if (gameState === 'PLAYING' && timeLeft !== null && timeLeft <= 0) {
      endGame()
    }
  }, [timeLeft, gameState, endGame])

  // Expose API for Puppeteer E2E testing
  useEffect(() => {
    if (typeof window === 'undefined') return
    const api: Record<string, any> = {
      specialTiles,
      submitWord: (word: string) => {
        const path = findWordPath(word, boardRef.current)
        if (path) {
          handleSubmitWord(word, path)
        } else {
          // Fallback dummy path of correct length if E2E passes arbitrary word
          const dummyPath: [number, number][] = Array.from({ length: word.length }, (_, i) => [0, i % boardRef.current.length])
          handleSubmitWord(word, dummyPath)
        }
      },
      triggerGameOver: () => {
        if (gameState === 'PLAYING') {
          endGame()
        }
      }
    }

    Object.defineProperties(api, {
      grid:               { get: () => boardRef.current,         configurable: true, enumerable: true },
      score:              { get: () => scoreRef.current,         configurable: true, enumerable: true },
      foundWords:         { get: () => Array.from(foundWordsRef.current), configurable: true, enumerable: true },
      allWords:           { get: () => Array.from(allWordsRef.current), configurable: true, enumerable: true },
      targetCategory:     { get: () => targetCategoryRef.current, configurable: true, enumerable: true },
      targets:            { get: () => targetWordsRef.current,   configurable: true, enumerable: true },
      targetWords:        { get: () => targetWordsRef.current,   configurable: true, enumerable: true },
      foundTargetWords:   { get: () => Array.from(foundTargetWordsRef.current), configurable: true, enumerable: true },
      foundWordsCount:    { get: () => foundTargetWordsRef.current.size, configurable: true, enumerable: true },
      targetWordsCount:   { get: () => targetWordsRef.current.length, configurable: true, enumerable: true },
      objectiveCompleted: { get: () => objectiveCompletedRef.current, configurable: true, enumerable: true },
      categoryCompleted:  { get: () => objectiveCompletedRef.current, configurable: true, enumerable: true },
      activeHint:         { get: () => activeHintRef.current,    configurable: true, enumerable: true },
    })

    ;(window as any).__debug_word_wizard = api
  }, [specialTiles, gameState, endGame, handleSubmitWord])

  // Listen for global game replay events
  useEffect(() => {
    const handleReplay = () => {
      startGame()
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [startGame])

  // Compute hint highlights
  const hintHighlights = React.useMemo<[number, number][]>(() => {
    if (!activeHint || !activeHint.word || foundTargetWords.has(activeHint.word)) return []
    const path = findWordPath(activeHint.word, board)
    if (!path) return []
    if (activeHint.level === 1) {
      return [path[0]]
    }
    if (activeHint.level === 2) {
      return [path[0], path[1]]
    }
    if (activeHint.level === 3) {
      return path
    }
    return []
  }, [activeHint, board, foundTargetWords])

  console.log('[WW TARGETS] ' + JSON.stringify({
    category: targetCategory,
    foundWordsCount: foundTargetWords.size,
    targetWordsCount: targetWords.length,
    targetWords
  }))

  const hintMessage = React.useMemo(() => {
    if (!activeHint || !activeHint.word) return ''
    if (activeHint.level === 1) {
      return 'A hidden word starts here'
    } else if (activeHint.level === 2) {
      return `Word Length: ${activeHint.word.length}`
    } else if (activeHint.level === 3) {
      return 'Hint 3: Full path glow'
    }
    return ''
  }, [activeHint])

  console.log('[WW HINT] ' + JSON.stringify({
    level: activeHint?.level,
    word: activeHint?.word,
    message: hintMessage,
    highlights: hintHighlights
  }))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
        maxWidth: 550,
        margin: '0 auto',
        padding: '16px 8px',
        color: '#f8fafc',
        position: 'relative',
        minHeight: 650,
      }}
    >
      <WordWizardParticles ref={particlesRef} />

      {/* SETUP STAGE */}
      {gameState === 'SETUP' && (
        <div
          id="ww-setup-menu"
          className="card glass"
          style={{
            width: '100%',
            padding: '2rem 1.5rem',
            background: 'linear-gradient(135deg, hsl(222, 20%, 9%), hsl(222, 18%, 13%))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><SparklesIcon size={48} className="text-purple-400" /></div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
              Word Wizard
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', marginTop: 4 }}>
              Unlock the secrets of the Magic Library by spelling words on the grid.
            </p>
          </div>

          {/* Mode Selector */}
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>
              Game Mode
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
              {(['classic', 'endless', 'daily'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    textTransform: 'capitalize',
                    fontSize: '0.85rem',
                    padding: '8px 4px',
                    borderRadius: 12,
                    fontWeight: 700,
                  }}
                >
                  {m === 'daily' ? <span>Daily</span> : m === 'endless' ? <span>Endless</span> : <span>Classic</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Selector (Only visible for classic/endless modes) */}
          {mode !== 'daily' && (
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>
                Difficulty / Size
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
                {(['easy', 'normal', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`btn ${difficulty === d ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      textTransform: 'capitalize',
                      fontSize: '0.85rem',
                      padding: '8px 4px',
                      borderRadius: 12,
                      fontWeight: 700,
                    }}
                  >
                    {d === 'easy' ? '4x4 Easy' : d === 'normal' ? '5x5 Normal' : '6x6 Hard'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Daily Modifier Badge if Daily selected */}
          {mode === 'daily' && (
            <div
              style={{
                background: 'rgba(129, 140, 248, 0.08)',
                border: '1px solid rgba(129, 140, 248, 0.2)',
                borderRadius: 16,
                padding: '12px 16px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.9rem' }}>
                Today's Daily Challenge:
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.85rem', marginTop: 4 }}>
                {getModifierDescription(getDailyModifier())}
              </div>
              <div style={{ fontWeight: 700, color: '#fef08a', fontSize: '0.8rem', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                Target Category: Countries
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            className="btn btn-primary"
            style={{
              padding: '14px 20px',
              fontSize: '1rem',
              fontWeight: 800,
              borderRadius: 16,
              boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
              marginTop: 10,
            }}
          >
            Spellwards!
          </button>
        </div>
      )}

      {/* PLAYING STAGE */}
      {gameState === 'PLAYING' && (
        <>
          <WordWizardHUD
            score={score}
            combo={combo}
            timeLeft={timeLeft}
            maxTime={maxTime}
            dailyModifier={activeModifier}
            hintsRemaining={hintsRemaining}
            onUseHint={handleUseHint}
            disabled={isLoading}
          />

          {/* New Objective Progress Panel */}
          <div
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
              border: '1.5px solid rgba(129, 140, 248, 0.15)',
              borderRadius: 20,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 0 15px rgba(129, 140, 248, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
            id="ww-objective-panel"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fef08a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                {getCategoryIcon(targetCategory)} <span>{targetCategory.charAt(0).toUpperCase() + targetCategory.slice(1)} Challenge</span>
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 850, color: 'rgba(255, 255, 255, 0.7)' }}>
                Progress: {foundTargetWords.size}/{targetWords.length}
              </span>
            </div>

            {/* Target Words List */}
            {difficulty !== 'hard' ? (
              <div 
                style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
                data-testid="ww-target-list"
              >
                {targetWords.map((word) => {
                  const isFound = foundTargetWords.has(word)
                  const displayWord = difficulty === 'easy' 
                    ? word.toUpperCase()
                    : word.split('').map(() => '_').join(' ')
                  
                  return (
                    <div
                      key={word}
                      data-testid="ww-target-item"
                      className="word-target-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 10,
                        background: isFound ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isFound ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                        color: isFound ? '#10b981' : 'rgba(255, 255, 255, 0.7)',
                        transition: 'all 0.3s ease',
                        textShadow: isFound ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: '1rem', color: isFound ? '#10b981' : 'rgba(255,255,255,0.3)' }}>{isFound ? '✓' : '□'}</span>
                      <span style={{ fontWeight: 700, letterSpacing: difficulty === 'normal' && !isFound ? '0.12em' : 'normal', fontSize: '0.8rem' }}>
                        {isFound ? word.toUpperCase() : displayWord}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div
                data-testid="ww-target-list"
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}
              >
                Find <span data-testid="ww-target-item" className="word-target-item">{targetWords.length}</span> Hidden Words
              </div>
            )}
          </div>

          {/* Active Hint Message Box */}
          {activeHint && (
            <div
              data-testid="ww-hint-message"
              className="hint-message-box"
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(167, 139, 250, 0.08)',
                border: '1.5px solid rgba(167, 139, 250, 0.3)',
                borderRadius: 16,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: '#c084fc',
                textShadow: '0 0 8px rgba(167, 139, 250, 0.3)',
                boxShadow: '0 4px 15px rgba(167, 139, 250, 0.1)',
                animation: 'pulse 1.5s infinite alternate',
              }}
            >
              💡 {hintMessage}
            </div>
          )}

          <WordWizardBoard
            grid={board}
            specialTiles={specialTiles}
            path={wordPath}
            setPath={setWordPath}
            onSubmitWord={handleSubmitWord}
            particlesRef={particlesRef}
            disabled={isLoading}
            hintHighlights={hintHighlights}
            hintLevel={activeHint?.level || 0}
          />

          {/* Found words slider panel */}
          <div
            style={{
              width: '100%',
              maxHeight: 120,
              overflowY: 'auto',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              padding: '10px 14px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignContent: 'flex-start',
            }}
          >
            {foundWords.size === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.3)', margin: 'auto' }}>
                No words spelled yet. Connect adjacent letters to spell!
              </span>
            ) : (
              Array.from(foundWords).map((w) => {
                const cat = getWordCategory(w)
                return (
                  <span
                    key={w}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: cat ? '#fbbf24' : '#f8fafc',
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '4px 10px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                    }}
                  >
                    {w}
                  </span>
                )
              })
            )}
          </div>

          {/* Celebration Completion Banner */}
          {objectiveCompleted && (
            <div
              className="card glass animate-fadeIn"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(9, 11, 23, 0.9)',
                backdropFilter: 'blur(16px)',
                padding: '2rem',
                borderRadius: 24,
                border: '2px solid rgba(251, 191, 36, 0.3)',
                boxShadow: '0 0 40px rgba(251, 191, 36, 0.25)',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', animation: 'pulse 1s infinite alternate' }}><TrophyIcon size={64} className="text-yellow-400" /></div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fbbf24', textShadow: '0 0 15px rgba(251, 191, 36, 0.4)', margin: 0 }}>
                CATEGORY COMPLETE!
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginTop: 12, maxWidth: 300 }}>
                You successfully found all target words in this category and earned a <strong>+1000 score bonus</strong>!
              </p>
              <button
                onClick={() => {
                  setObjectiveCompleted(false)
                  const nextCategory = QUEST_CATEGORIES.filter((c) => c !== targetCategory)[Math.floor(Math.random() * (QUEST_CATEGORIES.length - 1))]
                  setTargetCategory(nextCategory)
                  const categoryWords = Array.from(allValidWords).filter(w => getWordCategory(w) === nextCategory)
                  const targetCount = difficulty === 'hard' ? 8 : 4
                  const shuffled = categoryWords.sort(() => 0.5 - Math.random())
                  const selected = shuffled.slice(0, Math.min(targetCount, categoryWords.length))
                  
                  if (selected.length < targetCount) {
                    const remainingCount = targetCount - selected.length
                    const otherWords = Array.from(allValidWords).filter(w => !selected.includes(w))
                    const shuffledOther = otherWords.sort(() => 0.5 - Math.random())
                    const extra = shuffledOther.slice(0, remainingCount)
                    selected.push(...extra)
                  }
                  
                  console.log('[WW TARGET COUNT NEXT] ' + JSON.stringify({
                    difficulty,
                    targetCount: selected.length,
                    targetWords: selected
                  }))

                  setTargetWords(selected)
                  setFoundTargetWords(new Set())
                  setActiveHint(null)
                }}
                className="btn btn-primary"
                style={{
                  marginTop: 24,
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: 16,
                  boxShadow: '0 8px 20px rgba(99, 102, 241, 0.35)',
                }}
              >
                Next Category!
              </button>
            </div>
          )}

          {/* Cancel button to return to setup */}
          <button
            onClick={() => setGameState('SETUP')}
            className="btn btn-secondary"
            style={{
              fontSize: '0.8rem',
              padding: '6px 12px',
              borderRadius: 8,
              opacity: 0.6,
            }}
          >
            Exit Game
          </button>
        </>
      )}
    </div>
  )
}
