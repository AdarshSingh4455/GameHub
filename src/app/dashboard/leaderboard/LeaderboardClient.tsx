'use client'

import React, { useState, useEffect } from 'react'
import ProfileCardModal from '@/components/layout/ProfileCardModal'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import RankBadge from '@/components/layout/RankBadge'
import { getRankDetails } from '@/lib/rankedUtils'
import Avatar from '@/components/shared/Avatar'
import { GAMES_REGISTRY } from '@/lib/games'

export interface DivisionRange {
  current: string
  next: string
  min: number
  max: number
  percent: number
}

export function getDivisionRange(mmr: number): DivisionRange {
  const val = Math.max(0, mmr)

  // Bronze
  if (val < 1000) {
    if (val < 333) {
      return { current: "Bronze III", next: "Bronze II", min: 0, max: 333, percent: Math.min(100, Math.floor((val / 333) * 100)) }
    } else if (val < 666) {
      return { current: "Bronze II", next: "Bronze I", min: 333, max: 666, percent: Math.min(100, Math.floor(((val - 333) / 333) * 100)) }
    } else {
      return { current: "Bronze I", next: "Silver III", min: 666, max: 1000, percent: Math.min(100, Math.floor(((val - 666) / 334) * 100)) }
    }
  }
  // Silver
  if (val < 1500) {
    if (val < 1166) {
      return { current: "Silver III", next: "Silver II", min: 1000, max: 1166, percent: Math.min(100, Math.floor(((val - 1000) / 166) * 100)) }
    } else if (val < 1333) {
      return { current: "Silver II", next: "Silver I", min: 1166, max: 1333, percent: Math.min(100, Math.floor(((val - 1166) / 167) * 100)) }
    } else {
      return { current: "Silver I", next: "Gold III", min: 1333, max: 1500, percent: Math.min(100, Math.floor(((val - 1333) / 167) * 100)) }
    }
  }
  // Gold
  if (val < 2000) {
    if (val < 1666) {
      return { current: "Gold III", next: "Gold II", min: 1500, max: 1666, percent: Math.min(100, Math.floor(((val - 1500) / 166) * 100)) }
    } else if (val < 1833) {
      return { current: "Gold II", next: "Gold I", min: 1666, max: 1833, percent: Math.min(100, Math.floor(((val - 1666) / 167) * 100)) }
    } else {
      return { current: "Gold I", next: "Platinum III", min: 1833, max: 2000, percent: Math.min(100, Math.floor(((val - 1833) / 167) * 100)) }
    }
  }
  // Platinum
  if (val < 2500) {
    if (val < 2166) {
      return { current: "Platinum III", next: "Platinum II", min: 2000, max: 2166, percent: Math.min(100, Math.floor(((val - 2000) / 166) * 100)) }
    } else if (val < 2333) {
      return { current: "Platinum II", next: "Platinum I", min: 2166, max: 2333, percent: Math.min(100, Math.floor(((val - 2166) / 167) * 100)) }
    } else {
      return { current: "Platinum I", next: "Diamond III", min: 2333, max: 2500, percent: Math.min(100, Math.floor(((val - 2333) / 167) * 100)) }
    }
  }
  // Diamond
  if (val < 3000) {
    if (val < 2666) {
      return { current: "Diamond III", next: "Diamond II", min: 2500, max: 2666, percent: Math.min(100, Math.floor(((val - 2500) / 166) * 100)) }
    } else if (val < 2833) {
      return { current: "Diamond II", next: "Diamond I", min: 2666, max: 2833, percent: Math.min(100, Math.floor(((val - 2666) / 167) * 100)) }
    } else {
      return { current: "Diamond I", next: "Master", min: 2833, max: 3000, percent: Math.min(100, Math.floor(((val - 2833) / 167) * 100)) }
    }
  }
  // Master
  if (val < 3500) {
    return { current: "Master", next: "Grandmaster", min: 3000, max: 3500, percent: Math.min(100, Math.floor(((val - 3000) / 500) * 100)) }
  }
  // Grandmaster
  return { current: "Grandmaster", next: "Top GM", min: 3500, max: 99999, percent: Math.min(100, Math.floor(((val - 3500) / 1000) * 100)) }
}

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

  // Matchmaking Queue States
  const [isSearchingRanked, setIsSearchingRanked] = useState(false)
  const [matchState, setMatchState] = useState<'searching' | 'found'>('searching')
  const [searchTimer, setSearchTimer] = useState(0)
  const [acceptTimer, setAcceptTimer] = useState(10)
  const [opponentInfo, setOpponentInfo] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [selectedRankedGame, setSelectedRankedGame] = useState('snake-arena')

  useEffect(() => {
    fetch('/api/profile/details')
      .then(res => res.json())
      .then(data => setMyProfile(data))
      .catch(err => console.error(err))
  }, [])

  // Matchmaking radar queue timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSearchingRanked && matchState === 'searching') {
      interval = setInterval(() => {
        setSearchTimer(prev => {
          const nextVal = prev + 1
          // Simulate finding opponent between 4-7 seconds
          if (nextVal >= 5 && Math.random() > 0.4) {
            setMatchState('found')
            const mmrSeed = rankedStats?.mmr ?? 1000
            const opponentMmr = Math.max(100, mmrSeed + Math.floor(Math.random() * 80) - 40)
            const botNames = ['ApexBot', 'ShadowNinja', 'HyperSnake', 'BlitzPlayer', 'NovaRider', 'SpectreKing']
            const chosenName = botNames[Math.floor(Math.random() * botNames.length)]
            setOpponentInfo({ username: chosenName, mmr: opponentMmr })
            setAcceptTimer(10)
          }
          return nextVal
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isSearchingRanked, matchState, rankedStats])

  // Accept button countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSearchingRanked && matchState === 'found') {
      interval = setInterval(() => {
        setAcceptTimer(prev => {
          if (prev <= 1) {
            setIsSearchingRanked(false)
            setMatchState('searching')
            setSearchTimer(0)
            return 10
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isSearchingRanked, matchState])

  const handleStartMatchmaking = () => {
    // Derive compatible games from registry metadata
    const COMPATIBLE_GAMES = GAMES_REGISTRY.filter(g => g.supportsRanked).map(g => g.slug)
    const gamesList = COMPATIBLE_GAMES.length > 0 ? COMPATIBLE_GAMES : ['snake-arena']

    // Rotation logic using localStorage history
    let history: string[] = []
    try {
      const stored = localStorage.getItem('gamehub_ranked_history')
      if (stored) {
        history = JSON.parse(stored)
      }
    } catch (e) {
      history = []
    }

    // Filter out games that have been played recently to rotate fairly
    let candidates = gamesList.filter(g => !history.includes(g))
    if (candidates.length === 0) {
      candidates = gamesList
      history = []
    }

    const chosenGame = candidates[Math.floor(Math.random() * candidates.length)]

    // Save chosen game to history
    history.push(chosenGame)
    if (history.length > gamesList.length) {
      history.shift()
    }
    localStorage.setItem('gamehub_ranked_history', JSON.stringify(history))

    setSelectedRankedGame(chosenGame)
    setIsSearchingRanked(true)
    setMatchState('searching')
    setSearchTimer(0)
    setAcceptTimer(10)
  }

  const handleCancelMatchmaking = () => {
    setIsSearchingRanked(false)
    setMatchState('searching')
    setSearchTimer(0)
  }

  const handleAcceptMatch = () => {
    setIsSearchingRanked(false)
    window.location.href = `/dashboard/games/${selectedRankedGame}?mode=ranked&opponent=${opponentInfo?.username || 'ApexBot'}`
  }

  const formatSearchTime = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const sec = (totalSeconds % 60).toString().padStart(2, '0')
    return `${min}:${sec}`
  }

  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return 'N/A'
    const diff = new Date(endDateStr).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return days > 0 ? `${days} days left` : 'Ends today'
  }

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
                  {rows.map((row, i) => {
                    const isMe = row.profileId === myProfile?.id || row.username === myProfile?.username || row.username === user?.email?.split('@')[0]
                    return (
                      <tr
                        key={row.profileId + '-' + i}
                        style={{
                          borderBottom: i < rows.length - 1 ? '1px solid hsl(220 15% 18%)' : 'none',
                          backgroundColor: isMe ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                          borderLeft: isMe ? '4px solid hsl(220 100% 60%)' : 'none'
                        }}
                      >
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
                                style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, fontWeight: 600, color: isMe ? 'hsl(220 100% 60%)' : 'white', cursor: 'pointer', textAlign: 'left' }}
                                className="hover-underline"
                              >
                                {row.displayName || (row.username.includes('@') ? row.username.split('@')[0] : row.username)} {isMe && '(You)'}
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
                    )
                  })}
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
          
          <div className="ranked-flex-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* Column 1: Player Card */}
            {user && rankedStats && (
              <div className="card animate-scaleUp" style={{
                background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
                border: '1px solid hsl(220 20% 16%)',
                borderRadius: '24px',
                padding: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '260px'
              }}>
                {/* Backglow element */}
                <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: myDetails.glowColor, filter: 'blur(45px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <RankBadge mmr={myMmr} size="lg" showLabel={true} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{myProfile?.displayName || user.email?.split('@')[0]}</h3>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)' }}>
                          Rating: <strong style={{ color: 'white' }}>{myMmr} MMR</strong>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: rankedStats.streak >= 3 ? 'hsl(142 70% 50%)' : 'hsl(220 10% 50%)', background: 'rgba(255,255,255,0.04)', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
                          {rankedStats.streak >= 3 ? `🔥 ${rankedStats.streak} Win Streak` : `Streak: ${rankedStats.streak}`}
                        </span>
                      </div>

                      {/* Division Rank Progress */}
                      {(() => {
                        const divRange = getDivisionRange(myMmr);
                        return (
                          <div style={{ marginTop: '0.75rem', width: '100%', maxWidth: '240px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'hsl(220 10% 55%)', marginBottom: '0.2rem', fontWeight: 600 }}>
                              <span style={{ color: myDetails.badgeColor }}>{divRange.current}</span>
                              <span>{myMmr} / {divRange.max === 99999 ? 'MAX' : `${divRange.max}`} MMR</span>
                            </div>
                            <div style={{ height: '7px', background: 'hsl(220 20% 12%)', borderRadius: '99px', overflow: 'hidden', border: '1px solid hsl(220 15% 15%)' }}>
                              <div style={{ height: '100%', width: `${divRange.percent}%`, background: `linear-gradient(90deg, ${myDetails.badgeColor}, #ffffff)`, borderRadius: '99px', boxShadow: `0 0 10px ${myDetails.badgeColor}`, transition: 'width 0.5s ease-in-out' }} />
                            </div>
                            <div style={{ fontSize: '0.58rem', color: 'hsl(220 10% 50%)', marginTop: '0.15rem', textAlign: 'right' }}>
                              {divRange.next !== 'Top GM' ? `Next: ${divRange.next}` : 'Peak rating reached'}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Wins, Losses, Peak Rank stats strip */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'hsl(222 20% 6% / 0.4)', borderRadius: 16, padding: '0.75rem 1rem', marginTop: '1rem', border: '1px solid hsl(220 15% 15%)', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Wins</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(142 70% 55%)', marginTop: '2px' }}>{rankedStats.wins}</div>
                  </div>
                  <div style={{ height: '24px', width: '1px', background: 'hsl(220 15% 15%)' }} />
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Losses</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(0 80% 60%)', marginTop: '2px' }}>{rankedStats.losses}</div>
                  </div>
                  <div style={{ height: '24px', width: '1px', background: 'hsl(220 15% 15%)' }} />
                  <div>
                    <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Peak Rank</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'hsl(45 100% 60%)', marginTop: '2px' }}>{rankedStats.peakRank}</div>
                  </div>
                </div>

                {/* Matchmaking Queue Trigger */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '0.78rem', color: 'hsl(220 10% 55%)' }}>
                    Active: <strong>{activeSeason?.name || 'Season 1'}</strong> ({getDaysRemaining(activeSeason?.endDate)})
                  </div>
                  <button
                    className="btn btn-primary animate-pulse"
                    onClick={handleStartMatchmaking}
                    style={{
                      padding: '0.5rem 1.25rem',
                      fontWeight: 800,
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #e11d48, #be123c)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
                      fontSize: '0.8rem',
                      transition: 'transform 0.15s ease'
                    }}
                  >
                    ⚔️ Find Ranked Match
                  </button>
                </div>
              </div>
            )}

            {/* Column 2: Seasonal Rewards & Placements Preview (Future Ready Structure) */}
            <div className="card animate-scaleUp" style={{
              background: 'linear-gradient(135deg, hsl(222 20% 8%), hsl(222 25% 6%))',
              border: '1px dashed hsl(220 15% 18%)',
              borderRadius: '24px',
              padding: '1.5rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '260px'
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🎁 Seasonal Rewards & Placements
                </h4>
                <p style={{ fontSize: '0.76rem', color: 'hsl(220 10% 55%)', margin: '0.5rem 0 1rem', lineHeight: 1.4 }}>
                  Complete placement matches to qualify for exclusive seasonal frame rewards and titles.
                </p>

                {/* Placement matches progress mock */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', fontWeight: 700 }}>
                    <span style={{ color: 'hsl(220 10% 55%)' }}>Placement Progress:</span>
                    <span style={{ color: 'hsl(220 100% 75%)' }}>0 / 10 Played</span>
                  </div>
                  <div style={{ height: '6px', background: 'hsl(222 20% 4%)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: '0%', backgroundColor: 'hsl(220 100% 60%)', borderRadius: '99px' }} />
                  </div>
                </div>

                {/* Future Ready avatar frames and titles grid preview */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  <div style={{ border: '1px solid hsl(220 15% 15%)', borderRadius: 10, padding: '0.45rem', backgroundColor: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🖼️</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(220 10% 50%)' }}>Avatar Frames</span>
                      <span style={{ fontSize: '0.58rem', color: 'hsl(220 10% 60%)' }}>Locked (Bronze+)</span>
                    </div>
                  </div>
                  <div style={{ border: '1px solid hsl(220 15% 15%)', borderRadius: 10, padding: '0.45rem', backgroundColor: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>🏷️</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(220 10% 50%)' }}>Season Titles</span>
                      <span style={{ fontSize: '0.58rem', color: 'hsl(220 10% 60%)' }}>Locked (Gold+)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Regional Rankings placeholder */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'hsl(220 10% 50%)' }}>
                <span>Regional Server: <strong>North America</strong></span>
                <span style={{ color: 'hsl(45 100% 60%)', fontWeight: 700 }}>★ Friends Leaderboard locked</span>
              </div>
            </div>
          </div>

          {/* Match History Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, color: 'hsl(220 10% 55%)' }}>
              ⚔️ Recent Ranked Matches
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid hsl(220 20% 16%)' }}>
              {(!rankedStats?.recentMatches || rankedStats.recentMatches.length === 0) ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'hsl(220 10% 50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2.2rem' }}>⚔️</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>No ranked matches played yet</div>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', margin: 0 }}>Join the Ranked Queue above to play your placement matches!</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'hsl(222 20% 13%)', borderBottom: '1px solid hsl(220 15% 18%)', fontSize: '0.68rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Game Played</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Opponent</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Result</th>
                        <th style={{ padding: '0.75rem 1rem' }}>MMR Change</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedStats.recentMatches.map((match: any) => {
                        const isWin = match.result === 'win'
                        const isLoss = match.result === 'loss'
                        return (
                          <tr key={match.id} style={{ borderBottom: '1px solid hsl(220 15% 15%)', fontSize: '0.82rem', color: 'hsl(220 10% 80%)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                              <span style={{ background: 'hsl(220 20% 12%)', border: '1px solid hsl(220 15% 18%)', borderRadius: '6px', padding: '0.15rem 0.4rem', fontSize: '0.7rem', color: 'hsl(220 100% 80%)' }}>
                                Snake Arena
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{match.opponentName}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{
                                color: isWin ? 'hsl(142 70% 50%)' : isLoss ? 'hsl(0 80% 55%)' : 'hsl(220 10% 60%)',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                background: isWin ? 'rgba(22, 163, 74, 0.1)' : isLoss ? 'rgba(220, 38, 38, 0.1)' : 'rgba(255,255,255,0.05)'
                              }}>
                                {match.result}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 800, color: match.mmrChange > 0 ? 'hsl(142 70% 50%)' : match.mmrChange < 0 ? 'hsl(0 80% 55%)' : 'white' }}>
                              {match.mmrChange > 0 ? `+${match.mmrChange}` : match.mmrChange}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: 'hsl(220 10% 55%)' }}>
                              {new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Ranked Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, color: 'hsl(220 10% 55%)' }}>
              🏆 Seasonal Leaderboard
            </h3>
            <div className="card" style={{ overflow: 'hidden', border: '1px solid hsl(220 20% 16%)' }}>
              {rankedLoading ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading ranked standings...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'hsl(222 20% 13%)', borderBottom: '1px solid hsl(220 15% 20%)', fontSize: '0.72rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Rank</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Player</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Division Badge</th>
                        <th style={{ padding: '0.75rem 1rem' }}>MMR Rating</th>
                        <th style={{ padding: '0.75rem 1rem' }}>W / L</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Win Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedRows.map((row, i) => {
                        const isMe = row.profileId === myProfile?.id || row.username === myProfile?.username || row.username === user?.email?.split('@')[0]
                        return (
                          <tr
                            key={row.profileId + '-' + i}
                            style={{
                              borderBottom: i < rankedRows.length - 1 ? '1px solid hsl(220 15% 18%)' : 'none',
                              backgroundColor: isMe ? 'rgba(225, 29, 72, 0.08)' : 'transparent',
                              borderLeft: isMe ? '4px solid #e11d48' : 'none'
                            }}
                          >
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
                                    style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, fontWeight: 600, color: isMe ? '#e11d48' : 'white', cursor: 'pointer', textAlign: 'left' }}
                                    className="hover-underline"
                                  >
                                    {row.displayName || (row.username.includes('@') ? row.username.split('@')[0] : row.username)} {isMe && '(You)'}
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
                        )
                      })}
                      {rankedRows.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>No player records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Matchmaking Queue Modal */}
      {isSearchingRanked && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(5, 8, 16, 0.9)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card glass" style={{
            width: '100%',
            maxWidth: '420px',
            background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
            border: '1px solid hsl(220 20% 18%)',
            borderRadius: '24px',
            padding: '2rem',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            {matchState === 'searching' ? (
              <>
                <div style={{ margin: '0 auto 1.5rem', position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Glowing rings */}
                  <div style={{ position: 'absolute', inset: 0, border: '2px solid #e11d48', borderRadius: '50%', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', opacity: 0.75 }} />
                  <div style={{ position: 'absolute', inset: '10px', backgroundColor: 'hsl(222 20% 12%)', border: '1px solid hsl(220 20% 18%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', boxShadow: 'inset 0 0 20px rgba(225,29,72,0.15)' }}>
                    ⚔️
                  </div>
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.5rem', color: 'white' }}>Finding Ranked Match</h3>
                <p style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)', marginBottom: '1.5rem', lineHeight: 1.4 }}>
                  Searching for opponent near <strong style={{ color: '#e11d48' }}>{myMmr} MMR</strong>...
                </p>
                <div style={{ fontSize: '1.45rem', fontFamily: 'monospace', fontWeight: 700, color: 'white', marginBottom: '2rem', letterSpacing: '0.05em' }}>
                  Queue: {formatSearchTime(searchTimer)}
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleCancelMatchmaking}
                  style={{ width: '100%', minHeight: 45, borderRadius: 12, fontWeight: 700 }}
                >
                  Cancel Search
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'bounce 1s infinite' }}>🎯</div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'hsl(142 70% 50%)', marginBottom: '0.25rem' }}>Match Found!</h3>
                <p style={{ fontSize: '0.82rem', color: 'hsl(220 10% 60%)', marginBottom: '1.5rem' }}>
                  Accept to enter the ranked match for <strong style={{ color: 'white' }}>{GAMES_REGISTRY.find(g => g.slug === selectedRankedGame)?.name || 'Snake Arena'}</strong>.
                </p>
                
                {/* Opponent Card Preview */}
                <div style={{
                  backgroundColor: 'hsl(222 20% 6%)',
                  border: '1px solid hsl(220 15% 16%)',
                  borderRadius: 16,
                  padding: '1rem',
                  marginBottom: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'white' }}>{opponentInfo?.username}</div>
                    <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)' }}>Rating: {opponentInfo?.mmr} MMR</span>
                  </div>
                  <RankBadge mmr={opponentInfo?.mmr || 1200} size="sm" />
                </div>

                <div style={{ display: 'flex', gap: '0.85rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleCancelMatchmaking}
                    style={{ flex: 1, minHeight: 45, borderRadius: 12, fontWeight: 700 }}
                  >
                    Decline
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleAcceptMatch}
                    style={{ flex: 2, minHeight: 45, borderRadius: 12, background: 'linear-gradient(135deg, hsl(142 70% 45%), hsl(142 60% 35%))', border: 'none', fontWeight: 800, color: 'white', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)' }}
                  >
                    Accept ({acceptTimer}s)
                  </button>
                </div>
              </>
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
