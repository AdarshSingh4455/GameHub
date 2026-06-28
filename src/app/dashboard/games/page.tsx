'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
const BADGE_COLORS: Record<string, { bg: string; color: string; shadow: string }> = {
  NEW:  { bg: 'linear-gradient(135deg, hsl(142 70% 45%), hsl(142 60% 35%))', color: '#fff', shadow: 'hsl(142 70% 45% / 0.4)' },
  HOT:  { bg: 'linear-gradient(135deg, hsl(22 95% 55%), hsl(38 95% 50%))',   color: '#fff', shadow: 'hsl(22 95% 55% / 0.4)' },
  LIVE: { bg: 'linear-gradient(135deg, hsl(355 85% 55%), hsl(355 75% 45%))', color: '#fff', shadow: 'hsl(355 85% 55% / 0.4)' },
}

// Category color accents per section
const SECTION_COLORS: Record<string, string> = {
  Social:       'hsl(270 80% 65%)',
  Multiplayer:  'hsl(220 100% 65%)',
  Puzzle:       'hsl(180 80% 55%)',
  Arcade:       'hsl(355 85% 65%)',
  Strategy:     'hsl(38 95% 60%)',
  'Dual Player':'hsl(142 70% 55%)',
  'Match-3':    'hsl(316 85% 65%)',
}

// ─── Deterministic featured game (changes daily) ─────────────────────────────
function getDailyFeaturedGame(): GameInfo {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const eligible = GAMES_REGISTRY.filter(g => g.multiplayer || g.badge === 'Hot')
  return eligible[dayOfYear % eligible.length] || GAMES_REGISTRY[0]
}

// ─── Game Card Component ─────────────────────────────────────────────────────
function GameCard({ game, size = 'md' }: { game: GameInfo; size?: 'sm' | 'md' | 'lg' }) {
  const badgeUpper = game.badge?.toUpperCase()
  const showBadge  = badgeUpper && ['NEW', 'HOT', 'LIVE'].includes(badgeUpper)
  const badgeStyle = showBadge ? BADGE_COLORS[badgeUpper!] : null

  const iconSize = size === 'sm' ? 52 : size === 'lg' ? 96 : 72

  return (
    <Link
      href={`/dashboard/games/${game.slug}`}
      className={`glib-game-card glib-game-card--${size}`}
      id={`game-card-${game.slug}`}
    >
      {/* Status Badge */}
      {showBadge && badgeStyle && (
        <span
          className="glib-game-badge"
          style={{
            background: badgeStyle.bg,
            color: badgeStyle.color,
            boxShadow: `0 2px 10px ${badgeStyle.shadow}`,
          }}
        >
          {badgeUpper}
        </span>
      )}

      {/* Multiplayer indicator */}
      {game.multiplayer && (
        <span className="glib-multiplayer-dot" title="Multiplayer available" />
      )}

      {/* Icon */}
      <div className="glib-icon-wrap">
        <GameIcon slug={game.slug} size={iconSize} />
      </div>

      {/* Title */}
      <span className="glib-game-name">{game.name}</span>

      {/* Category */}
      <span className="glib-cat-badge">{game.category}</span>
    </Link>
  )
}

