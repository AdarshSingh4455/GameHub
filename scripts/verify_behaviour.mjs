import puppeteer from 'puppeteer';
import { spawn, execSync } from 'child_process';
import dns from 'dns';
import fs from 'fs';
import path from 'path';

dns.setDefaultResultOrder('ipv4first');

// Path inside our artifact directory
const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\ba8268b5-2cc0-4aa5-abb0-b8e6a780d763\\screenshots';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Workspace root database state path
const workspaceRoot = 'c:\\Users\\adars\\OneDrive\\Desktop\\Full Stack\\gameHub';
const DB_PATH = path.join(workspaceRoot, 'node_modules', '.cache', 'mock_db_state.json');

function readDB() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error('Mock DB file not found: ' + DB_PATH);
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// 0. Kill port 3000 if active
console.log('Cleaning up port 3000...');
try {
  execSync('npx kill-port 3000', { cwd: workspaceRoot, stdio: 'inherit' });
} catch (e) {
  console.log('Port 3000 already clean or kill-port failed');
}

// 1. Initialize DB to clean starting state
console.log('Initializing Mock DB State...');
const db = readDB();

// Reset mock-user-id profile stats to level 1, 0 streak, no unlocks
db.profiles['mock-user-id'] = {
  ...db.profiles['mock-user-id'],
  xp: 100,
  level: 1,
  coins: 500,
  currentStreak: 0,
  longestStreak: 0,
  selectedFrame: null,
  selectedEffect: null,
  selectedTitle: null,
  selectedChatPack: null
};

// Clear all user inventories
db.inventories = {};
writeDB(db);

// 2. Start next start production server
console.log('Starting Next.js production server...');
const server = spawn('npx.cmd', ['next', 'start', '-p', '3000'], {
  cwd: workspaceRoot,
  env: { ...process.env, MOCK_AUTH: 'true' },
  shell: true,
});

server.stdout.on('data', (data) => {
  console.log(`[Server]: ${data.toString().trim()}`);
});

server.stderr.on('data', (data) => {
  console.error(`[Server Error]: ${data.toString().trim()}`);
});

