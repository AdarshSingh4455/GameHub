import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRankDetails } from '@/lib/rankedUtils'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { checkAndProcessRankedSeasonReset, rotateRankedSeason } from '@/lib/rankedSeasonEngine'

export async function GET(request: NextRequest) {
  try {
    // 1. Automatic lazy evaluation check for season reset
    await checkAndProcessRankedSeasonReset()

    // 2. Fetch active season
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

    // 3. Fetch past seasons and snapshots
    const allSeasons = await prisma.rankedSeason.findMany({
      include: { snapshots: true }
    })

    // Prepare Hall of Fame
    let hallOfFame = allSeasons.filter(s => !s.isActive).map(s => {
      const sortedSnaps = [...s.snapshots].sort((a, b) => b.mmr - a.mmr)
      return {
        seasonId: s.id,
        seasonName: s.name,
        endDate: s.endDate,
        winner: sortedSnaps[0] || null,
        topPlayers: sortedSnaps.slice(0, 10),
      }
    })

    if (hallOfFame.length === 0) {
      // Mock history for visual richness
      hallOfFame = [
        {
          seasonId: 'season-beta',
          seasonName: 'Season 0: Beta Launch',
          endDate: new Date('2026-05-31T23:59:59Z'),
          winner: { username: 'NovaKnight', mmr: 3620, rank: 'Grandmaster', wins: 142, losses: 58, winRate: 71, peakTier: 'Grandmaster', rewards: { title: 'Season 0 Champion' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
          topPlayers: [
            { username: 'NovaKnight', mmr: 3620, rank: 'Grandmaster', wins: 142, losses: 58, winRate: 71, peakTier: 'Grandmaster', rewards: { title: 'Season 0 Champion' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'BlitzMaster', mmr: 3410, rank: 'Master', wins: 125, losses: 70, winRate: 64, peakTier: 'Master', rewards: { title: 'Season 0 Elite' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'PixelLord', mmr: 3180, rank: 'Master', wins: 110, losses: 65, winRate: 63, peakTier: 'Master', rewards: { title: 'Season 0 Elite' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'GamerX', mmr: 2950, rank: 'Diamond I', wins: 95, losses: 60, winRate: 61, peakTier: 'Diamond I', rewards: { title: 'Season 0 Challenger' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'ApexPlayer', mmr: 2840, rank: 'Diamond II', wins: 88, losses: 56, winRate: 61, peakTier: 'Diamond II', rewards: { title: 'Season 0 Challenger' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'ShadowWalker', mmr: 2710, rank: 'Diamond III', wins: 80, losses: 52, winRate: 60, peakTier: 'Diamond III', rewards: { title: 'Season 0 Contender' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'CodeNinja', mmr: 2560, rank: 'Platinum I', wins: 75, losses: 48, winRate: 60, peakTier: 'Platinum I', rewards: { title: 'Season 0 Contender' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'Nebula', mmr: 2420, rank: 'Platinum II', wins: 70, losses: 45, winRate: 60, peakTier: 'Platinum II', rewards: { title: 'Season 0 Contender' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'Vortex', mmr: 2280, rank: 'Platinum III', wins: 65, losses: 42, winRate: 60, peakTier: 'Platinum III', rewards: { title: 'Season 0 Contender' }, seasonNumber: 0, completionDate: new Date('2026-05-31') },
            { username: 'AlphaGamer', mmr: 2150, rank: 'Gold I', wins: 60, losses: 40, winRate: 60, peakTier: 'Gold I', rewards: { title: 'Season 0 Contender' }, seasonNumber: 0, completionDate: new Date('2026-05-31') }
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
    // 1. Authorize - only allow ADMIN or SUPER_ADMIN role
    const profile = await getAuthenticatedProfile(request)
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Admin role required.' }, { status: 403 })
    }

    // 2. Trigger the isolated seasonal rotation logic
    const result = await rotateRankedSeason()
    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    console.error('[POST /api/ranked/seasons]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
