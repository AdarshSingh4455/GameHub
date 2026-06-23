import path from 'path'
import dotenv from 'dotenv'

// Load environment variables from the parent root folders
dotenv.config({ path: path.join(__dirname, '../../.env.local') })
dotenv.config({ path: path.join(__dirname, '../../.env') })

import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server, Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Monitoring & Logging Utilities
import { logger, initSentry, logError } from './utils/logger'
import { recordDisconnect, recordReconnectSuccess, startMetricsReporting } from './utils/metrics'

// Middleware & Utilities
import { socketAuthMiddleware, AuthenticatedSocket } from './middleware/auth'
import { connectRedis, redisClient } from './utils/redis'
import { setUserPresence, UserPresenceState } from './utils/presence'
import { getRoomQueue, deleteRoomQueue } from './utils/queue'
import {
  createRoomLimiter,
  joinRoomLimiter,
  sendChatLimiter,
  submitMoveLimiter,
  checkRateLimit
} from './middleware/rateLimit'

// In-Memory Game Controllers
import { processCricketMove, deleteCricketSession, getCricketSession, saveCricketSession } from './games/cricket'
import { processDotsBoxesMove, deleteDotsBoxesSession, getDotsBoxesSession, saveDotsBoxesSession, getRandomDotsBoxesMove } from './games/dotsBoxes'
import { processTicTacToeMove, deleteTicTacToeSession, getTicTacToeSession, saveTicTacToeSession } from './games/ticTacToe'
import { processMemoryMove, deleteMemorySession, getMemorySession, saveMemorySession } from './games/memory'
import { processRpsMove, deleteRpsSession, getRpsSession, saveRpsSession, getMaskedRpsState } from './games/rps'
import { processNumberGuessingMove, deleteNumberGuessingSession, getNumberGuessingSession, saveNumberGuessingSession, getMaskedNumberGuessingState } from './games/numberGuessing'
import { processScribbleMove, deleteScribbleSession, getScribbleSession, saveScribbleSession, getScribbleMaskedState, endScribbleRound, setupNextScribbleTurn, clearScribbleInactivityCheck } from './games/scribble'
import { processHangmanMove, deleteHangmanSession, getHangmanSession, saveHangmanSession, getMaskedHangmanState } from './games/hangman'
import { INITIAL_STATES, handleMatchCompletion } from './games/framework'

// Initialize Sentry SDK
initSentry()

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }))
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  transports: ['websocket'] // Enforce WebSocket-only transport for horizontal scaling compatibility
})

import { createPrismaMockProxy } from './utils/mockPrisma'

// Initialize Prisma Client connection pool using PostgreSQL adapter
const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const realPrisma = new PrismaClient({ adapter })
export const prisma = process.env.MOCK_DB === 'true' || process.env.MOCK_AUTH === 'true'
  ? createPrismaMockProxy(realPrisma)
  : realPrisma

// Connection tracking maps
export const userSockets = new Map<string, string>() // maps userId -> socketId
const disconnectTimers = new Map<string, NodeJS.Timeout>() // maps userId -> Timeout
export const roomTurnTimeouts = new Map<string, NodeJS.Timeout>() // maps roomCode -> Turn Timeout

// Presence & Party Systems V2
export interface PartyMember {
  userId: string
  username: string
  socketId: string
  role: 'LEADER' | 'MEMBER'
}
export interface PartyState {
  partyCode: string
  members: PartyMember[]
}
export const parties = new Map<string, PartyState>() // partyCode -> PartyState
export const userParty = new Map<string, string>() // userId -> partyCode
export const presenceStore = new Map<string, { status: string; lastSeenAt: string }>()

export function clearTurnTimer(roomCode: string) {
  const timeout = roomTurnTimeouts.get(roomCode)
  if (timeout) {
    clearTimeout(timeout)
    roomTurnTimeouts.delete(roomCode)
  }
}

