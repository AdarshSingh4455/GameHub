import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAndProcessDisqualifications } from '@/lib/tournamentEngine'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const processed = await checkAndProcessDisqualifications(prisma)
    return NextResponse.json({
      success: true,
      message: `Processed auto-disqualifications for matches.`,
      disqualifiedCount: processed
    }, { status: 200 })
  } catch (err: unknown) {
    console.error('[GET /api/tournaments/cron]', err)
    const msg = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}
