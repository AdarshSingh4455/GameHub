'use client'
import { TrophyIcon, AwardIcon, CoinsIcon, TargetIcon, UserIcon, BarChartIcon, ScrollIcon, UsersIcon, PaletteIcon, GamepadIcon, GiftIcon, CalendarIcon, FlaskIcon, SearchIcon, MessageIcon, TagIcon, PackageIcon, StoreIcon, SparklesIcon, CrownIcon, LockIcon } from '@/components/shared/Icons'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress } from '@/lib/xpUtils'
import { GAMES_REGISTRY, getGameBySlug } from '@/lib/games'
import { prefetchProfileDetails } from '@/lib/prefetch'
import { RankBadge } from '@/components/layout/RankBadge'
import { getRankDetails } from '@/lib/rankedUtils'
import Avatar from '@/components/shared/Avatar'
import { Trophy, BookOpen, ArrowRight, Star, CheckCircle, Zap, Sparkles, Gamepad2, Flame, Award } from 'lucide-react'

interface DBProfile {
  id: string
  username: string
  displayName?: string | null
  xp: number
  level: number
  currentStreak: number
  longestStreak: number
  coins: number
  avatarUrl: string | null
  friendCode: string | null
  selectedTitle: string | null
  selectedFrame?: string | null
  hangmanMmr?: number
  hangmanWins?: number
  hangmanLosses?: number
  hangmanStreak?: number
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
  inventory?: Array<{
    cosmeticItem: {
      id: string
      name: string
      type: string
      priceCoins: number
      assetUrl: string | null
      metadata: any
      isDefault: boolean
    }
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
    displayName?: string | null
  }
  player2: {
    username: string
    displayName?: string | null
  } | null
}

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

function ProfileHeaderSkeleton() {
  return (
    <div
      className="card glass profile-header-container animate-pulse"
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
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'hsl(220 15% 20%)' }} />
      <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ height: 28, width: 200, background: 'hsl(220 15% 20%)', borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.65rem' }}>
          <div style={{ height: 16, width: 120, background: 'hsl(220 15% 20%)', borderRadius: 4 }} />
          <div style={{ height: 16, width: 80, background: 'hsl(220 15% 20%)', borderRadius: 4 }} />
          <div style={{ height: 16, width: 80, background: 'hsl(220 15% 20%)', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
      <div className="card glass animate-pulse" style={{ gridColumn: '1 / -1', height: 260, borderRadius: 24, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
      <div className="card glass animate-pulse" style={{ height: 200, borderRadius: 20, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
      <div className="card glass animate-pulse" style={{ height: 200, borderRadius: 20, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card glass animate-pulse" style={{ height: 80, borderRadius: 16, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        <div className="card glass animate-pulse" style={{ height: 220, borderRadius: 20, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
        <div className="card glass animate-pulse" style={{ height: 220, borderRadius: 20, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
      </div>
    </div>
  )
}

function MatchesSkeleton() {
  return (
    <div className="card glass animate-pulse" style={{ padding: '1.5rem', borderRadius: 20, display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }}>
      <div style={{ height: 40, width: '100%', background: 'hsl(220 15% 18%)', borderRadius: 12 }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ height: 70, background: 'hsl(220 15% 18%)', borderRadius: 16 }} />
      ))}
    </div>
  )
}

function AchievementsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="card glass animate-pulse" style={{ height: 110, borderRadius: 16, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
      ))}
    </div>
  )
}

function FriendsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card glass animate-pulse" style={{ height: 74, borderRadius: 16, background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 15% 18%)' }} />
      ))}
    </div>
  )
}

