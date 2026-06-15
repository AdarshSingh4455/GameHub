import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const cosmetics = await prisma.cosmeticItem.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ cosmetics }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/admin/cosmetics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, type, priceCoins, assetUrl, metadata, isDefault } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 })
    }

    const cosmetic = await prisma.cosmeticItem.create({
      data: {
        name,
        type,
        priceCoins: parseInt(priceCoins, 10) || 0,
        assetUrl: assetUrl || null,
        metadata: metadata || null,
        isDefault: !!isDefault,
      },
    })

    return NextResponse.json({ cosmetic }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/admin/cosmetics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, name, type, priceCoins, assetUrl, metadata, isDefault } = body

    if (!id) {
      return NextResponse.json({ error: 'Cosmetic Item ID is required' }, { status: 400 })
    }

    const cosmetic = await prisma.cosmeticItem.update({
      where: { id },
      data: {
        name,
        type,
        priceCoins: parseInt(priceCoins, 10) || 0,
        assetUrl: assetUrl || null,
        metadata: metadata || null,
        isDefault: !!isDefault,
      },
    })

    return NextResponse.json({ cosmetic }, { status: 200 })
  } catch (err: unknown) {
    console.error('[PUT /api/admin/cosmetics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      select: { role: true }
    })

    if (profile?.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Cosmetic Item ID is required' }, { status: 400 })
    }

    await prisma.cosmeticItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error('[DELETE /api/admin/cosmetics]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
