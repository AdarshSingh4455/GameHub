/**
 * verify_multiplayer_room_flow.mjs
 *
 * E2E test suite for Phase 10 Multiplayer Foundation.
 * Tests: Create Room, Join Room, Lobby, Ready System, Host Transfer, Cleanup.
 *
 * Runs against a Next.js dev server on port 3001 with MOCK_AUTH=true.
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

const PORT = 3001
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Dump the current page state to console for debugging.
 * Shows URL, title, all visible buttons, inputs, selects, and data-screen attr.
 */
async function debugPageState(page, label = '') {
  try {
    const info = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].map(b => ({
        id: b.id || '(no id)',
        text: b.textContent.trim().substring(0, 40),
        disabled: b.disabled
      }))
      const inputs = [...document.querySelectorAll('input')].map(i => ({
        id: i.id || '(no id)',
        type: i.type,
        name: i.name || '(no name)'
      }))
      const selects = [...document.querySelectorAll('select')].map(s => ({
        id: s.id || '(no id)',
        name: s.name || '(no name)',
        options: s.options.length
      }))
      const screen = document.querySelector('[data-screen]')?.getAttribute('data-screen') || 'unknown'
      return { url: location.href, title: document.title, screen, btns, inputs, selects }
    })
    console.log(`\n[E2E DEBUG${label ? ' – ' + label : ''}]`)
    console.log(`  URL: ${info.url}`)
    console.log(`  SCREEN attr: ${info.screen}`)
    console.log(`  TITLE: ${info.title}`)
    console.log(`  BUTTONS: ${info.btns.map(b => `[${b.id}]${b.text}${b.disabled ? '(disabled)' : ''}`).join(', ')}`)
    console.log(`  INPUTS: ${info.inputs.map(i => `[${i.id}/${i.name}]type=${i.type}`).join(', ')}`)
    console.log(`  SELECTS: ${info.selects.map(s => `[${s.id}/${s.name}]${s.options}opts`).join(', ')}`)
  } catch (e) {
    console.log(`[E2E DEBUG${label ? ' – ' + label : ''}] Error reading page state: ${e.message}`)
  }
}

/**
 * Wait for a specific data-screen attribute value.
 */
async function waitForScreen(page, screenName, timeout = 20000) {
  await page.waitForFunction(
    (s) => document.querySelector(`[data-screen="${s}"]`) !== null,
    { timeout },
    screenName
  )
}

/**
 * Navigate to multiplayer page, clearing sessionStorage first to reset state.
 */
async function goToMenu(page) {
  // Navigate first — sessionStorage is origin-scoped, can't access on about:blank
  await page.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  // Now clear session state so component starts at MENU
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('mp_screen')
      sessionStorage.removeItem('mp_lobby_room_code')
    } catch (e) { /* ignore */ }
  })
  // Reload so the component re-initialises with cleared storage
  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForScreen(page, 'MENU', 20000)
  await sleep(800)
}

// ── Dev server ────────────────────────────────────────────────────────────────
console.log('--- STARTING E2E MULTIPLAYER TEST SUITE ---')
console.log(`Starting Next.js production server on port ${PORT}...`)

const devServer = spawn('npx.cmd', ['next', 'dev', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => process.stdout.write(`[Next.js]: ${d.toString()}`))
devServer.stderr.on('data', d => process.stderr.write(`[Next.js Error]: ${d.toString()}`))

// Wait for server ready
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Server startup timeout (30s)')), 30000)
  devServer.stdout.on('data', d => {
    const s = d.toString()
    if (s.includes('Ready in') || s.includes('started server') || s.includes('localhost')) {
      clearTimeout(timer)
      resolve()
    }
  })
})
console.log('✓ Production server ready on port', PORT)
await sleep(1000)

