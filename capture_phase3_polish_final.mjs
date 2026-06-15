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

    // Mock progress to unlock all levels
    await page.evaluate(() => {
      localStorage.setItem('gamehub_colorsort_progress_guest', '50')
      localStorage.setItem('gamehub_colorsort_progress_mock-user-id', '50')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Start Level 1 (Cylinder, Hourglass, Beaker, Square shapes + Neon palette)
    console.log('Starting Color Sort Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#color-sort-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('colorsort_jar_shapes.png')
    await capture('colorsort_palette_neon.png')

    // Go back, play Level 2 (Pastel palette)
    console.log('Starting Color Sort Level 2...')
    await page.click('#colorsort-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#color-sort-level-grid button'))
      const btn2 = btns.find(b => b.textContent.trim() === '2')
      if (btn2) btn2.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('colorsort_palette_pastel.png')

    // Go back, play Level 3 (Metallic palette)
    console.log('Starting Color Sort Level 3...')
    await page.click('#colorsort-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#color-sort-level-grid button'))
      const btn3 = btns.find(b => b.textContent.trim() === '3')
      if (btn3) btn3.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('colorsort_palette_metallic.png')

    // Go back, play Level 4 (Vintage palette)
    console.log('Starting Color Sort Level 4...')
    await page.click('#colorsort-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#color-sort-level-grid button'))
      const btn4 = btns.find(b => b.textContent.trim() === '4')
      if (btn4) btn4.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('colorsort_palette_vintage.png')

    // Go back and enter Endless Lab
    await page.click('#colorsort-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.click('#colorsort-enter-lab-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await capture('colorsort_endless_lab.png')


    // ─── UNBLOCK TRAFFIC SCREENS ───
    console.log('Navigating to Unblock Traffic Game page...')
    await page.goto('http://localhost:3000/dashboard/games/unblock-traffic', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Mock progress to unlock all levels
    await page.evaluate(() => {
      localStorage.setItem('gamehub_traffic_progress_guest', '50')
      localStorage.setItem('gamehub_traffic_progress_mock-user-id', '50')
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Start Level 1 (Beach Theme + Right Exit)
    console.log('Starting Unblock Traffic Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#traffic-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_theme_beach.png')
    await capture('traffic_exit_right.png')

    // Start Level 2 (Mall Theme + Left Exit)
    console.log('Starting Unblock Traffic Level 2...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const btn2 = btns.find(b => b.textContent.trim() === '2')
      if (btn2) btn2.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_theme_mall.png')
    await capture('traffic_exit_left.png')

    // Start Level 3 (Stadium Theme + Down Exit)
    console.log('Starting Unblock Traffic Level 3...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const btn3 = btns.find(b => b.textContent.trim() === '3')
      if (btn3) btn3.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_exit_down.png')

    // Start Level 4 (Airport Theme + Up Exit)
    console.log('Starting Unblock Traffic Level 4...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const btn4 = btns.find(b => b.textContent.trim() === '4')
      if (btn4) btn4.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_exit_up.png')

    // Start Level 6 (Neon Theme + Left Exit)
    console.log('Starting Unblock Traffic Level 6...')
    await page.click('#traffic-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#traffic-level-grid button'))
      const btn6 = btns.find(b => b.textContent.trim() === '6')
      if (btn6) btn6.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('traffic_theme_neon.png')


    // ─── ARROW PUZZLE SCREENS ───
    console.log('Navigating to Arrow Puzzle Game page...')
    await page.goto('http://localhost:3000/dashboard/games/arrow-puzzle', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Start Level 1 (Sparse Early level)
    console.log('Starting Arrow Puzzle Level 1...')
    await page.evaluate(() => {
      const btn = document.querySelector('#easy-progression button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('arrow_early_sparse.png')

    // Go back, start Level 15 (Mid density level)
    console.log('Starting Arrow Puzzle Level 15...')
    await page.click('#arrow-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // Mock easy mode completed levels to unlock level 15 in level grid modal
    await page.evaluate(() => {
      const progress = JSON.stringify({
        completedLevels: {
          easy: Array.from({ length: 14 }, (_, i) => i + 1),
          medium: [], hard: [], expert: [], 'super-hard': []
        }
      })
      localStorage.setItem('gamehub_arrow_progress_guest', progress)
      localStorage.setItem('gamehub_arrow_progress_mock-user-id', progress)
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Open easy mode Level Selector Modal
    await page.click('#levels-easy')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // Click level 15 button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#level-grid-container button'))
      const btn15 = btns.find(b => b.textContent.trim() === '15')
      if (btn15) btn15.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('arrow_mid_dense.png')

    // Go back, unlock and play Level 45 (Extreme density level)
    console.log('Starting Arrow Puzzle Level 45...')
    await page.click('#arrow-exit-gameplay-btn')
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await page.evaluate(() => {
      const progress = JSON.stringify({
        completedLevels: {
          easy: Array.from({ length: 44 }, (_, i) => i + 1),
          medium: [], hard: [], expert: [], 'super-hard': []
        }
      })
      localStorage.setItem('gamehub_arrow_progress_guest', progress)
      localStorage.setItem('gamehub_arrow_progress_mock-user-id', progress)
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await page.click('#levels-easy')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#level-grid-container button'))
      const btn45 = btns.find(b => b.textContent.trim() === '45')
      if (btn45) btn45.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('arrow_extreme_dense.png')


    // ─── NEW PERSONAL BEST MODAL SCREEN ───
    console.log('Transitioning to Modal Personal Best example...')
    // Play Color Sort Level 1, inject best time mock, trigger victory
    await page.goto('http://localhost:3000/dashboard/games/color-sort', { waitUntil: 'networkidle2' })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Set mock best time to 9999 so current time (which is tiny) beats it
    await page.evaluate(() => {
      localStorage.setItem('gamehub_color-sort_level_1_best_time', '9999')
    })
    // Start Level 1
    await page.evaluate(() => {
      const btn = document.querySelector('#color-sort-level-grid button')
      if (btn) btn.click()
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    // Trigger win
    await page.evaluate(() => {
      if (window.triggerColorSortWin) {
        window.triggerColorSortWin()
      }
    })
    await new Promise((resolve) => setTimeout(resolve, 2500))
    await capture('modal_personal_best.png')

  } catch (err) {
    console.error('Error in Puppeteer capture script:', err)
  } finally {
    await browser.close()
    devServer.kill()
    console.log('All Phase 3 screenshots captured successfully.')
    process.exit(0)
  }
}

run()
