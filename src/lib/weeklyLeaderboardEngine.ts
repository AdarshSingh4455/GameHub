/**
 * Weekly Leaderboard Rewards Engine
 *
 * Handles weekly score finalization, tie-break resolution, reward distribution,
 * temporary badge assignment, and week rotation.
 *
 * Designed to be future-ready: the same primitives can be reused for
 * daily, monthly, seasonal, and special-event leaderboards.
 */

import { prisma } from '@/lib/prisma'

// ─── Constants ────────────────────────────────────────────────────────────────

export const WEEKLY_BADGE_SLUGS = {
  champion:   'weekly-champion',
  runnerUp:   'weekly-runner-up',
  topThree:   'weekly-top3',
} as const

export interface RewardTier {
  maxRank:    number
  coins:      number
  xp:         number
  badgeSlug?: string
}

export const WEEKLY_REWARD_TIERS: RewardTier[] = [
  { maxRank: 1,  coins: 2500, xp: 500, badgeSlug: WEEKLY_BADGE_SLUGS.champion },
  { maxRank: 2,  coins: 1800, xp: 300, badgeSlug: WEEKLY_BADGE_SLUGS.runnerUp },
  { maxRank: 3,  coins: 1200, xp: 200, badgeSlug: WEEKLY_BADGE_SLUGS.topThree },
  { maxRank: 10, coins: 500,  xp: 100 },
]

export interface WeeklyStandingEntry {
  rank:           number
  profileId:      string
  username:       string
  displayName:    string | null
  avatarUrl:      string | null
  score:          number
  totalGames:     number
  coinsEarned:    number
  xpEarned:       number
  badgeSlug?:     string
  firstScoredAt?: string
}

function getRewardForRank(rank: number): { coins: number; xp: number; badgeSlug?: string } {
  for (const tier of WEEKLY_REWARD_TIERS) {
    if (rank <= tier.maxRank) return { coins: tier.coins, xp: tier.xp, badgeSlug: tier.badgeSlug }
  }
  return { coins: 0, xp: 0 }
}

// ─── Countdown Helper ─────────────────────────────────────────────────────────

/** Returns the next Monday 10:30 AM (server time) after a given date. */
export function nextMonday1030(after: Date = new Date()): Date {
  const d = new Date(after)
  d.setMilliseconds(0)
  d.setSeconds(0)
  d.setMinutes(30)
  d.setHours(10)
  // Advance until next Monday
  while (d.getDay() !== 1 || d.getTime() <= after.getTime()) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

// ─── Get Current Weekly State (with lazy seed) ───────────────────────────────

export async function getOrCreateWeeklyState(tx?: any): Promise<{
  id: string
  weekNumber: number
  startDate: Date
  endDate: Date
}> {
  const db = tx ?? prisma
  let state = await db.weeklyLeaderboardState.findUnique({ where: { id: 'current' } })
  if (!state) {
    const start = new Date()
    start.setHours(10, 30, 0, 0)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    if (start.getTime() > Date.now()) start.setDate(start.getDate() - 7)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    state = await db.weeklyLeaderboardState.create({
      data: { id: 'current', weekNumber: 1, startDate: start, endDate: end }
    })
  }
  return state
}

// ─── Collect Weekly Top Players ───────────────────────────────────────────────

async function collectWeeklyStandings(
  startDate: Date,
  endDate: Date,
  db: any,
  limit = 50
): Promise<WeeklyStandingEntry[]> {
  // Sum XP earned within the week window grouped by profile
  const xpSums = await db.xPEvent.groupBy({
    by: ['profileId'],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum:   { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit
  })

  if (!xpSums.length) return []

  const profileIds = xpSums.map((x: any) => x.profileId)

  // For tie-breaking: find the first event where the player scored within the week
  const firstEvents: Record<string, string> = {}
  for (const pid of profileIds) {
    const ev = await db.xPEvent.findFirst({
      where:   { profileId: pid, createdAt: { gte: startDate, lte: endDate } },
      orderBy: { createdAt: 'asc' },
      select:  { createdAt: true }
    })
    firstEvents[pid] = ev?.createdAt?.toISOString?.() ?? ev?.createdAt ?? new Date(0).toISOString()
  }

  const profiles = await db.profile.findMany({
    where:  { id: { in: profileIds } },
    select: { id: true, username: true, displayName: true, avatarUrl: true }
  })
  const profileMap: Record<string, any> = {}
  for (const p of profiles) profileMap[p.id] = p

  // Build unsorted list
  const entries: Omit<WeeklyStandingEntry, 'rank'>[] = xpSums.map((x: any) => {
    const p = profileMap[x.profileId] || {}
    return {
      profileId:      x.profileId,
      username:       p.username ?? 'Unknown',
      displayName:    p.displayName ?? null,
      avatarUrl:      p.avatarUrl ?? null,
      score:          x._sum.amount ?? 0,
      totalGames:     x._count.id ?? 0,
      coinsEarned:    0,
      xpEarned:       0,
      firstScoredAt:  firstEvents[x.profileId]
    }
  })

  // Tie-break: 1) higher score, 2) fewer games, 3) earlier first-score timestamp
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.totalGames !== b.totalGames) return a.totalGames - b.totalGames
    return new Date(a.firstScoredAt!).getTime() - new Date(b.firstScoredAt!).getTime()
  })

  return entries.slice(0, 10).map((e, idx) => {
    const rank   = idx + 1
    const reward = getRewardForRank(rank)
    return { ...e, rank, coinsEarned: reward.coins, xpEarned: reward.xp, badgeSlug: reward.badgeSlug }
  })
}