// ── Test suite ────────────────────────────────────────────────────────────────
let browser
let passed = 0
let failed = 0

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const testId = Math.floor(Math.random() * 900000) + 100000
  const hostUserId = `mock-host-id-${testId}`
  const joinerUserId = `mock-joiner-id-${testId}`

  // ── Browser contexts ──────────────────────────────────────────────────────
  const hostContext = await browser.createBrowserContext()
  const hostPage = await hostContext.newPage()
  await hostPage.setViewport({ width: 1280, height: 800 })
  hostPage.on('console', msg => console.log('[HOST BROWSER]:', msg.text()))
  hostPage.on('pageerror', err => console.error('[HOST EXCEPTION]:', err.message))
  await hostPage.setCookie(
    { name: 'mock_user_id', value: hostUserId, url: BASE_URL },
    { name: 'mock_username', value: 'HostPlayer', url: BASE_URL }
  )

  const joinerContext = await browser.createBrowserContext()
  const joinerPage = await joinerContext.newPage()
  await joinerPage.setViewport({ width: 1280, height: 800 })
  joinerPage.on('console', msg => console.log('[JOINER BROWSER]:', msg.text()))
  joinerPage.on('pageerror', err => console.error('[JOINER EXCEPTION]:', err.message))
  await joinerPage.setCookie(
    { name: 'mock_user_id', value: joinerUserId, url: BASE_URL },
    { name: 'mock_username', value: 'JoinerPlayer', url: BASE_URL }
  )

  // ════════════════════════════════════════════════════════════════════════
  // TEST 1: Create Room
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 1: Create Room ===')

  console.log('Navigating to Multiplayer page (host)...')
  await goToMenu(hostPage)
  await hostPage.screenshot({ path: `${outputDir}\\01_host_menu.png` })
  console.log('✓ Menu screen loaded')
  await debugPageState(hostPage, 'MENU')

  console.log('Clicking Create Room...')
  await hostPage.click('#multiplayer-create-room-btn')
  await waitForScreen(hostPage, 'CREATE', 10000)
  await sleep(500)
  await debugPageState(hostPage, 'CREATE screen')

  // Wait for game selector to appear
  await hostPage.waitForSelector('#multiplayer-game-selector', { timeout: 10000 })
  await hostPage.select('#multiplayer-game-selector', 'cricket')
  console.log('✓ Game selector found and cricket selected')

  // Set max players to 2 (so full-room test works with just 3 people)
  await hostPage.evaluate(() => {
    const slider = document.getElementById('multiplayer-maxplayers-selector')
    if (slider) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeInputValueSetter.call(slider, '2')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
      slider.dispatchEvent(new Event('change', { bubbles: true }))
    }
  })
  await sleep(300)
  await hostPage.screenshot({ path: `${outputDir}\\02_host_create_config.png` })
  console.log('✓ Max players set to 2')

  console.log('Clicking Create Room confirm...')
  await hostPage.click('#multiplayer-create-confirm-btn')

  // Wait for LOBBY screen + room code to appear
  await waitForScreen(hostPage, 'LOBBY', 20000)
  await hostPage.waitForSelector('#multiplayer-room-code', { timeout: 15000 })
  const roomCode = await hostPage.$eval('#multiplayer-room-code', el => el.textContent.trim())
  console.log(`✓ Room created. Code: ${roomCode}`)
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 2: Host appears in lobby with crown badge
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 2: Host appears in lobby ===')
  
  // Add diagnostics before line 227
  await hostPage.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id)
    const screens = Array.from(document.querySelectorAll('[data-screen]')).map(el => el.getAttribute('data-screen'))
    console.log('[DIAGNOSTICS BEFORE LINE 227]', JSON.stringify({
      url: window.location.href,
      pathname: window.location.pathname,
      innerTextSnippet: document.body?.innerText?.slice(0, 1000),
      ids,
      screens
    }, null, 2))
  })

  // Wait for the host player card to appear in the lobby (keyed by data-player-id)
  await hostPage.waitForFunction(
    (uid) => {
      const list = document.querySelector('#lobby-players-list')
      return list && list.querySelector(`[data-player-id="${uid}"]`) !== null
    },
    { timeout: 15000 },
    hostUserId
  )
  await hostPage.waitForSelector(`#host-badge-${hostUserId}`, { timeout: 15000 })
  await hostPage.screenshot({ path: `${outputDir}\\03_host_in_lobby.png` })
  console.log('✓ Host appears in lobby with crown badge 👑')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 3: Copy room code
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 3: Copy room code ===')
  await hostPage.click('#multiplayer-copy-code-btn')
  await sleep(500)
  console.log('✓ Copy room code button clicked')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 4: Invalid room code blocked
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 4: Invalid room code blocked ===')
  await goToMenu(joinerPage)
  await joinerPage.click('#multiplayer-join-room-btn')
  await waitForScreen(joinerPage, 'JOIN', 10000)
  await joinerPage.waitForSelector('#multiplayer-room-input', { timeout: 10000 })
  await joinerPage.type('#multiplayer-room-input', 'XXXXXX')
  await joinerPage.screenshot({ path: `${outputDir}\\04_joiner_invalid_code.png` })
  await joinerPage.click('#multiplayer-join-confirm-btn')
  await joinerPage.waitForFunction(
    () => document.body.textContent.toLowerCase().includes('invalid room') ||
          document.body.textContent.toLowerCase().includes('not found') ||
          document.body.textContent.toLowerCase().includes('room not found'),
    { timeout: 15000 }
  )
  console.log('✓ Invalid room code correctly blocked')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 5: Joiner joins valid room
  // ════════════════════════════════════════════════════════════════════════
  console.log(`\n=== TEST 5: Joiner joins room ${roomCode} ===`)
  await joinerPage.click('#multiplayer-join-room-btn')
  await waitForScreen(joinerPage, 'JOIN', 10000)
  await joinerPage.waitForSelector('#multiplayer-room-input', { timeout: 10000 })
  // Clear the input field
  await joinerPage.evaluate(() => {
    const inp = document.getElementById('multiplayer-room-input')
    if (inp) inp.value = ''
  })
  await joinerPage.click('#multiplayer-room-input', { clickCount: 3 })
  await joinerPage.keyboard.press('Backspace')
  await joinerPage.type('#multiplayer-room-input', roomCode)
  await joinerPage.screenshot({ path: `${outputDir}\\05_joiner_valid_code.png` })
  await joinerPage.click('#multiplayer-join-confirm-btn')

  await waitForScreen(joinerPage, 'LOBBY', 20000)
  // Both player cards must be visible (checked by data-player-id, not fragile username text)
  await joinerPage.waitForFunction(
    (hId, jId) => {
      const list = document.querySelector('#lobby-players-list')
      return list &&
        list.querySelector(`[data-player-id="${hId}"]`) !== null &&
        list.querySelector(`[data-player-id="${jId}"]`) !== null
    },
    { timeout: 20000 },
    hostUserId,
    joinerUserId
  )
  await joinerPage.screenshot({ path: `${outputDir}\\06_joiner_in_lobby.png` })
  console.log('✓ Joiner joined lobby. Both players visible.')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 6: Full room blocked (room maxPlayers=2)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 6: Full room blocked ===')
  const thirdContext = await browser.createBrowserContext()
  const thirdPage = await thirdContext.newPage()
  await thirdPage.setCookie(
    { name: 'mock_user_id', value: `mock-player3-id-${testId}`, url: BASE_URL },
    { name: 'mock_username', value: 'ThirdPlayer', url: BASE_URL }
  )
  await goToMenu(thirdPage)
  await thirdPage.click('#multiplayer-join-room-btn')
  await waitForScreen(thirdPage, 'JOIN', 10000)
  await thirdPage.waitForSelector('#multiplayer-room-input', { timeout: 10000 })
  await thirdPage.type('#multiplayer-room-input', roomCode)
  await thirdPage.click('#multiplayer-join-confirm-btn')
  await thirdPage.waitForFunction(
    () => document.body.textContent.toLowerCase().includes('full') ||
          document.body.textContent.toLowerCase().includes('maximum') ||
          document.body.textContent.toLowerCase().includes('room is full'),
    { timeout: 15000 }
  )
  console.log('✓ Full room correctly blocked')
  await thirdContext.close()
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 7: Start button disabled until all ready
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 7: Start button disabled ===')
  await hostPage.waitForSelector('#multiplayer-start-btn', { timeout: 15000 })
  const isDisabledBefore = await hostPage.$eval('#multiplayer-start-btn', el => el.disabled)
  if (!isDisabledBefore) throw new Error('Start button was enabled before all players ready!')
  console.log('✓ Start button is disabled (not all ready)')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 8: Ready toggle sync
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 8: Ready toggle sync ===')
  // Joiner marks ready
  await joinerPage.click('#multiplayer-ready-btn')
  // Wait for joiner's ready status to appear in both views
  await joinerPage.waitForFunction(
    (uid) => {
      const el = document.getElementById(`ready-status-${uid}`)
      return el && el.textContent.includes('READY')
    },
    { timeout: 15000 },
    joinerUserId
  )
  // Wait for host view to see joiner ready
  await hostPage.waitForFunction(
    (uid) => {
      const el = document.getElementById(`ready-status-${uid}`)
      return el && el.textContent.includes('READY')
    },
    { timeout: 15000 },
    joinerUserId
  )
  await joinerPage.screenshot({ path: `${outputDir}\\07_joiner_ready.png` })
  console.log('✓ Ready status synced across clients')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 9: Start enabled after all ready
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 9: Start enabled after all ready ===')
  // Host marks ready
  await hostPage.click('#multiplayer-ready-btn')
  // Wait for start button to become enabled
  await hostPage.waitForFunction(
    () => {
      const btn = document.getElementById('multiplayer-start-btn')
      return btn && !btn.disabled
    },
    { timeout: 15000 }
  )
  await hostPage.screenshot({ path: `${outputDir}\\08_host_start_ready.png` })
  console.log('✓ Start button now enabled (all players ready)')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 10: Start game
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 10: Start game ===')
  await hostPage.click('#multiplayer-start-btn')
  await sleep(2000)

  // Add diagnostics
  await hostPage.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id)
    const testids = Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid'))
    console.log('[DIAGNOSTICS BEFORE LINE 382]', JSON.stringify({
      url: window.location.href,
      pathname: window.location.pathname,
      innerTextSnippet: document.body?.innerText?.slice(0, 1000),
      ids,
      testids
    }, null, 2))
  })

  // Wait for redirect to the play page (URL changes to /multiplayer/play/...)
  await hostPage.waitForFunction(
    () => window.location.pathname.includes('/multiplayer/play/'),
    { timeout: 20000 }
  )
  await hostPage.screenshot({ path: `${outputDir}\\09_game_started.png` })
  console.log('✓ Game started! Redirected to play page.')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 11: Host transfer when host leaves
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 11: Host transfer ===')

  // Both players are on the play page. Mark them as LEFT in the DB via Prisma
  // so that /api/multiplayer/active-room returns null and reconnect recovery won't fire.
  const currentRoom = await prisma.multiplayerRoom.findUnique({ where: { roomCode } })
  if (currentRoom) {
    await prisma.multiplayerRoomPlayer.updateMany({
      where: { roomId: currentRoom.id, userId: { in: [hostUserId, joinerUserId] } },
      data: { status: 'LEFT' }
    })
    // Also mark the room as FINISHED so it's fully cleared
    await prisma.multiplayerRoom.update({
      where: { id: currentRoom.id },
      data: { status: 'FINISHED' }
    })
  }
  console.log('[TEST 11] Marked both players as LEFT and room as FINISHED')
  await sleep(300)

  // Now navigate to menu — reconnect recovery will find no active room
  await goToMenu(hostPage)
  await hostPage.click('#multiplayer-create-room-btn')
  await waitForScreen(hostPage, 'CREATE', 10000)
  await hostPage.waitForSelector('#multiplayer-create-confirm-btn', { timeout: 10000 })
  await hostPage.click('#multiplayer-create-confirm-btn')

  await waitForScreen(hostPage, 'LOBBY', 20000)
  await hostPage.waitForSelector('#multiplayer-room-code', { timeout: 15000 })
  const newRoomCode = await hostPage.$eval('#multiplayer-room-code', el => el.textContent.trim())
  console.log(`New room for host transfer test: ${newRoomCode}`)

  // Joiner goes to menu, then joins new room via join API
  await goToMenu(joinerPage)
  await sleep(500)

  await joinerPage.click('#multiplayer-join-room-btn')
  await waitForScreen(joinerPage, 'JOIN', 10000)
  await joinerPage.waitForSelector('#multiplayer-room-input', { timeout: 10000 })
  // Clear any residual text in input before typing new code
  await joinerPage.evaluate(() => {
    const inp = document.getElementById('multiplayer-room-input')
    if (inp) inp.value = ''
  })
  await joinerPage.click('#multiplayer-room-input', { clickCount: 3 })
  await joinerPage.keyboard.press('Backspace')
  await sleep(200)
  // Debug: check room status directly before join
  const roomStatusCheck = await fetch(`${BASE_URL}/api/multiplayer/room/${newRoomCode}`)
  const roomStatusData = await roomStatusCheck.json()
  console.log(`[DEBUG] New room status: ${roomStatusData.room?.status}, players: ${roomStatusData.players?.length}`)

  // Add joiner directly to the new WAITING room via Prisma
  // (bypasses join-room API — we already tested join-room in Test 5)
  const newRoomRecord = await prisma.multiplayerRoom.findUnique({ where: { roomCode: newRoomCode } })
  if (!newRoomRecord) throw new Error(`New room ${newRoomCode} not found in DB`)
  await prisma.multiplayerRoomPlayer.upsert({
    where: { roomId_userId: { roomId: newRoomRecord.id, userId: joinerUserId } },
    update: { status: 'NOT_READY' },
    create: { roomId: newRoomRecord.id, userId: joinerUserId, status: 'NOT_READY' }
  })
  console.log(`[DEBUG] Joiner directly added to room ${newRoomCode} via Prisma`)

  // Navigate joiner to the lobby screen with the new room code
  await joinerPage.evaluate((code) => {
    try {
      sessionStorage.setItem('mp_screen', 'LOBBY')
      sessionStorage.setItem('mp_lobby_room_code', code)
    } catch (e) {}
  }, newRoomCode)
  await joinerPage.reload({ waitUntil: 'domcontentloaded' })
  await waitForScreen(joinerPage, 'LOBBY', 20000)
  await joinerPage.waitForFunction(
    (hId, jId) => {
      const list = document.querySelector('#lobby-players-list')
      return list &&
        list.querySelector(`[data-player-id="${hId}"]`) !== null &&
        list.querySelector(`[data-player-id="${jId}"]`) !== null
    },
    { timeout: 15000 },
    hostUserId,
    joinerUserId
  )
  console.log('Both players in new room. Host leaving...')

  // Host leaves → joiner becomes host
  await hostPage.click('#multiplayer-leave-btn')

  await joinerPage.waitForFunction(
    (joinerUid, hostUid) => {
      const badge = document.getElementById(`host-badge-${joinerUid}`)
      const list = document.querySelector('#lobby-players-list')
      // Joiner has crown badge AND old host card is gone
      return badge !== null && list && list.querySelector(`[data-player-id="${hostUid}"]`) === null
    },
    { timeout: 20000 },
    joinerUserId,
    hostUserId
  )
  await joinerPage.screenshot({ path: `${outputDir}\\10_host_transferred.png` })
  console.log('✓ Host transfer verified. Joiner is now host!')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 12: Room cleanup logic
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 12: Room cleanup ===')
  const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
  const oldRoomCode = `OLD${testId}`
  const oldHostId = `mock-host-cleanup-${testId}`

  // Ensure the old host profile exists
  await prisma.profile.upsert({
    where: { userId: oldHostId },
    update: {},
    create: {
      userId: oldHostId,
      username: `CleanupHost_${testId}`,
      avatarUrl: null,
      isGuest: true,
      coins: 0,
      xp: 0,
      level: 1
    }
  })

  // Create expired room directly in DB
  await prisma.multiplayerRoom.create({
    data: {
      roomCode: oldRoomCode,
      gameSlug: 'cricket',
      hostUserId: oldHostId,
      status: 'WAITING',
      createdAt: oneDayAgo,
      updatedAt: oneDayAgo,
      lastActivityAt: oneDayAgo
    }
  })
  console.log(`Seeded expired room: ${oldRoomCode}`)

  const cleanupRes = await fetch(`${BASE_URL}/api/multiplayer/cleanup`, { method: 'POST' })
  if (!cleanupRes.ok) throw new Error('Cleanup API call failed')
  const cleanupData = await cleanupRes.json()
  console.log(`Cleanup API response: ${JSON.stringify(cleanupData)}`)

  const roomAfter = await prisma.multiplayerRoom.findUnique({ where: { roomCode: oldRoomCode } })
  if (roomAfter) throw new Error('Expired room was NOT deleted by cleanup!')
  console.log('✓ Expired room deleted by cleanup')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ ALL ${passed} E2E TESTS PASSED`)
  console.log(`${'═'.repeat(50)}\n`)

} catch (err) {
  failed++
  console.error(`\n❌ E2E TEST SUITE FAILED: ${err.message || err}`)
  if (err.stack) console.error(err.stack)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
  if (browser) await browser.close()
  console.log('Shutting down Next.js dev server...')
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
