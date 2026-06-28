'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GAMES_REGISTRY, GameInfo } from '@/lib/games'
import { prefetchProfileDetails } from '@/lib/prefetch'
import GameIcon from '@/components/games/GameIcon'

// ─── Category Configuration ──────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'All',         label: 'All Games',   emoji: '🎮' },
  { id: 'Social',      label: 'Social',      emoji: '🎭' },
  { id: 'Multiplayer', label: 'Multiplayer', emoji: '🌐' },
  { id: 'Puzzle',      label: 'Puzzle',      emoji: '🧩' },
  { id: 'Arcade',      label: 'Arcade',      emoji: '🕹️' },
  { id: 'Strategy',    label: 'Strategy',    emoji: '♟️' },
  { id: 'Dual Player', label: 'Dual Player', emoji: '⚔️' },
  { id: 'Match-3',     label: 'Match-3',     emoji: '🍬' },
]

// ─── Badge color map ─────────────────────────────────────────────────────────
const BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  NEW:  { bg: 'linear-gradient(135deg, hsl(142 70% 45%), hsl(142 60% 35%))', color: '#fff' },
  HOT:  { bg: 'linear-gradient(135deg, hsl(22 95% 55%), hsl(38 95% 50%))',   color: '#fff' },
  LIVE: { bg: 'linear-gradient(135deg, hsl(355 85% 55%), hsl(355 75% 45%))', color: '#fff' },
}

