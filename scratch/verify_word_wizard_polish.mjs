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

async function startAndReady(page, mode = 'classic', difficulty = 'easy') {
  console.log(`[E2E] Starting Word Wizard: mode=${mode}, difficulty=${difficulty}...`);
  await page.waitForSelector('#ww-setup-menu h2', { timeout: 10000 });
  await sleep(500);

  // Click mode
  const buttons = await page.$$('#ww-setup-menu button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent.toLowerCase(), btn);
    if (text.includes(mode)) {
      await btn.click();
      await sleep(300);
      break;
    }
  }

  // Click difficulty
  if (mode !== 'daily') {
    const diffButtons = await page.$$('#ww-setup-menu button');
    for (const btn of diffButtons) {
      const text = await page.evaluate(el => el.textContent.toLowerCase(), btn);
      if (text.includes(difficulty)) {
        await btn.click();
        await sleep(300);
        break;
      }
    }
  }

  // Click Start
  const startBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('#ww-setup-menu button'));
    return buttons.find(b => b.textContent.includes('Spellwards!') || b.textContent.includes('Spell Again'));
  });
  if (startBtn && startBtn.asElement()) {
    await startBtn.asElement().click();
  }
  await sleep(1000);

  // Verify board is active
  await page.waitForFunction(() => {
    const debug = window.__debug_word_wizard;
    return debug && debug.grid && debug.grid.length > 0;
  }, { timeout: 15000 });
  console.log('[E2E] Word Wizard board loaded.');
}

