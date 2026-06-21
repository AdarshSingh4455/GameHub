'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
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

interface HistoryItem {
  id: string
  challengeId: string
  claimedAt: string
  title: string
  xpReward: number
  coinReward: number
}

export default function ChallengesPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [activeTab, setActiveTab] = useState<'DAILY' | 'WEEKLY' | 'COMPLETED' | 'HISTORY'>('DAILY')
  const [challenges, setChallenges] = useState<EnrichedChallenge[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [streak, setStreak] = useState<number>(0)
  const [coins, setCoins] = useState<number>(0)
  const [xp, setXp] = useState<number>(0)
  const [level, setLevel] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)

  const fetchUserData = useCallback(() => {
    if (user) {
      fetch('/api/profile/details')
        .then((res) => res.json())
        .then((data) => {
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
      setStreak(3) // mock streak
      setCoins(guestCoins)
      setXp(guestXP)
      setLevel(guestLvl)
    }
  }, [user])

  const fetchChallengesAndHistory = useCallback(() => {
    setLoading(true)
    if (user) {
      fetch('/api/challenges')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error('Failed to fetch')
        })
        .then((data) => {
          const serverChallenges: EnrichedChallenge[] = data.challenges || []
          const serverHistory: HistoryItem[] = data.history || []

          // Load local daily challenges too
          const localDailies = getStoredDailyChallenges()
          const claimedIds = new Set(serverChallenges.filter(c => c.claimed).map(c => c.id).concat(serverHistory.map(h => h.challengeId)))

          const enrichedLocalDailies: EnrichedChallenge[] = localDailies.map((c) => {
            const completed = c.current >= c.target
            const claimed = claimedIds.has(c.id) || c.completed // local ones auto-claim
            return {
              id: c.id,
              title: c.text,
              description: `Play and clear: ${c.text}`,
              type: 'DAILY',
              target: c.target,
              current: c.current,
              completed: completed || claimed,
              claimed: claimed,
              xpReward: c.xpReward,
              coinReward: c.coinReward,
            }
          })

          // Merge lists, avoiding duplicates
          const mergedChallenges = [...serverChallenges]
          for (const local of enrichedLocalDailies) {
            if (!mergedChallenges.some((c) => c.id === local.id)) {
              mergedChallenges.push(local)
            }
          }

          // Build synthetic history for completed local dailies
          const syntheticHistory: HistoryItem[] = enrichedLocalDailies
            .filter((c) => c.claimed)
            .map((c, idx) => ({
              id: `local-history-${idx}-${c.id}`,
              challengeId: c.id,
              claimedAt: new Date().toISOString(), // approximate
              title: c.title,
              xpReward: c.xpReward,
              coinReward: c.coinReward,
            }))

          const mergedHistory = [...serverHistory]
          for (const sh of syntheticHistory) {
            if (!mergedHistory.some((h) => h.challengeId === sh.challengeId)) {
              mergedHistory.unshift(sh)
            }
          }

          setChallenges(mergedChallenges)
          setHistory(mergedHistory)
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          addToast('error', 'Error', 'Failed to load challenges from server.')
          setLoading(false)
        })
    } else {
      // Guest mode: load standard local daily challenges
      const localDailies = getStoredDailyChallenges()
      const claimedList = JSON.parse(localStorage.getItem('gamehub_guest_claimed_challenges') || '[]') as string[]

      const enriched: EnrichedChallenge[] = localDailies.map((c) => {
        const completed = c.current >= c.target
        const claimed = claimedList.includes(c.id)
        return {
          id: c.id,
          title: c.text,
          description: `Play and clear: ${c.text}`,
          type: 'DAILY',
          target: c.target,
          current: c.current,
          completed: completed || claimed,
          claimed: claimed,
          xpReward: c.xpReward,
          coinReward: c.coinReward,
        }
      })

      const syntheticHistory: HistoryItem[] = enriched
        .filter((c) => c.claimed)
        .map((c, idx) => ({
          id: `guest-history-${idx}-${c.id}`,
          challengeId: c.id,
          claimedAt: new Date().toISOString(),
          title: c.title,
          xpReward: c.xpReward,
          coinReward: c.coinReward,
        }))

      setChallenges(enriched)
      setHistory(syntheticHistory)
      setLoading(false)
    }
  }, [user, addToast])

  useEffect(() => {
    fetchUserData()
    fetchChallengesAndHistory()

    const handleUpdate = () => {
      fetchUserData()
      fetchChallengesAndHistory()
    }
    window.addEventListener('gamehub_xp_update', handleUpdate)
    return () => window.removeEventListener('gamehub_xp_update', handleUpdate)
  }, [user, fetchUserData, fetchChallengesAndHistory])

  const handleClaim = async (challengeId: string) => {
    const ch = challenges.find((c) => c.id === challengeId)
    if (!ch) return

    setClaimingId(challengeId)

    if (user) {
      try {
        const res = await fetch('/api/challenges/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId }),
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
      const claimedList = JSON.parse(localStorage.getItem('gamehub_guest_claimed_challenges') || '[]') as string[]
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

  // Filter challenges based on active tab
  const filteredChallenges = useMemo(() => {
    if (activeTab === 'COMPLETED') {
      return challenges.filter((ch) => ch.completed || ch.claimed)
    } else {
      return challenges.filter((ch) => ch.type === activeTab && !ch.claimed)
    }
  }, [challenges, activeTab])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }} className="animate-fadeIn">
      {/* Header Panel */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-900/20 via-indigo-900/10 to-slate-900/80 border border-indigo-500/10 p-6 md:p-8 mb-8 backdrop-blur-xl">
        <div style={{ position: 'absolute', top: 0, right: 0, width: '160px', height: '160px', background: 'hsl(270 80% 60% / 0.05)', borderRadius: '999px', filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '160px', height: '160px', background: 'hsl(220 100% 60% / 0.05)', borderRadius: '999px', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'flex-start' }} className="md:flex-row md:items-center">
          <div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, marginBottom: '0.4rem', color: 'white', letterSpacing: '-0.02em' }}>
              ⚡ Challenges Hub
            </h1>
            <p style={{ color: 'hsl(220 10% 55%)', maxWidth: '500px', fontSize: '0.875rem', margin: 0, lineHeight: 1.4 }}>
              Complete tasks daily and weekly to earn XP, Coins, and level up your Profile! This is your single source of truth for all challenges.
            </p>
          </div>

          {/* User Profile Stats Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '0.75rem 1.25rem' }}>
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Level</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(220 100% 70%)' }}>{level}</span>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Coins</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(45 100% 60%)' }}>🪙 {coins}</span>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 800, textTransform: 'uppercase' }}>Streak</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'hsl(20 90% 60%)' }}>🔥 {streak}d</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu - swipeable on mobile */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '1.5rem',
          gap: '0.5rem',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
        className="no-scrollbar"
      >
        {(['DAILY', 'WEEKLY', 'COMPLETED', 'HISTORY'] as const).map((tab) => {
          const isActive = activeTab === tab
          let label = '📅 Daily'
          if (tab === 'WEEKLY') label = '⚔️ Weekly'
          if (tab === 'COMPLETED') label = '✅ Completed'
          if (tab === 'HISTORY') label = '📜 History'

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                position: 'relative',
                padding: '0.75rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isActive ? 'hsl(270 80% 70%)' : 'hsl(220 10% 60%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
                scrollSnapAlign: 'start',
                flexShrink: 0,
              }}
            >
              {label}
              {isActive && (
                <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))' }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Main Content Body */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="card" style={{ height: '160px', opacity: 0.15, background: 'rgba(255,255,255,0.03)', borderRadius: '16px' }} />
          ))}
        </div>
      ) : activeTab === 'HISTORY' ? (
        /* History Log View */
        <div className="card animate-slideUp" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'white', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            Completed Challenges Log
          </h3>
          {history.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(220 10% 50%)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              No challenge claims recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {history.map((item) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{item.title}</h4>
                    <span style={{ fontSize: '0.68rem', color: 'hsl(220 10% 45%)' }}>
                      Claimed: {new Date(item.claimedAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(157, 78, 221, 0.1)', border: '1px solid rgba(157, 78, 221, 0.2)', color: 'hsl(270 80% 70%)', padding: '0.15rem 0.45rem', borderRadius: 99 }}>
                      +{item.xpReward} XP
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(255, 183, 3, 0.1)', border: '1px solid rgba(255, 183, 3, 0.2)', color: 'hsl(45 100% 60%)', padding: '0.15rem 0.45rem', borderRadius: 99 }}>
                      🪙 +{item.coinReward}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredChallenges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '24px' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏆</span>
          <h3 style={{ fontWeight: 800, color: 'hsl(220 15% 90%)', marginBottom: '0.25rem' }}>No challenges here</h3>
          <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.78rem', margin: 0 }}>
            {activeTab === 'COMPLETED'
              ? 'You have not completed or claimed any challenges today.'
              : 'All set! Check back later or trigger new gameplay accomplishments.'}
          </p>
        </div>
      ) : (
        /* Challenges Cards List */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }} className="animate-slideUp">
          {filteredChallenges.map((ch) => {
            const pct = Math.min(100, Math.floor((ch.current / ch.target) * 100))
            const isCompleted = ch.completed && !ch.claimed

            return (
              <div
                key={ch.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  padding: '1.25rem',
                  background: isCompleted ? 'rgba(157, 78, 221, 0.05)' : 'rgba(255,255,255,0.02)',
                  border: '1px solid',
                  borderColor: isCompleted ? 'rgba(157, 78, 221, 0.25)' : 'rgba(255,255,255,0.06)',
                  borderRadius: '20px',
                  boxShadow: isCompleted ? '0 0 15px rgba(157, 78, 221, 0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '0.92rem', color: 'white', lineHeight: 1.3 }}>
                      {ch.title}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(45 100% 65%)', background: 'rgba(255,183,3,0.08)', padding: '0.1rem 0.4rem', borderRadius: 99 }}>
                        🪙 {ch.coinReward}
                      </span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'hsl(270 80% 70%)', background: 'rgba(157,78,221,0.08)', padding: '0.1rem 0.4rem', borderRadius: 99 }}>
                        ⚡ {ch.xpReward} XP
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginTop: '0.35rem', lineHeight: 1.4, textAlign: 'left' }}>
                    {ch.description}
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'hsl(220 10% 50%)', fontWeight: 700, marginBottom: '0.25rem' }}>
                    <span>PROGRESS</span>
                    <span style={{ color: ch.completed ? 'hsl(142 70% 55%)' : 'hsl(220 10% 50%)' }}>
                      {ch.current} / {ch.target} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: ch.completed
                          ? 'linear-gradient(90deg, #10b981, #34d399)'
                          : 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                        borderRadius: 99,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                  {ch.claimed ? (
                    <button
                      disabled
                      style={{ padding: '0.35rem 1rem', fontSize: '0.72rem', fontWeight: 750, color: 'hsl(142 70% 45%)', border: '1px solid rgba(16,185,129,0.15)', background: 'rgba(16,185,129,0.04)', borderRadius: '10px', cursor: 'not-allowed' }}
                    >
                      ✓ Claimed
                    </button>
                  ) : ch.completed ? (
                    <button
                      onClick={() => handleClaim(ch.id)}
                      disabled={claimingId === ch.id}
                      className="btn btn-primary"
                      style={{ padding: '0.45rem 1.25rem', fontSize: '0.75rem', fontWeight: 800, borderRadius: '10px' }}
                    >
                      {claimingId === ch.id ? 'Claiming...' : '🎁 Claim Reward'}
                    </button>
                  ) : (
                    <button
                      disabled
                      style={{ padding: '0.35rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.03)', background: 'none', borderRadius: '10px', cursor: 'not-allowed' }}
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