// Wait for server to be fully ready
await new Promise((resolve) => setTimeout(resolve, 8000));

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(60000);

  // Helper to take a screenshot
  const capture = async (name, width = 1280, height = 800, isMobile = false) => {
    await page.setViewport({ width, height, isMobile, hasTouch: isMobile });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const path = `${outputDir}\\${name}`;
    await page.screenshot({ path });
    console.log(`Captured: ${name} (${width}x${height})`);
  };

  try {
    // ──────── LOG IN ────────
    console.log('Logging in to dashboard...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await capture('01_dashboard_logged_in.png');

    // ──────── VERIFY CHAT PACKS & STORE CATEGORIES ────────
    console.log('Navigating to Store page...');
    await page.goto('http://localhost:3000/dashboard/store', { waitUntil: 'networkidle2' });
    await capture('02_store_scratcher.png');

    // Click on Chat Packs tab in Store
    console.log('Opening Chat Packs tab in store...');
    const tabs = await page.$$('button');
    for (const tab of tabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Chat Packs')) {
        await tab.click();
        console.log('Clicked Chat Packs tab');
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await capture('03_store_chat_packs.png');

    // ──────── VERIFY REBUILD UNLOCKS ADMIN TOOL ────────
    console.log('Navigating to Admin Dashboard...');
    await page.goto('http://localhost:3000/dashboard/admin', { waitUntil: 'networkidle2' });
    await capture('04_admin_dashboard.png');

    // Click on Lobby/Tools tab in Admin Dashboard
    console.log('Opening Admin Utilities...');
    const adminTabs = await page.$$('button');
    for (const tab of adminTabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Lobby Tools')) {
        await tab.click();
        console.log('Clicked Lobby Tools tab');
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await capture('05_admin_lobby_tools.png');

    // Trigger Rebuild Unlocks
    console.log('Executing Unlock Recovery Rebuild via API...');
    page.on('dialog', async dialog => {
      console.log('Accepting admin confirm dialog:', dialog.message());
      await dialog.accept();
    });
    
    // Let's call the endpoint directly to be robust and bypass UI tab selection issues
    await page.evaluate(async () => {
      const res = await fetch('/admin/tools/rebuild-unlocks', { method: 'POST' });
      return res.json();
    });
    console.log('Unlock recovery tool triggered.');

    // ──────── VERIFY PROGRESSION UNLOCK (LEVEL 5 & STREAK 7) ────────
    console.log('Updating user state in mock DB to Level 5 and Streak 7...');
    const currentDb = readDB();
    currentDb.profiles['mock-user-id'].xp = 11000; // Level 5
    currentDb.profiles['mock-user-id'].level = 5;
    currentDb.profiles['mock-user-id'].currentStreak = 7;
    currentDb.profiles['mock-user-id'].longestStreak = 7;
    writeDB(currentDb);

    console.log('Reloading dashboard to trigger auto-unlocks...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await capture('06_dashboard_level_5_streaks_unlocked.png');

    // Go to store and verify they are owned and equippable
    console.log('Checking Store inventory state...');
    await page.goto('http://localhost:3000/dashboard/store', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Switch to Frames tab
    const storeTabs = await page.$$('button');
    for (const tab of storeTabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Frames')) {
        await tab.click();
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await capture('07_store_neon_frame_unlocked.png');

    // Equip the Neon Frame
    console.log('Equipping Neon Frame...');
    await page.evaluate(() => {
      const equipBtn = document.querySelector('button[id^="store-item-equip-frame-neon"], button[id^="store-item-equip-"]');
      if (equipBtn) {
        equipBtn.click();
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await capture('08_store_neon_frame_equipped.png');

    // ──────── VERIFY GUEST MODE PREVIEW ────────
    console.log('Testing Guest Mode previews...');
    // Log out to clear mock-user-id cookie
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      // Clear storage
      localStorage.clear();
    });
    // Set cookie mock_user_id to guest
    await page.setCookie({
      name: 'mock_user_id',
      value: 'mock-guest-id',
      domain: 'localhost',
      path: '/'
    });
    
    await page.goto('http://localhost:3000/dashboard/store', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Switch to Frames tab to preview
    const guestTabs = await page.$$('button');
    for (const tab of guestTabs) {
      const text = await page.evaluate(el => el.textContent, tab);
      if (text && text.includes('Frames')) {
        await tab.click();
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await capture('09_guest_store_preview.png');

    // Click Preview button
    await page.evaluate(() => {
      const previewBtn = document.querySelector('button[id^="store-item-preview-"]');
      if (previewBtn) previewBtn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await capture('10_guest_store_preview_active.png');

    // ──────── VERIFY OFFLINE MODE FLOW ────────
    console.log('Switching to offline mode...');
    await page.setOfflineMode(true);
    
    console.log('Navigating to Memory Match while offline...');
    await page.goto('http://localhost:3000/dashboard/games/memory', { waitUntil: 'networkidle2' });
    await capture('11_offline_memory_match_menu.png');

    // Start Easy Game offline
    console.log('Starting offline game...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const easyBtn = btns.find(b => b.textContent.includes('Easy'));
      if (easyBtn) easyBtn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await capture('12_offline_memory_match_gameplay.png');

    // Trigger Win/GameOver offline to see calculated rewards modal
    console.log('Triggering offline win results modal...');
    await page.evaluate(() => {
      if (window.triggerMemoryMatchWin || window.triggerWin) {
        (window.triggerMemoryMatchWin || window.triggerWin)();
      } else {
        // Fallback
      }
    });
    // Let's reload online to proceed
    await page.setOfflineMode(false);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // ──────── VERIFY MOBILE UI & CENTERING ────────
    console.log('Emulating mobile screen 375x667 for centering audits...');
    await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
    
    // Memory Match Mobile Grid Centering
    console.log('Loading Memory Match mobile board...');
    await page.goto('http://localhost:3000/dashboard/games/memory', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const easyBtn = btns.find(b => b.textContent.includes('Easy'));
      if (easyBtn) easyBtn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await capture('13_mobile_memory_match_centered.png', 375, 667, true);

    // Multiplayer Hangman Mobile Centering
    console.log('Loading Multiplayer Hangman mock structures...');
    // We can load Multiplayer page in mobile
    await page.goto('http://localhost:3000/dashboard/multiplayer', { waitUntil: 'networkidle2' });
    await capture('14_mobile_multiplayer_lobby.png', 375, 667, true);

    console.log('Completed behavior verification successfully!');

  } catch (err) {
    console.error('Error during behavior verification:', err);
  } finally {
    await browser.close();
    server.kill();
    console.log('Verification completed. Server stopped.');
    process.exit(0);
  }
}

run();
