import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { parse } from 'pg-connection-string'

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes(':6543/')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(':6543/', ':5432/')
}

const connectionString = process.env.DATABASE_URL
let config: pg.PoolConfig = {}
if (connectionString) {
  config = parse(connectionString) as pg.PoolConfig
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = {
      rejectUnauthorized: false
    }
  }
}

const pool = new pg.Pool(config)
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const games = [
  // Tier A — fully rewritten, multiplayer first
  { slug: 'cricket',        name: 'Hand Cricket',        description: 'Battle with numbers — classic hand cricket!',               type: 'REWRITTEN', isMultiplay: true,  category: 'social'   },
  { slug: 'scribble',       name: 'Scribble',            description: 'Draw and guess with friends in real time.',                 type: 'REWRITTEN', isMultiplay: true,  category: 'social'   },
  { slug: 'dumb-charades',  name: 'Dumb Charades',       description: 'Describe the word through text clues!',                    type: 'REWRITTEN', isMultiplay: true,  category: 'social'   },
  { slug: 'whos-spy',       name: "Who's Spy",           description: 'Find the spy hiding among your crew.',                     type: 'REWRITTEN', isMultiplay: true,  category: 'social'   },
  { slug: 'tic-tac-toe',    name: 'Tic-Tac-Toe',        description: 'Classic 3×3 grid battle with leaderboards.',               type: 'REWRITTEN', isMultiplay: false, category: 'dual-player' },
  // Tier B
  { slug: 'word-wizard',    name: 'Word Wizard',         description: 'Spot hidden words in the grid before time runs out.',      type: 'REWRITTEN', isMultiplay: false, category: 'puzzle'   },
  { slug: 'rps',            name: 'Rock Paper Scissors', description: 'Best-of-3 showdown — solo or PVP.',                       type: 'REWRITTEN', isMultiplay: false, category: 'dual-player' },
  { slug: 'number-guessing',name: 'Number Guessing',     description: 'Guess the secret number — solo, PVP, or vs AI.',          type: 'REWRITTEN', isMultiplay: false, category: 'dual-player' },
  // Tier C — iframe
  { slug: '2048',           name: '2048',                description: 'Slide tiles and reach 2048!',                             type: 'IFRAME',    isMultiplay: false, category: 'puzzle'   },
  { slug: 'fighter',        name: 'Fighter Jet',         description: 'Dodge and shoot in this retro arcade shooter.',           type: 'IFRAME',    isMultiplay: false, category: 'arcade'   },
  { slug: 'ludo',           name: 'Ludo',                description: 'Classic Ludo for 2–4 players.',                          type: 'IFRAME',    isMultiplay: false, category: 'strategy' },
  { slug: 'memory',         name: 'Memory Match',        description: 'Flip cards and find all matching pairs!',                 type: 'IFRAME',    isMultiplay: false, category: 'dual-player' },
  { slug: 'arrow-puzzle',    name: 'Arrow Puzzle',        description: 'Clear the board by removing arrows with unobstructed paths.', type: 'REWRITTEN', isMultiplay: false, category: 'puzzle' },
  { slug: 'color-sort',     name: 'Color Sort',          description: 'Sort all colored liquids into separate jars.',             type: 'REWRITTEN', isMultiplay: false, category: 'puzzle'   },
  { slug: 'unblock-traffic', name: 'Unblock Traffic',     description: 'Move vehicles to clear a path for the target vehicle to escape.', type: 'REWRITTEN', isMultiplay: false, category: 'puzzle'   },
  { slug: 'water-connect',   name: 'Water Connect',       description: 'Connect matching color nodes without crossing paths to fill the entire board.', type: 'REWRITTEN', isMultiplay: false, category: 'puzzle'   },
  { slug: 'dots-boxes',      name: 'Dots & Boxes',        description: 'Claim territory by connecting dots. Play local, vs AI, or online!', type: 'REWRITTEN', isMultiplay: true,  category: 'dual-player' },
  { slug: 'block-blast',     name: 'Block Blast',        description: 'Place block shapes on the 8x8 grid. Clear rows and columns to score and build combos.', type: 'REWRITTEN', isMultiplay: false, category: 'puzzle' },
  { slug: 'neon-tetris',     name: 'Neon Tetris',        description: 'Glowing retro neon Tetris. Rotate, slide, and drop tetrominoes with SRS wall kicks, daily challenges, and combo chains.', type: 'REWRITTEN', isMultiplay: false, category: 'arcade' },
  { slug: 'ai-infinite-candy-crush', name: 'Candy Blast Infinity', description: 'Procedurally generated match-3 puzzle game. Match delicious candies and juicy fruits, trigger cascading combos, and clear challenging objectives!', type: 'REWRITTEN', isMultiplay: false, category: 'match-3' },
  { slug: 'hangman',         name: 'Hangman',             description: 'Guess the hidden word letter by letter. Play solo or challenge opponents online!', type: 'REWRITTEN', isMultiplay: true,  category: 'social' },
]

