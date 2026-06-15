'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import type { BlockShape } from '@/lib/blockBlastShapes'
import {
  calculatePlacementScore,
  calculateLineClearScore,
  calculateComboBonus
} from '@/lib/blockBlastScoring'
import {
  createEmptyBoard,
  canPlacePiece,
  isGameOver,
  placePiece,
  checkCleanSlate,
  ShapeGenerator,
  SeededRandom,
  getSeedFromDateStr,
  GameStateSnapshot,
  cloneBoard,
  rotateGrid,
  canPlacePieceAnywhere
} from '@/lib/BlockBlastEngine'

// ─── TYPES ───────────────────────────────────────────────────────────────────
type GameMode = 'classic' | 'daily'
type Difficulty = 'easy' | 'normal' | 'hard'

interface Particle {
  id: number
  x: number
  y: number
  color: string
  vx: number
  vy: number
  size: number
}

interface ScorePopup {
  id: number
  x: number
  y: number
  text: string
}

// ─── MEMOIZED CELL COMPONENT ────────────────────────────────────────────────
interface CellProps {
  row: number
  col: number
  color: string | null
  previewColor: string | null
  isClearing: boolean
  onClick: () => void
}

const Cell = React.memo(
  ({ row, col, color, previewColor, isClearing, onClick }: CellProps) => {
    // Determine cell display style
    const style: React.CSSProperties = {
      position: 'relative',
      aspectRatio: '1',
      borderRadius: '6px',
      transition: 'all 0.15s ease',
      cursor: 'pointer',
      boxSizing: 'border-box',
    }

    let cellClass = 'board-cell'
    if (color) {
      style.backgroundColor = color
      style.boxShadow = `0 0 12px ${color}80, inset 0 0 6px rgba(255,255,255,0.3)`
      cellClass += ' has-block'
    } else if (previewColor) {
      style.backgroundColor = previewColor
      style.border = `2px dashed ${previewColor.includes('239') ? '#ef4444' : '#06b6d4'}`
      cellClass += ' is-preview'
    } else {
      style.backgroundColor = 'rgba(15, 23, 42, 0.45)'
      style.border = '1px solid rgba(255, 255, 255, 0.05)'
    }

    if (isClearing) {
      cellClass += ' cell-clearing'
    }

    return (
      <div
        className={cellClass}
        style={style}
        onClick={onClick}
        data-row={row}
        data-col={col}
      />
    )
  },
  (prev, next) => {
    return (
      prev.color === next.color &&
      prev.previewColor === next.previewColor &&
      prev.isClearing === next.isClearing
    )
  }
)
Cell.displayName = 'Cell'

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BlockBlastGame() {
  const { user, submitGameResult } = useGameSession()

  // ─── Stage setup states ───
  const [inGame, setInGame] = useState(false)
  const [mode, setMode] = useState<GameMode>('classic')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  // ─── Game board states ───
  const [board, setBoard] = useState<(string | null)[][]>(createEmptyBoard())
  const [pieces, setPieces] = useState<(BlockShape | null)[]>([null, null, null])
  const [heldPiece, setHeldPiece] = useState<BlockShape | null>(null)
  const [holdUsedThisTurn, setHoldUsedThisTurn] = useState(false)
  
  // Selection/Drag/Rotation states
  const [selectedPieceIdx, setSelectedPieceIdx] = useState<number | -1>(-1)
  const [draggedIndex, setDraggedIndex] = useState<number | -1>(-1)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [shakingPieceIdx, setShakingPieceIdx] = useState<number | -1>(-1)

  // Scoring/Combos
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [placements, setPlacements] = useState(0)
  const [linesCleared, setLinesCleared] = useState(0)

  // Safety & Async Checks
  const [checkingMoves, setCheckingMoves] = useState(false)
  const [isGameOverState, setIsGameOverState] = useState(false)

  // History for Undo
  const [previousState, setPreviousState] = useState<GameStateSnapshot | null>(null)

  // Visuals & Particles
  const [particles, setParticles] = useState<Particle[]>([])
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([])
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set())

  // Previews derived state (bypassing full rerenders via cell-level checks)
  const [previewCoords, setPreviewCoords] = useState<{
    row: number
    col: number
    piece: BlockShape
    isValid: boolean
  } | null>(null)

  // High Scores Local Display
  const [localStats, setLocalStats] = useState({
    classic: {
      easy: { highScore: 0, bestCombo: 0, linesCleared: 0 },
      normal: { highScore: 0, bestCombo: 0, linesCleared: 0 },
      hard: { highScore: 0, bestCombo: 0, linesCleared: 0 },
    },
    daily: { highScore: 0, bestCombo: 0, linesCleared: 0 },
  })

  // Refs for tracking pointers
  const boardRef = useRef<HTMLDivElement>(null)
  const activePieceRef = useRef<BlockShape | null>(null)
  const activePieceIdxRef = useRef<number>(-1)
  const generatorRef = useRef<ShapeGenerator | null>(null)
  const nextParticleId = useRef(0)
  const nextPopupId = useRef(0)

  // State refs to bypass stale closure in global event listeners
  const boardStateRef = useRef(board)
  const piecesStateRef = useRef(pieces)
  const previewCoordsRef = useRef(previewCoords)
  const heldPieceRef = useRef(heldPiece)
  const scoreRef = useRef(score)
  const comboRef = useRef(combo)

  useEffect(() => {
    boardStateRef.current = board
  }, [board])

  useEffect(() => {
    piecesStateRef.current = pieces
  }, [pieces])

  useEffect(() => {
    previewCoordsRef.current = previewCoords
  }, [previewCoords])

  useEffect(() => {
    heldPieceRef.current = heldPiece
  }, [heldPiece])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    comboRef.current = combo
  }, [combo])

  // Board cell size tracker for exact visual size matching
  const [boardCellSize, setBoardCellSize] = useState<{ width: number; height: number }>({ width: 47, height: 47 })

  useEffect(() => {
    if (!inGame || !boardRef.current) return

    const observer = new ResizeObserver(() => {
      const cell = boardRef.current?.querySelector('.board-cell')
      if (cell) {
        const rect = cell.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          setBoardCellSize({ width: rect.width, height: rect.height })
        }
      }
    })

    observer.observe(boardRef.current)

    // Initial check
    const cell = boardRef.current.querySelector('.board-cell')
    if (cell) {
      const rect = cell.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setBoardCellSize({ width: rect.width, height: rect.height })
      }
    }

    return () => {
      observer.disconnect()
    }
  }, [inGame])

  // ─── LOAD HIGHEST LOCAL STATS ──────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (user) {
      try {
        const res = await fetch('/api/games/block-blast/stats')
        if (res.ok) {
          const data = await res.json()
          if (data.stats) {
            setLocalStats(data.stats)
          }
        }
      } catch (err) {
        console.error('Failed to load DB stats:', err)
      }
    } else {
      // LocalStorage for Guest
      try {
        const stored = localStorage.getItem('gamehub_bb_stats')
        if (stored) {
          setLocalStats(JSON.parse(stored))
        }
      } catch {}
    }
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // Save Stats Helper
  const saveHighScoreStats = useCallback(
    async (finalScore: number, finalLines: number, finalCombo: number) => {
      const statsCopy = { ...localStats }
      let isNewHigh = false

      if (mode === 'daily') {
        if (finalScore > statsCopy.daily.highScore) {
          statsCopy.daily.highScore = finalScore
          isNewHigh = true
        }
        statsCopy.daily.bestCombo = Math.max(statsCopy.daily.bestCombo, finalCombo)
        statsCopy.daily.linesCleared += finalLines
      } else {
        const currentDiff = statsCopy.classic[difficulty]
        if (finalScore > currentDiff.highScore) {
          currentDiff.highScore = finalScore
          isNewHigh = true
        }
        currentDiff.bestCombo = Math.max(currentDiff.bestCombo, finalCombo)
        currentDiff.linesCleared += finalLines
      }

      setLocalStats(statsCopy)

      if (!user) {
        localStorage.setItem('gamehub_bb_stats', JSON.stringify(statsCopy))
      }
      return isNewHigh
    },
    [localStats, mode, difficulty, user]
  )

  // ─── PARTICLE GENERATOR ───────────────────────────────────────────────────
  const spawnParticles = useCallback((row: number, col: number, color: string) => {
    if (!boardRef.current) return
    const boardRect = boardRef.current.getBoundingClientRect()
    const cellWidth = boardRect.width / 8
    const cellHeight = boardRect.height / 8

    const cellCenterX = col * cellWidth + cellWidth / 2
    const cellCenterY = row * cellHeight + cellHeight / 2

    const newParticles: Particle[] = []
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 4
      newParticles.push({
        id: nextParticleId.current++,
        x: cellCenterX,
        y: cellCenterY,
        color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 5,
      })
    }
    setParticles((prev) => [...prev, ...newParticles])
  }, [])

  // Update particles loop
  useEffect(() => {
    if (particles.length === 0) return
    const frame = requestAnimationFrame(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.1, // gravity
            size: Math.max(0, p.size - 0.1),
          }))
          .filter((p) => p.size > 0)
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [particles])

  // Update score popups loop
  useEffect(() => {
    if (scorePopups.length === 0) return
    const timer = setTimeout(() => {
      setScorePopups((prev) => prev.slice(1))
    }, 1200)
    return () => clearTimeout(timer)
  }, [scorePopups])

  // ─── INITIALIZE GAME ──────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const freshBoard = createEmptyBoard()
    setBoard(freshBoard)
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setPlacements(0)
    setLinesCleared(0)
    setHeldPiece(null)
    setHoldUsedThisTurn(false)
    setSelectedPieceIdx(-1)
    setDraggedIndex(-1)
    setPreviewCoords(null)
    setPreviousState(null)
    setIsGameOverState(false)
    setCheckingMoves(false)

    // Generator setup
    let generator: ShapeGenerator
    if (mode === 'daily') {
      const todayUtcStr = new Date().toISOString().split('T')[0]
      const seed = getSeedFromDateStr(todayUtcStr)
      const prng = new SeededRandom(seed)
      generator = new ShapeGenerator('normal', prng)
    } else {
      generator = new ShapeGenerator(difficulty)
    }

    generatorRef.current = generator
    const firstPieces = [generator.nextShape(), generator.nextShape(), generator.nextShape()]
    setPieces(firstPieces)
    setInGame(true)
  }, [mode, difficulty])

  // ─── REFILL SLOTS IF EMPTY ────────────────────────────────────────────────
  const checkRefill = (currentPieces: (BlockShape | null)[]) => {
    if (currentPieces.every((p) => p === null)) {
      if (generatorRef.current) {
        const next = [
          generatorRef.current.nextShape(),
          generatorRef.current.nextShape(),
          generatorRef.current.nextShape(),
        ]
        setPieces(next)
        return next
      }
    }
    return currentPieces
  }

  // ─── PLACEMENT TRIGGER ────────────────────────────────────────────────────
  const triggerPlacement = (
    startRow: number,
    startCol: number,
    piece: BlockShape,
    pieceIndex: number
  ) => {
    // Create state snapshot for Undo
    const snapshot: GameStateSnapshot = {
      board: cloneBoard(board),
      score,
      combo,
      maxCombo,
      placements,
      linesCleared,
      pieces: [...pieces],
      heldPiece,
      holdUsedThisTurn,
      gameOver: isGameOverState,
    }

    // Apply placement
    const { nextBoard, clearedRows, clearedCols } = placePiece(board, piece, startRow, startCol)
    const placedBlocksCount = piece.blocksCount
    const scoreFromPlacement = calculatePlacementScore(placedBlocksCount)

    const linesCount = clearedRows.length + clearedCols.length
    const scoreFromClears = calculateLineClearScore(linesCount)

    let nextCombo = combo
    if (linesCount > 0) {
      nextCombo += 1
    } else {
      nextCombo = 0
    }

    const comboBonus = calculateComboBonus(nextCombo)
    const totalMoveScore = scoreFromPlacement + scoreFromClears + comboBonus

    // Clear animations setup
    const cellsToAnimate = new Set<string>()
    clearedRows.forEach((r) => {
      for (let c = 0; c < 8; c++) {
        cellsToAnimate.add(`${r},${c}`)
        spawnParticles(r, c, piece.color)
      }
    })
    clearedCols.forEach((c) => {
      for (let r = 0; r < 8; r++) {
        cellsToAnimate.add(`${r},${c}`)
        spawnParticles(r, c, piece.color)
      }
    })

    if (cellsToAnimate.size > 0) {
      setClearingCells(cellsToAnimate)
      setTimeout(() => {
        setClearingCells(new Set())
      }, 300)
    }

    // Floating Popups
    if (linesCount > 0) {
      const popupText = `${scoreFromClears + comboBonus > 0 ? `+${scoreFromClears + comboBonus}` : ''} ${
        nextCombo > 1 ? `Combo x${nextCombo}! 🔥` : 'Clear! ⚡'
      }`
      if (boardRef.current) {
        const boardRect = boardRef.current.getBoundingClientRect()
        setScorePopups((prev) => [
          ...prev,
          {
            id: nextPopupId.current++,
            x: boardRect.width / 2,
            y: boardRect.height / 2 - 30,
            text: popupText,
          },
        ])
      }
    }

    // Remove piece from slot
    let updatedPieces = [...pieces]
    if (pieceIndex !== -1 && pieceIndex !== 99) {
      updatedPieces[pieceIndex] = null
    }

    // Update Held Piece state if placed from hold slot
    let nextHeldPiece = heldPiece
    if (pieceIndex === 99) {
      nextHeldPiece = null
    }

    // Check refill
    updatedPieces = checkRefill(updatedPieces)

    // Update states
    const finalScore = score + totalMoveScore
    const finalLinesCleared = linesCleared + linesCount
    const finalCombo = Math.max(maxCombo, nextCombo)
    const finalPlacements = placements + 1

    setBoard(nextBoard)
    setPieces(updatedPieces)
    setHeldPiece(nextHeldPiece)
    setScore(finalScore)
    setCombo(nextCombo)
    setMaxCombo(finalCombo)
    setLinesCleared(finalLinesCleared)
    setPlacements(finalPlacements)
    setHoldUsedThisTurn(false)
    setPreviousState(snapshot)

    setSelectedPieceIdx(-1)
    setDraggedIndex(-1)
    setPreviewCoords(null)

    // Check Clean Slate achievement trigger
    const isClean = checkCleanSlate(nextBoard)

    // Safety GameOver check
    const over = isGameOver(nextBoard, updatedPieces, nextHeldPiece)
    if (over) {
      setCheckingMoves(true)
      setTimeout(() => {
        const stillOver = isGameOver(nextBoard, updatedPieces, nextHeldPiece)
        if (stillOver) {
          setIsGameOverState(true)
          triggerGameOver(finalScore, finalLinesCleared, finalCombo, finalPlacements, isClean)
        } else {
          setCheckingMoves(false)
        }
      }, 1000)
    }
  }

  // ─── GAME OVER FLOW ───────────────────────────────────────────────────────
  const triggerGameOver = async (
    finalScore: number,
    finalLines: number,
    finalCombo: number,
    finalPlacements: number,
    isClean: boolean
  ) => {
    await saveHighScoreStats(finalScore, finalLines, finalCombo)
    const resultPayload = finalScore >= 1000 ? 'win' : 'loss'

    submitGameResult({
      gameSlug: 'block-blast',
      result: resultPayload,
      metadata: {
        score: finalScore,
        gameMetadata: {
          mode,
          difficulty: mode === 'classic' ? difficulty : 'normal',
          maxCombo: finalCombo,
          linesCleared: finalLines,
          placements: finalPlacements,
          cleanSlate: isClean ? 1 : 0,
        },
      },
    })
  }

  // ─── HOLD SYSTEM ──────────────────────────────────────────────────────────
  const handleHold = () => {
    if (selectedPieceIdx === -1) return
    if (holdUsedThisTurn) {
      return
    }

    const selectedPiece = pieces[selectedPieceIdx]
    if (!selectedPiece) return

    const prevHeld = heldPiece
    const nextPieces = [...pieces]
    nextPieces[selectedPieceIdx] = prevHeld

    setHeldPiece(selectedPiece)
    setPieces(nextPieces)
    setHoldUsedThisTurn(true)
    setSelectedPieceIdx(-1)
  }

  // ─── ROTATION SYSTEM ──────────────────────────────────────────────────────
  const handleRotatePiece = useCallback((idx: number) => {
    if (idx === -1) return
    const piece = idx === 99 ? heldPiece : pieces[idx]
    if (!piece) return

    // Calculate rotated grid
    const rotatedGrid = rotateGrid(piece.grid)

    console.log('[ROTATE BEFORE] ' + JSON.stringify(piece.grid))
    console.log('[ROTATE AFTER] ' + JSON.stringify(rotatedGrid))
    console.log('[ROTATE INFO] ' + JSON.stringify({ selectedPieceId: piece.id, selectedPieceIndex: idx }))

    const rotatedPiece: BlockShape = {
      ...piece,
      grid: rotatedGrid,
      width: piece.height,
      height: piece.width,
    }

    // Validate rotated shape fits somewhere on the board (prevents corrupt impossible orientation)
    if (!canPlacePieceAnywhere(board, rotatedPiece)) {
      setShakingPieceIdx(idx)
      setTimeout(() => setShakingPieceIdx(-1), 500)
      return
    }

    // Apply rotation
    if (idx === 99) {
      setHeldPiece(rotatedPiece)
    } else {
      setPieces((prev) => {
        const next = [...prev]
        next[idx] = rotatedPiece
        return next
      })
    }

    // Update active ref if currently dragging
    if (activePieceIdxRef.current === idx) {
      activePieceRef.current = rotatedPiece
    }
  }, [pieces, heldPiece, board])

  // Desktop R Key rotation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r') {
        if (selectedPieceIdx !== -1) {
          handleRotatePiece(selectedPieceIdx)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPieceIdx, handleRotatePiece])

  // ─── UNDO SYSTEM ──────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (!previousState) return

    setBoard(previousState.board)
    setScore(previousState.score)
    setCombo(previousState.combo)
    setMaxCombo(previousState.maxCombo)
    setPlacements(previousState.placements)
    setLinesCleared(previousState.linesCleared)
    setPieces(previousState.pieces)
    setHeldPiece(previousState.heldPiece)
    setHoldUsedThisTurn(previousState.holdUsedThisTurn)
    setIsGameOverState(previousState.gameOver)
    setPreviousState(null)
    setSelectedPieceIdx(-1)
  }

  // ─── DRAG & DROP POINTER HANDLERS ─────────────────────────────────────────
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    piece: BlockShape,
    index: number
  ) => {
    e.preventDefault()

    activePieceRef.current = piece
    activePieceIdxRef.current = index
    setDraggedIndex(index)
    setSelectedPieceIdx(index)
    setDragPosition({ x: e.clientX, y: e.clientY })

    const handleGlobalPointerMove = (ev: PointerEvent) => {
      setDragPosition({ x: ev.clientX, y: ev.clientY })

      if (boardRef.current) {
        const boardRect = boardRef.current.getBoundingClientRect()
        const cursorX = ev.clientX
        const cursorY = ev.clientY

        // Visual target: shifted up by 70px to avoid finger cover
        const targetX = cursorX
        const targetY = cursorY - 70

        const isOverBoard =
          targetX >= boardRect.left &&
          targetX <= boardRect.right &&
          targetY >= boardRect.top &&
          targetY <= boardRect.bottom

        if (isOverBoard) {
          const cellWidth = boardCellSize.width
          const cellHeight = boardCellSize.height

          // Exact overlay size based on cells and 6px gaps
          const currentPieceObj = activePieceRef.current || piece
          const dragOverlayWidth = currentPieceObj.width * cellWidth + (currentPieceObj.width - 1) * 6
          const dragOverlayHeight = currentPieceObj.height * cellHeight + (currentPieceObj.height - 1) * 6

          // Center visual alignment math matching placed cells
          const startCol = Math.round((targetX - boardRect.left - dragOverlayWidth / 2 - 8) / (cellWidth + 6))
          const startRow = Math.round((targetY - boardRect.top - dragOverlayHeight / 2 - 8) / (cellHeight + 6))

          const isValid = canPlacePiece(boardStateRef.current, currentPieceObj, startRow, startCol)
          setPreviewCoords({
            row: startRow,
            col: startCol,
            piece: currentPieceObj,
            isValid,
          })
        } else {
          setPreviewCoords(null)
        }
      }
    }

    const handleGlobalPointerUp = () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove)
      window.removeEventListener('pointerup', handleGlobalPointerUp)

      const draggedIdx = activePieceIdxRef.current
      if (draggedIdx === -1) return

      activePieceIdxRef.current = -1
      activePieceRef.current = null

      const currentPreview = previewCoordsRef.current
      if (currentPreview && currentPreview.isValid) {
        triggerPlacement(currentPreview.row, currentPreview.col, currentPreview.piece, draggedIdx)
      } else {
        setDraggedIndex(-1)
        setPreviewCoords(null)
      }
    }

    window.addEventListener('pointermove', handleGlobalPointerMove)
    window.addEventListener('pointerup', handleGlobalPointerUp)
  }

  // Mobile Double Tap Check + PointerDown Drag trigger
  const lastTapRef = useRef<{ [key: number]: number }>({})
  const handlePieceSlotPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    piece: BlockShape,
    idx: number
  ) => {
    const now = Date.now()
    const lastTap = lastTapRef.current[idx] || 0
    if (now - lastTap < 300) {
      // Double tap -> Rotate
      handleRotatePiece(idx)
      lastTapRef.current[idx] = 0 // Reset
    } else {
      lastTapRef.current[idx] = now
      handlePointerDown(e, piece, idx)
    }
  }

  // Tap-to-place cell click helper
  const handleCellClick = (row: number, col: number) => {
    if (selectedPieceIdx === -1) return
    const piece = selectedPieceIdx === 99 ? heldPiece : pieces[selectedPieceIdx]
    if (!piece) return

    if (canPlacePiece(board, piece, row, col)) {
      triggerPlacement(row, col, piece, selectedPieceIdx)
    }
  }

  // ─── MEMOIZED CELL PREVIEW FINDER ──────────────────────────────────────────
  const getPreviewColor = useCallback(
    (row: number, col: number): string | null => {
      if (!previewCoords) return null
      const { row: pr, col: pc, piece, isValid } = previewCoords
      const relativeR = row - pr
      const relativeC = col - pc

      if (
        relativeR >= 0 &&
        relativeR < piece.grid.length &&
        relativeC >= 0 &&
        relativeC < piece.grid[relativeR].length
      ) {
        if (piece.grid[relativeR][relativeC] === 1) {
          return isValid ? 'rgba(6, 182, 212, 0.5)' : 'rgba(239, 68, 68, 0.5)'
        }
      }
      return null
    },
    [previewCoords]
  )

  // ─── REPLAY DYNAMIC EVENT ───
  useEffect(() => {
    const handleReplay = () => {
      startGame()
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [mode, difficulty, startGame])

  // Expose debug interface for E2E testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const api: Record<string, any> = {
        setBoard,
        setPieces,
        setHeldPiece,
        setScore,
        setCombo,
        triggerGameOver: (s: number, l: number, c: number, p: number, o: boolean) => {
          setScore(s)
          setLinesCleared(l)
          setCombo(c)
          setPlacements(p)
          setIsGameOverState(o)
          setInGame(false)
        },
        rotatePiece: (idx: number) => {
          handleRotatePiece(idx)
        }
      }

      Object.defineProperties(api, {
        board:     { get: () => boardStateRef.current,     configurable: true, enumerable: true },
        pieces:    { get: () => piecesStateRef.current,    configurable: true, enumerable: true },
        heldPiece: { get: () => heldPieceRef.current,      configurable: true, enumerable: true },
        score:     { get: () => scoreRef.current,          configurable: true, enumerable: true },
        combo:     { get: () => comboRef.current,          configurable: true, enumerable: true },
      })

      ;(window as any).__debug_block_blast = api
    }
  }, [handleRotatePiece])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 15,
        width: '100%',
        maxWidth: 450,
        margin: '0 auto',
        padding: '12px 6px',
        color: '#f8fafc',
        position: 'relative',
        minHeight: 600,
        boxSizing: 'border-box',
      }}
      id="bb-game-root"
    >
      {/* Popups scoring text */}
      {scorePopups.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            color: '#fbbf24',
            textShadow: '0 0 10px #fbbf24',
            fontSize: '1.2rem',
            fontWeight: 900,
            animation: 'floatUpAndFade 1.2s forwards',
            zIndex: 9999,
          }}
        >
          {p.text}
        </div>
      ))}

      {/* SETUP STAGE */}
      {!inGame && (
        <div
          id="blockblast-setup-menu"
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
            <div style={{ fontSize: '3.5rem', marginBottom: '0.25rem' }}>🧱</div>
            <h2 style={{ fontWeight: 950, fontSize: '1.8rem', margin: 0, textShadow: '0 0 10px rgba(6, 182, 212, 0.4)' }}>
              Block Blast
            </h2>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.85rem', marginTop: '0.4rem', lineHeight: 1.45 }}>
              Place block shapes on the 8x8 grid. Clear rows/cols to score points. Rotate shapes using the R key, double tap on mobile, or click Rotate!
            </p>
          </div>

          {/* High stats preview card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '12px',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase' }}>
              Personal Bests ({mode === 'daily' ? 'Daily' : 'Classic'})
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)' }}>High Score</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>
                  {mode === 'daily' ? localStats.daily.highScore : localStats.classic[difficulty].highScore}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)' }}>Best Combo</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ec4899' }}>
                  x{mode === 'daily' ? localStats.daily.bestCombo : localStats.classic[difficulty].bestCombo}
                </div>
              </div>
            </div>
          </div>

          {/* Mode selections */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'hsl(222 20% 6%)',
              padding: '4px',
              borderRadius: 12,
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                backgroundColor: mode === 'classic' ? 'hsl(220 100% 60%)' : 'transparent',
                color: mode === 'classic' ? 'white' : 'hsl(220 10% 60%)',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setMode('classic')}
              id="bb-classic-tab"
            >
              Classic
            </button>
            <button
              style={{
                flex: 1,
                padding: '0.55rem',
                borderRadius: 8,
                fontSize: '0.85rem',
                fontWeight: 700,
                backgroundColor: mode === 'daily' ? 'hsl(220 100% 60%)' : 'transparent',
                color: mode === 'daily' ? 'white' : 'hsl(220 10% 60%)',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => setMode('daily')}
              id="bb-daily-tab"
            >
              📅 Daily Challenge
            </button>
          </div>

          {/* Difficulty selector (Classic Mode Only) */}
          {mode === 'classic' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'left' }}>
              {(['easy', 'normal', 'hard'] as const).map((diffVal) => (
                <button
                  key={diffVal}
                  onClick={() => setDifficulty(diffVal)}
                  className={`btn ${difficulty === diffVal ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', fontSize: '0.8rem', padding: '6px 8px', borderRadius: 10 }}
                >
                  {diffVal}
                </button>
              ))}
            </div>
          )}

          {/* Daily modifiers badge */}
          {mode === 'daily' && (
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '0.8rem',
                textAlign: 'left',
              }}
            >
              <div style={{ color: '#818cf8', fontWeight: 800 }}>Daily seed challenge</div>
              <div style={{ color: 'rgba(255, 255, 255, 0.7)', marginTop: 4 }}>
                Play a globally synchronized board. Compare scores on leaderboards.
              </div>
            </div>
          )}

          <button
            onClick={startGame}
            className="btn btn-primary"
            style={{
              padding: '12px 18px',
              fontWeight: 800,
              fontSize: '0.95rem',
              borderRadius: 14,
              boxShadow: '0 8px 16px rgba(99,102,241,0.3)',
            }}
            id="bb-start-btn"
          >
            Start Blast! 🧱
          </button>
        </div>
      )}

      {/* PLAYING STAGE */}
      {inGame && (
        <>
          {/* HUD Status Stats Row */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
            }}
            id="bb-hud"
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Score</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24' }}>{score}</span>
            </div>

            {/* Combos display status */}
            {combo > 1 && (
              <div className="animate-pulse" style={{ background: '#db2777', color: 'white', fontWeight: 900, fontSize: '0.75rem', padding: '4px 8px', borderRadius: 12, boxShadow: '0 0 10px #db2777' }}>
                Combo x{combo} 🔥
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Undo action button */}
              <button
                onClick={handleUndo}
                disabled={!previousState}
                className="btn"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  opacity: previousState ? 1 : 0.4,
                  cursor: previousState ? 'pointer' : 'not-allowed',
                }}
                id="bb-undo-btn"
              >
                ↩ Undo
              </button>

              <button
                onClick={() => setInGame(false)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: 8 }}
              >
                Quit
              </button>
            </div>
          </div>

          {/* ── 8x8 Board Container ── */}
          <div
            ref={boardRef}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
              backdropFilter: 'blur(8px)',
              border: '2px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '20px',
              padding: '8px',
              boxSizing: 'border-box',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gridTemplateRows: 'repeat(8, 1fr)',
              gap: '6px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), inset 0 0 15px rgba(255,255,255,0.02)',
            }}
            id="bb-board"
          >
            {board.map((row, r) =>
              row.map((cellColor, c) => (
                <Cell
                  key={`${r}-${c}`}
                  row={r}
                  col={c}
                  color={cellColor}
                  previewColor={getPreviewColor(r, c)}
                  isClearing={clearingCells.has(`${r},${c}`)}
                  onClick={() => handleCellClick(r, c)}
                />
              ))
            )}

            {/* ── Particles Canvas Overlay ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
              {particles.map((p) => (
                <div
                  key={p.id}
                  style={{
                    position: 'absolute',
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    borderRadius: '50%',
                    backgroundColor: p.color,
                    boxShadow: `0 0 8px ${p.color}`,
                    opacity: 0.8,
                    pointerEvents: 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Checking moves indicator safety spinner */}
          {checkingMoves && (
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="spinner" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              Analyzing board options...
            </div>
          )}

          {/* ── Tray Slots Control Bar ── */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            {/* Hold Slot Section */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '6px',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                width: '90px',
                boxSizing: 'border-box',
              }}
              id="bb-hold-slot-container"
            >
              <span style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', fontWeight: 800 }}>HOLD</span>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: selectedPieceIdx === 99 ? '2px solid #06b6d4' : '1px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: heldPiece ? 'grab' : 'default',
                  position: 'relative',
                }}
                onPointerDown={(e) => heldPiece && handlePieceSlotPointerDown(e, heldPiece, 99)}
                onClick={() => {
                  if (heldPiece) {
                    setSelectedPieceIdx(selectedPieceIdx === 99 ? -1 : 99)
                  }
                }}
                id="bb-hold-slot"
              >
                {heldPiece ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${heldPiece.grid[0].length}, 1fr)`,
                      gap: '2px',
                      width: '60%',
                      height: '60%',
                    }}
                  >
                    {heldPiece.grid.map((row, r) =>
                      row.map((val, c) => (
                        <div
                          key={`${r}-${c}`}
                          style={{
                            backgroundColor: val === 1 ? heldPiece.color : 'transparent',
                            borderRadius: '2px',
                            aspectRatio: '1',
                          }}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.6rem', color: 'hsl(220 10% 40%)', fontWeight: 700 }}>EMPTY</span>
                )}

                {/* Hold Indicator Badge */}
                {holdUsedThisTurn && heldPiece && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      color: 'hsl(0, 70%, 60%)',
                    }}
                  >
                    LOCKED
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                <button
                  onClick={handleHold}
                  disabled={selectedPieceIdx === -1 || holdUsedThisTurn}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.25rem 0.4rem',
                    fontSize: '0.6rem',
                    borderRadius: '6px',
                    width: '38px',
                    opacity: selectedPieceIdx === -1 || holdUsedThisTurn ? 0.4 : 1,
                    cursor: selectedPieceIdx === -1 || holdUsedThisTurn ? 'not-allowed' : 'pointer',
                  }}
                  id="bb-hold-btn"
                >
                  📥 Hold
                </button>
                <button
                  onClick={() => handleRotatePiece(selectedPieceIdx)}
                  disabled={selectedPieceIdx === -1}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.25rem 0.4rem',
                    fontSize: '0.6rem',
                    borderRadius: '6px',
                    width: '38px',
                    opacity: selectedPieceIdx === -1 ? 0.4 : 1,
                    cursor: selectedPieceIdx === -1 ? 'not-allowed' : 'pointer',
                  }}
                  id="bb-rotate-btn"
                >
                  ↻ Rot
                </button>
              </div>
            </div>

            {/* 3 Pieces Slots */}
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                flex: 1,
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '8px',
                boxSizing: 'border-box',
                height: '106px',
              }}
              id="bb-pieces-slots"
            >
              {pieces.map((piece, idx) => {
                const isSelected = selectedPieceIdx === idx
                const isDragged = draggedIndex === idx
                const isShaking = shakingPieceIdx === idx

                let slotBorder = '1px solid transparent'
                if (isShaking) {
                  // Handled by CSS class shake-animation
                } else if (isSelected) {
                  slotBorder = '2px solid #06b6d4'
                }

                return (
                  <div
                    key={idx}
                    className={isShaking ? 'shake-animation' : ''}
                    style={{
                      flex: 1,
                      height: '90px',
                      borderRadius: '10px',
                      border: slotBorder,
                      background: 'rgba(15, 23, 42, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      touchAction: 'none',
                      cursor: piece ? 'grab' : 'default',
                      opacity: isDragged ? 0.2 : 1,
                      boxSizing: 'border-box',
                    }}
                    onPointerDown={(e) => piece && handlePieceSlotPointerDown(e, piece, idx)}
                    onClick={() => {
                      if (piece) {
                        setSelectedPieceIdx(isSelected ? -1 : idx)
                      }
                    }}
                    id={`bb-piece-slot-${idx}`}
                    data-testid={`tray-piece-${idx}`}
                  >
                    {piece && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${piece.grid[0].length}, 1fr)`,
                          gap: '6px',
                          width: `${piece.grid[0].length * boardCellSize.width + (piece.grid[0].length - 1) * 6}px`,
                          height: `${piece.grid.length * boardCellSize.height + (piece.grid.length - 1) * 6}px`,
                          pointerEvents: 'none',
                        }}
                      >
                        {piece.grid.map((row, r) =>
                          row.map((val, c) => (
                            <div
                              key={`${r}-${c}`}
                              style={{
                                backgroundColor: val === 1 ? piece.color : 'transparent',
                                borderRadius: '6px',
                                width: `${boardCellSize.width}px`,
                                height: `${boardCellSize.height}px`,
                                boxSizing: 'border-box',
                                boxShadow: val === 1 ? `0 0 12px ${piece.color}80, inset 0 0 6px rgba(255,255,255,0.3)` : 'none',
                              }}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Dragging Absolute Overlay Element ── */}
      {draggedIndex !== -1 && activePieceRef.current && (
        <div
          style={{
            position: 'fixed',
            left: dragPosition.x,
            top: dragPosition.y,
            transform: 'translate3d(-50%, -50%, 0) translate3d(0, -70px, 0)',
            pointerEvents: 'none',
            zIndex: 99999,
            // Calculate exact container width and height matching grid blocks + 6px gaps
            width: `${activePieceRef.current.grid[0].length * boardCellSize.width + (activePieceRef.current.grid[0].length - 1) * 6}px`,
            height: `${activePieceRef.current.grid.length * boardCellSize.height + (activePieceRef.current.grid.length - 1) * 6}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${activePieceRef.current.grid[0].length}, 1fr)`,
              gap: '6px', // Matches board gaps exactly!
              width: '100%',
              height: '100%',
            }}
          >
            {activePieceRef.current.grid.map((row, r) =>
              row.map((val, c) => (
                <div
                  key={`${r}-${c}`}
                  style={{
                    backgroundColor: val === 1 ? activePieceRef.current!.color : 'transparent',
                    borderRadius: '4px',
                    width: `${boardCellSize.width}px`,
                    height: `${boardCellSize.height}px`,
                    boxShadow: val === 1 ? `0 0 12px ${activePieceRef.current!.color}` : 'none',
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Styles ── */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.05);
            opacity: 1;
          }
        }
        @keyframes floatUpAndFade {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0;
          }
          20% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -120%) scale(1);
            opacity: 0;
          }
        }
        @keyframes cellClear {
          0% {
            transform: scale(1);
            filter: brightness(1.8);
          }
          100% {
            transform: scale(0);
            opacity: 0;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .shake-animation {
          animation: shake 0.4s ease-in-out;
          border: 2px solid #ef4444 !important;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.4) !important;
        }
        .cell-clearing {
          animation: cellClear 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards !important;
        }
        .board-cell {
          position: relative;
        }
        .board-cell.is-preview {
          animation: previewPulse 0.8s infinite alternate;
        }
        @keyframes previewPulse {
          from {
            opacity: 0.55;
          }
          to {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}
