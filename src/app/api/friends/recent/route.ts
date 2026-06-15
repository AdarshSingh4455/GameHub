import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id }
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Get last 20 matches involving the current user
    const matches = await prisma.matchRecord.findMany({
      where: {
        OR: [
          { player1Id: profile.id },
          { player2Id: profile.id }
        ]
      },
      orderBy: { playedAt: 'desc' },
      take: 20,
      include: {
        player1: {
          select: { id: true, username: true, level: true, xp: true, avatarUrl: true }
        },
        player2: {
          select: { id: true, username: true, level: true, xp: true, avatarUrl: true }
        }
      }
    })

    // Extract unique opponent IDs
    const opponentMap = new Map<string, any>()
    matches.forEach(m => {
      const opp = m.player1Id === profile.id ? m.player2 : m.player1
      if (opp && opp.id !== profile.id) {
        opponentMap.set(opp.id, opp)
      }
    })

    const opponentIds = Array.from(opponentMap.keys())

    // Fetch existing friendships to exclude current friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: profile.id },
          { addresseeId: profile.id }
        ]
      }
    })

    const friendshipStatuses = new Map<string, string>()
    friendships.forEach(f => {
      const otherId = f.requesterId === profile.id ? f.addresseeId : f.requesterId
      let status = 'none'
      if (f.status === 'ACCEPTED') status = 'friends'
      else if (f.status === 'PENDING') status = f.requesterId === profile.id ? 'sent-pending' : 'received-pending'
      friendshipStatuses.set(otherId, status)
    })

    // Compile recent players list with friendship statuses
    const recentPlayers = opponentIds.map(id => {
      const opp = opponentMap.get(id)
      const status = friendshipStatuses.get(id) || 'none'
      return {
        ...opp,
        friendshipStatus: status
      }
    }).filter(p => p.friendshipStatus !== 'friends') // exclude existing friends

    return NextResponse.json({ recentPlayers }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/friends/recent]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
