import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import dns from 'dns';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\8ce036c5-a737-4147-8687-1c675a027ef6';
const PORT = 3012;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

console.log('Starting Next.js dev server on port ' + PORT + '...');
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

  // Listen for console and errors in browser
  page.on('console', msg => {
    console.log(`[BROWSER LOG]: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[BROWSER ERROR]: ${err.toString()}`);
  });

  // Helper to take a screenshot
  const capture = async (name, width, height, isMobile = false) => {
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });
    await sleep(2500); // Wait for layouts to settle
    const filePath = path.join(outputDir, name);
    await page.screenshot({ path: filePath });
    console.log(`Captured: ${name} (${width}x${height})`);
  };

  // Helper to handle post game ad overlay and XP modal
  const handlePostGameModals = async (action = 'replay') => {
    console.log('Waiting for post-game ad overlay to appear...');
    try {
      await page.waitForSelector('#ad-overlay-container', { timeout: 12000 });
      console.log('Ad overlay detected. Waiting for countdown...');
      await sleep(6500); // Ad timer is 5s, let's wait 6.5s to be safe
      
      console.log('Clicking Skip/Continue Ad button...');
      await page.click('#ad-skip-btn');
    } catch (e) {
      console.log('Ad overlay did not appear or skip failed:', e.message);
    }

    console.log('Waiting for XP modal to appear...');
    try {
      await page.waitForSelector('#post-game-modal-body', { timeout: 8000 });
      await sleep(2000); // wait for count-up animations to settle
      if (action === 'replay') {
        console.log('Clicking Play Again on XP Modal...');
        await page.click('#modal-replay-btn');
      } else if (action === 'dashboard') {
        console.log('Clicking Dashboard on XP Modal...');
        await page.click('#modal-dashboard-btn');
      }
      await sleep(2000);
    } catch (e) {
      console.log('XP Modal did not appear or click failed:', e.message);
    }
  };

  try {
    const uniqueId = Math.floor(Math.random() * 900000) + 100000;
    const username = `verify_arrow_${uniqueId}`;
    const email = `${username}@example.com`;
    const password = `Password${uniqueId}!`;

    console.log(`Registering verification user: ${username}`);
    await page.goto(`http://localhost:${PORT}/register`, { waitUntil: 'networkidle2' });
    await sleep(3000);

    // Register user
    await page.type('input[placeholder*="Username" i], input[type="text"]', username);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await sleep(7500); // Wait for dashboard redirection and storage config

    // Navigate to Arrow Puzzle
    console.log('Navigating to Arrow Puzzle...');
    await page.goto(`http://localhost:${PORT}/dashboard/games/arrow-puzzle`, { waitUntil: 'networkidle2' });
    await sleep(4000); // Hydration wait

    // Screenshot 2: Easy progression screen
    console.log('Capturing Screenshot 2: Easy progression screen...');
    await capture('2_easy_progression.png', 1200, 800, false);

    // Click easy level 1 button to start play
    console.log('Starting Easy Level 1...');
    await page.click('#easy-btn-1');
    await sleep(2500);

    // Screenshot 1: New path-based board design
    console.log('Capturing Screenshot 1: New path-based board design...');
    await capture('1_path_board.png', 1200, 800, false);

    // Solve Easy Level 1 programmatically
    console.log('Solving Easy Level 1 programmatically...');
    for (let i = 0; i < 40; i++) {
      const validBtns = await page.$$('.valid-arrow');
      if (validBtns.length === 0) {
        break;
      }
      await validBtns[0].click();
      await sleep(450); // Wait for animation
    }
    
    // Handle modals to proceed to Easy Level 2
    await handlePostGameModals('replay');
    await sleep(3000);

    // Solve Easy Level 2 programmatically
    console.log('Solving Easy Level 2 programmatically...');
    for (let i = 0; i < 40; i++) {
      const validBtns = await page.$$('.valid-arrow');
      if (validBtns.length === 0) {
        break;
      }
      await validBtns[0].click();
      await sleep(450); // Wait for animation
    }
    
    // Handle modals and return to dashboard
    await handlePostGameModals('dashboard');
    await sleep(4000);

    // Navigate back to Arrow Puzzle to see unlock updates
    console.log('Navigating back to Arrow Puzzle...');
    await page.goto(`http://localhost:${PORT}/dashboard/games/arrow-puzzle`, { waitUntil: 'networkidle2' });
    await sleep(5000); // Safe hydration wait!

    // Screenshot 3: Unlock progression screen (Medium, Hard, Expert, Super Hard unlocked)
    console.log('Capturing Screenshot 3: Unlock progression screen...');
    await capture('3_unlock_progression.png', 1200, 800, false);

    // Open Levels for Hard mode
    console.log('Opening Hard Mode levels...');
    await page.click('#levels-hard');
    await sleep(2000);

    // Click Hard Level 1
    console.log('Starting Hard Level 1...');
    await page.click('#btn-select-level-hard-1');
    await sleep(3000);

    // Screenshot 4: Hard mode example
    console.log('Capturing Screenshot 4: Hard mode example...');
    await capture('4_hard_mode.png', 1200, 800, false);

    // Exit to menu
    console.log('Exiting to Menu from Hard gameplay...');
    await page.click('#arrow-exit-gameplay-btn');
    await sleep(2000);

    // Open Levels for Expert mode
    console.log('Opening Expert Mode levels...');
    await page.click('#levels-expert');
    await sleep(2000);

    // Click Expert Level 1
    console.log('Starting Expert Level 1...');
    await page.click('#btn-select-level-expert-1');
    await sleep(3000);

    // Screenshot 5: Expert mode example
    console.log('Capturing Screenshot 5: Expert mode example...');
    await capture('5_expert_mode.png', 1200, 800, false);

    // Click Hint button
    console.log('Clicking Hint button...');
    await page.click('#hint-btn');
    await sleep(2000);

    // Screenshot 7: Hint system demonstration
    console.log('Capturing Screenshot 7: Hint system demonstration...');
    await capture('7_hint_system.png', 1200, 800, false);

    // Exit to menu
    console.log('Exiting to Menu from Expert gameplay...');
    await page.click('#arrow-exit-gameplay-btn');
    await sleep(2000);

    // Open Levels for Super Hard mode
    console.log('Opening Super Hard Mode levels...');
    await page.click('#levels-super-hard');
    await sleep(2000);

    // Click Super Hard Level 1
    console.log('Starting Super Hard Level 1...');
    await page.click('#btn-select-level-super-hard-1');
    await sleep(3000);

    // Screenshot 6: Super Hard mode example
    console.log('Capturing Screenshot 6: Super Hard mode example...');
    await capture('6_super_hard_mode.png', 1200, 800, false);

    // Screenshot 8: Mobile rendering
    console.log('Capturing Screenshot 8: Mobile rendering...');
    await capture('8_mobile_rendering.png', 390, 844, true);

    // Screenshot 9: Desktop rendering
    console.log('Capturing Screenshot 9: Desktop rendering...');
    await capture('9_desktop_rendering.png', 1200, 800, false);

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
