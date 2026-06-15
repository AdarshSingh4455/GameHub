import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const gameSlug = searchParams.get('gameSlug')

    if (!gameSlug) {
      return NextResponse.json({ error: 'gameSlug parameter is required' }, { status: 400 })
    }

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        ads: [
          {
            id: 'mock-ad-1',
            imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=300&auto=format&fit=crop',
            targetUrl: 'https://google.com',
            durationSecs: 3,
            allGames: true,
            active: true,
          }
        ]
      }, { status: 200 })
    }

    // Find active ads that target either all games or specifically this game
    const ads = await prisma.ad.findMany({
      where: {
        active: true,
        OR: [
          { allGames: true },
          { games: { has: gameSlug } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 5 // Max 5 active ads per game
    })

    return NextResponse.json({ ads }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/ads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, adId } = body

    if (!adId || !['impression', 'click'].includes(action)) {
      return NextResponse.json({ error: 'adId and valid action (impression/click) are required' }, { status: 400 })
    }

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ success: true, impressions: 1, clicks: 0 }, { status: 200 })
    }

    if (action === 'impression') {
      const updatedAd = await prisma.ad.update({
        where: { id: adId },
        data: {
          impressions: {
            increment: 1
          }
        }
      })
      return NextResponse.json({ success: true, impressions: updatedAd.impressions })
    } else if (action === 'click') {
      const updatedAd = await prisma.ad.update({
        where: { id: adId },
        data: {
          clicks: {
            increment: 1
          }
        }
      })
      return NextResponse.json({ success: true, clicks: updatedAd.clicks })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[POST /api/ads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
