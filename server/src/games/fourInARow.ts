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

interface FourInARowMove {
  column: number // 0 to 6
}

function checkWinner(board: (string | null)[]): { winner: 'X' | 'O'; line: number[] } | null {
  // Horizontal (6 rows, 7 cols)
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i1 = r * 7 + c
      const i2 = r * 7 + c + 1
      const i3 = r * 7 + c + 2
      const i4 = r * 7 + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as 'X' | 'O', line: [i1, i2, i3, i4] }
      }
    }
  }
  // Vertical
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 7; c++) {
      const i1 = r * 7 + c
      const i2 = (r + 1) * 7 + c
      const i3 = (r + 2) * 7 + c
      const i4 = (r + 3) * 7 + c
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as 'X' | 'O', line: [i1, i2, i3, i4] }
      }
    }
  }
  // Diagonal Down-Right
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const i1 = r * 7 + c
      const i2 = (r + 1) * 7 + c + 1
      const i3 = (r + 2) * 7 + c + 2
      const i4 = (r + 3) * 7 + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as 'X' | 'O', line: [i1, i2, i3, i4] }
      }
    }
  }
  // Diagonal Up-Right
  for (let r = 3; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      const i1 = r * 7 + c
      const i2 = (r - 1) * 7 + c + 1
      const i3 = (r - 2) * 7 + c + 2
      const i4 = (r - 3) * 7 + c + 3
      if (board[i1] && board[i1] === board[i2] && board[i1] === board[i3] && board[i1] === board[i4]) {
        return { winner: board[i1] as 'X' | 'O', line: [i1, i2, i3, i4] }
      }
    }
  }
  return null
}

export async function getFourInARowSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  return getGameSessionFromCache('four-in-a-row', roomCode, roomId, prisma)
}

export async function saveFourInARowSession(roomCode: string, state: any): Promise<void> {
  return saveGameSessionToCache('four-in-a-row', roomCode, state)
}

export async function deleteFourInARowSession(roomCode: string): Promise<void> {
  return deleteGameSessionFromCache('four-in-a-row', roomCode)
}

export async function processFourInARowMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: FourInARowMove,
  players: Player[],
  prisma: any
): Promise<{ state: any; snapshotPersisted: boolean; gameFinished: boolean; winnerId: string | null }> {
  const currentGameState = await getFourInARowSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  validateTurn(currentGameState, userId)

  const { column } = move
  if (column === undefined || column < 0 || column > 6) {
    throw new Error('Invalid column index')
  }

  const board = currentGameState.board || Array(42).fill(null)

  // Find lowest available row in column
  let targetRow = -1
  for (let r = 5; r >= 0; r--) {
    if (board[r * 7 + column] === null) {
      targetRow = r
      break
    }
  }

  if (targetRow === -1) {
    throw new Error('Column is full')
  }

  const playerIds = players.map(p => p.userId)
  const opponentUserId = playerIds.find(id => id !== userId) || ''

  const isP1 = playerIds[0] === userId
  const symbol = isP1 ? 'X' : 'O'

  // Apply move to board
  const boardIndex = targetRow * 7 + column
  board[boardIndex] = symbol
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
    winnerId = userId
    updatedStatus = 'FINISHED'
    nextTurn = null
    currentGameState.winnerId = winnerId
    currentGameState.winningLine = winCheck.line
    currentGameState.currentTurn = null

    // Run async to persist to DB
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'four-in-a-row', prisma)
    await deleteFourInARowSession(roomCode)
    snapshotPersisted = true
  } else if (board.every((cell: string | null) => cell !== null)) {
    gameFinished = true
    winnerId = 'DRAW'
    updatedStatus = 'FINISHED'
    nextTurn = null
    currentGameState.winnerId = 'DRAW'
    currentGameState.currentTurn = null

    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'four-in-a-row', prisma)
    await deleteFourInARowSession(roomCode)
    snapshotPersisted = true
  } else {
    currentGameState.currentTurn = nextTurn
    const turnDurationMs = 30000 // 30s turn timer
    currentGameState.turnExpiration = new Date(Date.now() + turnDurationMs).toISOString()
  }

  if (!snapshotPersisted) {
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'four-in-a-row', prisma)
    snapshotPersisted = true
    await saveFourInARowSession(roomCode, currentGameState)
  }

  return {
    state: currentGameState,
    snapshotPersisted,
    gameFinished,
    winnerId: updatedStatus === 'FINISHED' ? (winnerId || 'DRAW') : null
  }
}