export default function ProfilePage() {
  const { user } = useGameSession()
  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'ranked' | 'matches' | 'friends' | 'achievements' | 'cosmetics' | 'tournaments'>('overview')
  const [profile, setProfile] = useState<DBProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Tournaments states
  const [tournamentData, setTournamentData] = useState<{
    stats: {
      totalMatches: number
      wins: number
      runnerUps: number
      winRate: number
    }
    officialHistory: Array<{
      id: string
      name: string
      gameSlug: string
      startDate: string
      isOfficial: boolean
      status: string
      regStatus: string
      result: 'CHAMPION' | 'PARTICIPANT'
    }>
    communityHistory: Array<{
      id: string
      name: string
      gameSlug: string
      startDate: string
      isOfficial: boolean
      status: string
      regStatus: string
      result: 'CHAMPION' | 'PARTICIPANT'
    }>
  } | null>(null)
  const [tournamentsLoading, setTournamentsLoading] = useState(false)

  // Friends states
  const [friends, setFriends] = useState<any[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)

  // Achievement progress state
  const [achievementProgress, setAchievementProgress] = useState<any[]>([])
  const [achievementsLoading, setAchievementsLoading] = useState(false)

  // Hangman stats state
  const [hangmanStats, setHangmanStats] = useState<{
    wordsSolved: number
    wins: number
    losses: number
    correctGuesses: number
    incorrectGuesses: number
    fastestSolve: number | null
    currentStreak: number
    bestStreak: number
  }>({
    wordsSolved: 0,
    wins: 0,
    losses: 0,
    correctGuesses: 0,
    incorrectGuesses: 0,
    fastestSolve: null,
    currentStreak: 0,
    bestStreak: 0
  })

  // Match History states
  const [matches, setMatches] = useState<DBMatch[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)
  const [bbStats, setBbStats] = useState<{
    playCount: number
    highScore: number
    bestCombo: number
    avgLines: number
  } | null>(null)
  const [bbStatsLoading, setBbStatsLoading] = useState(false)
  const [matchPage, setMatchPage] = useState(1)
  const [matchTotalPages, setMatchTotalPages] = useState(1)
  const [matchFilterGame, setMatchFilterGame] = useState('all')
  const [matchFilterResult, setMatchFilterResult] = useState('all')
  const [matchSearchQuery, setMatchSearchQuery] = useState('')

  // Ranked League states
  const [rankedStats, setRankedStats] = useState<{
    mmr: number
    wins: number
    losses: number
    streak: number
    peakRank: string
    recentMatches: Array<{
      id: string
      opponentName: string
      result: 'win' | 'loss' | 'draw'
      mmrChange: number
      playedAt: string
    }>
  } | null>(null)
  const [rankedLoading, setRankedLoading] = useState(false)

  // 7-day activity tracking state
  const [activity, setActivity] = useState<Array<{ playedAt: string }>>([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Load local Hangman stats on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gamehub_hangman_stats')
      if (saved) {
        setHangmanStats(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load local Hangman stats', e)
    }
  }, [])

  // Online status helper
  const getOnlinePresence = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return { label: 'Offline', color: 'hsl(220 10% 45%)', dot: 'hsl(220 10% 40%)' }
    const diffMs = Date.now() - new Date(lastSeenAt).getTime()
    const diffSecs = diffMs / 1000
    if (diffSecs < 60) {
      return { label: 'Online', color: 'hsl(142 70% 55%)', dot: 'hsl(142 70% 50%)' }
    } else if (diffSecs < 300) {
      return { label: 'Away', color: 'hsl(38 95% 60%)', dot: 'hsl(38 95% 55%)' }
    }
    return { label: 'Offline', color: 'hsl(220 10% 45%)', dot: 'hsl(220 10% 40%)' }
  }

  // Fetch friends list on tab click or mount
  useEffect(() => {
    if (user && activeTab === 'friends') {
      setFriendsLoading(true)
      fetch('/api/friends')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load friends')
        })
        .then((data) => {
          setFriends(data.friends || [])
          setFriendsLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setFriendsLoading(false)
        })
    } else if (!user && activeTab === 'friends') {
      // Guest mock friends
      setFriends([
        { id: 'buddy1', username: 'RetroPlayer', lastSeenAt: new Date(Date.now() - 30000).toISOString() },
        { id: 'buddy2', username: 'PixelMaster', lastSeenAt: new Date(Date.now() - 120000).toISOString() },
        { id: 'buddy3', username: 'GigaChad', lastSeenAt: new Date(Date.now() - 600000).toISOString() }
      ])
    }
  }, [user, activeTab])

  // Fetch achievement progress on tab click
  useEffect(() => {
    if (user && activeTab === 'achievements') {
      setAchievementsLoading(true)
      fetch('/api/profile/details?achievements=true')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load achievements')
        })
        .then((data) => {
          setAchievementProgress(data.achievementProgress || [])
          setAchievementsLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setAchievementsLoading(false)
        })
    }
  }, [user, activeTab])

  // Fetch activity stats on tab click
  useEffect(() => {
    if (user && activeTab === 'stats') {
      setActivityLoading(true)
      fetch('/api/profile/details?activity=true')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load activity')
        })
        .then((data) => {
          setActivity(data.activity || [])
          setActivityLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setActivityLoading(false)
        })
    }
  }, [user, activeTab])

  // Fetch tournaments data on tab click
  useEffect(() => {
    if (user && activeTab === 'tournaments') {
      setTournamentsLoading(true)
      fetch('/api/profile/details?tournaments=true')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load tournaments')
        })
        .then((data) => {
          setTournamentData(data.tournamentData)
          setTournamentsLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setTournamentsLoading(false)
        })
    }
  }, [user, activeTab])

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
        { slug: 'hangman-perfect', name: 'Perfect Hangman', description: 'Solve a word without any wrong guesses.', xpReward: 150, coinReward: 50 }
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
        inventory: [
          { cosmeticItem: { id: 'frame-1', name: 'Standard Avatar Frame', type: 'AVATAR_FRAME', priceCoins: 0, assetUrl: null, metadata: null, isDefault: true } },
          { cosmeticItem: { id: 'title-1', name: 'Beginner Title', type: 'TITLE', priceCoins: 0, assetUrl: null, metadata: null, isDefault: true } }
        ]
      })

      // Set simulated achievements progress
      const guestTotalGames = simulatedGameStats.reduce((sum, g) => sum + g.playCount, 0)
      const guestTotalWins = simulatedGameStats.reduce((sum, g) => sum + g.winCount, 0)
      setAchievementProgress([
        { slug: 'first-game', name: 'First Move', description: 'Play your first game.', category: 'Gameplay', current: guestTotalGames > 0 ? 1 : 0, target: 1, progressPercentage: guestTotalGames > 0 ? 100 : 0, isUnlocked: guestTotalGames > 0, xpReward: 50, coinReward: 10 },
        { slug: 'first-win', name: 'Winner Winner', description: 'Win your first match.', category: 'Wins', current: guestTotalWins > 0 ? 1 : 0, target: 1, progressPercentage: guestTotalWins > 0 ? 100 : 0, isUnlocked: guestTotalWins > 0, xpReward: 100, coinReward: 25 },
        { slug: 'hangman-perfect', name: 'Perfect Hangman', description: 'Solve a word without any wrong guesses.', category: 'Special', current: 0, target: 1, progressPercentage: 0, isUnlocked: false, xpReward: 150, coinReward: 50 }
      ])

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

  const loadRankedStats = () => {
    if (user) {
      setRankedLoading(true)
      fetch('/api/ranked/stats')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to load ranked stats')
        })
        .then((data) => {
          setRankedStats({
            mmr: data.mmr ?? 1000,
            wins: data.wins ?? 0,
            losses: data.losses ?? 0,
            streak: data.streak ?? 0,
            peakRank: data.peakRank ?? 'Bronze',
            recentMatches: data.recentMatches || []
          })
          setRankedLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setRankedLoading(false)
        })
    } else {
      // Guest local simulation for ranked stats
      const guestMmr = parseInt(localStorage.getItem('gamehub_guest_ranked_mmr') || '1000', 10)
      const guestWins = parseInt(localStorage.getItem('gamehub_guest_ranked_wins') || '0', 10)
      const guestLosses = parseInt(localStorage.getItem('gamehub_guest_ranked_losses') || '0', 10)
      const guestStreak = parseInt(localStorage.getItem('gamehub_guest_ranked_streak') || '0', 10)
      const guestPeakRank = localStorage.getItem('gamehub_guest_ranked_peak_rank') || 'Bronze'
      let guestRecentMatches = []
      try {
        guestRecentMatches = JSON.parse(localStorage.getItem('gamehub_guest_ranked_matches') || '[]')
      } catch {}

      setRankedStats({
        mmr: guestMmr,
        wins: guestWins,
        losses: guestLosses,
        streak: guestStreak,
        peakRank: guestPeakRank,
        recentMatches: guestRecentMatches
      })
      setRankedLoading(false)
    }
  }

  useEffect(() => {
    loadProfileDetails()
    loadRankedStats()
    prefetchProfileDetails()
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
    if (activeTab === 'matches') {
      loadMatchesHistory()
    }
  }, [user, activeTab, matchPage, matchFilterGame, matchFilterResult, matchSearchQuery])

  useEffect(() => {
    if (!profile || activeTab !== 'stats') return

    let localMatches: DBMatch[] = []
    try {
      localMatches = JSON.parse(localStorage.getItem('gamehub_guest_match_history') || '[]') as DBMatch[]
    } catch {}

    if (user) {
      setBbStatsLoading(true)
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
          setBbStatsLoading(false)
        })
        .catch(() => setBbStatsLoading(false))
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
  }, [user, profile, activeTab])

  if (loading) {
    return (
      <div className="animate-fadeIn profile-page-container" style={{ gap: '1.5rem' }}>
        <ProfileHeaderSkeleton />
        <OverviewSkeleton />
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
    const dates: string[] = []
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
      rewards.push(`Exclusive Level ${lvl} Milestone Badge`)
    }
    if (lvl === 5) rewards.push('Rising Star Badge')
    if (lvl === 10) rewards.push('Veteran Badge')
    if (lvl === 25) rewards.push('Champion Badge')
    
    const coinsUnlock = 50 + (lvl * 10)
    rewards.push(`${coinsUnlock} Coins Bonus`)
    rewards.push('Next Achievement Progress milestones')
    
    return rewards
  }

  function last7DaysCountsQuery(act: Array<{ playedAt: string }>, dates: string[]) {
    return dates.map(dateStr => {
      return act.filter(a => a.playedAt.startsWith(dateStr)).length
    })
  }

  return (
    <div className="animate-fadeIn safe-bottom-padding profile-page-container">
      
      {/* Profile Header Card */}
      <div
        className="card glass profile-header-container"
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
        <Avatar
          avatarUrl={profile.avatarUrl}
          username={profile.username}
          selectedFrame={profile.selectedFrame}
          size={88}
        />

        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
              {profile.displayName || (profile.username.includes('@') ? profile.username.split('@')[0] : profile.username)}
            </h2>
            {profile.selectedTitle && (
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(45 100% 55%)', background: 'hsl(45 100% 50% / 0.12)', padding: '0.2rem 0.6rem', borderRadius: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {profile.selectedTitle}
              </span>
            )}
          </div>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem', marginTop: '0.1rem', marginBottom: '0.25rem', margin: 0 }}>
            @{profile.username}
          </p>
          
          <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Friend Code: <strong style={{ color: 'hsl(220 100% 70%)', fontFamily: 'monospace', fontSize: '0.9rem' }}>{profile.friendCode || '—'}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Level: <strong style={{ color: 'hsl(270 80% 65%)' }}>{profile.level}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', color: 'hsl(220 10% 55%)' }}>
              Coins: <strong style={{ color: 'hsl(45 100% 55%)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CoinsIcon size={14} /> <span>{profile.coins}</span></strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu Selection – horizontally swipeable on mobile */}
      <div className="horizontal-tab-bar">
        {[
          { id: 'overview', label: 'Overview', icon: <UserIcon size={16} /> },
          { id: 'stats', label: 'Stats', icon: <BarChartIcon size={16} /> },
          { id: 'ranked', label: 'Ranked', icon: <TrophyIcon size={16} /> },
          { id: 'tournaments', label: 'Tournaments', icon: <AwardIcon size={16} /> },
          { id: 'matches', label: 'Matches', icon: <ScrollIcon size={16} /> },
          { id: 'achievements', label: 'Achievements', icon: <AwardIcon size={16} /> },
          { id: 'friends', label: 'Friends', icon: <UsersIcon size={16} /> },
          { id: 'cosmetics', label: 'Cosmetics', icon: <PaletteIcon size={16} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`horizontal-tab-item ${activeTab === t.id ? 'active' : ''}`}
            id={`profile-tab-${t.id}`}
          >
            <span>{t.icon}</span>
            {t.label}
            {activeTab === t.id && (
              <div className="active-indicator" />
            )}
          </button>
        ))}
      </div>

      {/* TAB OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="profile-overview-grid" style={{ alignItems: 'start' }}>
          
          {/* 👑 Premium Profile Prestige Showcase Card */}
          <div 
            className="card glass showcase-shimmer" 
            style={{ 
              gridColumn: '1 / -1',
              padding: '2rem', 
              borderRadius: 24, 
              background: 'linear-gradient(135deg, hsl(270 40% 10% / 0.75), hsl(220 40% 8% / 0.75))',
              border: '1px solid hsl(270 30% 20%)',
              boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Soft decorative glow background */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, hsl(270 100% 60% / 0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
              filter: 'blur(30px)'
            }} />

            {/* Prestige Showcase Section */}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              
              {/* Level & XP */}
              <div style={{ padding: '1rem', background: 'hsl(222 20% 7% / 0.4)', border: '1px solid hsl(220 15% 12%)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Rank & Level</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>Level {profile.level}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                  <div style={{ flex: 1, height: 6, background: 'hsl(220 20% 12%)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${levelPercent}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))' }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'hsl(220 100% 70%)', fontWeight: 700 }}>{levelPercent}%</span>
                </div>
              </div>

              {/* Highest Rank */}
              <div style={{ padding: '1rem', background: 'hsl(222 20% 7% / 0.4)', border: '1px solid hsl(220 15% 12%)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Highest Matchmaking Rank</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: getRankDetails(rankedStats?.mmr || 1000).badgeColor, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Zap size={16} /> {rankedStats?.peakRank || 'Bronze'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Current MMR: {rankedStats?.mmr || 1000}</span>
              </div>

              {/* Wins & Win Rate */}
              <div style={{ padding: '1rem', background: 'hsl(222 20% 7% / 0.4)', border: '1px solid hsl(220 15% 12%)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Victories</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(142 70% 55%)' }}>{totalWins} Wins</span>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Win Rate: {winRate}% ({totalGames} Games)</span>
              </div>

              {/* Favorite Game */}
              <div style={{ padding: '1rem', background: 'hsl(222 20% 7% / 0.4)', border: '1px solid hsl(220 15% 12%)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Preferred Play Area</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 100% 70%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <GamepadIcon size={14} className="inline mr-1" /> {favoriteGameLabel}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Most played game mode</span>
              </div>

              {/* Recent Achievement */}
              <div style={{ padding: '1rem', background: 'hsl(222 20% 7% / 0.4)', border: '1px solid hsl(220 15% 12%)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent Achievement</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(45 100% 60%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={profile.achievements[0]?.achievement.name}>
                  <AwardIcon size={14} className="inline mr-1 text-yellow-400" /> {profile.achievements[0]?.achievement.name || 'No Badges'}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.achievements[0]?.achievement.description || 'Unlock by playing matches'}
                </span>
              </div>

              {/* About Shortcut Link Card */}
              <Link 
                href="/dashboard/about"
                style={{ 
                  padding: '1rem', 
                  background: 'linear-gradient(135deg, hsl(270 50% 15% / 0.6), hsl(220 50% 10% / 0.6))', 
                  border: '1px solid hsl(270 40% 30% / 0.5)', 
                  borderRadius: 16, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  transition: 'transform 0.2s, border-color 0.2s',
                  cursor: 'pointer'
                }}
                className="about-shortcut-card"
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(270 100% 75%)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>GameHub Showcase</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={16} /> Platform Details <ArrowRight size={14} />
                </span>
                <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 60%)' }}>Founder story, roadmap & stats</span>
              </Link>

            </div>
          </div>

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
                <GiftIcon size={14} className="inline mr-1 text-pink-400" /> Reward Preview: Next Level Unlocks:
              </div>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'hsl(220 10% 60%)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {getNextLevelUnlocks(profile.level + 1).map((reward, i) => (
                  <li key={i}>{reward}</li>
                ))}
              </ul>
            </div>
          </div>


          {/* Badge Showcase Card */}
          <div className="card glass" style={{ padding: '1.25rem', borderRadius: 20 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1rem', letterSpacing: '0.05em' }}>
              Unlocked Badges ({profile.achievements.length})
            </h3>
            {profile.achievements.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 50%)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
                No achievements unlocked yet. Play games to earn badges!
              </p>
            ) : (
              <div className="unlocked-badges-grid">
                {profile.achievements.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      background: 'hsl(222 20% 8% / 0.8)',
                      border: '1px solid hsl(220 15% 15%)',
                      padding: '0.5rem',
                      borderRadius: 14,
                      aspectRatio: '1 / 1',
                      boxSizing: 'border-box'
                    }}
                    title={`${item.achievement.name}: ${item.achievement.description}`}
                  >
                    <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}><AwardIcon size={24} className="text-yellow-400" /></span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'white', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
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
        activityLoading || bbStatsLoading ? (
          <StatsSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Summary stats row */}
          <div className="profile-stats-summary-grid">
            {[
              { label: 'Games Played', val: totalGames, color: 'white', icon: <Gamepad2 size={24} style={{ color: 'hsl(220 100% 65%)' }} /> },
              { label: 'Total Wins', val: totalWins, color: 'hsl(142 70% 55%)', icon: <Trophy size={24} style={{ color: 'hsl(45 100% 60%)' }} /> },
              { label: 'Total Losses', val: totalLosses, color: 'hsl(0 80% 60%)', icon: <Award size={24} style={{ color: 'hsl(0 80% 60%)' }} /> },
              { label: 'XP Streak', val: `${profile.currentStreak} Days`, color: 'hsl(38 95% 60%)', icon: <Flame size={24} style={{ color: 'hsl(38 95% 60%)' }} /> },
              { label: 'Favorite Game', val: favoriteGameLabel, color: 'hsl(220 100% 70%)', icon: <Star size={24} style={{ color: 'hsl(220 100% 70%)' }} /> }
            ].map((s, idx) => (
              <div key={idx} className="card glass" style={{ padding: '1.1rem 1.25rem', borderRadius: 16, display: 'flex', alignItems: 'center', gap: '1rem', height: '100%', boxSizing: 'border-box' }}>
                <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 850, color: s.color, marginTop: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="profile-stats-charts-grid">
            
            {/* SVG Weekly Bar Chart */}
            <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1.25rem', letterSpacing: '0.05em' }}>
                <CalendarIcon size={16} className="inline mr-2 text-blue-400" /> Match Activity (Last 7 Days)
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
                  <TargetIcon size={16} className="inline mr-2 text-pink-400" /> Win Rate
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
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><TrophyIcon size={32} className="text-yellow-400" /></div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Highest Score</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(45 100% 60%)', marginTop: '0.25rem' }}>{bbStats.highScore.toLocaleString()}</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🔥</div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Highest Combo</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(270 80% 65%)', marginTop: '0.25rem' }}>{bbStats.bestCombo}x</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><FlaskIcon size={32} className="text-purple-400" /></div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Avg Lines Cleared</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'hsl(142 70% 55%)', marginTop: '0.25rem' }}>{bbStats.avgLines}</div>
                </div>
                <div style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1.25rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><GamepadIcon size={32} className="text-blue-400" /></div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Games Played</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', marginTop: '0.25rem' }}>{bbStats.playCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Hangman Performance Stats Card */}
          {hangmanStats.wins + hangmanStats.losses > 0 && (
            <div className="card glass animate-fadeIn" style={{ padding: '1.5rem', borderRadius: 20, background: 'linear-gradient(135deg, hsl(222 20% 10% / 0.95), hsl(222 20% 7% / 0.95))', border: '1px solid hsl(220 15% 18%)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: '0 0 1.25rem', letterSpacing: '0.05em', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <BookOpen size={16} /> Hangman Performance
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                {[
                  { icon: <CheckCircle size={24} style={{ color: 'hsl(142 70% 55%)' }} />, label: 'Words Solved', val: hangmanStats.wordsSolved, color: 'hsl(142 70% 55%)' },
                  { icon: <Trophy size={24} style={{ color: 'hsl(45 100% 60%)' }} />, label: 'Wins', val: hangmanStats.wins, color: 'hsl(45 100% 60%)' },
                  { icon: <Award size={24} style={{ color: 'hsl(0 80% 60%)' }} />, label: 'Losses', val: hangmanStats.losses, color: 'hsl(0 80% 60%)' },
                  { icon: <Star size={24} style={{ color: 'hsl(220 100% 70%)' }} />, label: 'Accuracy', val: hangmanStats.correctGuesses + hangmanStats.incorrectGuesses > 0 ? `${Math.round((hangmanStats.correctGuesses / (hangmanStats.correctGuesses + hangmanStats.incorrectGuesses)) * 100)}%` : '—', color: 'hsl(220 100% 70%)' },
                  { icon: <Zap size={24} style={{ color: 'hsl(270 80% 65%)' }} />, label: 'Fastest Solve', val: hangmanStats.fastestSolve !== null ? `${hangmanStats.fastestSolve}s` : '—', color: 'hsl(270 80% 65%)' },
                  { icon: <Flame size={24} style={{ color: 'hsl(38 95% 60%)' }} />, label: 'Best Streak', val: hangmanStats.bestStreak, color: 'hsl(38 95% 60%)' },
                ].map((s, i) => (
                  <div key={i} style={{ background: 'hsl(222 20% 8% / 0.8)', border: '1px solid hsl(220 15% 15%)', padding: '1rem 0.75rem', borderRadius: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ marginBottom: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>{s.label}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: s.color, marginTop: '0.2rem' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        )
      )}

      {/* TAB MATCH HISTORY */}
      {activeTab === 'matches' && (
        matchesLoading ? (
          <MatchesSkeleton />
        ) : (
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
              <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(220 10% 45%)', display: 'flex', alignItems: 'center' }}><SearchIcon size={12} /></span>
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
              <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><ScrollIcon size={36} className="text-muted-foreground" /></span>
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
      )
    )}

      {/* TAB RANKED LEAGUE */}
      {activeTab === 'ranked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {rankedLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>
              Loading Ranked Profile...
            </div>
          ) : !rankedStats ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>
              No ranked data available.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
              
              {/* Ranked Status Card */}
              <div
                className="card glass"
                style={{
                  padding: '2rem',
                  borderRadius: 24,
                  background: 'linear-gradient(135deg, hsl(222 20% 10% / 0.95), hsl(222 20% 7% / 0.95))',
                  border: '1px solid hsl(220 15% 18%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                }}
              >
                {/* Background glow matching the rank */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-40%',
                    right: '-40%',
                    width: '80%',
                    height: '80%',
                    borderRadius: '50%',
                    background: getRankDetails(rankedStats.mmr).glowColor,
                    filter: 'blur(80px)',
                    opacity: 0.15,
                    pointerEvents: 'none'
                  }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <RankBadge mmr={rankedStats.mmr} size="lg" showLabel={false} />
                  <div>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
                      {getRankDetails(rankedStats.mmr).label}
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem' }}>
                      Rating: <strong style={{ color: getRankDetails(rankedStats.mmr).badgeColor, fontSize: '1rem' }}>{rankedStats.mmr} MMR</strong>
                    </div>
                  </div>
                </div>

                {/* Progress bar to next tier */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)' }}>
                    <span>Rank Progress</span>
                    <span>{getRankDetails(rankedStats.mmr).progress}%</span>
                  </div>
                  <div style={{ height: 10, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden', border: '1px solid hsl(220 15% 12%)' }}>
                    <div
                      style={{
                        width: `${getRankDetails(rankedStats.mmr).progress}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${getRankDetails(rankedStats.mmr).badgeColor}, hsl(220 100% 70%))`,
                        borderRadius: 99
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(220 10% 45%)' }}>
                    <span>Min {getRankDetails(rankedStats.mmr).minMmr}</span>
                    <span>Max {getRankDetails(rankedStats.mmr).maxMmr === 99999 ? '∞' : getRankDetails(rankedStats.mmr).maxMmr}</span>
                  </div>
                </div>

                {/* Detailed stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
                  <div style={{ background: 'hsl(222 20% 6% / 0.6)', border: '1px solid hsl(220 15% 13%)', padding: '1rem', borderRadius: 16 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Peak Rank</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={rankedStats.peakRank}>
                      <Zap size={14} /> {rankedStats.peakRank}
                    </div>
                  </div>
                  <div style={{ background: 'hsl(222 20% 6% / 0.6)', border: '1px solid hsl(220 15% 13%)', padding: '1rem', borderRadius: 16 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Streak</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: rankedStats.streak >= 0 ? 'hsl(142 70% 55%)' : 'hsl(0 80% 60%)', marginTop: '0.25rem' }}>
                      {rankedStats.streak >= 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2', justifyContent: 'center' }}><Flame size={16} /> +{rankedStats.streak}</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2', justifyContent: 'center', color: 'hsl(0 80% 60%)' }}><Award size={16} /> {rankedStats.streak}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ background: 'hsl(222 20% 6% / 0.6)', border: '1px solid hsl(220 15% 13%)', padding: '1rem', borderRadius: 16 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Wins / Losses</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'white', marginTop: '0.25rem' }}>
                      <span style={{ color: 'hsl(142 70% 55%)' }}>{rankedStats.wins}W</span>
                      <span style={{ color: 'hsl(220 10% 45%)' }}> / </span>
                      <span style={{ color: 'hsl(0 80% 60%)' }}>{rankedStats.losses}L</span>
                    </div>
                  </div>
                  <div style={{ background: 'hsl(222 20% 6% / 0.6)', border: '1px solid hsl(220 15% 13%)', padding: '1rem', borderRadius: 16 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 50%)' }}>Win Rate</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(142 70% 55%)', marginTop: '0.25rem' }}>
                      {rankedStats.wins + rankedStats.losses > 0
                        ? `${Math.round((rankedStats.wins / (rankedStats.wins + rankedStats.losses)) * 100)}%`
                        : '0%'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ranked Match History Log */}
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', margin: 0, letterSpacing: '0.05em' }}>
                  <ScrollIcon size={16} className="inline mr-2 text-blue-400" /> Recent Ranked Matches
                </h3>

                {rankedStats.recentMatches.length === 0 ? (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'hsl(220 20% 7%)', borderRadius: 16, border: '1px dashed hsl(220 15% 15%)' }}>
                    <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><GamepadIcon size={36} className="text-muted-foreground" /></span>
                    <h4 style={{ margin: 0, fontWeight: 700, color: 'white' }}>No Matches Recorded</h4>
                    <p style={{ color: 'hsl(220 10% 45%)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                      Simulate or play multiplayer matches to build your record.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {rankedStats.recentMatches.map((match) => {
                      const won = match.result === 'win'
                      const draw = match.result === 'draw'
                      const badgeBg = draw ? 'hsl(45 100% 55% / 0.12)' : won ? 'hsl(142 70% 45% / 0.12)' : 'hsl(0 80% 55% / 0.12)'
                      const badgeColor = draw ? 'hsl(45 100% 65%)' : won ? 'hsl(142 70% 55%)' : 'hsl(0 80% 65%)'
                      const resultLabel = draw ? 'Draw' : won ? 'Win' : 'Loss'

                      return (
                        <div
                          key={match.id}
                          style={{
                            background: 'hsl(222 20% 8% / 0.6)',
                            border: '1px solid hsl(220 15% 14%)',
                            borderRadius: 16,
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: badgeBg, color: badgeColor, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.35rem 0.6rem', borderRadius: 8, minWidth: 50, textAlign: 'center' }}>
                              {resultLabel}
                            </div>
                            <div>
                              <div style={{ fontWeight: 750, fontSize: '0.9rem', color: 'white' }}>
                                vs {match.opponentName}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '0.15rem' }}>
                                {new Date(match.playedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>MMR Change</div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: match.mmrChange > 0 ? 'hsl(142 70% 55%)' : match.mmrChange < 0 ? 'hsl(0 80% 60%)' : 'hsl(220 10% 50%)' }}>
                              {match.mmrChange > 0 ? `+${match.mmrChange}` : match.mmrChange}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>
          )}
          </div>
      )}

      {/* TAB ACHIEVEMENTS */}
      {activeTab === 'achievements' && (
        achievementsLoading ? (
          <AchievementsSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.75rem', color: 'hsl(220 10% 50%)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'hsl(142 70% 50%)', display: 'inline-block' }} />
              Unlocked
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'hsl(220 20% 25%)', display: 'inline-block' }} />
              In Progress
            </span>
          </div>

          {achievementProgress.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'hsl(220 20% 7%)', borderRadius: 16, border: '1px dashed hsl(220 15% 15%)' }}>
              <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><AwardIcon size={36} className="text-muted-foreground" /></span>
              <h4 style={{ margin: 0, fontWeight: 700, color: 'white' }}>No Achievements Yet</h4>
              <p style={{ color: 'hsl(220 10% 45%)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Play games to start earning achievements!
              </p>
            </div>
          ) : (
            <div className="profile-achievements-grid">
              {achievementProgress.map((ach, idx) => (
                <div
                  key={ach.slug || idx}
                  className="card glass"
                  style={{
                    padding: '1.25rem',
                    borderRadius: 16,
                    background: ach.isUnlocked
                      ? 'linear-gradient(135deg, hsl(142 70% 10% / 0.4), hsl(142 70% 7% / 0.4))'
                      : 'hsl(222 20% 8% / 0.6)',
                    border: `1px solid ${ach.isUnlocked ? 'hsl(142 70% 25% / 0.8)' : 'hsl(220 15% 14%)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    height: '100%',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: ach.isUnlocked ? 'hsl(142 70% 20%)' : 'hsl(220 20% 12%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.3rem', flexShrink: 0
                    }}>
                      {ach.isUnlocked ? <AwardIcon size={16} className="text-yellow-400" /> : <LockIcon size={16} className="text-muted-foreground" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 750, fontSize: '0.88rem', color: ach.isUnlocked ? 'hsl(142 70% 70%)' : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ach.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem', lineHeight: 1.3, height: '2.6rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ach.description}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', color: 'hsl(142 70% 55%)', fontWeight: 700 }}>+{ach.xpReward} XP</div>
                      <div style={{ fontSize: '0.65rem', color: 'hsl(45 100% 55%)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}><CoinsIcon size={10} /> <span>{ach.coinReward}</span></div>
                    </div>
                  </div>

                  {/* Progress bar (always rendered) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'hsl(220 10% 45%)', marginBottom: '0.25rem' }}>
                      <span>{ach.isUnlocked ? ach.target : ach.current} / {ach.target}</span>
                      <span>{ach.isUnlocked ? 100 : ach.progressPercentage}%</span>
                    </div>
                    <div style={{ height: 6, background: 'hsl(220 20% 12%)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${ach.isUnlocked ? 100 : ach.progressPercentage}%`, 
                        height: '100%', 
                        background: ach.isUnlocked 
                          ? 'linear-gradient(90deg, hsl(142 70% 45%), hsl(142 70% 55%))' 
                          : 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))', 
                        borderRadius: 99 
                      }} />
                    </div>
                  </div>

                  {/* Category badge */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(220 10% 40%)', background: 'hsl(220 20% 10%)', padding: '0.15rem 0.5rem', borderRadius: 99 }}>
                      {ach.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )
      )}

      {/* TAB FRIENDS */}
      {activeTab === 'friends' && (
        friendsLoading ? (
          <FriendsSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!user ? (
            <div className="card glass" style={{ padding: '2rem', borderRadius: 20, textAlign: 'center' }}>
              <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><UsersIcon size={36} className="text-muted-foreground" /></span>
              <h3 style={{ fontWeight: 700, color: 'white', margin: '0 0 0.5rem' }}>Friend List</h3>
              <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
                Log in to see and manage your real friends list.
              </p>
            </div>
          ) : null}

          {friendsLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading friends...</div>
          ) : friends.length === 0 ? (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'hsl(220 20% 7%)', borderRadius: 16, border: '1px dashed hsl(220 15% 15%)' }}>
              <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><UsersIcon size={36} className="text-muted-foreground" /></span>
              <h4 style={{ margin: 0, fontWeight: 700, color: 'white' }}>No Friends Added</h4>
              <p style={{ color: 'hsl(220 10% 45%)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Add friends from the <a href="/dashboard/friends" style={{ color: 'hsl(220 100% 65%)', textDecoration: 'none', fontWeight: 700 }}>Friends page</a>.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {friends.map((friend: any) => {
                const presence = getOnlinePresence(friend.lastSeenAt)
                return (
                  <div
                    key={friend.id}
                    className="card glass"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      background: 'linear-gradient(135deg, hsl(222 18% 11%), hsl(222 18% 8%))',
                      border: '1px solid hsl(220 15% 14%)',
                      borderRadius: 16,
                      minHeight: '80px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar
                          avatarUrl={friend.avatarUrl}
                          username={friend.username}
                          selectedFrame={friend.selectedFrame}
                          size={42}
                        />
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2, width: 12, height: 12,
                          borderRadius: '50%', background: presence.dot, border: '2px solid hsl(222 18% 11%)',
                          boxShadow: `0 0 5px ${presence.dot}`
                        }} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 750, fontSize: '0.95rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {friend.displayName || (friend.username.includes('@') ? friend.username.split('@')[0] : friend.username)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          @{friend.username}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: presence.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '0.15rem' }}>
                          {presence.label}
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/profile/${friend.id}`}
                      style={{
                        fontSize: '0.72rem', fontWeight: 700, color: 'hsl(220 100% 65%)',
                        background: 'hsl(220 100% 60% / 0.1)', border: '1px solid hsl(220 100% 60% / 0.25)',
                        padding: '0.4rem 0.8rem', borderRadius: 8, textDecoration: 'none',
                        whiteSpace: 'nowrap', flexShrink: 0
                      }}
                    >
                      View Profile
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        )
      )}

      {/* TAB COSMETICS */}
      {activeTab === 'cosmetics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {profile.inventory && profile.inventory.length > 0 ? (
            <>
              <div style={{ fontSize: '0.78rem', color: 'hsl(220 10% 50%)' }}>
                {profile.inventory.length} item{profile.inventory.length !== 1 ? 's' : ''} in your collection
              </div>
              <div className="profile-cosmetics-grid">
                {profile.inventory.map((item: any, idx: number) => {
                  const cosmetic = item.cosmeticItem
                  const typeEmoji: Record<string, string> = {
                    AVATAR_FRAME: 'Frame',
                    BOARD_THEME: 'Theme',
                    CHAT_COLOR: 'Color',
                    TITLE: 'Title',
                    BADGE: 'Badge',
                    AVATAR: 'Avatar',
                    CHAT_PACK: 'Pack',
                    SCRATCHER: 'Scratcher',
                    EFFECT: 'Effect',
                  }
                  return (
                    <div
                      key={cosmetic.id || idx}
                      className="card glass"
                      style={{
                        padding: '1.25rem 1rem',
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'center',
                        gap: '0.5rem',
                        height: '140px',
                        background: cosmetic.isDefault
                          ? 'hsl(222 20% 8% / 0.5)'
                          : 'linear-gradient(135deg, hsl(270 50% 12% / 0.4), hsl(220 30% 9% / 0.4))',
                        border: `1px solid ${cosmetic.isDefault ? 'hsl(220 15% 14%)' : 'hsl(270 50% 25% / 0.8)'}`,
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px' }}><GiftIcon size={24} className="text-pink-400" /></div>
                      <div style={{ fontWeight: 750, fontSize: '0.8rem', color: 'white', lineHeight: 1.2, height: '2.4rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{cosmetic.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', width: '100%' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(270 60% 60%)', background: 'hsl(270 50% 15%)', padding: '0.15rem 0.5rem', borderRadius: 99, width: 'fit-content' }}>
                          {cosmetic.type.replace(/_/g, ' ')}
                        </div>
                        {cosmetic.isDefault && (
                          <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 40%)', fontWeight: 600 }}>Default</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'hsl(220 20% 7%)', borderRadius: 16, border: '1px dashed hsl(220 15% 15%)' }}>
              <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><PaletteIcon size={36} className="text-muted-foreground" /></span>
              <h4 style={{ margin: 0, fontWeight: 700, color: 'white' }}>No Cosmetics Yet</h4>
              <p style={{ color: 'hsl(220 10% 45%)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Visit the <a href="/dashboard/store" style={{ color: 'hsl(270 80% 65%)', textDecoration: 'none', fontWeight: 700 }}>Store</a> to get cosmetics.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {tournamentsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)' }}>
              Loading tournament stats...
            </div>
          ) : !tournamentData ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 50%)' }}>
              No tournament data available. Guest players or new profiles do not have histories recorded.
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Total Matches', value: tournamentData.stats.totalMatches, color: 'hsl(220 100% 65%)', bg: 'hsl(220 100% 50% / 0.08)', border: 'hsl(220 100% 50% / 0.15)' },
                  { label: 'Wins (Champion)', value: tournamentData.stats.wins, color: 'hsl(45 100% 55%)', bg: 'hsl(45 100% 50% / 0.08)', border: 'hsl(45 100% 50% / 0.15)' },
                  { label: 'Runner-ups', value: tournamentData.stats.runnerUps, color: 'hsl(280 100% 65%)', bg: 'hsl(280 100% 50% / 0.08)', border: 'hsl(280 100% 50% / 0.15)' },
                  { label: 'Win Rate', value: `${tournamentData.stats.winRate}%`, color: 'hsl(140 100% 45%)', bg: 'hsl(140 100% 50% / 0.08)', border: 'hsl(140 100% 50% / 0.15)' }
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="card glass"
                    style={{
                      padding: '1.25rem 1rem',
                      borderRadius: 16,
                      textAlign: 'center',
                      background: stat.bg,
                      border: `1px solid ${stat.border}`
                    }}
                  >
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: stat.color, marginBottom: '0.2rem' }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notice for community tournaments */}
              <div 
                style={{ 
                  padding: '0.85rem 1.25rem', 
                  borderRadius: 12, 
                  background: 'hsl(220 20% 8% / 0.8)', 
                  border: '1px solid hsl(220 15% 15%)', 
                  fontSize: '0.78rem', 
                  color: 'hsl(220 10% 55%)',
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}
              >
                <span>ℹ️</span>
                <span><strong>Progression Notice:</strong> Community (User-created) tournaments are for practice and community engagement, and do not grant XP, Coins, or Achievements. Only Official Tournaments provide seasonal rewards.</span>
              </div>

              {/* Official History */}
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, background: 'hsl(222 20% 8% / 0.6)', border: '1px solid hsl(220 15% 15%)' }}>
                <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <TrophyIcon size={16} className="inline mr-2 text-yellow-400" /> Official Esports Tournaments
                </h3>
                {tournamentData.officialHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'hsl(220 10% 50%)', fontSize: '0.8rem' }}>
                    No official tournaments joined yet. Keep an eye out in the tournaments tab!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {tournamentData.officialHistory.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.85rem 1.1rem',
                          borderRadius: 12,
                          background: 'hsl(222 18% 10%)',
                          border: '1px solid hsl(220 15% 15%)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{h.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                            <GamepadIcon size={12} className="inline mr-1 text-purple-400" /> {getGameBySlug(h.gameSlug)?.name || h.gameSlug} • {new Date(h.startDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {h.result === 'CHAMPION' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'hsl(45 100% 50%)', background: 'hsl(45 100% 50% / 0.12)', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid hsl(45 100% 50% / 0.3)' }}>
                              <CrownIcon size={12} className="inline mr-1 text-yellow-400" /> CHAMPION
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(220 10% 60%)', background: 'hsl(222 15% 15%)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                              Participant
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, color: h.regStatus === 'CLAIMED' ? 'hsl(140 100% 45%)' : 'hsl(200 100% 50%)' }}>
                            {h.regStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Community History */}
              <div className="card glass" style={{ padding: '1.5rem', borderRadius: 20, background: 'hsl(222 20% 8% / 0.6)', border: '1px solid hsl(220 15% 15%)' }}>
                <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UsersIcon size={16} className="inline mr-2 text-blue-400" /> Community Tournaments
                </h3>
                {tournamentData.communityHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'hsl(220 10% 50%)', fontSize: '0.8rem' }}>
                    No community tournaments joined yet. You can create your own from the Tournaments tab!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {tournamentData.communityHistory.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.85rem 1.1rem',
                          borderRadius: 12,
                          background: 'hsl(222 18% 10%)',
                          border: '1px solid hsl(220 15% 15%)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white' }}>{h.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                            🎮 {getGameBySlug(h.gameSlug)?.name || h.gameSlug} • {new Date(h.startDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {h.result === 'CHAMPION' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'hsl(45 100% 50%)', background: 'hsl(45 100% 50% / 0.12)', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid hsl(45 100% 50% / 0.3)' }}>
                              <CrownIcon size={12} className="inline mr-1 text-yellow-400" /> CHAMPION
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'hsl(220 10% 60%)', background: 'hsl(222 15% 15%)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                              Participant
                            </span>
                          )}
                          <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'hsl(200 100% 50%)' }}>
                            {h.regStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
