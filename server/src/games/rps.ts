import { redisClient } from '../utils/redis'
import { logger, logError } from '../utils/logger'

interface Player {
  userId: string
  username: string
}

interface RpsMove {
  choice: 'rock' | 'paper' | 'scissors'
}

const GAME_CACHE_TTL = 7200

/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
export async function getRpsSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  const redisKey = `game:rps:${roomCode}`
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(redisKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err) {
      console.error('Failed to get rps session from Redis:', err)
    }
  }

  const dbSession = await prisma.multiplayerGameSession.findUnique({
    where: { roomId }
  })
  if (dbSession) {
    const parsedState = typeof dbSession.gameState === 'string' 
      ? JSON.parse(dbSession.gameState) 
      : dbSession.gameState
    
    await saveRpsSession(roomCode, parsedState)
    return parsedState
  }
  return null
}

/**
 * Saves active game session state to Redis
 */
export async function saveRpsSession(roomCode: string, state: any): Promise<void> {
  const redisKey = `game:rps:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL })
    } catch (err) {
      console.error('Failed to save rps session to Redis:', err)
    }
  }
}

/**
 * Deletes game session state from Redis
 */
export async function deleteRpsSession(roomCode: string): Promise<void> {
  const redisKey = `game:rps:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.del(redisKey)
    } catch (err) {
      console.error('Failed to delete rps session from Redis:', err)
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
  prisma: any
): void {
  const now = new Date()
  prisma.multiplayerGameSession.update({
    where: { roomId },
    data: {
      status,
      winnerId,
      gameState: state,
      lastActivityAt: now,
      updatedAt: now
    }
  }).then(() => {
    logger.info(`[SNAPSHOT SUCCESS] Persisted rps game state to PostgreSQL for roomId=${roomId}`)
  }).catch((err: any) => {
    logError(err, { roomId, context: 'rps-snapshot' })
  })
}

/**
 * Masks choice strings in the gameState before sending to clients
 */
export function getMaskedRpsState(state: any): any {
  if (!state) return null
  const maskedMoves: Record<string, string> = {}
  if (state.moves) {
    Object.keys(state.moves).forEach(uid => {
      maskedMoves[uid] = 'hidden'
    })
  }
  return {
    ...state,
    moves: maskedMoves
  }
}

/**
 * Evaluates round outcome
 */
function evaluateRoundWinner(choice1: string, choice2: string, p1Id: string, p2Id: string): string | null {
  if (choice1 === choice2) return null // Draw
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'scissors' && choice2 === 'paper') ||
    (choice1 === 'paper' && choice2 === 'rock')
  ) {
    return p1Id
  }
  return p2Id
}

/**
 * Processes Rock Paper Scissors moves
 */
export async function processRpsMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: RpsMove,
  players: Player[],
  prisma: any,
  io?: any
): Promise<{ state: any; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getRpsSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  if (currentGameState.stage === 'FINISHED') {
    throw new Error('Game already finished')
  }

  const { choice } = move
  if (!choice || !['rock', 'paper', 'scissors'].includes(choice)) {
    throw new Error('Invalid choice')
  }

  const playerIds = players.map(p => p.userId)
  if (!playerIds.includes(userId)) {
    throw new Error('Unauthorized move')
  }

  if (!currentGameState.moves) {
    currentGameState.moves = {}
  }

  if (currentGameState.moves[userId]) {
    throw new Error('You have already made a choice for this round')
  }

  // Register choice
  currentGameState.moves[userId] = choice

  const movedCount = Object.keys(currentGameState.moves).length
  let gameFinished = false
  let winnerId: string | null = null

  if (movedCount === 2) {
    // Both players have moved -> evaluate round
    const p1Id = playerIds[0]
    const p2Id = playerIds[1]
    const choice1 = currentGameState.moves[p1Id]
    const choice2 = currentGameState.moves[p2Id]

    const roundWinnerId = evaluateRoundWinner(choice1, choice2, p1Id, p2Id)

    if (!currentGameState.playerScores) {
      currentGameState.playerScores = {}
    }

    if (roundWinnerId) {
      currentGameState.playerScores[roundWinnerId] = (currentGameState.playerScores[roundWinnerId] || 0) + 1
    }

    const p1Name = players.find(p => p.userId === p1Id)?.username || 'Player 1'
    const p2Name = players.find(p => p.userId === p2Id)?.username || 'Player 2'
    const emojiMap: Record<string, string> = { rock: '✊', paper: '✋', scissors: '✌️' }

    let outcomeText = 'It is a Draw!'
    if (roundWinnerId) {
      const winnerName = roundWinnerId === p1Id ? p1Name : p2Name
      outcomeText = `${winnerName} wins the round!`
    }

    const roundInfo = {
      round: currentGameState.round,
      choices: { [p1Id]: choice1, [p2Id]: choice2 },
      winnerId: roundWinnerId,
      log: `Round ${currentGameState.round}: ${p1Name} played ${emojiMap[choice1]} vs ${p2Name} played ${emojiMap[choice2]}. ${outcomeText}`
    }

    if (!currentGameState.history) {
      currentGameState.history = []
    }
    currentGameState.history.push(roundInfo)

    if (!currentGameState.commentary) {
      currentGameState.commentary = []
    }
    currentGameState.commentary.unshift(roundInfo.log)

    // Set reveal flag so client renders choice details
    currentGameState.revealRoundResult = true
    
    // Save to cache and database for the intermediate reveal view
    await saveRpsSession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma)

    // Emit the intermediate show choices to both clients
    if (io) {
      io.to(`game:${roomCode}`).emit('game-update', {
        gameState: currentGameState,
        gameFinished: false,
        winnerId: null,
        lastMove: { userId, move }
      })
    }

    // Pause 2500ms so players can view choices side-by-side
    await new Promise(resolve => setTimeout(resolve, 2500))

    // Clear moves and evaluate next stage
    currentGameState.revealRoundResult = false
    currentGameState.moves = {}

    // Check game finish (Best of 3 -> First to 2 wins)
    const p1Score = currentGameState.playerScores[p1Id] || 0
    const p2Score = currentGameState.playerScores[p2Id] || 0

    if (p1Score >= 2) {
      gameFinished = true
      winnerId = p1Id
      currentGameState.stage = 'FINISHED'
    } else if (p2Score >= 2) {
      gameFinished = true
      winnerId = p2Id
      currentGameState.stage = 'FINISHED'
    } else {
      currentGameState.round += 1
      currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
    }

    await saveRpsSession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, gameFinished ? 'FINISHED' : 'PLAYING', winnerId, prisma)

    return { state: currentGameState, gameFinished, winnerId }
  } else {
    // Only one player has moved -> save and return
    currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
    await saveRpsSession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma)
    return { state: currentGameState, gameFinished: false, winnerId: null }
  }
}
