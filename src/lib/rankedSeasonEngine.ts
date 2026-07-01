import { prisma } from './prisma'
import { getRankDetails } from './rankedUtils'

// Get reward config based on rank
function getRewardsForRank(rankIndex: number, seasonNumber: number): any {
  if (rankIndex === 0) {
    return {
      title: `Season ${seasonNumber} Champion`,
      frame: `Season ${seasonNumber} Champion Frame`,
      badge: `Season ${seasonNumber} Champion Badge`,
      cashNotes: 500,
      coins: 10000,
      message: `Season ${seasonNumber} Champion Badge + Title + Frame + 500 Cash Notes + 10k Coins`
    }
  }
  if (rankIndex === 1) {
    return {
      title: `Season ${seasonNumber} Vice Champion`,
      frame: `Season ${seasonNumber} Premium Frame`,
      cashNotes: 300,
      coins: 5000,
      message: `Season ${seasonNumber} Premium Frame + Title + 300 Cash Notes + 5k Coins`
    }
  }
  if (rankIndex === 2) {
    return {
      title: `Season ${seasonNumber} Elite Contender`,
      frame: `Season ${seasonNumber} Premium Border`,
      cashNotes: 150,
      coins: 3000,
      message: `Season ${seasonNumber} Premium Border + Title + 150 Cash Notes + 3k Coins`
    }
  }
  if (rankIndex >= 3 && rankIndex < 10) {
    return {
      title: `Season ${seasonNumber} Top 10 Elite`,
      badge: `Season ${seasonNumber} Top 10 Badge`,
      cashNotes: 25,
      coins: 1000,
      message: `Season ${seasonNumber} Top 10 Badge + Title + 25 Cash Notes + 1k Coins`
    }
  }
  return {
    title: `Season ${seasonNumber} Contender`,
    cashNotes: 0,
    coins: 500,
    message: `Season ${seasonNumber} Contender Title + 500 Coins`
  }
}

// Automatically reset all players and save snapshots
export async function rotateRankedSeason(): Promise<any> {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch current active season
    const activeSeason = await tx.rankedSeason.findFirst({
      where: { isActive: true }
    })

    if (!activeSeason) {
      throw new Error('No active ranked season found to rotate.')
    }

    // 2. Parse current season number
    const matches = activeSeason.name.match(/\d+/)
    const currentNumber = matches ? parseInt(matches[0], 10) : 1
    const nextNumber = currentNumber + 1

    // 3. Fetch top players ordered by MMR
    const topProfiles = await tx.profile.findMany({
      orderBy: { rankedMmr: 'desc' },
      take: 10
    })

    // 4. Archive snapshots
    let idx = 0
    for (const p of topProfiles) {
      const details = getRankDetails(p.rankedMmr, 0)
      const total = p.rankedWins + p.rankedLosses
      const winRate = total > 0 ? (p.rankedWins / total) : 0
      const rewards = getRewardsForRank(idx, currentNumber)

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
          peakTier: p.rankedPeakRank || 'Bronze',
          rewards: rewards,
          seasonNumber: currentNumber,
          completionDate: new Date()
        }
      })

      // Send System Notification to top players
      await tx.notification.create({
        data: {
          profileId: p.id,
          type: 'SYSTEM',
          title: `🏆 Season ${currentNumber} Completed!`,
          message: `Congratulations! You finished Rank #${idx + 1} with ${p.rankedMmr} MMR. Reward: ${rewards.message} credited!`,
          linkUrl: '/dashboard/leaderboard',
          isRead: false
        }
      }).catch(() => null)

      // Award rewards to profile
      await tx.profile.update({
        where: { id: p.id },
        data: {
          coins: { increment: rewards.coins },
          cashNotes: { increment: rewards.cashNotes || 0 },
          selectedTitle: rewards.title,
          ...(rewards.frame ? { selectedFrame: rewards.frame } : {}),
          ...(rewards.badge ? { selectedBadge: rewards.badge } : {}),
        }
      }).catch(() => null)

      idx++
    }

    // 5. Mark active season inactive
    await tx.rankedSeason.update({
      where: { id: activeSeason.id },
      data: {
        isActive: false,
        endDate: new Date()
      }
    })

    // 6. Perform Soft Reset of MMR for ALL profiles
    const allProfiles = await tx.profile.findMany()
    for (const p of allProfiles) {
      const oldMmr = p.rankedMmr
      // NewMMR = 1000 + (OldMMR - 1000) * 0.5
      const newMmr = Math.max(0, Math.round(1000 + (oldMmr - 1000) * 0.5))

      await tx.profile.update({
        where: { id: p.id },
        data: {
          rankedMmr: newMmr,
          rankedWins: 0,
          rankedLosses: 0,
          rankedStreak: 0,
          rankedPeakRank: 'Bronze',
          placementMatchesRemaining: 5,
          rankedProtectionMatches: 0
        }
      })
    }

    // 7. Create next active season (90 days)
    const nextSeason = await tx.rankedSeason.create({
      data: {
        id: `season-${nextNumber}`,
        name: `Season ${nextNumber}: Genesis`,
        startDate: new Date(),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        isActive: true,
        rewards: { first: `Season ${nextNumber} Champion Title`, top10: 'Gold Rank Frame' }
      }
    })

    return {
      message: 'Ranked season rotated successfully',
      previousSeasonId: activeSeason.id,
      newSeasonId: nextSeason.id
    }
  })
}

// Lazy evaluation check triggered on GET requests
export async function checkAndProcessRankedSeasonReset(): Promise<{ ran: boolean; newSeasonId?: string }> {
  try {
    const activeSeason = await prisma.rankedSeason.findFirst({
      where: { isActive: true }
    })

    if (!activeSeason) {
      // Seed default active season if missing entirely
      await prisma.rankedSeason.create({
        data: {
          id: 'season-genesis',
          name: 'Season 1: Genesis',
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          isActive: true,
          rewards: { first: 'Season 1 Champion Title', top10: 'Gold Rank Frame' }
        }
      })
      return { ran: true, newSeasonId: 'season-genesis' }
    }

    // Check if current date exceeds end date
    if (new Date(activeSeason.endDate).getTime() <= Date.now()) {
      const res = await rotateRankedSeason()
      return { ran: true, newSeasonId: res.newSeasonId }
    }

    return { ran: false }
  } catch (err) {
    console.error('[rankedSeasonEngine] Season reset error:', err)
    return { ran: false }
  }
}
