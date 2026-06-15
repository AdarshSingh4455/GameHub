import puppeteer from 'puppeteer';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Launching Puppeteer browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const [page] = await browser.pages();

  try {
    const uniqueId = Math.floor(Math.random() * 900000) + 100000;
    const username = `verify_user_${uniqueId}`;
    const email = `${username}@example.com`;
    const password = `Password${uniqueId}!`;

    console.log(`\n=== 1. REGISTER USER: ${username} ===`);
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    await sleep(2000);

    await page.type('input[placeholder*="Username" i]', username);
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    console.log('Waiting for registration redirect...');
    await sleep(6000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('Signing in...');
      await page.type('input[type="email"]', email);
      await page.type('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await sleep(5000);
    }

    console.log('Final URL after auth:', page.url());

    console.log('\n=== 2. FETCH INITIAL PROFILE DETAILS ===');
    const initialProfile = await page.evaluate(async () => {
      const res = await fetch('/api/profile/details');
      return await res.json();
    });
    console.log('Initial Level:', initialProfile.profile.level);
    console.log('Initial XP:', initialProfile.profile.xp);
    console.log('Initial Coins:', initialProfile.profile.coins);

    console.log('\n=== 3. SUBMIT 2048 GAME OVER RESULT ===');
    const result2048 = await page.evaluate(async () => {
      const res = await fetch('/api/games/game-over', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameSlug: '2048',
          result: 'win',
          metadata: { score: 2048, durationSecs: 90 }
        })
      });
      return { status: res.status, body: await res.json() };
    });
    console.log('2048 Submit Status:', result2048.status);
    console.log('2048 Submit Response:', JSON.stringify(result2048.body, null, 2));

    console.log('\n=== 4. SUBMIT MEMORY MATCH GAME OVER RESULT ===');
    const resultMemory = await page.evaluate(async () => {
      const res = await fetch('/api/games/game-over', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameSlug: 'memory',
          result: 'win',
          metadata: { score: 1200, difficulty: 'medium', durationSecs: 60 }
        })
      });
      return { status: res.status, body: await res.json() };
    });
    console.log('Memory Match Submit Status:', resultMemory.status);
    console.log('Memory Match Submit Response:', JSON.stringify(resultMemory.body, null, 2));

    console.log('\n=== 5. FETCH UPDATED PROFILE DETAILS ===');
    const updatedProfile = await page.evaluate(async () => {
      const res = await fetch('/api/profile/details');
      return await res.json();
    });
    console.log('Updated Level:', updatedProfile.profile.level);
    console.log('Updated XP:', updatedProfile.profile.xp);
    console.log('Updated Coins:', updatedProfile.profile.coins);

    console.log('\n=== 6. VERIFY LEADERBOARD FILTERS ===');
    const globalLeaderboard = await page.evaluate(async () => {
      const res = await fetch('/api/leaderboard?timeframe=all-time');
      return await res.json();
    });
    console.log('Global Leaderboard Rows (first 3):', JSON.stringify(globalLeaderboard.rows.slice(0, 3), null, 2));

    const gameLeaderboard = await page.evaluate(async () => {
      const res = await fetch('/api/leaderboard?game=2048');
      return await res.json();
    });
    console.log('2048 Game Leaderboard Rows (first 3):', JSON.stringify(gameLeaderboard.rows.slice(0, 3), null, 2));

    console.log('\n=== 7. UPDATE USERNAME AND TITLE ===');
    const newUsername = `updated_user_${uniqueId}`;
    const updateRes = await page.evaluate(async (newU) => {
      const res = await fetch('/api/profile/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newU,
          title: 'Pixel Master',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber'
        })
      });
      return { status: res.status, body: await res.json() };
    }, newUsername);
    console.log('Profile Details Update Status:', updateRes.status);
    console.log('Profile Details Update Response:', JSON.stringify(updateRes.body, null, 2));

    console.log('\n=== 8. CHECK USERNAME AVAILABILITY ENDPOINT ===');
    const checkRes = await page.evaluate(async (newU) => {
      const res = await fetch(`/api/profile/check-username?username=${newU}`);
      return await res.json();
    }, newUsername);
    console.log(`Is username '${newUsername}' available for self?`, checkRes.available);

    const checkTakenRes = await page.evaluate(async () => {
      const res = await fetch(`/api/profile/check-username?username=gamer_pro`);
      return await res.json();
    });
    console.log(`Is username 'gamer_pro' available (taken)?`, checkTakenRes.available);

  } catch (err) {
    console.error('Error during validation execution:', err);
  } finally {
    console.log('Shutting down browser...');
    await browser.close();
    process.exit(0);
  }
}

run();
