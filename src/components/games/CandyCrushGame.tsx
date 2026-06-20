'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { generateLevel, LevelData, ALL_CANDIES } from '@/lib/match3/LevelGenerator'
import { BoardCell, areAdjacent, isMoveable, cloneGrid, findMatches, processMatchesAndCascades, hasPossibleMoves, reshuffleGrid, executeSpecialCombo } from '@/lib/match3/Match3Engine'
import { useToast } from '@/lib/contexts/ToastContext'

// Color map details
const GEM_COLORS: Record<string, { emoji: string; name: string; gradient: string; glow: string }> = {
  red: { emoji: '❤️', name: 'Ruby Heart', gradient: 'linear-gradient(135deg, #ff4d6d, #c9184a)', glow: '0 0 12px rgba(255, 77, 109, 0.5)' },
  blue: { emoji: '🌟', name: 'Sapphire Star', gradient: 'linear-gradient(135deg, #3a86c8, #0056b3)', glow: '0 0 12px rgba(58, 134, 200, 0.5)' },
  green: { emoji: '🍀', name: 'Emerald Clover', gradient: 'linear-gradient(135deg, #38b000, #007200)', glow: '0 0 12px rgba(56, 176, 0, 0.5)' },
  yellow: { emoji: '☀️', name: 'Amber Sun', gradient: 'linear-gradient(135deg, #ffb703, #fb8500)', glow: '0 0 12px rgba(255, 183, 3, 0.5)' },
  purple: { emoji: '🌙', name: 'Amethyst Moon', gradient: 'linear-gradient(135deg, #9d4edd, #5a189a)', glow: '0 0 12px rgba(157, 78, 221, 0.5)' },
  cyan: { emoji: '💎', name: 'Diamond Crystal', gradient: 'linear-gradient(135deg, #00f5d4, #00bbf9)', glow: '0 0 12px rgba(0, 245, 212, 0.5)' },
  orange: { emoji: '🔥', name: 'Tangerine Flame', gradient: 'linear-gradient(135deg, #ff7b00, #ff0000)', glow: '0 0 12px rgba(255, 123, 0, 0.5)' },
}

const BLOCKER_INFO: Record<string, { emoji: string; label: string; style: React.CSSProperties }> = {
  ice: { emoji: '❄️', label: 'Ice Block', style: { border: '2px solid #a5f3fc', background: 'rgba(165, 243, 252, 0.25)' } },
  stone: { emoji: '🪨', label: 'Stone Block', style: { border: '2px solid #64748b', background: 'rgba(100, 116, 139, 0.4)' } },
  lock: { emoji: '🔒', label: 'Locked Candy', style: { border: '2px solid #f87171', background: 'rgba(248, 113, 113, 0.15)' } },
  double_lock: { emoji: '🔐', label: 'Double Locked', style: { border: '2px solid #b91c1c', background: 'rgba(185, 28, 28, 0.25)' } },
  crate: { emoji: '📦', label: 'Crate Box', style: { border: '2px solid #b45309', background: 'rgba(180, 83, 9, 0.3)' } },
}

const LOCAL_STORAGE_PROGRESS_KEY = 'gamehub_candycrush_progress_v1'

interface SavedProgress {
  version: number
  currentLevel: number
  highScore: number
  stats: {
    playCount: number
    winCount: number
    totalMatches: number
    totalBlockersCleared: number
    totalColorBombsUsed: number
  }
  achievements: string[]
}

// Sub-component for individual cell rendering (memoized to maximize performance)
interface CellProps {
  cell: BoardCell
  isSelected: boolean
  onClick: (r: number, c: number) => void
}

