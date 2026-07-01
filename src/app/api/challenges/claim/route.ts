import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xp'
import { recalculateLeaderboardRanks } from '@/lib/ranks'

export const dynamic = 'force-dynamic'

const CHALLENGES = [
  { id: 'daily_play_3', target: 3, xpReward: 100, coinReward: 20, metric: 'play_matches', type: 'DAILY' },
  { id: 'daily_win_1', target: 1, xpReward: 150, coinReward: 30, metric: 'win_matches', type: 'DAILY' },
  { id: 'daily_earn_200_xp', target: 200, xpReward: 100, coinReward: 20, metric: 'earn_xp', type: 'DAILY' },
  { id: 'daily_streak_3', target: 3, xpReward: 150, coinReward: 30, metric: 'login_streak', type: 'DAILY' },
  { id: 'weekly_play_10', target: 10, xpReward: 500, coinReward: 100, metric: 'play_matches', type: 'WEEKLY' },
  { id: 'weekly_win_5', target: 5, xpReward: 700, coinReward: 150, metric: 'win_matches', type: 'WEEKLY' },
  { id: 'weekly_earn_1000_xp', target: 1000, xpReward: 500, coinReward: 100, metric: 'earn_xp', type: 'WEEKLY' },
  { id: 'weekly_streak_7', target: 7, xpReward: 750, coinReward: 150, metric: 'login_streak', type: 'WEEKLY' }
]

export async function POST(request: Request) {
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

    const { challengeId } = await request.json()
    const challenge = CHALLENGES.find(c => c.id === challengeId)
    if (!challenge) {
      return NextResponse.json({ error: 'Invalid challenge ID' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if already claimed
    const existingClaim = await prisma.challengeClaim.findUnique({
      where: {
        profileId_challengeId: {
          profileId: profile.id,
          challengeId
        }
      }
    })

    if (existingClaim) {
      return NextResponse.json({ error: 'Challenge already claimed' }, { status: 400 })
    }

    // Verify progress to ensure they met the target
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    let progress = 0

    if (challenge.metric === 'play_matches') {
      progress = await prisma.matchRecord.count({
        where: {
          OR: [
            { player1Id: profile.id },
            { player2Id: profile.id }
          ],
          playedAt: { gte: challenge.type === 'DAILY' ? todayStart : weekStart }
        }
      })
    } else if (challenge.metric === 'win_matches') {
      progress = await prisma.matchRecord.count({
        where: {
          winnerId: profile.id,
          playedAt: { gte: challenge.type === 'DAILY' ? todayStart : weekStart }
        }
      })
    } else if (challenge.metric === 'earn_xp') {
      const xpEvents = await prisma.xPEvent.aggregate({
        where: {
          profileId: profile.id,
          createdAt: { gte: challenge.type === 'DAILY' ? todayStart : weekStart }
        },
        _sum: {
          amount: true
        }
      })
      progress = xpEvents._sum?.amount || 0
    } else if (challenge.metric === 'login_streak') {
      progress = profile.currentStreak
    }

    if (progress < challenge.target) {
      return NextResponse.json({ error: 'Challenge requirements not met' }, { status: 400 })
    }

    // Perform transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Create claim record
      await tx.challengeClaim.create({
        data: {
          profileId: profile.id,
          challengeId
        }
      })

      // 2. Increment profile coins and XP
      const updatedProfile = await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: challenge.xpReward },
          coins: { increment: challenge.coinReward }
        }
      })

      // 3. Record XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'MANUAL_GRANT',
          amount: challenge.xpReward,
          meta: { challengeId }
        }
      })

      // 4. Check level up
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

      // 5. Recalculate ranks
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
    console.error('[POST /api/challenges/claim]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
