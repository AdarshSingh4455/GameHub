'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { GAMES_REGISTRY, GameInfo } from '@/lib/games'
import DashboardRetentionPanel from '@/components/layout/DashboardRetentionPanel'
import { prefetchProfileDetails } from '@/lib/prefetch'
import GameIcon from '@/components/games/GameIcon'

interface Props {
  user: User | null
  username: string
}

const CATEGORIES = ['All', 'Dual Player', 'Social', 'Puzzle', 'Arcade', 'Strategy', 'Match-3']

export default function DashboardClient({ user, username }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    prefetchProfileDetails()
  }, [])

  // Featured Game selection based on day of the year (daily deterministic "random")
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const featuredGame = GAMES_REGISTRY[dayOfYear % GAMES_REGISTRY.length]

  // Quick Play games (Cricket, Memory, 2048, Fighter)
  const quickPlayGames = GAMES_REGISTRY.filter(g => ['cricket', 'memory', '2048', 'fighter'].includes(g.slug))

  // Filter games based on selected category
  const filteredGames = selectedCategory === 'All'
    ? GAMES_REGISTRY
    : GAMES_REGISTRY.filter(g => g.category.toLowerCase() === selectedCategory.toLowerCase())

  return (
    <div style={{ maxWidth: 1100, display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }} className="animate-fadeIn safe-bottom-padding">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontWeight: 900, marginBottom: '0.25rem', color: 'white' }}>
          {user ? `Welcome back, ${username} 👋` : 'Pick a Game, Jump In 🎮'}
        </h1>
        <p style={{ color: 'hsl(220 10% 55%)', margin: 0, fontSize: '0.85rem' }}>
          {user ? 'Continue your streak and climb the leaderboards.' : 'Play as guest — or create an account to save your XP.'}
        </p>

        {!user && (
          <div className="card" style={{ marginTop: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', color: 'white' }}>🔒 Unlock full features</div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', lineHeight: 1.4 }}>Create a free account to earn XP, unlock achievements, and compete on leaderboards.</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <Link href="/register" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>Create Account</Link>
              <Link href="/login"    className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Sign In</Link>
            </div>
          </div>
        )}
      </div>

      {/* Spotlight Featured Game Card */}
      <div className="card animate-pulse-glow" style={{
        background: 'linear-gradient(135deg, hsl(220 100% 60% / 0.12), hsl(270 80% 60% / 0.12))',
        border: '1px solid hsl(220 100% 60% / 0.35)',
        padding: '1.25rem',
        borderRadius: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        boxShadow: 'var(--shadow-glow-primary)',
      }} id="dashboard-spotlight-card">
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'hsl(45 100% 65%)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
            🔥 FEATURED SPOTLIGHT
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '-0.02em' }}>
            <span>{featuredGame.emoji}</span>
            <span>{featuredGame.name}</span>
          </h2>
          <p style={{ color: 'hsl(220 10% 65%)', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
            {featuredGame.description}
          </p>
        </div>
        <Link href={`/dashboard/games/${featuredGame.slug}`} className="btn btn-primary" style={{ borderRadius: 12, padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} id="spotlight-play-btn">
          🚀 Play Spotlight
        </Link>
      </div>

      {/* Engagement & Daily claim widgets */}
      <DashboardRetentionPanel user={user} />

      {/* Quick Play Row (Horizontal scroll swipe) */}
      <div>
        <h2 style={{ fontWeight: 900, fontSize: '1.05rem', marginBottom: '0.5rem', color: 'white', letterSpacing: '-0.01em' }}>⚡ Quick Play</h2>
        
        <div className="quick-play-scroll" style={{
          display: 'flex',
          gap: '0.75rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
          scrollbarWidth: 'none',
        }} id="quick-play-row">
          {quickPlayGames.map(game => (
            <Link
              key={`quick-${game.slug}`}
              href={`/dashboard/games/${game.slug}`}
              className="card card-hover"
              style={{
                flex: '0 0 130px',
                padding: '0.9rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: '0.4rem',
                textDecoration: 'none',
                borderRadius: 14,
              }}
              id={`quick-play-${game.slug}`}
            >
              <GameIcon slug={game.slug} size={36} />
              <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{game.name}</span>
              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: 99, background: 'hsl(220 20% 16%)', color: 'hsl(220 10% 60%)', fontWeight: 600 }}>
                {game.category}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Filter Category Chips & All Games Grid */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.05rem', color: 'white', letterSpacing: '-0.01em', margin: 0 }}>🎮 All Games</h2>
            <Link href="/dashboard/games" style={{ fontSize: '0.75rem', color: 'hsl(220 100% 65%)', textDecoration: 'none', fontWeight: 700 }}>View catalog →</Link>
          </div>

          {/* Swipeable Category Chips container */}
          <div className="category-chips-container" style={{
            display: 'flex',
            gap: '0.4rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            padding: '0.15rem 0',
          }} id="category-chips">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`category-chip ${selectedCategory === category ? 'active' : ''}`}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: 99,
                  border: '1px solid',
                  borderColor: selectedCategory === category ? 'hsl(220 100% 60%)' : 'hsl(220 15% 18%)',
                  background: selectedCategory === category ? 'hsl(220 100% 60% / 0.12)' : 'hsl(222 18% 12%)',
                  color: selectedCategory === category ? 'hsl(220 100% 75%)' : 'hsl(220 10% 60%)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                id={`category-chip-${category.toLowerCase().replace(' ', '-')}`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* 2-Columns grid on mobile, maps to custom css classes */}
        <div className="dashboard-games-grid stagger" id="games-grid-container">
          {filteredGames.map((game) => (
            <Link
              key={game.slug}
              href={`/dashboard/games/${game.slug}`}
              className="card card-hover dashboard-game-card animate-slideUp"
              style={{
                borderRadius: 14,
              }}
              id={`game-card-${game.slug}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.4rem' }}>
                <GameIcon slug={game.slug} size={30} />
                <div style={{ textAlign: 'right' }}>
                  {game.badge && (
                    <span style={{ fontSize: '0.6rem', padding: '0.15rem 0.45rem', borderRadius: '99px', background: 'hsl(220 20% 20%)', color: 'hsl(220 10% 65%)', fontWeight: 800, textTransform: 'uppercase' }}>
                      {game.badge}
                    </span>
                  )}
                  {game.multiplayer && (
                    <div style={{ fontSize: '0.55rem', color: 'hsl(142 70% 55%)', marginTop: '0.2rem', fontWeight: 700 }}>● Dual Mode</div>
                  )}
                </div>
              </div>
              
              <div style={{ margin: '0.4rem 0' }}>
                <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.2rem', color: 'white' }}>{game.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', lineHeight: 1.3, height: '2.6em', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {game.description}
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid hsl(220 15% 15%)', paddingTop: '0.4rem' }}>
                <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem', borderRadius: '99px', background: 'hsl(220 20% 20%)', color: 'hsl(220 10% 55%)', fontWeight: 600 }}>
                  {game.category}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'hsl(220 100% 65%)', fontWeight: 800 }}>Play →</span>
              </div>
            </Link>
          ))}
          {filteredGames.length === 0 && (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)', fontSize: '0.8rem' }}>
              No games found in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
