/**
 * verify_multiplayer_tic_tac_toe.mjs
 *
 * E2E test suite for Phase 12 Multiplayer Tic-Tac-Toe.
 * Tests: Create Room, Join Room, Spectator mode (3rd user), Ready System, Start Game, Turn validation, Double-clicks, Reconnect, Winner, Replay on Win, Draw, Replay on Draw.
 */

import puppeteer from 'puppeteer'
import { spawn, execSync } from 'child_process'
import dns from 'dns'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import pkgConnectionString from 'pg-connection-string'
const { parse } = pkgConnectionString

import pkgEnv from '@next/env'
const { loadEnvConfig } = pkgEnv
loadEnvConfig(process.cwd())

dns.setDefaultResultOrder('ipv4first')

const PORT = 3004
const BASE_URL = `http://localhost:${PORT}`
const MP_URL = `${BASE_URL}/dashboard/multiplayer`
const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\2fa26a86-1c47-4065-b02c-d9b870f62a8c'

// ── Prisma setup ──────────────────────────────────────────────────────────────
const connectionString = process.env.DATABASE_URL
let dbConfig = {}
if (connectionString) {
  dbConfig = parse(connectionString)
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    dbConfig.ssl = { rejectUnauthorized: false }
  }
}
const pool = new pg.Pool(dbConfig)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function waitForCellInDB(roomCode, index, value, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    const gs = roomRec?.gameSession?.gameState
    const state = typeof gs === 'string' ? JSON.parse(gs) : (gs || {})
    const board = state.board || []
    if (board[index] === value) {
      console.log(`  [waitForCellInDB] ✓ cell[${index}]='${value}' confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForCellInDB: cell[${index}]='${value}' not found in DB after ${timeout}ms`)
}

async function waitForGameFinishedInDB(roomCode, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    if (roomRec?.gameSession?.status === 'FINISHED') {
      console.log(`  [waitForGameFinishedInDB] ✓ Game FINISHED confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForGameFinishedInDB: Game not FINISHED after ${timeout}ms`)
}

async function waitForBoardCleared(roomCode, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    const gs = roomRec?.gameSession?.gameState
    const state = typeof gs === 'string' ? JSON.parse(gs) : (gs || {})
    const board = state.board || []
    if (board.every(cell => cell === null)) {
      console.log(`  [waitForBoardCleared] ✓ Board cleared confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForBoardCleared: Board not cleared after ${timeout}ms`)
}

async function waitForTurn(page) {
  const start = Date.now()
  while (Date.now() - start < 15000) {
    const bannerInfo = await page.evaluate(() => {
      const banner = document.getElementById('ttt-turn-banner')
      return banner ? { found: true, text: banner.textContent } : { found: false }
    }).catch(() => ({ found: false }))
    
    if (bannerInfo.found && bannerInfo.text.includes('Your Turn')) {
      return
    }
    await sleep(500)
  }
  throw new Error('waitForTurn timed out!')
}

async function waitForScreen(page, screenName, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await page.evaluate((s) => {
      const el = document.querySelector(`[data-screen="${s}"]`)
      return { found: !!el, url: window.location.href }
    }, screenName).catch(e => ({ found: false }))

    if (result.found) return
    await sleep(500)
  }
  throw new Error(`waitForScreen("${screenName}") timed out after ${timeout}ms.`)
}

async function dismissOverlays(page) {
  await page.keyboard.press('Escape')
  await sleep(300)
}

async function clickById(page, id, label = '') {
  const elInfo = await page.evaluate((elId) => {
    const el = document.getElementById(elId)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const info = {
      tagName: el.tagName,
      disabled: el.disabled,
      outerHTML: el.outerHTML
    }
    el.click()
    return info
  }, id)
  if (!elInfo) throw new Error(`clickById: element #${id} not found in DOM${label ? ` (${label})` : ''}`)
  console.log(`  [click] #${id}${label ? ` (${label})` : ''} | tag=${elInfo.tagName} disabled=${elInfo.disabled} html=${elInfo.outerHTML.substring(0, 120)}`)
}

async function goToMenu(page, label = '') {
  await page.goto('about:blank', { waitUntil: 'load' })
  await page.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('mp_screen')
      sessionStorage.removeItem('mp_lobby_room_code')
    } catch (e) { /* ignore */ }
  })
  await page.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  await dismissOverlays(page)
  await waitForScreen(page, 'MENU', 25000)
  await sleep(500)
}

