import { redisClient } from '../utils/redis'
import { logger, logError } from '../utils/logger'

interface Player {
  userId: string
  username: string
}

interface ScribbleMove {
  type: 'settings' | 'select-word' | 'draw' | 'clear' | 'guess' | 'vote-replay'
  timerDuration?: number
  word?: string
  guess?: string
  lines?: any[]
}

const GAME_CACHE_TTL = 7200

export const SCRIBBLE_WORDS = [
  "Apple", "Mountain", "Doctor", "Football", "House", "Cat", "Dog", "Car", "Sun", "Tree",
  "Banana", "Airplane", "Laptop", "Coffee", "Guitar", "Sword", "Rocket", "Chair", "Bridge", "Castle",
  "Spider", "Pizza", "Burger", "Pencil", "Camera", "Mirror", "Hammer", "Clock", "Flower", "Fish",
  "Bird", "Snake", "Hat", "Shoes", "Moon", "Star", "Cloud", "Rainbow", "Fire", "Water",
  "Elephant", "Bicycle", "Cookie", "Dolphin", "Jungle", "Volcano", "Violin", "Helicopter", "Turtle", "Dinosaur"
]

export async function getScribbleSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  const redisKey = `game:scribble:${roomCode}`
  if (redisClient.isReady) {
    try {
      const cached = await redisClient.get(redisKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (err) {
      console.error('Failed to get scribble session from Redis:', err)
    }
  }

  const dbSession = await prisma.multiplayerGameSession.findUnique({
    where: { roomId }
  })
  if (dbSession) {
    const parsedState = typeof dbSession.gameState === 'string' 
      ? JSON.parse(dbSession.gameState) 
      : dbSession.gameState
    
    await saveScribbleSession(roomCode, parsedState)
    return parsedState
  }
  return null
}

export async function saveScribbleSession(roomCode: string, state: any): Promise<void> {
  const redisKey = `game:scribble:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL })
    } catch (err) {
      console.error('Failed to save scribble session to Redis:', err)
    }
  }
}

export async function deleteScribbleSession(roomCode: string): Promise<void> {
  const redisKey = `game:scribble:${roomCode}`
  if (redisClient.isReady) {
    try {
      await redisClient.del(redisKey)
    } catch (err) {
      console.error('Failed to delete scribble session from Redis:', err)
    }
  }
}

function persistSnapshot(roomId: string, state: any, status: string, winnerId: string | null, prisma: any): void {
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
    logger.info(`[SNAPSHOT SUCCESS] Persisted scribble game state to PostgreSQL for roomId=${roomId}`)
  }).catch((err: any) => {
    logError(err, { roomId, context: 'scribble-snapshot' })
  })
}

// Global active interval checkers for scribble games
export const scribbleInactivityCheckers = new Map<string, NodeJS.Timeout>()

export function clearScribbleInactivityCheck(roomCode: string) {
  const interval = scribbleInactivityCheckers.get(roomCode)
  if (interval) {
    clearInterval(interval)
    scribbleInactivityCheckers.delete(roomCode)
  }
}

export function startScribbleInactivityCheck(roomCode: string, io: any, prisma: any) {
  clearScribbleInactivityCheck(roomCode)
  const interval = setInterval(async () => {
    try {
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode },
        include: { players: { include: { profile: true } } }
      })
      if (!room || room.status !== 'PLAYING') {
        clearScribbleInactivityCheck(roomCode)
        return
      }
      const state = await getScribbleSession(roomCode, room.id, prisma)
      if (!state || state.stage !== 'DRAWING') {
        clearScribbleInactivityCheck(roomCode)
        return
      }

      // Emit periodic state updates to keep clients synced with current hints and timer
      for (const player of room.players) {
        const pSocketId = userSockets.get(player.userId)
        if (pSocketId) {
          const maskedState = getScribbleMaskedState(state, player.userId)
          io.to(pSocketId).emit('game-update', {
            gameState: maskedState,
            gameFinished: false,
            winnerId: null
          })
        }
      }

      const elapsedInactivity = Date.now() - state.lastDrawAt
      if (elapsedInactivity >= 15000) {
        clearScribbleInactivityCheck(roomCode)
        const getUsername = (uid: string) => room.players.find((p: any) => p.userId === uid)?.profile?.username || 'Drawer'
        state.commentary.unshift(`⚠️ ${getUsername(state.drawerId)} was skipped due to drawing inactivity!`)
        await endScribbleRound(roomCode, room.id, state, room.players, prisma, io, true)
      } else if (elapsedInactivity >= 10000) {
        io.to(`game:${roomCode}`).emit('scribble-afk-warning', { drawerId: state.drawerId })
      }
    } catch (err) {
      console.error('Inactivity check error:', err)
    }
  }, 1000)
  scribbleInactivityCheckers.set(roomCode, interval)
}

export function getScribbleMaskedState(state: any, userId: string) {
  if (!state) return null
  if (state.drawerId === userId || state.stage === 'ROUND_SUMMARY' || state.stage === 'FINISHED') {
    return state
  }

  if (state.stage === 'DRAWING' && state.selectedWord) {
    const word = state.selectedWord.toUpperCase()
    const elapsedMs = Date.now() - state.timerStart
    
    const elapsedPercent = elapsedMs / (state.timerDuration * 1000)
    let revealPct = 0
    if (elapsedPercent >= 0.75) {
      revealPct = 0.50
    } else if (elapsedPercent >= 0.50) {
      revealPct = 0.35
    } else if (elapsedPercent >= 0.25) {
      revealPct = 0.20
    } else {
      revealPct = 0.00
    }

    let cappedHintsCount = 0
    if (revealPct > 0) {
      cappedHintsCount = Math.max(1, Math.floor(word.length * revealPct))
      const maxPossibleReveal = Math.floor(word.length / 2)
      if (cappedHintsCount > maxPossibleReveal) {
        cappedHintsCount = maxPossibleReveal
      }
    }

    // Deterministic shuffle of indices to reveal based on word seed
    const indices = Array.from({ length: word.length }, (_, i) => i)
    let seed = word.length
    for (let i = indices.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280
      const j = Math.floor((seed / 233280) * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }

    const revealedIndices = indices.slice(0, cappedHintsCount)
    
    let hintString = ''
    for (let i = 0; i < word.length; i++) {
      if (revealedIndices.includes(i)) {
        hintString += word[i] + ' '
      } else {
        hintString += '_ '
      }
    }
    hintString = hintString.trim()

    return {
      ...state,
      selectedWord: undefined, // Mask the word
      hintString
    }
  }

  return state
}

export async function processScribbleMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: ScribbleMove,
  players: any[],
  prisma: any,
  io: any
): Promise<{ state: any; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getScribbleSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Scribble session not found')
  }

  const { type } = move
  let gameFinished = false
  let winnerId: string | null = null

  if (type === 'settings') {
    if (currentGameState.stage !== 'LOBBY_SETTINGS') {
      throw new Error('Game settings already initialized')
    }
    if (currentGameState.hostUserId !== userId) {
      throw new Error('Only the host can configure the match')
    }

    const duration = move.timerDuration || 45
    if (duration !== 30 && duration !== 45 && duration !== 60) {
      throw new Error('Invalid timer duration')
    }

    currentGameState.timerDuration = duration
    
    // Initialize strict player rotation array
    currentGameState.drawerRotation = players.map(p => p.userId)
    
    // Find the first connected player to start drawing
    let firstConnectedIndex = 0
    while (firstConnectedIndex < currentGameState.drawerRotation.length) {
      const uid = currentGameState.drawerRotation[firstConnectedIndex]
      const isConnected = players.some((p: any) => p.userId === uid && p.status !== 'DISCONNECTED' && p.status !== 'LEFT')
      if (isConnected) {
        break
      }
      firstConnectedIndex++
    }

    currentGameState.drawerIndex = firstConnectedIndex >= currentGameState.drawerRotation.length ? 0 : firstConnectedIndex
    currentGameState.drawerId = currentGameState.drawerRotation[currentGameState.drawerIndex]
    currentGameState.stage = 'WORD_SELECTION'
    currentGameState.wordsToSelect = generateRandomWords()
    currentGameState.timerStart = Date.now()
    currentGameState.timerRemaining = 15 // 15 seconds to pick word
    
    await saveScribbleSession(roomCode, currentGameState)
    persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma)
    
    // Schedule word selection timeout
    startScribbleWordSelectionTimer(roomCode, io, prisma)

  } else if (type === 'select-word') {
    if (currentGameState.stage !== 'WORD_SELECTION') {
      throw new Error('Not currently selecting a word')
    }
    if (currentGameState.drawerId !== userId) {
      throw new Error('Only the current drawer can select the word')
    }

    const word = move.word || ''
    if (!currentGameState.wordsToSelect.includes(word)) {
      throw new Error('Invalid word selection')
    }

    await startScribbleDrawing(roomCode, roomId, currentGameState, word, players, prisma, io)

  } else if (type === 'draw') {
    if (currentGameState.stage !== 'DRAWING') {
      throw new Error('Not in drawing stage')
    }
    if (currentGameState.drawerId !== userId) {
      throw new Error('Only the drawer can draw')
    }

    currentGameState.canvasLines = move.lines || []
    currentGameState.lastDrawAt = Date.now()
    await saveScribbleSession(roomCode, currentGameState)

  } else if (type === 'clear') {
    if (currentGameState.stage !== 'DRAWING') {
      throw new Error('Not in drawing stage')
    }
    if (currentGameState.drawerId !== userId) {
      throw new Error('Only the drawer can clear the canvas')
    }

    currentGameState.canvasLines = []
    currentGameState.lastDrawAt = Date.now()
    await saveScribbleSession(roomCode, currentGameState)

  } else if (type === 'guess') {
    if (currentGameState.stage !== 'DRAWING') {
      throw new Error('Guesses are only allowed during drawing')
    }
    if (currentGameState.drawerId === userId) {
      throw new Error('Drawer cannot guess their own word')
    }
    if (currentGameState.guessedPlayers.includes(userId)) {
      throw new Error('You already guessed correctly')
    }

    const guess = (move.guess || '').trim().toLowerCase()
    const targetWord = currentGameState.selectedWord.toLowerCase()
    const getUsername = (uid: string) => players.find((p: any) => p.userId === uid)?.username || 'Player'

    if (guess === targetWord) {
      // Correct Guess!
      currentGameState.guessedPlayers.push(userId)
      
      const elapsedMs = Date.now() - currentGameState.timerStart
      const duration = currentGameState.timerDuration
      
      let points = 40
      if (elapsedMs < (duration * 1000) / 3) {
        points = 100
      } else if (elapsedMs < (duration * 1000 * 2) / 3) {
        points = 70
      }

      // First Correct Guess Bonus (+25 points)
      if (!currentGameState.firstGuessed) {
        points += 25
        currentGameState.firstGuessed = true
        currentGameState.commentary.unshift(`⭐ ${getUsername(userId)} guessed FIRST! (+25 pts)`)
      }

      currentGameState.roundScores[userId] = points
      currentGameState.playerScores[userId] = (currentGameState.playerScores[userId] || 0) + points

      // Drawer Bonus (+20 points per guesser)
      const drawerId = currentGameState.drawerId
      currentGameState.roundScores[drawerId] = (currentGameState.roundScores[drawerId] || 0) + 20
      currentGameState.playerScores[drawerId] = (currentGameState.playerScores[drawerId] || 0) + 20

      currentGameState.commentary.unshift(`✅ ${getUsername(userId)} guessed correctly! (+${points} pts)`)

      // Check if all active players (except drawer) have guessed correctly
      const spectators = players.filter((p: any) => p.userId !== drawerId)
      const allGuessed = spectators.every((p: any) => currentGameState.guessedPlayers.includes(p.userId))

      if (allGuessed) {
        clearScribbleInactivityCheck(roomCode)
        await endScribbleRound(roomCode, roomId, currentGameState, players, prisma, io)
      } else {
        await saveScribbleSession(roomCode, currentGameState)
        persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma)
      }
    } else {
      // Incorrect guess - treat as chat message or log
      currentGameState.commentary.unshift(`💬 ${getUsername(userId)}: ${move.guess}`)
      await saveScribbleSession(roomCode, currentGameState)
    }
  }

  return { state: currentGameState, gameFinished, winnerId }
}

function generateRandomWords(): string[] {
  const shuffled = [...SCRIBBLE_WORDS].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, 4)
}

export async function startScribbleDrawing(roomCode: string, roomId: string, state: any, word: string, players: any[], prisma: any, io: any) {
  clearTurnTimer(roomCode)
  
  state.selectedWord = word
  state.stage = 'DRAWING'
  state.timerStart = Date.now()
  state.guessedPlayers = []
  state.roundScores = players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {})
  state.firstGuessed = false
  state.canvasLines = []
  state.lastDrawAt = Date.now()
  
  const getUsername = (uid: string) => players.find((p: any) => p.userId === uid)?.username || 'Drawer'
  state.commentary.unshift(`🎨 Round started! ${getUsername(state.drawerId)} is drawing...`)

  await saveScribbleSession(roomCode, state)
  persistSnapshot(roomId, state, 'PLAYING', null, prisma)

  // Start activity monitoring
  startScribbleInactivityCheck(roomCode, io, prisma)

  // Schedule round end drawing timer
  const duration = state.timerDuration
  const timeout = setTimeout(async () => {
    const queue = getRoomQueue(roomCode)
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: { players: { include: { profile: true } } }
        })
        if (!room) return
        const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } })
        if (!session || session.status !== 'PLAYING') return

        const freshState = await getScribbleSession(roomCode, room.id, prisma)
        if (freshState && freshState.stage === 'DRAWING') {
          clearScribbleInactivityCheck(roomCode)
          await endScribbleRound(roomCode, room.id, freshState, room.players, prisma, io)
        }
      } catch (err) {
        console.error('Drawing round timer expired error:', err)
      }
    })
  }, duration * 1000)
  
  roomTurnTimeouts.set(roomCode, timeout)
  
  // Emit player-specific masked states
  for (const player of players) {
    const pSocketId = userSockets.get(player.userId)
    if (pSocketId) {
      const maskedState = getScribbleMaskedState(state, player.userId)
      io.to(pSocketId).emit('game-update', {
        gameState: maskedState,
        gameFinished: false,
        winnerId: null
      })
    }
  }
}

export async function endScribbleRound(roomCode: string, roomId: string, state: any, players: any[], prisma: any, io: any, isSkipped = false) {
  clearTurnTimer(roomCode)
  clearScribbleInactivityCheck(roomCode)

  state.stage = 'ROUND_SUMMARY'
  state.commentary.unshift(`🏁 Round Over! The word was: "${state.selectedWord.toUpperCase()}"`)

  await saveScribbleSession(roomCode, state)
  persistSnapshot(roomId, state, 'PLAYING', null, prisma)

  // Notify clients (reveal full word to everyone in round summary)
  io.to(`game:${roomCode}`).emit('game-update', {
    gameState: state,
    gameFinished: false,
    winnerId: null
  })

  // Start 8-second Round Summary timer
  const summaryTimeout = setTimeout(() => {
    const queue = getRoomQueue(roomCode)
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: { players: { include: { profile: true } } }
        })
        if (!room) return
        const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } })
        if (!session || session.status !== 'PLAYING') return

        const freshState = await getScribbleSession(roomCode, room.id, prisma)
        if (freshState && freshState.stage === 'ROUND_SUMMARY') {
          await setupNextScribbleTurn(roomCode, room.id, freshState, room.players, prisma, io)
        }
      } catch (err) {
        console.error('Round summary transition error:', err)
      }
    })
  }, 8000)

  roomTurnTimeouts.set(roomCode, summaryTimeout)
}

export async function setupNextScribbleTurn(roomCode: string, roomId: string, state: any, players: any[], prisma: any, io: any) {
  if (!state.drawerRotation) {
    state.drawerRotation = players.map(p => p.userId)
  }

  state.drawerIndex++
  if (state.drawerIndex >= state.drawerRotation.length) {
    state.drawerIndex = 0
    state.round++
  }

  // Scan for the next connected player in rotation, counting skipped turns
  let searchAttempts = 0
  const rotationLength = state.drawerRotation.length
  let foundConnected = false

  while (searchAttempts < rotationLength && state.round <= state.maxRounds) {
    const potentialDrawerId = state.drawerRotation[state.drawerIndex]
    const isConnected = players.some((p: any) => p.userId === potentialDrawerId && p.status !== 'DISCONNECTED' && p.status !== 'LEFT')
    
    if (isConnected) {
      state.drawerId = potentialDrawerId
      foundConnected = true
      break
    } else {
      state.commentary.unshift(`⚠️ Skipped turn for disconnected player.`)
      state.drawerIndex++
      searchAttempts++
      if (state.drawerIndex >= state.drawerRotation.length) {
        state.drawerIndex = 0
        state.round++
      }
    }
  }

  // Check if final round ended
  if (state.round > state.maxRounds) {
    // Cap round counter at maxRounds on finish
    state.round = state.maxRounds
    state.stage = 'FINISHED'
    
    // Find winner
    let maxScore = -1
    let winnerId: string | null = null
    Object.keys(state.playerScores).forEach(uid => {
      const s = state.playerScores[uid]
      if (s > maxScore) {
        maxScore = s
        winnerId = uid
      } else if (s === maxScore) {
        winnerId = 'DRAW'
      }
    })

    state.commentary.unshift(`🏆 Match finished! Leaderboard is final.`)
    await saveScribbleSession(roomCode, state)
    persistSnapshot(roomId, state, 'FINISHED', winnerId, prisma)

    // Distribute multiplayer rewards
    await handleMultiplayerCompletionRewards(roomId, state, winnerId, players, prisma)
    await deleteScribbleSession(roomCode)

    io.to(`game:${roomCode}`).emit('game-update', {
      gameState: state,
      gameFinished: true,
      winnerId
    })
  } else {
    // Word selection for next drawer
    state.stage = 'WORD_SELECTION'
    state.wordsToSelect = generateRandomWords()
    state.selectedWord = ''
    state.timerStart = Date.now()
    state.timerRemaining = 15
    state.canvasLines = []
    
    await saveScribbleSession(roomCode, state)
    persistSnapshot(roomId, state, 'PLAYING', null, prisma)

    // Schedule Word Selection timer (15s)
    startScribbleWordSelectionTimer(roomCode, io, prisma)

    // Emit player-specific masked states for word selection stage
    for (const player of players) {
      const pSocketId = userSockets.get(player.userId)
      if (pSocketId) {
        const maskedState = getScribbleMaskedState(state, player.userId)
        io.to(pSocketId).emit('game-update', {
          gameState: maskedState,
          gameFinished: false,
          winnerId: null
        })
      }
    }
  }
}

export function startScribbleWordSelectionTimer(roomCode: string, io: any, prisma: any) {
  clearTurnTimer(roomCode)
  const timeout = setTimeout(() => {
    const queue = getRoomQueue(roomCode)
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: { players: { include: { profile: true } } }
        })
        if (!room) return
        const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } })
        if (!session || session.status !== 'PLAYING') return

        const state = await getScribbleSession(roomCode, room.id, prisma)
        if (state && state.stage === 'WORD_SELECTION') {
          // Drawer did not pick word in 15 seconds! Select first word automatically
          const autoWord = state.wordsToSelect[0] || 'Apple'
          state.commentary.unshift(`⏰ Time out! Word auto-chosen for drawer.`)
          await startScribbleDrawing(roomCode, room.id, state, autoWord, room.players, prisma, io)
        }
      } catch (err) {
        console.error('Word selection timer expired error:', err)
      }
    })
  }, 15000)
  roomTurnTimeouts.set(roomCode, timeout)
}

async function handleMultiplayerCompletionRewards(roomId: string, state: any, winnerId: string | null, players: any[], prisma: any) {
  try {
    const game = await prisma.game.findUnique({ where: { slug: 'scribble' } })
    if (!game) return

    // Order players by scores
    const sortedPlayers = [...players].sort((a, b) => (state.playerScores[b.userId] || 0) - (state.playerScores[a.userId] || 0))
    
    for (let i = 0; i < sortedPlayers.length; i++) {
      const p = sortedPlayers[i]
      
      // Determine rewards based on rank
      let xp = 30
      let coins = 5
      if (i === 0) {
        xp = 150
        coins = 30
      } else if (i === 1) {
        xp = 100
        coins = 20
      } else if (i === 2) {
        xp = 75
        coins = 15
      }

      if (p.profile) {
        await prisma.profile.update({
          where: { id: p.profile.id },
          data: {
            xp: { increment: xp },
            coins: { increment: coins }
          }
        })
      }
    }
  } catch (err) {
    logger.error(err, 'Failed to distribute scribble rewards')
  }
}

// Reuse timers/queues references from index.ts by proxying
import { roomTurnTimeouts, userSockets, clearTurnTimer } from '../index'
import { getRoomQueue } from '../utils/queue'
