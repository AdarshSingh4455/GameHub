import pkgEnv from '@next/env'
const { loadEnvConfig } = pkgEnv
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import pkgConnectionString from 'pg-connection-string'
const { parse } = pkgConnectionString

const connectionString = process.env.DATABASE_URL
let dbConfig = {}
if (connectionString) {
  dbConfig = parse(connectionString)
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    dbConfig.ssl = { rejectUnauthorized: false }
  }
}
const pool = new pg.Pool(dbConfig)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function run() {
  try {
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: '6DOAIR' },
      include: {
        players: true,
        gameSession: true
      }
    })

    console.log('--- DATABASE RECORDS FOR ROOM 6DOAIR ---')
    console.log(JSON.stringify(room, null, 2))
  } catch (err) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}

run()
