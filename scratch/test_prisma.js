const { PrismaClient } = require('@prisma/client');

// Set the DATABASE_URL environment variable dynamically
process.env.DATABASE_URL = 'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require';

const prisma = new PrismaClient();

async function run() {
  console.log('Testing Prisma connection with URL:', process.env.DATABASE_URL.replace(/:[^:]+@/, ':****@'));
  try {
    const profile = await prisma.profile.findFirst();
    console.log('🎉 SUCCESS! Connected to Prisma successfully.');
    console.log('First profile:', profile);
  } catch (err) {
    console.error('FAILED:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
