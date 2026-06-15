import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import UsernameForm from './UsernameForm'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/settings')

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: { username: true, selectedTitle: true, avatarUrl: true }
  })

  const username = profile?.username ?? (user.user_metadata?.username as string) ?? 'unknown'
  const title = profile?.selectedTitle ?? ''
  const avatarUrl = profile?.avatarUrl ?? ''

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}>⚙️ Settings</h1>
        <p style={{ color: 'hsl(220 10% 55%)' }}>Manage your account preferences.</p>
      </div>

      {/* Profile section */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Profile</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <UsernameForm initialUsername={username} initialTitle={title} initialAvatarUrl={avatarUrl} />
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}>Email</label>
            <input className="input" defaultValue={user.email ?? ''} id="settings-email" readOnly style={{ opacity: 0.7, cursor: 'not-allowed' }} />
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Preferences</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { label: 'Sound effects',         id: 'pref-sound',         checked: true  },
            { label: 'Show on leaderboard',    id: 'pref-leaderboard',   checked: true  },
            { label: 'Email notifications',    id: 'pref-email',         checked: true  },
          ].map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.9rem', color: 'hsl(220 10% 75%)' }}>{p.label}</span>
              <input type="checkbox" defaultChecked={p.checked} id={p.id} style={{ width: 18, height: 18, accentColor: 'hsl(220 100% 60%)' }} />
            </label>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ padding: '1.5rem', borderColor: 'hsl(0 80% 40% / 0.3)' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem', color: 'hsl(0 80% 60%)' }}>Danger Zone</h2>
        <p style={{ fontSize: '0.85rem', color: 'hsl(220 10% 55%)', marginBottom: '1rem' }}>Once you delete your account, all data is permanently lost.</p>
        <button className="btn btn-danger btn-sm" id="settings-delete-account" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
          Delete Account (Coming Soon)
        </button>
      </div>
    </div>
  )
}