function startTurnTimer(roomCode: string) {
  clearTurnTimer(roomCode)

  const timeout = setTimeout(async () => {
    logger.info(`[TURN TIMEOUT] roomCode=${roomCode} - executing auto move`)
    const queue = getRoomQueue(roomCode)
    
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: {
            players: {
              include: {
                profile: true
              }
            }
          }
        })
        if (!room || room.status !== 'PLAYING') return

        const session = await prisma.multiplayerGameSession.findUnique({
          where: { roomId: room.id }
        })
        if (!session || session.status !== 'PLAYING') return

        const currentTurnUserId = session.currentTurn
        if (!currentTurnUserId) return

        const activePlayers = room.players
          .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
          .slice(0, 2)

        const mappedPlayers = activePlayers.map(p => ({
          userId: p.userId,
          username: p.profile?.username || 'Player'
        }))

        let result: any = null
        let lastMoveApplied: any = null

        if (room.gameSlug === 'dots-boxes') {
          const state = await getDotsBoxesSession(roomCode, room.id, prisma)
          const randomMove = getRandomDotsBoxesMove(state)
          if (randomMove) {
            result = await processDotsBoxesMove(roomCode, room.id, currentTurnUserId, randomMove, mappedPlayers, prisma)
            lastMoveApplied = randomMove
          }
        } else if (room.gameSlug === 'memory') {
          const state = await getMemorySession(roomCode, room.id, prisma)
          if (state && state.cards) {
            if (state.flippedIndices.length === 0) {
              const unmatchedIdxs = state.cards
                .map((c: any, i: number) => ({ c, i }))
                .filter(({ c }: any) => !c.isMatched && !c.isFlipped)
                .map(({ i }: any) => i)
              if (unmatchedIdxs.length >= 2) {
                const card1 = unmatchedIdxs[Math.floor(Math.random() * unmatchedIdxs.length)]
                let res = await processMemoryMove(roomCode, room.id, currentTurnUserId, { cardIndex: card1 }, mappedPlayers, prisma, io)
                lastMoveApplied = { cardIndex: card1 }
                await new Promise(resolve => setTimeout(resolve, 800))
                const unmatchedIdxs2 = res.state.cards
                  .map((c: any, i: number) => ({ c, i }))
                  .filter(({ c }: any) => !c.isMatched && !c.isFlipped)
                  .map(({ i }: any) => i)
                if (unmatchedIdxs2.length > 0) {
                  const card2 = unmatchedIdxs2[Math.floor(Math.random() * unmatchedIdxs2.length)]
                  result = await processMemoryMove(roomCode, room.id, currentTurnUserId, { cardIndex: card2 }, mappedPlayers, prisma, io)
                  lastMoveApplied = { cardIndex: card2 }
                }
              }
            } else if (state.flippedIndices.length === 1) {
              const firstCardIdx = state.flippedIndices[0]
              const unmatchedIdxs = state.cards
                .map((c: any, i: number) => ({ c, i }))
                .filter(({ c, i }: any) => !c.isMatched && i !== firstCardIdx)
                .map(({ i }: any) => i)
              if (unmatchedIdxs.length > 0) {
                const card2 = unmatchedIdxs[Math.floor(Math.random() * unmatchedIdxs.length)]
                result = await processMemoryMove(roomCode, room.id, currentTurnUserId, { cardIndex: card2 }, mappedPlayers, prisma, io)
                lastMoveApplied = { cardIndex: card2 }
              }
            }
          }
        } else if (room.gameSlug === 'rps') {
          const state = await getRpsSession(roomCode, room.id, prisma)
          if (state && state.stage !== 'FINISHED') {
            const choices = ['rock', 'paper', 'scissors']
            const p1 = mappedPlayers[0]
            const p2 = mappedPlayers[1]
            let p1Choice = state.moves?.[p1.userId]
            let p2Choice = state.moves?.[p2.userId]

            if (!p1Choice) {
              const r1 = choices[Math.floor(Math.random() * 3)] as any
              logger.info(`[RPS TIMEOUT] player1=${p1.username} auto-move=${r1}`)
              let res = await processRpsMove(roomCode, room.id, p1.userId, { choice: r1 }, mappedPlayers, prisma)
              result = res
              p1Choice = r1
            }

            if (!p2Choice) {
              const r2 = choices[Math.floor(Math.random() * 3)] as any
              logger.info(`[RPS TIMEOUT] player2=${p2.username} auto-move=${r2}`)
              let res = await processRpsMove(roomCode, room.id, p2.userId, { choice: r2 }, mappedPlayers, prisma)
              result = res
            }
            lastMoveApplied = { isAutoMove: true }
          }
        } else if (room.gameSlug === 'number-guessing') {
          const state = await getNumberGuessingSession(roomCode, room.id, prisma)
          if (state && state.stage !== 'FINISHED') {
            const minBound = state.minBound || 1
            const maxBound = state.maxBound || 100
            const randomGuess = Math.floor(Math.random() * (maxBound - minBound + 1)) + minBound
            logger.info(`[NUMBER GUESS TIMEOUT] activePlayer=${currentTurnUserId} auto-guess=${randomGuess}`)
            result = await processNumberGuessingMove(roomCode, room.id, currentTurnUserId, { guess: randomGuess }, mappedPlayers, prisma)
            lastMoveApplied = { guess: randomGuess }
          }
        } else if (room.gameSlug === 'hangman') {
          const state = await getHangmanSession(roomCode, room.id, prisma)
          if (state && state.stage === 'PLAYING') {
            const isP1 = currentTurnUserId === state.p1Id
            const opponentUserId = isP1 ? state.p2Id : state.p1Id

            // Deduct life
            if (isP1) {
              state.p1Lives--
            } else {
              state.p2Lives--
            }

            // Log timeout message to commentary
            if (!state.commentary) state.commentary = []
            state.commentary.unshift(`⏰ Time Out! ${isP1 ? state.p1Username || 'Player 1' : state.p2Username || 'Player 2'} lost 1 life due to inactivity.`)

            // Check if lives run out
            const livesOut = isP1 ? state.p1Lives <= 0 : state.p2Lives <= 0
            let gameFinished = false
            let winnerId = null

            if (livesOut) {
              gameFinished = true
              winnerId = opponentUserId
              state.stage = 'FINISHED'
              state.winnerId = winnerId
              state.currentTurn = null
              state.turnExpiration = null
              await deleteHangmanSession(roomCode)
            } else {
              // Switch turn
              state.currentTurn = opponentUserId
              state.turnExpiration = new Date(Date.now() + 60000).toISOString()
            }

            // Persist the updated state
            await saveHangmanSession(roomCode, state)
            await prisma.multiplayerGameSession.update({
              where: { roomId: room.id },
              data: {
                gameState: state,
                status: gameFinished ? 'FINISHED' : 'PLAYING'
              }
            })

            result = {
              state,
              gameFinished,
              winnerId
            }
            lastMoveApplied = { type: 'TIMEOUT' }
          }
        }

        if (result) {
          const { state, gameFinished, winnerId } = result

          if (room.gameSlug === 'scribble' || room.gameSlug === 'hangman') {
            // Asymmetric broadcasts for private word states
            for (const player of room.players) {
              const socketId = userSockets.get(player.userId)
              if (socketId) {
                const playerMaskedState = room.gameSlug === 'scribble'
                  ? getScribbleMaskedState(state, player.userId)
                  : getMaskedHangmanState(state, player.userId)
                io.to(socketId).emit('game-update', {
                  gameState: playerMaskedState,
                  gameFinished,
                  winnerId,
                  lastMove: { userId: currentTurnUserId, move: lastMoveApplied, isAutoMove: true },
                  serverTime: Date.now()
                })
              }
            }
          } else {
            let broadcastState = state
            if (room.gameSlug === 'rps' && state.moves && Object.keys(state.moves).length > 0) {
              broadcastState = getMaskedRpsState(state)
            } else if (room.gameSlug === 'number-guessing') {
              broadcastState = getMaskedNumberGuessingState(state)
            }

            io.to(`game:${roomCode}`).emit('game-update', {
              gameState: broadcastState,
              gameFinished,
              winnerId,
              lastMove: { userId: currentTurnUserId, move: lastMoveApplied, isAutoMove: true },
              serverTime: Date.now()
            })
          }

          if (gameFinished) {
            await handleMatchCompletion(room, state, winnerId, prisma)
            deleteRoomQueue(roomCode)
            clearTurnTimer(roomCode)
          } else {
            startTurnTimer(roomCode)
          }
        }
      } catch (err: any) {
        logger.error(`[TURN TIMEOUT ERROR] roomCode=${roomCode} error=${err.message}`)
      }
    }).catch(err => {
      logger.error(`[TURN TIMEOUT QUEUE ERROR] roomCode=${roomCode} error=${err.message}`)
    })
  }, process.env.TEST_FAST_TIMEOUT === 'true' ? 2000 : 60000) // 60s turn timer

  roomTurnTimeouts.set(roomCode, timeout)
}

// Health check endpoint
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok'
  let redisStatus = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    dbStatus = 'error'
  }

  if (!redisClient.isReady) {
    redisStatus = 'error'
  }

  res.json({
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    database: dbStatus,
    redis: redisStatus,
    activeConnections: io.engine.clientsCount
  })
})

// Bind local JWT auth middleware
io.use(socketAuthMiddleware)

// Setup Redis Adapter for horizontal scalability if Redis is connected
connectRedis().then(() => {
  if (redisClient.isReady) {
    const pubClient = redisClient.duplicate()
    const subClient = redisClient.duplicate()
    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient))
      logger.info('🔌 Redis adapter integrated for horizontal scaling.')
    }).catch(err => {
      logger.error({ err }, 'Failed to configure Redis Adapter')
    })
  }
})

