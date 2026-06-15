import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const achievements = await prisma.achievement.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json({ achievements }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/achievements]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
