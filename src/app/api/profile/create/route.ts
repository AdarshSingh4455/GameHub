import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { Role } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { userId, username } = await request.json()

    if (!userId || !username) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Check username uniqueness
    const existing = await prisma.profile.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }

    // Securely check email from session for role elevation
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    let role: Role = Role.USER
    if (user && user.id === userId && user.email && user.email.toLowerCase() === 'adarsh004455@gmail.com') {
      role = Role.SUPER_ADMIN
    }

    const { getUniqueFriendCode } = await import('@/lib/utils')
    const friendCode = await getUniqueFriendCode()

    const profile = await prisma.profile.create({
      data: {
        userId,
        username,
        role,
        friendCode,
        preferences: { create: {} },
      },
    })

    return NextResponse.json({ profile }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/profile/create]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