// Socket Connection Handler
io.on('connection', async (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket
  const user = socket.data.user
  if (!user) {
    logger.warn('Socket connected without user auth data, disconnecting...')
    socket.disconnect()
    return
  }

  const { userId, username } = user
  logger.info(`[+] Connected: userId=${userId} socketId=${socket.id} (${username})`)

  // Register socket mappings
  userSockets.set(userId, socket.id)
  setUserPresence(userId, 'ONLINE').catch(err => logError(err, { userId }))
  presenceStore.set(userId, { status: 'ONLINE', lastSeenAt: new Date().toISOString() })
  io.emit('presence-change', { userId, status: 'ONLINE', lastSeenAt: new Date().toISOString() })

  // Check if player is returning from a disconnect grace period
  if (disconnectTimers.has(userId)) {
    logger.info(`[RECONNECT RECOVERY] User reconnected within grace period: ${username} (${userId})`)
    clearTimeout(disconnectTimers.get(userId)!)
    disconnectTimers.delete(userId)
    recordReconnectSuccess()

    // Restore status in active room player profiles and re-join socket rooms (non-blocking)
    prisma.multiplayerRoomPlayer.findMany({
      where: { userId, NOT: { status: 'LEFT' } },
      include: { room: { include: { players: true } } }
    }).then(async (profiles: any) => {
      let validationPassed = true
      
      for (const p of profiles) {
        const room = p.room
        
        // 1. Verify room still exists in DB
        if (!room) {
          logger.warn(`[RECONNECT VALIDATION FAILED] Room does not exist for player ${userId}`)
          validationPassed = false
          break
        }
        
        // 2. Verify player was previously part of that room (p exists)
        // 3. Verify room status allows reconnection (WAITING, STARTING, PLAYING)
        const allowedStatuses = ['WAITING', 'STARTING', 'PLAYING']
        if (!allowedStatuses.includes(room.status)) {
          logger.warn(`[RECONNECT VALIDATION FAILED] Room status ${room.status} does not allow reconnection`)
          validationPassed = false
          break
        }
        
        // 4. Prevent duplicate player entries: check if there is already another socket with active connection for this userId
        const existingSocketId = userSockets.get(userId)
        if (existingSocketId && existingSocketId !== socket.id) {
          const sockets = await io.in(existingSocketId).fetchSockets()
          if (sockets.length > 0) {
            logger.warn(`[RECONNECT VALIDATION FAILED] Duplicate entry detected for player ${userId}`)
            validationPassed = false
            break
          }
        }
      }

      if (!validationPassed || profiles.length === 0) {
        logger.warn(`[RECONNECT RECOVERY] Validation failed, emitting reconnect-failed for user=${userId}`)
        socket.emit('reconnect-failed')
        return
      }

      // Restore status: set disconnectedAt to null
      await prisma.multiplayerRoomPlayer.updateMany({
        where: { userId, NOT: { status: 'LEFT' } },
        data: { disconnectedAt: null }
      })

      // Re-join socket to rooms and broadcast recovery
      for (const p of profiles) {
        if (p.room) {
          const roomCode = p.room.roomCode
          socket.join(`room:${roomCode}`)
          if (p.room.status === 'PLAYING') {
            socket.join(`game:${roomCode}`)
          }
          io.to(`room:${roomCode}`).emit('player-reconnected', { userId })
          io.to(`game:${roomCode}`).emit('player-reconnected', { userId })
          await broadcastRoomUpdate(roomCode)
          logger.info(`[RECONNECT RECOVERY] Re-joined roomCode=${roomCode} and broadcast recovery`)
        }
      }
    }).catch((err: any) => {
      logError(err, { userId })
      socket.emit('reconnect-failed')
    })
  }

  // Heartbeat ping keepalive updates presence state in Redis
  socket.on('heartbeat', async () => {
    await setUserPresence(userId, 'ONLINE')
    presenceStore.set(userId, { status: 'ONLINE', lastSeenAt: new Date().toISOString() })
    prisma.profile.update({
      where: { userId },
      data: { lastSeenAt: new Date() }
    }).catch((err: any) => logError(err, { userId }))
  })

  socket.on('ping-latency', (callback?: any) => {
    if (typeof callback === 'function') callback()
  })

  // Manual status presence updates (ONLINE, AWAY, OFFLINE)
  socket.on('presence-update', async ({ status }: { status: 'ONLINE' | 'AWAY' | 'OFFLINE' }) => {
    await setUserPresence(userId, status as any)
    presenceStore.set(userId, { status, lastSeenAt: new Date().toISOString() })
    io.emit('presence-change', { userId, status, lastSeenAt: new Date().toISOString() })
    prisma.profile.update({
      where: { userId },
      data: { lastSeenAt: new Date() }
    }).catch((err: any) => logError(err, { userId }))
  })

  // ─── LOBBY EVENTS ──────────────────────────────────────────────────────────

  // Create Room
  socket.on('create-room', async (
    { gameSlug, maxPlayers }: { gameSlug: string; maxPlayers?: number },
    callback: (res: { roomCode?: string; error?: string }) => void
  ) => {
    if (!(await checkRateLimit(socket, createRoomLimiter, 'create-room', callback))) return

    try {
      // Generate a unique 6-character room code
      let roomCode = ''
      let isUnique = false
      let attempts = 0
      while (!isUnique && attempts < 50) {
        roomCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        const existing = await prisma.multiplayerRoom.findUnique({ where: { roomCode } })
        if (!existing) isUnique = true
        attempts++
      }

      if (!isUnique) throw new Error('Failed to generate unique room code')

      const room = await prisma.multiplayerRoom.create({
        data: {
          roomCode,
          gameSlug,
          hostUserId: userId,
          maxPlayers: maxPlayers ?? 4,
          status: 'WAITING',
          players: {
            create: {
              userId,
              status: 'NOT_READY'
            }
          }
        }
      })

      socket.join(`room:${roomCode}`)
      callback({ roomCode })
      logger.info(`[ROOM CREATED] code=${roomCode} host=${username} game=${gameSlug}`)
    } catch (err: any) {
      logError(err, { userId, gameSlug })
      callback({ error: err.message || 'Failed to create room' })
    }
  })

  // Join Room
  socket.on('join-room', async (
    { roomCode }: { roomCode: string },
    callback: (res: { success?: boolean; error?: string; gameSlug?: string }) => void
  ) => {
    if (!(await checkRateLimit(socket, joinRoomLimiter, 'join-room', callback))) return

    try {
      const normalizedCode = roomCode.trim().toUpperCase()
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode: normalizedCode },
        include: { players: true }
      })

      if (!room) return callback({ error: 'Room not found' })
      if (room.status !== 'WAITING') return callback({ error: 'Game already started' })
      const existingPlayer = room.players.find(p => p.userId === userId)
      if (!existingPlayer && room.players.length >= room.maxPlayers) {
        return callback({ error: 'Room is full' })
      }

      if (!existingPlayer) {
        await prisma.multiplayerRoomPlayer.create({
          data: {
            roomId: room.id,
            userId,
            status: 'NOT_READY'
          }
        })
      } else {
        // Reset status if they previously left/disconnected, otherwise preserve ready state
        const nextStatus = existingPlayer.status === 'LEFT' ? 'NOT_READY' : existingPlayer.status
        await prisma.multiplayerRoomPlayer.update({
          where: { id: existingPlayer.id },
          data: { status: nextStatus, disconnectedAt: null }
        })
      }

      socket.join(`room:${normalizedCode}`)
      callback({ success: true, gameSlug: room.gameSlug })

      // Broadcast updated player list
      await broadcastRoomUpdate(normalizedCode)
      logger.info(`[ROOM JOINED] code=${normalizedCode} user=${username}`)
    } catch (err: any) {
      logError(err, { userId, roomCode })
      callback({ error: err.message || 'Failed to join room' })
    }
  })

  // Toggle Ready Status
  socket.on('toggle-ready', async ({ roomId }: { roomId: string }, callback?: any) => {
    console.log(`[SOCKET DEBUG] toggle-ready received: roomId=${roomId}, userId=${userId}`)
    try {
      const player = await prisma.multiplayerRoomPlayer.findUnique({
        where: { roomId_userId: { roomId, userId } },
        include: { room: true }
      })

      if (!player) throw new Error('Player profile not found in room')

      const nextStatus = player.status === 'READY' ? 'NOT_READY' : 'READY'
      await prisma.multiplayerRoomPlayer.update({
        where: { id: player.id },
        data: { status: nextStatus }
      })

      await broadcastRoomUpdate(player.room.roomCode)
      if (callback) callback({ success: true })
    } catch (err: any) {
      logError(err, { userId, roomId })
      if (callback) callback({ error: err.message })
    }
  })

  // Leave Room
  socket.on('leave-room', async ({ roomId }: { roomId: string }, callback?: any) => {
    try {
      const player = await prisma.multiplayerRoomPlayer.findUnique({
        where: { roomId_userId: { roomId, userId } },
        include: { room: true }
      })

      if (!player) {
        if (callback) callback({ success: true })
        return
      }

      const roomCode = player.room.roomCode
      socket.leave(`room:${roomCode}`)

      // Delete player record
      await prisma.multiplayerRoomPlayer.delete({ where: { id: player.id } })

      // Fetch remaining players
      const remaining = await prisma.multiplayerRoomPlayer.findMany({
        where: { roomId },
        orderBy: { joinedAt: 'asc' }
      })

      if (remaining.length === 0) {
        const playerUserIds = [userId]
        if (await canDestroyRoom(roomCode, playerUserIds)) {
          // Clean up empty room and session
          await prisma.multiplayerRoom.delete({ where: { id: roomId } })
          deleteRoomQueue(roomCode)
          clearTurnTimer(roomCode)
          await deleteCricketSession(roomCode)
          await deleteDotsBoxesSession(roomCode)
          await deleteMemorySession(roomCode)
          await deleteRpsSession(roomCode)
          await deleteNumberGuessingSession(roomCode)
          logger.info(`[ROOM CLOSED] Empty room cleaned up: ${roomCode}`)
        }
      } else {
        // If host left, perform host migration
        if (player.room.hostUserId === userId) {
          await handleHostMigration(roomId, userId, roomCode)
        }

        await broadcastRoomUpdate(roomCode)
      }

      if (callback) callback({ success: true })
    } catch (err: any) {
      logError(err, { userId, roomId })
      if (callback) callback({ error: err.message })
    }
  })

  // ─── PARTY EVENTS ──────────────────────────────────────────────────────────

  // Create Party
  socket.on('party-create', (callback: (res: { partyCode?: string; error?: string }) => void) => {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const newParty: PartyState = {
        partyCode: code,
        members: [{
          userId,
          username,
          socketId: socket.id,
          role: 'LEADER'
        }]
      }
      parties.set(code, newParty)
      userParty.set(userId, code)
      socket.join(`party:${code}`)
      callback({ partyCode: code })
      logger.info(`[PARTY CREATED] code=${code} leader=${username}`)
    } catch (err: any) {
      callback({ error: err.message || 'Failed to create party' })
    }
  })

  // Join Party
  socket.on('party-join', ({ partyCode }: { partyCode: string }, callback: (res: { success?: boolean; error?: string; party?: PartyState }) => void) => {
    try {
      const code = partyCode.trim().toUpperCase()
      const party = parties.get(code)
      if (!party) {
        return callback({ error: 'Party not found' })
      }

      // Check if already in this party
      if (party.members.some(m => m.userId === userId)) {
        return callback({ success: true, party })
      }

      // If in another party, leave it first
      const currentCode = userParty.get(userId)
      if (currentCode) {
        const p = parties.get(currentCode)
        if (p) {
          p.members = p.members.filter(m => m.userId !== userId)
          socket.leave(`party:${currentCode}`)
          if (p.members.length === 0) {
            parties.delete(currentCode)
          } else {
            const wasLeader = !p.members.some(m => m.role === 'LEADER')
            if (wasLeader && p.members.length > 0) {
              p.members[0].role = 'LEADER'
            }
            io.to(`party:${currentCode}`).emit('party-updated', p)
          }
        }
        userParty.delete(userId)
      }

      // Add to new party
      const newMember: PartyMember = {
        userId,
        username,
        socketId: socket.id,
        role: 'MEMBER'
      }
      party.members.push(newMember)
      userParty.set(userId, code)
      socket.join(`party:${code}`)

      callback({ success: true, party })
      io.to(`party:${code}`).emit('party-updated', party)
      logger.info(`[PARTY JOINED] code=${code} member=${username}`)
    } catch (err: any) {
      callback({ error: err.message || 'Failed to join party' })
    }
  })

  // Leave Party
  socket.on('party-leave', (callback?: (res: { success?: boolean; error?: string }) => void) => {
    try {
      const code = userParty.get(userId)
      if (!code) {
        if (callback) callback({ success: true })
        return
      }

      const party = parties.get(code)
      if (party) {
        party.members = party.members.filter(m => m.userId !== userId)
        socket.leave(`party:${code}`)

        if (party.members.length === 0) {
          parties.delete(code)
          logger.info(`[PARTY CLOSED] Empty party cleaned up: ${code}`)
        } else {
          const hasLeader = party.members.some(m => m.role === 'LEADER')
          if (!hasLeader && party.members.length > 0) {
            party.members[0].role = 'LEADER'
          }
          io.to(`party:${code}`).emit('party-updated', party)
        }
      }

      userParty.delete(userId)
      if (callback) callback({ success: true })
      logger.info(`[PARTY LEFT] code=${code} member=${username}`)
    } catch (err: any) {
      if (callback) callback({ error: err.message || 'Failed to leave party' })
    }
  })

  // Invite to Party
  socket.on('party-invite', ({ targetUserId }: { targetUserId: string }, callback: (res: { success?: boolean; error?: string }) => void) => {
    try {
      const code = userParty.get(userId)
      if (!code) {
        return callback({ error: 'You are not in a party' })
      }

      const targetSocketId = userSockets.get(targetUserId)
      if (targetSocketId) {
        io.to(targetSocketId).emit('party-invite-received', {
          partyCode: code,
          inviterUsername: username
        })
      }

      callback({ success: true })
    } catch (err: any) {
      callback({ error: err.message || 'Failed to invite user' })
    }
  })

  // Party Chat
  socket.on('party-chat', ({ message }: { message: string }) => {
    try {
      const code = userParty.get(userId)
      if (!code) return

      io.to(`party:${code}`).emit('party-chat-msg', {
        userId,
        username,
        message,
        timestamp: Date.now()
      })
    } catch (err: any) {
      logger.error(`[PARTY CHAT ERROR] userId=${userId} error=${err.message}`)
    }
  })

  // Party Matchmaking Sync (synced match entry)
  socket.on('party-matchmaking', ({ gameSlug, roomCode }: { gameSlug: string; roomCode: string }, callback?: (res: { success?: boolean; error?: string }) => void) => {
    try {
      const code = userParty.get(userId)
      if (!code) {
        if (callback) callback({ error: 'You are not in a party' })
        return
      }

      const party = parties.get(code)
      if (!party) {
        if (callback) callback({ error: 'Party not found' })
        return
      }

      const member = party.members.find(m => m.userId === userId)
      if (!member || member.role !== 'LEADER') {
        if (callback) callback({ error: 'Only the party leader can initiate matchmaking' })
        return
      }

      // Sync join room event to all party members
      io.to(`party:${code}`).emit('party-matchmaking-sync', { gameSlug, roomCode })
      if (callback) callback({ success: true })
    } catch (err: any) {
      if (callback) callback({ error: err.message || 'Matchmaking sync failed' })
    }
  })

  // Start Game
  socket.on('start-game', async ({ roomId }: { roomId: string }, callback?: any) => {
    try {
      const room = await prisma.multiplayerRoom.findUnique({
        where: { id: roomId },
        include: { players: true }
      })

      if (!room) throw new Error('Room not found')
      if (room.hostUserId !== userId) throw new Error('Only the host can start the game')
      if (room.players.length < 2) throw new Error('Need at least 2 players to start')
      
      let activePlayers = room.players
        .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())

      if (room.gameSlug === 'cricket') {
        const pCount = room.players.length
        if (pCount !== 2 && pCount !== 4 && pCount !== 6) {
          throw new Error('Team Hand Cricket only supports 2, 4, or 6 players. Game cannot start with odd counts.')
        }
      } else if (room.gameSlug === 'scribble') {
        if (room.players.length < 2) {
          throw new Error('Scribble requires at least 2 players to start.')
        }
      } else {
        activePlayers = activePlayers.slice(0, 2)
      }

      const allReady = activePlayers.every(p => p.status === 'READY' || p.userId === room.hostUserId)
      if (!allReady) throw new Error('All players must be ready to start')

      // Set initial game states
      let initialGameState: any = {}
      if (room.gameSlug === 'cricket') {
        initialGameState = INITIAL_STATES['cricket'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'scribble') {
        initialGameState = INITIAL_STATES['scribble'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'dots-boxes') {
        initialGameState = INITIAL_STATES['dots-boxes'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'tic-tac-toe') {
        initialGameState = INITIAL_STATES['tic-tac-toe'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'memory') {
        initialGameState = INITIAL_STATES['memory'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'rps') {
        initialGameState = INITIAL_STATES['rps'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'number-guessing') {
        initialGameState = INITIAL_STATES['number-guessing'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'hangman') {
        initialGameState = INITIAL_STATES['hangman'](activePlayers, room.hostUserId)
      } else {
        throw new Error('Unsupported game slug')
      }

      // Update room status
      await prisma.multiplayerRoom.update({
        where: { id: roomId },
        data: { status: 'STARTING' }
      })

      // Create active game session in DB
      await prisma.multiplayerGameSession.upsert({
        where: { roomId },
        create: {
          roomId,
          gameSlug: room.gameSlug,
          status: 'PLAYING',
          gameState: initialGameState,
          currentTurn: initialGameState.currentTurn || null
        },
        update: {
          status: 'PLAYING',
          gameState: initialGameState,
          currentTurn: initialGameState.currentTurn || null
        }
      })

      // Cache game state in Redis
      if (room.gameSlug === 'cricket') {
        await saveCricketSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'scribble') {
        await saveScribbleSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'dots-boxes') {
        await saveDotsBoxesSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'tic-tac-toe') {
        await saveTicTacToeSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'memory') {
        await saveMemorySession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'rps') {
        await saveRpsSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'number-guessing') {
        await saveNumberGuessingSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'hangman') {
        await saveHangmanSession(room.roomCode, initialGameState)
      }

      await broadcastRoomUpdate(room.roomCode)
      io.to(`room:${room.roomCode}`).emit('game-started', { roomCode: room.roomCode })
      
      if (room.gameSlug === 'dots-boxes' || room.gameSlug === 'memory' || room.gameSlug === 'rps' || room.gameSlug === 'number-guessing') {
        startTurnTimer(room.roomCode)
      }
      
      logger.info(`[GAME STARTING] room=${room.roomCode} game=${room.gameSlug}`)
      if (callback) callback({ success: true })
    } catch (err: any) {
      logError(err, { userId, roomId })
      if (callback) callback({ error: err.message })
    }
  })

  // Chat
  socket.on('send-chat', async (
    { roomCode, message }: { roomCode: string; message: string },
    callback?: any
  ) => {
    if (!(await checkRateLimit(socket, sendChatLimiter, 'send-chat', callback))) return

    try {
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode }
      })
      if (!room) throw new Error('Room not found')

      const chatMsg = await prisma.multiplayerChatMessage.create({
        data: {
          roomId: room.id,
          userId,
          message
        },
        include: {
          profile: {
            select: { username: true, avatarUrl: true }
          }
        }
      })

      const packet = {
        id: chatMsg.id,
        userId: chatMsg.userId,
        username: chatMsg.profile.username,
        avatarUrl: chatMsg.profile.avatarUrl,
        message: chatMsg.message,
        createdAt: chatMsg.createdAt
      }

      io.to(`room:${roomCode}`).emit('chat-message', packet)
      if (callback) callback({ success: true })
    } catch (err: any) {
      logError(err, { userId, roomCode })
      if (callback) callback({ error: err.message })
    }
  })

  // ─── GAMEPLAY EVENTS ────────────────────────────────────────────────────────

  // Join Active Game
  socket.on('join-game', async (
    { roomCode }: { roomCode: string },
    callback?: (res: { success?: boolean; error?: string }) => void
  ) => {
    logger.info(`[JOIN-GAME] user=${username} (${userId}) roomCode=${roomCode}`)
    try {
      const normalizedCode = roomCode.trim().toUpperCase()
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode: normalizedCode },
        include: {
          players: {
            include: {
              profile: {
                select: { username: true, avatarUrl: true, level: true, selectedTitle: true, selectedFrame: true }
              }
            },
            orderBy: { joinedAt: 'asc' }
          }
        }
      })

      if (!room) throw new Error('ROOM_NOT_FOUND')
      const isPlayer = room.players.some(p => p.userId === userId)
      if (!isPlayer) throw new Error('PLAYER_NOT_IN_ROOM')

      // Set presence to IN_GAME
      setUserPresence(userId, 'IN_GAME').catch(err => logError(err, { userId }))

      socket.join(`game:${normalizedCode}`)

      // Retrieve cached or database game session
      let gameState = null
      if (room.gameSlug === 'cricket') {
        gameState = await getCricketSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'scribble') {
        gameState = await getScribbleSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'dots-boxes') {
        gameState = await getDotsBoxesSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'tic-tac-toe') {
        gameState = await getTicTacToeSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'memory') {
        gameState = await getMemorySession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'rps') {
        gameState = await getRpsSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'number-guessing') {
        gameState = await getNumberGuessingSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'hangman') {
        gameState = await getHangmanSession(normalizedCode, room.id, prisma).catch(() => null)
      }

      // Send current state
      const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId: room.id }
      })

      let broadcastState = gameState ?? dbSession?.gameState
      if (!broadcastState) throw new Error('SESSION_NOT_FOUND')

      if (callback) callback({ success: true })
      if (room.gameSlug === 'rps' && broadcastState && broadcastState.moves) {
        const maskedMoves: Record<string, string> = {}
        Object.keys(broadcastState.moves).forEach(uid => {
          maskedMoves[uid] = uid === userId ? broadcastState.moves[uid] : 'hidden'
        })
        broadcastState = { ...broadcastState, moves: maskedMoves }
      } else if (room.gameSlug === 'number-guessing' && broadcastState) {
        broadcastState = getMaskedNumberGuessingState(broadcastState)
      } else if (room.gameSlug === 'scribble' && broadcastState) {
        broadcastState = getScribbleMaskedState(broadcastState, userId)
      } else if (room.gameSlug === 'hangman' && broadcastState) {
        broadcastState = getMaskedHangmanState(broadcastState, userId)
      }

      logger.info(`[JOIN-GAME] Sending game-state to ${username}: stage=${broadcastState?.stage} gameSlug=${room.gameSlug}`)

      socket.emit('game-state', {
        room,
        gameSession: {
          ...dbSession,
          gameState: broadcastState
        },
        players: room.players.map(p => ({
          userId: p.userId,
          status: p.disconnectedAt ? 'DISCONNECTED' : p.status,
          username: p.profile?.username || 'Player',
          avatarUrl: p.profile?.avatarUrl || null,
          level: p.profile?.level || 1,
          selectedTitle: p.profile?.selectedTitle || null,
          selectedFrame: p.profile?.selectedFrame || null
        })),
        serverTime: Date.now()
      })

    } catch (err: any) {
      logger.error(`[JOIN-GAME ERROR] user=${username} roomCode=${roomCode} error=${err.message}`)
      logError(err, { userId, roomCode })
      if (callback) callback({ error: err.message })
    }
  })

  // Submit Move (Room-Level Sequential Queue processing)
  socket.on('submit-move', async (
    { roomCode, move }: { roomCode: string; move: any },
    callback?: (res: { success?: boolean; error?: string }) => void
  ) => {
    if (!(await checkRateLimit(socket, submitMoveLimiter, 'submit-move', callback))) return

    const queue = getRoomQueue(roomCode)
    
    // Process move inside the FIFO queue sequentially to prevent race conditions
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: {
            players: {
              include: {
                profile: true
              }
            }
          }
        })

        if (!room) throw new Error('Room not found')
        const isPlayer = room.players.some(p => p.userId === userId)
        if (!isPlayer) throw new Error('Unauthorized move submission')

        // Slicing logic: do not slice for Cricket and Scribble
        let activeRoomPlayers = room.players
          .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
        if (room.gameSlug !== 'cricket' && room.gameSlug !== 'scribble') {
          activeRoomPlayers = activeRoomPlayers.slice(0, 2)
        }
        const mappedPlayers = activeRoomPlayers.map(p => ({
          userId: p.userId,
          username: p.profile?.username || 'Player'
        }))

        let result: any = null

        // Execute engine calculations
        if (room.gameSlug === 'cricket') {
          result = await processCricketMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'scribble') {
          result = await processScribbleMove(roomCode, room.id, userId, move, mappedPlayers, prisma, io)
        } else if (room.gameSlug === 'dots-boxes') {
          result = await processDotsBoxesMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'tic-tac-toe') {
          result = await processTicTacToeMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'memory') {
          result = await processMemoryMove(roomCode, room.id, userId, move, mappedPlayers, prisma, io)
        } else if (room.gameSlug === 'rps') {
          result = await processRpsMove(roomCode, room.id, userId, move, mappedPlayers, prisma, io)
        } else if (room.gameSlug === 'number-guessing') {
          result = await processNumberGuessingMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'hangman') {
          result = await processHangmanMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else {
          throw new Error('Unsupported game engine')
        }

        const { state, gameFinished, winnerId } = result

        // Emit update to all room clients, masking choices if it's RPS and not yet evaluated
        let broadcastState = state
        if (room.gameSlug === 'rps' && state.moves && Object.keys(state.moves).length > 0) {
          broadcastState = getMaskedRpsState(state)
        } else if (room.gameSlug === 'number-guessing') {
          broadcastState = getMaskedNumberGuessingState(state)
        }

        if (room.gameSlug === 'scribble' || room.gameSlug === 'hangman') {
          for (const player of room.players) {
            const pSocketId = userSockets.get(player.userId)
            const targetSocket = player.userId === userId ? socket : (pSocketId ? io.to(pSocketId) : null)
            if (targetSocket) {
              const maskedState = room.gameSlug === 'scribble'
                ? getScribbleMaskedState(state, player.userId)
                : getMaskedHangmanState(state, player.userId)
              targetSocket.emit('game-update', {
                gameState: maskedState,
                gameFinished,
                winnerId,
                lastMove: { userId, move },
                serverTime: Date.now()
              })
            }
          }
        } else {
          io.to(`game:${roomCode}`).emit('game-update', {
            gameState: broadcastState,
            gameFinished,
            winnerId,
            lastMove: { userId, move },
            serverTime: Date.now()
          })
        }

        if (gameFinished) {
          clearTurnTimer(roomCode)
          await handleMatchCompletion(room, state, winnerId, prisma)
          deleteRoomQueue(roomCode)
        } else if (
          room.gameSlug === 'dots-boxes' || 
          room.gameSlug === 'memory' || 
          room.gameSlug === 'rps' || 
          room.gameSlug === 'number-guessing' ||
          (room.gameSlug === 'hangman' && state.stage === 'PLAYING')
        ) {
          startTurnTimer(roomCode)
        }

        if (callback) callback({ success: true })
      } catch (err: any) {
        logError(err, { userId, roomCode, move })
        if (callback) callback({ error: err.message })
      }
    }).catch(err => {
      if (callback) callback({ error: err.message })
    })
  })

  // Vote Replay
  socket.on('vote-replay', async (
    { roomCode }: { roomCode: string },
    callback?: (res: { success?: boolean; error?: string }) => void
  ) => {
    const queue = getRoomQueue(roomCode)
    
    queue.add(async () => {
      try {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode },
          include: { players: { include: { profile: true } } }
        })

        if (!room) throw new Error('Room not found')
        const isPlayer = room.players.some(p => p.userId === userId)
        if (!isPlayer) throw new Error('Unauthorized')

        const session = await prisma.multiplayerGameSession.findUnique({
          where: { roomId: room.id }
        })

        if (!session) throw new Error('Session not found')

        let gameState: any = null
        if (room.gameSlug === 'cricket') {
          gameState = await getCricketSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'dots-boxes') {
          gameState = await getDotsBoxesSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'tic-tac-toe') {
          gameState = await getTicTacToeSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'memory') {
          gameState = await getMemorySession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'rps') {
          gameState = await getRpsSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'number-guessing') {
          gameState = await getNumberGuessingSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'scribble') {
          gameState = await getScribbleSession(roomCode, room.id, prisma)
        }

        if (!gameState) {
          gameState = typeof session.gameState === 'string' ? JSON.parse(session.gameState) : session.gameState
        }

        if (!gameState.replayVotes) {
          gameState.replayVotes = {}
        }

        gameState.replayVotes[userId] = true

        const votesCount = Object.keys(gameState.replayVotes).filter(k => gameState.replayVotes[k] === true).length

        // Determine the two active players (first two by join order)
        const activePlayers = room.players
          .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
          .slice(0, 2)
        const activePlayerIds = activePlayers.map(p => p.userId)

        // Only count votes from active players (not spectators)
        const activeVoteCount = activePlayerIds.filter(id => gameState.replayVotes[id] === true).length

        let updatedStatus = session.status
        let updatedWinnerId = session.winnerId
        let updatedTurn = session.currentTurn
        let finalGameState = gameState

        logger.info(`[VOTE-REPLAY] room=${roomCode} voter=${userId} votesCount=${votesCount} activeVoteCount=${activeVoteCount} activePlayers=${activePlayerIds.join(',')}`)

        if (activeVoteCount >= activePlayers.length) {
          updatedStatus = 'PLAYING'
          updatedWinnerId = null

          if (room.gameSlug === 'cricket') {
            finalGameState = INITIAL_STATES['cricket'](activePlayers, room.hostUserId)
            updatedTurn = null // Toss choice determines roles
            await saveCricketSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'dots-boxes') {
            finalGameState = INITIAL_STATES['dots-boxes'](activePlayers, room.hostUserId)
            updatedTurn = finalGameState.currentTurn
            await saveDotsBoxesSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'tic-tac-toe') {
            finalGameState = INITIAL_STATES['tic-tac-toe'](activePlayers, room.hostUserId)
            updatedTurn = finalGameState.currentTurn
            await saveTicTacToeSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'memory') {
            finalGameState = INITIAL_STATES['memory'](activePlayers, room.hostUserId)
            updatedTurn = finalGameState.currentTurn
            await saveMemorySession(roomCode, finalGameState)
          } else if (room.gameSlug === 'rps') {
            finalGameState = INITIAL_STATES['rps'](activePlayers, room.hostUserId)
            updatedTurn = null
            await saveRpsSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'number-guessing') {
            finalGameState = INITIAL_STATES['number-guessing'](activePlayers, room.hostUserId)
            updatedTurn = finalGameState.currentTurn
            await saveNumberGuessingSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'scribble') {
            await deleteScribbleSession(roomCode)
            finalGameState = INITIAL_STATES['scribble'](activePlayers, room.hostUserId)
            updatedTurn = null
            await saveScribbleSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'hangman') {
            await deleteHangmanSession(roomCode)
            finalGameState = INITIAL_STATES['hangman'](activePlayers, room.hostUserId)
            updatedTurn = finalGameState.currentTurn
            await saveHangmanSession(roomCode, finalGameState)
          }

          logger.info(`[VOTE-REPLAY] room=${roomCode} RESET → fresh board, nextTurn=${updatedTurn}`)

          // Update Room status to STARTING so it gets resolved properly
          await prisma.multiplayerRoom.update({
            where: { id: room.id },
            data: { status: 'STARTING' }
          })
        } else {
          // Warm cache with updated vote state
          if (room.gameSlug === 'cricket') {
            await saveCricketSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'dots-boxes') {
            await saveDotsBoxesSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'tic-tac-toe') {
            await saveTicTacToeSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'memory') {
            await saveMemorySession(roomCode, finalGameState)
          } else if (room.gameSlug === 'rps') {
            await saveRpsSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'number-guessing') {
            await saveNumberGuessingSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'scribble') {
            await saveScribbleSession(roomCode, finalGameState)
          } else if (room.gameSlug === 'hangman') {
            await saveHangmanSession(roomCode, finalGameState)
          }
        }

        const now = new Date()
        await prisma.multiplayerGameSession.update({
          where: { id: session.id },
          data: {
            status: updatedStatus,
            winnerId: updatedWinnerId,
            currentTurn: updatedTurn,
            gameState: finalGameState,
            lastActivityAt: now,
            updatedAt: now
          }
        })

        io.to(`game:${roomCode}`).emit('game-update', {
          gameState: finalGameState,
          gameFinished: updatedStatus === 'FINISHED',
          winnerId: updatedWinnerId,
          lastMove: { userId, type: 'replay_vote' },
          serverTime: Date.now()
        })

        if (activeVoteCount >= activePlayers.length) {
          // Trigger client re-sync after replay reset
          io.to(`game:${roomCode}`).emit('game-started', { roomCode })
        }

        if (callback) callback({ success: true })
      } catch (err: any) {
        logError(err, { userId, roomCode })
        if (callback) callback({ error: err.message })
      }
    }).catch(err => {
      if (callback) callback({ error: err.message })
    })
  })

  // Match Reactions (temporary overlay broadcast)
  socket.on('match-reaction', ({ roomCode, emoji }: { roomCode: string; emoji: string }) => {
    socket.to(`game:${roomCode}`).emit('match-reaction', { userId, emoji })
  })

  // Dedicated Chat Pack message sync
  socket.on('chat-pack-message', ({ roomCode, message, packId }: { roomCode: string; message: string; packId: string }) => {
    socket.to(`game:${roomCode}`).emit('chat-pack-message', {
      playerId: userId,
      message,
      packId,
      timestamp: Date.now()
    })
  })

  // Scribble Canvas Synchronization (real-time broadcast)
  socket.on('scribble-draw', ({ roomCode, drawData }: { roomCode: string; drawData: any }) => {
    socket.to(`game:${roomCode}`).emit('scribble-draw', { drawData })
  })

  socket.on('scribble-clear', ({ roomCode }: { roomCode: string }) => {
    socket.to(`game:${roomCode}`).emit('scribble-clear')
  })

  // Disconnect Handler
  socket.on('disconnect', async () => {
    logger.info(`[-] Disconnected: userId=${userId} socketId=${socket.id}`)
    userSockets.delete(userId)
    await setUserPresence(userId, 'OFFLINE')
    presenceStore.set(userId, { status: 'OFFLINE', lastSeenAt: new Date().toISOString() })
    io.emit('presence-change', { userId, status: 'OFFLINE', lastSeenAt: new Date().toISOString() })

    // Cleanly leave party on disconnect
    const partyCode = userParty.get(userId)
    if (partyCode) {
      const party = parties.get(partyCode)
      if (party) {
        party.members = party.members.filter(m => m.userId !== userId)
        if (party.members.length === 0) {
          parties.delete(partyCode)
        } else {
          const hasLeader = party.members.some(m => m.role === 'LEADER')
          if (!hasLeader && party.members.length > 0) {
            party.members[0].role = 'LEADER'
          }
          io.to(`party:${partyCode}`).emit('party-updated', party)
        }
      }
      userParty.delete(userId)
    }

    recordDisconnect()

    // Determine grace period based on active rooms: 60s for WAITING or PLAYING
    const gracePeriod = 60000

    // Start grace timer for reconnection
    const timer = setTimeout(async () => {
      disconnectTimers.delete(userId)
      logger.info(`[GRACE PERIOD EXPIRED] Player abandoned connection: ${username} (${userId})`)

      try {
        // Find if player is in any active rooms
        const activeRooms = await prisma.multiplayerRoomPlayer.findMany({
          where: { userId, NOT: { status: 'LEFT' } },
          include: { room: true }
        })

        for (const playerProfile of activeRooms) {
          const room = playerProfile.room
          if (!room) continue
          const roomId = room.id
          const roomCode = room.roomCode

          if (room.status === 'PLAYING') {
            // Player abandoned active game
            const remainingPlayers = await prisma.multiplayerRoomPlayer.findMany({
              where: { roomId, NOT: { userId } },
              include: { profile: { select: { username: true } } }
            })

            const remainingUserIds = remainingPlayers.map(p => p.userId)

            // Game specific disconnect rules
            if (room.gameSlug === 'cricket') {
              const state = await getCricketSession(roomCode, roomId, prisma).catch(() => null)
              if (state && state.teams) {
                // Captain transfer
                for (const teamKey of ['BLUE', 'GREEN'] as const) {
                  const team = state.teams[teamKey]
                  if (team.captain === userId) {
                    const nextTeammate = team.players.find((id: string) => id !== userId && remainingUserIds.includes(id))
                    if (nextTeammate) {
                      team.captain = nextTeammate
                      state.commentary.unshift(`👑 Captain disconnected. ${remainingPlayers.find(p => p.userId === nextTeammate)?.profile?.username || 'Teammate'} is promoted to Captain!`)
                      await prisma.multiplayerGameSession.update({
                        where: { roomId },
                        data: { gameState: state }
                      })
                      await saveCricketSession(roomCode, state)
                      io.to(`game:${roomCode}`).emit('game-update', {
                        gameState: state,
                        gameFinished: false,
                        winnerId: null
                      })
                    }
                  }
                }

                // Check if their team has no players left
                const isBlue = state.teams['BLUE'].players.includes(userId)
                const myTeamKey = isBlue ? 'BLUE' : 'GREEN'
                const opponentTeamKey = isBlue ? 'GREEN' : 'BLUE'
                const myTeamRemaining = state.teams[myTeamKey].players.filter((id: string) => remainingUserIds.includes(id))
                
                if (myTeamRemaining.length === 0) {
                  const opponentCaptainId = state.teams[opponentTeamKey].captain || opponentTeamKey
                  logger.info(`[FORFEIT MATCH] Cricket room=${roomCode} team=${myTeamKey} empty. Winner=${opponentTeamKey}`)
                  
                  clearTurnTimer(roomCode)
                  state.stage = 'FINISHED'
                  state.commentary.unshift(`🔴 Forfeit! All members of ${myTeamKey === 'BLUE' ? 'Blue Team' : 'Green Team'} disconnected.`)
                  
                  await prisma.multiplayerGameSession.update({
                    where: { roomId },
                    data: {
                      status: 'FINISHED',
                      winnerId: opponentCaptainId,
                      gameState: state
                    }
                  })
                  await prisma.multiplayerRoom.update({
                    where: { id: roomId },
                    data: { status: 'FINISHED' }
                  })
                  io.to(`game:${roomCode}`).emit('game-update', {
                    gameFinished: true,
                    winnerId: opponentCaptainId,
                    gameState: state
                  })

                  const playerUserIds = remainingPlayers.map(p => p.userId).concat(userId)
                  if (await canDestroyRoom(roomCode, playerUserIds)) {
                    await prisma.multiplayerRoom.delete({ where: { id: roomId } })
                    deleteRoomQueue(roomCode)
                    clearTurnTimer(roomCode)
                    await deleteCricketSession(roomCode)
                  }
                }
                continue
              }
            } else if (room.gameSlug === 'scribble') {
              const state = await getScribbleSession(roomCode, roomId, prisma).catch(() => null)
              if (state) {
                if (remainingPlayers.length >= 2) {
                  if (state.drawerId === userId && state.stage === 'DRAWING') {
                    state.commentary.unshift(`⚠️ Drawer ${username} disconnected! Skipping turn...`)
                    await endScribbleRound(roomCode, roomId, state, remainingPlayers, prisma, io, true)
                  } else if (state.drawerId === userId && state.stage === 'WORD_SELECTION') {
                    state.commentary.unshift(`⚠️ Drawer ${username} disconnected during word selection! Skipping turn...`)
                    await setupNextScribbleTurn(roomCode, roomId, state, remainingPlayers, prisma, io)
                  } else {
                    state.commentary.unshift(`👋 Player ${username} disconnected.`)
                    await saveScribbleSession(roomCode, state)
                    
                    for (const player of remainingPlayers) {
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
                } else {
                  const winnerId = remainingPlayers[0]?.userId || 'DRAW'
                  clearTurnTimer(roomCode)
                  clearScribbleInactivityCheck(roomCode)
                  
                  await prisma.multiplayerGameSession.update({
                    where: { roomId },
                    data: {
                      status: 'FINISHED',
                      winnerId,
                      gameState: { stage: 'FINISHED', commentary: [`🔴 Forfeit! Fewer than 2 players left.`] }
                    }
                  })
                  await prisma.multiplayerRoom.update({
                    where: { id: roomId },
                    data: { status: 'FINISHED' }
                  })
                  io.to(`game:${roomCode}`).emit('game-update', {
                    gameFinished: true,
                    winnerId,
                    gameState: { stage: 'FINISHED', commentary: [`Forfeit! Fewer than 2 players left.`] }
                  })

                  const playerUserIds = remainingPlayers.map(p => p.userId).concat(userId)
                  if (await canDestroyRoom(roomCode, playerUserIds)) {
                    await prisma.multiplayerRoom.delete({ where: { id: roomId } })
                    deleteRoomQueue(roomCode)
                    clearTurnTimer(roomCode)
                    await deleteScribbleSession(roomCode)
                  }
                }
                continue
              }
            }

            // Default 1v1 forfeit logic
            const opponentId = remainingPlayers[0]?.userId || null
            logger.info(`[FORFEIT MATCH] room=${roomCode} user=${username} forfeited to winnerId=${opponentId}`)

            clearTurnTimer(roomCode)

            // Update Game Session
            await prisma.multiplayerGameSession.update({
              where: { roomId },
              data: {
                status: 'FINISHED',
                winnerId: opponentId ?? 'DRAW',
                gameState: { stage: 'FINISHED', commentary: [`🔴 Forfeit! Player ${username} disconnected.`] }
              }
            })

            // Update Room Status
            await prisma.multiplayerRoom.update({
              where: { id: roomId },
              data: { status: 'FINISHED' }
            })

            io.to(`game:${roomCode}`).emit('game-update', {
              gameFinished: true,
              winnerId: opponentId ?? 'DRAW',
              gameState: { stage: 'FINISHED', commentary: [`Forfeit! Player ${username} disconnected.`] }
            })

            const playerUserIds = remainingPlayers.map(p => p.userId).concat(userId)
            if (await canDestroyRoom(roomCode, playerUserIds)) {
              await prisma.multiplayerRoom.delete({ where: { id: roomId } })
              deleteRoomQueue(roomCode)
              clearTurnTimer(roomCode)
              await deleteCricketSession(roomCode)
              await deleteDotsBoxesSession(roomCode)
              await deleteMemorySession(roomCode)
              await deleteRpsSession(roomCode)
              await deleteNumberGuessingSession(roomCode)
              await deleteScribbleSession(roomCode)
              logger.info(`[ROOM CLOSED] Empty room cleaned up: ${roomCode}`)
            }

          } else if (room.status === 'WAITING') {
            // Player abandoned waiting lobby -> Clean remove
            await prisma.multiplayerRoomPlayer.delete({
              where: { id: playerProfile.id }
            })

            const remaining = await prisma.multiplayerRoomPlayer.findMany({
              where: { roomId },
              orderBy: { joinedAt: 'asc' }
            })

            if (remaining.length === 0) {
              const playerUserIds = [userId]
              if (await canDestroyRoom(roomCode, playerUserIds)) {
                await prisma.multiplayerRoom.delete({ where: { id: roomId } })
                logger.info(`[ROOM CLOSED] Empty room cleaned up: ${roomCode}`)
              }
            } else {
              if (room.hostUserId === userId) {
                await handleHostMigration(roomId, userId, roomCode)
              }
              await broadcastRoomUpdate(roomCode)
            }
          }
        }
      } catch (err: any) {
        logError(err, { userId })
      }
    }, gracePeriod)

    disconnectTimers.set(userId, timer)

    // Mark status as DISCONNECTED in database during grace period (only for active rooms)
    try {
      await prisma.multiplayerRoomPlayer.updateMany({
        where: { userId, NOT: { status: 'LEFT' } },
        data: { disconnectedAt: new Date() }
      })

      // Broadcast disconnection alert to rooms
      const userRooms = await prisma.multiplayerRoomPlayer.findMany({
        where: { userId },
        include: { room: true }
      })

      for (const p of userRooms) {
        if (p.room) {
          io.to(`room:${p.room.roomCode}`).emit('player-disconnected', { userId })
          io.to(`game:${p.room.roomCode}`).emit('player-disconnected', { userId })
          await broadcastRoomUpdate(p.room.roomCode)
        }
      }
    } catch (err: any) {
      logError(err, { userId })
    }
  })
})

