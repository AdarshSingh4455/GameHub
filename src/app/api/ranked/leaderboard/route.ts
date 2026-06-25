import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRankDetails } from '@/lib/rankedUtils'

export async function GET(request: NextRequest) {
  try {
    const profiles = await prisma.profile.findMany({
      orderBy: { rankedMmr: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        level: true,
        rankedMmr: true,
        rankedWins: true,
        rankedLosses: true,
        rankedStreak: true,
        rankedPeakRank: true,
        avatarUrl: true,
        selectedFrame: true,
        selectedTitle: true,
      },
      take: 50,
    })

    const rows = profiles.map((p, idx) => {
      const details = getRankDetails(p.rankedMmr)
      const totalMatches = p.rankedWins + p.rankedLosses
      const winRate = totalMatches > 0 ? Math.round((p.rankedWins / totalMatches) * 100) : 0

      return {
        rank: idx + 1,
        profileId: p.id,
        username: p.username,
        displayName: p.displayName,
        level: p.level,
        mmr: p.rankedMmr,
        wins: p.rankedWins,
        losses: p.rankedLosses,
        winRate,
        rankLabel: details.label,
        peakRank: p.rankedPeakRank,
        streak: p.rankedStreak,
        avatarUrl: p.avatarUrl || null,
        selectedFrame: p.selectedFrame || null,
        selectedTitle: p.selectedTitle || null,
      }
    })

    return NextResponse.json({ rows }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/ranked/leaderboard]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
