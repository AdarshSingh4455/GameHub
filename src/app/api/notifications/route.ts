import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({ success: true, notifications }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/notifications]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, id } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    if (action === 'markRead') {
      if (!id) return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      })
      return NextResponse.json({ success: true, notification: updated }, { status: 200 })
    }

    if (action === 'markAllRead') {
      await prisma.notification.updateMany({
        where: { profileId: profile.id, isRead: false },
        data: { isRead: true }
      })
      return NextResponse.json({ success: true }, { status: 200 })
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ error: 'Missing notification id' }, { status: 400 })
      await prisma.notification.delete({
        where: { id }
      })
      return NextResponse.json({ success: true }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    console.error('[POST /api/notifications]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
