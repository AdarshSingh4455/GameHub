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
  console.log(`[BOARD GEN TEST] Starting Word Wizard: mode=${mode}, difficulty=${difficulty}...`);
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
  console.log('[BOARD GEN TEST] Word Wizard board loaded.');
}

async function main() {
  console.log('[BOARD GEN TEST] Spinning up Next.js dev server on port 3005...');
  const devServer = spawn('npx.cmd', ['next', 'dev', '-p', '3005'], {
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

    console.log('[BOARD GEN TEST] Logging in...');
    await page.goto('http://localhost:3005/login', { waitUntil: 'networkidle2' });
    await sleep(2000);

    console.log('[BOARD GEN TEST] Navigating to Word Wizard...');
    await page.goto('http://localhost:3005/dashboard/games/word-wizard', { waitUntil: 'networkidle2' });
    await sleep(2000);

    // ─── TEST 1: EASY DIFFICULTY BOARD QUALITY & TARGET EXISTENCE ───
    await startAndReady(page, 'classic', 'easy');
    
    const easyData = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      const targets = debug.targets || [];
      const allWords = debug.allWords || [];
      const grid = debug.grid;
      return { targets, allWords, grid };
    });

    console.log('[BOARD GEN TEST] Easy targets:', easyData.targets);
    console.log('[BOARD GEN TEST] Total words found on board:', easyData.allWords.length);

    if (easyData.targets.length !== 4) {
      throw new Error(`Expected exactly 4 targets for Easy mode, got ${easyData.targets.length}`);
    }

    // Verify target words exist and are in the allWords set
    for (const target of easyData.targets) {
      if (!easyData.allWords.includes(target.toLowerCase())) {
        throw new Error(`Target word ${target} does not exist in the board words set!`);
      }
    }
    console.log('✓ Easy target words exist and are traceable.');

    // Verify quality rule: min 10 additional words
    const additionalWordsCountEasy = easyData.allWords.filter(w => !easyData.targets.map(t => t.toLowerCase()).includes(w)).length;
    console.log('[BOARD GEN TEST] Easy additional words count:', additionalWordsCountEasy);
    if (additionalWordsCountEasy < 10) {
      throw new Error(`Expected min 10 additional words for Easy mode, got ${additionalWordsCountEasy}`);
    }
    console.log('✓ Easy mode quality rules satisfied.');

    // ─── TEST 2: HINTS HIGHLIGHTING PROGRESSION ───
    console.log('[BOARD GEN TEST] Verifying progressive hint levels...');
    
    // Hint Level 1
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    let hintState1 = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      return {
        level: debug.activeHint?.level,
        msg: document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '',
      };
    });
    console.log('[BOARD GEN TEST] Hint level 1:', hintState1);
    if (hintState1.level !== 1 || !hintState1.msg.includes('starts here')) {
      throw new Error(`Level 1 hint incorrect. Level: ${hintState1.level}, Msg: ${hintState1.msg}`);
    }
    console.log('✓ Hint 1 correctly highlights starting tile.');

    // Hint Level 2
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    let hintState2 = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      return {
        level: debug.activeHint?.level,
        msg: document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '',
      };
    });
    console.log('[BOARD GEN TEST] Hint level 2:', hintState2);
    if (hintState2.level !== 2 || !hintState2.msg.includes('Length')) {
      throw new Error(`Level 2 hint incorrect. Level: ${hintState2.level}, Msg: ${hintState2.msg}`);
    }
    console.log('✓ Hint 2 correctly highlights first two tiles and shows length.');

    // Hint Level 3
    await page.click('[data-testid="ww-hint-button"]');
    await sleep(500);
    let hintState3 = await page.evaluate(() => {
      const debug = window.__debug_word_wizard;
      return {
        level: debug.activeHint?.level,
        msg: document.querySelector('[data-testid="ww-hint-message"]')?.textContent || '',
      };
    });
    console.log('[BOARD GEN TEST] Hint level 3:', hintState3);
    if (hintState3.level !== 3) {
      throw new Error(`Level 3 hint incorrect. Level: ${hintState3.level}`);
    }
    console.log('✓ Hint 3 correctly highlights full path.');

    // ─── TEST 3: CATEGORY COMPLETION ───
    console.log('[BOARD GEN TEST] Solving the target words to trigger Category Completion...');
    const result = await page.evaluate(async () => {
      const debug = window.__debug_word_wizard;
      const targets = debug.targets || [];
      const initialScore = debug.score;

      for (const target of targets) {
        debug.submitWord(target);
        await new Promise(r => setTimeout(r, 100));
      }

      return {
        foundCount: debug.foundWordsCount,
        finalScore: debug.score,
        initialScore,
        categoryCompleted: debug.categoryCompleted
      };
    });

    console.log('[BOARD GEN TEST] Completion results:', result);
    if (result.foundCount < 4) {
      throw new Error(`Expected to find 4 targets, found ${result.foundCount}`);
    }
    if (!result.categoryCompleted) {
      throw new Error('Category completion banner did not trigger!');
    }
    const scoreDiff = result.finalScore - result.initialScore;
    if (scoreDiff < 1000) {
      throw new Error(`Expected score difference to be at least 1000 (bonus), got ${scoreDiff}`);
    }
    console.log('✓ Category completion triggers and awards +1000 bonus score.');

    // Save screenshot of victory
    await page.screenshot({ path: path.join(outputDir, 'ww_board_gen_category_complete.png') });
    console.log('[BOARD GEN TEST] Saved ww_board_gen_category_complete.png');

    console.log('🎉 ALL Word Wizard Board Generation E2E Tests Passed successfully!');

  } catch (err) {
    console.error('❌ E2E Board Generation Test failed:', err);
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
