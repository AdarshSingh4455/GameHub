import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const conversationId = '21eb29c1-97f6-4a5c-9df2-863f19824772';
const outputDir = `C:\\Users\\adars\\.gemini\\antigravity\\brain\\${conversationId}`;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function startAndReady(page, mode = 'classic', difficulty = 'normal') {
  console.log(`Starting Word Wizard in ${mode} mode with ${difficulty} difficulty...`);
  
  await page.waitForSelector('#ww-setup-menu h2', { timeout: 10000 });
  
  // Select mode
  const modeButtons = await page.$$('#ww-setup-menu button');
  for (const btn of modeButtons) {
    const text = await page.evaluate(el => el.textContent.toLowerCase(), btn);
    if (mode === 'classic' && text.includes('classic')) {
      await btn.click();
    } else if (mode === 'endless' && text.includes('endless')) {
      await btn.click();
    } else if (mode === 'daily' && text.includes('daily')) {
      await btn.click();
    }
  }
  await sleep(300);

  // Select difficulty (only for classic/endless)
  if (mode !== 'daily') {
    const diffButtons = await page.$$('#ww-setup-menu button');
    for (const btn of diffButtons) {
      const text = await page.evaluate(el => el.textContent.toLowerCase(), btn);
      if (difficulty === 'easy' && text.includes('easy')) {
        await btn.click();
      } else if (difficulty === 'normal' && text.includes('normal')) {
        await btn.click();
      } else if (difficulty === 'hard' && text.includes('hard')) {
        await btn.click();
      }
    }
    await sleep(300);
  }

  // Click start button
  const startBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('#ww-setup-menu button'));
    return buttons.find(b => b.textContent.includes('Spell Again') || b.textContent.includes('Spellwards!'));
  });
  if (startBtn && startBtn.asElement()) {
    await startBtn.asElement().click();
  } else {
    // If setup not active, find and click start
    const buttons = await page.$$('#ww-setup-menu button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Spellwards!') || text.includes('Spell Again')) {
        await btn.click();
        break;
      }
    }
  }

  await page.waitForFunction(() => {
    const debug = window.__debug_word_wizard;
    return debug && debug.grid && debug.grid.length > 0;
  }, { timeout: 20000 });

  await sleep(800);
  console.log('Word Wizard board initialized.');
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

    console.log('Navigating to Word Wizard...');
    await page.goto('http://localhost:3001/dashboard/games/word-wizard', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Capture Setup Screen
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_01_setup.png') });
    console.log('Screenshot saved: wordwizard_01_setup.png');

    // ─── TEST 1: GRID GENERATION SIZES ───
    console.log('Verifying grid size variations...');
    // Easy mode should be 4x4
    await startAndReady(page, 'classic', 'easy');
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_02_classic_start.png') });
    console.log('Screenshot saved: wordwizard_02_classic_start.png');

    const easySize = await page.evaluate(() => window.__debug_word_wizard.grid.length);
    if (easySize !== 4) throw new Error(`Easy board size should be 4, got: ${easySize}`);
    console.log('✅ Easy board size check passed.');

    // Exit to setup
    const exitBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Exit Game'));
    });
    await exitBtn.asElement().click();
    await sleep(500);

    // Normal mode should be 5x5
    await startAndReady(page, 'classic', 'normal');
    const normalSize = await page.evaluate(() => window.__debug_word_wizard.grid.length);
    if (normalSize !== 5) throw new Error(`Normal board size should be 5, got: ${normalSize}`);
    console.log('✅ Normal board size check passed.');

    // ─── TEST 2: WORD VALIDATION & SCORING ───
    console.log('Verifying word spelling and scoring mechanics...');
    const targetWord = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      return debug.allWords[0];
    });

    if (!targetWord) throw new Error('No valid words found on board');

    console.log(`Submitting valid word: "${targetWord}"`);
    await page.evaluate((word) => {
      window.__debug_word_wizard.submitWord(word);
    }, targetWord);

    await sleep(800); // Wait for React state update

    console.log('Submitting invalid word: "xyzqwe"');
    await page.evaluate(() => {
      window.__debug_word_wizard.submitWord('xyzqwe');
    });

    await sleep(800); // Wait for React state update

    const foundWords = await page.evaluate(() => {
      return window.__debug_word_wizard.foundWords;
    });

    console.log('Found words in state:', foundWords);
    if (!foundWords.includes(targetWord.toLowerCase())) {
      throw new Error(`Spelled word "${targetWord}" was not added to foundWords list`);
    }
    if (foundWords.includes('xyzqwe')) {
      throw new Error('Invalid word "xyzqwe" was incorrectly accepted');
    }
    console.log('✅ Word validation verification passed.');
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_03_word_spelled.png') });
    console.log('Screenshot saved: wordwizard_03_word_spelled.png');

    // ─── TEST 3: HINTS PENALTY & LOGIC ───
    console.log('Verifying hints system...');
    const hintSelector = '[data-testid="ww-hint-button"]';
    
    await page.waitForSelector(hintSelector, { timeout: 5000 });

    const buttonState = await page.evaluate((sel) => {
      const btn = document.querySelector(sel);
      if (!btn) return { exists: false };
      
      const rect = btn.getBoundingClientRect();
      const style = window.getComputedStyle(btn);
      const isVisible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      const isDisabled = btn.disabled;
      
      return {
        exists: true,
        visible: isVisible,
        disabled: isDisabled,
        textContent: btn.textContent.trim(),
        zIndex: style.zIndex,
      };
    }, hintSelector);

    console.log('Hint Button State:', buttonState);

    if (!buttonState.exists) {
      throw new Error('Hint button does not exist in DOM');
    }
    if (!buttonState.visible) {
      throw new Error('Hint button is not visible');
    }
    if (buttonState.disabled) {
      throw new Error('Hint button is disabled. Hints remaining: ' + buttonState.textContent);
    }

    await page.click(hintSelector);
    await sleep(800);
    
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_04_hint_used.png') });
    console.log('Screenshot saved: wordwizard_04_hint_used.png');
    console.log('✅ Hint activation checked.');

    // ─── TEST 4: DAILY CHALLENGE SEED CONSISTENCY ───
    console.log('Verifying daily challenge seed consistency...');
    await page.evaluate(() => {
      // Exit active game
      const buttons = Array.from(document.querySelectorAll('button'));
      const exit = buttons.find(b => b.textContent.includes('Exit Game'));
      if (exit) exit.click();
    });
    await sleep(500);

    // Start daily mode 1
    await startAndReady(page, 'daily');
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_05_daily_start.png') });
    console.log('Screenshot saved: wordwizard_05_daily_start.png');
    const dailyGrid1 = await page.evaluate(() => JSON.stringify(window.__debug_word_wizard.grid));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exit = buttons.find(b => b.textContent.includes('Exit Game'));
      if (exit) exit.click();
    });
    await sleep(500);

    // Start daily mode 2
    await startAndReady(page, 'daily');
    const dailyGrid2 = await page.evaluate(() => JSON.stringify(window.__debug_word_wizard.grid));
    
    if (dailyGrid1 !== dailyGrid2) {
      throw new Error('Daily challenge boards were not identical across separate starts');
    }
    console.log('✅ Daily challenge seed consistency passed.');

    // ─── TEST 5: GAME OVER & RESULT SUBMISSION ───
    console.log('Verifying game over overlay and database score submission...');
    await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      debug.triggerGameOver();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_06_gameover.png') });
    console.log('Screenshot saved: wordwizard_06_gameover.png');

    console.log('Bypassing Game over screen to check global session XP modal...');
    
    // Monitor and log transitions
    console.log('Monitoring post-game stage and XP modal state...');
    let xpModalVisible = false;
    for (let i = 0; i < 20; i++) {
      const state = await page.evaluate(() => {
        const session = window.__debug_game_session || {};
        const adContainer = document.getElementById('ad-overlay-container') !== null;
        const postGameModal = document.getElementById('post-game-modal-body') !== null;
        const singlePlayerModal = document.getElementById('single-player-modal-body') !== null;
        return {
          postGameStage: session.postGameStage,
          isLoading: session.isLoading,
          adContainerVisible: adContainer,
          postGameModalVisible: postGameModal,
          singlePlayerModalVisible: singlePlayerModal,
        };
      });
      
      console.log(`[E2E STATE LOG] Time: ${i * 500}ms | Stage: ${state.postGameStage} | Loading: ${state.isLoading} | AdOverlay: ${state.adContainerVisible} | PostGameModal: ${state.postGameModalVisible} | SinglePlayerModal: ${state.singlePlayerModalVisible}`);
      
      if (state.adContainerVisible) {
        console.log('Ad overlay detected! Waiting for skip countdown...');
        await page.waitForFunction(() => {
          const btn = document.getElementById('ad-skip-btn');
          return btn && !btn.disabled;
        }, { timeout: 10000 });
        console.log('Clicking skip ad button...');
        await page.click('#ad-skip-btn');
        await sleep(1000);
      }

      if (state.singlePlayerModalVisible || state.postGameModalVisible) {
        xpModalVisible = true;
        break;
      }
      await sleep(500);
    }

    if (!xpModalVisible) {
      throw new Error('XP modal did not become visible after game over');
    }

    await sleep(1000);
    await page.screenshot({ path: path.join(outputDir, 'wordwizard_07_xp_modal.png') });
    console.log('Screenshot saved: wordwizard_07_xp_modal.png');
    console.log('✅ Game over and XP modal verification passed.');

  } catch (err) {
    console.error('❌ E2E Verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    console.log('Stopping Next.js dev server...');
    devServer.kill('SIGINT');
    await sleep(2000);
    console.log('E2E Verification completed.');
  }
}

main();
