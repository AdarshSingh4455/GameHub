'use client'

import React, { useState, useEffect } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getStoredDailyChallenges, DailyChallenge } from '@/lib/dailyChallenges'

interface EnrichedChallenge {
  id: string
  title: string
  description: string
  type: 'DAILY' | 'WEEKLY'
  target: number
  current: number
  completed: boolean
  claimed: boolean
  xpReward: number
  coinReward: number
}

export default function ChallengesPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<'DAILY' | 'WEEKLY' | 'COMPLETED'>('DAILY')
  const [challenges, setChallenges] = useState<EnrichedChallenge[]>([])
  const [streak, setStreak] = useState<number>(0)
  const [coins, setCoins] = useState<number>(0)
  const [xp, setXp] = useState<number>(0)
  const [level, setLevel] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const fetchUserData = () => {
    if (user) {
      fetch('/api/profile/details')
        .then(res => res.json())
        .then(data => {
          if (data.profile) {
            setStreak(data.profile.currentStreak || 0)
            setCoins(data.profile.coins || 0)
            setXp(data.profile.xp || 0)
            setLevel(data.profile.level || 1)
          }
        })
        .catch(console.error)
    } else {
      const guestXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const guestCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      const guestLvl = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      setStreak(3) // mock streak for guest
      setCoins(guestCoins)
      setXp(guestXP)
      setLevel(guestLvl)
    }
  }

  const fetchChallenges = () => {
    setLoading(true)
    if (user) {
      fetch('/api/challenges')
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Failed to fetch')
        })
        .then(data => {
          setChallenges(data.challenges || [])
          setLoading(false)
        })
        .catch(() => {
          addToast('error', 'Error', 'Failed to load challenges from server.')
          setLoading(false)
        })
    } else {
      // Guest mode: load standard local daily challenges
      const localDailies = getStoredDailyChallenges()
      // Enrich into our format
      const enriched: EnrichedChallenge[] = localDailies.map(c => {
        // Retrieve if claimed locally
        const claimedList = JSON.parse(localStorage.getItem('gamehub_guest_claimed_challenges') || '[]')
        return {
          id: c.id,
          title: c.text,
          description: c.text,
          type: 'DAILY',
          target: c.target,
          current: c.current,
          completed: c.completed,
          claimed: claimedList.includes(c.id),
          xpReward: c.xpReward,
          coinReward: c.coinReward
        }
      })
      setChallenges(enriched)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserData()
    fetchChallenges()

    const handleUpdate = () => {
      fetchUserData()
      fetchChallenges()
    }
    window.addEventListener('gamehub_xp_update', handleUpdate)
    return () => window.removeEventListener('gamehub_xp_update', handleUpdate)
  }, [user])

  const handleClaim = async (challengeId: string) => {
    const ch = challenges.find(c => c.id === challengeId)
    if (!ch) return

    setClaimingId(challengeId)

    if (user) {
      try {
        const res = await fetch('/api/challenges/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId })
        })
        const data = await res.json()
        if (res.ok && data.success) {
          addToast(
            'achievement_unlocked',
            'Challenge Claimed! 🎯',
            `Earned +${ch.xpReward} XP and +${ch.coinReward} Coins!`
          )
          window.dispatchEvent(new Event('gamehub_xp_update'))
        } else {
          addToast('error', 'Claim Failed', data.error || 'Failed to claim reward.')
        }
      } catch (err) {
        addToast('error', 'Error', 'Something went wrong claiming reward.')
      } finally {
        setClaimingId(null)
      }
    } else {
      // Guest local storage claim
      const claimedList = JSON.parse(localStorage.getItem('gamehub_guest_claimed_challenges') || '[]')
      if (claimedList.includes(challengeId)) {
        addToast('error', 'Already Claimed', 'You have already claimed this reward.')
        setClaimingId(null)
        return
      }

      claimedList.push(challengeId)
      localStorage.setItem('gamehub_guest_claimed_challenges', JSON.stringify(claimedList))

      const curXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const curCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      localStorage.setItem('gamehub_guest_xp', (curXP + ch.xpReward).toString())
      localStorage.setItem('gamehub_guest_coins', (curCoins + ch.coinReward).toString())

      const newLvl = Math.floor(Math.sqrt((curXP + ch.xpReward) / 100)) + 1
      const oldLvl = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      if (newLvl > oldLvl) {
        localStorage.setItem('gamehub_guest_level', newLvl.toString())
        addToast('level_up', 'Level Up! ⭐', `Congratulations! You reached Level ${newLvl}!`)
      }

      addToast(
        'achievement_unlocked',
        'Challenge Claimed! 🎯',
        `Earned +${ch.xpReward} XP and +${ch.coinReward} Coins!`
      )
      window.dispatchEvent(new Event('gamehub_xp_update'))
      setClaimingId(null)
    }
  }

  // Filter challenges based on tab
  const filteredChallenges = challenges.filter(ch => {
    if (activeTab === 'COMPLETED') {
      return ch.claimed
    } else {
      return ch.type === activeTab && !ch.claimed
    }
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header Panel */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-slate-900/80 border border-indigo-500/20 p-6 md:p-8 mb-8 backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-indigo-200 to-cyan-300 bg-clip-text text-transparent mb-2">
              ⚡ Challenges Hub
            </h1>
            <p className="text-slate-400 max-w-xl text-sm md:text-base">
              Complete tasks daily and weekly to earn XP, Coins, and level up your Profile!
            </p>
          </div>

          {/* User Profile Stats Bar */}
          <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 self-start md:self-auto backdrop-blur-md">
            <div className="text-center px-2">
              <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Level</span>
              <span className="text-xl font-extrabold text-cyan-400">{level}</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center px-2">
              <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Coins</span>
              <span className="text-xl font-extrabold text-amber-400">🪙 {coins}</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-800" />
            <div className="text-center px-2">
              <span className="block text-xs text-slate-500 font-bold uppercase tracking-wider">Streak</span>
              <span className="text-xl font-extrabold text-orange-400">🔥 {streak} Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-800/60 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('DAILY')}
          className={`px-5 py-3 font-semibold text-sm transition-all duration-300 relative ${
            activeTab === 'DAILY'
              ? 'text-violet-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📅 Daily Challenges
          {activeTab === 'DAILY' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('WEEKLY')}
          className={`px-5 py-3 font-semibold text-sm transition-all duration-300 relative ${
            activeTab === 'WEEKLY'
              ? 'text-violet-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚔️ Weekly Challenges
          {activeTab === 'WEEKLY' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`px-5 py-3 font-semibold text-sm transition-all duration-300 relative ${
            activeTab === 'COMPLETED'
              ? 'text-violet-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ✅ Claimed
          {activeTab === 'COMPLETED' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500" />
          )}
        </button>
      </div>

      {/* Challenges List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-44 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 animate-pulse flex flex-col justify-between">
              <div>
                <div className="h-5 bg-slate-800 rounded w-2/3 mb-3" />
                <div className="h-3 bg-slate-800 rounded w-1/2" />
              </div>
              <div className="flex justify-between items-end">
                <div className="w-1/3">
                  <div className="h-2 bg-slate-800 rounded w-full mb-2" />
                  <div className="h-3 bg-slate-800 rounded w-1/2" />
                </div>
                <div className="w-24 h-9 bg-slate-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/10 border border-dashed border-slate-800/60 rounded-2xl">
          <span className="text-5xl mb-4 block">🏆</span>
          <h3 className="text-lg font-bold text-slate-300">No challenges here</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto mt-1">
            {activeTab === 'COMPLETED'
              ? "You haven't claimed any challenges yet. Get playing!"
              : 'Check back later or play other games to trigger new progress.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredChallenges.map(ch => {
            const pct = Math.min(100, Math.floor((ch.current / ch.target) * 100))
            const isCompleted = ch.completed && !ch.claimed

            return (
              <div
                key={ch.id}
                className={`relative overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-sm ${
                  isCompleted
                    ? 'bg-violet-950/20 border-violet-500/40 shadow-lg shadow-violet-500/5'
                    : 'bg-slate-900/30 border-slate-800/80 hover:border-slate-700/80'
                } p-6 flex flex-col justify-between gap-6`}
              >
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-base md:text-lg text-slate-100 flex items-center gap-2">
                      {ch.title}
                    </h3>
                    <span className="flex items-center gap-2 text-xs font-semibold bg-slate-800/80 border border-slate-700/50 rounded-full px-3 py-1">
                      <span className="text-amber-400">🪙 {ch.coinReward}</span>
                      <span className="text-violet-400">⚡ {ch.xpReward} XP</span>
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs md:text-sm mt-1">
                    {ch.description}
                  </p>
                </div>

                <div>
                  {/* Progress Indicator */}
                  <div className="flex justify-between items-center text-xs text-slate-500 font-bold mb-2">
                    <span>PROGRESS</span>
                    <span className={ch.completed ? 'text-green-400' : 'text-slate-400'}>
                      {ch.current} / {ch.target} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/40">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        ch.completed
                          ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex justify-end mt-2">
                  {ch.claimed ? (
                    <button
                      disabled
                      className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 flex items-center gap-2"
                    >
                      ✓ Claimed
                    </button>
                  ) : ch.completed ? (
                    <button
                      onClick={() => handleClaim(ch.id)}
                      disabled={claimingId === ch.id}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 transition-all duration-300 transform hover:scale-[1.02] shadow-md shadow-violet-500/20 flex items-center gap-2"
                    >
                      {claimingId === ch.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        '🎁 Claim Reward'
                      )}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-800/40 border border-slate-700/20 text-slate-500"
                    >
                      🔒 In Progress
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
