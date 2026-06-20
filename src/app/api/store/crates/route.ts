import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'
import { computeLevel } from '@/lib/xpUtils'

export const dynamic = 'force-dynamic'

const CRATE_COSTS = {
  BRONZE: 50,
  SILVER: 100,
  GOLD: 250,
  MYTHIC: 500
}

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { crateType } = await request.json()
    if (!crateType || !['BRONZE', 'SILVER', 'GOLD', 'MYTHIC'].includes(crateType)) {
      return NextResponse.json({ error: 'Invalid or missing crateType' }, { status: 400 })
    }

    const cost = CRATE_COSTS[crateType as keyof typeof CRATE_COSTS]
    if (profile.coins < cost) {
      return NextResponse.json({ error: `Insufficient coins. ${crateType} crate costs ${cost} coins.` }, { status: 400 })
    }

    const roll = Math.random() * 100
    let rewardType: 'coins' | 'xp' | 'cosmetic' = 'coins'
    let val = 0
    let rewardName = ''

    // Rarity rolls
    if (crateType === 'BRONZE') {
      if (roll < 60) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 41) + 20 // 20-60 Coins
      } else if (roll < 95) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 51) + 30 // 30-80 XP
      } else {
        rewardType = 'cosmetic'
      }
    } else if (crateType === 'SILVER') {
      if (roll < 45) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 81) + 40 // 40-120 Coins
      } else if (roll < 90) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 91) + 60 // 60-150 XP
      } else {
        rewardType = 'cosmetic'
      }
    } else if (crateType === 'GOLD') {
      if (roll < 30) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 201) + 100 // 100-300 Coins
      } else if (roll < 70) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 251) + 150 // 150-400 XP
      } else {
        rewardType = 'cosmetic'
      }
    } else {
      // MYTHIC
      if (roll < 15) {
        rewardType = 'coins'
        val = Math.floor(Math.random() * 451) + 250 // 250-700 Coins
      } else if (roll < 40) {
        rewardType = 'xp'
        val = Math.floor(Math.random() * 701) + 300 // 300-1000 XP
      } else {
        rewardType = 'cosmetic'
      }
    }

    let rolledCosmetic: any = null
    if (rewardType === 'cosmetic') {
      // Query non-default cosmetic items
      const candidates = await prisma.cosmeticItem.findMany({
        where: {
          type: { in: ['TITLE', 'FRAME', 'EFFECT'] },
          isDefault: false
        }
      })

      if (candidates.length > 0) {
        rolledCosmetic = candidates[Math.floor(Math.random() * candidates.length)]
        rewardName = `${rolledCosmetic.name} (${rolledCosmetic.type})`
      } else {
        // Fallback to coins if database has no custom cosmetics loaded
        rewardType = 'coins'
        val = cost
        rewardName = `${val} Coins (Crate Refund)`
      }
    }

    let userCoins = profile.coins - cost
    let userXP = profile.xp
    let userLevel = profile.level
    let leveledUp = false

    if (rewardType === 'coins') {
      userCoins += val
      rewardName = `${val} Coins`
    } else if (rewardType === 'xp') {
      userXP += val
      rewardName = `${val} XP`
      const nextLvl = computeLevel(userXP)
      if (nextLvl > userLevel) {
        userLevel = nextLvl
        leveledUp = true
      }
    } else if (rewardType === 'cosmetic' && rolledCosmetic) {
      // Check ownership
      const owned = await prisma.profileInventory.findUnique({
        where: {
          profileId_cosmeticItemId: {
            profileId: profile.id,
            cosmeticItemId: rolledCosmetic.id
          }
        }
      })

      if (owned) {
        // Refund duplicate
        const refund = Math.floor(cost * 0.4)
        userCoins += refund
        rewardName = `${rolledCosmetic.name} (Duplicate Refund: +${refund} Coins)`
      } else {
        await prisma.profileInventory.create({
          data: {
            profileId: profile.id,
            cosmeticItemId: rolledCosmetic.id
          }
        })
      }
    }

    // Update Profile
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        coins: userCoins,
        xp: userXP,
        level: userLevel
      }
    })

    // Log XP Event if XP given
    if (rewardType === 'xp') {
      await prisma.xPEvent.create({
        data: {
          profileId: profile.id,
          type: 'STREAK_BONUS',
          amount: val,
          meta: { crateType }
        }
      })
    }

    // Log Analytics Event
    await prisma.analyticsEvent.create({
      data: {
        profileId: profile.id,
        eventName: 'crate_purchased_opened',
        metadata: { crateType, cost, rewardType, rewardName }
      }
    })

    return NextResponse.json({
      success: true,
      userCoins,
      userXP,
      userLevel,
      leveledUp,
      reward: {
        type: rewardType,
        value: val,
        name: rewardName,
        item: rolledCosmetic
      }
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/store/crates]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
