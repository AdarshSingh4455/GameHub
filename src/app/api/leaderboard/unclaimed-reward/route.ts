import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { prisma } from '@/lib/prisma'
import { checkAndProcessWeeklyReset } from '@/lib/weeklyLeaderboardEngine'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard/unclaimed-reward
 * Returns the most recent unclaimed weekly reward for the authenticated user, if any.
 * Also triggers a lazy weekly reset check.
 */
export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ reward: null }, { status: 200 })
    }

    // Lazy check: process overdue weekly resets silently
    checkAndProcessWeeklyReset().catch(() => null)

    // Find unclaimed reward for this user, most recent first
    const reward = await prisma.weeklyLeaderboardReward.findFirst({
      where:   { profileId: profile.id, claimed: false },
      orderBy: { createdAt: 'desc' }
    })

    if (!reward) {
      return NextResponse.json({ reward: null })
    }

    // Find previous week reward for comparison (claimed or not)
    const previousReward = await prisma.weeklyLeaderboardReward.findFirst({
      where:   { profileId: profile.id, weekNumber: reward.weekNumber - 1 },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch archive dates
    const archive = await prisma.weeklyLeaderboardArchive.findUnique({
      where: { weekNumber: reward.weekNumber }
    })

    return NextResponse.json({
      reward: {
        id:          reward.id,
        weekNumber:  reward.weekNumber,
        rank:        reward.rank,
        score:       reward.score,
        coinsEarned: reward.coinsEarned,
        xpEarned:    reward.xpEarned,
        totalGames:  reward.totalGames,
        previousRank: previousReward?.rank ?? null,
        createdAt:   reward.createdAt,
        startDate:   archive?.startDate?.toISOString() ?? archive?.startDate ?? null,
        endDate:     archive?.endDate?.toISOString() ?? archive?.endDate ?? null
      }
    })
  } catch (err: unknown) {
    console.error('[GET /api/leaderboard/unclaimed-reward]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
