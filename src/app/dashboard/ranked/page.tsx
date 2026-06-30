import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardClient from '../leaderboard/LeaderboardClient'

export const metadata: Metadata = { title: 'Ranked Matchmaking' }

export default async function RankedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?redirect=/dashboard/ranked')

  return <LeaderboardClient initialTab="ranked" autoStartMatchmaking={true} />
}
