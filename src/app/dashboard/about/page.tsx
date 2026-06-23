'use client'

import React, { useEffect, useState } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'

interface PlatformStats {
  totalPlayers: number
  totalMatches: number
  totalGames: number
  totalAchievements: number
  totalCosmetics: number
  totalFriendConnections: number
}

export default function AboutPage() {
  const { addToast } = useToast()
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/platform/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success) {
          setStats(data.stats)
        }
      })
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoading(false))
  }, [])

  const handleShare = () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://gamehub.app'
    if (navigator.share) {
      navigator.share({
        title: 'GameHub',
        text: 'Join me on GameHub - Play, compete, progress and connect!',
        url: shareUrl,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(shareUrl)
      addToast('success', 'Link Copied', 'GameHub share link copied to clipboard!')
    }
  }

  return (
    <div className="animate-fadeIn safe-bottom-padding" style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* ── Premium Hero Banner ── */}
      <div 
        className="card glass" 
        style={{ 
          padding: '3rem 2rem', 
          borderRadius: 24, 
          textAlign: 'center', 
          position: 'relative', 
          overflow: 'hidden',
          background: 'linear-gradient(135deg, hsl(220 30% 8% / 0.95), hsl(260 30% 8% / 0.95))',
          border: '1px solid hsl(220 15% 18%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}
      >
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, hsl(220 100% 60% / 0.08) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />
        <span style={{ fontSize: '3rem', display: 'block', animation: 'float 4s ease-in-out infinite' }}>🎮</span>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.75rem)', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }} className="gradient-text">
          GameHub
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'hsl(220 10% 65%)', fontWeight: 500, margin: 0, maxWidth: 500 }}>
          Play. Compete. Progress. Connect.
        </p>
        <button 
          onClick={handleShare}
          className="btn btn-primary"
          style={{ marginTop: '0.5rem', borderRadius: 12, padding: '0.6rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span>🔗</span> Share GameHub
        </button>
      </div>

      {/* ── Live Platform Statistics ── */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
          📈 Live Platform Statistics
        </h2>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem', color: 'hsl(220 10% 50%)', fontSize: '0.85rem' }}>
            Retrieving live stats...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }} className="profile-stats-grid">
            {[
              { label: 'Total Players', val: stats?.totalPlayers ?? 0, color: 'hsl(220 100% 70%)', emoji: '👥' },
              { label: 'Total Multiplayer Matches', val: stats?.totalMatches ?? 0, color: 'hsl(270 80% 70%)', emoji: '⚔️' },
              { label: 'Total Games', val: stats?.totalGames ?? 0, color: 'hsl(142 70% 55%)', emoji: '🎮' },
              { label: 'Total Achievements', val: stats?.totalAchievements ?? 0, color: 'hsl(45 100% 60%)', emoji: '🎖️' },
              { label: 'Total Cosmetics', val: stats?.totalCosmetics ?? 0, color: 'hsl(340 85% 65%)', emoji: '🎨' },
              { label: 'Total Friend Connections', val: stats?.totalFriendConnections ?? 0, color: 'hsl(180 70% 50%)', emoji: '🤝' }
            ].map((s, idx) => (
              <div 
                key={idx} 
                style={{ 
                  padding: '1rem', 
                  background: 'hsl(222 20% 8% / 0.8)', 
                  border: '1px solid hsl(220 15% 15%)', 
                  borderRadius: 14, 
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{s.emoji}</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color }}>
                  {s.val.toLocaleString()}
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'hsl(220 10% 45%)', textTransform: 'uppercase' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main About Info ── */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
          ℹ️ About GameHub
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.92rem', color: 'hsl(220 10% 75%)', lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            GameHub is a modern social gaming platform built to bring casual, competitive, and multiplayer gaming together in one unified experience.
          </p>
          <p style={{ margin: 0 }}>
            Unlike traditional gaming websites that focus on a single game, GameHub combines multiple skill-based games, progression systems, achievements, rankings, cosmetics, social features, and real-time multiplayer interactions into one ecosystem.
          </p>
        </div>
      </div>

      {/* ── Founder section ── */}
      <div 
        className="card glass" 
        style={{ 
          padding: '2rem 1.5rem', 
          borderRadius: 20, 
          background: 'linear-gradient(135deg, hsl(220 20% 10% / 0.8), hsl(220 20% 8% / 0.8))',
          border: '1px solid hsl(220 15% 18%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: 0, letterSpacing: '0.05em' }}>
          👨‍💻 Product Founder
        </h2>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div 
            style={{ 
              width: 64, 
              height: 64, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'white',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.3)'
            }}
          >
            AS
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: 0 }}>Adarsh Singh</h3>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(270 80% 65%)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginTop: '2px' }}>
              Creator, Designer, Product Visionary & Developer
            </span>
            <p style={{ fontSize: '0.88rem', color: 'hsl(220 10% 70%)', lineHeight: 1.5, marginTop: '0.75rem', margin: 0 }}>
              GameHub was created by Adarsh Singh with the vision of building an engaging gaming ecosystem that combines fun, competition, progression, and social interaction into one platform.
            </p>
            <p style={{ fontSize: '0.88rem', color: 'hsl(220 10% 70%)', lineHeight: 1.5, marginTop: '0.5rem', margin: 0 }}>
              The goal was not simply to create another gaming website, but to build a platform where players can enjoy multiple games, showcase achievements, unlock rewards, develop rivalries, and create memorable experiences with friends. Every feature, from multiplayer rooms and rankings to cosmetics and achievements, was designed around making gaming more interactive and rewarding.
            </p>
          </div>
        </div>
      </div>

      {/* ── Vision Section ── */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
          👁️ Platform Vision & Roadmap
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.92rem', color: 'hsl(220 10% 75%)', lineHeight: 1.6 }}>
          <p style={{ margin: 0, fontWeight: 500, color: 'white' }}>
            To create one of the most engaging and accessible gaming ecosystems where anyone can instantly join, compete, progress, and connect with others through games.
          </p>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 100% 70%)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              🚀 Future Roadmap:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }} className="profile-stats-grid">
              {[
                '🎮 New Puzzle & Arcade Games',
                '🏆 Competitive Seasonal Tournaments',
                '⚔️ Advanced Ranked Modes & MMR',
                '👥 Community Hubs & Clubs',
                '📱 Native iOS & Android Apps',
                '🌐 Global Cross-play Matchmaking'
              ].map((r, i) => (
                <div key={i} style={{ padding: '0.5rem 0.75rem', background: 'hsl(222 20% 7%)', borderRadius: 8, fontSize: '0.8rem', border: '1px solid hsl(220 15% 12%)' }}>
                  {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline Section ── */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1.25rem 0', letterSpacing: '0.05em' }}>
          🗓️ Platform Timeline
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative', paddingLeft: '1.5rem' }}>
          <div style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 2, background: 'hsl(220 15% 18%)' }} />
          {[
            { date: 'Q1 2026', title: 'Ideation & Core Prototyping', desc: 'Conceived the social progression architecture. Built local versions of Memory Match and Hangman.' },
            { date: 'Q2 2026', title: 'Multiplayer Engine Launch', desc: 'Integrated Socket.IO rooms, player lobbies, and live chat features.' },
            { date: 'Q2 2026 (June)', title: 'Cosmetic Store Expansion', desc: 'Introduced milestone unlockable titles and avatar frames. Expanded chat message packs.' },
            { date: 'Q3 2026 (Planning)', title: 'Mobile App Wrap & PWA Support', desc: 'Wrapped GameHub using Capacitor and implemented offline-ready service worker caches.' }
          ].map((item, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <div 
                style={{ 
                  position: 'absolute', 
                  left: -24, 
                  top: 5, 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  background: 'hsl(220 100% 60%)', 
                  border: '3px solid #0b0f19',
                  boxShadow: '0 0 8px hsl(220 100% 60%)'
                }} 
              />
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 50%)' }}>{item.date}</span>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white', margin: '2px 0 4px 0' }}>{item.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 60%)', margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Technology Stack ── */}
      <div className="card" style={{ padding: '1.5rem', borderRadius: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem 0', letterSpacing: '0.05em' }}>
          🛠️ Technology Stack
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem' }}>
          {[
            { name: 'Next.js 15', desc: 'API routes & SSR layout compilation', icon: '⚡' },
            { name: 'React 19', desc: 'Declarative component logic', icon: '⚛️' },
            { name: 'TypeScript', desc: 'Static compile-time type safety', icon: '📘' },
            { name: 'Prisma ORM', desc: 'Database model querying', icon: '💎' },
            { name: 'PostgreSQL', desc: 'Robust transactional database', icon: '🐘' },
            { name: 'Supabase', desc: 'Secure user login session management', icon: '⚡' },
            { name: 'Socket.IO', desc: 'Real-time room syncing and actions', icon: '🔌' },
            { name: 'Tailwind CSS', desc: 'Responsive CSS layout overrides', icon: '🎨' }
          ].map((t, i) => (
            <div 
              key={i} 
              style={{ 
                padding: '0.85rem', 
                background: 'hsl(222 20% 7%)', 
                border: '1px solid hsl(220 15% 14%)', 
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{t.name}</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', margin: 0, lineHeight: 1.3 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer Section ── */}
      <footer 
        style={{ 
          borderTop: '1px solid hsl(220 15% 18%)', 
          padding: '2rem 1.5rem', 
          textAlign: 'center', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '8px', 
          marginTop: '1rem' 
        }}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>GameHub</span>
        <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)' }}>
          Play. Compete. Progress. Connect.
        </span>
        <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 40%)', marginTop: '0.5rem' }}>
          Built with ❤️ by Adarsh Singh
        </span>
      </footer>

    </div>
  )
}