/**
 * Helper to handle host migration and emit HOST_TRANSFERRED to all players
 */
async function handleHostMigration(roomId: string, currentHostId: string, roomCode: string) {
  try {
    const remaining = await prisma.multiplayerRoomPlayer.findMany({
      where: { roomId, NOT: { userId: currentHostId } },
      include: { profile: { select: { username: true } } },
      orderBy: { joinedAt: 'asc' }
    })

    if (remaining.length > 0) {
      const newHost = remaining[0]
      await prisma.multiplayerRoom.update({
        where: { id: roomId },
        data: { hostUserId: newHost.userId }
      })

      logger.info(`[HOST MIGRATED] room=${roomCode} newHost=${newHost.userId}`)
      
      // Broadcast HOST_TRANSFERRED events
      io.to(`room:${roomCode}`).emit('host-transferred', {
        newHostId: newHost.userId,
        newHostUsername: newHost.profile?.username || 'Player'
      })
      io.to(`game:${roomCode}`).emit('host-transferred', {
        newHostId: newHost.userId,
        newHostUsername: newHost.profile?.username || 'Player'
      })
    }
  } catch (err: any) {
    logError(err, { roomId, currentHostId, context: 'host-migration' })
  }
}

/**
 * GC Safety: checks if a room can be safely destroyed
 */
