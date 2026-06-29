import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  finalizeWeeklyLeaderboard,
  getOrCreateWeeklyState,
  previewCurrentTop10,
  rotateWeek,
  checkAndProcessWeeklyReset
} from '@/lib/weeklyLeaderboardEngine'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/weekly-leaderboard
 * Preview current top 10 + weekly state
 */
export async function GET(request: NextRequest) {
  try {
    const state    = await getOrCreateWeeklyState()
    const preview  = await previewCurrentTop10()
    const archives = await prisma.weeklyLeaderboardArchive.findMany({
      orderBy: { weekNumber: 'desc' },
      take: 10
    })

    return NextResponse.json({
      state:   { ...state, startDate: (state.startDate as any)?.toISOString?.() ?? state.startDate, endDate: (state.endDate as any)?.toISOString?.() ?? state.endDate },
      preview,
      archives
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/admin/weekly-leaderboard
 * body: { action: 'finalize' | 'rotate' | 'finalizeAndRotate' | 'check' }
 */
export async function POST(request: NextRequest) {
  try {
    const body   = await request.json()
    const action = body?.action

    if (action === 'finalize') {
      const result = await finalizeWeeklyLeaderboard()
      return NextResponse.json({ success: true, result })
    }

    if (action === 'rotate') {
      const result = await rotateWeek()
      return NextResponse.json({ success: true, result })
    }

    if (action === 'finalizeAndRotate') {
      const finalResult = await finalizeWeeklyLeaderboard()
      const rotResult   = await rotateWeek()
      return NextResponse.json({ success: true, finalize: finalResult, rotate: rotResult })
    }

    if (action === 'check') {
      const result = await checkAndProcessWeeklyReset()
      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[POST /api/admin/weekly-leaderboard]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