// ─── Horizontal Carousel ─────────────────────────────────────────────────────
function GameCarousel({ games, title, accent }: { games: GameInfo[]; title: string; accent?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === 'right' ? 220 : -220, behavior: 'smooth' })
  }

  if (games.length === 0) return null

  return (
    <section className="glib-section">
      <div className="glib-section-header">
        <h2 className="glib-section-title" style={{ color: accent }}>
          {title}
        </h2>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="glib-scroll-btn" onClick={() => scroll('left')} aria-label="Scroll left">‹</button>
          <button className="glib-scroll-btn" onClick={() => scroll('right')} aria-label="Scroll right">›</button>
        </div>
      </div>
      <div className="glib-carousel" ref={scrollRef}>
        {games.map(game => (
          <div key={game.slug} className="glib-carousel-item">
            <GameCard game={game} size="sm" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section Grid ─────────────────────────────────────────────────────────────
function GameSection({
  games, title, subtitle, emoji, accent, viewAllCategory,
  onViewAll, maxVisible = 8
}: {
  games: GameInfo[]
  title: string
  subtitle?: string
  emoji: string
  accent?: string
  viewAllCategory: string
  onViewAll: (cat: string) => void
  maxVisible?: number
}) {
  if (games.length === 0) return null
  const visible = games.slice(0, maxVisible)

  return (
    <section className="glib-section">
      <div className="glib-section-header">
        <div>
          <h2 className="glib-section-title">
            <span style={{ marginRight: '0.5rem' }}>{emoji}</span>
            <span style={{ color: accent || 'white' }}>{title}</span>
          </h2>
          {subtitle && <p className="glib-section-subtitle">{subtitle}</p>}
        </div>
        {games.length > maxVisible && (
          <button
            className="glib-view-all"
            onClick={() => onViewAll(viewAllCategory)}
            style={{ color: accent }}
          >
            View All ({games.length}) →
          </button>
        )}
      </div>
      <div className="glib-grid glib-grid--section">
        {visible.map(game => (
          <GameCard key={game.slug} game={game} size="md" />
        ))}
      </div>
    </section>
  )
}

// ─── Featured Hero Card ───────────────────────────────────────────────────────
function FeaturedHeroCard({ game }: { game: GameInfo }) {
  return (
    <section className="glib-section">
      <Link href={`/dashboard/games/${game.slug}`} className="glib-featured-card" id="featured-game-card">
        {/* Glow blob */}
        <div className="glib-featured-glow" />

        <div className="glib-featured-left">
          <span className="glib-featured-eyebrow">🔥 Featured Today</span>
          <div className="glib-featured-icon">
            <GameIcon slug={game.slug} size={80} />
          </div>
          <h2 className="glib-featured-title">{game.name}</h2>
          <p className="glib-featured-desc">{game.description}</p>
          <div className="glib-featured-meta">
            <span className="glib-featured-cat">{game.category}</span>
            {game.multiplayer && (
              <span className="glib-featured-mp">🌐 Multiplayer</span>
            )}
          </div>
        </div>

        <div className="glib-featured-action">
          <div className="glib-featured-emoji">{game.emoji}</div>
          <div className="glib-featured-btn">
            <span>Play Now</span>
            <span style={{ fontSize: '1.1rem' }}>→</span>
          </div>
        </div>
      </Link>
    </section>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GamesLibraryPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery]         = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [isSearchFocused, setIsSearchFocused]  = useState(false)
  const featuredGame = useMemo(() => getDailyFeaturedGame(), [])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedCategory, searchQuery]
  )

  // Section slices (only shown on "All" without search)
  const showSections = selectedCategory === 'All' && !searchQuery
  const recentlyAdded  = GAMES_REGISTRY.filter(g => g.badge === 'New').slice(0, 10)
  const multiplayerGames = GAMES_REGISTRY.filter(g => g.multiplayer)
  const puzzleGames    = GAMES_REGISTRY.filter(g => g.category === 'Puzzle')
  const socialGames    = GAMES_REGISTRY.filter(g => g.category === 'Social')
  const arcadeGames    = GAMES_REGISTRY.filter(g => g.category === 'Arcade')

  const handleViewAll = (cat: string) => {
    setSelectedCategory(cat)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="glib-root animate-fadeIn">

      {/* ── Hero Bar ── */}
      <div className="glib-hero">
        <div className="glib-hero-text">
          <h1 className="glib-hero-title">Games Library</h1>
          <p className="glib-hero-subtitle">
            {GAMES_REGISTRY.length} games · Play solo, challenge friends, or climb the leaderboard
          </p>
        </div>

        {/* Search */}
        <div className={`glib-search-wrap ${isSearchFocused ? 'focused' : ''}`}>
          <span className="glib-search-icon">🔍</span>
          <input
            id="game-search-input"
            type="text"
            placeholder="Search games..."
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
      </div>

      {/* ── Quick Stats Strip ── */}
      <div className="glib-stats-strip">
        {[
          { label: 'Total Games',    value: GAMES_REGISTRY.length,                                        emoji: '🎮' },
          { label: 'Multiplayer',    value: GAMES_REGISTRY.filter(g => g.multiplayer).length,             emoji: '🌐' },
          { label: 'New This Month', value: GAMES_REGISTRY.filter(g => g.badge === 'New').length,         emoji: '✨' },
          { label: 'Categories',     value: CATEGORIES.length - 1,                                        emoji: '🏷️' },
        ].map(stat => (
          <div key={stat.label} className="glib-stat-item">
            <span className="glib-stat-emoji">{stat.emoji}</span>
            <span className="glib-stat-value">{stat.value}</span>
            <span className="glib-stat-label">{stat.label}</span>
          </div>
        ))}
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

      {/* ── Search Results ── */}
      {searchQuery && (
        <div className="glib-search-results-header">
          <span>
            {filteredGames.length > 0
              ? `${filteredGames.length} result${filteredGames.length !== 1 ? 's' : ''} for "${searchQuery}"`
              : `No games found for "${searchQuery}"`}
          </span>
          {filteredGames.length > 0 && (
            <button className="glib-view-all" onClick={() => setSearchQuery('')}>Clear ✕</button>
          )}
        </div>
      )}

      {/* ── Search / Filtered Grid ── */}
      {(searchQuery || selectedCategory !== 'All') && (
        filteredGames.length > 0 ? (
          <section className="glib-section">
            {!searchQuery && (
              <div className="glib-section-header">
                <h2 className="glib-section-title" style={{ color: SECTION_COLORS[selectedCategory] }}>
                  {CATEGORIES.find(c => c.id === selectedCategory)?.emoji}{' '}
                  {CATEGORIES.find(c => c.id === selectedCategory)?.label}
                </h2>
                <span className="glib-section-count">{filteredGames.length} games</span>
              </div>
            )}
            <div className="glib-grid glib-grid--main stagger">
              {filteredGames.map(game => (
                <GameCard key={game.slug} game={game} size="md" />
              ))}
            </div>
          </section>
        ) : (
          <div className="glib-empty">
            <div className="glib-empty-icon">👾</div>
            <h3 className="glib-empty-title">No games found</h3>
            <p className="glib-empty-desc">
              {searchQuery
                ? `We couldn't find any games matching "${searchQuery}".`
                : `No games in the ${selectedCategory} category yet.`}
            </p>
            <button
              className="glib-empty-btn"
              onClick={() => { setSearchQuery(''); setSelectedCategory('All') }}
            >
              Browse All Games
            </button>
          </div>
        )
      )}

      {/* ── Sectioned Layout (All, no search) ── */}
      {showSections && (
        <>
          {/* Featured Game */}
          <FeaturedHeroCard game={featuredGame} />

          {/* Recently Added Carousel */}
          {recentlyAdded.length > 0 && (
            <section className="glib-section">
              <div className="glib-section-header">
                <h2 className="glib-section-title">
                  <span style={{ marginRight: '0.5rem' }}>✨</span>
                  <span style={{ color: 'hsl(142 70% 55%)' }}>Recently Added</span>
                </h2>
                <button
                  className="glib-view-all"
                  style={{ color: 'hsl(142 70% 55%)' }}
                  onClick={() => handleViewAll('All')}
                >
                  View All →
                </button>
              </div>
              <div className="glib-carousel" id="recently-added-carousel">
                {recentlyAdded.map(game => (
                  <div key={game.slug} className="glib-carousel-item">
                    <GameCard game={game} size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Multiplayer Section */}
          <GameSection
            games={multiplayerGames}
            title="Multiplayer Games"
            subtitle="Play with or against your friends in real-time"
            emoji="🌐"
            accent={SECTION_COLORS['Multiplayer']}
            viewAllCategory="Multiplayer"
            onViewAll={handleViewAll}
          />

          {/* Social Section */}
          <GameSection
            games={socialGames}
            title="Social & Party"
            subtitle="Draw, act, deceive, and laugh together"
            emoji="🎭"
            accent={SECTION_COLORS['Social']}
            viewAllCategory="Social"
            onViewAll={handleViewAll}
          />

          {/* Puzzle Section */}
          <GameSection
            games={puzzleGames}
            title="Puzzle & Brain"
            subtitle="Train your brain with challenging puzzles"
            emoji="🧩"
            accent={SECTION_COLORS['Puzzle']}
            viewAllCategory="Puzzle"
            onViewAll={handleViewAll}
          />

          {/* Arcade Section */}
          {arcadeGames.length > 0 && (
            <GameSection
              games={arcadeGames}
              title="Arcade"
              subtitle="Fast-paced action and classic arcade thrills"
              emoji="🕹️"
              accent={SECTION_COLORS['Arcade']}
              viewAllCategory="Arcade"
              onViewAll={handleViewAll}
            />
          )}

          {/* All Games full grid */}
          <section className="glib-section">
            <div className="glib-section-header">
              <div>
                <h2 className="glib-section-title">
                  <span style={{ marginRight: '0.5rem' }}>🎮</span>
                  <span>Complete Library</span>
                </h2>
                <p className="glib-section-subtitle">Every game in one place</p>
              </div>
              <span className="glib-section-count">{GAMES_REGISTRY.length} games</span>
            </div>
            <div className="glib-grid glib-grid--main stagger">
              {GAMES_REGISTRY.map(game => (
                <GameCard key={game.slug} game={game} size="md" />
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── Styles ── */}
      <style jsx>{`

        /* ── Root ── */
        .glib-root {
          max-width: 1280px;
          margin-inline: auto;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding-bottom: 3rem;
        }

        /* ── Hero ── */
        .glib-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
          padding-top: 0.5rem;
        }
        .glib-hero-title {
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 900;
          color: white;
          letter-spacing: -0.03em;
          margin: 0 0 0.25rem;
          background: linear-gradient(135deg, #fff 60%, hsl(220 100% 75%));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glib-hero-subtitle {
          color: hsl(220 10% 55%);
          font-size: 0.9rem;
          margin: 0;
        }

        /* ── Search ── */
        .glib-search-wrap {
          position: relative;
          width: 100%;
          max-width: 320px;
          transition: max-width 0.3s ease;
        }
        .glib-search-wrap.focused {
          max-width: 380px;
        }
        .glib-search-icon {
          position: absolute;
          left: 0.85rem;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.9rem;
          pointer-events: none;
          z-index: 1;
        }
        .glib-search-input {
          width: 100%;
          padding: 0.6rem 2.5rem 0.6rem 2.4rem;
          font-size: 0.875rem;
          font-family: inherit;
          border-radius: 12px;
          border: 1px solid hsl(220 15% 22%);
          background: hsl(222 22% 9%);
          color: hsl(220 15% 92%);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .glib-search-input:focus {
          border-color: hsl(220 100% 60% / 0.6);
          box-shadow: 0 0 0 3px hsl(220 100% 60% / 0.1);
        }
        .glib-search-input::placeholder { color: hsl(220 10% 40%); }
        .glib-search-clear {
          position: absolute;
          right: 0.7rem;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: hsl(220 10% 45%);
          cursor: pointer;
          font-size: 0.8rem;
          padding: 0.1rem 0.25rem;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .glib-search-clear:hover { color: hsl(220 10% 75%); }

        /* ── Stats Strip ── */
        .glib-stats-strip {
          display: flex;
          gap: 1px;
          background: hsl(220 15% 18%);
          border: 1px solid hsl(220 15% 18%);
          border-radius: 16px;
          overflow: hidden;
        }
        .glib-stat-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          padding: 0.85rem 0.5rem;
          background: hsl(222 22% 10%);
          transition: background 0.15s;
        }
        .glib-stat-item:hover { background: hsl(222 22% 12%); }
        .glib-stat-emoji { font-size: 1.1rem; }
        .glib-stat-value { font-size: 1.4rem; font-weight: 900; color: white; line-height: 1; }
        .glib-stat-label { font-size: 0.62rem; color: hsl(220 10% 50%); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; }

        /* ── Category Pills ── */
        .glib-pills-wrap {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding: 0.15rem 0;
          -ms-overflow-style: none;
        }
        .glib-pills-wrap::-webkit-scrollbar { display: none; }
        .glib-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          white-space: nowrap;
          padding: 0.45rem 1rem;
          border-radius: 99px;
          border: 1px solid hsl(220 15% 20%);
          background: hsl(222 20% 9%);
          color: hsl(220 10% 60%);
          font-family: inherit;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          flex-shrink: 0;
        }
        .glib-pill:hover {
          border-color: hsl(220 100% 60% / 0.4);
          color: hsl(220 10% 85%);
          background: hsl(222 20% 12%);
          transform: translateY(-1px);
        }
        .glib-pill--active {
          border-color: hsl(220 100% 60%);
          background: hsl(220 100% 60% / 0.14);
          color: hsl(220 100% 78%);
          box-shadow: 0 0 14px hsl(220 100% 60% / 0.2);
          transform: translateY(-1px);
        }

        /* ── Sections ── */
        .glib-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .glib-section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .glib-section-title {
          font-size: 1.2rem;
          font-weight: 900;
          color: white;
          margin: 0;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
        }
        .glib-section-subtitle {
          font-size: 0.78rem;
          color: hsl(220 10% 50%);
          margin: 0.2rem 0 0;
        }
        .glib-section-count {
          font-size: 0.75rem;
          color: hsl(220 10% 45%);
          font-weight: 600;
          align-self: center;
          white-space: nowrap;
        }
        .glib-view-all {
          background: transparent;
          border: none;
          font-family: inherit;
          font-size: 0.78rem;
          font-weight: 700;
          color: hsl(220 100% 65%);
          cursor: pointer;
          padding: 0.2rem 0;
          white-space: nowrap;
          align-self: center;
          transition: opacity 0.15s;
        }
        .glib-view-all:hover { opacity: 0.75; }

        /* ── Grids ── */
        .glib-grid {
          display: grid;
          gap: 1rem;
        }
        .glib-grid--main {
          grid-template-columns: repeat(5, 1fr);
        }
        .glib-grid--section {
          grid-template-columns: repeat(4, 1fr);
        }

        /* ── Carousel ── */
        .glib-carousel {
          display: flex;
          gap: 0.85rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 0.5rem;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .glib-carousel::-webkit-scrollbar { display: none; }
        .glib-carousel-item {
          flex: 0 0 150px;
          scroll-snap-align: start;
        }
        .glib-scroll-btn {
          background: hsl(222 20% 14%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 65%);
          border-radius: 8px;
          width: 28px;
          height: 28px;
          font-size: 1.1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          padding: 0;
          line-height: 1;
        }
        .glib-scroll-btn:hover {
          background: hsl(220 100% 60% / 0.12);
          border-color: hsl(220 100% 60% / 0.4);
          color: white;
        }

        /* ── Game Cards ── */
        .glib-game-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          text-decoration: none;
          border-radius: 20px;
          border: 1px solid hsl(220 15% 17%);
          background: linear-gradient(160deg, hsl(222 25% 11%) 0%, hsl(222 20% 8%) 100%);
          box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                      border-color 0.2s ease,
                      box-shadow 0.22s ease,
                      background 0.2s ease;
        }
        .glib-game-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%);
          pointer-events: none;
        }
        .glib-game-card:hover {
          transform: translateY(-6px) scale(1.02);
          border-color: hsl(220 100% 60% / 0.45);
          box-shadow: 0 16px 40px rgba(0,0,0,0.55), 0 0 0 1px hsl(220 100% 60% / 0.1), 0 0 30px hsl(220 100% 60% / 0.12);
          background: linear-gradient(160deg, hsl(222 25% 13%) 0%, hsl(222 20% 10%) 100%);
        }
        .glib-game-card:active {
          transform: translateY(-2px) scale(0.98);
          transition-duration: 0.1s;
        }

        /* Card sizes */
        .glib-game-card--md {
          padding: 1.25rem 0.9rem;
          aspect-ratio: 1 / 1;
          width: 100%;
        }
        .glib-game-card--sm {
          padding: 1rem 0.65rem;
          width: 100%;
          min-height: 140px;
        }
        .glib-game-card--lg {
          padding: 1.75rem 1.25rem;
          aspect-ratio: 3 / 4;
        }

        /* Status badge */
        .glib-game-badge {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 0.58rem;
          font-weight: 900;
          padding: 0.18rem 0.55rem;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          z-index: 10;
        }

        /* Multiplayer dot */
        .glib-multiplayer-dot {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: hsl(142 70% 50%);
          box-shadow: 0 0 6px hsl(142 70% 50%);
        }

        /* Icon container */
        .glib-icon-wrap {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: linear-gradient(135deg, hsl(222 22% 16%), hsl(222 20% 12%));
          border: 1px solid hsl(220 15% 22%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.3);
          transition: transform 0.2s ease, border-color 0.2s ease;
          flex-shrink: 0;
        }
        .glib-game-card--sm .glib-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 14px;
        }
        .glib-game-card:hover .glib-icon-wrap {
          transform: scale(1.08);
          border-color: hsl(220 100% 65% / 0.4);
        }

        /* Game name */
        .glib-game-name {
          font-size: 0.88rem;
          font-weight: 800;
          color: white;
          text-align: center;
          line-height: 1.25;
          max-width: 100%;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .glib-game-card--sm .glib-game-name {
          font-size: 0.78rem;
          -webkit-line-clamp: 1;
        }

        /* Category badge */
        .glib-cat-badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 0.18rem 0.55rem;
          border-radius: 6px;
          background: hsl(220 20% 15%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 65%);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }

        /* ── Featured Card ── */
        .glib-featured-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          padding: 2rem 2.25rem;
          border-radius: 24px;
          border: 1px solid hsl(220 100% 60% / 0.35);
          background: linear-gradient(135deg, hsl(222 30% 11% / 0.95), hsl(220 25% 8% / 0.95));
          box-shadow: 0 0 0 1px hsl(220 100% 60% / 0.08), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px hsl(220 100% 60% / 0.08);
          text-decoration: none;
          position: relative;
          overflow: hidden;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          flex-wrap: wrap;
          min-height: 200px;
        }
        .glib-featured-card:hover {
          transform: translateY(-4px);
          border-color: hsl(220 100% 60% / 0.55);
          box-shadow: 0 0 0 1px hsl(220 100% 60% / 0.15), 0 24px 64px rgba(0,0,0,0.55), 0 0 60px hsl(220 100% 60% / 0.15);
        }
        .glib-featured-glow {
          position: absolute;
          top: -40%;
          right: -5%;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, hsl(220 100% 60% / 0.12) 0%, transparent 70%);
          pointer-events: none;
          filter: blur(40px);
        }
        .glib-featured-left {
          flex: 1;
          min-width: 220px;
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .glib-featured-eyebrow {
          font-size: 0.7rem;
          font-weight: 900;
          color: hsl(45 100% 65%);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .glib-featured-icon {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          background: hsl(222 22% 14%);
          border: 1px solid hsl(220 100% 60% / 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px hsl(220 100% 60% / 0.15);
        }
        .glib-featured-title {
          font-size: 1.7rem;
          font-weight: 900;
          color: white;
          letter-spacing: -0.025em;
          margin: 0;
          line-height: 1.1;
        }
        .glib-featured-desc {
          font-size: 0.82rem;
          color: hsl(220 10% 68%);
          margin: 0;
          line-height: 1.55;
          max-width: 500px;
        }
        .glib-featured-meta {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .glib-featured-cat {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.2rem 0.7rem;
          border-radius: 8px;
          background: hsl(220 20% 15%);
          border: 1px solid hsl(220 15% 22%);
          color: hsl(220 10% 70%);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .glib-featured-mp {
          font-size: 0.65rem;
          font-weight: 800;
          color: hsl(142 70% 55%);
          background: hsl(142 70% 50% / 0.12);
          border: 1px solid hsl(142 70% 50% / 0.25);
          padding: 0.2rem 0.7rem;
          border-radius: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .glib-featured-action {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          position: relative;
          z-index: 2;
          flex-shrink: 0;
        }
        .glib-featured-emoji {
          font-size: 4rem;
          line-height: 1;
          filter: drop-shadow(0 0 16px rgba(255,255,255,0.15));
          animation: float 3s ease-in-out infinite;
        }
        .glib-featured-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          border-radius: 12px;
          background: linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%));
          color: white;
          font-size: 0.88rem;
          font-weight: 800;
          box-shadow: 0 4px 20px hsl(220 100% 60% / 0.4);
          white-space: nowrap;
          transition: filter 0.15s, transform 0.15s;
        }
        .glib-featured-card:hover .glib-featured-btn {
          filter: brightness(1.1);
          transform: scale(1.03);
        }

        /* ── Search Results Header ── */
        .glib-search-results-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.82rem;
          color: hsl(220 10% 55%);
          font-weight: 600;
          padding: 0 0.1rem;
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
          border-radius: 24px;
          gap: 0.75rem;
        }
        .glib-empty-icon { font-size: 3.5rem; }
        .glib-empty-title { font-size: 1.2rem; font-weight: 800; color: white; margin: 0; }
        .glib-empty-desc { font-size: 0.85rem; color: hsl(220 10% 50%); margin: 0; max-width: 340px; line-height: 1.5; }
        .glib-empty-btn {
          margin-top: 0.5rem;
          padding: 0.55rem 1.4rem;
          border-radius: 10px;
          background: hsl(220 100% 60% / 0.12);
          border: 1px solid hsl(220 100% 60% / 0.3);
          color: hsl(220 100% 70%);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
        }
        .glib-empty-btn:hover { background: hsl(220 100% 60% / 0.2); }

        /* ── Responsive ── */
        @media (max-width: 1100px) {
          .glib-grid--main { grid-template-columns: repeat(4, 1fr); }
          .glib-grid--section { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 800px) {
          .glib-grid--main { grid-template-columns: repeat(3, 1fr); }
          .glib-grid--section { grid-template-columns: repeat(3, 1fr); }
          .glib-stats-strip { display: none; }
          .glib-featured-card { padding: 1.5rem; }
          .glib-featured-title { font-size: 1.35rem; }
          .glib-featured-desc { font-size: 0.78rem; }
        }
        @media (max-width: 600px) {
          .glib-root { gap: 1.5rem; }
          .glib-grid--main { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .glib-grid--section { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
          .glib-hero { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .glib-search-wrap, .glib-search-wrap.focused { max-width: 100%; }
          .glib-featured-action { display: none; }
          .glib-featured-card { min-height: auto; }
          .glib-featured-card { padding: 1.25rem; }
          .glib-featured-title { font-size: 1.2rem; }
          .glib-game-card--md { padding: 0.9rem 0.6rem; border-radius: 16px; }
          .glib-icon-wrap { width: 56px; height: 56px; border-radius: 14px; }
          .glib-game-name { font-size: 0.78rem; }
          .glib-cat-badge { font-size: 0.55rem; }
          .glib-carousel-item { flex: 0 0 130px; }
        }
      `}</style>
    </div>
  )
}
