import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const conversationId = '396bca3e-ae2c-4517-aebc-06fba41583a9';
const outputDir = `C:\\Users\\adars\\.gemini\\antigravity\\brain\\${conversationId}\\screenshots`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startAndReady(page, mode = 'classic') {
  console.log(`[E2E] Starting Neon Tetris: mode=${mode}...`);
  await page.waitForSelector('#tetris-setup-menu', { timeout: 10000 });
  await sleep(500);

  if (mode === 'daily') {
    await page.click('#nt-daily-tab');
  } else {
    await page.click('#nt-classic-tab');
  }
  await sleep(300);

  await page.click('#nt-start-btn');
  await sleep(1000);

  // Wait until pieces are initialized
  await page.waitForFunction(() => {
    const debug = window.__debug_neon_tetris;
    return debug && debug.currentPiece !== null;
  }, { timeout: 15000 });
  console.log('[E2E] Neon Tetris board loaded.');
}

async function main() {
  console.log('[E2E] Spinning up Next.js dev server on port 3004...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3004'], {
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
    page.setDefaultNavigationTimeout(45000);

    console.log('[E2E] Logging in...');
    await page.goto('http://localhost:3004/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[E2E] Navigating to Neon Tetris...');
    await page.goto('http://localhost:3004/dashboard/games/neon-tetris', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── TEST 1: LOGO STYLING BRANDING VERIFICATION ───
    const logoDetails = await page.evaluate(() => {
      const headerSpanCyan = Array.from(document.querySelectorAll('#tetris-setup-menu span')).find(el => el.textContent === 'NEON');
      const headerSpanPurple = Array.from(document.querySelectorAll('#tetris-setup-menu span')).find(el => el.textContent === 'TETRIS');
      const subBadge = Array.from(document.querySelectorAll('#tetris-setup-menu span')).find(el => el.textContent === 'Arcade Edition');
      
      return {
        hasNeon: headerSpanCyan !== undefined,
        hasTetris: headerSpanPurple !== undefined,
        hasArcadeBadge: subBadge !== undefined
      };
    });

    console.log('[E2E] Logo Branding elements detected:', logoDetails);
    if (!logoDetails.hasNeon || !logoDetails.hasTetris || !logoDetails.hasArcadeBadge) {
      throw new Error('Branding elements for NEON TETRIS Arcade Edition are missing on the setup screen!');
    }
    console.log('✅ Logo redesign branding verified successfully.');
    await page.screenshot({ path: path.join(outputDir, 'nt_logo_redesign_setup.png') });
    console.log('[E2E] Saved nt_logo_redesign_setup.png');

    // Start classic mode
    await startAndReady(page, 'classic');

    // ─── TEST 2: DOUBLE CLICK DIRECT PIECE ROTATION ───
    console.log('[E2E] Verifying double-click rotation on active piece cells...');
    const rotBeforeClick = await page.evaluate(() => window.__debug_neon_tetris.currentRotation);

    // Locate an active cell. The grid cells render data-row and data-col, but we can search for the cell styling.
    // Let's identify the row/col of the active piece cells from debug API
    const activePieceCellCoords = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const piece = debug.currentPiece;
      const pos = debug.currentPos;
      const coords = [];
      for (let r = 0; r < piece.grid.length; r++) {
        for (let c = 0; c < piece.grid[r].length; c++) {
          if (piece.grid[r][c] !== 0) {
            coords.push({ r: pos.y + r, c: pos.x + c });
          }
        }
      }
      return coords;
    });

    console.log('[E2E] Active piece coordinates:', activePieceCellCoords);
    if (activePieceCellCoords.length === 0) {
      throw new Error('No active cell coordinates found for direct interaction testing');
    }

    const targetCellSelector = `[data-row="${activePieceCellCoords[0].r}"][data-col="${activePieceCellCoords[0].c}"]`;
    console.log(`[E2E] Clicking target selector: ${targetCellSelector}`);

    // Double click the cell
    const cellEl = await page.$(targetCellSelector);
    if (!cellEl) {
      throw new Error(`Target cell not found at DOM selector: ${targetCellSelector}`);
    }
    await cellEl.click({ clickCount: 2 });
    await sleep(500);

    const rotAfterClick = await page.evaluate(() => window.__debug_neon_tetris.currentRotation);
    console.log(`[E2E] Rotation index: before=${rotBeforeClick}, after double-click=${rotAfterClick}`);
    if (rotAfterClick === rotBeforeClick) {
      throw new Error('Double clicking active cell failed to rotate the tetromino clockwise!');
    }
    console.log('✅ Double click rotation verified successfully.');

    // ─── TEST 3: DOUBLE TAP DIRECT TOUCH ROTATION ───
    console.log('[E2E] Verifying touch-start double-tap rotation...');
    // We get the new active coords
    const newCoords = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const piece = debug.currentPiece;
      const pos = debug.currentPos;
      const coords = [];
      for (let r = 0; r < piece.grid.length; r++) {
        for (let c = 0; c < piece.grid[r].length; c++) {
          if (piece.grid[r][c] !== 0) {
            coords.push({ r: pos.y + r, c: pos.x + c });
          }
        }
      }
      return coords;
    });

    const tapSelector = `[data-row="${newCoords[0].r}"][data-col="${newCoords[0].c}"]`;
    console.log(`[E2E] Simulating double tap on touch-start at: ${tapSelector}`);
    
    // Simulate double tap via two consecutive clicks with small delay
    await page.click(tapSelector);
    await sleep(50);
    await page.click(tapSelector);
    await sleep(500);

    const rotAfterDoubleTap = await page.evaluate(() => window.__debug_neon_tetris.currentRotation);
    console.log(`[E2E] Rotation index after double-tap: ${rotAfterDoubleTap}`);
    if (rotAfterDoubleTap === rotAfterClick) {
      throw new Error('Double-tap simulation failed to rotate the tetromino!');
    }
    console.log('✅ Double tap rotation verified successfully.');
    await page.screenshot({ path: path.join(outputDir, 'nt_piece_rotated.png') });
    console.log('[E2E] Saved nt_piece_rotated.png');

    // ─── TEST 4: STANDARD ROTATION ACTIONS (BUTTONS & KEYBOARD) ───
    console.log('[E2E] Verifying standard keyboard controls still work...');
    const rotBeforeKey = await page.evaluate(() => window.__debug_neon_tetris.currentRotation);
    await page.keyboard.press('KeyX');
    await sleep(300);

    const rotAfterKey = await page.evaluate(() => window.__debug_neon_tetris.currentRotation);
    console.log(`[E2E] Keyboard rotation index: before=${rotBeforeKey}, after X key=${rotAfterKey}`);
    if (rotAfterKey === rotBeforeKey) {
      throw new Error('Keyboard X key rotation failed!');
    }
    console.log('✅ Keyboard controls rotation verified successfully.');

  } catch (err) {
    console.error('❌ E2E Neon Tetris Rotation failed:', err);
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
