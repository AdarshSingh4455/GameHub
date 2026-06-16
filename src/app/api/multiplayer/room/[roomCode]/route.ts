import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    if (!roomCode) {
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    const normalizedCode = roomCode.trim().toUpperCase()

    // 1. Fetch room with players and their profiles
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: normalizedCode },
      include: {
        players: {
          include: {
            profile: {
              select: {
                username: true,
                avatarUrl: true,
                level: true,
                lastSeenAt: true
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 2. Fetch host profile details
    const hostProfile = await prisma.profile.findUnique({
      where: { userId: room.hostUserId },
      select: {
        id: true,
        userId: true,
        username: true,
        avatarUrl: true,
        level: true,
        lastSeenAt: true
      }
    })

    // 3. Format players response
    const players = room.players.map(p => ({
      id: p.id,
      userId: p.userId,
      status: p.disconnectedAt ? 'DISCONNECTED' : p.status, // READY, NOT_READY, DISCONNECTED, LEFT
      joinedAt: p.joinedAt,
      username: p.profile.username,
      avatarUrl: p.profile.avatarUrl,
      level: p.profile.level,
      lastSeenAt: p.profile.lastSeenAt
    }))

    console.log(`[ROOM POLL] roomCode=${normalizedCode}`)
    players.forEach(p => {
      console.log(`  - player: userId=${p.userId} readyStatus=${p.status}`)
    })
    const playerCount = players.length
    const allPlayersReady = players.length > 0 && players.every(p => p.status === 'READY')
    console.log(`[ROOM POLL] allPlayersReady=${allPlayersReady} playerCount=${playerCount} hostUserId=${room.hostUserId}`)

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameSlug: room.gameSlug,
        hostUserId: room.hostUserId,
        status: room.status,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt
      },
      host: hostProfile,
      players,
      status: room.status
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/room/[roomCode]]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
