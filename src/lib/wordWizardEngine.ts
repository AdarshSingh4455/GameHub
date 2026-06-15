// Word Wizard Game Engine
// Pure logic, no React, highly performant

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

function tryEmbedWords(words: string[], size: number, prng: SeededRandom): string[][] | null {
  const grid = Array.from({ length: size }, () => Array(size).fill(''))
  
  for (const word of words) {
    const uppercaseWord = word.toUpperCase()
    let placed = false
    
    // Try up to 100 paths for this word
    for (let pathAttempt = 0; pathAttempt < 100; pathAttempt++) {
      let r = prng.range(0, size)
      let c = prng.range(0, size)
      
      const path: [number, number][] = []
      const visited = new Set<string>()
      
      let currR = r
      let currC = c
      let fits = true
      
      for (let i = 0; i < uppercaseWord.length; i++) {
        const letter = uppercaseWord[i]
        const key = `${currR},${currC}`
        
        if (visited.has(key)) {
          fits = false
          break
        }
        
        if (grid[currR][currC] !== '' && grid[currR][currC] !== letter) {
          fits = false
          break
        }
        
        path.push([currR, currC])
        visited.add(key)
        
        if (i < uppercaseWord.length - 1) {
          const adj = getAdjacentCells(currR, currC, size)
          // Seeded shuffle using prng
          const shuffledAdj = adj.slice().sort(() => prng.next() - 0.5)
          
          let nextFound = false
          for (const [nr, nc] of shuffledAdj) {
            const nextKey = `${nr},${nc}`
            if (!visited.has(nextKey) && (grid[nr][nc] === '' || grid[nr][nc] === uppercaseWord[i + 1])) {
              currR = nr
              currC = nc
              nextFound = true
              break
            }
          }
          
          if (!nextFound) {
            fits = false
            break
          }
        }
      }
      
      if (fits && path.length === uppercaseWord.length) {
        for (let i = 0; i < path.length; i++) {
          const [pr, pc] = path[i]
          grid[pr][pc] = uppercaseWord[i]
        }
        placed = true
        break
      }
    }
    
    if (!placed) {
      return null
    }
  }
  
  return grid
}

export function generateBoard(
  size: number,
  difficulty: 'easy' | 'normal' | 'hard',
  seed?: number,
  dailyModifier?: string,
  targetWords?: string[]
): BoardData {
  const prng = new SeededRandom(seed !== undefined ? seed : Math.floor(Math.random() * 1000000))
  const pool = getLetterPool(difficulty, dailyModifier)

  const minAdditional = difficulty === 'easy' ? 10 : difficulty === 'normal' ? 15 : 25

  if (targetWords && targetWords.length > 0) {
    // Target-first generation
    for (let attempt = 0; attempt < 100; attempt++) {
      const embeddedGrid = tryEmbedWords(targetWords, size, prng)
      if (!embeddedGrid) continue

      // Fill remaining empty cells
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (embeddedGrid[r][c] === '') {
            embeddedGrid[r][c] = prng.choose(pool.split('')).toUpperCase()
          }
        }
      }

      const words = findAllWords(embeddedGrid)

      // Verify all target words are present on the board
      const allTargetsPresent = targetWords.every(w => words.has(w.toLowerCase()))
      if (!allTargetsPresent) continue

      // Verify quality rules: minimum additional valid words
      const additionalWordsCount = Array.from(words).filter(w => !targetWords.includes(w.toLowerCase())).length
      if (additionalWordsCount < minAdditional) continue

      // Generate special tiles
      const specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'> = {}
      const tileTypes: ('gold' | 'arcane' | 'freeze' | 'combo')[] = ['gold', 'arcane', 'freeze', 'combo']
      const specialCount = size === 4 ? 1 : size === 5 ? 2 : 3
      const placed = new Set<string>()
      
      for (let i = 0; i < specialCount; i++) {
        let r = prng.range(0, size)
        let c = prng.range(0, size)
        let key = `${r},${c}`
        let retries = 0
        while (placed.has(key) && retries < 10) {
          r = prng.range(0, size)
          c = prng.range(0, size)
          key = `${r},${c}`
          retries++
        }
        placed.add(key)
        specialTiles[key] = prng.choose(tileTypes)
      }

      return { grid: embeddedGrid, specialTiles }
    }
  }

  // Fallback to random board if targetWords not passed or all 100 attempts failed
  let bestGrid: string[][] = []
  let bestSpecialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'> = {}
  let maxWordsCount = -1

  for (let attempt = 0; attempt < 10; attempt++) {
    const grid: string[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => prng.choose(pool.split('')).toUpperCase())
    )

    const specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'> = {}
    const tileTypes: ('gold' | 'arcane' | 'freeze' | 'combo')[] = ['gold', 'arcane', 'freeze', 'combo']
    const specialCount = size === 4 ? 1 : size === 5 ? 2 : 3
    const placed = new Set<string>()
    
    for (let i = 0; i < specialCount; i++) {
      let r = prng.range(0, size)
      let c = prng.range(0, size)
      let key = `${r},${c}`
      let retries = 0
      while (placed.has(key) && retries < 10) {
        r = prng.range(0, size)
        c = prng.range(0, size)
        key = `${r},${c}`
        retries++
      }
      placed.add(key)
      specialTiles[key] = prng.choose(tileTypes)
    }

    const words = findAllWords(grid)
    if (words.size >= 25) {
      return { grid, specialTiles }
    }

    if (words.size > maxWordsCount) {
      maxWordsCount = words.size
      bestGrid = grid
      bestSpecialTiles = specialTiles
    }
  }

  return { grid: bestGrid, specialTiles: bestSpecialTiles }
}

