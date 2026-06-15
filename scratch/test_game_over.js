const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in env');
  process.exit(1);
}

const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
const config = parse(sessionConnectionString);

if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
  config.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(config);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mock implementation of getGameXP and computeLevel
function getGameXP(gameSlug, result) {
  const isMini = ['2048', 'fighter', 'memory'].includes(gameSlug);
  if (result === 'win') return isMini ? 50 : 100;
  if (result === 'loss') return isMini ? 10 : 25;
  return isMini ? 25 : 50;
}

function computeLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

async function checkAndUnlockAchievements(profileId, gameSlug, result, tx) {
  return []; // Mocked for initial check
}

async function test() {
  console.log('Finding profile for adarsh004455...');
  const profile = await prisma.profile.findFirst({
    where: { username: { startsWith: 'adarsh' } }
  });

  if (!profile) {
    console.error('Profile starting with adarsh not found');
    return;
  }

  console.log(`Testing with profile: id="${profile.id}", username="${profile.username}"`);

  const gameSlug = '2048';
  const result = 'win';
  const metadata = { score: 1024, timeSpent: 120 };

  try {
    await prisma.$transaction(async (tx) => {
      // Find game
      console.log('1. Finding game...');
      const game = await tx.game.findUnique({
        where: { slug: gameSlug },
      });
      if (!game) {
        throw new Error(`Game not found: ${gameSlug}`);
      }
      console.log(`Found game: id="${game.id}", name="${game.name}"`);

      // Record match history
      console.log('2. Recording match history...');
      await tx.matchRecord.create({
        data: {
          gameId: game.id,
          player1Id: profile.id,
          player1Score: metadata?.score ?? 0,
          player2Score: metadata?.opponentScore ?? 0,
          winnerId: result === 'win' ? profile.id : null,
          durationSecs: metadata?.durationSecs ?? null,
        },
      });

      // Record score if applicable
      console.log('3. Recording score...');
      if (metadata?.score !== undefined) {
        await tx.score.create({
          data: {
            profileId: profile.id,
            gameId: game.id,
            score: metadata.score,
            metadata: metadata?.gameMetadata ?? null,
          },
        });
      }

      // Update incremental game stats for favorites/high scores
      console.log('4. Checking profile game stats...');
      const stats = await tx.profileGameStats.findUnique({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
      });
      const newHighScore = Math.max(stats?.highScore ?? 0, metadata?.score ?? 0);

      console.log('5. Upserting profile game stats...');
      await tx.profileGameStats.upsert({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
        create: {
          profileId: profile.id,
          gameSlug,
          playCount: 1,
          winCount: result === 'win' ? 1 : 0,
          highScore: metadata?.score ?? 0,
        },
        update: {
          playCount: { increment: 1 },
          winCount: { increment: result === 'win' ? 1 : 0 },
          highScore: newHighScore,
          lastPlayed: new Date(),
        },
      });

      // Fetch resolved game XP rewards from central config
      const baseXP = getGameXP(gameSlug, result);
      const baseCoins = result === 'win' ? 20 : 5;

      console.log('6. Updating profile rewards...');
      // Increment profile base rewards
      const updatedProfile = await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: baseXP },
          coins: { increment: baseCoins },
        },
      });

      console.log('7. Recording XP event...');
      // Record XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: result === 'win' ? 'MATCH_WIN' : 'MATCH_LOSS',
          amount: baseXP,
          meta: { gameSlug },
        },
      });

      console.log('8. Checking achievements...');
      // Check for achievements
      const newlyUnlocked = await checkAndUnlockAchievements(profile.id, gameSlug, result, tx);

      console.log('Transaction succeeded!');
    });
  } catch (err) {
    console.error('Transaction failed with error:', err);
  }
}

test()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
