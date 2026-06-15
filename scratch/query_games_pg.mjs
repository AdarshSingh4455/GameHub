import pg from 'pg';
import { parse } from 'pg-connection-string';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

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

async function main() {
  console.log('Querying games in database...');
  const games = await prisma.game.findMany();
  console.log('Games found:', games.map(g => ({ id: g.id, slug: g.slug, name: g.name })));
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