async function main() {
  console.log('[E2E] Spinning up Next.js dev server on port 3002...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3002'], {
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
  let hasWarnings = false;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45000);

    // Watch for react/console warnings
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[BROWSER]: ${text}`);
      if (text.includes('Cannot update a component') || text.includes('Warning:')) {
        hasWarnings = true;
      }
    });

    console.log('[E2E] Logging in...');
    await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[E2E] Navigating to Word Wizard...');
    await page.goto('http://localhost:3002/dashboard/games/word-wizard', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── TEST 1: CATEGORY TARGETS AND VISIBILITY MODES ───
    await startAndReady(page, 'classic', 'easy');
    await page.screenshot({ path: path.join(outputDir, 'ww_easy_mode_checklist.png') });
    console.log('[E2E] Saved ww_easy_mode_checklist.png');

    // Easy Mode should reveal targets
    const targetInfo = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      const targets = debug.targets || [];
      const checklistTexts = Array.from(document.querySelectorAll('[data-testid="ww-target-item"]')).map(el => el.textContent.trim());
      return { targets, checklistTexts };
    });
    console.log('[E2E] Easy Targets:', targetInfo.targets);
    console.log('[E2E] Easy Checklist UI Texts:', targetInfo.checklistTexts);

    if (targetInfo.targets.length !== 4) {
      throw new Error(`Expected exactly 4 targets for Easy mode, got ${targetInfo.targets.length}`);
    }
    // Check if the checklist text actually shows the words (e.g. TREE or _ _ _ _)
    const firstChecklistWord = targetInfo.checklistTexts[0] || '';
    if (firstChecklistWord.includes('_')) {
      throw new Error(`Easy mode checklist shouldn't contain underscores: ${firstChecklistWord}`);
    }
    console.log('✅ Easy mode visibility check passed.');

    // Exit and Start Normal Mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exit = buttons.find(b => b.textContent.includes('Exit Game'));
      if (exit) exit.click();
    });
    await sleep(500);

    await startAndReady(page, 'classic', 'normal');
    const normalTexts = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('[data-testid="ww-target-item"]')).map(el => el.textContent.trim());
    });
    console.log('[E2E] Normal Checklist UI Texts:', normalTexts);
    if (!normalTexts.every(t => t.includes('_'))) {
      throw new Error('Normal mode checklist should display underscores for lengths');
    }
    console.log('✅ Normal mode visibility check passed.');

    // Exit and Start Hard Mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exit = buttons.find(b => b.textContent.includes('Exit Game'));
      if (exit) exit.click();
    });
    await sleep(500);

    await startAndReady(page, 'classic', 'hard');
    const hardPanelText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ww-target-list"]');
      return el ? el.textContent : '';
    });
    console.log('[E2E] Hard UI Panel Text:', hardPanelText);
    if (!hardPanelText.includes('Hidden Words')) {
      throw new Error('Hard mode should hide individual targets and state how many hidden words exist');
    }
    console.log('✅ Hard mode visibility check passed.');

    // Exit and return to Easy Mode for completion/hint tests
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exit = buttons.find(b => b.textContent.includes('Exit Game'));
      if (exit) exit.click();
    });
    await sleep(500);

    await startAndReady(page, 'classic', 'easy');

    // ─── TEST 2: HINTS SYSTEM PROGRESSION ───
    console.log('[E2E] Verifying progressive hint levels...');
    // Level 1 hint
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    let hintMsg = await page.evaluate(() => document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '');
    console.log('[E2E] Hint level 1 message:', hintMsg);
    if (!hintMsg.toLowerCase().includes('starts here')) {
      throw new Error(`Expected Level 1 hint message to mention start tile, got: ${hintMsg}`);
    }

    // Level 2 hint
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    hintMsg = await page.evaluate(() => document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '');
    console.log('[E2E] Hint level 2 message:', hintMsg);
    if (!hintMsg.toLowerCase().includes('length')) {
      throw new Error(`Expected Level 2 hint message to mention length, got: ${hintMsg}`);
    }

    // Level 3 hint
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    hintMsg = await page.evaluate(() => document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '');
    console.log('[E2E] Hint level 3 message:', hintMsg);
    if (!hintMsg.toLowerCase().includes('glow')) {
      throw new Error(`Expected Level 3 hint message to mention glow, got: ${hintMsg}`);
    }
    console.log('✅ Progressive hints verified successfully.');

    // ─── TEST 3: TARGET MATCHING, PROGRESS UPDATES AND BONUS ───
    console.log('[E2E] Solving the target words...');
    const result = await page.evaluate(async () => {
      const debug = window.__debug_word_wizard;
      const targets = debug.targets || [];
      const initialScore = debug.score;

      // Submit all target words
      for (const target of targets) {
        debug.submitWord(target);
        // Wait 100ms
        await new Promise(r => setTimeout(r, 100));
      }

      console.log('[E2E INTERNAL] ' + JSON.stringify({
        foundWords: debug.foundWords,
        foundWordsCount: debug.foundWordsCount,
        targetWords: debug.targetWords,
        targetWordsCount: debug.targetWordsCount,
        categoryCompleted: debug.categoryCompleted
      }));

      return {
        foundCount: debug.foundWordsCount,
        finalScore: debug.score,
        initialScore,
        categoryCompleted: debug.categoryCompleted
      };
    });

    console.log('[E2E] Solve results:', result);
    if (result.foundCount < 4) {
      throw new Error('Not all target words were correctly identified and registered');
    }
    // Completion bonus check: target score diff should include standard score plus +1000 bonus
    const scoreDiff = result.finalScore - result.initialScore;
    console.log(`[E2E] Score increase: ${scoreDiff} points`);
    if (scoreDiff < 1000) {
      throw new Error('Score did not register the +1000 Category Complete bonus!');
    }
    console.log('✅ Target matching and category completion bonus verified.');
    await page.screenshot({ path: path.join(outputDir, 'ww_category_complete_celebration.png') });
    console.log('[E2E] Saved ww_category_complete_celebration.png');

    // ─── TEST 4: GAME OVER SCREEN AND NO REACT RENDER WARNINGS ───
    console.log('[E2E] Triggering game over and verifying warnings...');
    await page.evaluate(() => {
      window.__debug_word_wizard.triggerGameOver();
    });
    await sleep(2000);

    if (hasWarnings) {
      throw new Error('Detected React render phase warnings during gameplay or endGame!');
    }
    console.log('✅ No React warnings detected. Game session ended cleanly.');

  } catch (err) {
    console.error('❌ E2E Word Wizard Polish failed:', err);
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
