import pg from 'pg';
import { parse } from 'pg-connection-string';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
let config = {};
if (connectionString) {
  config = parse(connectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }
}
const pool = new pg.Pool(config);
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const profiles = await prisma.profile.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
  console.log('*** REGISTERED PROFILES ***');
  profiles.forEach(p => {
    console.log(`- Username: ${p.username}, Level: ${p.level}, XP: ${p.xp}, Coins: ${p.coins}, ID: ${p.id}, UserID: ${p.userId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
