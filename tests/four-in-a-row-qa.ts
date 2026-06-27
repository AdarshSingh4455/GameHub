// Connect Four E2E Logic and AI Verification Suite
import { processFourInARowMove } from '../server/src/games/fourInARow'
import { getFourInARowMove } from '../src/lib/gameAI'

interface TestPlayer {
  userId: string
  username: string
}

const mockPlayers: TestPlayer[] = [
  { userId: 'player-1', username: 'Alice' },
  { userId: 'player-2', username: 'Bob' }
]

const sessionDb = new Map<string, any>()

const mockPrisma: any = {
  multiplayerRoom: {
    findUnique: async () => ({
      id: 'room-id',
      gameSlug: 'four-in-a-row',
      status: 'ACTIVE'
    })
  },
  multiplayerGameSession: {
    findUnique: async ({ where }: any) => {
      const state = sessionDb.get(where.roomId)
      if (!state) return null
      return {
        roomId: where.roomId,
        gameState: state
      }
    },
    upsert: async ({ where, create, update }: any) => {
      const state = update.gameState || create.gameState
      sessionDb.set(where.roomId, state)
      return { roomId: where.roomId, gameState: state }
    },
    update: async ({ where, data }: any) => {
      const state = data.gameState
      sessionDb.set(where.roomId, state)
      return { roomId: where.roomId, gameState: state }
    }
  }
}

function getInitialState(hostId = 'player-1') {
  return {
    board: Array(42).fill(null),
    currentTurn: hostId,
    winningLine: [],
    winnerId: null,
    status: 'ACTIVE',
    replayVotes: {}
  }
}

