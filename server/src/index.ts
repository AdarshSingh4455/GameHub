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
import { processDotsBoxesMove, deleteDotsBoxesSession, getDotsBoxesSession, saveDotsBoxesSession } from './games/dotsBoxes'
import { processTicTacToeMove, deleteTicTacToeSession, getTicTacToeSession, saveTicTacToeSession } from './games/ticTacToe'
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
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket'] // Enforce WebSocket-only transport for horizontal scaling compatibility
})

// Initialize Prisma Client connection pool using PostgreSQL adapter
const connectionString = process.env.DATABASE_URL
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Connection tracking maps
const userSockets = new Map<string, string>() // maps userId -> socketId
const disconnectTimers = new Map<string, NodeJS.Timeout>() // maps userId -> Timeout

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
        // Reset status if they previously left/disconnected
        await prisma.multiplayerRoomPlayer.update({
          where: { id: existingPlayer.id },
          data: { status: 'NOT_READY', disconnectedAt: null }
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
          await deleteCricketSession(roomCode)
          await deleteDotsBoxesSession(roomCode)
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
      
      const activePlayers = room.players
        .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
        .slice(0, 2)
      const allReady = activePlayers.every(p => p.status === 'READY' || p.userId === room.hostUserId)
      if (!allReady) throw new Error('All players must be ready to start')

      // Set initial game states
      let initialGameState: any = {}
      if (room.gameSlug === 'cricket') {
        initialGameState = INITIAL_STATES['cricket'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'dots-boxes') {
        initialGameState = INITIAL_STATES['dots-boxes'](activePlayers, room.hostUserId)
      } else if (room.gameSlug === 'tic-tac-toe') {
        initialGameState = INITIAL_STATES['tic-tac-toe'](activePlayers, room.hostUserId)
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
      } else if (room.gameSlug === 'dots-boxes') {
        await saveDotsBoxesSession(room.roomCode, initialGameState)
      } else if (room.gameSlug === 'tic-tac-toe') {
        await saveTicTacToeSession(room.roomCode, initialGameState)
      }

      await broadcastRoomUpdate(room.roomCode)
      io.to(`room:${room.roomCode}`).emit('game-started', { roomCode: room.roomCode })
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
        include: { players: true }
      })

      if (!room) throw new Error('Room not found')
      const isPlayer = room.players.some(p => p.userId === userId)
      if (!isPlayer) throw new Error('Not authorized to access this match')

      // Set presence to IN_GAME
      setUserPresence(userId, 'IN_GAME').catch(err => logError(err, { userId }))

      socket.join(`game:${normalizedCode}`)

      // Retrieve cached or database game session
      let gameState = null
      if (room.gameSlug === 'cricket') {
        gameState = await getCricketSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'dots-boxes') {
        gameState = await getDotsBoxesSession(normalizedCode, room.id, prisma).catch(() => null)
      } else if (room.gameSlug === 'tic-tac-toe') {
        gameState = await getTicTacToeSession(normalizedCode, room.id, prisma).catch(() => null)
      }

      if (callback) callback({ success: true })
      
      // Send current state
      const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId: room.id }
      })

      logger.info(`[JOIN-GAME] Sending game-state to ${username}: stage=${(gameState ?? dbSession?.gameState)?.stage} gameSlug=${room.gameSlug}`)

      socket.emit('game-state', {
        room,
        gameSession: {
          ...dbSession,
          gameState: gameState ?? dbSession?.gameState
        },
        players: room.players.map(p => ({
          userId: p.userId,
          status: p.status
        }))
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

        // Only pass the 2 active players (sorted by join order) to game engines
        // Spectators (3rd+ players) must never receive X/O symbol assignments
        const mappedPlayers = room.players
          .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
          .slice(0, 2)
          .map(p => ({
            userId: p.userId,
            username: p.profile?.username || 'Player'
          }))

        let result: any = null

        // Execute engine calculations
        if (room.gameSlug === 'cricket') {
          result = await processCricketMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'dots-boxes') {
          result = await processDotsBoxesMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else if (room.gameSlug === 'tic-tac-toe') {
          result = await processTicTacToeMove(roomCode, room.id, userId, move, mappedPlayers, prisma)
        } else {
          throw new Error('Unsupported game engine')
        }

        const { state, gameFinished, winnerId } = result

        // Emit update to all room clients
        io.to(`game:${roomCode}`).emit('game-update', {
          gameState: state,
          gameFinished,
          winnerId,
          lastMove: { userId, move }
        })

        if (gameFinished) {
          await handleMatchCompletion(room, state, winnerId, prisma)
          deleteRoomQueue(roomCode)
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

        let gameState = null
        if (room.gameSlug === 'cricket') {
          gameState = await getCricketSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'dots-boxes') {
          gameState = await getDotsBoxesSession(roomCode, room.id, prisma)
        } else if (room.gameSlug === 'tic-tac-toe') {
          gameState = await getTicTacToeSession(roomCode, room.id, prisma)
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
          lastMove: { userId, type: 'replay_vote' }
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

  // Disconnect Handler
  socket.on('disconnect', async () => {
    logger.info(`[-] Disconnected: userId=${userId} socketId=${socket.id}`)
    userSockets.delete(userId)
    await setUserPresence(userId, 'OFFLINE')
    recordDisconnect()

    // Determine grace period based on active rooms: 30s if in active match, 5s if in waiting lobby
    let gracePeriod = 5000
    try {
      const activeRooms = await prisma.multiplayerRoomPlayer.findMany({
        where: { userId, NOT: { status: 'LEFT' } },
        include: { room: true }
      })
      const hasPlayingRoom = activeRooms.some(p => p.room && p.room.status === 'PLAYING')
      if (hasPlayingRoom) {
        gracePeriod = 30000
      }
    } catch (err: any) {
      logError(err, { userId, context: 'disconnect-grace-period-lookup' })
    }

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
            // Player abandoned active game -> Forfeit and award victory to opponent
            const remainingPlayers = await prisma.multiplayerRoomPlayer.findMany({
              where: { roomId, NOT: { userId } }
            })

            const opponentId = remainingPlayers[0]?.userId || null
            logger.info(`[FORFEIT MATCH] room=${roomCode} user=${username} forfeited to winnerId=${opponentId}`)

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
              await deleteCricketSession(roomCode)
              await deleteDotsBoxesSession(roomCode)
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
              select: { username: true, avatarUrl: true, level: true }
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
      level: p.profile.level
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
