import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomCode } = await params
    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 })
    }

    const normalizedCode = roomCode.trim().toUpperCase()

    // 1. Fetch room with players and gameSession
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
                displayName: true,
                selectedFrame: true,
                selectedTitle: true
              }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        gameSession: true
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 2. Validate that requester belongs to the room
    const isPlayer = room.players.some(p => p.userId === profile.userId)
    if (!isPlayer) {
      return NextResponse.json({ error: 'Access denied: You are not in this room' }, { status: 403 })
    }

    if (!room.gameSession) {
      return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
    }

    // Redact Hand Cricket moves if not revealed yet
    let redactedGameState = JSON.parse(JSON.stringify(room.gameSession.gameState))
    if (room.gameSlug === 'cricket' && redactedGameState && redactedGameState.moves) {
      const moves = redactedGameState.moves
      const redactedMoves: Record<string, any> = {}
      for (const [uId, moveVal] of Object.entries(moves)) {
        if (uId === profile.userId) {
          redactedMoves[uId] = moveVal
        } else if (moveVal !== null && moveVal !== undefined) {
          redactedMoves[uId] = 'SUBMITTED'
        }
      }
      redactedGameState.moves = redactedMoves
    }

    const playersList = room.players.map(p => ({
      id: p.id,
      userId: p.userId,
      status: p.status,
      joinedAt: p.joinedAt,
      username: p.profile.username,
      avatarUrl: p.profile.avatarUrl,
      level: p.profile.level
    }))

    console.log(`[API GET /game] roomCode=${normalizedCode} currentTurn=${room.gameSession.currentTurn} gameState=${JSON.stringify(redactedGameState)}`)

    return NextResponse.json({
      room: {
        id: room.id,
        roomCode: room.roomCode,
        gameSlug: room.gameSlug,
        hostUserId: room.hostUserId,
        status: room.status
      },
      gameSession: {
        id: room.gameSession.id,
        roomId: room.gameSession.roomId,
        gameSlug: room.gameSession.gameSlug,
        status: room.gameSession.status,
        gameState: redactedGameState,
        currentTurn: room.gameSession.currentTurn,
        winnerId: room.gameSession.winnerId,
        lastActivityAt: room.gameSession.lastActivityAt
      },
      players: playersList
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/game/[roomCode]]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 })
  }
}
