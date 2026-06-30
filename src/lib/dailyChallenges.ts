// Client-side daily challenges manager
export interface DailyChallenge {
  id: string
  text: string
  gameSlug: string
  target: number
  current: number
  completed: boolean
  xpReward: number
  coinReward: number
}

// Generate daily challenges based on date string
export function getDailyChallenges(dateStr: string): DailyChallenge[] {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  const seed = Math.abs(hash)
  
  // Custom seeded random helper
  const nextRand = () => {
    const x = Math.sin(seed + 1) * 10000
    return x - Math.floor(x)
  }
  const pickRange = (min: number, max: number) => {
    return min + nextRand() * (max - min)
  }

  const mpScoreGoal = Math.floor(pickRange(1000, 2500) / 100) * 100
  const mpAccuracyGoal = Math.floor(pickRange(75, 95))
  const sfDistanceGoal = Math.floor(pickRange(1500, 4000) / 100) * 100
  const sfCoinsGoal = Math.floor(pickRange(15, 50))
  const sfScoreGoal = Math.floor(pickRange(2000, 6000) / 100) * 100

  return [
    { id: 'daily_play_3', text: 'Play 3 Games', gameSlug: 'all', target: 3, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_earn_100_xp', text: 'Earn 100 XP', gameSlug: 'all', target: 100, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_win_2', text: 'Win 2 Matches', gameSlug: 'all', target: 2, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_complete_1', text: 'Complete 1 Puzzle', gameSlug: 'all', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_beat_hard_ai', text: 'Beat Hard AI', gameSlug: 'all', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    { id: 'daily_bb_play', text: 'Play Block Blast', gameSlug: 'block-blast', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_bb_score_1000', text: 'Score 1000 in Block Blast', gameSlug: 'block-blast', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_bb_score_3000', text: 'Score 3000 in Block Blast', gameSlug: 'block-blast', target: 1, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_bb_clear_10', text: 'Clear 10 Lines in Block Blast', gameSlug: 'block-blast', target: 10, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_bb_clear_25', text: 'Clear 25 Lines in Block Blast', gameSlug: 'block-blast', target: 25, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_nt_play', text: 'Play Neon Tetris', gameSlug: 'neon-tetris', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_nt_score_1000', text: 'Score 1000 in Neon Tetris', gameSlug: 'neon-tetris', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_nt_score_3000', text: 'Score 3000 in Neon Tetris', gameSlug: 'neon-tetris', target: 1, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_nt_clear_20', text: 'Clear 20 Lines in Neon Tetris', gameSlug: 'neon-tetris', target: 20, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_nt_clear_50', text: 'Clear 50 Lines in Neon Tetris', gameSlug: 'neon-tetris', target: 50, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_ww_play', text: 'Play Word Wizard', gameSlug: 'word-wizard', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_ww_find_10', text: 'Find 10 Words in Word Wizard', gameSlug: 'word-wizard', target: 10, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_ww_find_25', text: 'Find 25 Words in Word Wizard', gameSlug: 'word-wizard', target: 25, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_ww_score_2000', text: 'Score 2000 in Word Wizard', gameSlug: 'word-wizard', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_ww_score_5000', text: 'Score 5000 in Word Wizard', gameSlug: 'word-wizard', target: 1, current: 0, completed: false, xpReward: 250, coinReward: 50 },
    { id: 'daily_ww_no_hints', text: 'Use No Hints in Word Wizard', gameSlug: 'word-wizard', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    { id: 'daily_ww_rare', text: 'Find 3 Rare Letter Words', gameSlug: 'word-wizard', target: 3, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    // Match-3 Category Challenges
    { id: 'daily_match3_play', text: 'Play 1 Match-3 Game', gameSlug: 'ai-infinite-candy-crush', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_match3_score', text: 'Score 5000 in Match-3', gameSlug: 'ai-infinite-candy-crush', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_match3_combo', text: 'Reach a 4x Combo in Match-3', gameSlug: 'ai-infinite-candy-crush', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    // Memory Plate procedural challenges
    { id: 'daily_mp_play', text: 'Play Memory Plate', gameSlug: 'memory-plate', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_mp_score', text: `Score ${mpScoreGoal} in Memory Plate`, gameSlug: 'memory-plate', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    { id: 'daily_mp_accuracy', text: `Get ${mpAccuracyGoal}% Accuracy in Memory Plate`, gameSlug: 'memory-plate', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 },
    // Sky Flight procedural challenges
    { id: 'daily_sf_play', text: 'Play Sky Flight', gameSlug: 'sky-flight', target: 1, current: 0, completed: false, xpReward: 100, coinReward: 20 },
    { id: 'daily_sf_distance', text: `Fly ${sfDistanceGoal}m in Sky Flight`, gameSlug: 'sky-flight', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_sf_coins', text: `Collect ${sfCoinsGoal} Coins in Sky Flight`, gameSlug: 'sky-flight', target: 1, current: 0, completed: false, xpReward: 150, coinReward: 30 },
    { id: 'daily_sf_score', text: `Score ${sfScoreGoal} in Sky Flight`, gameSlug: 'sky-flight', target: 1, current: 0, completed: false, xpReward: 200, coinReward: 40 }
  ]
}

// Load, update, and claim daily challenges
export function getStoredDailyChallenges(): DailyChallenge[] {
  if (typeof window === 'undefined') return []
  const todayStr = new Date().toISOString().split('T')[0]
  const storedDate = localStorage.getItem('gamehub_daily_challenges_date')
  
  if (storedDate !== todayStr) {
    const fresh = getDailyChallenges(todayStr)
    localStorage.setItem('gamehub_daily_challenges_date', todayStr)
    localStorage.setItem('gamehub_daily_challenges_data', JSON.stringify(fresh))
    return fresh
  }

  try {
    const raw = localStorage.getItem('gamehub_daily_challenges_data')
    return raw ? JSON.parse(raw) : getDailyChallenges(todayStr)
  } catch {
    const fresh = getDailyChallenges(todayStr)
    return fresh
  }
}

export async function incrementDailyChallengeProgress(
  id: string,
  amount = 1,
  user: any,
  addToast?: (id: string, title: string, message: string) => void
) {
  if (typeof window === 'undefined') return
  const data = getStoredDailyChallenges()
  const idx = data.findIndex(c => c.id === id)
  if (idx === -1) return

  const challenge = data[idx]
  if (challenge.completed) return

  challenge.current = Math.min(challenge.target, challenge.current + amount)
  if (challenge.current >= challenge.target) {
    challenge.completed = true
    
    // Reward Granting
    const showToast = (type: string, title: string, message: string) => {
      if (addToast) {
        addToast(type, title, message)
      } else {
        window.dispatchEvent(
          new CustomEvent('gamehub_toast', {
            detail: { type, title, message },
          })
        )
      }
    }

    showToast(
      'achievement_unlocked',
      'Daily Challenge Completed! 🎯',
      `${challenge.text} (+${challenge.xpReward} XP, +${challenge.coinReward} Coins)`
    )

    if (user) {
      // Authenticated backend claim
      try {
        await fetch('/api/profile/complete-challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            xpReward: challenge.xpReward,
            coinReward: challenge.coinReward,
            challengeId: challenge.id,
          })
        })
        window.dispatchEvent(new Event('gamehub_xp_update'))
      } catch (err) {
        console.error('Failed to claim challenge backend:', err)
      }
    } else {
      // Guest local storage update
      const curXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const curCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      localStorage.setItem('gamehub_guest_xp', (curXP + challenge.xpReward).toString())
      localStorage.setItem('gamehub_guest_coins', (curCoins + challenge.coinReward).toString())
      
      const newLvl = Math.floor(Math.sqrt((curXP + challenge.xpReward) / 100)) + 1
      const oldLvl = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      if (newLvl > oldLvl) {
        localStorage.setItem('gamehub_guest_level', newLvl.toString())
        showToast('level_up', 'Level Up! ⭐', `Congratulations! You reached Level ${newLvl}!`)
      }
      
      window.dispatchEvent(new Event('gamehub_xp_update'))
    }
  }

  localStorage.setItem('gamehub_daily_challenges_data', JSON.stringify(data))
}
