import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { computeLevel } from '@/lib/xpUtils'

export async function POST(request: Request) {
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
      const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      userId = user.id
    }

    const body = await request.json()
    const { cosmeticItemId } = body

    if (!cosmeticItemId) {
      return NextResponse.json({ error: 'Cosmetic Item ID is required' }, { status: 400 })
    }

    // 1. Fetch user profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 2. Fetch cosmetic item
    const item = await prisma.cosmeticItem.findUnique({
      where: { id: cosmeticItemId },
    })

    if (!item) {
      return NextResponse.json({ error: 'Cosmetic item not found' }, { status: 404 })
    }

    // 3. Handle non-Scratcher purchases
    if (item.type !== 'SCRATCHER') {
      // Check if already owned
      const owned = await prisma.profileInventory.findUnique({
        where: {
          profileId_cosmeticItemId: {
            profileId: profile.id,
            cosmeticItemId: item.id,
          },
        },
      })

      if (owned) {
        return NextResponse.json({ error: 'You already own this cosmetic!' }, { status: 400 })
      }

      // Check coins balance
      if (profile.coins < item.priceCoins) {
        return NextResponse.json({ error: 'Insufficient coins balance!' }, { status: 400 })
      }

      // Enforce level requirements for buying frames
      if (item.type === 'AVATAR_FRAME') {
        const metadata = (item.metadata as any) || {}
        const minLevel = metadata.minLevel
        if (minLevel !== undefined && minLevel !== null && profile.level < minLevel) {
          return NextResponse.json({ error: `Requires level ${minLevel} to purchase (Current: ${profile.level})` }, { status: 400 })
        }
      }

      // Enforce win requirements for buying titles
      if (item.type === 'TITLE') {
        const metadata = (item.metadata as any) || {}
        const minWins = metadata.minWins
        if (minWins !== undefined && minWins !== null) {
          const stats = await prisma.profileGameStats.findMany({
            where: { profileId: profile.id }
          })
          const totalWins = stats.reduce((sum, s) => sum + s.winCount, 0)
          if (totalWins < minWins) {
            return NextResponse.json({ error: `Requires ${minWins} wins to purchase (Current: ${totalWins})` }, { status: 400 })
          }
        }
      }

      // Deduct coins & Add to inventory
      const updatedProfile = await prisma.profile.update({
        where: { id: profile.id },
        data: { coins: profile.coins - item.priceCoins },
      })

      const inventory = await prisma.profileInventory.create({
        data: {
          profileId: profile.id,
          cosmeticItemId: item.id,
        },
      })

      return NextResponse.json({
        success: true,
        userCoins: updatedProfile.coins,
        purchasedItem: item,
      }, { status: 200 })
    }

    // 4. Handle SCRATCHER purchase and immediate roll
    if (profile.coins < item.priceCoins) {
      return NextResponse.json({ error: 'Insufficient coins to buy scratcher!' }, { status: 400 })
    }

    // Deduct coins first
    let currentCoins = profile.coins - item.priceCoins

    const metadata = (item.metadata as any) || {}
    const rarity = metadata.rarity || 'COMMON'

    // Roll reward type
    const roll = Math.random() * 100
    let rewardType: 'coins' | 'xp' | 'cosmetic' | 'badge' = 'coins'
    let val = 0
    let rewardName = ''
    let rewardedItem: any = null

    // Determine reward category based on rarity
    if (rarity === 'COMMON') {
      if (roll < 50) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 26) + 10 // 10-35 Coins
      } else if (roll < 95) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 41) + 20 // 20-60 XP
      } else {
        rewardType = 'cosmetic' // Common avatar
      }
    } else if (rarity === 'RARE') {
      if (roll < 40) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 51) + 40 // 40-90 Coins
      } else if (roll < 80) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 101) + 80 // 80-180 XP
      } else if (roll < 95) {
        rewardType = 'cosmetic'
      } else {
        rewardType = 'badge' // Rare badge
      }
    } else if (rarity === 'EPIC') {
      if (roll < 30) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 151) + 100 // 100-250 Coins
      } else if (roll < 65) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 251) + 150 // 150-400 XP
      } else if (roll < 90) {
        rewardType = 'cosmetic'
      } else {
        rewardType = 'badge'
      }
    } else {
      // LEGENDARY
      if (roll < 20) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 451) + 300 // 300-750 Coins
      } else if (roll < 50) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 701) + 500 // 500-1200 XP
      } else if (roll < 80) {
        rewardType = 'cosmetic'
      } else {
        rewardType = 'badge'
      }
    }

    let rolledCosmetic: any = null
    let rolledBadge: any = null

    // If cosmetic was rolled, pick a random item
    if (rewardType === 'cosmetic') {
      const candidates = await prisma.cosmeticItem.findMany({
        where: {
          type: { in: ['AVATAR', 'CHAT_PACK'] },
          isDefault: false,
        },
      })
      if (candidates.length > 0) {
        rolledCosmetic = candidates[Math.floor(Math.random() * candidates.length)]
        rewardName = rolledCosmetic.name
      } else {
        // Fallback to coins if no cosmetics found
        rewardType = 'coins'
        val = 50
      }
    }

    // If badge was rolled, pick a random achievement
    if (rewardType === 'badge') {
      const achievementsList = await prisma.achievement.findMany()
      if (achievementsList.length > 0) {
        rolledBadge = achievementsList[Math.floor(Math.random() * achievementsList.length)]
        rewardName = `${rolledBadge.name} Badge`
      } else {
        // Fallback to XP if no badges found
        rewardType = 'xp'
        val = 100
      }
    }

    // Apply reward to profile
    let currentXP = profile.xp
    let currentLevel = profile.level
    let leveledUp = false

    if (rewardType === 'coins') {
      currentCoins += val
      rewardName = `${val} Coins`
    } else if (rewardType === 'xp') {
      currentXP += val
      rewardName = `${val} XP`
      const newLevel = computeLevel(currentXP)
      if (newLevel > currentLevel) {
        currentLevel = newLevel
        leveledUp = true
      }
    } else if (rewardType === 'cosmetic' && rolledCosmetic) {
      // Check if already owned
      const owned = await prisma.profileInventory.findUnique({
        where: {
          profileId_cosmeticItemId: {
            profileId: profile.id,
            cosmeticItemId: rolledCosmetic.id,
          },
        },
      })

      if (owned) {
        // Refund coins!
        const refund = Math.round(rolledCosmetic.priceCoins * 0.5) || 20
        currentCoins += refund
        rewardName = `${rolledCosmetic.name} (Duplicate Refund: +${refund} Coins)`
      } else {
        // Grant cosmetic
        await prisma.profileInventory.create({
          data: {
            profileId: profile.id,
            cosmeticItemId: rolledCosmetic.id,
          },
        })
        rewardedItem = rolledCosmetic
      }
    } else if (rewardType === 'badge' && rolledBadge) {
      // Check if already unlocked
      const owned = await prisma.userAchievement.findUnique({
        where: {
          profileId_achievementId: {
            profileId: profile.id,
            achievementId: rolledBadge.id,
          },
        },
      })

      if (owned) {
        // Refund XP
        const refundXP = 150
        currentXP += refundXP
        rewardName = `${rolledBadge.name} Badge (Duplicate Refund: +${refundXP} XP)`
        const newLevel = computeLevel(currentXP)
        if (newLevel > currentLevel) {
          currentLevel = newLevel
          leveledUp = true
        }
      } else {
        // Grant badge
        await prisma.userAchievement.create({
          data: {
            profileId: profile.id,
            achievementId: rolledBadge.id,
          },
        })
      }
    }

    // Update database
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        coins: currentCoins,
        xp: currentXP,
        level: currentLevel,
      },
    })

    // Log XP Event if XP reward
    if (rewardType === 'xp') {
      await prisma.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'STREAK_BONUS', // or custom event type
          amount: val,
          meta: { source: 'scratcher', scratcherName: item.name },
        },
      })
    }

    return NextResponse.json({
      success: true,
      userCoins: currentCoins,
      userXP: currentXP,
      userLevel: currentLevel,
      leveledUp,
      reward: {
        type: rewardType,
        value: val,
        name: rewardName,
        item: rolledCosmetic || rolledBadge || null,
      },
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[POST /api/store/buy]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
