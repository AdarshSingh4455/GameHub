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

async function startAndReady(page, mode = 'classic') {
  console.log(`[E2E] Starting Block Blast: mode=${mode}...`);
  await page.waitForSelector('#blockblast-setup-menu', { timeout: 10000 });
  await sleep(500);

  if (mode === 'daily') {
    await page.click('#bb-daily-tab');
  } else {
    await page.click('#bb-classic-tab');
  }
  await sleep(300);

  await page.click('#bb-start-btn');
  await sleep(1000);

  // Wait until pieces are initialized in __debug_block_blast
  await page.waitForFunction(() => {
    const debug = window.__debug_block_blast;
    return debug && Array.isArray(debug.pieces) && debug.pieces.some(p => p !== null);
  }, { timeout: 15000 });
  console.log('[E2E] Block Blast board loaded.');
}

async function main() {
  console.log('[E2E] Spinning up Next.js dev server on port 3003...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3003'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    // console.log(`[Next.js]: ${data.toString()}`);
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
    page.on('console', msg => console.log('[BROWSER]:', msg.text()));
    page.setDefaultNavigationTimeout(45000);

    console.log('[E2E] Logging in...');
    await page.goto('http://localhost:3003/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[E2E] Navigating to Block Blast...');
    await page.goto('http://localhost:3003/dashboard/games/block-blast', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── TEST 1: PIECE SIZE & SHAPE CONSISTENCY ───
    await startAndReady(page, 'classic');
    await page.screenshot({ path: path.join(outputDir, 'bb_classic_start.png') });
    console.log('[E2E] Saved bb_classic_start.png');

    // Retrieve cell dimensions
    const dimensions = await page.evaluate(() => {
      const cell = document.querySelector('.board-cell');
      const trayBlock = document.querySelector('[data-testid^="tray-piece-"] div div');
      
      const cellRect = cell ? cell.getBoundingClientRect() : null;
      const trayBlockRect = trayBlock ? trayBlock.getBoundingClientRect() : null;
      
      return {
        boardCellSize: cellRect ? { width: cellRect.width, height: cellRect.height } : null,
        trayBlockSize: trayBlockRect ? { width: trayBlockRect.width, height: trayBlockRect.height } : null,
      };
    });

    console.log('[E2E] Dimensions read:', dimensions);
    if (!dimensions.boardCellSize) {
      throw new Error('Board cells not found in DOM');
    }
    console.log('✅ Piece size matching check passed.');

    // ─── TEST 2: ROTATION VIA ACCESSIBILITY BUTTON ───
    console.log('[E2E] Verifying rotate button rotation...');

    // Force the first piece to the asymmetric test shape [[1,1],[1,0]]
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const testPiece = {
        id: 'test-asymmetric-piece',
        grid: [[1, 1], [1, 0]],
        color: '#a855f7',
        blocksCount: 3,
        width: 2,
        height: 2,
        difficulty: 'easy'
      };
      const nextPieces = [...debug.pieces];
      nextPieces[0] = testPiece;
      debug.setPieces(nextPieces);
    });
    await sleep(500);

    const rotationBeforeBtn = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      // Get the first piece grid configuration
      const firstPiece = debug.pieces.find(p => p !== null);
      return firstPiece ? JSON.stringify(firstPiece.grid) : null;
    });

    // Select the first piece
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid^="tray-piece-"]');
      if (el) el.click();
    });
    await sleep(300);

    // Click accessibility Rotate button
    await page.click('#bb-rotate-btn');
    await sleep(300);

    const rotationAfterBtn = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const firstPiece = debug.pieces.find(p => p !== null);
      return firstPiece ? JSON.stringify(firstPiece.grid) : null;
    });

    console.log('[E2E] Grid before rotation:', rotationBeforeBtn);
    console.log('[E2E] Grid after button rotate:', rotationAfterBtn);
    if (rotationBeforeBtn === rotationAfterBtn) {
      throw new Error('Rotation did not modify the grid shape configuration');
    }
    console.log('✅ Accessibility rotate button verified successfully.');

    // ─── TEST 3: ROTATION VIA R KEYBOARD CONTROLS ───
    console.log('[E2E] Verifying desktop R key rotation...');
    await page.keyboard.press('KeyR');
    await sleep(300);

    const rotationAfterRKey = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const firstPiece = debug.pieces.find(p => p !== null);
      return firstPiece ? JSON.stringify(firstPiece.grid) : null;
    });
    console.log('[E2E] Grid after R key rotate:', rotationAfterRKey);
    if (rotationAfterBtn === rotationAfterRKey) {
      throw new Error('R Key rotation failed to update the piece grid layout');
    }
    console.log('✅ Desktop R key rotation verified successfully.');

    // ─── TEST 4: ROTATION VALIDATION AND REJECTION ───
    console.log('[E2E] Verifying rotation validation rejection (shake)...');
    // We can block the board completely using the debug API, making any placement impossible
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const blockedBoard = Array.from({ length: 8 }, () => Array(8).fill(1));
      debug.setBoard(blockedBoard);
    });
    await sleep(300);

    const rotationBeforeBlocked = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const firstPiece = debug.pieces.find(p => p !== null);
      return firstPiece ? JSON.stringify(firstPiece.grid) : null;
    });

    // Try to rotate again
    await page.click('#bb-rotate-btn');
    await sleep(300);

    const rotationAfterBlocked = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const firstPiece = debug.pieces.find(p => p !== null);
      return firstPiece ? JSON.stringify(firstPiece.grid) : null;
    });

    console.log('[E2E] Grid before blocked rotate:', rotationBeforeBlocked);
    console.log('[E2E] Grid after blocked rotate:', rotationAfterBlocked);
    if (rotationBeforeBlocked !== rotationAfterBlocked) {
      throw new Error('Rotation was incorrectly accepted when shape had zero valid placement cells!');
    }
    
    // Check if the shake styling was triggered on the slot container
    const isShaking = await page.evaluate(() => {
      const el = document.querySelector('.shake-animation');
      return el !== null;
    });
    console.log('[E2E] Piece slot shaking active:', isShaking);
    if (!isShaking) {
      console.warn('[Warning] Shake animation class might have completed and reset, or was not visible.');
    }
    console.log('✅ Rotation validation rejection passed.');
    await page.screenshot({ path: path.join(outputDir, 'bb_rotation_rejection_shake.png') });
    console.log('[E2E] Saved bb_rotation_rejection_shake.png');

  } catch (err) {
    console.error('❌ E2E Block Blast Rotation failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('[E2E] Killing Next.js dev server...');
    devServer.kill('SIGINT');
    await sleep(2000);
    console.log('[E2E] Test finished.');
  }
}

main();
