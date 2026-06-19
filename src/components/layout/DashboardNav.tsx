'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import DailyRewardModal from './DailyRewardModal'
import { getUtcDaysElapsed } from '@/lib/dailyRewards'
import type { AchievementProgressInfo } from '@/lib/achievements'
import { getLevelProgress } from '@/lib/xpUtils'

interface NavLink {
  href: string
  label: string
  emoji: string
  authRequired?: boolean
}

const NAV_LINKS: NavLink[] = [
  { href: '/dashboard',             label: 'Home',          emoji: '🏠' },
  { href: '/dashboard/games',       label: 'All Games',     emoji: '🎮' },
  { href: '/dashboard/challenges',  label: 'Challenges',   emoji: '⚡' },
  { href: '/dashboard/store',       label: 'Store',        emoji: '🪙' },
  { href: '/dashboard/multiplayer', label: 'Multiplayer',   emoji: '🌐', authRequired: true },
  { href: '/dashboard/leaderboard', label: 'Leaderboard',   emoji: '🏆', authRequired: true },
  { href: '/dashboard/rewards',     label: 'Rewards',       emoji: '🎯' },
  { href: '/dashboard/friends',     label: 'Friends',       emoji: '👥', authRequired: true },
  { href: '/dashboard/profile',     label: 'Profile',       emoji: '👤' },
  { href: '/dashboard/settings',    label: 'Settings',      emoji: '⚙️',  authRequired: true },
]

const BOTTOM_NAV_LINKS: NavLink[] = [
  { href: '/dashboard',             label: 'Home',         emoji: '🏠' },
  { href: '/dashboard/games',       label: 'Games',        emoji: '🎮' },
  { href: '/dashboard/challenges',  label: 'Challenges',   emoji: '⚡' },
  { href: '/dashboard/store',       label: 'Store',        emoji: '🪙' },
  { href: '/dashboard/rewards',     label: 'Rewards',      emoji: '🎯' },
  { href: '/dashboard/profile',     label: 'Profile',      emoji: '👤' },
]

interface Props {
  user: User | null
}

