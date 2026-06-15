import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { isRateLimited } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      console.log('[JOIN-ROOM] Unauthorized — no profile found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limit check: max 12 joins per minute
    if (isRateLimited(profile.userId, 'join-room', 12)) {
      console.log(`[JOIN-ROOM] Rate limited userId=${profile.userId}`)
      return NextResponse.json(
        { error: 'Too many join attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { roomCode } = body
    console.log(`[JOIN-ROOM] Request from userId=${profile.userId} roomCode=${roomCode}`)

    if (!roomCode || typeof roomCode !== 'string' || roomCode.trim() === '' || roomCode.toLowerCase() === 'undefined') {
      return NextResponse.json({ error: 'roomCode is required' }, { status: 400 })
    }

    const normalizedCode = roomCode.trim().toUpperCase()

    // 1. Fetch room with current players
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: normalizedCode },
      include: {
        players: true
      }
    })

    if (!room) {
      console.log(`[JOIN-ROOM] Room not found: ${normalizedCode}`)
      return NextResponse.json({ error: 'Invalid room code' }, { status: 404 })
    }

    // 2. Security validation checks
    if (room.status !== 'WAITING') {
      console.log(`[JOIN-ROOM] Room not WAITING (status=${room.status})`)
      return NextResponse.json({ error: 'Active game in progress' }, { status: 400 })
    }

    const isAlreadyPlayer = room.players.some(p => p.userId === profile.userId)
    if (isAlreadyPlayer) {
      console.log(`[JOIN-ROOM] userId=${profile.userId} already in room, returning existing`)
      return NextResponse.json({ roomCode: room.roomCode }, { status: 200 })
    }

    if (room.players.length >= room.maxPlayers) {
      console.log(`[JOIN-ROOM] Room full (${room.players.length}/${room.maxPlayers})`)
      return NextResponse.json({ error: 'Room is full' }, { status: 400 })
    }

    // 3. Join player
    await prisma.multiplayerRoomPlayer.create({
      data: {
        roomId: room.id,
        userId: profile.userId,
        status: 'NOT_READY'
      }
    })
    console.log(`[JOIN-ROOM] ✓ userId=${profile.userId} joined room ${normalizedCode}`)

    // Update lastActivityAt on room
    await prisma.multiplayerRoom.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date() }
    })

    return NextResponse.json({ roomCode: room.roomCode }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/join-room]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
