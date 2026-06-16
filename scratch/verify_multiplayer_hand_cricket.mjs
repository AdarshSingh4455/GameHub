/**
 * verify_multiplayer_hand_cricket.mjs
 *
 * E2E test suite for Phase 11 Multiplayer Hand Cricket.
 * Tests: Create Room, Join Room, Ready System, Start Game, Toss choice, Innings 1, Innings 2, Winner, Replay.
 *
 * On failure: server is killed, logs show exact failure point.
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

const PORT = 3002
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

/**
 * Wait for a specific data-screen value. Polls every 500ms with diagnostics.
 */
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

/**
 * Dismiss any open modal/overlay (daily claim, etc.) by pressing Escape or clicking outside.
 */
async function dismissOverlays(page) {
  // Press Escape to close any modal
  await page.keyboard.press('Escape')
  await sleep(300)
  // Click body center at a known safe area (far from modals)
  await page.evaluate(() => {
    // Close any element with role=dialog or modal class
    const dialogs = document.querySelectorAll('[role="dialog"], .modal, [data-modal]')
    dialogs.forEach(d => {
      const closeBtn = d.querySelector('[data-dismiss], .close, [aria-label="Close"]')
      if (closeBtn) closeBtn.click()
    })
  })
  await sleep(300)
}

/**
 * Click an element by ID using a synthetic DOM click (bypasses coordinate overlay interception).
 */
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

/**
 * Navigate to the multiplayer menu cleanly.
 */
async function goToMenu(page, label = '') {
  console.log(`\n[goToMenu${label}] Navigating to multiplayer…`)

  // Navigate to about:blank first so we can clear sessionStorage from the right origin
  await page.goto('about:blank', { waitUntil: 'load' })

  // Load the multiplayer page
  await page.goto(MP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })

  // Clear any persisted session state that might restore a non-MENU screen
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('mp_screen')
      sessionStorage.removeItem('mp_lobby_room_code')
      console.log('[E2E] sessionStorage cleared')
    } catch(e) { console.log('[E2E] sessionStorage error:', e.message) }
  })

  // Dismiss any overlays (daily claim modal, toasts, etc.)
  await dismissOverlays(page)

  // Wait for screen to show MENU
  await waitForScreen(page, 'MENU', 30000)
  console.log(`[goToMenu${label}] ✓ MENU confirmed`)
  await sleep(500)
}

// ── Server start ──────────────────────────────────────────────────────────────
console.log('--- STARTING HAND CRICKET MULTIPLAYER E2E TEST ---')
console.log(`Starting Next.js server on port ${PORT}...`)

