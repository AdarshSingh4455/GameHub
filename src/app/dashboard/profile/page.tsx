'use client'

import React, { useEffect, useState } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress } from '@/lib/xpUtils'
import { GAMES_REGISTRY, getGameBySlug } from '@/lib/games'

interface DBProfile {
  id: string
  username: string
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  coins: number
  avatarUrl: string | null
  friendCode: string | null
  selectedTitle: string | null
  achievements: Array<{
    unlockedAt: string
    achievement: {
      slug: string
      name: string
      description: string
      xpReward: number
      coinReward: number
    }
  }>
  gameStats: Array<{
    gameSlug: string
    playCount: number
    winCount: number
    highScore: number
  }>
}

interface DBMatch {
  id: string
  playedAt: string
  winnerId: string | null
  player1Score: number
  player2Score: number
  xpEarned: number
  coinsEarned: number
  metadata?: Record<string, any> | null
  game: {
    name: string
    slug: string
  }
  player1: {
    username: string
  }
  player2: {
    username: string
  } | null
}

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

export default function ProfilePage() {
  const { user } = useGameSession()
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'matches'>('overview')
  const [profile, setProfile] = useState<DBProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Match History states
  const [matches, setMatches] = useState<DBMatch[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [bbStats, setBbStats] = useState<{
    playCount: number
    highScore: number
    bestCombo: number
    avgLines: number
  } | null>(null)
  const [matchPage, setMatchPage] = useState(1)
  const [matchTotalPages, setMatchTotalPages] = useState(1)
  const [matchFilterGame, setMatchFilterGame] = useState('all')
  const [matchFilterResult, setMatchFilterResult] = useState('all')
  const [matchSearchQuery, setMatchSearchQuery] = useState('')

  // 7-day activity tracking state
  const [activity, setActivity] = useState<Array<{ playedAt: string }>>([])

  // Load profile details
  const loadProfileDetails = () => {
    if (user) {
      setLoading(true)
      fetch('/api/profile/details')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load profile')
        })
        .then((data) => {
          setProfile(data.profile)
          setActivity(data.activity || [])
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoading(false)
        })
    } else {
      // Guest local simulation
      const guestXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const guestLevel = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      const guestCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      const unlockedSlugs = JSON.parse(localStorage.getItem('gamehub_guest_achievements') || '[]') as string[]
      const stats = JSON.parse(localStorage.getItem('gamehub_guest_stats') || '{"playCount":0,"winCount":0}')

      const mockAchievementsDb = [
        { slug: 'first-game', name: 'First Move', description: 'Play your first game.', xpReward: 50, coinReward: 10 },
        { slug: 'first-win', name: 'Winner Winner', description: 'Win your first match.', xpReward: 100, coinReward: 25 },
      ]

      const simulatedAchievements = mockAchievementsDb
        .filter((a) => unlockedSlugs.includes(a.slug))
        .map((a) => ({
          unlockedAt: new Date().toISOString(),
          achievement: a,
        }))

      let localMatches: DBMatch[] = []
      try {
        localMatches = JSON.parse(localStorage.getItem('gamehub_guest_match_history') || '[]') as DBMatch[]
      } catch {}

      const statsMap: Record<string, { playCount: number; winCount: number; highScore: number }> = {}
      for (const m of localMatches) {
        const slug = m.game.slug
        if (!statsMap[slug]) {
          statsMap[slug] = { playCount: 0, winCount: 0, highScore: 0 }
        }
        statsMap[slug].playCount += 1
        const won = m.winnerId === 'guest' || m.winnerId === 'profile-guest' || m.winnerId === 'guest-profile' || m.winnerId === 'guest-match'
        if (won || (m.winnerId && m.winnerId !== 'opponent' && m.winnerId !== 'AI' && m.winnerId !== null)) {
          statsMap[slug].winCount += 1
        }
        statsMap[slug].highScore = Math.max(statsMap[slug].highScore, m.player1Score)
      }

      const simulatedGameStats = GAMES_REGISTRY.map((g) => {
        const s = statsMap[g.slug]
        return {
          gameSlug: g.slug,
          playCount: s ? s.playCount : 0,
          winCount: s ? s.winCount : 0,
          highScore: s ? s.highScore : 0,
        }
      }).filter((s) => s.playCount > 0)

      setProfile({
        id: 'guest',
        username: 'Guest Explorer',
        xp: guestXP,
        level: guestLevel,
        currentStreak: 0,
        longestStreak: 0,
        coins: guestCoins,
        avatarUrl: null,
        friendCode: 'GH-GUEST01',
        selectedTitle: 'Beginner',
        achievements: simulatedAchievements,
        gameStats: simulatedGameStats,
      })

      // Load guest matches for activity mapping
      try {
        const localMatches = JSON.parse(localStorage.getItem('gamehub_guest_match_history') || '[]') as DBMatch[]
        setActivity(localMatches.map(m => ({ playedAt: m.playedAt })))
      } catch {
        setActivity([])
      }
      
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfileDetails()
  }, [user])

  // Load paginated matches history
  const loadMatchesHistory = () => {
    if (user) {
      setMatchesLoading(true)
      const params = new URLSearchParams({
        page: matchPage.toString(),
        limit: '10',
        game: matchFilterGame,
        result: matchFilterResult,
        search: matchSearchQuery
      })

      fetch(`/api/profile/matches?${params.toString()}`)
        .then(res => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then(data => {
          setMatches(data.matches || [])
          setMatchTotalPages(data.totalPages || 1)
          setMatchesLoading(false)
        })
        .catch(() => setMatchesLoading(false))
    } else {
      // Guest client-side local search/filtering
      setMatchesLoading(true)
      try {
        const allLocalMatches = JSON.parse(localStorage.getItem('gamehub_guest_match_history') || '[]') as DBMatch[]
        
        const filtered = allLocalMatches.filter(m => {
          const matchesGame = matchFilterGame === 'all' || m.game.slug === matchFilterGame
          
          const isWin = m.winnerId === 'guest' || m.winnerId === profile?.id
          const isDraw = m.winnerId === null && m.player1Score === m.player2Score
          const isLoss = !isWin && !isDraw

          let matchesResult = true
          if (matchFilterResult === 'win') {
            matchesResult = isWin
          } else if (matchFilterResult === 'loss') {
            matchesResult = isLoss
          } else if (matchFilterResult === 'draw') {
            matchesResult = isDraw
          }

          const isP1 = m.player1.username === profile?.username
          const opponentName = isP1 ? m.player2?.username ?? 'AI' : m.player1.username
          const matchesSearch = opponentName.toLowerCase().includes(matchSearchQuery.toLowerCase())

          return matchesGame && matchesResult && matchesSearch
        })

        const limit = 10
        const totalPages = Math.ceil(filtered.length / limit) || 1
        const startIndex = (matchPage - 1) * limit
        const paginated = filtered.slice(startIndex, startIndex + limit)

        setMatches(paginated)
        setMatchTotalPages(totalPages)
      } catch {
        setMatches([])
        setMatchTotalPages(1)
      }
      setMatchesLoading(false)
    }
  }

  useEffect(() => {
    loadMatchesHistory()
  }, [user, matchPage, matchFilterGame, matchFilterResult, matchSearchQuery])

  useEffect(() => {
    if (!profile) return

    let localMatches: DBMatch[] = []
    try {
      localMatches = JSON.parse(localStorage.getItem('gamehub_guest_match_history') || '[]') as DBMatch[]
    } catch {}

    if (user) {
      fetch('/api/games/block-blast/stats')
        .then(res => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then(data => {
          const stats = data.stats
          const easy = stats.classic.easy
          const normal = stats.classic.normal
          const hard = stats.classic.hard
          const daily = stats.daily

          const maxScore = Math.max(easy.highScore, normal.highScore, hard.highScore, daily.highScore)
          const maxComboVal = Math.max(easy.bestCombo, normal.bestCombo, hard.bestCombo, daily.bestCombo)
          const totalLines = easy.linesCleared + normal.linesCleared + hard.linesCleared + daily.linesCleared

          const bbPlayStat = profile.gameStats.find(s => s.gameSlug === 'block-blast')
          const playCount = bbPlayStat ? bbPlayStat.playCount : 0
          const avgLines = playCount > 0 ? Math.round((totalLines / playCount) * 10) / 10 : 0

          setBbStats({
            playCount,
            highScore: maxScore,
            bestCombo: maxComboVal,
            avgLines
          })
        })
        .catch(() => {})
    } else {
      const bbMatches = localMatches.filter(m => m.game.slug === 'block-blast')
      const playCount = bbMatches.length
      let maxScore = 0
      let maxComboVal = 0
      let totalLines = 0

      for (const m of bbMatches) {
        maxScore = Math.max(maxScore, m.player1Score)
        const meta = m.metadata as Record<string, any> | null
        if (meta) {
          maxComboVal = Math.max(maxComboVal, meta.maxCombo ?? 0)
          totalLines += meta.linesCleared ?? 0
        }
      }
      const avgLines = playCount > 0 ? Math.round((totalLines / playCount) * 10) / 10 : 0

      setBbStats({
        playCount,
        highScore: maxScore,
        bestCombo: maxComboVal,
        avgLines
      })
    }
  }, [user, profile])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ fontSize: '1.25rem', color: 'hsl(220 10% 50%)' }}>Loading Profile...</div>
      </div>
    )
  }

  if (!profile) return null

  // XP Progression Calculations
  const {
    floorXP: currentLevelXP,
    levelRange: nextLevelXPNeeded,
    xpInLevel: relativeXP,
    progressPercent: levelPercent
  } = getLevelProgress(profile.xp)

  // Stats Aggregate Calculations
  const totalGames = profile.gameStats.reduce((sum, g) => sum + g.playCount, 0)
  const totalWins = profile.gameStats.reduce((sum, g) => sum + g.winCount, 0)
  const totalLosses = Math.max(0, totalGames - totalWins)
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0

  const sortedStats = [...profile.gameStats].sort((a, b) => b.playCount - a.playCount)
  const favoriteGameSlug = sortedStats[0]?.gameSlug || 'none'
  const favoriteGameInfo = getGameBySlug(favoriteGameSlug)
  const favoriteGameLabel = favoriteGameInfo ? favoriteGameInfo.name : favoriteGameSlug !== 'none' ? favoriteGameSlug.replace('-', ' ') : '—'

  // Last 7 days activity calculator
  const getLast7Days = () => {
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dates.push(d.toISOString().split('T')[0])
    }
    return dates
  }
  const last7DaysDates = getLast7Days()
  const last7DaysCounts = last7DaysCountsQuery(activity, last7DaysDates)
  const maxActivityCount = Math.max(...last7DaysCounts, 1)

  // XP Level Unlocks Calculator
  const getNextLevelUnlocks = (lvl: number) => {
    const rewards: string[] = []
    if (lvl % 5 === 0) {
      rewards.push(`🏆 Exclusive Level ${lvl} Milestone Badge`)
    }
    if (lvl === 5) rewards.push('🎖️ Rising Star Badge')
    if (lvl === 10) rewards.push('🎖️ Veteran Badge')
    if (lvl === 25) rewards.push('🏅 Champion Badge')
    
    const coinsUnlock = 50 + (lvl * 10)
    rewards.push(`🪙 ${coinsUnlock} Coins Bonus`)
    rewards.push('🎯 Next Achievement Progress milestones')
    
    return rewards
  }

  function last7DaysCountsQuery(act: Array<{ playedAt: string }>, dates: string[]) {
    return dates.map(dateStr => {
      return act.filter(a => a.playedAt.startsWith(dateStr)).length
    })
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fadeIn safe-bottom-padding">
      
      {/* Profile Header Card */}
      <div
        className="card glass"
        style={{
          padding: '2rem',
          borderRadius: 24,
          display: 'flex',
          gap: '2rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, hsl(220 20% 10% / 0.95), hsl(220 20% 7% / 0.95))',
          border: '1px solid hsl(220 15% 18%)',
        }}
      >
        {/* Avatar block */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '2.5rem',
            color: 'white',
            border: '4px solid hsl(220 15% 22%)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
            flexShrink: 0
          }}
        >
          {profile.username[0].toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
              {profile.username}
            </h2>
            {profile.selectedTitle && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(45 100% 55%)', background: 'hsl(45 100% 50% / 0.12)', padding: '0.2rem 0.6rem', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {profile.selectedTitle}
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Friend Code: <strong style={{ color: 'hsl(220 100% 70%)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{profile.friendCode || '—'}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Level: <strong style={{ color: 'hsl(270 80% 65%)' }}>{profile.level}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Coins: <strong style={{ color: 'hsl(45 100% 55%)' }}>🪙 {profile.coins}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu Selection */}
      <div style={{ display: 'flex', borderBottom: '1px solid hsl(220 15% 16%)', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { id: 'overview', label: 'Overview', icon: '👤' },
          { id: 'stats', label: 'Progression & Stats', icon: '📊' },
          { id: 'matches', label: 'Match History', icon: '📜' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === t.id ? 'hsl(220 100% 70%)' : 'hsl(220 10% 50%)',
              fontWeight: 700,
              fontSize: '0.95rem',
              padding: '0.5rem 0.5rem 0.75rem',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'color 0.2s'
            }}
            id={`profile-tab-${t.id}`}
          >
            <span>{t.icon}</span>
            {t.label}
            {activeTab === t.id && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: 'hsl(220 100% 60%)',
                boxShadow: '0 0 8px hsl(220 100% 60%)'
              }} />
            )}
          </button>
        ))}
      </div>

      {/* TAB OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* XP Progression Card */}
          <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: 0, letterSpacing: '0.05em' }}>
              XP Progression
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>Level {profile.level}</span>
              <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', color: 'hsl(220 100% 70%)', letterSpacing: '0.08em', margin: '0.2rem 0' }}>
                {getBlockProgressBar(levelPercent)}
              </div>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(220 100% 70%)' }}>
                {relativeXP} / {nextLevelXPNeeded} XP
              </span>
            </div>

            {/* Block progress bar graphics */}
            <div>
              <div style={{ height: 12, background: 'hsl(220 20% 12%)', borderRadius: 99, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${levelPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                    borderRadius: 99
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(220 10% 40%)', marginTop: '0.35rem' }}>
                <span>{currentLevelXP} XP Floor</span>
                <span>{levelPercent}% Completed</span>
                <span>{currentLevelXP + nextLevelXPNeeded} XP Next</span>
              </div>
            </div>

            {/* Level Unlock Preview */}
            <div
              style={{
                background: 'hsl(220 20% 7% / 0.6)',
                border: '1px solid hsl(220 15% 14%)',
                borderRadius: 14,
                padding: '1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(270 80% 65%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🎁 Reward Preview: Next Level Unlocks:
              </div>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'hsl(220 10% 60%)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {getNextLevelUnlocks(profile.level + 1).map((reward, i) => (
                  <li key={i}>{reward}</li>
                ))}
              </ul>
            </div>
          </div>


          {/* Badge Showcase Card */}
          <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem', letterSpacing: '0.05em' }}>
              Unlocked Badges ({profile.achievements.length})
            </h3>
            {profile.achievements.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 50%)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
                No achievements unlocked yet. Play games to earn badges!
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '0.75rem' }}>
                {profile.achievements.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      background: 'hsl(222 20% 8% / 0.8)',
                      border: '1px solid hsl(220 15% 15%)',
                      padding: '0.75rem 0.5rem',
                      borderRadius: 14,
                    }}
                    title={`${item.achievement.name}: ${item.achievement.description}`}
                  >
                    <span style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>🏅</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'white', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.achievement.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB STATS DASHBOARD */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Summary stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Games Played', val: totalGames, color: 'white', icon: '🎮' },
              { label: 'Total Wins', val: totalWins, color: 'hsl(142 70% 55%)', icon: '🏆' },
              { label: 'Total Losses', val: totalLosses, color: 'hsl(0 80% 60%)', icon: '💀' },
              { label: 'XP Streak', val: `${profile.currentStreak} Days`, color: 'hsl(38 95% 60%)', icon: '🔥' },
              { label: 'Favorite Game', val: favoriteGameLabel, color: 'hsl(220 100% 70%)', icon: '⭐' }
            ].map((s, idx) => (
              <div key={idx} className="card glass" style={{ padding: '1.1rem 1.25rem', borderRadius: 16, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '1.75rem' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>{s.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 850, color: s.color, marginTop: '0.15rem' }}>{s.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            
            {/* SVG Weekly Bar Chart */}
            <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1.25rem', letterSpacing: '0.05em' }}>
                📅 Match Activity (Last 7 Days)
              </h3>
              
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <svg viewBox="0 0 400 180" width="100%" height="180">
                  {last7DaysDates.map((dateStr, idx) => {
                    const count = last7DaysCounts[idx]
                    const barHeight = (count / maxActivityCount) * 110
                    const x = 25 + idx * 52
                    const y = 140 - barHeight
                    const dayLabel = new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short' })
                    
                    return (
                      <g key={dateStr}>
                        {/* Bar background */}
                        <rect x={x} y={30} width={24} height={110} rx={6} fill="hsl(220 20% 12% / 0.4)" />
                        
                        {/* Active bar */}
                        {count > 0 && (
                          <rect
                            x={x}
                            y={y}
                            width={24}
                            height={barHeight}
                            rx={6}
                            fill="url(#weeklyBarGradient)"
                          />
                        )}
                        {/* Count text */}
                        <text x={x + 12} y={count > 0 ? y - 8 : 135} textAnchor="middle" fill={count > 0 ? 'white' : 'hsl(220 10% 35%)'} fontSize="10" fontWeight="700">
                          {count}
                        </text>
                        {/* Day label */}
                        <text x={x + 12} y={160} textAnchor="middle" fill="hsl(220 10% 55%)" fontSize="9.5" fontWeight="600">
                          {dayLabel}
                        </text>
                      </g>
                    )
                  })}
                  <defs>
                    <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(220 100% 65%)" />
                      <stop offset="100%" stopColor="hsl(270 80% 60%)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Win Rate Donut Ring */}
            <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>
                  🎯 Win Rate
                </h3>
                <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.8rem', margin: 0, maxWidth: 180, lineHeight: 1.4 }}>
                  Compare wins against total games played. Maintain a streak to level up faster!
                </p>
              </div>

              {/* Progress ring SVG */}
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg viewBox="0 0 120 120" width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="50" fill="transparent" stroke="hsl(220 20% 12%)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="transparent"
                    stroke="url(#winProgressGradient)"
                    strokeWidth="10"
                    strokeDasharray={314.16}
                    strokeDashoffset={314.16 - (winRate / 100) * 314.16}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 6px hsl(142 70% 50% / 0.35))' }}
                  />
                  <defs>
                    <linearGradient id="winProgressGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(142 70% 55%)" />
                      <stop offset="100%" stopColor="hsl(160 80% 50%)" />
                    </linearGradient>
                  </defs>
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>{winRate}%</span>
                  <span style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Wins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Block Blast Performance Stats Card */}
          {bbStats && bbStats.playCount > 0 && (
            <div className="card glass animate-fadeIn" style={{ padding: '1.5rem', borderRadius: 20, background: 'linear-gradient(135deg, hsl(222 20% 10% / 0.95), hsl(222 20% 7% / 0.95))', border: '1px solid hsl(220 15% 18%)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1.25rem', letterSpacing: '0.05em' }}>
                ⏹️ Block Blast Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.25rem' }}>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🏆</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Highest Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(45 100% 60%)', marginTop: '0.25rem' }}>{bbStats.highScore.toLocaleString()}</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🔥</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Highest Combo</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(270 80% 65%)', marginTop: '0.25rem' }}>{bbStats.bestCombo}x</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🧪</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Avg Lines Cleared</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(142 70% 55%)', marginTop: '0.25rem' }}>{bbStats.avgLines}</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🎮</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Games Played</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginTop: '0.25rem' }}>{bbStats.playCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB MATCH HISTORY */}
      {activeTab === 'matches' && (
        <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Filters and search block */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search opponent */}
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by opponent..."
                value={matchSearchQuery}
                onChange={e => {
                  setMatchSearchQuery(e.target.value)
                  setMatchPage(1)
                }}
                className="input input-sm"
                style={{
                  paddingLeft: '2.25rem',
                  borderRadius: 12,
                  background: 'hsl(220 20% 7%)',
                  border: '1px solid hsl(220 15% 15%)'
                }}
                id="matches-opponent-search"
              />
              <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(220 10% 45%)', fontSize: '0.8rem' }}>🔍</span>
            </div>

            {/* Filter by game */}
            <select
              value={matchFilterGame}
              onChange={e => {
                setMatchFilterGame(e.target.value)
                setMatchPage(1)
              }}
              className="input input-sm"
              style={{
                width: 'auto',
                minWidth: 140,
                borderRadius: 12,
                background: 'hsl(220 20% 7%)',
                border: '1px solid hsl(220 15% 15%)',
                cursor: 'pointer'
              }}
              id="matches-game-filter"
            >
              <option value="all">All Games</option>
              {GAMES_REGISTRY.map(g => (
                <option key={g.slug} value={g.slug}>{g.name}</option>
              ))}
            </select>

            {/* Filter by result */}
            <div style={{ display: 'flex', gap: '0.25rem', background: 'hsl(220 20% 7%)', padding: '0.2rem', borderRadius: 10, border: '1px solid hsl(220 15% 14%)' }}>
              {['all', 'win', 'loss', 'draw'].map(res => (
                <button
                  key={res}
                  onClick={() => {
                    setMatchFilterResult(res)
                    setMatchPage(1)
                  }}
                  className="btn btn-sm"
                  style={{
                    borderRadius: 8,
                    padding: '0.3rem 0.65rem',
                    fontSize: '0.72rem',
                    background: matchFilterResult === res ? 'hsl(220 100% 60%)' : 'transparent',
                    color: matchFilterResult === res ? 'white' : 'hsl(220 10% 60%)',
                    border: 'none',
                    fontWeight: 700,
                  }}
                  id={`matches-result-${res}`}
                >
                  {res.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Matches table list */}
          {matchesLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>
              Loading match logs...
            </div>
          ) : matches.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'hsl(220 20% 7%)', borderRadius: 16, border: '1px dashed hsl(220 15% 15%)' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📜</span>
              <h4 style={{ margin: 0, fontWeight: 700, color: 'white' }}>No Matches Found</h4>
              <p style={{ color: 'hsl(220 10% 45%)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                No records match your filters. Go play games to start log compilation!
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {matches.map((match) => {
                const isP1 = match.player1.username === profile.username
                const opponentName = isP1 ? match.player2?.username ?? 'AI' : match.player1.username
                
                const won = match.winnerId === profile.id
                const draw = match.winnerId === null && match.player1Score === match.player2Score
                
                const label = draw ? 'Draw' : won ? 'Win' : 'Loss'
                const badgeBg = draw ? 'hsl(45 100% 55% / 0.12)' : won ? 'hsl(142 70% 45% / 0.12)' : 'hsl(0 80% 55% / 0.12)'
                const badgeColor = draw ? 'hsl(45 100% 65%)' : won ? 'hsl(142 70% 55%)' : 'hsl(0 80% 65%)'

                return (
                  <div
                    key={match.id}
                    style={{
                      background: 'hsl(222 20% 8% / 0.6)',
                      border: '1px solid hsl(220 15% 14%)',
                      borderRadius: 16,
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Game description */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 200 }}>
                      <div style={{ background: badgeBg, color: badgeColor, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.35rem 0.6rem', borderRadius: 8, minWidth: 50, textAlign: 'center' }}>
                        {label}
                      </div>
                      <div>
                        <div style={{ fontWeight: 750, fontSize: '0.92rem', color: 'white' }}>
                          {match.game.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', marginTop: '0.15rem' }}>
                          {new Date(match.playedAt).toLocaleDateString()} · vs {opponentName}
                        </div>
                      </div>
                    </div>

                    {/* Scores & Rewards */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>Match Score</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', fontFamily: 'monospace', marginTop: '0.1rem' }}>
                          {isP1 ? `${match.player1Score} - ${match.player2Score}` : `${match.player2Score} - ${match.player1Score}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'hsl(142 70% 60%)', background: 'hsl(142 70% 50% / 0.12)', padding: '0.2rem 0.5rem', borderRadius: 8 }}>
                          +{match.xpEarned} XP
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 750, color: 'hsl(45 100% 60%)', background: 'hsl(45 100% 50% / 0.12)', padding: '0.2rem 0.5rem', borderRadius: 8 }}>
                          +{match.coinsEarned} Coins
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Pagination Controls */}
              {matchTotalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    disabled={matchPage === 1}
                    onClick={() => setMatchPage(p => Math.max(1, p - 1))}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: 10, opacity: matchPage === 1 ? 0.5 : 1 }}
                  >
                    ◀ Previous
                  </button>
                  <span style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
                    Page <strong>{matchPage}</strong> of {matchTotalPages}
                  </span>
                  <button
                    disabled={matchPage === matchTotalPages}
                    onClick={() => setMatchPage(p => Math.min(matchTotalPages, p + 1))}
                    className="btn btn-secondary btn-sm"
                    style={{ borderRadius: 10, opacity: matchPage === matchTotalPages ? 0.5 : 1 }}
                  >
                    Next ▶
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
