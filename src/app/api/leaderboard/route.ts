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
      if (game === 'tournaments') {
        const tournamentWins = await prisma.xPEvent.groupBy({
          by: ['profileId'],
          where: {
            type: 'TOURNAMENT',
            profileId: showFriends ? { in: targetProfileIds } : undefined
          },
          _count: {
            id: true
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          },
          take: 10
        })

        const profileIds = tournamentWins.map(x => x.profileId)
        const profiles = await prisma.profile.findMany({
          where: { id: { in: profileIds } },
          select: {
            id: true,
            username: true,
            displayName: true,
            level: true,
            selectedTitle: true,
            currentRank: true,
            previousRank: true,
            avatarUrl: true,
            selectedFrame: true,
            _count: { select: { wonMatches: true } }
          }
        })

        const rows = tournamentWins.map((x, idx) => {
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
            displayName: p?.displayName || null,
            level: p?.level || 1,
            score: x._count.id,
            wins: p?._count.wonMatches || 0,
            title: p?.selectedTitle || null,
            avatarUrl: p?.avatarUrl || null,
            selectedFrame: p?.selectedFrame || null,
            movement,
            currentRank: p?.currentRank || null,
            previousRank: p?.previousRank || null
          }
        })

        return NextResponse.json({ rows }, { status: 200 })
      }

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
                displayName: true,
                level: true,
                selectedTitle: true,
                currentRank: true,
                previousRank: true,
                avatarUrl: true,
                selectedFrame: true,
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
            displayName: p.displayName || null,
            level: p.level,
            score: s.score,
            wins: p._count.wonMatches,
            title: p.selectedTitle,
            avatarUrl: p.avatarUrl || null,
            selectedFrame: p.selectedFrame || null,
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
              displayName: true,
              level: true,
              xp: true,
              selectedTitle: true,
              currentRank: true,
              previousRank: true,
              avatarUrl: true,
              selectedFrame: true,
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
          displayName: p.displayName || null,
          level: p.level,
          score: s.highScore, // show high score instead of total XP
          wins: s.winCount, // show game-specific win count
          title: p.selectedTitle,
          avatarUrl: p.avatarUrl || null,
          selectedFrame: p.selectedFrame || null,
          movement,
          currentRank: p.currentRank,
          previousRank: p.previousRank
        }
      })

      return NextResponse.json({ rows }, { status: 200 })
    }

    // If global leaderboard with timeframes (Monthly / Weekly)
    if (timeframe === 'monthly' || timeframe === 'weekly') {
      let startDate: Date

      if (timeframe === 'weekly') {
        // Use canonical week start from WeeklyLeaderboardState
        // This ensures "this week's" scores are consistent with the reward system
        try {
          const { getOrCreateWeeklyState, checkAndProcessWeeklyReset } = await import('@/lib/weeklyLeaderboardEngine')
          // Lazy check for overdue reset (non-blocking)
          checkAndProcessWeeklyReset().catch(() => null)
          const state = await getOrCreateWeeklyState()
          startDate = new Date(state.startDate)
        } catch {
          // Fallback to 7-day rolling window
          startDate = new Date()
          startDate.setDate(startDate.getDate() - 7)
        }
      } else {
        // Monthly: rolling 30 days
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)
      }

      const xpSums = await prisma.xPEvent.groupBy({
        by: ['profileId'],
        where: {
          createdAt: { gte: startDate },
          profileId: showFriends ? { in: targetProfileIds } : undefined
        },
        _sum:   { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10
      })

      // Fetch profile details for these IDs
      const profileIds = xpSums.map(x => x.profileId)
      const profiles = await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: {
          id: true, username: true, displayName: true, level: true,
          currentRank: true, previousRank: true, selectedTitle: true,
          avatarUrl: true, selectedFrame: true,
          _count: { select: { wonMatches: true } }
        }
      })

      // For weekly: tie-break by games played and first-score timestamp
      let entries: any[] = xpSums.map(x => {
        const p = profiles.find(prof => prof.id === x.profileId)
        let movement = 'none'
        if (p?.currentRank !== null && p?.previousRank !== null) {
          if ((p?.currentRank ?? 0) < (p?.previousRank ?? 0)) movement = 'up'
          else if ((p?.currentRank ?? 0) > (p?.previousRank ?? 0)) movement = 'down'
          else movement = 'same'
        }
        return {
          profileId:   p?.id || x.profileId,
          username:    p?.username || 'Unknown',
          displayName: p?.displayName || null,
          level:       p?.level || 1,
          xp:          x._sum.amount ?? 0,
          totalGames:  (x._count as any).id ?? 0,
          wins:        p?._count?.wonMatches || 0,
          title:       p?.selectedTitle || null,
          avatarUrl:   p?.avatarUrl || null,
          selectedFrame: p?.selectedFrame || null,
          movement,
          currentRank:  p?.currentRank || null,
          previousRank: p?.previousRank || null
        }
      })

      // Apply tie-break sort for weekly (score desc, fewer games, alphabetical)
      if (timeframe === 'weekly') {
        entries.sort((a, b) => {
          if (b.xp !== a.xp) return b.xp - a.xp
          if (a.totalGames !== b.totalGames) return a.totalGames - b.totalGames
          return a.username.localeCompare(b.username)
        })
      }

      const rows = entries.map((e, idx) => ({ ...e, rank: idx + 1, score: e.xp }))

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
        displayName: true,
        level: true,
        xp: true,
        currentRank: true,
        previousRank: true,
        selectedTitle: true,
        avatarUrl: true,
        selectedFrame: true,
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
        displayName: p.displayName,
        level: p.level,
        xp: p.xp,
        wins: p.wins || p._count.wonMatches,
        title: p.selectedTitle,
        avatarUrl: p.avatarUrl || null,
        selectedFrame: p.selectedFrame || null,
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
