import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // 1. Create a redirect response object first
    const response = NextResponse.redirect(`${origin}${next}`)

    // 2. Initialize Supabase client linked directly to the request and response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // 3. Exchange OAuth code for a session
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError) {
      // 4. Retrieve authenticated user securely
      const { data: { user } } = await supabase.auth.getUser()

      if (user && user.email) {
        const userId = user.id
        const email = user.email
        
        // 5. Determine Server-Side Secure Role Elevation
        let role: Role = Role.USER
        if (email.toLowerCase() === 'adarsh004455@gmail.com') {
          role = Role.SUPER_ADMIN
        } else if (email.toLowerCase() === 'admin@gamehub.dev') {
          role = Role.ADMIN
        }

        // 6. Check if database profile already exists
        const existingProfile = await prisma.profile.findUnique({
          where: { userId },
        })

        if (!existingProfile) {
          // 7. Auto-create database profile for OAuth user
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

          await prisma.profile.create({
            data: {
              userId,
              username,
              role,
              friendCode,
              preferences: { create: {} },
            },
          })
        } else {
          // 8. Update role securely on the server-side if it differs
          if (existingProfile.role !== role) {
            await prisma.profile.update({
              where: { id: existingProfile.id },
              data: { role },
            })
          }
        }

        return response
      }
    }
  }

  // Redirect to login page on callback failure
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
