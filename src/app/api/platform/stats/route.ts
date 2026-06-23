import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [
      totalPlayers,
      totalMatches,
      totalGames,
      totalAchievements,
      totalCosmetics,
      totalFriendships
    ] = await Promise.all([
      prisma.profile.count(),
      prisma.matchRecord.count({
        where: {
          roomCode: {
            not: null
          }
        }
      }),
      prisma.game.count(),
      prisma.achievement.count(),
      prisma.cosmeticItem.count(),
      prisma.friendship.count({
        where: {
          status: 'ACCEPTED'
        }
      })
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalPlayers,
        totalMatches, // multiplayer matches
        totalGames,
        totalAchievements,
        totalCosmetics,
        totalFriendConnections: totalFriendships
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (err: unknown) {
    console.error('[GET /api/platform/stats]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
