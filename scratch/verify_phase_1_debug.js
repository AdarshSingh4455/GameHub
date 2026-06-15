import puppeteer from 'puppeteer';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const [page] = await browser.pages();

  // Capture console and errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  try {
    const uniqueId = Math.floor(Math.random() * 900000) + 100000;
    const username = `verify_user_${uniqueId}`;
    const email = `${username}@example.com`;
    const password = `Password${uniqueId}!`;

    console.log(`\n=== 1. REGISTER USER: ${username} ===`);
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    await sleep(2000);

    await page.type('input[placeholder*="username" i]', username);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    
    await page.screenshot({ path: 'scratch/01_register_filled.png' });
    
    console.log('Clicking submit...');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for action...');
    await sleep(10000);

    await page.screenshot({ path: 'scratch/02_register_after_submit.png' });

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

  } catch (err) {
    console.error('Error during validation execution:', err);
  } finally {
    console.log('Shutting down browser...');
    await browser.close();
    process.exit(0);
  }
}

run();
