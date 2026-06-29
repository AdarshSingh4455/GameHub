'use client'
import { FlaskIcon, LockIcon, TrophyIcon, AwardIcon, ZapIcon, LightbulbIcon, HistoryIcon, LogOutIcon, AlertIcon, GiftIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import GameHUD from '@/components/layout/GameHUD'

// Distinct vibrant HSL color palettes for liquids
const LIQUID_COLORS = [
  'hsl(215 90% 50%)',   // Blue
  'hsl(330 85% 55%)',   // Pink
  'hsl(48 95% 48%)',    // Yellow
  'hsl(142 75% 40%)',   // Green
  'hsl(270 80% 55%)',   // Purple
  'hsl(28 95% 50%)',    // Orange
  'hsl(0 85% 50%)',     // Red
  'hsl(180 100% 40%)',  // Cyan
]

type Difficulty = 'tutorial' | 'beginner' | 'intermediate' | 'advanced' | 'master'

interface LevelConfig {
  jarsCount: number
  colorsCount: number
  emptyJarsCount: number
}

// 5-Tiered Difficulty Curve Configurations
const DIFFICULTY_CONFIGS: Record<Difficulty, LevelConfig> = {
  tutorial: { jarsCount: 3, colorsCount: 2, emptyJarsCount: 1 },
  beginner: { jarsCount: 4, colorsCount: 3, emptyJarsCount: 1 },
  intermediate: { jarsCount: 5, colorsCount: 4, emptyJarsCount: 1 },
  advanced: { jarsCount: 7, colorsCount: 5, emptyJarsCount: 2 },
  master: { jarsCount: 8, colorsCount: 6, emptyJarsCount: 2 },
}

// Seeded Random Number Generator (mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Generate seeded random generator from string
function getSeededRandom(seedStr: string) {
  let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 50249325
  for (let i = 0, k; i < seedStr.length; i++) {
    k = seedStr.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h4 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  const seedInt = (h1 ^ h2 ^ h3 ^ h4) >>> 0
  return mulberry32(seedInt)
}

// BFS Color Sort Solver to check solvability and find hints
function solveColorSort(jars: string[][]): [number, number][] | null {
  const queue: { state: string[][]; path: [number, number][] }[] = []
  const visited = new Set<string>()

  function hashState(state: string[][]): string {
    return state.map(jar => jar.join(',')).sort().join('|')
  }

  function isSolved(state: string[][]): boolean {
    return state.every(jar => {
      if (jar.length === 0) return true
      if (jar.length !== 4) return false
      const first = jar[0]
      return jar.every(c => c === first)
    })
  }

  queue.push({ state: jars, path: [] })
  visited.add(hashState(jars))

  const maxIterations = 8000
  let iter = 0

  while (queue.length > 0 && iter < maxIterations) {
    iter++
    const curr = queue.shift()!
    if (isSolved(curr.state)) {
      return curr.path
    }

    const n = curr.state.length
    for (let i = 0; i < n; i++) {
      const srcJar = curr.state[i]
      if (srcJar.length === 0) continue

      // Skip already fully sorted single-color jars
      if (srcJar.length === 4 && srcJar.every(c => c === srcJar[0])) continue

      const topColor = srcJar[srcJar.length - 1]

      // Count consecutive same colors at the top
      let topCount = 0
      for (let k = srcJar.length - 1; k >= 0; k--) {
        if (srcJar[k] === topColor) topCount++
        else break
      }

      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const destJar = curr.state[j]
        if (destJar.length === 4) continue

        if (destJar.length === 0 || destJar[destJar.length - 1] === topColor) {
          const space = 4 - destJar.length
          const pourAmount = Math.min(topCount, space)
          if (pourAmount === 0) continue

          const nextState = curr.state.map((jar, idx) => {
            if (idx === i) return jar.slice(0, jar.length - pourAmount)
            if (idx === j) return [...jar, ...Array(pourAmount).fill(topColor)]
            return jar
          })

          const hash = hashState(nextState)
          if (!visited.has(hash)) {
            visited.add(hash)
            queue.push({
              state: nextState,
              path: [...curr.path, [i, j]],
            })
          }
        }
      }
    }
  }

  return null
}

// Check if any valid pour move exists
function hasValidMoves(jars: string[][]): boolean {
  const n = jars.length
  for (let i = 0; i < n; i++) {
    const srcJar = jars[i]
    if (srcJar.length === 0) continue
    if (srcJar.length === 4 && srcJar.every(c => c === srcJar[0])) continue
    const topColor = srcJar[srcJar.length - 1]
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const destJar = jars[j]
      if (destJar.length >= 4) continue
      if (destJar.length === 0 || destJar[destJar.length - 1] === topColor) {
        return true
      }
    }
  }
  return false
}

// Handcrafted Level Templates (A, B, C, D) for each difficulty tier
const COLOR_SORT_TEMPLATES: Record<Difficulty, { jars: number[][] }[]> = {
  tutorial: [
    { jars: [[0, 1, 0, 1], [1, 0, 1, 0]] }, // Template A
    { jars: [[0, 0, 1, 1], [1, 1, 0, 0]] }, // Template B
    { jars: [[0, 1, 1, 0], [1, 0, 0, 1]] }, // Template C
    { jars: [[1, 0, 1, 0], [0, 1, 0, 1]] }, // Template D
  ],
  beginner: [
    { jars: [[0, 1, 2, 0], [1, 2, 0, 1], [2, 0, 1, 2]] },
    { jars: [[0, 0, 1, 2], [1, 1, 2, 0], [2, 2, 0, 1]] },
    { jars: [[0, 2, 1, 1], [1, 0, 2, 2], [2, 1, 0, 0]] },
    { jars: [[1, 2, 0, 0], [2, 0, 1, 1], [0, 1, 2, 2]] },
  ],
  intermediate: [
    { jars: [[0, 1, 2, 3], [1, 2, 3, 0], [2, 3, 0, 1], [3, 0, 1, 2]] },
    { jars: [[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3, 0], [3, 3, 0, 1]] },
    { jars: [[3, 2, 1, 0], [2, 1, 0, 3], [1, 0, 3, 2], [0, 3, 2, 1]] },
    { jars: [[0, 2, 0, 2], [1, 3, 1, 3], [2, 0, 2, 0], [3, 1, 3, 1]] },
  ],
  advanced: [
    { jars: [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 0], [3, 4, 0, 1], [4, 0, 1, 2]] },
    { jars: [[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3, 4], [3, 3, 4, 0], [4, 4, 0, 1]] },
    { jars: [[4, 3, 2, 1], [3, 2, 1, 0], [2, 1, 0, 4], [1, 0, 4, 3], [0, 4, 3, 2]] },
    { jars: [[0, 2, 4, 1], [1, 3, 0, 2], [2, 4, 1, 3], [3, 0, 2, 4], [4, 1, 3, 0]] },
  ],
  master: [
    { jars: [[0, 1, 2, 3], [1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 0], [4, 5, 0, 1], [5, 0, 1, 2]] },
    { jars: [[0, 0, 1, 1], [2, 2, 3, 3], [4, 4, 5, 5], [1, 2, 4, 0], [3, 5, 0, 2], [5, 1, 3, 4]] },
    { jars: [[5, 4, 3, 2], [4, 3, 2, 1], [3, 2, 1, 0], [2, 1, 0, 5], [1, 0, 5, 4], [0, 5, 4, 3]] },
    { jars: [[0, 3, 1, 4], [2, 5, 3, 0], [4, 1, 5, 2], [5, 2, 0, 3], [1, 4, 2, 5], [3, 0, 4, 1]] },
  ],
}

