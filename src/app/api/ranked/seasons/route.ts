import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRankDetails } from '@/lib/rankedUtils'

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch active season
    let activeSeason = await prisma.rankedSeason.findFirst({
      where: { isActive: true }
    })

    if (!activeSeason) {
      // Seed default active season if missing
      activeSeason = await prisma.rankedSeason.create({
        data: {
          id: 'season-genesis',
          name: 'Season 1: Genesis',
          startDate: new Date('2026-06-01T00:00:00Z'),
          endDate: new Date('2026-08-31T23:59:59Z'),
          isActive: true,
          rewards: { first: 'Season 1 Champion Title', top10: 'Gold Rank Frame' }
        }
      })
    }

    // 2. Fetch past seasons and snapshots
    const allSeasons = await prisma.rankedSeason.findMany({
      include: { snapshots: true }
    })

    // Prepare mock Hall of Fame if no past seasons exist
    let hallOfFame = allSeasons.filter(s => !s.isActive).map(s => {
      const sortedSnaps = [...s.snapshots].sort((a, b) => b.mmr - a.mmr)
      return {
        seasonId: s.id,
        seasonName: s.name,
        endDate: s.endDate,
        winner: sortedSnaps[0] || null,
        topPlayers: sortedSnaps.slice(0, 5),
      }
    })

    if (hallOfFame.length === 0) {
      // Mock history for visual richness
      hallOfFame = [
        {
          seasonId: 'season-beta',
          seasonName: 'Season 0: Beta Launch',
          endDate: new Date('2026-05-31T23:59:59Z'),
          winner: { username: 'NovaKnight', mmr: 3620, rank: 'Grandmaster', wins: 142, losses: 58, winRate: 71 },
          topPlayers: [
            { username: 'NovaKnight', mmr: 3620, rank: 'Grandmaster', wins: 142, losses: 58, winRate: 71 },
            { username: 'BlitzMaster', mmr: 3410, rank: 'Master', wins: 125, losses: 70, winRate: 64 },
            { username: 'PixelLord', mmr: 3180, rank: 'Master', wins: 110, losses: 65, winRate: 63 },
            { username: 'GamerX', mmr: 2950, rank: 'Diamond I', wins: 95, losses: 60, winRate: 61 },
            { username: 'ApexPlayer', mmr: 2840, rank: 'Diamond II', wins: 88, losses: 56, winRate: 61 }
          ]
        }
      ] as any[]
    }

    return NextResponse.json({
      activeSeason,
      hallOfFame,
      allSeasons
    }, { status: 200 })
  } catch (err: any) {
    console.error('[GET /api/ranked/seasons]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Implement season reset trigger
    // 1. Fetch current active season
    const activeSeason = await prisma.rankedSeason.findFirst({
      where: { isActive: true }
    })

    if (!activeSeason) {
      return NextResponse.json({ error: 'No active season to reset' }, { status: 400 })
    }

    // 2. Fetch top players ordered by MMR
    const topProfiles = await prisma.profile.findMany({
      orderBy: { rankedMmr: 'desc' },
      take: 10
    })

    await prisma.$transaction(async (tx) => {
      // A. Create snapshots
      for (const p of topProfiles) {
        const details = getRankDetails(p.rankedMmr)
        const total = p.rankedWins + p.rankedLosses
        const winRate = total > 0 ? (p.rankedWins / total) : 0

        await tx.seasonSnapshot.create({
          data: {
            seasonId: activeSeason.id,
            profileId: p.id,
            username: p.username,
            mmr: p.rankedMmr,
            rank: details.label,
            wins: p.rankedWins,
            losses: p.rankedLosses,
            winRate: Math.round(winRate * 100),
          }
        })
      }

      // B. Mark current season inactive
      await tx.rankedSeason.update({
        where: { id: activeSeason.id },
        data: { isActive: false }
      })

      // C. Reset player ranks & MMR to 1000
      await tx.profile.updateMany({
        data: {
          rankedMmr: 1000,
          rankedWins: 0,
          rankedLosses: 0,
          rankedStreak: 0,
          rankedPeakRank: 'Bronze',
        }
      })

      // D. Create new active season (e.g. Season 2)
      const matches = activeSeason.name.match(/\d+/)
      const currentNumber = matches ? parseInt(matches[0]) : 1
      const nextNumber = currentNumber + 1

      await tx.rankedSeason.create({
        data: {
          name: `Season ${nextNumber}: Genesis`,
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
          isActive: true,
          rewards: { first: `Season ${nextNumber} Champion Title`, top10: 'Gold Rank Frame' }
        }
      })
    })

    return NextResponse.json({ message: 'Season reset successfully completed' }, { status: 200 })
  } catch (err: any) {
    console.error('[POST /api/ranked/seasons]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
