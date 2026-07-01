import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xpUtils'
import { checkAndUnlockProgressionItems } from '@/lib/cosmeticUnlocks'

function calculateStreak(claimDates: Date[]): { currentStreak: number; longestStreak: number } {
  if (claimDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // Get unique UTC dates as YYYY-MM-DD strings
  const dateStrings = Array.from(new Set(claimDates.map(d => {
    const date = new Date(d)
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  }))).sort()

  if (dateStrings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // Find longest streak overall
  let maxStreak = 1
  let currentRun = 1
  for (let i = 1; i < dateStrings.length; i++) {
    const prev = new Date(dateStrings[i - 1])
    const curr = new Date(dateStrings[i])
    const diffTime = curr.getTime() - prev.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      currentRun++
      if (currentRun > maxStreak) {
        maxStreak = currentRun
      }
    } else if (diffDays > 1) {
      currentRun = 1
    }
  }

  // Calculate current streak (ending today or yesterday)
  const todayUTCStr = new Date().toISOString().split('T')[0]
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayUTCStr = yesterday.toISOString().split('T')[0]

  const lastClaimStr = dateStrings[dateStrings.length - 1]
  let currentStreak = 0

  if (lastClaimStr === todayUTCStr || lastClaimStr === yesterdayUTCStr) {
    currentStreak = 1
    for (let i = dateStrings.length - 1; i > 0; i--) {
      const prev = new Date(dateStrings[i - 1])
      const curr = new Date(dateStrings[i])
      const diffTime = curr.getTime() - prev.getTime()
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(maxStreak, currentStreak)
  }
}

async function runRecoveryTool(request: Request) {
  try {
    let userId: string
    if (process.env.MOCK_AUTH === 'true') {
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

      // 3. Recalculate streaks from DailyRewardLog
      const claims = await prisma.dailyRewardLog.findMany({
        where: { profileId: profile.id },
        select: { claimedAt: true }
      })
      const claimDates = claims.map(c => c.claimedAt)
      const calculatedStreakObj = calculateStreak(claimDates)
      
      const newStreak = Math.max(calculatedStreakObj.currentStreak, profile.currentStreak)
      const newLongest = Math.max(calculatedStreakObj.longestStreak, profile.longestStreak)

      // 4. Update profile level and streaks if different
      let profileUpdated = false
      if (profile.level !== calculatedLevel || profile.currentStreak !== newStreak || profile.longestStreak !== newLongest) {
        await prisma.profile.update({
          where: { id: profile.id },
          data: { 
            level: calculatedLevel,
            currentStreak: newStreak,
            longestStreak: newLongest
          }
        })
        profileUpdated = true
      }

      // 5. Run progression unlocks check to award missing items
      const newlyUnlocked = await checkAndUnlockProgressionItems(
        profile.id,
        calculatedLevel,
        newStreak,
        totalWins
      )

      if (newlyUnlocked.length > 0 || profileUpdated) {
        results.push({
          username: profile.username,
          oldLevel: profile.level,
          newLevel: calculatedLevel,
          oldStreak: profile.currentStreak,
          newStreak: newStreak,
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
    console.error('[admin/tools/rebuild-unlocks]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runRecoveryTool(request)
}

export async function POST(request: Request) {
  return runRecoveryTool(request)
}
