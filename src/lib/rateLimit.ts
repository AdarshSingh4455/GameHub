// In-memory rate limiter for multiplayer endpoints

const rateLimits = new Map<string, number[]>()

export function isRateLimited(
  userId: string,
  action: string,
  limit: number,
  windowMs: number = 60000
): boolean {
  const key = `${userId}:${action}`
  const now = Date.now()
  const timestamps = rateLimits.get(key) || []

  // Filter out expired timestamps
  const activeTimestamps = timestamps.filter(ts => now - ts < windowMs)
  
  if (activeTimestamps.length >= limit) {
    return true // Rate limited
  }

  activeTimestamps.push(now)
  rateLimits.set(key, activeTimestamps)
  return false // Allowed
}
