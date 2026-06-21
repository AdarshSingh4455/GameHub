import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface UnlockedAchievementInfo {
  slug: string
  name: string
  description: string
  xpReward: number
  coinReward: number
  category: string
}

export interface AchievementProgressInfo {
  slug: string
  name: string
  description: string
  category: 'Gameplay' | 'Wins' | 'Streaks' | 'Social' | 'Special'
  current: number
  target: number
  progressPercentage: number
  isUnlocked: boolean
  xpReward: number
  coinReward: number
}

interface AchievementRule {
  slug: string
  check: (params: {
    profileId: string
    gameSlug: string
    result: 'win' | 'loss' | 'draw'
    tx: Prisma.TransactionClient
  }) => Promise<boolean>
}

export const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    slug: 'first-game',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
      })
      return count >= 1
    },
  },
  {
    slug: 'first-win',
    check: async ({ profileId, result, tx }) => {
      if (result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 1
    },
  },
  {
    slug: 'cricket-hat-trick',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'cricket' || result !== 'win') return false
      const matches = await tx.matchRecord.findMany({
        where: {
          game: { slug: 'cricket' },
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
        orderBy: { playedAt: 'desc' },
        take: 3,
      })
      return matches.length === 3 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'ttt-undefeated',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'tic-tac-toe' || result !== 'win') return false
      const matches = await tx.matchRecord.findMany({
        where: {
          game: { slug: 'tic-tac-toe' },
          OR: [
            { player1Id: profileId },
            { player2Id: profileId },
          ],
        },
        orderBy: { playedAt: 'desc' },
        take: 10,
      })
      return matches.length === 10 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'level-5',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 5
    },
  },
  {
    slug: 'level-10',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 10
    },
  },
  {
    slug: 'level-25',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { level: true },
      })
      return (profile?.level ?? 1) >= 25
    },
  },
  // --- Sprint 2 Additions ---
  {
    slug: 'games-5',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 5
    },
  },
  {
    slug: 'games-25',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 25
    },
  },
  {
    slug: 'games-100',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
      })
      return count >= 100
    },
  },
  {
    slug: 'wins-5',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 5
    },
  },
  {
    slug: 'wins-20',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 20
    },
  },
  {
    slug: 'wins-50',
    check: async ({ profileId, tx }) => {
      const count = await tx.matchRecord.count({
        where: { winnerId: profileId },
      })
      return count >= 50
    },
  },
  {
    slug: 'win-streak-3',
    check: async ({ profileId, tx }) => {
      const matches = await tx.matchRecord.findMany({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
        orderBy: { playedAt: 'desc' },
        take: 3,
      })
      return matches.length === 3 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'win-streak-5',
    check: async ({ profileId, tx }) => {
      const matches = await tx.matchRecord.findMany({
        where: {
          OR: [{ player1Id: profileId }, { player2Id: profileId }],
        },
        orderBy: { playedAt: 'desc' },
        take: 5,
      })
      return matches.length === 5 && matches.every((m) => m.winnerId === profileId)
    },
  },
  {
    slug: 'cricket-century',
    check: async ({ profileId, tx }) => {
      const agg = await tx.score.aggregate({
        where: {
          profileId,
          game: { slug: 'cricket' },
        },
        _sum: { score: true },
      })
      return (agg._sum.score ?? 0) >= 100
    },
  },
  {
    slug: 'ttt-perfect',
    check: async ({ profileId, tx }) => {
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'tic-tac-toe' },
        },
      })
      return scores.some((s) => {
        const meta = s.metadata as Record<string, unknown> | null
        const moves = meta?.moves as number | undefined
        return moves !== undefined && moves <= 5
      })
    },
  },
  {
    slug: 'streak-3',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 3
    },
  },
  {
    slug: 'streak-7',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 7
    },
  },
  {
    slug: 'streak-30',
    check: async ({ profileId, tx }) => {
      const profile = await tx.profile.findUnique({
        where: { id: profileId },
        select: { currentStreak: true },
      })
      return (profile?.currentStreak ?? 0) >= 30
    },
  },
  // --- Water Connect Achievements ---
  {
    slug: 'wc-first-flow',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'water-connect' || result !== 'win') return false
      const count = await tx.score.count({
        where: {
          profileId,
          game: { slug: 'water-connect' },
        },
      })
      return count >= 1
    },
  },
  {
    slug: 'wc-apprentice',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'water-connect' || result !== 'win') return false
      const count = await tx.score.count({
        where: {
          profileId,
          game: { slug: 'water-connect' },
        },
      })
      return count >= 5
    },
  },
  {
    slug: 'wc-master',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'water-connect' || result !== 'win') return false
      const count = await tx.score.count({
        where: {
          profileId,
          game: { slug: 'water-connect' },
        },
      })
      return count >= 25
    },
  },
  {
    slug: 'wc-25-completed',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'water-connect' || result !== 'win') return false
      const count = await tx.score.count({
        where: {
          profileId,
          game: { slug: 'water-connect' },
        },
      })
      return count >= 25
    },
  },
  // --- Dots & Boxes Achievements ---
  {
    slug: 'db-first-victory',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'dots-boxes' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: {
          winnerId: profileId,
          game: { slug: 'dots-boxes' },
        },
      })
      return count >= 1
    },
  },
  {
    slug: 'db-box-collector',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'dots-boxes') return false
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'dots-boxes' },
        },
      })
      let totalBoxes = 0
      for (const s of scores) {
        const meta = s.metadata as Record<string, any> | null
        if (meta && typeof meta.p1Boxes === 'number') {
          totalBoxes += meta.p1Boxes
        }
      }
      return totalBoxes >= 50
    },
  },
  {
    slug: 'db-chain-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'dots-boxes') return false
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'dots-boxes' },
        },
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxChainLength === 'number' && meta.maxChainLength >= 5
      })
    },
  },
  {
    slug: 'db-online-champion',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'dots-boxes' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: {
          winnerId: profileId,
          game: { slug: 'dots-boxes' },
          roomCode: { not: null }
        },
      })
      return count >= 1
    },
  },
  // --- Block Blast Achievements ---
  {
    slug: 'bb-first-placement',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.placements === 'number' && meta.placements >= 1
      })
    }
  },
  {
    slug: 'bb-first-clear',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.linesCleared === 'number' && meta.linesCleared >= 1
      })
    }
  },
  {
    slug: 'bb-1000-club',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const maxScore = await tx.score.aggregate({
        where: { profileId, game: { slug: 'block-blast' } },
        _max: { score: true }
      })
      return (maxScore._max.score ?? 0) >= 1000
    }
  },
  {
    slug: 'bb-5000-club',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const maxScore = await tx.score.aggregate({
        where: { profileId, game: { slug: 'block-blast' } },
        _max: { score: true }
      })
      return (maxScore._max.score ?? 0) >= 5000
    }
  },
  {
    slug: 'bb-combo-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxCombo === 'number' && meta.maxCombo >= 5
      })
    }
  },
  {
    slug: 'bb-line-destroyer',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      let total = 0
      for (const s of scores) {
        const meta = s.metadata as Record<string, any> | null
        if (meta && typeof meta.linesCleared === 'number') {
          total += meta.linesCleared
        }
      }
      return total >= 100
    }
  },
  {
    slug: 'bb-champion',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'block-blast' },
        },
        select: { score: true, metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        const mode = meta?.mode ?? 'classic'
        return mode === 'classic' && s.score >= 3000
      })
    }
  },
  {
    slug: 'bb-clean-slate',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && meta.cleanSlate === 1
      })
    }
  },
  {
    slug: 'bb-survivor',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'block-blast' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.placements === 'number' && meta.placements >= 100
      })
    }
  },
  {
    slug: 'bb-daily-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'block-blast') return false
      const scores = await tx.score.findMany({
        where: {
          profileId,
          game: { slug: 'block-blast' },
        },
        select: { score: true, metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        const mode = meta?.mode ?? 'classic'
        return mode === 'daily' && s.score >= 3000
      })
    }
  },
  // --- Neon Tetris Achievements ---
  {
    slug: 'nt-first-clear',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.linesCleared === 'number' && meta.linesCleared >= 1
      })
    }
  },
  {
    slug: 'nt-tetris-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && meta.hasTetris === true
      })
    }
  },
  {
    slug: 'nt-combo-5',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxCombo === 'number' && meta.maxCombo >= 5
      })
    }
  },
  {
    slug: 'nt-combo-10',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxCombo === 'number' && meta.maxCombo >= 10
      })
    }
  },
  {
    slug: 'nt-level-10',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.level === 'number' && meta.level >= 10
      })
    }
  },
  {
    slug: 'nt-perfect-clear',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.perfectClears === 'number' && meta.perfectClears >= 1
      })
    }
  },
  {
    slug: 'nt-survivor',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.piecesPlaced === 'number' && meta.piecesPlaced >= 100
      })
    }
  },
  {
    slug: 'nt-daily-winner',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'neon-tetris') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'neon-tetris' } },
        select: { score: true, metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        const mode = meta?.mode ?? 'classic'
        return mode === 'daily' && s.score >= 1500
      })
    }
  },
  // --- Word Wizard Achievements ---
  {
    slug: 'ww-first-word',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.wordsFound === 'number' && meta.wordsFound >= 1
      })
    }
  },
  {
    slug: 'ww-word-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      let total = 0
      for (const s of scores) {
        const meta = s.metadata as Record<string, any> | null
        if (meta && typeof meta.wordsFound === 'number') {
          total += meta.wordsFound
        }
      }
      return total >= 50
    }
  },
  {
    slug: 'ww-score-2000',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { score: true }
      })
      return scores.some(s => s.score >= 2000)
    }
  },
  {
    slug: 'ww-score-5000',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { score: true }
      })
      return scores.some(s => s.score >= 5000)
    }
  },
  {
    slug: 'ww-combo-5',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxCombo === 'number' && meta.maxCombo >= 5
      })
    }
  },
  {
    slug: 'ww-combo-10',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxCombo === 'number' && meta.maxCombo >= 10
      })
    }
  },
  {
    slug: 'ww-daily-champion',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { score: true, metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        const mode = meta?.mode ?? 'classic'
        return mode === 'daily' && s.score >= 2000
      })
    }
  },
  {
    slug: 'ww-no-hints',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.hintsUsed === 'number' && meta.hintsUsed === 0
      })
    }
  },
  {
    slug: 'ww-rare-letter-hunter',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      let totalRare = 0
      for (const s of scores) {
        const meta = s.metadata as Record<string, any> | null
        if (meta && typeof meta.rareWordsCount === 'number') {
          totalRare += meta.rareWordsCount
        }
      }
      return totalRare >= 5
    }
  },
  {
    slug: 'ww-vocabulary-king',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'word-wizard') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'word-wizard' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.maxWordLength === 'number' && meta.maxWordLength >= 7
      })
    }
  },
  {
    slug: 'hangman-first-win',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { game: { slug: 'hangman' }, winnerId: profileId },
      })
      return count >= 1
    }
  },
  {
    slug: 'hangman-wins-10',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { game: { slug: 'hangman' }, winnerId: profileId },
      })
      return count >= 10
    }
  },
  {
    slug: 'hangman-wins-25',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { game: { slug: 'hangman' }, winnerId: profileId },
      })
      return count >= 25
    }
  },
  {
    slug: 'hangman-wins-100',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const count = await tx.matchRecord.count({
        where: { game: { slug: 'hangman' }, winnerId: profileId },
      })
      return count >= 100
    }
  },
  {
    slug: 'hangman-perfect-solver',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'hangman' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.incorrectGuesses === 'number' && meta.incorrectGuesses === 0
      })
    }
  },
  {
    slug: 'hangman-no-wrong-guess',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'hangman' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.incorrectGuesses === 'number' && meta.incorrectGuesses === 0
      })
    }
  },
  {
    slug: 'hangman-fast-thinker',
    check: async ({ profileId, gameSlug, result, tx }) => {
      if (gameSlug !== 'hangman' || result !== 'win') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'hangman' } },
        select: { metadata: true }
      })
      return scores.some(s => {
        const meta = s.metadata as Record<string, any> | null
        return meta && typeof meta.timeTakenSecs === 'number' && meta.timeTakenSecs < 30
      })
    }
  },
  {
    slug: 'hangman-word-master',
    check: async ({ profileId, gameSlug, tx }) => {
      if (gameSlug !== 'hangman') return false
      const scores = await tx.score.findMany({
        where: { profileId, game: { slug: 'hangman' } },
        select: { metadata: true }
      })
      let totalCorrect = 0
      for (const s of scores) {
        const meta = s.metadata as Record<string, any> | null
        if (meta && typeof meta.correctGuesses === 'number') {
          totalCorrect += meta.correctGuesses
        }
      }
      return totalCorrect >= 50
    }
  },
]

