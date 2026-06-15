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

async function main() {
  console.log('Fetching games...');
  const games = await prisma.game.findMany();
  console.log(`Found ${games.length} games:`);
  games.forEach(g => {
    console.log(`- Slug="${g.slug}", Name="${g.name}", Category="${g.category}"`);
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
