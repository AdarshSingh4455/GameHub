import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find any room where the player is currently registered,
    // the room status is STARTING or PLAYING,
    // and the player's status is NOT LEFT.
    const activePlayerRoom = await prisma.multiplayerRoomPlayer.findFirst({
      where: {
        userId: profile.userId,
        status: {
          not: 'LEFT'
        },
        room: {
          status: {
            in: ['WAITING', 'STARTING', 'PLAYING']
          }
        }
      },
      include: {
        room: {
          include: {
            gameSession: true
          }
        }
      }
    })

    if (!activePlayerRoom || !activePlayerRoom.room) {
      return NextResponse.json({ roomCode: null }, { status: 200 })
    }

    return NextResponse.json({
      roomCode: activePlayerRoom.room.roomCode,
      status: activePlayerRoom.room.status,
      gameSlug: activePlayerRoom.room.gameSlug,
      roomId: activePlayerRoom.room.id
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/active-room]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
