import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const tournaments = await prisma.tournament.findMany({
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json({ tournaments }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/admin/tournaments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      gameSlug,
      type,
      regStart,
      regEnd,
      startDate,
      endDate,
      durationDays,
      maxPlayers,
      bannerUrl,
      rules,
      privacy,
      preferredSplit,
      startTime,
      rewardCoins,
      rewardBadge,
      rewardTitle,
      rewardCosmetic,
      eligibleGames
    } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Name, Start Date, and End Date are required' }, { status: 400 })
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description || null,
        gameSlug: gameSlug || 'tic-tac-toe',
        type: type || 'ONE_DAY',
        regStart: regStart ? new Date(regStart) : new Date(),
        regEnd: regEnd ? new Date(regEnd) : new Date(startDate),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        durationDays: parseInt(durationDays, 10) || 1,
        maxPlayers: parseInt(maxPlayers, 10) || 16,
        bannerUrl: bannerUrl || null,
        rules: rules || null,
        isOfficial: true,
        creatorId: null,
        privacy: privacy || 'PUBLIC',
        preferredSplit: preferredSplit || '8x2',
        startTime: startTime || '10:00 AM',
        eligibleGames: eligibleGames || [gameSlug || 'tic-tac-toe'],
        rewardCoins: parseInt(rewardCoins, 10) || 0,
        rewardBadge: rewardBadge || null,
        rewardTitle: rewardTitle || null,
        rewardCosmetic: rewardCosmetic || null,
        status: 'ANNOUNCEMENT'
      },
    })

    // Create audit logs
    await prisma.tournamentAuditLog.create({
      data: {
        tournamentId: tournament.id,
        event: 'Tournament Created',
        details: `Official Tournament "${name}" created by Admin.`
      }
    })

    await prisma.tournamentAuditLog.create({
      data: {
        tournamentId: tournament.id,
        event: 'Registration Opened',
        details: `Registration opened from ${new Date(tournament.regStart).toLocaleString()} to ${new Date(tournament.regEnd).toLocaleString()}.`
      }
    })

    return NextResponse.json({ tournament }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/admin/tournaments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      id,
      name,
      description,
      gameSlug,
      type,
      regStart,
      regEnd,
      startDate,
      endDate,
      durationDays,
      maxPlayers,
      bannerUrl,
      rules,
      privacy,
      preferredSplit,
      startTime,
      rewardCoins,
      rewardBadge,
      rewardTitle,
      rewardCosmetic,
      eligibleGames,
      status
    } = body

    if (!id) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    const oldTournament = await prisma.tournament.findUnique({
      where: { id }
    })

    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        name,
        description: description || null,
        gameSlug: gameSlug || undefined,
        type: type || undefined,
        regStart: regStart ? new Date(regStart) : undefined,
        regEnd: regEnd ? new Date(regEnd) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        durationDays: durationDays ? parseInt(durationDays, 10) : undefined,
        maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : undefined,
        bannerUrl: bannerUrl !== undefined ? bannerUrl : undefined,
        rules: rules !== undefined ? rules : undefined,
        privacy: privacy || undefined,
        preferredSplit: preferredSplit || undefined,
        startTime: startTime || undefined,
        eligibleGames: eligibleGames || undefined,
        rewardCoins: rewardCoins !== undefined ? parseInt(rewardCoins, 10) : undefined,
        rewardBadge: rewardBadge !== undefined ? rewardBadge : undefined,
        rewardTitle: rewardTitle !== undefined ? rewardTitle : undefined,
        rewardCosmetic: rewardCosmetic !== undefined ? rewardCosmetic : undefined,
        status: status || undefined
      },
    })

    if (status === 'COMPLETED' && oldTournament && oldTournament.status !== 'COMPLETED') {
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: id,
          event: 'Tournament Completed',
          details: `Tournament status updated to COMPLETED by Admin.`
        }
      })
    }

    return NextResponse.json({ tournament }, { status: 200 })
  } catch (err: unknown) {
    console.error('[PUT /api/admin/tournaments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    await prisma.tournament.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/tournaments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