// Premium rotating liquid color palettes
const PALETTES = {
  neon: [
    'hsl(320 100% 60%)', // Neon Pink
    'hsl(180 100% 50%)', // Neon Cyan
    'hsl(90 100% 50%)',  // Neon Green
    'hsl(45 100% 50%)',  // Neon Yellow
    'hsl(280 100% 65%)', // Neon Purple
    'hsl(20 100% 55%)',  // Neon Orange
  ],
  pastel: [
    'hsl(350 85% 82%)',  // Pastel Pink
    'hsl(195 80% 78%)',  // Pastel Blue
    'hsl(130 65% 78%)',  // Pastel Green
    'hsl(55 80% 80%)',   // Pastel Yellow
    'hsl(265 65% 82%)',  // Pastel Lavender
    'hsl(25 85% 80%)',   // Pastel Peach
  ],
  metallic: [
    'hsl(340 70% 45%)',  // Ruby
    'hsl(210 75% 45%)',  // Sapphire
    'hsl(150 70% 35%)',  // Emerald
    'hsl(48 85% 45%)',   // Topaz
    'hsl(280 65% 45%)',  // Amethyst
    'hsl(15 75% 45%)',   // Amber
  ],
  vintage: [
    'hsl(10 40% 40%)',   // Terracotta
    'hsl(200 35% 40%)',  // Denim Blue
    'hsl(90 25% 35%)',   // Sage Green
    'hsl(40 50% 45%)',   // Ochre Gold
    'hsl(320 20% 38%)',  // Dusty Rose
    'hsl(30 35% 30%)',   // Raw Amber
  ]
}

// Helper to determine the palette for a level
function getPaletteColors(levelNum: number): string[] {
  return LIQUID_COLORS
}

export interface CategoryConfig {
  name: string
  gold: number
  silver: number
  bronze: number
}

export function getLevelCategoryDetails(levelNum: number): CategoryConfig {
  if (levelNum > 50) {
    return { name: 'Endless Lab', gold: 90, silver: 130, bronze: 190 }
  }

  const patIdx = (levelNum - 1) % 5

  if (levelNum >= 45) {
    return { name: 'Expert Chaos', gold: 140, silver: 200, bronze: 280 }
  }

  if (levelNum > 30) {
    if (patIdx === 1) {
      return { name: 'Almost Sorted', gold: 25, silver: 40, bronze: 60 }
    }
    if (patIdx === 3) {
      return { name: 'False Easy', gold: 70, silver: 100, bronze: 140 }
    }
    return { name: 'Chaos', gold: 110, silver: 160, bronze: 220 }
  }

  switch (patIdx) {
    case 0:
      return { name: 'Mixed', gold: 60, silver: 90, bronze: 120 }
    case 1:
      return { name: 'Almost Sorted', gold: 25, silver: 40, bronze: 60 }
    case 2:
      return { name: 'Highly Mixed', gold: 80, silver: 120, bronze: 180 }
    case 3:
      return { name: 'False Easy', gold: 70, silver: 100, bronze: 140 }
    case 4:
    default:
      return { name: 'Long Chain', gold: 90, silver: 130, bronze: 190 }
  }
}

export function formatTargetTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Standardized cylindrical jar shape — always cylindrical regardless of index
function getJarShapeStyles(_index: number) {
  return {
    borderRadius: '4px 4px 18px 18px',
  }
}

// Generate level deterministically using templates, scrambling, and dynamic configurations
function generateColorSortLevel(difficulty: Difficulty, levelNum: number, extraEmpty = 0): { jars: string[][]; minMoves: number } {
  // Determine actual difficulty configuration based on campaign progression
  let actualDiff = difficulty
  let overrideEmptyJars: number | null = null

  if (levelNum === 1 || levelNum === 2) {
    actualDiff = 'beginner' // 4 jars, 3 colors, 1 empty
  } else if (levelNum >= 3 && levelNum <= 9) {
    actualDiff = 'intermediate' // 5 jars, 4 colors, 1 empty
  } else if (levelNum >= 10 && levelNum <= 20) {
    actualDiff = 'advanced'
    overrideEmptyJars = 1 // 6 jars, 5 colors, 1 empty
  } else if (levelNum > 20) {
    actualDiff = 'master' // 8 jars, 6 colors, 2 empty
  }

  const config = { ...DIFFICULTY_CONFIGS[actualDiff] }
  if (overrideEmptyJars !== null) {
    config.emptyJarsCount = overrideEmptyJars
    config.jarsCount = config.colorsCount + overrideEmptyJars
  }

  // Apply extra empty jars for adaptive difficulty
  config.emptyJarsCount += extraEmpty
  config.jarsCount += extraEmpty

  const patternType = ['A', 'B', 'C', 'D', 'E'][(levelNum - 1) % 5]

  // Loop to find a configuration that is solvable and fits the pattern rules
  for (let attempt = 0; attempt < 150; attempt++) {
    const seed = `color-sort-${actualDiff}-${levelNum}-attempt-${attempt}-extra-${extraEmpty}`
    const rng = getSeededRandom(seed)

    // Select actual liquid colors from rotating palette and shuffle/scramble them deterministically
    const activePalette = getPaletteColors(levelNum)
    const colors = [...activePalette.slice(0, config.colorsCount)]
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]]
    }

    let candidateJars: string[][] = []

    if (attempt < 10) {
      // Get the template index based on level number
      const templates = COLOR_SORT_TEMPLATES[actualDiff]
      const templateIdx = (levelNum - 1 + attempt) % templates.length
      const template = templates[templateIdx]

      // Map relative template indices to scrambled colors
      candidateJars = template.jars.map(jarColors =>
        jarColors.map(colorIdx => colors[colorIdx])
      )

      // Append the empty jars
      for (let i = 0; i < config.emptyJarsCount; i++) {
        candidateJars.push([])
      }

      // Scramble the order of jars deterministically
      for (let i = candidateJars.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [candidateJars[i], candidateJars[j]] = [candidateJars[j], candidateJars[i]]
      }
    } else {
      // Shuffled pool fallback for more randomness
      const flatPool: string[] = []
      colors.forEach(color => {
        for (let i = 0; i < 4; i++) {
          flatPool.push(color)
        }
      })

      for (let i = flatPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [flatPool[i], flatPool[j]] = [flatPool[j], flatPool[i]]
      }

      for (let i = 0; i < config.colorsCount; i++) {
        candidateJars.push(flatPool.slice(i * 4, (i + 1) * 4))
      }
      for (let i = 0; i < config.emptyJarsCount; i++) {
        candidateJars.push([])
      }
    }

    // Apply level type patterns (A: Simple, B: Almost Solved, C: Highly Mixed, D: False Easy, E: Long Chain)
    if (patternType === 'B') {
      // Level Type B: Almost solved (set starting state to 3 moves away from victory)
      const solution = solveColorSort(candidateJars)
      if (solution && solution.length > 3) {
        let currentJars = candidateJars.map(j => [...j])
        for (let m = 0; m < solution.length - 3; m++) {
          const [from, to] = solution[m]
          const color = currentJars[from][currentJars[from].length - 1]
          let matchCount = 0
          for (let k = currentJars[from].length - 1; k >= 0; k--) {
            if (currentJars[from][k] === color) matchCount++
            else break
          }
          const space = 4 - currentJars[to].length
          const pour = Math.min(matchCount, space)
          currentJars[from] = currentJars[from].slice(0, currentJars[from].length - pour)
          currentJars[to] = [...currentJars[to], ...Array(pour).fill(color)]
        }
        candidateJars = currentJars
      }
    } else if (patternType === 'C') {
      // Level Type C: Highly Mixed (interleave color layers deeply)
      const flatPool: string[] = []
      candidateJars.forEach(jar => {
        jar.forEach(c => flatPool.push(c))
      })
      // Intense deterministic shuffle
      for (let i = flatPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [flatPool[i], flatPool[j]] = [flatPool[j], flatPool[i]]
      }
      const newJars: string[][] = []
      for (let i = 0; i < config.colorsCount; i++) {
        newJars.push(flatPool.slice(i * 4, (i + 1) * 4))
      }
      for (let i = 0; i < config.emptyJarsCount; i++) {
        newJars.push([])
      }
      candidateJars = newJars
    } else if (patternType === 'D') {
      // Level Type D: False Easy (group colors together inside jars so it looks clean, but requires planning)
      candidateJars = candidateJars.map(jar => {
        if (jar.length === 0) return jar
        return [...jar].sort()
      })
    }

    const solution = solveColorSort(candidateJars)
    if (solution) {
      if (patternType === 'E') {
        // Level Type E: Long Chain (requires a minimum number of solution moves)
        const minChainLength = config.colorsCount * 2.4
        if (solution.length < minChainLength && attempt < 140) {
          continue // Reject and try another scramble to get a longer chain
        }
      }
      return { jars: candidateJars, minMoves: solution.length }
    }
  }

  // Final fallback
  const activePalette = getPaletteColors(levelNum)
  const colors = [...activePalette.slice(0, config.colorsCount)]
  const fallbackSolved = colors.map(c => [c, c, c, c])
  for (let i = 0; i < config.emptyJarsCount; i++) fallbackSolved.push([])
  return { jars: fallbackSolved, minMoves: 1 }
}

