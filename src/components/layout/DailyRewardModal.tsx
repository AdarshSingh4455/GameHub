'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'

interface Props {
  user: unknown // supabase user
  isOpen: boolean
  onClose: () => void
  onClaimSuccess: () => void
}

interface DailyClaimInfo {
  canClaim: boolean
  currentStreak: number
  dailyRewardDay: number
  nextClaimDay: number
  secondsRemaining: number
  rewardTable: { day: number; coins: number; xp: number; badge?: string }[]
}

const GUEST_XP_KEY = 'gamehub_guest_xp'
const GUEST_COINS_KEY = 'gamehub_guest_coins'
const GUEST_STREAK_KEY = 'gamehub_guest_streak'
const GUEST_REWARD_DAY_KEY = 'gamehub_guest_reward_day'
const GUEST_LAST_CLAIM_KEY = 'gamehub_guest_last_claim'

export default function DailyRewardModal({ user, isOpen, onClose, onClaimSuccess }: Props) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [claimData, setClaimData] = useState<DailyClaimInfo | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [claimedReward, setClaimedReward] = useState<{ coins: number; xp: number } | null>(null)

  // Fetch claim info on open
  useEffect(() => {
    if (!isOpen) return

    setClaimedReward(null)
    if (user) {
      setLoading(true)
      fetch('/api/profile/daily-claim')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          setClaimData(data)
          setCountdown(data.secondsRemaining)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else {
      // Guest local claim info calculation
      const lastClaimStr = localStorage.getItem(GUEST_LAST_CLAIM_KEY)
      const currentStreak = parseInt(localStorage.getItem(GUEST_STREAK_KEY) || '0', 10)
      const dailyRewardDay = parseInt(localStorage.getItem(GUEST_REWARD_DAY_KEY) || '1', 10)

      const rewardTable = [
        { day: 1, coins: 10,  xp: 50 },
        { day: 2, coins: 20,  xp: 75 },
        { day: 3, coins: 30,  xp: 100 },
        { day: 4, coins: 40,  xp: 125 },
        { day: 5, coins: 50,  xp: 150 },
        { day: 6, coins: 60,  xp: 200 },
        { day: 7, coins: 100, xp: 300, badge: 'Weekly Warrior' },
      ]

      let canClaim = true
      let nextClaimDay = dailyRewardDay
      let secondsRemaining = 0

      if (lastClaimStr) {
        const lastClaimDate = new Date(lastClaimStr)
        const now = new Date()

        // Strict UTC day calculation
        const utc1 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
        const utc2 = Date.UTC(lastClaimDate.getUTCFullYear(), lastClaimDate.getUTCMonth(), lastClaimDate.getUTCDate())
        const daysDiff = Math.floor((utc1 - utc2) / 86400000)

        if (daysDiff === 0) {
          canClaim = false
          const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
          secondsRemaining = Math.max(0, Math.ceil((nextUtcMidnight.getTime() - now.getTime()) / 1000))
        } else if (daysDiff > 1) {
          nextClaimDay = 1
        } else {
          nextClaimDay = (dailyRewardDay % rewardTable.length) + 1
        }
      } else {
        nextClaimDay = 1
      }

      setClaimData({
        canClaim,
        currentStreak,
        dailyRewardDay,
        nextClaimDay,
        secondsRemaining,
        rewardTable,
      })
      setCountdown(secondsRemaining)
    }
  }, [user, isOpen])

  // Countdown timer interval
  useEffect(() => {
    if (countdown <= 0) return
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval)
          // Refetch claim data
          if (claimData) setClaimData({ ...claimData, canClaim: true })
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [countdown, claimData])

  const handleClaim = async () => {
    if (!claimData || !claimData.canClaim || loading) return

    setLoading(true)

    if (user) {
      try {
        const res = await fetch('/api/profile/daily-claim', { method: 'POST' })
        if (!res.ok) throw new Error()
        const data = await res.json()

        setClaimedReward({ coins: data.coinsGained, xp: data.xpGained })
        addToast('daily_reward_claimed', 'Reward Claimed! 🎁', `Claimed Day ${data.dayClaimed} reward: +${data.coinsGained} Coins and +${data.xpGained} XP!`)

        if (data.unlockedAchievements?.length > 0) {
          data.unlockedAchievements.forEach((ach: { name: string; description: string }) => {
            addToast('achievement_unlocked', 'Achievement Unlocked! 🏆', `${ach.name}: ${ach.description}`)
          })
        }

        if (data.leveledUp) {
          addToast('level_up', 'Level Up! ⭐', `Congratulations! You reached Level ${data.newLevel}!`)
        }

        onClaimSuccess()
        setClaimData({
          ...claimData,
          canClaim: false,
          currentStreak: data.streak,
          dailyRewardDay: data.dayClaimed,
        })
        setCountdown(86400) // generic 24 hour buffer while refresh
      } catch (err) {
        console.error('Error claiming reward:', err)
      } finally {
        setLoading(false)
      }
    } else {
      // Simulate guest claim locally
      const table = claimData.rewardTable
      const currentStreak = claimData.currentStreak
      const nextDay = claimData.nextClaimDay
      const rewardConfig = table.find((r) => r.day === nextDay) || table[0]

      const oldXP = parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10)
      const oldCoins = parseInt(localStorage.getItem(GUEST_COINS_KEY) || '0', 10)

      const finalXP = oldXP + rewardConfig.xp
      const finalCoins = oldCoins + rewardConfig.coins
      const finalStreak = currentStreak + 1

      localStorage.setItem(GUEST_XP_KEY, finalXP.toString())
      localStorage.setItem(GUEST_COINS_KEY, finalCoins.toString())
      localStorage.setItem(GUEST_STREAK_KEY, finalStreak.toString())
      localStorage.setItem(GUEST_REWARD_DAY_KEY, nextDay.toString())
      localStorage.setItem(GUEST_LAST_CLAIM_KEY, new Date().toISOString())

      // Dispatch XP event for dashboard nav updater
      window.dispatchEvent(new Event('gamehub_xp_update'))

      setClaimedReward({ coins: rewardConfig.coins, xp: rewardConfig.xp })
      addToast('daily_reward_claimed', 'Reward Claimed! 🎁', `[GUEST] Claimed Day ${nextDay} reward: +${rewardConfig.coins} Coins and +${rewardConfig.xp} XP!`)

      onClaimSuccess()
      setClaimData({
        ...claimData,
        canClaim: false,
        currentStreak: finalStreak,
        dailyRewardDay: nextDay,
      })
      setCountdown(86400)
      setLoading(false)
    }
  }

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card animate-slideUp"
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'hsl(220 20% 10% / 0.95)',
          border: '1px solid hsl(220 20% 16%)',
          borderRadius: '24px',
          padding: '2rem',
          position: 'relative',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'hsl(220 10% 50%)',
            fontSize: '1.25rem',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎁</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(220 15% 92%)', margin: 0 }}>
            Daily Login Rewards
          </h2>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Claim daily gifts to build your login streak!
          </p>
        </div>

        {loading && !claimData ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>
            Loading reward calendar...
          </div>
        ) : claimData ? (
          <>
            {/* 7 Day Calendar Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(65px, 1fr))',
                gap: '0.5rem',
                marginBottom: '2rem',
              }}
            >
              {claimData.rewardTable.map((reward) => {
                const isClaimed = reward.day <= claimData.dailyRewardDay && !claimData.canClaim
                const isActive = claimData.canClaim && reward.day === claimData.nextClaimDay
                
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
                      padding: '0.75rem 0.5rem',
                      textAlign: 'center',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      alignItems: 'center',
                      opacity: isClaimed ? 0.6 : 1,
                      transform: isActive ? 'scale(1.05)' : 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 0 15px -3px hsl(220 100% 65% / 0.2)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isActive ? 'hsl(220 100% 65%)' : 'hsl(220 10% 50%)' }}>
                      DAY {reward.day}
                    </div>
                    <div style={{ fontSize: '1.25rem', margin: '0.1rem 0' }}>
                      {reward.day === 7 ? '👑' : isClaimed ? '📦' : '🎁'}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(220 15% 90%)' }}>
                      +{reward.coins}c
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'hsl(220 100% 65%)' }}>
                      +{reward.xp}xp
                    </div>
                    {isClaimed && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-0.25rem',
                          right: '-0.25rem',
                          background: 'hsl(142 70% 50%)',
                          color: 'white',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.5rem',
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

            {/* Streak & Claim CTA Block */}
            <div
              style={{
                background: 'hsl(220 20% 7%)',
                border: '1px solid hsl(220 20% 14%)',
                borderRadius: '16px',
                padding: '1.25rem',
                textAlign: 'center',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Active Streak
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'hsl(38 95% 60%)', marginTop: '0.2rem' }}>
                    🔥 {claimData.currentStreak} Days
                  </div>
                </div>
                <div style={{ width: '1px', background: 'hsl(220 20% 16%)' }} />
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Status
                  </div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: claimData.canClaim ? 'hsl(220 100% 65%)' : 'hsl(142 70% 55%)',
                      marginTop: '0.5rem',
                    }}
                  >
                    {claimData.canClaim ? '🎁 Ready to Claim!' : '✅ Claimed Today'}
                  </div>
                </div>
              </div>

              {claimedReward ? (
                <div className="animate-slideUp" style={{ padding: '0.5rem 0', color: 'hsl(142 70% 55%)', fontWeight: 700, fontSize: '0.95rem' }}>
                  🎉 Gained +{claimedReward.coins} Coins and +{claimedReward.xp} XP!
                </div>
              ) : claimData.canClaim ? (
                <button
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', borderRadius: '12px' }}
                  onClick={handleClaim}
                  disabled={loading}
                >
                  {loading ? 'Claiming...' : '🎁 Claim Today\'s Reward'}
                </button>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'hsl(220 10% 50%)' }}>
                  Next claim available in:{' '}
                  <strong style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'hsl(220 15% 90%)' }}>
                    {formatCountdown(countdown)}
                  </strong>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