async function canDestroyRoom(roomCode: string, playerUserIds: string[]): Promise<boolean> {
  // 1. Verify no connected sockets remain in the room
  const socketsInRoom = await io.in(`room:${roomCode}`).fetchSockets()
  if (socketsInRoom.length > 0) {
    logger.info(`[GC SAFETY] Cannot delete room ${roomCode}: ${socketsInRoom.length} connected sockets remain.`)
    return false
  }

  // 2. Verify no reconnect grace timer is active for any player
  for (const userId of playerUserIds) {
    if (disconnectTimers.has(userId)) {
      logger.info(`[GC SAFETY] Cannot delete room ${roomCode}: Reconnect grace timer is active for user ${userId}.`)
      return false
    }
  }

  return true
}

/**
 * Fetch room data and broadcast it to all connections in room
 */
async function broadcastRoomUpdate(roomCode: string) {
  try {
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: {
        players: {
          include: {
            profile: {
              select: { username: true, avatarUrl: true, level: true, selectedTitle: true, selectedFrame: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    })

    if (!room) return

    const playersData = room.players.map(p => ({
      userId: p.userId,
      status: p.disconnectedAt ? 'DISCONNECTED' : p.status,
      joinedAt: p.joinedAt,
      username: p.profile.username,
      avatarUrl: p.profile.avatarUrl,
      level: p.profile.level,
      selectedTitle: p.profile.selectedTitle,
      selectedFrame: p.profile.selectedFrame
    }))

    io.to(`room:${roomCode}`).emit('room-update', {
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameSlug: room.gameSlug,
        hostUserId: room.hostUserId,
        status: room.status,
        maxPlayers: room.maxPlayers
      },
      players: playersData
    })
  } catch (err: any) {
    logError(err, { roomCode })
  }
}

/**
 * Starts a background loop to reconcile active game states from cache/Redis to PostgreSQL
 * to ensure that no game state is lost if asynchronous move snapshots fail.
 */
function startReconciliationLoop() {
  setInterval(async () => {
    try {
      const activeRooms = await prisma.multiplayerRoom.findMany({
        where: { status: 'PLAYING' }
      })

      if (activeRooms.length === 0) return

      logger.info(`[RECONCILIATION] Starting sync for ${activeRooms.length} active games.`)

      for (const room of activeRooms) {
        try {
          let gameState: any = null

          if (room.gameSlug === 'cricket') {
            gameState = await getCricketSession(room.roomCode, room.id, prisma)
          } else if (room.gameSlug === 'dots-boxes') {
            gameState = await getDotsBoxesSession(room.roomCode, room.id, prisma)
          } else if (room.gameSlug === 'tic-tac-toe') {
            gameState = await getTicTacToeSession(room.roomCode, room.id, prisma)
          } else if (room.gameSlug === 'memory') {
            gameState = await getMemorySession(room.roomCode, room.id, prisma)
          } else if (room.gameSlug === 'rps') {
            gameState = await getRpsSession(room.roomCode, room.id, prisma)
          } else if (room.gameSlug === 'number-guessing') {
            gameState = await getNumberGuessingSession(room.roomCode, room.id, prisma)
          }

          if (gameState) {
            const winnerId = gameState.winnerId || null
            const currentTurn = gameState.currentTurn || null
            await prisma.multiplayerGameSession.update({
              where: { roomId: room.id },
              data: {
                gameState,
                winnerId,
                currentTurn,
                lastActivityAt: new Date()
              }
            })
          }
        } catch (err: any) {
          logError(err, { roomCode: room.roomCode, context: 'reconciliation-room' })
        }
      }
    } catch (err: any) {
      logError(err, { context: 'reconciliation-loop' })
    }
  }, 30000) // Reconcile every 30 seconds
}

// Start Observability Metrics reporting loop
startMetricsReporting(io)

// Start active game state reconciliation loop
startReconciliationLoop()

// Start Server
const PORT = parseInt(process.env.PORT || '5000', 10)
server.listen(PORT, () => {
  logger.info(`🎮 GameHub Socket.IO server → http://localhost:${PORT}`)
})
