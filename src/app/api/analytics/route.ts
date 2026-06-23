import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { eventName, metadata } = await request.json()
    if (!eventName) {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 })
    }

    let profileId: string | null = null
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    
    if (user) {
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true }
      })
      if (profile) {
        profileId = profile.id
      }
    }

    const event = await prisma.analyticsEvent.create({
      data: {
        profileId,
        eventName,
        metadata: metadata || {}
      }
    })

    return NextResponse.json({ success: true, eventId: event.id })
  } catch (err: unknown) {
    console.error('[POST /api/analytics]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
