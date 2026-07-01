import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    const email = searchParams.get('email')

    if (!username && !email) {
      return NextResponse.json({ error: 'Missing username or email' }, { status: 400 })
    }

    const searchName = username || email?.split('@')[0] || ''
    
    // First try: Find by exact username in the database
    let profile = await prisma.profile.findUnique({
      where: { username: searchName }
    })

    // Second try: Case-insensitive search if exact find failed
    if (!profile) {
      const allProfiles = await prisma.profile.findMany()
      profile = allProfiles.find(
        (p: any) => p.username?.toLowerCase() === searchName.toLowerCase()
      ) || null
    }

    if (profile) {
      return NextResponse.json({ userId: profile.userId })
    }

    // Default stable fallback if profile does not exist yet (to generate a consistent ID for new users)
    let hash = 0
    const val = email || searchName
    for (let i = 0; i < val.length; i++) {
      hash = (hash << 5) - hash + val.charCodeAt(i)
      hash |= 0
    }
    const mockUserId = `mock-uid-${Math.abs(hash)}`

    return NextResponse.json({ userId: mockUserId })
  } catch (err) {
    console.error('[GET /api/auth/resolve-user]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
