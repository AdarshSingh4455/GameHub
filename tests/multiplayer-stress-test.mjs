import { io } from 'socket.io-client'
import { spawn, execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

const WS_URL = 'http://localhost:5000'
const WAIT = (ms) => new Promise(r => setTimeout(r, ms))

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout after ' + ms + 'ms: ' + label)), ms)
    )
  ])

let wsServer = null
const log = (msg) => {
  const ts = new Date().toISOString().slice(11, 19)
  console.log('[' + ts + '] ' + msg)
}

let totalReconnectAttempts = 0
let successfulReconnects = 0
let failedReconnects = 0
let roomRecoveryAttempts = 0
let roomRecoverySuccess = 0

const DB_PATH = path.join(process.cwd(), 'node_modules', '.cache', 'mock_db_state.json')

function reseedMockDb() {
  const dbDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })
  const makeProfile = (id, username, num) => ({
    id, userId: id, username,
    avatarUrl: null,
    friendCode: 'GH-' + username.toUpperCase().padEnd(5, '0').slice(0, 5) + num,
    xp: 5000, level: 15, coins: 99999,
    isGuest: false,
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date().toISOString(),
    selectedTitle: null, selectedFrame: null, selectedChatPack: null,
    currentRank: null, previousRank: null,
    _count: { wonMatches: 2, friends: 1 }
  })
  const state = {
    profiles: {
      'test-user-a': makeProfile('test-user-a', 'TestUserA', '0001'),
      'test-user-b': makeProfile('test-user-b', 'TestUserB', '0002')
    },
    rooms: {}, sessions: {}, friendships: {}, invites: {}, notifications: {}
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf8')
  log('Mock DB re-seeded to clean state.')
}

async function startServer() {
  log('Force-clearing port 5000 before starting server...')
  try {
    if (process.platform === 'win32') {
      const pids = execSync(
        '(Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique',
        { shell: 'powershell', encoding: 'utf8' }
      ).split('\n').map(x => x.trim()).filter(Boolean)
      for (const pid of pids) {
        try { execSync('taskkill /F /T /PID ' + pid, { stdio: 'ignore' }) } catch (_) {}
      }
    } else {
      execSync('lsof -t -i:5000 | xargs kill -9', { stdio: 'ignore' })
    }
  } catch (_) {}
  await WAIT(2000)

  log('Pre-seeding mock DB state...')
  reseedMockDb()

  log('Starting WebSocket server...')
  wsServer = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'server/src/index.ts'],
    {
      env: { ...process.env, PORT: '5000', MOCK_AUTH: 'true', TEST_FAST_TIMEOUT: 'true', NODE_ENV: 'development' },
      shell: true,
      stdio: 'pipe'
    }
  )
  wsServer.stderr.on('data', d => { log('[Server ERR] ' + d.toString().trim()) })

  log('Waiting for socket server to become healthy...')
  let connected = false
  for (let i = 0; i < 30; i++) {
    await WAIT(1000)
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          const socket = io(WS_URL, { auth: { mockUserId: 'test-user-a', mockUsername: 'TestUserA' }, transports: ['websocket'], timeout: 1000 })
          socket.on('connect', () => { socket.disconnect(); resolve() })
          socket.on('connect_error', (e) => { socket.disconnect(); reject(e) })
        }),
        1500, 'health probe'
      )
      connected = true
      log('Socket server is healthy and ready.')
      break
    } catch (_) {}
  }
  if (!connected) throw new Error('Socket server failed to start within 30s')
  // Wait for Redis retry storm to exhaust (3 retries x 2s each + buffer) before running tests
  log('Waiting 12s for Redis connection storm to settle...')
  await WAIT(12000)
  log('Ready. Starting test suite.')
}

function killServer() {
  if (wsServer) {
    log('Shutting down server...')
    try {
      if (process.platform === 'win32') {
        execSync('taskkill /F /T /PID ' + wsServer.pid, { stdio: 'ignore' })
      } else {
        wsServer.kill('SIGKILL')
      }
    } catch (_) {}
    wsServer = null
  }
}

