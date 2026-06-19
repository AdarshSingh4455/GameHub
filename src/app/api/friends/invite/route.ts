import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const sender = await getAuthenticatedProfile(request)

    if (!sender) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { targetFriendId, gameSlug, roomCode } = await request.json().catch(() => ({}))

    if (!targetFriendId || !gameSlug || !roomCode) {
      return NextResponse.json({ error: 'Missing targetFriendId, gameSlug, or roomCode' }, { status: 400 })
    }

    // Create invite notification for the friend
    const notification = await prisma.notification.create({
      data: {
        profileId: targetFriendId,
        type: 'ROOM_INVITE',
        title: 'Game Invitation 🎮',
        message: `${sender.username} invited you to play a match of ${gameSlug.replace('-', ' ').toUpperCase()}!`,
        linkUrl: `/dashboard/games/${gameSlug}?roomCode=${roomCode}`,
        meta: { roomCode, gameSlug, senderName: sender.username }
      }
    })

    return NextResponse.json({ success: true, notification }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/friends/invite]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
