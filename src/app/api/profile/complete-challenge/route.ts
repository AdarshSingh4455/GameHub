import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xp'
import { recalculateLeaderboardRanks } from '@/lib/ranks'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        xp: 1600,
        coins: 400,
        level: 5,
        leveledUp: false
      }, { status: 200 })
    }

    const { xpReward, coinReward, challengeId } = await request.json()

    // Fetch profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Perform update in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check if they already unlocked this XPEvent for today
      // Daily challenges start with prefix wc_ or db_
      const today = new Date()
      today.setHours(0,0,0,0)
      
      const existingEvent = await tx.xPEvent.findFirst({
        where: {
          profileId: profile.id,
          type: 'MANUAL_GRANT',
          createdAt: { gte: today },
          meta: { path: ['challengeId'], equals: challengeId }
        }
      })

      if (existingEvent) {
        return { success: false, message: 'Challenge reward already claimed today' }
      }

      // Increment profile XP and coins
      const updatedProfile = await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: xpReward },
          coins: { increment: coinReward }
        }
      })

      // Record XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'MANUAL_GRANT',
          amount: xpReward,
          meta: { challengeId }
        }
      })

      // Check level up
      const newLevel = computeLevel(updatedProfile.xp)
      const leveledUp = newLevel > profile.level
      if (leveledUp) {
        await tx.profile.update({
          where: { id: profile.id },
          data: { level: newLevel }
        })

        // Log level up event
        await tx.analyticsEvent.create({
          data: {
            profileId: profile.id,
            eventName: 'level_up',
            metadata: {
              oldLevel: profile.level,
              newLevel
            }
          }
        })
      }

      // Recalculate ranks based on new XP
      await recalculateLeaderboardRanks(tx)

      return {
        success: true,
        xp: updatedProfile.xp,
        coins: updatedProfile.coins,
        level: newLevel,
        leveledUp
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/profile/complete-challenge]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
