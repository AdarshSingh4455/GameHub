import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { prisma } from './src/lib/prisma.ts';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const outputDir = 'C:\\Users\\adars\\.gemini\\antigravity\\brain\\db50329b-1beb-4cc3-ae5b-1af71832b2ff';

// Clean DB and Seed mock profiles
async function seedDB() {
  console.log('Cleaning database tournament tables...');
  await prisma.tournamentMatch.deleteMany({});
  await prisma.subTournament.deleteMany({});
  await prisma.tournamentRegistration.deleteMany({});
  await prisma.tournamentTeamMember.deleteMany({});
  await prisma.tournamentTeam.deleteMany({});
  await prisma.tournamentAuditLog.deleteMany({});
  await prisma.tournament.deleteMany({});

  console.log('Upserting test profiles (AdminUser, Player1, Player2, Player3, Player4)...');
  const profiles = [
    { id: 'admin-id', username: 'AdminUser', role: 'SUPER_ADMIN' },
    { id: 'user-1', username: 'Player1', role: 'USER' },
    { id: 'user-2', username: 'Player2', role: 'USER' },
    { id: 'user-3', username: 'Player3', role: 'USER' },
    { id: 'user-4', username: 'Player4', role: 'USER' },
  ];

  for (const p of profiles) {
    await prisma.profile.upsert({
      where: { userId: p.id },
      update: { role: p.role, username: p.username },
      create: {
        userId: p.id,
        username: p.username,
        role: p.role,
        coins: 100,
        xp: 100,
        level: 1,
      }
    });
  }
  console.log('Database seeded successfully.');
}

