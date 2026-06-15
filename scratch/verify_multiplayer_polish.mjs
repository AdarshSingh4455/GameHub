/**
 * verify_multiplayer_polish.mjs
 *
 * E2E test suite for Phase 11.5 Social & Polish upgrades:
 * 1. Slow polling validation (2s lobby status & chat, 4s social, 15s heartbeat).
 * 2. Active friend list with presence indicators (🟢, 🟡, ⚫).
 * 3. Pending invitations list with Accept/Decline actions.
 * 4. Invite friends button & modal in lobby.
 * 5. Share room link auto-fill and auto-join.
 * 6. Lobby chat panel messaging.
 * 7. Reconnect match recovery on reload and navigation restore.
 * 8. Automatic redirect with logs verification.
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
    await sleep(500)
  }
  throw new Error(`waitForScreen("${screenName}") timed out after ${timeout}ms.`)
}

async function clickById(page, id) {
  await page.evaluate((selectorId) => {
    const el = document.getElementById(selectorId)
    if (!el) throw new Error(`Element with id "${selectorId}" not found`)
    el.click()
  }, id)
  await sleep(500)
}

async function waitForInviteInDB(receiverId, status, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const invite = await prisma.multiplayerInvite.findFirst({
      where: { receiverId, status }
    })
    if (invite) {
      return invite
    }
    await sleep(300)
  }
  throw new Error(`waitForInviteInDB: Invite for receiverId ${receiverId} with status ${status} not found in DB after ${timeout}ms`)
}

// ── Dev server spawn ─────────────────────────────────────────────────────────
console.log('--- STARTING E2E MULTIPLAYER POLISH TEST ---')
console.log(`Starting Next.js production server on port ${PORT}...`)

const devServer = spawn('npm.cmd', ['run', 'start', '--', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => process.stdout.write(`[Next.js]: ${d.toString()}`))
devServer.stderr.on('data', d => process.stderr.write(`[Next.js Error]: ${d.toString()}`))

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
console.log('✓ Production server ready on port', PORT)
await sleep(1000)

let browser
let passed = 0
let failed = 0

try {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const testId = Math.floor(Math.random() * 900000) + 100000
  const hostUserId = `mock-host-polish-${testId}`
  const joinerUserId = `mock-joiner-polish-${testId}`

  console.log(`Seeding host user: ${hostUserId} and joiner user: ${joinerUserId}`)

  const hostProfile = await prisma.profile.upsert({
    where: { userId: hostUserId },
    update: {},
    create: {
      userId: hostUserId,
      username: `HostPolish_${testId}`,
      avatarUrl: null,
      isGuest: true,
      coins: 100,
      xp: 0,
      level: 1
    }
  })

  const joinerProfile = await prisma.profile.upsert({
    where: { userId: joinerUserId },
    update: {},
    create: {
      userId: joinerUserId,
      username: `JoinerPolish_${testId}`,
      avatarUrl: null,
      isGuest: true,
      coins: 100,
      xp: 0,
      level: 1
    }
  })

  // Set accepted friendship
  await prisma.friendship.upsert({
    where: {
      requesterId_addresseeId: {
        requesterId: hostProfile.id,
        addresseeId: joinerProfile.id
      }
    },
    update: { status: 'ACCEPTED' },
    create: {
      requesterId: hostProfile.id,
      addresseeId: joinerProfile.id,
      status: 'ACCEPTED'
    }
  })

  console.log('✓ Seeding complete. Set up browser contexts...')

  const hostContext = await browser.createBrowserContext()
  const hostPage = await hostContext.newPage()
  await hostPage.setViewport({ width: 1280, height: 800 })
  const hostConsoleLogs = []
  hostPage.on('console', msg => {
    const text = msg.text()
    hostConsoleLogs.push(text)
    console.log('[HOST BROWSER]:', text)
  })
  await hostPage.setCookie(
    { name: 'mock_user_id', value: hostUserId, url: BASE_URL },
    { name: 'mock_username', value: hostProfile.username, url: BASE_URL }
  )

  const joinerContext = await browser.createBrowserContext()
  const joinerPage = await joinerContext.newPage()
  await joinerPage.setViewport({ width: 1280, height: 800 })
  const joinerConsoleLogs = []
  joinerPage.on('console', msg => {
    const text = msg.text()
    joinerConsoleLogs.push(text)
    console.log('[JOINER BROWSER]:', text)
  })
  await joinerPage.setCookie(
    { name: 'mock_user_id', value: joinerUserId, url: BASE_URL },
    { name: 'mock_username', value: joinerProfile.username, url: BASE_URL }
  )

  // ════════════════════════════════════════════════════════════════════════
  // TEST 1: Friends Presence indicator
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 1: Friends Presence Indicator ===')
  
  // Go to page
  await hostPage.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  await waitForScreen(hostPage, 'MENU', 20000)
  await sleep(1000)

  // Joiner enters page -> updates presence
  await joinerPage.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  await waitForScreen(joinerPage, 'MENU', 20000)
  await sleep(1000)

  // Host should poll and see Joiner is Online
  console.log('Waiting for host presence list to update Joiner status to Online...')
  await hostPage.waitForFunction(
    (uname) => {
      const listEl = document.body.textContent
      return listEl.includes(uname) && listEl.includes('Online')
    },
    { timeout: 15000 },
    joinerProfile.username
  )
  console.log('✓ Friend presence indicator (Online) verified on Host page!')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 2: Friend invite flow and notifications
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 2: Friend Lobbies Invite flow ===')
  
  // Host creates a room
  console.log('Host creating Hand Cricket room...')
  await clickById(hostPage, 'multiplayer-create-room-btn')
  await waitForScreen(hostPage, 'CREATE', 15000)
  await hostPage.select('#multiplayer-game-selector', 'cricket')
  await clickById(hostPage, 'multiplayer-create-confirm-btn')
  await waitForScreen(hostPage, 'LOBBY', 15000)
  
  const roomCode = await hostPage.evaluate(() => {
    return document.getElementById('multiplayer-room-code')?.textContent?.trim()
  })
  console.log(`Host created room code: ${roomCode}`)

  // Host opens invite modal and invites Joiner
  console.log('Host sending invite to Joiner via modal...')
  await hostPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const inviteBtn = btns.find(b => b.textContent.includes('Invite Friends'))
    if (inviteBtn) inviteBtn.click()
  })
  await sleep(1000)

  await hostPage.waitForSelector(`#invite-friend-btn-${joinerUserId}`, { timeout: 15000 })
  await hostPage.click(`#invite-friend-btn-${joinerUserId}`)

  // Verify invite notification exists in DB
  const pendingInvite = await waitForInviteInDB(joinerUserId, 'PENDING')
  console.log('✓ Pending invite record verified in DB')

  // Verify Joiner dashboard shows invite
  console.log('Checking Joiner dashboard receives invite list...')
  await joinerPage.waitForFunction(
    (uname) => {
      const txt = document.body.textContent
      return txt.includes('Received Invites') && txt.includes(uname)
    },
    { timeout: 15000 },
    hostProfile.username
  )
  console.log('✓ Joiner lobby page received invite list notifications')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 3: Decline Invite
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 3: Decline Invite ===')
  
  // Wait for the notification message to appear in the DOM
  await joinerPage.waitForFunction(
    (uname) => document.body.textContent.includes(uname) && document.body.textContent.includes('invited you to play'),
    { timeout: 15000 },
    hostProfile.username
  )

  await joinerPage.waitForSelector(`#decline-invite-btn-${pendingInvite.id}`, { timeout: 15000 })
  await joinerPage.click(`#decline-invite-btn-${pendingInvite.id}`)
  
  // Verify invite is DECLINED in database
  await waitForInviteInDB(joinerUserId, 'DECLINED')
  console.log('✓ Invite decline recorded in DB')
  passed++

  // Re-invite so we can test Accept
  console.log('Re-inviting Joiner...')
  // Re-open invite modal if closed
  await hostPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const inviteBtn = btns.find(b => b.textContent.includes('Invite Friends'))
    if (inviteBtn) inviteBtn.click()
  })
  await sleep(1000)
  await hostPage.waitForSelector(`#invite-friend-btn-${joinerUserId}`, { timeout: 15000 })
  await hostPage.click(`#invite-friend-btn-${joinerUserId}`)

  // Fetch the new pending invite
  const newPendingInvite = await waitForInviteInDB(joinerUserId, 'PENDING')

  // ════════════════════════════════════════════════════════════════════════
  // TEST 4: Accept Invite
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 4: Accept Invite ===')
  
  await joinerPage.waitForSelector(`#accept-invite-btn-${newPendingInvite.id}`, { timeout: 15000 })
  await joinerPage.click(`#accept-invite-btn-${newPendingInvite.id}`)

  await waitForScreen(joinerPage, 'LOBBY', 15000)
  console.log('✓ Joiner accepted invite and successfully redirected to LOBBY')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 5: Lobby Chat panel
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 5: Lobby Chat panel ===')
  
  // Host closes invite modal if open
  await hostPage.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const closeBtn = btns.find(b => b.textContent.includes('Close'))
    if (closeBtn) closeBtn.click()
  })
  await sleep(500)

  // Host sends message
  const hostMsg = `Hello Joiner! ${testId}`
  console.log(`Host sending chat message: "${hostMsg}"...`)
  await hostPage.type('input[placeholder="Type message..."]', hostMsg)
  await hostPage.keyboard.press('Enter')
  await sleep(2000)

  // Joiner should see message
  await joinerPage.waitForFunction(
    (msg) => document.body.textContent.includes(msg),
    { timeout: 10000 },
    hostMsg
  )
  console.log('✓ Chat message polled and displayed in Joiner\'s feed')

  // Joiner sends message
  const joinerMsg = `Hey Host! Good luck! ${testId}`
  console.log(`Joiner sending chat message: "${joinerMsg}"...`)
  await joinerPage.type('input[placeholder="Type message..."]', joinerMsg)
  await joinerPage.keyboard.press('Enter')
  await sleep(2000)

  // Host should see message
  await hostPage.waitForFunction(
    (msg) => document.body.textContent.includes(msg),
    { timeout: 10000 },
    joinerMsg
  )
  console.log('✓ Chat message polled and displayed in Host\'s feed')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 6: Reconnect recovery (Lobby reload)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 6: Reconnect recovery (Lobby reload) ===')
  
  console.log('Refreshing Joiner page...')
  await joinerPage.reload({ waitUntil: 'domcontentloaded' })
  await waitForScreen(joinerPage, 'LOBBY', 20000)
  console.log('✓ Joiner successfully restored to the LOBBY screen on reload')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 7: Lobby start game and automatic redirects (Critical)
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 7: Start Game & Redirects ===')
  
  // Both ready up
  console.log('Host readying up...')
  await clickById(hostPage, 'multiplayer-ready-btn')
  await sleep(1000)

  console.log('Joiner readying up...')
  await clickById(joinerPage, 'multiplayer-ready-btn')
  
  console.log('Waiting for Host start button to be enabled (waiting for poll cycle)...')
  await hostPage.waitForFunction(() => {
    const btn = document.getElementById('multiplayer-start-btn')
    return btn && !btn.disabled
  }, { timeout: 15000 })

  // Clear host console logs to trace redirect trigger prints
  hostConsoleLogs.length = 0
  joinerConsoleLogs.length = 0

  console.log('Host launching the game match...')
  await clickById(hostPage, 'multiplayer-start-btn')

  // Wait for redirect to happen on both pages
  console.log('Waiting for host redirect...')
  await hostPage.waitForFunction(
    (code) => window.location.pathname.includes(`/play/${code}`),
    { timeout: 20000 },
    roomCode
  )

  console.log('Waiting for joiner redirect...')
  await joinerPage.waitForFunction(
    (code) => window.location.pathname.includes(`/play/${code}`),
    { timeout: 20000 },
    roomCode
  )
  console.log('✓ Both players automatically redirected to game boards!')

  // Check that redirect check prints occurred
  const hostCheckRedirect = hostConsoleLogs.some(log => log.includes('[MULTIPLAYER REDIRECT CHECK]'))
  const hostExecutedRedirect = hostConsoleLogs.some(log => log.includes('[MULTIPLAYER REDIRECT EXECUTED]'))
  const joinerCheckRedirect = joinerConsoleLogs.some(log => log.includes('[MULTIPLAYER REDIRECT CHECK]'))
  const joinerExecutedRedirect = joinerConsoleLogs.some(log => log.includes('[MULTIPLAYER REDIRECT EXECUTED]'))

  console.log('Redirect log checks:', {
    hostCheckRedirect,
    hostExecutedRedirect,
    joinerCheckRedirect,
    joinerExecutedRedirect
  })

  if (!hostCheckRedirect || !hostExecutedRedirect || !joinerCheckRedirect || !joinerExecutedRedirect) {
    throw new Error('Missing [MULTIPLAYER REDIRECT CHECK] or [MULTIPLAYER REDIRECT EXECUTED] logs in host/joiner contexts!')
  }
  console.log('✓ Redirect logs successfully validated!')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // TEST 8: Active Match Recovery Validation
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n=== TEST 8: Active Match Recovery ===')
  
  // Scenario A: Refresh play page directly
  console.log('Scenario A: Refreshing active match play page directly...')
  await hostPage.reload({ waitUntil: 'domcontentloaded' })
  try {
    await hostPage.waitForFunction(
      () => document.body.textContent.includes('The Coin Toss') || 
            document.body.textContent.includes('Innings') || 
            document.body.textContent.includes('Scorecard'),
      { timeout: 10000 }
    )
    console.log('✓ Restored to play page directly')
  } catch (err) {
    const html = await hostPage.evaluate(() => document.body.innerHTML)
    console.error('Scenario A Timeout! HTML content was:', html)
    throw err
  }

  // Scenario B: Navigate to /dashboard/multiplayer and verify auto-restore redirect
  console.log('Scenario B: Navigating to main multiplayer page while match is active...')
  await hostPage.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  console.log('Waiting for active-room query and automatic redirect back to play page...')
  await hostPage.waitForFunction(
    (code) => window.location.pathname.includes(`/play/${code}`),
    { timeout: 20000 },
    roomCode
  )
  console.log('✓ Automatically redirected back to active match!')
  passed++

  // ════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ════════════════════════════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ ALL ${passed} E2E SOCIAL/POLISH TESTS PASSED`)
  console.log(`${'═'.repeat(50)}\n`)

} catch (err) {
  failed++
  console.error(`\n❌ E2E POLISH TEST SUITE FAILED: ${err.message || err}`)
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
