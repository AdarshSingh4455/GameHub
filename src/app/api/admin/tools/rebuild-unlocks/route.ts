import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xpUtils'
import { checkAndUnlockProgressionItems } from '@/lib/cosmeticUnlocks'

export async function POST() {
  try {
    let userId: string
    if (process.env.MOCK_AUTH === 'true') {
      userId = 'mock-user-id'
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    // Verify user role is SUPER_ADMIN
    const adminProfile = await prisma.profile.findUnique({
      where: { userId }
    })

    if (adminProfile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all logged-in profiles
    const profiles = await prisma.profile.findMany({
      where: { isGuest: false }
    })

    const results: any[] = []

    for (const profile of profiles) {
      // 1. Recalculate level from XP
      const calculatedLevel = computeLevel(profile.xp)

      // 2. Recalculate wins from ProfileGameStats
      const stats = await prisma.profileGameStats.findMany({
        where: { profileId: profile.id }
      })
      const totalWins = stats.reduce((sum: number, s: any) => sum + (s.winCount || 0), 0)

      // 3. Update profile level if it is different
      let levelUpdated = false
      if (profile.level !== calculatedLevel) {
        await prisma.profile.update({
          where: { id: profile.id },
          data: { level: calculatedLevel }
        })
        levelUpdated = true
      }

      // 4. Run progression unlocks check to award missing items
      const newlyUnlocked = await checkAndUnlockProgressionItems(
        profile.id,
        calculatedLevel,
        profile.currentStreak,
        totalWins
      )

      if (newlyUnlocked.length > 0 || levelUpdated) {
        results.push({
          username: profile.username,
          oldLevel: profile.level,
          newLevel: calculatedLevel,
          totalWins,
          unlockedItems: newlyUnlocked.map((item: any) => item.name)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully checked ${profiles.length} profiles.`,
      rebuiltCount: results.length,
      details: results
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[POST /api/admin/tools/rebuild-unlocks]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
