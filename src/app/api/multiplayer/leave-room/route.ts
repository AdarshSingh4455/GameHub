import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { roomId, forceClearAll } = body

    if (forceClearAll || !roomId) {
      const activeMappings = await prisma.multiplayerRoomPlayer.findMany({
        where: {
          userId: profile.userId
        }
      })

      for (const mapping of activeMappings) {
        await prisma.multiplayerRoomPlayer.delete({
          where: { id: mapping.id }
        }).catch(() => null)

        const remaining = await prisma.multiplayerRoomPlayer.count({
          where: { roomId: mapping.roomId }
        })
        if (remaining === 0) {
          await prisma.multiplayerRoom.delete({
            where: { id: mapping.roomId }
          }).catch(() => null)
        }
      }

      return NextResponse.json({ success: true, clearedCount: activeMappings.length }, { status: 200 })
    }

    // Check if player is in the room
    const player = await prisma.multiplayerRoomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: profile.userId
        }
      }
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not in this room' }, { status: 400 })
    }

    // 1. Remove player
    await prisma.multiplayerRoomPlayer.delete({
      where: { id: player.id }
    })

    // 2. Fetch room to inspect remaining players
    const room = await prisma.multiplayerRoom.findUnique({
      where: { id: roomId },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' }
        }
      }
    })

    if (room) {
      if (room.players.length === 0) {
        // Delete empty room
        await prisma.multiplayerRoom.delete({
          where: { id: roomId }
        })
      } else if (room.hostUserId === profile.userId) {
        // Host left. Transfer host to oldest remaining player (first one in joinedAt asc order)
        const oldestPlayer = room.players[0]
        await prisma.multiplayerRoom.update({
          where: { id: roomId },
          data: {
            hostUserId: oldestPlayer.userId,
            lastActivityAt: new Date()
          }
        })
      } else {
        // Normal player left, update room activity
        await prisma.multiplayerRoom.update({
          where: { id: roomId },
          data: { lastActivityAt: new Date() }
        })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/leave-room]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
