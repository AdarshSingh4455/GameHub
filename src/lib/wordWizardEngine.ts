// Word Wizard Game Engine
// Pure logic, no React, highly performant
// Generator: straight-line Horizontal/Vertical placement only (no diagonals)

import { WORD_SET, getWordCategory } from './wordWizardDictionary'

// Seeded PRNG Mulberry32
export class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next() {
    let t = (this.seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number) {
    return Math.floor(this.next() * (max - min)) + min
  }

  choose<T>(arr: T[]): T {
    const idx = this.range(0, arr.length)
    return arr[idx]
  }
}

// Letter frequency pools
const STANDARD_LETTERS = 'eeeeeeeeeetttttttttaaaaaaaaaoooooooooiiiiiiiiinnnnnnnnnsssssssssrrrrrrrrrhhhhhhhhddddddllllluuuuucccmmmfffyyywwwgggppbbvvkxqzj'
const EASY_LETTERS = 'eeeeeeeeeetttttttttaaaaaaaaaoooooooooiiiiiiiiinnnnnnnnnsssssssssrrrrrrrrrhhhhhhhhddddddlllll'
const HARD_LETTERS = 'eeeeetttttaaaaaooooiinnssrrhhddllccmywgpbvkxqzjxqzjxqzj'

export function getLetterPool(difficulty: 'easy' | 'normal' | 'hard', dailyModifier?: string): string {
  if (dailyModifier === 'double_rare') {
    return HARD_LETTERS + 'xqzjxqzj'
  }
  if (difficulty === 'easy') return EASY_LETTERS
  if (difficulty === 'hard') return HARD_LETTERS
  return STANDARD_LETTERS
}

export interface BoardData {
  grid: string[][]
  specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'>
}

function shuffle<T>(array: T[], prng: SeededRandom): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = prng.range(0, i + 1)
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

// Directions: right, left, down, up (no diagonals)
const DIRECTIONS: [number, number][] = [
  [0, 1],   // right →
  [0, -1],  // left  ←
  [1, 0],   // down  ↓
  [-1, 0],  // up    ↑
]

/**
 * Attempt to place a single word in the grid using a straight line.
 * Allows intersection only when the existing letter matches.
 * Returns true if placed successfully, false otherwise.
 */
function placeWordLinear(
  word: string,
  grid: string[][],
  size: number,
  prng: SeededRandom
): boolean {
  const upper = word.toUpperCase()
  const len = upper.length

  // Build all valid (row, col, dir) start positions for this word
  const candidates: Array<[number, number, [number, number]]> = []

  for (let dr_dc of DIRECTIONS) {
    const [dr, dc] = dr_dc
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Check if the word fits in this direction from (r, c)
        const endR = r + dr * (len - 1)
        const endC = c + dc * (len - 1)
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue

        // Check for conflicts with existing letters
        let canPlace = true
        for (let i = 0; i < len; i++) {
          const gr = r + dr * i
          const gc = c + dc * i
          const existing = grid[gr][gc]
          if (existing !== '' && existing !== upper[i]) {
            canPlace = false
            break
          }
        }

        if (canPlace) {
          candidates.push([r, c, dr_dc])
        }
      }
    }
  }

  if (candidates.length === 0) return false

  // Shuffle candidates and pick one
  const shuffled = shuffle(candidates, prng)
  const [startR, startC, [dr, dc]] = shuffled[0]

  // Place the word
  for (let i = 0; i < len; i++) {
    grid[startR + dr * i][startC + dc * i] = upper[i]
  }

  return true
}

/**
 * Try to embed all words into the grid.
 * Returns the completed grid or null if any word could not be placed.
 */
function tryEmbedWords(words: string[], size: number, prng: SeededRandom): string[][] | null {
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''))
  // Sort longest-first to maximize intersection opportunities
  const sorted = [...words].sort((a, b) => b.length - a.length)

  for (const word of sorted) {
    const placed = placeWordLinear(word, grid, size, prng)
    if (!placed) return null
  }

  return grid
}

/**
 * Count how many distinct straight-line (H/V) occurrences of a word exist in the grid.
 * Palindromes placed in a single path are correctly counted as 1 occurrence.
 */
