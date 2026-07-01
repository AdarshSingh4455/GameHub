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
    
    // 1. Exact username match
    let profile = await prisma.profile.findUnique({
      where: { username: searchName }
    })

    // 2. Case-insensitive username match
    if (!profile) {
      const allProfiles = await prisma.profile.findMany()

      profile = allProfiles.find(
        (p: any) => p.username?.toLowerCase() === searchName.toLowerCase()
      ) || null

      // 3. Email match: check if any profile stores the full email
      if (!profile && email) {
        profile = allProfiles.find(
          (p: any) => p.email?.toLowerCase() === email.toLowerCase()
        ) || null
      }

      // 4. Email-prefix match: if user's display name starts with the part before @
      // This handles adarsh004455 -> Adarsh (display name starts with "adarsh")
      if (!profile && email) {
        const emailPrefix = email.split('@')[0].toLowerCase()
        profile = allProfiles.find((p: any) => {
          const uname = (p.username || '').toLowerCase()
          return uname.startsWith(emailPrefix) || emailPrefix.startsWith(uname)
        }) || null
      }
    }

    if (profile) {
      return NextResponse.json({ userId: profile.userId })
    }

    // Stable fallback for genuinely new users
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
