import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

const BOT_NAMES = [
  'PixelKnight [Bot]',
  'CyberSamurai [Bot]',
  'AlphaZero [Bot]',
  'CodeNinja [Bot]',
  'RoboRex [Bot]',
  'ByteBoss [Bot]',
  'ApexPredator [Bot]',
  'RetroRacer [Bot]'
]

// Helper to seed tournaments if they don't exist
async function getOrSeedTournaments() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  // Find daily tournament for today
  let daily = await prisma.tournament.findFirst({
    where: {
      name: { contains: 'Daily' },
      startDate: { gte: todayStart },
      endDate: { lte: todayEnd }
    }
  })

  if (!daily) {
    daily = await prisma.tournament.create({
      data: {
        name: `Daily Arena Challenge - ${todayStart.toLocaleDateString()}`,
        description: 'Participate in today\'s rapid-fire brackets. Defeat 3 rounds of bots to claim the Daily Champion title!',
        startDate: todayStart,
        endDate: todayEnd,
        eligibleGames: ['tic-tac-toe', 'dots-boxes', 'cricket'],
        rewardCoins: 250,
        rewardTitle: 'Daily Arena Champ',
        rewardBadge: 'daily-gold',
        status: 'REGISTERING'
      }
    })
  }

  // Find weekly tournament for this week (using Monday of this week)
  const currentDay = now.getDay()
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0)
  const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000)

  let weekly = await prisma.tournament.findFirst({
    where: {
      name: { contains: 'Weekly' },
      startDate: { gte: monday },
      endDate: { lte: sunday }
    }
  })

  if (!weekly) {
    weekly = await prisma.tournament.create({
      data: {
        name: `Weekly Grand Championship - Week of ${monday.toLocaleDateString()}`,
        description: 'The ultimate weekly battle. Claim victory over the best bots to win 1,000 coins and the Grandmaster title!',
        startDate: monday,
        endDate: sunday,
        eligibleGames: ['tic-tac-toe', 'dots-boxes', 'cricket', 'scribble'],
        rewardCoins: 1000,
        rewardTitle: 'Grandmaster',
        rewardBadge: 'weekly-platinum',
        status: 'REGISTERING'
      }
    })
  }

  return { daily, weekly }
}

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { daily, weekly } = await getOrSeedTournaments()

    // Fetch past tournaments (finished)
    const history = await prisma.tournament.findMany({
      where: {
        status: 'COMPLETED',
        endDate: { lt: new Date() }
      },
      orderBy: { endDate: 'desc' },
      take: 10
    })

    return NextResponse.json({
      success: true,
      daily,
      weekly,
      history
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/tournaments]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, tournamentId, outcome } = body

    if (!action || !tournamentId) {
      return NextResponse.json({ error: 'Missing action or tournamentId' }, { status: 400 })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId }
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // ── REGISTER ──
    if (action === 'register') {
      if (tournament.status !== 'REGISTERING') {
        return NextResponse.json({ error: 'Tournament registration is closed' }, { status: 400 })
      }

      let currentBracket: any = tournament.bracketData || { participants: [], rounds: [] }
      const alreadyRegistered = currentBracket.participants.some((p: any) => p.id === profile.id)

      if (alreadyRegistered) {
        return NextResponse.json({ error: 'Already registered for this tournament' }, { status: 400 })
      }

      // Add user to participants list
      currentBracket.participants.push({
        id: profile.id,
        name: profile.username,
        isBot: false
      })

      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { bracketData: currentBracket }
      })

      // Add Notification
      await prisma.notification.create({
        data: {
          profileId: profile.id,
          type: 'TOURNAMENT',
          title: 'Registered for Tournament 🏆',
          message: `You registered for ${tournament.name}. Get ready to play!`
        }
      })

      return NextResponse.json({ success: true, tournament: updated }, { status: 200 })
    }

    // ── START (FILL WITH BOTS & GENERATE BRACKET) ──
    if (action === 'start') {
      let currentBracket: any = tournament.bracketData || { participants: [], rounds: [] }
      const alreadyRegistered = currentBracket.participants.some((p: any) => p.id === profile.id)

      if (!alreadyRegistered) {
        return NextResponse.json({ error: 'Must register before starting the tournament' }, { status: 400 })
      }

      // Fill up the rest with bots to make 8 participants
      const participants = [...currentBracket.participants]
      let botIndex = 0
      while (participants.length < 8) {
        const botName = BOT_NAMES[botIndex % BOT_NAMES.length]
        participants.push({
          id: `bot-${botIndex}-${Date.now()}`,
          name: botName,
          isBot: true
        })
        botIndex++
      }

      // Generate Rounds
      const rounds = [
        {
          roundIndex: 0,
          name: 'Quarter Finals',
          matches: [
            { id: 'm1', p1: participants[0].id, p2: participants[1].id, score1: null, score2: null, winnerId: null, status: 'PENDING' },
            { id: 'm2', p1: participants[2].id, p2: participants[3].id, score1: null, score2: null, winnerId: null, status: 'PENDING' },
            { id: 'm3', p1: participants[4].id, p2: participants[5].id, score1: null, score2: null, winnerId: null, status: 'PENDING' },
            { id: 'm4', p1: participants[6].id, p2: participants[7].id, score1: null, score2: null, winnerId: null, status: 'PENDING' }
          ]
        },
        {
          roundIndex: 1,
          name: 'Semi Finals',
          matches: [
            { id: 'm5', p1: null, p2: null, score1: null, score2: null, winnerId: null, status: 'PENDING' },
            { id: 'm6', p1: null, p2: null, score1: null, score2: null, winnerId: null, status: 'PENDING' }
          ]
        },
        {
          roundIndex: 2,
          name: 'Finals',
          matches: [
            { id: 'm7', p1: null, p2: null, score1: null, score2: null, winnerId: null, status: 'PENDING' }
          ]
        }
      ]

      const nextBracket = { participants, rounds }
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          bracketData: nextBracket,
          status: 'ACTIVE'
        }
      })

      // Send start notification
      await prisma.notification.create({
        data: {
          profileId: profile.id,
          type: 'TOURNAMENT',
          title: 'Tournament Started! ⚔️',
          message: `${tournament.name} brackets are generated. Play your Quarter Finals match!`
        }
      })

      return NextResponse.json({ success: true, tournament: updated }, { status: 200 })
    }

    // ── PLAY MATCH ──
    if (action === 'playMatch') {
      if (tournament.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Tournament is not active' }, { status: 400 })
      }

      const bracket: any = tournament.bracketData
      if (!bracket) {
        return NextResponse.json({ error: 'Bracket data not found' }, { status: 404 })
      }

      // Find the user's active pending match
      let userMatch: any = null
      let roundIndex = -1

      for (let r = 0; r < bracket.rounds.length; r++) {
        const round = bracket.rounds[r]
        const m = round.matches.find((match: any) =>
          (match.p1 === profile.id || match.p2 === profile.id) && match.winnerId === null
        )
        if (m) {
          userMatch = m
          roundIndex = r
          break
        }
      }

      if (!userMatch) {
        return NextResponse.json({ error: 'No pending match found for your profile' }, { status: 404 })
      }

      const userWon = outcome === 'win'
      const opponentId = userMatch.p1 === profile.id ? userMatch.p2 : userMatch.p1
      const opponent = bracket.participants.find((p: any) => p.id === opponentId)

      // 1. Resolve User Match
      userMatch.winnerId = userWon ? profile.id : opponentId
      userMatch.score1 = userWon ? 2 : 1
      userMatch.score2 = userWon ? 1 : 2
      userMatch.status = 'COMPLETED'

      // 2. Simulate Bot vs Bot Matches in the current round
      const currentRound = bracket.rounds[roundIndex]
      currentRound.matches.forEach((m: any) => {
        if (m.winnerId === null) {
          // Choose winner randomly among non-null participants
          const winner = Math.random() > 0.5 ? m.p1 : m.p2
          m.winnerId = winner
          m.score1 = winner === m.p1 ? 2 : 1
          m.score2 = winner === m.p1 ? 1 : 2
          m.status = 'COMPLETED'
        }
      })

      // 3. Populate Next Round matches if user won
      let tournamentStatus = 'ACTIVE'
      if (userWon) {
        const nextRoundIndex = roundIndex + 1
        if (nextRoundIndex < bracket.rounds.length) {
          const nextRound = bracket.rounds[nextRoundIndex]
          // Match mapping for 8-player bracket:
          // Round 0 Matches: m1, m2, m3, m4
          // Round 1 Matches: m5 (Winner of m1 vs m2), m6 (Winner of m3 vs m4)
          // Round 2 Matches: m7 (Winner of m5 vs m6)
          if (roundIndex === 0) {
            nextRound.matches[0].p1 = currentRound.matches[0].winnerId
            nextRound.matches[0].p2 = currentRound.matches[1].winnerId
            nextRound.matches[1].p1 = currentRound.matches[2].winnerId
            nextRound.matches[1].p2 = currentRound.matches[3].winnerId
          } else if (roundIndex === 1) {
            nextRound.matches[0].p1 = currentRound.matches[0].winnerId
            nextRound.matches[0].p2 = currentRound.matches[1].winnerId
          }

          await prisma.notification.create({
            data: {
              profileId: profile.id,
              type: 'TOURNAMENT',
              title: 'Advanced to Next Round! 🏆',
              message: `You defeated ${opponent?.name || 'Bot'} and advanced in ${tournament.name}!`
            }
          })
        } else {
          // User won the Finals!
          tournamentStatus = 'COMPLETED'
          await prisma.notification.create({
            data: {
              profileId: profile.id,
              type: 'TOURNAMENT',
              title: 'Tournament Winner! 👑',
              message: `Incredible! You won the first place in ${tournament.name}! Claim your rewards now.`
            }
          })
        }
      } else {
        // User lost! Eliminated
        tournamentStatus = 'ELIMINATED'
        await prisma.notification.create({
          data: {
            profileId: profile.id,
            type: 'TOURNAMENT',
            title: 'Eliminated from Tournament ❌',
            message: `You were defeated by ${opponent?.name || 'Bot'}. Better luck next time!`
          }
        })
      }

      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: {
          bracketData: bracket,
          status: tournamentStatus
        }
      })

      return NextResponse.json({ success: true, tournament: updated, userWon }, { status: 200 })
    }

    // ── CLAIM REWARDS ──
    if (action === 'claimRewards') {
      const isCompleted = tournament.status === 'COMPLETED'
      const isEliminated = tournament.status === 'ELIMINATED'

      if (!isCompleted && !isEliminated) {
        return NextResponse.json({ error: 'Tournament rewards cannot be claimed in this state' }, { status: 400 })
      }

      // Consolation reward if eliminated, full rewards if completed
      const coinsReward = isCompleted ? tournament.rewardCoins : Math.floor(tournament.rewardCoins * 0.1)
      const xpReward = isCompleted ? 500 : 100

      // Award to Profile
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          coins: { increment: coinsReward },
          xp: { increment: xpReward }
        }
      })

      // Log XP Event
      await prisma.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'TOURNAMENT',
          amount: xpReward,
          meta: { tournamentId: tournament.id, status: tournament.status }
        }
      })

      // Log Analytics Event
      await prisma.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'tournament_rewards_claimed',
          metadata: { tournamentId: tournament.id, coinsReward, xpReward, won: isCompleted }
        }
      })

      // Reset/Update status for user
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'CLAIMED' }
      })

      return NextResponse.json({
        success: true,
        coinsReward,
        xpReward,
        tournament: updated
      }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[POST /api/tournaments]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
