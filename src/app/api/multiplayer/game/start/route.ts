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
    const { roomCode, roomId } = body

    if (!roomCode && !roomId) {
      return NextResponse.json({ error: 'roomCode or roomId is required' }, { status: 400 })
    }

    // Fetch room with players
    const room = await prisma.multiplayerRoom.findFirst({
      where: roomId ? { id: roomId } : { roomCode: roomCode.trim().toUpperCase() },
      include: { players: true }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check host
    if (room.hostUserId !== profile.userId) {
      return NextResponse.json({ error: 'Only the host can start the game' }, { status: 403 })
    }

    // Check min players
    if (room.players.length < 2) {
      return NextResponse.json({ error: 'Minimum 2 players required' }, { status: 400 })
    }

    const playerIds = room.players.map(p => p.userId)
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: playerIds } }
    })
    const getUsername = (uid: string) => {
      const prof = profiles.find(p => p.userId === uid)
      return prof ? prof.username : 'Player'
    }

    // Initialize game state based on slug
    let initialGameState: any = {}
    let startingTurn: string | null = null

    if (room.gameSlug === 'cricket') {
      // Choose random toss winner
      const tossWinnerId = playerIds[Math.floor(Math.random() * playerIds.length)]
      startingTurn = tossWinnerId

      const p1 = room.players[0]
      const p2 = room.players[1]
      const tossWinnerUsername = getUsername(tossWinnerId)

      initialGameState = {
        stage: 'TOSS',
        tossWinnerId,
        tossChoice: null,
        p1: { userId: p1.userId, username: getUsername(p1.userId) },
        p2: { userId: p2.userId, username: getUsername(p2.userId) },
        innings: 1,
        runs: 0,
        wickets: 0,
        balls: 0,
        maxOvers: 2,
        maxWickets: 3,
        battingUserId: null,
        bowlingUserId: null,
        moves: {},
        history: [],
        commentary: [`🪙 Toss won by ${tossWinnerUsername}. Waiting for their choice.`],
        replayVotes: {}
      }
    } else if (room.gameSlug === 'dots-boxes') {
      startingTurn = playerIds[Math.floor(Math.random() * playerIds.length)]

      initialGameState = {
        horizontalLines: [],
        verticalLines: [],
        completedBoxes: [],
        playerScores: playerIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
        currentTurn: startingTurn,
        replayVotes: {}
      }
    } else {
      return NextResponse.json({ error: `Game slug ${room.gameSlug} not supported` }, { status: 400 })
    }

    // Update room status
    await prisma.multiplayerRoom.update({
      where: { id: room.id },
      data: {
        status: 'PLAYING',
        startedAt: new Date(),
        lastActivityAt: new Date()
      }
    })

    // Upsert session
    const session = await prisma.multiplayerGameSession.upsert({
      where: { roomId: room.id },
      create: {
        roomId: room.id,
        gameSlug: room.gameSlug,
        status: 'PLAYING',
        gameState: initialGameState,
        currentTurn: startingTurn,
        lastActivityAt: new Date()
      },
      update: {
        gameSlug: room.gameSlug,
        status: 'PLAYING',
        gameState: initialGameState,
        currentTurn: startingTurn,
        winnerId: null,
        lastActivityAt: new Date()
      }
    })

    return NextResponse.json({ session }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/game/start]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 })
  }
}
