// Unit tests for Scribble logic validation
import { getScribbleMaskedState, setupNextScribbleTurn } from '../server/src/games/scribble'
import assert from 'assert'

// Mock dependencies
const mockPrisma = {
  profile: {
    findUnique: async () => ({ id: 'mock-user' }),
    update: async () => ({})
  },
  multiplayerGameSession: {
    update: async () => ({})
  },
  multiplayerRoom: {
    update: async () => ({})
  }
}

const mockIo = {
  to: () => ({
    emit: () => {}
  })
}

async function runTests() {
  console.log('🧪 Starting Scribble Rotation and Hint unit tests...')

  // -------------------------------------------------------------
  // Test 1: 2-player turn progression
  // -------------------------------------------------------------
  {
    const players = [
      { userId: 'player-a', username: 'PlayerA', status: 'READY' },
      { userId: 'player-b', username: 'PlayerB', status: 'READY' }
    ]
    const state = {
      round: 1,
      maxRounds: 3,
      drawerIndex: 0,
      drawerRotation: ['player-a', 'player-b'],
      drawerId: 'player-a',
      stage: 'WORD_SELECTION',
      commentary: [],
      timerStart: Date.now()
    }

    console.log('  1. Testing 2-player round completion criteria...')
    
    // Player A finishes turn, transition to next turn
    await setupNextScribbleTurn('ROOM1', 'room-id-1', state, players, mockPrisma, mockIo)
    
    // Round should still be 1 (Player B needs to draw)
    assert.strictEqual(state.round, 1)
    assert.strictEqual(state.drawerIndex, 1)
    assert.strictEqual(state.drawerId, 'player-b')
    console.log('     [PASS] Turn 1 -> Turn 2 rotation successful. Round remains 1.')

    // Player B finishes turn, transition to next turn
    await setupNextScribbleTurn('ROOM1', 'room-id-1', state, players, mockPrisma, mockIo)
    
    // Both players have drawn once, so round increments to 2
    assert.strictEqual(state.round, 2)
    assert.strictEqual(state.drawerIndex, 0)
    assert.strictEqual(state.drawerId, 'player-a')
    console.log('     [PASS] Turn 2 -> Turn 3 wrap successful. Round incremented to 2.')
  }

  // -------------------------------------------------------------
  // Test 2: 3-player rotation skipping disconnected players
  // -------------------------------------------------------------
  {
    const players = [
      { userId: 'player-a', username: 'PlayerA', status: 'READY' },
      { userId: 'player-b', username: 'PlayerB', status: 'DISCONNECTED' }, // disconnected!
      { userId: 'player-c', username: 'PlayerC', status: 'READY' }
    ]
    const state = {
      round: 1,
      maxRounds: 3,
      drawerIndex: 0,
      drawerRotation: ['player-a', 'player-b', 'player-c'],
      drawerId: 'player-a',
      stage: 'WORD_SELECTION',
      commentary: [],
      timerStart: Date.now()
    }

    console.log('  2. Testing 3-player rotation with disconnected player...')
    
    // Player A finishes drawing, setup next turn
    await setupNextScribbleTurn('ROOM1', 'room-id-1', state, players, mockPrisma, mockIo)
    
    // Player B is skipped because they are DISCONNECTED.
    // Turn should skip directly to Player C (index 2).
    assert.strictEqual(state.drawerIndex, 2)
    assert.strictEqual(state.drawerId, 'player-c')
    assert.strictEqual(state.round, 1)
    console.log('     [PASS] Skipped disconnected Player B. Turn assigned directly to Player C.')
  }

  // -------------------------------------------------------------
  // Test 3: Round counter capping (No Round 4/3)
  // -------------------------------------------------------------
  {
    const players = [
      { userId: 'player-a', username: 'PlayerA', status: 'READY' },
      { userId: 'player-b', username: 'PlayerB', status: 'READY' }
    ]
    const state = {
      round: 3,
      maxRounds: 3,
      drawerIndex: 1, // Last player drawing in final round
      drawerRotation: ['player-a', 'player-b'],
      drawerId: 'player-b',
      stage: 'DRAWING',
      commentary: [],
      timerStart: Date.now(),
      playerScores: { 'player-a': 100, 'player-b': 200 }
    }

    console.log('  3. Testing max round capping on game finish...')
    
    await setupNextScribbleTurn('ROOM1', 'room-id-1', state, players, mockPrisma, mockIo)
    
    // Game should finish and stage become FINISHED
    assert.strictEqual(state.stage, 'FINISHED')
    // Round counter capped at maxRounds (3) instead of leaking to 4
    assert.strictEqual(state.round, 3)
    console.log('     [PASS] Game ended. Round counter capped correctly at 3/3.')
  }

  // -------------------------------------------------------------
  // Test 4: Progressive hints capped at 50% max letters
  // -------------------------------------------------------------
  {
    console.log('  4. Testing progressive hint reveals with 50% length cap...')
    const word = 'CHOCOLATE' // Length 9, 50% cap = Math.floor(9/2) = 4 letters
    const state = {
      selectedWord: word,
      timerDuration: 60, // 60 seconds duration
      timerStart: Date.now(),
      stage: 'DRAWING'
    }

    // A: 10% time elapsed -> revealPct = 0% -> 0 letters
    state.timerStart = Date.now() - 6000
    let masked = getScribbleMaskedState(state, 'some-user')
    let revealedCount = masked.hintString.replace(/\s/g, '').split('').filter(c => c !== '_').length
    assert.strictEqual(revealedCount, 0)
    console.log(`     [PASS] 10% time: Word masked state = "${masked.hintString}" (${revealedCount} letters revealed)`)

    // B: 30% time elapsed -> revealPct = 20% -> 1 letter (9 * 0.2 = 1.8 -> floor = 1)
    state.timerStart = Date.now() - 18000
    masked = getScribbleMaskedState(state, 'some-user')
    revealedCount = masked.hintString.replace(/\s/g, '').split('').filter(c => c !== '_').length
    assert.strictEqual(revealedCount, 1)
    console.log(`     [PASS] 30% time: Word masked state = "${masked.hintString}" (${revealedCount} letters revealed)`)

    // C: 60% time elapsed -> revealPct = 35% -> 3 letters (9 * 0.35 = 3.15 -> floor = 3)
    state.timerStart = Date.now() - 36000
    masked = getScribbleMaskedState(state, 'some-user')
    revealedCount = masked.hintString.replace(/\s/g, '').split('').filter(c => c !== '_').length
    assert.strictEqual(revealedCount, 3)
    console.log(`     [PASS] 60% time: Word masked state = "${masked.hintString}" (${revealedCount} letters revealed)`)

    // D: 80% time elapsed -> revealPct = 50% -> 4 letters (9 * 0.5 = 4.5 -> floor = 4, capped at 4)
    state.timerStart = Date.now() - 48000
    masked = getScribbleMaskedState(state, 'some-user')
    revealedCount = masked.hintString.replace(/\s/g, '').split('').filter(c => c !== '_').length
    assert.strictEqual(revealedCount, 4)
    console.log(`     [PASS] 80% time: Word masked state = "${masked.hintString}" (${revealedCount} letters revealed)`)
  }

  console.log('\n✅ All unit verification tests completed successfully!')
}

runTests().catch(err => {
  console.error('❌ Verification test failed:', err)
  process.exit(1)
})
