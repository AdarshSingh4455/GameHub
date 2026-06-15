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

// Convert port 6543 to 5432 for query stability
const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
const config = parse(sessionConnectionString);

if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
  config.ssl = { rejectUnauthorized: false };
}

const pool = new pg.Pool(config);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Fetching profiles sorted by XP desc...');
  const profiles = await prisma.profile.findMany({
    orderBy: { xp: 'desc' },
    include: {
      _count: {
        select: { wonMatches: true }
      }
    }
  });

  console.log(`Found ${profiles.length} profiles:`);
  profiles.forEach((p, idx) => {
    console.log(`Rank #${idx + 1}: Username="${p.username}", Level=${p.level}, XP=${p.xp}, Wins=${p._count.wonMatches}`);
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
