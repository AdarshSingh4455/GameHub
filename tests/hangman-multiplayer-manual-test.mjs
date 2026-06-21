/**
 * GameHub Hangman Multiplayer Manual-Test Runner
 * 
 * Verifies room creation, joining, readying, starting match, word submission, and active gameplay.
 * Runs using the compiled server/dist/index.js.
 */

import puppeteer from 'puppeteer'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

const BASE_URL = 'http://localhost:3000'
const WS_URL   = 'http://localhost:5000'
const OUT_DIR  = path.join(process.cwd(), 'test-proofs')
const WAIT     = (ms) => new Promise(r => setTimeout(r, ms))

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const log = (msg) => {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

let devServer, wsServer
const servers = []

// Reset mock DB and seed all necessary test data
async function startServers() {
  const dbPath = path.join(process.cwd(), 'node_modules', '.cache', 'mock_db_state.json')

  log('Force-clearing ports 3000 and 5000 before starting servers...')
  try {
    execSync('powershell -ExecutionPolicy Bypass -File scripts/kill-ports.ps1', { stdio: 'ignore' })
  } catch (e) {}
  await WAIT(3000)

  log('Pre-seeding mock DB state...')
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const initialProfiles = {
    'test-user-a': {
      id: 'test-user-a',
      userId: 'test-user-a',
      username: 'TestUserA',
      avatarUrl: null,
      friendCode: 'GH-AAAAA0001',
      xp: 5000,
      level: 15,
      coins: 99999,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      currentRank: null,
      previousRank: null,
      _count: { wonMatches: 2, friends: 1 }
    },
    'test-user-b': {
      id: 'test-user-b',
      userId: 'test-user-b',
      username: 'TestUserB',
      avatarUrl: null,
      friendCode: 'GH-BBBBB0002',
      xp: 4000,
      level: 12,
      coins: 99999,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-02').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      currentRank: null,
      previousRank: null,
      _count: { wonMatches: 1, friends: 1 }
    }
  }

  const initialFriendships = {
    'friendship-ab': {
      id: 'friendship-ab',
      requesterId: 'test-user-a',
      addresseeId: 'test-user-b',
      status: 'ACCEPTED',
      createdAt: new Date('2024-02-01').toISOString(),
      updatedAt: new Date().toISOString(),
      requester: { ...initialProfiles['test-user-a'] },
      addressee: { ...initialProfiles['test-user-b'] }
    }
  }

  const initialDbState = {
    profiles: initialProfiles,
    rooms: {},
    sessions: {},
    friendships: initialFriendships,
    invites: {},
    notifications: {}
  }

  fs.writeFileSync(dbPath, JSON.stringify(initialDbState, null, 2), 'utf8')

  log('Starting Next.js dev server...')
  devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3000'], {
    env: { ...process.env, MOCK_AUTH: 'true', NODE_ENV: 'development' },
    shell: true,
    stdio: 'pipe'
  })
  devServer.stdout.on('data', d => {
    const s = d.toString().trim()
    if (s && s.includes('Ready')) log(`[Next.js Ready] ${s.slice(0, 100)}`)
  })
  servers.push(devServer)

  log('Starting compiled WebSocket server (using server/dist/index.js)...')
  wsServer = spawn('node', ['server/dist/index.js'], {
    env: { ...process.env, PORT: '5000', MOCK_AUTH: 'true', NODE_ENV: 'development' },
    shell: true,
    stdio: 'pipe'
  })
  wsServer.stdout.on('data', d => log(`[WS] ${d.toString().trim().slice(0, 100)}`))
  wsServer.stderr.on('data', d => log(`[WS ERR] ${d.toString().trim().slice(0, 100)}`))
  servers.push(wsServer)

  log('Waiting for Next.js to be ready...')
  const { default: http } = await import('http')
  const isReady = () => new Promise(resolve => {
    const req = http.get('http://localhost:3000', res => { res.resume(); resolve(true) })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => { req.destroy(); resolve(false) })
  })

  let ready = false
  for (let i = 0; i < 45; i++) {
    await WAIT(2000)
    ready = await isReady()
    if (ready) {
      log(`✅ Next.js ready after ${(i + 1) * 2}s`)
      break
    }
  }

  if (!ready) throw new Error('Next.js server did not start within 90s')
  await WAIT(2000)
}

