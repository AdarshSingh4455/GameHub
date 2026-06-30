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
    let isAbandoned = false

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
    } else if (room.status === 'WAITING') {
      // For waiting lobbies, only consider abandoned if it's older than 30 minutes, 
      // or if the host is no longer active (lastSeenAt is older than 5 minutes)
      const hostProfile = await prisma.profile.findUnique({
        where: { userId: room.hostUserId }
      })
      const hostLastSeen = hostProfile?.lastSeenAt ? new Date(hostProfile.lastSeenAt).getTime() : 0
      const isHostActive = (Date.now() - hostLastSeen) < 300000 // 5 minutes
      
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
      if (room.createdAt < thirtyMinutesAgo && !isHostActive) {
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
