import { prisma } from '@/lib/prisma'
import type { XPEventType } from '@prisma/client'

// ─── XP CONFIG ────────────────────────────────────────────────────────────────
export const XP_REWARDS = {
  MATCH_WIN:     100,
  MATCH_LOSS:     25,
  DAILY_LOGIN:    50,
  ACHIEVEMENT:     0,  // set per-achievement
  STREAK_BONUS:    0,  // calculated dynamically
  MANUAL_GRANT:    0,
} as const

export const GAME_XP_CONFIG: Record<string, { win: number; loss: number; draw: number }> = {
  'cricket':        { win: 100, loss: 25, draw: 50 },
  'tic-tac-toe':    { win: 100, loss: 25, draw: 50 },
  'four-in-a-row':  { win: 100, loss: 25, draw: 50 },
  'scribble':       { win: 100, loss: 25, draw: 50 },
  'dumb-charades':  { win: 100, loss: 25, draw: 50 },
  'whos-spy':       { win: 100, loss: 25, draw: 50 },
  'word-wizard':    { win: 100, loss: 25, draw: 50 },
  'rps':            { win: 100, loss: 25, draw: 50 },
  'number-guessing':{ win: 100, loss: 25, draw: 50 },
  '2048':           { win: 50,  loss: 10, draw: 25 },
  'fighter':        { win: 50,  loss: 10, draw: 25 },
  'ludo':           { win: 100, loss: 25, draw: 50 },
  'memory':         { win: 50,  loss: 10, draw: 25 },
  'snake-arena':    { win: 100, loss: 25, draw: 50 },
}

export function getGameXP(gameSlug: string, result: 'win' | 'loss' | 'draw'): number {
  const config = GAME_XP_CONFIG[gameSlug] || { win: 50, loss: 10, draw: 25 }
  return config[result]
}

import {
  computeLevel,
  xpRequiredForLevel,
  xpForNextLevel,
} from './xpUtils'

export {
  computeLevel,
  xpRequiredForLevel,
  xpForNextLevel,
}


// Streak bonus XP (extra per day after day-3)
export function streakBonus(currentStreak: number): number {
  if (currentStreak < 3) return 0
  if (currentStreak < 7)  return 25
  if (currentStreak < 14) return 50
  if (currentStreak < 30) return 100
  return 150
}

// ─── XP SERVICE ───────────────────────────────────────────────────────────────

/**
 * Award XP to a profile and update its level.
 * Returns { newXP, newLevel, leveledUp }
 */
export async function awardXP(
  profileId: string,
  type: XPEventType,
  amount: number,
  meta?: Record<string, string | number | boolean | null>
): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
  // Log the event
  await prisma.xPEvent.create({
    data: { profileId, type, amount, meta },
  })

  // Update profile
  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: { xp: { increment: amount } },
    select: { xp: true, level: true },
  })

  const newLevel = computeLevel(updated.xp)
  const leveledUp = newLevel > updated.level

  if (leveledUp) {
    await prisma.profile.update({
      where: { id: profileId },
      data: { level: newLevel },
    })
  }

  return { newXP: updated.xp, newLevel, leveledUp }
}

/**
 * Handle daily login XP + streak.
 */
export async function handleDailyLogin(profileId: string) {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { lastLoginDate: true, currentStreak: true, longestStreak: true },
  })

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let newStreak = profile.currentStreak
  let isNewDay = false

  if (!profile.lastLoginDate) {
    // First ever login
    newStreak = 1
    isNewDay = true
  } else {
    const lastLogin = new Date(profile.lastLoginDate)
    const lastDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate())

    if (lastDate.getTime() === today.getTime()) {
      // Already logged in today — no bonus
      return { xpAwarded: 0, newStreak: profile.currentStreak, alreadyClaimed: true }
    } else if (lastDate.getTime() === yesterday.getTime()) {
      newStreak = profile.currentStreak + 1
      isNewDay = true
    } else {
      // Streak broken
      newStreak = 1
      isNewDay = true
    }
  }

  if (!isNewDay) return { xpAwarded: 0, newStreak: profile.currentStreak, alreadyClaimed: true }

  const baseXP = XP_REWARDS.DAILY_LOGIN
  const bonus = streakBonus(newStreak)
  const totalXP = baseXP + bonus

  // Update streak
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, profile.longestStreak),
      lastLoginDate: now,
    },
  })

  // Award base XP
  await awardXP(profileId, 'DAILY_LOGIN', baseXP, { streak: newStreak })

  // Award streak bonus if applicable
  if (bonus > 0) {
    await awardXP(profileId, 'STREAK_BONUS', bonus, { streak: newStreak })
  }

  return { xpAwarded: totalXP, newStreak, alreadyClaimed: false }
}
