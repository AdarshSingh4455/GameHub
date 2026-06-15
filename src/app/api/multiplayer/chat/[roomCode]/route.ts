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
      return NextResponse.json({ error: 'Room code is required' }, { status: 400 })
    }

    const normalizedCode = roomCode.trim().toUpperCase()

    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: normalizedCode }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify caller belongs to the room
    const player = await prisma.multiplayerRoomPlayer.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: profile.userId
        }
      }
    })

    if (!player) {
      return NextResponse.json({ error: 'Access denied: You are not in this room' }, { status: 403 })
    }

    // Fetch messages (e.g., last 50 messages)
    const messages = await prisma.multiplayerChatMessage.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        profile: {
          select: {
            username: true,
            avatarUrl: true
          }
        }
      }
    })

    const formattedMessages = messages.map(m => ({
      id: m.id,
      userId: m.userId,
      message: m.message,
      createdAt: m.createdAt,
      username: m.profile.username,
      avatarUrl: m.profile.avatarUrl
    }))

    return NextResponse.json({ messages: formattedMessages }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/chat/[roomCode]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
