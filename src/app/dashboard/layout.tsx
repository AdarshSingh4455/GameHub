import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/layout/DashboardNav'
import FriendsActivityDrawerMount from '@/components/layout/FriendsActivityDrawerMount'
import { GameSessionProvider } from '@/lib/contexts/GameSessionContext'
import { ToastProvider } from '@/lib/contexts/ToastContext'
import { SocketProvider } from '@/lib/contexts/SocketContext'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <GameSessionProvider user={user}>
      <ToastProvider>
        <SocketProvider>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <DashboardNav user={user} />
            <main className="app-content" style={{ flex: 1, marginLeft: 'var(--sidebar-width, 260px)', padding: 'clamp(1rem, 3vw, 2rem)' }}>
              {children}
            </main>
            {/* Friends Activity Drawer — auth-gated, client-only */}
            <FriendsActivityDrawerMount show={!!user} />
          </div>
        </SocketProvider>
      </ToastProvider>
    </GameSessionProvider>
  )
}
