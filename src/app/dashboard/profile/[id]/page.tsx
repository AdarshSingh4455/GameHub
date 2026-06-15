import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ProfileClient from './ProfileClient'
import type { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: { username: true }
  })
  return {
    title: profile ? `${profile.username}'s Profile` : 'User Profile'
  }
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: currentAuthUser } } = await supabase.auth.getUser()
  
  if (!currentAuthUser) {
    redirect(`/login?redirect=/dashboard/profile/${id}`)
  }

  // 1. Fetch profile to view
  const profile = await prisma.profile.findUnique({
    where: { id }
  })

  if (!profile) {
    redirect('/dashboard')
  }

  // 2. Fetch viewing profile
  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: currentAuthUser.id }
  })

  // 3. Compute stats
  const rank = await prisma.profile.count({
    where: {
      xp: { gt: profile.xp }
    }
  }) + 1

  const totalMatches = await prisma.matchRecord.count({
    where: {
      OR: [
        { player1Id: profile.id },
        { player2Id: profile.id }
      ]
    }
  })

  const wins = await prisma.matchRecord.count({
    where: { winnerId: profile.id }
  })

  const draws = await prisma.matchRecord.count({
    where: {
      winnerId: null,
      player2Id: { not: null },
      OR: [
        { player1Id: profile.id },
        { player2Id: profile.id }
      ]
    }
  })

  const losses = totalMatches - wins - draws
  const winPercent = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  // 4. Favorite Game
  const favoriteStat = await prisma.profileGameStats.findFirst({
    where: { profileId: profile.id },
    orderBy: { playCount: 'desc' }
  })

  let favoriteGame = 'None'
  if (favoriteStat) {
    const game = await prisma.game.findUnique({
      where: { slug: favoriteStat.gameSlug },
      select: { name: true }
    })
    favoriteGame = game?.name || favoriteStat.gameSlug
  }

  // 5. Badges (UserAchievements)
  const unlockedBadges = await prisma.userAchievement.findMany({
    where: { profileId: profile.id },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' }
  })

  const badges = unlockedBadges.map(ua => ({
    slug: ua.achievement.slug,
    name: ua.achievement.name,
    description: ua.achievement.description,
    unlockedAt: ua.unlockedAt.toISOString()
  }))

  // 6. Recent Activity
  const xpEvents = await prisma.xPEvent.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  const activity = [
    ...xpEvents.map(x => ({
      type: 'xp',
      date: x.createdAt.toISOString(),
      text: x.type === 'MATCH_WIN' ? `Won a match of ${x.meta && typeof x.meta === 'object' && x.meta !== null && 'gameSlug' in x.meta ? String((x.meta as Record<string, unknown>).gameSlug) : 'a game'}` :
            x.type === 'MATCH_LOSS' ? `Played a match of ${x.meta && typeof x.meta === 'object' && x.meta !== null && 'gameSlug' in x.meta ? String((x.meta as Record<string, unknown>).gameSlug) : 'a game'}` :
            x.type === 'DAILY_LOGIN' ? 'Claimed Daily Login Reward' : 'Earned bonus XP',
      amount: x.amount
    })),
    ...unlockedBadges.map(ua => ({
      type: 'achievement',
      date: ua.unlockedAt.toISOString(),
      text: `Unlocked achievement: ${ua.achievement.name}`,
      amount: ua.achievement.xpReward
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)

  // 7. Friendship status
  let friendshipStatus: 'none' | 'friends' | 'sent-pending' | 'received-pending' | 'self' = 'none'

  if (viewerProfile) {
    if (viewerProfile.id === profile.id) {
      friendshipStatus = 'self'
    } else {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: viewerProfile.id, addresseeId: profile.id },
            { requesterId: profile.id, addresseeId: viewerProfile.id }
          ]
        }
      })

      if (friendship) {
        if (friendship.status === 'ACCEPTED') {
          friendshipStatus = 'friends'
        } else if (friendship.status === 'PENDING') {
          if (friendship.requesterId === viewerProfile.id) {
            friendshipStatus = 'sent-pending'
          } else {
            friendshipStatus = 'received-pending'
          }
        }
      }
    }
  }

  const serializableProfile = {
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatarUrl,
    selectedTitle: profile.selectedTitle,
    level: profile.level,
    xp: profile.xp,
    currentStreak: profile.currentStreak,
    createdAt: profile.createdAt.toISOString()
  }

  const serializableStats = {
    rank,
    totalMatches,
    wins,
    losses,
    draws,
    winPercent,
    favoriteGame
  }

  return (
    <ProfileClient
      profile={serializableProfile}
      stats={serializableStats}
      badges={badges}
      activity={activity}
      initialFriendshipStatus={friendshipStatus}
    />
  )
}
