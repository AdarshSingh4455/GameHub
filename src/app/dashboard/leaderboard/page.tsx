import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardClient from './LeaderboardClient'

export const metadata: Metadata = { title: 'Leaderboard' }

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/dashboard/leaderboard')
  const { tab } = await searchParams

  const initialTab = (tab === 'ranked' || tab === 'casual' || tab === 'hallOfFame' || tab === 'weeklyHistory')
    ? tab
    : 'casual'

  return <LeaderboardClient initialTab={initialTab} />
}
