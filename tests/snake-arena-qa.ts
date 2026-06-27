import { tickSnakeArena } from '../server/src/games/snakeArena'
import type { SnakeArenaState } from '../src/lib/snakeArenaTypes'
import * as assert from 'assert'

console.log('🤖 Starting Snake Arena QA Server Physics Engine Tests...\n')

// Helper to create a base mock game state
function createMockState(): SnakeArenaState {
  return {
    cols: 60,
    rows: 40,
    snakes: {
      'player-1': {
        userId: 'player-1',
        username: 'P1',
        body: [
          { x: 10, y: 10 },
          { x: 9, y: 10 },
          { x: 8, y: 10 }
        ],
        direction: { x: 1, y: 0 },
        length: 3,
        score: 0,
        eliminations: 0,
        survivalTime: 0,
        status: 'ACTIVE',
        color: '#ff0000',
        spawnProtectedUntil: 0, // No spawn protection
        activePowerups: []
      },
      'player-2': {
        userId: 'player-2',
        username: 'P2',
        body: [
          { x: 20, y: 20 },
          { x: 21, y: 20 },
          { x: 22, y: 20 }
        ],
        direction: { x: -1, y: 0 },
        length: 3,
        score: 0,
        eliminations: 0,
        survivalTime: 0,
        status: 'ACTIVE',
        color: '#0000ff',
        spawnProtectedUntil: 0,
        activePowerups: []
      }
    },
    foods: [],
    powerups: [],
    tickCount: 0,
    status: 'PLAYING',
    winnerId: null,
    replayVotes: {},
    spectators: [],
    startTime: Date.now(),
    mapTheme: 'classic'
  }
}

// TEST 1: Basic movement coordinate updates
function testMovement() {
  console.log('Test 1: Snake movement coordinate updates')
  const state = createMockState()
  const { state: nextState } = tickSnakeArena(state)

  const p1 = nextState.snakes['player-1']
  const p2 = nextState.snakes['player-2']

  // P1 moving right: {10,10} -> {11,10}
  assert.strictEqual(p1.body[0].x, 11)
  assert.strictEqual(p1.body[0].y, 10)
  assert.strictEqual(p1.body[1].x, 10)
  assert.strictEqual(p1.body[2].x, 9)

  // P2 moving left: {20,20} -> {19,20}
  assert.strictEqual(p2.body[0].x, 19)
  assert.strictEqual(p2.body[0].y, 20)

  console.log('✅ Passed: Coordinate updates correct.')
}

// TEST 2: Food collection & growth
function testFoodEating() {
  console.log('\nTest 2: Food collection and segment growth')
  const state = createMockState()
  
  // Place normal food directly in path of P1 head's next step ({11,10})
  state.foods.push({
    id: 'food-test',
    x: 11,
    y: 10,
    type: 'normal',
    value: 10
  })

  const { state: nextState } = tickSnakeArena(state)
  const p1 = nextState.snakes['player-1']

  // Should eat and grow length to 4
  assert.strictEqual(p1.length, 4)
  assert.strictEqual(p1.body.length, 4)
  assert.strictEqual(p1.score, 10)
  assert.strictEqual(nextState.foods.filter(f => f.id === 'food-test').length, 0)

  console.log('✅ Passed: Growth and score increments correct.')
}

// TEST 3: Wall collision elimination
function testWallCollision() {
  console.log('\nTest 3: Wall collision elimination')
  const state = createMockState()
  // Put P1 head at border edge, facing out of bounds
  state.snakes['player-1'].body[0] = { x: 59, y: 10 }
  state.snakes['player-1'].direction = { x: 1, y: 0 }

  const { state: nextState } = tickSnakeArena(state)
  const p1 = nextState.snakes['player-1']

  assert.strictEqual(p1.status, 'ELIMINATED')
  console.log('✅ Passed: Snake correctly eliminated on boundary hit.')
}

// TEST 4: Self collision elimination
function testSelfCollision() {
  console.log('\nTest 4: Self collision elimination')
  const state = createMockState()
  // Loop P1 head directly into its body segment
  state.snakes['player-1'].body = [
    { x: 10, y: 10 },
    { x: 11, y: 10 },
    { x: 11, y: 11 },
    { x: 10, y: 11 }
  ]
  state.snakes['player-1'].direction = { x: 1, y: 0 } // moves into {11, 10}

  const { state: nextState } = tickSnakeArena(state)
  const p1 = nextState.snakes['player-1']

  assert.strictEqual(p1.status, 'ELIMINATED')
  console.log('✅ Passed: Snake correctly eliminated on self-collision.')
}

// TEST 5: Body-to-body overlap does NOT eliminate
function testBodyOverlap() {
  console.log('\nTest 5: Body-to-body overlap non-elimination')
  const state = createMockState()
  
  // Arrange bodies so segments overlap but heads do not hit anything
  state.snakes['player-1'].body = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ]
  state.snakes['player-2'].body = [
    { x: 12, y: 12 },
    { x: 9, y: 10 }, // Overlaps segment 1 of P1
    { x: 8, y: 10 }
  ]

  const { state: nextState } = tickSnakeArena(state)
  assert.strictEqual(nextState.snakes['player-1'].status, 'ACTIVE')
  assert.strictEqual(nextState.snakes['player-2'].status, 'ACTIVE')
  console.log('✅ Passed: Segments overlap does not cause elimination.')
}

// TEST 6: Head-to-head priority resolution based on length
function testHeadToHeadCollision() {
  console.log('\nTest 6: Head-to-head collision priority resolution')

  // Case A: Equal length - both die
  {
    const state = createMockState()
    // Heads meet at {15, 10}
    state.snakes['player-1'].body = [{ x: 14, y: 10 }, { x: 13, y: 10 }]
    state.snakes['player-1'].direction = { x: 1, y: 0 }
    
    state.snakes['player-2'].body = [{ x: 16, y: 10 }, { x: 17, y: 10 }]
    state.snakes['player-2'].direction = { x: -1, y: 0 }

    const { state: nextState } = tickSnakeArena(state)
    assert.strictEqual(nextState.snakes['player-1'].status, 'ELIMINATED')
    assert.strictEqual(nextState.snakes['player-2'].status, 'ELIMINATED')
    console.log('   - Equal length: both die... passed.')
  }

  // Case B: Longer snake survives
  {
    const state = createMockState()
    // P1 (3 segments) vs P2 (4 segments) meeting at {15, 10}
    state.snakes['player-1'].body = [{ x: 14, y: 10 }, { x: 13, y: 10 }, { x: 12, y: 10 }]
    state.snakes['player-1'].direction = { x: 1, y: 0 }
    
    state.snakes['player-2'].body = [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }, { x: 19, y: 10 }]
    state.snakes['player-2'].direction = { x: -1, y: 0 }

    const { state: nextState } = tickSnakeArena(state)
    assert.strictEqual(nextState.snakes['player-1'].status, 'ELIMINATED')
    assert.strictEqual(nextState.snakes['player-2'].status, 'ACTIVE')
    assert.strictEqual(nextState.snakes['player-2'].eliminations, 1)
    console.log('   - Longer snake survives: P2 survives, P1 dies... passed.')
  }

  console.log('✅ Passed: Head-to-head collisions correctly resolved.')
}

// Run all test methods
try {
  testMovement()
  testFoodEating()
  testWallCollision()
  testSelfCollision()
  testBodyOverlap()
  testHeadToHeadCollision()
  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! SERVER ENGINE PHYSICS VALIDATED.')
} catch (e) {
  console.error('\n❌ TEST RUNNER FAILURE:', e)
  process.exit(1)
}
