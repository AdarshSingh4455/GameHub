import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { parse } from 'pg-connection-string'
import { checkAndUnlockAchievements } from '../src/lib/achievements'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sessionConnectionString = connectionString.replace(':6543/', ':5432/')
const config = parse(sessionConnectionString)

if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
  config.ssl = { rejectUnauthorized: false }
}

const pool = new pg.Pool(config)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const profile = await prisma.profile.findFirst({
    where: { username: { startsWith: 'adarsh' } }
  })

  if (!profile) {
    console.error('Profile not found')
    return
  }

  console.log(`Running checkAndUnlockAchievements on profile ${profile.username}...`)

  try {
    await prisma.$transaction(async (tx) => {
      const unlocked = await checkAndUnlockAchievements(profile.id, '2048', 'win', tx)
      console.log('Success! Newly unlocked achievements:', unlocked)
    })
  } catch (err) {
    console.error('Transaction crashed with error:', err)
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
