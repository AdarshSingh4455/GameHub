import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Connecting to database using configured prisma adapter...')
  try {
    const gamesCount = await prisma.game.count()
    console.log(`Success! Games in database: ${gamesCount}`)
    const profilesCount = await prisma.profile.count()
    console.log(`Profiles in database: ${profilesCount}`)
  } catch (e) {
    console.error('Connection failed:', e)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
