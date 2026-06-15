import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import dns from 'dns';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

console.log('Starting Next.js dev server with MOCK_AUTH=false...');
const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3000'], {
  env: { ...process.env, MOCK_AUTH: 'false' },
  shell: true,
});

devServer.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.log(`[Next.js stdout]: ${line}`);
});

devServer.stderr.on('data', (data) => {
  const line = data.toString().trim();
  if (line) console.error(`[Next.js stderr]: ${line}`);
});

await new Promise((resolve) => setTimeout(resolve, 8000));

async function run() {
  console.log('Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const [page] = await browser.pages();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    const uniqueId = Math.floor(Math.random() * 900000) + 100000;
    const username = `testuser_${uniqueId}`;
    const email = `${username}@example.com`;
    const password = `Password${uniqueId}!`;

    console.log(`1. Navigating to Register Page to create user: ${username}...`);
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    await sleep(2000);

    await page.type('input[placeholder*="Username" i]', username);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    console.log('2. Waiting for registration and redirect to login/dashboard...');
    await sleep(6000);

    const currentUrl = page.url();
    console.log('Current URL after registration:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('Redirected to login. Signing in...');
      await page.type('input[type="email"]', email);
      await page.type('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await sleep(5000);
      console.log('New URL after login:', page.url());
    }

    console.log('3. Triggering game-over POST request via browser fetch console...');
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/games/game-over', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameSlug: '2048',
            result: 'win',
            metadata: { score: 1024, timeSpent: 120 }
          })
        });
        const status = res.status;
        const body = await res.json();
        return { status, body };
      } catch (e) {
        return { error: e.message };
      }
    });

    console.log('API Response Status:', result.status);
    console.log('API Response Body:', JSON.stringify(result.body, null, 2));

  } catch (err) {
    console.error('Error occurred in test runner:', err);
  } finally {
    console.log('Shutting down...');
    await browser.close();
    devServer.kill();
    process.exit(0);
  }
}

run();
