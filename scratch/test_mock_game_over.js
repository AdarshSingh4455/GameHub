/**
 * Authenticated game-over test using MOCK_AUTH=true
 * Tests the full progression pipeline: XP, coins, achievements, level-up
 */
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

const BASE = 'http://localhost:3000';

async function testGameOver(gameSlug, result, metadata, label) {
  const r = await globalThis.fetch(`${BASE}/api/games/game-over`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameSlug, result, metadata })
  });
  const body = await r.json();
  if (r.status === 200) {
    console.log(`✅ ${label}`);
    console.log(`   xpGained=${body.xpGained} coinsGained=${body.coinsGained} newXP=${body.newXP} levelUp=${body.leveledUp}`);
    if (body.unlockedAchievements?.length) {
      console.log(`   🏆 Achievements: ${body.unlockedAchievements.map(a => a.name).join(', ')}`);
    }
    if (body.nextAchievement) {
      console.log(`   📊 Next: ${body.nextAchievement.name} (${body.nextAchievement.progress}%)`);
    }
  } else {
    console.log(`❌ ${label} → HTTP ${r.status}: ${JSON.stringify(body)}`);
  }
  return { status: r.status, body };
}

async function run() {
  console.log('=== MOCK_AUTH Game-Over Tests ===');
  console.log('Note: Server must be running with MOCK_AUTH=true\n');

  const results = {};

  // 2048 win
  results.game2048Win = await testGameOver('2048', 'win', { score: 2048, durationSecs: 90 }, '2048 WIN');

  // 2048 loss
  results.game2048Loss = await testGameOver('2048', 'loss', { score: 512, durationSecs: 45 }, '2048 LOSS');

  // Memory win
  results.memoryWin = await testGameOver('memory', 'win', { score: 1200, durationSecs: 60 }, 'Memory WIN');

  // Tic-tac-toe win
  results.tttWin = await testGameOver('tic-tac-toe', 'win', { score: 100, durationSecs: 30 }, 'Tic-Tac-Toe WIN');

  // Tic-tac-toe draw
  results.tttDraw = await testGameOver('tic-tac-toe', 'draw', { score: 0, durationSecs: 25 }, 'Tic-Tac-Toe DRAW');

  console.log('\n=== SUMMARY ===');
  for (const [key, val] of Object.entries(results)) {
    console.log(`${val.status === 200 ? '✅' : '❌'} ${key}: HTTP ${val.status}`);
  }
}

run().catch(console.error);
