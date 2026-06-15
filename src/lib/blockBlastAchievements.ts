export interface AchievementDefinition {
  slug: string
  name: string
  description: string
  xpReward: number
  coinReward: number
  category: string
  gameSlug: string
}

export const BLOCK_BLAST_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    slug: 'bb-first-placement',
    name: 'First Placement',
    description: 'Place your first block piece in Block Blast.',
    xpReward: 50,
    coinReward: 10,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-first-clear',
    name: 'First Clear',
    description: 'Clear a row or column in Block Blast.',
    xpReward: 100,
    coinReward: 20,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-1000-club',
    name: '1000 Score Club',
    description: 'Reach a score of 1,000 points in Block Blast.',
    xpReward: 150,
    coinReward: 30,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-5000-club',
    name: '5000 Score Club',
    description: 'Reach a score of 5,000 points in Block Blast.',
    xpReward: 400,
    coinReward: 100,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-combo-master',
    name: 'Combo Master',
    description: 'Achieve a combo chain of 5 or more in a single game.',
    xpReward: 200,
    coinReward: 50,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-line-destroyer',
    name: 'Line Destroyer',
    description: 'Clear a total of 100 rows or columns across all games.',
    xpReward: 300,
    coinReward: 75,
    category: 'gameplay',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-champion',
    name: 'Block Blast Champion',
    description: 'Reach a score of 3,000 points in Classic Mode.',
    xpReward: 250,
    coinReward: 50,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-clean-slate',
    name: 'Clean Slate',
    description: 'Completely empty the entire board after clearing lines.',
    xpReward: 300,
    coinReward: 75,
    category: 'special',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-survivor',
    name: 'Survivor',
    description: 'Survive 100 block placements in a single game.',
    xpReward: 250,
    coinReward: 50,
    category: 'gameplay',
    gameSlug: 'block-blast',
  },
  {
    slug: 'bb-daily-master',
    name: 'Daily Master',
    description: 'Finish a Daily Challenge with a score of 3,000+ points.',
    xpReward: 300,
    coinReward: 75,
    category: 'special',
    gameSlug: 'block-blast',
  },
]
