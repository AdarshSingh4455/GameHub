import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CHALLENGES = [
  {
    id: 'daily_play_3',
    title: 'Play 3 Matches Today',
    description: 'Play 3 multiplayer or singleplayer matches today',
    type: 'DAILY',
    target: 3,
    xpReward: 100,
    coinReward: 20,
    metric: 'play_matches'
  },
  {
    id: 'daily_win_1',
    title: 'Win 1 Match Today',
    description: 'Win at least one match today',
    type: 'DAILY',
    target: 1,
    xpReward: 150,
    coinReward: 30,
    metric: 'win_matches'
  },
  {
    id: 'daily_earn_200_xp',
    title: 'Earn 200 XP Today',
    description: 'Earn 200 XP from any activities today',
    type: 'DAILY',
    target: 200,
    xpReward: 100,
    coinReward: 20,
    metric: 'earn_xp'
  },
  {
    id: 'daily_streak_3',
    title: 'Streak Starter',
    description: 'Maintain a login streak of 3 days or more',
    type: 'DAILY',
    target: 3,
    xpReward: 150,
    coinReward: 30,
    metric: 'login_streak'
  },
  {
    id: 'weekly_play_10',
    title: 'Weekly Gamer',
    description: 'Play 10 matches this week',
    type: 'WEEKLY',
    target: 10,
    xpReward: 500,
    coinReward: 100,
    metric: 'play_matches'
  },
  {
    id: 'weekly_win_5',
    title: 'Weekly Champion',
    description: 'Win 5 matches this week',
    type: 'WEEKLY',
    target: 5,
    xpReward: 700,
    coinReward: 150,
    metric: 'win_matches'
  },
  {
    id: 'weekly_earn_1000_xp',
    title: 'XP Grindhouse',
    description: 'Earn 1000 XP this week',
    type: 'WEEKLY',
    target: 1000,
    xpReward: 500,
    coinReward: 100,
    metric: 'earn_xp'
  },
  {
    id: 'weekly_streak_7',
    title: 'Streak Master',
    description: 'Maintain a login streak of 7 days or more',
    type: 'WEEKLY',
    target: 7,
    xpReward: 750,
    coinReward: 150,
    metric: 'login_streak'
  }
]

export async function GET(request: Request) {
  try {
    let userId: string
    if (process.env.MOCK_AUTH === 'true') {
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

    // Set time limits
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    // Execute DB checks in parallel
    const [
      matchesToday,
      matchesWonToday,
      xpEventsToday,
      matchesThisWeek,
      matchesWonThisWeek,
      xpEventsThisWeek,
      claims
    ] = await Promise.all([
      // 1. Matches played today
      prisma.matchRecord.count({
        where: {
          OR: [
            { player1Id: profile.id },
            { player2Id: profile.id }
          ],
          playedAt: { gte: todayStart }
        }
      }),
      // 2. Matches won today
      prisma.matchRecord.count({
        where: {
          winnerId: profile.id,
          playedAt: { gte: todayStart }
        }
      }),
      // 3. XP earned today
      prisma.xPEvent.aggregate({
        where: {
          profileId: profile.id,
          createdAt: { gte: todayStart }
        },
        _sum: {
          amount: true
        }
      }),
      // 4. Matches played this week
      prisma.matchRecord.count({
        where: {
          OR: [
            { player1Id: profile.id },
            { player2Id: profile.id }
          ],
          playedAt: { gte: weekStart }
        }
      }),
      // 5. Matches won this week
      prisma.matchRecord.count({
        where: {
          winnerId: profile.id,
          playedAt: { gte: weekStart }
        }
      }),
      // 6. XP earned this week
      prisma.xPEvent.aggregate({
        where: {
          profileId: profile.id,
          createdAt: { gte: weekStart }
        },
        _sum: {
          amount: true
        }
      }),
      // 7. Claims
      prisma.challengeClaim.findMany({
        where: { profileId: profile.id }
      })
    ])

    const xpToday = xpEventsToday._sum?.amount || 0
    const xpWeek = xpEventsThisWeek._sum?.amount || 0
    const claimedIds = new Set(claims.map((c: any) => c.challengeId))

    // Map challenges with current progress
    const enrichedChallenges = CHALLENGES.map(challenge => {
      let current = 0
      if (challenge.type === 'DAILY') {
        if (challenge.metric === 'play_matches') current = matchesToday
        else if (challenge.metric === 'win_matches') current = matchesWonToday
        else if (challenge.metric === 'earn_xp') current = xpToday
        else if (challenge.metric === 'login_streak') current = profile.currentStreak
      } else {
        if (challenge.metric === 'play_matches') current = matchesThisWeek
        else if (challenge.metric === 'win_matches') current = matchesWonThisWeek
        else if (challenge.metric === 'earn_xp') current = xpWeek
        else if (challenge.metric === 'login_streak') current = profile.currentStreak
      }

      const completed = current >= challenge.target
      const claimed = claimedIds.has(challenge.id)

      return {
        ...challenge,
        current,
        completed,
        claimed
      }
    })

    const history = claims.map((c: any) => {
      const challengeDef = CHALLENGES.find(ch => ch.id === c.challengeId)
      return {
        id: c.id,
        challengeId: c.challengeId,
        claimedAt: c.claimedAt,
        title: challengeDef ? challengeDef.title : c.challengeId.replace(/_/g, ' ').toUpperCase(),
        xpReward: challengeDef ? challengeDef.xpReward : 100,
        coinReward: challengeDef ? challengeDef.coinReward : 20,
      }
    })

    return NextResponse.json({ challenges: enrichedChallenges, history }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/challenges]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