// ─── Main: Finalize & Distribute ─────────────────────────────────────────────

export interface FinalizeResult {
  weekNumber:    number
  distributed:   number
  alreadyDone:   boolean
  standings:     WeeklyStandingEntry[]
}

export async function finalizeWeeklyLeaderboard(): Promise<FinalizeResult> {
  return prisma.$transaction(async (tx) => {
    const state = await getOrCreateWeeklyState(tx)
    const weekNumber = state.weekNumber

    // ── Idempotency: bail if already distributed ──────────────────────────
    const existing = await tx.weeklyLeaderboardArchive.findUnique({
      where: { weekNumber }
    })
    if (existing?.rewardsDistributed) {
      return { weekNumber, distributed: 0, alreadyDone: true, standings: existing.standings as WeeklyStandingEntry[] }
    }

    // ── Collect standings ────────────────────────────────────────────────
    const standings = await collectWeeklyStandings(
      new Date(state.startDate),
      new Date(state.endDate),
      tx
    )

    // ── Archive standings ────────────────────────────────────────────────
    if (existing) {
      await tx.weeklyLeaderboardArchive.update({
        where: { weekNumber },
        data:  { standings, rewardsDistributed: true, distributedAt: new Date() }
      })
    } else {
      await tx.weeklyLeaderboardArchive.create({
        data: {
          weekNumber,
          startDate:          new Date(state.startDate),
          endDate:            new Date(state.endDate),
          standings,
          rewardsDistributed: true,
          distributedAt:      new Date()
        }
      })
    }

    // ── Clear old weekly badges ───────────────────────────────────────────
    const badgeSlugs = Object.values(WEEKLY_BADGE_SLUGS)
    await tx.userAchievement.deleteMany({
      where: { achievement: { slug: { in: badgeSlugs } } }
    })

    // ── Distribute rewards ────────────────────────────────────────────────
    let distributed = 0
    for (const entry of standings) {
      if (entry.coinsEarned === 0 && entry.xpEarned === 0) continue

      // Upsert reward record (idempotent)
      await tx.weeklyLeaderboardReward.create({
        data: {
          profileId:   entry.profileId,
          weekNumber,
          rank:        entry.rank,
          score:       entry.score,
          coinsEarned: entry.coinsEarned,
          xpEarned:    entry.xpEarned,
          totalGames:  entry.totalGames,
          claimed:     false,
          createdAt:   new Date()
        }
      }).catch(() => null) // skip if already exists (@@unique constraint)

      // Credit coins & XP to profile
      await tx.profile.update({
        where: { id: entry.profileId },
        data:  {
          coins: { increment: entry.coinsEarned },
          xp:    { increment: entry.xpEarned }
        }
      }).catch(() => null)

      // Assign weekly badge (Top 3 only)
      if (entry.badgeSlug) {
        // Ensure achievement record exists (upsert-safe)
        let achievement = await tx.achievement.findFirst({ where: { slug: entry.badgeSlug } }).catch(() => null)
        if (!achievement) {
          const badgeMeta: Record<string, { name: string; description: string }> = {
            [WEEKLY_BADGE_SLUGS.champion]:  { name: 'Weekly Champion',  description: 'Ranked #1 on the weekly leaderboard.' },
            [WEEKLY_BADGE_SLUGS.runnerUp]:  { name: 'Weekly Runner-up', description: 'Ranked #2 on the weekly leaderboard.' },
            [WEEKLY_BADGE_SLUGS.topThree]:  { name: 'Weekly Top 3',     description: 'Ranked top 3 on the weekly leaderboard.' },
          }
          const meta = badgeMeta[entry.badgeSlug] ?? { name: entry.badgeSlug, description: '' }
          achievement = await tx.achievement.create({
            data: { id: entry.badgeSlug, slug: entry.badgeSlug, name: meta.name, description: meta.description, xpReward: 0, coinReward: 0, category: 'Weekly' }
          }).catch(() => null)
        }
        if (achievement) {
          await tx.userAchievement.create({
            data: { profileId: entry.profileId, achievementId: achievement.id, unlockedAt: new Date() }
          }).catch(() => null)
        }
      }

      // Send notification
      const medalEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : '🏅'
      await tx.notification.create({
        data: {
          profileId: entry.profileId,
          type:      'SYSTEM',
          title:     `${medalEmoji} Weekly Reward — Week #${weekNumber}`,
          message:   `You finished Rank #${entry.rank} this week! +${entry.coinsEarned} Coins and +${entry.xpEarned} XP have been credited to your account.`,
          linkUrl:   '/dashboard/leaderboard',
          isRead:    false
        }
      }).catch(() => null)

      distributed++
    }

    return { weekNumber, distributed, alreadyDone: false, standings }
  }, { timeout: 30000 })
}