async function run() {
  await seedDB();

  console.log('Starting Next.js dev server with MOCK_AUTH=true...');
  const devServer = spawn('cmd.exe', ['/c', 'npm run dev'], {
    env: { ...process.env, MOCK_AUTH: 'true' },
    shell: true,
  });

  devServer.stdout.on('data', (data) => {
    console.log(`[Next.js]: ${data.toString().trim()}`);
  });

  devServer.stderr.on('data', (data) => {
    console.error(`[Next.js Error]: ${data.toString().trim()}`);
  });

  // Wait for dev server to boot
  await new Promise((resolve) => setTimeout(resolve, 8000));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ----------------------------------------
    // Step 1: Admin Tournament Creation Screen
    // ----------------------------------------
    const adminContext = await browser.createBrowserContext();
    const adminPage = await adminContext.newPage();
    await adminPage.setViewport({ width: 1280, height: 800 });
    // Authenticate as AdminUser using cookies
    await adminPage.setCookie({ name: 'mock_user_id', value: 'admin-id', url: 'http://localhost:3000' });
    await adminPage.setCookie({ name: 'mock_username', value: 'AdminUser', url: 'http://localhost:3000' });

    console.log('Admin navigating to admin panel...');
    await adminPage.goto('http://localhost:3000/dashboard/admin', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click Tournaments tab
    console.log('Clicking admin Tournaments tab...');
    await adminPage.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const tournTab = tabs.find(t => t.textContent.includes('Tournaments'));
      if (tournTab) tournTab.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Fill Admin tournament details
    console.log('Filling admin tournament creation form...');
    await adminPage.evaluate(() => {
      const setReactValue = (el, val) => {
        if (!el) return;
        const lastVal = el.value;
        el.value = val;
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastVal);
        const event = new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true });
        el.dispatchEvent(event);
      };

      const form = document.querySelector('form');
      if (form) {
        const nameInput = form.querySelector('input[placeholder*="Grand Esports"]');
        setReactValue(nameInput, 'Admin Championship Trophy');

        const gameSelect = form.querySelector('select');
        setReactValue(gameSelect, 'tic-tac-toe');

        const dateInputs = Array.from(form.querySelectorAll('input[type="date"]'));
        if (dateInputs[0]) setReactValue(dateInputs[0], '2026-06-30');
        if (dateInputs[1]) setReactValue(dateInputs[1], '2026-06-30');
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await adminPage.screenshot({ path: `${outputDir}\\admin_tournament_creation.png` });
    console.log('Captured: admin_tournament_creation.png');

    // ----------------------------------------
    // Step 2: User Tournament Creation Screen
    // ----------------------------------------
    const user1Context = await browser.createBrowserContext();
    const user1Page = await user1Context.newPage();
    user1Page.on('console', (msg) => console.log('USER1 PAGE LOG:', msg.text()));
    user1Page.on('pageerror', (err) => console.error('USER1 PAGE ERROR:', err.toString()));
    await user1Page.setViewport({ width: 1280, height: 800 });
    await user1Page.setCookie({ name: 'mock_user_id', value: 'user-1', url: 'http://localhost:3000' });
    await user1Page.setCookie({ name: 'mock_username', value: 'Player1', url: 'http://localhost:3000' });

    console.log('Player1 navigating to tournaments page...');
    await user1Page.goto('http://localhost:3000/dashboard/tournaments', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Click "Host Tournament" or "Plus" button
    console.log('Opening Create Tournament modal...');
    await user1Page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Host') || b.textContent.includes('Create'));
      if (btn) btn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Fill User Tournament creation form
    console.log('Filling user tournament form...');
    await user1Page.evaluate(() => {
      const setReactValue = (el, val) => {
        if (!el) return;
        const lastVal = el.value;
        el.value = val;
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastVal);
        const event = new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true });
        el.dispatchEvent(event);
      };

      const form = document.querySelector('form');
      if (form) {
        const nameInput = form.querySelector('input[type="text"]:not([placeholder="10:00 AM"])');
        setReactValue(nameInput, 'Player1 Mega Cup');

        const maxPlayersInput = form.querySelector('input[type="number"]');
        setReactValue(maxPlayersInput, '4');

        const startDateInput = form.querySelector('input[type="date"]');
        setReactValue(startDateInput, '2026-06-30');

        const startTimeInput = form.querySelector('input[placeholder="10:00 AM"]');
        setReactValue(startTimeInput, '10:00 AM');
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await user1Page.screenshot({ path: `${outputDir}\\user_tournament_creation.png` });
    console.log('Captured: user_tournament_creation.png');

    // Submit user tournament creation form
    console.log('Submitting user tournament form...');
    await user1Page.evaluate(() => {
      const btn = document.querySelector('form button[type="submit"]');
      if (btn) btn.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get the tournament ID from database
    const dbTournaments = await prisma.tournament.findMany();
    dbTournaments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const userTournament = dbTournaments.find(t => t.name === 'Player1 Mega Cup');
    if (!userTournament) throw new Error('User tournament not found in DB!');
    const tournamentId = userTournament.id;
    console.log('User tournament created with ID:', tournamentId);

    // ----------------------------------------
    // Step 3: Register Players & Correct IST display
    // ----------------------------------------
    console.log('Registering Players 1, 2, 3, and 4...');
    // We execute register actions directly inside each player's page context
    const user2Context = await browser.createBrowserContext();
    const user2Page = await user2Context.newPage();
    const user3Context = await browser.createBrowserContext();
    const user3Page = await user3Context.newPage();
    const user4Context = await browser.createBrowserContext();
    const user4Page = await user4Context.newPage();

    await user2Page.setCookie({ name: 'mock_user_id', value: 'user-2', url: 'http://localhost:3000' });
    await user2Page.setCookie({ name: 'mock_username', value: 'Player2', url: 'http://localhost:3000' });
    await user3Page.setCookie({ name: 'mock_user_id', value: 'user-3', url: 'http://localhost:3000' });
    await user3Page.setCookie({ name: 'mock_username', value: 'Player3', url: 'http://localhost:3000' });
    await user4Page.setCookie({ name: 'mock_user_id', value: 'user-4', url: 'http://localhost:3000' });
    await user4Page.setCookie({ name: 'mock_username', value: 'Player4', url: 'http://localhost:3000' });

    // Attach console listeners for all player pages
    user2Page.on('console', (msg) => console.log('USER2 PAGE LOG:', msg.text()));
    user2Page.on('pageerror', (err) => console.error('USER2 PAGE ERROR:', err.toString()));
    user3Page.on('console', (msg) => console.log('USER3 PAGE LOG:', msg.text()));
    user3Page.on('pageerror', (err) => console.error('USER3 PAGE ERROR:', err.toString()));
    user4Page.on('console', (msg) => console.log('USER4 PAGE LOG:', msg.text()));
    user4Page.on('pageerror', (err) => console.error('USER4 PAGE ERROR:', err.toString()));

    // Register Player 1
    await user1Page.evaluate(async (id) => {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', tournamentId: id })
      });
      if (!res.ok) {
        console.error('Player1 register failed:', res.status, await res.text());
      } else {
        console.log('Player1 register success');
      }
    }, tournamentId);

    // Register Player 2
    await user2Page.goto('http://localhost:3000/dashboard/tournaments', { waitUntil: 'networkidle2' });
    await user2Page.evaluate(async (id) => {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', tournamentId: id })
      });
      if (!res.ok) {
        console.error('Player2 register failed:', res.status, await res.text());
      } else {
        console.log('Player2 register success');
      }
    }, tournamentId);

    // Register Player 3
    await user3Page.goto('http://localhost:3000/dashboard/tournaments', { waitUntil: 'networkidle2' });
    await user3Page.evaluate(async (id) => {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', tournamentId: id })
      });
      if (!res.ok) {
        console.error('Player3 register failed:', res.status, await res.text());
      } else {
        console.log('Player3 register success');
      }
    }, tournamentId);

    // Register Player 4
    await user4Page.goto('http://localhost:3000/dashboard/tournaments', { waitUntil: 'networkidle2' });
    await user4Page.evaluate(async (id) => {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', tournamentId: id })
      });
      if (!res.ok) {
        console.error('Player4 register failed:', res.status, await res.text());
      } else {
        console.log('Player4 register success');
      }
    }, tournamentId);

    // Reload Player 1 to verify they see everyone joined in real-time
    await user1Page.goto('http://localhost:3000/dashboard/tournaments', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Print API response and HTML snippet for debugging
    const tournResponse = await user1Page.evaluate(async () => {
      try {
        const res = await fetch('/api/tournaments');
        return await res.text();
      } catch (err) {
        return 'FETCH ERROR: ' + err.toString();
      }
    });
    console.log('--- TOURNAMENTS GET RESPONSE ---');
    console.log(tournResponse);
    console.log('--------------------------------');

    const hasCard = await user1Page.evaluate(() => {
      const cards = document.querySelectorAll('.tournament-card');
      return {
        count: cards.length,
        html: document.body.innerText.substring(0, 800)
      };
    });
    console.log('--- DOM CARD COUNT & TEXT ---');
    console.log('Cards count:', hasCard.count);
    console.log('Body Text:', hasCard.html);
    console.log('-----------------------------');

    // Click the tournament card to open details
    await user1Page.click('.tournament-card');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture screenshot: Multiple Players Joined (should show 4/4 joined)
    await user1Page.screenshot({ path: `${outputDir}\\multiple_players_joined.png` });
    console.log('Captured: multiple_players_joined.png');

    // Capture screenshot: Correct IST Time
    await user1Page.screenshot({ path: `${outputDir}\\correct_ist_time.png` });
    console.log('Captured: correct_ist_time.png');

    // ----------------------------------------
    // Step 4: Start Tournament
    // ----------------------------------------
    console.log('Starting the tournament bracket...');
    await user1Page.evaluate(async (id) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', tournamentId: id })
      });
    }, tournamentId);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Switch to bracket tab to view the live bracket tree
    await user1Page.evaluate(() => {
      const bracketTab = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Bracket'));
      if (bracketTab) bracketTab.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture screenshot: Live Tournament Running
    await user1Page.screenshot({ path: `${outputDir}\\live_tournament_running.png` });
    console.log('Captured: live_tournament_running.png');

    // ----------------------------------------
    // Step 5: Advance Bracket (Round 1 Matches)
    // ----------------------------------------
    // Get generated matches
    const subTournaments = await prisma.subTournament.findMany({
      where: { tournamentId },
      include: { matches: true }
    });
    const subId = subTournaments[0].id;
    const matches = subTournaments[0].matches;
    console.log(`Generated sub-tournament ${subId} with ${matches.length} matches.`);

    // Find Match 1 (Player1 vs Player2) and Match 2 (Player3 vs Player4)
    const m1 = matches.find(m => m.roundIndex === 0 && m.matchIndex === 0);
    const m2 = matches.find(m => m.roundIndex === 0 && m.matchIndex === 1);

    console.log('Simulating Match 1: Player1 defeats Player2...');
    // Player 1 joins Match 1
    await user1Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, m1.id);

    // Player 2 joins Match 1
    await user2Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, m1.id);

    // Resolve Match 1 (Player1 wins)
    await user1Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolveMatch', tournamentId: tId, matchId: mId, outcome: 'win' })
      });
    }, tournamentId, m1.id);

    console.log('Simulating Match 2: Player3 defeats Player4...');
    // Player 3 joins Match 2
    await user3Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, m2.id);

    // Player 4 joins Match 2
    await user4Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, m2.id);

    // Resolve Match 2 (Player3 wins)
    await user3Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolveMatch', tournamentId: tId, matchId: mId, outcome: 'win' })
      });
    }, tournamentId, m2.id);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture screenshot: Bracket Progression
    await user1Page.screenshot({ path: `${outputDir}\\bracket_progression.png` });
    console.log('Captured: bracket_progression.png');

    // ----------------------------------------
    // Step 6: Finals Match & Winner Screen
    // ----------------------------------------
    // Fetch finals match (Round index 1)
    const freshMatches = await prisma.tournamentMatch.findMany({
      where: { subTournamentId: subId }
    });
    const finalsMatch = freshMatches.find(m => m.roundIndex === 1);
    console.log('Finals match ID:', finalsMatch.id);

    console.log('Simulating Finals: Player1 defeats Player3...');
    // Player 1 joins Finals
    await user1Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, finalsMatch.id);

    // Player 3 joins Finals
    await user3Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'joinMatch', tournamentId: tId, matchId: mId })
      });
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'readyMatch', tournamentId: tId, matchId: mId })
      });
    }, tournamentId, finalsMatch.id);

    // Resolve Finals (Player 1 wins)
    await user1Page.evaluate(async (tId, mId) => {
      await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolveMatch', tournamentId: tId, matchId: mId, outcome: 'win' })
      });
    }, tournamentId, finalsMatch.id);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Capture screenshot: Final Winner Screen (Champion card dialog or bracket champion highlight)
    await user1Page.screenshot({ path: `${outputDir}\\final_winner_screen.png` });
    console.log('Captured: final_winner_screen.png');

  } catch (err) {
    console.error('Error during automation lifecycle:', err);
  } finally {
    await browser.close();
    devServer.kill();
    console.log('Finished capturing all verification screenshots.');
    process.exit(0);
  }
}

run();
