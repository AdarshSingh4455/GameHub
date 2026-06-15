import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile, generateRoomCode } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gameSlug } = await request.json().catch(() => ({}))
    if (!gameSlug) {
      return NextResponse.json({ error: 'gameSlug is required' }, { status: 400 })
    }

    // 1. Find a waiting room for the selected game that is not full
    const waitingRooms = await prisma.multiplayerRoom.findMany({
      where: {
        gameSlug,
        status: 'WAITING'
      },
      include: {
        players: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const joinableRoom = waitingRooms.find(r => r.players.length < r.maxPlayers)

    if (joinableRoom) {
      // Check if user is already a player in this room
      const isAlreadyPlayer = joinableRoom.players.some(p => p.userId === profile.userId)
      if (!isAlreadyPlayer) {
        // Add player to the room
        await prisma.multiplayerRoomPlayer.create({
          data: {
            roomId: joinableRoom.id,
            userId: profile.userId,
            status: 'NOT_READY'
          }
        })
      }

      // Update room last activity
      await prisma.multiplayerRoom.update({
        where: { id: joinableRoom.id },
        data: { lastActivityAt: new Date() }
      })

      return NextResponse.json({ roomCode: joinableRoom.roomCode, action: 'joined' }, { status: 200 })
    }

    // 2. Create a new room if none found
    const code = await generateRoomCode()
    const newRoom = await prisma.multiplayerRoom.create({
      data: {
        roomCode: code,
        gameSlug,
        hostUserId: profile.userId,
        maxPlayers: 4, // default max players
        status: 'WAITING',
        players: {
          create: {
            userId: profile.userId,
            status: 'NOT_READY'
          }
        }
      }
    })

    return NextResponse.json({ roomCode: newRoom.roomCode, action: 'created' }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/quick-join]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
