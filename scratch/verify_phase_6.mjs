import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\feef7fed-a095-4d4d-ae6c-c7a4c2f8c56b\\screenshots';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Starting Next.js development server for Phase 6 E2E Verification...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3000'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    // console.log(`[Next.js]: ${data.toString().trim()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString().trim()}`);
  });

  // Wait for server to start
  await sleep(10000);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);

  page.on('console', msg => {
    console.log(`[BROWSER LOG]: ${msg.text()}`);
  });

  try {
    // 1. Bypass authentication using mock auth
    console.log('Navigating to login page for authentication bypass...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Set viewport
    await page.setViewport({ width: 1024, height: 768 });
    await sleep(500);

    // 2. Test Color Sort Game category targets and headers
    console.log('Testing Color Sort Game...');
    await page.goto('http://localhost:3000/dashboard/games/color-sort', { waitUntil: 'networkidle2' });
    await sleep(2500);

    // Click Level 1 campaign button
    console.log('Clicking Level 1 button in Color Sort...');
    // Level buttons are numbered, click button that has text "1"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lvl1 = buttons.find(b => b.textContent.trim() === '1');
      if (lvl1) lvl1.click();
    });
    await sleep(1500);

    // Capture level preview (should show Mixed category targets)
    await page.screenshot({ path: path.join(outputDir, 'color_sort_01_preview.png') });
    console.log('Captured: color_sort_01_preview.png');

    // Click play button on preview overlay
    await page.click('#colorsort-preview-play-btn');
    await sleep(1000);

    // Capture playing board with category label and stacked target times
    await page.screenshot({ path: path.join(outputDir, 'color_sort_02_board.png') });
    console.log('Captured: color_sort_02_board.png');

    // Click Rules button
    console.log('Opening Rules Modal in Color Sort...');
    await page.click('#game-rules-btn');
    await sleep(800);

    // Capture Rules Modal
    await page.screenshot({ path: path.join(outputDir, 'color_sort_03_rules.png') });
    console.log('Captured: color_sort_03_rules.png');

    // Close using keyboard Escape key
    console.log('Closing Rules Modal with Escape key...');
    await page.keyboard.press('Escape');
    await sleep(800);

    // Capture closed state
    await page.screenshot({ path: path.join(outputDir, 'color_sort_04_board_closed.png') });
    console.log('Captured: color_sort_04_board_closed.png');


    // 3. Test Water Connect Modes & Info Panel
    console.log('Testing Water Connect Game...');
    await page.goto('http://localhost:3000/dashboard/games/water-connect', { waitUntil: 'networkidle2' });
    await sleep(2500);

    // Capture Water Connect setup screen (should show Easy/Challenge mode buttons)
    await page.screenshot({ path: path.join(outputDir, 'water_connect_01_setup.png') });
    console.log('Captured: water_connect_01_setup.png');

    // Click Easy Mode button
    console.log('Toggling Mode to Easy...');
    await page.click('#waterconnect-mode-easy');
    await sleep(800);

    // Capture toggled setup screen
    await page.screenshot({ path: path.join(outputDir, 'water_connect_02_easy_selected.png') });
    console.log('Captured: water_connect_02_easy_selected.png');

    // Click Level 1 to play
    console.log('Clicking Level 1 button in Water Connect...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lvl1 = buttons.find(b => b.textContent.trim() === '1');
      if (lvl1) lvl1.click();
    });
    await sleep(1500);

    // Capture level preview showing Easy Mode and Board: 4x4
    await page.screenshot({ path: path.join(outputDir, 'water_connect_03_preview.png') });
    console.log('Captured: water_connect_03_preview.png');

    // Play!
    await page.click('#waterconnect-preview-play-btn');
    await sleep(1000);

    // Capture board HUD showing Mode and Board Size
    await page.screenshot({ path: path.join(outputDir, 'water_connect_04_board.png') });
    console.log('Captured: water_connect_04_board.png');

    // Open Rules Modal
    console.log('Opening Rules Modal in Water Connect...');
    await page.click('#game-rules-btn');
    await sleep(800);

    // Capture Rules Modal showing Water Connect specific rules
    await page.screenshot({ path: path.join(outputDir, 'water_connect_05_rules.png') });
    console.log('Captured: water_connect_05_rules.png');

    // Close using OK button click
    console.log('Closing Rules Modal with OK button...');
    await page.click('#game-rules-ok-btn');
    await sleep(800);

    // Capture closed state
    await page.screenshot({ path: path.join(outputDir, 'water_connect_06_board_closed.png') });
    console.log('Captured: water_connect_06_board_closed.png');

    console.log('SUCCESS: All E2E verification steps completed successfully!');

  } catch (err) {
    console.error('Error during E2E verification:', err);
    process.exit(1);
  } finally {
    console.log('Cleaning up browser and dev server processes...');
    await browser.close();
    devServer.kill();
    await sleep(2000);
    process.exit(0);
  }
}

main().catch(console.error);