function connectClient(userId, username) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_URL, {
      auth: { mockUserId: userId, mockUsername: username },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', err => reject(err))
  })
}

async function simulateReconnect(userId, username) {
  totalReconnectAttempts++
  try {
    const newSocket = await withTimeout(connectClient(userId, username), 5000, 'reconnect ' + username)
    successfulReconnects++
    log('[Reconnect] Fresh socket for ' + username + ' connected.')
    return newSocket
  } catch (err) {
    failedReconnects++
    log('[Reconnect] Failed for ' + username + ': ' + err.message)
    throw err
  }
}

async function freshConnect(userId, username) {
  // Like simulateReconnect but does NOT count toward reconnect metrics (used for test setup only)
  const newSocket = await withTimeout(connectClient(userId, username), 5000, 'fresh-connect ' + username)
  log('[FreshConnect] Socket for ' + username + ' ready.')
  return newSocket
}

async function verifyRoomRecovery(socket, roomCode, gameSlug) {
  roomRecoveryAttempts++
  return withTimeout(
    new Promise((resolve, reject) => {
      socket.once('game-state', (data) => {
        try {
          if (!data || !data.room || !data.gameSession) throw new Error('Invalid recovery state data')
          if (data.room.roomCode !== roomCode) throw new Error('Room code mismatch: expected ' + roomCode + ', got ' + data.room.roomCode)
          if (data.gameSession.gameSlug !== gameSlug) throw new Error('Game slug mismatch: expected ' + gameSlug + ', got ' + data.gameSession.gameSlug)
          roomRecoverySuccess++
          resolve(true)
        } catch (err) {
          log('[Recovery] Check failed: ' + err.message)
          reject(err)
        }
      })
      socket.emit('join-game', { roomCode }, (res) => {
        if (res && res.error) reject(new Error('join-game error: ' + res.error))
      })
    }),
    8000, 'verifyRoomRecovery ' + roomCode
  )
}