const devServer = spawn('npx.cmd', ['next', 'dev', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => process.stdout.write(`[Server]: ${d.toString()}`))
devServer.stderr.on('data', d => process.stderr.write(`[Server Error]: ${d.toString()}`))

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
await sleep(1500)

let browser
let passed = 0

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  })

  const testId = Math.floor(Math.random() * 900000) + 100000
  const hostUserId = `mock-host-hc-${testId}`
  const joinerUserId = `mock-joiner-hc-${testId}`

  // ── Host page ──
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
    { name: 'mock_username', value: 'HCHost', url: BASE_URL }
  )

  // ── Joiner page ──
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
    { name: 'mock_username', value: 'HCJoiner', url: BASE_URL }
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Create Room (Host)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 1: Create Room ══════════════════════════════════════════════')
  await goToMenu(hostPage, ' [HOST]')

  await clickById(hostPage, 'multiplayer-create-room-btn', 'Create Room card')
  await waitForScreen(hostPage, 'CREATE', 15000)
  console.log('  → On CREATE screen')

  await hostPage.waitForSelector('#multiplayer-game-selector', { visible: true })
  await hostPage.select('#multiplayer-game-selector', 'cricket')

  await clickById(hostPage, 'multiplayer-create-confirm-btn', 'Create Confirm')
  await waitForScreen(hostPage, 'LOBBY', 25000)

  const roomCode = await hostPage.$eval('#multiplayer-room-code', el => el.textContent.trim())
  console.log(`✓ STEP 1 PASSED — Room created. Code: ${roomCode}`)
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Join Room (Joiner)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 2: Join Room ════════════════════════════════════════════════')
  await goToMenu(joinerPage, ' [JOINER]')

  await clickById(joinerPage, 'multiplayer-join-room-btn', 'Join Room card')
  await waitForScreen(joinerPage, 'JOIN', 15000)
  console.log('  → On JOIN screen')

  // Enter room code via native value setter (forces React state update)
  await joinerPage.waitForSelector('#multiplayer-room-input', { visible: true })
  await joinerPage.evaluate((code) => {
    const inp = document.getElementById('multiplayer-room-input')
    if (!inp) throw new Error('#multiplayer-room-input not found')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(inp, code)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
  }, roomCode)
  await sleep(300)

  const inputVal = await joinerPage.$eval('#multiplayer-room-input', el => el.value)
  console.log(`  Input value: "${inputVal}" (expected: "${roomCode}")`)
  if (inputVal !== roomCode) throw new Error(`Input value mismatch: got "${inputVal}", expected "${roomCode}"`)

  await clickById(joinerPage, 'multiplayer-join-confirm-btn', 'Join Confirm')

  await waitForScreen(joinerPage, 'LOBBY', 25000)
  console.log('✓ STEP 2 PASSED — Joiner in lobby')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Ready up & Start Game
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 3: Ready & Start ════════════════════════════════════════════')

  // Wait for room state to be fully loaded and both players present on both pages
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
  console.log('  Joiner ready')
  await sleep(800)

  await clickById(hostPage, 'multiplayer-ready-btn', 'Host ready')
  console.log('  Host ready')
  await sleep(800)

  // Wait for start button to become enabled (both players ready)
  await hostPage.waitForFunction(
    () => {
      const btn = document.getElementById('multiplayer-start-btn')
      return btn && !btn.hasAttribute('disabled') && !btn.disabled
    },
    { timeout: 15000 }
  )

  await clickById(hostPage, 'multiplayer-start-btn', 'Start Game')
  await sleep(1500)

  // Wait for redirect to play page
  await hostPage.waitForFunction(() => window.location.href.includes('/play/'), { timeout: 25000 })
  await joinerPage.waitForFunction(() => window.location.href.includes('/play/'), { timeout: 25000 })
  console.log(`  Host URL: ${await hostPage.url()}`)
  console.log(`  Joiner URL: ${await joinerPage.url()}`)
  console.log('✓ STEP 3 PASSED — Redirected to play page')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Toss
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 4: Toss ═════════════════════════════════════════════════════')
  await sleep(2000) // let session load

  const roomRec = await prisma.multiplayerRoom.findUnique({
    where: { roomCode },
    include: { gameSession: true }
  })
  if (!roomRec?.gameSession) throw new Error('Game session not found in DB after start')
  const gameState = typeof roomRec.gameSession.gameState === 'string'
    ? JSON.parse(roomRec.gameSession.gameState)
    : roomRec.gameSession.gameState
  const tossWinnerId = gameState.tossWinnerId
  const isHostWinner = tossWinnerId === hostUserId
  const winnerPage = isHostWinner ? hostPage : joinerPage
  console.log(`  Toss winner: ${isHostWinner ? 'Host' : 'Joiner'} (${tossWinnerId})`)

  // Wait for Bat First button on winner's page
  await winnerPage.waitForFunction(
    () => Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Bat First')),
    { timeout: 20000 }
  )
  // Click Bat First via evaluate
  const batClicked = await winnerPage.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Bat First'))
    if (!btn) return false
    btn.click()
    return true
  })
  if (!batClicked) throw new Error('Bat First button not found or not clickable')
  await sleep(1500)
  console.log('✓ STEP 4 PASSED — Toss decided, bat first selected')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5: Innings 1
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 5: Innings 1 ════════════════════════════════════════════════')

  const playBall = async (batNum, bowlNum, expectedDbBalls) => {
    // 1. Wait for DB to transition out of TOSS stage, and wait for balls count to match expectedDbBalls
    let rec
    let state
    const start = Date.now()
    while (Date.now() - start < 15000) {
      rec = await prisma.multiplayerRoom.findUnique({
        where: { roomCode },
        include: { gameSession: true }
      })
      if (!rec?.gameSession) {
        throw new Error('Game session not found in DB during playBall')
      }
      state = typeof rec.gameSession.gameState === 'string'
        ? JSON.parse(rec.gameSession.gameState)
        : rec.gameSession.gameState
      
      if (state.stage !== 'TOSS' && state.balls === expectedDbBalls) {
        break
      }
      await sleep(200)
    }

    if (state.stage === 'TOSS') {
      throw new Error('Timeout waiting for DB stage to transition out of TOSS')
    }
    if (state.balls !== expectedDbBalls) {
      throw new Error(`Timeout waiting for DB balls count to reach ${expectedDbBalls}. Current: ${state.balls}`)
    }

    const batsmanPage = state.battingUserId === hostUserId ? hostPage : joinerPage
    const bowlerPage = state.battingUserId === hostUserId ? joinerPage : hostPage

    // 2. Wait for buttons to be active (not disabled) on both batsman and bowler pages
    await batsmanPage.waitForFunction(
      () => {
        const btn = document.getElementById('cricket-btn-1')
        return btn && !btn.disabled && !btn.hasAttribute('disabled')
      },
      { timeout: 15000 }
    )
    await bowlerPage.waitForFunction(
      () => {
        const btn = document.getElementById('cricket-btn-1')
        return btn && !btn.disabled && !btn.hasAttribute('disabled')
      },
      { timeout: 15000 }
    )

    // 3. Wait for client UI to synchronize with the current innings and ball count
    const dbStage = state.stage
    const dbBalls = state.balls
    const ov = Math.floor(dbBalls / 6)
    const ball = dbBalls % 6
    const overStr = `${ov}.${ball}`

    console.log(`[playBall DEBUG] DB balls: ${dbBalls}, stage: ${dbStage}, expected overStr: ${overStr}`)
    const currentBatsmanText = await batsmanPage.evaluate(() => document.body.textContent)
    console.log(`[playBall DEBUG] Current batsman page text:`, currentBatsmanText.substring(0, 300))

    await batsmanPage.waitForFunction(
      (s, ovStr) => {
        const text = document.body.textContent
        const stageMatch = s === 'FIRST_INNINGS' ? text.includes('FIRST INNINGS') : text.includes('SECOND INNINGS')
        return stageMatch && text.includes(ovStr)
      },
      { timeout: 15000 },
      dbStage,
      overStr
    )
    await bowlerPage.waitForFunction(
      (s, ovStr) => {
        const text = document.body.textContent
        const stageMatch = s === 'FIRST_INNINGS' ? text.includes('FIRST INNINGS') : text.includes('SECOND INNINGS')
        return stageMatch && text.includes(ovStr)
      },
      { timeout: 15000 },
      dbStage,
      overStr
    )

    const batsmanLabel = state.battingUserId === hostUserId ? 'Host' : 'Joiner'
    console.log(`  Ball: ${batsmanLabel} bats ${batNum}, bowler bowls ${bowlNum}`)

    // Click batsman
    await batsmanPage.evaluate((n) => {
      const btn = document.getElementById(`cricket-btn-${n}`)
      if (btn) btn.click()
    }, batNum)
    await sleep(300)

    // Click bowler
    await bowlerPage.evaluate((n) => {
      const btn = document.getElementById(`cricket-btn-${n}`)
      if (btn) btn.click()
    }, bowlNum)

    await sleep(1500)
  }

  // Ball 1: bat=1, bowl=2 → +1 run
  await playBall(1, 2, 0)
  await playBall(2, 2, 1)
  await playBall(3, 3, 2)
  await playBall(4, 4, 3)
  console.log('✓ STEP 5 PASSED — Innings 1 complete')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6: Innings 2
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 6: Innings 2 ════════════════════════════════════════════════')
  await playBall(5, 5, 0) // OUT 1
  await playBall(6, 6, 1) // OUT 2
  await playBall(4, 4, 2) // OUT 3 → Game over
  console.log('✓ STEP 6 PASSED — Innings 2 complete')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7: Winner
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 7: Winner Screen ════════════════════════════════════════════')
  try {
    await hostPage.waitForFunction(
      () => document.body.textContent.includes('Match Won!') ||
            document.body.textContent.includes('Match Lost') ||
            document.body.textContent.includes("It's a Draw!"),
      { timeout: 15000 }
    )
  } catch (err) {
    const text = await hostPage.evaluate(() => document.body.textContent)
    console.error('STEP 7 Timeout: Host Page body text content was:', text)
    throw err
  }
  await hostPage.screenshot({ path: `${outputDir}\\11_hc_match_finished.png` })
  console.log('✓ STEP 7 PASSED — Winner screen displayed')
  passed++

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 8: Replay
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n══ STEP 8: Replay ═══════════════════════════════════════════════════')
  await hostPage.waitForSelector('#multiplayer-replay-btn', { visible: true, timeout: 10000 })
  await hostPage.evaluate(() => document.getElementById('multiplayer-replay-btn')?.click())
  await sleep(500)
  await joinerPage.waitForSelector('#multiplayer-replay-btn', { visible: true, timeout: 10000 })
  await joinerPage.evaluate(() => document.getElementById('multiplayer-replay-btn')?.click())
  await sleep(1500)

  await hostPage.waitForFunction(
    () => document.body.textContent.includes('The Coin Toss'),
    { timeout: 15000 }
  )
  console.log('✓ STEP 8 PASSED — Replay reset to Toss stage')
  passed++

  console.log('\n══════════════════════════════════════════')
  console.log(`✅ ALL ${passed}/8 HAND CRICKET E2E TESTS PASSED`)
  console.log('══════════════════════════════════════════\n')

} catch (err) {
  console.error(`\n❌ E2E FAILED at step ${passed + 1}: ${err.message}`)
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
