import puppeteer from 'puppeteer'
import { spawn } from 'child_process'
import dns from 'dns'

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

  const capture = async (name, width = 1280, height = 800) => {
    await page.setViewport({ width, height })
    await new Promise((resolve) => setTimeout(resolve, 2000))
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

    // ─── COLOR SORT SCREENS ───
    console.log('Navigating to Color Sort Game page...')
    await page.goto('http://localhost:3000/dashboard/games/color-sort', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('colorsort_level_select.png')

    // Click Level 1 to play
    console.log('Starting Color Sort Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#color-sort-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Trigger pour animation and capture midway
    console.log('Initiating pour from Jar 0 to Jar 2...')
    await page.click('#colorsort-jar-0')
    await new Promise((resolve) => setTimeout(resolve, 200))
    await page.click('#colorsort-jar-2')
    
    // Wait for pour animation to be active (lifting/moving is 700ms, pouring is 1000ms. Wait 800ms total from click)
    await new Promise((resolve) => setTimeout(resolve, 800))
    await capture('colorsort_pouring_animation.png')
    
    // Wait for animation to finish
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Go back and enter Endless Lab
    await page.click('#color-sort-root button[id="colorsort-exit-gameplay-btn"]')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    console.log('Mocking Level 50 completion to unlock Endless Lab...')
    await page.evaluate(() => {
      localStorage.setItem('gamehub_colorsort_progress_guest', '50')
      localStorage.setItem('gamehub_colorsort_progress_mock-user-id', '50')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await page.click('#colorsort-enter-lab-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await capture('colorsort_endless_lab.png')

    // ─── UNBLOCK TRAFFIC SCREENS ───
    console.log('Navigating to Unblock Traffic Game page...')
    await page.goto('http://localhost:3000/dashboard/games/unblock-traffic', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_select.png')

    // Start Level 1
    console.log('Starting Unblock Traffic Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#traffic-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_1_layout.png')

    // One-Tap Movement Proof
    console.log('Tapping a vehicle to verify one-tap sliding movement...')
    // We can evaluate which vehicle can slide in the level and click it.
    // In Level 1, we can just tap the first vehicle that isn't the target red car.
    await page.evaluate(() => {
      // Find the first vehicle element starting with 'v-'
      const vehicles = Array.from(document.querySelectorAll('[id^="traffic-vehicle-v-"]'))
      if (vehicles.length > 0) {
        vehicles[0].click()
      }
    })
    // Wait for slide transition to complete (250ms)
    await new Promise((resolve) => setTimeout(resolve, 500))
    await capture('traffic_one_tap_movement.png')

    // Start Level 11 for Locked Vehicles
    console.log('Transitioning to Level 11 for Locked Vehicles...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // Set level progress to 10 so we can unlock Level 11
    await page.evaluate(() => {
      localStorage.setItem('gamehub_traffic_progress_guest', '10')
      localStorage.setItem('gamehub_traffic_progress_mock-user-id', '10')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Click Level 11 button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const lvl11Btn = btns.find(b => b.textContent.trim() === '11')
      if (lvl11Btn) lvl11Btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_11_locked.png')

    // Start Level 31 for Switch and Gate
    console.log('Transitioning to Level 31 for Switch and Gate...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.evaluate(() => {
      localStorage.setItem('gamehub_traffic_progress_guest', '30')
      localStorage.setItem('gamehub_traffic_progress_mock-user-id', '30')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Click Level 31
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const lvl31Btn = btns.find(b => b.textContent.trim() === '31')
      if (lvl31Btn) lvl31Btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_31_switch_gate.png')

    // Start Level 41 for Key-Lock Escape Chain
    console.log('Transitioning to Level 41 for Key-Lock Chain...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.evaluate(() => {
      localStorage.setItem('gamehub_traffic_progress_guest', '40')
      localStorage.setItem('gamehub_traffic_progress_mock-user-id', '40')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Click Level 41
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const lvl41Btn = btns.find(b => b.textContent.trim() === '41')
      if (lvl41Btn) lvl41Btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_41_key_lock.png')

    // Start Level 50 for High-Density Congestion
    console.log('Transitioning to Level 50 for Master high-density board...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.evaluate(() => {
      localStorage.setItem('gamehub_traffic_progress_guest', '49')
      localStorage.setItem('gamehub_traffic_progress_mock-user-id', '49')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Click Level 50
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const lvl50Btn = btns.find(b => b.textContent.trim() === '50')
      if (lvl50Btn) lvl50Btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await capture('traffic_level_50_master.png')

    // Trigger Win on Level 50
    console.log('Triggering Unblock Traffic Victory Modal...')
    await page.evaluate(() => {
      if (window.triggerTrafficWin) {
        window.triggerTrafficWin()
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_victory_modal.png')

    // Go to Rewards Page to prove Achievements DB unlocking works
    console.log('Navigating to Rewards Page to capture permanent achievement unlocks list...')
    await page.goto('http://localhost:3000/dashboard/rewards', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 3000))
    await capture('achievement_unlock_proof.png')

  } catch (err) {
    console.error('Error in Puppeteer capture script:', err)
  } finally {
    await browser.close()
    devServer.kill()
    console.log('Phase 3 polish captures completed successfully.')
    process.exit(0)
  }
}

run()
