import puppeteer from 'puppeteer'
import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import dns from 'dns'

dns.setDefaultResultOrder('ipv4first')

const BASE_URL = 'http://localhost:3000'
const OUT_DIR  = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\195ab622-23af-4bce-9437-c89caa5f08ea'
const WAIT     = (ms) => new Promise(r => setTimeout(r, ms))

let devServer, wsServer
const servers = []

const log = (msg) => {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${msg}`)
}

async function startServers() {
  log('Force-clearing ports 3000 and 5000 before starting servers...')
  try {
    execSync(
      'powershell -ExecutionPolicy Bypass -File scripts/kill-ports.ps1',
      { stdio: 'ignore' }
    )
  } catch (e) {}
  await WAIT(3000)

  // Seed mock database
  log('Seeding mock DB state...')
  const dbPath = path.join(process.cwd(), 'node_modules', '.cache', 'mock_db_state.json')
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const initialProfiles = {
    'test-user-a': {
      id: 'test-user-a',
      userId: 'test-user-a',
      username: 'coder_pro',
      displayName: 'Alex Rivers',
      avatarUrl: null,
      friendCode: 'GH-AAAAA0001',
      xp: 12000,
      level: 15,
      coins: 99999,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: 'Pro Gamer',
      selectedFrame: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      _count: { wonMatches: 2, friends: 2 }
    },
    'test-user-b': {
      id: 'test-user-b',
      userId: 'test-user-b',
      username: 'pixel_queen',
      displayName: 'Luna Sterling',
      avatarUrl: null,
      friendCode: 'GH-BBBBB0002',
      xp: 8000,
      level: 12,
      coins: 5000,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-02').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: 'Pixel Artist',
      selectedFrame: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      _count: { wonMatches: 1, friends: 2 }
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

  const initialInventories = {
    'test-user-a_item-chat-competitor': {
      id: 'test-user-a_item-chat-competitor',
      profileId: 'test-user-a',
      cosmeticItemId: 'item-chat-competitor',
      purchasedAt: new Date().toISOString()
    }
  }

  const initialDbState = {
    profiles: initialProfiles,
    rooms: {},
    sessions: {},
    friendships: initialFriendships,
    invites: {},
    notifications: {},
    inventories: initialInventories,
    matches: {},
    xpEvents: {},
    rankedMatches: {}
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
  devServer.stderr.on('data', d => {
    const s = d.toString().trim()
    if (s && !s.includes('DeprecationWarning')) log(`[Next.js ERR] ${s.slice(0, 100)}`)
  })
  servers.push(devServer)

  log('Starting WebSocket server...')
  wsServer = spawn('npx.cmd', ['tsx', 'server/src/index.ts'], {
    env: { ...process.env, MOCK_AUTH: 'true', NODE_ENV: 'development' },
    shell: true,
    stdio: 'pipe'
  })
  wsServer.stdout.on('data', d => {
    const s = d.toString().trim()
    if (s) log(`[WS Ready] ${s.slice(0, 1000)}`)
  })
  wsServer.stderr.on('data', d => {
    const s = d.toString().trim()
    if (s && !s.includes('DeprecationWarning')) log(`[WS ERR] ${s.slice(0, 1000)}`)
  })
  servers.push(wsServer)

  const { default: http } = await import('http')

  log('Waiting for Next.js dev server on port 3000...')
  const isPortReady = (port) => new Promise(resolve => {
    const req = http.get(`http://localhost:${port}`, res => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => { req.destroy(); resolve(false) })
  })

  let ready = false
  for (let i = 0; i < 45; i++) {
    await WAIT(1500)
    ready = await isPortReady(3000)
    if (ready) break
  }
  if (!ready) throw new Error('Dev server timed out starting')
  log('Next.js is responding on port 3000!')

  log('Waiting for WebSocket server on port 5000...')
  let wsReady = false
  for (let i = 0; i < 15; i++) {
    await WAIT(1000)
    wsReady = await isPortReady(5000)
    if (wsReady) break
  }
  if (wsReady) {
    log('WebSocket server is responding on port 5000!')
  }
  await WAIT(1000)
}

function killServers() {
  log('Killing servers...')
  for (const s of servers) {
    try { execSync(`taskkill /F /T /PID ${s.pid}`, { stdio: 'ignore' }) } catch {}
    try { s.kill() } catch {}
  }
  try {
    execSync(
      'powershell -ExecutionPolicy Bypass -File scripts/kill-ports.ps1',
      { stdio: 'ignore' }
    )
  } catch (e) {}
}

