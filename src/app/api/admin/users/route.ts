import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user role
    const profile = await prisma.profile.findUnique({
      where: { userId: currentUser.id },
      select: { role: true }
    })

    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all profiles from prisma (source of truth), including game stats
    const profiles = await prisma.profile.findMany({
      include: {
        gameStats: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Fetch auth users using raw SQL query (as auth.users is in a separate schema)
    const authUsers: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, email, phone, last_sign_in_at, raw_app_meta_data FROM auth.users
    `)

    // Correlate profiles with auth.users details
    const users = profiles.map((p) => {
      const authUser = authUsers.find((au) => au.id === p.userId)
      
      const email = authUser?.email || 'N/A'
      const phone = authUser?.phone || 'N/A'
      const lastSignIn = authUser?.last_sign_in_at || p.lastSeenAt || null
      
      // Flexible provider detection
      let provider = 'N/A'
      if (authUser?.raw_app_meta_data) {
        try {
          const meta = typeof authUser.raw_app_meta_data === 'string'
            ? JSON.parse(authUser.raw_app_meta_data)
            : authUser.raw_app_meta_data
          
          if (meta.provider) {
            provider = meta.provider
          } else if (meta.providers && Array.isArray(meta.providers)) {
            provider = meta.providers.join(', ')
          }
        } catch (e) {
          console.warn('Failed to parse raw_app_meta_data:', e)
        }
      }

      // Compute game stats
      const wins = p.gameStats?.reduce((sum, gs) => sum + gs.winCount, 0) || 0
      const playCount = p.gameStats?.reduce((sum, gs) => sum + gs.playCount, 0) || 0
      const losses = Math.max(0, playCount - wins)
      const winRate = playCount > 0 ? parseFloat(((wins / playCount) * 100).toFixed(1)) : 0.0

      // Compute online status
      const isOnline = p.lastSeenAt ? (Date.now() - new Date(p.lastSeenAt).getTime()) < 60000 : false

      return {
        id: p.id,
        userId: p.userId,
        username: p.username,
        displayName: p.displayName || (p.username.includes('@') ? p.username.split('@')[0] : p.username),
        role: p.role,
        xp: p.xp,
        level: p.level,
        coins: p.coins,
        avatarUrl: p.avatarUrl,
        createdAt: p.createdAt,
        email,
        phone,
        lastSignIn,
        lastLoginDate: p.lastLoginDate,
        provider,
        wins,
        losses,
        winRate,
        rank: p.currentRank || 'N/A',
        lastSeenAt: p.lastSeenAt,
        onlineStatus: isOnline ? 'online' : 'offline',
        banStatus: 'active', // Placeholder since there is no ban column in schema
      }
    })

    return NextResponse.json({ users }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/admin/users]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
