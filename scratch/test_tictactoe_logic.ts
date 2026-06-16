import { processTicTacToeMove } from '../server/src/games/ticTacToe'
import { redisClient } from '../server/src/utils/redis'

// Mock Redis client properties and functions
Object.defineProperty(redisClient, 'isReady', {
  get: () => true,
  configurable: true
})

const sessions: Record<string, string> = {}

redisClient.get = async (key: string) => {
  return sessions[key] || null
}

redisClient.set = async (key: string, value: string) => {
  sessions[key] = value
  return 'OK'
}

redisClient.del = async (key: string) => {
  delete sessions[key]
  return 1
}

async function runTests() {
  console.log('🧪 RUNNING TIC-TAC-TOE ENGINE UNIT TESTS...')
  
  const players = [
    { userId: 'player-x', username: 'Player X' },
    { userId: 'player-o', username: 'Player O' }
  ]
  
  // Mock Prisma Client
  const mockPrisma = {
    multiplayerGameSession: {
      findUnique: async () => null,
      update: async ({ where, data }: any) => {
        // Mock DB update success
        return { id: 'session-id', ...data }
      }
    },
    game: {
      findUnique: async () => ({ id: 'game-id' })
    }
  }

  let testPassed = 0
  let testFailed = 0

  function assert(condition: boolean, msg: string) {
    if (condition) {
      testPassed++
      console.log(`  ✓ PASSED: ${msg}`)
    } else {
      testFailed++
      console.error(`  ❌ FAILED: ${msg}`)
    }
  }

  // --- Test Case 1: Initial move and turn rotation ---
  try {
    const roomCode = 'TEST1'
    const roomId = 'room-id-1'
    const key = `game:tic-tac-toe:${roomCode}`
    
    // Initial game state
    sessions[key] = JSON.stringify({
      board: Array(9).fill(null),
      currentTurn: 'player-x',
      moveCount: 0,
      replayVotes: {},
      turnExpiration: null,
      spectators: []
    })

    const res1 = await processTicTacToeMove(roomCode, roomId, 'player-x', { index: 4 }, players, mockPrisma)
    assert(res1.state.board[4] === 'X', 'Player X claims middle cell')
    assert(res1.state.currentTurn === 'player-o', 'Turn rotates to Player O')
    assert(res1.state.moveCount === 1, 'Move count increments')
    assert(res1.state.turnExpiration !== null, 'Turn timer expiration timestamp is set')
  } catch (err: any) {
    console.error('Test Case 1 Error:', err.message)
    testFailed++
  }

  // --- Test Case 2: Out of turn move attempt ---
  try {
    const roomCode = 'TEST2'
    const roomId = 'room-id-2'
    const key = `game:tic-tac-toe:${roomCode}`
    
    sessions[key] = JSON.stringify({
      board: Array(9).fill(null),
      currentTurn: 'player-x',
      moveCount: 0,
      replayVotes: {},
      turnExpiration: null,
      spectators: []
    })

    // Player O attempts to play when it is Player X's turn
    await processTicTacToeMove(roomCode, roomId, 'player-o', { index: 4 }, players, mockPrisma)
    assert(false, 'Should throw an error when playing out of turn')
  } catch (err: any) {
    assert(err.message === "It's not your turn", 'Throws error on out-of-turn play')
  }

  // --- Test Case 3: Play on already claimed cell ---
  try {
    const roomCode = 'TEST3'
    const roomId = 'room-id-3'
    const key = `game:tic-tac-toe:${roomCode}`
    
    sessions[key] = JSON.stringify({
      board: [null, null, null, null, 'X', null, null, null, null],
      currentTurn: 'player-o',
      moveCount: 1,
      replayVotes: {},
      turnExpiration: null,
      spectators: []
    })

    // Player O attempts to play on cell index 4 (already X)
    await processTicTacToeMove(roomCode, roomId, 'player-o', { index: 4 }, players, mockPrisma)
    assert(false, 'Should throw an error when playing on claimed cell')
  } catch (err: any) {
    assert(err.message === 'Cell already claimed', 'Throws error on double claim')
  }

  // --- Test Case 4: Winning detection (horizontal row 0) ---
  try {
    const roomCode = 'TEST4'
    const roomId = 'room-id-4'
    const key = `game:tic-tac-toe:${roomCode}`
    
    sessions[key] = JSON.stringify({
      board: ['X', 'X', null, 'O', 'O', null, null, null, null],
      currentTurn: 'player-x',
      moveCount: 4,
      replayVotes: {},
      turnExpiration: null,
      spectators: []
    })

    const res4 = await processTicTacToeMove(roomCode, roomId, 'player-x', { index: 2 }, players, mockPrisma)
    assert(res4.gameFinished === true, 'Game is detected as finished')
    assert(res4.winnerId === 'player-x', 'Winner is detected as player-x')
    assert(res4.state.winningLine.join(',') === '0,1,2', 'Winning line row 0 is logged')
    assert(sessions[key] === undefined, 'Active Redis session cache is cleared on finish')
  } catch (err: any) {
    console.error('Test Case 4 Error:', err.message)
    testFailed++
  }

  // --- Test Case 5: Draw detection ---
  try {
    const roomCode = 'TEST5'
    const roomId = 'room-id-5'
    const key = `game:tic-tac-toe:${roomCode}`
    
    // Board is 8 cells full, waiting for last cell
    sessions[key] = JSON.stringify({
      board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null],
      currentTurn: 'player-x',
      moveCount: 8,
      replayVotes: {},
      turnExpiration: null,
      spectators: []
    })

    const res5 = await processTicTacToeMove(roomCode, roomId, 'player-x', { index: 8 }, players, mockPrisma)
    assert(res5.gameFinished === true, 'Game is detected as finished')
    assert(res5.winnerId === 'DRAW', 'Winner is detected as DRAW')
    assert(res5.state.board[8] === 'X', 'Last cell is claimed')
    assert(sessions[key] === undefined, 'Active Redis session cache is cleared on draw')
  } catch (err: any) {
    console.error('Test Case 5 Error:', err.message)
    testFailed++
  }

  console.log(`\n📊 UNIT TESTS SUMMARY: ${testPassed} Passed, ${testFailed} Failed`)
  if (testFailed > 0) {
    process.exit(1)
  }
}

runTests()