export function countWordOccurrences(word: string, board: string[][]): number {
  const size = board.length
  const upper = word.toUpperCase()
  const len = upper.length
  const matchedCoordinateSets: string[] = []

  for (const [dr, dc] of DIRECTIONS) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const endR = r + dr * (len - 1)
        const endC = c + dc * (len - 1)
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue

        let match = true
        const coords: string[] = []
        for (let i = 0; i < len; i++) {
          const gr = r + dr * i
          const gc = c + dc * i
          if (board[gr][gc].toUpperCase() !== upper[i]) {
            match = false
            break
          }
          coords.push(`${gr},${gc}`)
        }

        if (match) {
          coords.sort()
          const key = coords.join('|')
          if (!matchedCoordinateSets.includes(key)) {
            matchedCoordinateSets.push(key)
          }
        }
      }
    }
  }

  return matchedCoordinateSets.length
}

/**
 * Verify that every target word exists exactly once in the grid
 * (readable left→right or top→bottom in a straight H/V line).
 */
function verifyAllWordsExist(words: string[], grid: string[][]): boolean {
  return words.every(w => countWordOccurrences(w, grid) === 1)
}

export function generateBoard(
  size: number,
  difficulty: 'easy' | 'normal' | 'hard',
  seed?: number,
  dailyModifier?: string,
  targetWords?: string[]
): BoardData {
  // Override size to match new board spec: Easy=8, Normal=10, Hard=12
  const boardSize = difficulty === 'easy' ? 8 : difficulty === 'normal' ? 10 : 12

  const prng = new SeededRandom(seed !== undefined ? seed : Math.floor(Math.random() * 1000000))
  const pool = getLetterPool(difficulty, dailyModifier)

  if (targetWords && targetWords.length > 0) {
    targetWords.forEach(w => {
      const lower = w.toLowerCase()
      WORD_SET.add(lower)
      for (let i = 1; i <= lower.length; i++) {
        PREFIX_SET.add(lower.substring(0, i))
      }
    })

    const MAX_ATTEMPTS = 200

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const attemptSeed = (seed !== undefined ? seed : 0) + attempt * 37
      const attemptPrng = new SeededRandom(attemptSeed)

      const embeddedGrid = tryEmbedWords(targetWords, boardSize, attemptPrng)
      if (!embeddedGrid) continue

      // Fill remaining empty cells with random letters
      for (let r = 0; r < boardSize; r++) {
        for (let c = 0; c < boardSize; c++) {
          if (embeddedGrid[r][c] === '') {
            embeddedGrid[r][c] = attemptPrng.choose(pool.split('')).toUpperCase()
          }
        }
      }

      // Validate every target word is present (H/V only)
      if (!verifyAllWordsExist(targetWords, embeddedGrid)) continue

      // Generate special tiles
      const specialTiles = generateSpecialTiles(boardSize, attemptPrng)

      return { grid: embeddedGrid, specialTiles }
    }

    // If all 200 attempts failed, generate a best-effort board without
    // target words rather than showing a broken puzzle
    console.warn('[WordWizard] Failed to embed all target words after 200 attempts — generating fallback board')
  }

  // Fallback: purely random board (also used when no targetWords provided)
  for (let attempt = 0; attempt < 10; attempt++) {
    const grid: string[][] = Array.from({ length: boardSize }, () =>
      Array.from({ length: boardSize }, () => prng.choose(pool.split('')).toUpperCase())
    )

    const words = findAllWords(grid)
    if (words.size >= 15) {
      const specialTiles = generateSpecialTiles(boardSize, prng)
      return { grid, specialTiles }
    }
  }

  // Last resort: return whatever we have
  const grid: string[][] = Array.from({ length: boardSize }, () =>
    Array.from({ length: boardSize }, () => prng.choose(pool.split('')).toUpperCase())
  )
  const specialTiles = generateSpecialTiles(boardSize, prng)
  return { grid, specialTiles }
}

function generateSpecialTiles(
  size: number,
  prng: SeededRandom
): Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'> {
  const specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'> = {}
  const tileTypes: ('gold' | 'arcane' | 'freeze' | 'combo')[] = ['gold', 'arcane', 'freeze', 'combo']
  const specialCount = size <= 8 ? 2 : size <= 10 ? 3 : 4
  const placed = new Set<string>()

  for (let i = 0; i < specialCount; i++) {
    let r = prng.range(0, size)
    let c = prng.range(0, size)
    let key = `${r},${c}`
    let retries = 0
    while (placed.has(key) && retries < 20) {
      r = prng.range(0, size)
      c = prng.range(0, size)
      key = `${r},${c}`
      retries++
    }
    placed.add(key)
    specialTiles[key] = prng.choose(tileTypes)
  }

  return specialTiles
}

/**
 * Returns the 4 orthogonal (non-diagonal) neighbors of a cell.
 * Used for player path validation (dragging through adjacent cells).
 */
