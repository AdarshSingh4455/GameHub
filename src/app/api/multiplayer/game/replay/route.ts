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
    const { roomCode } = body

    if (!roomCode) {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 })
    }

    // 1. Fetch room with players
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: roomCode.trim().toUpperCase() },
      include: {
        players: true
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // 2. Validate player is in room
    const isPlayer = room.players.some(p => p.userId === profile.userId)
    if (!isPlayer) {
      return NextResponse.json({ error: 'You are not a player in this room' }, { status: 403 })
    }

    // 3. Process replay vote with optimistic concurrency control (OCC)
    let attempts = 0
    const maxAttempts = 10
    let updatedSession = null

    while (attempts < maxAttempts) {
      attempts++

      // Fetch the latest session to get the most up-to-date gameState and updatedAt
      const session = await prisma.multiplayerGameSession.findUnique({
        where: { roomId: room.id }
      })

      if (!session) {
        return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
      }

      const playerIds = room.players.map(p => p.userId)
      const currentGameState = JSON.parse(JSON.stringify(session.gameState))

      if (!currentGameState.replayVotes) {
        currentGameState.replayVotes = {}
      }

      // Register vote
      currentGameState.replayVotes[profile.userId] = true
      console.log(`[REPLAY VOTE] Vote registered (attempt ${attempts}). roomId=${room.id} userId=${profile.userId} votes=${JSON.stringify(currentGameState.replayVotes)}`)

      const votesCount = Object.keys(currentGameState.replayVotes).filter(k => currentGameState.replayVotes[k] === true).length

      let updatedStatus = session.status
      let updatedWinnerId = session.winnerId
      let updatedTurn = session.currentTurn
      let finalGameState = currentGameState

      if (votesCount === 2) {
        console.log(`[REPLAY RESET] Both players voted to replay (attempt ${attempts}). Resetting match state for roomCode=${roomCode}`)
        // Reset game
        updatedStatus = 'PLAYING'
        updatedWinnerId = null

        const profiles = await prisma.profile.findMany({
          where: { userId: { in: playerIds } }
        })
        const getUsername = (uid: string) => profiles.find(p => p.userId === uid)?.username || 'Player'

        if (room.gameSlug === 'cricket') {
          const tossWinnerId = playerIds[Math.floor(Math.random() * playerIds.length)]
          updatedTurn = tossWinnerId

          const p1 = room.players[0]
          const p2 = room.players[1]
          const tossWinnerUsername = getUsername(tossWinnerId)

          finalGameState = {
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
            commentary: [`🪙 New Match! Toss won by ${tossWinnerUsername}. Waiting for their choice.`],
            replayVotes: {}
          }
        } else if (room.gameSlug === 'dots-boxes') {
          updatedTurn = playerIds[Math.floor(Math.random() * playerIds.length)]

          finalGameState = {
            horizontalLines: [],
            verticalLines: [],
            completedBoxes: [],
            playerScores: playerIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {}),
            currentTurn: updatedTurn,
            replayVotes: {}
          }
        }
      }

      const now = new Date()
      // Perform optimistic update
      const updateResult = await prisma.multiplayerGameSession.updateMany({
        where: {
          id: session.id,
          updatedAt: session.updatedAt
        },
        data: {
          status: updatedStatus,
          winnerId: updatedWinnerId,
          currentTurn: updatedTurn,
          gameState: finalGameState,
          lastActivityAt: now,
          updatedAt: now
        }
      })

      if (updateResult.count === 1) {
        // Succeeded! Fetch the updated session to return
        updatedSession = await prisma.multiplayerGameSession.findUnique({
          where: { id: session.id }
        })
        break
      }

      console.warn(`[REPLAY VOTE] Optimistic lock conflict (attempt ${attempts}) for roomId=${room.id}. Retrying...`)
      // Wait for a short, randomized delay before retrying
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
    }

    if (!updatedSession) {
      return NextResponse.json({ error: 'Failed to update replay vote due to concurrent modifications' }, { status: 409 })
    }

    const result = { session: updatedSession }

    return NextResponse.json(result, { status: 200 })

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/game/replay]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 })
  }
}
