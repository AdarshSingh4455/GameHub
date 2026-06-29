import { NextRequest, NextResponse } from 'next/server'
import { checkAndProcessWeeklyReset, finalizeWeeklyLeaderboard, rotateWeek } from '@/lib/weeklyLeaderboardEngine'

export const dynamic = 'force-dynamic'

/**
 * GET /api/leaderboard/cron
 * Called by external cron (Vercel Cron, GitHub Actions, etc.) every Monday 10:30 AM
 * Finalizes the previous week, distributes rewards, and rotates to the new week.
 */
export async function GET(request: Request) {
  try {
    // Validate secret if provided in environment
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization') || ''
      const token = authHeader.replace('Bearer ', '')
      if (token !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const finResult = await finalizeWeeklyLeaderboard()
    let rotResult: Awaited<ReturnType<typeof rotateWeek>> | null = null

    if (!finResult.alreadyDone) {
      rotResult = await rotateWeek()
    }

    return NextResponse.json({
      success:     true,
      weekNumber:  finResult.weekNumber,
      distributed: finResult.distributed,
      alreadyDone: finResult.alreadyDone,
      newWeek:     rotResult
    })

  } catch (err: unknown) {
    console.error('[GET /api/leaderboard/cron]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
