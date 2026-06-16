import {
  getGameSessionFromCache,
  saveGameSessionToCache,
  deleteGameSessionFromCache,
  validateTurn,
  persistSnapshotAsync
} from './framework'
import { logger } from '../utils/logger'

interface Player {
  userId: string
  username: string
}

interface TicTacToeMove {
  index: number // 0 to 8
}

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]              // diagonals
]

/**
 * Checks if a player has won the game
 */
function checkWinner(board: (string | null)[]): { winner: 'X' | 'O'; line: number[] } | null {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as 'X' | 'O', line: [a, b, c] }
    }
  }
  return null
}

/**
 * Loads the active Tic-Tac-Toe game session state
 */
export async function getTicTacToeSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  return getGameSessionFromCache('tic-tac-toe', roomCode, roomId, prisma)
}

/**
 * Saves Tic-Tac-Toe game session state to cache
 */
export async function saveTicTacToeSession(roomCode: string, state: any): Promise<void> {
  return saveGameSessionToCache('tic-tac-toe', roomCode, state)
}

/**
 * Deletes Tic-Tac-Toe game session state from cache
 */
export async function deleteTicTacToeSession(roomCode: string): Promise<void> {
  return deleteGameSessionFromCache('tic-tac-toe', roomCode)
}

/**
 * Processes a Tic-Tac-Toe multiplayer move
 */
export async function processTicTacToeMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: TicTacToeMove,
  players: Player[],
  prisma: any
): Promise<{ state: any; snapshotPersisted: boolean; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getTicTacToeSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  // Authoritative turn check
  validateTurn(currentGameState, userId)

  const { index } = move
  if (index === undefined || index < 0 || index > 8) {
    throw new Error('Invalid board index')
  }

  const board = currentGameState.board || Array(9).fill(null)

  // Validate double-click/already claimed cell
  if (board[index] !== null) {
    throw new Error('Cell already claimed')
  }

  const playerIds = players.map(p => p.userId)
  const opponentUserId = playerIds.find(id => id !== userId) || ''

  // Assign symbols based on room order (p1 = X, p2 = O)
  const isP1 = playerIds[0] === userId
  const symbol = isP1 ? 'X' : 'O'

  // Apply move to board
  board[index] = symbol
  currentGameState.board = board

  if (!currentGameState.moveCount) {
    currentGameState.moveCount = 0
  }
  currentGameState.moveCount++

  // Check win or draw
  const winCheck = checkWinner(board)
  let gameFinished = false
  let winnerId: string | null = null
  let updatedStatus = 'PLAYING'
  let snapshotPersisted = false
  let nextTurn: string | null = opponentUserId

  if (winCheck) {
    gameFinished = true
    winnerId = userId // The active player won
    updatedStatus = 'FINISHED'
    nextTurn = null
    currentGameState.winnerId = winnerId
    currentGameState.winningLine = winCheck.line
    currentGameState.currentTurn = null
    
    // Final snapshot persistence
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma)
    await deleteTicTacToeSession(roomCode)
    snapshotPersisted = true
  } else if (board.every((cell: string | null) => cell !== null)) {
    gameFinished = true
    winnerId = 'DRAW'
    updatedStatus = 'FINISHED'
    nextTurn = null
    currentGameState.winnerId = 'DRAW'
    currentGameState.currentTurn = null
    
    // Final snapshot persistence
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma)
    await deleteTicTacToeSession(roomCode)
    snapshotPersisted = true
  } else {
    // Normal turn switch
    currentGameState.currentTurn = nextTurn
    
    // Update turn expiration timestamp for turn timer countdown
    const turnDurationMs = 30000 // 30 seconds turn timer
    currentGameState.turnExpiration = new Date(Date.now() + turnDurationMs).toISOString()
  }

  // Persist snapshot asynchronously: on every move (since TTT has max 9 moves, we snapshot every move for high recovery guarantees)
  if (!snapshotPersisted) {
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma)
    snapshotPersisted = true
    
    // Save updated state to Redis cache
    await saveTicTacToeSession(roomCode, currentGameState)
  }

  return {
    state: currentGameState,
    snapshotPersisted,
    gameFinished,
    winnerId: updatedStatus === 'FINISHED' ? (winnerId || 'DRAW') : null
  }
}
