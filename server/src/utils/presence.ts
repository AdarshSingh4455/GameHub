import { redisClient } from './redis'

export interface UserPresence {
  status: 'ONLINE' | 'OFFLINE' | 'IN_GAME' | 'IN_LOBBY' | 'IN_CHAT' | 'AWAY'
  activity?: string
  gameSlug?: string
  gameMode?: string
  startedAt?: number
  lastSeenAt: string
}

const PRESENCE_TTL = 60 // 60 seconds TTL for heartbeat updates

/**
 * Sets user presence state in Redis
 */
export async function setUserPresence(userId: string, presence: UserPresence | string): Promise<void> {
  if (!redisClient.isReady) return
  const key = `presence:user:${userId}`
  try {
    if (presence === 'OFFLINE') {
      await redisClient.del(key)
    } else {
      let data: UserPresence
      if (typeof presence === 'string') {
        data = {
          status: presence as any,
          activity: presence === 'IN_GAME' ? 'Playing' : 'Browsing Games',
          lastSeenAt: new Date().toISOString()
        }
      } else {
        data = presence
      }
      await redisClient.set(key, JSON.stringify(data), { EX: PRESENCE_TTL })
    }
  } catch (err) {
    console.error(`Failed to set presence for user ${userId}:`, err)
  }
}

/**
 * Gets the current user presence state from Redis
 */
export async function getUserPresence(userId: string): Promise<UserPresence | 'OFFLINE'> {
  if (!redisClient.isReady) return 'OFFLINE'
  try {
    const val = await redisClient.get(`presence:user:${userId}`)
    if (!val) return 'OFFLINE'
    try {
      return JSON.parse(val) as UserPresence
    } catch {
      return {
        status: val as any,
        activity: 'Idle',
        lastSeenAt: new Date().toISOString()
      }
    }
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
    if (currentPresence) {
      await redisClient.expire(key, PRESENCE_TTL)
    }
  } catch (err) {
    console.error(`Failed to refresh presence TTL for user ${userId}:`, err)
  }
}