const CandyCell: React.FC<CellProps> = React.memo(({ cell, isSelected, onClick }) => {
  const gem = cell.color ? GEM_COLORS[cell.color] : null

  // Special effects styles
  const specialBadge = useMemo(() => {
    if (!cell.special) return null
    switch (cell.special) {
      case 'line_horizontal':
        return <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>↔️</span>
      case 'line_vertical':
        return <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>↕️</span>
      case 'area':
        return <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>💥</span>
      case 'color':
        return <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: 3 }}>🌈</span>
      default:
        return null
    }
  }, [cell.special])

  const blockerStyle = useMemo(() => {
    if (!cell.blocker) return {}
    return BLOCKER_INFO[cell.blocker]?.style || {}
  }, [cell.blocker])

  const blockerEmoji = useMemo(() => {
    if (!cell.blocker) return null
    return (
      <span style={{
        position: 'absolute',
        top: 2,
        left: 2,
        fontSize: '0.85rem',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))'
      }}>
        {BLOCKER_INFO[cell.blocker]?.emoji}
      </span>
    )
  }, [cell.blocker])

  const cellStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'relative',
      aspectRatio: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      cursor: isMoveable(cell) ? 'pointer' : 'not-allowed',
      background: 'rgba(255,255,255,0.03)',
      border: isSelected ? '2px solid hsl(220 100% 60%)' : '1px solid rgba(255,255,255,0.08)',
      boxShadow: isSelected ? '0 0 10px hsl(220 100% 60% / 0.5)' : 'none',
      transition: 'all 0.15s ease-in-out',
      overflow: 'hidden',
      userSelect: 'none',
    }

    if (gem && !cell.blocker) {
      base.background = gem.gradient
      base.boxShadow = isSelected ? base.boxShadow : gem.glow
    }

    return { ...base, ...blockerStyle }
  }, [cell, isSelected, gem, blockerStyle])

  return (
    <div
      style={cellStyle}
      onClick={() => onClick(cell.row, cell.col)}
      className="candy-cell-hover"
    >
      {gem && !['stone', 'crate'].includes(cell.blocker || '') && (
        <span style={{
          fontSize: '1.4rem',
          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
          transition: 'transform 0.15s ease',
          zIndex: 1,
        }}>
          {gem.emoji}
        </span>
      )}
      {cell.blocker === 'stone' && (
        <span style={{ fontSize: '1.3rem', zIndex: 1 }}>🪨</span>
      )}
      {cell.blocker === 'crate' && (
        <span style={{ fontSize: '1.3rem', zIndex: 1 }}>📦</span>
      )}
      {blockerEmoji}
      {specialBadge}
    </div>
  )
})

CandyCell.displayName = 'CandyCell'

