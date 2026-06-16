'use client'

import React, { useState, useEffect } from 'react'
import ProfileCardModal from '@/components/layout/ProfileCardModal'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

interface LeaderboardRow {
  rank: number
  profileId: string
  username: string
  level: number
  xp?: number
  score?: number
  wins: number
  title?: string | null
  movement: 'up' | 'down' | 'same' | 'none'
  currentRank: number | null
  previousRank: number | null
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
]

export default function LeaderboardClient() {
  const { user } = useGameSession()
  const [scope, setScope] = useState<'global' | 'friends'>('global')
  const [timeframe, setTimeframe] = useState('all-time')
  const [game, setGame] = useState('all')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
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
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [timeframe, game, scope])

  return (
    <div className="animate-fadeIn safe-bottom-padding" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}>🏆 Leaderboard</h1>
        <p style={{ color: 'hsl(220 10% 55%)' }}>Top players ranked by performance. Change filters below to see rankings.</p>
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Scope Select (Global vs Friends) */}
        {user && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 50%)', marginRight: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>Rankings Scope:</span>
            <button
              onClick={() => setScope('global')}
              className={`btn btn-sm ${scope === 'global' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderColor: scope === 'global' ? undefined : 'hsl(220 15% 18%)',
                background: scope === 'global' ? undefined : 'hsl(220 20% 8%)',
              }}
              id="lb-scope-global"
            >
              🌍 Global
            </button>
            <button
              onClick={() => setScope('friends')}
              className={`btn btn-sm ${scope === 'friends' ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderColor: scope === 'friends' ? undefined : 'hsl(220 15% 18%)',
                background: scope === 'friends' ? undefined : 'hsl(220 20% 8%)',
              }}
              id="lb-scope-friends"
            >
              👥 Friends
            </button>
          </div>
        )}

        {/* Timeframes (only active if game is 'all') */}
        {game === 'all' && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeframe(t.value)}
                className={`btn btn-sm ${timeframe === t.value ? 'btn-primary' : 'btn-secondary'}`}
                id={`lb-timeframe-${t.value}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Game Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'hsl(220 10% 50%)', marginRight: '0.25rem', fontWeight: 600, textTransform: 'uppercase' }}>Filter by Game:</span>
          {GAMES.map((g) => (
            <button
              key={g.value}
              onClick={() => {
                setGame(g.value)
                if (g.value !== 'all') {
                  setTimeframe('all-time') // reset timeframe when selecting a specific game
                }
              }}
              className={`btn btn-sm ${game === g.value ? 'btn-primary' : 'btn-secondary'}`}
              id={`lb-game-${g.value}`}
              style={{
                borderColor: game === g.value ? undefined : 'hsl(220 15% 18%)',
                background: game === g.value ? undefined : 'hsl(220 20% 8%)',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading rankings...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'hsl(222 20% 13%)', borderBottom: '1px solid hsl(220 15% 20%)' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Player</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Level</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {game !== 'all' ? 'High Score' : 'XP'}
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.profileId + '-' + i}
                  className="leaderboard-row"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid hsl(220 15% 18%)' : 'none' }}
                >
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: row.rank <= 3 ? ['hsl(45 100% 60%)', 'hsl(220 15% 75%)', 'hsl(25 80% 55%)'][row.rank - 1] : 'hsl(220 10% 50%)', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ minWidth: '1.75rem' }}>{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : `#${row.rank}`}</span>
                      {(() => {
                        if (row.movement === 'up') return <span style={{ color: 'hsl(142 70% 50%)', fontSize: '0.72rem' }} title="Moved Up">▲</span>
                        if (row.movement === 'down') return <span style={{ color: 'hsl(0 80% 55%)', fontSize: '0.72rem' }} title="Moved Down">▼</span>
                        if (row.movement === 'same') return <span style={{ color: 'hsl(220 10% 45%)', fontSize: '0.72rem' }} title="Unchanged">•</span>
                        return <span style={{ color: 'hsl(220 10% 30%)', fontSize: '0.72rem' }}>—</span>
                      })()}
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,hsl(220 100% 60%),hsl(270 80% 60%))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                        {row.username ? row.username[0].toUpperCase() : '?'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <button
                          onClick={() => setSelectedProfileId(row.profileId)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            textAlign: 'left',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: 'white',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                          className="hover-underline"
                        >
                          {row.username}
                        </button>
                        {row.title && (
                          <span style={{ fontSize: '0.72rem', color: 'hsl(45 100% 60%)', fontWeight: 500 }}>
                            {row.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'hsl(270 80% 65%)', fontWeight: 700 }}>Lv {row.level}</td>
                  <td style={{ padding: '0.85rem 1rem', color: 'hsl(220 100% 65%)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {game !== 'all' ? (row.score ?? 0).toLocaleString() : `${(row.xp ?? 0).toLocaleString()} XP`}
                  </td>
                  <td style={{ padding: '0.85rem 1rem', color: 'hsl(142 70% 55%)', fontWeight: 600 }}>{row.wins}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 55%)', fontSize: '0.85rem' }}>
                    No player records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'hsl(220 10% 35%)' }}>
        Live data updated in real-time from the database.
      </p>

      <ProfileCardModal
        profileId={selectedProfileId}
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
      />
    </div>
  )
}
