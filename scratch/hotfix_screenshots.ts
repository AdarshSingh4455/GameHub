import puppeteer from 'puppeteer-core'
import path from 'path'

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const BRAIN_DIR = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\471e0fbb-828d-478c-b985-c2bdc323015c'

async function main() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    const uniqueId = Math.floor(Math.random() * 900000) + 100000
    const username = `hotfix_user_${uniqueId}`
    const email = `${username}@example.com`
    const password = `Password${uniqueId}!`

    console.log(`Registering user: ${username}`)
    await page.goto('http://localhost:3000/register', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    
    // Fill register
    await page.type('input[placeholder*="Username" i], input[type="text"]', username)
    await page.type('input[type="email"]', email)
    await page.type('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await sleep(4000)

    // Login
    console.log('Logging in...')
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await page.type('input[type="email"]', email)
    await page.type('input[type="password"]', password)
    await page.click('button[type="submit"]')
    await sleep(5000)

    // Verify Profile page XP values (showing positive math)
    console.log('Visiting profile page...')
    await page.goto('http://localhost:3000/dashboard/profile', { waitUntil: 'domcontentloaded' })
    await sleep(3000)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'profile_xp_values.png') })
    console.log('Captured profile_xp_values.png')

    // Verify Memory Match Game Page
    console.log('Visiting Memory Match page...')
    await page.goto('http://localhost:3000/dashboard/games/memory', { waitUntil: 'domcontentloaded' })
    await sleep(3000)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'memory_match_native.png') })
    console.log('Captured memory_match_native.png')

    // Simulate completion of Memory Match and verify desktop XP modal
    console.log('Triggering Game Over event for Memory Match...')
    await page.evaluate(() => {
      window.postMessage({
        type: 'game_over',
        gameSlug: 'memory',
        result: 'win',
        score: 12
      }, window.location.origin);
    })
    await sleep(2500)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'xp_modal_desktop.png') })
    console.log('Captured xp_modal_desktop.png')

    // Set viewport to mobile to verify responsive XP modal (width 320px)
    console.log('Resizing to 320px mobile viewport...')
    await page.setViewport({ width: 320, height: 600 })
    await sleep(1000)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'xp_modal_mobile.png') })
    console.log('Captured xp_modal_mobile.png')

    // Reset viewport and reload memory game
    await page.setViewport({ width: 1280, height: 800 })
    await sleep(500)

    // Verify Fighter Jet Game Page
    console.log('Visiting Fighter Jet page...')
    await page.goto('http://localhost:3000/dashboard/games/fighter', { waitUntil: 'domcontentloaded' })
    await sleep(3500)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'fighter_jet_native.png') })
    console.log('Captured fighter_jet_native.png')

    // Enter Immersive Fullscreen mode via wrapper-led button
    console.log('Toggling immersive fullscreen...')
    await page.click('#toggle-fullscreen-btn')
    await sleep(1500)
    await page.screenshot({ path: path.join(BRAIN_DIR, 'fighter_jet_fullscreen.png') })
    console.log('Captured fighter_jet_fullscreen.png')

    // Exit fullscreen
    await page.click('#toggle-fullscreen-btn')
    await sleep(1000)

    console.log('Hotfix verification screenshot capture complete!')
  } catch (err) {
    console.error('Error during screenshots generation:', err)
  } finally {
    await browser.close()
  }
}

main().catch(console.error)
