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

const ACHIEVEMENT_RULES = [
  {
    slug: 'first-game',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
      })
      return count >= 1
    },
  },
  {
    slug: 'first-win',
    check: async ({ profileId, result, tx }) => {
      if (result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 1
    },
  },
  {
    slug: 'cricket-hat-trick',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'cricket' || result !== 'win') return false
      const matches = await tx.matchRecord.findMany({
        where: {
          game: { slug: 'cricket' },
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
        orderBy: { playedAt: 'desc' },
        take: 3,
      })
      return matches.length === 3 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'ttt-undefeated',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'tic-tac-toe' || result !== 'win') return false
      const matches = await tx.matchRecord.findMany({
        where: {
          game: { slug: 'tic-tac-toe' },
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
        orderBy: { playedAt: 'desc' },
        take: 10,
      })
      return matches.length === 10 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'level-5',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 5
    },
  },
  {
    slug: 'level-10',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 10
    },
  },
  {
    slug: 'level-25',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 25
    },
  },
  {
    slug: 'games-5',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 5
    },
  },
  {
    slug: 'games-25',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 25
    },
  },
  {
    slug: 'games-100',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 100
    },
  },
  {
    slug: 'wins-5',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 5
    },
  },
  {
    slug: 'wins-20',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 20
    },
  },
  {
    slug: 'wins-50',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 50
    },
  },
  {
    slug: 'win-streak-3',
    check: async ({ profileId, tx }) => {
      const matches = await tx.matchRecord.findMany({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
        orderBy: { playedAt: 'desc' },
        take: 3,
      })
      return matches.length === 3 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'win-streak-5',
    check: async ({ profileId, tx }) => {
      const matches = await tx.matchRecord.findMany({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
        orderBy: { playedAt: 'desc' },
        take: 5,
      })
      return matches.length === 5 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'cricket-century',
    check: async ({ profileId, tx }) => {
      const agg = await tx.score.aggregate({
        where: {
          profileId,
          game: { slug: 'cricket' },
        },
        _sum: { score: true },
      })
      return (agg._sum.score ?? 0) >= 100
    },
  },
  {
    slug: 'ttt-perfect',
    check: async ({ profileId, tx }) => {
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'tic-tac-toe' },
        },
      })
      return scores.some((s) => {
        const meta = s.metadata
        const moves = meta?.moves
        return moves !== undefined && moves <= 5
      })
    },
  },
  {
    slug: 'streak-3',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 3
    },
  },
  {
    slug: 'streak-7',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 7
    },
  },
  {
    slug: 'streak-30',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 30
    },
  },
];

async function checkAndUnlockAchievements(profileId, gameSlug, result, tx) {
  for (const rule of ACHIEVEMENT_RULES) {
    console.log(`Running check for achievement: ${rule.slug}...`);
    await rule.check({ profileId, gameSlug, result, tx });
  }
}

async function test() {
  const profile = await prisma.profile.findFirst({
    where: { username: { startsWith: 'adarsh' } }
  });

  if (!profile) {
    console.error('Profile starting with adarsh not found');
    return;
  }

  const gameSlug = '2048';
  const result = 'win';

  try {
    await prisma.$transaction(async (tx) => {
      await checkAndUnlockAchievements(profile.id, gameSlug, result, tx);
      console.log('Transaction succeeded with all rules check!');
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
