import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    let userId: string

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
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
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // Get current user's profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('search')?.trim() || ''

    // Fetch all existing friendships for the user to determine status
    const allFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: profile.id },
          { addresseeId: profile.id }
        ]
      }
    })

    // Build a mapping of user ID -> friendship status/role
    const friendshipMap = new Map<string, { id: string; status: string; isRequester: boolean }>()
    allFriendships.forEach(f => {
      const otherId = f.requesterId === profile.id ? f.addresseeId : f.requesterId
      friendshipMap.set(otherId, {
        id: f.id,
        status: f.status,
        isRequester: f.requesterId === profile.id
      })
    })

    if (searchQuery) {
      let matchingProfiles: any[] = []

      // Check if it's a friend code
      if (searchQuery.toUpperCase().startsWith('GH-') && searchQuery.length === 11) {
        const found = await prisma.profile.findFirst({
          where: {
            friendCode: {
              equals: searchQuery.toUpperCase().trim()
            },
            id: {
              not: profile.id
            }
          },
          select: {
            id: true,
            username: true,
            level: true,
            xp: true,
            avatarUrl: true
          }
        })
        matchingProfiles = found ? [found] : []
      } else {
        matchingProfiles = await prisma.profile.findMany({
          where: {
            username: {
              contains: searchQuery,
              mode: 'insensitive'
            },
            id: {
              not: profile.id
            }
          },
          select: {
            id: true,
            username: true,
            level: true,
            xp: true,
            avatarUrl: true
          },
          take: 10
        })
      }

      // Map profiles with their friendship status relative to current user
      const results = matchingProfiles.map(p => {
        const friendship = friendshipMap.get(p.id)
        let status = 'none' // 'none', 'friends', 'sent-pending', 'received-pending'

        if (friendship) {
          if (friendship.status === 'ACCEPTED') {
            status = 'friends'
          } else if (friendship.status === 'PENDING') {
            status = friendship.isRequester ? 'sent-pending' : 'received-pending'
          } else if (friendship.status === 'BLOCKED') {
            status = 'blocked'
          }
        }

        return {
          ...p,
          friendshipStatus: status
        }
      })

      return NextResponse.json({ results }, { status: 200 })
    }

    // 2. Fetch standard lists (Friends, Incoming, Outgoing)
    // Accepted Friends
    const acceptedFriendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: profile.id },
          { addresseeId: profile.id }
        ],
        status: 'ACCEPTED'
      },
      include: {
        requester: {
          select: { id: true, userId: true, username: true, level: true, xp: true, avatarUrl: true, lastSeenAt: true }
        },
        addressee: {
          select: { id: true, userId: true, username: true, level: true, xp: true, avatarUrl: true, lastSeenAt: true }
        }
      }
    })

    const friends = acceptedFriendships.map(f => 
      f.requesterId === profile.id ? f.addressee : f.requester
    )

    // Pending Incoming Requests (requests sent to the current user)
    const incomingFriendships = await prisma.friendship.findMany({
      where: {
        addresseeId: profile.id,
        status: 'PENDING'
      },
      include: {
        requester: {
          select: { id: true, username: true, level: true, xp: true, avatarUrl: true }
        }
      }
    })
    const pendingIncoming = incomingFriendships.map(f => f.requester)

    // Pending Outgoing Requests (requests sent by the current user)
    const outgoingFriendships = await prisma.friendship.findMany({
      where: {
        requesterId: profile.id,
        status: 'PENDING'
      },
      include: {
        addressee: {
          select: { id: true, username: true, level: true, xp: true, avatarUrl: true }
        }
      }
    })
    const pendingOutgoing = outgoingFriendships.map(f => f.addressee)

    return NextResponse.json({
      friends,
      pendingIncoming,
      pendingOutgoing
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/friends]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
