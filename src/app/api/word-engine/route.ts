import { NextResponse } from 'next/server'
import { WordEngine } from '@/lib/word-engine/WordEngine'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
        // Fallback to anonymous for public / unauthenticated sessions
        userId = 'anonymous'
      } else {
        userId = user.id
      }
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'random'
    const difficulty = (searchParams.get('difficulty') || 'normal') as 'easy' | 'normal' | 'hard'
    const count = parseInt(searchParams.get('count') || '10', 10)

    const words = await WordEngine.getWords({
      category,
      difficulty,
      count,
      userId
    })

    return NextResponse.json({ success: true, words })
  } catch (error: any) {
    console.error('[WordEngine API Error]:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
