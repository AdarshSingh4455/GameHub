import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { username } = await request.json()
    const trimmedUsername = username?.trim().toLowerCase()

    if (!trimmedUsername) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }

    // Validation checks
    if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
      return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
    }

    if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
      return NextResponse.json({ error: 'Username can only contain alphanumeric characters and underscores' }, { status: 400 })
    }

    // Check if profile exists for current user
    const currentProfile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // If username is unchanged, return success immediately
    if (currentProfile.username === trimmedUsername) {
      return NextResponse.json({ success: true, message: 'Username is unchanged' }, { status: 200 })
    }

    // Check if the username is already taken by another profile
    const existing = await prisma.profile.findUnique({
      where: { username: trimmedUsername }
    })

    if (existing) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
    }

    // Update username in transaction/sequence
    // 1. Update Prisma Profile
    await prisma.profile.update({
      where: { id: currentProfile.id },
      data: { username: trimmedUsername }
    })

    // 2. Update Supabase Auth User Metadata
    const { error: supabaseError } = await supabase.auth.updateUser({
      data: { username: trimmedUsername }
    })

    if (supabaseError) {
      console.warn('[update-username] Failed to sync Supabase metadata:', supabaseError)
      // We don't fail the request since database profile was updated successfully
    }

    // Log analytics event for username change
    await prisma.analyticsEvent.create({
      data: {
        profileId: currentProfile.id,
        eventName: 'username_changed',
        metadata: {
          oldUsername: currentProfile.username,
          newUsername: trimmedUsername
        }
      }
    })

    return NextResponse.json({ success: true, username: trimmedUsername }, { status: 200 })

  } catch (err: unknown) {
    console.error('[POST /api/profile/update-username]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
