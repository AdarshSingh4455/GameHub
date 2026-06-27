'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { GAMES_REGISTRY } from '@/lib/games'
import { prefetchProfileDetails } from '@/lib/prefetch'
import GameIcon from '@/components/games/GameIcon'

const CATEGORIES = ['All', 'Social', 'Dual Player', 'Strategy', 'Puzzle', 'Arcade', 'Match-3']

export default function GamesDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  useEffect(() => {
    prefetchProfileDetails()
  }, [])

  const filteredGames = GAMES_REGISTRY.filter((game) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      game.category.toLowerCase() === selectedCategory.toLowerCase()

    const matchesSearch =
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase())

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
              {/* Badge overlay */}
              {game.badge && (
                <span className="games-compact-badge">{game.badge}</span>
              )}

              {/* Icon */}
              <div className="games-compact-icon">
                <GameIcon slug={game.slug} size={40} />
              </div>

              {/* Name */}
              <span className="games-compact-name">{game.name}</span>

              {/* Multiplayer dot */}
              {game.multiplayer && (
                <div className="games-compact-mp-dot" title="Multiplayer available" />
              )}
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
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 0.85rem;
        }

        @media (min-width: 480px) {
          .games-compact-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
        }

        @media (min-width: 768px) {
          .games-compact-grid {
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 1rem;
          }
        }

        @media (min-width: 1100px) {
          .games-compact-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          }
        }

        .games-compact-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          padding: 1rem 0.5rem 0.9rem;
          border-radius: 16px;
          border: 1px solid hsl(220 20% 18%);
          background: linear-gradient(135deg, hsl(222 20% 10%), hsl(222 18% 13%));
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          aspect-ratio: 1 / 1.05;
          overflow: hidden;
        }

        .games-compact-card:hover {
          transform: translateY(-4px) scale(1.03);
          border-color: hsl(220 100% 60% / 0.5);
          box-shadow: 0 8px 24px hsl(220 100% 60% / 0.12), 0 2px 8px rgba(0,0,0,0.3);
          background: linear-gradient(135deg, hsl(222 22% 12%), hsl(222 20% 16%));
        }

        .games-compact-card:active {
          transform: scale(0.97);
        }

        .games-compact-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: hsl(220 20% 15%);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }

        .games-compact-name {
          font-size: 0.75rem;
          font-weight: 700;
          color: hsl(220 15% 88%);
          text-align: center;
          line-height: 1.25;
          max-width: 100%;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .games-compact-badge {
          position: absolute;
          top: 6px;
          right: 6px;
          font-size: 0.55rem;
          font-weight: 800;
          padding: 0.15rem 0.4rem;
          border-radius: 99px;
          background: linear-gradient(135deg, hsl(220 100% 55%), hsl(270 80% 60%));
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        .games-compact-mp-dot {
          position: absolute;
          bottom: 7px;
          right: 8px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: hsl(142 70% 55%);
          box-shadow: 0 0 6px hsl(142 70% 55% / 0.6);
        }

        @media (max-width: 480px) {
          .games-compact-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 0.6rem !important;
          }
          .games-compact-card {
            padding: 0.8rem 0.35rem 0.75rem;
            border-radius: 12px;
          }
          .games-compact-icon {
            width: 42px;
            height: 42px;
            border-radius: 10px;
          }
          .games-compact-name {
            font-size: 0.68rem;
          }
        }
      `}</style>
    </div>
  )
}
