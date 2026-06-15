const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Querying games...');
  const games = await prisma.game.findMany();
  console.log('Games found in DB:');
  console.log(games);

  console.log('Querying profiles...');
  const profiles = await prisma.profile.findMany();
  console.log('Profiles found in DB:');
  console.log(profiles.map(p => ({ id: p.id, userId: p.userId, username: p.username, xp: p.xp, level: p.level, coins: p.coins })));
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
