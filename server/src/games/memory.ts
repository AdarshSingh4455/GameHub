import { redisClient } from '../utils/redis'
import { logger, logError } from '../utils/logger'

interface Player {
  userId: string
  username: string
}

interface MemoryMove {
  cardIndex: number
}

// Active Game Cache TTL: 2 hours
const GAME_CACHE_TTL = 7200

/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
export async function getMemorySession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  const redisKey = `game:memory:${roomCode}`
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(redisKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err) {
      console.error('Failed to get memory session from Redis:', err)
    }
  }

  // Fallback to PostgreSQL
  const dbSession = await prisma.multiplayerGameSession.findUnique({
    where: { roomId }
  })
  if (dbSession) {
    const parsedState = typeof dbSession.gameState === 'string' 
      ? JSON.parse(dbSession.gameState) 
      : dbSession.gameState
    
    // Warm up Redis cache
    await saveMemorySession(roomCode, parsedState)
    return parsedState
  }
  return null
}

/**
 * Saves active game session state to Redis
 */
export async function saveMemorySession(roomCode: string, state: any): Promise<void> {
  const redisKey = `game:memory:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL })
    } catch (err) {
      console.error('Failed to save memory session to Redis:', err)
    }
  }
}

/**
 * Deletes game session state from Redis
 */
export async function deleteMemorySession(roomCode: string): Promise<void> {
  const redisKey = `game:memory:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.del(redisKey)
    } catch (err) {
      console.error('Failed to delete memory session from Redis:', err)
    }
  }
}

/**
 * Persists a snapshot of the current game session state to PostgreSQL
 */
function persistSnapshot(
  roomId: string,
  state: any,
  status: string,
  winnerId: string | null,
  nextTurn: string | null,
  prisma: any
): void {
  const now = new Date()
  prisma.multiplayerGameSession.update({
    where: { roomId },
    data: {
      status,
      winnerId,
      currentTurn: nextTurn,
      gameState: state,
      lastActivityAt: now,
      updatedAt: now
    }
  }).then(() => {
    logger.info(`[SNAPSHOT SUCCESS] Persisted memory game state to PostgreSQL for roomId=${roomId}`)
  }).catch((err: any) => {
    logError(err, { roomId, context: 'memory-snapshot' })
  })
}

/**
 * Processes Memory Match game moves
 */
export async function processMemoryMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: MemoryMove,
  players: Player[],
  prisma: any,
  io: any
): Promise<{ state: any; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getMemorySession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  const currentTurn = currentGameState.currentTurn
  if (currentTurn !== userId) {
    throw new Error("It's not your turn")
  }

  const { cardIndex } = move
  if (cardIndex === undefined || cardIndex < 0 || cardIndex >= currentGameState.cards.length) {
    throw new Error('Invalid cardIndex')
  }

  const cards = currentGameState.cards || []
  const card = cards[cardIndex]

  if (card.isMatched || card.isFlipped) {
    throw new Error('Card is already flipped or matched')
  }

  const flippedIndices = currentGameState.flippedIndices || []
  if (flippedIndices.length >= 2) {
    throw new Error('Already flipped two cards, wait for evaluation')
  }

  // Flip the card
  card.isFlipped = true
  flippedIndices.push(cardIndex)
  currentGameState.flippedIndices = flippedIndices

  // If this is the first card flipped, just broadcast the state and return
  if (flippedIndices.length === 1) {
    currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
    await saveMemorySession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, 'PLAYING', null, userId, prisma)
    return { state: currentGameState, gameFinished: false, winnerId: null }
  }

  // If this is the second card flipped:
  // 1. Send the intermediate state so clients can display the second card flipped
  io.to(`game:${roomCode}`).emit('game-update', {
    gameState: currentGameState,
    gameFinished: false,
    winnerId: null,
    lastMove: { userId, move }
  })

  // 2. Perform the evaluation after a short delay
  const idx1 = flippedIndices[0]
  const idx2 = flippedIndices[1]
  const card1 = cards[idx1]
  const card2 = cards[idx2]

  const playerIds = players.map(p => p.userId)
  const opponentUserId = playerIds.find(id => id !== userId) || ''

  let gameFinished = false
  let winnerId: string | null = null

  if (card1.emoji === card2.emoji) {
    // MATCH FOUND
    await new Promise(resolve => setTimeout(resolve, 300))

    card1.isMatched = true
    card2.isMatched = true
    card1.isFlipped = false
    card2.isFlipped = false
    currentGameState.flippedIndices = []

    if (!currentGameState.playerScores) {
      currentGameState.playerScores = {}
    }
    currentGameState.playerScores[userId] = (currentGameState.playerScores[userId] || 0) + 1

    // Check if game is finished
    const allMatched = cards.every((c: any) => c.isMatched)
    if (allMatched) {
      gameFinished = true
      const p1Score = currentGameState.playerScores[playerIds[0]] || 0
      const p2Score = currentGameState.playerScores[playerIds[1]] || 0

      if (p1Score > p2Score) {
        winnerId = playerIds[0]
      } else if (p2Score > p1Score) {
        winnerId = playerIds[1]
      } else {
        winnerId = 'DRAW'
      }

      currentGameState.stage = 'FINISHED'
    } else {
      currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
    }

    await saveMemorySession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, gameFinished ? 'FINISHED' : 'PLAYING', winnerId, gameFinished ? null : userId, prisma)

    return { state: currentGameState, gameFinished, winnerId }
  } else {
    // NO MATCH
    await new Promise(resolve => setTimeout(resolve, 500))

    card1.isFlipped = false
    card2.isFlipped = false
    currentGameState.flippedIndices = []
    
    // Pass turn
    currentGameState.currentTurn = opponentUserId
    currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()

    await saveMemorySession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, 'PLAYING', null, opponentUserId, prisma)

    return { state: currentGameState, gameFinished: false, winnerId: null }
  }
}
