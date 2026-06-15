import { prisma } from '@/lib/prisma'

export interface AnalyticsStats {
  matchesPlayed: number
  wins: number
  losses: number
  draws: number
  totalPlayTime: number // in seconds
  favoriteGame: string
  highestWinStreak: number
}

export async function getUserAnalytics(profileId: string): Promise<AnalyticsStats> {
  // Fetch all matches for the user in chronological order
  const matches = await prisma.matchRecord.findMany({
    where: {
      OR: [
        { player1Id: profileId },
        { player2Id: profileId }
      ]
    },
    orderBy: {
      playedAt: 'asc'
    },
    include: {
      game: true
    }
  })

  const matchesPlayed = matches.length
  let wins = 0
  let losses = 0
  let draws = 0
  let totalPlayTime = 0

  let currentWinStreak = 0
  let highestWinStreak = 0

  const gameCounts: Record<string, number> = {}

  for (const m of matches) {
    totalPlayTime += m.durationSecs || 0

    const gameName = m.game.name
    gameCounts[gameName] = (gameCounts[gameName] || 0) + 1

    if (m.winnerId === profileId) {
      wins++
      currentWinStreak++
      if (currentWinStreak > highestWinStreak) {
        highestWinStreak = currentWinStreak
      }
    } else if (m.winnerId === null && m.player2Id !== null) {
      draws++
      currentWinStreak = 0 // break streak on draw
    } else {
      losses++
      currentWinStreak = 0 // break streak on loss
    }
  }

  // Find favorite game by play count
  let favoriteGame = 'None'
  let maxPlays = 0
  for (const [name, count] of Object.entries(gameCounts)) {
    if (count > maxPlays) {
      maxPlays = count
      favoriteGame = name
    }
  }

  return {
    matchesPlayed,
    wins,
    losses,
    draws,
    totalPlayTime,
    favoriteGame,
    highestWinStreak
  }
}
