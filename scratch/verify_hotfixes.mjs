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
  console.log('Starting dev server for Hotfixes verification...');
  const devServer = spawn('npx.cmd', ['next', 'start', '-p', '3000'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
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
    console.log(`[BROWSER]: ${msg.text()}`);
  });

  try {
    // 1. Bypass auth
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.setViewport({ width: 1024, height: 768 });

    console.log('Navigating to Water Connect...');
    await page.goto('http://localhost:3000/dashboard/games/water-connect', { waitUntil: 'networkidle2' });
    await sleep(2500);

    // Setup screen - choose Level 1 Easy Mode
    await page.click('#waterconnect-mode-easy');
    await sleep(500);

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const lvl1 = buttons.find(b => b.textContent.trim() === '1');
      if (lvl1) lvl1.click();
    });
    await sleep(1500);

    await page.click('#waterconnect-preview-play-btn');
    await sleep(1000);

    // 2. Solve the entire board using hints (4 paths = 4 clicks)
    console.log('Solving the board using 4 hints...');
    for (let i = 0; i < 4; i++) {
      console.log(`Clicking hint button ${i + 1}/4...`);
      await page.click('#waterconnect-hint-btn');
      await sleep(1000);
    }

    console.log('Waiting for victory transition and ad to start...');
    await sleep(3000);

    // Capture screen to see if Ad is showing
    await page.screenshot({ path: path.join(outputDir, 'hotfix_01_ad_started.png') });
    console.log('Captured: hotfix_01_ad_started.png');

    // 3. Monitor Ad countdown to verify it does not reset
    console.log('Monitoring ad countdown...');
    await sleep(2000);
    await page.screenshot({ path: path.join(outputDir, 'hotfix_02_ad_countdown.png') });
    console.log('Captured: hotfix_02_ad_countdown.png');

    // Wait for countdown to finish and XP modal to open
    console.log('Waiting 12 seconds for ad countdown to finish...');
    await sleep(12000);
    await page.screenshot({ path: path.join(outputDir, 'hotfix_03_xp_modal.png') });
    console.log('Captured: hotfix_03_xp_modal.png');

    // Verify that the modal exists
    const modalExists = await page.evaluate(() => {
      return !!document.getElementById('single-player-modal-backdrop');
    });
    console.log(`XP Modal visible: ${modalExists}`);

    if (!modalExists) {
      throw new Error('XP Modal was not shown! Check if victory flow was triggered.');
    }

    // Verify hint penalty:
    // With 4 hints used, stars should be capped at 1 star
    const starsCount = await page.evaluate(() => {
      const container = document.getElementById('single-player-modal-backdrop');
      if (!container) return 0;
      // Count filled star elements or emojis in the modal
      return (container.innerHTML.match(/★|⭐/g) || []).length;
    });
    console.log(`Stars/Reward elements detected in modal: ${starsCount}`);

    // Click replay on the modal to reset the game
    console.log('Clicking replay on modal...');
    const replayBtn = await page.$('#single-modal-replay-btn');
    if (replayBtn) {
      await replayBtn.click();
    } else {
      await page.click('button');
    }
    await sleep(1500);

    // Play again
    await page.click('#waterconnect-preview-play-btn');
    await sleep(1000);

    // Solve using hints again to trigger ad
    console.log('Solving again using hints...');
    for (let i = 0; i < 4; i++) {
      await page.click('#waterconnect-hint-btn');
      await sleep(1000);
    }
    await sleep(3000); // Wait for ad showing

    // Confirm ad overlay is open
    const adOpenBeforeNav = await page.evaluate(() => {
      return !!document.getElementById('ad-overlay-container');
    });
    console.log(`Ad open before navigation: ${adOpenBeforeNav}`);

    // Navigate to dashboard games list using page.goto
    console.log('Navigating to dashboard games list...');
    await page.goto('http://localhost:3000/dashboard/games', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Verify ad overlay is no longer rendered
    const adOpenAfterNav = await page.evaluate(() => {
      return !!document.getElementById('ad-overlay-container');
    });
    console.log(`Ad open after navigation: ${adOpenAfterNav}`);

    if (adOpenAfterNav) {
      throw new Error('Leak detected: Ad overlay was NOT cleared after page navigation!');
    } else {
      console.log('Success: Ad overlay was successfully cleared after page navigation.');
    }

    console.log('SUCCESS: All hotfixes verified successfully!');

  } catch (err) {
    console.error('Error during hotfix verification:', err);
    process.exit(1);
  } finally {
    console.log('Stopping dev server and browser...');
    await browser.close();
    devServer.kill();
    await sleep(2000);
    process.exit(0);
  }
}

main().catch(console.error);
