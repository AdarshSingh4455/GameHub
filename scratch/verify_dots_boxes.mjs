import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\feef7fed-a095-4d4d-ae6c-c7a4c2f8c56b\\screenshots';

// Create directories if they don't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTestForDifficulty(page, difficulty) {
  console.log(`\n==================================================`);
  console.log(`STARTING TESTING FOR DIFFICULTY: ${difficulty.toUpperCase()}`);
  console.log(`==================================================`);

  // Ensure we are on the setup page (if in-game, go back first)
  const setupMenu = await page.$('#dotsboxes-setup-menu');
  if (!setupMenu) {
    console.log('Setup menu not visible. Clicking Back to Setup button...');
    const quitBtn = await page.$('#db-quit-btn');
    if (quitBtn) {
      await quitBtn.click();
      await sleep(1500);
    }
  }

  // Choose 6x6 board size
  console.log('Selecting 6x6 board size...');
  await page.click('#db-size-6x6');
  await sleep(500);

  // Select difficulty
  console.log(`Selecting difficulty: ${difficulty}...`);
  await page.click(`#db-ai-${difficulty}`);
  await sleep(500);

  // Click Play vs AI
  console.log('Clicking "Play vs AI"...');
  await page.click('#db-start-ai');
  await sleep(2000);

  // Take screenshot of the initial board
  await page.screenshot({ path: path.join(outputDir, `dots_boxes_${difficulty}_00_start.png`) });
  console.log(`Captured: dots_boxes_${difficulty}_00_start.png`);

  const dotsSize = 6;
  let moveCount = 0;
  let turnNumber = 1;

  // Run for at least 20 turns (or until game ends)
  while (turnNumber <= 15) { // 15 cycles of Player Move + AI Move = 30 total turns max
    console.log(`\n--- Cycle ${turnNumber} ---`);

    // 1. Get unclaimed lines
    const unclaimedLines = await page.evaluate((size) => {
      const ids = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
          const lineId = `h-${r}-${c}`;
          const el = document.getElementById(`db-line-${lineId}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && window.getComputedStyle(inner).opacity !== '1') {
              ids.push(lineId);
            }
          }
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
          const lineId = `v-${r}-${c}`;
          const el = document.getElementById(`db-line-${lineId}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && window.getComputedStyle(inner).opacity !== '1') {
              ids.push(lineId);
            }
          }
        }
      }
      return ids;
    }, dotsSize);

    if (unclaimedLines.length === 0) {
      console.log('No unclaimed lines left. Game must be over!');
      break;
    }

    // Get current line count before player move
    const lineCountBeforePlayer = await page.evaluate((size) => {
      let count = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
          const el = document.getElementById(`db-line-h-${r}-${c}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
          }
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
          const el = document.getElementById(`db-line-v-${r}-${c}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
          }
        }
      }
      return count;
    }, dotsSize);

    // 2. Select a line and click it (Player move)
    const selectedLine = unclaimedLines[Math.floor(Math.random() * unclaimedLines.length)];
    console.log(`Player draws line: ${selectedLine}`);
    await page.click(`#db-line-${selectedLine}`);
    moveCount++;

    // Wait for state to update and line to appear as claimed
    await sleep(500);

    // Verify line count increased after Player move
    const lineCountAfterPlayer = await page.evaluate((size) => {
      let count = 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 1; c++) {
          const el = document.getElementById(`db-line-h-${r}-${c}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
          }
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size; c++) {
          const el = document.getElementById(`db-line-v-${r}-${c}`);
          if (el) {
            const inner = el.querySelector('.db-line-inner');
            if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
          }
        }
      }
      return count;
    }, dotsSize);

    console.log(`Lines count: Before Player: ${lineCountBeforePlayer} -> After Player: ${lineCountAfterPlayer}`);
    if (lineCountAfterPlayer <= lineCountBeforePlayer) {
      throw new Error(`CRITICAL FAIL: Line count did not increase after Player move!`);
    }

    // Capture turn change screen
    if (turnNumber <= 2) {
      await page.screenshot({ path: path.join(outputDir, `dots_boxes_${difficulty}_turn_${turnNumber}_player.png`) });
      console.log(`Captured: dots_boxes_${difficulty}_turn_${turnNumber}_player.png`);
    }

    // Check if turn switched to AI
    const turnAfterPlayer = await page.evaluate(() => {
      const indicator = document.getElementById('db-turn-indicator');
      const text = indicator ? indicator.textContent : '';
      return {
        text,
        isAITurn: text.includes('AI Turn'),
        isGameOver: text.includes('Wins') || text.includes('Tie')
      };
    });

    if (turnAfterPlayer.isAITurn) {
      // 3. Wait for AI Turn to finish (either player turn indicator active or game over)
      console.log('Waiting for AI turn...');
      let isAITurnActive = true;
      let attempts = 0;
      while (isAITurnActive && attempts < 15) {
        await sleep(500);
        const turnStatus = await page.evaluate(() => {
          const indicator = document.getElementById('db-turn-indicator');
          const text = indicator ? indicator.textContent : '';
          const hasWinner = document.getElementById('db-quit-btn') && 
                            (text.includes('Wins!') || text.includes('Tie'));
          return {
            text,
            isPlayerTurn: text.includes('Your Turn') || text.includes('Player 1 Turn'),
            isGameOver: hasWinner || text.includes('Wins') || text.includes('Tie')
          };
        });

        if (turnStatus.isPlayerTurn || turnStatus.isGameOver) {
          isAITurnActive = false;
          if (turnStatus.isGameOver) {
            console.log(`Game Over detected during AI turn: ${turnStatus.text}`);
          }
        }
        attempts++;
      }

      if (isAITurnActive) {
        throw new Error(`CRITICAL FAIL: AI turn got deadlocked or timed out! Turn status: ${await page.evaluate(() => document.getElementById('db-turn-indicator')?.textContent)}`);
      }

      // Wait 300ms for CSS transition to fully settle
      await sleep(300);

      // Verify line count increased after AI move
      const lineCountAfterAI = await page.evaluate((size) => {
        let count = 0;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size - 1; c++) {
            const el = document.getElementById(`db-line-h-${r}-${c}`);
            if (el) {
              const inner = el.querySelector('.db-line-inner');
              if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
            }
          }
        }
        for (let r = 0; r < size - 1; r++) {
          for (let c = 0; c < size; c++) {
            const el = document.getElementById(`db-line-v-${r}-${c}`);
            if (el) {
              const inner = el.querySelector('.db-line-inner');
              if (inner && parseFloat(window.getComputedStyle(inner).opacity) > 0.5) count++;
            }
          }
        }
        return count;
      }, dotsSize);

      console.log(`Lines count: After Player: ${lineCountAfterPlayer} -> After AI: ${lineCountAfterAI}`);
      
      if (lineCountAfterAI <= lineCountAfterPlayer) {
        throw new Error(`CRITICAL FAIL: Line count did not increase after AI turn!`);
      }
    } else {
      console.log(`Player completed a box! Extra turn granted. Skipping AI turn wait. currentTurnText=${turnAfterPlayer.text}`);
    }

    if (turnNumber <= 2) {
      await page.screenshot({ path: path.join(outputDir, `dots_boxes_${difficulty}_turn_${turnNumber}_ai.png`) });
      console.log(`Captured: dots_boxes_${difficulty}_turn_${turnNumber}_ai.png`);
    }

    // Check if game is over
    const isGameOver = await page.evaluate(() => {
      const text = document.getElementById('db-turn-indicator')?.textContent || '';
      return text.includes('Wins') || text.includes('Tie');
    });

    if (isGameOver) {
      console.log('Game is over.');
      break;
    }

    turnNumber++;
  }

  // Take final game board screenshot
  await page.screenshot({ path: path.join(outputDir, `dots_boxes_${difficulty}_final.png`) });
  console.log(`Captured: dots_boxes_${difficulty}_final.png`);
  console.log(`COMPLETED TESTING FOR ${difficulty.toUpperCase()}. Total turns verified: ${turnNumber * 2}`);
}

async function main() {
  console.log('Starting Next.js development server...');
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
  await sleep(8000);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);

  // Monitor page console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[DEBUG]')) {
      console.log(`[PAGE LOG] ${text}`);
    }
  });

  try {
    // 1. Bypass auth
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // 2. Go to Dots & Boxes page
    console.log('Navigating to Dots & Boxes game...');
    await page.goto('http://localhost:3000/dashboard/games/dots-boxes', { waitUntil: 'networkidle2' });
    await sleep(2500);

    // Run tests for all three difficulties
    await runTestForDifficulty(page, 'easy');
    await runTestForDifficulty(page, 'medium');
    await runTestForDifficulty(page, 'hard');

    console.log('\nAll tests completed successfully!');
  } catch (err) {
    console.error('Error during test execution:', err);
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