/**
 * Checks all rules for achievements not yet unlocked by this profile.
 * Unlocks qualifying achievements, increments XP & Coins in the transaction,
 * logs XPEvent and AnalyticsEvent, and returns the list of newly unlocked achievements.
 */
export async function checkAndUnlockAchievements(
  profileId: string,
  gameSlug: string,
  result: 'win' | 'loss' | 'draw',
  tx: Prisma.TransactionClient
): Promise<UnlockedAchievementInfo[]> {
  const unlocked = await tx.userAchievement.findMany({
    where: { profileId },
    select: { achievement: { select: { slug: true } } },
  })
  const unlockedSlugs = new Set(unlocked.map((ua) => ua.achievement.slug))

  const newlyUnlocked: UnlockedAchievementInfo[] = []

  for (const rule of ACHIEVEMENT_RULES) {
    if (unlockedSlugs.has(rule.slug)) continue

    const isEligible = await rule.check({ profileId, gameSlug, result, tx })
    if (isEligible) {
      const achievement = await tx.achievement.findUnique({
        where: { slug: rule.slug },
      })

      if (achievement) {
        await tx.userAchievement.create({
          data: {
            profileId,
            achievementId: achievement.id,
          },
        })

        await tx.profile.update({
          where: { id: profileId },
          data: {
            xp: { increment: achievement.xpReward },
            coins: { increment: achievement.coinReward },
          },
        })

        if (achievement.xpReward > 0) {
          await tx.xPEvent.create({
            data: {
              profileId,
              type: 'ACHIEVEMENT',
              amount: achievement.xpReward,
              meta: { achievementSlug: rule.slug },
            },
          })
        }

        // Analytics event hook for achievement unlocked
        await tx.analyticsEvent.create({
          data: {
            profileId,
            eventName: 'achievement_unlocked',
            metadata: {
              achievementSlug: rule.slug,
              xpReward: achievement.xpReward,
              coinReward: achievement.coinReward,
            },
          },
        })

        newlyUnlocked.push({
          slug: achievement.slug,
          name: achievement.name,
          description: achievement.description,
          xpReward: achievement.xpReward,
          coinReward: achievement.coinReward,
          category: achievement.category,
        })
      }
    }
  }

  return newlyUnlocked
}

