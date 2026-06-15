const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
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
  const profiles = await prisma.profile.findMany();
  profiles.forEach(p => {
    console.log(`Username="${p.username}", profile.id="${p.id}", profile.userId="${p.userId}"`);
  });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
