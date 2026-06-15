// Session-scoped game AI logic for Sprint 3

// ==========================================
// 1. TIC TAC TOE AI
// ==========================================
type TTTCell = 'X' | 'O' | null

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function checkTTTWinner(board: TTTCell[]): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of TTT_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as 'X' | 'O'
    }
  }
  if (board.every(Boolean)) return 'draw'
  return null
}

function minimax(board: TTTCell[], isMaximizing: boolean, depth: number): number {
  const winner = checkTTTWinner(board)
  if (winner === 'O') return 10 - depth
  if (winner === 'X') return depth - 10
  if (winner === 'draw') return 0

  if (isMaximizing) {
    let best = -Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O'
        best = Math.max(best, minimax(board, false, depth + 1))
        board[i] = null
      }
    }
    return best
  } else {
    let best = Infinity
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X'
        best = Math.min(best, minimax(board, true, depth + 1))
        board[i] = null
      }
    }
    return best
  }
}

export function getTTTMove(board: TTTCell[], difficulty: 'moderate' | 'hard'): number {
  const availableMoves: number[] = []
  for (let i = 0; i < 9; i++) {
    if (!board[i]) availableMoves.push(i)
  }

  if (availableMoves.length === 0) return -1

  // Moderate AI: 30% chance of random move, 70% optimal
  if (difficulty === 'moderate' && Math.random() < 0.3) {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)]
  }

  // Hard AI / Optimal minimax: Find best move
  let bestVal = -Infinity
  let bestMove = availableMoves[0]

  for (const move of availableMoves) {
    board[move] = 'O'
    const val = minimax(board, false, 0)
    board[move] = null
    if (val > bestVal) {
      bestVal = val
      bestMove = move
    }
  }
  return bestMove
}


// ==========================================
// 2. ROCK PAPER SCISSORS AI
// ==========================================
export type RPSMove = 'rock' | 'paper' | 'scissors'

const RPS_BEATS: Record<RPSMove, RPSMove> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
}

const RPS_LOSES: Record<RPSMove, RPSMove> = {
  rock: 'paper',
  paper: 'scissors',
  scissors: 'rock',
}

export function getRPSMove(history: RPSMove[], difficulty: 'moderate' | 'hard'): RPSMove {
  const moves: RPSMove[] = ['rock', 'paper', 'scissors']

  // If no history, play randomly
  if (history.length === 0) {
    return moves[Math.floor(Math.random() * moves.length)]
  }

  const lastPlayerMove = history[history.length - 1]

  if (difficulty === 'moderate') {
    // Moderate AI: 50% chance of playing the counter to the player's last move, 50% random
    if (Math.random() < 0.5) {
      return RPS_LOSES[lastPlayerMove]
    }
    return moves[Math.floor(Math.random() * moves.length)]
  }

  // Hard AI: Markov Chain / pattern prediction
  // Find transitions. Look at pairs of moves (player move i -> player move i+1)
  const transitions: Record<string, Record<RPSMove, number>> = {
    rock: { rock: 0, paper: 0, scissors: 0 },
    paper: { rock: 0, paper: 0, scissors: 0 },
    scissors: { rock: 0, paper: 0, scissors: 0 },
  }

  for (let i = 0; i < history.length - 1; i++) {
    const prev = history[i]
    const next = history[i + 1]
    if (transitions[prev] && next in transitions[prev]) {
      transitions[prev][next]++
    }
  }

  const playerTendencies = transitions[lastPlayerMove]
  let predictedMove: RPSMove = 'rock'
  let maxCount = -1

  // Find player's most likely next move
  for (const move of moves) {
    if (playerTendencies[move] > maxCount) {
      maxCount = playerTendencies[move]
      predictedMove = move
    }
  }

  // If there's no pattern yet (counts are all 0), default to countering their last move
  if (maxCount === 0) {
    return RPS_LOSES[lastPlayerMove]
  }

  // Counter the predicted move
  return RPS_LOSES[predictedMove]
}


// ==========================================
// 3. NUMBER GUESSING AI
// ==========================================
export function getNumberGuess(min: number, max: number, difficulty: 'moderate' | 'hard'): number {
  if (min > max) return min

  if (difficulty === 'hard') {
    // Hard AI: Perfect Binary Search
    return Math.floor((min + max) / 2)
  }

  // Moderate AI: Guess randomly within the correct range, simulating a smart player without exact midpoint calculation
  const range = max - min + 1
  // Add a slight bias towards the center but keep it random
  const randomOffset = Math.floor(Math.random() * range)
  return min + randomOffset
}


// ==========================================
// 4. MEMORY MATCH AI
// ==========================================
export interface MemoryCard {
  id: number
  emoji: string
  isFlipped: boolean
  isMatched: boolean
}

export function getMemoryMatchMoves(
  cards: MemoryCard[],
  seenMemory: Record<number, string>, // index -> emoji map (capacity-limited on frontend)
  difficulty: 'easy' | 'moderate' | 'hard'
): [number, number] {
  const unmatchedIndices = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.isMatched)
    .map(({ i }) => i)

  if (unmatchedIndices.length < 2) return [unmatchedIndices[0] ?? 0, unmatchedIndices[0] ?? 0]

  // 1. Scan memory for any matching pair and return it
  const memoryEntries = Object.entries(seenMemory).map(([idx, emoji]) => ({ idx: parseInt(idx, 10), emoji }))
  for (let i = 0; i < memoryEntries.length; i++) {
    for (let j = i + 1; j < memoryEntries.length; j++) {
      if (memoryEntries[i].emoji === memoryEntries[j].emoji && memoryEntries[i].idx !== memoryEntries[j].idx) {
        console.log(`[AI LOG] Found remembered match in memory at indices ${memoryEntries[i].idx} and ${memoryEntries[j].idx}`)
        return [memoryEntries[i].idx, memoryEntries[j].idx]
      }
    }
  }

  // 2. If no matching pair in memory:
  // Easy Mode: plays randomly (randomly pick two unmatched cards)
  if (difficulty === 'easy') {
    const firstChoice = unmatchedIndices[Math.floor(Math.random() * unmatchedIndices.length)]
    const poolSecond = unmatchedIndices.filter(idx => idx !== firstChoice)
    const secondChoice = poolSecond[Math.floor(Math.random() * poolSecond.length)]
    return [firstChoice, secondChoice]
  }

  // Medium (moderate) & Hard Mode: Strategic exploration
  // Try to pick a card that is NOT currently in our memory first
  const unseenIndices = unmatchedIndices.filter((idx) => !(idx in seenMemory))
  const pool = unseenIndices.length > 0 ? unseenIndices : unmatchedIndices
  const firstChoice = pool[Math.floor(Math.random() * pool.length)]

  // Now check if we know the match for the first flipped card in our memory
  const firstEmoji = cards[firstChoice].emoji
  for (const [idxStr, emoji] of Object.entries(seenMemory)) {
    const idx = parseInt(idxStr, 10)
    if (emoji === firstEmoji && idx !== firstChoice) {
      console.log(`[AI LOG] Flipped unseen card ${firstChoice} and remembered its match at ${idx}`)
      return [firstChoice, idx]
    }
  }

  // Otherwise, pick a second card randomly
  const poolSecond = unmatchedIndices.filter((idx) => idx !== firstChoice)
  const secondChoice = poolSecond[Math.floor(Math.random() * poolSecond.length)]

  return [firstChoice, secondChoice]
}
