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
    const { roomId } = body

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 })
    }

    // Find the player in this room
    const player = await prisma.multiplayerRoomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId,
          userId: profile.userId
        }
      }
    })

    if (!player) {
      return NextResponse.json({ error: 'Player not in this room' }, { status: 404 })
    }

    const nextStatus = player.status === 'READY' ? 'NOT_READY' : 'READY'

    console.log(`[READY] roomId=${roomId}`)
    console.log(`[READY] userId=${profile.userId}`)
    console.log(`[READY] oldStatus=${player.status}`)
    console.log(`[READY] newStatus=${nextStatus}`)

    const updatedPlayer = await prisma.multiplayerRoomPlayer.update({
      where: { id: player.id },
      data: { status: nextStatus }
    })

    // Update last activity on room
    await prisma.multiplayerRoom.update({
      where: { id: roomId },
      data: { lastActivityAt: new Date() }
    })

    return NextResponse.json({ status: updatedPlayer.status }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/toggle-ready]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
