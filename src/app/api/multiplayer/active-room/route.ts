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

    const room = activePlayerRoom.room
    const fiveMinutesAgo = new Date(Date.now() - 300000)
    let isAbandoned = room.updatedAt < fiveMinutesAgo

    if (room.status === 'PLAYING') {
      const roomPlayers = await prisma.multiplayerRoomPlayer.findMany({
        where: { roomId: room.id }
      })
      
      const oneMinuteAgo = new Date(Date.now() - 60000)
      const activePlayers = roomPlayers.filter(p => {
        if (p.status === 'LEFT') return false
        if (p.disconnectedAt && p.disconnectedAt < oneMinuteAgo) return false
        return true
      })

      if (activePlayers.length <= 1 && room.updatedAt < oneMinuteAgo) {
        isAbandoned = true
      }
    }

    if (isAbandoned) {
      try {
        await prisma.multiplayerRoomPlayer.update({
          where: { id: activePlayerRoom.id },
          data: { status: 'LEFT' }
        })
      } catch (err) {
        console.error('Failed to update stale room player to LEFT:', err)
      }
      return NextResponse.json({ roomCode: null }, { status: 200 })
    }

    return NextResponse.json({
      roomCode: room.roomCode,
      status: room.status,
      gameSlug: room.gameSlug,
      roomId: room.id
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/active-room]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