export function getAdjacentCells(row: number, col: number, size: number): [number, number][] {
  const adj: [number, number][] = []
  const offsets: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
  for (const [dr, dc] of offsets) {
    const nr = row + dr
    const nc = col + dc
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      adj.push([nr, nc])
    }
  }
  return adj
}

// Global prefix set built on import for ultra-fast pruning
const PREFIX_SET = new Set<string>()
for (const word of WORD_SET) {
  for (let i = 1; i <= word.length; i++) {
    PREFIX_SET.add(word.substring(0, i).toLowerCase())
  }
}

/**
 * Find all valid dictionary words readable in the grid.
 * Only scans Horizontal (left→right, right→left) and Vertical (top→bottom, bottom→top).
 * No diagonals.
 */
export function findAllWords(board: string[][]): Set<string> {
  const size = board.length
  const foundWords = new Set<string>()

  for (const [dr, dc] of DIRECTIONS) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Walk from (r, c) in direction (dr, dc)
        let current = ''
        let nr = r
        let nc = c
        while (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          current += board[nr][nc].toLowerCase()

          if (!PREFIX_SET.has(current)) break

          if (WORD_SET.has(current) && current.length >= 3) {
            foundWords.add(current)
          }

          nr += dr
          nc += dc
        }
      }
    }
  }

  return foundWords
}

export function isValidPath(path: [number, number][], board: string[][]): boolean {
  if (path.length === 0) return false
  const size = board.length

  // Check unique cells
  const seen = new Set<string>()
  for (const [r, c] of path) {
    if (r < 0 || r >= size || c < 0 || c >= size) return false
    const key = `${r},${c}`
    if (seen.has(key)) return false
    seen.add(key)
  }

  // Check adjacency (only orthogonal — no diagonals)
  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i]
    const [r2, c2] = path[i + 1]
    const dr = Math.abs(r1 - r2)
    const dc = Math.abs(c1 - c2)
    // Must be exactly 1 step in exactly one axis (no diagonals)
    if (!((dr === 1 && dc === 0) || (dr === 0 && dc === 1))) {
      return false
    }
  }

  return true
}

export function getWordFromPath(path: [number, number][], board: string[][]): string {
  return path.map(([r, c]) => board[r][c]).join('')
}

export function getRareLetterBonus(word: string): number {
  let bonus = 0
  const w = word.toLowerCase()
  for (const char of w) {
    if ('jqxz'.includes(char)) {
      bonus += 150
    } else if ('kvwy'.includes(char)) {
      bonus += 80
    } else if ('fhpb'.includes(char)) {
      bonus += 30
    }
  }
  return bonus
}

export function getBaseScore(length: number): number {
  if (length === 3) return 100
  if (length === 4) return 200
  if (length === 5) return 400
  if (length === 6) return 700
  return 1000 // 7+ letters
}

export interface ScoreResult {
  base: number
  rareBonus: number
  categoryBonus: number
  specialMultiplier: number
  totalBeforeCombo: number
}

export function calculateScore(
  word: string,
  path: [number, number][],
  specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'>
): ScoreResult {
  const base = getBaseScore(word.length)
  const rareBonus = getRareLetterBonus(word)
  
  const category = getWordCategory(word)
  const categoryBonus = category ? 200 : 0

  let specialMultiplier = 1
  for (const [r, c] of path) {
    const key = `${r},${c}`
    if (specialTiles[key] === 'gold') {
      specialMultiplier *= 2
    }
  }

  const totalBeforeCombo = (base + rareBonus + categoryBonus) * specialMultiplier

  return {
    base,
    rareBonus,
    categoryBonus,
    specialMultiplier,
    totalBeforeCombo
  }
}

/**
 * Find a word in the board scanning only Horizontal and Vertical directions.
 * Returns the path of [row, col] pairs if found, or null.
 */
export function findWordPath(word: string, board: string[][]): [number, number][] | null {
  const size = board.length
  const upper = word.toUpperCase()
  const len = upper.length

  for (const [dr, dc] of DIRECTIONS) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Check bounds for full word in this direction
        const endR = r + dr * (len - 1)
        const endC = c + dc * (len - 1)
        if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue

        // Match each character
        let match = true
        const path: [number, number][] = []
        for (let i = 0; i < len; i++) {
          const gr = r + dr * i
          const gc = c + dc * i
          if (board[gr][gc].toUpperCase() !== upper[i]) {
            match = false
            break
          }
          path.push([gr, gc])
        }

        if (match) return path
      }
    }
  }

  return null
}
