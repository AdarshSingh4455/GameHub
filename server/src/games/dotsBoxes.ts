import { redisClient } from '../utils/redis'
import { logger, logError } from '../utils/logger'


interface Player {
  userId: string
  username: string
}

interface DotsBoxesMove {
  lineId: string
}

// Active Game Cache TTL: 2 hours
const GAME_CACHE_TTL = 7200

/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
export async function getDotsBoxesSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  const redisKey = `game:dotsboxes:${roomCode}`
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(redisKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err) {
      console.error('Failed to get dots & boxes session from Redis:', err)
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
    await saveDotsBoxesSession(roomCode, parsedState)
    return parsedState
  }
  return null
}

/**
 * Saves active game session state to Redis
 */
export async function saveDotsBoxesSession(roomCode: string, state: any): Promise<void> {
  const redisKey = `game:dotsboxes:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL })
    } catch (err) {
      console.error('Failed to save dots & boxes session to Redis:', err)
    }
  }
}

/**
 * Deletes game session state from Redis
 */
export async function deleteDotsBoxesSession(roomCode: string): Promise<void> {
  const redisKey = `game:dotsboxes:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.del(redisKey)
    } catch (err) {
      console.error('Failed to delete dots & boxes session from Redis:', err)
    }
  }
}

/**
 * Persists a snapshot of the current game session state to PostgreSQL
 */
function persistSnapshot(roomId: string, state: any, status: string, winnerId: string | null, nextTurn: string | null, prisma: any): void {
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
    logger.info(`[SNAPSHOT SUCCESS] Persisted dots & boxes game state to PostgreSQL for roomId=${roomId}`)
  }).catch((err: any) => {
    logError(err, { roomId, context: 'dots-boxes-snapshot' })
  })
}

/**
 * Processes Dots & Boxes game moves
 */
export async function processDotsBoxesMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: DotsBoxesMove,
  players: Player[],
  prisma: any
): Promise<{ state: any; snapshotPersisted: boolean; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getDotsBoxesSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  // Load session turn directly to verify (as stored in database field or gameState)
  const currentTurn = currentGameState.currentTurn
  if (currentTurn !== userId) {
    throw new Error("It's not your turn")
  }

  const { lineId } = move
  if (!lineId) {
    throw new Error('lineId is required')
  }

  const horizontalLines = currentGameState.horizontalLines || []
  const verticalLines = currentGameState.verticalLines || []
  const completedBoxes = currentGameState.completedBoxes || []
  const playerScores = currentGameState.playerScores || {}
  const playerIds = players.map(p => p.userId)
  const opponentUserId = playerIds.find(id => id !== userId) || ''

  // Validate line is not already claimed
  if (horizontalLines.includes(lineId) || verticalLines.includes(lineId)) {
    throw new Error('Line already claimed')
  }

  // Add line to state
  const parts = lineId.split('-')
  const type = parts[0]
  const r = parseInt(parts[1], 10)
  const c = parseInt(parts[2], 10)

  if (type === 'h') {
    horizontalLines.push(lineId)
  } else if (type === 'v') {
    verticalLines.push(lineId)
  } else {
    throw new Error('Invalid line ID format')
  }

  currentGameState.horizontalLines = horizontalLines
  currentGameState.verticalLines = verticalLines
  
  if (!currentGameState.lineOwners) {
    currentGameState.lineOwners = {}
  }
  currentGameState.lineOwners[lineId] = userId

  // Check box completions
  const dotsSize = currentGameState.dotsSize || 6
  const sizeBoxes = dotsSize - 1
  let boxesCompletedThisTurn = 0

  const checkAndClaim = (br: number, bc: number) => {
    if (br < 0 || br >= sizeBoxes || bc < 0 || bc >= sizeBoxes) return false

    // Check if already completed
    const isAlreadyCompleted = completedBoxes.some((b: any) => b.r === br && b.c === bc)
    if (isAlreadyCompleted) return false

    const top = `h-${br}-${bc}`
    const bottom = `h-${br + 1}-${bc}`
    const left = `v-${br}-${bc}`
    const right = `v-${br}-${bc + 1}`

    const isClaimed = (horizontalLines.includes(top) || verticalLines.includes(top)) &&
                      (horizontalLines.includes(bottom) || verticalLines.includes(bottom)) &&
                      (horizontalLines.includes(left) || verticalLines.includes(left)) &&
                      (horizontalLines.includes(right) || verticalLines.includes(right))

    if (isClaimed) {
      completedBoxes.push({ r: br, c: bc, owner: userId })
      return true
    }
    return false
  }

  if (type === 'h') {
    if (checkAndClaim(r, c)) boxesCompletedThisTurn++
    if (checkAndClaim(r - 1, c)) boxesCompletedThisTurn++
  } else {
    if (checkAndClaim(r, c)) boxesCompletedThisTurn++
    if (checkAndClaim(r, c - 1)) boxesCompletedThisTurn++
  }

  currentGameState.completedBoxes = completedBoxes

  let nextTurn = currentTurn
  if (boxesCompletedThisTurn > 0) {
    playerScores[userId] = (playerScores[userId] || 0) + boxesCompletedThisTurn
    currentGameState.playerScores = playerScores
  } else {
    // Switch turn
    nextTurn = opponentUserId
  }

  currentGameState.currentTurn = nextTurn

  // Check if game finished (total lines for 6x6 is 60)
  const totalLines = dotsSize * (dotsSize - 1) * 2
  const currentLinesCount = horizontalLines.length + verticalLines.length
  
  let gameFinished = false
  let winnerId: string | null = null
  let updatedStatus = 'PLAYING'
  let snapshotPersisted = false

  if (!currentGameState.moveCount) {
    currentGameState.moveCount = 0
  }
  currentGameState.moveCount++

  if (currentLinesCount === totalLines) {
    const p1Score = playerScores[userId] || 0
    const p2Score = playerScores[opponentUserId] || 0

    if (p1Score > p2Score) {
      winnerId = userId
    } else if (p2Score > p1Score) {
      winnerId = opponentUserId
    } // if tie, winnerId remains null (DRAW)

    currentGameState.currentTurn = null
    nextTurn = null
    updatedStatus = 'FINISHED'
    gameFinished = true

    // Persist final match state and clean up Redis cache
    persistSnapshot(roomId, currentGameState, updatedStatus, winnerId, nextTurn, prisma)
    await deleteDotsBoxesSession(roomCode)
    snapshotPersisted = true
  }

  // Persist snapshot periodically: every 5 moves (meaning 5 lines drawn), if game ends, OR if Redis is down
  if (!snapshotPersisted && (currentGameState.moveCount % 5 === 0 || !redisClient.isReady)) {
    persistSnapshot(roomId, currentGameState, updatedStatus, winnerId, nextTurn, prisma)
    snapshotPersisted = true
  }

  if (!gameFinished) {
    await saveDotsBoxesSession(roomCode, currentGameState)
  }

  return {
    state: currentGameState,
    snapshotPersisted,
    gameFinished,
    winnerId
  }
}
