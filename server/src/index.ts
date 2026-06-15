import express from 'express'
import http from 'http'
import cors from 'cors'
import { Server } from 'socket.io'

const app = express()
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000' }))
app.use(express.json())

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), rooms: Object.keys(rooms).length })
})

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  score: number
}

export interface Room {
  players: Player[]
  hostId: string
  gameSlug: string
  settings: Record<string, unknown>
  gameStarted: boolean
  currentWord?: string
  currentTimeLeft?: number
  guessedPlayers?: Set<string>
  dotsBoxesState?: {
    size: number
    lines: string[]
    boxes: Record<string, string>
    turnId: string
    scores: Record<string, number>
  }
}

export const rooms: Record<string, Room> = {}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ─── Socket events ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`)

  // Create room
  socket.on('create-room', (
    { username, gameSlug, settings }: { username: string; gameSlug: string; settings?: Record<string, unknown> },
    callback: (code: string) => void
  ) => {
    const roomCode = generateRoomCode()
    rooms[roomCode] = {
      players: [{ id: socket.id, name: username, score: 0 }],
      hostId: socket.id,
      gameSlug,
      settings: settings ?? {},
      gameStarted: false,
    }
    socket.join(roomCode)
    callback(roomCode)
    console.log(`Room ${roomCode} created by ${username} [${gameSlug}]`)
  })

  // Join room
  socket.on('join-room', (
    { username, roomCode }: { username: string; roomCode: string },
    callback: (res: { success?: boolean; error?: string; players?: Player[] }) => void
  ) => {
    const room = rooms[roomCode]
    if (!room) return callback({ error: 'Room not found' })
    if (room.gameStarted) return callback({ error: 'Game already started' })
    if (room.players.some(p => p.name === username)) return callback({ error: 'Username taken in this room' })

    room.players.push({ id: socket.id, name: username, score: 0 })
    socket.join(roomCode)
    callback({ success: true, players: room.players })
    io.to(roomCode).emit('player-joined', room.players)
  })

  // Leave room
  socket.on('leave-room', ({ roomCode }: { roomCode: string }) => {
    leaveRoom(socket.id, roomCode)
  })

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`)
    for (const code of Object.keys(rooms)) {
      leaveRoom(socket.id, code)
    }
  })

  // ── Scribble ──────────────────────────────────────────────────────────────

  const WORD_BANK = [
    'elephant', 'laptop', 'banana', 'mountain', 'airplane', 'rainbow', 'guitar',
    'umbrella', 'cactus', 'lighthouse', 'dragon', 'telescope', 'volcano', 'compass',
    'dinosaur', 'submarine', 'tornado', 'pyramid', 'jellyfish', 'waterfall',
    'basketball', 'saxophone', 'helicopter', 'thunderstorm', 'constellation',
  ]

  socket.on('scribble:start-turn', ({ roomCode }: { roomCode: string }) => {
    const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5)
    io.to(socket.id).emit('scribble:choose-word', shuffled.slice(0, 3))
  })

  socket.on('scribble:word-chosen', ({ roomCode, word }: { roomCode: string; word: string }) => {
    const room = rooms[roomCode]
    if (!room) return
    room.currentWord = word
    room.guessedPlayers = new Set()
    const display = word.split('').map(() => '_').join(' ')
    io.to(roomCode).emit('scribble:round-start', { displayWord: display, wordLength: word.length })
    startScribbleTimer(roomCode, word, room)
  })

  socket.on('scribble:drawing-data', ({ roomCode, drawing }: { roomCode: string; drawing: unknown }) => {
    socket.to(roomCode).emit('scribble:receive-drawing', { drawing })
  })

  socket.on('scribble:clear-canvas', ({ roomCode }: { roomCode: string }) => {
    socket.to(roomCode).emit('scribble:canvas-cleared')
  })

  socket.on('scribble:chat', ({ roomCode, playerName, message }: { roomCode: string; playerName: string; message: string }) => {
    const room = rooms[roomCode]
    if (!room?.currentWord) return

    const correct = message.toLowerCase().trim() === room.currentWord.toLowerCase().trim()
    if (correct && !room.guessedPlayers?.has(socket.id)) {
      room.guessedPlayers?.add(socket.id)
      const points = 50 + (room.currentTimeLeft ?? 0) * 2

      const player = room.players.find(p => p.id === socket.id)
      if (player) player.score += points
      const host = room.players.find(p => p.id === room.hostId)
      if (host) host.score += 25

      io.to(roomCode).emit('scribble:correct-guess', { playerName, points })
      io.to(roomCode).emit('scribble:update-scores', room.players)
    } else if (!correct) {
      io.to(roomCode).emit('scribble:chat-message', { playerName, message })
    }
  })

  // ── Charades ──────────────────────────────────────────────────────────────

  const PHRASES = [
    'The Lion King', 'Avengers Endgame', 'Jurassic Park', 'Harry Potter',
    'The Dark Knight', 'Inception', 'Interstellar', 'Spider-Man', 'Frozen',
    'Finding Nemo', 'The Matrix', 'Titanic', 'Gladiator', 'The Godfather',
  ]

  socket.on('charades:start', ({ roomCode }: { roomCode: string }) => {
    const room = rooms[roomCode]
    if (!room) return
    const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)]
    room.currentWord = phrase
    room.guessedPlayers = new Set()
    io.to(socket.id).emit('charades:phrase-assigned', { phrase })
    io.to(roomCode).emit('charades:round-started', { actorId: socket.id })
  })

  socket.on('charades:hint', ({ roomCode, hintText }: { roomCode: string; hintText: string }) => {
    socket.to(roomCode).emit('charades:hint-broadcast', { hintText })
  })

  socket.on('charades:guess', ({ roomCode, playerName, guess }: { roomCode: string; playerName: string; guess: string }) => {
    const room = rooms[roomCode]
    if (!room?.currentWord) return
    const correct = guess.toLowerCase().trim() === room.currentWord.toLowerCase().trim()
    if (correct && !room.guessedPlayers?.has(socket.id)) {
      room.guessedPlayers?.add(socket.id)
      const player = room.players.find(p => p.id === socket.id)
      if (player) player.score += 100
      io.to(roomCode).emit('charades:correct-guess', { playerName, phrase: room.currentWord })
      io.to(roomCode).emit('charades:update-scores', room.players)
    } else {
      io.to(roomCode).emit('charades:wrong-guess', { playerName })
    }
  })

  // ── Dots & Boxes ──────────────────────────────────────────────────────────

  socket.on('dotsboxes:start', ({ roomCode, size }: { roomCode: string; size: number }) => {
    const room = rooms[roomCode]
    if (!room) return
    room.dotsBoxesState = {
      size,
      lines: [],
      boxes: {},
      turnId: room.players[0].id,
      scores: room.players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
    }
    room.gameStarted = true
    io.to(roomCode).emit('dotsboxes:started', room.dotsBoxesState)
  })

  socket.on('dotsboxes:draw-line', ({ roomCode, lineId }: { roomCode: string; lineId: string }) => {
    const room = rooms[roomCode]
    if (!room || !room.dotsBoxesState) return
    const state = room.dotsBoxesState

    // 1. Verify correct player turn
    if (state.turnId !== socket.id) {
      return socket.emit('error', 'Not your turn')
    }

    // 2. Verify line is not already claimed
    if (state.lines.includes(lineId)) {
      return socket.emit('error', 'Line already drawn')
    }

    // 3. Verify move is legal
    const parts = lineId.split('-')
    if (parts.length !== 3) return socket.emit('error', 'Invalid line format')
    const type = parts[0]
    const r = parseInt(parts[1], 10)
    const c = parseInt(parts[2], 10)
    const size = state.size
    if (type === 'h') {
      if (r < 0 || r >= size || c < 0 || c >= size - 1) return socket.emit('error', 'Out of bounds')
    } else if (type === 'v') {
      if (r < 0 || r >= size - 1 || c < 0 || c >= size) return socket.emit('error', 'Out of bounds')
    } else {
      return socket.emit('error', 'Invalid line type')
    }

    // 4. Claim the line
    state.lines.push(lineId)

    // 5. Check if box completed
    let boxCompleted = false
    const sizeBoxes = size - 1

    const checkAndClaimBox = (br: number, bc: number) => {
      if (br < 0 || br >= sizeBoxes || bc < 0 || bc >= sizeBoxes) return false
      const boxKey = `${br},${bc}`
      if (state.boxes[boxKey]) return false

      const top = `h-${br}-${bc}`
      const bottom = `h-${br + 1}-${bc}`
      const left = `v-${br}-${bc}`
      const right = `v-${br}-${bc + 1}`

      const isCompleted = state.lines.includes(top) &&
                          state.lines.includes(bottom) &&
                          state.lines.includes(left) &&
                          state.lines.includes(right)

      if (isCompleted) {
        state.boxes[boxKey] = socket.id
        state.scores[socket.id] = (state.scores[socket.id] || 0) + 1

        const player = room.players.find(p => p.id === socket.id)
        if (player) player.score = state.scores[socket.id]

        return true
      }
      return false
    }

    if (type === 'h') {
      if (checkAndClaimBox(r, c)) boxCompleted = true
      if (checkAndClaimBox(r - 1, c)) boxCompleted = true
    } else {
      if (checkAndClaimBox(r, c)) boxCompleted = true
      if (checkAndClaimBox(r, c - 1)) boxCompleted = true
    }

    // 6. Turn synchronization
    if (!boxCompleted) {
      const otherPlayer = room.players.find(p => p.id !== socket.id)
      if (otherPlayer) {
        state.turnId = otherPlayer.id
      }
    }

    // 7. Check if game is completed
    const totalLinesCount = size * (size - 1) * 2
    const gameFinished = state.lines.length === totalLinesCount

    // 8. Broadcast update
    io.to(roomCode).emit('dotsboxes:updated', {
      state,
      lastMove: { playerId: socket.id, lineId, boxCompleted },
      gameFinished,
      players: room.players
    })

    if (gameFinished) {
      room.gameStarted = false
    }
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function leaveRoom(socketId: string, roomCode: string) {
  const room = rooms[roomCode]
  if (!room) return
  room.players = room.players.filter(p => p.id !== socketId)
  if (room.players.length === 0) {
    delete rooms[roomCode]
  } else {
    io.to(roomCode).emit('player-left', room.players)
    // Reassign host if needed
    if (room.hostId === socketId) {
      room.hostId = room.players[0].id
      io.to(roomCode).emit('host-changed', { newHostId: room.hostId })
    }
  }
}

function startScribbleTimer(roomCode: string, word: string, room: Room) {
  let timeLeft = 60
  room.currentTimeLeft = timeLeft
  const revealed = word.split('').map(() => '_')
  const indexes = word.split('').map((_, i) => i).sort(() => Math.random() - 0.5)

  const interval = setInterval(() => {
    if (!rooms[roomCode]) { clearInterval(interval); return }
    timeLeft--
    rooms[roomCode].currentTimeLeft = timeLeft

    if (timeLeft % 20 === 0 && indexes.length > 0) {
      const idx = indexes.shift()!
      revealed[idx] = word[idx]
      io.to(roomCode).emit('scribble:hint', revealed.join(' '))
    }

    io.to(roomCode).emit('scribble:timer', timeLeft)

    if (timeLeft <= 0) {
      clearInterval(interval)
      io.to(roomCode).emit('scribble:turn-ended', { word })
    }
  }, 1000)
}

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '5000', 10)
server.listen(PORT, () => {
  console.log(`🎮 GameHub Socket.IO server → http://localhost:${PORT}`)
})
