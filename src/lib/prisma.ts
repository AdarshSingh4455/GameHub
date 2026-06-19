import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { parse } from 'pg-connection-string'

import { createPrismaMockProxy } from './mockPrisma'

const globalForPrisma = globalThis as unknown as { prisma: any }

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    if (process.env.MOCK_DB === 'true') {
      return createPrismaMockProxy(null) as any
    }
    const connectionString = process.env.DATABASE_URL
    let config: pg.PoolConfig = {}
    if (connectionString) {
      config = parse(connectionString) as pg.PoolConfig
      if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
        config.ssl = {
          rejectUnauthorized: false
        }
      }
    }

    const pool = new pg.Pool(config)
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
  })()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

