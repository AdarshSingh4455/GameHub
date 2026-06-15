import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getGameBySlug } from '@/lib/games'
import GamePageClient from './GamePageClient'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game) return {}
  return {
    title: `Play ${game.name}`,
    description: game.description,
  }
}

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = getGameBySlug(slug)
  if (!game) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const username = (user?.user_metadata?.username as string) ?? 'Explorer'

  return (
    <GamePageClient
      game={game}
      username={username}
      slug={slug}
    />
  )
}
