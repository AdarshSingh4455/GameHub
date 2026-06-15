import puppeteer from 'puppeteer-core'
import path from 'path'

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

const BRAIN_DIR = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\471e0fbb-828d-478c-b985-c2bdc323015c'

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    const uniqueId = Math.floor(Math.random() * 900000) + 100000
    const username = `player_${uniqueId}`
    const email = `${username}@example.com`
    const password = `Password${uniqueId}!`

    console.log(`Registering user: ${username} (${email})`)

    // 1. Go to register page
    await page.goto('http://localhost:3000/register', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await page.screenshot({ path: path.join(BRAIN_DIR, '01_register_page.png') })

    // 2. Fill registration form
    await page.type('input[placeholder*="Username" i], input[type="text"]', username)
    await page.type('input[type="email"]', email)
    // There might be multiple inputs or placeholders, let's type password in the first password field
    await page.type('input[type="password"]', password)
    
    await page.screenshot({ path: path.join(BRAIN_DIR, '02_register_filled.png') })

    // 3. Click submit
    await page.click('button[type="submit"]')
    await sleep(4000)
    await page.screenshot({ path: path.join(BRAIN_DIR, '03_register_submitted.png') })

    // 4. Try logging in with the newly created account
    console.log('Navigating to login page...')
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
    await sleep(2000)
    await page.screenshot({ path: path.join(BRAIN_DIR, '04_login_page.png') })

    await page.type('input[type="email"]', email)
    await page.type('input[type="password"]', password)
    await page.screenshot({ path: path.join(BRAIN_DIR, '05_login_filled.png') })

    await page.click('button[type="submit"]')
    await sleep(5000)
    await page.screenshot({ path: path.join(BRAIN_DIR, '06_login_submitted.png') })

    console.log('Auth flow test completed!')
  } catch (err) {
    console.error('Error in auth flow:', err)
  } finally {
    await browser.close()
  }
}

main().catch(console.error)
