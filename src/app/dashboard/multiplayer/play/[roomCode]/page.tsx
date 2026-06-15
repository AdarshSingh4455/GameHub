import type { Metadata } from 'next'
import PlayPageClient from './PlayPageClient'

export const metadata: Metadata = {
  title: 'Multiplayer Match 🌐',
  description: 'Online multiplayer match gameplay session.'
}

export default async function PlayPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params

  return (
    <PlayPageClient roomCode={roomCode} />
  )
}
