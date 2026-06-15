import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: { lastSeenAt: new Date() },
      select: { id: true }
    })

    return NextResponse.json({ success: true, profileId: updatedProfile.id }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/profile/heartbeat]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

