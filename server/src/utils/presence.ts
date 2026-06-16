import { redisClient } from './redis'

export type UserPresenceState = 'ONLINE' | 'OFFLINE' | 'IN_GAME'

const PRESENCE_TTL = 60 // 60 seconds TTL for heartbeat updates

/**
 * Sets user presence state in Redis
 */
export async function setUserPresence(userId: string, state: UserPresenceState): Promise<void> {
  if (!redisClient.isReady) return
  const key = `presence:user:${userId}`
  try {
    if (state === 'OFFLINE') {
      await redisClient.del(key)
    } else {
      await redisClient.set(key, state, { EX: PRESENCE_TTL })
    }
  } catch (err) {
    console.error(`Failed to set presence for user ${userId}:`, err)
  }
}

/**
 * Gets the current user presence state from Redis
 */
export async function getUserPresence(userId: string): Promise<UserPresenceState> {
  if (!redisClient.isReady) return 'OFFLINE'
  try {
    const state = await redisClient.get(`presence:user:${userId}`)
    return (state as UserPresenceState) || 'OFFLINE'
  } catch (err) {
    console.error(`Failed to get presence for user ${userId}:`, err)
    return 'OFFLINE'
  }
}

/**
 * Refreshes user presence TTL (heartbeat)
 */
export async function keepPresenceAlive(userId: string): Promise<void> {
  if (!redisClient.isReady) return
  const key = `presence:user:${userId}`
  try {
    const currentPresence = await redisClient.get(key)
    if (currentPresence && currentPresence !== 'OFFLINE') {
      await redisClient.expire(key, PRESENCE_TTL)
    }
  } catch (err) {
    console.error(`Failed to refresh presence TTL for user ${userId}:`, err)
  }
}
