import puppeteer from 'puppeteer';
import { spawn, execSync } from 'child_process';
import dns from 'dns';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\8ce036c5-a737-4147-8687-1c675a027ef6';
const PORT = 3009;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 1. Run seed script for mock ad
console.log('Seeding mock ad...');
try {
  execSync('cmd /c "npx tsx --env-file=.env.local scratch/seed_mock_ad.ts"', { stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run mock ad seed script:', err);
}

// 2. Start Next.js dev server
console.log('Starting Next.js dev server...');
const devServer = spawn('npx', ['next', 'dev', '-p', PORT.toString()], {
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
});

devServer.stdout.on('data', (data) => {
  console.log(`[Next.js]: ${data.toString().trim()}`);
});

devServer.stderr.on('data', (data) => {
  console.error(`[Next.js Error]: ${data.toString().trim()}`);
});

// Wait for dev server to start
await sleep(10000);

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Helper to take a screenshot and log
  const capture = async (name, width, height, isMobile = false) => {
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });
    await sleep(2500); // wait for layout/render
    const filePath = path.join(outputDir, name);
    await page.screenshot({ path: filePath });
    console.log(`Captured: ${name} (${width}x${height})`);
  };

  try {
    const uniqueId = Math.floor(Math.random() * 900000) + 100000;
    const username = `verify_${uniqueId}`;
    const email = `${username}@example.com`;
    const password = `Password${uniqueId}!`;

    console.log(`Registering verification user: ${username}`);
    await page.goto(`http://localhost:${PORT}/register`, { waitUntil: 'networkidle2' });
    await sleep(2000);

    // Fill registration
    await page.type('input[placeholder*="Username" i], input[type="text"]', username);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await sleep(6000); // wait for session creation and dashboard load

    // 1. Mobile Games Library fixed (390x844)
    console.log('Capturing Games Library...');
    await page.goto(`http://localhost:${PORT}/dashboard/games`, { waitUntil: 'networkidle2' });
    await capture('mobile_games_library.png', 390, 844, true);

    // 2. Mobile Store fixed (390x844)
    console.log('Capturing Store...');
    await page.goto(`http://localhost:${PORT}/dashboard/store`, { waitUntil: 'networkidle2' });
    await capture('mobile_store.png', 390, 844, true);

    // 3. Profile Card stats view (390x844)
    console.log('Capturing Profile Card with new stats...');
    await page.goto(`http://localhost:${PORT}/dashboard/leaderboard`, { waitUntil: 'networkidle2' });
    await sleep(2500);
    // Find a user row in the leaderboard to click
    const userRow = await page.$('.leaderboard-row');
    if (userRow) {
      await userRow.click();
      console.log('Clicked user row to open Profile Card.');
      await sleep(2000); // wait for profile fetch and animation
      await capture('profile_card_stats.png', 390, 844, true);
      
      // Close profile modal/drawer by clicking backdrop or close button
      const closeBtn = await page.$('.sm\\:flex'); // desktop close button or overlay
      if (closeBtn) {
        await closeBtn.click();
      } else {
        await page.click('body');
      }
      await sleep(500);
    } else {
      console.log('No user row found on leaderboard. Navigating to friends to open card.');
      await page.goto(`http://localhost:${PORT}/dashboard/friends`, { waitUntil: 'networkidle2' });
      await sleep(2000);
      // Try to open own profile card from navbar or profile settings if possible
    }

    // 4. Memory Match AI Turn Completed (390x844)
    console.log('Navigating to Memory Match...');
    await page.goto(`http://localhost:${PORT}/dashboard/games/memory`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    // Select Moderate AI to enter playing state
    const moderateBtn = await page.$('#memory-ai-moderate');
    if (moderateBtn) {
      await moderateBtn.click();
    } else {
      const launchBtn = await page.$('#memory-start-ai');
      if (launchBtn) await launchBtn.click();
    }
    await sleep(2000);

    // Click card 0 (Player turn)
    const card0 = await page.$('#memory-card-0');
    if (card0) {
      await card0.click();
      console.log('Clicked card 0.');
      await sleep(500);
    }
    // Click card 1 (Player turn finishes, switches to AI turn)
    const card1 = await page.$('#memory-card-1');
    if (card1) {
      await card1.click();
      console.log('Clicked card 1. AI turn starting...');
    }
    // Wait for AI to execute turn (500-1000ms delay) and then capture
    await sleep(2500);
    await capture('memory_match_ai_turn.png', 390, 844, true);

    // 5. Number Guessing AI Turn Completed (390x844)
    console.log('Navigating to Number Guessing...');
    await page.goto(`http://localhost:${PORT}/dashboard/games/number-guessing`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    const numStartBtn = await page.$('#numguess-start-ai');
    if (numStartBtn) await numStartBtn.click();
    await sleep(2000);

    // Make guess 50
    const guessInput = await page.$('#numguess-input-field');
    if (guessInput) {
      await page.type('#numguess-input-field', '50');
      await page.click('#numguess-submit-btn');
      console.log('Submitted guess 50. AI turn starting...');
    }
    // Wait for AI to execute turn and guess back (500-1000ms delay)
    await sleep(2500);
    await capture('number_guessing_ai_turn.png', 390, 844, true);

    // 6. Ad -> XP Modal Flow (390x844)
    console.log('Navigating to Tic Tac Toe to trigger Victory flow...');
    await page.goto(`http://localhost:${PORT}/dashboard/games/tic-tac-toe`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    // Click Start vs AI
    const tttStart = await page.$('#ttt-start-ai');
    if (tttStart) await tttStart.click();
    await sleep(2000);

    // Play Tic-Tac-Toe sequence to win quickly:
    // X clicks 0, 1, 2. AI plays in between.
    await page.click('#ttt-cell-0');
    console.log('P1 clicked cell 0. Waiting for AI move...');
    await sleep(1500); // Wait for AI move

    await page.click('#ttt-cell-1');
    console.log('P1 clicked cell 1. Waiting for AI move...');
    await sleep(1500); // Wait for AI move

    await page.click('#ttt-cell-2');
    console.log('P1 clicked cell 2. Winning move! Transitioning to ad...');
    await sleep(2000); // Wait for result submit and ad load

    // Ad overlay should be visible now!
    await capture('ad_xp_modal_sequence.png', 390, 844, true);

  } catch (err) {
    console.error('Error during verification run:', err);
  } finally {
    await browser.close();
    devServer.kill();
    console.log('Verification finished. Server stopped.');
    process.exit(0);
  }
}

run();
