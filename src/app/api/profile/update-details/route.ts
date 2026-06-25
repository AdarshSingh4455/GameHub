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

    const { username, displayName, avatarUrl } = await request.json()

    // Fetch profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const updateData: { username?: string; displayName?: string | null; avatarUrl?: string | null } = {}

    // Username update
    if (username !== undefined) {
      const trimmedUsername = username.trim().toLowerCase()
      if (!trimmedUsername) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 })
      }
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        return NextResponse.json({ error: 'Username must be between 3 and 20 characters' }, { status: 400 })
      }
      if (!/^[a-z0-9_]+$/.test(trimmedUsername)) {
        return NextResponse.json({ error: 'Username can only contain alphanumeric characters and underscores' }, { status: 400 })
      }
      if (trimmedUsername !== profile.username) {
        // Check availability
        const existing = await prisma.profile.findUnique({
          where: { username: trimmedUsername }
        })
        if (existing) {
          return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
        }
        updateData.username = trimmedUsername
      }
    }

    // Display Name update (non-unique, editable, max 25 chars)
    if (displayName !== undefined) {
      const trimmedDisplayName = displayName.trim()
      if (trimmedDisplayName.length > 25) {
        return NextResponse.json({ error: 'Display name must be 25 characters or less' }, { status: 400 })
      }
      updateData.displayName = trimmedDisplayName || null
    }

    // Profile picture/Avatar URL update
    if (avatarUrl !== undefined) {
      const trimmedAvatarUrl = avatarUrl.trim()
      updateData.avatarUrl = trimmedAvatarUrl || null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, message: 'No changes submitted' }, { status: 200 })
    }

    // Update in database
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: updateData
    })

    // If username updated, sync Supabase auth user metadata
    if (updateData.username) {
      const { error: supabaseError } = await supabase.auth.updateUser({
        data: { username: updateData.username }
      })
      if (supabaseError) {
        console.warn('[update-details] Failed to sync Supabase metadata:', supabaseError)
      }

      await prisma.analyticsEvent.create({
        data: {
          profileId: profile.id,
          eventName: 'username_changed',
          metadata: {
            oldUsername: profile.username,
            newUsername: updateData.username
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      profile: {
        username: updatedProfile.username,
        displayName: updatedProfile.displayName,
        avatarUrl: updatedProfile.avatarUrl
      }
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[POST /api/profile/update-details]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