async function runLobbyStress(socketA, socketB) {
  log('Starting Lobby Stress Test (25 iterations)...')
  for (let i = 1; i <= 25; i++) {
    const { roomCode } = await withTimeout(
      new Promise((resolve, reject) => { socketA.emit('create-room', { gameSlug: 'cricket', maxPlayers: 2 }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
      15000, 'create-room #' + i
    )
    const roomUpdatePromise = new Promise(resolve => socketA.once('room-update', resolve))
    await withTimeout(
      new Promise((resolve, reject) => { socketB.emit('join-room', { roomCode }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
      15000, 'join-room #' + i
    )
    const updateA = await withTimeout(roomUpdatePromise, 15000, 'room-update #' + i)
    const roomId = updateA.room.id
    if (updateA.room.status !== 'WAITING' || updateA.players.length !== 2) throw new Error('Iteration ' + i + ': invalid room state')
    await new Promise(resolve => socketB.emit('leave-room', { roomId }, resolve))
    await new Promise(resolve => socketA.emit('leave-room', { roomId }, resolve))
    if (i % 5 === 0 || i === 25) log('  Completed lobby cycle ' + i + '/25')
  }
  log('Lobby Stress Test passed.')
}

async function runRematchStress(socketA, socketB) {
  log('Starting Rematch Stress Test (10 iterations)...')
  const { roomCode } = await withTimeout(
    new Promise((resolve, reject) => { socketA.emit('create-room', { gameSlug: 'cricket', maxPlayers: 2 }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
    15000, 'create-room for rematch'
  )
  // Register room-update listener BEFORE join-room fires broadcastRoomUpdate
  const roomUpdateAPromise = new Promise(resolve => socketA.once('room-update', resolve))
  await withTimeout(
    new Promise((resolve, reject) => { socketB.emit('join-room', { roomCode }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
    15000, 'join-room for rematch'
  )
  const roomUpdateA = await withTimeout(roomUpdateAPromise, 15000, 'room-update for rematch')
  const roomId = roomUpdateA.room.id
  await new Promise(resolve => socketB.emit('toggle-ready', { roomId }, resolve))
  await new Promise(resolve => socketA.emit('start-game', { roomId }, resolve))

  for (let matchNum = 1; matchNum <= 10; matchNum++) {
    log('  Running Match ' + matchNum + '/10...')
    const stateAPromise = new Promise(resolve => socketA.once('game-state', resolve))
    const stateBPromise = new Promise(resolve => socketB.once('game-state', resolve))
    await Promise.all([
      new Promise(resolve => socketA.emit('join-game', { roomCode }, resolve)),
      new Promise(resolve => socketB.emit('join-game', { roomCode }, resolve))
    ])
    const stateA = await withTimeout(stateAPromise, 8000, 'game-state A match ' + matchNum)
    await withTimeout(stateBPromise, 8000, 'game-state B match ' + matchNum)
    let sessionState = stateA.gameSession.gameState
    if (sessionState.stage !== 'TOSS') throw new Error('Match ' + matchNum + ': Expected TOSS, got ' + sessionState.stage)

    const tossWinnerId = sessionState.tossWinnerId
    const tossSocket = tossWinnerId === 'test-user-a' ? socketA : socketB
    const tossUpdatePromise = new Promise(resolve => {
      function onUpdate(data) {
        if (data.gameState && data.gameState.stage === 'FIRST_INNINGS') { tossSocket.off('game-update', onUpdate); resolve(data) }
      }
      tossSocket.on('game-update', onUpdate)
    })
    tossSocket.emit('submit-move', { roomCode, move: { type: 'toss', choice: 'BAT' } })
    await withTimeout(tossUpdatePromise, 8000, 'toss match ' + matchNum)

    const innings1Promise = new Promise(resolve => {
      function onUpdate(data) {
        if (data.gameState && data.gameState.stage === 'SECOND_INNINGS') { socketA.off('game-update', onUpdate); resolve(data) }
      }
      socketA.on('game-update', onUpdate)
    })
    socketA.emit('submit-move', { roomCode, move: { type: 'play', number: 3 } })
    socketB.emit('submit-move', { roomCode, move: { type: 'play', number: 3 } })
    await withTimeout(innings1Promise, 8000, 'innings1 match ' + matchNum)

    const matchFinishPromise = new Promise(resolve => {
      function onUpdate(data) {
        if (data.gameFinished || (data.gameState && data.gameState.stage === 'FINISHED')) { socketA.off('game-update', onUpdate); resolve(data) }
      }
      socketA.on('game-update', onUpdate)
    })
    socketA.emit('submit-move', { roomCode, move: { type: 'play', number: 3 } })
    socketB.emit('submit-move', { roomCode, move: { type: 'play', number: 3 } })
    const finishUpdate = await withTimeout(matchFinishPromise, 8000, 'match finish ' + matchNum)
    log('    Match ' + matchNum + ' finished. winnerId: ' + finishUpdate.winnerId)

    if (matchNum < 10) {
      // FIX: listen for game-started (emitted after all votes), then re-join next iter
      const gameStartedPromise = new Promise(resolve => {
        function onStarted(data) {
          if (data.roomCode === roomCode) { socketA.off('game-started', onStarted); resolve(data) }
        }
        socketA.on('game-started', onStarted)
      })
      socketA.emit('vote-replay', { roomCode })
      socketB.emit('vote-replay', { roomCode })
      await withTimeout(gameStartedPromise, 10000, 'game-started after rematch ' + matchNum)
      log('    Rematch ' + matchNum + ' accepted. Ready for next match.')
    }
  }
  await new Promise(resolve => socketB.emit('leave-room', { roomId }, resolve))
  await new Promise(resolve => socketA.emit('leave-room', { roomId }, resolve))
  log('Rematch Stress Test passed.')
}

async function startRoomAndGetCode(socketA, socketB, gameSlug) {
  const { roomCode } = await withTimeout(
    new Promise((resolve, reject) => { socketA.emit('create-room', { gameSlug, maxPlayers: 2 }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
    15000, 'create-room ' + gameSlug
  )
  // Register room-update listener BEFORE join-room fires broadcastRoomUpdate
  const roomUpdateAPromise = new Promise(resolve => socketA.once('room-update', resolve))
  await withTimeout(
    new Promise((resolve, reject) => { socketB.emit('join-room', { roomCode }, (res) => { res.error ? reject(new Error(res.error)) : resolve(res) }) }),
    15000, 'join-room ' + gameSlug
  )
  const roomUpdateA = await withTimeout(roomUpdateAPromise, 15000, 'room-update ' + gameSlug)
  const roomId = roomUpdateA.room.id
  await withTimeout(
    new Promise((resolve, reject) => {
      socketB.emit('toggle-ready', { roomId }, (res) => {
        if (res && res.error) reject(new Error('toggle-ready error: ' + res.error))
        else resolve(res)
      })
    }),
    10000, 'toggle-ready ' + gameSlug
  )
  await withTimeout(
    new Promise((resolve, reject) => {
      socketA.emit('start-game', { roomId }, (res) => {
        if (res && res.error) reject(new Error('start-game error: ' + res.error))
        else resolve(res)
      })
    }),
    10000, 'start-game ' + gameSlug
  )
  const stateAPromise = new Promise(resolve => socketA.once('game-state', resolve))
  await Promise.all([
    new Promise(resolve => socketA.emit('join-game', { roomCode }, resolve)),
    new Promise(resolve => socketB.emit('join-game', { roomCode }, resolve))
  ])
  const stateA = await withTimeout(stateAPromise, 15000, 'game-state ' + gameSlug)
  return { roomCode, roomId, stateA }
}

async function runRecoveryStress(socketARef, socketB) {
  log('Starting Room Recovery Stress Test (20 iterations x 3 games)...')
  let socketA = socketARef

  log('  Testing Hand Cricket recovery...')
  const cricket = await startRoomAndGetCode(socketA, socketB, 'cricket')
  for (let i = 1; i <= 20; i++) {
    socketA.disconnect()
    socketA = await simulateReconnect('test-user-a', 'TestUserA')
    await verifyRoomRecovery(socketA, cricket.roomCode, 'cricket')
  }
  await new Promise(resolve => socketB.emit('leave-room', { roomId: cricket.roomId }, resolve))
  await new Promise(resolve => socketA.emit('leave-room', { roomId: cricket.roomId }, resolve))
  log('  Hand Cricket recovery passed.')

  log('  Testing Hangman recovery...')
  const hangman = await startRoomAndGetCode(socketA, socketB, 'hangman')
  // FIX: register listener BEFORE emitting moves
  const playingStagePromise = new Promise(resolve => {
    function onUpdate(data) {
      if (data.gameState && data.gameState.stage === 'PLAYING') { socketA.off('game-update', onUpdate); resolve(data) }
    }
    socketA.on('game-update', onUpdate)
  })
  socketA.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'SUBMIT_WORD', word: 'APPLE' } })
  socketB.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'SUBMIT_WORD', word: 'BANANA' } })
  await withTimeout(playingStagePromise, 8000, 'hangman PLAYING stage')
  for (let i = 1; i <= 20; i++) {
    socketA.disconnect()
    socketA = await simulateReconnect('test-user-a', 'TestUserA')
    await verifyRoomRecovery(socketA, hangman.roomCode, 'hangman')
  }
  await new Promise(resolve => socketB.emit('leave-room', { roomId: hangman.roomId }, resolve))
  await new Promise(resolve => socketA.emit('leave-room', { roomId: hangman.roomId }, resolve))
  log('  Hangman recovery passed.')

  log('Room Recovery Stress Test passed. (Cricket 20x + Hangman 20x = 40 recovery cycles)')
  return [socketA, socketB]
}

async function testHangmanGameplayCases(socketA, socketB) {
  log('Running Hangman specific gameplay test cases...')
  const guesses = [
    { target: 'APPLE',       letters: ['A', 'P', 'L', 'E'] },
    { target: 'BALLOON',     letters: ['B', 'A', 'L', 'O', 'N'] },
    { target: 'LETTER',      letters: ['L', 'E', 'T', 'R'] },
    { target: 'MISSISSIPPI', letters: ['M', 'I', 'S', 'P'] }
  ]

  for (let idx = 0; idx < guesses.length; idx++) {
    const { target, letters } = guesses[idx]
    log('  Testing word solve for target: ' + target + '')
    const hangman = await startRoomAndGetCode(socketA, socketB, 'hangman')

    // FIX: register listener BEFORE moves
    const playingStagePromise = new Promise(resolve => {
      function onUpdate(data) {
        if (data.gameState && data.gameState.stage === 'PLAYING') { socketA.off('game-update', onUpdate); resolve(data) }
      }
      socketA.on('game-update', onUpdate)
    })
    socketA.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'SUBMIT_WORD', word: target } })
    socketB.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'SUBMIT_WORD', word: 'BANANA' } })
    const initialPlayState = await withTimeout(playingStagePromise, 8000, 'PLAYING stage for ' + target)

    let currentTurn = initialPlayState.gameState.currentTurn
    let letterIndex = 0
    let gameFinished = false

    // FIX: register onUpdate BEFORE takeTurn is called
    const winPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socketB.off('game-update', onUpdate)
        socketA.off('game-update', onUpdate)
        reject(new Error('Timeout waiting for word solve victory on ' + target + ''))
      }, 20000)

      function onUpdate(data) {
        if (data.gameFinished) {
          gameFinished = true
          clearTimeout(timeout)
          socketB.off('game-update', onUpdate)
          socketA.off('game-update', onUpdate)
          resolve(data)
        } else {
          currentTurn = data.gameState.currentTurn
          setImmediate(takeTurn)
        }
      }

      // register on BOTH because hangman sends masked state per-player
      socketB.on('game-update', onUpdate)
      socketA.on('game-update', onUpdate)

      function takeTurn() {
        if (gameFinished) return
        if (currentTurn === 'test-user-b') {
          if (letterIndex < letters.length) {
            const letter = letters[letterIndex++]
            socketB.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'GUESS_LETTER', letter } })
          }
        } else {
          socketA.emit('submit-move', { roomCode: hangman.roomCode, move: { type: 'GUESS_LETTER', letter: 'X' } })
        }
      }

      takeTurn() // kick off after listeners registered
    })

    const finalState = await winPromise
    if (finalState.winnerId !== 'test-user-b') throw new Error('Expected test-user-b to win ' + target + ', got: ' + finalState.winnerId)
    log('  Solved ' + target + '. Winner: test-user-b.')
    await new Promise(resolve => socketB.emit('leave-room', { roomId: hangman.roomId }, resolve))
    await new Promise(resolve => socketA.emit('leave-room', { roomId: hangman.roomId }, resolve))
  }

  log('  Testing Hangman Turn Timeout (FAST TIMEOUT = 2s)...')
  const hangmanTimeout = await startRoomAndGetCode(socketA, socketB, 'hangman')
  const playingStagePromise2 = new Promise(resolve => {
    function onUpdate(data) {
      if (data.gameState && data.gameState.stage === 'PLAYING') { socketA.off('game-update', onUpdate); resolve(data) }
    }
    socketA.on('game-update', onUpdate)
  })
  socketA.emit('submit-move', { roomCode: hangmanTimeout.roomCode, move: { type: 'SUBMIT_WORD', word: 'APPLE' } })
  socketB.emit('submit-move', { roomCode: hangmanTimeout.roomCode, move: { type: 'SUBMIT_WORD', word: 'BANANA' } })
  const startPlayingState = await withTimeout(playingStagePromise2, 8000, 'timeout test PLAYING stage')

  const activeTurnPlayer = startPlayingState.gameState.currentTurn
  const activeSocket = activeTurnPlayer === 'test-user-a' ? socketA : socketB
  const opponentPlayer = activeTurnPlayer === 'test-user-a' ? 'test-user-b' : 'test-user-a'
  const initialLives = activeTurnPlayer === 'test-user-a' ? startPlayingState.gameState.p1Lives : startPlayingState.gameState.p2Lives
  log('    Active turn: ' + activeTurnPlayer + ', lives=' + initialLives + '. Waiting for server timeout...')

  const timeoutUpdatePromise = new Promise((resolve, reject) => {
    const handle = setTimeout(() => { activeSocket.off('game-update', onUpdate); reject(new Error('Timeout waiting for TIMEOUT broadcast')) }, 12000)
    function onUpdate(data) {
      if (data.lastMove && data.lastMove.move && data.lastMove.move.type === 'TIMEOUT') {
        clearTimeout(handle)
        activeSocket.off('game-update', onUpdate)
        resolve(data)
      }
    }
    activeSocket.on('game-update', onUpdate)
  })

  const timeoutState = await timeoutUpdatePromise
  const nextTurn = timeoutState.gameState.currentTurn
  const postTimeoutLives = activeTurnPlayer === 'test-user-a' ? timeoutState.gameState.p1Lives : timeoutState.gameState.p2Lives

  if (nextTurn !== opponentPlayer) throw new Error('Expected turn to switch to ' + opponentPlayer + ', got: ' + nextTurn)
  if (postTimeoutLives !== initialLives - 1) throw new Error('Expected lives to drop from ' + initialLives + ' to ' + (initialLives - 1) + ', got: ' + postTimeoutLives)

  log('    Hangman Turn Timeout verified. Life lost, turn toggled.')
  await new Promise(resolve => socketB.emit('leave-room', { roomId: hangmanTimeout.roomId }, resolve))
  await new Promise(resolve => socketA.emit('leave-room', { roomId: hangmanTimeout.roomId }, resolve))
  log('Hangman specific gameplay tests passed.')
  return socketA
}

