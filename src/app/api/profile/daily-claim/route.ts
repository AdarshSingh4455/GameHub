import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { DAILY_REWARD_TABLE, getUtcDaysElapsed } from '@/lib/dailyRewards'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { computeLevel } from '@/lib/xp'
import { recalculateLeaderboardRanks } from '@/lib/ranks'
import { Prisma } from '@prisma/client'

export async function GET() {
  try {
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      const now = new Date()
      const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const secondsRemaining = Math.max(0, Math.ceil((nextUtcMidnight.getTime() - now.getTime()) / 1000))
      return NextResponse.json({
        canClaim: true,
        currentStreak: 4,
        dailyRewardDay: 3,
        nextClaimDay: 3,
        lastDailyRewardClaim: new Date(Date.now() - 3600000 * 24).toISOString(), // 24h ago
        secondsRemaining,
        rewardTable: DAILY_REWARD_TABLE,
      }, { status: 200 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: {
        currentStreak: true,
        dailyRewardDay: true,
        lastDailyRewardClaim: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const now = new Date()
    let canClaim = true
    let nextClaimDay = profile.dailyRewardDay

    if (profile.lastDailyRewardClaim) {
      const daysElapsed = getUtcDaysElapsed(now, profile.lastDailyRewardClaim)
      if (daysElapsed === 0) {
        canClaim = false
      } else if (daysElapsed > 1) {
        // Missed a day, next reward would reset to Day 1
        nextClaimDay = 1
      } else {
        // Consecutive, next reward day cycles or increments
        nextClaimDay = (profile.dailyRewardDay % DAILY_REWARD_TABLE.length) + 1
      }
    } else {
      nextClaimDay = 1
    }

    // Time remaining until next UTC midnight
    const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
    const secondsRemaining = Math.max(0, Math.ceil((nextUtcMidnight.getTime() - now.getTime()) / 1000))

    return NextResponse.json({
      canClaim,
      currentStreak: profile.currentStreak,
      dailyRewardDay: profile.dailyRewardDay,
      nextClaimDay,
      lastDailyRewardClaim: profile.lastDailyRewardClaim,
      secondsRemaining,
      rewardTable: DAILY_REWARD_TABLE,
    }, { status: 200 })

  } catch (err) {
    console.error('[GET /api/profile/daily-claim]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        coinsGained: 50,
        xpGained: 100,
        streak: 5,
        dayClaimed: 3,
        leveledUp: false,
        newLevel: 5,
        unlockedAchievements: [],
      }, { status: 200 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const now = new Date()

    // 1. Double claim verification
    if (profile.lastDailyRewardClaim) {
      const daysElapsed = getUtcDaysElapsed(now, profile.lastDailyRewardClaim)
      if (daysElapsed === 0) {
        return NextResponse.json({ error: 'Already claimed today' }, { status: 400 })
      }
    }

    // 2. Perform reward claim transaction
    const resultPayload = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let newStreak = 1
      let newRewardDay = 1
      let streakProtected = false
      let comebackApplied = false

      if (profile.lastDailyRewardClaim) {
        const daysElapsed = getUtcDaysElapsed(now, profile.lastDailyRewardClaim)
        if (daysElapsed === 1) {
          // Consecutive login
          newStreak = profile.currentStreak + 1
          newRewardDay = (profile.dailyRewardDay % DAILY_REWARD_TABLE.length) + 1
        } else if (profile.streakProtectionActive) {
          // Protected from reset!
          newStreak = profile.currentStreak + 1
          newRewardDay = (profile.dailyRewardDay % DAILY_REWARD_TABLE.length) + 1
          streakProtected = true
        } else {
          // Missed login day(s) - reset
          newStreak = 1
          newRewardDay = 1
        }

        if (daysElapsed >= 7) {
          comebackApplied = true
        }
      } else {
        // First claim ever
        newStreak = 1
        newRewardDay = 1
      }

      // Fetch active reward config
      const rewardConfig = DAILY_REWARD_TABLE.find(r => r.day === newRewardDay) || DAILY_REWARD_TABLE[0]
      const extraCoins = comebackApplied ? 300 : 0

      // Update user coins and XP, daily reward day, and streaks
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: rewardConfig.xp },
          coins: { increment: rewardConfig.coins + extraCoins },
          currentStreak: newStreak,
          longestStreak: Math.max(profile.longestStreak, newStreak),
          dailyRewardDay: newRewardDay,
          lastDailyRewardClaim: now,
          lastActiveAt: now,
          streakProtectionActive: streakProtected ? false : profile.streakProtectionActive
        },
      })

      // Log claim details
      await tx.dailyRewardLog.create({
        data: {
          profileId: profile.id,
          dayNumber: newRewardDay,
          coinsGiven: rewardConfig.coins,
          xpGiven: rewardConfig.xp,
          claimedAt: now,
        },
      })

      // Log XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'DAILY_LOGIN',
          amount: rewardConfig.xp,
        },
      })

      // Log AnalyticsEvent hook
      await tx.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'daily_reward_claimed',
          metadata: {
            dayNumber: newRewardDay,
            coinsGained: rewardConfig.coins,
            xpGained: rewardConfig.xp,
            streak: newStreak,
          },
        },
      })

      // Check achievements (specifically daily login streak milestones: streak-3, streak-7, streak-30)
      const newlyUnlocked = await checkAndUnlockAchievements(profile.id, 'daily-login', 'win', tx)

      // Total rewards gained
      const totalXPGained = rewardConfig.xp + newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0)
      const totalCoinsGained = rewardConfig.coins + newlyUnlocked.reduce((sum, a) => sum + a.coinReward, 0)

      const finalXP = profile.xp + totalXPGained
      const finalLevel = computeLevel(finalXP)
      const leveledUp = finalLevel > profile.level

      if (leveledUp) {
        await tx.profile.update({
          where: { id: profile.id },
          data: { level: finalLevel },
        })

        // Log LevelUp analytics event
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

      // Recalculate ranks based on new XP
      await recalculateLeaderboardRanks(tx)

      return {
        success: true,
        coinsGained: totalCoinsGained,
        xpGained: totalXPGained,
        streak: newStreak,
        dayClaimed: newRewardDay,
        leveledUp,
        newLevel: finalLevel,
        unlockedAchievements: newlyUnlocked,
        streakProtected,
        comebackApplied
      }
    }, { maxWait: 15000, timeout: 30000 })

    return NextResponse.json(resultPayload, { status: 200 })

  } catch (err) {
    console.error('[POST /api/profile/daily-claim]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
