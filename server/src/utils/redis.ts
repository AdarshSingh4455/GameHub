import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const redisClient = createClient({
  url: redisUrl
})

redisClient.on('error', (err) => {
  console.error('Redis Client Connection Error:', err)
})

// Immediately connect to Redis
export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    try {
      await redisClient.connect()
      console.log('🔌 Connected to Redis presence and rate limit cache.')
    } catch (err) {
      console.error('❌ Redis Connection Failed:', err)
    }
  }
}
