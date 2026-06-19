import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    let userId: string | null = null
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
      userId = user?.id || null
    }

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

    if (userId) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
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
