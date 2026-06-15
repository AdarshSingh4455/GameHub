import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateRoomCode, getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Cleanup old waiting rooms (older than 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await prisma.multiplayerRoom.deleteMany({
      where: {
        status: 'WAITING',
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    })

    // 2. Parse body
    const body = await request.json().catch(() => ({}))
    const { gameSlug, maxPlayers } = body

    if (!gameSlug) {
      return NextResponse.json({ error: 'gameSlug is required' }, { status: 400 })
    }

    const maxPlayersCount = parseInt(maxPlayers, 10) || 4
    if (maxPlayersCount < 2 || maxPlayersCount > 8) {
      return NextResponse.json({ error: 'maxPlayers must be between 2 and 8' }, { status: 400 })
    }

    // 3. Generate unique room code
    const roomCode = await generateRoomCode()

    // 4. Transaction to create room and add host as first player
    const room = await prisma.$transaction(async (tx) => {
      const newRoom = await tx.multiplayerRoom.create({
        data: {
          roomCode,
          gameSlug,
          hostUserId: profile.userId,
          maxPlayers: maxPlayersCount,
          status: 'WAITING'
        }
      })

      await tx.multiplayerRoomPlayer.create({
        data: {
          roomId: newRoom.id,
          userId: profile.userId,
          status: 'NOT_READY'
        }
      })

      return newRoom
    })

    return NextResponse.json({ roomCode: room.roomCode }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/create-room]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