const achievements = [
  { slug: 'first-game',        name: 'First Move',          description: 'Play your first game.',                   xpReward: 50,   coinReward: 10,  category: 'special' },
  { slug: 'first-win',         name: 'Winner Winner',       description: 'Win your first match.',                   xpReward: 100,  coinReward: 25,  category: 'wins' },
  { slug: 'streak-3',          name: 'Hot Streak',          description: 'Claim daily rewards 3 days in a row.',    xpReward: 75,   coinReward: 15,  category: 'streaks' },
  { slug: 'streak-7',          name: 'On Fire',             description: 'Claim daily rewards 7 days in a row.',    xpReward: 200,  coinReward: 50,  category: 'streaks' },
  { slug: 'streak-30',         name: 'Dedicated',           description: 'Claim daily rewards 30 days in a row.',   xpReward: 500,  coinReward: 150, category: 'streaks' },
  { slug: 'level-5',           name: 'Rising Star',         description: 'Reach Level 5.',                          xpReward: 150,  coinReward: 30,  category: 'special' },
  { slug: 'level-10',          name: 'Veteran',             description: 'Reach Level 10.',                         xpReward: 300,  coinReward: 75,  category: 'special' },
  { slug: 'level-25',          name: 'Champion',            description: 'Reach Level 25.',                         xpReward: 750,  coinReward: 200, category: 'special' },
  { slug: 'social-butterfly',  name: 'Social Butterfly',    description: 'Add 5 friends.',                          xpReward: 100,  coinReward: 20,  category: 'social' },
  { slug: 'cricket-hat-trick', name: 'Hat Trick',           description: 'Win 3 Cricket matches in a row.',         xpReward: 200,  coinReward: 50,  category: 'streaks', gameSlug: 'cricket' },
  { slug: 'ttt-undefeated',    name: 'Undefeated',          description: 'Win 10 Tic-Tac-Toe games in a row.',     xpReward: 300,  coinReward: 75,  category: 'streaks', gameSlug: 'tic-tac-toe' },
  // Sprint 2 additions
  { slug: 'games-5',           name: 'Novice Player',       description: 'Play 5 games of any type.',               xpReward: 100,  coinReward: 20,  category: 'gameplay' },
  { slug: 'games-25',          name: 'Dedicated Gamer',     description: 'Play 25 games of any type.',              xpReward: 250,  coinReward: 50,  category: 'gameplay' },
  { slug: 'games-100',         name: 'Game Marathoner',     description: 'Play 100 games of any type.',             xpReward: 600,  coinReward: 150, category: 'gameplay' },
  { slug: 'wins-5',            name: 'Frequent Winner',     description: 'Win 5 matches.',                          xpReward: 150,  coinReward: 30,  category: 'wins' },
  { slug: 'wins-20',           name: 'Match Master',        description: 'Win 20 matches.',                         xpReward: 300,  coinReward: 75,  category: 'wins' },
  { slug: 'wins-50',           name: 'Legendary Champion',  description: 'Win 50 matches.',                         xpReward: 800,  coinReward: 200, category: 'wins' },
  { slug: 'win-streak-3',      name: 'Unstoppable',         description: 'Win 3 matches in a row.',                 xpReward: 200,  coinReward: 50,  category: 'streaks' },
  { slug: 'win-streak-5',      name: 'On a Rampage',        description: 'Win 5 matches in a row.',                 xpReward: 400,  coinReward: 100, category: 'streaks' },
  { slug: 'cricket-century',   name: 'Century Maker',       description: 'Score 100+ total runs in Cricket.',        xpReward: 250,  coinReward: 50,  category: 'special', gameSlug: 'cricket' },
  { slug: 'ttt-perfect',       name: 'Master Strategist',   description: 'Win a game of Tic-Tac-Toe in 5 or fewer moves.', xpReward: 150, coinReward: 30, category: 'special', gameSlug: 'tic-tac-toe' },
  // Phase 3 additions: Color Sort Achievements
  { slug: 'color-sort-first-pour', name: 'First Pour',          description: 'Perform your first pour in Color Sort.',             xpReward: 50,  coinReward: 10,  category: 'special', gameSlug: 'color-sort' },
  { slug: 'color-sort-apprentice', name: 'Sorting Apprentice',  description: 'Complete 5 levels in Color Sort.',                   xpReward: 100, coinReward: 20,  category: 'gameplay', gameSlug: 'color-sort' },
  { slug: 'color-sort-master',     name: 'Liquid Master',       description: 'Complete 25 levels in Color Sort.',                  xpReward: 250, coinReward: 50,  category: 'gameplay', gameSlug: 'color-sort' },
  { slug: 'color-sort-no-hint',    name: 'No Hint Run',         description: 'Complete a level in Color Sort without hints.',      xpReward: 150, coinReward: 30,  category: 'special', gameSlug: 'color-sort' },
  { slug: 'color-sort-perfect',    name: 'Perfect Sort',        description: 'Get 3 stars on a Color Sort level.',                 xpReward: 150, coinReward: 30,  category: 'special', gameSlug: 'color-sort' },
  // Phase 3 additions: Unblock Traffic Achievements
  { slug: 'traffic-first-escape',  name: 'First Escape',        description: 'Escape your first vehicle in Unblock Traffic.',       xpReward: 50,  coinReward: 10,  category: 'special', gameSlug: 'unblock-traffic' },
  { slug: 'traffic-officer',       name: 'Traffic Officer',     description: 'Complete 5 levels in Unblock Traffic.',               xpReward: 100, coinReward: 20,  category: 'gameplay', gameSlug: 'unblock-traffic' },
  { slug: 'traffic-grid-master',   name: 'Grid Master',         description: 'Complete 25 levels in Unblock Traffic.',              xpReward: 250, coinReward: 50,  category: 'gameplay', gameSlug: 'unblock-traffic' },
  { slug: 'traffic-no-hint',       name: 'No Hint Escape',      description: 'Escape without using any hints.',                     xpReward: 150, coinReward: 30,  category: 'special', gameSlug: 'unblock-traffic' },
  { slug: 'traffic-legend',        name: 'Rush Hour Legend',    description: 'Get 3 stars on an Unblock Traffic level.',            xpReward: 150, coinReward: 30,  category: 'special', gameSlug: 'unblock-traffic' },
  // Phase 5 additions: Water Connect Achievements
  { slug: 'wc-first-flow',         name: 'First Flow',          description: 'Connect your first color path in Water Connect.',             xpReward: 50,  coinReward: 10,  category: 'special',  gameSlug: 'water-connect' },
  { slug: 'wc-apprentice',         name: 'Puzzle Apprentice',   description: 'Complete 5 puzzles in Water Connect.',                         xpReward: 100, coinReward: 20,  category: 'gameplay', gameSlug: 'water-connect' },
  { slug: 'wc-master',             name: 'Puzzle Master',       description: 'Complete 25 puzzles in Water Connect.',                        xpReward: 250, coinReward: 50,  category: 'gameplay', gameSlug: 'water-connect' },
  { slug: 'wc-25-completed',       name: '25 Puzzles Completed',description: 'Complete 25 puzzles in Water Connect.',                       xpReward: 250, coinReward: 50,  category: 'gameplay', gameSlug: 'water-connect' },
  // Phase 5 additions: Dots & Boxes Achievements
  { slug: 'db-first-victory',       name: 'First Victory',       description: 'Win your first Dots & Boxes match.',                           xpReward: 100, coinReward: 25,  category: 'wins',     gameSlug: 'dots-boxes' },
  { slug: 'db-box-collector',       name: 'Box Collector',       description: 'Claim 50 total boxes in Dots & Boxes.',                       xpReward: 150, coinReward: 30,  category: 'gameplay', gameSlug: 'dots-boxes' },
  { slug: 'db-chain-master',        name: 'Chain Master',        description: 'Complete 5 boxes in a single turn in Dots & Boxes.',           xpReward: 150, coinReward: 30,  category: 'special',  gameSlug: 'dots-boxes' },
  { slug: 'db-online-champion',     name: 'Online Champion',     description: 'Win an online multiplayer Dots & Boxes match.',                xpReward: 250, coinReward: 50,  category: 'wins',     gameSlug: 'dots-boxes' },
  // Phase 7 additions: Block Blast Achievements
  { slug: 'bb-first-placement',     name: 'First Placement',     description: 'Place your first block in Block Blast.',                       xpReward: 50,  coinReward: 10,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-first-clear',         name: 'First Clear',         description: 'Clear your first line in Block Blast.',                       xpReward: 50,  coinReward: 10,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-1000-club',           name: '1000 Club',           description: 'Score 1,000+ points in a single game of Block Blast.',          xpReward: 100, coinReward: 20,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-5000-club',           name: '5000 Club',           description: 'Score 5,000+ points in a single game of Block Blast.',          xpReward: 250, coinReward: 50,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-combo-master',        name: 'Combo Master',        description: 'Achieve a combo chain of 5x or higher in Block Blast.',         xpReward: 150, coinReward: 30,  category: 'streaks',  gameSlug: 'block-blast' },
  { slug: 'bb-line-destroyer',      name: 'Line Destroyer',      description: 'Clear 100 total lines in Block Blast.',                         xpReward: 200, coinReward: 40,  category: 'gameplay', gameSlug: 'block-blast' },
  { slug: 'bb-champion',            name: 'Block Blast Champion',description: 'Score 3,000+ points in Classic Block Blast.',                  xpReward: 200, coinReward: 40,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-clean-slate',         name: 'Clean Slate',         description: 'Completely empty the board after a line clear.',                 xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'block-blast' },
  { slug: 'bb-survivor',            name: 'Survivor',            description: 'Place 100+ block shapes in a single game of Block Blast.',      xpReward: 200, coinReward: 40,  category: 'gameplay', gameSlug: 'block-blast' },
  { slug: 'bb-daily-master',        name: 'Daily Master',        description: 'Score 3,000+ points in the Block Blast Daily Challenge.',       xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'block-blast' },
  // Phase 8 additions: Neon Tetris Achievements
  { slug: 'nt-first-clear',     name: 'First Neon Clear',    description: 'Clear your first line in Neon Tetris.',                       xpReward: 50,  coinReward: 10,  category: 'special',  gameSlug: 'neon-tetris' },
  { slug: 'nt-tetris-master',    name: 'Tetris Master',       description: 'Perform a 4-line Tetris clear in Neon Tetris.',               xpReward: 150, coinReward: 30,  category: 'special',  gameSlug: 'neon-tetris' },
  { slug: 'nt-combo-5',         name: 'Combo Starter',       description: 'Achieve a combo chain of 5x or higher in Neon Tetris.',       xpReward: 100, coinReward: 20,  category: 'streaks',  gameSlug: 'neon-tetris' },
  { slug: 'nt-combo-10',        name: 'Combo Overlord',      description: 'Achieve a combo chain of 10x or higher in Neon Tetris.',      xpReward: 250, coinReward: 50,  category: 'streaks',  gameSlug: 'neon-tetris' },
  { slug: 'nt-level-10',        name: 'Neon Veteran',        description: 'Reach Level 10 or higher in Neon Tetris.',                    xpReward: 200, coinReward: 40,  category: 'special',  gameSlug: 'neon-tetris' },
  { slug: 'nt-perfect-clear',   name: 'Perfect Clear!',      description: 'Completely empty the board in Neon Tetris.',                  xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'neon-tetris' },
  { slug: 'nt-survivor',        name: 'Tetris Survivor',     description: 'Place 100+ block shapes in a single game of Neon Tetris.',     xpReward: 200, coinReward: 40,  category: 'gameplay', gameSlug: 'neon-tetris' },
  { slug: 'nt-daily-winner',    name: 'Daily Champ',         description: 'Score 1,500+ points in the Neon Tetris Daily Challenge.',      xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'neon-tetris' },
  // Phase 9 additions: Word Wizard Achievements
  { slug: 'ww-first-word',          name: 'First Spell',         description: 'Find your first word in Word Wizard.',                         xpReward: 50,  coinReward: 10,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-word-master',         name: 'Word Master',         description: 'Find 50 words total in Word Wizard.',                          xpReward: 150, coinReward: 30,  category: 'gameplay', gameSlug: 'word-wizard' },
  { slug: 'ww-score-2000',          name: 'Spellbound',          description: 'Score 2,000+ points in a single game of Word Wizard.',        xpReward: 150, coinReward: 30,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-score-5000',          name: 'Grand Wizard',        description: 'Score 5,000+ points in a single game of Word Wizard.',        xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-combo-5',             name: 'Combo Caster',        description: 'Achieve a combo chain of 5x or higher in Word Wizard.',        xpReward: 100, coinReward: 20,  category: 'streaks',  gameSlug: 'word-wizard' },
  { slug: 'ww-combo-10',            name: 'Arcane Streak',       description: 'Achieve a combo chain of 10x or higher in Word Wizard.',       xpReward: 250, coinReward: 50,  category: 'streaks',  gameSlug: 'word-wizard' },
  { slug: 'ww-daily-champion',      name: 'Daily Champion',      description: 'Score 2,000+ points in the Word Wizard Daily Challenge.',     xpReward: 300, coinReward: 60,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-no-hints',            name: 'Pure Wizard',         description: 'Complete a game of Word Wizard without using any hints.',      xpReward: 200, coinReward: 40,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-rare-letter-hunter',  name: 'Rare Hunter',         description: 'Find 5 total words containing rare letters in Word Wizard.',   xpReward: 200, coinReward: 40,  category: 'special',  gameSlug: 'word-wizard' },
  { slug: 'ww-vocabulary-king',     name: 'Vocabulary King',     description: 'Find a word of 7+ letters in Word Wizard.',                    xpReward: 250, coinReward: 50,  category: 'special',  gameSlug: 'word-wizard' },
  // Phase 20 additions: Candy Blast Infinity Achievements
  { slug: 'cc-first-match', name: 'First Match', description: 'Complete your first Candy Blast Infinity match.', xpReward: 50, coinReward: 10, category: 'special', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-combo-10', name: 'Combo Deca', description: 'Achieve a combo chain of 10x or higher in a match.', xpReward: 200, coinReward: 40, category: 'streaks', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-color-bomb-50', name: 'Color Demolitionist', description: 'Use 50 Color Bombs in total.', xpReward: 300, coinReward: 60, category: 'special', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-clear-1000-blockers', name: 'Blockbuster', description: 'Clear 1000 total blockers.', xpReward: 400, coinReward: 80, category: 'gameplay', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-level-100', name: 'Century Matcher', description: 'Reach Level 100.', xpReward: 500, coinReward: 100, category: 'gameplay', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-level-500', name: 'Crush Veteran', description: 'Reach Level 500.', xpReward: 750, coinReward: 200, category: 'gameplay', gameSlug: 'ai-infinite-candy-crush' },
  { slug: 'cc-level-1000', name: 'Match-3 Legend', description: 'Reach Level 1000.', xpReward: 1000, coinReward: 300, category: 'gameplay', gameSlug: 'ai-infinite-candy-crush' },
  // Phase 21.5 additions: Hangman Achievements
  { slug: 'hangman-first-win', name: 'First Hangman Win', description: 'Win your first Hangman match.', xpReward: 100, coinReward: 25, category: 'wins', gameSlug: 'hangman' },
  { slug: 'hangman-wins-10', name: 'Hangman Challenger', description: 'Win 10 Hangman matches.', xpReward: 200, coinReward: 50, category: 'wins', gameSlug: 'hangman' },
  { slug: 'hangman-wins-25', name: 'Hangman Expert', description: 'Win 25 Hangman matches.', xpReward: 300, coinReward: 75, category: 'wins', gameSlug: 'hangman' },
  { slug: 'hangman-wins-100', name: 'Hangman Overlord', description: 'Win 100 Hangman matches.', xpReward: 500, coinReward: 150, category: 'wins', gameSlug: 'hangman' },
  { slug: 'hangman-perfect-solver', name: 'Perfect Solver', description: 'Solve a word without making any wrong letter guesses.', xpReward: 200, coinReward: 50, category: 'special', gameSlug: 'hangman' },
  { slug: 'hangman-no-wrong-guess', name: 'No Wrong Guess', description: 'Win a Hangman match with no incorrect letter guesses.', xpReward: 200, coinReward: 50, category: 'special', gameSlug: 'hangman' },
  { slug: 'hangman-fast-thinker', name: 'Fast Thinker', description: 'Solve a Hangman word in under 30 seconds.', xpReward: 150, coinReward: 30, category: 'special', gameSlug: 'hangman' },
  { slug: 'hangman-word-master', name: 'Word Master', description: 'Correctly guess 50 letters in Hangman.', xpReward: 200, coinReward: 50, category: 'gameplay', gameSlug: 'hangman' },
]

async function main() {
  console.log('🌱  Seeding GameHub database...\n')

  // Seed games
  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: {},
      create: game,
    })
  }
  console.log(`✅  Seeded ${games.length} games.`)

  // Seed achievements
  for (const a of achievements) {
    await prisma.achievement.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    })
  }
  console.log(`✅  Seeded ${achievements.length} achievements.`)

  // Seed default cosmetics
  const defaults = [
    { name: 'Default Frame',    type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: true },
    { name: 'Default Theme',    type: 'BOARD_THEME'  as const, priceCoins: 0, isDefault: true },
    { name: 'Default Title',    type: 'TITLE'        as const, priceCoins: 0, isDefault: true },

    // Avatars
    { name: 'Cyber Bot Avatar',  type: 'AVATAR' as const, priceCoins: 100, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber', isDefault: false },
    { name: 'Viking Warrior Avatar', type: 'AVATAR' as const, priceCoins: 150, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Viking', isDefault: false },
    { name: 'Ninja Stealth Avatar', type: 'AVATAR' as const, priceCoins: 200, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ninja', isDefault: false },
    { name: 'Astronaut Space Avatar', type: 'AVATAR' as const, priceCoins: 250, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astronaut', isDefault: false },

    // Chat Packs
    { name: 'Friendly Chat Pack', type: 'CHAT_PACK' as const, priceCoins: 50, assetUrl: 'Friendly', isDefault: false, metadata: { messages: ['Well played! 🤝', 'Good game! 🎮', 'Nice move! 🔥', 'Hello there! 👋'] } },
    { name: 'Competitor Chat Pack', type: 'CHAT_PACK' as const, priceCoins: 100, assetUrl: 'Competitive', isDefault: false, metadata: { messages: ['Too easy! ⚡', 'Calculated. 🎯', 'Close one! 😮', 'Unlucky! 💀'] } },
    { name: 'Silly Chat Pack', type: 'CHAT_PACK' as const, priceCoins: 80, assetUrl: 'Silly', isDefault: false, metadata: { messages: ['Catch me if you can! 🏃', 'Oops, my bad! 🤡', 'Wow! 🌟', 'Let me cook! 👨‍🍳'] } },
    { name: 'Sports Pack', type: 'CHAT_PACK' as const, priceCoins: 60, assetUrl: 'Sports', isDefault: false, metadata: { messages: ['Goal! ⚽', 'Touchdown! 🏈', 'Home Run! ⚾', 'Nice Shot! 🏀'] } },
    { name: 'Funny Pack', type: 'CHAT_PACK' as const, priceCoins: 70, assetUrl: 'Funny', isDefault: false, metadata: { messages: ['LOL! 😂', 'No way! 🤯', 'BRB! 🏃‍♂️', 'Aha! 💡'] } },
    { name: 'Pro Pack', type: 'CHAT_PACK' as const, priceCoins: 90, assetUrl: 'Pro', isDefault: false, metadata: { messages: ['Calculated. 😎', 'GG! 🏆', 'GG WP! 🤝', 'Next game? 🎮'] } },
    { name: 'Cricket Pack', type: 'CHAT_PACK' as const, priceCoins: 80, assetUrl: 'Cricket', isDefault: false, metadata: { messages: ['Sixer! 🏏', 'Bowled him! 🎯', 'Howzzat! 📢', 'Good bowling! ⚾'] } },
    { name: 'Legend Pack', type: 'CHAT_PACK' as const, priceCoins: 120, assetUrl: 'Legend', isDefault: false, metadata: { messages: ['What A Move! 🧠', 'Too Easy! ⚡', 'Close One! 😱', 'Good Luck! 🍀'] } },
    { name: 'Cricket Sledge Pack', type: 'CHAT_PACK' as const, priceCoins: 120, assetUrl: 'Cricket Sledge', isDefault: false, metadata: { messages: ['Nice Duck 🦆', 'Lucky Shot 😏', 'Pressure 😈', 'Easy Catch 😂'] } },
    { name: 'Dating Pack', type: 'CHAT_PACK' as const, priceCoins: 120, assetUrl: 'Dating', isDefault: false, metadata: { messages: ['Nice Move 🙂', 'Impressed ✨', 'Cute Play 🌸', 'Good Choice 💫'] } },
    { name: 'Savage Pack', type: 'CHAT_PACK' as const, priceCoins: 150, assetUrl: 'Savage', isDefault: false, metadata: { messages: ['Too Slow', 'Skill Issue', 'Lucky Win', 'Try Again'] } },

    // Scratchers
    { name: 'Bronze Scratcher', type: 'SCRATCHER' as const, priceCoins: 20, assetUrl: 'Bronze', isDefault: false, metadata: { rarity: 'COMMON', description: 'Scratch to win basic Coins or XP.' } },
    { name: 'Silver Scratcher', type: 'SCRATCHER' as const, priceCoins: 50, assetUrl: 'Silver', isDefault: false, metadata: { rarity: 'RARE', description: 'Scratch to win decent Coins, XP, or Rare items.' } },
    { name: 'Gold Scratcher', type: 'SCRATCHER' as const, priceCoins: 100, assetUrl: 'Gold', isDefault: false, metadata: { rarity: 'EPIC', description: 'Scratch to win huge Coins, XP, or Epic items.' } },
    { name: 'Legendary Scratcher', type: 'SCRATCHER' as const, priceCoins: 250, assetUrl: 'Legendary', isDefault: false, metadata: { rarity: 'LEGENDARY', description: 'Scratch to win Legendary rewards!' } },

    // Titles
    { name: 'Rookie', type: 'TITLE' as const, priceCoins: 0, isDefault: false, metadata: { minWins: 25, description: 'Unlocked at 25 Wins' } },
    { name: 'Challenger', type: 'TITLE' as const, priceCoins: 0, isDefault: false, metadata: { minWins: 100, description: 'Unlocked at 100 Wins' } },
    { name: 'Immortal', type: 'TITLE' as const, priceCoins: 0, isDefault: false, metadata: { minWins: 500, description: 'Unlocked at 500 Wins' } },
    { name: 'Champion', type: 'TITLE' as const, priceCoins: 120, isDefault: false, metadata: { description: 'A proven winner' } },
    { name: 'Legend', type: 'TITLE' as const, priceCoins: 200, isDefault: false, metadata: { description: 'Known by everyone' } },
    { name: 'Grandmaster', type: 'TITLE' as const, priceCoins: 300, isDefault: false, metadata: { description: 'Absolute master of games' } },
    { name: 'Night Owl', type: 'TITLE' as const, priceCoins: 80, isDefault: false, metadata: { description: 'Plays late into the night' } },
    { name: 'Puzzle King', type: 'TITLE' as const, priceCoins: 150, isDefault: false, metadata: { description: 'Solves anything' } },
    { name: 'Cricket Boss', type: 'TITLE' as const, priceCoins: 150, isDefault: false, metadata: { description: 'Rules the pitch' } },
    { name: 'XP Hunter', type: 'TITLE' as const, priceCoins: 100, isDefault: false, metadata: { description: 'Always leveling up' } },
    { name: 'Streak Master', type: 'TITLE' as const, priceCoins: 180, isDefault: false, metadata: { description: 'Never breaks a streak' } },

    // Effects
    { name: 'Confetti Burst', type: 'EFFECT' as const, priceCoins: 150, isDefault: false, metadata: { description: 'Celebratory confetti shower' } },
    { name: 'Lightning Aura', type: 'EFFECT' as const, priceCoins: 220, isDefault: false, metadata: { description: 'Electrifying flashes' } },
    { name: 'Golden Glow', type: 'EFFECT' as const, priceCoins: 200, isDefault: false, metadata: { description: 'Radiate pure luxury' } },
    { name: 'Pixel Fire', type: 'EFFECT' as const, priceCoins: 180, isDefault: false, metadata: { description: 'Retro burning pixels' } },
    { name: 'Victory Sparkles', type: 'EFFECT' as const, priceCoins: 160, isDefault: false, metadata: { description: 'Sparkling trails of success' } },
    { name: 'Diamond Pulse', type: 'EFFECT' as const, priceCoins: 250, isDefault: false, metadata: { description: 'Shiny crystalline waves' } },
    { name: 'Royal Aura', type: 'EFFECT' as const, priceCoins: 300, isDefault: false, metadata: { description: 'The aura of kings' } },

    // Profile Frames
    { name: 'Bronze', type: 'AVATAR_FRAME' as const, priceCoins: 60, isDefault: false, metadata: { description: 'Sturdy bronze framing' } },
    { name: 'Silver', type: 'AVATAR_FRAME' as const, priceCoins: 100, isDefault: false, metadata: { description: 'Polished silver lining' } },
    { name: 'Gold', type: 'AVATAR_FRAME' as const, priceCoins: 180, isDefault: false, metadata: { description: 'Gleaming golden borders' } },
    { name: 'Diamond', type: 'AVATAR_FRAME' as const, priceCoins: 250, isDefault: false, metadata: { description: 'Sparkling diamond shell' } },
    { name: 'Mythic', type: 'AVATAR_FRAME' as const, priceCoins: 400, isDefault: false, metadata: { description: 'Ascendant legendary border' } },
    { name: 'Bronze Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 15, description: 'Requires Level 15' } },
    { name: 'Silver Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 30, description: 'Requires Level 30' } },
    { name: 'Gold Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 45, description: 'Requires Level 45' } },
    { name: 'Platinum Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 60, description: 'Requires Level 60' } },
    { name: 'Diamond Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 75, description: 'Requires Level 75' } },
    { name: 'Master Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 90, description: 'Requires Level 90' } },
    { name: 'Legendary Frame', type: 'AVATAR_FRAME' as const, priceCoins: 0, isDefault: false, metadata: { minLevel: 100, description: 'Requires Level 100' } }
  ]
  for (const c of defaults) {
    await prisma.cosmeticItem.upsert({
      where: { name: c.name },
      update: {
        type: c.type,
        priceCoins: c.priceCoins,
        assetUrl: c.assetUrl,
        metadata: (c as any).metadata || null,
      },
      create: {
        name: c.name,
        type: c.type,
        priceCoins: c.priceCoins,
        assetUrl: c.assetUrl,
        metadata: (c as any).metadata || null,
        isDefault: c.isDefault,
      },
    })
  }
  console.log(`✅  Seeded default and store cosmetics.`)

  console.log('\n🎮  Done!')
}

main().catch(console.error).finally(() => prisma.$disconnect())
