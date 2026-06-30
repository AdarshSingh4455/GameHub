'use client'
import { GamepadIcon, PlayIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

type Board = number[][]
type AppMode = 'classic' | 'challenge'

interface ChallengeObjective {
  type: 'reach_tile' | 'score_goal' | 'move_limit' | 'time_attack'
  description: string
  targetTile?: number
  targetScore?: number
  moveLimit?: number
  timeLimit?: number // seconds
}

function getHourlyChallengeObjective(): ChallengeObjective {
  const seed = Math.floor(Date.now() / 3600000) // changes every hour
  const variant = seed % 4

  const objectives: ChallengeObjective[] = [
    {
      type: 'reach_tile',
      description: 'Reach a 1024 tile',
      targetTile: 1024,
    },
    {
      type: 'score_goal',
      description: 'Score 3,000 points',
      targetScore: 3000,
    },
    {
      type: 'move_limit',
      description: 'Create a 512 tile within 80 moves',
      targetTile: 512,
      moveLimit: 80,
    },
    {
      type: 'time_attack',
      description: 'Reach 2048 in 5 minutes',
      targetTile: 2048,
      timeLimit: 300,
    },
  ]

  return objectives[variant]
}

function getChallengeProgress(
  obj: ChallengeObjective,
  board: Board,
  score: number,
  moves: number,
  timer: number
): { value: number; max: number; label: string; isDone: boolean; isFailed: boolean } {
  const maxTile = board.flat().reduce((a, b) => Math.max(a, b), 0)

  if (obj.type === 'reach_tile') {
    return {
      value: Math.min(maxTile, obj.targetTile!),
      max: obj.targetTile!,
      label: `Best tile: ${maxTile} / ${obj.targetTile}`,
      isDone: maxTile >= obj.targetTile!,
      isFailed: false,
    }
  }
  if (obj.type === 'score_goal') {
    return {
      value: Math.min(score, obj.targetScore!),
      max: obj.targetScore!,
      label: `Score: ${score} / ${obj.targetScore}`,
      isDone: score >= obj.targetScore!,
      isFailed: false,
    }
  }
  if (obj.type === 'move_limit') {
    const movesLeft = Math.max(0, obj.moveLimit! - moves)
    return {
      value: Math.min(maxTile, obj.targetTile!),
      max: obj.targetTile!,
      label: `Best tile: ${maxTile} / ${obj.targetTile} — ${movesLeft} moves left`,
      isDone: maxTile >= obj.targetTile!,
      isFailed: moves >= obj.moveLimit! && maxTile < obj.targetTile!,
    }
  }
  // time_attack
  const timeLeft = Math.max(0, obj.timeLimit! - timer)
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  return {
    value: Math.min(maxTile, obj.targetTile!),
    max: obj.targetTile!,
    label: `Best tile: ${maxTile} / ${obj.targetTile} — ${mins}:${secs.toString().padStart(2, '0')} left`,
    isDone: maxTile >= obj.targetTile!,
    isFailed: timeLeft <= 0 && maxTile < obj.targetTile!,
  }
}

export default function Game2048() {
  const { submitGameResult, isLoading } = useGameSession()

  const [appMode, setAppMode] = useState<AppMode>('classic')
  const [board, setBoard] = useState<Board>([[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]])
  const [score, setScore] = useState(0)
  const [timer, setTimer] = useState(0)
  const [moveCount, setMoveCount] = useState(0)
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'gameover'>('setup')
  const [hasReached2048, setHasReached2048] = useState(false)

  // Challenge state
  const [challengeObjective, setChallengeObjective] = useState<ChallengeObjective | null>(null)
  const [challengeStatus, setChallengeStatus] = useState<'playing' | 'success' | 'failed'>('playing')
  const challengeStatusRef = useRef<'playing' | 'success' | 'failed'>('playing')

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // Live refs to avoid stale closures
  const moveCountRef = useRef(0)
  const scoreRef = useRef(0)
  const timerRef2 = useRef(0)
  const boardRef = useRef(board)

  // Ranked states
  const [isRanked, setIsRanked] = useState(false)
  const [opponentName, setOpponentName] = useState('ApexBot')
  const [targetScore, setTargetScore] = useState(1000)

  useEffect(() => { moveCountRef.current = moveCount }, [moveCount])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { timerRef2.current = timer }, [timer])
  useEffect(() => { boardRef.current = board }, [board])

  // Parse query parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'ranked') {
        setIsRanked(true)
        setAppMode('classic')
        const oppName = params.get('opponent') || 'ApexBot'
        setOpponentName(oppName)
        const oppMmr = parseInt(params.get('opponentMmr') || '1000', 10)

        // Set target score challenge dynamically
        let target = 1000
        if (oppMmr < 1167) target = 1000      // Bronze
        else if (oppMmr < 1834) target = 2500 // Silver
        else if (oppMmr < 3000) target = 5000 // Gold
        else target = 10000                    // Diamond+
        setTargetScore(target)

        // Auto start game
        const initialBoard = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]
        addRandomTile(initialBoard)
        addRandomTile(initialBoard)
        setBoard(initialBoard)
        boardRef.current = initialBoard
        setScore(0)
        scoreRef.current = 0
        setTimer(0)
        timerRef2.current = 0
        setMoveCount(0)
        moveCountRef.current = 0
        setHasReached2048(false)
        setChallengeStatus('playing')
        challengeStatusRef.current = 'playing'
        setChallengeObjective(null)
        setGameState('playing')
      }
    }
  }, [])

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1)
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [gameState])

  // Challenge fail check (time attack / move limit)
  useEffect(() => {
    if (!challengeObjective || gameState !== 'playing' || challengeStatus !== 'playing') return
    const maxTile = board.flat().reduce((a, b) => Math.max(a, b), 0)
    const progress = getChallengeProgress(challengeObjective, board, score, moveCount, timer)
    if (progress.isDone) {
      setChallengeStatus('success')
      challengeStatusRef.current = 'success'
      if (timerRef.current) clearInterval(timerRef.current)
    } else if (progress.isFailed) {
      setChallengeStatus('failed')
      challengeStatusRef.current = 'failed'
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, score, timer, moveCount])

  const startGame = useCallback((mode: AppMode) => {
    setScore(0)
    setTimer(0)
    setMoveCount(0)
    moveCountRef.current = 0
    scoreRef.current = 0
    timerRef2.current = 0
    setHasReached2048(false)
    setChallengeStatus('playing')
    challengeStatusRef.current = 'playing'

    const newBoard: Board = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]
    addRandomTile(newBoard)
    addRandomTile(newBoard)
    setBoard(newBoard)
    boardRef.current = newBoard

    if (mode === 'challenge') {
      setChallengeObjective(getHourlyChallengeObjective())
    } else {
      setChallengeObjective(null)
    }

    setGameState('playing')
  }, [])

  const addRandomTile = (b: Board) => {
    const empty: { r: number; c: number }[] = []
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (b[r][c] === 0) empty.push({ r, c })
    if (empty.length > 0) {
      const { r, c } = empty[Math.floor(Math.random() * empty.length)]
      b[r][c] = Math.random() < 0.9 ? 2 : 4
    }
  }

  const checkGameOver = (b: Board): boolean => {
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === 0) return false
        if (r < 3 && b[r][c] === b[r+1][c]) return false
        if (c < 3 && b[r][c] === b[r][c+1]) return false
      }
    return true
  }

  const slideRowLeft = (row: number[]): { newRow: number[]; gainedScore: number } => {
    const filtered = row.filter(v => v !== 0)
    let gainedScore = 0
    const newRow: number[] = []
    for (let i = 0; i < filtered.length; i++) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i+1]) {
        const merged = filtered[i] * 2
        newRow.push(merged)
        gainedScore += merged
        i++
      } else {
        newRow.push(filtered[i])
      }
    }
    while (newRow.length < 4) newRow.push(0)
    return { newRow, gainedScore }
  }

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameState !== 'playing') return
    if (challengeStatusRef.current !== 'playing') return

    const currentBoard = boardRef.current.map(row => [...row])
    let totalGained = 0
    let moved = false

    if (direction === 'left') {
      for (let r = 0; r < 4; r++) {
        const { newRow, gainedScore } = slideRowLeft(currentBoard[r])
        if (JSON.stringify(currentBoard[r]) !== JSON.stringify(newRow)) moved = true
        currentBoard[r] = newRow
        totalGained += gainedScore
      }
    } else if (direction === 'right') {
      for (let r = 0; r < 4; r++) {
        const rev = [...currentBoard[r]].reverse()
        const { newRow, gainedScore } = slideRowLeft(rev)
        const final = newRow.reverse()
        if (JSON.stringify(currentBoard[r]) !== JSON.stringify(final)) moved = true
        currentBoard[r] = final
        totalGained += gainedScore
      }
    } else if (direction === 'up') {
      for (let c = 0; c < 4; c++) {
        const col = [currentBoard[0][c], currentBoard[1][c], currentBoard[2][c], currentBoard[3][c]]
        const { newRow, gainedScore } = slideRowLeft(col)
        for (let r = 0; r < 4; r++) {
          if (currentBoard[r][c] !== newRow[r]) { moved = true; currentBoard[r][c] = newRow[r] }
        }
        totalGained += gainedScore
      }
    } else {
      for (let c = 0; c < 4; c++) {
        const col = [currentBoard[3][c], currentBoard[2][c], currentBoard[1][c], currentBoard[0][c]]
        const { newRow, gainedScore } = slideRowLeft(col)
        for (let r = 0; r < 4; r++) {
          const ri = 3 - r
          if (currentBoard[ri][c] !== newRow[r]) { moved = true; currentBoard[ri][c] = newRow[r] }
        }
        totalGained += gainedScore
      }
    }

    if (moved) {
      addRandomTile(currentBoard)
      setBoard(currentBoard)
      boardRef.current = currentBoard

      const newScore = scoreRef.current + totalGained
      setScore(newScore)
      scoreRef.current = newScore

      const newMoves = moveCountRef.current + 1
      setMoveCount(newMoves)
      moveCountRef.current = newMoves

      let reaches2048 = false
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
          if (currentBoard[r][c] === 2048) reaches2048 = true

      if (reaches2048 && !hasReached2048 && !challengeObjective && !isRanked) {
        setHasReached2048(true)
        submitGameResult({ gameSlug: '2048', result: 'win', metadata: { score: newScore, timeSpent: timerRef2.current } })
      }

      if (checkGameOver(currentBoard)) {
        setGameState('gameover')
        if (timerRef.current) clearInterval(timerRef.current)

        if (isRanked) {
          const resultPayload = newScore >= targetScore ? 'win' : 'loss'
          const customTitle = resultPayload === 'win' ? 'Victory!' : 'Target Failed'
          const customSubtitle = `Target: ${targetScore} • Score: ${newScore} • ${resultPayload === 'win' ? 'Target Achieved' : 'Below Target'}`

          submitGameResult({
            gameSlug: '2048',
            result: resultPayload,
            metadata: {
              score: newScore,
              timeSpent: timerRef2.current,
              customTitle,
              customSubtitle,
            }
          })

          fetch('/api/ranked/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              result: resultPayload,
              opponentName: opponentName,
              gameSlug: '2048'
            })
          })
          .then(async (res) => {
            if (res.ok) {
              const data = await res.json()
              if (data.revealRank) {
                localStorage.setItem('gamehub_rank_reveal', 'pending')
              }
              if (data.promoted) {
                localStorage.setItem('gamehub_promotion_celebration', JSON.stringify({ oldRank: data.oldRank, newRank: data.newRank }))
              }
            }
          })
          .catch(err => console.error('Failed to submit ranked stats:', err))

        } else {
          if (!reaches2048 && !hasReached2048 && !challengeObjective) {
            submitGameResult({ gameSlug: '2048', result: 'loss', metadata: { score: newScore, timeSpent: timerRef2.current } })
          }
          if (challengeObjective) {
            // Submit result for challenge based on current status
            const finalChallengeStatus: string = challengeStatusRef.current
            submitGameResult({
              gameSlug: '2048',
              result: finalChallengeStatus === 'success' ? 'win' : 'loss',
              metadata: { score: newScore, timeSpent: timerRef2.current, customTitle: finalChallengeStatus === 'success' ? 'Challenge Complete!' : 'Board Locked' },
            })
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, challengeStatus, hasReached2048, challengeObjective, submitGameResult, isRanked, targetScore, opponentName])

  useEffect(() => {
    if (isRanked && gameState === 'playing' && score >= targetScore) {
      setGameState('gameover')
      if (timerRef.current) clearInterval(timerRef.current)

      const resultPayload = 'win'
      const customTitle = 'Victory!'
      const customSubtitle = `Target: ${targetScore} • Score: ${score} • Target Achieved`

      submitGameResult({
        gameSlug: '2048',
        result: resultPayload,
        metadata: {
          score: score,
          timeSpent: timerRef2.current,
          customTitle,
          customSubtitle,
        }
      })

      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultPayload,
          opponentName: opponentName,
          gameSlug: '2048'
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data.revealRank) {
            localStorage.setItem('gamehub_rank_reveal', 'pending')
          }
          if (data.promoted) {
            localStorage.setItem('gamehub_promotion_celebration', JSON.stringify({ oldRank: data.oldRank, newRank: data.newRank }))
          }
        }
      })
      .catch(err => console.error('Failed to submit ranked stats:', err))
    }
  }, [score, isRanked, gameState, targetScore, submitGameResult, opponentName])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return
      if (['ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); move('up') }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { e.preventDefault(); move('down') }
      else if (['ArrowLeft', 'KeyA'].includes(e.code)) { e.preventDefault(); move('left') }
      else if (['ArrowRight', 'KeyD'].includes(e.code)) { e.preventDefault(); move('right') }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, move])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (gameState !== 'playing') return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing') return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 40) move(dx > 0 ? 'right' : 'left')
    } else {
      if (Math.abs(dy) > 40) move(dy > 0 ? 'down' : 'up')
    }
    touchStartRef.current = null
  }

  const getTileColors = (value: number) => {
    const colors: Record<number, { bg: string; color: string; border: string; glow?: string }> = {
      2:    { bg: 'hsl(220 20% 18%)', color: 'hsl(220 15% 92%)', border: 'hsl(220 15% 24%)' },
      4:    { bg: 'hsl(220 20% 24%)', color: 'hsl(220 15% 95%)', border: 'hsl(220 15% 30%)' },
      8:    { bg: 'hsl(220 100% 60% / 0.15)', color: 'hsl(220 100% 70%)', border: 'hsl(220 100% 60% / 0.4)' },
      16:   { bg: 'hsl(220 100% 60% / 0.3)', color: 'hsl(220 100% 80%)', border: 'hsl(220 100% 60% / 0.6)' },
      32:   { bg: 'hsl(270 80% 60% / 0.2)', color: 'hsl(270 80% 70%)', border: 'hsl(270 80% 60% / 0.4)' },
      64:   { bg: 'hsl(270 80% 60% / 0.4)', color: 'hsl(270 80% 80%)', border: 'hsl(270 80% 60% / 0.6)' },
      128:  { bg: 'hsl(45 100% 55% / 0.15)', color: 'hsl(45 100% 65%)', border: 'hsl(45 100% 55% / 0.4)' },
      256:  { bg: 'hsl(45 100% 55% / 0.3)', color: 'hsl(45 100% 75%)', border: 'hsl(45 100% 55% / 0.6)', glow: '0 0 10px hsl(45 100% 55% / 0.3)' },
      512:  { bg: 'hsl(45 100% 55% / 0.45)', color: 'hsl(45 100% 85%)', border: 'hsl(45 100% 55% / 0.7)', glow: '0 0 15px hsl(45 100% 55% / 0.5)' },
      1024: { bg: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 50%))', color: 'hsl(20 100% 8%)', border: 'hsl(45 100% 60%)', glow: '0 0 20px hsl(45 100% 55% / 0.6)' },
      2048: { bg: 'linear-gradient(135deg, hsl(45 100% 55%), hsl(270 80% 60%))', color: 'white', border: 'hsl(45 100% 60%)', glow: '0 0 25px hsl(270 80% 60% / 0.8)' },
    }
    if (value > 2048) return { bg: 'linear-gradient(135deg, hsl(270 80% 60%), hsl(220 100% 60%))', color: 'white', border: 'hsl(270 80% 70%)', glow: '0 0 30px hsl(220 100% 60% / 0.8)' }
    return colors[value] || { bg: 'hsl(222 18% 12%)', color: 'transparent', border: 'hsl(222 18% 12%)' }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60), s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ── CHALLENGE STATUS OVERLAY ─────────────────────────────────────────────

  const challengeProgress = challengeObjective && gameState === 'playing'
    ? getChallengeProgress(challengeObjective, board, score, moveCount, timer)
    : null

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────

  if (gameState === 'setup') {
    return (
      <div className="card glass" style={{ padding: '2.5rem', textAlign: 'center', margin: '0 auto', maxWidth: 500 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <GamepadIcon size={48} className="text-blue-400" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>2048</h2>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Slide tiles and merge matching numbers to reach 2048!
        </p>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', background: 'hsl(222 20% 6%)', padding: '4px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.25rem' }}>
          <button
            onClick={() => setAppMode('classic')}
            style={{ flex: 1, padding: '0.6rem', borderRadius: 10, fontSize: '0.86rem', fontWeight: 700, background: appMode === 'classic' ? 'hsl(220 100% 60%)' : 'transparent', color: appMode === 'classic' ? 'white' : 'hsl(220 10% 60%)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Classic
          </button>
          <button
            onClick={() => setAppMode('challenge')}
            style={{ flex: 1, padding: '0.6rem', borderRadius: 10, fontSize: '0.86rem', fontWeight: 700, background: appMode === 'challenge' ? 'linear-gradient(135deg, hsl(270 80% 60%), hsl(220 100% 60%))' : 'transparent', color: appMode === 'challenge' ? 'white' : 'hsl(220 10% 60%)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            Challenge
          </button>
        </div>

        {appMode === 'challenge' && (() => {
          const obj = getHourlyChallengeObjective()
          const typeIcon = { reach_tile: '🎯', score_goal: '💰', move_limit: '🔢', time_attack: '⏱️' }[obj.type]
          return (
            <div style={{ background: 'hsl(270 80% 60% / 0.08)', border: '1px solid hsl(270 80% 60% / 0.25)', borderRadius: 14, padding: '1rem 1.25rem', marginBottom: '1.25rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(270 60% 65%)', marginBottom: '0.4rem' }}>Hourly Challenge</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <span>{typeIcon}</span>{obj.description}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>
                {obj.type === 'move_limit' && `Complete within ${obj.moveLimit} moves`}
                {obj.type === 'time_attack' && `Complete within ${Math.floor(obj.timeLimit! / 60)} minutes`}
                {obj.type === 'score_goal' && 'Score the target before running out of moves'}
                {obj.type === 'reach_tile' && 'Merge tiles to reach the target value'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 40%)', marginTop: '0.5rem' }}>Rotates hourly • Earn bonus XP on completion</div>
            </div>
          )
        })()}

        {appMode === 'classic' && (
          <div style={{ background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, padding: '0.75rem 1rem', marginBottom: '1.25rem', textAlign: 'left', fontSize: '0.82rem' }}>
            <div style={{ fontWeight: 700, color: 'white', marginBottom: '0.3rem' }}>Classic Mode</div>
            <div style={{ color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>Reach the 2048 tile with no time or move limits. Continue playing after winning for higher scores!</div>
          </div>
        )}

        <button className="btn btn-primary btn-lg animate-pulse-glow" onClick={() => startGame(appMode)} style={{ width: '100%' }}>
          <PlayIcon size={14} className="inline mr-1" /> {appMode === 'challenge' ? 'Start Challenge' : 'Play Classic'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {isRanked && (
        <div style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '16px',
          background: 'linear-gradient(90deg, rgba(236, 72, 153, 0.15), rgba(6, 182, 212, 0.15))',
          border: '1px solid rgba(236, 72, 153, 0.3)',
          textAlign: 'center',
          fontSize: '0.85rem',
          fontWeight: 800,
          color: 'white',
          boxSizing: 'border-box',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          🏆 Ranked Challenge: Beat <span style={{ color: '#fbbf24', textShadow: '0 0 8px rgba(251, 191, 36, 0.4)' }}>{targetScore}</span> Points to win! (Opponent: {opponentName})
        </div>
      )}

      {/* ── HUD ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(220 20% 7%)', padding: '0.75rem 1.25rem', borderRadius: 16, border: '1px solid hsl(220 20% 14%)' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Score</span>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{score}</div>
        </div>

        {hasReached2048 && !challengeObjective && (
          <div style={{ background: 'hsl(45 100% 55% / 0.15)', border: '1px solid hsl(45 100% 55% / 0.3)', color: 'hsl(45 100% 60%)', padding: '0.2rem 0.6rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 800 }}>
            2048 Reached!
          </div>
        )}

        {challengeObjective && (
          <div style={{ fontSize: '0.68rem', fontWeight: 800, color: challengeStatus === 'success' ? 'hsl(142 70% 60%)' : challengeStatus === 'failed' ? 'hsl(0 70% 60%)' : 'hsl(270 80% 70%)', textTransform: 'uppercase' }}>
            {challengeStatus === 'success' ? 'Complete!' : challengeStatus === 'failed' ? 'Failed' : 'Challenge'}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>{challengeObjective ? 'Moves' : 'Timer'}</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
              {challengeObjective ? moveCount : formatTime(timer)}
            </div>
          </div>
        </div>
      </div>

      {/* ── CHALLENGE HUD CARD ──────────────────── */}
      {challengeObjective && challengeProgress && (
        <div style={{
          background: challengeStatus === 'success' ? 'hsl(142 70% 40% / 0.12)' : challengeStatus === 'failed' ? 'hsl(0 80% 55% / 0.1)' : 'hsl(270 80% 60% / 0.08)',
          border: `1px solid ${challengeStatus === 'success' ? 'hsl(142 70% 45% / 0.35)' : challengeStatus === 'failed' ? 'hsl(0 80% 55% / 0.3)' : 'hsl(270 80% 60% / 0.25)'}`,
          borderRadius: 14,
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(270 80% 70%)', textTransform: 'uppercase' }}>
              {challengeStatus === 'success' ? '✅ Challenge Complete!' : challengeStatus === 'failed' ? '❌ Challenge Failed' : `Objective`}
            </span>
            {challengeObjective.type === 'time_attack' && challengeStatus === 'playing' && (
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'hsl(45 100% 65%)' }}>
                {formatTime(Math.max(0, challengeObjective.timeLimit! - timer))}
              </span>
            )}
            {challengeObjective.type === 'move_limit' && challengeStatus === 'playing' && (
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: moveCount > (challengeObjective.moveLimit! * 0.8) ? 'hsl(0 70% 65%)' : 'hsl(45 100% 65%)' }}>
                {Math.max(0, challengeObjective.moveLimit! - moveCount)} left
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white' }}>{challengeObjective.description}</div>
          <div style={{ height: 6, background: 'hsl(220 20% 14%)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (challengeProgress.value / challengeProgress.max) * 100)}%`,
              height: '100%',
              background: challengeStatus === 'success' ? 'linear-gradient(90deg, hsl(142 70% 45%), hsl(142 80% 60%))' : 'linear-gradient(90deg, hsl(270 80% 55%), hsl(220 100% 65%))',
              borderRadius: 99,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)' }}>{challengeProgress.label}</div>
          {challengeStatus === 'success' && (
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(45 100% 65%)', textAlign: 'center', marginTop: '0.1rem' }}>
              +100 XP bonus earned!
            </div>
          )}
        </div>
      )}

      {/* ── BOARD ───────────────────────────────── */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="card glass"
        style={{
          padding: '1rem',
          background: 'hsl(222 18% 12%)',
          border: '1px solid hsl(220 15% 20%)',
          borderRadius: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          gap: 'clamp(6px, 2vw, 12px)',
          aspectRatio: '1',
          maxWidth: '450px',
          margin: '0 auto',
          width: '100%',
          touchAction: 'none',
          opacity: challengeStatus !== 'playing' ? 0.7 : 1,
          transition: 'opacity 0.3s',
        }}
      >
        {board.map((row, rIdx) =>
          row.map((val, cIdx) => {
            const ts = getTileColors(val)
            return (
              <div
                key={`${rIdx}-${cIdx}`}
                className={val > 0 ? 'animate-slideUp' : ''}
                style={{
                  background: val > 0 ? ts.bg : 'hsl(222 20% 7%)',
                  border: val > 0 ? `1px solid ${ts.border}` : '1px solid hsl(222 20% 10%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: val > 1000 ? 'clamp(1rem, 4vw, 1.4rem)' : 'clamp(1.2rem, 5vw, 1.8rem)',
                  fontWeight: 800,
                  color: ts.color,
                  boxShadow: ts.glow || 'none',
                  transition: 'all 0.15s ease',
                  aspectRatio: '1',
                  userSelect: 'none',
                }}
              >
                {val > 0 ? val : ''}
              </div>
            )
          })
        )}
      </div>

      {/* ── FOOTER ──────────────────────────────── */}
      <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current)
            setGameState('setup')
          }}
          disabled={isLoading}
        >
          Reset Game
        </button>
        {challengeObjective && challengeStatus !== 'playing' && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => startGame('challenge')}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
