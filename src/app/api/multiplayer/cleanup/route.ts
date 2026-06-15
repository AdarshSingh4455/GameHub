import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const deleted = await prisma.multiplayerRoom.deleteMany({
      where: {
        status: 'WAITING',
        createdAt: {
          lt: twentyFourHoursAgo
        }
      }
    })

    return NextResponse.json({ success: true, count: deleted.count }, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/cleanup]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
