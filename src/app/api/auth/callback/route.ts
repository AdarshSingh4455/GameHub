import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(request: NextRequest) {
  console.log('[auth-callback] GET request initiated.')
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    console.error('[auth-callback] Missing code query parameter.')
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  // 1. Initialize Response first
  const response = NextResponse.redirect(`${origin}${next}`)

  try {
    console.log('[auth-callback] Initializing Supabase client with Next.js 15 cookies() store...')
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch (err) {
              console.error('[auth-callback] Error setting cookies in setAll:', err)
            }
          },
        },
      }
    )

    // 2. Exchange OAuth code for a session
    console.log('[auth-callback] Step 1: Exchanging authorization code for session...')
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.error('[auth-callback] Step 1: Exchange code for session failed.', sessionError)
      return NextResponse.redirect(`${origin}/login?error=exchange_code_failed`)
    }
    console.log('[auth-callback] Step 1: Exchange code for session succeeded.')

    // 3. Retrieve authenticated user securely
    console.log('[auth-callback] Step 2: Retrieving authenticated user...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[auth-callback] Step 2: Retrieve user failed.', userError || 'User object is null')
      return NextResponse.redirect(`${origin}/login?error=retrieve_user_failed`)
    }
    console.log(`[auth-callback] Step 2: Retrieve user succeeded. User ID: ${user.id}, Email: ${user.email}`)

    if (!user.email) {
      console.error('[auth-callback] Step 2: User email is empty.')
      return NextResponse.redirect(`${origin}/login?error=missing_email`)
    }

    const userId = user.id
    const email = user.email
    
    // Determine Server-Side Secure Role Elevation
    let role: Role = Role.USER
    if (email.toLowerCase() === 'adarsh004455@gmail.com') {
      role = Role.SUPER_ADMIN
    } else if (email.toLowerCase() === 'admin@gamehub.dev') {
      role = Role.ADMIN
    }

    // 4. Check if database profile already exists
    console.log('[auth-callback] Step 3: Checking if database profile exists for user ID:', userId)
    const existingProfile = await prisma.profile.findUnique({
      where: { userId },
    })
    console.log('[auth-callback] Step 3: Profile lookup completed. Found:', !!existingProfile)

    if (!existingProfile) {
      console.log('[auth-callback] Step 4: Auto-creating database profile for OAuth user...')
      let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
      if (baseUsername.length < 3) {
        baseUsername = 'user_' + baseUsername
      }
      if (baseUsername.length > 20) {
        baseUsername = baseUsername.slice(0, 20)
      }

      let username = baseUsername
      let count = 1
      let isUnique = false

      while (!isUnique) {
        const existingUser = await prisma.profile.findUnique({
          where: { username },
        })
        if (!existingUser) {
          isUnique = true
        } else {
          const suffix = count.toString()
          const maxBaseLen = 20 - suffix.length
          username = baseUsername.slice(0, maxBaseLen) + suffix
          count++
        }
      }

      const { getUniqueFriendCode } = await import('@/lib/utils')
      const friendCode = await getUniqueFriendCode()

      try {
        const newProfile = await prisma.profile.create({
          data: {
            userId,
            username,
            role,
            friendCode,
            preferences: { create: {} },
          },
        })
        console.log('[auth-callback] Step 4: Profile created successfully:', newProfile.id)
      } catch (createError: any) {
        console.error('[auth-callback] Step 4: Profile creation failed!')
        console.error('[auth-callback] Creation Error Stack:', createError.stack || createError)
        throw createError
      }
    } else {
      // Update role securely on the server-side if it differs
      if (existingProfile.role !== role) {
        console.log(`[auth-callback] Step 4: Updating profile role from ${existingProfile.role} to ${role}...`)
        try {
          await prisma.profile.update({
            where: { id: existingProfile.id },
            data: { role },
          })
          console.log('[auth-callback] Step 4: Profile role updated successfully.')
        } catch (updateError: any) {
          console.error('[auth-callback] Step 4: Profile role update failed!')
          console.error('[auth-callback] Update Error Stack:', updateError.stack || updateError)
          throw updateError
        }
      }
    }

    console.log('[auth-callback] Step 5: Handling redirect response...')
    return response

  } catch (error: any) {
    console.error('[auth-callback] UNCAUGHT EXCEPTION inside GET callback:')
    console.error(error.stack || error)
    
    // Safely redirect to login page instead of displaying plain HTTP 500 page
    return NextResponse.redirect(`${origin}/login?error=auth_callback_uncaught_error`)
  }
}

