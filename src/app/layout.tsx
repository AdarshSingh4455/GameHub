import type { Metadata, Viewport } from 'next'
import './globals.css'
import SplashScreen from '@/components/layout/SplashScreen'

export const metadata: Metadata = {
  title: {
    template: '%s | GameHub',
    default: 'GameHub — Play Together, Compete, Win',
  },
  description:
    'GameHub is a multiplayer social gaming platform. Play Hand Cricket, Scribble, Dumb Charades, Tic-Tac-Toe and more — with friends or solo.',
  keywords: ['gamehub', 'multiplayer games', 'scribble', 'hand cricket', 'online games'],
  openGraph: {
    title: 'GameHub — Play Together, Compete, Win',
    description: 'Social multiplayer gaming with leaderboards and achievements.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <SplashScreen />
      </body>
    </html>
  )
}
