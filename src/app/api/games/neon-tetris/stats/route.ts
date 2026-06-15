import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        stats: {
          classic: { highScore: 4500, bestCombo: 6, highestLevel: 5, totalLines: 48, avgLines: 12, perfectClears: 1 },
          daily: { highScore: 6200, bestCombo: 8, highestLevel: 7, totalLines: 65, avgLines: 21, perfectClears: 2 },
        }
      }, { status: 200 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { id: true }
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Query scores for neon-tetris
    const scores = await prisma.score.findMany({
      where: {
        profileId: profile.id,
        game: {
          slug: 'neon-tetris'
        }
      }
    })

    // Query playCount to calculate averages
    const gameStats = await prisma.profileGameStats.findUnique({
      where: {
        profileId_gameSlug: {
          profileId: profile.id,
          gameSlug: 'neon-tetris'
        }
      },
      select: { playCount: true }
    })
    const _playCount = gameStats?.playCount ?? 0

    const stats = {
      classic: { highScore: 0, bestCombo: 0, highestLevel: 1, totalLines: 0, avgLines: 0, perfectClears: 0 },
      daily: { highScore: 0, bestCombo: 0, highestLevel: 1, totalLines: 0, avgLines: 0, perfectClears: 0 }
    }

    let classicPlayCount = 0
    let dailyPlayCount = 0

    for (const s of scores) {
      const meta = s.metadata as any
      const scoreVal = s.score
      const combo = meta?.maxCombo ?? 0
      const lines = meta?.linesCleared ?? 0
      const level = meta?.level ?? 1
      const pcs = meta?.perfectClears ?? 0
      const mode = meta?.mode ?? 'classic'

      if (mode === 'daily') {
        dailyPlayCount++
        stats.daily.highScore = Math.max(stats.daily.highScore, scoreVal)
        stats.daily.bestCombo = Math.max(stats.daily.bestCombo, combo)
        stats.daily.highestLevel = Math.max(stats.daily.highestLevel, level)
        stats.daily.totalLines += lines
        stats.daily.perfectClears += pcs
      } else {
        classicPlayCount++
        stats.classic.highScore = Math.max(stats.classic.highScore, scoreVal)
        stats.classic.bestCombo = Math.max(stats.classic.bestCombo, combo)
        stats.classic.highestLevel = Math.max(stats.classic.highestLevel, level)
        stats.classic.totalLines += lines
        stats.classic.perfectClears += pcs
      }
    }

    stats.classic.avgLines = classicPlayCount > 0 ? Math.round((stats.classic.totalLines / classicPlayCount) * 10) / 10 : 0
    stats.daily.avgLines = dailyPlayCount > 0 ? Math.round((stats.daily.totalLines / dailyPlayCount) * 10) / 10 : 0

    return NextResponse.json({ stats }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/games/neon-tetris/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