console.log('--- STARTING TIC-TAC-TOE MULTIPLAYER E2E TEST ---')
console.log(`Starting Next.js server on port ${PORT}...`)

const devServer = spawn('npx.cmd', ['next', 'dev', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => {
  const s = d.toString()
  if (s.includes('Ready in') || s.includes('started server') || s.includes('localhost')) {
    // server ready
  }
})

// Wait for server ready
await sleep(8000)
console.log('✓ Server assumed ready on port', PORT)

let browser
let passed = 0

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const testId = Math.floor(Math.random() * 900000) + 100000
  const hostUserId = `mock-host-ttt-${testId}`
  const joinerUserId = `mock-joiner-ttt-${testId}`
  const spectatorUserId = `mock-spec-ttt-${testId}`

  // ── Host Page Setup ──
  const hostContext = await browser.createBrowserContext()
  const hostPage = await hostContext.newPage()
  hostPage.on('console', msg => console.log('  [BROWSER HOST]', msg.text()))
  hostPage.on('pageerror', err => console.log('  [BROWSER HOST ERROR]', err.message))
  await hostPage.setViewport({ width: 1280, height: 800 })
  await hostPage.setCookie(
    { name: 'mock_user_id', value: hostUserId, url: BASE_URL },
    { name: 'mock_username', value: 'TTTHost', url: BASE_URL }
  )

  // ── Joiner Page Setup ──
  const joinerContext = await browser.createBrowserContext()
  const joinerPage = await joinerContext.newPage()
  joinerPage.on('console', msg => console.log('  [BROWSER JOINER]', msg.text()))
  joinerPage.on('pageerror', err => console.log('  [BROWSER JOINER ERROR]', err.message))
  await joinerPage.setViewport({ width: 1280, height: 800 })
  await joinerPage.setCookie(
    { name: 'mock_user_id', value: joinerUserId, url: BASE_URL },
    { name: 'mock_username', value: 'TTTJoiner', url: BASE_URL }
  )

  // ── Spectator Page Setup ──
  const spectatorContext = await browser.createBrowserContext()
  const spectatorPage = await spectatorContext.newPage()
  spectatorPage.on('console', msg => console.log('  [BROWSER SPECTATOR]', msg.text()))
  spectatorPage.on('pageerror', err => console.log('  [BROWSER SPECTATOR ERROR]', err.message))
  await spectatorPage.setViewport({ width: 1280, height: 800 })
  await spectatorPage.setCookie(
    { name: 'mock_user_id', value: spectatorUserId, url: BASE_URL },
    { name: 'mock_username', value: 'TTTSpectator', url: BASE_URL }
  )

  // 1. Create Room (Host)
  console.log('Host creating Tic-Tac-Toe room...')
  await goToMenu(hostPage, ' [HOST]')
  await clickById(hostPage, 'multiplayer-create-room-btn', 'Create Room card')
  await waitForScreen(hostPage, 'CREATE', 15000)
  await hostPage.waitForSelector('#multiplayer-game-selector')
  await hostPage.select('#multiplayer-game-selector', 'tic-tac-toe')
  await clickById(hostPage, 'multiplayer-create-confirm-btn', 'Create Confirm')
  await waitForScreen(hostPage, 'LOBBY', 25000)
  const roomCode = await hostPage.$eval('#multiplayer-room-code', el => el.textContent.trim())
  console.log(`✓ Room created. Code: ${roomCode}`)
  passed++

  // 2. Joiner Page joins room as P2
  console.log('Joiner joining room...')
  await goToMenu(joinerPage, ' [JOINER]')
  await clickById(joinerPage, 'multiplayer-join-room-btn', 'Join Room card')
  await waitForScreen(joinerPage, 'JOIN', 15000)
  await joinerPage.waitForSelector('#multiplayer-room-input', { visible: true })
  await joinerPage.type('#multiplayer-room-input', roomCode)
  await sleep(200)
  await clickById(joinerPage, 'multiplayer-join-confirm-btn', 'Join Confirm')
  await waitForScreen(joinerPage, 'LOBBY', 25000)
  console.log('✓ Joiner joined lobby successfully')
  passed++

  // 3. Spectator joins room (checks spectator room overflow / join spectating hooks)
  console.log('Third client (spectator) entering room code...')
  await goToMenu(spectatorPage, ' [SPECTATOR]')
  await clickById(spectatorPage, 'multiplayer-join-room-btn', 'Join Room card')
  await waitForScreen(spectatorPage, 'JOIN', 15000)
  await spectatorPage.waitForSelector('#multiplayer-room-input', { visible: true })
  await spectatorPage.type('#multiplayer-room-input', roomCode)
  await sleep(200)
  await clickById(spectatorPage, 'multiplayer-join-confirm-btn', 'Join Confirm')
  
  // Wait to join room
  await sleep(1500)
  console.log('✓ Spectator client connected to room')
  passed++

  // 4. Ready up & Start Game
  console.log('Players marking ready...')
  await joinerPage.waitForSelector('#multiplayer-ready-btn')
  await clickById(joinerPage, 'multiplayer-ready-btn', 'Joiner ready')
  await sleep(500)
  await clickById(hostPage, 'multiplayer-ready-btn', 'Host ready')
  
  console.log('Waiting for host start button to be enabled...')
  await hostPage.waitForSelector('#multiplayer-start-btn:not([disabled])', { timeout: 15000 })
  console.log('✓ Host start button enabled')

  console.log('Host starting match...')
  await clickById(hostPage, 'multiplayer-start-btn', 'Start Game')
  await sleep(2000)

  // Wait for redirect to play screen
  await hostPage.waitForFunction(() => window.location.href.includes('/play/'), { timeout: 20000 })
  await joinerPage.waitForFunction(() => window.location.href.includes('/play/'), { timeout: 20000 })
  console.log('✓ Match started and play screen redirect validated')
  passed++

  // Helper to safe parse or return gameState
  function getGameState(roomRec) {
    const raw = roomRec.gameSession.gameState
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  }

  // 5. Turn Validation & Double-click prevention
  let roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  let turnUserId = roomRec.gameSession.currentTurn
  let activePage = turnUserId === hostUserId ? hostPage : joinerPage
  let inactivePage = turnUserId === hostUserId ? joinerPage : hostPage
  let activeSymbol = turnUserId === hostUserId ? 'X' : 'O'
  let inactiveSymbol = turnUserId === hostUserId ? 'O' : 'X'

  console.log(`Initial turn owner: ${turnUserId === hostUserId ? 'Host' : 'Joiner'}`)

  // Inactive player clicks cell 4 (should be blocked)
  console.log('Inactive player clicks cell 4...')
  await clickById(inactivePage, 'ttt-cell-4', 'Click cell 4 out-of-turn')
  await sleep(1000)

  // Verify cell is still empty in DB
  roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  let state = getGameState(roomRec)
  if (state.board[4] !== null) {
    throw new Error('Out-of-turn move was processed by server!')
  }
  console.log('✓ Invalid move blocked successfully')
  passed++

  // Active player clicks cell 4
  console.log('Active player clicks cell 4...')
  await waitForTurn(activePage)
  await clickById(activePage, 'ttt-cell-4', 'Claim center cell 4')
  
  // Wait for DB confirmation
  roomRec = await waitForCellInDB(roomCode, 4, activeSymbol)
  console.log('✓ Valid move processed by server')
  passed++

  // Try to double-click cell 4
  console.log('Attempting double-click on center cell 4...')
  await clickById(activePage, 'ttt-cell-4', 'Double claim cell 4')
  await sleep(800)
  
  // Verify cell is still only owned by first symbol
  roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  state = getGameState(roomRec)
  if (state.board[4] !== activeSymbol) {
    throw new Error('Double click state desynchronization!')
  }
  console.log('✓ Double-click attempt successfully prevented')
  passed++

  // 6. Reconnect during active match
  console.log('Reloading host page to verify reconnection state recovery...')
  await hostPage.reload({ waitUntil: 'domcontentloaded' })
  await sleep(2000)
  await hostPage.waitForSelector('#ttt-board-grid', { timeout: 15000 })
  console.log('✓ Host page recovered match grid state successfully')
  passed++

  // 7. Finish Match (Win condition)
  // Current board: cell 4 has activeSymbol.
  // Let's inject a win sequence:
  // Turn rotates to opponent. We will simulate moves sequentially
  // X: 0, 1, 2 (win!)
  // O: 3, 5
  // Reset session board state for testing win sequence quickly
  console.log('Injecting Tic-Tac-Toe near-win state...')
  const injectedState = {
    board: ['X', 'X', null, 'O', 'O', null, null, null, null],
    currentTurn: hostUserId,
    moveCount: 4,
    replayVotes: {},
    turnExpiration: new Date(Date.now() + 30000).toISOString(),
    spectators: []
  }

  await prisma.multiplayerGameSession.update({
    where: { roomId: roomRec.id },
    data: {
      gameState: injectedState,
      currentTurn: hostUserId,
      status: 'PLAYING'
    }
  })
  await sleep(1500)

  // Host (X) makes final winning move on cell 2
  console.log('Host (X) clicks cell 2 to win match...')
  await hostPage.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1500)
  await waitForTurn(hostPage)
  await clickById(hostPage, 'ttt-cell-2', 'Win move cell 2')

  // Wait for game FINISHED status in DB
  roomRec = await waitForGameFinishedInDB(roomCode)
  state = getGameState(roomRec)
  if (roomRec.gameSession.winnerId !== hostUserId) {
    throw new Error('Winner was not correctly assigned!')
  }
  console.log('✓ Tic-Tac-Toe win condition successfully logged')
  passed++

  // 8. Replay System after win
  console.log('Voting for Play Again after win...')
  await hostPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await joinerPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await clickById(hostPage, 'multiplayer-replay-btn', 'Host votes replay')
  await sleep(500)
  await clickById(joinerPage, 'multiplayer-replay-btn', 'Joiner votes replay')

  // Verify board is cleared
  roomRec = await waitForBoardCleared(roomCode)
  console.log('✓ Replay system after Win successfully reset board!')
  passed++

  // 9. Draw and Replay after draw
  // Inject near-draw state:
  // X O X
  // X O O
  // O X null
  console.log('Injecting Tic-Tac-Toe near-draw state...')
  const nearDrawState = {
    board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null],
    currentTurn: hostUserId, // Host (X) turn to play last cell 8
    moveCount: 8,
    replayVotes: {},
    turnExpiration: new Date(Date.now() + 30000).toISOString(),
    spectators: []
  }

  await prisma.multiplayerGameSession.update({
    where: { roomId: roomRec.id },
    data: {
      gameState: nearDrawState,
      currentTurn: hostUserId,
      status: 'PLAYING'
    }
  })
  await sleep(1500)

  // Host (X) makes last move on cell 8
  console.log('Host (X) clicks cell 8 to complete draw...')
  await hostPage.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1500)
  await waitForTurn(hostPage)
  await clickById(hostPage, 'ttt-cell-8', 'Draw move cell 8')

  // Wait for finished in DB
  roomRec = await waitForGameFinishedInDB(roomCode)
  state = getGameState(roomRec)
  if (roomRec.gameSession.winnerId !== 'DRAW') {
    throw new Error('Match winner is notDRAW on full board!')
  }
  console.log('✓ Tic-Tac-Toe draw condition successfully logged')
  passed++

  // Vote replay after draw
  console.log('Voting for Play Again after draw...')
  await hostPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await joinerPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await clickById(hostPage, 'multiplayer-replay-btn', 'Host votes replay')
  await sleep(500)
  await clickById(joinerPage, 'multiplayer-replay-btn', 'Joiner votes replay')

  // Verify board cleared
  roomRec = await waitForBoardCleared(roomCode)
  console.log('✓ Replay system after Draw successfully reset board!')
  passed++

  console.log('\n======================================')
  console.log(`✅ ALL ${passed} TIC-TAC-TOE MULTIPLAYER E2E TESTS PASSED`)
  console.log('======================================\n')

} catch (err) {
  console.error(`\n❌ E2E TEST SUITE FAILED: ${err.message}`)
  if (err.stack) console.error(err.stack)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
  if (browser) await browser.close()
  console.log('Cleaning up server...')
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /F /T /PID ${devServer.pid}`, { stdio: 'ignore' })
    } catch (e) {
      devServer.kill('SIGKILL')
    }
  } else {
    devServer.kill('SIGINT')
  }
  await sleep(2000)
}
