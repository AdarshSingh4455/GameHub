import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getGameXP, computeLevel } from '@/lib/xp'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import { recalculateLeaderboardRanks } from '@/lib/ranks'
import { Prisma } from '@prisma/client'
import { checkAndUnlockProgressionItems } from '@/lib/cosmeticUnlocks'

export async function POST(request: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    console.log('[GAME_OVER_PAYLOAD]', body)

    if (!body || !body.gameSlug || !body.result) {
      console.warn('[GAME_OVER_INVALID_PAYLOAD]', body)
      return NextResponse.json(
        { error: 'Invalid payload' },
        { status: 400 }
      )
    }

    const { gameSlug, result, metadata } = body

    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        gameSlug,
        result,
        xpGained: 100,
        coinsGained: 20,
        oldXP: 1500,
        newXP: 1600,
        oldLevel: 5,
        newLevel: 5,
        leveledUp: false,
        currentStreak: 4,
        unlockedAchievements: [],
        nextAchievement: {
          name: 'Reach Level 10',
          current: 5,
          target: 10,
          progress: 50,
        },
      }, { status: 200 })
    }

    // 1. Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Fetch profile
    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 3. Parse request body

    if (!gameSlug || !result) {
      return NextResponse.json({ error: 'Missing gameSlug or result' }, { status: 400 })
    }

    if (!['win', 'loss', 'draw'].includes(result)) {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    }

    // 4. Submit game result in transaction
    const responsePayload = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Find game
      const game = await tx.game.findUnique({
        where: { slug: gameSlug },
      })
      if (!game) {
        throw new Error(`Game not found: ${gameSlug}`)
      }

      // Fetch resolved game XP rewards from central config
      let baseXP = getGameXP(gameSlug, result)
      let baseCoins = result === 'win' ? 20 : 5

      if (gameSlug === 'block-blast') {
        const score = metadata?.score ?? 0
        const gameMeta = metadata?.gameMetadata ?? {}
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
        const score = metadata?.score ?? 0
        const gameMeta = metadata?.gameMetadata ?? {}
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

      // Record match history
      await tx.matchRecord.create({
        data: {
          gameId: game.id,
          player1Id: profile.id,
          player1Score: metadata?.score ?? 0,
          player2Score: metadata?.opponentScore ?? 0,
          winnerId: result === 'win' ? profile.id : null,
          durationSecs: metadata?.durationSecs ?? null,
          xpEarned: baseXP,
          coinsEarned: baseCoins,
        },
      })

      // Record score if applicable
      if (metadata?.score !== undefined) {
        await tx.score.create({
          data: {
            profileId: profile.id,
            gameId: game.id,
            score: metadata.score,
            metadata: metadata?.gameMetadata ?? null,
          },
        })
      }

      // Update incremental game stats for favorites/high scores
      const stats = await tx.profileGameStats.findUnique({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
      })
      const newHighScore = Math.max(stats?.highScore ?? 0, metadata?.score ?? 0)

      await tx.profileGameStats.upsert({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
        create: {
          profileId: profile.id,
          gameSlug,
          playCount: 1,
          winCount: result === 'win' ? 1 : 0,
          highScore: metadata?.score ?? 0,
        },
        update: {
          playCount: { increment: 1 },
          winCount: { increment: result === 'win' ? 1 : 0 },
          highScore: newHighScore,
          lastPlayed: new Date(),
        },
      })

      // Increment profile base rewards
      const updatedProfile = await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: baseXP },
          coins: { increment: baseCoins },
        },
      })

      // Record XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: result === 'win' ? 'MATCH_WIN' : 'MATCH_LOSS',
          amount: baseXP,
          meta: { gameSlug },
        },
      })

      // Check for achievements
      const newlyUnlocked = await checkAndUnlockAchievements(profile.id, gameSlug, result, tx)

      // Calculate total rewards
      const totalXPGained = baseXP + newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0)
      const totalCoinsGained = baseCoins + newlyUnlocked.reduce((sum, a) => sum + a.coinReward, 0)

      const finalXP = profile.xp + totalXPGained
      const finalLevel = computeLevel(finalXP)
      const leveledUp = finalLevel > profile.level

      if (leveledUp) {
        await tx.profile.update({
          where: { id: profile.id },
          data: { level: finalLevel },
        })

        // Log LevelUp analytics event
        await tx.analyticsEvent.create({
          data: {
            profileId: profile.id,
            eventName: 'level_up',
            metadata: {
              oldLevel: profile.level,
              newLevel: finalLevel,
            },
          },
        })
      }

      // Calculate next achievement progress
      const unlockedSlugs = new Set(
        (await tx.userAchievement.findMany({
          where: { profileId: profile.id },
          select: { achievement: { select: { slug: true } } },
        })).map((ua: any) => ua.achievement.slug)
      )

      let nextAchievement = { name: 'Veteran Player', progress: 0, target: 10, current: 0 }

      if (gameSlug === 'cricket' && !unlockedSlugs.has('cricket-hat-trick')) {
        // Cricket win streak
        const lastCricket = await tx.matchRecord.findMany({
          where: {
            game: { slug: 'cricket' },
            OR: [{ player1Id: profile.id }, { player2Id: profile.id }],
          },
          orderBy: { playedAt: 'desc' },
          take: 3,
        })
        let currentStreak = 0
        for (const m of lastCricket) {
          if (m.winnerId === profile.id) currentStreak++
          else break
        }
        nextAchievement = {
          name: 'Hat Trick (Cricket)',
          current: currentStreak,
          target: 3,
          progress: Math.min(100, Math.round((currentStreak / 3) * 100)),
        }
      } else if (gameSlug === 'tic-tac-toe' && !unlockedSlugs.has('ttt-undefeated')) {
        // TTT win streak
        const lastTTT = await tx.matchRecord.findMany({
          where: {
            game: { slug: 'tic-tac-toe' },
            OR: [{ player1Id: profile.id }, { player2Id: profile.id }],
          },
          orderBy: { playedAt: 'desc' },
          take: 10,
        })
        let currentStreak = 0
        for (const m of lastTTT) {
          if (m.winnerId === profile.id) currentStreak++
          else break
        }
        nextAchievement = {
          name: 'Undefeated (Tic-Tac-Toe)',
          current: currentStreak,
          target: 10,
          progress: Math.min(100, Math.round((currentStreak / 10) * 100)),
        }
      } else if (gameSlug === 'four-in-a-row' && !unlockedSlugs.has('four-in-a-row-wins-10')) {
        const count = await tx.matchRecord.count({
          where: {
            game: { slug: 'four-in-a-row' },
            winnerId: profile.id,
          },
        })
        nextAchievement = {
          name: 'Disc Dropper (4 In A Row)',
          current: count,
          target: 10,
          progress: Math.min(100, Math.round((count / 10) * 100)),
        }
      } else if (!unlockedSlugs.has('first-win')) {
        const totalWins = await tx.matchRecord.count({ where: { winnerId: profile.id } })
        nextAchievement = {
          name: 'First Win',
          current: totalWins > 0 ? 1 : 0,
          target: 1,
          progress: totalWins > 0 ? 100 : 0,
        }
      } else {
        // Fallback: Level milestone
        const nextMilestone = finalLevel < 5 ? 5 : finalLevel < 10 ? 10 : 25
        nextAchievement = {
          name: `Reach Level ${nextMilestone}`,
          current: finalLevel,
          target: nextMilestone,
          progress: Math.min(100, Math.round((finalLevel / nextMilestone) * 100)),
        }
      }

      // Recalculate ranks based on new XP
      await recalculateLeaderboardRanks(tx)

      // Fetch all user wins to evaluate win-based cosmetics
      const allStats = await tx.profileGameStats.findMany({
        where: { profileId: profile.id }
      })
      const totalWins = allStats.reduce((sum, s) => sum + (s.winCount || 0), 0)

      // Call progression unlock check to award newly unlocked items (frames, titles, effects)
      const newlyUnlockedCosmetics = await checkAndUnlockProgressionItems(
        profile.id,
        finalLevel,
        updatedProfile.currentStreak,
        totalWins,
        tx
      )

      return {
        gameSlug,
        result,
        xpGained: totalXPGained,
        coinsGained: totalCoinsGained,
        oldXP: profile.xp,
        newXP: finalXP,
        oldLevel: profile.level,
        newLevel: finalLevel,
        leveledUp,
        currentStreak: updatedProfile.currentStreak,
        unlockedAchievements: newlyUnlocked,
        newlyUnlockedCosmetics,
        nextAchievement,
        highScore: newHighScore,
        metadata,
      }
    }, { maxWait: 15000, timeout: 30000 })

    return NextResponse.json(responsePayload, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/games/game-over]', err)
    const errMsg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
