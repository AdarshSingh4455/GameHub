import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const conversationId = 'd218537d-8deb-4297-a62c-c4a6c3e69f18';
const outputDir = `C:\\Users\\adars\\.gemini\\antigravity\\brain\\${conversationId}\\screenshots`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('[POST GAME FLOW TEST] Spinning up Next.js dev server on port 3006...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3006'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    console.log(`[Next.js]: ${data.toString()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString()}`);
  });

  await sleep(12000); // Allow dev server to start

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);

    console.log('[POST GAME FLOW TEST] Logging in...');
    await page.goto('http://localhost:3006/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[POST GAME FLOW TEST] Navigating to Word Wizard...');
    await page.goto('http://localhost:3006/dashboard/games/word-wizard', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── ROUND 1: WARM-UP (Compiles all route endpoints) ───
    console.log('[POST GAME FLOW TEST] --- ROUND 1: WARM-UP ---');
    await page.waitForSelector('#ww-setup-menu h2', { timeout: 10000 });
    const startBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('#ww-setup-menu button'));
      return buttons.find(b => b.textContent.includes('Spellwards!'));
    });
    if (startBtn && startBtn.asElement()) {
      await startBtn.asElement().click();
    }
    await sleep(1500);

    await page.waitForFunction(() => {
      return window.__debug_word_wizard !== undefined;
    });

    console.log('[POST GAME FLOW TEST] Warm-up: Triggering Game Over...');
    await page.evaluate(() => {
      window.__debug_word_wizard.triggerGameOver();
    });

    console.log('[POST GAME FLOW TEST] Warm-up: Waiting for ad container...');
    await page.waitForSelector('#ad-overlay-container', { timeout: 45000 });

    console.log('[POST GAME FLOW TEST] Warm-up: Waiting for ad continue button...');
    await page.waitForFunction(() => {
      const skipBtn = document.getElementById('ad-skip-btn');
      return skipBtn && !skipBtn.disabled;
    }, { timeout: 45000 });

    console.log('[POST GAME FLOW TEST] Warm-up: Clicking continue...');
    await page.click('#ad-skip-btn');

    console.log('[POST GAME FLOW TEST] Warm-up: Waiting for XP Modal...');
    await page.waitForSelector('#single-player-modal-body', { timeout: 45000 });
    await sleep(1000);

    // Click Replay from XP Modal
    console.log('[POST GAME FLOW TEST] Warm-up: Clicking Replay to start Round 2...');
    await page.click('#single-modal-replay-btn');
    await sleep(1500);

    // Verify game has re-loaded and is ready
    await page.waitForFunction(() => {
      return window.__debug_word_wizard !== undefined;
    });
    console.log('[POST GAME FLOW TEST] Round 2 game loaded.');

    // ─── ROUND 2: MEASURED SPEED RUN ───
    console.log('[POST GAME FLOW TEST] --- ROUND 2: MEASUREMENT ---');
    const t0 = Date.now();
    await page.evaluate(() => {
      window.__debug_word_wizard.triggerGameOver();
    });

    // Measure time until Ad overlay appears
    await page.waitForSelector('#ad-overlay-container', { timeout: 5000 });
    const tAd = Date.now() - t0;
    console.log(`[POST GAME FLOW TEST] Game Over -> Ad overlay transition time: ${tAd}ms`);
    if (tAd > 300) {
      throw new Error(`Expected Game Over -> Ad transition <= 300ms, got ${tAd}ms`);
    }
    console.log('✓ Game Over -> Ad transition speed is within 300ms.');

    // Verify no fake Game Over screen is shown in the DOM
    const fakeScreenExists = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      return bodyText.includes('Words Spelled') && bodyText.includes('Max Combo');
    });
    if (fakeScreenExists) {
      throw new Error('Detected fake Game Over screen in the DOM!');
    }
    console.log('✓ Verified: No intermediate fake game over screen.');

    // Wait until skip button is skippable
    console.log('[POST GAME FLOW TEST] Waiting for ad continue button...');
    await page.waitForFunction(() => {
      const skipBtn = document.getElementById('ad-skip-btn');
      return skipBtn && !skipBtn.disabled;
    }, { timeout: 10000 });

    console.log('[POST GAME FLOW TEST] Clicking continue to close ad...');
    const tCloseStart = Date.now();
    await page.click('#ad-skip-btn');

    // Measure time until XP Modal appears
    await page.waitForSelector('#single-player-modal-body', { timeout: 5000 });
    const tXP = Date.now() - tCloseStart;
    console.log(`[POST GAME FLOW TEST] Ad Close -> XP Modal transition time: ${tXP}ms`);
    if (tXP > 300) {
      throw new Error(`Expected Ad Close -> XP Modal transition <= 300ms, got ${tXP}ms`);
    }
    console.log('✓ Ad Close -> XP Modal transition speed is within 300ms.');

    // Capture screenshot of XP Modal
    await page.screenshot({ path: path.join(outputDir, 'ww_faster_post_game_xp_modal.png') });
    console.log('[POST GAME FLOW TEST] Saved ww_faster_post_game_xp_modal.png');

    console.log('🎉 ALL Post-Game Flow E2E Tests Passed successfully!');

  } catch (err) {
    console.error('❌ E2E Post-Game Flow Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('[POST GAME FLOW TEST] Killing Next.js dev server...');
    devServer.kill('SIGINT');
    await sleep(2000);
    console.log('[POST GAME FLOW TEST] Finished.');
  }
}

main();
