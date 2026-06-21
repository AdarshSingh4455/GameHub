import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { getRankDetails } from '@/lib/rankedUtils'

export async function GET(request: NextRequest) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rankedMatches = await prisma.rankedMatch.findMany({
      where: { profileId: profile.id },
      orderBy: { playedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      mmr: profile.rankedMmr,
      wins: profile.rankedWins,
      losses: profile.rankedLosses,
      streak: profile.rankedStreak,
      peakRank: profile.rankedPeakRank,
      recentMatches: rankedMatches,
    }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/ranked/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const result = body.result || 'win'
    const opponentName = body.opponentName || 'BlitzBot'

    if (!['win', 'loss', 'draw'].includes(result)) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    }

    const oldMmr = profile.rankedMmr
    const oldDetails = getRankDetails(oldMmr)

    // Calculate MMR change
    let mmrChange = 0
    let newStreak = profile.rankedStreak

    if (result === 'win') {
      mmrChange = 25
      newStreak = Math.max(1, newStreak + 1)
      // Streak bonus: +5 MMR per win in a streak of 3 or higher, max bonus +15
      if (newStreak >= 3) {
        const bonus = Math.min(15, (newStreak - 2) * 5)
        mmrChange += bonus
      }
    } else if (result === 'loss') {
      mmrChange = -18
      newStreak = Math.min(-1, newStreak - 1)
    } else {
      mmrChange = 0
      newStreak = 0
    }

    const newMmr = Math.max(0, oldMmr + mmrChange)
    const newDetails = getRankDetails(newMmr)

    // Determine wins/losses updates
    const winsDelta = result === 'win' ? 1 : 0
    const lossesDelta = result === 'loss' ? 1 : 0

    // Compare ranks to check peak rank update
    const rankPriority: Record<string, number> = {
      'Bronze': 1, 'Silver': 2, 'Gold': 3, 'Platinum': 4, 'Diamond': 5, 'Master': 6, 'Grandmaster': 7
    }
    const oldPriority = rankPriority[oldDetails.rank] || 1
    const newPriority = rankPriority[newDetails.rank] || 1
    let peakRank = profile.rankedPeakRank
    if (newPriority > (rankPriority[peakRank] || 1)) {
      peakRank = newDetails.rank
    }

    // Update Profile and Create RankedMatch in transaction
    await prisma.$transaction(async (tx) => {
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          rankedMmr: newMmr,
          rankedWins: profile.rankedWins + winsDelta,
          rankedLosses: profile.rankedLosses + lossesDelta,
          rankedStreak: newStreak,
          rankedPeakRank: peakRank,
        }
      })

      await tx.rankedMatch.create({
        data: {
          profileId: profile.id,
          opponentName,
          result,
          mmrChange,
        }
      })
    })

    return NextResponse.json({
      oldMmr,
      newMmr,
      mmrChange,
      oldRank: oldDetails.label,
      newRank: newDetails.label,
      promoted: newPriority > oldPriority,
      demoted: newPriority < oldPriority,
      streak: newStreak,
      wins: profile.rankedWins + winsDelta,
      losses: profile.rankedLosses + lossesDelta,
    }, { status: 200 })
  } catch (err: any) {
    console.error('[POST /api/ranked/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
