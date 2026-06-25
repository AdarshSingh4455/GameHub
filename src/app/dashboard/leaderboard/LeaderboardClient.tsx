'use client'

import React, { useState, useEffect } from 'react'
import ProfileCardModal from '@/components/layout/ProfileCardModal'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import RankBadge from '@/components/layout/RankBadge'
import { getRankDetails } from '@/lib/rankedUtils'
import Avatar from '@/components/shared/Avatar'

interface LeaderboardRow {
  rank: number
  profileId: string
  username: string
  displayName?: string | null
  level: number
  xp?: number
  score?: number
  wins: number
  title?: string | null
  movement: 'up' | 'down' | 'same' | 'none'
  currentRank: number | null
  previousRank: number | null
  avatarUrl?: string | null
  selectedFrame?: string | null
}

interface RankedRow {
  rank: number
  profileId: string
  username: string
  displayName?: string | null
  level: number
  mmr: number
  wins: number
  losses: number
  winRate: number
  rankLabel: string
  peakRank: string
  streak: number
  avatarUrl?: string | null
  selectedFrame?: string | null
  selectedTitle?: string | null
}

interface SeasonWinner {
  username: string
  displayName?: string | null
  mmr: number
  rank: string
  wins: number
  losses: number
  winRate: number
}

interface HallOfFameEntry {
  seasonId: string
  seasonName: string
  endDate: string
  winner: SeasonWinner | null
  topPlayers: SeasonWinner[]
}

