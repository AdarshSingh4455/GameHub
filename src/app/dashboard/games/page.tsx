'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GAMES_REGISTRY } from '@/lib/games'
import { prefetchProfileDetails } from '@/lib/prefetch'
import GameIcon from '@/components/games/GameIcon'

const CATEGORIES = ['All', 'Social', 'Dual Player', 'Board', 'Strategy', 'Multiplayer', 'Puzzle', 'Arcade', 'Match-3']

export default function GamesDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    prefetchProfileDetails()
  }, [])

  const filteredGames = GAMES_REGISTRY.filter((game) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      game.category.toLowerCase() === selectedCategory.toLowerCase() ||
      (selectedCategory.toLowerCase() === 'multiplayer' && game.multiplayer) ||
      (game.categories && game.categories.some(c => c.toLowerCase() === selectedCategory.toLowerCase()))

    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.aliases && game.aliases.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())))

    return matchesCategory && matchesSearch
  })

  return (
    <div style={{ maxWidth: 1200, marginInline: 'auto', width: '100%' }} className="animate-fadeIn mobile-centered-wrapper">
      {/* Header section */}
      <div style={{ marginBottom: '1.75rem' }} className="page-header">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: '0.4rem' }}>
          Games Library 🎮
        </h1>
        <p style={{ color: 'hsl(220 10% 55%)' }} className="page-description">
          Explore our complete collection of games. Play solo vs AI, compete with friends, or climb the leaderboard.
        </p>
      </div>

      {/* Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        {/* Category Tabs */}
        <div className="category-chips-container">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`category-chip ${isActive ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 1rem 0.45rem 2.1rem',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid hsl(220 20% 20%)',
              background: 'hsl(220 20% 8%)',
              color: 'hsl(220 15% 90%)',
              outline: 'none',
            }}
            id="game-search-input"
          />
          <span
            style={{
              position: 'absolute',
              left: '0.7rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(220 10% 45%)',
              pointerEvents: 'none',
              fontSize: '0.85rem',
            }}
          >
            🔍
          </span>
        </div>
      </div>

      {/* Games Grid - Compact cards: logo + name only */}
      {filteredGames.length > 0 ? (
        <div className="games-compact-grid stagger">
          {filteredGames.map((game) => (
            <Link
              key={game.slug}
              href={`/dashboard/games/${game.slug}`}
              className="games-compact-card animate-slideUp"
              id={`game-card-${game.slug}`}
            >
              {/* Top Section: Badge */}
              <div className="card-top-section">
                <span className={`premium-badge ${game.badge ? `badge-${game.badge.toLowerCase()}` : `cat-${game.category.toLowerCase().replace(' ', '-')}`}`}>
                  {game.badge || game.category}
                </span>
              </div>

              {/* Middle Section: Dedicated Premium Icon Container */}
              <div className="card-middle-section">
                <div className="games-premium-icon-container">
                  <GameIcon slug={game.slug} size={64} />
                </div>
              </div>

              {/* Bottom Section: Name & Multiplayer Indicator */}
              <div className="card-bottom-section">
                <span className="games-compact-name">{game.name}</span>
                {game.multiplayer ? (
                  <span className="games-mp-indicator">👥 Dual Mode</span>
                ) : (
                  <span className="games-solo-indicator">👤 Solo Practice</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center', borderRadius: 16 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👾</div>
          <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>No games found</h3>
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.9rem' }}>
            We couldn&apos;t find any games matching &quot;{searchQuery}&quot; in the {selectedCategory} category.
          </p>
        </div>
      )}

      <style jsx>{`
        .games-compact-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1.25rem;
        }

        .games-compact-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1rem 1.25rem;
          border-radius: 20px;
          border: 1px solid hsl(220 20% 16%);
          background: linear-gradient(135deg, hsl(222 22% 9% / 0.8), hsl(222 18% 12% / 0.8));
          backdrop-filter: blur(8px);
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.2s, box-shadow 0.2s, background 0.2s;
          min-height: 240px;
          height: 100%;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        .games-compact-card:hover {
          transform: translateY(-6px) scale(1.03);
          border-color: hsl(220 100% 65% / 0.4);
          box-shadow: 0 12px 30px hsl(220 100% 60% / 0.15), 0 4px 12px rgba(0,0,0,0.5);
          background: linear-gradient(135deg, hsl(222 22% 11% / 0.9), hsl(222 20% 14% / 0.9));
        }

        .games-compact-card:active {
          transform: translateY(-2px) scale(0.98);
        }

        .card-top-section {
          width: 100%;
          display: flex;
          justify-content: center;
          margin-bottom: 0.5rem;
        }

        .premium-badge {
          font-size: 0.62rem;
          font-weight: 800;
          padding: 0.2rem 0.65rem;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          background: hsl(220 20% 16%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 70%);
          white-space: nowrap;
        }

        .premium-badge.badge-live {
          background: linear-gradient(135deg, hsl(355 85% 55%), hsl(355 75% 45%)) !important;
          color: white !important;
          border: none !important;
          box-shadow: 0 2px 8px hsl(355 85% 55% / 0.2);
        }

        .premium-badge.badge-hot {
          background: linear-gradient(135deg, hsl(38 95% 55%), hsl(22 90% 50%)) !important;
          color: white !important;
          border: none !important;
          box-shadow: 0 2px 8px hsl(38 95% 55% / 0.2);
        }

        .premium-badge.badge-new {
          background: linear-gradient(135deg, hsl(142 70% 45%), hsl(142 60% 35%)) !important;
          color: white !important;
          border: none !important;
          box-shadow: 0 2px 8px hsl(142 70% 45% / 0.2);
        }

        .card-middle-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0.75rem 0;
        }

        .games-premium-icon-container {
          width: 80px;
          height: 80px;
          border-radius: 18px;
          background: linear-gradient(135deg, hsl(222 20% 14%), hsl(222 20% 10%));
          border: 1px solid hsl(220 15% 20%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.05), 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease;
        }

        .games-compact-card:hover .games-premium-icon-container {
          transform: scale(1.08);
          border-color: hsl(220 100% 65% / 0.3);
        }

        .card-bottom-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
        }

        .games-compact-name {
          font-size: 0.88rem;
          font-weight: 800;
          color: white;
          text-align: center;
          line-height: 1.25;
          max-width: 100%;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .games-mp-indicator {
          font-size: 0.68rem;
          font-weight: 700;
          color: hsl(142 70% 55%);
        }

        .games-solo-indicator {
          font-size: 0.68rem;
          font-weight: 700;
          color: hsl(220 10% 55%);
        }

        @media (max-width: 767px) {
          .games-compact-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 0.75rem !important;
          }
          .games-compact-card {
            padding: 1.25rem 0.75rem 1rem;
            min-height: 220px;
          }
          .games-premium-icon-container {
            width: 72px;
            height: 72px;
          }
        }
      `}</style>
    </div>
  )
}