// ─── Week Rotation ────────────────────────────────────────────────────────────

export async function rotateWeek(): Promise<{ weekNumber: number; startDate: Date; endDate: Date }> {
  return prisma.$transaction(async (tx) => {
    const state = await getOrCreateWeeklyState(tx)
    const newStart = new Date(state.endDate)
    const newEnd   = nextMonday1030(newStart)
    const newWeek  = state.weekNumber + 1
    await tx.weeklyLeaderboardState.update({
      where: { id: 'current' },
      data:  { weekNumber: newWeek, startDate: newStart, endDate: newEnd }
    })
    return { weekNumber: newWeek, startDate: newStart, endDate: newEnd }
  })
}

// ─── Lazy Check: run finalize + rotate if overdue ─────────────────────────────

export async function checkAndProcessWeeklyReset(): Promise<{ ran: boolean; weekNumber?: number }> {
  try {
    const state = await getOrCreateWeeklyState()
    if (new Date(state.endDate).getTime() > Date.now()) return { ran: false }

    // Overdue — finalize then rotate
    await finalizeWeeklyLeaderboard()
    const next = await rotateWeek()
    return { ran: true, weekNumber: next.weekNumber }
  } catch (err) {
    console.error('[weeklyLeaderboardEngine] checkAndProcessWeeklyReset error:', err)
    return { ran: false }
  }
}

// ─── Preview Current Top 10 (no distribution) ────────────────────────────────

export async function previewCurrentTop10(): Promise<WeeklyStandingEntry[]> {
  const state = await getOrCreateWeeklyState()
  return collectWeeklyStandings(new Date(state.startDate), new Date(), prisma)
}
