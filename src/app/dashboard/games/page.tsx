import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from '../DashboardClient'

export const metadata: Metadata = { title: 'Games Library' }

export default async function GamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const username = (user?.user_metadata?.username as string) ?? 'Explorer'

  return <DashboardClient user={user} username={username} isGamesLibrary={true} />
}
