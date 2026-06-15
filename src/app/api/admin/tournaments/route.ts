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
    const { name, description, startDate, endDate, eligibleGames, rewardCoins, rewardBadge, rewardTitle, rewardCosmetic } = body

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Name, Start Date, and End Date are required' }, { status: 400 })
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        eligibleGames: eligibleGames || [],
        rewardCoins: parseInt(rewardCoins, 10) || 0,
        rewardBadge: rewardBadge || null,
        rewardTitle: rewardTitle || null,
        rewardCosmetic: rewardCosmetic || null,
      },
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
    const { id, name, description, startDate, endDate, eligibleGames, rewardCoins, rewardBadge, rewardTitle, rewardCosmetic } = body

    if (!id) {
      return NextResponse.json({ error: 'Tournament ID is required' }, { status: 400 })
    }

    const tournament = await prisma.tournament.update({
      where: { id },
      data: {
        name,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        eligibleGames: eligibleGames || [],
        rewardCoins: parseInt(rewardCoins, 10) || 0,
        rewardBadge: rewardBadge || null,
        rewardTitle: rewardTitle || null,
        rewardCosmetic: rewardCosmetic || null,
      },
    })

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
