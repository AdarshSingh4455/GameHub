const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

const achievements = [
  { slug: 'first-game',        name: 'First Move',          description: 'Play your first game.',                   xpReward: 50,   coinReward: 10,  category: 'special' },
  { slug: 'first-win',         name: 'Winner Winner',       description: 'Win your first match.',                   xpReward: 100,  coinReward: 25,  category: 'wins' },
  { slug: 'streak-3',          name: 'Hot Streak',          description: 'Claim daily rewards 3 days in a row.',    xpReward: 75,   coinReward: 15,  category: 'streaks' },
  { slug: 'streak-7',          name: 'On Fire',             description: 'Claim daily rewards 7 days in a row.',    xpReward: 200,  coinReward: 50,  category: 'streaks' },
  { slug: 'streak-30',         name: 'Dedicated',           description: 'Claim daily rewards 30 days in a row.',   xpReward: 500,  coinReward: 150, category: 'streaks' },
  { slug: 'level-5',           name: 'Rising Star',         description: 'Reach Level 5.',                          xpReward: 150,  coinReward: 30,  category: 'special' },
  { slug: 'level-10',          name: 'Veteran',             description: 'Reach Level 10.',                         xpReward: 300,  coinReward: 75,  category: 'special' },
  { slug: 'level-25',          name: 'Champion',            description: 'Reach Level 25.',                         xpReward: 750,  coinReward: 200, category: 'special' },
  { slug: 'social-butterfly',  name: 'Social Butterfly',    description: 'Add 5 friends.',                          xpReward: 100,  coinReward: 20,  category: 'social' },
  { slug: 'cricket-hat-trick', name: 'Hat Trick',           description: 'Win 3 Cricket matches in a row.',         xpReward: 200,  coinReward: 50,  category: 'streaks', gameSlug: 'cricket' },
  { slug: 'ttt-undefeated',    name: 'Undefeated',          description: 'Win 10 Tic-Tac-Toe games in a row.',     xpReward: 300,  coinReward: 75,  category: 'streaks', gameSlug: 'tic-tac-toe' },
  { slug: 'games-5',           name: 'Novice Player',       description: 'Play 5 games of any type.',               xpReward: 100,  coinReward: 20,  category: 'gameplay' },
  { slug: 'games-25',          name: 'Dedicated Gamer',     description: 'Play 25 games of any type.',              xpReward: 250,  coinReward: 50,  category: 'gameplay' },
  { slug: 'games-100',         name: 'Game Marathoner',     description: 'Play 100 games of any type.',             xpReward: 600,  coinReward: 150, category: 'gameplay' },
  { slug: 'wins-5',            name: 'Frequent Winner',     description: 'Win 5 matches.',                          xpReward: 150,  coinReward: 30,  category: 'wins' },
  { slug: 'wins-20',           name: 'Match Master',        description: 'Win 20 matches.',                         xpReward: 300,  coinReward: 75,  category: 'wins' },
  { slug: 'wins-50',           name: 'Legendary Champion',  description: 'Win 50 matches.',                         xpReward: 800,  coinReward: 200, category: 'wins' },
  { slug: 'win-streak-3',      name: 'Unstoppable',         description: 'Win 3 matches in a row.',                 xpReward: 200,  coinReward: 50,  category: 'streaks' },
  { slug: 'win-streak-5',      name: 'On a Rampage',        description: 'Win 5 matches in a row.',                 xpReward: 400,  coinReward: 100, category: 'streaks' },
  { slug: 'cricket-century',   name: 'Century Maker',       description: 'Score 100+ total runs in Cricket.',        xpReward: 250,  coinReward: 50,  category: 'special', gameSlug: 'cricket' },
  { slug: 'ttt-perfect',       name: 'Master Strategist',   description: 'Win a game of Tic-Tac-Toe in 5 or fewer moves.', xpReward: 150, coinReward: 30, category: 'special', gameSlug: 'tic-tac-toe' },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  console.log('Connecting to:', sessionConnectionString.replace(/:[^:@]+@/, ':****@'));

  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new pg.Pool(config);
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Starting achievements upsert...');
    for (let i = 0; i < achievements.length; i++) {
      const a = achievements[i];
      console.log(`[${i+1}/${achievements.length}] Upserting: ${a.slug}`);
      await prisma.achievement.upsert({
        where: { slug: a.slug },
        update: {},
        create: a,
      });
      console.log(`  Done: ${a.slug}`);
    }
    console.log('All achievements upserted successfully!');
  } catch (err) {
    console.error('Error during achievements upsert:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
    console.log('Disconnected.');
  }
}

main();
