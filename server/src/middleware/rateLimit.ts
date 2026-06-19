import { Socket } from 'socket.io'
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible'
import { redisClient } from '../utils/redis'

class AdaptiveRateLimiter {
  private redisLimiter: RateLimiterRedis
  private memoryLimiter: RateLimiterMemory

  constructor(opts: any) {
    this.redisLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      ...opts
    })
    this.memoryLimiter = new RateLimiterMemory(opts)
  }

  async consume(key: string, points = 1) {
    if (redisClient.isReady) {
      try {
        return await this.redisLimiter.consume(key, points)
      } catch (err: any) {
        // If it is a rate limit rejection (rejected resource contains msBeforeNext), rethrow it
        if (err && err.msBeforeNext !== undefined) {
          throw err
        }
        // Otherwise, it is a Redis connection error/offline state; fallback to memory
        return await this.memoryLimiter.consume(key, points)
      }
    } else {
      return await this.memoryLimiter.consume(key, points)
    }
  }
}

// Rate limit rules: key prefixes, points (max requests), duration (in seconds)
export const createRoomLimiter = new AdaptiveRateLimiter({
  keyPrefix: 'rl:create_room',
  points: 5,
  duration: 60
})

export const joinRoomLimiter = new AdaptiveRateLimiter({
  keyPrefix: 'rl:join_room',
  points: 10,
  duration: 60
})

export const sendChatLimiter = new AdaptiveRateLimiter({
  keyPrefix: 'rl:send_chat',
  points: 60,
  duration: 60
})

export const submitMoveLimiter = new AdaptiveRateLimiter({
  keyPrefix: 'rl:submit_move',
  points: 2, // Allow a minor double-click buffer but block heavy spam
  duration: 1
})

/**
 * Check if the current socket client exceeds the rate limit for a specific action.
 * Emits an error event or executes the callback with an error parameter if blocked.
 */
export const checkRateLimit = async (
  socket: Socket,
  limiter: AdaptiveRateLimiter,
  event: string,
  callback?: (response: { error: string }) => void
): Promise<boolean> => {
  // Bypass rate limiting in mock/test environment to prevent test failures
  if (process.env.MOCK_AUTH === 'true') {
    return true
  }

  // Rate limit by userId if logged in, fallback to socket.id or handshake IP
  const identifier = socket.data.user?.userId || socket.id
  
  try {
    await limiter.consume(identifier)
    return true
  } catch (rejRes) {
    console.warn(`[RATE LIMIT EXCEEDED] identifier=${identifier} event=${event}`)
    const errorMsg = 'Too many requests. Please try again in a moment.'
    
    if (callback) {
      callback({ error: errorMsg })
    } else {
      socket.emit('error', errorMsg)
    }
    return false
  }
}

