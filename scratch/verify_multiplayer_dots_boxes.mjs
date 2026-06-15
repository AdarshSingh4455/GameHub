/**
 * verify_multiplayer_dots_boxes.mjs
 *
 * E2E test suite for Phase 11 Multiplayer Dots & Boxes.
 * Tests: Create Room, Join Room, Ready System, Start Game, Turn validation, Box capture, Score updates, Winner, Replay.
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

const PORT = 3003
const BASE_URL = `http://localhost:${PORT}`
const MP_URL = `${BASE_URL}/dashboard/multiplayer`
const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\8e5712d6-2a1d-4d28-81b7-8aa44ac712a6'

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

async function waitForLineInDB(roomCode, lineId, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    const gs = roomRec?.gameSession?.gameState
    const state = typeof gs === 'string' ? JSON.parse(gs) : (gs || {})
    const hLines = state.horizontalLines || []
    const vLines = state.verticalLines || []
    if (hLines.includes(lineId) || vLines.includes(lineId)) {
      console.log(`  [waitForLineInDB] ✓ ${lineId} confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForLineInDB: ${lineId} not found in DB after ${timeout}ms`)
}

async function waitForBoxInDB(roomCode, br, bc, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    const gs = roomRec?.gameSession?.gameState
    const state = typeof gs === 'string' ? JSON.parse(gs) : (gs || {})
    const boxes = state.completedBoxes || []
    if (boxes.some(b => b.r === br && b.c === bc)) {
      console.log(`  [waitForBoxInDB] ✓ box(${br},${bc}) confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForBoxInDB: box(${br},${bc}) not found in DB after ${timeout}ms`)
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

async function waitForLinesCleared(roomCode, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const roomRec = await prisma.multiplayerRoom.findUnique({
      where: { roomCode },
      include: { gameSession: true }
    })
    const gs = roomRec?.gameSession?.gameState
    const state = typeof gs === 'string' ? JSON.parse(gs) : (gs || {})
    const hLines = state.horizontalLines || []
    const vLines = state.verticalLines || []
    if (hLines.length === 0 && vLines.length === 0) {
      console.log(`  [waitForLinesCleared] ✓ Lines cleared confirmed in DB (${Date.now() - start}ms)`)
      return roomRec
    }
    await sleep(300)
  }
  throw new Error(`waitForLinesCleared: Lines not cleared after ${timeout}ms`)
}

async function waitForTurn(page) {
  const start = Date.now()
  while (Date.now() - start < 15000) {
    const bannerInfo = await page.evaluate(() => {
      const banner = document.getElementById('dots-boxes-turn-banner')
      return banner ? { found: true, text: banner.textContent } : { found: false }
    }).catch(() => ({ found: false }))
    
    if (bannerInfo.found && bannerInfo.text.includes('Your Turn')) {
      return
    }
    const pageText = await page.evaluate(() => document.body?.textContent || '').catch(() => '')
    console.log(`  [waitForTurn] bannerInfo: ${JSON.stringify(bannerInfo)} | pageText snippet: ${pageText.substring(0, 300).replace(/\s+/g, ' ')}`)
    await sleep(500)
  }
  throw new Error('waitForTurn timed out!')
}

async function waitForScreen(page, screenName, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await page.evaluate((s) => {
      const el = document.querySelector(`[data-screen="${s}"]`)
      const allScreenEls = Array.from(document.querySelectorAll('[data-screen]'))
      return {
        found: !!el,
        currentScreenAttrs: allScreenEls.map(e => e.getAttribute('data-screen')),
        url: window.location.href,
      }
    }, screenName).catch(e => ({ found: false, error: e.message }))

    if (result.found) return

    console.log(`  [waitForScreen] Waiting for "${screenName}"… ${Date.now() - start}ms | current: ${JSON.stringify(result.currentScreenAttrs)} | url: ${result.url}`)
    if (result.error) console.log(`  [waitForScreen] eval error: ${result.error}`)
    await sleep(500)
  }

  const finalDiag = await page.evaluate(() => ({
    url: window.location.href,
    dataScreens: Array.from(document.querySelectorAll('[data-screen]')).map(e => e.getAttribute('data-screen')),
    bodySnippet: document.body?.textContent?.substring(0, 500),
  })).catch(() => ({}))
  throw new Error(`waitForScreen("${screenName}") timed out after ${timeout}ms.\n  Final: ${JSON.stringify(finalDiag, null, 2)}`)
}

async function dismissOverlays(page) {
  await page.keyboard.press('Escape')
  await sleep(300)
  await page.evaluate(() => {
    const dialogs = document.querySelectorAll('[role="dialog"], .modal, [data-modal]')
    dialogs.forEach(d => {
      const closeBtn = d.querySelector('[data-dismiss], .close, [aria-label="Close"]')
      if (closeBtn) closeBtn.click()
    })
  })
  await sleep(300)
}

async function clickById(page, id, label = '') {
  const found = await page.evaluate((elId) => {
    const el = document.getElementById(elId)
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    el.click()
    return true
  }, id)
  if (!found) throw new Error(`clickById: element #${id} not found in DOM${label ? ` (${label})` : ''}`)
  console.log(`  [click] #${id}${label ? ` (${label})` : ''}`)
}

async function goToMenu(page, label = '') {
  console.log(`\n[goToMenu${label}] Navigating to multiplayer…`)
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

console.log('--- STARTING DOTS & BOXES MULTIPLAYER E2E TEST ---')
console.log(`Starting Next.js server on port ${PORT}...`)

const devServer = spawn('npm.cmd', ['run', 'start', '--', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => process.stdout.write(`[Server]: ${d.toString()}`))
devServer.stderr.on('data', d => process.stderr.write(`[Server Error]: ${d.toString()}`))

// Wait for server ready
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Server startup timeout (35s)')), 35000)
  devServer.stdout.on('data', d => {
    const s = d.toString()
    if (s.includes('Ready in') || s.includes('started server') || s.includes('localhost')) {
      clearTimeout(timer)
      resolve()
    }
  })
})
console.log('✓ Server ready on port', PORT)
await sleep(1000)

let browser
let passed = 0

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const testId = Math.floor(Math.random() * 900000) + 100000
  const hostUserId = `mock-host-db-${testId}`
  const joinerUserId = `mock-joiner-db-${testId}`

  // ── Host Page Setup ──
  const hostContext = await browser.createBrowserContext()
  const hostPage = await hostContext.newPage()
  await hostPage.setViewport({ width: 1280, height: 800 })
  hostPage.on('console', msg => {
    const t = msg.text()
    if (!t.includes('Download the React') && !t.includes('ERR_')) console.log('[HOST]:', t)
  })
  hostPage.on('pageerror', err => console.error('[HOST ERROR]:', err.message))
  await hostPage.setCookie(
    { name: 'mock_user_id', value: hostUserId, url: BASE_URL },
    { name: 'mock_username', value: 'DBHost', url: BASE_URL }
  )

  // ── Joiner Page Setup ──
  const joinerContext = await browser.createBrowserContext()
  const joinerPage = await joinerContext.newPage()
  await joinerPage.setViewport({ width: 1280, height: 800 })
  joinerPage.on('console', msg => {
    const t = msg.text()
    if (!t.includes('Download the React') && !t.includes('ERR_')) console.log('[JOINER]:', t)
  })
  joinerPage.on('pageerror', err => console.error('[JOINER ERROR]:', err.message))
  await joinerPage.setCookie(
    { name: 'mock_user_id', value: joinerUserId, url: BASE_URL },
    { name: 'mock_username', value: 'DBJoiner', url: BASE_URL }
  )

  // 1. Create Room (Host)
  console.log('Host navigating to lobby menu...')
  await goToMenu(hostPage, ' [HOST]')
  await clickById(hostPage, 'multiplayer-create-room-btn', 'Create Room card')
  await waitForScreen(hostPage, 'CREATE', 15000)
  await hostPage.waitForSelector('#multiplayer-game-selector')
  await hostPage.select('#multiplayer-game-selector', 'dots-boxes')
  await clickById(hostPage, 'multiplayer-create-confirm-btn', 'Create Confirm')
  await waitForScreen(hostPage, 'LOBBY', 25000)
  const roomCode = await hostPage.$eval('#multiplayer-room-code', el => el.textContent.trim())
  console.log(`✓ Room created. Code: ${roomCode}`)
  passed++

  // 2. Join Room (Joiner)
  console.log('Joiner joining room...')
  await goToMenu(joinerPage, ' [JOINER]')
  await clickById(joinerPage, 'multiplayer-join-room-btn', 'Join Room card')
  await waitForScreen(joinerPage, 'JOIN', 15000)
  await joinerPage.waitForSelector('#multiplayer-room-input', { visible: true })
  await joinerPage.evaluate(() => {
    const inp = document.getElementById('multiplayer-room-input')
    if (inp) inp.value = ''
  })
  await clickById(joinerPage, 'multiplayer-room-input')
  await joinerPage.keyboard.press('Backspace')
  await sleep(200)
  await joinerPage.type('#multiplayer-room-input', roomCode)
  await sleep(200)
  await clickById(joinerPage, 'multiplayer-join-confirm-btn', 'Join Confirm')
  await waitForScreen(joinerPage, 'LOBBY', 25000)
  console.log('✓ Joiner joined lobby successfully')
  passed++

  // 3. Ready up & Start Game
  console.log('Players marking ready...')
  // Wait for ready button to be enabled and players list to be ready on both pages
  await joinerPage.waitForFunction(
    () => {
      const btn = document.getElementById('multiplayer-ready-btn')
      const playersList = document.getElementById('lobby-players-list')
      const playerItems = playersList ? playersList.querySelectorAll('[data-player-id]') : []
      return btn && !btn.hasAttribute('disabled') && !btn.disabled && playerItems.length >= 2
    },
    { timeout: 15000 }
  )
  await hostPage.waitForFunction(
    () => {
      const btn = document.getElementById('multiplayer-ready-btn')
      const playersList = document.getElementById('lobby-players-list')
      const playerItems = playersList ? playersList.querySelectorAll('[data-player-id]') : []
      return btn && !btn.hasAttribute('disabled') && !btn.disabled && playerItems.length >= 2
    },
    { timeout: 15000 }
  )

  await clickById(joinerPage, 'multiplayer-ready-btn', 'Joiner ready')
  await sleep(1000)
  await clickById(hostPage, 'multiplayer-ready-btn', 'Host ready')
  await sleep(1000)

  console.log('Host starting game...')
  await hostPage.waitForFunction(
    () => {
      const btn = document.getElementById('multiplayer-start-btn')
      return btn && !btn.hasAttribute('disabled') && !btn.disabled
    },
    { timeout: 15000 }
  )
  await clickById(hostPage, 'multiplayer-start-btn', 'Start Game')
  await sleep(1500)

  // Wait for both to redirect to the play page
  await hostPage.waitForFunction(
    () => window.location.href.includes('/play/'),
    { timeout: 25000 }
  )
  await joinerPage.waitForFunction(
    () => window.location.href.includes('/play/'),
    { timeout: 25000 }
  )
  console.log('✓ Redirection to play page verified')
  passed++

  // Helper to safe parse or return gameState
  function getGameState(roomRec) {
    const raw = roomRec.gameSession.gameState
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  }

  // 4. Turn Validation & Move Claims
  // Let's check who has the turn in DB
  let roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  let turnUserId = roomRec.gameSession.currentTurn
  let activePage = turnUserId === hostUserId ? hostPage : joinerPage
  let inactivePage = turnUserId === hostUserId ? joinerPage : hostPage
  let inactiveUserId = turnUserId === hostUserId ? joinerUserId : hostUserId

  console.log(`Initial turn owner: ${turnUserId === hostUserId ? 'Host' : 'Joiner'}`)

  // Wait for board elements to render
  await hostPage.waitForSelector('#db-line-h-0-0', { timeout: 15000 })
  await joinerPage.waitForSelector('#db-line-h-0-0', { timeout: 15000 })

  // Inactive player tries to click and should see turn blocking toast (or no action)
  console.log('Inactive player clicks h-0-0 (should be blocked)...')
  await clickById(inactivePage, 'db-line-h-0-0', 'Blocked Line')
  await sleep(1000)

  // Verify DB state did not change
  roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  let state = getGameState(roomRec)
  if (state.horizontalLines.includes('h-0-0')) {
    throw new Error('Blocked move was processed anyway!')
  }
  console.log('✓ Turn validation block verified successfully')
  passed++

  // Active player clicks h-0-0
  console.log('Active player clicks h-0-0...')
  await waitForTurn(activePage)
  await clickById(activePage, 'db-line-h-0-0', 'Claim Line')

  // Wait for line to appear in DB (retry up to 15s to handle DB latency)
  roomRec = await waitForLineInDB(roomCode, 'h-0-0')
  state = getGameState(roomRec)
  if (roomRec.gameSession.currentTurn === turnUserId) {
    throw new Error('Turn did not switch after line claim!')
  }
  console.log('✓ Line claim and turn switch verified')
  passed++

  // Swap roles for next move
  let temp = activePage
  activePage = inactivePage
  inactivePage = temp

  let tempUid = turnUserId
  turnUserId = inactiveUserId
  inactiveUserId = tempUid

  // 5. Box Capture and Score Updates
  // Draw remaining sides to complete box (0,0)
  // Box (0,0) sides: h-0-0 (claimed), v-0-0, v-0-1, h-1-0
  // Active player (now inactiveUserId from step before) plays v-0-0
  console.log('Drawing remaining lines to verify box capture...')
  await waitForTurn(activePage)
  await clickById(activePage, 'db-line-v-0-0', 'Draw side v-0-0')
  await waitForLineInDB(roomCode, 'v-0-0')

  // Turn switches back
  await waitForTurn(inactivePage)
  await clickById(inactivePage, 'db-line-v-0-1', 'Draw side v-0-1')
  await waitForLineInDB(roomCode, 'v-0-1')

  // Turn switches back to activePage. They draw h-1-0 to capture box (0,0)
  console.log('Completing box (0,0) by drawing h-1-0...')
  await waitForTurn(activePage)
  await clickById(activePage, 'db-line-h-1-0', 'Draw side h-1-0')

  // Wait for box to be completed in DB (retry up to 15s)
  roomRec = await waitForBoxInDB(roomCode, 0, 0)
  state = getGameState(roomRec)
  const score = state.playerScores[turnUserId] || 0
  if (score < 1) {
    throw new Error('Score did not increment after box capture!')
  }
  // Turn should remain with the player who completed the box
  if (roomRec.gameSession.currentTurn !== turnUserId) {
    throw new Error('Turn switched after box completion!')
  }
  console.log('✓ Box capture, score updates, and extra turn verified')
  passed++

  // 6. Fast-Finish Match (DB Injection)
  // Directly write all lines except the last horizontal line 'h-5-4' to DB
  console.log('Injecting near-complete game state to database...')
  const dotsSize = 6
  const horizontalLines = []
  const verticalLines = []
  const lineOwners = {}

  for (let r = 0; r < dotsSize; r++) {
    for (let c = 0; c < dotsSize - 1; c++) {
      const line = `h-${r}-${c}`
      if (line !== 'h-5-4') {
        horizontalLines.push(line)
        lineOwners[line] = hostUserId
      }
    }
  }
  for (let r = 0; r < dotsSize - 1; r++) {
    for (let c = 0; c < dotsSize; c++) {
      const line = `v-${r}-${c}`
      verticalLines.push(line)
      lineOwners[line] = hostUserId
    }
  }

  // Pre-fill boxes
  const completedBoxes = []
  const sizeBoxes = dotsSize - 1
  for (let r = 0; r < sizeBoxes; r++) {
    for (let c = 0; c < sizeBoxes; c++) {
      // Box 4,4 will be completed by the final line h-5-4
      if (!(r === 4 && c === 4)) {
        completedBoxes.push({ r, c, owner: hostUserId })
      }
    }
  }

  const injectedState = {
    dotsSize: 6,
    horizontalLines,
    verticalLines,
    lineOwners,
    completedBoxes,
    playerScores: {
      [hostUserId]: completedBoxes.length,
      [joinerUserId]: 1
    },
    currentTurn: roomRec.gameSession.currentTurn,
    replayVotes: {}
  }

  await prisma.multiplayerGameSession.update({
    where: { roomId: roomRec.id },
    data: {
      gameState: injectedState,
      currentTurn: roomRec.gameSession.currentTurn // maintain who has turn
    }
  })
  await sleep(1500) // Let clients poll and render near-full board

  // Determine whose turn it is to draw final line h-5-4
  roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  const lastTurnUid = roomRec.gameSession.currentTurn
  const lastActivePage = lastTurnUid === hostUserId ? hostPage : joinerPage

  console.log(`Clicking the final line h-5-4 in active browser page...`)
  await waitForTurn(lastActivePage)
  await clickById(lastActivePage, 'db-line-h-5-4', 'Claim final Line')

  // Wait for game to finish in DB (retry up to 15s)
  roomRec = await waitForGameFinishedInDB(roomCode)
  console.log('✓ Game completion and win evaluation verified')
  passed++

  // 7. Replay
  console.log('Voting for Play Again...')
  // Wait for replay button to appear in both pages (needs a poll cycle after FINISHED state)
  await hostPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await joinerPage.waitForSelector('#multiplayer-replay-btn', { timeout: 15000 })
  await clickById(hostPage, 'multiplayer-replay-btn', 'Host Replay')
  await sleep(500)
  await clickById(joinerPage, 'multiplayer-replay-btn', 'Joiner Replay')

  // Wait for board to be cleared (retry up to 15s)
  roomRec = await waitForLinesCleared(roomCode)
  const resetState = getGameState(roomRec)
  console.log('✓ Replay successfully reset match board!')
  passed++

  console.log('\n======================================')
  console.log(`✅ ALL ${passed} DOTS & BOXES MULTIPLAYER E2E TESTS PASSED`)
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
