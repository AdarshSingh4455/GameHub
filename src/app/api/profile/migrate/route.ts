import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xp'
import { Prisma } from '@prisma/client'

interface GuestStat {
  gameSlug: string
  playCount: number
  winCount: number
  highScore: number
}

export async function POST(request: NextRequest) {
  try {
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

    // 3. Prevent double migration (bypass only in development environment to facilitate repeating device testing)
    if (profile.migratedFromGuest && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Guest progress has already been migrated.' }, { status: 400 })
    }

    const body = await request.json()
    const {
      guestXP = 0,
      guestStreak = 0,
      guestLongestStreak = 0,
      guestRewardDay = 1,
      guestLastClaim = null,
      guestStats = [],
      guestAchievements = [],
    } = body

    // 4. Perform migration in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Migrate profile XP, coins, streaks, and claims
      const finalXP = profile.xp + guestXP
      const finalLevel = computeLevel(finalXP)
      
      const newStreak = Math.max(profile.currentStreak, guestStreak)
      const newLongest = Math.max(profile.longestStreak, guestLongestStreak)

      let parsedLastClaim: Date | null = null
      if (guestLastClaim) {
        try {
          parsedLastClaim = new Date(guestLastClaim)
        } catch {
          // ignore invalid date
        }
      }

      await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: finalXP,
          level: finalLevel,
          currentStreak: newStreak,
          longestStreak: newLongest,
          dailyRewardDay: Math.max(profile.dailyRewardDay, guestRewardDay),
          lastDailyRewardClaim: parsedLastClaim || profile.lastDailyRewardClaim,
          migratedFromGuest: true,
        },
      })

      // Migrate game statistics
      for (const stat of guestStats as GuestStat[]) {
        if (!stat.gameSlug) continue
        
        const existingStats = await tx.profileGameStats.findUnique({
          where: {
            profileId_gameSlug: {
              profileId: profile.id,
              gameSlug: stat.gameSlug,
            },
          },
        })

        if (existingStats) {
          await tx.profileGameStats.update({
            where: { id: existingStats.id },
            data: {
              playCount: existingStats.playCount + stat.playCount,
              winCount: existingStats.winCount + stat.winCount,
              highScore: Math.max(existingStats.highScore, stat.highScore),
            },
          })
        } else {
          await tx.profileGameStats.create({
            data: {
              profileId: profile.id,
              gameSlug: stat.gameSlug,
              playCount: stat.playCount,
              winCount: stat.winCount,
              highScore: stat.highScore,
            },
          })
        }
      }

      // Migrate achievements
      for (const slug of guestAchievements as string[]) {
        const achievement = await tx.achievement.findUnique({
          where: { slug },
        })
        if (!achievement) continue

        // Check if user already unlocked this achievement
        const exists = await tx.userAchievement.findUnique({
          where: {
            profileId_achievementId: {
              profileId: profile.id,
              achievementId: achievement.id,
            },
          },
        })

        if (!exists) {
          await tx.userAchievement.create({
            data: {
              profileId: profile.id,
              achievementId: achievement.id,
            },
          })
        }
      }

      // Log AnalyticsEvent hook
      await tx.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'guest_progress_migrated',
          metadata: {
            migratedXP: guestXP,
            migratedStreak: guestStreak,
            statsCount: guestStats.length,
            achievementsCount: guestAchievements.length,
          },
        },
      })
    }, { maxWait: 15000, timeout: 30000 })

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err) {
    console.error('[POST /api/profile/migrate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