async function prewarmPages() {
  log('\n🔥 Pre-warming pages (triggering on-demand Next.js compilation)...')
  const { default: http } = await import('http')
  const pages = [
    '/',
    '/dashboard',
    '/dashboard/multiplayer',
    '/dashboard/friends',
    '/api/friends',
    '/api/profile/details',
    '/api/multiplayer/notifications',
  ]
  for (const p of pages) {
    await new Promise(resolve => {
      const req = http.get(`http://localhost:3000${p}`, res => { res.resume(); resolve() })
      req.on('error', resolve)
      req.setTimeout(120000, () => { req.destroy(); resolve() })
    })
    log(`  Pre-warmed: ${p}`)
    await WAIT(500)
  }
  log('✅ Pre-warm complete — all pages compiled\n')
}

function killServers() {
  log('Shutting down servers...')
  for (const s of servers) { try { s.kill() } catch {} }
}

async function makeSession(label, mockUserId, mockUsername) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
    defaultViewport: { width: 1280, height: 900 }
  })
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(180000)

  // Attach Console and Page Error listeners
  page.on('console', msg => {
    const text = msg.text()
    if (msg.type() === 'error' || text.includes('failed') || text.includes('Error') || text.includes('exception')) {
      log(`[Console][${label}] ${msg.type().toUpperCase()}: ${text}`)
    }
  })
  page.on('pageerror', err => {
    log(`[PageError][${label}] ${err.message}\nStack: ${err.stack}`)
  })

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.evaluate((id, name) => {
    document.cookie = `mock_user_id=${id}; path=/; max-age=86400`
    document.cookie = `mock_username=${name}; path=/; max-age=86400`
    localStorage.setItem('gamehub_mock_user_id', id)
    localStorage.setItem('gamehub_mock_username', name)
  }, mockUserId, mockUsername)

  const screenshot = async (name) => {
    const file = path.join(OUT_DIR, `${name}.png`)
    await page.screenshot({ path: file })
    log(`📸 [${label}] ${name}.png saved`)
    return file
  }

  const goto = async (url) => {
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle2', timeout: 30000 })
    await WAIT(4000)
  }

  const click = async (sel) => {
    await page.waitForSelector(sel, { timeout: 30000 })
    await page.click(sel)
    await WAIT(500)
  }

  const type = async (sel, text) => {
    await page.waitForSelector(sel, { timeout: 30000 })
    await page.click(sel, { clickCount: 3 })
    await page.type(sel, text, { delay: 60 })
    await WAIT(400)
  }

  const getText = async (sel) => {
    try {
      return await page.$eval(sel, el => el.textContent?.trim() || '')
    } catch { return '' }
  }

  const waitFor = async (sel, timeout = 30000) => {
    return page.waitForSelector(sel, { timeout })
  }

  return { browser, page, screenshot, goto, click, type, getText, waitFor, label }
}

