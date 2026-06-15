import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

// GET /api/multiplayer/notifications — Fetch user notifications
export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbProfile = await prisma.profile.findUnique({
      where: { userId: profile.userId }
    })

    if (!dbProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        profileId: dbProfile.id
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    return NextResponse.json({ notifications }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/multiplayer/notifications]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/multiplayer/notifications — Mark read or delete/decline notification
export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbProfile = await prisma.profile.findUnique({
      where: { userId: profile.userId }
    })

    if (!dbProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { notificationId, action } = await request.json().catch(() => ({}))
    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
    }

    const notif = await prisma.notification.findUnique({
      where: { id: notificationId }
    })

    if (!notif || notif.profileId !== dbProfile.id) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    if (action === 'decline' || action === 'delete') {
      // If invite, update the MultiplayerInvite table
      const metaObj = notif.meta as any
      console.log('[NOTIFICATIONS POST] action=decline/delete, notif.id=', notificationId, 'meta=', JSON.stringify(metaObj))
      if (metaObj && metaObj.roomCode) {
        const room = await prisma.multiplayerRoom.findUnique({
          where: { roomCode: metaObj.roomCode }
        })
        console.log('[NOTIFICATIONS POST] room found:', !!room, 'receiverId=', profile.userId)
        if (room) {
          const updated = await prisma.multiplayerInvite.updateMany({
            where: {
              roomId: room.id,
              receiverId: profile.userId,
              status: 'PENDING'
            },
            data: { status: 'DECLINED' }
          })
          console.log('[NOTIFICATIONS POST] multiplayerInvite updated count:', updated.count)
        }
      }

      // Delete the notification (remove from notification center)
      await prisma.notification.delete({
        where: { id: notificationId }
      })
    } else {
      // Default action: mark as read
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/notifications]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
