import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { isRateLimited } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// POST /api/multiplayer/invite — Send an invite
export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate Limit check: max 10 invites per minute
    if (isRateLimited(profile.userId, 'invite', 10)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { friendUserId, roomCode } = await request.json().catch(() => ({}))
    if (!friendUserId || !roomCode) {
      return NextResponse.json({ error: 'friendUserId and roomCode are required' }, { status: 400 })
    }

    // Find the room
    const room = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: roomCode.toUpperCase().trim() },
      include: { players: true }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Verify sender is in the room
    const isSenderInRoom = room.players.some(p => p.userId === profile.userId)
    if (!isSenderInRoom) {
      return NextResponse.json({ error: 'You are not a member of this room' }, { status: 403 })
    }

    // Find friend profile
    const friendProfile = await prisma.profile.findUnique({
      where: { userId: friendUserId }
    })

    if (!friendProfile) {
      return NextResponse.json({ error: 'Friend profile not found' }, { status: 404 })
    }

    // Create or update pending invite
    const invite = await prisma.multiplayerInvite.upsert({
      where: {
        roomId_receiverId_status: {
          roomId: room.id,
          receiverId: friendUserId,
          status: 'PENDING'
        }
      },
      update: {},
      create: {
        roomId: room.id,
        senderId: profile.userId,
        receiverId: friendUserId,
        status: 'PENDING'
      }
    })

    // Create notification for the friend
    const gameName = room.gameSlug === 'cricket' ? 'Hand Cricket' : room.gameSlug === 'dots-boxes' ? 'Dots & Boxes' : room.gameSlug
    
    // Check if notification already exists to avoid spamming
    const existingNotification = await prisma.notification.findFirst({
      where: {
        profileId: friendProfile.id,
        type: 'ROOM_INVITE',
        isRead: false,
        meta: {
          path: ['roomCode'],
          equals: room.roomCode
        }
      }
    })

    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          profileId: friendProfile.id,
          type: 'ROOM_INVITE',
          title: 'Game Lobby Invite 🌐',
          message: `${profile.username} invited you to play ${gameName}!`,
          meta: {
            roomCode: room.roomCode,
            gameSlug: room.gameSlug,
            hostUsername: profile.username
          }
        }
      })
    }

    return NextResponse.json({ success: true, inviteId: invite.id }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/invite]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET /api/multiplayer/invite — List active pending invites for user
export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invites = await prisma.multiplayerInvite.findMany({
      where: {
        receiverId: profile.userId,
        status: 'PENDING'
      },
      include: {
        room: {
          select: {
            roomCode: true,
            gameSlug: true,
            status: true
          }
        },
        sender: {
          select: {
            username: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Filter out invites for rooms that are no longer active/waiting
    const activeInvites = invites.filter(inv => inv.room && inv.room.status === 'WAITING')

    return NextResponse.json({ invites: activeInvites }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/invite]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/multiplayer/invite — Decline an invite by inviteId (fallback)
export async function DELETE(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { inviteId } = await request.json().catch(() => ({}))
    if (!inviteId) {
      return NextResponse.json({ error: 'inviteId is required' }, { status: 400 })
    }

    console.log(`[DELETE /api/multiplayer/invite] inviteId=${inviteId} userId=${profile.userId}`)

    const updated = await prisma.multiplayerInvite.updateMany({
      where: {
        id: inviteId,
        receiverId: profile.userId,
        status: 'PENDING'
      },
      data: { status: 'DECLINED' }
    })

    console.log(`[DELETE /api/multiplayer/invite] updated count=${updated.count}`)

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Invite not found or already handled' }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[DELETE /api/multiplayer/invite]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
