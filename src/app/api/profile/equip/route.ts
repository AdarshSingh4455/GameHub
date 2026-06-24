import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

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

    const { itemId, action } = await request.json()
    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId }
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Verify item exists
    const item = await prisma.cosmeticItem.findUnique({
      where: { id: itemId }
    })
    if (!item) {
      return NextResponse.json({ error: 'Cosmetic item not found' }, { status: 404 })
    }

    // Verify ownership (unless it's a guest, or a default item)
    let isOwned = item.isDefault || profile.isGuest
    let ownedRecord = null

    if (!isOwned) {
      ownedRecord = await prisma.profileInventory.findUnique({
        where: {
          profileId_cosmeticItemId: {
            profileId: profile.id,
            cosmeticItemId: itemId
          }
        }
      })
      if (ownedRecord) {
        isOwned = true
      }
    }

    if (!isOwned) {
      return NextResponse.json({ error: 'You do not own this cosmetic item' }, { status: 403 })
    }

    // Determine field to update based on item type
    let updateField: string | null = null
    const metadata = (item.metadata as any) || {}

    if (item.type === 'TITLE') {
      updateField = 'selectedTitle'
      const minWins = metadata.minWins
      if (!ownedRecord && !profile.isGuest && minWins !== undefined && minWins !== null) {
        const stats = await prisma.profileGameStats.findMany({
          where: { profileId: profile.id }
        })
        const totalWins = stats.reduce((sum, s) => sum + s.winCount, 0)
        if (totalWins < minWins) {
          return NextResponse.json({ error: `Requires ${minWins} wins (Current: ${totalWins})` }, { status: 400 })
        }
      }
    } else if (item.type === 'AVATAR_FRAME') {
      updateField = 'selectedFrame'
      const minLevel = metadata.minLevel
      if (!ownedRecord && !profile.isGuest && minLevel !== undefined && minLevel !== null) {
        if (profile.level < minLevel) {
          return NextResponse.json({ error: `Requires level ${minLevel} (Current: ${profile.level})` }, { status: 400 })
        }
      }
    } else if (item.type === 'EFFECT') {
      updateField = 'selectedEffect'
    } else if (item.type === 'BOARD_THEME') {
      updateField = 'selectedTheme'
    } else if (item.type === 'CHAT_PACK') {
      updateField = 'selectedChatPack'
    } else {
      return NextResponse.json({ error: 'Item type not equippable' }, { status: 400 })
    }

    const newValue = action === 'equip' ? item.name : null

    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        [updateField]: newValue
      }
    })

    return NextResponse.json({ success: true, profile: updatedProfile })
  } catch (err: unknown) {
    console.error('[POST /api/profile/equip]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

