import { SHAPES_CATALOG, BlockShape } from './blockBlastShapes'
import { calculatePlacementScore, calculateLineClearScore, calculateComboBonus } from './blockBlastScoring'

export class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  // Mulberry32 generator
  next() {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number) {
    return Math.floor(this.next() * (max - min)) + min
  }
}

export class ShapeGenerator {
  private easyBag: number[] = []
  private normalBag: number[] = []
  private hardBag: number[] = []
  private prng?: SeededRandom
  private difficulty: 'easy' | 'normal' | 'hard'

  constructor(difficulty: 'easy' | 'normal' | 'hard', prng?: SeededRandom) {
    this.difficulty = difficulty
    this.prng = prng
    this.refillAll()
  }

  private shuffle(arr: number[]) {
    if (this.prng) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.prng.range(0, i + 1)
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
    } else {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
    }
  }

  private refillAll() {
    this.easyBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'easy' ? idx : -1)).filter((idx) => idx !== -1)
    this.normalBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'normal' ? idx : -1)).filter((idx) => idx !== -1)
    this.hardBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'hard' ? idx : -1)).filter((idx) => idx !== -1)

    this.shuffle(this.easyBag)
    this.shuffle(this.normalBag)
    this.shuffle(this.hardBag)
  }

  nextShape(): BlockShape {
    const rand = this.prng ? this.prng.next() : Math.random()
    let targetDiff: 'easy' | 'normal' | 'hard' = 'normal'

    if (this.difficulty === 'easy') {
      if (rand < 0.7) targetDiff = 'easy'
      else if (rand < 0.9) targetDiff = 'normal'
      else targetDiff = 'hard'
    } else if (this.difficulty === 'normal') {
      if (rand < 0.33) targetDiff = 'easy'
      else if (rand < 0.67) targetDiff = 'normal'
      else targetDiff = 'hard'
    } else {
      // Hard mode
      if (rand < 0.15) targetDiff = 'easy'
      else if (rand < 0.5) targetDiff = 'normal'
      else targetDiff = 'hard'
    }

    let bag: number[]
    if (targetDiff === 'easy') {
      if (this.easyBag.length === 0) {
        this.easyBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'easy' ? idx : -1)).filter((idx) => idx !== -1)
        this.shuffle(this.easyBag)
      }
      bag = this.easyBag
    } else if (targetDiff === 'normal') {
      if (this.normalBag.length === 0) {
        this.normalBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'normal' ? idx : -1)).filter((idx) => idx !== -1)
        this.shuffle(this.normalBag)
      }
      bag = this.normalBag
    } else {
      if (this.hardBag.length === 0) {
        this.hardBag = SHAPES_CATALOG.map((s, idx) => (s.difficulty === 'hard' ? idx : -1)).filter((idx) => idx !== -1)
        this.shuffle(this.hardBag)
      }
      bag = this.hardBag
    }

    const shapeIdx = bag.pop()!
    return SHAPES_CATALOG[shapeIdx]
  }
}

export function getSeedFromDateStr(dateStr: string): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function createEmptyBoard(): (string | null)[][] {
  return Array.from({ length: 8 }, () => Array(8).fill(null))
}

export function canPlacePiece(
  board: (string | null)[][],
  piece: BlockShape,
  startRow: number,
  startCol: number
): boolean {
  const pWidth = piece.width
  const pHeight = piece.height

  if (startRow < 0 || startRow + pHeight > 8 || startCol < 0 || startCol + pWidth > 8) {
    return false
  }

  for (let r = 0; r < piece.grid.length; r++) {
    for (let c = 0; c < piece.grid[r].length; c++) {
      if (piece.grid[r][c] === 1) {
        if (board[startRow + r][startCol + c] !== null) {
          return false
        }
      }
    }
  }

  return true
}

export function canPlacePieceAnywhere(board: (string | null)[][], piece: BlockShape): boolean {
  const pWidth = piece.width
  const pHeight = piece.height

  for (let r = 0; r <= 8 - pHeight; r++) {
    for (let c = 0; c <= 8 - pWidth; c++) {
      if (canPlacePiece(board, piece, r, c)) {
        return true
      }
    }
  }

  return false
}

export function isGameOver(
  board: (string | null)[][],
  pieces: (BlockShape | null)[],
  heldPiece: BlockShape | null
): boolean {
  // Check active pieces
  for (const piece of pieces) {
    if (piece !== null) {
      if (canPlacePieceAnywhere(board, piece)) {
        return false
      }
    }
  }
  // Check held piece
  if (heldPiece !== null) {
    if (canPlacePieceAnywhere(board, heldPiece)) {
      return false
    }
  }
  return true
}

export interface GameStateSnapshot {
  board: (string | null)[][]
  score: number
  combo: number
  maxCombo: number
  placements: number
  linesCleared: number
  pieces: (BlockShape | null)[]
  heldPiece: BlockShape | null
  holdUsedThisTurn: boolean
  gameOver: boolean
}

export function cloneBoard(board: (string | null)[][]): (string | null)[][] {
  return board.map((row) => [...row])
}

export function placePiece(
  board: (string | null)[][],
  piece: BlockShape,
  startRow: number,
  startCol: number
): {
  nextBoard: (string | null)[][]
  clearedRows: number[]
  clearedCols: number[]
} {
  const nextBoard = cloneBoard(board)

  for (let r = 0; r < piece.grid.length; r++) {
    for (let c = 0; c < piece.grid[r].length; c++) {
      if (piece.grid[r][c] === 1) {
        nextBoard[startRow + r][startCol + c] = piece.color
      }
    }
  }

  const clearedRows: number[] = []
  const clearedCols: number[] = []

  // Check rows
  for (let r = 0; r < 8; r++) {
    if (nextBoard[r].every((cell) => cell !== null)) {
      clearedRows.push(r)
    }
  }

  // Check columns
  for (let c = 0; c < 8; c++) {
    let columnFilled = true
    for (let r = 0; r < 8; r++) {
      if (nextBoard[r][c] === null) {
        columnFilled = false
        break
      }
    }
    if (columnFilled) {
      clearedCols.push(c)
    }
  }

  // Clear filled rows/cols
  clearedRows.forEach((r) => {
    for (let c = 0; c < 8; c++) {
      nextBoard[r][c] = null
    }
  })

  clearedCols.forEach((c) => {
    for (let r = 0; r < 8; r++) {
      nextBoard[r][c] = null
    }
  })

  return { nextBoard, clearedRows, clearedCols }
}

export function checkCleanSlate(board: (string | null)[][]): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] !== null) return false
    }
  }
  return true
}

export function rotateGrid(grid: number[][]): number[][] {
  const H = grid.length
  const W = grid[0].length
  const newGrid: number[][] = Array.from({ length: W }, () => Array(H).fill(0))
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      newGrid[c][H - 1 - r] = grid[r][c]
    }
  }
  return newGrid
}