export default function ColorSortGame() {
  const { user, submitGameResult } = useGameSession()

  // Game Mode & Navigation States
  const [stage, setStage] = useState<'setup' | 'playing' | 'endless_lab' | 'gameover'>('setup')
  const [difficulty, setDifficulty] = useState<Difficulty>('tutorial')
  const [level, setLevel] = useState<number>(1)
  const [jars, setJars] = useState<string[][]>([])
  const [initialJars, setInitialJars] = useState<string[][]>([])
  const [undoStack, setUndoStack] = useState<string[][][]>([])

  // Endless Lab States
  const [labSeed, setLabSeed] = useState<string>('12345')
  const [labDifficulty, setLabDifficulty] = useState<Difficulty>('intermediate')
  const [labBestRun, setLabBestRun] = useState<number>(0)

  // Selection & Pouring Animation states
  const [selectedJarIdx, setSelectedJarIdx] = useState<number | null>(null)
  const [pourStep, setPourStep] = useState<'idle' | 'lifting' | 'moving' | 'pouring' | 'returning'>('idle')
  const [pourAnimation, setPourAnimation] = useState<{
    from: number
    to: number
    color: string
    amount: number
    dx: number
    dy: number
  } | null>(null)

  // Gameplay stats
  const [movesCount, setMovesCount] = useState<number>(0)
  const [timeElapsed, setTimeElapsed] = useState<number>(0)
  const [minMovesNeeded, setMinMovesNeeded] = useState<number>(5)
  const [hintsUsed, setHintsUsed] = useState<number>(0)
  const [hintMessage, setHintMessage] = useState<string | null>(null)
  const [hintHighlight, setHintHighlight] = useState<{ from: number; to: number } | null>(null)
  const [errorShakeIdx, setErrorShakeIdx] = useState<number | null>(null)

  // Time targets
  const [goldTime, setGoldTime] = useState<number>(30)
  const [silverTime, setSilverTime] = useState<number>(50)
  const [bronzeTime, setBronzeTime] = useState<number>(75)

  // Timer control
  const [timerRunning, setTimerRunning] = useState<boolean>(false)

  // Level preview overlay
  const [showPreview, setShowPreview] = useState<boolean>(false)
  const [previewData, setPreviewData] = useState<{ gold: number; silver: number; bronze: number } | null>(null)

  // Stuck detection & rescue jar system
  const [isStuck, setIsStuck] = useState<boolean>(false)
  const [usedRescueJar, setUsedRescueJar] = useState<boolean>(false)
  const [rescueJarIdx, setRescueJarIdx] = useState<number | null>(null)
  const [stuckCount, setStuckCount] = useState<number>(0)
  const [restartCount, setRestartCount] = useState<number>(0)

  // Ad preloading
  const [adPreloaded, setAdPreloaded] = useState<boolean>(false)

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const progressKey = user ? `gamehub_colorsort_progress_${user.id}` : 'gamehub_colorsort_progress_guest'
  const bestRunKey = user ? `gamehub_colorsort_lab_best_${user.id}` : 'gamehub_colorsort_lab_best_guest'

  // Load progress
  const [completedLevelsCount, setCompletedLevelsCount] = useState<number>(0)

  // Ad simulation modal
  const [adModalOpen, setAdModalOpen] = useState(false)
  const [adCountdown, setAdCountdown] = useState(0)

  useEffect(() => {
    const savedLvl = localStorage.getItem(progressKey)
    if (savedLvl) {
      setCompletedLevelsCount(parseInt(savedLvl, 10))
    }
    const savedBest = localStorage.getItem(bestRunKey)
    if (savedBest) {
      setLabBestRun(parseInt(savedBest, 10))
    }
  }, [progressKey, bestRunKey])

  // Timer Effect — only runs when timerRunning is true
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerRunning])

  // Ad countdown effect
  useEffect(() => {
    if (!adModalOpen || adCountdown <= 0) return
    const t = setTimeout(() => setAdCountdown(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [adModalOpen, adCountdown])

  // Check victory condition
  useEffect(() => {
    if (stage !== 'playing' || jars.length === 0 || pourAnimation !== null) return

    const won = jars.every(jar => {
      if (jar.length === 0) return true
      if (jar.length !== 4) return false
      return jar.every(c => c === jar[0])
    })

    if (won) {
      triggerVictory()
    }
  }, [jars, stage, pourAnimation])

  // Listen for replay/next level global events from modal
  useEffect(() => {
    const handleReplay = () => {
      if (stage === 'gameover' || stage === 'playing') {
        startLevel(difficulty, level)
      }
    }

    const handleNext = () => {
      if (level < 50) {
        const nextLevelNum = level + 1
        let nextDiff = difficulty
        if (nextLevelNum <= 10) nextDiff = 'tutorial'
        else if (nextLevelNum <= 20) nextDiff = 'beginner'
        else if (nextLevelNum <= 30) nextDiff = 'intermediate'
        else if (nextLevelNum <= 40) nextDiff = 'advanced'
        else nextDiff = 'master'

        setLevel(nextLevelNum)
        setDifficulty(nextDiff)
        startLevel(nextDiff, nextLevelNum)
      } else {
        // Unlock Endless Lab
        setStage('endless_lab')
      }
    }

    window.addEventListener('gamehub_replay', handleReplay)
    window.addEventListener('gamehub_next_level', handleNext)
    return () => {
      window.removeEventListener('gamehub_replay', handleReplay)
      window.removeEventListener('gamehub_next_level', handleNext)
    }
  }, [level, difficulty, stage])

  // Start Level
  const startLevel = (diff: Difficulty, lvlNum: number, extraEmpty = 0) => {
    const levelData = generateColorSortLevel(diff, lvlNum, extraEmpty)
    setJars(levelData.jars)
    setInitialJars(levelData.jars.map(j => [...j]))
    setMinMovesNeeded(levelData.minMoves)
    setUndoStack([])
    setSelectedJarIdx(null)
    setMovesCount(0)
    setTimeElapsed(0)
    setHintsUsed(0)
    setHintMessage(null)
    setHintHighlight(null)
    setDifficulty(diff)
    setLevel(lvlNum)

    // Reset stuck/rescue state
    setIsStuck(false)
    setUsedRescueJar(false)
    setRescueJarIdx(null)
    setStuckCount(0)
    setRestartCount(0)

    // Category based targets
    const catDetails = getLevelCategoryDetails(lvlNum)
    setGoldTime(catDetails.gold)
    setSilverTime(catDetails.silver)
    setBronzeTime(catDetails.bronze)

    // Setup preview
    setPreviewData({ gold: catDetails.gold, silver: catDetails.silver, bronze: catDetails.bronze })
    setShowPreview(true)
    setTimerRunning(false)

    // Preload ad after a short delay
    setAdPreloaded(false)
    setTimeout(() => setAdPreloaded(true), 500)

    setStage('playing')
  }

  // Start Endless Lab Level
  const startLabLevel = () => {
    const config = DIFFICULTY_CONFIGS[labDifficulty]
    const rng = getSeededRandom(`color-sort-lab-${labSeed}`)

    let attempts = 0
    let levelJars: string[][] = []
    let minM = 5

    while (attempts < 100) {
      attempts++
      const colors = LIQUID_COLORS.slice(0, config.colorsCount)
      const flatPool: string[] = []
      colors.forEach(color => {
        for (let i = 0; i < 4; i++) flatPool.push(color)
      })

      // Seeded shuffle
      for (let i = flatPool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [flatPool[i], flatPool[j]] = [flatPool[j], flatPool[i]]
      }

      const tempJars: string[][] = []
      for (let i = 0; i < config.colorsCount; i++) {
        tempJars.push(flatPool.slice(i * 4, (i + 1) * 4))
      }
      for (let i = 0; i < config.emptyJarsCount; i++) {
        tempJars.push([])
      }

      const solution = solveColorSort(tempJars)
      if (solution) {
        levelJars = tempJars
        minM = solution.length
        break
      }
    }

    if (levelJars.length === 0) {
      // Fallback
      levelJars = LIQUID_COLORS.slice(0, config.colorsCount).map(c => [c, c, c, c])
      for (let i = 0; i < config.emptyJarsCount; i++) levelJars.push([])
      minM = 1
    }

    setJars(levelJars)
    setInitialJars(levelJars.map(j => [...j]))
    setMinMovesNeeded(minM)
    setUndoStack([])
    setSelectedJarIdx(null)
    setMovesCount(0)
    setTimeElapsed(0)
    setHintsUsed(0)
    setHintMessage(null)
    setHintHighlight(null)

    // Reset stuck/rescue
    setIsStuck(false)
    setUsedRescueJar(false)
    setRescueJarIdx(null)
    setStuckCount(0)
    setRestartCount(0)

    const gold = 15 + levelJars.length * 5
    const silver = Math.round(gold * 1.7)
    const bronze = Math.round(silver * 1.5)
    setGoldTime(gold)
    setSilverTime(silver)
    setBronzeTime(bronze)

    // Preview for lab levels too
    setPreviewData({ gold, silver, bronze })
    setShowPreview(true)
    setTimerRunning(false)

    setAdPreloaded(false)
    setTimeout(() => setAdPreloaded(true), 500)

    setStage('playing')
  }

  // Handle Jar Click (Select / Pour)
  const handleJarClick = (index: number) => {
    if (pourAnimation !== null || stage !== 'playing') return
    if (showPreview) return // Block interaction during preview

    setHintHighlight(null)
    setHintMessage(null)

    if (selectedJarIdx === null) {
      // Select source
      if (jars[index].length === 0) {
        shakeJar(index)
        return
      }
      setSelectedJarIdx(index)
    } else {
      // Destination selected
      const sourceIdx = selectedJarIdx
      setSelectedJarIdx(null)

      if (sourceIdx === index) {
        return // Unselect
      }

      const sourceJar = jars[sourceIdx]
      const destJar = jars[index]

      // Rescue jar capacity limit (only holds 1 layer)
      const isRescueDest = rescueJarIdx !== null && index === rescueJarIdx
      const maxDestCapacity = isRescueDest ? 1 : 4

      if (destJar.length >= maxDestCapacity) {
        shakeJar(index)
        return // Destination full
      }

      const topColor = sourceJar[sourceJar.length - 1]
      if (destJar.length > 0 && destJar[destJar.length - 1] !== topColor) {
        shakeJar(index)
        return // Colors mismatch
      }

      // Count source matching consecutive layers
      let matchingCount = 0
      for (let k = sourceJar.length - 1; k >= 0; k--) {
        if (sourceJar[k] === topColor) matchingCount++
        else break
      }

      const space = maxDestCapacity - destJar.length
      const pourAmount = Math.min(matchingCount, space)

      if (pourAmount === 0) {
        shakeJar(index)
        return
      }

      // Push to Undo stack
      setUndoStack(prev => [...prev, jars.map(j => [...j])])

      // Trigger achievement hook: First Pour
      if (movesCount === 0 && user) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'color-sort-first-pour' }),
        }).catch(() => {})
      }

      // Calculate translation offsets between source and destination jar mouths
      const fromEl = document.getElementById(`colorsort-jar-${sourceIdx}`)
      const toEl = document.getElementById(`colorsort-jar-${index}`)
      let dx = 0
      let dy = 0
      if (fromEl && toEl) {
        const fromRect = fromEl.getBoundingClientRect()
        const toRect = toEl.getBoundingClientRect()
        dx = toRect.left - fromRect.left
        dy = toRect.top - fromRect.top
      }

      // Start multi-stage lift-translate-pour-return animation
      setPourAnimation({
        from: sourceIdx,
        to: index,
        color: topColor,
        amount: pourAmount,
        dx,
        dy,
      })
      setPourStep('lifting')

      // Step 1: Lift source jar (lasts 300ms)
      setTimeout(() => {
        setPourStep('moving')

        // Step 2: Move source jar above destination (lasts 400ms)
        setTimeout(() => {
          setPourStep('pouring')

          // Step 3: Tilt, stream flows, source jar drains, dest jar fills (lasts 1000ms)
          setTimeout(() => {
            setPourStep('returning')

            // Step 4: Tilt back and return to start position (lasts 500ms)
            setTimeout(() => {
              let newJars: string[][] = []
              setJars(currentJars => {
                newJars = currentJars.map((jar, idx) => {
                  if (idx === sourceIdx) {
                    return jar.slice(0, jar.length - pourAmount)
                  }
                  if (idx === index) {
                    return [...jar, ...Array(pourAmount).fill(topColor)]
                  }
                  return jar
                })
                return newJars
              })
              setMovesCount(prev => prev + 1)
              setPourAnimation(null)
              setPourStep('idle')

              // Check if stuck after the pour completes
              setTimeout(() => {
                if (newJars.length > 0) {
                  const noMoves = !hasValidMoves(newJars)
                  const noSolution = solveColorSort(newJars) === null
                  // Also check it's not already won
                  const alreadyWon = newJars.every(jar => {
                    if (jar.length === 0) return true
                    if (jar.length !== 4) return false
                    return jar.every(c => c === jar[0])
                  })
                  if (!alreadyWon && (noMoves || noSolution)) {
                    setIsStuck(true)
                    setStuckCount(c => c + 1)
                  }
                }
              }, 50)
            }, 500)
          }, 1000)
        }, 400)
      }, 300)
    }
  }

  const shakeJar = (idx: number) => {
    setErrorShakeIdx(idx)
    setTimeout(() => setErrorShakeIdx(null), 400)
  }

  // Undo move
  const handleUndo = () => {
    if (undoStack.length === 0 || pourAnimation !== null) return
    const prev = undoStack[undoStack.length - 1]
    setJars(prev)
    setUndoStack(prevStack => prevStack.slice(0, -1))
    setMovesCount(prev => prev + 1)
    setSelectedJarIdx(null)
    setHintHighlight(null)
    setHintMessage(null)
    setIsStuck(false)
  }

  // Trigger Hint Solver
  const handleHintClick = () => {
    if (stage !== 'playing' || pourAnimation !== null) return

    const solution = solveColorSort(jars)
    if (!solution || solution.length === 0) {
      setHintMessage('Stuck! No solutions available. Try Undoing or Restarting.')
      return
    }

    const nextMove = solution[0]

    const triggerHintHighlight = () => {
      setHintHighlight({ from: nextMove[0], to: nextMove[1] })
      setHintMessage(`Hint: Pour from Jar ${nextMove[0] + 1} to Jar ${nextMove[1] + 1}`)
    }

    if (hintsUsed === 0) {
      setHintsUsed(1)
      triggerHintHighlight()
    } else {
      // Request ad — use faster countdown if ad preloaded
      const countdown = adPreloaded ? 3 : 4
      setAdCountdown(countdown)
      setAdModalOpen(true)
    }
  }

  const claimRewardedHint = () => {
    setAdModalOpen(false)
    setHintsUsed(prev => prev + 1)
    const solution = solveColorSort(jars)
    if (solution && solution.length > 0) {
      const nextMove = solution[0]
      setHintHighlight({ from: nextMove[0], to: nextMove[1] })
      setHintMessage(`Hint: Pour from Jar ${nextMove[0] + 1} to Jar ${nextMove[1] + 1}`)
    }
  }

  // Add rescue jar
  const addRescueJar = () => {
    setJars(prev => {
      const next = [...prev, []]
      setRescueJarIdx(next.length - 1)
      return next
    })
    setUsedRescueJar(true)
    setIsStuck(false)
  }

  const triggerVictory = () => {
    setStage('gameover')
    setTimerRunning(false)
    if (timerRef.current) clearInterval(timerRef.current)

    // Save personal best time
    const bestTimeKey = `gamehub_colorsort_level_${level}_best_time`
    const savedBest = localStorage.getItem(bestTimeKey)
    if (!savedBest || timeElapsed < parseInt(savedBest, 10)) {
      localStorage.setItem(bestTimeKey, timeElapsed.toString())
    }

    // Calculate stars: depend primarily on time targets
    let finalStars = 1
    if (timeElapsed <= goldTime) {
      finalStars = 3
    } else if (timeElapsed <= silverTime) {
      finalStars = 2
    }

    const calculatedScore = Math.max(10, 1000 - (movesCount - minMovesNeeded) * 25 - (hintsUsed * 100) - timeElapsed)

    // Save Progression
    if (level > completedLevelsCount && completedLevelsCount < 50) {
      const nextCompleted = level
      localStorage.setItem(progressKey, nextCompleted.toString())
      setCompletedLevelsCount(nextCompleted)
    }

    // Update Endless Lab Best Run
    if (stage === 'playing' && level > 50) {
      const runScore = calculatedScore
      if (runScore > labBestRun) {
        localStorage.setItem(bestRunKey, runScore.toString())
        setLabBestRun(runScore)
      }
    }

    // Trigger achievements based on wins
    if (user) {
      const totalCompletions = Math.max(level, completedLevelsCount)
      if (totalCompletions >= 5) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'color-sort-apprentice' }),
        }).catch(() => {})
      }
      if (totalCompletions >= 25) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'color-sort-master' }),
        }).catch(() => {})
      }
      if (hintsUsed === 0) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'color-sort-no-hint' }),
        }).catch(() => {})
      }
      if (finalStars === 3) {
        fetch('/api/achievements/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievementSlug: 'color-sort-perfect' }),
        }).catch(() => {})
      }
    }

    submitGameResult({
      gameSlug: 'color-sort',
      result: 'win',
      metadata: {
        score: calculatedScore,
        gameMetadata: {
          difficulty,
          level,
          moves: movesCount,
          timeSecs: timeElapsed,
          stars: finalStars,
          goldTime,
          silverTime,
        },
      },
    })
  }

  useEffect(() => {
    (window as any).triggerColorSortWin = () => {
      triggerVictory()
    }
    (window as any).triggerColorSortStuck = () => {
      setIsStuck(true)
    }
    (window as any).triggerColorSortRescue = () => {
      addRescueJar()
    }
    (window as any).getColorSortAdPreloaded = () => {
      return adPreloaded
    }
  }, [jars, difficulty, level, movesCount, timeElapsed, minMovesNeeded, hintsUsed, adPreloaded])

  const getDifficultyColor = (diff: Difficulty) => {
    return {
      tutorial: 'hsl(142 70% 45%)',
      beginner: 'hsl(215 90% 50%)',
      intermediate: 'hsl(270 80% 55%)',
      advanced: 'hsl(28 95% 50%)',
      master: 'hsl(0 85% 50%)',
    }[diff]
  }

  // Compute jar rows for progressive layout
  const getJarRows = (jarList: string[][], lvlNum: number): string[][][] => {
    let rowSize: number
    if (lvlNum <= 14) {
      // Single row (all jars in one row)
      return [jarList]
    } else if (lvlNum <= 24) {
      rowSize = 3
    } else if (lvlNum <= 39) {
      rowSize = 4
    } else {
      rowSize = 5
    }
    const rows: string[][][] = []
    for (let i = 0; i < jarList.length; i += rowSize) {
      rows.push(jarList.slice(i, i + rowSize))
    }
    return rows
  }

  // Get the best time from localStorage for preview
  const getLevelBestTime = (lvl: number): number | null => {
    const saved = localStorage.getItem(`gamehub_colorsort_level_${lvl}_best_time`)
    return saved ? parseInt(saved, 10) : null
  }

  // Determine whether to show adaptive difficulty option
  const showAdaptiveOption = restartCount >= 3 || stuckCount >= 2

  return (
    <div
      style={{
        maxWidth: 520,
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0.5rem',
        position: 'relative',
      }}
      className="animate-fadeIn"
      id="color-sort-root"
    >
      {/* 1. SETUP STAGE */}
      {stage === 'setup' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(222 18% 12% / 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          id="colorsort-setup-screen"
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><FlaskIcon size={48} className="text-purple-400" /></div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>Color Sort</h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.2rem', lineHeight: 1.4 }}>
              Sort all matching colored liquids into separate glass jars. Pour strategically and unlock the Endless Lab!
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 800, letterSpacing: '0.08em' }}>
              Levels 1 - 50 Campaign
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: '4px',
                background: 'hsl(222 20% 8%)',
                borderRadius: 12,
                border: '1px solid hsl(220 15% 15%)',
              }}
              id="color-sort-level-grid"
            >
              {Array.from({ length: 50 }).map((_, idx) => {
                const lvlNum = idx + 1
                const isCompleted = completedLevelsCount >= lvlNum
                const isPlayable = lvlNum <= completedLevelsCount + 1

                let diffColor = 'hsl(220 10% 40%)'
                let lvlDiff: Difficulty = 'tutorial'
                if (lvlNum <= 10) { lvlDiff = 'tutorial'; diffColor = getDifficultyColor('tutorial') }
                else if (lvlNum <= 20) { lvlDiff = 'beginner'; diffColor = getDifficultyColor('beginner') }
                else if (lvlNum <= 30) { lvlDiff = 'intermediate'; diffColor = getDifficultyColor('intermediate') }
                else if (lvlNum <= 40) { lvlDiff = 'advanced'; diffColor = getDifficultyColor('advanced') }
                else { lvlDiff = 'master'; diffColor = getDifficultyColor('master') }

                return (
                  <button
                    key={`lvl-${lvlNum}`}
                    disabled={!isPlayable}
                    onClick={() => startLevel(lvlDiff, lvlNum)}
                    style={{
                      aspectRatio: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isCompleted
                        ? 'hsl(142 70% 45% / 0.4)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.3)'
                        : 'transparent',
                      background: isCompleted
                        ? 'hsl(142 70% 45% / 0.12)'
                        : isPlayable
                        ? 'hsl(220 100% 60% / 0.05)'
                        : 'hsl(222 18% 10%)',
                      color: isCompleted
                        ? 'hsl(142 70% 55%)'
                        : isPlayable
                        ? 'white'
                        : 'hsl(220 10% 35%)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: isPlayable ? 'pointer' : 'not-allowed',
                      position: 'relative',
                    }}
                    title={`${lvlDiff.toUpperCase()} Level`}
                  >
                    {isPlayable ? lvlNum : <LockIcon size={12} className="mx-auto" />}
                    {isPlayable && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 3,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: diffColor,
                        }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Endless Lab Button (Unlocks after Level 50) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {completedLevelsCount >= 50 ? (
              <button
                onClick={() => setStage('endless_lab')}
                className="btn btn-primary"
                style={{
                  borderRadius: 14,
                  padding: '0.85rem',
                  background: 'linear-gradient(90deg, hsl(270 80% 55%), hsl(220 100% 50%))',
                  border: 'none',
                  boxShadow: '0 0 15px hsl(270 80% 55% / 0.35)',
                }}
                id="colorsort-enter-lab-btn"
              >
                <FlaskIcon size={14} className="inline mr-1 text-purple-400" /> Enter Endless Lab
              </button>
            ) : (
              <div
                style={{
                  background: 'hsl(222 20% 7%)',
                  border: '1px dashed hsl(220 15% 15%)',
                  borderRadius: 14,
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'hsl(220 10% 45%)',
                }}
                id="colorsort-lab-locked-badge"
              >
                <LockIcon size={14} className="inline mr-1 text-red-500" /> Endless Lab Mode unlocks after Level 50
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. ENDLESS LAB STAGE */}
      {stage === 'endless_lab' && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(222 18% 12% / 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          id="colorsort-endless-lab-screen"
        >
          <div style={{ textAlign: 'center' }}>
            <span style={{ display: 'flex', justifyContent: 'center' }}><FlaskIcon size={36} className="text-purple-400" /></span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 950, color: 'white', letterSpacing: '-0.02em', marginTop: '0.25rem' }}>
              ENDLESS LAB
            </h2>
            <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.78rem', marginTop: '0.15rem' }}>
              Experiment with deterministic seeds and custom complexities.
            </p>
          </div>

          <div
            style={{
              background: 'hsl(222 20% 7% / 0.7)',
              borderRadius: 14,
              padding: '0.85rem',
              border: '1px dashed hsl(220 15% 16%)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800 }}>
              Lab Best Run (Score)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(48 95% 50%)', marginTop: '0.15rem' }}>
              <TrophyIcon size={14} className="inline mr-1 text-yellow-400" /> {labBestRun || 'N/A'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'hsl(220 10% 60%)', fontWeight: 700 }}>Deterministic Seed</label>
              <input
                type="text"
                value={labSeed}
                onChange={e => setLabSeed(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                maxLength={10}
                style={{
                  background: 'hsl(222 20% 7%)',
                  border: '1px solid hsl(220 15% 20%)',
                  borderRadius: 10,
                  padding: '0.5rem 0.75rem',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
                id="colorsort-lab-seed-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: 'hsl(220 10% 60%)', fontWeight: 700 }}>Complexity Rating</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {(['intermediate', 'advanced', 'master'] as Difficulty[]).map(diff => (
                  <button
                    key={diff}
                    onClick={() => setLabDifficulty(diff)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: labDifficulty === diff ? getDifficultyColor(diff) : 'hsl(220 15% 18%)',
                      background: labDifficulty === diff ? `${getDifficultyColor(diff)}20` : 'hsl(222 18% 10%)',
                      color: labDifficulty === diff ? 'white' : 'hsl(220 10% 60%)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                    }}
                    id={`lab-diff-${diff}`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              onClick={startLabLevel}
              className="btn btn-primary"
              style={{ flex: 1.5, borderRadius: 12, padding: '0.65rem' }}
              id="colorsort-lab-launch-btn"
            >
              <FlaskIcon size={14} className="inline mr-1" /> Launch Experiment
            </button>
            <button
              onClick={() => setStage('setup')}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12, padding: '0.65rem' }}
            >
              ⬅️ Back
            </button>
          </div>
        </div>
      )}

      {/* 3. PLAYING STAGE */}
      {stage === 'playing' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            width: '100%',
            position: 'relative',
          }}
          id="color-sort-board-container"
        >
          {/* Level Start Preview Overlay */}
          {showPreview && previewData && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 500,
                background: 'hsl(222 20% 6% / 0.97)',
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1.25rem',
                padding: '2rem 1.5rem',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
              }}
              id="colorsort-level-preview"
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><FlaskIcon size={36} className="text-purple-400" /></div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', margin: 0 }}>
                  Color Sort
                </h2>
                <div style={{ fontSize: '0.9rem', color: 'hsl(220 10% 55%)', marginTop: '0.2rem' }}>
                  {level > 50 ? 'Endless Lab' : `Level ${level} — ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`}
                </div>
              </div>

              <div
                style={{
                  background: 'hsl(222 18% 12%)',
                  borderRadius: 16,
                  padding: '1rem 1.5rem',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  border: '1px solid hsl(220 15% 18%)',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'center', letterSpacing: '0.08em' }}>
                  Time Targets
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(45 100% 55%)' }} /></div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(48 95% 55%)' }}>{previewData.gold}s</div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Gold</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(220 10% 75%)' }} /></div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(210 70% 65%)' }}>{previewData.silver}s</div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Silver</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}><AwardIcon size={18} style={{ color: 'hsl(35 60% 50%)' }} /></div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(28 80% 60%)' }}>{previewData.bronze}s</div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>Bronze</div>
                  </div>
                </div>
                {(() => {
                  const best = getLevelBestTime(level)
                  if (!best) return null
                  return (
                    <div style={{ textAlign: 'center', marginTop: '0.25rem', fontSize: '0.72rem', color: 'hsl(142 70% 55%)', fontWeight: 700 }}>
                      <ZapIcon size={14} className="inline mr-1 text-yellow-400" /> Your Best: {best}s
                    </div>
                  )
                })()}
              </div>

              <button
                onClick={() => {
                  setShowPreview(false)
                  setTimerRunning(true)
                }}
                style={{
                  background: 'hsl(142 70% 40%)',
                  border: 'none',
                  borderRadius: 14,
                  padding: '0.85rem 2.5rem',
                  color: 'white',
                  fontSize: '1rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px hsl(142 70% 40% / 0.4)',
                  letterSpacing: '0.02em',
                }}
                id="colorsort-preview-play-btn"
              >
                ▶️ Play!
              </button>
            </div>
          )}

          {/* Header Stats */}
          <GameHUD
            id="colorsort-header-hud"
            style={{
              padding: '0.6rem 0.85rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Mode</span>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', textTransform: 'capitalize' }}>
                {level > 50 ? 'Endless Lab' : `${difficulty} (Lvl ${level})`}
              </div>
              {level <= 50 && (
                <div style={{ fontSize: '0.65rem', color: 'hsl(142 70% 50%)', fontWeight: 700, marginTop: '0.1rem' }}>
                  {getLevelCategoryDetails(level).name}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.55rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>Targets</span>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'hsl(45 100% 55%)', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  <span>Gold: {formatTargetTime(goldTime)}</span>
                  <span>Silver: {formatTargetTime(silverTime)}</span>
                  <span>Bronze: {formatTargetTime(bronzeTime)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Moves</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'white' }} id="colorsort-moves">{movesCount}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Time</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 900, color: 'hsl(48 95% 50%)' }}>
                  {Math.floor(timeElapsed / 60)}:{(timeElapsed % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </GameHUD>

          {/* Jars Grid Area — Progressive Layout */}
          <div
            style={{
              background: 'hsl(222 20% 8%)',
              border: '1px solid hsl(220 15% 15%)',
              borderRadius: 24,
              padding: '2rem 1rem',
              minHeight: '260px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1.5rem',
              position: 'relative',
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
            }}
            id="colorsort-glassmorphic-board"
          >
            {getJarRows(jars, level).map((row, rowIdx) => (
              <div
                key={`row-${rowIdx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '1rem',
                }}
              >
                {row.map((jar, localIdx) => {
                  const idx = rowIdx === 0
                    ? localIdx
                    : getJarRows(jars, level).slice(0, rowIdx).reduce((acc, r) => acc + r.length, 0) + localIdx

                  const isSelected = selectedJarIdx === idx
                  const isSource = pourAnimation?.from === idx
                  const isDest = pourAnimation?.to === idx
                  const isShake = errorShakeIdx === idx

                  // Is this jar highlighted by hints?
                  const isHintFrom = hintHighlight?.from === idx
                  const isHintTo = hintHighlight?.to === idx

                  // Rescue jar indicator
                  const isRescueJar = rescueJarIdx === idx

                  // Animated CSS transform values
                  let transformStyle = isSelected ? 'translateY(-16px)' : 'translateY(0px)'
                  let transformOrigin = '50% 0%'
                  let transitionStyle = 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.2s'

                  if (pourAnimation && isSource) {
                    const { dx, dy } = pourAnimation
                    const isRight = dx >= 0

                    // Position mouth of source jar just above destination mouth
                    const targetX = dx + (isRight ? -14 : 14)
                    const targetY = dy - 55

                    if (pourStep === 'lifting') {
                      transitionStyle = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                      transformStyle = 'translateY(-40px) rotate(0deg)'
                    } else if (pourStep === 'moving') {
                      transitionStyle = 'transform 0.4s ease-in-out'
                      transformStyle = `translate(${targetX}px, ${targetY}px) rotate(0deg)`
                    } else if (pourStep === 'pouring') {
                      transitionStyle = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      const angle = isRight ? 75 : -75
                      transformStyle = `translate(${targetX}px, ${targetY}px) rotate(${angle}deg)`
                    } else if (pourStep === 'returning') {
                      transitionStyle = 'transform 0.5s ease-in-out'
                      transformStyle = 'translate(0px, 0px) rotate(0deg)'
                    }
                  }

                  // Highlight outline styles
                  let jarBorder = isRescueJar
                    ? '2px solid hsl(28 95% 50% / 0.8)'
                    : '2px solid rgba(255, 255, 255, 0.15)'
                  let glow = isRescueJar ? 'drop-shadow(0 0 8px hsl(28 95% 50% / 0.5))' : 'none'

                  if (isSelected) {
                    jarBorder = '2px solid hsl(220 100% 65%)'
                    glow = 'drop-shadow(0 0 10px hsl(220 100% 65% / 0.6))'
                  } else if (isHintFrom) {
                    jarBorder = '2px solid hsl(142 70% 50%)'
                    glow = 'drop-shadow(0 0 12px hsl(142 70% 50% / 0.7))'
                  } else if (isHintTo) {
                    jarBorder = '2px dashed hsl(142 70% 50%)'
                    glow = 'drop-shadow(0 0 8px hsl(142 70% 50% / 0.45))'
                  }

                  const shapeStyles = getJarShapeStyles(idx)

                  return (
                    <div
                      key={`jar-${idx}`}
                      onClick={() => handleJarClick(idx)}
                      style={{
                        position: 'relative',
                        width: 55,
                        height: 140,
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.08) 100%)',
                        border: jarBorder,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        padding: '2px',
                        boxSizing: 'border-box',
                        transition: transitionStyle,
                        transformOrigin,
                        transform: isShake
                          ? 'none'
                          : transformStyle,
                        filter: glow,
                        boxShadow: 'inset 0 4px 15px rgba(255, 255, 255, 0.05), 0 8px 20px rgba(0,0,0,0.5)',
                        animation: isShake ? 'shake 0.35s ease-in-out' : 'none',
                        zIndex: isSource ? 100 : isDest ? 50 : 10,
                        ...shapeStyles,
                      }}
                      className="color-sort-jar-container"
                      id={`colorsort-jar-${idx}`}
                    >
                      {/* Rescue Jar Label */}
                      {isRescueJar && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -18,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: '0.55rem',
                            fontWeight: 800,
                            color: 'hsl(28 95% 60%)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                          }}
                        >
                          🆘 Rescue
                        </div>
                      )}

                      {/* Jar Lip Top overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          top: -4,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: '105%',
                          height: 6,
                          background: 'rgba(255, 255, 255, 0.35)',
                          borderRadius: 4,
                          border: '1px solid rgba(255,255,255,0.25)',
                        }}
                      />

                      {/* Neck metal band */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 24,
                          left: 0,
                          right: 0,
                          height: 4,
                          background: 'linear-gradient(90deg, #d4af37, #fff, #aa7c11, #fff, #d4af37)',
                          borderTop: '1px solid rgba(255,255,255,0.4)',
                          borderBottom: '1px solid rgba(0,0,0,0.4)',
                          zIndex: 9,
                          pointerEvents: 'none',
                        }}
                      />
                      {/* Base metal band */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 0,
                          right: 0,
                          height: 5,
                          background: 'linear-gradient(90deg, #d4af37, #fff, #aa7c11, #fff, #d4af37)',
                          borderTop: '1px solid rgba(255,255,255,0.4)',
                          borderBottom: '1px solid rgba(0,0,0,0.4)',
                          zIndex: 9,
                          pointerEvents: 'none',
                        }}
                      />

                      {/* Glossy Diagonal Sheen Reflection */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.03) 70%, rgba(255,255,255,0.08) 100%)',
                          borderRadius: '4px 4px 16px 16px',
                          pointerEvents: 'none',
                          zIndex: 8,
                        }}
                      />

                      {/* Glass Side Highlights */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 20%, rgba(255,255,255,0) 80%, rgba(255,255,255,0.1) 100%)',
                          borderRadius: '4px 4px 16px 16px',
                          pointerEvents: 'none',
                          zIndex: 2,
                        }}
                      />

                      {/* Flowing Liquid Stream (Renders relative to Destination Jar) */}
                      {isDest && pourStep === 'pouring' && pourAnimation && (
                        <>
                          <div
                            style={{
                              position: 'absolute',
                              top: -55,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 14,
                              height: 55,
                              borderRadius: '4px',
                              zIndex: 90,
                              // Animated scrolling flow gradient
                              background: `linear-gradient(to bottom, ${pourAnimation.color} 0%, ${pourAnimation.color.replace(')', ' / 0.8)')} 30%, ${pourAnimation.color} 70%, ${pourAnimation.color} 100%)`,
                              backgroundSize: '100% 24px',
                              animation: 'colorsort-stream-flow 0.4s linear infinite',
                              boxShadow: `0 0 12px ${pourAnimation.color}`,
                              pointerEvents: 'none',
                            }}
                          >
                            {/* Falling droplets */}
                            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                              <div className="stream-droplet" style={{ animationDelay: '0.1s', backgroundColor: 'white' }} />
                              <div className="stream-droplet" style={{ animationDelay: '0.25s', backgroundColor: 'white' }} />
                              <div className="stream-droplet" style={{ animationDelay: '0.4s', backgroundColor: 'white' }} />
                            </div>
                          </div>

                          {/* Splash ripple effect */}
                          <div
                            style={{
                              position: 'absolute',
                              top: -2,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 24,
                              height: 6,
                              borderRadius: '50%',
                              border: `2px solid ${pourAnimation.color}`,
                              animation: 'colorsort-splash-ripple 0.6s ease-out infinite',
                              pointerEvents: 'none',
                              zIndex: 95,
                            }}
                          />
                        </>
                      )}

                      {/* Render Liquid Layers */}
                      {jar.map((color, layerIdx) => {
                        const isBottom = layerIdx === 0
                        const isDraining = pourAnimation && isSource && (layerIdx >= jar.length - pourAnimation.amount)

                        let segmentHeight = '24%'
                        if (isDraining) {
                          segmentHeight = pourStep === 'pouring' || pourStep === 'returning' ? '0%' : '24%'
                        }

                        return (
                          <div
                            key={`layer-${layerIdx}`}
                            style={{
                              height: segmentHeight,
                              background: `linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0%, ${color} 22%, ${color} 78%, rgba(0, 0, 0, 0.28) 100%)`,
                              boxShadow: 'inset 0 4px 6px rgba(255, 255, 255, 0.15), inset 0 -4px 6px rgba(0, 0, 0, 0.25)',
                              width: '100%',
                              transition: pourAnimation ? 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                              borderRadius: isBottom ? '0 0 14px 14px' : '0',
                              position: 'relative',
                              filter: `drop-shadow(0 0 5px ${color.replace(')', ' / 0.45)')})`,
                              opacity: 1,
                            }}
                          >
                            {/* Meniscus Highlight at the top of the layer */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 3,
                                background: 'rgba(255, 255, 255, 0.35)',
                                pointerEvents: 'none',
                              }}
                            />
                            {/* Highlights overlay */}
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: '12%',
                                width: '8%',
                                background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)',
                                pointerEvents: 'none',
                              }}
                            />
                          </div>
                        )
                      })}

                      {/* Temporary Rising Liquid Layer in Destination Jar during pouring */}
                      {isDest && pourAnimation && (
                        <div
                          style={{
                            height: pourStep === 'pouring' || pourStep === 'returning' ? `${pourAnimation.amount * 24}%` : '0%',
                            background: `linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0%, ${pourAnimation.color} 22%, ${pourAnimation.color} 78%, rgba(0, 0, 0, 0.28) 100%)`,
                            boxShadow: 'inset 0 4px 6px rgba(255, 255, 255, 0.15), inset 0 -4px 6px rgba(0, 0, 0, 0.25)',
                            width: '100%',
                            transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderRadius: jar.length === 0 ? '0 0 14px 14px' : '0',
                            position: 'relative',
                            filter: `drop-shadow(0 0 5px ${pourAnimation.color.replace(')', ' / 0.45)')})`,
                            opacity: 1,
                          }}
                        >
                          {/* Meniscus Highlight at the top of the layer */}
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: 3,
                              background: 'rgba(255, 255, 255, 0.35)',
                              pointerEvents: 'none',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: '12%',
                              width: '8%',
                              background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 100%)',
                              pointerEvents: 'none',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Hint Message display */}
          {hintMessage && (
            <div
              style={{
                background: 'hsl(142 70% 45% / 0.1)',
                border: '1px solid hsl(142 70% 45% / 0.3)',
                padding: '0.65rem',
                borderRadius: 12,
                fontSize: '0.78rem',
                color: 'hsl(142 70% 60%)',
                textAlign: 'center',
                fontWeight: 600,
              }}
              id="colorsort-hint-box"
            >
              {hintMessage}
            </div>
          )}

          {/* Bottom Action Controls */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleHintClick}
              className="btn btn-secondary"
              style={{ flex: 1.2, borderRadius: 12 }}
              id="colorsort-hint-btn"
            >
              <LightbulbIcon size={14} className="inline mr-1 text-yellow-400" /> Hint ({hintsUsed === 0 ? 'Free' : 'Ad'})
            </button>
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12, opacity: undoStack.length === 0 ? 0.45 : 1 }}
              id="colorsort-undo-btn"
            >
              ↩️ Undo
            </button>
            <button
              onClick={() => {
                if (level > 50) startLabLevel()
                else startLevel(difficulty, level)
              }}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 12 }}
              id="colorsort-restart-btn"
            >
              <HistoryIcon size={14} className="inline mr-1" /> Restart
            </button>
            <button
              onClick={() => {
                setSelectedJarIdx(null)
                setTimerRunning(false)
                setStage(level > 50 ? 'endless_lab' : 'setup')
              }}
              className="btn btn-ghost"
              style={{ flex: 0.8, borderRadius: 12 }}
              id="colorsort-exit-gameplay-btn"
            >
              <LogOutIcon size={14} className="inline mr-1" /> Exit
            </button>
          </div>
        </div>
      )}

      {/* STUCK Modal Overlay */}
      {isStuck && stage === 'playing' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          id="colorsort-stuck-modal"
        >
          <div
            className="card"
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              background: 'hsl(222 18% 12%)',
              maxWidth: 360,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'center',
              border: '1px solid hsl(28 95% 50% / 0.3)',
              borderRadius: 20,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.35rem' }}><AlertIcon size={36} className="text-red-500" /></div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: 0 }}>
                You&apos;re Stuck
              </h3>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                No valid solution remains from this position.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%' }}>
              <button
                onClick={() => {
                  setIsStuck(false)
                  setRestartCount(c => c + 1)
                  if (level > 50) startLabLevel()
                  else startLevel(difficulty, level)
                }}
                style={{
                  background: 'hsl(215 90% 50%)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '0.75rem',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
                id="colorsort-stuck-restart-btn"
              >
                Restart Level
              </button>

              {!usedRescueJar && (
                <button
                  onClick={addRescueJar}
                  style={{
                    background: 'hsl(28 95% 45%)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0.75rem',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  id="colorsort-rescue-jar-btn"
                >
                  🆘 Add Rescue Jar
                </button>
              )}

              {showAdaptiveOption && (
                <button
                  onClick={() => {
                    setIsStuck(false)
                    if (level > 50) startLabLevel()
                    else startLevel(difficulty, level, 1)
                  }}
                  style={{
                    background: 'hsl(270 70% 50%)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0.75rem',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                  id="colorsort-easier-variant-btn"
                >
                  Try Easier Variant
                </button>
              )}

              <button
                onClick={() => setIsStuck(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid hsl(220 15% 25%)',
                  borderRadius: 12,
                  padding: '0.6rem',
                  color: 'hsl(220 10% 55%)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                ↩️ Continue Anyway (Undo moves)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsored Ad simulation overlay */}
      {adModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          id="colorsort-ad-popup"
        >
          <div
            className="card"
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              background: 'hsl(222 18% 12%)',
              maxWidth: 360,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 900, color: 'hsl(48 95% 50%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.25rem' }}>
                SPONSORED ADVERTISEMENT
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>Unlock Next Hint</h3>
            </div>

            <div
              style={{
                width: '100%',
                aspectRatio: 1.6,
                background: 'hsl(222 20% 8%)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid hsl(220 15% 18%)',
                color: 'hsl(220 10% 50%)',
                fontSize: '0.8rem',
              }}
            >
              📺 Playing Ad Video...
            </div>

            {adCountdown > 0 ? (
              <button
                disabled
                className="btn btn-secondary"
                style={{ width: '100%', borderRadius: 10, opacity: 0.5, cursor: 'not-allowed' }}
              >
                Claim reward in {adCountdown}s
              </button>
            ) : (
              <button
                onClick={claimRewardedHint}
                className="btn btn-gold"
                style={{ width: '100%', borderRadius: 10 }}
                id="colorsort-claim-ad-reward-btn"
              >
                <GiftIcon size={14} className="inline mr-1 text-pink-400" /> Claim Extra Hint
              </button>
            )}
          </div>
        </div>
      )}

      {/* Keyframe definitions injection */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        @keyframes colorsort-stream-flow {
          0% { background-position-y: 0px; }
          100% { background-position-y: 24px; }
        }
        .stream-droplet {
          position: absolute;
          width: 3px;
          height: 5px;
          border-radius: 50%;
          left: 50%;
          transform: translateX(-50%);
          opacity: 0.8;
          animation: droplet-fall 0.4s linear infinite;
        }
        @keyframes droplet-fall {
          0% { top: 0%; opacity: 0; }
          30% { opacity: 0.95; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes colorsort-splash-ripple {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0.8; }
          100% { transform: translate(-50%, 0) scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