// ─── Game Card Component ─────────────────────────────────────────────────────
function GameCard({ game }: { game: GameInfo }) {
  const badgeUpper = game.badge?.toUpperCase()
  const showBadge  = badgeUpper && ['NEW', 'HOT', 'LIVE'].includes(badgeUpper)
  const badgeStyle = showBadge ? BADGE_COLORS[badgeUpper!] : null

  return (
    <Link
      href={`/dashboard/games/${game.slug}`}
      className="glib-game-card"
      id={`game-card-${game.slug}`}
    >
      {/* Top Right Status Badge */}
      {showBadge && badgeStyle && (
        <span
          className="glib-game-badge"
          style={{
            background: badgeStyle.bg,
            color: badgeStyle.color,
          }}
        >
          {badgeUpper}
        </span>
      )}

      {/* Center: Large Game Logo / Icon */}
      <div className="glib-icon-wrap">
        <GameIcon slug={game.slug} size={56} />
      </div>

      {/* Game Info: Name and Category */}
      <div className="glib-info-wrap">
        <span className="glib-game-name">{game.name}</span>
        <span className="glib-cat-badge">{game.category}</span>
      </div>
    </Link>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function GamesLibraryPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery]         = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [isSearchFocused, setIsSearchFocused]  = useState(false)

  useEffect(() => { prefetchProfileDetails() }, [])

  // Filtering logic
  const matchCategory = (game: GameInfo, cat: string) => {
    if (cat === 'All') return true
    if (cat === 'Multiplayer') return game.multiplayer
    return (
      game.category.toLowerCase() === cat.toLowerCase() ||
      (game.categories?.some(c => c.toLowerCase() === cat.toLowerCase()) ?? false)
    )
  }

  const matchSearch = (game: GameInfo, q: string) => {
    if (!q) return true
    const lower = q.toLowerCase()
    return (
      game.name.toLowerCase().includes(lower) ||
      game.description.toLowerCase().includes(lower) ||
      (game.aliases?.some(a => a.toLowerCase().includes(lower)) ?? false) ||
      game.category.toLowerCase().includes(lower)
    )
  }

  const filteredGames = useMemo(
    () => GAMES_REGISTRY.filter(g => matchCategory(g, selectedCategory) && matchSearch(g, searchQuery)),
    [selectedCategory, searchQuery]
  )

  return (
    <div className="glib-root animate-fadeIn">

      {/* ── Header ── */}
      <div className="glib-header">
        <h1 className="glib-title">Games Library</h1>
        <p className="glib-subtitle">
          Discover and play premium web games. Select a card to jump right in.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div className={`glib-search-container ${isSearchFocused ? 'focused' : ''}`}>
        <span className="glib-search-icon">🔍</span>
        <input
          id="game-search-input"
          type="text"
          placeholder="Search games by name, category, or keyword..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="glib-search-input"
          autoComplete="off"
        />
        {searchQuery && (
          <button
            className="glib-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Category Pills ── */}
      <div className="glib-pills-wrap" role="tablist" aria-label="Game categories">
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => { setSelectedCategory(cat.id); setSearchQuery('') }}
              className={`glib-pill ${isActive ? 'glib-pill--active' : ''}`}
              id={`category-pill-${cat.id.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Game Grid ── */}
      <div className="glib-grid-section">
        {filteredGames.length > 0 ? (
          <div className="glib-grid stagger">
            {filteredGames.map(game => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        ) : (
          <div className="glib-empty">
            <div className="glib-empty-icon">👾</div>
            <h3 className="glib-empty-title">No games found</h3>
            <p className="glib-empty-desc">
              We couldn't find any games matching your current search or category filter.
            </p>
            <button
              className="glib-empty-btn"
              onClick={() => { setSearchQuery(''); setSelectedCategory('All') }}
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Styles ── */}
      <style jsx>{`
        .glib-root {
          max-width: 1200px;
          margin-inline: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding-bottom: 3rem;
        }

        /* ── Header ── */
        .glib-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .glib-title {
          font-size: 2.25rem;
          font-weight: 800;
          color: white;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .glib-subtitle {
          color: hsl(220 10% 60%);
          font-size: 0.95rem;
          margin: 0;
        }

        /* ── Search Bar ── */
        .glib-search-container {
          position: relative;
          width: 100%;
          display: flex;
          align-items: center;
        }
        .glib-search-icon {
          position: absolute;
          left: 1rem;
          font-size: 1rem;
          color: hsl(220 10% 50%);
          pointer-events: none;
        }
        .glib-search-input {
          width: 100%;
          padding: 0.85rem 2.5rem 0.85rem 2.75rem;
          font-size: 0.95rem;
          font-family: inherit;
          border-radius: 14px;
          border: 1px solid hsl(220 15% 20%);
          background: hsl(222 22% 9%);
          color: white;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .glib-search-container.focused .glib-search-input {
          border-color: hsl(220 100% 60% / 0.8);
          box-shadow: 0 0 0 3px hsl(220 100% 60% / 0.15);
        }
        .glib-search-input::placeholder {
          color: hsl(220 10% 45%);
        }
        .glib-search-clear {
          position: absolute;
          right: 1rem;
          background: transparent;
          border: none;
          color: hsl(220 10% 50%);
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0.2rem;
          border-radius: 50%;
        }

        /* ── Category Pills ── */
        .glib-pills-wrap {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 0.15rem 0;
          -ms-overflow-style: none;
        }
        .glib-pills-wrap::-webkit-scrollbar {
          display: none;
        }
        .glib-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          white-space: nowrap;
          padding: 0.5rem 1.1rem;
          border-radius: 99px;
          border: 1px solid hsl(220 15% 18%);
          background: hsl(222 20% 9%);
          color: hsl(220 10% 60%);
          font-family: inherit;
          font-size: 0.825rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .glib-pill:hover {
          border-color: hsl(220 15% 28%);
          color: white;
          background: hsl(222 20% 12%);
        }
        .glib-pill--active {
          border-color: hsl(220 100% 60%);
          background: hsl(220 100% 60% / 0.12);
          color: hsl(220 100% 75%);
          box-shadow: 0 0 12px hsl(220 100% 60% / 0.15);
        }

        /* ── Grid ── */
        .glib-grid-section {
          width: 100%;
          margin-top: 0.5rem;
        }
        .glib-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.25rem;
          width: 100%;
        }

        /* ── Game Card ── */
        .glib-game-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 220px;
          padding: 1.5rem 1rem;
          border-radius: 16px;
          border: 1px solid hsl(220 15% 18%);
          background: linear-gradient(135deg, hsl(222 20% 10%), hsl(222 18% 13%));
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          text-decoration: none;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                      border-color 0.2s ease,
                      box-shadow 0.2s ease;
          cursor: pointer;
          box-sizing: border-box;
          overflow: hidden;
        }
        .glib-game-card:hover {
          transform: translateY(-4px);
          border-color: hsl(220 100% 60% / 0.7);
          box-shadow: 0 12px 30px rgba(99, 102, 241, 0.25);
        }

        /* Status Badge */
        .glib-game-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 0.58rem;
          font-weight: 900;
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          z-index: 10;
        }

        /* Icon Container */
        .glib-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 16px;
          background: hsl(220 20% 15%);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease;
        }
        .glib-game-card:hover .glib-icon-wrap {
          transform: scale(1.05);
        }

        /* Info Container */
        .glib-info-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          min-width: 0;
          margin-top: 1rem;
        }
        .glib-game-name {
          font-size: 0.9rem;
          font-weight: 800;
          color: white;
          text-align: center;
          line-height: 1.25;
          margin-bottom: 0.4rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
          display: block;
        }
        .glib-cat-badge {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
          background: hsl(220 20% 16%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 60%);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          display: inline-block;
        }

        /* ── Empty State ── */
        .glib-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
          background: hsl(222 20% 8% / 0.6);
          border: 1px solid hsl(220 15% 15%);
          border-radius: 20px;
          gap: 0.75rem;
          width: 100%;
          box-sizing: border-box;
        }
        .glib-empty-icon {
          font-size: 3rem;
        }
        .glib-empty-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: white;
          margin: 0;
        }
        .glib-empty-desc {
          font-size: 0.85rem;
          color: hsl(220 10% 50%);
          margin: 0;
          max-width: 320px;
          line-height: 1.5;
        }
        .glib-empty-btn {
          margin-top: 0.5rem;
          padding: 0.5rem 1.25rem;
          border-radius: 10px;
          background: hsl(220 100% 60% / 0.1);
          border: 1px solid hsl(220 100% 60% / 0.25);
          color: hsl(220 100% 70%);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .glib-empty-btn:hover {
          background: hsl(220 100% 60% / 0.18);
        }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .glib-root {
            gap: 1.25rem;
          }
          .glib-title {
            font-size: 1.85rem;
          }
          .glib-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
          .glib-game-card {
            height: 180px;
            padding: 1.25rem 0.75rem;
          }
          .glib-icon-wrap {
            width: 56px;
            height: 56px;
            border-radius: 12px;
          }
          .glib-game-name {
            font-size: 0.825rem;
          }
          .glib-cat-badge {
            font-size: 0.6rem;
          }
        }
      `}</style>
    </div>
  )
}
