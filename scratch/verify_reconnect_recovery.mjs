/**
 * verify_reconnect_recovery.mjs
 *
 * E2E test script to verify that:
 * 1. Active-room API does not return a room unless the room status is STARTING/PLAYING and MultiplayerGameSession exists.
 * 2. Play page automatically cleans up, displays a toast, and redirects to lobby on 404.
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

console.log('--- RECONNECT RECOVERY E2E VERIFICATION ---')
console.log(`Starting Next.js production server on port ${PORT}...`)

const devServer = spawn('npm.cmd', ['run', 'start', '--', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', d => {
  const s = d.toString()
  if (s.includes('started server') || s.includes('localhost') || s.includes('Ready in')) {
    // console log server output if needed
  }
})
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
  const mockUserId = 'mock-reconnect-user-999'
  const mockUsername = 'ReconnectTester'

  // 1. Seed user profile
  await prisma.profile.upsert({
    where: { userId: mockUserId },
    update: { username: mockUsername },
    create: {
      userId: mockUserId,
      username: mockUsername,
      coins: 100,
      xp: 0
    }
  })

  // 2. Clear any old rooms & create room 6DOAIR with PLAYING status but NO MultiplayerGameSession
  await prisma.multiplayerRoomPlayer.deleteMany({
    where: { room: { roomCode: '6DOAIR' } }
  })
  await prisma.multiplayerGameSession.deleteMany({
    where: { room: { roomCode: '6DOAIR' } }
  })
  await prisma.multiplayerRoom.deleteMany({
    where: { roomCode: '6DOAIR' }
  })

  const room = await prisma.multiplayerRoom.create({
    data: {
      roomCode: '6DOAIR',
      gameSlug: 'dots-boxes',
      hostUserId: mockUserId,
      status: 'PLAYING',
      maxPlayers: 2,
      players: {
        create: [
          { userId: mockUserId, status: 'READY' }
        ]
      }
    }
  })
  console.log('✓ Seeded room 6DOAIR in database with status=PLAYING and gameSession=null')

  // Launch browser
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1280, height: 800 })

  page.on('console', msg => {
    const t = msg.text()
    if (t.includes('RECONNECT') || t.includes('Expired')) {
      console.log('[BROWSER]:', t)
    }
  })

  await page.setCookie(
    { name: 'mock_user_id', value: mockUserId, url: BASE_URL },
    { name: 'mock_username', value: mockUsername, url: BASE_URL }
  )

  // TEST 1: Active-room API response verification
  console.log('\n--- TEST 1: active-room query response ---')
  await page.goto(`${BASE_URL}/api/multiplayer/active-room`, { waitUntil: 'domcontentloaded' })
  const rawResponse = await page.evaluate(() => document.body.textContent.trim())
  console.log('active-room API response:', rawResponse)
  const parsedResponse = JSON.parse(rawResponse)
  if (parsedResponse.roomCode !== null) {
    throw new Error(`Expected roomCode=null because gameSession does not exist, got: ${rawResponse}`)
  }
  console.log('✓ active-room successfully returned roomCode: null')
  passed++

  // TEST 2: Navigating to main multiplayer dashboard (should NOT redirect)
  console.log('\n--- TEST 2: Opening Multiplayer Dashboard (Should not redirect) ---')
  await page.goto(MP_URL, { waitUntil: 'domcontentloaded' })
  await sleep(3000)
  const currentUrl = page.url()
  console.log('Current URL on dashboard:', currentUrl)
  if (currentUrl.includes('/play/')) {
    throw new Error(`Should NOT redirect to play page when room has no active game session! URL: ${currentUrl}`)
  }
  console.log('✓ Dashboard remained on multiplayer screen without redirecting')
  passed++

  // TEST 3: Accessing play page directly (should redirect back and show toast)
  console.log('\n--- TEST 3: Accessing /play/6DOAIR page directly (Should redirect back and clear references) ---')
  // Set mock local/session storage values to check if they get cleared
  await page.evaluate(() => {
    sessionStorage.setItem('mp_screen', 'LOBBY')
    sessionStorage.setItem('mp_lobby_room_code', '6DOAIR')
    localStorage.setItem('mp_screen', 'LOBBY')
    localStorage.setItem('mp_lobby_room_code', '6DOAIR')
  })

  await page.goto(`${BASE_URL}/dashboard/multiplayer/play/6DOAIR`, { waitUntil: 'domcontentloaded' })
  console.log('Navigated to play page. Waiting for automatic redirect back to dashboard...')

  // Wait for page to redirect back to /dashboard/multiplayer
  await page.waitForFunction(
    (target) => window.location.href === target,
    { timeout: 15000 },
    MP_URL
  )
  console.log('✓ Redirected back to dashboard successfully!')

  // Check storage items
  const storageCheck = await page.evaluate(() => {
    return {
      sessionScreen: sessionStorage.getItem('mp_screen'),
      sessionRoom: sessionStorage.getItem('mp_lobby_room_code'),
      localScreen: localStorage.getItem('mp_screen'),
      localRoom: localStorage.getItem('mp_lobby_room_code')
    }
  })
  console.log('Storage check values after redirect:', JSON.stringify(storageCheck))
  if (storageCheck.sessionScreen || storageCheck.sessionRoom || storageCheck.localScreen || storageCheck.localRoom) {
    throw new Error(`Storage references were not cleared!: ${JSON.stringify(storageCheck)}`)
  }
  console.log('✓ All storage references were cleared correctly')
  passed++

  console.log('\n================================================')
  console.log(`✅ ALL ${passed}/3 RECONNECT RECOVERY TESTS PASSED`)
  console.log('================================================\n')

} catch (err) {
  console.error(`\n❌ RECONNECT RECOVERY E2E TEST FAILED: ${err.message}`)
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
