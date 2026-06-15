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

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const { action, targetId } = await request.json()

    if (!action || !targetId) {
      return NextResponse.json({ error: 'Missing action or targetId' }, { status: 400 })
    }

    if (profile.id === targetId) {
      return NextResponse.json({ error: 'Cannot perform friendship action on yourself' }, { status: 400 })
    }

    // 1. Send Friend Request
    if (action === 'send') {
      // Check if friendship already exists
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: profile.id, addresseeId: targetId },
            { requesterId: targetId, addresseeId: profile.id }
          ]
        }
      })

      if (existing) {
        return NextResponse.json({ error: 'Friendship or request already exists' }, { status: 400 })
      }

      const requestRecord = await prisma.friendship.create({
        data: {
          requesterId: profile.id,
          addresseeId: targetId,
          status: 'PENDING'
        }
      })

      return NextResponse.json({ success: true, friendship: requestRecord }, { status: 200 })
    }

    // 2. Accept Friend Request
    if (action === 'accept') {
      const existing = await prisma.friendship.findUnique({
        where: {
          requesterId_addresseeId: {
            requesterId: targetId,
            addresseeId: profile.id
          }
        }
      })

      if (!existing || existing.status !== 'PENDING') {
        return NextResponse.json({ error: 'No pending friend request found' }, { status: 404 })
      }

      // Accept the request using a transaction
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.friendship.update({
          where: {
            requesterId_addresseeId: {
              requesterId: targetId,
              addresseeId: profile.id
            }
          },
          data: { status: 'ACCEPTED' }
        })

        // Check and unlock "social-butterfly" achievement for both users
        for (const pid of [profile.id, targetId]) {
          const friendsCount = await tx.friendship.count({
            where: {
              status: 'ACCEPTED',
              OR: [{ requesterId: pid }, { addresseeId: pid }]
            }
          })

          if (friendsCount >= 5) {
            // Find achievement
            const ach = await tx.achievement.findUnique({ where: { slug: 'social-butterfly' } })
            if (ach) {
              const alreadyUnlocked = await tx.userAchievement.findUnique({
                where: {
                  profileId_achievementId: {
                    profileId: pid,
                    achievementId: ach.id
                  }
                }
              })

              if (!alreadyUnlocked) {
                // Unlock it!
                await tx.userAchievement.create({
                  data: {
                    profileId: pid,
                    achievementId: ach.id
                  }
                })

                // Grant reward
                await tx.profile.update({
                  where: { id: pid },
                  data: {
                    xp: { increment: ach.xpReward },
                    coins: { increment: ach.coinReward }
                  }
                })

                // Log XP event
                if (ach.xpReward > 0) {
                  await tx.xPEvent.create({
                    data: {
                      profileId: pid,
                      type: 'ACHIEVEMENT',
                      amount: ach.xpReward,
                      meta: { achievementSlug: ach.slug }
                    }
                  })
                }

                // Log analytics event
                await tx.analyticsEvent.create({
                  data: {
                    profileId: pid,
                    eventName: 'achievement_unlocked',
                    metadata: {
                      achievementSlug: ach.slug,
                      xpReward: ach.xpReward,
                      coinReward: ach.coinReward
                    }
                  }
                })
              }
            }
          }
        }

        return updated
      }, { maxWait: 15000, timeout: 30000 })

      return NextResponse.json({ success: true, friendship: result }, { status: 200 })
    }

    // 3. Decline Friend Request
    if (action === 'decline') {
      const existing = await prisma.friendship.findUnique({
        where: {
          requesterId_addresseeId: {
            requesterId: targetId,
            addresseeId: profile.id
          }
        }
      })

      if (!existing || existing.status !== 'PENDING') {
        return NextResponse.json({ error: 'No pending friend request found' }, { status: 404 })
      }

      await prisma.friendship.delete({
        where: {
          requesterId_addresseeId: {
            requesterId: targetId,
            addresseeId: profile.id
          }
        }
      })

      return NextResponse.json({ success: true }, { status: 200 })
    }

    // 4. Remove / Unfriend / Cancel Request
    if (action === 'remove') {
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: profile.id, addresseeId: targetId },
            { requesterId: targetId, addresseeId: profile.id }
          ]
        }
      })

      if (!existing) {
        return NextResponse.json({ error: 'No friendship record found' }, { status: 404 })
      }

      await prisma.friendship.delete({
        where: { id: existing.id }
      })

      return NextResponse.json({ success: true }, { status: 200 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err: unknown) {
    console.error('[POST /api/friends/action]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
