// Word Wizard stats aggregation API endpoint

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        stats: {
          classic: {
            easy: { highScore: 800, bestCombo: 3, totalWordsFound: 15 },
            normal: { highScore: 1500, bestCombo: 5, totalWordsFound: 32 },
            hard: { highScore: 1200, bestCombo: 4, totalWordsFound: 24 },
          },
          daily: { highScore: 2200, bestCombo: 6, totalWordsFound: 40 },
          endless: { highScore: 3000, bestCombo: 8, totalWordsFound: 75 },
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

    // Query scores for word-wizard
    const scores = await prisma.score.findMany({
      where: {
        profileId: profile.id,
        game: {
          slug: 'word-wizard'
        }
      }
    })

    const stats = {
      classic: {
        easy: { highScore: 0, bestCombo: 0, totalWordsFound: 0 },
        normal: { highScore: 0, bestCombo: 0, totalWordsFound: 0 },
        hard: { highScore: 0, bestCombo: 0, totalWordsFound: 0 },
      },
      daily: { highScore: 0, bestCombo: 0, totalWordsFound: 0 },
      endless: { highScore: 0, bestCombo: 0, totalWordsFound: 0 },
    }

    for (const s of scores) {
      const meta = s.metadata as any
      const scoreVal = s.score
      const combo = meta?.maxCombo ?? 0
      const wordsFound = meta?.wordsFound ?? 0
      const mode = meta?.mode ?? 'classic'

      if (mode === 'daily') {
        stats.daily.highScore = Math.max(stats.daily.highScore, scoreVal)
        stats.daily.bestCombo = Math.max(stats.daily.bestCombo, combo)
        stats.daily.totalWordsFound += wordsFound
      } else if (mode === 'endless') {
        stats.endless.highScore = Math.max(stats.endless.highScore, scoreVal)
        stats.endless.bestCombo = Math.max(stats.endless.bestCombo, combo)
        stats.endless.totalWordsFound += wordsFound
      } else {
        const diff = (meta?.difficulty ?? 'normal').toLowerCase()
        if (diff === 'easy') {
          stats.classic.easy.highScore = Math.max(stats.classic.easy.highScore, scoreVal)
          stats.classic.easy.bestCombo = Math.max(stats.classic.easy.bestCombo, combo)
          stats.classic.easy.totalWordsFound += wordsFound
        } else if (diff === 'hard') {
          stats.classic.hard.highScore = Math.max(stats.classic.hard.highScore, scoreVal)
          stats.classic.hard.bestCombo = Math.max(stats.classic.hard.bestCombo, combo)
          stats.classic.hard.totalWordsFound += wordsFound
        } else {
          stats.classic.normal.highScore = Math.max(stats.classic.normal.highScore, scoreVal)
          stats.classic.normal.bestCombo = Math.max(stats.classic.normal.bestCombo, combo)
          stats.classic.normal.totalWordsFound += wordsFound
        }
      }
    }

    return NextResponse.json({ stats }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/games/word-wizard/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
