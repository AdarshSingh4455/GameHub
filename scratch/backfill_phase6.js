const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local env vars
const envLocalPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envLocalPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { parse } = require('pg-connection-string');

const connectionString = process.env.DATABASE_URL;
let config = {};
if (connectionString) {
  config = parse(connectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }
}

const pool = new pg.Pool(config);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function generateFriendCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GH-${code}`;
}

async function main() {
  const profiles = await prisma.profile.findMany();
  console.log(`Found ${profiles.length} profiles. Backfilling...`);
  
  // 1. Backfill Friend Codes
  for (const p of profiles) {
    if (!p.friendCode) {
      let unique = false;
      let code = '';
      while (!unique) {
        code = generateFriendCode();
        const dup = await prisma.profile.findFirst({ where: { friendCode: code } });
        if (!dup) unique = true;
      }
      await prisma.profile.update({
        where: { id: p.id },
        data: { friendCode: code }
      });
      console.log(`Assigned ${code} to ${p.username}`);
    }
  }

  // 2. Backfill Ranks (Global Leaderboard by XP desc)
  const sortedProfiles = await prisma.profile.findMany({
    orderBy: { xp: 'desc' }
  });
  console.log('Recalculating ranks...');
  for (let idx = 0; idx < sortedProfiles.length; idx++) {
    const p = sortedProfiles[idx];
    const rank = idx + 1;
    await prisma.profile.update({
      where: { id: p.id },
      data: {
        currentRank: rank,
        previousRank: rank // initially same
      }
    });
    console.log(`Rank #${rank}: ${p.username} (${p.xp} XP)`);
  }

  console.log('Backfill complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
