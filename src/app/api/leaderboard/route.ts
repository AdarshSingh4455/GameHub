import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || 'all-time'
    const game = searchParams.get('game') || 'all'
    const showFriends = searchParams.get('friends') === 'true'

    let targetProfileIds: string[] = []

    if (showFriends) {
      const currentUser = await getAuthenticatedProfile(request)
      if (!currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (!currentUser) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      // Fetch accepted friendships
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: currentUser.id, status: 'ACCEPTED' },
            { addresseeId: currentUser.id, status: 'ACCEPTED' }
          ]
        },
        select: {
          requesterId: true,
          addresseeId: true
        }
      })

      const friendIds = friendships.map(f => f.requesterId === currentUser.id ? f.addresseeId : f.requesterId)
      targetProfileIds = [...friendIds, currentUser.id]
    }

    // If game-specific filter is selected
    if (game !== 'all') {
      let gameSlug = game
      let modeFilter: string | null = null

      if (game === 'block-blast-classic') {
        gameSlug = 'block-blast'
        modeFilter = 'classic'
      } else if (game === 'block-blast-daily') {
        gameSlug = 'block-blast'
        modeFilter = 'daily'
      } else if (game === 'neon-tetris-classic') {
        gameSlug = 'neon-tetris'
        modeFilter = 'classic'
      } else if (game === 'neon-tetris-daily') {
        gameSlug = 'neon-tetris'
        modeFilter = 'daily'
      } else if (game === 'word-wizard-classic') {
        gameSlug = 'word-wizard'
        modeFilter = 'classic'
      } else if (game === 'word-wizard-daily') {
        gameSlug = 'word-wizard'
        modeFilter = 'daily'
      }

      if (modeFilter !== null) {
        const scores = await prisma.score.findMany({
          where: {
            game: { slug: gameSlug },
            metadata: {
              path: ['mode'],
              equals: modeFilter
            },
            profileId: showFriends ? { in: targetProfileIds } : undefined
          },
          orderBy: { score: 'desc' },
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                level: true,
                selectedTitle: true,
                currentRank: true,
                previousRank: true,
                _count: {
                  select: { wonMatches: true }
                }
              }
            }
          }
        })

        const uniqueScoresMap = new Map<string, typeof scores[0]>()
        for (const s of scores) {
          if (!uniqueScoresMap.has(s.profileId)) {
            uniqueScoresMap.set(s.profileId, s)
          }
          if (uniqueScoresMap.size >= 10) break
        }

        const rows = Array.from(uniqueScoresMap.values()).map((s, idx) => {
          const p = s.profile
          let movement = 'none'
          if (p.currentRank !== null && p.previousRank !== null) {
            if (p.currentRank < p.previousRank) movement = 'up'
            else if (p.currentRank > p.previousRank) movement = 'down'
            else movement = 'same'
          }
          return {
            rank: idx + 1,
            profileId: p.id,
            username: p.username,
            level: p.level,
            score: s.score,
            wins: p._count.wonMatches,
            title: p.selectedTitle,
            movement,
            currentRank: p.currentRank,
            previousRank: p.previousRank
          }
        })

        return NextResponse.json({ rows }, { status: 200 })
      }

      const stats = await prisma.profileGameStats.findMany({
        where: {
          gameSlug,
          profileId: showFriends ? { in: targetProfileIds } : undefined
        },
        orderBy: { highScore: 'desc' },
        include: {
          profile: {
            select: {
              id: true,
              username: true,
              level: true,
              xp: true,
              selectedTitle: true,
              currentRank: true,
              previousRank: true,
              _count: {
                select: { wonMatches: true }
              }
            }
          }
        },
        take: 10
      })

      const rows = stats.map((s, idx) => {
        const p = s.profile
        let movement = 'none'
        if (p.currentRank !== null && p.previousRank !== null) {
          if (p.currentRank < p.previousRank) movement = 'up'
          else if (p.currentRank > p.previousRank) movement = 'down'
          else movement = 'same'
        }
        return {
          rank: idx + 1,
          profileId: p.id,
          username: p.username,
          level: p.level,
          score: s.highScore, // show high score instead of total XP
          wins: s.winCount, // show game-specific win count
          title: p.selectedTitle,
          movement,
          currentRank: p.currentRank,
          previousRank: p.previousRank
        }
      })

      return NextResponse.json({ rows }, { status: 200 })
    }

    // If global leaderboard with timeframes (Monthly / Weekly)
    if (timeframe === 'monthly' || timeframe === 'weekly') {
      const days = timeframe === 'monthly' ? 30 : 7
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const xpSums = await prisma.xPEvent.groupBy({
        by: ['profileId'],
        where: {
          createdAt: {
            gte: startDate
          },
          profileId: showFriends ? { in: targetProfileIds } : undefined
        },
        _sum: {
          amount: true
        },
        orderBy: {
          _sum: {
            amount: 'desc'
          }
        },
        take: 10
      })

      // Fetch profile details for these IDs
      const profileIds = xpSums.map(x => x.profileId)
      const profiles = await prisma.profile.findMany({
        where: {
          id: { in: profileIds }
        },
        select: {
          id: true,
          username: true,
          level: true,
          currentRank: true,
          previousRank: true,
          selectedTitle: true,
          _count: {
            select: { wonMatches: true }
          }
        }
      })

      // Map back in order of sorted sums
      const rows = xpSums.map((x, idx) => {
        const p = profiles.find(prof => prof.id === x.profileId)
        let movement = 'none'
        if (p && p.currentRank !== null && p.previousRank !== null) {
          if (p.currentRank < p.previousRank) movement = 'up'
          else if (p.currentRank > p.previousRank) movement = 'down'
          else movement = 'same'
        }
        return {
          rank: idx + 1,
          profileId: p?.id || x.profileId,
          username: p?.username || 'Unknown',
          level: p?.level || 1,
          xp: x._sum.amount || 0, // show XP gained in this period
          wins: p?._count.wonMatches || 0,
          title: p?.selectedTitle || null,
          movement,
          currentRank: p?.currentRank || null,
          previousRank: p?.previousRank || null
        }
      })

      return NextResponse.json({ rows }, { status: 200 })
    }

    // Default: All Time
    const profiles = await prisma.profile.findMany({
      where: showFriends ? { id: { in: targetProfileIds } } : undefined,
      take: 10,
      orderBy: {
        xp: 'desc'
      },
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        currentRank: true,
        previousRank: true,
        selectedTitle: true,
        _count: {
          select: { wonMatches: true }
        }
      }
    })

    const rows = profiles.map((p, idx) => {
      let movement = 'none'
      if (p.currentRank !== null && p.previousRank !== null) {
        if (p.currentRank < p.previousRank) movement = 'up'
        else if (p.currentRank > p.previousRank) movement = 'down'
        else movement = 'same'
      }
      return {
        rank: idx + 1,
        profileId: p.id,
        username: p.username,
        level: p.level,
        xp: p.xp,
        wins: p._count.wonMatches,
        title: p.selectedTitle,
        movement,
        currentRank: p.currentRank,
        previousRank: p.previousRank
      }
    })

    return NextResponse.json({ rows }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/leaderboard]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
