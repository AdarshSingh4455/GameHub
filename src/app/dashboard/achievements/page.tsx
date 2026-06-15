import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import AchievementsClient from './AchievementsClient'

export const metadata: Metadata = { title: 'Achievements' }

export default async function AchievementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <AchievementsClient user={user} />
}