export default function CandyCrushGame() {
  const { submitGameResult } = useGameSession()
  const { addToast } = useToast()

  // Game Progress state
  const [saveData, setSaveData] = useState<SavedProgress>({
    version: 1,
    currentLevel: 1,
    highScore: 0,
    stats: {
      playCount: 0,
      winCount: 0,
      totalMatches: 0,
      totalBlockersCleared: 0,
      totalColorBombsUsed: 0
    },
    achievements: []
  })

  const [levelNumber, setLevelNumber] = useState(1)
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [grid, setGrid] = useState<BoardCell[][]>([])
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null)

  // Session Stats
  const [score, setScore] = useState(0)
  const [movesRemaining, setMovesRemaining] = useState(30)
  const [isLocked, setIsLocked] = useState(false)
  const [isShuffling, setIsShuffling] = useState(false)
  const [maxComboThisMatch, setMaxComboThisMatch] = useState(0)
  const [blockersClearedThisMatch, setBlockersClearedThisMatch] = useState(0)
  const [colorBombsUsedThisMatch, setColorBombsUsedThisMatch] = useState(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [matchResult, setMatchResult] = useState<'win' | 'loss' | null>(null)

  // Load progress from local storage on mount
  useEffect(() => {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROGRESS_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SavedProgress
        if (parsed.version === 1) {
          setSaveData(parsed)
          setLevelNumber(parsed.currentLevel || 1)
        }
      } catch (e) {
        console.error('Failed to parse save data', e)
      }
    }
  }, [])

  // Generate / Load Level
  const initLevel = useCallback((lvlNum: number) => {
    const lvl = generateLevel(lvlNum)
    setLevelData(lvl)
    setScore(0)
    setMovesRemaining(lvl.moveLimit)
    setMaxComboThisMatch(0)
    setBlockersClearedThisMatch(0)
    setColorBombsUsedThisMatch(0)
    setGameEnded(false)
    setMatchResult(null)
    setSelectedCell(null)

    // Build the grid representation
    const R = lvl.boardSize
    const C = lvl.boardSize
    let freshGrid: BoardCell[][] = []

    let validInitialBoard = false
    let attempts = 0

    while (!validInitialBoard && attempts < 100) {
      attempts++
      freshGrid = Array(R).fill(null).map((_, r) =>
        Array(C).fill(null).map((_, c) => {
          const randomColor = lvl.candyTypes[Math.floor(Math.random() * lvl.candyTypes.length)]
          return {
            id: `cell_${r}_${c}_${Date.now()}`,
            row: r,
            col: c,
            color: randomColor,
            special: null,
            blocker: lvl.blockersGrid[r][c],
          }
        })
      )

      // Ensure no initial match-3s, and make sure it has valid moves
      if (!findMatches(freshGrid).matchedCoords.length && hasPossibleMoves(freshGrid)) {
        validInitialBoard = true
      }
    }

    setGrid(freshGrid)
  }, [])

  useEffect(() => {
    initLevel(levelNumber)
  }, [levelNumber, initLevel])

  // Save progress helper
  const saveProgress = useCallback((updated: SavedProgress) => {
    setSaveData(updated)
    localStorage.setItem(LOCAL_STORAGE_PROGRESS_KEY, JSON.stringify(updated))
  }, [])

  // Sync objectives progress
  const objectivesProgress = useMemo(() => {
    if (!levelData) return []
    return levelData.objectives.map((obj) => {
      let currentVal = 0
      if (obj.type === 'score') {
        currentVal = score
      } else if (obj.type === 'clear_color') {
        // We will increment this as matches are processed, we track them in state if needed or compute.
        // For clear color, we'll keep a mutable session tracking or read it from total cleared.
        // Let's attach current value from state. We'll store objective currents in levelData itself.
        currentVal = obj.current
      } else if (obj.type === 'clear_blockers') {
        currentVal = obj.current
      } else if (obj.type === 'combo') {
        currentVal = maxComboThisMatch
      }

      return {
        ...obj,
        current: Math.min(obj.target, currentVal),
        completed: currentVal >= obj.target
      }
    })
  }, [levelData, score, maxComboThisMatch])


  const triggerEndGame = useCallback((res: 'win' | 'loss', finalScore: number) => {
    if (gameEnded) return
    setGameEnded(true)
    setMatchResult(res)

    // Calculate XP
    let xpGained = 0
    let coinsGained = 5
    if (res === 'win') {
      const levelBonus = levelNumber * 10
      const perfectWinBonus = movesRemaining > (levelData?.moveLimit || 30) / 2 ? 150 : 0
      const comboBonus = maxComboThisMatch * 15
      xpGained = 150 + levelBonus + perfectWinBonus + comboBonus
      coinsGained = 30 + Math.floor(finalScore / 1000)
    } else {
      xpGained = 25
    }

    // Save statistics in local storage
    const newStats = {
      playCount: saveData.stats.playCount + 1,
      winCount: saveData.stats.winCount + (res === 'win' ? 1 : 0),
      totalMatches: saveData.stats.totalMatches, // incremented during game
      totalBlockersCleared: saveData.stats.totalBlockersCleared + blockersClearedThisMatch,
      totalColorBombsUsed: saveData.stats.totalColorBombsUsed + colorBombsUsedThisMatch
    }

    const nextLevel = res === 'win' ? levelNumber + 1 : levelNumber

    // Achievements checklist
    const newAchievements = [...saveData.achievements]
    const checkUnlock = (slug: string, cond: boolean) => {
      if (cond && !newAchievements.includes(slug)) {
        newAchievements.push(slug)
        // trigger achievement toast
        setTimeout(() => {
          addToast(
            'achievement_unlocked',
            'Achievement Unlocked! 🏆',
            slug.replace('cc-', '').replace(/-/g, ' ').toUpperCase()
          )
        }, 1000)
      }
    }

    checkUnlock('cc-first-match', newStats.playCount >= 1)
    checkUnlock('cc-combo-10', maxComboThisMatch >= 10)
    checkUnlock('cc-color-bomb-50', newStats.totalColorBombsUsed >= 50)
    checkUnlock('cc-clear-1000-blockers', newStats.totalBlockersCleared >= 1000)
    checkUnlock('cc-level-100', nextLevel > 100)
    checkUnlock('cc-level-500', nextLevel > 500)
    checkUnlock('cc-level-1000', nextLevel > 1000)

    const updatedSave: SavedProgress = {
      version: 1,
      currentLevel: nextLevel,
      highScore: Math.max(saveData.highScore, finalScore),
      stats: newStats,
      achievements: newAchievements
    }

    saveProgress(updatedSave)

    // Trigger GameSession context XP modal
    submitGameResult({
      gameSlug: 'ai-infinite-candy-crush',
      result: res,
      metadata: {
        score: finalScore,
        gameMetadata: {
          level: levelNumber,
          difficulty: levelData?.difficultyTier || 'Medium',
          movesRemaining,
          maxCombo: maxComboThisMatch,
          xpEarned: xpGained,
          coinsEarned: coinsGained,
        }
      }
    })
  }, [levelNumber, levelData, movesRemaining, maxComboThisMatch, blockersClearedThisMatch, colorBombsUsedThisMatch, saveData, saveProgress, submitGameResult, addToast, gameEnded])

  // Check loss condition
  useEffect(() => {
    if (levelData && movesRemaining <= 0 && !gameEnded) {
      // Check if current updates satisfy objectives
      const allDone = objectivesProgress.every((obj) => obj.completed)
      if (!allDone) {
        triggerEndGame('loss', score)
      }
    }
  }, [movesRemaining, objectivesProgress, levelData, gameEnded, triggerEndGame, score])

  // Handle cascade matching loop
  const triggerCascades = useCallback(async (currentGrid: BoardCell[][]) => {
    setIsLocked(true)
    let tempGrid = cloneGrid(currentGrid)
    let combo = 0
    let totalScoreIncrease = 0

    let cascadeActive = true
    while (cascadeActive) {
      const { grid: nextGrid, scoreGained, blockersCleared, cascadeGrid } = processMatchesAndCascades(
        tempGrid,
        levelData?.candyTypes || ALL_CANDIES
      )

      if (scoreGained > 0) {
        combo++
        setMaxComboThisMatch((c) => Math.max(c, combo))

        // Scale score with combo multiplier
        const comboMultiplier = 1 + (combo - 1) * 0.5
        const addedScore = Math.floor(scoreGained * comboMultiplier)
        totalScoreIncrease += addedScore

        // Increment blockers cleared
        if (blockersCleared.length > 0) {
          setBlockersClearedThisMatch((b) => b + blockersCleared.length)

          // Clear objective items
          setLevelData((currLvl) => {
            if (!currLvl) return null
            const nextObjs = currLvl.objectives.map((obj) => {
              if (obj.type === 'clear_blockers') {
                const countThisTurn = blockersCleared.filter((bc) => bc.type === obj.blockerType).length
                return { ...obj, current: obj.current + countThisTurn }
              }
              return obj
            })
            return { ...currLvl, objectives: nextObjs }
          })
        }

        // Increment matched color counts
        const matches = findMatches(tempGrid)
        const clearedColorCounts: Record<string, number> = {}
        for (const coord of matches.matchedCoords) {
          const color = tempGrid[coord.r][coord.c].color
          if (color) {
            clearedColorCounts[color] = (clearedColorCounts[color] || 0) + 1
          }
        }

        // Update color objectives
        setLevelData((currLvl) => {
          if (!currLvl) return null
          const nextObjs = currLvl.objectives.map((obj) => {
            if (obj.type === 'clear_color' && obj.color && clearedColorCounts[obj.color]) {
              return { ...obj, current: obj.current + clearedColorCounts[obj.color] }
            }
            return obj
          })
          return { ...currLvl, objectives: nextObjs }
        })

        // Apply grid update and pause briefly for visual collapse transition
        setGrid(nextGrid)
        tempGrid = nextGrid
        await new Promise((resolve) => setTimeout(resolve, 300))
      } else {
        cascadeActive = false
      }
    }

    // Accumulate final score
    setScore((s) => {
      const nextScore = s + totalScoreIncrease
      // Instantly verify victory
      if (levelData) {
        const nextObjs = levelData.objectives.map((obj) => {
          let val = 0
          if (obj.type === 'score') val = nextScore
          else if (obj.type === 'combo') val = Math.max(maxComboThisMatch, combo)
          else val = obj.current
          return { ...obj, current: val, completed: val >= obj.target }
        })
        const allDone = nextObjs.every((o) => o.completed)
        if (allDone) {
          triggerEndGame('win', nextScore)
        }
      }
      return nextScore
    })

    // Check if grid is deadlocked
    if (!hasPossibleMoves(tempGrid) && !gameEnded) {
      setIsShuffling(true)
      await new Promise((resolve) => setTimeout(resolve, 800))
      const shuffled = reshuffleGrid(tempGrid, levelData?.candyTypes || ALL_CANDIES)
      setGrid(shuffled)
      setIsShuffling(false)
      addToast('info', 'No Moves Left', 'Board has been reshuffled!')
    }

    setIsLocked(false)
  }, [levelData, gameEnded, triggerEndGame, maxComboThisMatch, addToast])

  // Handle cell selection and swap interactions
  const handleCellClick = useCallback(async (r: number, c: number) => {
    if (isLocked || gameEnded) return

    const cell = grid[r][c]
    if (!isMoveable(cell)) return

    if (!selectedCell) {
      setSelectedCell({ r, c })
    } else {
      const { r: r1, c: c1 } = selectedCell

      // Adjacent swap check
      if (areAdjacent(r1, c1, r, c)) {
        setSelectedCell(null)
        setIsLocked(true)

        // Execute Swap in temp grid
        const temp = cloneGrid(grid)
        const cell1 = { ...temp[r1][c1], row: r, col: c }
        const cell2 = { ...temp[r][c], row: r1, col: c1 }

        temp[r][c] = cell1
        temp[r1][c1] = cell2

        // Check if both are special candy combos
        const hasSpecialCombo = !!(cell1.special && cell2.special)
        let comboResult = { explodedCells: [] as {r:number; c:number}[], scoreGained: 0, blockersCleared: [] as any[] }

        if (hasSpecialCombo) {
          const res = executeSpecialCombo(temp, r1, c1, r, c)
          comboResult = res
          if (cell1.special === 'color' || cell2.special === 'color') {
            setColorBombsUsedThisMatch((cb) => cb + 1)
          }
        }

        const matches = findMatches(temp)
        const isValidSwap = matches.matchedCoords.length > 0 || hasSpecialCombo

        if (isValidSwap) {
          setGrid(temp)
          setMovesRemaining((m) => m - 1)

          // If special combo, clear exploded cells and trigger cascade
          if (hasSpecialCombo) {
            setScore((s) => s + comboResult.scoreGained)
            if (comboResult.blockersCleared.length > 0) {
              setBlockersClearedThisMatch((b) => b + comboResult.blockersCleared.length)
            }
            // Clear exploded cells
            for (const { r: er, c: ec } of comboResult.explodedCells) {
              temp[er][ec].color = null
              temp[er][ec].special = null
            }
            setGrid(temp)
            await new Promise((resolve) => setTimeout(resolve, 250))
          }

          // Trigger falling gravity cascades
          await triggerCascades(temp)
        } else {
          // Play shake feedback or reject swap visual
          addToast('error', 'Invalid Move', 'Must match 3 or combine special candies!')
          setIsLocked(false)
        }
      } else {
        // Toggle selection to new cell
        setSelectedCell({ r, c })
      }
    }
  }, [grid, selectedCell, isLocked, gameEnded, triggerCascades, addToast])

  if (!levelData) {
    return <div style={{ color: 'hsl(220 10% 50%)', padding: '2rem', textAlign: 'center' }}>Loading level parameters...</div>
  }

  return (
    <div style={{
      maxWidth: '850px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      width: '100%',
    }} className="animate-fadeIn">
      {/* Top HUD Dashboard */}
      <div className="card" style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, hsl(220 20% 11%), hsl(220 20% 8%))',
        border: '1px solid hsl(220 20% 16%)',
        borderRadius: '20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}>
        {/* Level & Highscore */}
        <div>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            AI Singleplayer Match-3
          </span>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
            <span>Level {levelNumber}</span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 99, background: 'hsl(220 20% 18%)', color: 'hsl(45 100% 65%)', fontWeight: 800 }}>
              {levelData.difficultyTier}
            </span>
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.2rem' }}>
            High Score: <strong style={{ color: 'white' }}>{saveData.highScore}</strong>
          </div>
        </div>

        {/* Moves constraint */}
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Moves Left</div>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: 950,
            color: movesRemaining <= 5 ? 'hsl(0 80% 60%)' : 'hsl(220 100% 70%)',
            lineHeight: 1.1,
            marginTop: '0.1rem',
          }}>
            {movesRemaining}
          </div>
        </div>

        {/* Score tracker */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Current Score</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(45 100% 60%)', lineHeight: 1.1, marginTop: '0.1rem' }}>
            {score}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem' }}>
            Target: <strong>{levelData.targetScore}</strong>
          </div>
        </div>
      </div>

      {/* Main Game Layout grid split */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '1rem',
      }} className="md:grid-cols-3">
        {/* Left Side: Board Panel */}
        <div className="md:col-span-2" style={{ position: 'relative' }}>
          <div className="card" style={{
            padding: '1rem',
            background: 'hsl(220 20% 9% / 0.8)',
            border: '1px solid hsl(220 20% 15%)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            minHeight: '400px',
          }}>
            {isShuffling && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10,15,30,0.85)',
                borderRadius: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                backdropFilter: 'blur(4px)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔄</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>No Possible Moves</h3>
                <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)' }}>Reshuffling board...</p>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${levelData.boardSize}, 1fr)`,
              gap: '4px',
              width: '100%',
              maxWidth: '500px',
            }}>
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isSel = !!(selectedCell && selectedCell.r === r && selectedCell.c === c)
                  return (
                    <CandyCell
                      key={cell.id}
                      cell={cell}
                      isSelected={isSel}
                      onClick={handleCellClick}
                    />
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Level Objectives Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Objectives Card */}
          <div className="card" style={{
            padding: '1.25rem',
            background: 'hsl(220 20% 10% / 0.95)',
            border: '1px solid hsl(220 20% 16%)',
            borderRadius: '20px',
          }}>
            <h3 style={{ margin: 0, fontSize: '0.78rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700, letterSpacing: '0.05em' }}>
              🎯 Level Objectives
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '1rem' }}>
              {objectivesProgress.map((obj, idx) => {
                let text = ''
                let icon = '🎯'

                if (obj.type === 'score') {
                  text = `Reach ${obj.target} Points`
                  icon = '🏆'
                } else if (obj.type === 'clear_color' && obj.color) {
                  const gemName = GEM_COLORS[obj.color]?.name || obj.color
                  text = `Clear ${obj.target} ${gemName}s`
                  icon = GEM_COLORS[obj.color]?.emoji || '🍬'
                } else if (obj.type === 'clear_blockers' && obj.blockerType) {
                  text = `Clear ${obj.target} ${BLOCKER_INFO[obj.blockerType]?.label || obj.blockerType}`
                  icon = BLOCKER_INFO[obj.blockerType]?.emoji || '🧱'
                } else if (obj.type === 'combo') {
                  text = `Reach a ${obj.target}x Combo Chain`
                  icon = '⚡'
                }

                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.65rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                      <span style={{
                        fontSize: '0.78rem',
                        color: obj.completed ? 'hsl(220 10% 50%)' : 'white',
                        textDecoration: obj.completed ? 'line-through' : 'none',
                        fontWeight: 600,
                      }}>
                        {text}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: obj.completed ? 'hsl(142 70% 55%)' : 'hsl(220 10% 60%)' }}>
                      {obj.completed ? '✅' : `${obj.current} / ${obj.target}`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Level Switch / Reset tools */}
          <div className="card" style={{
            padding: '1.25rem',
            background: 'hsl(220 20% 9%)',
            border: '1px solid hsl(220 20% 15%)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            <button
              onClick={() => initLevel(levelNumber)}
              className="btn btn-secondary"
              style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              🔄 Restart Level
            </button>

            {levelNumber > 1 && (
              <button
                onClick={() => setLevelNumber((l) => Math.max(1, l - 1))}
                className="btn btn-secondary"
                style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '10px' }}
              >
                ◀ Previous Level
              </button>
            )}

            <button
              onClick={() => setLevelNumber((l) => l + 1)}
              className="btn btn-secondary"
              style={{ padding: '0.45rem', fontSize: '0.8rem', borderRadius: '10px' }}
            >
              Next Level ▶
            </button>
          </div>
        </div>
      </div>

      {/* Game Over / Win Overlay modal */}
      {gameEnded && matchResult && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 10, 20, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          backdropFilter: 'blur(8px)',
        }} className="animate-fadeIn">
          <div className="card text-center animate-scaleUp" style={{
            maxWidth: '380px',
            width: '90%',
            padding: '2rem 1.5rem',
            background: 'linear-gradient(135deg, hsl(220 20% 12%), hsl(220 20% 8%))',
            border: '2px solid',
            borderColor: matchResult === 'win' ? 'hsl(142 70% 50% / 0.4)' : 'hsl(0 80% 50% / 0.4)',
            borderRadius: '28px',
            boxShadow: matchResult === 'win' ? '0 0 30px rgba(74, 222, 128, 0.15)' : '0 0 30px rgba(248, 113, 113, 0.15)',
          }}>
            <span style={{ fontSize: '3.5rem', marginBottom: '0.5rem', display: 'block' }}>
              {matchResult === 'win' ? '🏆' : '💀'}
            </span>

            <h2 style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              color: matchResult === 'win' ? 'hsl(142 70% 55%)' : 'hsl(0 80% 60%)',
              letterSpacing: '-0.02em',
            }}>
              {matchResult === 'win' ? 'Level Cleared!' : 'Moves Depleted!'}
            </h2>

            <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.825rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
              {matchResult === 'win'
                ? `Outstanding! You successfully cleared all level objectives for Level ${levelNumber}.`
                : `You ran out of moves before completing all level objectives. Keep practicing!`
              }
            </p>

            {/* Score box */}
            <div style={{
              margin: '1.25rem 0',
              padding: '0.75rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
            }}>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Final Score</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 950, color: 'hsl(45 100% 60%)', marginTop: '0.15rem' }}>{score}</div>
              {matchResult === 'win' && (
                <div style={{ fontSize: '0.7rem', color: 'hsl(142 70% 55%)', marginTop: '0.25rem', fontWeight: 600 }}>
                  🌟 +{150 + levelNumber * 10} XP Win Reward
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {matchResult === 'win' ? (
                <button
                  onClick={() => {
                    setLevelNumber((l) => l + 1)
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem', borderRadius: '12px', fontWeight: 800 }}
                >
                  🚀 Next Level
                </button>
              ) : (
                <button
                  onClick={() => {
                    initLevel(levelNumber)
                  }}
                  className="btn btn-primary"
                  style={{ padding: '0.75rem', borderRadius: '12px', fontWeight: 800 }}
                >
                  🔄 Try Again
                </button>
              )}

              <button
                onClick={() => {
                  setGameEnded(false)
                }}
                className="btn btn-secondary"
                style={{ padding: '0.6rem', borderRadius: '12px', fontSize: '0.8rem' }}
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
