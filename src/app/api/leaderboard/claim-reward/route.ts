import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/leaderboard/claim-reward
 * Marks a weekly reward as claimed (dismissed by user after viewing the result modal).
 * body: { rewardId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body     = await request.json()
    const rewardId = body?.rewardId as string

    if (!rewardId) {
      return NextResponse.json({ error: 'rewardId is required' }, { status: 400 })
    }

    // Verify ownership
    const reward = await prisma.weeklyLeaderboardReward.findFirst({
      where: { id: rewardId, profileId: profile.id }
    })

    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
    }

    if (reward.claimed) {
      return NextResponse.json({ success: true, alreadyClaimed: true })
    }

    await prisma.weeklyLeaderboardReward.update({
      where: { id: rewardId },
      data:  { claimed: true, claimedAt: new Date() }
    })

    // Mark related notification as read
    if (reward.weekNumber) {
      await prisma.notification.updateMany({
        where: {
          profileId: profile.id,
          title:     { contains: `Week #${reward.weekNumber}` },
          isRead:    false
        },
        data: { isRead: true }
      }).catch(() => null)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[POST /api/leaderboard/claim-reward]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
