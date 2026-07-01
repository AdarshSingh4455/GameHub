import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xp'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { achievementSlug } = body

    if (!achievementSlug) {
      return NextResponse.json({ error: 'Missing achievementSlug' }, { status: 400 })
    }

    if (process.env.MOCK_AUTH === 'true') {
      return NextResponse.json({
        success: true,
        achievementSlug,
        mocked: true,
      }, { status: 200 })
    }

    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 3. Find the achievement
    const achievement = await prisma.achievement.findUnique({
      where: { slug: achievementSlug },
    })
    if (!achievement) {
      return NextResponse.json({ error: `Achievement not found: ${achievementSlug}` }, { status: 404 })
    }

    // 4. Check if already unlocked
    const existingUnlock = await prisma.userAchievement.findUnique({
      where: {
        profileId_achievementId: {
          profileId: profile.id,
          achievementId: achievement.id,
        },
      },
    })

    if (existingUnlock) {
      return NextResponse.json({
        success: true,
        message: 'Achievement already unlocked',
        unlocked: false,
      }, { status: 200 })
    }

    // 5. Unlock the achievement in a transaction
    const responsePayload = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create user achievement record
      await tx.userAchievement.create({
        data: {
          profileId: profile.id,
          achievementId: achievement.id,
        },
      })

      // Increment profile base rewards
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: achievement.xpReward },
          coins: { increment: achievement.coinReward },
        },
      })

      // Record XP event
      if (achievement.xpReward > 0) {
        await tx.xPEvent.create({
          data: {
            profileId: profile.id,
            type: 'ACHIEVEMENT',
            amount: achievement.xpReward,
            meta: { achievementSlug },
          },
        })
      }

      // Record Analytics event
      await tx.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'achievement_unlocked',
          metadata: {
            achievementSlug,
            xpReward: achievement.xpReward,
            coinReward: achievement.coinReward,
          },
        },
      })

      // Check level up
      const finalXP = profile.xp + achievement.xpReward
      const finalLevel = computeLevel(finalXP)
      const leveledUp = finalLevel > profile.level

      if (leveledUp) {
        await tx.profile.update({
          where: { id: profile.id },
          data: { level: finalLevel },
        })

        await tx.analyticsEvent.create({
          data: {
            profileId: profile.id,
            eventName: 'level_up',
            metadata: {
              oldLevel: profile.level,
              newLevel: finalLevel,
            },
          },
        })
      }

      return {
        success: true,
        unlocked: true,
        achievementSlug,
        xpGained: achievement.xpReward,
        coinsGained: achievement.coinReward,
        leveledUp,
        newLevel: finalLevel,
      }
    })

    return NextResponse.json(responsePayload, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/achievements/unlock]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
