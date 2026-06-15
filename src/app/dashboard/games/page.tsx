'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GAMES_REGISTRY } from '@/lib/games'

const CATEGORIES = ['All', 'Social', 'Dual Player', 'Strategy', 'Puzzle', 'Arcade']

export default function GamesDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Filter games based on search query and category
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
    <div style={{ maxWidth: 1100 }} className="animate-fadeIn">
      {/* Header section */}
      <div style={{ marginBottom: '2rem' }} className="page-header">
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.2rem)', fontWeight: 800, marginBottom: '0.5rem' }}>
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
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
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
                style={{
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 1rem 0.5rem 2.25rem',
              fontSize: '0.875rem',
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
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(220 10% 45%)',
              pointerEvents: 'none',
              fontSize: '0.9rem',
            }}
          >
            🔍
          </span>
        </div>
      </div>

      {/* Grid listing */}
      {filteredGames.length > 0 ? (
        <div className="dashboard-games-grid stagger">
          {filteredGames.map((game) => (
            <Link
              key={game.slug}
              href={`/dashboard/games/${game.slug}`}
              className="card card-hover dashboard-game-card animate-slideUp"
              id={`game-card-${game.slug}`}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontSize: '2.5rem' }}>{game.emoji}</span>
                <div style={{ textAlign: 'right' }}>
                  {game.badge && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.6rem',
                        borderRadius: '99px',
                        background: 'hsl(220 20% 18%)',
                        color: 'hsl(220 10% 70%)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {game.badge}
                    </span>
                  )}
                  {game.multiplayer && (
                    <div style={{ fontSize: '0.6rem', color: 'hsl(142 70% 55%)', marginTop: '0.35rem', fontWeight: 600 }}>
                      ● Multiplayer
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3
                  style={{
                    fontWeight: 800,
                    fontSize: '1.05rem',
                    marginBottom: '0.35rem',
                    color: 'hsl(220 15% 92%)',
                  }}
                >
                  {game.name}
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'hsl(220 10% 50%)', lineHeight: 1.5 }}>
                  {game.description}
                </p>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '99px',
                    background: 'hsl(220 20% 22%)',
                    color: 'hsl(220 10% 55%)',
                  }}
                >
                  {game.category}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'hsl(220 100% 65%)', fontWeight: 700 }}>
                  Play Now →
                </span>
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
    </div>
  )
}
