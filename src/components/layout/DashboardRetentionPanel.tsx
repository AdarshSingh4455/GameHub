'use client'

import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { AchievementProgressInfo } from '@/lib/achievements'
import { DAILY_REWARD_TABLE, getUtcDaysElapsed } from '@/lib/dailyRewards'
import DailyRewardModal from './DailyRewardModal'
import { getLevelProgress } from '@/lib/xpUtils'
import { Flame, Star, Award, Target, Trophy, Gift, Archive, Crown } from 'lucide-react'



interface Props {
  user: User | null
}

interface ProfileStats {
  level: number
  xp: number
  coins: number
  streak: number
  rewardDay: number
  lastClaim: string | null
  achievementProgress: AchievementProgressInfo[]
}

const GUEST_XP_KEY = 'gamehub_guest_xp'
const GUEST_COINS_KEY = 'gamehub_guest_coins'
const GUEST_STREAK_KEY = 'gamehub_guest_streak'
const GUEST_REWARD_DAY_KEY = 'gamehub_guest_reward_day'
const GUEST_LAST_CLAIM_KEY = 'gamehub_guest_last_claim'

function getBlockProgressBar(percent: number, size: number = 10): string {
  const filledCount = Math.round((percent / 100) * size)
  const emptyCount = size - filledCount
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount) + ` ${percent}%`
}

