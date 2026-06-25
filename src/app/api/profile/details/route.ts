import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getAchievementProgress } from '@/lib/achievements'

import { checkAndUnlockProgressionItems } from '@/lib/cosmeticUnlocks'

export async function GET(request: Request) {
  try {
    let userId: string
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      const cookieHeader = request.headers.get('cookie') || ''
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const eqIdx = c.indexOf('=')
          if (eqIdx === -1) return [c.trim(), '']
          const name = c.substring(0, eqIdx).trim()
          const value = c.substring(eqIdx + 1).trim()
          return [name, decodeURIComponent(value)]
        })
      )
      userId = cookies['mock_user_id'] || 'mock-user-id'
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Fetch game stats to calculate total wins for progression check
    const gameStatsForCheck = await prisma.profileGameStats.findMany({
      where: { profileId: profile.id }
    })
    const totalWins = gameStatsForCheck.reduce((sum, s) => sum + (s.wins || 0), 0)

    // Check and unlock progression rewards automatically
    await checkAndUnlockProgressionItems(profile.id, profile.level, profile.currentStreak, totalWins)

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    sevenDaysAgo.setHours(0,0,0,0)

    const url = new URL(request.url)
    const fetchAchievements = url.searchParams.get('achievements') === 'true'
    const fetchActivity = url.searchParams.get('activity') === 'true'
    const fetchMatches = url.searchParams.get('matches') === 'true'

    const [matches, achievementProgress, activity, inventory, gameStats, userAchievements] = await Promise.all([
      // 1. Fetch last 10 matches
      fetchMatches
        ? prisma.matchRecord.findMany({
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
                  displayName: true,
                },
              },
              player2: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          })
        : Promise.resolve([]),

      // 2. Fetch achievement progress
      fetchAchievements ? getAchievementProgress(profile.id) : Promise.resolve([]),

      // 3. Fetch last 7 days matches for activity tracking
      fetchActivity
        ? prisma.matchRecord.findMany({
            where: {
              OR: [
                { player1Id: profile.id },
                { player2Id: profile.id }
              ],
              playedAt: { gte: sevenDaysAgo }
            },
            select: { playedAt: true }
          })
        : Promise.resolve([]),

      // 4. Fetch inventory manually to support mockPrisma
      prisma.profileInventory.findMany({
        where: { profileId: profile.id },
        include: { cosmeticItem: true }
      }),

      // 5. Fetch game stats manually to support mockPrisma
      prisma.profileGameStats.findMany({
        where: { profileId: profile.id },
        orderBy: { playCount: 'desc' }
      }),

      // 6. Fetch user achievements manually to support mockPrisma
      prisma.userAchievement.findMany({
        where: { profileId: profile.id },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' }
      }),

      // 7. Analytics event hook for profile viewed
      prisma.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'profile_viewed',
        },
      })
    ])

    const profileWithIncludes = {
      ...profile,
      inventory,
      gameStats,
      achievements: userAchievements
    }

    return NextResponse.json({
      profile: profileWithIncludes,
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