async function runTest() {
  await startServers()
  await prewarmPages()

  log('Creating browser sessions...')
  const host = await makeSession('Host(A)', 'test-user-a', 'TestUserA')
  const joiner = await makeSession('Joiner(B)', 'test-user-b', 'TestUserB')

  try {
    log('1. Host creates Hangman room...')
    await host.goto('/dashboard/multiplayer')
    await host.click('#multiplayer-create-room-btn')
    await WAIT(800)

    // Select Hangman
    await host.page.select('#multiplayer-game-selector', 'hangman')
    await WAIT(500)
    await host.click('#multiplayer-create-confirm-btn')
    
    log('Waiting for room code element in Host lobby UI...')
    await host.waitFor('#multiplayer-room-code')
    await WAIT(1000)

    const roomCode = await host.getText('#multiplayer-room-code')
    log(`Room created successfully. Code: ${roomCode}`)
    await host.screenshot('test_1_host_room_created')

    if (!roomCode) {
      throw new Error('Failed to retrieve room code from lobby UI')
    }

    log('2. Joiner enters room...')
    await joiner.goto('/dashboard/multiplayer')
    await joiner.click('#multiplayer-join-room-btn')
    await WAIT(800)
    await joiner.type('#multiplayer-room-input', roomCode)
    await joiner.click('#multiplayer-join-confirm-btn')
    
    log('Waiting for join confirmation in Joiner lobby UI...')
    await joiner.waitFor('#multiplayer-ready-btn')
    await joiner.screenshot('test_2_joiner_joined_lobby')

    log('3. Setting ready states...')
    await host.click('#multiplayer-ready-btn')
    await joiner.click('#multiplayer-ready-btn')
    await WAIT(1500)
    await host.screenshot('test_3_both_ready')

    log('4. Host starts the Hangman match...')
    await host.click('#multiplayer-start-btn')
    
    log('Waiting for Word Submission screen to appear...')
    await host.waitFor('input[placeholder="ENTER WORD"]')
    await joiner.waitFor('input[placeholder="ENTER WORD"]')

    await host.screenshot('test_4_host_word_submission')
    await joiner.screenshot('test_5_joiner_word_submission')

    const hostBody = await host.page.evaluate(() => document.body.innerText)
    if (hostBody.includes('Unsupported game slug') || hostBody.includes('Error')) {
      throw new Error('Match initialization failed with error: ' + hostBody)
    }
    log('✅ Word Submission stage successfully reached! No "Unsupported game slug" error.')

    log('5. Submitting secret words...')
    // Host submits secret word "APPLE"
    await host.type('input[placeholder="ENTER WORD"]', 'APPLE')
    await host.click('button.btn-primary')
    await WAIT(1500)

    // Check if Host got spelling suggestion
    let hostModalOpened = await host.page.evaluate(() => document.body.innerText.includes('Spelling Suggestion'))
    if (hostModalOpened) {
      log('Host spelling suggestion modal detected, keeping original word...')
      await host.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const keepBtn = buttons.find(b => b.textContent.includes('Keep Original Word'));
        if (keepBtn) keepBtn.click();
      })
      await WAIT(1500)
    }
    await host.screenshot('test_6_host_word_submitted')

    // Joiner submits secret word "BANANA"
    await joiner.type('input[placeholder="ENTER WORD"]', 'BANANA')
    await joiner.click('button.btn-primary')
    await WAIT(1500)

    // Check if Joiner got spelling suggestion
    let joinerModalOpened = await joiner.page.evaluate(() => document.body.innerText.includes('Spelling Suggestion'))
    if (joinerModalOpened) {
      log('Joiner spelling suggestion modal detected, keeping original word...')
      await joiner.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const keepBtn = buttons.find(b => b.textContent.includes('Keep Original Word'));
        if (keepBtn) keepBtn.click();
      })
      await WAIT(1500)
    }

    log('Waiting for Active gameplay screen to load...')
    await host.waitFor('button.btn-secondary') // Waiting for "Guess Word" button
    await joiner.waitFor('button.btn-secondary')

    await host.screenshot('test_7_host_active_gameplay')
    await joiner.screenshot('test_8_joiner_active_gameplay')

    const hostGameplayBody = await host.page.evaluate(() => document.body.innerText)
    if (hostGameplayBody.includes('Submit Word') || hostGameplayBody.includes('WAITING FOR OPPONENT')) {
      throw new Error('Active gameplay screen not reached.')
    }
    log('✅ Active gameplay stage reached successfully!')

  } catch (err) {
    log(`❌ Verification FAILED: ${err.message}`)
    try {
      await host.screenshot('test_err_host')
      await joiner.screenshot('test_err_joiner')
    } catch {}
    throw err
  } finally {
    await host.browser.close()
    await joiner.browser.close()
    killServers()
  }
}

runTest().then(() => {
  log('🎉 All Hangman multiplayer verification checks PASSED successfully!')
  process.exit(0)
}).catch(err => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
