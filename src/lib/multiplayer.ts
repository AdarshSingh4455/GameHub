import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export function randomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function generateRoomCode(): Promise<string> {
  let code = ''
  let attempts = 0
  let isUnique = false

  while (!isUnique && attempts < 100) {
    code = randomCode()
    const existing = await prisma.multiplayerRoom.findUnique({
      where: { roomCode: code }
    })
    if (!existing) {
      isUnique = true
    }
    attempts++
  }

  if (!isUnique) {
    throw new Error('Failed to generate a unique room code after many attempts')
  }

  return code
}

export async function getAuthenticatedProfile(request: Request) {
  let userId: string | undefined
  let username: string | undefined

  if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    // Read from cookies in the request headers
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const eqIdx = c.indexOf('=')
        if (eqIdx === -1) return [c.trim(), '']
        const name = c.substring(0, eqIdx).trim()
        const value = c.substring(eqIdx + 1).trim()
        return [name, decodeURIComponent(value)]
      })
    )

    userId = cookies['mock_user_id'] || 'mock-user-id'
    username = cookies['mock_username'] || 'Adarsh'
  } else {
    // Normal auth
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      username = user.user_metadata?.username || user.email?.split('@')[0] || 'Player'
    }
  }

  if (!userId) {
    return null
  }

  // Find or create the profile in the database
  let profile = await prisma.profile.findUnique({
    where: { userId }
  })

  if (!profile) {
    // Generate unique username if needed
    let finalUsername = username || 'Player'
    const existing = await prisma.profile.findUnique({
      where: { username: finalUsername }
    })
    if (existing && existing.userId !== userId) {
      finalUsername = `${finalUsername}_${Math.floor(Math.random() * 1000)}`
    }

    try {
      profile = await prisma.profile.create({
        data: {
          userId,
          username: finalUsername,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${finalUsername}`,
          isGuest: userId.startsWith('mock-') || userId === 'mock-user-id',
          coins: 100,
          xp: 0,
          level: 1
        }
      })
    } catch (err: any) {
      if (err.code === 'P2002') {
        profile = await prisma.profile.findUnique({
          where: { userId }
        })
      }
      if (!profile) throw err
    }
  } else if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production' && username && profile.username !== username) {
    // In mock mode, always sync the username from the cookie so E2E tests are consistent
    try {
      profile = await prisma.profile.update({
        where: { userId },
        data: { username }
      })
    } catch {
      // If username conflicts with another user, keep existing name
    }
  }

  return profile
}
