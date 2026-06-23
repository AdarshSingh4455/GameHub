'use client'

import React, { useState, useEffect } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { DAILY_REWARD_TABLE, getUtcDaysElapsed } from '@/lib/dailyRewards'
import { getLevelProgress } from '@/lib/xpUtils'
import type { AchievementProgressInfo } from '@/lib/achievements'
import { getCachedProfileDetails, prefetchProfileDetails } from '@/lib/prefetch'

interface ProfileStats {
  level: number
  xp: number
  coins: number
  streak: number
  rewardDay: number
  lastClaim: string | null
  achievementProgress: AchievementProgressInfo[]
  ownedChatPacks: Array<{
    id: string
    name: string
    category: string
    source: string
    messages: string[]
  }>
}

const UPCOMING_UNLOCKS = [
  { level: 5, reward: '👑 Novice Leader Badge', description: 'Unlock the Novice Leader badge on your profile and entry to elite chat.' },
  { level: 10, reward: '🎖️ Gaming Expert Badge', description: 'Unlock the Veteran badge and +500 bonus coins.' },
  { level: 15, reward: '🛡️ Strategist Badge', description: 'Unlock special match customization options.' },
  { level: 20, reward: '🎯 Perfect Accuracy Badge', description: 'Earn double XP multiplier on selected weekend games.' },
  { level: 25, reward: '💎 GameHub Legend Badge', description: 'Unlock permanent golden name styling in leaderboards.' },
]

