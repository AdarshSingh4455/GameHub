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

    const colorSortedMatches = await prisma.rankedMatch.findMany({
      where: { profileId: profile.id },
      orderBy: { playedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      mmr: profile.rankedMmr ?? 1000,
      wins: profile.rankedWins ?? 0,
      losses: profile.rankedLosses ?? 0,
      streak: profile.rankedStreak ?? 0,
      peakRank: profile.rankedPeakRank ?? 'Bronze',
      placementMatchesRemaining: profile.placementMatchesRemaining ?? 5,
      rankedProtectionMatches: profile.rankedProtectionMatches ?? 0,
      recentMatches: colorSortedMatches,
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
    const gameSlug = body.gameSlug || 'snake-arena'

    if (!['win', 'loss', 'draw'].includes(result)) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    }

    const oldMmr = profile.rankedMmr
    const oldPlacements = profile.placementMatchesRemaining ?? 5
    const oldProtection = profile.rankedProtectionMatches ?? 0

    const oldDetails = getRankDetails(oldMmr, oldPlacements)

    // 1. Calculate MMR change
    let mmrChange = 0
    let newStreak = profile.rankedStreak

    if (result === 'win') {
      mmrChange = 30
      newStreak = Math.max(1, newStreak + 1)
      // Streak bonus: 3 wins -> +5, 5 wins -> +10, 8+ wins -> +15
      if (newStreak >= 8) {
        mmrChange += 15
      } else if (newStreak >= 5) {
        mmrChange += 10
      } else if (newStreak >= 3) {
        mmrChange += 5
      }
    } else if (result === 'loss') {
      mmrChange = -10
      newStreak = Math.min(-1, newStreak - 1)
    } else {
      mmrChange = 10
      newStreak = 0
    }

    let newMmr = Math.max(0, oldMmr + mmrChange)

    // 2. Placements Logic
    let newPlacements = oldPlacements
    let revealRank = false
    if (oldPlacements > 0) {
      newPlacements = oldPlacements - 1
      if (newPlacements === 0) {
        revealRank = true
      }
    }

    let newDetails = getRankDetails(newMmr, newPlacements)

    // 3. Rank Protection Logic (Only active when NOT in placements)
    const rankPriority: Record<string, number> = {
      'Bronze': 1, 'Silver': 2, 'Gold': 3, 'Platinum': 4, 'Diamond': 5, 'Master': 6, 'Grandmaster': 7
    }
    const oldPriority = rankPriority[oldDetails.rank] || 1
    let newPriority = rankPriority[newDetails.rank] || 1
    
    let newProtection = oldProtection
    let rankProtected = false
    let isPromotion = false
    let isDemotion = false

    if (oldPlacements === 0 && newPlacements === 0) {
      // Promotion Check
      if (newPriority > oldPriority) {
        newProtection = 3 // Grant 3 protected matches on promotion to new major tier
        isPromotion = true
      }
      
      // Demotion Check
      if (newPriority < oldPriority) {
        if (oldProtection > 0) {
          // Clamp MMR to the minimum boundary of the old major tier (prevent demotion)
          newMmr = oldDetails.minMmr
          newDetails = getRankDetails(newMmr, 0)
          newPriority = oldPriority
          newProtection = oldProtection - 1
          rankProtected = true
        } else {
          isDemotion = true
        }
      }
    }

    // Determine wins/losses updates
    const winsDelta = result === 'win' ? 1 : 0
    const lossesDelta = result === 'loss' ? 1 : 0

    // Compare ranks to check peak rank update
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
          placementMatchesRemaining: newPlacements,
          rankedProtectionMatches: newProtection,
        }
      })

      await tx.rankedMatch.create({
        data: {
          profileId: profile.id,
          opponentName,
          result,
          mmrChange,
          gameSlug,
        }
      })
    })

    return NextResponse.json({
      oldMmr,
      newMmr,
      mmrChange,
      oldRank: oldDetails.label,
      newRank: newDetails.label,
      promoted: isPromotion,
      demoted: isDemotion,
      rankProtected,
      revealRank,
      streak: newStreak,
      wins: profile.rankedWins + winsDelta,
      losses: profile.rankedLosses + lossesDelta,
      placementMatchesRemaining: newPlacements,
      rankedProtectionMatches: newProtection,
    }, { status: 200 })
  } catch (err: any) {
    console.error('[POST /api/ranked/stats]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
