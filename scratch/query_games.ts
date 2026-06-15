import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { prisma } = await import('../src/lib/prisma');

  console.log('Querying all profiles in detail...');
  const profiles = await prisma.profile.findMany();
  console.log(profiles);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
