import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getAchievementProgress } from '@/lib/achievements'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        profile: {
          id: 'mock-profile-id',
          userId: 'mock-user-id',
          username: 'Adarsh',
          role: 'SUPER_ADMIN',
          xp: 1500,
          level: 5,
          coins: 350,
          currentStreak: 4,
          longestStreak: 12,
          dailyRewardDay: 3,
          lastDailyRewardClaim: new Date(Date.now() - 3600000 * 24).toISOString(), // 24h ago
          migratedFromGuest: false,
        },
        matches: [
          {
            id: 'match-1',
            gameSlug: 'tic-tac-toe',
            result: 'win',
            playedAt: new Date(Date.now() - 3600000).toISOString(),
            game: { name: 'Tic-Tac-Toe', slug: 'tic-tac-toe' },
            player1: { username: 'Adarsh' },
            player2: { username: 'AI' },
          }
        ],
        achievementProgress: [
          {
            id: 'ach-1',
            name: 'First Move',
            description: 'Play your first game.',
            xpReward: 50,
            coinReward: 10,
            isUnlocked: true,
            current: 1,
            target: 1,
            progressPercentage: 100,
          },
          {
            id: 'ach-2',
            name: 'Winner Winner',
            description: 'Win your first match.',
            xpReward: 100,
            coinReward: 25,
            isUnlocked: false,
            current: 0,
            target: 1,
            progressPercentage: 0,
          }
        ],
      }, { status: 200 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: {
        achievements: {
          include: {
            achievement: true,
          },
          orderBy: { unlockedAt: 'desc' },
        },
        gameStats: {
          orderBy: { playCount: 'desc' },
          take: 3,
        },
        inventory: {
          include: {
            cosmeticItem: true,
          },
        },
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Fetch last 10 matches
    const matches = await prisma.matchRecord.findMany({
      where: {
        OR: [
          { player1Id: profile.id },
          { player2Id: profile.id },
        ],
      },
      orderBy: { playedAt: 'desc' },
      take: 10,
      include: {
        game: {
          select: {
            name: true,
            slug: true,
          },
        },
        player1: {
          select: {
            username: true,
          },
        },
        player2: {
          select: {
            username: true,
          },
        },
      },
    })

    // Fetch achievement progress
    const achievementProgress = await getAchievementProgress(profile.id)

    // Fetch last 7 days matches for activity tracking
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0,0,0,0)

    const activity = await prisma.matchRecord.findMany({
      where: {
        OR: [
          { player1Id: profile.id },
          { player2Id: profile.id }
        ],
        playedAt: { gte: sevenDaysAgo }
      },
      select: { playedAt: true }
    })

    // Analytics event hook for profile viewed
    await prisma.analyticsEvent.create({
      data: {
        profileId: profile.id,
        eventName: 'profile_viewed',
      },
    })

    return NextResponse.json({
      profile,
      matches,
      achievementProgress,
      activity,
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/profile/details]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
