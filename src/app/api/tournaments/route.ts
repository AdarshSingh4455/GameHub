import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import {
  getTournamentSplits,
  generateBracket,
  propagateWinner,
  checkAndCreateFromWaitingList,
  checkAndProcessDisqualifications,
  getMatchTiming,
  createNotification
} from '@/lib/tournamentEngine'

export const dynamic = 'force-dynamic'

// GET /api/tournaments
export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Process disqualifications dynamically first so lists are fresh
    await checkAndProcessDisqualifications(prisma)

    // 2. Fetch all tournaments
    const allTournaments = await prisma.tournament.findMany({
      orderBy: { regStart: 'asc' },
      include: {
        registrations: {
          include: {
            profile: true,
            team: true
          }
        },
        subTournaments: {
          include: {
            matches: true
          }
        }
      }
    })

    const now = new Date()

    // 3. Process each tournament to calculate card stats
    const processed = allTournaments.map((t: any) => {
      const regStart = new Date(t.regStart)
      const regEnd = new Date(t.regEnd)
      const startDate = new Date(t.startDate)
      
      // Determine calculated status based on dates
      let calculatedStatus = t.status
      if (t.status !== 'COMPLETED' && t.status !== 'CLAIMED') {
        if (t.status === 'ACTIVE' || t.subTournaments.length > 0) {
          calculatedStatus = 'ACTIVE'
        } else if (now <= regEnd) {
          calculatedStatus = 'REGISTRATION_OPEN'
        } else {
          calculatedStatus = 'REGISTRATION_CLOSED'
        }
      }

      // Check if user is registered
      const userReg = t.registrations.find((r: any) => r.profileId === profile.id)
      const isRegistered = !!userReg

      // Waiting list state details
      let waitingListState: any = null
      if (userReg && userReg.status === 'WAITING_LIST') {
        const waitingList = t.registrations.filter((r: any) => r.status === 'WAITING_LIST')
        waitingListState = {
          waitingPosition: userReg.waitingPosition,
          playersNeeded: Math.max(0, 4 - waitingList.length),
          estStart: `Starts as soon as 4 players join`
        }
      }

      // Count registered players
      const registeredPlayers = t.registrations.length

      // Count active players (capacity - completed matches in active brackets)
      let activePlayers = 0
      if (calculatedStatus === 'ACTIVE') {
        activePlayers = t.subTournaments.reduce((acc: number, sub: any) => {
          if (sub.status === 'ACTIVE') {
            const completedCount = sub.matches.filter((m: any) => m.status === 'COMPLETED' || m.status === 'WALK_OVER' || m.status === 'DISQUALIFIED').length
            return acc + (sub.capacity - completedCount)
          }
          return acc
        }, 0)
      } else if (calculatedStatus === 'REGISTRATION_CLOSED' || calculatedStatus === 'REGISTRATION_OPEN') {
        activePlayers = registeredPlayers
      }

      // Find current round
      let currentRound = 'N/A'
      if (calculatedStatus === 'ACTIVE') {
        // Find highest roundIndex that has active pending matches
        let highestActiveRoundIndex = 0
        let roundName = 'Round 1'
        t.subTournaments.forEach((sub: any) => {
          sub.matches.forEach((m: any) => {
            if (m.status === 'PENDING' || m.status === 'PLAYING') {
              if (m.roundIndex >= highestActiveRoundIndex) {
                highestActiveRoundIndex = m.roundIndex
                roundName = m.roundName
              }
            }
          })
        })
        currentRound = `${roundName} Live`
      } else if (calculatedStatus === 'REGISTRATION_OPEN') {
        currentRound = 'Registration Open'
      } else if (calculatedStatus === 'COMPLETED' || calculatedStatus === 'CLAIMED') {
        currentRound = 'Tournament Completed'
      }

      // Countdown timer calculation
      let countdown = 0
      if (calculatedStatus === 'REGISTRATION_OPEN') {
        countdown = Math.max(0, Math.floor((regEnd.getTime() - now.getTime()) / 1000))
      } else if (calculatedStatus === 'REGISTRATION_CLOSED') {
        countdown = Math.max(0, Math.floor((startDate.getTime() - now.getTime()) / 1000))
      }

      // Rewards string formatting
      let rewardsString = `₹${t.rewardCoins}`
      if (t.rewardCoins > 0 && t.isOfficial) {
        rewardsString = `💰 ${t.rewardCoins} Coins`
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        gameSlug: t.gameSlug,
        type: t.type,
        regStart: t.regStart,
        regEnd: t.regEnd,
        startDate: t.startDate,
        endDate: t.endDate,
        durationDays: t.durationDays,
        maxPlayers: t.maxPlayers,
        bannerUrl: t.bannerUrl,
        rules: t.rules,
        isOfficial: t.isOfficial,
        creatorId: t.creatorId,
        privacy: t.privacy,
        inviteCode: t.inviteCode,
        preferredSplit: t.preferredSplit,
        startTime: t.startTime,
        winnerId: t.winnerId,
        rewardCoins: t.rewardCoins,
        rewardBadge: t.rewardBadge,
        rewardTitle: t.rewardTitle,
        rewardCosmetic: t.rewardCosmetic,
        status: calculatedStatus,
        isRegistered,
        registeredPlayers,
        activePlayers,
        currentRound,
        countdown,
        rewardsString,
        waitingListState
      }
    })

    // Sort into categories
    const announcements: any[] = []
    const registrationOpen = processed.filter(t => t.status === 'REGISTRATION_OPEN')
    const upcoming = processed.filter(t => t.status === 'REGISTRATION_CLOSED')
    const live = processed.filter(t => t.status === 'ACTIVE')
    const completed = processed.filter(t => t.status === 'COMPLETED' || t.status === 'CLAIMED')
    const myTournaments = processed.filter(t => t.isRegistered)

    return NextResponse.json({
      success: true,
      announcements,
      registrationOpen,
      upcoming,
      live,
      completed,
      myTournaments
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/tournaments]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/tournaments
export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, tournamentId, matchId, outcome, teamId, teamName } = body

    if (!action || !tournamentId) {
      return NextResponse.json({ error: 'Missing action or tournamentId' }, { status: 400 })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { registrations: true }
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // ── REGISTER ──
    if (action === 'register') {
      const now = new Date()
      const regStart = new Date(tournament.regStart)
      const regEnd = new Date(tournament.regEnd)

      if (now < regStart || now > regEnd) {
        return NextResponse.json({ error: 'Tournament registration is closed' }, { status: 400 })
      }

      // Check if already registered
      const alreadyRegistered = tournament.registrations.some((r: any) => r.profileId === profile.id)
      if (alreadyRegistered) {
        return NextResponse.json({ error: 'Already registered for this tournament' }, { status: 400 })
      }

      // Prevent duplicate registrations / joining multiple teams / team changes after start
      if (tournament.status === 'ACTIVE' || tournament.status === 'COMPLETED') {
        return NextResponse.json({ error: 'Tournament has already started. Team rosters are locked.' }, { status: 400 })
      }

      // Handle team invite or tournament invite validation
      let activeTeamId: any = null
      let teamToJoin: any = null

      if (teamId) {
        // Check if teamId matches a team invite code in this tournament
        teamToJoin = await prisma.tournamentTeam.findFirst({
          where: { tournamentId, inviteCode: teamId }
        })
        if (teamToJoin) {
          activeTeamId = teamToJoin.id
        }
      }

      if (tournament.privacy === 'INVITE_CODE' || tournament.privacy === 'PRIVATE') {
        const isTournInviteValid = teamId === tournament.inviteCode
        const isTeamInviteValid = !!teamToJoin
        if (!isTournInviteValid && !isTeamInviteValid) {
          return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
        }
      }

      if (teamToJoin) {
        // Add member to the team
        await prisma.tournamentTeamMember.create({
          data: { teamId: teamToJoin.id, profileId: profile.id }
        })
      } else if (teamName) {
        // Create team
        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
        const team = await prisma.tournamentTeam.create({
          data: {
            tournamentId,
            name: teamName,
            captainId: profile.id,
            inviteCode
          }
        })
        activeTeamId = team.id
        // Add member
        await prisma.tournamentTeamMember.create({
          data: { teamId: team.id, profileId: profile.id }
        })
      }

      // Check capacity split & waitlist placement
      // If registration exceeds maxPlayers, place in waiting list
      let status = 'REGISTERED'
      let waitingPosition = 0

      if (tournament.registrations.length >= tournament.maxPlayers) {
        status = 'WAITING_LIST'
        const currentWaiting = tournament.registrations.filter((r: any) => r.status === 'WAITING_LIST')
        waitingPosition = currentWaiting.length + 1
      }

      const reg = await prisma.tournamentRegistration.create({
        data: {
          tournamentId,
          profileId: profile.id,
          teamId: activeTeamId,
          status,
          waitingPosition
        }
      })

      // Send notification
      await createNotification(
        prisma,
        profile.id,
        'Registered for Tournament 🏆',
        `You registered for ${tournament.name}. Get ready to play!`
      )

      // Audit Log: Player Registered or Waitlisted
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId,
          event: status === 'REGISTERED' ? 'Player Registered' : 'Player Waitlisted',
          details: `${profile.username} registered. Status: ${status}`
        }
      })

      return NextResponse.json({ success: true, registration: reg }, { status: 200 })
    }

    // ── START / AUTO-GENERATE BRACKETS ──
    if (action === 'start') {
      // Transition from REGISTRATION_OPEN or CLOSED to ACTIVE and split players
      const regs = await prisma.tournamentRegistration.findMany({
        where: { tournamentId },
        orderBy: { registeredAt: 'asc' },
        include: { profile: true, team: true }
      })

      if (regs.length < 4) {
        return NextResponse.json({ error: 'Not enough players to start the tournament (minimum 4)' }, { status: 400 })
      }

      // Capacity splitting
      const { splits, waiting } = getTournamentSplits(
        regs.length,
        tournament.preferredSplit as '8x2' | '4x4'
      )

      // Total players accommodated
      const totalAccommodated = splits.reduce((a, b) => a + b, 0)
      
      // Update statuses
      const activeRegs = regs.slice(0, totalAccommodated)
      const waitingRegs = regs.slice(totalAccommodated)

      // 1. Create SubTournaments and generate brackets
      let playerIndex = 0
      for (let i = 0; i < splits.length; i++) {
        const capacity = splits[i]
        const subRegs = activeRegs.slice(playerIndex, playerIndex + capacity)
        playerIndex += capacity

        const sub = await prisma.subTournament.create({
          data: {
            tournamentId,
            name: `${tournament.name} - Division ${i + 1}`,
            capacity,
            status: 'ACTIVE'
          }
        })

        const participants = subRegs.map((r: any) => {
          if (r.team) {
            return { id: r.team.id, name: r.team.name }
          } else {
            return { id: r.profile.id, name: r.profile.username }
          }
        })

        await generateBracket(
          prisma,
          sub.id,
          participants,
          tournament.type as 'ONE_DAY' | 'MULTI_DAY',
          new Date(tournament.startDate).toISOString(),
          tournament.startTime
        )

        // Update registrations status to REGISTERED
        for (const r of subRegs) {
          await prisma.tournamentRegistration.update({
            where: { id: r.id },
            data: { status: 'REGISTERED', waitingPosition: 0 }
          })
          
          await createNotification(
            prisma,
            r.profileId,
            'Tournament Started! ⚔️',
            `Bracket generated for ${tournament.name}! View your schedule and play.`
          )
        }
      }

      // 2. Update remaining players to WAITING_LIST status
      for (let i = 0; i < waitingRegs.length; i++) {
        const r = waitingRegs[i]
        await prisma.tournamentRegistration.update({
          where: { id: r.id },
          data: { status: 'WAITING_LIST', waitingPosition: i + 1 }
        })

        await createNotification(
          prisma,
          r.profileId,
          'Placed on Waiting List ⏳',
          `You are on the waiting list for ${tournament.name}. You will join once 4 more players register.`
        )
      }

      // 3. Update Tournament Status to ACTIVE
      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'ACTIVE' }
      })

      return NextResponse.json({ success: true, tournament: updated }, { status: 200 })
    }

    // ── JOIN MATCH (PLAY NOW WINDOW CLICK) ──
    if (action === 'joinMatch') {
      if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          subTournament: {
            include: { tournament: true }
          }
        }
      })

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

      const now = new Date()
      const start = new Date(match.joinWindowStart)
      const end = new Date(match.joinWindowEnd)

      if (now < start) return NextResponse.json({ error: 'Join window is not open yet' }, { status: 400 })
      if (now > end) {
        // Disqualify dynamically
        await checkAndProcessDisqualifications(prisma)
        return NextResponse.json({ error: 'Join window has expired' }, { status: 400 })
      }

      // Mark user joined
      const isP1 = match.p1Id === profile.id || (match.p1Id && match.p1Id === teamId)
      const isP2 = match.p2Id === profile.id || (match.p2Id && match.p2Id === teamId)

      if (!isP1 && !isP2) return NextResponse.json({ error: 'You are not a participant in this match' }, { status: 400 })

      // Match Integrity lock: Prevent duplicate joins & replaying completed matches
      if (['COMPLETED', 'WALK_OVER', 'DISQUALIFIED'].includes(match.status)) {
        return NextResponse.json({ error: 'Match has already been resolved.' }, { status: 400 })
      }

      // If already joined (e.g. recovery/refresh scenario), return the current match state directly
      const updateData: any = {}
      let needsUpdate = false

      if (isP1 && !match.p1Joined) {
        updateData.p1Joined = true
        needsUpdate = true
      } else if (isP2 && !match.p2Joined) {
        updateData.p2Joined = true
        needsUpdate = true
      }

      // Bot auto-join and auto-ready:
      const opponentId = isP1 ? match.p2Id : match.p1Id
      const isOpponentBot = opponentId?.startsWith('bot-')
      if (isOpponentBot) {
        if (isP1 && !match.p2Joined) {
          updateData.p2Joined = true
          updateData.p2Ready = true
          needsUpdate = true
        } else if (isP2 && !match.p1Joined) {
          updateData.p1Joined = true
          updateData.p1Ready = true
          needsUpdate = true
        }
      }

      let updatedMatch = match
      if (needsUpdate) {
        updatedMatch = await prisma.tournamentMatch.update({
          where: { id: matchId },
          data: updateData
        })

        // Send notifications
        if (opponentId && !opponentId.startsWith('bot-')) {
          await createNotification(
            prisma,
            opponentId,
            'Opponent Joined Match! ⚔️',
            `Your opponent joined the match in ${match.subTournament.tournament.name}. Go play now!`
          )
        }
      }

      return NextResponse.json({ success: true, match: updatedMatch }, { status: 200 })
    }

    // ── READY MATCH ──
    if (action === 'readyMatch') {
      if (!matchId) return NextResponse.json({ error: 'Missing matchId' }, { status: 400 })

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          subTournament: {
            include: { tournament: true }
          }
        }
      })

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

      // Match Integrity lock
      if (['COMPLETED', 'WALK_OVER', 'DISQUALIFIED'].includes(match.status)) {
        return NextResponse.json({ error: 'Match has already been resolved.' }, { status: 400 })
      }

      const isP1 = match.p1Id === profile.id || (match.p1Id && match.p1Id === teamId)
      const isP2 = match.p2Id === profile.id || (match.p2Id && match.p2Id === teamId)

      if (!isP1 && !isP2) return NextResponse.json({ error: 'You are not a participant in this match' }, { status: 400 })

      // Prevent duplicate ready
      if ((isP1 && match.p1Ready) || (isP2 && match.p2Ready)) {
        return NextResponse.json({ error: 'You are already marked as ready.' }, { status: 400 })
      }

      const updateData: any = {}
      if (isP1) {
        updateData.p1Ready = true
      } else {
        updateData.p2Ready = true
      }

      // Check if both are ready
      const p1Ready = isP1 ? true : match.p1Ready
      const p2Ready = isP2 ? true : match.p2Ready

      if (p1Ready && p2Ready) {
        updateData.status = 'PLAYING'
      }

      const updatedMatch = await prisma.tournamentMatch.update({
        where: { id: matchId },
        data: updateData
      })

      // Audit logs
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: match.subTournament.tournament.id,
          event: 'Player Ready',
          details: `${isP1 ? match.p1Name : match.p2Name} is Ready for the match.`
        }
      })

      if (p1Ready && p2Ready) {
        await prisma.tournamentAuditLog.create({
          data: {
            tournamentId: match.subTournament.tournament.id,
            event: 'Match Started',
            details: `Match ${match.roundName} - ${match.p1Name} vs ${match.p2Name} has started.`
          }
        })
      }

      // Send notifications
      const opponentId = isP1 ? match.p2Id : match.p1Id
      if (opponentId && !opponentId.startsWith('bot-')) {
        await createNotification(
          prisma,
          opponentId,
          'Opponent is Ready! ⚔️',
          `Your opponent is ready in ${match.subTournament.tournament.name}. Get ready to play!`
        )
      }

      return NextResponse.json({ success: true, match: updatedMatch }, { status: 200 })
    }

    // ── RESOLVE / PLAY MATCH ──
    if (action === 'playMatch' || action === 'resolveMatch') {
      if (!matchId || !outcome) return NextResponse.json({ error: 'Missing matchId or outcome' }, { status: 400 })

      const match = await prisma.tournamentMatch.findUnique({
        where: { id: matchId },
        include: {
          subTournament: {
            include: { tournament: true }
          }
        }
      })

      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

      // Match Integrity Lock: prevent multiple score submissions & replaying completed matches
      if (['COMPLETED', 'WALK_OVER', 'DISQUALIFIED'].includes(match.status)) {
        return NextResponse.json({ error: 'Match has already been resolved.' }, { status: 400 })
      }

      const userWon = outcome === 'win'
      const isP1 = match.p1Id === profile.id || (match.p1Id && match.p1Id === teamId)
      const isP2 = match.p2Id === profile.id || (match.p2Id && match.p2Id === teamId)

      if (!isP1 && !isP2) return NextResponse.json({ error: 'Not a participant in this match' }, { status: 400 })

      const winnerId = userWon ? (isP1 ? match.p1Id : match.p2Id) : (isP1 ? match.p2Id : match.p1Id)
      const winnerName = userWon ? (isP1 ? match.p1Name : match.p2Name) : (isP1 ? match.p2Name : match.p1Name)
      
      const p1Score = userWon ? (isP1 ? 2 : 1) : (isP1 ? 1 : 2)
      const p2Score = userWon ? (isP1 ? 1 : 2) : (isP1 ? 2 : 1)

      // Update match record
      const updatedMatch = await prisma.tournamentMatch.update({
        where: { id: matchId },
        data: {
          status: 'COMPLETED',
          winnerId,
          p1Score,
          p2Score
        }
      })

      // Audit Log: Winner Declared
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: match.subTournament.tournament.id,
          event: 'Winner Declared',
          details: `Match ${match.roundName} resolved. Winner: ${winnerName} (${p1Score}-${p2Score})`
        }
      })

      // Propagate winner
      if (winnerId && winnerName) {
        await propagateWinner(
          prisma,
          match.subTournamentId,
          match.roundIndex,
          match.matchIndex,
          winnerId,
          winnerName
        )
      }

      // Check if sub-tournament is completed
      const sub = await prisma.subTournament.findUnique({
        where: { id: match.subTournamentId },
        include: { matches: true }
      })

      const isSubFinished = sub?.status === 'COMPLETED'

      // Send notifications
      if (userWon) {
        await createNotification(
          prisma,
          profile.id,
          isSubFinished ? 'Tournament Winner! 👑' : 'Advanced to Next Round! 🏆',
          isSubFinished
            ? `Incredible! You won the first place in ${match.subTournament.tournament.name}! Claim your rewards.`
            : `You advanced in ${match.subTournament.tournament.name}!`
        )
      } else {
        await createNotification(
          prisma,
          profile.id,
          'Eliminated from Tournament ❌',
          `You were defeated in ${match.subTournament.tournament.name}. Better luck next time!`
        )
      }

      // If official and sub finished, let's mark main tournament event completed (if all subs completed)
      if (isSubFinished) {
        const allSubs = await prisma.subTournament.findMany({
          where: { tournamentId }
        })
        const allFinished = allSubs.every((s: any) => s.status === 'COMPLETED')
        if (allFinished) {
          await prisma.tournament.update({
            where: { id: tournamentId },
            data: { status: 'COMPLETED' }
          })
          
          await prisma.tournamentAuditLog.create({
            data: {
              tournamentId,
              event: 'Tournament Completed',
              details: `All division brackets completed. Tournament concluded successfully.`
            }
          })
          
          // Send globally
          for (const reg of tournament.registrations) {
            await createNotification(
              prisma,
              reg.profileId,
              'Tournament Completed 🏆',
              `${tournament.name} has finished! View the bracket and results.`
            )
          }
        }
      }

      return NextResponse.json({ success: true, match: updatedMatch, subTournamentFinished: isSubFinished }, { status: 200 })
    }

    // ── CLAIM REWARDS ──
    if (action === 'claimRewards') {
      const sub = await prisma.subTournament.findFirst({
        where: { tournamentId, winnerId: profile.id }
      })

      const isWinner = !!sub
      const coinsReward = isWinner ? tournament.rewardCoins : Math.floor(tournament.rewardCoins * 0.1)
      const xpReward = isWinner ? 500 : 100

      // Only grant rewards if tournament is Official
      if (tournament.isOfficial) {
        await prisma.profile.update({
          where: { id: profile.id },
          data: {
            coins: { increment: coinsReward },
            xp: { increment: xpReward }
          }
        })

        // Log events
        await prisma.xPEvent.create({
          data: {
            profileId: profile.id,
            type: 'TOURNAMENT',
            amount: xpReward,
            meta: { tournamentId, status: tournament.status }
          }
        })

        await prisma.analyticsEvent.create({
          data: {
            profileId: profile.id,
            eventName: 'tournament_rewards_claimed',
            metadata: { tournamentId, coinsReward, xpReward, won: isWinner }
          }
        })
      }

      // Mark status as CLAIMED locally for user (can record in metadata/registration)
      await prisma.tournamentRegistration.update({
        where: {
          tournamentId_profileId: {
            tournamentId,
            profileId: profile.id
          }
        },
        data: {
          status: 'CLAIMED'
        }
      })

      return NextResponse.json({
        success: true,
        coinsReward: tournament.isOfficial ? coinsReward : 0,
        xpReward: tournament.isOfficial ? xpReward : 0,
        isOfficial: tournament.isOfficial
      }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[POST /api/tournaments]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
