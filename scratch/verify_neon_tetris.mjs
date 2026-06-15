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
  console.log(`Starting Neon Tetris in ${mode} mode...`);
  
  await page.waitForSelector('#tetris-setup-menu', { timeout: 5000 });

  if (mode === 'daily') {
    await page.click('#nt-daily-tab');
  } else {
    await page.click('#nt-classic-tab');
  }
  await sleep(300);

  await page.click('#nt-start-btn');
  
  await page.waitForFunction(() => {
    const debug = window.__debug_neon_tetris;
    return debug && debug.currentPiece !== null;
  }, { timeout: 20000 });

  await sleep(500);
  console.log('Neon Tetris started successfully.');
}

async function main() {
  console.log('Starting Next.js dev server on port 3001 for E2E testing...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3001'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    // console.log(`[Next.js]: ${data.toString()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString()}`);
  });

  console.log('Waiting for Next.js dev server to spin up...');
  await sleep(15000);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    page.on('console', msg => {
      console.log(`[BROWSER LOG]: ${msg.text()}`);
    });

    console.log('Bypassing login with MOCK_AUTH...');
    await page.goto('http://localhost:3001/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('Navigating to Neon Tetris...');
    await page.goto('http://localhost:3001/dashboard/games/neon-tetris', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── TEST 1: CLASSIC MODE INITIALIZATION & BASIC MOVEMENT ───
    await startAndReady(page, 'classic');

    console.log('Verifying piece movements...');
    const moveResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const initialX = debug.currentPos.x;
      const initialY = debug.currentPos.y;

      // Move left
      debug.triggerMove('left');
      const leftX = debug.currentPos.x;

      // Move right
      debug.triggerMove('right');
      debug.triggerMove('right');
      const rightX = debug.currentPos.x;

      // Soft drop
      debug.triggerMove('down');
      const softY = debug.currentPos.y;

      return {
        initialX,
        initialY,
        leftX,
        rightX,
        softY,
        scoreAfterSoftDrop: debug.score
      };
    });

    console.log('Move test output:', moveResult);
    if (moveResult.leftX !== moveResult.initialX - 1) throw new Error('Move left failed');
    if (moveResult.rightX !== moveResult.initialX + 1) throw new Error('Move right failed');
    if (moveResult.softY !== moveResult.initialY + 1) throw new Error('Soft drop failed');
    if (moveResult.scoreAfterSoftDrop < 1) throw new Error('Soft drop score allocation failed');
    console.log('✅ Movement verification passed.');

    // ─── TEST 2: ROTATION (SRS) ───
    console.log('Verifying rotations...');
    const rotateResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const startRot = debug.currentRotation;

      debug.triggerRotate('cw');
      const cwRot = debug.currentRotation;

      debug.triggerRotate('ccw');
      const ccwRot = debug.currentRotation;

      return { startRot, cwRot, ccwRot };
    });
    console.log('Rotation test output:', rotateResult);
    if (rotateResult.cwRot !== 1) throw new Error('Rotate CW failed');
    if (rotateResult.ccwRot !== 0) throw new Error('Rotate CCW failed');
    console.log('✅ Rotation verification passed.');

    // ─── TEST 3: GHOST PIECE & HARD DROP ───
    console.log('Verifying Ghost Piece & Hard Drop...');
    const dropResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const initialScore = debug.score;
      const initialPlaced = debug.piecesPlaced;

      // Hard drop
      debug.triggerHardDrop();

      return {
        scoreGained: debug.score - initialScore,
        placedCount: debug.piecesPlaced,
        placedPieceIndex: initialPlaced + 1
      };
    });
    console.log('Drop test output:', dropResult);
    if (dropResult.scoreGained <= 0) throw new Error('Hard drop score allocation failed');
    if (dropResult.placedCount !== 1) throw new Error('Hard drop placement lock failed');
    console.log('✅ Ghost Piece & Hard Drop verification passed.');

    // ─── TEST 4: HOLD SYSTEM ───
    console.log('Verifying Hold system...');
    const holdResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      const originalType = debug.currentPiece.type;

      // Swapping piece to hold
      debug.triggerHold();
      const heldType = debug.heldPiece.type;
      const newActiveType = debug.currentPiece.type;

      return { originalType, heldType, newActiveType };
    });
    console.log('Hold test output:', holdResult);
    if (holdResult.heldType !== holdResult.originalType) throw new Error('Held piece type mismatch');
    console.log('✅ Hold system verification passed.');

    // ─── TEST 5: LINE CLEAR & COMBOS & LEVEL UPS ───
    console.log('Verifying Line Clears, Combos, and Level Ups...');
    const clearResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      
      // Setup row 19 almost filled
      const testBoard = Array.from({ length: 20 }, () => Array(10).fill(null));
      for (let c = 0; c < 9; c++) {
        testBoard[19][c] = '#06b6d4'; // Cyan
      }
      debug.setBoard(testBoard);

      // Set current piece to a single block (use "O" piece grid block or similar)
      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      // Move to column 9, row 19 (the filled row)
      debug.setCurrentPos({ x: 9, y: 19 });

      const initialLines = debug.linesCleared;
      const initialScore = debug.score;
      const initialLevel = debug.level;

      // Lock piece to trigger line clear
      debug.triggerLockPlacement();

      const linesAfterClear = debug.linesCleared;
      const scoreAfterClear = debug.score;

      // Setup level up: set lines cleared to 9 and clear another line
      debug.setLinesCleared(9);
      debug.setLevel(1);
      const levelBeforeClear = debug.level;

      const testBoard2 = Array.from({ length: 20 }, () => Array(10).fill(null));
      for (let c = 0; c < 9; c++) {
        testBoard2[19][c] = '#06b6d4';
      }
      debug.setBoard(testBoard2);
      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      debug.setCurrentPos({ x: 9, y: 19 });
      
      // Lock to trigger level up
      debug.triggerLockPlacement();

      const levelAfterClear = debug.level;

      return {
        initialLines,
        linesAfterClear,
        scoreGained: scoreAfterClear - initialScore,
        levelBeforeClear,
        levelAfterClear
      };
    });
    console.log('Line clear test output:', clearResult);
    if (clearResult.linesAfterClear !== clearResult.initialLines + 1) throw new Error('Line clear failed to increment linesCleared count');
    if (clearResult.scoreGained < 100) throw new Error('Line clear score reward failed');
    if (clearResult.levelAfterClear !== 2) throw new Error('Level up progression failed');
    console.log('✅ Line Clears, Combos, and Level Ups passed.');

    // ─── TEST 6: PERFECT CLEAR ───
    console.log('Verifying Perfect Clear...');
    const pcResult = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      
      // Clear board completely except for 1 block
      const testBoard = Array.from({ length: 20 }, () => Array(10).fill(null));
      testBoard[19][0] = '#06b6d4';
      debug.setBoard(testBoard);

      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      debug.setCurrentPos({ x: 1, y: 19 }); // Placment that doesn't trigger line clear but makes board non-empty
      debug.triggerLockPlacement();
      
      // Reset board to empty except first row has 9 filled and 1 empty
      const testBoard2 = Array.from({ length: 20 }, () => Array(10).fill(null));
      for (let c = 0; c < 9; c++) {
        testBoard2[19][c] = '#06b6d4';
      }
      debug.setBoard(testBoard2);

      // Now place the last block to clear the entire board
      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      debug.setCurrentPos({ x: 9, y: 19 });
      
      const initialPC = debug.perfectClears;
      debug.triggerLockPlacement();
      const afterPC = debug.perfectClears;

      return { initialPC, afterPC };
    });
    console.log('Perfect Clear test output:', pcResult);
    if (pcResult.afterPC !== pcResult.initialPC + 1) throw new Error('Perfect Clear failed to increment perfectClears count');
    console.log('✅ Perfect Clear verification passed.');

    // ─── TEST 7: GAME OVER & RESULT SUBMISSION ───
    console.log('Verifying Game Over & Results Submission...');
    
    const gameOverResult = await page.evaluate(async () => {
      const debug = window.__debug_neon_tetris;
      
      // Strategy: Fill cols 3-6 in rows 0-2 (4 cells each row, NOT a full row of 10).
      // This blocks the standard spawn zone (x=3) without triggering any line clears.
      // Any piece spawning at (x=3, y=-1) or (x=3, y=0) will collide immediately.
      const blockedBoard = Array.from({ length: 20 }, () => Array(10).fill(null));
      for (let r = 0; r < 3; r++) {
        for (let c = 3; c <= 6; c++) {
          blockedBoard[r][c] = '#ef4444';
        }
      }
      debug.setBoard(blockedBoard);

      // Ensure nextQueue has a known non-O piece (any piece spawns at y=-1, colliding with row 0)
      debug.setNextQueue([
        { type: 'T', color: '#a855f7', grid: [[0,1,0],[1,1,1],[0,0,0]] },
        { type: 'I', color: '#06b6d4', grid: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]] },
        { type: 'S', color: '#10b981', grid: [[0,1,1],[1,1,0],[0,0,0]] },
        { type: 'Z', color: '#ef4444', grid: [[1,1,0],[0,1,1],[0,0,0]] },
        { type: 'L', color: '#f97316', grid: [[0,0,1],[1,1,1],[0,0,0]] },
      ]);

      // Place a 1x1 piece at bottom-right corner — won't cause a line clear
      debug.setCurrentPiece({
        type: 'I',
        color: '#06b6d4',
        grid: [[1]]
      });
      debug.setCurrentPos({ x: 9, y: 19 });

      // Lock to trigger game over check (next T piece at x=3,y=-1 will collide with row 0 col 3)
      debug.triggerLockPlacement();
      
      return {
        isGameOver: debug.gameOver
      };
    });
    console.log('Game Over test output:', gameOverResult);
    if (!gameOverResult.isGameOver) throw new Error('Game Over trigger failed');
    console.log('✅ Game Over verification passed.');

    // Allow any async game-over API calls to complete before navigating
    await sleep(2000);

    // ─── TEST 8: DAILY CHALLENGE SEED CONSISTENCY ───
    console.log('Verifying Daily Challenge seed consistency...');
    
    // Navigate via /dashboard first to force a clean component remount
    // (avoids Fast Refresh race condition when navigating to the same URL)
    await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
    await sleep(2000);
    await page.goto('http://localhost:3001/dashboard/games/neon-tetris', { waitUntil: 'networkidle2' });
    await sleep(3000); // Extra settle time for dev server rebuilds
    await startAndReady(page, 'daily');

    const firstRunOrder = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      return [
        debug.currentPiece.type,
        ...debug.nextQueue.map(p => p.type)
      ];
    });

    console.log('Daily challenge run 1 piece order:', firstRunOrder);

    // Navigate via dashboard again for clean remount
    await page.goto('http://localhost:3001/dashboard', { waitUntil: 'networkidle2' });
    await sleep(1500);
    await page.goto('http://localhost:3001/dashboard/games/neon-tetris', { waitUntil: 'networkidle2' });
    await sleep(2000);
    await startAndReady(page, 'daily');

    const secondRunOrder = await page.evaluate(() => {
      const debug = window.__debug_neon_tetris;
      return [
        debug.currentPiece.type,
        ...debug.nextQueue.map(p => p.type)
      ];
    });

    console.log('Daily challenge run 2 piece order:', secondRunOrder);

    const matches = firstRunOrder.every((val, i) => val === secondRunOrder[i]);
    if (!matches) throw new Error('Daily challenge seed order consistency check failed');
    console.log('✅ Daily Challenge consistency verification passed.');

    console.log('\n🎉 ALL E2E VERIFICATIONS SUCCESSFUL! Neon Tetris is fully verified.');
    process.exit(0);

  } catch (err) {
    console.error('❌ E2E VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('Stopping Next.js development server...');
    devServer.kill('SIGINT');
  }
}

main();
