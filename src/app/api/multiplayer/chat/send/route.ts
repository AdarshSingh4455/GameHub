import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { isRateLimited } from '@/lib/rateLimit'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: max 30 chat messages per minute
    if (isRateLimited(profile.userId, 'chat', 30)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { roomCode, message } = await request.json().catch(() => ({}))
    if (!roomCode || !message) {
      return NextResponse.json({ error: 'roomCode and message are required' }, { status: 400 })
    }

    const cleanMsg = message.trim()
    if (!cleanMsg) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    if (cleanMsg.length > 200) {
      return NextResponse.json({ error: 'Message cannot exceed 200 characters' }, { status: 400 })
    }

    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: roomCode.toUpperCase().trim() },
      include: { players: true }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify sender is in room
    const isInRoom = room.players.some(p => p.userId === profile.userId)
    if (!isInRoom) {
      return NextResponse.json({ error: 'You are not a member of this room' }, { status: 403 })
    }

    // Save message
    const chatMsg = await prisma.multiplayerChatMessage.create({
      data: {
        roomId: room.id,
        userId: profile.userId,
        message: cleanMsg
      }
    })

    // Update lastActivityAt on room to prevent expiry
    await prisma.multiplayerRoom.update({
      where: { id: room.id },
      data: { lastActivityAt: new Date() }
    })

    return NextResponse.json({ success: true, messageId: chatMsg.id }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/chat/send]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