async function injectChromeAndScreenshot(page, route, filename) {
  // Set viewport to exactly 424 x (946 + 86) where 86px is browser chrome overlay
  await page.setViewport({
    width: 424,
    height: 946 + 86,
    deviceScaleFactor: 2.55,
    isMobile: true,
    hasTouch: true
  })

  await page.evaluate((urlRoute) => {
    const existing = document.getElementById('simulated-browser-chrome')
    if (existing) existing.remove()

    const chromeDiv = document.createElement('div')
    chromeDiv.id = 'simulated-browser-chrome'
    chromeDiv.style.cssText = `
      width: 100%;
      background-color: #202124;
      color: #e8eaed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      border-bottom: 1px solid #3c4043;
      user-select: none;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      z-index: 9999999;
    `

    chromeDiv.innerHTML = `
      <!-- Tabs Bar -->
      <div style="display: flex; align-items: center; height: 28px; padding-left: 10px; background-color: #17181b; box-sizing: border-box; width: 100%;">
        <div style="display: flex; gap: 6px; margin-right: 15px; flex-shrink: 0;">
          <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #ff5f56;"></div>
          <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #ffbd2e;"></div>
          <div style="width: 10px; height: 10px; border-radius: 50%; background-color: #27c93f;"></div>
        </div>
        <div style="
          background-color: #202124;
          border-radius: 8px 8px 0 0;
          padding: 0 12px;
          height: 24px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          font-size: 11px;
          color: #e8eaed;
          margin-top: 4px;
          flex-shrink: 0;
        ">
          <span>🎮 GameHub</span>
          <span style="color: #9aa0a6; cursor: pointer;">×</span>
        </div>
      </div>
      <!-- Address Bar Row -->
      <div style="display: flex; align-items: center; height: 32px; padding: 0 8px; gap: 8px; background-color: #202124; box-sizing: border-box; width: 100%;">
        <div style="display: flex; gap: 12px; color: #9aa0a6; font-size: 14px; margin-right: 4px; flex-shrink: 0;">
          <span style="cursor: pointer; font-weight: bold;">←</span>
          <span style="cursor: pointer; font-weight: bold;">→</span>
          <span style="cursor: pointer; font-size: 12px; font-weight: bold;">⟳</span>
        </div>
        <div style="
          flex: 1;
          background-color: #292a2d;
          border-radius: 14px;
          height: 22px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: #e8eaed;
          font-size: 11px;
          box-sizing: border-box;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        ">
          <span style="color: #9aa0a6; margin-right: 6px; flex-shrink: 0;">🔒</span>
          <span style="color: #8ab4f8; flex-shrink: 0;">localhost:3000</span><span style="color: #e8eaed;">${urlRoute}</span>
        </div>
        <div style="color: #9aa0a6; font-size: 14px; padding: 0 4px; cursor: pointer; flex-shrink: 0;">⋮</div>
      </div>
      <!-- DevTools responsive device simulation bar -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 26px;
        padding: 0 10px;
        background-color: #2f3136;
        border-bottom: 1px solid #202225;
        font-size: 11px;
        color: #b9bbbe;
        box-sizing: border-box;
        width: 100%;
      ">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="color: #43b581;">●</span>
          <span>Responsive Viewport: <strong>424 × 946</strong></span>
        </div>
        <div>
          <span>DPR: <strong>2.55</strong></span>
        </div>
      </div>
    `
    document.body.insertBefore(chromeDiv, document.body.firstChild)
  }, route)

  await WAIT(1000)
  const destPath = path.join(OUT_DIR, filename)
  await page.screenshot({ path: destPath })
  log(`📸 Captured screenshot to artifact: ${filename}`)
}

async function captureAll() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(180000) // 3 minutes timeout

  // Authenticate as test-user-a
  log('Setting authentication cookies...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => {
    document.cookie = 'mock_user_id=test-user-a; path=/; max-age=86400'
    document.cookie = 'mock_username=coder_pro; path=/; max-age=86400'
    localStorage.setItem('gamehub_mock_user_id', 'test-user-a')
    localStorage.setItem('gamehub_mock_username', 'coder_pro')
  })

  // 1. Multiplayer Dashboard
  log('Navigating to Multiplayer page...')
  await page.goto(`${BASE_URL}/dashboard/multiplayer`, { waitUntil: 'domcontentloaded' })
  log('Waiting for Next.js compilation of Multiplayer page...')
  await page.waitForSelector('h1', { timeout: 120000 })
  await WAIT(6000)
  await injectChromeAndScreenshot(page, '/dashboard/multiplayer', 'live_multiplayer_dashboard.png')

  // 2. Profile Overview
  log('Navigating to Profile Overview...')
  await page.goto(`${BASE_URL}/dashboard/profile`, { waitUntil: 'domcontentloaded' })
  log('Waiting for Next.js compilation of Profile page...')
  await page.waitForSelector('h2', { timeout: 120000 })
  await WAIT(6000)
  await injectChromeAndScreenshot(page, '/dashboard/profile', 'live_profile_overview.png')

  // 3. Profile Achievements
  log('Navigating to Profile Achievements...')
  await page.click('#profile-tab-achievements')
  await page.waitForSelector('.profile-achievements-grid', { timeout: 30000 })
  await WAIT(2500)
  await injectChromeAndScreenshot(page, '/dashboard/profile#achievements', 'live_profile_achievements.png')

  // 4. Leaderboard Modal
  log('Navigating to Leaderboard...')
  await page.goto(`${BASE_URL}/dashboard/leaderboard`, { waitUntil: 'domcontentloaded' })
  log('Waiting for Next.js compilation of Leaderboard page...')
  await page.waitForSelector('button.hover-underline', { timeout: 120000 })
  await WAIT(3000)
  
  log('Clicking leaderboard row to open Profile Modal...')
  await page.click('button.hover-underline')
  await page.waitForSelector('.profile-card-container', { timeout: 30000 })
  await WAIT(2000)
  await injectChromeAndScreenshot(page, '/dashboard/leaderboard', 'live_leaderboard_profile_modal.png')

  await browser.close()
}

async function run() {
  try {
    await startServers()
    await captureAll()
  } catch (err) {
    console.error('ERROR in screenshot automation script:', err)
  } finally {
    killServers()
    log('Done!')
  }
}

run()
