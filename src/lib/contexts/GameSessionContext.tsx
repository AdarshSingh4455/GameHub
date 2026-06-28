'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import PostGameXPModal from '@/components/layout/PostGameXPModal'
import { computeLevel } from '@/lib/xpUtils'
import { incrementDailyChallengeProgress } from '@/lib/dailyChallenges'
import { getGameBySlug } from '@/lib/games'
import { createClient } from '@/lib/supabase/client'

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element
  mozFullScreenElement?: Element
  msFullscreenElement?: Element
}


export interface AchievementUnlock {
  slug?: string
  name: string
  description: string
  xpReward: number
  coinReward: number
}

export interface GameResultPayload {
  gameSlug: string
  result: 'win' | 'loss' | 'draw'
  xpGained: number
  coinsGained: number
  oldXP: number
  newXP: number
  oldLevel: number
  newLevel: number
  leveledUp: boolean
  currentStreak: number
  unlockedAchievements: AchievementUnlock[]
  nextAchievement: {
    name: string
    current: number
    target: number
    progress: number
  }
  isGuest?: boolean
  highScore?: number
  metadata?: Record<string, any>
}

interface GameSessionContextType {
  user: User | null
  isLoading: boolean
  modalOpen: boolean
  modalData: GameResultPayload | null
  submitGameResult: (payload: {
    gameSlug: string
    result: 'win' | 'loss' | 'draw'
    metadata?: Record<string, unknown>
  }) => Promise<void>
  closeModal: (action?: 'replay' | 'next') => void
  isOnline: boolean
  preloadAdsForGame: (gameSlug: string) => Promise<void>
  triggerAd: (gameSlug: string, onComplete: () => void) => void
}

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined)

const GUEST_XP_KEY = 'gamehub_guest_xp'
const GUEST_LEVEL_KEY = 'gamehub_guest_level'
const GUEST_ACHIEVEMENTS_KEY = 'gamehub_guest_achievements'
const GUEST_STATS_KEY = 'gamehub_guest_stats'



export interface Ad {
  id: string
  imageUrl: string
  targetUrl: string
  durationSecs: number
  duration_seconds?: number
  skip_after_seconds?: number
  allGames: boolean
  games: string[]
  active: boolean
  // Internal: set to true once the image has fully loaded into browser cache
  _imageReady?: boolean
  _imageWidth?: number
  _imageHeight?: number
}

