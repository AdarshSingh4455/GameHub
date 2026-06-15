import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 3600 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)

    // 1. Users Metrics
    const totalUsers = await prisma.profile.count()
    const activeUsers = await prisma.profile.count({
      where: {
        lastLoginDate: { not: null }
      }
    })
    const dau = await prisma.profile.count({
      where: {
        lastLoginDate: { gte: oneDayAgo }
      }
    })
    const wau = await prisma.profile.count({
      where: {
        lastLoginDate: { gte: sevenDaysAgo }
      }
    })
    const mau = await prisma.profile.count({
      where: {
        lastLoginDate: { gte: thirtyDaysAgo }
      }
    })

    // 2. Games Metrics
    const totalMatches = await prisma.matchRecord.count()
    const avgDurationRes = await prisma.matchRecord.aggregate({
      _avg: { durationSecs: true }
    })
    const avgSessionDuration = Math.round(avgDurationRes._avg.durationSecs || 45)

    // Most/least played games
    const gameStats = await prisma.profileGameStats.groupBy({
      by: ['gameSlug'],
      _sum: { playCount: true },
      orderBy: { _sum: { playCount: 'desc' } }
    })

    let mostPlayed = 'None'
    let leastPlayed = 'None'

    if (gameStats.length > 0) {
      const mostSlug = gameStats[0].gameSlug
      const leastSlug = gameStats[gameStats.length - 1].gameSlug

      const mostGameObj = await prisma.game.findUnique({ where: { slug: mostSlug }, select: { name: true } })
      const leastGameObj = await prisma.game.findUnique({ where: { slug: leastSlug }, select: { name: true } })

      mostPlayed = mostGameObj?.name || mostSlug
      leastPlayed = leastGameObj?.name || leastSlug
    }

    // 3. Retention & Streaks
    const dailyClaimsCount = await prisma.dailyRewardLog.count()
    const streakAggregate = await prisma.profile.aggregate({
      _avg: { currentStreak: true },
      _max: { longestStreak: true }
    })
    const avgStreak = Math.round((streakAggregate._avg.currentStreak || 0) * 10) / 10
    const maxStreak = streakAggregate._max.longestStreak || 0

    // 4. Economy Metrics
    // Coins earned
    const dailyRewardCoinsRes = await prisma.dailyRewardLog.aggregate({
      _sum: { coinsGiven: true }
    })
    const dailyRewardCoins = dailyRewardCoinsRes._sum.coinsGiven || 0

    const userAchievements = await prisma.userAchievement.findMany({
      include: { achievement: true }
    })
    const achievementCoins = userAchievements.reduce((sum, ua) => sum + (ua.achievement.coinReward || 0), 0)

    // Estimate game win/loss coins: win = 20 coins, loss = 5 coins
    const allMatches = await prisma.matchRecord.findMany({
      select: { winnerId: true, player1Id: true, player2Id: true }
    })

    let estimatedGameCoins = 0
    allMatches.forEach((m) => {
      // 20 coins for winner, 5 coins for loser
      if (m.winnerId) {
        estimatedGameCoins += 20
        estimatedGameCoins += 5 // loser gets 5
      } else {
        // Draw: 10 coins each
        estimatedGameCoins += 20
      }
    })

    const coinsEarned = dailyRewardCoins + achievementCoins + estimatedGameCoins

    // Coins spent (Single source of truth: ProfileInventory item prices)
    const inventory = await prisma.profileInventory.findMany({
      include: { cosmeticItem: true }
    })
    const coinsSpent = inventory.reduce((sum, inv) => sum + (inv.cosmeticItem.priceCoins || 0), 0)

    // 5. Ads Metrics
    const adsAggregate = await prisma.ad.aggregate({
      _sum: { impressions: true, clicks: true }
    })
    const adImpressions = adsAggregate._sum.impressions || 0
    const adClicks = adsAggregate._sum.clicks || 0
    const ctr = adImpressions > 0 ? Math.round((adClicks / adImpressions) * 10000) / 100 : 0

    return NextResponse.json({
      users: {
        totalUsers,
        activeUsers,
        dau,
        wau,
        mau,
      },
      games: {
        totalMatches,
        avgSessionDuration,
        mostPlayed,
        leastPlayed,
      },
      retention: {
        dailyClaimsCount,
        avgStreak,
        maxStreak,
      },
      economy: {
        coinsEarned,
        coinsSpent,
      },
      ads: {
        impressions: adImpressions,
        clicks: adClicks,
        ctr,
      }
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/admin/analytics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