export default function DashboardRetentionPanel({ user }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [canClaimToday, setCanClaimToday] = useState(true)


  const loadData = () => {
    if (user) {
      setLoading(true)
      fetch('/api/profile/details')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          setStats({
            level: data.profile.level,
            xp: data.profile.xp,
            coins: data.profile.coins,
            streak: data.profile.currentStreak,
            rewardDay: data.profile.dailyRewardDay,
            lastClaim: data.profile.lastDailyRewardClaim,
            achievementProgress: data.achievementProgress || [],
          })

          // Calculate UTC claim availability
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
      const xp = parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10)
      const level = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      const coins = parseInt(localStorage.getItem(GUEST_COINS_KEY) || '0', 10)
      const streak = parseInt(localStorage.getItem(GUEST_STREAK_KEY) || '0', 10)
      const rewardDay = parseInt(localStorage.getItem(GUEST_REWARD_DAY_KEY) || '1', 10)
      const lastClaim = localStorage.getItem(GUEST_LAST_CLAIM_KEY)

      setStats({
        level,
        xp,
        coins,
        streak,
        rewardDay,
        lastClaim,
        achievementProgress: [], // simulated progress not required for guest home view
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

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (loading && !stats) {
    return <div style={{ color: 'hsl(220 10% 50%)', padding: '1rem 0' }}>Loading panel...</div>
  }

  if (!stats) return null

  // XP progression bounds
  const {
    progressPercent: xpProgressPercentage,
    xpRemaining: xpToNextLevel
  } = getLevelProgress(stats.xp)

  // Closest achievements progress calculations
  const lockedAchievements = stats.achievementProgress
    .filter((a) => !a.isUnlocked)
    .sort((a, b) => b.progressPercentage - a.progressPercentage)

  const nearCompletionCount = lockedAchievements.filter((a) => a.progressPercentage >= 50).length
  const topLockedAchievements = lockedAchievements.slice(0, 2)


  return (
    <div className="retention-panel-container">
      {/* Widget 1: Retention & XP Summary Card */}
      <div
        className="card"
        style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, hsl(220 20% 11%), hsl(220 20% 8%))',
          border: '1px solid hsl(220 20% 16%)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1.25rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700, letterSpacing: '0.05em' }}>
            Retention Summary
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
            <Flame size={40} style={{ color: 'hsl(38 95% 60%)' }} />
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 850, color: 'hsl(38 95% 60%)', lineHeight: 1.1 }}>
                {stats.streak} Days
              </div>
              <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginTop: '0.15rem' }}>
                Consecutive logins streak
              </div>
            </div>
          </div>
        </div>

        {/* Level bar progress */}
        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid hsl(220 20% 14%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '0.75rem', color: 'hsl(220 10% 60%)', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 600, color: 'hsl(220 15% 90%)' }}>Level {stats.level}</span>
            <span style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Star size={10} style={{ color: 'hsl(45 100% 60%)' }} /> {stats.xp} XP</span>
          </div>
          {/* Block Progress Bar */}
          <div style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: 'hsl(220 100% 70%)', letterSpacing: '0.04em', margin: '0.25rem 0' }}>
            {getBlockProgressBar(xpProgressPercentage)}
          </div>
          <div style={{ height: '8px', background: 'hsl(220 20% 16%)', borderRadius: '99px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${xpProgressPercentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, hsl(220 100% 65%), hsl(270 80% 65%))',
                borderRadius: '99px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'hsl(220 10% 50%)', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{xpToNextLevel} XP to Lv {stats.level + 1}</span>
            <span>Lv {stats.level + 1}</span>
          </div>
          {/* Reward Preview */}
          <div style={{ marginTop: '0.55rem', fontSize: '0.68rem', color: 'hsl(220 10% 55%)', background: 'hsl(220 20% 8% / 0.8)', padding: '0.45rem 0.65rem', borderRadius: '8px', border: '1px dashed hsl(220 20% 14%)' }}>
            <strong style={{ color: 'hsl(270 80% 65%)' }}>Next Level Unlocks:</strong>
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.15rem', color: 'hsl(220 10% 65%)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Award size={10} /> Coins</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Award size={10} /> Badge</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Target size={10} /> Progress</span>
            </div>
          </div>
        </div>

        {/* Near completion flag */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'hsl(38 95% 60%)', background: 'hsl(38 95% 60% / 0.08)', border: '1px solid hsl(38 95% 60% / 0.15)', padding: '0.5rem 0.75rem', borderRadius: '10px' }}>
            <Target size={14} />
            <span>
              <strong>{nearCompletionCount}</strong> achievements near completion
            </span>
          </div>
        )}
      </div>

      {/* Widget 2: Daily Reward Card */}
      <div
        className="card"
        style={{
          padding: '1.5rem',
          background: 'hsl(220 20% 10% / 0.8)',
          border: '1px solid hsl(220 20% 16%)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700, letterSpacing: '0.05em' }}>
            Daily Calendar
          </h3>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: canClaimToday ? 'hsl(220 100% 65%)' : 'hsl(142 70% 55%)' }}>
            {canClaimToday ? 'Claim Ready' : 'Claimed'}
          </span>
        </div>

        {/* Inline Day Grid Mock */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
          {DAILY_REWARD_TABLE.map((reward) => {
            const isClaimed = reward.day <= stats.rewardDay && !canClaimToday
            const isActive = canClaimToday && reward.day === stats.rewardDay
            
            return (
              <div
                key={reward.day}
                style={{
                  background: isClaimed
                    ? 'hsl(220 20% 12% / 0.4)'
                    : isActive
                    ? 'hsl(220 100% 65% / 0.08)'
                    : 'hsl(220 20% 8%)',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'hsl(220 100% 65% / 0.3)'
                    : 'hsl(220 20% 14%)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.1rem',
                  textAlign: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  opacity: isClaimed ? 0.5 : 1,
                  color: isActive ? 'hsl(220 100% 70%)' : 'hsl(220 10% 60%)',
                }}
              >
                D{reward.day}
                <div style={{ fontSize: '0.7rem', marginTop: '0.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {reward.day === 7 ? (
                    <Crown size={12} style={{ color: 'hsl(45 100% 60%)' }} />
                  ) : isClaimed ? (
                    <Archive size={12} style={{ color: 'hsl(220 10% 50%)' }} />
                  ) : (
                    <Gift size={12} style={{ color: 'hsl(270 80% 65%)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {canClaimToday ? (
          <button
            className="btn btn-primary"
            onClick={() => setModalOpen(true)}
            style={{ width: '100%', borderRadius: '10px', padding: '0.5rem' }}
            id="dashboard-claim-cta"
          >
            <Gift size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Claim Daily Reward
          </button>
        ) : (
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '10px',
              background: 'hsl(220 20% 8%)',
              border: '1px solid hsl(220 20% 14%)',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: 'hsl(220 10% 50%)',
            }}
          >
            Next claim in: <strong style={{ fontFamily: 'monospace', color: 'hsl(220 15% 90%)' }}>{formatCountdown(countdown)}</strong>
          </div>
        )}
      </div>

      {/* Widget 3: Milestone Targets & Unlocks (Auth user only) */}
      {user && (
        <div
          className="card"
          style={{
            padding: '1.5rem',
            background: 'hsl(220 20% 10% / 0.8)',
            border: '1px solid hsl(220 20% 16%)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: 'hsl(220 10% 50%)', fontWeight: 700, letterSpacing: '0.05em' }}>
            Closest Milestones
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {topLockedAchievements.length > 0 ? (
              topLockedAchievements.map((ach) => (
                <div key={ach.slug}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.15rem' }}>
                    <span style={{ fontWeight: 600, color: 'hsl(220 15% 90%)' }}>{ach.name}</span>
                    <span style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)' }}>{ach.current} / {ach.target}</span>
                  </div>
                  <div style={{ height: '5px', background: 'hsl(220 20% 16%)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${ach.progressPercentage}%`,
                        height: '100%',
                        background: 'hsl(38 95% 60%)',
                        borderRadius: '99px',
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                All achievements unlocked! <Trophy size={12} style={{ color: 'hsl(45 100% 60%)' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Daily Reward Modal Popup */}
      <DailyRewardModal
        user={user}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onClaimSuccess={loadData}
      />
    </div>
  )
}