async function runTests() {
  console.log('🧪 CONNECT FOUR QA LOGIC VERIFICATION')
  let passed = true

  // 1. Horizontal Win Test
  try {
    sessionDb.clear()
    sessionDb.set('room-id', getInitialState())

    let state: any
    const moves = [
      { col: 0, p: 'player-1' }, // R
      { col: 0, p: 'player-2' }, // Y
      { col: 1, p: 'player-1' }, // R
      { col: 1, p: 'player-2' }, // Y
      { col: 2, p: 'player-1' }, // R
      { col: 2, p: 'player-2' }, // Y
      { col: 3, p: 'player-1' }, // R (wins!)
    ]

    for (const m of moves) {
      const res = await processFourInARowMove('ROOM1', 'room-id', m.p, { column: m.col }, mockPlayers, mockPrisma)
      state = res.state
    }

    const expectedLine = [35, 36, 37, 38] // lowest row horizontal line 0, 1, 2, 3
    const isWin = state.winnerId === 'player-1' && JSON.stringify(state.winningLine.sort()) === JSON.stringify(expectedLine)

    if (isWin) {
      console.log('✅ TEST 1 PASSED: Horizontal Win detected correctly.')
    } else {
      console.log('❌ TEST 1 FAILED: Horizontal Win not detected.', state)
      passed = false
    }
  } catch (err) {
    console.error('❌ TEST 1 EXCEPTION:', err)
    passed = false
  }

  // 2. Vertical Win Test
  try {
    sessionDb.clear()
    sessionDb.set('room-id', getInitialState())

    let state: any
    const moves = [
      { col: 0, p: 'player-1' }, // R row 5
      { col: 1, p: 'player-2' }, // Y row 5
      { col: 0, p: 'player-1' }, // R row 4
      { col: 1, p: 'player-2' }, // Y row 4
      { col: 0, p: 'player-1' }, // R row 3
      { col: 1, p: 'player-2' }, // Y row 3
      { col: 0, p: 'player-1' }, // R row 2 (wins!)
    ]

    for (const m of moves) {
      const res = await processFourInARowMove('ROOM2', 'room-id', m.p, { column: m.col }, mockPlayers, mockPrisma)
      state = res.state
    }

    const expectedLine = [14, 21, 28, 35] // column 0 vertical (rows 2, 3, 4, 5)
    const isWin = state.winnerId === 'player-1' && JSON.stringify(state.winningLine.sort()) === JSON.stringify(expectedLine)

    if (isWin) {
      console.log('✅ TEST 2 PASSED: Vertical Win detected correctly.')
    } else {
      console.log('❌ TEST 2 FAILED: Vertical Win not detected.', state)
      passed = false
    }
  } catch (err) {
    console.error('❌ TEST 2 EXCEPTION:', err)
    passed = false
  }

  // 3. Diagonal Up-Right Win Test
  try {
    sessionDb.clear()
    sessionDb.set('room-id', getInitialState())

    let state: any
    const moves = [
      { col: 0, p: 'player-1' }, // R (0,5)
      { col: 1, p: 'player-2' }, // Y (1,5)
      { col: 1, p: 'player-1' }, // R (1,4)
      { col: 2, p: 'player-2' }, // Y (2,5)
      { col: 2, p: 'player-1' }, // R (2,4)
      { col: 3, p: 'player-2' }, // Y (3,5)
      { col: 2, p: 'player-1' }, // R (2,3)
      { col: 3, p: 'player-2' }, // Y (3,4)
      { col: 3, p: 'player-1' }, // R (3,3)
      { col: 0, p: 'player-2' }, // Y (0,4)
      { col: 3, p: 'player-1' }, // R (3,2) (wins diagonally!)
    ]

    for (const m of moves) {
      const res = await processFourInARowMove('ROOM3', 'room-id', m.p, { column: m.col }, mockPlayers, mockPrisma)
      state = res.state
    }

    const expectedLine = [17, 23, 29, 35] // (3,2), (2,3), (1,4), (0,5) -> indexes 17, 23, 29, 35
    const isWin = state.winnerId === 'player-1' && JSON.stringify(state.winningLine.sort()) === JSON.stringify(expectedLine)

    if (isWin) {
      console.log('✅ TEST 3 PASSED: Diagonal Up-Right Win detected correctly.')
    } else {
      console.log('❌ TEST 3 FAILED: Diagonal Up-Right Win not detected.', state)
      passed = false
    }
  } catch (err) {
    console.error('❌ TEST 3 EXCEPTION:', err)
    passed = false
  }

  // 4. Invalid Move / Full Column Prevention Test
  try {
    sessionDb.clear()
    sessionDb.set('room-id', getInitialState())

    for (let i = 0; i < 6; i++) {
      const p = i % 2 === 0 ? 'player-1' : 'player-2'
      await processFourInARowMove('ROOM4', 'room-id', p, { column: 0 }, mockPlayers, mockPrisma)
    }

    try {
      await processFourInARowMove('ROOM4', 'room-id', 'player-1', { column: 0 }, mockPlayers, mockPrisma)
      console.log('❌ TEST 4 FAILED: Full column did not throw error.')
      passed = false
    } catch (e: any) {
      if (e.message && e.message.toLowerCase().includes('full')) {
        console.log('✅ TEST 4 PASSED: Invalid move (full column) prevented correctly.')
      } else {
        console.log('❌ TEST 4 FAILED: Wrong exception message.', e.message)
        passed = false
      }
    }
  } catch (err) {
    console.error('❌ TEST 4 EXCEPTION:', err)
    passed = false
  }

  // 5. Minimax AI Difficulty Test
  try {
    // Single-ended 3-in-a-row blocking test:
    // Player has X at col 0, col 1, col 2 (lowest row 5: indexes 35, 36, 37)
    // CPU must play at col 3 (index 38) to block player from winning.
    const testBoard = Array(42).fill(null)
    testBoard[35] = 'X' // Player disc col 0 row 5
    testBoard[36] = 'X' // Player disc col 1 row 5
    testBoard[37] = 'X' // Player disc col 2 row 5

    const aiMoveCol = getFourInARowMove(testBoard, 'hard', 'O')
    console.log(`[DEBUG] AI chose column: ${aiMoveCol}`)
    
    if (aiMoveCol === 3) {
      console.log('✅ TEST 5 PASSED: Hard AI strategically blocks opponent (picked col 3).')
    } else {
      console.log(`❌ TEST 5 FAILED: Hard AI failed to block opponent (picked col ${aiMoveCol}, expected 3).`)
      passed = false
    }
  } catch (err) {
    console.error('❌ TEST 5 EXCEPTION:', err)
    passed = false
  }

  if (passed) {
    console.log('\n🌟 ALL QA LOGIC TESTS COMPLETED SUCCESSFULLY!')
    process.exit(0)
  } else {
    console.log('\n🚨 SOME QA LOGIC TESTS FAILED!')
    process.exit(1)
  }
}

runTests()
