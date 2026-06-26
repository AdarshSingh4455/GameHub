import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      gameSlug,
      type, // ONE_DAY or MULTI_DAY
      durationDays,
      regStart,
      regEnd,
      startDate,
      endDate,
      maxPlayers,
      bannerUrl,
      rules,
      isOfficial,
      privacy, // PUBLIC, PRIVATE, INVITE_CODE
      preferredSplit, // 8x2 or 4x4
      startTime,
      rewardCoins,
      rewardBadge,
      rewardTitle
    } = body

    if (!name || !gameSlug || !startDate || !endDate) {
      return NextResponse.json({ error: 'Name, game, start date, and end date are required' }, { status: 400 })
    }

    const minPlayers = 4
    const parsedMaxPlayers = parseInt(maxPlayers, 10) || 16
    if (parsedMaxPlayers < minPlayers) {
      return NextResponse.json({ error: `Maximum players must be at least ${minPlayers}` }, { status: 400 })
    }

    // Force official check
    let forceOfficial = false
    if (isOfficial) {
      if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') {
        forceOfficial = true
      } else {
        return NextResponse.json({ error: 'Only admins can create official tournaments' }, { status: 403 })
      }
    }

    // Rate limiting: Limit tournament creation frequency per user (15 minutes between creations)
    if (!forceOfficial) {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
      const recentTournament = await prisma.tournament.findFirst({
        where: {
          creatorId: profile.id,
          createdAt: { gte: fifteenMinutesAgo }
        }
      })
      if (recentTournament) {
        return NextResponse.json(
          { error: 'You are creating tournaments too frequently. Please wait 15 minutes between creations.' },
          { status: 429 }
        )
      }
    }

    // Generate invite code for private/invite-code community tournaments
    let inviteCode: string | null = null
    if (privacy === 'INVITE_CODE' || privacy === 'PRIVATE') {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description || null,
        gameSlug,
        type: type || 'ONE_DAY',
        regStart: regStart ? new Date(regStart) : new Date(),
        regEnd: regEnd ? new Date(regEnd) : new Date(startDate),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        durationDays: parseInt(durationDays, 10) || 1,
        maxPlayers: parsedMaxPlayers,
        bannerUrl: bannerUrl || null,
        rules: rules || null,
        isOfficial: forceOfficial,
        creatorId: forceOfficial ? null : profile.id,
        privacy: privacy || 'PUBLIC',
        inviteCode,
        preferredSplit: preferredSplit || '8x2',
        startTime: startTime || '10:00 AM',
        rewardCoins: forceOfficial ? (parseInt(rewardCoins, 10) || 0) : 0,
        rewardBadge: forceOfficial ? (rewardBadge || null) : null,
        rewardTitle: forceOfficial ? (rewardTitle || null) : null,
        status: 'ANNOUNCEMENT' // Must start in announcement phase
      }
    })

    // Create system notification for community registration started
    if (!forceOfficial) {
      await prisma.notification.create({
        data: {
          profileId: profile.id,
          type: 'TOURNAMENT',
          title: 'Community Tournament Created! 🏆',
          message: `You created ${name}. Invite friends with code: ${inviteCode || 'N/A'}`
        }
      })
    }

    // Create audit logs
    await prisma.tournamentAuditLog.create({
      data: {
        tournamentId: tournament.id,
        event: 'Tournament Created',
        details: `Tournament "${name}" created by ${profile.username}.`
      }
    })

    await prisma.tournamentAuditLog.create({
      data: {
        tournamentId: tournament.id,
        event: 'Registration Opened',
        details: `Registration opened from ${new Date(tournament.regStart).toLocaleString()} to ${new Date(tournament.regEnd).toLocaleString()}.`
      }
    })

    return NextResponse.json({ success: true, tournament }, { status: 201 })

  } catch (err: unknown) {
    console.error('[POST /api/tournaments/create]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
