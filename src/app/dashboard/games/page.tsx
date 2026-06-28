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
              {/* Top-right badge only if applicable: NEW, HOT, LIVE */}
              {(() => {
                const badgeUpper = game.badge?.toUpperCase()
                const showBadge = badgeUpper && ['NEW', 'HOT', 'LIVE'].includes(badgeUpper)
                return showBadge ? (
                  <span className={`premium-badge badge-${badgeUpper.toLowerCase()}`}>
                    {badgeUpper}
                  </span>
                ) : null
              })()}

              {/* Large Game Icon */}
              <div className="games-premium-icon-container">
                <GameIcon slug={game.slug} size={72} />
              </div>

              {/* Game Name */}
              <span className="games-compact-name">{game.name}</span>

              {/* Category Label */}
              <span className="games-category-badge">{game.category}</span>
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
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .games-compact-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.25rem;
          border-radius: 24px;
          border: 1px solid hsl(220 20% 20%);
          background: hsl(222 25% 10%);
          backdrop-filter: blur(8px);
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.25s, box-shadow 0.25s, background 0.25s;
          aspect-ratio: 1 / 1;
          width: 100%;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .games-compact-card:hover {
          transform: translateY(-6px);
          border-color: hsl(220 100% 65% / 0.5);
          box-shadow: 0 12px 32px hsl(220 100% 60% / 0.18), 0 8px 20px rgba(0,0,0,0.6);
          background: hsl(222 25% 12%);
        }

        .games-compact-card:active {
          transform: translateY(-2px) scale(0.98);
        }

        .premium-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 0.62rem;
          font-weight: 800;
          padding: 0.2rem 0.65rem;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          z-index: 10;
          color: white;
        }

        .premium-badge.badge-live {
          background: linear-gradient(135deg, hsl(355 85% 55%), hsl(355 75% 45%));
          box-shadow: 0 2px 8px hsl(355 85% 55% / 0.35);
        }

        .premium-badge.badge-hot {
          background: linear-gradient(135deg, hsl(38 95% 55%), hsl(22 90% 50%));
          box-shadow: 0 2px 8px hsl(38 95% 55% / 0.35);
        }

        .premium-badge.badge-new {
          background: linear-gradient(135deg, hsl(142 70% 45%), hsl(142 60% 35%));
          box-shadow: 0 2px 8px hsl(142 70% 45% / 0.35);
        }

        .games-premium-icon-container {
          width: 96px;
          height: 96px;
          border-radius: 20px;
          background: linear-gradient(135deg, hsl(222 20% 16%), hsl(222 20% 12%));
          border: 1px solid hsl(220 15% 22%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, border-color 0.2s ease;
          margin-bottom: 0.75rem;
        }

        .games-compact-card:hover .games-premium-icon-container {
          transform: scale(1.06);
          border-color: hsl(220 100% 65% / 0.4);
        }

        .games-compact-name {
          font-size: 1.02rem;
          font-weight: 800;
          color: white;
          text-align: center;
          line-height: 1.3;
          max-width: 100%;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          margin-bottom: 0.3rem;
        }

        .games-category-badge {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 0.2rem 0.65rem;
          border-radius: 8px;
          background: hsl(220 20% 15%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 70%);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @media (max-width: 767px) {
          .games-compact-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }
          .games-compact-card {
            padding: 0.75rem;
            border-radius: 18px;
          }
          .games-premium-icon-container {
            width: 72px;
            height: 72px;
            border-radius: 16px;
            margin-bottom: 0.5rem;
          }
          .games-compact-name {
            font-size: 0.88rem;
            margin-bottom: 0.2rem;
          }
          .games-category-badge {
            font-size: 0.6rem;
            padding: 0.15rem 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
