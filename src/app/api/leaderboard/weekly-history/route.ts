import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAndProcessWeeklyReset, getOrCreateWeeklyState, nextMonday1030 } from '@/lib/weeklyLeaderboardEngine'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard/weekly-history
 * Returns all archived weekly leaderboard results (Hall of Fame),
 * plus the current week's state and countdown to next reset.
 */
export async function GET() {
  try {
    // Lazy reset check
    checkAndProcessWeeklyReset().catch(() => null)

    const archives = await prisma.weeklyLeaderboardArchive.findMany({
      orderBy: { weekNumber: 'desc' }
    })

    const state      = await getOrCreateWeeklyState()
    const endDate    = new Date(state.endDate)
    const nextReset  = endDate.getTime() > Date.now() ? endDate : nextMonday1030()

    return NextResponse.json({
      archives: archives.map(a => ({
        id:                 a.id,
        weekNumber:         a.weekNumber,
        startDate:          a.startDate,
        endDate:            a.endDate,
        rewardsDistributed: a.rewardsDistributed,
        distributedAt:      a.distributedAt,
        standings:          a.standings
      })),
      currentWeek: {
        weekNumber: state.weekNumber,
        startDate:  state.startDate,
        endDate:    state.endDate,
        nextReset:  nextReset.toISOString()
      }
    })
  } catch (err: unknown) {
    console.error('[GET /api/leaderboard/weekly-history]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