export default function RewardsPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [canClaimToday, setCanClaimToday] = useState(true)
  const [countdown, setCountdown] = useState<number>(0)
  const [claiming, setClaiming] = useState(false)

  const loadData = () => {
    const cached = getCachedProfileDetails()
    if (cached && cached.profile) {
      const inventory = cached.profile.inventory || []
      const chatPacks = inventory
        .filter((inv: any) => inv.cosmeticItem && inv.cosmeticItem.type === 'CHAT_PACK')
        .map((inv: any) => ({
          id: inv.cosmeticItem.id,
          name: inv.cosmeticItem.name,
          category: inv.cosmeticItem.metadata?.rarity || 'COMMON',
          source: inv.cosmeticItem.priceCoins > 0 ? 'Purchased from Store' : 'Level Unlock',
          messages: inv.cosmeticItem.metadata?.messages || [],
        }))

      setStats({
        level: cached.profile.level,
        xp: cached.profile.xp,
        coins: cached.profile.coins,
        streak: cached.profile.currentStreak,
        rewardDay: cached.profile.dailyRewardDay,
        lastClaim: cached.profile.lastDailyRewardClaim,
        achievementProgress: cached.achievementProgress || [],
        ownedChatPacks: chatPacks,
      })

      if (cached.profile.lastDailyRewardClaim) {
        const lastClaimDate = new Date(cached.profile.lastDailyRewardClaim)
        const now = new Date()
        const daysDiff = getUtcDaysElapsed(now, lastClaimDate)
        if (daysDiff === 0) {
          setCanClaimToday(false)
          const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
          setCountdown(Math.max(0, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000)))
        } else {
          setCanClaimToday(true)
        }
      } else {
        setCanClaimToday(true)
      }
      setLoading(false)
    } else {
      setLoading(true)
    }

    if (user) {
      fetch('/api/profile/details')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          // Parse owned chat packs
          const inventory = data.profile.inventory || []
          const chatPacks = inventory
            .filter((inv: any) => inv.cosmeticItem && inv.cosmeticItem.type === 'CHAT_PACK')
            .map((inv: any) => ({
              id: inv.cosmeticItem.id,
              name: inv.cosmeticItem.name,
              category: inv.cosmeticItem.metadata?.rarity || 'COMMON',
              source: inv.cosmeticItem.priceCoins > 0 ? 'Purchased from Store' : 'Level Unlock',
              messages: inv.cosmeticItem.metadata?.messages || [],
            }))

          setStats({
            level: data.profile.level,
            xp: data.profile.xp,
            coins: data.profile.coins,
            streak: data.profile.currentStreak,
            rewardDay: data.profile.dailyRewardDay,
            lastClaim: data.profile.lastDailyRewardClaim,
            achievementProgress: data.achievementProgress || [],
            ownedChatPacks: chatPacks,
          })

          // Calculate claims
          if (data.profile.lastDailyRewardClaim) {
            const lastClaimDate = new Date(data.profile.lastDailyRewardClaim)
            const now = new Date()
            const daysDiff = getUtcDaysElapsed(now, lastClaimDate)
            if (daysDiff === 0) {
              setCanClaimToday(false)
              const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
              setCountdown(Math.max(0, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000)))
            } else {
              setCanClaimToday(true)
            }
          } else {
            setCanClaimToday(true)
          }
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      // Guest local retrieval
      const xp = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const level = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      const coins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      const streak = parseInt(localStorage.getItem('gamehub_guest_streak') || '0', 10)
      const rewardDay = parseInt(localStorage.getItem('gamehub_guest_reward_day') || '1', 10)
      const lastClaim = localStorage.getItem('gamehub_guest_last_claim')

      // Simulated guest achievements list
      const mockAchievements: AchievementProgressInfo[] = [
        { slug: 'first-game', name: 'First Move', description: 'Play your first game.', category: 'Gameplay', xpReward: 50, coinReward: 10, current: 0, target: 1, progressPercentage: 0, isUnlocked: false },
        { slug: 'first-win', name: 'Winner Winner', description: 'Win your first match.', category: 'Wins', xpReward: 100, coinReward: 25, current: 0, target: 1, progressPercentage: 0, isUnlocked: false },
        { slug: 'streak-3', name: 'Hot Streak', description: 'Claim daily rewards 3 days in a row.', category: 'Streaks', xpReward: 75, coinReward: 15, current: streak, target: 3, progressPercentage: Math.min(100, Math.round((streak / 3) * 100)), isUnlocked: streak >= 3 },
      ]

      // Retrieve mock inventory
      const guestInvIds = JSON.parse(localStorage.getItem('gamehub_guest_inventory') || '[]')
      const mockChatPacks = [
        { id: 'friendly-chat', name: 'Friendly Chat Pack', category: 'COMMON', source: 'Purchased from Store', messages: ['Well played! 🤝', 'Good game! 🎮', 'Nice move! 🔥', 'Hello there! 👋'] },
        { id: 'competitor-chat', name: 'Competitor Chat Pack', category: 'RARE', source: 'Purchased from Store', messages: ['Too easy! ⚡', 'Calculated. 🎯', 'Close one! 😮', 'Unlucky! 💀'] },
        { id: 'silly-chat', name: 'Silly Chat Pack', category: 'EPIC', source: 'Purchased from Store', messages: ['Catch me if you can! 🏃', 'Oops, my bad! 🤡', 'Wow! 🌟', 'Let me cook! 👨‍🍳'] }
      ].filter(p => guestInvIds.includes(p.id) || (guestInvIds.includes('cyber-bot') || guestInvIds.length > 0) && p.id === 'friendly-chat')

      setStats({
        level,
        xp,
        coins,
        streak,
        rewardDay,
        lastClaim,
        achievementProgress: mockAchievements,
        ownedChatPacks: mockChatPacks,
      })

      if (lastClaim) {
        const lastClaimDate = new Date(lastClaim)
        const now = new Date()
        const daysDiff = getUtcDaysElapsed(now, lastClaimDate)
        if (daysDiff === 0) {
          setCanClaimToday(false)
          const nextMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
          setCountdown(Math.max(0, Math.ceil((nextMidnight.getTime() - now.getTime()) / 1000)))
        } else {
          setCanClaimToday(true)
        }
      } else {
        setCanClaimToday(true)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    const handleUpdate = () => {
      loadData()
    }

    window.addEventListener('storage', handleUpdate)
    window.addEventListener('gamehub_xp_update', handleUpdate)

    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('gamehub_xp_update', handleUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Countdown timer update
  useEffect(() => {
    if (countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          setCanClaimToday(true)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown])

  const handleClaim = async () => {
    if (claiming || !canClaimToday || !stats) return
    setClaiming(true)

    if (user) {
      try {
        const res = await fetch('/api/profile/daily-claim', { method: 'POST' })
        if (!res.ok) throw new Error()
        const data = await res.json()

        addToast('daily_reward_claimed', 'Reward Claimed! 🎁', `Claimed Day ${data.dayClaimed} reward: +${data.coinsGained} Coins and +${data.xpGained} XP!`)

        if (data.unlockedAchievements?.length > 0) {
          data.unlockedAchievements.forEach((ach: { name: string; description: string }) => {
            addToast('achievement_unlocked', 'Achievement Unlocked! 🏆', `${ach.name}: ${ach.description}`)
          })
        }

        if (data.leveledUp) {
          addToast('level_up', 'Level Up! ⭐', `Congratulations! You reached Level ${data.newLevel}!`)
        }

        // Trigger header details to update
        window.dispatchEvent(new Event('gamehub_xp_update'))
        loadData()
      } catch (err) {
        console.error('[CLAIM ERROR]', err)
      } finally {
        setClaiming(false)
      }
    } else {
      // Guest local claim
      const table = DAILY_REWARD_TABLE
      const nextDay = (stats.rewardDay % 7) + 1
      const rewardConfig = table.find((r) => r.day === nextDay) || table[0]

      const finalXP = stats.xp + rewardConfig.xp
      const finalCoins = stats.coins + rewardConfig.coins
      const finalStreak = stats.streak + 1

      localStorage.setItem('gamehub_guest_xp', finalXP.toString())
      localStorage.setItem('gamehub_guest_coins', finalCoins.toString())
      localStorage.setItem('gamehub_guest_streak', finalStreak.toString())
      localStorage.setItem('gamehub_guest_reward_day', nextDay.toString())
      localStorage.setItem('gamehub_guest_last_claim', new Date().toISOString())

      // Check level up for guest
      const newLevel = Math.floor(Math.sqrt(finalXP / 100)) + 1
      const oldLevel = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      if (newLevel > oldLevel) {
        localStorage.setItem('gamehub_guest_level', newLevel.toString())
        addToast('level_up', 'Level Up! ⭐', `Congratulations! You reached Level ${newLevel}!`)
      }

      window.dispatchEvent(new Event('gamehub_xp_update'))
      addToast('daily_reward_claimed', 'Reward Claimed! 🎁', `[GUEST] Claimed Day ${nextDay} reward: +${rewardConfig.coins} Coins and +${rewardConfig.xp} XP!`)
      
      setClaiming(false)
      loadData()
    }
  }

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (loading && !stats) {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }} className="mobile-centered-wrapper">
        <style>{`
          @keyframes skeleton-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .shimmer-block {
            background: linear-gradient(90deg, hsl(222 20% 15%) 25%, hsl(222 20% 22%) 50%, hsl(222 20% 15%) 75%);
            background-size: 200% 100%;
            animation: skeleton-shimmer 1.5s infinite linear;
          }
        `}</style>
        
        {/* Header Skeleton */}
        <div>
          <div className="shimmer-block" style={{ width: '180px', height: '28px', borderRadius: '6px' }} />
          <div className="shimmer-block" style={{ width: '380px', height: '16px', borderRadius: '4px', marginTop: '8px' }} />
        </div>

        {/* Row 1 Grid: 3 Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map(idx => (
            <div key={idx} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '140px' }}>
              <div className="shimmer-block" style={{ width: '120px', height: '12px', borderRadius: '4px' }} />
              <div className="shimmer-block" style={{ width: '80px', height: '24px', borderRadius: '6px' }} />
              <div className="shimmer-block" style={{ width: '100%', height: '8px', borderRadius: '4px', marginTop: 'auto' }} />
            </div>
          ))}
        </div>

        {/* Row 2 Grid: 2 Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {[1, 2].map(idx => (
            <div key={idx} className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '360px' }}>
              <div className="shimmer-block" style={{ width: '140px', height: '16px', borderRadius: '4px' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', flex: 1, contentVisibility: 'auto' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(item => (
                  <div key={item} className="shimmer-block" style={{ borderRadius: '12px', height: '70px' }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const {
    progressPercent: xpProgressPercentage,
    xpRemaining: xpToNextLevel
  } = getLevelProgress(stats.xp)

  return (
    <div className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper" style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, marginBottom: '0.25rem' }}>🎯 Rewards Hub</h1>
        <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.95rem' }}>
          Collect daily login incentives, view unlocked levels, and trace game achievements.
        </p>
      </div>

      {/* Row 1: XP Progress, Streaks, Coins */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Level Progression */}
        <div className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', letterSpacing: '0.05em', margin: 0 }}>
            XP Progression
          </h2>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>Level {stats.level}</span>
              <span style={{ fontSize: '0.75rem', color: 'hsl(220 100% 70%)', fontWeight: 700 }}>{stats.xp} Total XP</span>
            </div>
            <div style={{ height: 8, background: 'hsl(220 20% 12%)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${xpProgressPercentage}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 65%), hsl(270 80% 65%))', borderRadius: 99 }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '0.35rem', textAlign: 'right' }}>
              {xpToNextLevel} XP to Level {stats.level + 1}
            </div>
          </div>
        </div>

        {/* Login Streak */}
        <div className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', letterSpacing: '0.05em', margin: 0 }}>
            Login Streak
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🔥</span>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(38 95% 60%)', lineHeight: 1.1 }}>
                {stats.streak} Days
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', margin: 0 }}>
                Play daily to grow your streak multiplier!
              </p>
            </div>
          </div>
        </div>

        {/* Coins Wallet */}
        <div className="card glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', letterSpacing: '0.05em', margin: 0 }}>
            Coins Balance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2.5rem' }}>🪙</span>
            <div>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'hsl(45 100% 55%)', lineHeight: 1.1 }}>
                {stats.coins} Coins
              </div>
              <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', margin: 0 }}>
                Earned from victories and achievements.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Daily Login Rewards Calendar */}
      <div className="card glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: 0 }}>🎁 Daily Login Calendar</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
            Get bonus coins and XP every calendar day you log in.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.6rem' }}>
          {DAILY_REWARD_TABLE.map((reward) => {
            const isClaimed = reward.day <= stats.rewardDay && !canClaimToday
            const isActive = canClaimToday && reward.day === ((stats.rewardDay % 7) + 1)
            
            return (
              <div
                key={reward.day}
                style={{
                  background: isClaimed
                    ? 'hsl(220 20% 12% / 0.5)'
                    : isActive
                    ? 'hsl(220 100% 65% / 0.08)'
                    : 'hsl(220 20% 8%)',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'hsl(220 100% 65% / 0.4)'
                    : isClaimed
                    ? 'hsl(220 20% 14%)'
                    : 'hsl(220 20% 16%)',
                  borderRadius: '12px',
                  padding: '1rem 0.5rem',
                  textAlign: 'center',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  alignItems: 'center',
                  opacity: isClaimed ? 0.6 : 1,
                  transform: isActive ? 'scale(1.05)' : 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 15px -3px hsl(220 100% 65% / 0.2)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isActive ? 'hsl(220 100% 65%)' : 'hsl(220 10% 50%)' }}>
                  DAY {reward.day}
                </div>
                <div style={{ fontSize: '1.5rem', margin: '0.1rem 0' }}>
                  {reward.day === 7 ? '👑' : isClaimed ? '📦' : '🎁'}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white' }}>
                  +{reward.coins}c
                </div>
                <div style={{ fontSize: '0.65rem', color: 'hsl(220 100% 65%)' }}>
                  +{reward.xp}xp
                </div>
                {isClaimed && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-0.25rem',
                      right: '-0.25rem',
                      background: 'hsl(142 70% 45%)',
                      color: 'white',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {canClaimToday ? (
          <button
            className="btn btn-primary btn-lg animate-pulse-glow"
            onClick={handleClaim}
            disabled={claiming}
            style={{ alignSelf: 'center', minWidth: 250, borderRadius: 12 }}
            id="rewards-claim-btn"
          >
            {claiming ? 'Claiming...' : '🎁 Claim Today\'s Reward'}
          </button>
        ) : (
          <div
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              background: 'hsl(220 20% 7%)',
              border: '1px solid hsl(220 20% 14%)',
              alignSelf: 'center',
              fontSize: '0.85rem',
              color: 'hsl(220 10% 55%)',
              display: 'flex',
              gap: '0.5rem',
            }}
          >
            <span>Next claim ready in:</span>
            <strong style={{ fontFamily: 'monospace', color: 'white' }}>{formatCountdown(countdown)}</strong>
          </div>
        )}
      </div>

      {/* Row 3: Upcoming Unlocks */}
      <div className="card glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: 0 }}>🔓 Upcoming Unlocks</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
            Reach level milestones to unlock badges, multipliers, and features.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {UPCOMING_UNLOCKS.map((unlock) => {
            const isUnlocked = stats.level >= unlock.level
            return (
              <div
                key={unlock.level}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  background: isUnlocked ? 'hsl(220 20% 12% / 0.3)' : 'hsl(220 20% 7%)',
                  border: '1px solid',
                  borderColor: isUnlocked ? 'hsl(220 100% 65% / 0.15)' : 'hsl(220 20% 14%)',
                  borderRadius: '12px',
                  opacity: isUnlocked ? 0.75 : 1,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: isUnlocked ? 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))' : 'hsl(220 20% 14%)',
                    color: isUnlocked ? 'white' : 'hsl(220 10% 40%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    flexShrink: 0,
                  }}
                >
                  {isUnlocked ? '✓' : `Lvl ${unlock.level}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isUnlocked ? 'hsl(220 15% 90%)' : 'hsl(220 10% 80%)' }}>
                    {unlock.reward}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'hsl(220 10% 55%)', marginTop: '0.1rem', lineHeight: 1.35 }}>
                    {unlock.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Row 4: Achievements List */}
      <div className="card glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: 0 }}>🎯 Badges & Achievements</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
            Earn extra coins and XP rewards by completing gameplay challenges.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {stats.achievementProgress.map((ach) => (
            <div
              key={ach.slug}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                background: ach.isUnlocked ? 'hsl(220 20% 12% / 0.4)' : 'hsl(220 20% 8%)',
                borderColor: ach.isUnlocked ? 'hsl(45 100% 55% / 0.15)' : 'hsl(220 20% 14%)',
                opacity: ach.isUnlocked ? 1 : 0.65,
                transition: 'opacity 0.2s',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: ach.isUnlocked ? 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 45%))' : 'hsl(220 20% 14%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem',
                  flexShrink: 0,
                  boxShadow: ach.isUnlocked ? '0 4px 10px hsl(45 100% 55% / 0.2)' : 'none',
                }}
              >
                {ach.isUnlocked ? '🏅' : '🔒'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: ach.isUnlocked ? 'hsl(45 100% 65%)' : 'hsl(220 10% 80%)' }}>
                  {ach.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'hsl(220 10% 55%)', margin: '0.15rem 0 0.5rem 0', lineHeight: 1.35 }}>
                  {ach.description}
                </div>

                {!ach.isUnlocked && ach.target > 1 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginBottom: '0.15rem' }}>
                      <span>Progress</span>
                      <span>{ach.current} / {ach.target}</span>
                    </div>
                    <div style={{ height: 4, background: 'hsl(220 20% 16%)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${ach.progressPercentage}%`, height: '100%', background: 'hsl(38 95% 60%)', borderRadius: 99 }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-gold" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                    +{ach.xpReward} XP
                  </span>
                  {ach.coinReward > 0 && (
                    <span className="badge badge-blue" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                      +{ach.coinReward} Coins
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!user && (
          <p style={{ fontSize: '0.75rem', color: 'hsl(0 80% 60%)', textAlign: 'center', margin: '0.5rem 0' }}>
            ⚠️ Guest achievements progress is not tracked. Create an account to unlock badges permanently!
          </p>
        )}
      </div>

      {/* Row 5: Owned Chat Packs */}
      <div className="card glass" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', margin: 0 }}>💬 Owned Chat Packs</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
            Browse your unlocked and purchased chat packs. Preview phrases to use during in-game chat.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {stats.ownedChatPacks.map((pack) => (
            <div
              key={pack.id}
              className="card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                background: 'hsl(220 20% 8%)',
                borderColor: 'hsl(220 20% 14%)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white' }}>{pack.name}</span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '99px',
                    background: 'hsl(220 20% 16%)',
                    color: pack.category === 'LEGENDARY' ? 'hsl(45 100% 60%)' : pack.category === 'EPIC' ? 'hsl(270 80% 70%)' : 'hsl(220 10% 60%)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {pack.category}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>
                Source: <strong>{pack.source}</strong>
              </div>
              <div style={{ borderTop: '1px solid hsl(220 15% 15%)', paddingTop: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>Preview Phrases:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {pack.messages.map((msg: string, i: number) => (
                    <div key={i} style={{ fontSize: '0.75rem', color: 'hsl(220 10% 75%)', padding: '0.25rem 0.45rem', background: 'hsl(220 20% 6%)', borderRadius: 6 }}>
                      {msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {stats.ownedChatPacks.length === 0 && (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '2rem 1rem', color: 'hsl(220 10% 45%)', fontSize: '0.82rem', border: '1px dashed hsl(220 15% 16%)', borderRadius: 12 }}>
              No chat packs owned yet. Visit the <a href="/dashboard/store" style={{ color: 'hsl(220 100% 70%)', textDecoration: 'none' }} className="hover-underline">Store</a> to buy some using Coins!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
