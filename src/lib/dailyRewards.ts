export interface DailyRewardConfig {
  day: number
  coins: number
  xp: number
  badge?: string
}

// Reusable table configuration for rewards, supporting trivial expansion to 30 days
export const DAILY_REWARD_TABLE: DailyRewardConfig[] = [
  { day: 1, coins: 10,  xp: 50 },
  { day: 2, coins: 20,  xp: 75 },
  { day: 3, coins: 30,  xp: 100 },
  { day: 4, coins: 40,  xp: 125 },
  { day: 5, coins: 50,  xp: 150 },
  { day: 6, coins: 60,  xp: 200 },
  { day: 7, coins: 100, xp: 300, badge: 'Weekly Warrior' },
]

/**
 * Calculates day difference based strictly on UTC calendar date midnights.
 * This prevents client timezone manipulations.
 */
export function getUtcDaysElapsed(date1: Date, date2: Date): number {
  const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate())
  const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate())
  return Math.floor((utc1 - utc2) / 86400000)
}
