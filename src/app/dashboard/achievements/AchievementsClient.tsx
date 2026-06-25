'use client'

import React, { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import Link from 'next/link'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/layout/Card'

interface Achievement {
  slug: string
  name: string
  description: string
  xpReward: number
  coinReward: number
  category: string
  gameSlug?: string | null
}

interface AchievementProgress {
  slug: string
  name: string
  description: string
  category: string
  current: number
  target: number
  progressPercentage: number
  isUnlocked: boolean
  xpReward: number
  coinReward: number
}

interface Props {
  user: User | null
}

const CATEGORIES = ['All', 'General', 'Puzzle', 'Multiplayer', 'AI Battles', 'Progression']

export default function AchievementsClient({ user }: Props) {
  const [achievements, setAchievements] = useState<AchievementProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Load achievement data
  useEffect(() => {
    if (user) {
      // Authenticated User: Load achievements list & progress from API
      setLoading(true)
      fetch('/api/profile/details?achievements=true')
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Failed to load achievements')
        })
        .then(data => {
          const progress: AchievementProgress[] = (data.achievementProgress || []).map((ach: any) => ({
            ...ach,
            category: mapCategoryToUI(ach)
          }))
          setAchievements(progress)
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setLoading(false)
        })
    } else {
      // Guest User: Fetch all achievements and calculate progress locally
      setLoading(true)
      fetch('/api/achievements')
        .then(res => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then(data => {
          const allAch: Achievement[] = data.achievements || []

          const guestLevel = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
          const unlockedSlugs = JSON.parse(localStorage.getItem('gamehub_guest_achievements') || '[]') as string[]
          const stats = JSON.parse(localStorage.getItem('gamehub_guest_stats') || '{"playCount":0,"winCount":0}')

          const progressList: AchievementProgress[] = allAch.map(a => {
            const guestProg = getGuestProgress(a.slug, stats, guestLevel, 0, unlockedSlugs)
            return {
              slug: a.slug,
              name: a.name,
              description: a.description,
              category: mapCategoryToUI(a),
              current: guestProg.current,
              target: guestProg.target,
              progressPercentage: guestProg.progressPercentage,
              isUnlocked: guestProg.isUnlocked,
              xpReward: a.xpReward,
              coinReward: a.coinReward
            }
          })

          setAchievements(progressList)
          setLoading(false)
        })
        .catch(err => {
          console.error(err)
          setLoading(false)
        })
    }
  }, [user])

  // Helper to map DB/Seeded category to UI category
  const mapCategoryToUI = (ach: { slug: string; category: string; gameSlug?: string | null }) => {
    const slug = ach.slug
    const gameSlug = ach.gameSlug || ''
    
    if (slug.includes('level') || slug.includes('streak') || slug.startsWith('games-')) {
      return 'Progression'
    }
    
    if (slug.includes('beat_hard') || slug.includes('undefeated') || slug.includes('hat-trick') || slug.includes('perfect')) {
      return 'AI Battles'
    }

    if (slug.includes('online') || slug.includes('social') || ['cricket', 'scribble', 'dumb-charades', 'whos-spy'].includes(gameSlug)) {
      return 'Multiplayer'
    }

    if (['water-connect', 'arrow-puzzle', 'unblock-traffic', 'color-sort', '2048'].includes(gameSlug) ||
        slug.startsWith('cs-') || slug.startsWith('traffic-') || slug.startsWith('wc-') ||
        slug.includes('color-sort') || slug.includes('traffic') || slug.includes('puzzle')) {
      return 'Puzzle'
    }

    return 'General'
  }

  // Calculate local guest achievement progress values
  const getGuestProgress = (slug: string, stats: any, level: number, streak: number, unlockedSlugs: string[]) => {
    const isUnlocked = unlockedSlugs.includes(slug)
    if (isUnlocked) {
      return { current: 1, target: 1, isUnlocked: true, progressPercentage: 100 }
    }

    let current = 0
    let target = 1

    switch (slug) {
      case 'first-game':
        current = stats.playCount >= 1 ? 1 : 0
        target = 1
        break
      case 'first-win':
        current = stats.winCount >= 1 ? 1 : 0
        target = 1
        break
      case 'games-5':
        current = stats.playCount
        target = 5
        break
      case 'games-25':
        current = stats.playCount
        target = 25
        break
      case 'games-100':
        current = stats.playCount
        target = 100
        break
      case 'wins-5':
        current = stats.winCount
        target = 5
        break
      case 'wins-20':
        current = stats.winCount
        target = 20
        break
      case 'wins-50':
        current = stats.winCount
        target = 50
        break
      case 'level-5':
        current = level
        target = 5
        break
      case 'level-10':
        current = level
        target = 10
        break
      case 'level-25':
        current = level
        target = 25
        break
      default:
        current = 0
        target = 1
    }

    return {
      current,
      target,
      isUnlocked: current >= target,
      progressPercentage: Math.min(100, Math.round((current / target) * 100))
    }
  }

  // Filtered Achievements
  const filteredAchievements = achievements.filter(ach => {
    const matchesSearch =
      ach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ach.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || ach.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const unlockedCount = achievements.filter(a => a.isUnlocked).length
  const totalCount = achievements.length
  const totalXPUnlocks = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.xpReward, 0)
  const totalCoinsUnlocks = achievements.filter(a => a.isUnlocked).reduce((sum, a) => sum + a.coinReward, 0)

  return (
    <PageWrapper className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper" style={{ maxWidth: 960, marginInline: 'auto', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 850, margin: 0, letterSpacing: '-0.02em', color: 'white' }}>
          🎯 Achievements Vault
        </h1>
        <p style={{ color: 'hsl(220 10% 55%)', margin: 0, fontSize: '0.9rem' }}>
          Complete games, defeat AI opponents, and unlock exclusive rewards.
        </p>
      </div>

      {/* Guest Mode Warning Banner */}
      {!user && (
        <Card
          style={{
            background: 'linear-gradient(135deg, hsl(38 95% 60% / 0.1), hsl(220 100% 60% / 0.1))',
            border: '1px solid hsl(38 95% 55% / 0.3)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(38 95% 65%)' }}>
              🔒 Playing as Guest
            </div>
            <div style={{ fontSize: '0.8rem', color: 'hsl(220 10% 65%)', marginTop: '0.15rem' }}>
              Achievements progress is simulated in your browser. Register to save your badges permanently!
            </div>
          </div>
          <Link href="/register" className="btn btn-primary btn-sm">Create Account</Link>
        </Card>
      )}

      {/* Overall Progress Dashboard Widget */}
      <Card
        variant="glass"
        style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, hsl(220 20% 10%), hsl(220 20% 7%))',
          border: '1px solid hsl(220 15% 16%)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 45%)', letterSpacing: '0.05em' }}>
              Overall Completion
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '0.2rem' }}>
              {unlockedCount} <span style={{ fontSize: '1.1rem', color: 'hsl(220 10% 50%)', fontWeight: 600 }}>/ {totalCount} Unlocked</span>
            </div>
          </div>

          {/* Aggregated Rewards Gained */}
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 45%)' }}>Total XP Earned</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(142 70% 55%)', marginTop: '0.15rem' }}>✨ {totalXPUnlocks} XP</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'hsl(220 10% 45%)' }}>Total Coins Claimed</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'hsl(45 100% 55%)', marginTop: '0.15rem' }}>🪙 {totalCoinsUnlocks}</div>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div>
          <div style={{ height: 8, background: 'hsl(220 20% 14%)', borderRadius: 99, overflow: 'hidden' }}>
            <div
              style={{
                width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))',
                borderRadius: 99
              }}
            />
          </div>
        </div>
      </Card>

      {/* Interactive Filters Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: 99,
                padding: '0.4rem 1rem',
                border: selectedCategory === cat ? undefined : '1px solid hsl(220 15% 18%)',
                background: selectedCategory === cat ? undefined : 'hsl(220 20% 8%)',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search achievements by name or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input"
            style={{
              paddingLeft: '2.5rem',
              borderRadius: 14,
              border: '1px solid hsl(220 15% 18%)',
              background: 'hsl(220 20% 7%)'
            }}
            id="achievement-search-input"
          />
          <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'hsl(220 10% 45%)' }}>🔍</span>
        </div>
      </div>

      {/* Grid of Achievement Cards */}
      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'hsl(220 10% 55%)' }}>
          Loading achievements vault...
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1rem'
          }}
          className="stagger"
        >
          {filteredAchievements.map(ach => (
            <Card
              key={ach.slug}
              className="hover-card"
              style={{
                padding: '1.25rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'start',
                opacity: ach.isUnlocked ? 1 : 0.65,
                background: ach.isUnlocked
                  ? 'linear-gradient(135deg, hsl(222 20% 12%), hsl(222 20% 8%))'
                  : 'hsl(220 20% 8% / 0.8)',
                border: '1px solid',
                borderColor: ach.isUnlocked ? 'hsl(38 95% 50% / 0.2)' : 'hsl(220 15% 15%)',
                transition: 'transform 0.2s, border-color 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Badge/Emoji Visual */}
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: ach.isUnlocked
                    ? 'linear-gradient(135deg, hsl(45 100% 55%), hsl(38 95% 45%))'
                    : 'hsl(220 20% 14%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                  boxShadow: ach.isUnlocked ? '0 4px 12px hsl(38 95% 50% / 0.2)' : 'none'
                }}
              >
                {ach.isUnlocked ? '🏅' : '🔒'}
              </div>

              {/* Text Description */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 750, color: 'white', margin: 0, lineHeight: 1.2 }}>
                    {ach.name}
                  </h3>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.45rem',
                      borderRadius: 6,
                      background: 'hsl(220 20% 14%)',
                      color: 'hsl(220 10% 60%)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {ach.category}
                  </span>
                </div>
                
                <p style={{ fontSize: '0.76rem', color: 'hsl(220 10% 55%)', margin: 0, lineHeight: 1.35 }}>
                  {ach.description}
                </p>

                {/* Progress bar for locked achievements */}
                {!ach.isUnlocked && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>
                      <span>Progress</span>
                      <span>{ach.current} / {ach.target}</span>
                    </div>
                    <div style={{ height: 4, background: 'hsl(220 20% 16%)', borderRadius: 99, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${ach.progressPercentage}%`,
                          height: '100%',
                          background: 'hsl(220 100% 60%)',
                          borderRadius: 99
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Rewards preview */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'hsl(142 70% 60%)',
                      background: 'hsl(142 70% 50% / 0.12)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: 6
                    }}
                  >
                    +{ach.xpReward} XP
                  </span>
                  {ach.coinReward > 0 && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'hsl(45 100% 60%)',
                        background: 'hsl(45 100% 50% / 0.12)',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 6
                      }}
                    >
                      +{ach.coinReward} Coins
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {filteredAchievements.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 45%)', fontSize: '0.88rem' }}>
              No achievements match your filters.
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  )
}