export function GameSessionProvider({
  user,
  children,
}: {
  user: User | null
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [modalData, setModalData] = useState<GameResultPayload | null>(null)
  const [isReplay, setIsReplay] = useState(false)

  // Listen to auth state changes and refresh router to sync cookies with Server Components
  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AUTH STATE CHANGE] event=${event} session=${!!session}`)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        router.refresh()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // Reset ad and post-game flow states on navigation to prevent leakage/retriggering
  React.useEffect(() => {
    setPostGameStage('IDLE')
    setAdToShow(null)
    setModalData(null)
    setIsReplay(false)
  }, [pathname])
  const [isLoading, setIsLoading] = useState(false)

  // Online/Offline tracking
  const [isOnline, setIsOnline] = useState<boolean>(true)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      const handleOnline = () => setIsOnline(true)
      const handleOffline = () => setIsOnline(false)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  // Ads preloading buffer
  const [adsBuffer, setAdsBuffer] = useState<Ad[]>([])
  const [adOrientation, setAdOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [adCompleteCallback, setAdCompleteCallback] = useState<(() => void) | null>(null)

  const preloadAdsForGame = async (gameSlug: string) => {
    if (!navigator.onLine) return
    try {
      const adRes = await fetch(`/api/ads?gameSlug=${gameSlug}`)
      if (adRes.ok) {
        const adData = await adRes.json()
        if (adData.ads && adData.ads.length > 0) {
          const ads: Ad[] = adData.ads
          // Eagerly preload every ad image into browser cache and mark when ready
          const preloadedAds = ads.map(ad => ({ ...ad, _imageReady: false }))
          setAdsBuffer(preloadedAds)

          preloadedAds.forEach((ad) => {
            if (!ad.imageUrl) return
            const img = new Image()
            img.onload = () => {
              // Mutate the buffer entry in place to mark image as ready + cache dimensions
              setAdsBuffer(prev => {
                const next = [...prev]
                const target = next.findIndex(a => a.id === ad.id)
                if (target !== -1) {
                  next[target] = {
                    ...next[target],
                    _imageReady: true,
                    _imageWidth: img.naturalWidth,
                    _imageHeight: img.naturalHeight
                  }
                }
                return next
              })
            }
            img.onerror = () => {
              // Mark as ready anyway so we don't wait forever — will fail gracefully
              setAdsBuffer(prev => {
                const next = [...prev]
                const target = next.findIndex(a => a.id === ad.id)
                if (target !== -1) next[target] = { ...next[target], _imageReady: true }
                return next
              })
            }
            img.src = ad.imageUrl
          })
        }
      }
    } catch (err) {
      console.error('Failed to preload ads:', err)
    }
  }

  // Ads display state
  const [adToShow, setAdToShow] = useState<Ad | null>(null)
  const [adTimeLeft, setAdTimeLeft] = useState(0)

  // Centralized Post Game State Machine: 'IDLE' | 'AD_SHOWING' | 'XP_MODAL_SHOWING'
  const [postGameStage, setPostGameStage] = useState<'IDLE' | 'AD_SHOWING' | 'XP_MODAL_SHOWING'>('IDLE')

  // Guest progress migration logic
  React.useEffect(() => {
    if (!user) return

    const guestXP = parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10)
    const guestStreak = parseInt(localStorage.getItem('gamehub_guest_streak') || '0', 10)
    const guestLongest = parseInt(localStorage.getItem('gamehub_guest_longest_streak') || '0', 10)
    const guestRewardDay = parseInt(localStorage.getItem('gamehub_guest_reward_day') || '1', 10)
    const guestLastClaim = localStorage.getItem('gamehub_guest_last_claim')

    if (guestXP === 0 && guestStreak === 0) return

    const guestStats = JSON.parse(localStorage.getItem(GUEST_STATS_KEY) || '{"playCount":0,"winCount":0}')
    const guestAchievements = JSON.parse(localStorage.getItem(GUEST_ACHIEVEMENTS_KEY) || '[]')

    const statsPayload: any[] = []
    if (guestStats.playCount > 0) {
      statsPayload.push({
        gameSlug: 'tic-tac-toe',
        playCount: guestStats.playCount,
        winCount: guestStats.winCount,
        highScore: guestStats.highScore || 0,
      })
    }

    fetch('/api/profile/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestXP,
        guestStreak,
        guestLongestStreak: guestLongest,
        guestRewardDay,
        guestLastClaim,
        guestStats: statsPayload,
        guestAchievements,
      }),
    })
      .then((res) => {
        if (res.ok) {
          localStorage.removeItem(GUEST_XP_KEY)
          localStorage.removeItem(GUEST_LEVEL_KEY)
          localStorage.removeItem(GUEST_ACHIEVEMENTS_KEY)
          localStorage.removeItem(GUEST_STATS_KEY)
          localStorage.removeItem('gamehub_guest_coins')
          localStorage.removeItem('gamehub_guest_streak')
          localStorage.removeItem('gamehub_guest_reward_day')
          localStorage.removeItem('gamehub_guest_last_claim')
          localStorage.removeItem('gamehub_guest_longest_streak')

          // Trigger Nav details updates
          window.dispatchEvent(new Event('gamehub_xp_update'))
        }
      })
      .catch((err) => console.error('[MIGRATION ERROR]', err))
  }, [user])

  // Countdown timer for Ads
  React.useEffect(() => {
    if (postGameStage !== 'AD_SHOWING' || !adToShow || adTimeLeft <= 0) return

    const timer = setInterval(() => {
      setAdTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer)
          return 0
        }
        if (prev === 1) {
          clearInterval(timer)
          setTimeout(() => {
            setAdToShow(null)
            setPostGameStage(adCompleteCallback ? 'IDLE' : 'XP_MODAL_SHOWING')
            if (adCompleteCallback) {
              adCompleteCallback()
              setAdCompleteCallback(null)
            }
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [postGameStage, adToShow, adCompleteCallback, adTimeLeft === 0])

  // Handles recording click & navigating
  const handleAdClick = async () => {
    if (!adToShow) return
    try {
      await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'click', adId: adToShow.id }),
      })
    } catch (err) {
      console.error('Failed to log ad click:', err)
    }
    window.open(adToShow.targetUrl, '_blank')
  }

  // Trigger ads and post-game modal flow
  async function triggerPostGameFlow(payload: GameResultPayload) {
    setModalData(payload)
    
    // Trigger toast notifications for unlocked badges/achievements
    if (payload.unlockedAchievements && payload.unlockedAchievements.length > 0) {
      payload.unlockedAchievements.forEach((ach: any) => {
        window.dispatchEvent(
          new CustomEvent('gamehub_toast', {
            detail: {
              type: 'new_badge',
              title: '🏅 Badge Unlocked!',
              message: `${ach.name}\n${ach.description}`
            }
          })
        )
      })
    }
    
    // Do not show ads in offline mode or during replay
    if (payload.metadata?.offline || isReplay) {
      setPostGameStage('XP_MODAL_SHOWING')
      return
    }

    // Determine ad status strictly from cached preloaded buffer. No extra network calls.
    let activeAd: Ad | null = null
    if (adsBuffer.length > 0) {
      activeAd = adsBuffer[0]
      setAdsBuffer((prev) => [...prev.slice(1), prev[0]]) // cycle buffer
    }

    if (activeAd) {
      // Record ad impression
      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'impression', adId: activeAd.id })
      }).catch(err => console.error('Failed to record ad impression:', err))

      // FAST PATH: image was already preloaded — show immediately with no roundtrip
      if (activeAd._imageReady && activeAd._imageWidth !== undefined && activeAd._imageHeight !== undefined) {
        const orientation = activeAd._imageWidth >= activeAd._imageHeight ? 'landscape' : 'portrait'
        setAdOrientation(orientation)
        setAdToShow(activeAd)
        setAdTimeLeft(0) // Start with 0, count down only after loaded in DOM
        setPostGameStage('AD_SHOWING')
      } else {
        // SLOW PATH: image not yet cached — wait with a 500ms timeout failsafe
        let resolved = false
        const timeoutId = setTimeout(() => {
          if (!resolved) {
            resolved = true
            console.warn('[AD FAIL-SAFE] Single-player ad load timeout, skipping.')
            setPostGameStage('XP_MODAL_SHOWING')
          }
        }, 500)

        const img = new Image()
        img.onload = () => {
          if (resolved) return
          clearTimeout(timeoutId)
          resolved = true
          const orientation = img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait'
          setAdOrientation(orientation)
          setAdToShow(activeAd!)
          setAdTimeLeft(0) // Start with 0, count down only after loaded in DOM
          setPostGameStage('AD_SHOWING')
        }
        img.onerror = () => {
          if (resolved) return
          clearTimeout(timeoutId)
          resolved = true
          console.warn('[AD FAIL-SAFE] Single-player ad load error, skipping.')
          setPostGameStage('XP_MODAL_SHOWING')
        }
        img.src = activeAd.imageUrl
      }
    } else {
      setPostGameStage('XP_MODAL_SHOWING')
    }
  }

  // Multiplayer ad trigger with 1s safety timeout
  const triggerAd = (gameSlug: string, onComplete: () => void) => {
    if (!navigator.onLine) {
      onComplete()
      return
    }

    let resolved = false
    const complete = () => {
      if (!resolved) {
        resolved = true
        onComplete()
      }
    }

    // Set 1-second fail-safe timeout
    const timeoutId = setTimeout(() => {
      console.warn('[AD FAIL-SAFE] Timeout reached, skipping ad.')
      complete()
    }, 1000)

    const showAd = (ad: Ad) => {
      if (resolved) return

      fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'impression', adId: ad.id })
      }).catch(err => console.error('Failed to record ad impression:', err))

      const img = new Image()
      img.onload = () => {
        if (resolved) return
        clearTimeout(timeoutId)
        const orientation = img.width >= img.height ? 'landscape' : 'portrait'
        setAdOrientation(orientation)
        setAdToShow(ad)
        setAdTimeLeft(0) // Start with 0, count down only after loaded in DOM
        setAdCompleteCallback(() => complete)
        setPostGameStage('AD_SHOWING')
      }
      img.onerror = () => {
        console.error('[AD FAIL-SAFE] Image load failed.')
        clearTimeout(timeoutId)
        complete()
      }
      img.src = ad.imageUrl
    }

    if (adsBuffer.length > 0) {
      const ad = adsBuffer[0]
      setAdsBuffer((prev) => [...prev.slice(1), prev[0]])
      showAd(ad)
    } else {
      fetch(`/api/ads?gameSlug=${gameSlug}`)
        .then((res) => res.json())
        .then((data) => {
          if (resolved) return
          if (data.ads && data.ads.length > 0) {
            const ad = data.ads[Math.floor(Math.random() * data.ads.length)]
            showAd(ad)
          } else {
            clearTimeout(timeoutId)
            complete()
          }
        })
        .catch((e) => {
          console.error('[AD FAIL-SAFE] Fetch error:', e)
          clearTimeout(timeoutId)
          complete()
        })
    }
  }

  // Submits the result
  async function submitGameResult({
    gameSlug,
    result,
    metadata = {},
  }: {
    gameSlug: string
    result: 'win' | 'loss' | 'draw'
    metadata?: Record<string, unknown>
  }) {
    setIsLoading(true)

    // Automatically exit fullscreen before showing result modal
    if (typeof document !== 'undefined') {
      const doc = document as VendorDocument
      if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) {
        doc.exitFullscreen().catch(() => {});
      }
      const fullFallbacks = document.querySelectorAll('.fullscreen-mobile-fallback');
      fullFallbacks.forEach(el => el.classList.remove('fullscreen-mobile-fallback'));
    }

    const prelimPayload: GameResultPayload = {
      gameSlug,
      result,
      xpGained: 0,
      coinsGained: 0,
      oldXP: user ? parseInt(localStorage.getItem('gamehub_user_xp') || '0', 10) : parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10),
      newXP: user ? parseInt(localStorage.getItem('gamehub_user_xp') || '0', 10) : parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10),
      oldLevel: user ? parseInt(localStorage.getItem('gamehub_user_level') || '1', 10) : parseInt(localStorage.getItem(GUEST_LEVEL_KEY) || '1', 10),
      newLevel: user ? parseInt(localStorage.getItem('gamehub_user_level') || '1', 10) : parseInt(localStorage.getItem(GUEST_LEVEL_KEY) || '1', 10),
      leveledUp: false,
      currentStreak: 0,
      unlockedAchievements: [],
      nextAchievement: {
        name: 'Calculating...',
        current: 0,
        target: 1,
        progress: 0,
      },
      isGuest: !user,
      highScore: (metadata?.score as number) ?? 0,
      metadata: {
        ...metadata,
        loading: true // Show spinner
      }
    }

    setModalData(prelimPayload)
    setPostGameStage('XP_MODAL_SHOWING')

    // Asynchronous backend and simulation processing
    const runAsyncSubmission = async () => {
      // Bypasses saves completely when offline
      if (!navigator.onLine) {
        let baseXP = gameSlug === '2048' || gameSlug === 'fighter' || gameSlug === 'memory'
          ? (result === 'win' ? 50 : result === 'loss' ? 10 : 25)
          : (result === 'win' ? 100 : result === 'loss' ? 25 : 50)
        let baseCoins = result === 'win' ? 20 : 5

        if (gameSlug === 'block-blast') {
          const score = (metadata?.score as number) ?? 0
          const gameMeta = (metadata?.gameMetadata as Record<string, any>) ?? {}
          const difficulty = (gameMeta.difficulty ?? 'normal').toLowerCase()
          const maxCombo = gameMeta.maxCombo ?? 0

          if (result === 'win') {
            if (score < 1000) baseXP = 50
            else if (score < 3000) baseXP = 100
            else baseXP = 150
          } else {
            baseXP = 10
          }

          const baseCoinsValue = Math.floor(score / 100)
          const diffMultiplier = difficulty === 'hard' ? 2.0 : difficulty === 'normal' ? 1.5 : 1.0
          const comboBonus = maxCombo * 5
          baseCoins = Math.max(5, Math.floor((baseCoinsValue + comboBonus) * diffMultiplier))
        } else if (gameSlug === 'neon-tetris') {
          const score = (metadata?.score as number) ?? 0
          const gameMeta = (metadata?.gameMetadata as Record<string, any>) ?? {}
          const maxCombo = gameMeta.maxCombo ?? 0

          if (score < 1000) {
            baseXP = 50
          } else if (score < 5000) {
            baseXP = 100
          } else {
            baseXP = 200
          }

          baseCoins = Math.max(
            5,
            Math.floor(score / 100) + maxCombo * 2
          )
        }

        const oldXP = user
          ? 0
          : parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10)
        const oldLevel = user
          ? 1
          : parseInt(localStorage.getItem(GUEST_LEVEL_KEY) || '1', 10)

        const payload: GameResultPayload = {
          gameSlug,
          result,
          xpGained: baseXP,
          coinsGained: baseCoins,
          oldXP,
          newXP: oldXP,
          oldLevel,
          newLevel: oldLevel,
          leveledUp: false,
          currentStreak: 0,
          unlockedAchievements: [],
          nextAchievement: {
            name: 'Offline mode active',
            current: 0,
            target: 1,
            progress: 0,
          },
          isGuest: !user,
          highScore: (metadata?.score as number) ?? 0,
          metadata: {
            ...metadata,
            offline: true,
            loading: false
          }
        }

        setModalData(payload)
        setIsLoading(false)
        return
      }

      // A. Guest Mode (Never write to DB)
      if (!user) {
        // Load simulated values from local storage
        const oldXP = parseInt(localStorage.getItem(GUEST_XP_KEY) || '0', 10)
        const oldLevel = parseInt(localStorage.getItem(GUEST_LEVEL_KEY) || '1', 10)
        const unlockedSlugs = JSON.parse(
          localStorage.getItem(GUEST_ACHIEVEMENTS_KEY) || '[]'
        ) as string[]
        const unlockedSet = new Set(unlockedSlugs)
        const stats = JSON.parse(
          localStorage.getItem(GUEST_STATS_KEY) || '{"playCount":0,"winCount":0,"highScore":0}'
        )

        // Increment stats
        stats.playCount += 1
        if (result === 'win') {
          stats.winCount += 1
        }
        const oldHighScore = stats.highScore || 0
        const newHighScore = Math.max(oldHighScore, (metadata?.score as number) ?? 0)
        stats.highScore = newHighScore

        // Base XP config matching backend config
        let baseXP = gameSlug === '2048' || gameSlug === 'fighter' || gameSlug === 'memory'
          ? (result === 'win' ? 50 : result === 'loss' ? 10 : 25)
          : (result === 'win' ? 100 : result === 'loss' ? 25 : 50)
        let baseCoins = result === 'win' ? 20 : 5

        if (gameSlug === 'block-blast') {
          const score = (metadata?.score as number) ?? 0
          const gameMeta = (metadata?.gameMetadata as Record<string, any>) ?? {}
          const difficulty = (gameMeta.difficulty ?? 'normal').toLowerCase()
          const maxCombo = gameMeta.maxCombo ?? 0

          if (result === 'win') {
            if (score < 1000) baseXP = 50
            else if (score < 3000) baseXP = 100
            else baseXP = 150
          } else {
            baseXP = 10
          }

          const baseCoinsValue = Math.floor(score / 100)
          const diffMultiplier = difficulty === 'hard' ? 2.0 : difficulty === 'normal' ? 1.5 : 1.0
          const comboBonus = maxCombo * 5
          baseCoins = Math.max(5, Math.floor((baseCoinsValue + comboBonus) * diffMultiplier))
        }

        // Simulate achievements
        const newlyUnlocked: AchievementUnlock[] = []
        if (stats.playCount === 1 && !unlockedSet.has('first-game')) {
          unlockedSet.add('first-game')
          newlyUnlocked.push({
            name: 'First Move',
            description: 'Play your first game.',
            xpReward: 50,
            coinReward: 10,
          })
        }
        if (result === 'win' && stats.winCount === 1 && !unlockedSet.has('first-win')) {
          unlockedSet.add('first-win')
          newlyUnlocked.push({
            name: 'Winner Winner',
            description: 'Win your first match.',
            xpReward: 100,
            coinReward: 25,
          })
        }

        const totalXPGained = baseXP + newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0)
        const totalCoinsGained = baseCoins + newlyUnlocked.reduce((sum, a) => sum + a.coinReward, 0)

        const finalXP = oldXP + totalXPGained
        const finalLevel = computeLevel(finalXP)
        const leveledUp = finalLevel > oldLevel

        // Save simulated values
        const oldCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
        const finalCoins = oldCoins + totalCoinsGained
        localStorage.setItem('gamehub_guest_coins', finalCoins.toString())

        localStorage.setItem(GUEST_XP_KEY, finalXP.toString())
        localStorage.setItem(GUEST_LEVEL_KEY, finalLevel.toString())
        localStorage.setItem(GUEST_ACHIEVEMENTS_KEY, JSON.stringify(Array.from(unlockedSet)))
        localStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats))

        // Next Achievement
        let nextAchievement = { name: 'First Win', current: stats.winCount, target: 1, progress: stats.winCount > 0 ? 100 : 0 }
        if (stats.winCount >= 1) {
          const nextMilestone = finalLevel < 5 ? 5 : finalLevel < 10 ? 10 : 25
          nextAchievement = {
            name: `Reach Level ${nextMilestone}`,
            current: finalLevel,
            target: nextMilestone,
            progress: Math.min(100, Math.round((finalLevel / nextMilestone) * 100)),
          }
        }

        const payload: GameResultPayload = {
          gameSlug,
          result,
          xpGained: totalXPGained,
          coinsGained: totalCoinsGained,
          oldXP,
          newXP: finalXP,
          oldLevel,
          newLevel: finalLevel,
          leveledUp,
          currentStreak: 0,
          unlockedAchievements: newlyUnlocked,
          nextAchievement,
          isGuest: true,
          highScore: newHighScore,
          metadata: {
            ...metadata,
            loading: false
          }
        }

        // Store guest match history
        try {
          const guestHistoryRaw = localStorage.getItem('gamehub_guest_match_history') || '[]'
          const guestHistory = JSON.parse(guestHistoryRaw)
          const newMatch = {
            id: 'guest-match-' + Date.now(),
            playedAt: new Date().toISOString(),
            gameSlug,
            result,
            xpEarned: totalXPGained,
            coinsEarned: totalCoinsGained,
            player1Score: (metadata?.score as number) ?? 0,
            player2Score: (metadata?.opponentScore as number) ?? 0,
            opponent: metadata?.difficulty ? `AI (${metadata.difficulty})` : 'AI',
            game: { name: getGameBySlug(gameSlug)?.name || gameSlug, slug: gameSlug }
          }
          guestHistory.unshift(newMatch)
          localStorage.setItem('gamehub_guest_match_history', JSON.stringify(guestHistory))
        } catch (e) {
          console.error('Failed to save guest match history:', e)
        }

        // Update daily challenges progress for guest
        await updateDailyChallengesForMatch(gameSlug, result, totalXPGained, metadata, null)

        setModalData(payload)
        setIsLoading(false)
        return
      }

      // B. Authenticated User (Write to DB)
      try {
        const res = await fetch('/api/games/game-over', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameSlug, result, metadata }),
        })

        if (!res.ok) {
          const errStatus = res.status;
          const errStatusText = res.statusText;
          const errText = await res.text();
          console.error(`[API SUBMIT ERROR] Status: ${errStatus}, Text: ${errStatusText}, Body:`, errText);
          throw new Error(`Failed to submit game result: ${errStatus} ${errStatusText} - ${errText}`);
        }

        const data = await res.json()

        if (data.newXP !== undefined) {
          localStorage.setItem('gamehub_user_xp', data.newXP.toString())
        }
        if (data.newLevel !== undefined) {
          localStorage.setItem('gamehub_user_level', data.newLevel.toString())
        }

        const payload: GameResultPayload = {
          ...data,
          isGuest: false,
          metadata: {
            ...metadata,
            loading: false
          }
        }

        // Trigger toast notifications for unlocked badges/achievements on successful response
        if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
          data.unlockedAchievements.forEach((ach: any) => {
            window.dispatchEvent(
              new CustomEvent('gamehub_toast', {
                detail: {
                  type: 'new_badge',
                  title: '🏅 Badge Unlocked!',
                  message: `${ach.name}\n${ach.description}`
                }
              })
            )
          })
        }

        // Update daily challenges progress for authenticated user
        await updateDailyChallengesForMatch(gameSlug, result, data.xpGained, metadata, user)

        setModalData(payload)
      } catch (err) {
        console.error('Error submitting game result:', err)
      } finally {
        setIsLoading(false)
      }
    }

    runAsyncSubmission()
  }

  function closeModal(action?: 'replay' | 'next' | 'lobby') {
    setPostGameStage('IDLE')
    setModalData(null)
    if (action === 'replay' || action === 'next') {
      setIsReplay(true)
    } else {
      setIsReplay(false)
    }
    if (action === 'next') {
      window.dispatchEvent(new Event('gamehub_next_level'))
    } else if (action === 'replay') {
      window.dispatchEvent(new Event('gamehub_replay'))
    }
  }

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__debug_game_session = {
        user,
        isLoading,
        postGameStage,
        modalData,
      }
    }
  }, [user, isLoading, postGameStage, modalData])

  return (
    <GameSessionContext.Provider
      value={{
        user,
        isLoading,
        modalOpen: postGameStage === 'XP_MODAL_SHOWING',
        modalData,
        submitGameResult,
        closeModal,
        isOnline,
        preloadAdsForGame,
        triggerAd,
      }}
    >
      {children}

      {/* Sponsored Ad Overlay */}
      {postGameStage === 'AD_SHOWING' && adToShow && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.94)',
            backdropFilter: 'blur(12px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          id="ad-overlay-container"
        >
          <div
            className="card glass"
            style={{
              width: '95vw',
              maxWidth: adOrientation === 'landscape' ? 600 : 360,
              height: adOrientation === 'landscape' ? 'auto' : 'min(90vh, 560px)',
              background: 'linear-gradient(135deg, hsl(222 20% 9% / 0.95), hsl(222 18% 13% / 0.95))',
              border: '1px solid hsl(220 15% 22%)',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
              borderRadius: 20,
              textAlign: 'center',
              position: 'relative',
              gap: '1rem',
            }}
            id="ad-overlay-card"
          >
            <div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: 'hsl(45 100% 55%)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  marginBottom: '0.5rem',
                }}
              >
                Sponsored Promotion
              </div>
              <h3
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: 'white',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Advertiser Message
              </h3>
            </div>

            {/* Banner click area */}
            <div
              onClick={handleAdClick}
              style={{
                cursor: 'pointer',
                width: '100%',
                aspectRatio: adOrientation === 'landscape' ? '16/9' : '9/16',
                maxHeight: adOrientation === 'landscape' ? 'none' : '320px',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid hsl(220 15% 18%)',
                background: 'hsl(222 20% 6%)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              id="ad-banner-link"
            >
              {adToShow.imageUrl ? (
                <img
                  src={adToShow.imageUrl}
                  alt="Sponsor Banner"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  onLoad={() => {
                    console.log('[AD RENDER] Image loaded successfully, starting countdown.')
                    setAdTimeLeft(adToShow.duration_seconds ?? adToShow.durationSecs ?? 5)
                  }}
                  onError={() => {
                    console.error('[AD RENDER ERROR] Image failed to render, skipping ad.')
                    setAdToShow(null)
                    setPostGameStage(adCompleteCallback ? 'IDLE' : 'XP_MODAL_SHOWING')
                    if (adCompleteCallback) {
                      adCompleteCallback()
                      setAdCompleteCallback(null)
                    }
                  }}
                />
              ) : (
                <div 
                  style={{ color: 'hsl(220 10% 50%)', fontSize: '0.85rem' }}
                  ref={(el) => {
                    if (el && adTimeLeft === 0) {
                      setAdTimeLeft(adToShow.duration_seconds ?? adToShow.durationSecs ?? 5)
                    }
                  }}
                >
                  Click to visit sponsor
                </div>
              )}
              
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(5, 8, 16, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    background: 'hsla(220, 100%, 60%, 0.9)',
                    color: 'white',
                    padding: '0.4rem 0.8rem',
                    borderRadius: 99,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }}
                >
                  Visit Sponsor ↗
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'hsl(220 10% 65%)',
                  fontWeight: 600,
                }}
              >
                Rewards unlock in <span style={{ color: 'hsl(45 100% 55%)', fontWeight: 800 }}>{adTimeLeft}s</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAdClick}
                  className="btn btn-primary"
                  style={{ flex: 1, borderRadius: 12, fontSize: '0.85rem' }}
                >
                  Open ↗
                </button>
                
                <button
                  disabled={(adToShow.duration_seconds ?? adToShow.durationSecs ?? 5) - adTimeLeft < (adToShow.skip_after_seconds ?? 5)}
                  onClick={() => {
                    setAdToShow(null)
                    setPostGameStage(adCompleteCallback ? 'IDLE' : 'XP_MODAL_SHOWING')
                    if (adCompleteCallback) {
                      adCompleteCallback()
                      setAdCompleteCallback(null)
                    }
                  }}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    fontSize: '0.85rem',
                    opacity: ((adToShow.duration_seconds ?? adToShow.durationSecs ?? 5) - adTimeLeft < (adToShow.skip_after_seconds ?? 5)) ? 0.5 : 1,
                    cursor: ((adToShow.duration_seconds ?? adToShow.durationSecs ?? 5) - adTimeLeft < (adToShow.skip_after_seconds ?? 5)) ? 'not-allowed' : 'pointer',
                  }}
                  id="ad-skip-btn"
                >
                  {((adToShow.duration_seconds ?? adToShow.durationSecs ?? 5) - adTimeLeft < (adToShow.skip_after_seconds ?? 5)) 
                    ? `Skip in ${(adToShow.skip_after_seconds ?? 5) - ((adToShow.duration_seconds ?? adToShow.durationSecs ?? 5) - adTimeLeft)}s` 
                    : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Post-Game XP modal */}
      {postGameStage === 'XP_MODAL_SHOWING' && modalData && (
        <PostGameXPModal data={modalData} onClose={closeModal} />
      )}
    </GameSessionContext.Provider>
  )
}

async function updateDailyChallengesForMatch(
  gameSlug: string,
  result: 'win' | 'loss' | 'draw',
  xpGained: number,
  metadata: Record<string, any> | undefined,
  user: any
) {
  // 1. Play 3 Games
  await incrementDailyChallengeProgress('daily_play_3', 1, user)
  
  // 2. Earn 100 XP
  if (xpGained > 0) {
    await incrementDailyChallengeProgress('daily_earn_100_xp', xpGained, user)
  }

  // 3. Win 2 Matches
  if (result === 'win') {
    await incrementDailyChallengeProgress('daily_win_2', 1, user)
  }

  // 4. Complete 1 Puzzle
  const game = getGameBySlug(gameSlug)
  if (result === 'win' && game && (game.category.toLowerCase() === 'puzzle' || game.category.toLowerCase() === 'match-3')) {
    await incrementDailyChallengeProgress('daily_complete_1', 1, user)
  }

  // 5. Beat Hard AI
  if (result === 'win' && metadata && (metadata.difficulty === 'hard' || metadata.difficulty === 'Hard')) {
    await incrementDailyChallengeProgress('daily_beat_hard_ai', 1, user)
  }

  // Block Blast specific daily challenges
  if (gameSlug === 'block-blast') {
    await incrementDailyChallengeProgress('daily_bb_play', 1, user)

    const score = metadata?.score ?? 0
    if (score >= 1000) {
      await incrementDailyChallengeProgress('daily_bb_score_1000', 1, user)
    }
    if (score >= 3000) {
      await incrementDailyChallengeProgress('daily_bb_score_3000', 1, user)
    }

    const gameMeta = metadata?.gameMetadata ?? {}
    const lines = gameMeta.linesCleared ?? 0
    if (lines > 0) {
      await incrementDailyChallengeProgress('daily_bb_clear_10', lines, user)
      await incrementDailyChallengeProgress('daily_bb_clear_25', lines, user)
    }
  }

  // Neon Tetris specific daily challenges
  if (gameSlug === 'neon-tetris') {
    await incrementDailyChallengeProgress('daily_nt_play', 1, user)

    const score = metadata?.score ?? 0
    if (score >= 1000) {
      await incrementDailyChallengeProgress('daily_nt_score_1000', 1, user)
    }
    if (score >= 3000) {
      await incrementDailyChallengeProgress('daily_nt_score_3000', 1, user)
    }

    const gameMeta = metadata?.gameMetadata ?? {}
    const lines = gameMeta.linesCleared ?? 0
    if (lines > 0) {
      await incrementDailyChallengeProgress('daily_nt_clear_20', lines, user)
      await incrementDailyChallengeProgress('daily_nt_clear_50', lines, user)
    }
  }

  // Word Wizard specific daily challenges
  if (gameSlug === 'word-wizard') {
    await incrementDailyChallengeProgress('daily_ww_play', 1, user)

    const score = metadata?.score ?? 0
    if (score >= 2000) {
      await incrementDailyChallengeProgress('daily_ww_score_2000', 1, user)
    }
    if (score >= 5000) {
      await incrementDailyChallengeProgress('daily_ww_score_5000', 1, user)
    }

    const gameMeta = metadata?.gameMetadata ?? {}
    const wordsFound = gameMeta.wordsFound ?? 0
    if (wordsFound > 0) {
      await incrementDailyChallengeProgress('daily_ww_find_10', wordsFound, user)
      await incrementDailyChallengeProgress('daily_ww_find_25', wordsFound, user)
    }

    const hintsUsed = gameMeta.hintsUsed ?? 0
    if (hintsUsed === 0) {
      await incrementDailyChallengeProgress('daily_ww_no_hints', 1, user)
    }

    const rareWordsCount = gameMeta.rareWordsCount ?? 0
    if (rareWordsCount > 0) {
      await incrementDailyChallengeProgress('daily_ww_rare', rareWordsCount, user)
    }
  }

  // Match-3 category specific challenges
  if (gameSlug === 'ai-infinite-candy-crush') {
    await incrementDailyChallengeProgress('daily_match3_play', 1, user)

    const score = metadata?.score ?? 0
    if (score >= 5000) {
      await incrementDailyChallengeProgress('daily_match3_score', 1, user)
    }

    const gameMeta = metadata?.gameMetadata ?? {}
    const maxCombo = gameMeta.maxCombo ?? 0
    if (maxCombo >= 4) {
      await incrementDailyChallengeProgress('daily_match3_combo', 1, user)
    }
  }
}

export function useGameSession() {
  const context = useContext(GameSessionContext)
  if (context === undefined) {
    throw new Error('useGameSession must be used within a GameSessionProvider')
  }
  return context
}
