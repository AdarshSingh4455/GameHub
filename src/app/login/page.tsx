import { GamepadIcon } from '@/components/shared/Icons'
import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from './LoginForm'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
      {/* BG orbs */}
      <div style={{ position: 'fixed', top: '15%', left: '10%', width: 500, height: 500, borderRadius: '50%', background: 'hsl(220 100% 60% / 0.06)', filter: 'blur(100px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '10%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'hsl(270 80% 60% / 0.06)', filter: 'blur(100px)', pointerEvents: 'none' }} />

      <div className="card animate-slideUp" style={{ width: '100%', maxWidth: 440, padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontWeight: 800, fontSize: '1.5rem', display: 'block', marginBottom: '0.25rem' }} className="gradient-text"><GamepadIcon size={20} className="inline mr-1 text-blue-400" /> GameHub</span>
          </Link>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Welcome back</h1>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem' }}>Sign in to track your XP and achievements</p>
        </div>

        <LoginForm />

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'hsl(220 10% 55%)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'hsl(220 100% 65%)', fontWeight: 600, textDecoration: 'none' }}>
            Create one free
          </Link>
        </div>

        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <Link href="/dashboard" style={{ color: 'hsl(220 10% 50%)', fontSize: '0.8rem', textDecoration: 'none' }}>
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  )
}