export default function DashboardNav({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  
  const [userStats, setUserStats] = useState({
    level: 1,
    xp: 0,
    coins: 0,
    streak: 0,
    rewardDay: 1,
    lastClaim: null as string | null,
    achievementProgress: [] as AchievementProgressInfo[],
    role: null as string | null,
  })

  // Detect game page to hide mobile top header and bottom nav
  const isGamePage = (pathname.startsWith('/dashboard/games/') && pathname !== '/dashboard/games') || pathname.startsWith('/dashboard/multiplayer/play/')

  // Inject body class for global styling adjustments when in a game
  useEffect(() => {
    if (isGamePage) {
      document.body.classList.add('game-page-active')
    } else {
      document.body.classList.remove('game-page-active')
    }
    return () => {
      document.body.classList.remove('game-page-active')
    }
  }, [isGamePage])

  // Load details / stats dynamically
  const loadProfileDetails = () => {
    if (user) {
      fetch('/api/profile/details')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          setUserStats({
            level: data.profile.level,
            xp: data.profile.xp,
            coins: data.profile.coins,
            streak: data.profile.currentStreak,
            rewardDay: data.profile.dailyRewardDay,
            lastClaim: data.profile.lastDailyRewardClaim,
            achievementProgress: data.achievementProgress || [],
            role: data.profile.role,
          })
        })
        .catch(() => {})
    } else {
      const guestXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const guestLevel = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      const guestCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      const guestStreak = parseInt(localStorage.getItem('gamehub_guest_streak') || '0', 10)
      const guestRewardDay = parseInt(localStorage.getItem('gamehub_guest_reward_day') || '1', 10)
      const guestLastClaim = localStorage.getItem('gamehub_guest_last_claim')

       setUserStats({
        level: guestLevel,
        xp: guestXP,
        coins: guestCoins,
        streak: guestStreak,
        rewardDay: guestRewardDay,
        lastClaim: guestLastClaim,
        achievementProgress: [], 
        role: null,
      })
    }
  }

  useEffect(() => {
    loadProfileDetails()

    const handleUpdate = () => {
      loadProfileDetails()
    }

    window.addEventListener('storage', handleUpdate)
    window.addEventListener('gamehub_xp_update', handleUpdate)
    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('gamehub_xp_update', handleUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function getInitials() {
    if (user) {
      const name = (user.user_metadata?.username as string) ?? user.email ?? '?'
      return name[0].toUpperCase()
    }
    return 'G'
  }

  // --- Calculations for Sidebar Progress Widgets ---
  const {
    level: L,
    progressPercent: xpProgressPercentage,
    nextFloorXP: nextLevelThreshold,
  } = getLevelProgress(userStats.xp)

  // Determine Daily Reward Status
  let dailyClaimable = true
  if (userStats.lastClaim) {
    const lastClaimDate = new Date(userStats.lastClaim)
    const daysDiff = getUtcDaysElapsed(new Date(), lastClaimDate)
    if (daysDiff === 0) {
      dailyClaimable = false
    }
  }

  // Retrieve closest locked achievement
  const closestAchievement = userStats.achievementProgress
    .filter((a) => !a.isUnlocked)
    .sort((a, b) => b.progressPercentage - a.progressPercentage)[0]

  return (
    <>
      {/* ── Mobile Top Header ── */}
      {!isGamePage && (
        <header className="mobile-header">
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(220 15% 92%)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Toggle Navigation Menu"
          >
            ☰
          </button>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontWeight: 800, fontSize: '1.2rem' }} className="gradient-text">🎮 GameHub</span>
          </Link>
          <Link
            href={user ? '/dashboard/profile' : '/register'}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: user ? 'linear-gradient(135deg,hsl(220 100% 60%),hsl(270 80% 60%))' : 'hsl(220 15% 20%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              textDecoration: 'none',
              color: 'white',
              border: '1px solid hsl(220 15% 30%)',
            }}
          >
            {getInitials()}
          </Link>
        </header>
      )}

      {/* ── Mobile Drawer Backdrop Overlay ── */}
      {drawerOpen && !isGamePage && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Navigation Sidebar / Drawer ── */}
      <aside className={`sidebar-container ${drawerOpen ? 'open' : ''} ${isGamePage ? 'hidden' : ''}`} style={{ display: isGamePage ? 'none' : 'flex' }}>
        {/* Logo */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid hsl(220 15% 18%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }} onClick={() => setDrawerOpen(false)}>
            <span style={{ fontWeight: 800, fontSize: '1.25rem' }} className="gradient-text">🎮 GameHub</span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsl(220 10% 50%)',
              fontSize: '1.2rem',
              cursor: 'pointer',
            }}
            className="md:hidden"
          >
            ✕
          </button>
        </div>

        {/* User / Guest card */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid hsl(220 15% 18%)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg,hsl(220 100% 60%),hsl(270 80% 60%))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    flexShrink: 0,
                  }}
                >
                  {getInitials()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(220 15% 92%)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {(user.user_metadata?.username as string) ?? user.email}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)' }}>
                    Level {L} · {userStats.coins} Coins
                  </div>
                </div>
              </div>

              {/* Sidebar Progress Widgets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
                {/* Level Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>
                    <span>Level {L} XP Progress</span>
                    <span>{xpProgressPercentage}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'hsl(220 20% 16%)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${xpProgressPercentage}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 65%), hsl(270 80% 65%))', borderRadius: '99px' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'hsl(220 10% 45%)', marginTop: '0.15rem', textAlign: 'right' }}>
                    {userStats.xp} / {nextLevelThreshold} XP
                  </div>
                </div>

                {/* Streak and Daily Claim Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem', padding: '0.4rem 0.5rem', borderRadius: 8, background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 20% 14%)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 70%)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    🔥 <strong>{userStats.streak}</strong> Day Streak
                  </span>

                  {dailyClaimable ? (
                    <button
                      onClick={() => setModalOpen(true)}
                      style={{
                        background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))',
                        border: 'none',
                        color: 'white',
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        borderRadius: 6,
                        cursor: 'pointer',
                        boxShadow: '0 0 10px -2px hsl(220 100% 65% / 0.4)'
                      }}
                      id="sidebar-claim-reward"
                    >
                      🎁 Claim!
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: 6, background: 'hsl(142 70% 50% / 0.15)', color: 'hsl(142 70% 55%)', fontWeight: 700 }}>
                      Claimed ✓
                    </span>
                  )}
                </div>

                {/* Closest Locked Achievement Widget */}
                {closestAchievement && (
                  <div style={{ padding: '0.5rem', background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 12%)', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'hsl(220 10% 45%)', fontWeight: 700, marginBottom: '0.25rem' }}>Next Achievement</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 15% 90%)', marginBottom: '0.1rem' }}>{closestAchievement.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>
                      <span>{closestAchievement.current} / {closestAchievement.target}</span>
                      <span>{closestAchievement.progressPercentage}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'hsl(220 20% 16%)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ width: `${closestAchievement.progressPercentage}%`, height: '100%', background: 'hsl(38 95% 60%)', borderRadius: '99px' }} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'hsl(220 15% 20%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    color: 'hsl(220 10% 60%)',
                  }}
                >
                  G
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(220 10% 80%)' }}>Guest Mode</div>
                  <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 45%)' }}>
                    Level {L} · {userStats.xp} XP
                  </div>
                </div>
              </div>

              {/* Guest Streak Widget */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderRadius: 8, background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 20% 14%)', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'hsl(220 10% 70%)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  🔥 <strong>{userStats.streak}</strong> Day Streak
                </span>

                {dailyClaimable ? (
                  <button
                    onClick={() => setModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, hsl(220 100% 65%), hsl(270 80% 60%))',
                      border: 'none',
                      color: 'white',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      borderRadius: 6,
                      cursor: 'pointer',
                      boxShadow: '0 0 10px -2px hsl(220 100% 65% / 0.4)'
                    }}
                    id="sidebar-claim-reward-guest"
                  >
                    🎁 Claim!
                  </button>
                ) : (
                  <span style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: 6, background: 'hsl(142 70% 50% / 0.15)', color: 'hsl(142 70% 55%)', fontWeight: 700 }}>
                    Claimed ✓
                  </span>
                )}
              </div>

              <Link
                href="/register"
                className="btn btn-primary btn-sm"
                style={{ justifyContent: 'center', marginTop: '0.25rem' }}
                onClick={() => setDrawerOpen(false)}
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'center' }}
                onClick={() => setDrawerOpen(false)}
              >
                Sign In
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ padding: '0.75rem', flex: 1 }}>
          {(() => {
            const dynamicNavLinks = [...NAV_LINKS]
            // Insert Store
            dynamicNavLinks.splice(3, 0, { href: '/dashboard/store', label: 'Store', emoji: '🪙' })
            // Insert Admin if SUPER_ADMIN
            if (userStats.role === 'SUPER_ADMIN') {
              dynamicNavLinks.splice(6, 0, { href: '/dashboard/admin', label: 'Admin Panel', emoji: '🛠️', authRequired: true })
            }

            return dynamicNavLinks.map((link) => {
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
            const locked = link.authRequired && !user

            return (
              <Link
                key={link.href}
                href={locked ? '/login' : link.href}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: 10,
                  textDecoration: 'none',
                  marginBottom: '0.2rem',
                  fontSize: '0.9rem',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'hsl(220 100% 75%)' : locked ? 'hsl(220 10% 38%)' : 'hsl(220 10% 65%)',
                  background: active ? 'hsl(220 100% 60% / 0.12)' : 'transparent',
                  border: active ? '1px solid hsl(220 100% 60% / 0.2)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                title={locked ? 'Sign in to access' : undefined}
              >
                <span style={{ fontSize: '1.1rem' }}>{link.emoji}</span>
                {link.label}
                {locked && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>🔒</span>}
              </Link>
            )
          })
        })()}
        </nav>

        {/* Bottom: sign out */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid hsl(220 15% 18%)' }}>
          {user ? (
            <button
              onClick={() => {
                setDrawerOpen(false)
                handleSignOut()
              }}
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'flex-start', color: 'hsl(0 80% 60%)' }}
              id="signout-btn"
            >
              🚪 Sign Out
            </button>
          ) : (
            <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 35%)', textAlign: 'center' }}>
              Sign in to save scores & XP
            </p>
          )}
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation Bar ── */}
      {!isGamePage && (
        <nav className="mobile-bottom-nav">
          {(() => {
            const dynamicBottomNavLinks = [...BOTTOM_NAV_LINKS]

            return dynamicBottomNavLinks.map((link) => {
            const active = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
            const locked = link.authRequired && !user

            return (
              <Link
                key={link.href}
                href={locked ? '/login' : link.href}
                className={`bottom-nav-item ${active ? 'active' : ''}`}
                title={locked ? 'Sign in to access' : undefined}
              >
                <div className="bottom-nav-icon-container">
                  <span className="bottom-nav-emoji">{link.emoji}</span>
                  {active && <span className="bottom-nav-active-dot" />}
                </div>
                <span className="bottom-nav-label">{link.label}</span>
              </Link>
            )
          })
        })()}
        </nav>
      )}

      {/* Daily Reward Modal Popup */}
      <DailyRewardModal
        user={user}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onClaimSuccess={loadProfileDetails}
      />
    </>
  )
}