export function getAdjacentCells(row: number, col: number, size: number): [number, number][] {
  const adj: [number, number][] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        adj.push([nr, nc])
      }
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

export function findAllWords(board: string[][]): Set<string> {
  const size = board.length
  const foundWords = new Set<string>()

  const pathSet = new Set<string>()

  function dfs(r: number, c: number, currentStr: string) {
    const key = `${r},${c}`
    if (pathSet.has(key)) return

    const newStr = (currentStr + board[r][c]).toLowerCase()
    
    // Prune if not a prefix of any word in dictionary
    if (!PREFIX_SET.has(newStr)) return

    // Add if it's a valid word
    if (WORD_SET.has(newStr) && newStr.length >= 3) {
      foundWords.add(newStr)
    }

    pathSet.add(key)
    const adj = getAdjacentCells(r, c, size)
    for (const [nr, nc] of adj) {
      dfs(nr, nc, newStr)
    }
    pathSet.delete(key)
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      dfs(r, c, '')
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

  // Check adjacency
  for (let i = 0; i < path.length - 1; i++) {
    const [r1, c1] = path[i]
    const [r2, c2] = path[i + 1]
    const dr = Math.abs(r1 - r2)
    const dc = Math.abs(c1 - c2)
    if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) {
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

export function findWordPath(word: string, board: string[][]): [number, number][] | null {
  const size = board.length
  const w = word.toLowerCase()
  
  function dfs(r: number, c: number, idx: number, visited: Set<string>, currentPath: [number, number][]): [number, number][] | null {
    if (idx === w.length) return currentPath
    
    const key = `${r},${c}`
    if (visited.has(key)) return null
    if (board[r][c].toLowerCase() !== w[idx]) return null
    
    visited.add(key)
    const nextPath = [...currentPath, [r, c] as [number, number]]
    
    if (idx === w.length - 1) {
      return nextPath
    }
    
    const adj = getAdjacentCells(r, c, size)
    for (const [nr, nc] of adj) {
      const path = dfs(nr, nc, idx + 1, visited, nextPath)
      if (path) return path
    }
    
    visited.delete(key)
    return null
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const path = dfs(r, c, 0, new Set(), [])
      if (path) return path
    }
  }
  return null
}

