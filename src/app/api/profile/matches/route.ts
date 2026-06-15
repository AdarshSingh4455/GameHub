import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const game = searchParams.get('game') || 'all'
    const result = searchParams.get('result') || 'all'
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    // Build Prisma query filters
    const whereClause: any = {
      OR: [
        { player1Id: profile.id },
        { player2Id: profile.id }
      ]
    }

    // Filter by game
    if (game !== 'all') {
      whereClause.game = { slug: game }
    }

    // Filter by result
    if (result === 'win') {
      whereClause.winnerId = profile.id
    } else if (result === 'loss') {
      whereClause.winnerId = { not: profile.id, notIn: [profile.id] } // won by someone else
      whereClause.NOT = [
        { winnerId: null } // exclude draws/AI draws
      ]
    } else if (result === 'draw') {
      whereClause.winnerId = null
    }

    // Filter by search (opponent name)
    if (search.trim() !== '') {
      whereClause.AND = [
        {
          OR: [
            {
              // Current user is player1, so search player2 username
              player1Id: profile.id,
              player2: {
                username: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            },
            {
              // Current user is player2, so search player1 username
              player2Id: profile.id,
              player1: {
                username: {
                  contains: search,
                  mode: 'insensitive'
                }
              }
            }
          ]
        }
      ]
    }

    // Fetch matches count and records
    const [matches, totalCount] = await prisma.$transaction([
      prisma.matchRecord.findMany({
        where: whereClause,
        orderBy: { playedAt: 'desc' },
        skip,
        take: limit,
        include: {
          game: {
            select: { name: true, slug: true }
          },
          player1: {
            select: { username: true }
          },
          player2: {
            select: { username: true }
          }
        }
      }),
      prisma.matchRecord.count({
        where: whereClause
      })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      matches,
      totalCount,
      totalPages,
      currentPage: page
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/profile/matches]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
