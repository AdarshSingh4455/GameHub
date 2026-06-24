import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// Helper to check ad limit for targeted games
async function validateAdLimits(
  adId: string | null,
  allGames: boolean,
  games: string[],
  active: boolean
): Promise<string | null> {
  if (!active) return null

  // Fetch all games
  const allDbGames = await prisma.game.findMany({ select: { slug: true } })
  const gameSlugs = allDbGames.map((g) => g.slug)

  // Fetch all other active ads (excluding the current one if updating)
  const activeAds = await prisma.ad.findMany({
    where: {
      active: true,
      id: adId ? { not: adId } : undefined,
    },
  })

  // For each targeted game, calculate how many active ads it currently has
  const gamesToCheck = allGames ? gameSlugs : games

  for (const slug of gamesToCheck) {
    let activeCountForGame = 0

    for (const ad of activeAds) {
      if (ad.allGames || ad.games.includes(slug)) {
        activeCountForGame++
      }
    }

    if (activeCountForGame >= 5) {
      return `Cannot activate ad: Game '${slug}' already has the maximum limit of 5 active ads.`
    }
  }

  return null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user role
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ads = await prisma.ad.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ ads }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/admin/ads]', err)
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
    const { imageUrl, targetUrl, durationSecs, duration_seconds, skip_after_seconds, allGames, games, active } = body

    if (!imageUrl || !targetUrl) {
      return NextResponse.json({ error: 'Image URL and Target URL are required' }, { status: 400 })
    }

    // Validate active ads limit
    const limitError = await validateAdLimits(null, !!allGames, games || [], !!active)
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 400 })
    }

    const ad = await prisma.ad.create({
      data: {
        imageUrl,
        targetUrl,
        durationSecs: parseInt(durationSecs, 10) || 5,
        duration_seconds: parseInt(duration_seconds, 10) || parseInt(durationSecs, 10) || 5,
        skip_after_seconds: parseInt(skip_after_seconds, 10) || 5,
        allGames: !!allGames,
        games: games || [],
        active: active !== undefined ? !!active : true,
      },
    })

    return NextResponse.json({ ad }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/admin/ads]', err)
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
    const { id, imageUrl, targetUrl, durationSecs, duration_seconds, skip_after_seconds, allGames, games, active } = body

    if (!id) {
      return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 })
    }

    // Validate active ads limit
    const limitError = await validateAdLimits(id, !!allGames, games || [], !!active)
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 400 })
    }

    const ad = await prisma.ad.update({
      where: { id },
      data: {
        imageUrl,
        targetUrl,
        durationSecs: parseInt(durationSecs, 10) || 5,
        duration_seconds: parseInt(duration_seconds, 10) || parseInt(durationSecs, 10) || 5,
        skip_after_seconds: parseInt(skip_after_seconds, 10) || 5,
        allGames: !!allGames,
        games: games || [],
        active: active !== undefined ? !!active : true,
      },
    })

    return NextResponse.json({ ad }, { status: 200 })
  } catch (err: unknown) {
    console.error('[PUT /api/admin/ads]', err)
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
      return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 })
    }

    await prisma.ad.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/ads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