const TIMEFRAMES = [
  { value: 'all-time', label: 'All Time' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]

const GAMES = [
  { value: 'all', label: 'All Games' },
  { value: 'cricket', label: 'Hand Cricket' },
  { value: 'tic-tac-toe', label: 'Tic-Tac-Toe' },
  { value: 'memory', label: 'Memory Match' },
  { value: '2048', label: '2048' },
  { value: 'fighter', label: 'Fighter Jet' },
  { value: 'block-blast-classic', label: 'Block Blast (Classic)' },
  { value: 'block-blast-daily', label: 'Block Blast (Daily)' },
  { value: 'neon-tetris-classic', label: 'Neon Tetris (Classic)' },
  { value: 'neon-tetris-daily', label: 'Neon Tetris (Daily)' },
  { value: 'word-wizard-classic', label: 'Word Wizard (Classic)' },
  { value: 'word-wizard-daily', label: 'Word Wizard (Daily)' },
  { value: 'hangman-classic', label: 'Hangman Classic' },
  { value: 'hangman-multiplayer', label: 'Hangman Multiplayer' },
]

export default function LeaderboardClient() {
  const { user } = useGameSession()
  
  // Tabs: 'casual' | 'ranked' | 'hallOfFame'
  const [activeTab, setActiveTab] = useState<'casual' | 'ranked' | 'hallOfFame'>('casual')

  // Casual state
  const [scope, setScope] = useState<'global' | 'friends'>('global')
  const [timeframe, setTimeframe] = useState('all-time')
  const [game, setGame] = useState('all')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [casualLoading, setCasualLoading] = useState(true)

  // Ranked State
  const [rankedRows, setRankedRows] = useState<RankedRow[]>([])
  const [rankedStats, setRankedStats] = useState<any>(null)
  const [activeSeason, setActiveSeason] = useState<any>(null)
  const [rankedLoading, setRankedLoading] = useState(true)
  


  // Hall of Fame State
  const [hallOfFame, setHallOfFame] = useState<HallOfFameEntry[]>([])
  const [hofLoading, setHofLoading] = useState(true)

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Load Casual Leaderboard
  useEffect(() => {
    if (activeTab !== 'casual') return
    setCasualLoading(true)
    const params = new URLSearchParams()
    if (game !== 'all') {
      params.set('game', game)
    } else {
      params.set('timeframe', timeframe)
    }
    if (scope === 'friends') {
      params.set('friends', 'true')
    }

    fetch(`/api/leaderboard?${params.toString()}`)
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Failed to fetch')
      })
      .then((data) => {
        setRows(data.rows || [])
        setCasualLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setCasualLoading(false)
      })
  }, [timeframe, game, scope, activeTab])

  // Load Ranked Data
  const loadRankedData = () => {
    setRankedLoading(true)
    // Fetch stats
    fetch('/api/ranked/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setRankedStats(data))
      .catch((err) => console.error(err))

    // Fetch seasons
    fetch('/api/ranked/seasons')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setActiveSeason(data.activeSeason)
          setHallOfFame(data.hallOfFame || [])
        }
      })
      .catch((err) => console.error(err))

    // Fetch leaderboard
    fetch('/api/ranked/leaderboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setRankedRows(data.rows || [])
        setRankedLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setRankedLoading(false)
      })
  }

  useEffect(() => {
    if (activeTab === 'ranked') {
      loadRankedData()
    } else if (activeTab === 'hallOfFame') {
      setHofLoading(true)
      fetch('/api/ranked/seasons')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setHallOfFame(data.hallOfFame || [])
            setActiveSeason(data.activeSeason)
          }
          setHofLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setHofLoading(false)
        })
    }
  }, [activeTab])



  // Trigger Season Reset Simulation
  const handleSeasonReset = async () => {
    if (!confirm('Are you sure you want to end the current season? This will archive standings and reset all MMR ratings to 1000.')) return
    try {
      const res = await fetch('/api/ranked/seasons', { method: 'POST' })
      if (res.ok) {
        alert('Season successfully ended. STANDINGS RESET!')
        loadRankedData()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const myMmr = rankedStats?.mmr ?? 1000
  const myDetails = getRankDetails(myMmr)

  return (
    <div className="animate-fadeIn safe-bottom-padding leaderboard-page-container">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}>🏆 Global Leaderboard</h1>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem' }}>
            Check out current rankings, seasonal milestones, and compete in the multiplayer ranked ecosystem.
          </p>
        </div>
        {activeTab === 'ranked' && user && (
          <button
            onClick={handleSeasonReset}
            className="btn btn-sm btn-ghost"
            style={{ color: 'hsl(0 80% 60%)', fontSize: '0.72rem', borderColor: 'hsla(0, 80%, 60%, 0.25)' }}
          >
            ⏹️ End Season
          </button>
        )}
      </div>

      {/* Tabs list - swipeable on mobile */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid hsl(220 15% 18%)',
          paddingBottom: '0.5rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar"
      >
        {[
          { key: 'casual', label: 'Casual XP & High Scores', icon: '🎮' },
          { key: 'ranked', label: 'Ranked Competitive', icon: '⚡' },
          { key: 'hallOfFame', label: 'Hall of Fame', icon: '👑' },
        ].map((t) => {
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                scrollSnapAlign: 'start',
                flexShrink: 0,
                background: active ? undefined : 'transparent',
                borderColor: 'transparent',
                fontSize: '0.8rem',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              {t.icon} {t.label}
            </button>
          )
        })}
      </div>

      {/* ────────────────── 1. CASUAL LEADERBOARDS TAB ────────────────── */}
      {activeTab === 'casual' && (
        <>
          {/* Filter Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {user && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', marginRight: '0.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope:</span>
                <button onClick={() => setScope('global')} className={`btn btn-sm ${scope === 'global' ? 'btn-primary' : 'btn-secondary'}`}>🌍 Global</button>
                <button onClick={() => setScope('friends')} className={`btn btn-sm ${scope === 'friends' ? 'btn-primary' : 'btn-secondary'}`}>👥 Friends</button>
              </div>
            )}

            {game === 'all' && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className={`btn btn-sm ${timeframe === t.value ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Game:</span>
              <select
                value={game}
                onChange={(e) => {
                  setGame(e.target.value)
                  if (e.target.value !== 'all') setTimeframe('all-time')
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem 2rem 0.5rem 0.75rem',
                  borderRadius: '10px',
                  backgroundColor: 'hsl(220 20% 10%)',
                  border: '1px solid hsl(220 15% 18%)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  outline: 'none',
                  minHeight: 38
                }}
              >
                <option value="all">All Games</option>
                <option value="cricket">Hand Cricket</option>
                <option value="tic-tac-toe">Tic-Tac-Toe</option>
                <option value="memory">Memory Match</option>
                <option value="2048">2048</option>
                <option value="fighter">Fighter Jet</option>
                <optgroup label="Block Blast">
                  <option value="block-blast-classic">Block Blast (Classic)</option>
                  <option value="block-blast-daily">Block Blast (Daily)</option>
                </optgroup>
                <optgroup label="Neon Tetris">
                  <option value="neon-tetris-classic">Neon Tetris (Classic)</option>
                  <option value="neon-tetris-daily">Neon Tetris (Daily)</option>
                </optgroup>
                <optgroup label="Word Wizard">
                  <option value="word-wizard-classic">Word Wizard (Classic)</option>
                  <option value="word-wizard-daily">Word Wizard (Daily)</option>
                </optgroup>
                <optgroup label="Hangman">
                  <option value="hangman-classic">Hangman Classic</option>
                  <option value="hangman-multiplayer">Hangman Multiplayer</option>
                </optgroup>
              </select>
            </div>
          </div>

          {/* Casual Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {casualLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading standings...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'hsl(222 20% 13%)', borderBottom: '1px solid hsl(220 15% 20%)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Rank</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Player</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Level</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>{game !== 'all' ? 'High Score' : 'XP'}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.profileId + '-' + i} style={{ borderBottom: i < rows.length - 1 ? '1px solid hsl(220 15% 18%)' : 'none' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: row.rank <= 3 ? ['hsl(45 100% 60%)', 'hsl(220 15% 75%)', 'hsl(25 80% 55%)'][row.rank - 1] : 'hsl(220 10% 50%)', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ minWidth: '1.75rem' }}>{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar
                            avatarUrl={row.avatarUrl}
                            username={row.username}
                            selectedFrame={row.selectedFrame}
                            size={32}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <button
                              onClick={() => setSelectedProfileId(row.profileId)}
                              style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, fontWeight: 600, color: 'white', cursor: 'pointer', textAlign: 'left' }}
                              className="hover-underline"
                            >
                              {row.displayName || (row.username.includes('@') ? row.username.split('@')[0] : row.username)}
                            </button>
                            <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 55%)' }}>
                              @{row.username}
                            </span>
                            {row.title && (
                              <span style={{ fontSize: '0.7rem', color: 'hsl(45 100% 60%)', fontWeight: 600, letterSpacing: '0.05em' }}>
                                {row.title}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'hsl(270 80% 65%)', fontWeight: 700 }}>Lv {row.level}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'hsl(220 100% 65%)', fontWeight: 600 }}>{game !== 'all' ? (row.score ?? 0).toLocaleString() : `${(row.xp ?? 0).toLocaleString()} XP`}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'hsl(142 70% 55%)', fontWeight: 600 }}>{row.wins}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>No player records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ────────────────── 2. RANKED LEADERBOARDS TAB ────────────────── */}
      {activeTab === 'ranked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Current Player Rank Status card */}
          {user && rankedStats && (
            <div className="card animate-slideUp" style={{
              background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
              border: '1px solid hsl(220 20% 16%)',
              borderRadius: '24px',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {/* Backglow element */}
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: myDetails.glowColor, filter: 'blur(45px)', pointerEvents: 'none' }} />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <RankBadge mmr={myMmr} size="lg" showLabel={true} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{user.email?.split('@')[0]}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)' }}>
                        Rating: <strong style={{ color: 'white' }}>{myMmr} MMR</strong>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: rankedStats.streak >= 3 ? 'hsl(142 70% 50%)' : 'hsl(220 10% 50%)', background: 'rgba(255,255,255,0.03)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        {rankedStats.streak >= 3 ? `🔥 ${rankedStats.streak} Win Streak` : `Streak: ${rankedStats.streak}`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: '0.75rem', width: '220px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>
                        <span>{myDetails.minMmr} MMR</span>
                        <span>{myDetails.maxMmr === 99999 ? 'MAX' : `${myDetails.maxMmr} MMR`}</span>
                      </div>
                      <div style={{ height: '6px', background: 'hsl(220 20% 12%)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${myDetails.progress}%`, background: `linear-gradient(90deg, ${myDetails.badgeColor}, #ffffff)`, borderRadius: '99px', boxShadow: `0 0 10px ${myDetails.badgeColor}` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Wins</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(142 70% 55%)' }}>{rankedStats.wins}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Losses</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(0 80% 60%)' }}>{rankedStats.losses}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Peak Rank</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'hsl(45 100% 60%)' }}>{rankedStats.peakRank}</div>
                  </div>
                </div>

                {/* Matchmaking Queue Trigger */}
                <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.78rem', color: 'hsl(220 10% 55%)' }}>
                    Active: <strong>{activeSeason?.name || 'Season 1'}</strong> (Ends: {activeSeason ? new Date(activeSeason.endDate).toLocaleDateString() : 'N/A'})
                  </div>
                  <button
                    disabled
                    className="btn btn-secondary"
                    style={{
                      padding: '0.5rem 1.25rem',
                      fontWeight: 800,
                      borderRadius: '12px',
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }}
                  >
                    ⚔️ Ranked Queue (Coming Soon)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Ranked Table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            {rankedLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading ranked standings...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'hsl(222 20% 13%)', borderBottom: '1px solid hsl(220 15% 20%)' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Rank</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Player</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Division Badge</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>MMR Rating</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>W / L</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedRows.map((row, i) => (
                    <tr key={row.profileId + '-' + i} style={{ borderBottom: i < rankedRows.length - 1 ? '1px solid hsl(220 15% 18%)' : 'none' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: row.rank <= 3 ? ['hsl(45 100% 60%)', 'hsl(220 15% 75%)', 'hsl(25 80% 55%)'][row.rank - 1] : 'hsl(220 10% 50%)', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ minWidth: '1.75rem' }}>{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <Avatar
                            avatarUrl={row.avatarUrl}
                            username={row.username}
                            selectedFrame={row.selectedFrame}
                            size={32}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <button
                              onClick={() => setSelectedProfileId(row.profileId)}
                              style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, fontWeight: 600, color: 'white', cursor: 'pointer', textAlign: 'left' }}
                              className="hover-underline"
                            >
                              {row.displayName || (row.username.includes('@') ? row.username.split('@')[0] : row.username)}
                            </button>
                            <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 55%)' }}>
                              @{row.username}
                            </span>
                            {row.selectedTitle && (
                              <span style={{ fontSize: '0.7rem', color: 'hsl(45 100% 60%)', fontWeight: 600, letterSpacing: '0.05em' }}>
                                {row.selectedTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <RankBadge mmr={row.mmr} size="sm" />
                          <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 65%)', fontWeight: 600 }}>{row.rankLabel}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'hsl(220 100% 65%)', fontWeight: 700 }}>{row.mmr} MMR</td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'hsl(220 10% 55%)' }}>
                        <span style={{ color: 'hsl(142 70% 50%)', fontWeight: 600 }}>{row.wins}W</span> / <span style={{ color: 'hsl(0 80% 55%)', fontWeight: 600 }}>{row.losses}L</span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'hsl(45 100% 60%)', fontWeight: 700 }}>{row.winRate}%</td>
                    </tr>
                  ))}
                  {rankedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>No player records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── 3. HALL OF FAME TAB ────────────────── */}
      {activeTab === 'hallOfFame' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {hofLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading Hall of Fame...</div>
          ) : (
            <>
              {hallOfFame.map((entry, idx) => (
                <div key={entry.seasonId || idx} className="card animate-slideUp" style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
                  border: '1px solid hsl(220 20% 16%)',
                  borderRadius: '24px',
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 900, color: 'hsl(45 100% 55%)', fontSize: '1.15rem' }}>👑 {entry.seasonName}</h3>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)' }}>
                        Archived: {new Date(entry.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.winner && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(251, 191, 36, 0.05)', padding: '0.4rem 1rem', borderRadius: '12px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 50%)', fontWeight: 600 }}>CHAMPION:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fef08a' }}>
                            {entry.winner.displayName || (entry.winner.username.includes('@') ? entry.winner.username.split('@')[0] : entry.winner.username)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)' }}>({entry.winner.mmr} MMR)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
                    Top Standings Snapshots
                  </h4>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase' }}>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Rank</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Player</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>Division</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left' }}>MMR</th>
                        <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.topPlayers.map((player, pIdx) => (
                        <tr key={pIdx} style={{ fontSize: '0.8rem', borderBottom: pIdx < entry.topPlayers.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                          <td style={{ padding: '0.5rem 0.5rem', fontWeight: 700, color: pIdx === 0 ? 'hsl(45 100% 55%)' : 'hsl(220 10% 50%)' }}>
                            {pIdx === 0 ? '🥇 1st' : pIdx === 1 ? '🥈 2nd' : pIdx === 2 ? '🥉 3rd' : `#${pIdx + 1}`}
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600, color: 'white' }}>
                            {player.displayName || (player.username.includes('@') ? player.username.split('@')[0] : player.username)}
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem', color: 'hsl(220 10% 60%)' }}>{player.rank}</td>
                          <td style={{ padding: '0.5rem 0.5rem', color: 'hsl(220 100% 65%)', fontWeight: 600 }}>{player.mmr} MMR</td>
                          <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: 'hsl(142 70% 50%)', fontWeight: 600 }}>{player.winRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {hallOfFame.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }} className="card">
                  🏆 No archived season records in the Hall of Fame yet. Resets will snapshot standings here.
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ProfileCardModal
        profileId={selectedProfileId}
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
      />
    </div>
  )
}
