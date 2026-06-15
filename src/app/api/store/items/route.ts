import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Retrieve all non-default purchasable cosmetics
    const items = await prisma.cosmeticItem.findMany({
      where: {
        isDefault: false,
        priceCoins: { gt: 0 }
      },
      orderBy: { priceCoins: 'asc' }
    })

    let ownedIds: string[] = []
    let coins = 0

    if (user) {
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { id: true, coins: true }
      })

      if (profile) {
        coins = profile.coins
        const inventory = await prisma.profileInventory.findMany({
          where: { profileId: profile.id },
          select: { cosmeticItemId: true }
        })
        ownedIds = inventory.map(i => i.cosmeticItemId)
      }
    }

    return NextResponse.json({
      items,
      ownedIds,
      userCoins: coins
    }, { status: 200 })

  } catch (err: unknown) {
    console.error('[GET /api/store/items]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
