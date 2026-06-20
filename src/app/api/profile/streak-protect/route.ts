import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (profile.streakProtectionActive) {
      return NextResponse.json({ error: 'Streak protection is already active' }, { status: 400 })
    }

    if (profile.coins < 100) {
      return NextResponse.json({ error: 'Insufficient coins. Streak protection costs 100 coins.' }, { status: 400 })
    }

    const updated = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        coins: { decrement: 100 },
        streakProtectionActive: true
      }
    })

    // Log analytics
    await prisma.analyticsEvent.create({
      data: {
        profileId: profile.id,
        eventName: 'streak_protection_purchased',
        metadata: { cost: 100 }
      }
    })

    return NextResponse.json({ success: true, profile: updated }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/profile/streak-protect]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
