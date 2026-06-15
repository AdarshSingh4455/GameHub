import { prisma } from '../src/lib/prisma'


async function main() {
  const existingAd = await prisma.ad.findFirst()
  if (!existingAd) {
    await prisma.ad.create({
      data: {
        imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=300&auto=format&fit=crop',
        targetUrl: 'https://google.com',
        durationSecs: 3,
        allGames: true,
        active: true,
      }
    })
    console.log('Created mock ad for testing!')
  } else {
    console.log('Mock ad already exists:', existingAd)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
