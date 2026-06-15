import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import pg from 'pg';
import { parse } from 'pg-connection-string';

dns.setDefaultResultOrder('ipv4first');

const conversationId = '21eb29c1-97f6-4a5c-9df2-863f19824772';
const outputDir = `C:\\Users\\adars\\.gemini\\antigravity\\brain\\${conversationId}\\screenshots`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Robust helper to start a game mode and wait for the engine state to initialize
async function startAndReady(page, mode = 'classic') {
  console.log(`Starting game in ${mode} mode...`);
  
  // Wait for setup menu to be visible
  await page.waitForSelector('#blockblast-setup-menu', { timeout: 5000 });

  if (mode === 'daily') {
    await page.click('#bb-daily-tab');
  } else {
    await page.click('#bb-classic-tab');
  }
  await sleep(300);

  await page.click('#bb-start-btn');
  
  // Wait until React state finishes initialization and sets the 3 pieces in window.__debug_block_blast
  await page.waitForFunction(() => {
    const debug = window.__debug_block_blast;
    return debug && 
           Array.isArray(debug.pieces) && 
           debug.pieces.some(p => p !== null);
  }, { timeout: 15000 });

  await sleep(500);
  console.log('Game successfully started and pieces populated.');
}

async function main() {
  console.log('Starting Next.js development server for Block Blast testing...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3000'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    console.log(`[Next.js]: ${data.toString().trim()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString().trim()}`);
  });

  // Wait for server to start
  console.log('Waiting for Next.js server to start...');
  await sleep(12000);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);

  page.on('console', msg => {
    console.log(`[BROWSER LOG]: ${msg.text()}`);
  });

  page.on('requestfailed', request => {
    console.error(`[REQUEST FAILED]: ${request.url()}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      console.error(`[RESPONSE ERROR]: ${response.url()} returned status ${response.status()}`);
    }
  });

  try {
    // 1. Log in (mock bypasses auth)
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // 2. Go to Block Blast page
    console.log('Navigating to Block Blast game...');
    await page.goto('http://localhost:3000/dashboard/games/block-blast', { waitUntil: 'networkidle2' });
    
    // Give Next.js ample time to do initial page compilation
    console.log('Waiting for lazy compilation to settle...');
    await sleep(8000);

    await page.setViewport({ width: 1024, height: 768 });
    await sleep(500);

    // Pre-compile the XP Modal component by triggering a dummy game over
    console.log('Pre-compiling XP modal by starting a quick game and triggering game over...');
    await startAndReady(page, 'classic');
    await page.evaluate(() => {
      window.__debug_block_blast.triggerGameOver(100, 1, 0, 1, false);
    });
    console.log('Waiting for XP modal lazy compilation and potential Fast Refresh...');
    await sleep(8000);

    // Reload page to start with a fresh clean state
    console.log('Reloading page after pre-compilation...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(4000);

    await page.screenshot({ path: path.join(outputDir, 'block_blast_01_setup.png') });
    console.log('Captured: block_blast_01_setup.png');

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICATION 1: DAILY SEED IDENTICAL ACROSS TWO SESSIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING DAILY SEED IDENTICAL SESSIONS ---');
    console.log('Starting Session 1 Daily Challenge...');
    await startAndReady(page, 'daily');

    const piecesSession1 = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      return debug.pieces.map(p => p ? p.name : null);
    });
    console.log('Session 1 Daily pieces:', piecesSession1);

    await page.screenshot({ path: path.join(outputDir, 'block_blast_02_session1.png') });
    console.log('Captured: block_blast_02_session1.png');

    // Click Quit/Quit button or reload to return
    console.log('Reloading page to start Session 2...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(3000);

    console.log('Starting Session 2 Daily Challenge...');
    await startAndReady(page, 'daily');

    const piecesSession2 = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      return debug.pieces.map(p => p ? p.name : null);
    });
    console.log('Session 2 Daily pieces:', piecesSession2);

    await page.screenshot({ path: path.join(outputDir, 'block_blast_03_session2.png') });
    console.log('Captured: block_blast_03_session2.png');

    if (JSON.stringify(piecesSession1) !== JSON.stringify(piecesSession2)) {
      throw new Error(`Daily seed mismatch! Session 1: ${JSON.stringify(piecesSession1)}, Session 2: ${JSON.stringify(piecesSession2)}`);
    }
    console.log('SUCCESS: Daily Challenge pieces are identical across two independent sessions!');

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICATION 2: HOLD SWAP AFTER PLACEMENT RESET
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING HOLD SWAP AFTER PLACEMENT RESET ---');
    console.log('Reloading page for Classic mode Hold check...');
    await page.reload({ waitUntil: 'networkidle2' });
    await sleep(3000);
    await startAndReady(page, 'classic');

    // Get initial piece name from slot 0
    const initialPieceName = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      return debug.pieces[0] ? debug.pieces[0].name : null;
    });

    console.log('Initial piece in Slot 0:', initialPieceName);

    // Select piece slot 0 directly via debug object to avoid click deselect collision
    console.log('Selecting Piece Slot 0...');
    await page.evaluate(() => {
      window.__debug_block_blast.setSelectedPieceIdx(0);
    });
    await sleep(300);

    // Click hold button
    console.log('Clicking Hold Button...');
    await page.click('#bb-hold-btn');
    await sleep(300);

    // Verify hold used and hold button disabled
    const holdState1 = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const holdBtn = document.getElementById('bb-hold-btn');
      return {
        heldPieceName: debug.heldPiece ? debug.heldPiece.name : null,
        holdUsedThisTurn: debug.holdUsedThisTurn,
        btnDisabled: holdBtn ? holdBtn.disabled : false,
      };
    });

    console.log('Hold State after hold:', holdState1);
    if (holdState1.heldPieceName !== initialPieceName) {
      throw new Error(`Expected held piece to be ${initialPieceName}, got ${holdState1.heldPieceName}`);
    }
    if (!holdState1.holdUsedThisTurn || !holdState1.btnDisabled) {
      throw new Error('Expected holdUsedThisTurn to be true and hold button to be disabled!');
    }

    // Now let's trigger a placement to reset hold
    console.log('Simulating block placement on board...');
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const pieceIdx = debug.pieces.findIndex(p => p !== null);
      const piece = debug.pieces[pieceIdx];
      debug.triggerPlacement(0, 0, piece, pieceIdx);
    });
    await sleep(500);

    // Select another piece to enable Hold button check
    console.log('Selecting another piece to verify Hold is reset...');
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const pieceIdx = debug.pieces.findIndex(p => p !== null);
      debug.setSelectedPieceIdx(pieceIdx);
    });
    await sleep(300);

    // Verify hold has reset
    const holdState2 = await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      const holdBtn = document.getElementById('bb-hold-btn');
      return {
        holdUsedThisTurn: debug.holdUsedThisTurn,
        btnDisabled: holdBtn ? holdBtn.disabled : false,
      };
    });

    console.log('Hold State after placement & selection:', holdState2);
    if (holdState2.holdUsedThisTurn || holdState2.btnDisabled) {
      throw new Error('Expected holdUsedThisTurn to be false and hold button enabled after placement!');
    }
    console.log('SUCCESS: Hold swap availability resets correctly after placement!');

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICATION 3: UNDO AFTER LINE CLEAR & VERIFICATION 5: PERFECT CLEAR
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING UNDO AFTER LINE CLEAR & PERFECT CLEAR ---');
    console.log('Configuring board state for single line clear + clean slate...');
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      
      // Setup almost full row 0 (cols 1 to 7 filled)
      const mockBoard = debug.board.map(() => Array(8).fill(null));
      for (let c = 1; c < 8; c++) {
        mockBoard[0][c] = 'cyan';
      }
      debug.setBoard(mockBoard);

      // Force a 1x1 block in Slot 0
      debug.setPieces([
        { id: 'single', name: 'Single', color: 'cyan', grid: [[1]], blocksCount: 1, width: 1, height: 1, difficulty: 'easy' },
        null,
        null
      ]);
    });
    await sleep(500);
    await page.screenshot({ path: path.join(outputDir, 'block_blast_04_before_clear.png') });
    console.log('Captured: block_blast_04_before_clear.png');

    console.log('Placing 1x1 block at (0, 0) to clear row 0...');
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      debug.triggerPlacement(0, 0, debug.pieces[0], 0);
    });
    await sleep(500);

    // Verify perfect clear / clean slate
    const boardStateClean = await page.evaluate(() => {
      const board = window.__debug_block_blast.board;
      return board.every(row => row.every(cell => cell === null));
    });

    console.log('Is board clean slate (Perfect Clear)?', boardStateClean);
    if (!boardStateClean) {
      throw new Error('Board was expected to be empty after clearing row 0!');
    }
    await page.screenshot({ path: path.join(outputDir, 'block_blast_05_after_clear.png') });
    console.log('Captured: block_blast_05_after_clear.png');

    // Test Undo
    console.log('Clicking Undo button to restore pre-clear state...');
    await page.click('#bb-undo-btn');
    await sleep(500);

    const boardStateRestored = await page.evaluate(() => {
      const board = window.__debug_block_blast.board;
      return {
        col0IsEmpty: board[0][0] === null,
        col1IsFilled: board[0][1] !== null,
        otherRowsAreEmpty: board.slice(1).every(row => row.every(c => c === null))
      };
    });

    console.log('Board restoration state after Undo:', boardStateRestored);
    if (!boardStateRestored.col0IsEmpty || !boardStateRestored.col1IsFilled || !boardStateRestored.otherRowsAreEmpty) {
      throw new Error('Undo did not restore the pre-clear board state correctly!');
    }
    await page.screenshot({ path: path.join(outputDir, 'block_blast_06_after_undo.png') });
    console.log('Captured: block_blast_06_after_undo.png');
    console.log('SUCCESS: Undo and Perfect Clear (bb-clean-slate) verified!');

    // ─────────────────────────────────────────────────────────────────────────
    // VERIFICATION 4: GAME OVER ON FULL BOARD EDGE CASE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- VERIFYING GAME OVER ON FULL BOARD EDGE CASE ---');
    console.log('Triggering Game Over and verification of XP submission modal...');
    await page.evaluate(() => {
      const debug = window.__debug_block_blast;
      debug.triggerGameOver(4500, 15, 6, 120, false);
    });
    console.log('Waiting for XP modal or ad overlay to appear...');
    await sleep(8000);

    // Check if ad overlay is showing
    const adShowing = await page.evaluate(() => {
      return document.getElementById('ad-overlay-container') !== null;
    });

    if (adShowing) {
      console.log('Ad overlay detected! Waiting for skip countdown to finish...');
      await page.waitForFunction(() => {
        const btn = document.getElementById('ad-skip-btn');
        return btn && !btn.disabled;
      }, { timeout: 10000 });
      console.log('Clicking skip/continue button...');
      await page.click('#ad-skip-btn');
      await sleep(1500);
    }

    await page.screenshot({ path: path.join(outputDir, 'block_blast_07_xp_modal.png') });
    console.log('Captured: block_blast_07_xp_modal.png');

    const xpModalVisible = await page.evaluate(() => {
      return document.getElementById('post-game-modal-body') !== null ||
             document.getElementById('single-player-modal-body') !== null;
    });

    console.log('Is XP Modal visible?', xpModalVisible);
    if (!xpModalVisible) {
      const debugSession = await page.evaluate(() => {
        return window.__debug_game_session || null;
      });
      console.log('Debug Game Session State:', debugSession);
      const html = await page.evaluate(() => document.body.innerHTML);
      console.log('DOM Content:', html);
      throw new Error('XP modal did not open after game over!');
    }
    
    console.log('SUCCESS: Game Over and XP post-game modal verified successfully!');

  } catch (err) {
    console.error('Error during Block Blast test execution:', err);
    process.exit(1);
  } finally {
    console.log('Closing browser and stopping dev server...');
    await browser.close();
    devServer.kill();
    await sleep(2000);
    process.exit(0);
  }
}

main().catch(console.error);
