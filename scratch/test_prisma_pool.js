const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const url = 'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require';

async function run() {
  console.log('Testing Prisma PgPool setup...');
  
  const pool = new pg.Pool({
    connectionString: url,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  try {
    const profile = await prisma.profile.findFirst();
    console.log('🎉 SUCCESS! Prisma connected and query succeeded!');
    console.log('First profile:', profile);
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

run();
