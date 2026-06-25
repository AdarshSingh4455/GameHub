import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let currentAuthUser: { id: string } | null = null

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
      const mockUserId = cookies['mock_user_id'] || 'mock-user-id'
      currentAuthUser = { id: mockUserId }
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      currentAuthUser = user
    }

    // 1. Fetch profile
    const profile = await prisma.profile.findUnique({
      where: { id }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Compute rank
    const rank = await prisma.profile.count({
      where: {
        xp: { gt: profile.xp }
      }
    }) + 1

    // 3. Compute match stats
    const totalMatches = await prisma.matchRecord.count({
      where: {
        OR: [
          { player1Id: profile.id },
          { player2Id: profile.id }
        ]
      }
    })

    const wins = await prisma.matchRecord.count({
      where: { winnerId: profile.id }
    })

    const draws = await prisma.matchRecord.count({
      where: {
        winnerId: null,
        player2Id: { not: null },
        OR: [
          { player1Id: profile.id },
          { player2Id: profile.id }
        ]
      }
    })

    const losses = totalMatches - wins - draws
    const winPercent = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

    // 4. Favorite Game
    const favoriteStat = await prisma.profileGameStats.findFirst({
      where: { profileId: profile.id },
      orderBy: { playCount: 'desc' }
    })

    let favoriteGame = 'None'
    if (favoriteStat) {
      const game = await prisma.game.findUnique({
        where: { slug: favoriteStat.gameSlug },
        select: { name: true }
      })
      favoriteGame = game?.name || favoriteStat.gameSlug
    }

    // 5. Badges (UserAchievements)
    const unlockedBadges = await prisma.userAchievement.findMany({
      where: { profileId: profile.id },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' }
    })

    const badges = unlockedBadges.map(ua => ({
      slug: ua.achievement.slug,
      name: ua.achievement.name,
      description: ua.achievement.description,
      unlockedAt: ua.unlockedAt.toISOString()
    }))

    // 6. Recent Activity
    const xpEvents = await prisma.xPEvent.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const activity = [
      ...xpEvents.map(x => ({
        type: 'xp',
        date: x.createdAt.toISOString(),
        text: x.type === 'MATCH_WIN' ? `Won a match of ${x.meta && typeof x.meta === 'object' && x.meta !== null && 'gameSlug' in x.meta ? String((x.meta as Record<string, unknown>).gameSlug) : 'a game'}` :
              x.type === 'MATCH_LOSS' ? `Played a match of ${x.meta && typeof x.meta === 'object' && x.meta !== null && 'gameSlug' in x.meta ? String((x.meta as Record<string, unknown>).gameSlug) : 'a game'}` :
              x.type === 'DAILY_LOGIN' ? 'Claimed Daily Login Reward' : 'Earned bonus XP',
        amount: x.amount
      })),
      ...unlockedBadges.map(ua => ({
        type: 'achievement',
        date: ua.unlockedAt.toISOString(),
        text: `Unlocked achievement: ${ua.achievement.name}`,
        amount: ua.achievement.xpReward
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

    // 7. Friendship Status
    let friendshipStatus: 'none' | 'friends' | 'sent-pending' | 'received-pending' | 'self' = 'none'

    if (currentAuthUser) {
      const viewerProfile = await prisma.profile.findUnique({
        where: { userId: currentAuthUser.id }
      })

      if (viewerProfile) {
        if (viewerProfile.id === profile.id) {
          friendshipStatus = 'self'
        } else {
          const friendship = await prisma.friendship.findFirst({
            where: {
              OR: [
                { requesterId: viewerProfile.id, addresseeId: profile.id },
                { requesterId: profile.id, addresseeId: viewerProfile.id }
              ]
            }
          })

          if (friendship) {
            if (friendship.status === 'ACCEPTED') {
              friendshipStatus = 'friends'
            } else if (friendship.status === 'PENDING') {
              if (friendship.requesterId === viewerProfile.id) {
                friendshipStatus = 'sent-pending'
              } else {
                friendshipStatus = 'received-pending'
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        selectedTitle: profile.selectedTitle,
        selectedFrame: profile.selectedFrame,
        level: profile.level,
        xp: profile.xp,
        coins: profile.coins,
        currentStreak: profile.currentStreak,
        longestStreak: profile.longestStreak,
        createdAt: profile.createdAt.toISOString()
      },
      stats: {
        rank,
        totalMatches,
        wins,
        losses,
        draws,
        winPercent,
        favoriteGame
      },
      badges,
      activity,
      friendshipStatus
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/profile/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
