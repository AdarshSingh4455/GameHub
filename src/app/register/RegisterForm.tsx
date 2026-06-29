'use client'
import { SuccessIcon } from '@/components/shared/Icons'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterForm() {
  const router = useRouter()
  const [username, setUsername]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  async function handleGoogleSignIn() {
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`
      }
    })
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (username.length < 3)  { setError('Username must be at least 3 characters.'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Create profile via API route
    if (data.user) {
      await fetch('/api/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, username }),
      })
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}><SuccessIcon size={48} className="text-green-500" /></div>
        <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Account created!</h2>
        <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Check your email to confirm your account, then sign in.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => router.push('/login')}
          id="goto-login"
        >
          Go to Sign In
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <div style={{ background: 'hsl(0 80% 55% / 0.1)', border: '1px solid hsl(0 80% 55% / 0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'hsl(0 80% 65%)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}>
          Username
        </label>
        <input
          type="text"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          placeholder="your_username"
          required
          minLength={3}
          maxLength={20}
          id="register-username"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}>
          Email
        </label>
        <input
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          id="register-email"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}>
          Password
        </label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 6 characters"
          required
          minLength={6}
          id="register-password"
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading}
        id="register-submit"
        style={{ marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Creating account…' : 'Create Free Account'}
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'hsl(220 20% 20%)' }} />
        <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 45%)' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'hsl(220 20% 20%)' }} />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="btn btn-secondary"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.6rem',
          borderRadius: 8,
          fontWeight: 600,
          background: 'hsl(220 20% 12%)',
          border: '1px solid hsl(220 20% 20%)',
          color: 'hsl(220 10% 85%)',
          cursor: 'pointer'
        }}
        id="register-google"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        Sign up with Google
      </button>
    </form>
  )
}