/**
 * Calculates current progress for all achievements to display in the UI.
 */
export async function getAchievementProgress(profileId: string): Promise<AchievementProgressInfo[]> {
  const [
    allAchievements,
    unlocked,
    profile,
    totalGames,
    totalWins,
    lastMatches,
    cricketAgg,
    tttScores
  ] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({
      where: { profileId },
      select: { achievementId: true },
    }),
    prisma.profile.findUnique({
      where: { id: profileId },
      select: { level: true, currentStreak: true },
    }),
    prisma.matchRecord.count({
      where: {
        OR: [{ player1Id: profileId }, { player2Id: profileId }],
      },
    }),
    prisma.matchRecord.count({
      where: { winnerId: profileId },
    }),
    prisma.matchRecord.findMany({
      where: {
        OR: [{ player1Id: profileId }, { player2Id: profileId }],
      },
      include: {
        game: true,
      },
      orderBy: { playedAt: 'desc' },
    }),
    prisma.score.aggregate({
      where: {
        profileId,
        game: { slug: 'cricket' },
      },
      _sum: { score: true },
    }),
    prisma.score.findMany({
      where: {
        profileId,
        game: { slug: 'tic-tac-toe' },
      },
    })
  ])

  const unlockedIds = new Set(unlocked.map((ua) => ua.achievementId))
  const level = profile?.level ?? 1
  const streak = profile?.currentStreak ?? 0

  let currentWinStreak = 0
  for (const m of lastMatches) {
    if (m.winnerId === profileId) currentWinStreak++
    else break
  }

  const cricketRuns = cricketAgg._sum.score ?? 0

  const hasPerfectTTT = tttScores.some((s) => {
    const meta = s.metadata as Record<string, unknown> | null
    const moves = meta?.moves as number | undefined
    return moves !== undefined && moves <= 5
  }) ? 1 : 0

  const progressList: AchievementProgressInfo[] = []

  for (const a of allAchievements) {
    const isUnlocked = unlockedIds.has(a.id)
    let current = 0
    let target = 1

    // Determine category matching: Gameplay, Wins, Streaks, Social, Special
    const cat = (a.category.charAt(0).toUpperCase() + a.category.slice(1)) as AchievementProgressInfo['category']

    switch (a.slug) {
      case 'first-game':
        current = totalGames >= 1 ? 1 : 0
        target = 1
        break
      case 'first-win':
        current = totalWins >= 1 ? 1 : 0
        target = 1
        break
      case 'games-5':
        current = totalGames
        target = 5
        break
      case 'games-25':
        current = totalGames
        target = 25
        break
      case 'games-100':
        current = totalGames
        target = 100
        break
      case 'wins-5':
        current = totalWins
        target = 5
        break
      case 'wins-20':
        current = totalWins
        target = 20
        break
      case 'wins-50':
        current = totalWins
        target = 50
        break
      case 'win-streak-3':
        current = currentWinStreak
        target = 3
        break
      case 'win-streak-5':
        current = currentWinStreak
        target = 5
        break
      case 'streak-3':
        current = streak
        target = 3
        break
      case 'streak-7':
        current = streak
        target = 7
        break
      case 'streak-30':
        current = streak
        target = 30
        break
      case 'cricket-hat-trick':
        // Last 3 matches in cricket
        const cricketMatches = lastMatches.filter((m) => m.game?.slug === 'cricket')
        let cricketWinStreak = 0
        for (const m of cricketMatches) {
          if (m.winnerId === profileId) cricketWinStreak++
          else break
        }
        current = cricketWinStreak
        target = 3
        break
      case 'ttt-undefeated':
        const tttMatches = lastMatches.filter((m) => m.game?.slug === 'tic-tac-toe')
        let tttWinStreak = 0
        for (const m of tttMatches) {
          if (m.winnerId === profileId) tttWinStreak++
          else break
        }
        current = tttWinStreak
        target = 10
        break
      case 'cricket-century':
        current = cricketRuns
        target = 100
        break
      case 'ttt-perfect':
        current = hasPerfectTTT
        target = 1
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
      case 'social-butterfly':
        // Count friendships accepted
        const friendsCount = await prisma.friendship.count({
          where: {
            status: 'ACCEPTED',
            OR: [{ requesterId: profileId }, { addresseeId: profileId }],
          },
        })
        current = friendsCount
        target = 5
        break
      case 'color-sort-first-pour':
        const csPlays = await prisma.score.count({
          where: { profileId, game: { slug: 'color-sort' } },
        })
        current = csPlays >= 1 ? 1 : 0
        target = 1
        break
      case 'color-sort-apprentice':
        current = await getProgMaxLevel(profileId, 'color-sort')
        target = 5
        break
      case 'color-sort-master':
        current = await getProgMaxLevel(profileId, 'color-sort')
        target = 25
        break
      case 'color-sort-no-hint':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'color-sort-perfect':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'traffic-first-escape':
        const trPlays = await prisma.score.count({
          where: { profileId, game: { slug: 'unblock-traffic' } },
        })
        current = trPlays >= 1 ? 1 : 0
        target = 1
        break
      case 'traffic-officer':
        current = await getProgMaxLevel(profileId, 'unblock-traffic')
        target = 5
        break
      case 'traffic-grid-master':
        current = await getProgMaxLevel(profileId, 'unblock-traffic')
        target = 25
        break
      case 'traffic-no-hint':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'traffic-legend':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'wc-first-flow':
        const wcPlays = await prisma.score.count({
          where: { profileId, game: { slug: 'water-connect' } },
        })
        current = wcPlays >= 1 ? 1 : 0
        target = 1
        break
      case 'wc-apprentice':
        const wcCountApp = await prisma.score.count({
          where: { profileId, game: { slug: 'water-connect' } },
        })
        current = wcCountApp
        target = 5
        break
      case 'wc-master':
      case 'wc-25-completed':
        const wcCountMast = await prisma.score.count({
          where: { profileId, game: { slug: 'water-connect' } },
        })
        current = wcCountMast
        target = 25
        break
      case 'db-first-victory':
        const dbWins = await prisma.matchRecord.count({
          where: { winnerId: profileId, game: { slug: 'dots-boxes' } },
        })
        current = dbWins >= 1 ? 1 : 0
        target = 1
        break
      case 'db-box-collector':
        const dbScores = await prisma.score.findMany({
          where: { profileId, game: { slug: 'dots-boxes' } },
          select: { metadata: true }
        })
        let dbBoxes = 0
        for (const s of dbScores) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.p1Boxes === 'number') {
            dbBoxes += meta.p1Boxes
          }
        }
        current = dbBoxes
        target = 50
        break
      case 'db-chain-master':
        const dbScoresChain = await prisma.score.findMany({
          where: { profileId, game: { slug: 'dots-boxes' } },
          select: { metadata: true }
        })
        let maxChain = 0
        for (const s of dbScoresChain) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.maxChainLength === 'number') {
            maxChain = Math.max(maxChain, meta.maxChainLength)
          }
        }
        current = maxChain
        target = 5
        break
      case 'db-online-champion':
        const dbOnlineWins = await prisma.matchRecord.count({
          where: {
            winnerId: profileId,
            game: { slug: 'dots-boxes' },
            roomCode: { not: null }
          },
        })
        current = dbOnlineWins >= 1 ? 1 : 0
        target = 1
        break
      case 'bb-first-placement':
      case 'bb-first-clear':
      case 'bb-1000-club':
      case 'bb-5000-club':
      case 'bb-combo-master':
      case 'bb-champion':
      case 'bb-clean-slate':
      case 'bb-survivor':
      case 'bb-daily-master':
      case 'nt-first-clear':
      case 'nt-tetris-master':
      case 'nt-combo-5':
      case 'nt-combo-10':
      case 'nt-level-10':
      case 'nt-perfect-clear':
      case 'nt-survivor':
      case 'nt-daily-winner':
      case 'ww-first-word':
      case 'ww-score-2000':
      case 'ww-score-5000':
      case 'ww-combo-5':
      case 'ww-combo-10':
      case 'ww-daily-champion':
      case 'ww-no-hints':
      case 'ww-vocabulary-king':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'bb-line-destroyer':
        const bbScores = await prisma.score.findMany({
          where: { profileId, game: { slug: 'block-blast' } },
          select: { metadata: true }
        })
        let totalBBLines = 0
        for (const s of bbScores) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.linesCleared === 'number') {
            totalBBLines += meta.linesCleared
          }
        }
        current = totalBBLines
        target = 100
        break
      case 'ww-word-master':
        const wwScoresMaster = await prisma.score.findMany({
          where: { profileId, game: { slug: 'word-wizard' } },
          select: { metadata: true }
        })
        let totalWordsSpelled = 0
        for (const s of wwScoresMaster) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.wordsFound === 'number') {
            totalWordsSpelled += meta.wordsFound
          }
        }
        current = totalWordsSpelled
        target = 50
        break
      case 'ww-rare-letter-hunter':
        const wwScoresRare = await prisma.score.findMany({
          where: { profileId, game: { slug: 'word-wizard' } },
          select: { metadata: true }
        })
        let totalRareWords = 0
        for (const s of wwScoresRare) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.rareWordsCount === 'number') {
            totalRareWords += meta.rareWordsCount
          }
        }
        current = totalRareWords
        target = 5
        break
      case 'hangman-first-win':
        const hWins = await prisma.matchRecord.count({
          where: { game: { slug: 'hangman' }, winnerId: profileId }
        })
        current = hWins >= 1 ? 1 : 0
        target = 1
        break
      case 'hangman-wins-10':
        current = await prisma.matchRecord.count({
          where: { game: { slug: 'hangman' }, winnerId: profileId }
        })
        target = 10
        break
      case 'hangman-wins-25':
        current = await prisma.matchRecord.count({
          where: { game: { slug: 'hangman' }, winnerId: profileId }
        })
        target = 25
        break
      case 'hangman-wins-100':
        current = await prisma.matchRecord.count({
          where: { game: { slug: 'hangman' }, winnerId: profileId }
        })
        target = 100
        break
      case 'hangman-perfect-solver':
      case 'hangman-no-wrong-guess':
      case 'hangman-fast-thinker':
        current = isUnlocked ? 1 : 0
        target = 1
        break
      case 'hangman-word-master':
        const hScores = await prisma.score.findMany({
          where: { profileId, game: { slug: 'hangman' } },
          select: { metadata: true }
        })
        let totalHCorrect = 0
        for (const s of hScores) {
          const meta = s.metadata as Record<string, any> | null
          if (meta && typeof meta.correctGuesses === 'number') {
            totalHCorrect += meta.correctGuesses
          }
        }
        current = totalHCorrect
        target = 50
        break
      default:
        current = isUnlocked ? 1 : 0
        target = 1
    }

    if (isUnlocked) {
      current = target
    }

    progressList.push({
      slug: a.slug,
      name: a.name,
      description: a.description,
      category: cat,
      current,
      target,
      progressPercentage: Math.min(100, Math.round((current / target) * 100)),
      isUnlocked,
      xpReward: a.xpReward,
      coinReward: a.coinReward,
    })
  }

  return progressList
}

async function getProgMaxLevel(profileId: string, gameSlug: string): Promise<number> {
  const scores = await prisma.score.findMany({
    where: {
      profileId,
      game: { slug: gameSlug },
    },
    select: { metadata: true },
  })
  let maxLevel = 0
  for (const s of scores) {
    const meta = s.metadata as Record<string, any> | null
    if (meta && typeof meta.level === 'number') {
      maxLevel = Math.max(maxLevel, meta.level)
    }
  }
  return maxLevel
}
