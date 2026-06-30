'use client'
import { TrophyIcon, GamepadIcon, ZapIcon, CrownIcon, GlobeIcon, UsersIcon, AwardIcon } from '@/components/shared/Icons'

import React, { useState, useEffect } from 'react'
import ProfileCardModal from '@/components/layout/ProfileCardModal'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import RankBadge from '@/components/layout/RankBadge'
import { getRankDetails } from '@/lib/rankedUtils'
import Avatar from '@/components/shared/Avatar'
import { GAMES_REGISTRY } from '@/lib/games'
import { Swords, Lock, Trophy, Zap, AlertTriangle, Users, Gift, Image, Tag, Target } from 'lucide-react'

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

interface LeaderboardClientProps {
  initialTab?: 'casual' | 'ranked' | 'hallOfFame' | 'weeklyHistory'
  autoStartMatchmaking?: boolean
}

export default function LeaderboardClient({
  initialTab = 'casual',
  autoStartMatchmaking = false
}: LeaderboardClientProps = {}) {
  const { user } = useGameSession()

  // Dynamically map from GAMES_REGISTRY
  const gameOptions = React.useMemo(() => {
    const options: { value: string; label: string; group?: string }[] = [
      { value: 'all', label: 'All Games' }
    ]
    for (const game of GAMES_REGISTRY) {
      if (game.supportsLeaderboard) {
        if (game.leaderboardModes) {
          for (const m of game.leaderboardModes) {
            options.push({ value: m.value, label: m.label, group: game.name })
          }
        } else {
          options.push({ value: game.slug, label: game.name })
        }
      }
    }
    return options
  }, [])

  // Group options to render optgroups
  const groupedOptions = React.useMemo(() => {
    const groups: { label: string; value?: string; options?: { value: string; label: string }[] }[] = []
    for (const opt of gameOptions) {
      if (opt.group) {
        let group = groups.find(g => g.label === opt.group)
        if (!group) {
          group = { label: opt.group, options: [] }
          groups.push(group)
        }
        group.options?.push({ value: opt.value, label: opt.label })
      } else {
        groups.push({ label: opt.label, value: opt.value })
      }
    }
    return groups
  }, [gameOptions])
  
  // Tabs: 'casual' | 'ranked' | 'hallOfFame' | 'weeklyHistory'
  const [activeTab, setActiveTab] = useState<'casual' | 'ranked' | 'hallOfFame' | 'weeklyHistory'>(initialTab)

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

  // Weekly History & Countdown State
  const [weeklyArchives, setWeeklyArchives] = useState<any[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(true)
  const [nextReset, setNextReset] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState('')
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([])
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedArchiveId, setSelectedArchiveId] = useState<string>('')

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Matchmaking Queue States
  const [isSearchingRanked, setIsSearchingRanked] = useState(false)
  const [matchState, setMatchState] = useState<'searching' | 'found'>('searching')
  const [searchTimer, setSearchTimer] = useState(0)
  const [acceptTimer, setAcceptTimer] = useState(10)
  const [opponentInfo, setOpponentInfo] = useState<any>(null)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [selectedRankedGame, setSelectedRankedGame] = useState('snake-arena')

  // Celebration states
  const [showRankReveal, setShowRankReveal] = useState(false)
  const [showPromotion, setShowPromotion] = useState(false)
  const [promoDetails, setPromoDetails] = useState<{ oldRank: string; newRank: string } | null>(null)

  useEffect(() => {
    fetch('/api/profile/details')
      .then(res => res.json())
      .then(data => setMyProfile(data))
      .catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('gamehub_rank_reveal') === 'pending') {
        localStorage.removeItem('gamehub_rank_reveal')
        setShowRankReveal(true)
      }
      const storedPromo = localStorage.getItem('gamehub_promotion_celebration')
      if (storedPromo) {
        localStorage.removeItem('gamehub_promotion_celebration')
        try {
          setPromoDetails(JSON.parse(storedPromo))
          setShowPromotion(true)
        } catch (e) {
          console.error(e)
        }
      }
    }
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

  const [didAutoStart, setDidAutoStart] = useState(false)
  useEffect(() => {
    if (autoStartMatchmaking && activeTab === 'ranked' && !didAutoStart) {
      setDidAutoStart(true)
      handleStartMatchmaking()
    }
  }, [autoStartMatchmaking, activeTab, didAutoStart])

  const handleAcceptMatch = () => {
    setIsSearchingRanked(false)
    window.location.href = `/dashboard/games/${selectedRankedGame}?mode=ranked&opponent=${opponentInfo?.username || 'ApexBot'}&opponentMmr=${opponentInfo?.mmr || 1000}&mmr=${rankedStats?.mmr || 1000}`
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

  // Fetch weekly history and countdown
  useEffect(() => {
    if (activeTab === 'weeklyHistory' || (activeTab === 'casual' && timeframe === 'weekly')) {
      setWeeklyLoading(true)
      fetch('/api/leaderboard/weekly-history')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setWeeklyArchives(data.archives || [])
            if (data.currentWeek?.nextReset) {
              setNextReset(new Date(data.currentWeek.nextReset))
            }
          }
          setWeeklyLoading(false)
        })
        .catch(() => setWeeklyLoading(false))
    }
    // Also fetch countdown whenever on casual/ranked tab
    if (activeTab === 'casual' || activeTab === 'ranked') {
      fetch('/api/leaderboard/weekly-history')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.currentWeek?.nextReset) setNextReset(new Date(data.currentWeek.nextReset))
        })
        .catch(() => null)
    }
  }, [activeTab, timeframe])

  // Live countdown tick
  useEffect(() => {
    if (!nextReset) return
    const tick = () => {
      const diff = nextReset.getTime() - Date.now()
      if (diff <= 0) { setCountdown('Resetting...'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextReset])



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
  const isSoon = nextReset ? (nextReset.getTime() - Date.now() < 24 * 60 * 60 * 1000) : false

  return (
    <div className="animate-fadeIn safe-bottom-padding leaderboard-page-container">
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}><TrophyIcon size={24} className="inline mr-2 text-yellow-400" /> Global Leaderboard</h1>
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
          { key: 'casual', label: 'Casual XP & High Scores', icon: <GamepadIcon size={16} /> },
          { key: 'ranked', label: 'Ranked Competitive', icon: <ZapIcon size={16} /> },
          { key: 'hallOfFame', label: 'Hall of Fame', icon: <CrownIcon size={16} /> },
          { key: 'weeklyHistory', label: 'Weekly History', icon: <Trophy size={16} /> },
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

      {/* ── Weekly Reset Countdown ─────────────────────────────────────── */}
      {countdown && (activeTab === 'casual' || activeTab === 'ranked' || activeTab === 'weeklyHistory') && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.4rem',
          background: isSoon
            ? 'linear-gradient(135deg, hsl(35 30% 9%), hsl(25 35% 8%))'
            : 'linear-gradient(135deg, hsl(222 25% 10%), hsl(252 30% 12%))',
          border: isSoon
            ? '1px solid hsl(38 95% 50% / 0.45)'
            : '1px solid hsl(252 60% 40% / 0.4)',
          borderRadius: 16, padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          boxShadow: isSoon ? '0 0 15px hsl(38 95% 50% / 0.12)' : 'none',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isSoon ? 'hsl(38 95% 55%)' : 'hsl(142 70% 55%)',
                animation: 'pulse 2s ease infinite',
                boxShadow: isSoon ? '0 0 8px hsl(38 95% 55%)' : 'none'
              }} />
              <span style={{ fontSize: '0.8rem', color: isSoon ? 'hsl(38 90% 70%)' : 'hsl(220 10% 60%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Next Weekly Reset
              </span>
            </div>
            <span style={{
              fontSize: '1.05rem', fontWeight: 900,
              color: isSoon ? 'hsl(38 95% 60%)' : 'hsl(252 80% 75%)',
              letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
              textShadow: isSoon ? '0 0 10px hsl(38 95% 55% / 0.3)' : 'none'
            }}>
              {countdown}
            </span>
          </div>
          {isSoon && (
            <div style={{ fontSize: '0.72rem', color: 'hsl(38 90% 55%)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span>⚠️</span> <strong>Weekly rewards will be distributed soon!</strong> Keep playing to secure your rank.
            </div>
          )}
        </div>
      )}

      {/* ────────────────── 1. CASUAL LEADERBOARDS TAB ────────────────── */}
      {activeTab === 'casual' && (
        <>
          {/* Filter Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {user && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', marginRight: '0.25rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope:</span>
                <button onClick={() => setScope('global')} className={`btn btn-sm ${scope === 'global' ? 'btn-primary' : 'btn-secondary'}`}><GlobeIcon size={14} className="inline mr-1" /> Global</button>
                <button onClick={() => setScope('friends')} className={`btn btn-sm ${scope === 'friends' ? 'btn-primary' : 'btn-secondary'}`}><UsersIcon size={14} className="inline mr-1" /> Friends</button>
              </div>
            )}

            {game === 'all' && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className={`btn btn-sm ${timeframe === t.value ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {t.label}
                  </button>
                ))}
                {timeframe === 'weekly' && (
                  <button
                    onClick={() => {
                      if (weeklyArchives.length > 0) {
                        setSelectedArchiveId(weeklyArchives[0].id)
                      }
                      setShowHistoryModal(true)
                    }}
                    className="btn btn-sm btn-secondary animate-pulse-glow"
                    style={{
                      background: 'linear-gradient(135deg, hsl(270 80% 60% / 0.15), hsl(220 100% 60% / 0.15))',
                      borderColor: 'hsl(270 80% 50% / 0.3)',
                      color: 'hsl(270 80% 85%)',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📅 History Archive
                  </button>
                )}
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
                {groupedOptions.map((item, idx) => {
                  if (item.options) {
                    return (
                      <optgroup key={idx} label={item.label}>
                        {item.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                    )
                  }
                  return (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  )
                })}
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
                            <span style={{ minWidth: '1.75rem' }}>{row.rank <= 3 ? <AwardIcon size={18} style={{ color: row.rank === 1 ? 'hsl(45 100% 55%)' : row.rank === 2 ? 'hsl(220 10% 75%)' : 'hsl(35 60% 50%)' }} /> : `#${row.rank}`}</span>
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
                    <RankBadge mmr={myMmr} size="lg" showLabel={true} placementRemaining={rankedStats.placementMatchesRemaining} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{myProfile?.displayName || user.email?.split('@')[0]}</h3>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)' }}>
                          Rating: <strong style={{ color: 'white' }}>{rankedStats.placementMatchesRemaining > 0 ? 'Unranked' : `${myMmr} MMR`}</strong>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: rankedStats.streak >= 3 ? 'hsl(142 70% 50%)' : 'hsl(220 10% 50%)', background: 'rgba(255,255,255,0.04)', padding: '0.15rem 0.45rem', borderRadius: '6px', fontWeight: 700 }}>
                          {rankedStats.streak >= 3 ? `🔥 ${rankedStats.streak} Win Streak` : `Streak: ${rankedStats.streak}`}
                        </span>
                      </div>

                      {/* Division Rank Progress */}
                      {(() => {
                        if (rankedStats.placementMatchesRemaining > 0) {
                          const matchesLeft = rankedStats.placementMatchesRemaining;
                          return (
                            <div style={{ marginTop: '0.75rem', width: '100%', maxWidth: '240px' }}>
                              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 60%)', margin: 0, lineHeight: 1.45 }}>
                                Complete <strong>{matchesLeft}</strong> more placement match{matchesLeft !== 1 ? 'es' : ''} to establish your competitive rank.
                              </p>
                            </div>
                          );
                        }
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Swords size={14} /> Find Ranked Match</span>
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
                  <Gift size={16} /> Seasonal Rewards & Placements
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
                  <div style={{ border: '1px solid hsl(220 15% 15%)', borderRadius: 10, padding: '0.45rem', backgroundColor: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Image size={18} style={{ opacity: 0.5, color: 'hsl(220 10% 70%)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'hsl(220 10% 50%)' }}>Avatar Frames</span>
                      <span style={{ fontSize: '0.58rem', color: 'hsl(220 10% 60%)' }}>Locked (Bronze+)</span>
                    </div>
                  </div>
                  <div style={{ border: '1px solid hsl(220 15% 15%)', borderRadius: 10, padding: '0.45rem', backgroundColor: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag size={18} style={{ opacity: 0.5, color: 'hsl(220 10% 70%)' }} />
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
                <span style={{ color: 'hsl(45 100% 60%)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Lock size={12} /> Friends Leaderboard locked</span>
              </div>
            </div>
          </div>

          {/* Match History Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0, color: 'hsl(220 10% 55%)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Swords size={16} /> Recent Ranked Matches
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid hsl(220 20% 16%)' }}>
              {(!rankedStats?.recentMatches || rankedStats.recentMatches.length === 0) ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'hsl(220 10% 50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <Swords size={32} style={{ color: 'hsl(220 10% 30%)' }} />
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
              <TrophyIcon size={20} className="inline mr-2 text-yellow-400" /> Seasonal Leaderboard
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
                  <div style={{ position: 'absolute', inset: '10px', backgroundColor: 'hsl(222 20% 12%)', border: '1px solid hsl(220 20% 18%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 20px rgba(225,29,72,0.15)' }}>
                    <Swords size={32} style={{ color: '#e11d48' }} />
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
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', animation: 'bounce 1s infinite' }}>
                  <Target size={48} style={{ color: 'hsl(142 70% 50%)' }} />
                </div>
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
                      <h3 style={{ margin: 0, fontWeight: 900, color: 'hsl(45 100% 55%)', fontSize: '1.15rem' }}><CrownIcon size={18} className="inline mr-2 text-yellow-400" /> {entry.seasonName}</h3>
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
                            {pIdx <= 2 ? <AwardIcon size={16} style={{ color: pIdx === 0 ? 'hsl(45 100% 55%)' : pIdx === 1 ? 'hsl(220 10% 75%)' : 'hsl(35 60% 50%)' }} /> : `#${pIdx + 1}`}
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
                  No archived season records in the Hall of Fame yet. Resets will snapshot standings here.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ────────────────── 4. WEEKLY HISTORY TAB ────────────────── */}
      {activeTab === 'weeklyHistory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} style={{ color: '#FFD700' }} /> Weekly Hall of Fame
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'hsl(220 10% 55%)' }}>
                Permanent achievement history — every week's champions, results, and rewards.
              </p>
            </div>
          </div>

          {weeklyLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading weekly history...</div>
          ) : weeklyArchives.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }} className="card">
              No weekly results archived yet. The first results will appear here after the first weekly reset.
            </div>
          ) : (
            weeklyArchives.map((archive: any) => {
              const standings: any[] = Array.isArray(archive.standings) ? archive.standings : []
              const champion = standings.find(s => s.rank === 1)
              const runnerUp = standings.find(s => s.rank === 2)
              const thirdPlace = standings.find(s => s.rank === 3)
              const top3      = standings.slice(0, 3)
              const rest      = standings.slice(3)

              const isExpanded = expandedWeeks.includes(archive.weekNumber)

              const toggleExpand = () => {
                setExpandedWeeks(prev =>
                  prev.includes(archive.weekNumber)
                    ? prev.filter(w => w !== archive.weekNumber)
                    : [...prev, archive.weekNumber]
                )
              }

              const medalColors: Record<number, string> = {
                0: '#FFD700', 1: '#C0C0C0', 2: '#CD7F32'
              }
              const medals = ['🏆', '🥈', '🥉']

              const formattedStart = new Date(archive.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              const formattedEnd = new Date(archive.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <div
                  key={archive.id}
                  className="card animate-slideUp"
                  style={{
                    padding: '1.25rem',
                    background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
                    border: isExpanded ? '1px solid hsl(45 100% 50% / 0.35)' : '1px solid hsl(220 20% 15%)',
                    borderRadius: 20,
                    cursor: 'pointer',
                    boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.4)' : 'none',
                    transition: 'all 0.25s ease'
                  }}
                  onClick={toggleExpand}
                >
                  {/* Collapsed/Expanded Header Summary */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <h3 style={{ margin: 0, fontWeight: 900, color: 'white', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Week #{archive.weekNumber}
                        {archive.rewardsDistributed && (
                          <span style={{ fontSize: '0.62rem', background: 'hsl(142 60% 15%)', color: 'hsl(142 70% 60%)', padding: '0.15rem 0.5rem', borderRadius: 6, fontWeight: 800, border: '1px solid hsl(142 60% 25%)' }}>
                            Distributed
                          </span>
                        )}
                      </h3>
                      <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', fontWeight: 600 }}>
                        {formattedStart} – {formattedEnd}
                      </span>
                    </div>

                    {!isExpanded && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {champion && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)', borderRadius: 10, padding: '0.35rem 0.65rem' }}>
                            <span style={{ fontSize: '1rem' }}>🏆</span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Champion</span>
                              <span style={{ fontSize: '0.78rem', color: '#FFD700', fontWeight: 800 }}>{champion.displayName || champion.username}</span>
                            </div>
                          </div>
                        )}
                        <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 45%)', fontWeight: 700, textTransform: 'uppercase' }}>Click to view details</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: 'white' }}>
                      {isExpanded ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                      )}
                    </div>
                  </div>

                  {/* Expanded Section Details */}
                  {isExpanded && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.05)' }} onClick={e => e.stopPropagation()}>
                      {/* Podium - Top 3 */}
                      {top3.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          {top3.map((p: any, idx: number) => (
                            <div key={idx} style={{
                              background: `${medalColors[idx]}09`,
                              border: `1px solid ${medalColors[idx]}25`,
                              borderRadius: 16, padding: '1rem 0.5rem',
                              textAlign: 'center',
                              boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                            }}>
                              <div style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{medals[idx]}</div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', wordBreak: 'break-all' }}>
                                {p.displayName || p.username}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem', fontWeight: 600 }}>
                                {p.score.toLocaleString()} XP
                              </div>
                              {p.coinsEarned > 0 && (
                                <div style={{ fontSize: '0.65rem', color: '#FFD700', fontWeight: 700, marginTop: '0.15rem' }}>
                                  +{p.coinsEarned.toLocaleString()} 🪙
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rest of Top 10 */}
                      {standings.length > 0 && (
                        <div style={{ background: 'hsl(222 20% 8% / 0.5)', borderRadius: 16, border: '1px solid hsl(220 20% 13%)', padding: '0.75rem 1rem' }}>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'hsl(220 10% 45%)', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.35rem' }}>Standings Board</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {standings.slice(0, 10).map((p: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: idx < standings.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                                  <td style={{ padding: '0.5rem 0', width: 36, fontWeight: 800, color: idx < 3 ? (medalColors[idx]) : 'hsl(220 10% 50%)', fontSize: '0.8rem' }}>
                                    {idx < 3 ? medals[idx] : `#${idx + 1}`}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.8rem', color: 'white', fontWeight: 600 }}>
                                    {p.displayName || p.username}
                                  </td>
                                  <td style={{ padding: '0.5rem 0.25rem', fontSize: '0.75rem', color: 'hsl(220 10% 55%)', textAlign: 'right', fontWeight: 600 }}>
                                    {p.score.toLocaleString()} XP
                                  </td>
                                  <td style={{ padding: '0.5rem 0', fontSize: '0.72rem', color: '#FFD700', fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {p.coinsEarned > 0 ? `+${p.coinsEarned.toLocaleString()} 🪙` : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {standings.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'hsl(220 10% 50%)', fontSize: '0.8rem', padding: '1rem 0' }}>
                          No players participated this week.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ────────────────── WEEKLY LEADERBOARD HISTORY MODAL ────────────────── */}
      {showHistoryModal && (() => {
        const selectedArchive = weeklyArchives.find(a => a.id === selectedArchiveId)
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 8, 16, 0.88)',
              backdropFilter: 'blur(12px)',
              zIndex: 100000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setShowHistoryModal(false)}
            id="weekly-history-modal-backdrop"
          >
            <div
              style={{
                width: '100%',
                maxWidth: 480,
                maxHeight: '85vh',
                overflowY: 'auto',
                background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
                border: '1px solid hsl(220 15% 18%)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                borderRadius: 24,
                position: 'relative',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)'
              }}
              onClick={e => e.stopPropagation()}
              id="weekly-history-modal-body"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📅 Weekly Leaderboard History
                </h2>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'hsl(220 10% 55%)', cursor: 'pointer', fontSize: '1.2rem', outline: 'none' }}
                >
                  ✕
                </button>
              </div>

              {/* Dropdown to select week */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select Archive Week:</span>
                <select
                  value={selectedArchiveId}
                  onChange={(e) => setSelectedArchiveId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    backgroundColor: 'hsl(220 20% 10%)',
                    border: '1px solid hsl(220 15% 18%)',
                    color: 'white',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                >
                  <option value="" disabled>-- Select Week --</option>
                  {weeklyArchives.map((a: any) => {
                    const start = new Date(a.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    const end = new Date(a.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    return (
                      <option key={a.id} value={a.id}>
                        Week #{a.weekNumber} ({start} – {end})
                      </option>
                    )
                  })}
                </select>
              </div>

              {selectedArchive ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}>
                  {/* Podium */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem' }}>
                    {[0, 1, 2].map((idx) => {
                      const p = selectedArchive.standings?.find((s: any) => s.rank === idx + 1)
                      if (!p) return null
                      const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']
                      const medals = ['🏆', '🥈', '🥉']
                      return (
                        <div key={idx} style={{
                          background: `${medalColors[idx]}09`,
                          border: `1px solid ${medalColors[idx]}25`,
                          borderRadius: 14,
                          padding: '0.65rem 0.35rem',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '1.25rem', marginBottom: '0.1rem' }}>{medals[idx]}</div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.displayName || p.username}
                          </div>
                          <div style={{ fontSize: '0.58rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem', fontWeight: 600 }}>
                            {p.score.toLocaleString()} XP
                          </div>
                          {p.coinsEarned > 0 && (
                            <div style={{ fontSize: '0.58rem', color: '#FFD700', fontWeight: 700, marginTop: '0.05rem' }}>
                              +{p.coinsEarned.toLocaleString()} 🪙
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Rest of Top 10 Table */}
                  {selectedArchive.standings && selectedArchive.standings.length > 0 ? (
                    <div style={{ background: 'hsl(222 20% 8% / 0.5)', borderRadius: 14, border: '1px solid hsl(220 20% 13%)', padding: '0.6rem 0.85rem' }}>
                      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'hsl(220 10% 45%)', fontWeight: 800, letterSpacing: '0.04em', marginBottom: '0.35rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.25rem' }}>
                        Standings Board
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {selectedArchive.standings.map((p: any, idx: number) => {
                            const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']
                            const medals = ['🏆', '🥈', '🥉']
                            return (
                              <tr key={idx} style={{ borderBottom: idx < selectedArchive.standings.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                                <td style={{ padding: '0.35rem 0', width: 28, fontWeight: 800, color: idx < 3 ? medalColors[idx] : 'hsl(220 10% 50%)', fontSize: '0.72rem' }}>
                                  {idx < 3 ? medals[idx] : `#${idx + 1}`}
                                </td>
                                <td style={{ padding: '0.35rem 0.25rem', fontSize: '0.75rem', color: 'white', fontWeight: 600 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Avatar username={p.username} avatarUrl={p.avatarUrl} size={18} />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        {p.displayName || p.username}
                                        {p.selectedFrame && (
                                          <span style={{ fontSize: '0.55rem', background: 'hsl(270 80% 50% / 0.2)', color: 'hsl(270 80% 75%)', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>
                                            {p.selectedFrame.replace('frame-', '')}
                                          </span>
                                        )}
                                      </span>
                                      {p.selectedTitle && (
                                        <span style={{ fontSize: '0.55rem', color: 'hsl(220 100% 75%)', fontWeight: 700 }}>
                                          {p.selectedTitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.35rem 0.25rem', fontSize: '0.7rem', color: 'hsl(220 10% 55%)', textAlign: 'right', fontWeight: 600 }}>
                                  {p.score.toLocaleString()} XP
                                </td>
                                <td style={{ padding: '0.35rem 0', fontSize: '0.68rem', color: '#FFD700', fontWeight: 800, textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {p.coinsEarned > 0 ? `+${p.coinsEarned.toLocaleString()} 🪙` : ''}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'hsl(220 10% 50%)', fontSize: '0.75rem' }}>
                      No players participated this week.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)', fontSize: '0.78rem' }}>
                  Select a week from the dropdown to browse historical results.
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <ProfileCardModal
        profileId={selectedProfileId}
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
      />

      {/* ── Rank Reveal Modal Overlay ── */}
      {showRankReveal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 5, 10, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'hidden'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '420px',
            animation: 'fadeIn 1s ease-out'
          }}>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: 900,
              color: 'white',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '1rem',
              textShadow: '0 0 20px rgba(255,255,255,0.4)'
            }}>
              Placements Completed!
            </h2>
            <p style={{ color: 'hsl(220 10% 65%)', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
              Your performance has been evaluated by the seasonal engine.
            </p>

            {/* Revealed Badge with animation */}
            <div style={{
              transform: 'scale(1.3)',
              marginBottom: '2.5rem',
              animation: 'scaleUp 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}>
              <RankBadge mmr={myMmr} size="lg" showLabel={true} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginBottom: '2rem' }}>
              Starting Rating: {myMmr} MMR
            </h3>

            <button
              className="btn btn-primary"
              onClick={() => setShowRankReveal(false)}
              style={{
                padding: '0.6rem 2rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.4)'
              }}
            >
              Claim Standing
            </button>
          </div>
        </div>
      )}

      {/* ── Promotion Celebration Modal Overlay ── */}
      {showPromotion && promoDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 5, 10, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'hidden'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            maxWidth: '420px',
            animation: 'fadeIn 0.8s ease-out'
          }}>
            {/* Animated Trophy Icon */}
            <div style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fbbf24, #d97706)',
              boxShadow: '0 0 30px rgba(251, 191, 36, 0.5)',
              marginBottom: '1.5rem',
              animation: 'bounce 2s infinite'
            }}>
              <Trophy size={44} className="text-white" />
            </div>

            <h2 style={{
              fontSize: '2rem',
              fontWeight: 950,
              background: 'linear-gradient(90deg, #fbbf24, #ffffff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0
            }}>
              Rank Promoted!
            </h2>
            <p style={{ color: 'hsl(220 10% 65%)', fontSize: '0.9rem', marginTop: '0.5rem', marginBottom: '2.5rem' }}>
              Congratulations! You have risen to a new competitive tier.
            </p>

            {/* Transition Display */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1.5rem',
              marginBottom: '2.5rem'
            }}>
              <div style={{ opacity: 0.6, transform: 'scale(0.85)' }}>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', display: 'block', marginBottom: '0.25rem', fontWeight: 800 }}>OLD TIER</span>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'white' }}>{promoDetails.oldRank}</div>
              </div>
              
              <div style={{ fontSize: '1.5rem', color: '#fbbf24', fontWeight: 800 }}>→</div>

              <div style={{ transform: 'scale(1.2)' }}>
                <span style={{ fontSize: '0.7rem', color: 'hsl(45 100% 60%)', display: 'block', marginBottom: '0.25rem', fontWeight: 900 }}>NEW TIER</span>
                <RankBadge mmr={myMmr} size="lg" showLabel={true} />
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={() => setShowPromotion(false)}
              style={{
                padding: '0.6rem 2.5rem',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                border: 'none',
                color: 'black',
                boxShadow: '0 0 25px rgba(251, 191, 36, 0.4)',
                cursor: 'pointer'
              }}
            >
              Excellent
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
