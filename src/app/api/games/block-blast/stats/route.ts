import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: NextRequest) {
  try {
    if (process.env.MOCK_AUTH === 'true') {
      return NextResponse.json({
        stats: {
          classic: {
            easy: { highScore: 1200, bestCombo: 3, linesCleared: 25 },
            normal: { highScore: 2400, bestCombo: 5, linesCleared: 54 },
            hard: { highScore: 1800, bestCombo: 4, linesCleared: 30 },
          },
          daily: { highScore: 3200, bestCombo: 6, linesCleared: 45 },
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

    // Query scores for block-blast
    const scores = await prisma.score.findMany({
      where: {
        profileId: profile.id,
        game: {
          slug: 'block-blast'
        }
      }
    })

    const stats = {
      classic: {
        easy: { highScore: 0, bestCombo: 0, linesCleared: 0 },
        normal: { highScore: 0, bestCombo: 0, linesCleared: 0 },
        hard: { highScore: 0, bestCombo: 0, linesCleared: 0 },
      },
      daily: { highScore: 0, bestCombo: 0, linesCleared: 0 }
    }

    for (const s of scores) {
      const meta = s.metadata as any
      const scoreVal = s.score
      const combo = meta?.maxCombo ?? 0
      const lines = meta?.linesCleared ?? 0
      const mode = meta?.mode ?? 'classic'

      if (mode === 'daily') {
        stats.daily.highScore = Math.max(stats.daily.highScore, scoreVal)
        stats.daily.bestCombo = Math.max(stats.daily.bestCombo, combo)
        stats.daily.linesCleared += lines
      } else {
        const diff = (meta?.difficulty ?? 'normal').toLowerCase()
        if (diff === 'easy') {
          stats.classic.easy.highScore = Math.max(stats.classic.easy.highScore, scoreVal)
          stats.classic.easy.bestCombo = Math.max(stats.classic.easy.bestCombo, combo)
          stats.classic.easy.linesCleared += lines
        } else if (diff === 'hard') {
          stats.classic.hard.highScore = Math.max(stats.classic.hard.highScore, scoreVal)
          stats.classic.hard.bestCombo = Math.max(stats.classic.hard.bestCombo, combo)
          stats.classic.hard.linesCleared += lines
        } else {
          stats.classic.normal.highScore = Math.max(stats.classic.normal.highScore, scoreVal)
          stats.classic.normal.bestCombo = Math.max(stats.classic.normal.bestCombo, combo)
          stats.classic.normal.linesCleared += lines
        }
      }
    }

    return NextResponse.json({ stats }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/games/block-blast/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
