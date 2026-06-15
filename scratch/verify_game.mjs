import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import pg from 'pg';
import { parse } from 'pg-connection-string';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dns.setDefaultResultOrder('ipv4first');

const connectionString = process.env.DATABASE_URL;
let config = {};
if (connectionString) {
  config = parse(connectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }
}
const pool = new pg.Pool(config);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BRAIN_DIR = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\4e1f968e-c6cf-4ddd-88b9-2e9f742edd17';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function handleAdOverlayIfPresent(page) {
  console.log('Waiting for post-game screen (Ad overlay or Completion Modal) to appear...');
  await page.waitForSelector('#ad-overlay-container, #single-player-modal-body', { timeout: 20000 });
  
  const adOverlay = await page.$('#ad-overlay-container');
  if (adOverlay) {
    console.log('Ad overlay detected. Waiting for it to auto-advance...');
    await page.waitForSelector('#single-player-modal-body', { timeout: 15000 });
    console.log('Auto-advanced to Completion Modal.');
  }
  await sleep(1500);
}

async function main() {
  console.log('Starting Next.js production server...');
  const devServer = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-Command', 'npm run start'], {
    cwd: 'c:\\Users\\adars\\OneDrive\\Desktop\\Full Stack\\gameHub',
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    console.log(`[Next.js stdout]: ${data.toString().trim()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js stderr]: ${data.toString().trim()}`);
  });

  // Wait 10 seconds for dev server to boot
  await sleep(10000);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`[PAGE CONSOLE] ${msg.text()}`);
  });

  try {
    const username = 'adarsh004455';

    console.log(`\n=== 1. Navigating to Dashboard (Auto-login as ${username}) ===`);
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await sleep(4000);

    console.log('\n=== 2. Navigating to Arrow Puzzle ===');
    await page.goto('http://localhost:3000/dashboard/games/arrow-puzzle', { waitUntil: 'networkidle2' });
    await sleep(3000);

    await page.screenshot({ path: path.join(BRAIN_DIR, '01_setup_page.png') });
    console.log('Captured 01_setup_page.png');

    console.log('\n=== 3. Starting Easy Level 1 ===');
    await page.click('#play-easy');
    await sleep(3000);

    await page.screenshot({ path: path.join(BRAIN_DIR, '02_board_matte.png') });
    console.log('Captured 02_board_matte.png');

    console.log('\n=== 4. Hovering over an Arrow corridor to verify path highlighting ===');
    // Find the first arrow button
    const firstArrowId = await page.evaluate(() => {
      const el = document.querySelector('[id^="arrow-tile-"]');
      return el ? el.id : null;
    });

    if (firstArrowId) {
      console.log(`Hovering over arrow: ${firstArrowId}`);
      await page.hover(`#${firstArrowId}`);
      await sleep(1000);
      await page.screenshot({ path: path.join(BRAIN_DIR, '03_hover_glow.png') });
      console.log('Captured 03_hover_glow.png');
    } else {
      console.log('No arrow tiles found on board!');
    }

    console.log('\n=== 5. Auto-solving Level 1 ===');
    const solveResult = await page.evaluate(async () => {
      let attempts = 0;
      const actions = [];
      while (attempts < 60) {
        const buttons = Array.from(document.querySelectorAll('[id^="arrow-tile-"]'));
        if (buttons.length === 0) {
          actions.push('No more arrows, level completed!');
          break;
        }

        let stateChanged = false;
        const beforeStates = buttons.map(b => b.outerHTML);

        for (let i = 0; i < buttons.length; i++) {
          const btn = document.querySelectorAll('[id^="arrow-tile-"]')[i];
          if (!btn) continue;

          btn.click();
          // wait for slide out / clear animation
          await new Promise(r => setTimeout(r, 450));

          const afterButtons = Array.from(document.querySelectorAll('[id^="arrow-tile-"]'));
          const afterStates = afterButtons.map(b => b.outerHTML);

          if (afterButtons.length < buttons.length || JSON.stringify(beforeStates) !== JSON.stringify(afterStates)) {
            actions.push(`Clicked arrow at index ${i} successfully`);
            stateChanged = true;
            break; // fresh start
          }
        }

        if (!stateChanged) {
          actions.push('Stuck - no valid moves found');
          break;
        }
        attempts++;
      }
      return actions;
    });

    console.log('Solver action logs:', solveResult);
    
    // Wait for the ad overlay / completion modal to settle
    await handleAdOverlayIfPresent(page);

    await page.screenshot({ path: path.join(BRAIN_DIR, '04_single_player_modal.png') });
    console.log('Captured 04_single_player_modal.png');

    console.log('\n=== 6. Testing Replay Flow ===');
    await page.click('#single-modal-replay-btn');
    await sleep(3500);

    await page.screenshot({ path: path.join(BRAIN_DIR, '05_replay_flow.png') });
    console.log('Captured 05_replay_flow.png');

    console.log('\n=== 7. Solving Level 1 again to unlock next level ===');
    await page.evaluate(async () => {
      let attempts = 0;
      while (attempts < 60) {
        const buttons = Array.from(document.querySelectorAll('[id^="arrow-tile-"]'));
        if (buttons.length === 0) break;
        let stateChanged = false;
        const beforeStates = buttons.map(b => b.outerHTML);
        for (let i = 0; i < buttons.length; i++) {
          const btn = document.querySelectorAll('[id^="arrow-tile-"]')[i];
          if (!btn) continue;
          btn.click();
          await new Promise(r => setTimeout(r, 450));
          const afterButtons = Array.from(document.querySelectorAll('[id^="arrow-tile-"]'));
          const afterStates = afterButtons.map(b => b.outerHTML);
          if (afterButtons.length < buttons.length || JSON.stringify(beforeStates) !== JSON.stringify(afterStates)) {
            stateChanged = true;
            break;
          }
        }
        if (!stateChanged) break;
        attempts++;
      }
    });

    // Wait for the ad overlay / completion modal to settle
    await handleAdOverlayIfPresent(page);

    console.log('\n=== 8. Testing Next Level Flow ===');
    await page.click('#single-modal-next-btn');
    await sleep(3500);

    await page.screenshot({ path: path.join(BRAIN_DIR, '06_next_level_flow.png') });
    console.log('Captured 06_next_level_flow.png');

    console.log('\n=== 9. Querying Database to verify XP, Coin and Achievement persistence ===');
    const userProfile = await prisma.profile.findFirst({
      where: { username },
      include: {
        xpEvents: true,
        matchesAsP1: true,
        achievements: {
          include: {
            achievement: true
          }
        },
        gameStats: true
      }
    });

    console.log('\n*** VERIFICATION DATA ***');
    console.log(`Username: ${userProfile?.username}`);
    console.log(`Coins: ${userProfile?.coins} (Expected > 0)`);
    console.log(`XP: ${userProfile?.xp} (Expected > 0)`);
    console.log(`Level: ${userProfile?.level}`);
    console.log(`Matches Played: ${userProfile?.matchesAsP1.length}`);
    console.log(`Game Stats:`, userProfile?.gameStats);
    console.log(`XP Events Count: ${userProfile?.xpEvents.length}`);
    console.log(`Achievements Unlocked:`, userProfile?.achievements.map(a => a.achievement.name));

    // Save DB proof to scratch folder
    fs.writeFileSync(
      path.join(BRAIN_DIR, 'db_verification_proof.json'),
      JSON.stringify(userProfile, null, 2)
    );

    // Save console logs to verify clean console
    const reactWarnings = consoleLogs.filter(log => log.toLowerCase().includes('warning') || log.toLowerCase().includes('react'));
    console.log('\n=== 10. Checking Console Warning Logs ===');
    console.log(`Total Console Warning Logs found: ${reactWarnings.length}`);
    fs.writeFileSync(
      path.join(BRAIN_DIR, 'clean_console_proof.json'),
      JSON.stringify({ consoleLogs, reactWarnings }, null, 2)
    );

  } catch (err) {
    console.error('Error in verification flow:', err);
  } finally {
    console.log('Shutting down dev server and browser...');
    await browser.close();
    devServer.kill('SIGINT');
    await sleep(2000);
    console.log('Verification completed!');
    process.exit(0);
  }
}

main().catch(console.error);
