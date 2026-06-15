import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')?.trim().toLowerCase()

    if (!username) {
      return NextResponse.json({ error: 'Missing username' }, { status: 400 })
    }

    if (username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ available: false }, { status: 200 })
    }

    // Get current user's profile to allow their own username
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { username: true }
    })

    if (currentProfile?.username === username) {
      return NextResponse.json({ available: true }, { status: 200 })
    }

    const existing = await prisma.profile.findUnique({
      where: { username },
      select: { id: true }
    })

    return NextResponse.json({ available: !existing }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/profile/check-username]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
