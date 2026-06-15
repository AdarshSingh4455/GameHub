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
  console.log('Inserting profiles...');

  const p1 = await prisma.profile.upsert({
    where: { userId: 'test-uid-gamer-pro' },
    update: {
      username: 'gamer_pro',
      xp: 5200,
      level: 5,
      coins: 500
    },
    create: {
      userId: 'test-uid-gamer-pro',
      username: 'gamer_pro',
      xp: 5200,
      level: 5,
      coins: 500
    }
  });
  console.log('Upserted gamer_pro:', p1.username);

  const p2 = await prisma.profile.upsert({
    where: { userId: 'test-uid-alex-warrior' },
    update: {
      username: 'alex_warrior',
      xp: 3400,
      level: 3,
      coins: 250
    },
    create: {
      userId: 'test-uid-alex-warrior',
      username: 'alex_warrior',
      xp: 3400,
      level: 3,
      coins: 250
    }
  });
  console.log('Upserted alex_warrior:', p2.username);

  console.log('All profiles inserted successfully!');
}

main()
  .catch(e => {
    console.error('Error seeding profiles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
