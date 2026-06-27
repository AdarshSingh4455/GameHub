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


// ==========================================
// 5. CONNECT FOUR (4 IN A ROW) AI
// ==========================================
type FourCell = 'X' | 'O' | null // X is player, O is CPU

function getLowestRow(board: FourCell[], col: number): number {
  for (let r = 5; r >= 0; r--) {
    if (board[r * 7 + col] === null) return r
  }
  return -1
}

function checkFourWinner(board: FourCell[]): 'X' | 'O' | 'draw' | null {
  // Horizontal
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      if (board[i] && board[i] === board[i+1] && board[i] === board[i+2] && board[i] === board[i+3]) {
        return board[i] as 'X' | 'O'
      }
    }
  }
  // Vertical
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const i = r * 7 + c
      if (board[i] && board[i] === board[i+7] && board[i] === board[i+14] && board[i] === board[i+21]) {
        return board[i] as 'X' | 'O'
      }
    }
  }
  // Diagonal Down-Right
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      if (board[i] && board[i] === board[i+8] && board[i] === board[i+16] && board[i] === board[i+24]) {
        return board[i] as 'X' | 'O'
      }
    }
  }
  // Diagonal Up-Right
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      if (board[i] && board[i] === board[i-6] && board[i] === board[i-12] && board[i] === board[i-18]) {
        return board[i] as 'X' | 'O'
      }
    }
  }
  if (board.every(cell => cell !== null)) return 'draw'
  return null
}

function evaluateWindow(window: FourCell[], cpuSymbol: 'X' | 'O'): number {
  let score = 0
  const oppSymbol = cpuSymbol === 'O' ? 'X' : 'O'

  let cpuCount = 0
  let oppCount = 0
  let emptyCount = 0

  for (const cell of window) {
    if (cell === cpuSymbol) cpuCount++
    else if (cell === oppSymbol) oppCount++
    else emptyCount++
  }

  if (cpuCount === 4) {
    score += 1000
  } else if (cpuCount === 3 && emptyCount === 1) {
    score += 50
  } else if (cpuCount === 2 && emptyCount === 2) {
    score += 10
  }

  if (oppCount === 3 && emptyCount === 1) {
    score -= 80
  } else if (oppCount === 2 && emptyCount === 2) {
    score -= 8
  }

  return score
}

function scoreBoard(board: FourCell[], cpuSymbol: 'X' | 'O'): number {
  let score = 0

  // 1. Center column preference
  const centerCol = 3
  for (let r = 0; r < 6; r++) {
    if (board[r * 7 + centerCol] === cpuSymbol) {
      score += 4
    }
  }

  // 2. Horizontal windows
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      score += evaluateWindow([board[i], board[i+1], board[i+2], board[i+3]], cpuSymbol)
    }
  }

  // 3. Vertical windows
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const i = r * 7 + c
      score += evaluateWindow([board[i], board[i+7], board[i+14], board[i+21]], cpuSymbol)
    }
  }

  // 4. Diagonal Down-Right windows
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      score += evaluateWindow([board[i], board[i+8], board[i+16], board[i+24]], cpuSymbol)
    }
  }

  // 5. Diagonal Up-Right windows
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 7 + c
      score += evaluateWindow([board[i], board[i-6], board[i-12], board[i-18]], cpuSymbol)
    }
  }

  return score
}

function minimaxConnectFour(
  board: FourCell[],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  cpuSymbol: 'X' | 'O'
): number {
  const winner = checkFourWinner(board)
  const oppSymbol = cpuSymbol === 'O' ? 'X' : 'O'
  
  if (winner === cpuSymbol) return 10000 - depth
  if (winner === oppSymbol) return depth - 10000
  if (winner === 'draw') return 0
  if (depth >= 4) return scoreBoard(board, cpuSymbol)

  if (isMaximizing) {
    let maxEval = -Infinity
    for (let c = 0; c < 7; c++) {
      const r = getLowestRow(board, c)
      if (r !== -1) {
        const i = r * 7 + c
        board[i] = cpuSymbol
        const score = minimaxConnectFour(board, depth + 1, alpha, beta, false, cpuSymbol)
        board[i] = null
        maxEval = Math.max(maxEval, score)
        alpha = Math.max(alpha, score)
        if (beta <= alpha) break
      }
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (let c = 0; c < 7; c++) {
      const r = getLowestRow(board, c)
      if (r !== -1) {
        const i = r * 7 + c
        board[i] = oppSymbol
        const score = minimaxConnectFour(board, depth + 1, alpha, beta, true, cpuSymbol)
        board[i] = null
        minEval = Math.min(minEval, score)
        beta = Math.min(beta, score)
        if (beta <= alpha) break
      }
    }
    return minEval
  }
}

export function getFourInARowMove(
  board: FourCell[],
  difficulty: 'easy' | 'moderate' | 'hard',
  cpuSymbol: 'X' | 'O' = 'O'
): number {
  const validCols: number[] = []
  for (let c = 0; c < 7; c++) {
    if (getLowestRow(board, c) !== -1) validCols.push(c)
  }

  if (validCols.length === 0) return -1

  // Easy AI: 90% random moves
  if (difficulty === 'easy') {
    if (Math.random() < 0.9) {
      return validCols[Math.floor(Math.random() * validCols.length)]
    }
  }

  // Moderate AI: 40% random, 60% minimax search at depth 3
  if (difficulty === 'moderate') {
    if (Math.random() < 0.4) {
      return validCols[Math.floor(Math.random() * validCols.length)]
    }
  }

  // Find best move using minimax with alpha-beta pruning
  let bestVal = -Infinity
  let bestCol = validCols[0]

  for (const col of validCols) {
    const row = getLowestRow(board, col)
    const idx = row * 7 + col
    board[idx] = cpuSymbol
    const depthLimit = difficulty === 'moderate' ? 2 : 4
    const val = minimaxConnectFour(board, 0, -Infinity, Infinity, false, cpuSymbol)
    board[idx] = null

    if (val > bestVal) {
      bestVal = val
      bestCol = col
    }
  }

  return bestCol
}
