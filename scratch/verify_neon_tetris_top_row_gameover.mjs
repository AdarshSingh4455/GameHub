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
  console.log('[NEON TETRIS TOP ROW TEST] Spinning up Next.js dev server on port 3007...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3007'], {
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

    console.log('[NEON TETRIS TOP ROW TEST] Logging in...');
    await page.goto('http://localhost:3007/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[NEON TETRIS TOP ROW TEST] Navigating to Neon Tetris...');
    await page.goto('http://localhost:3007/dashboard/games/neon-tetris', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Start classic game
    console.log('[NEON TETRIS TOP ROW TEST] Starting game...');
    await page.waitForSelector('#tetris-setup-menu', { timeout: 5000 });
    await page.click('#nt-start-btn');
    
    await page.waitForFunction(() => {
      const debug = window.__debug_neon_tetris;
      return debug && debug.currentPiece !== null;
    }, { timeout: 15000 });
    await sleep(500);

    // Test case: Lock a piece in row 0
    console.log('[NEON TETRIS TOP ROW TEST] Forcing a piece to be locked in row 0...');
    const result = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;

      // Set the board to be empty
      const emptyBoard = Array.from({ length: 20 }, () => Array(10).fill(null));
      debug.setBoard(emptyBoard);

      // Place a 1x1 block in row 0
      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      debug.setCurrentPos({ x: 5, y: 0 });

      // Lock placement
      debug.triggerLockPlacement();

      return {
        isGameOver: debug.gameOver,
        cellInRow0: debug.board[0][5]
      };
    });

    console.log('[NEON TETRIS TOP ROW TEST] Lock result:', result);
    if (!result.isGameOver) {
      throw new Error('Locking a block in row 0 did NOT trigger immediate Game Over!');
    }
    console.log('✓ Neon Tetris immediate Game Over when row 0 is occupied verified.');

    // Capture screenshot of game over
    await page.screenshot({ path: path.join(outputDir, 'neon_tetris_row0_gameover.png') });
    console.log('[BOARD GEN TEST] Saved neon_tetris_row0_gameover.png');

    console.log('🎉 ALL Neon Tetris Top Row Game Over Tests Passed successfully!');

  } catch (err) {
    console.error('❌ E2E Neon Tetris Top Row Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('[BOARD GEN TEST] Killing Next.js dev server...');
    devServer.kill('SIGINT');
    await sleep(2000);
    console.log('[BOARD GEN TEST] Finished.');
  }
}

main();