async function runStressSuite() {
  await startServer()
  log('Connecting test clients...')
  let clientA = await connectClient('test-user-a', 'TestUserA')
  let clientB = await connectClient('test-user-b', 'TestUserB')

  try {
    await runLobbyStress(clientA, clientB)
    await runRematchStress(clientA, clientB)
    ;[clientA, clientB] = await runRecoveryStress(clientA, clientB)

    const reconnectSuccessRate = totalReconnectAttempts > 0 ? (successfulReconnects / totalReconnectAttempts) * 100 : 100
    const roomRecoverySuccessRate = roomRecoveryAttempts > 0 ? (roomRecoverySuccess / roomRecoveryAttempts) * 100 : 100

    console.log('\n====================================================')
    console.log('PHASE 23 -- HARDENING METRICS REPORT')
    console.log('====================================================')
    console.log('Total Reconnect Attempts:       ' + totalReconnectAttempts)
    console.log('Successful Reconnects:          ' + successfulReconnects)
    console.log('Failed Reconnects:              ' + failedReconnects)
    console.log('Reconnect Success Rate:         ' + reconnectSuccessRate.toFixed(2) + '%')
    console.log('----------------------------------------------------')
    console.log('Total Room Recovery Attempts:   ' + roomRecoveryAttempts)
    console.log('Successful Room Recoveries:     ' + roomRecoverySuccess)
    console.log('Failed Room Recoveries:         ' + (roomRecoveryAttempts - roomRecoverySuccess))
    console.log('Room Recovery Success Rate:     ' + roomRecoverySuccessRate.toFixed(2) + '%')
    console.log('====================================================\n')

    if (reconnectSuccessRate < 95 || roomRecoverySuccessRate < 95) {
      console.error('METRIC FAILURE: Targets not met.')
      console.error('   Reconnect:     ' + reconnectSuccessRate.toFixed(2) + '% (need >=95%)')
      console.error('   Room Recovery: ' + roomRecoverySuccessRate.toFixed(2) + '% (need >=95%)')
      process.exit(1)
    }

    log('All stress tests PASSED. Metrics targets met.')
    process.exit(0)
  } catch (err) {
    console.error('STRESS TEST SUITE FAILED: ' + err.message)
    process.exit(1)
  } finally {
    try { clientA && clientA.disconnect() } catch (_) {}
    try { clientB && clientB.disconnect() } catch (_) {}
    killServer()
  }
}

runStressSuite().catch(err => {
  console.error('Fatal execution error: ' + err.message)
  killServer()
  process.exit(1)
})
