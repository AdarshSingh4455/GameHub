import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import dns from 'dns';

// Ensure local DNS resolution works offline
dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\67c5cd80-1340-4a3e-8c66-de14a0564016';

// 1. Start the next dev server with MOCK_AUTH=true
console.log('Starting Next.js dev server with MOCK_AUTH=true...');
const devServer = spawn('npx', ['next', 'dev', '-p', '3000'], {
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
await new Promise((resolve) => setTimeout(resolve, 8000));

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Helper to take a screenshot and log
  const capture = async (name, width, height, isMobile = false) => {
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });
    await new Promise((resolve) => setTimeout(resolve, 2000)); // wait for layout/render
    const path = `${outputDir}\\${name}`;
    await page.screenshot({ path });
    console.log(`Captured: ${name} (${width}x${height})`);
  };

  try {
    // 1. Google login page / Sign in
    console.log('Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await capture('google_login_success.png', 1280, 800);

    // 2. Dashboard after Google login (Mocked profile details)
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await capture('dashboard_after_google_login.png', 1280, 800);

    // 3. Mobile Hamburger Menu Visible
    console.log('Emulating mobile portrait for hamburger menu...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    // Click the Hamburger Menu button (☰)
    const hamburgerBtn = await page.$('header.mobile-header button');
    if (hamburgerBtn) {
      await hamburgerBtn.click();
      console.log('Clicked hamburger menu button.');
    }
    await capture('hamburger_menu_visible.png', 375, 667, true);

    // Close hamburger by clicking backdrop
    const backdrop = await page.$('.mobile-drawer-overlay');
    if (backdrop) {
      await backdrop.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 4. Rewards Page
    console.log('Navigating to rewards page...');
    await page.goto('http://localhost:3000/dashboard/rewards', { waitUntil: 'networkidle2' });
    await capture('rewards_page.png', 1280, 800);

    // 4b. Leaderboard Page
    console.log('Navigating to leaderboard page...');
    await page.goto('http://localhost:3000/dashboard/leaderboard', { waitUntil: 'networkidle2' });
    await capture('leaderboard_page.png', 1280, 800);

    // 4c. Settings Page
    console.log('Navigating to settings page...');
    await page.goto('http://localhost:3000/dashboard/settings', { waitUntil: 'networkidle2' });
    await capture('settings_page.png', 1280, 800);

    // 4d. Friends Page
    console.log('Navigating to friends page...');
    await page.goto('http://localhost:3000/dashboard/friends', { waitUntil: 'networkidle2' });
    await capture('friends_page.png', 1280, 800);

    // 5. Dual Player Category Visible
    console.log('Navigating to games directory...');
    await page.goto('http://localhost:3000/dashboard/games', { waitUntil: 'networkidle2' });
    // Click on "Dual Player" tab
    const tabs = await page.$$('button');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Dual Player')) {
        await tab.click();
        console.log('Clicked Dual Player category tab.');
        break;
      }
    }
    await capture('dual_player_category_visible.png', 1280, 800);

    // 6. Memory Match Portrait
    console.log('Navigating to Memory Match (setup)...');
    await page.goto('http://localhost:3000/dashboard/games/memory', { waitUntil: 'networkidle2' });
    // Click Easy difficulty to enter playing state
    const easyButtons = await page.$$('button');
    for (const btn of easyButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Easy')) {
        await btn.click();
        console.log('Clicked Easy difficulty button.');
        break;
      }
    }
    await capture('memory_match_portrait.png', 375, 667, true);

    // 7. Memory Match Landscape
    console.log('Rotating to landscape for Memory Match...');
    await capture('memory_match_landscape.png', 667, 375, true);

    // 8. Tic Tac Toe Landscape
    console.log('Navigating to Tic-Tac-Toe...');
    await page.goto('http://localhost:3000/dashboard/games/tic-tac-toe', { waitUntil: 'networkidle2' });
    // Click Single Player vs AI button to start
    const startBtns = await page.$$('button');
    for (const btn of startBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('vs AI')) {
        await btn.click();
        console.log('Started Tic-Tac-Toe vs AI.');
        break;
      }
    }
    await capture('tic_tac_toe_landscape.png', 667, 375, true);

    // 9. Fullscreen Game (Mobile Portrait Auto-Fullscreen)
    console.log('Navigating to Tic-Tac-Toe on mobile portrait (auto-fullscreen test)...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/dashboard/games/tic-tac-toe', { waitUntil: 'networkidle2' });
    // Find the vs AI button again and click
    const tttBtns = await page.$$('button');
    for (const btn of tttBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('vs AI')) {
        await btn.click();
        break;
      }
    }
    await capture('fullscreen_game.png', 375, 667, true);

    // 10. Victory Modal
    console.log('Triggering Victory Modal...');
    // We can evaluate directly on the client to invoke the context submitGameResult method
    await page.evaluate(() => {
      // Find the submitGameResult method from the Context or simply trigger it by manipulating the state
      // The easiest way is to trigger it via the game session context's global trigger or window hooks if available,
      // or we can click cells on the Tic-Tac-Toe grid to win!
      // Since X starts, let's click cell 0, 3, 1, 4, 2 to win in Tic-Tac-Toe!
      const clickCell = (id) => {
        const el = document.getElementById(id);
        if (el) el.click();
      };
      clickCell('ttt-cell-0'); // Player X
      setTimeout(() => clickCell('ttt-cell-3'), 100); // AI O
      setTimeout(() => clickCell('ttt-cell-1'), 200); // Player X
      setTimeout(() => clickCell('ttt-cell-4'), 300); // AI O
      setTimeout(() => clickCell('ttt-cell-2'), 400); // Player X wins!
    });
    // Wait for victory modal to pop up
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await capture('victory_modal.png', 375, 667, true);

    // Close modal to reset state
    const replayBtn = await page.$('#modal-replay-btn');
    if (replayBtn) {
      await replayBtn.click();
      console.log('Clicked Play Again button to close modal.');
    }

    // 11. Defeat Modal
    console.log('Triggering Defeat Modal...');
    // Let's reload and play to lose, or we can just trigger it directly by submitting result
    await page.goto('http://localhost:3000/dashboard/games/tic-tac-toe', { waitUntil: 'networkidle2' });
    // Click vs AI
    const tttBtnsLoss = await page.$$('button');
    for (const btn of tttBtnsLoss) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('vs AI')) {
        await btn.click();
        break;
      }
    }
    // Click cells to lose: X clicks 0, 1, 8. O (AI) wins on 3, 4, 5.
    await page.evaluate(() => {
      const clickCell = (id) => {
        const el = document.getElementById(id);
        if (el) el.click();
      };
      clickCell('ttt-cell-0'); // X clicks top-left
      // Let the AI play and we click non-blocking cells to allow AI to win
      // AI will try to win if it has 2 in a row. Let's block or not block.
      // Wait, let's just make O win. AI plays intelligently.
      // Alternatively, we can let it play normally, or we can click cells.
      // If we want a guaranteed defeat, we can just invoke submitGameResult directly using the context.
      // Wait, is there a way to call it from window? Let's check if we can click the reset/quit or trigger the state.
      // Let's just click cells sequentially to let the game play out.
    });
    // Let's wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // If we click cell 0, 1, 8, the AI will naturally block and win.
    await page.evaluate(() => {
      const clickCell = (id) => {
        const el = document.getElementById(id);
        if (el) el.click();
      };
      clickCell('ttt-cell-0');
      setTimeout(() => clickCell('ttt-cell-1'), 400);
      setTimeout(() => clickCell('ttt-cell-8'), 800);
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // In case the game is not over, we can click some more cells
    await page.evaluate(() => {
      const clickCell = (id) => {
        const el = document.getElementById(id);
        if (el) el.click();
      };
      clickCell('ttt-cell-6');
      setTimeout(() => clickCell('ttt-cell-7'), 400);
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await capture('defeat_modal.png', 375, 667, true);

  } catch (err) {
    console.error('Error during screenshot generation:', err);
  } finally {
    await browser.close();
    devServer.kill();
    console.log('Finished capturing all screenshots. Server stopped.');
    process.exit(0);
  }
}

run();
