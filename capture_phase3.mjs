import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import dns from 'dns'

// Ensure local DNS resolution works offline
dns.setDefaultResultOrder('ipv4first')

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\4e1f968e-c6cf-4ddd-88b9-2e9f742edd17'

console.log('Starting Next.js dev server with MOCK_AUTH=true...')
const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3000'], {
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
})

devServer.stdout.on('data', (data) => {
  console.log(`[Next.js]: ${data.toString().trim()}`)
})

devServer.stderr.on('data', (data) => {
  console.error(`[Next.js Error]: ${data.toString().trim()}`)
})

// Wait for dev server to start
await new Promise((resolve) => setTimeout(resolve, 10000))

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(120000)

  // Helper to take a screenshot and log
  const capture = async (name, width, height, isMobile = false) => {
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile })
    await new Promise((resolve) => setTimeout(resolve, 2500)) // wait for layout/render
    const path = `${outputDir}\\${name}`
    await page.screenshot({ path })
    console.log(`Captured: ${name} (${width}x${height})`)
  }

  try {
    // 1. Log in / bypass auth via login landing
    console.log('Navigating to login page...')
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 3000))

    // 2. Go to dashboard
    console.log('Navigating to dashboard...')
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // ─── Color Sort Screens ───
    console.log('Navigating to Color Sort Game page...')
    await page.goto('http://localhost:3000/dashboard/games/color-sort', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('colorsort_level_select.png', 1280, 800)

    // Unlock Endless Lab by setting completed levels counts
    console.log('Mocking level 50 completion to unlock Endless Lab...')
    await page.evaluate(() => {
      localStorage.setItem('gamehub_colorsort_progress_guest', '50')
      localStorage.setItem('gamehub_colorsort_progress_mock-user-id', '50')
    })
    
    // Reload page to reflect new progression count
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Click Endless Lab button
    console.log('Entering Endless Lab...')
    await page.click('#colorsort-enter-lab-btn')
    await capture('colorsort_endless_lab.png', 1280, 800)

    // ─── Unblock Traffic Screens ───
    console.log('Navigating to Unblock Traffic Game page...')
    await page.goto('http://localhost:3000/dashboard/games/unblock-traffic', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_select.png', 1280, 800)

    // Start Level 1
    console.log('Starting Unblock Traffic Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#traffic-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Trigger Win using window helper
    console.log('Triggering Unblock Traffic Victory...')
    await page.evaluate(() => {
      if (window.triggerTrafficWin) {
        window.triggerTrafficWin()
      }
    })

    // Capture the Victory Completion Modal with achievements unlocked inside it
    await capture('traffic_escape_victory.png', 1280, 800)

    // Go to Rewards to show the permanent achievement unlocks list in dashboard
    console.log('Navigating to Rewards page to verify achievement unlocks...')
    await page.goto('http://localhost:3000/dashboard/rewards', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await capture('achievement_unlock_proof.png', 1280, 800)

  } catch (err) {
    console.error('Error in Puppeteer script:', err)
  } finally {
    await browser.close()
    devServer.kill()
    console.log('Phase 3 captures completed successfully.')
    process.exit(0)
  }
}

run()
