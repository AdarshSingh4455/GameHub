import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'node_modules', '.cache', 'mock_db_state.json')

export interface MockDbState {
  profiles: Record<string, any>
  rooms: Record<string, any>
  sessions: Record<string, any>
  friendships: Record<string, any>
  invites: Record<string, any>
  notifications: Record<string, any>
  inventories?: Record<string, any>
  challengeClaims?: Record<string, any>
  matches?: Record<string, any>
  xpEvents?: Record<string, any>
  tournaments: Record<string, any>
  tournamentRegistrations: Record<string, any>
  subTournaments: Record<string, any>
  tournamentMatches: Record<string, any>
  tournamentTeams: Record<string, any>
  tournamentTeamMembers: Record<string, any>
  tournamentAuditLogs: Record<string, any>
  rankedMatches?: Record<string, any>
  rankedSeasons?: Record<string, any>
  seasonSnapshots?: Record<string, any>
  ads?: Record<string, any>
  weeklyLeaderboardState?: Record<string, any>
  weeklyLeaderboardArchive?: Record<string, any>
  weeklyLeaderboardReward?: Record<string, any>
}

export const MOCK_COSMETIC_ITEMS = [
  // Avatars
  { id: 'item-cyber-bot', name: 'Cyber Bot Avatar', type: 'AVATAR', priceCoins: 100, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber', isDefault: false },
  { id: 'item-viking', name: 'Viking Warrior Avatar', type: 'AVATAR', priceCoins: 150, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Viking', isDefault: false },
  { id: 'item-ninja', name: 'Ninja Stealth Avatar', type: 'AVATAR', priceCoins: 200, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ninja', isDefault: false },
  { id: 'item-astronaut', name: 'Astronaut Space Avatar', type: 'AVATAR', priceCoins: 250, assetUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astronaut', isDefault: false },

  // Chat Packs
  { id: 'item-chat-friendly', name: 'Friendly Chat Pack', type: 'CHAT_PACK', priceCoins: 50, assetUrl: 'Friendly', isDefault: false, metadata: { messages: ['Well played! 🤝', 'Good game! 🎮', 'Nice move! 🔥', 'Hello there! 👋'] } },
  { id: 'item-chat-competitor', name: 'Competitor Chat Pack', type: 'CHAT_PACK', priceCoins: 100, assetUrl: 'Competitive', isDefault: false, metadata: { messages: ['Too easy! ⚡', 'Calculated. 🎯', 'Close one! 😮', 'Unlucky! 💀'] } },
  { id: 'item-chat-silly', name: 'Silly Chat Pack', type: 'CHAT_PACK', priceCoins: 80, assetUrl: 'Silly', isDefault: false, metadata: { messages: ['Catch me if you can! 🏃', 'Oops, my bad! 🤡', 'Wow! 🌟', 'Let me cook! 👨‍🍳'] } },
  { id: 'item-chat-sports', name: 'Sports Pack', type: 'CHAT_PACK', priceCoins: 60, assetUrl: 'Sports', isDefault: false, metadata: { messages: ['Goal! ⚽', 'Touchdown! 🏈', 'Home Run! ⚾', 'Nice Shot! 🏀'] } },
  { id: 'item-chat-funny', name: 'Funny Pack', type: 'CHAT_PACK', priceCoins: 70, assetUrl: 'Funny', isDefault: false, metadata: { messages: ['LOL! 😂', 'No way! 🤯', 'BRB! 🏃‍♂️', 'Aha! 💡'] } },
  { id: 'item-chat-pro', name: 'Pro Pack', type: 'CHAT_PACK', priceCoins: 90, assetUrl: 'Pro', isDefault: false, metadata: { messages: ['Calculated. 😎', 'GG! 🏆', 'GG WP! 🤝', 'Next game? 🎮'] } },
  { id: 'item-chat-cricket', name: 'Cricket Chat Pack', type: 'CHAT_PACK', priceCoins: 80, assetUrl: 'Cricket', isDefault: false, metadata: { messages: ['🏏 Well Played!', '🏏 What a Shot!', '🏏 Clean Bowled!', '🏏 Catch It!', '🏏 Six!!!', '🏏 Nice Defense!', '🏏 Lucky Escape!', '🏏 Great Match!'] } },
  { id: 'item-chat-legend', name: 'Legend Pack', type: 'CHAT_PACK', priceCoins: 120, assetUrl: 'Legend', isDefault: false, metadata: { messages: ['What A Move! 🧠', 'Too Easy! ⚡', 'Close One! 😱', 'Good Luck! 🍀'] } },
  { id: 'item-chat-cricket-sledge', name: 'Cricket Sledge Pack', type: 'CHAT_PACK', priceCoins: 120, assetUrl: 'Cricket Sledge', isDefault: false, metadata: { messages: ['Nice Duck 🦆', 'Lucky Shot 😏', 'Pressure 😈', 'Easy Catch 😂', 'Too Easy 😎', "Where's Your Timing? 🤣"] } },
  { id: 'item-chat-dating', name: 'Romantic Dating Chat Pack', type: 'CHAT_PACK', priceCoins: 120, assetUrl: 'Dating', isDefault: false, metadata: { messages: ['❤️ Hi There!', '❤️ Missed You', '❤️ Nice To See You', "❤️ You're Sweet", '❤️ Good Luck!', '❤️ Have Fun!', "❤️ You're Amazing!", '❤️ See You Soon!'] } },
  { id: 'item-chat-savage', name: 'Savage Pack', type: 'CHAT_PACK', priceCoins: 150, assetUrl: 'Savage', isDefault: false, metadata: { messages: ['Too Slow', 'Skill Issue', 'Lucky Win', 'Try Again'] } },

  // Scratchers
  { id: 'item-scratch-bronze', name: 'Bronze Scratcher', type: 'SCRATCHER', priceCoins: 20, assetUrl: 'Bronze', isDefault: false, metadata: { rarity: 'COMMON', description: 'Scratch to win basic Coins or XP.' } },
  { id: 'item-scratch-silver', name: 'Silver Scratcher', type: 'SCRATCHER', priceCoins: 50, assetUrl: 'Silver', isDefault: false, metadata: { rarity: 'RARE', description: 'Scratch to win decent Coins, XP, or Rare items.' } },
  { id: 'item-scratch-gold', name: 'Gold Scratcher', type: 'SCRATCHER', priceCoins: 100, assetUrl: 'Gold', isDefault: false, metadata: { rarity: 'EPIC', description: 'Scratch to win huge Coins, XP, or Epic items.' } },
  { id: 'item-scratch-legendary', name: 'Legendary Scratcher', type: 'SCRATCHER', priceCoins: 250, assetUrl: 'Legendary', isDefault: false, metadata: { rarity: 'LEGENDARY', description: 'Scratch to win Legendary rewards!' } },

  // Titles
  { id: 'title-rookie', name: 'Rookie', type: 'TITLE', priceCoins: 0, isDefault: false, metadata: { minWins: 25, description: 'Unlocked at 25 Wins' } },
  { id: 'title-challenger', name: 'Challenger', type: 'TITLE', priceCoins: 0, isDefault: false, metadata: { minWins: 100, description: 'Unlocked at 100 Wins' } },
  { id: 'title-immortal', name: 'Immortal', type: 'TITLE', priceCoins: 0, isDefault: false, metadata: { minWins: 500, description: 'Unlocked at 500 Wins' } },
  { id: 'title-champion', name: 'Champion', type: 'TITLE', priceCoins: 120, isDefault: false, metadata: { description: 'A proven winner' } },
  { id: 'title-legend', name: 'Legend', type: 'TITLE', priceCoins: 200, isDefault: false, metadata: { description: 'Known by everyone' } },
  { id: 'title-grandmaster', name: 'Grandmaster', type: 'TITLE', priceCoins: 300, isDefault: false, metadata: { description: 'Absolute master of games' } },
  { id: 'title-night-owl', name: 'Night Owl', type: 'TITLE', priceCoins: 80, isDefault: false, metadata: { description: 'Plays late into the night' } },
  { id: 'title-puzzle-king', name: 'Puzzle King', type: 'TITLE', priceCoins: 150, isDefault: false, metadata: { description: 'Solves anything' } },
  { id: 'title-cricket-boss', name: 'Cricket Boss', type: 'TITLE', priceCoins: 150, isDefault: false, metadata: { description: 'Rules the pitch' } },
  { id: 'title-xp-hunter', name: 'XP Hunter', type: 'TITLE', priceCoins: 100, isDefault: false, metadata: { description: 'Always leveling up' } },
  { id: 'title-streak-master', name: 'Streak Master', type: 'TITLE', priceCoins: 180, isDefault: false, metadata: { description: 'Never breaks a streak' } },

  // Effects
  { id: 'effect-confetti', name: 'Confetti Burst', type: 'EFFECT', priceCoins: 150, isDefault: false, metadata: { description: 'Celebratory confetti shower' } },
  { id: 'effect-lightning', name: 'Lightning Aura', type: 'EFFECT', priceCoins: 220, isDefault: false, metadata: { description: 'Electrifying flashes' } },
  { id: 'effect-golden', name: 'Golden Glow', type: 'EFFECT', priceCoins: 200, isDefault: false, metadata: { description: 'Radiate pure luxury' } },
  { id: 'effect-pixel-fire', name: 'Pixel Fire', type: 'EFFECT', priceCoins: 180, isDefault: false, metadata: { description: 'Retro burning pixels' } },
  { id: 'effect-victory-sparkles', name: 'Victory Sparkles', type: 'EFFECT', priceCoins: 160, isDefault: false, metadata: { description: 'Sparkling trails of success' } },
  { id: 'effect-diamond', name: 'Diamond Pulse', type: 'EFFECT', priceCoins: 250, isDefault: false, metadata: { description: 'Shiny crystalline waves' } },
  { id: 'effect-royal', name: 'Royal Aura', type: 'EFFECT', priceCoins: 300, isDefault: false, metadata: { description: 'The aura of kings' } },

  // Profile Frames
  { id: 'frame-bronze', name: 'Bronze', type: 'AVATAR_FRAME', priceCoins: 60, isDefault: false, metadata: { description: 'Sturdy bronze framing' } },
  { id: 'frame-silver', name: 'Silver', type: 'AVATAR_FRAME', priceCoins: 100, isDefault: false, metadata: { description: 'Polished silver lining' } },
  { id: 'frame-gold', name: 'Gold', type: 'AVATAR_FRAME', priceCoins: 180, isDefault: false, metadata: { description: 'Gleaming golden borders' } },
  { id: 'frame-diamond', name: 'Diamond', type: 'AVATAR_FRAME', priceCoins: 250, isDefault: false, metadata: { description: 'Sparkling diamond shell' } },
  { id: 'frame-mythic', name: 'Mythic', type: 'AVATAR_FRAME', priceCoins: 400, isDefault: false, metadata: { description: 'Ascendant legendary border' } },
  { id: 'frame-lvl-bronze', name: 'Bronze Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 15, description: 'Requires Level 15' } },
  { id: 'frame-lvl-silver', name: 'Silver Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 30, description: 'Requires Level 30' } },
  { id: 'frame-lvl-gold', name: 'Gold Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 45, description: 'Requires Level 45' } },
  { id: 'frame-lvl-platinum', name: 'Platinum Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 60, description: 'Requires Level 60' } },
  { id: 'frame-lvl-diamond', name: 'Diamond Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 75, description: 'Requires Level 75' } },
  { id: 'frame-lvl-master', name: 'Master Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 90, description: 'Requires Level 90' } },
  { id: 'frame-lvl-legendary', name: 'Legendary Frame', type: 'AVATAR_FRAME', priceCoins: 0, isDefault: false, metadata: { minLevel: 100, description: 'Requires Level 100' } },

  // Locked Progression items in mock database
  { id: 'frame-neon', name: 'Neon Frame', type: 'AVATAR_FRAME', priceCoins: 100, isDefault: false, metadata: { minLevel: 5, description: 'Reach Level 5 reward' } },
  { id: 'frame-prestige', name: 'Prestige Border', type: 'AVATAR_FRAME', priceCoins: 250, isDefault: false, metadata: { minLevel: 10, description: 'Reach Level 10 reward' } },
  { id: 'frame-ruby', name: 'Ruby Glow', type: 'AVATAR_FRAME', priceCoins: 350, isDefault: false, metadata: { minLevel: 25, description: 'Reach Level 25 reward' } },
  { id: 'frame-champion', name: 'Champion Frame', type: 'AVATAR_FRAME', priceCoins: 450, isDefault: false, metadata: { minLevel: 0, description: 'Win 50 Matches reward' } },
  { id: 'title-cosmic', name: 'Cosmic Title', type: 'TITLE', priceCoins: 150, isDefault: false, metadata: { minWins: 0, description: 'Reach Level 15 reward' } },
  { id: 'title-game-legend', name: 'Game Legend', type: 'TITLE', priceCoins: 500, isDefault: false, metadata: { minWins: 100, description: 'Win 100 Matches reward' } },
  { id: 'title-shadow-warrior', name: 'Shadow Warrior', type: 'TITLE', priceCoins: 80, isDefault: false, metadata: { description: 'Purchase in Store' } },
  { id: 'title-speed-demon', name: 'Speed Demon', type: 'TITLE', priceCoins: 120, isDefault: false, metadata: { description: 'Solve Memory Match in 15s' } },
  { id: 'effect-cosmic-trail', name: 'Cosmic Trail', type: 'EFFECT', priceCoins: 200, isDefault: false, metadata: { description: 'Reach Level 15 reward' } },
  { id: 'effect-golden-aura', name: 'Golden Aura', type: 'EFFECT', priceCoins: 400, isDefault: false, metadata: { description: 'Reach Level 50 reward' } },
  { id: 'effect-rainbow-sparkles', name: 'Rainbow Sparkles', type: 'EFFECT', priceCoins: 150, isDefault: false, metadata: { description: 'Daily Rewards streak 7 reward' } },
  { id: 'effect-thunder', name: 'Thunder Effect', type: 'EFFECT', priceCoins: 300, isDefault: false, metadata: { description: 'Open in Rare Mystery Crate' } }

]

let cachedDb: MockDbState | null = null

export function loadDb(): MockDbState {
  let retries = 15
  while (retries > 0) {
    try {
      if (fs.existsSync(DB_PATH)) {
        const content = fs.readFileSync(DB_PATH, 'utf8')
        if (content.trim()) {
          const parsed = JSON.parse(content)
          if (parsed.profiles && parsed.rooms && parsed.sessions && parsed.friendships) {
            if (!parsed.inventories) parsed.inventories = {}
            if (!parsed.challengeClaims) parsed.challengeClaims = {}
            if (!parsed.matches) parsed.matches = {}
            if (!parsed.xpEvents) parsed.xpEvents = {}
            if (!parsed.tournaments) parsed.tournaments = {}
            if (!parsed.rankedMatches) parsed.rankedMatches = {}
            if (!parsed.rankedSeasons) parsed.rankedSeasons = {}
            if (!parsed.seasonSnapshots) parsed.seasonSnapshots = {}
            if (!parsed.ads) parsed.ads = {}
            if (!parsed.tournamentRegistrations) parsed.tournamentRegistrations = {}
            if (!parsed.subTournaments) parsed.subTournaments = {}
            if (!parsed.tournamentMatches) parsed.tournamentMatches = {}
            if (!parsed.tournamentTeams) parsed.tournamentTeams = {}
            if (!parsed.tournamentTeamMembers) parsed.tournamentTeamMembers = {}
            if (!parsed.tournamentAuditLogs) parsed.tournamentAuditLogs = {}
            if (!parsed.weeklyLeaderboardState) parsed.weeklyLeaderboardState = {}
            if (!parsed.weeklyLeaderboardArchive) parsed.weeklyLeaderboardArchive = {}
            if (!parsed.weeklyLeaderboardReward) parsed.weeklyLeaderboardReward = {}
            
            // Seed a default current weekly leaderboard state if empty
            if (Object.keys(parsed.weeklyLeaderboardState).length === 0) {
              // Calculate previous Monday 10:30 AM
              const getPrevMonday1030 = () => {
                const d = new Date()
                d.setHours(10, 30, 0, 0)
                const day = d.getDay()
                const diff = day === 0 ? -6 : 1 - day
                d.setDate(d.getDate() + diff)
                if (d.getTime() > Date.now()) {
                  d.setDate(d.getDate() - 7)
                }
                return d
              }
              const start = getPrevMonday1030()
              const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
              parsed.weeklyLeaderboardState['current'] = {
                id: 'current',
                weekNumber: 2,
                startDate: start.toISOString(),
                endDate: end.toISOString()
              }
            }
            cachedDb = parsed
            return parsed
          }
        }
      }
      break
    } catch (err) {
      retries--
      if (retries === 0) {
        console.error('[mockPrisma] loadDb failed after all retries:', err)
        if (cachedDb) return cachedDb
        break
      }
      const start = Date.now()
      while (Date.now() - start < 10) {}
    }
  }

  if (cachedDb) return cachedDb

  // Return default state with seeded data
  const initialProfiles: Record<string, any> = {
    'test-user-a': {
      id: 'test-user-a',
      userId: 'test-user-a',
      username: 'TestUserA',
      avatarUrl: null,
      friendCode: 'GH-AAAAA0001',
      xp: 2450,
      level: 8,
      coins: 320,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      selectedBadge: null,
      selectedFrame: null,
      selectedChatPack: null,
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      hangmanMmr: 1000,
      hangmanWins: 0,
      hangmanLosses: 0,
      hangmanStreak: 0,
      _count: { wonMatches: 0, friends: 1 }
    },
    'test-user-b': {
      id: 'test-user-b',
      userId: 'test-user-b',
      username: 'TestUserB',
      avatarUrl: null,
      friendCode: 'GH-BBBBB0002',
      xp: 1800,
      level: 6,
      coins: 180,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-02').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      selectedBadge: null,
      selectedFrame: null,
      selectedChatPack: null,
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      hangmanMmr: 1000,
      hangmanWins: 0,
      hangmanLosses: 0,
      hangmanStreak: 0,
      _count: { wonMatches: 0, friends: 1 }
    },
    'mock-user-id': {
      id: 'mock-user-id',
      userId: 'mock-user-id',
      username: 'MockUser',
      avatarUrl: null,
      friendCode: 'GH-MOCK00001',
      xp: 500,
      level: 3,
      coins: 100,
      isGuest: false,
      role: 'SUPER_ADMIN',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      selectedBadge: null,
      selectedFrame: null,
      selectedChatPack: null,
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      hangmanMmr: 1000,
      hangmanWins: 0,
      hangmanLosses: 0,
      hangmanStreak: 0,
      _count: { wonMatches: 0, friends: 0 }
    }
  }

  const initialFriendships: Record<string, any> = {
    'friendship-ab': {
      id: 'friendship-ab',
      requesterId: 'test-user-a',
      addresseeId: 'test-user-b',
      status: 'ACCEPTED',
      createdAt: new Date('2024-02-01').toISOString(),
      updatedAt: new Date().toISOString(),
      requester: { ...initialProfiles['test-user-a'] },
      addressee: { ...initialProfiles['test-user-b'] }
    }
  }

  const initialInvites: Record<string, any> = {
    'invite-ba-001': {
      id: 'invite-ba-001',
      senderId: 'test-user-b',
      receiverId: 'test-user-a',
      roomCode: 'QAROOM',
      roomId: 'room-QAROOM',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        username: initialProfiles['test-user-b'].username,
        avatarUrl: null,
      },
      room: {
        id: 'room-QAROOM',
        roomCode: 'QAROOM',
        gameSlug: 'scribble',
        status: 'WAITING',
        maxPlayers: 4,
      }
    },
    'invite-ab-001': {
      id: 'invite-ab-001',
      senderId: 'test-user-a',
      receiverId: 'test-user-b',
      roomCode: 'QAROOM2',
      roomId: 'room-QAROOM2',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sender: {
        username: initialProfiles['test-user-a'].username,
        avatarUrl: null,
      },
      room: {
        id: 'room-QAROOM2',
        roomCode: 'QAROOM2',
        gameSlug: 'scribble',
        status: 'WAITING',
        maxPlayers: 4,
      }
    }
  }

  const defaultDb: MockDbState = {
    profiles: initialProfiles,
    rooms: {},
    sessions: {},
    friendships: initialFriendships,
    invites: initialInvites,
    notifications: {},
    inventories: {},
    challengeClaims: {},
    matches: {},
    xpEvents: {},
    tournaments: {},
    rankedMatches: {},
    rankedSeasons: {},
    seasonSnapshots: {},
    tournamentRegistrations: {},
    subTournaments: {},
    tournamentMatches: {},
    tournamentTeams: {},
    tournamentTeamMembers: {},
    tournamentAuditLogs: {},
    weeklyLeaderboardState: {
      current: {
        id: 'current',
        weekNumber: 2,
        startDate: (() => {
          const d = new Date()
          d.setHours(10, 30, 0, 0)
          const day = d.getDay()
          const diff = day === 0 ? -6 : 1 - day
          d.setDate(d.getDate() + diff)
          if (d.getTime() > Date.now()) d.setDate(d.getDate() - 7)
          return d.toISOString()
        })(),
        endDate: (() => {
          const d = new Date()
          d.setHours(10, 30, 0, 0)
          const day = d.getDay()
          const diff = day === 0 ? -6 : 1 - day
          d.setDate(d.getDate() + diff)
          if (d.getTime() > Date.now()) d.setDate(d.getDate() - 7)
          return new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })()
      }
    },
    weeklyLeaderboardArchive: {
      'week-1': {
        id: 'week-1',
        weekNumber: 1,
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        rewardsDistributed: true,
        distributedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        standings: [
          {
            rank: 1,
            profileId: 'seeded-player-1',
            username: 'ShadowNinja',
            displayName: 'Shadow Ninja',
            avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=ShadowNinja',
            selectedFrame: 'frame-neon-purple',
            selectedTitle: 'Weekly Champion',
            score: 4500,
            totalGames: 24,
            coinsEarned: 2500,
            xpEarned: 500,
            badgeSlug: 'weekly-champion'
          },
          {
            rank: 2,
            profileId: 'seeded-player-2',
            username: 'SpeedRunner',
            displayName: 'Speed Runner',
            avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=SpeedRunner',
            selectedFrame: 'frame-gold',
            selectedTitle: 'Weekly Runner Up',
            score: 3800,
            totalGames: 18,
            coinsEarned: 1800,
            xpEarned: 300,
            badgeSlug: 'weekly-runner-up'
          },
          {
            rank: 3,
            profileId: 'seeded-player-3',
            username: 'Puzzler',
            displayName: 'Puzzler King',
            avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Puzzler',
            selectedFrame: null,
            selectedTitle: 'Weekly Top 3',
            score: 3100,
            totalGames: 15,
            coinsEarned: 1200,
            xpEarned: 200,
            badgeSlug: 'weekly-top3'
          },
          {
            rank: 4,
            profileId: 'seeded-player-4',
            username: 'AlphaGamer',
            displayName: 'Alpha Gamer',
            avatarUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=AlphaGamer',
            selectedFrame: null,
            selectedTitle: null,
            score: 2200,
            totalGames: 10,
            coinsEarned: 500,
            xpEarned: 100,
            badgeSlug: null
          }
        ]
      }
    },
    weeklyLeaderboardReward: {}
  }

  cachedDb = defaultDb
  try {
    const tmpPath = DB_PATH + '.tmp'
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmpPath, JSON.stringify(defaultDb, null, 2), 'utf8')
    fs.renameSync(tmpPath, DB_PATH)
  } catch (e) {}

  return defaultDb
}

export function saveDb(state: MockDbState) {
  cachedDb = state
  let retries = 15
  while (retries > 0) {
    try {
      const tmpPath = DB_PATH + '.tmp'
      const dir = path.dirname(DB_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8')
      fs.renameSync(tmpPath, DB_PATH)
      return
    } catch (err) {
      retries--
      if (retries === 0) {
        console.error('[mockPrisma] saveDb failed after all retries:', err)
        break
      }
      const start = Date.now()
      while (Date.now() - start < 10) {}
    }
  }
}

function getOrCreateProfile(db: MockDbState, userId: string, overrideName?: string): any {
  let profile = db.profiles[userId]
  if (!profile) {
    profile = {
      id: userId,
      userId,
      username: overrideName || `User_${userId.substring(0, 6)}`,
      avatarUrl: null,
      friendCode: `GH-AUTO${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      xp: 100,
      level: 1,
      coins: 50,
      isGuest: false,
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      selectedBadge: null,
      selectedFrame: null,
      selectedChatPack: null,
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      pinnedAchievements: [],
      streakProtectionActive: false,
      lastActiveAt: new Date().toISOString(),
      _count: { wonMatches: 0, friends: 0 }
    }
    db.profiles[userId] = profile
    saveDb(db)
  }
  // Ensure fields are not missing
  if (profile.selectedTitle === undefined) profile.selectedTitle = null
  if (profile.selectedBadge === undefined) profile.selectedBadge = null
  if (profile.selectedFrame === undefined) profile.selectedFrame = null
  if (profile.selectedChatPack === undefined) profile.selectedChatPack = null
  if (profile.selectedTheme === undefined) profile.selectedTheme = null
  if (profile.selectedEffect === undefined) profile.selectedEffect = null
  if (profile.currentRank === undefined) profile.currentRank = null
  if (profile.previousRank === undefined) profile.previousRank = null
  if (profile.pinnedAchievements === undefined) profile.pinnedAchievements = []
  if (profile.streakProtectionActive === undefined) profile.streakProtectionActive = false
  if (profile.lastActiveAt === undefined) profile.lastActiveAt = new Date().toISOString()
  if (profile._count === undefined) profile._count = { wonMatches: 0, friends: 0 }
  if (profile.rankedMmr === undefined) profile.rankedMmr = 1000
  if (profile.rankedWins === undefined) profile.rankedWins = 0
  if (profile.rankedLosses === undefined) profile.rankedLosses = 0
  if (profile.rankedStreak === undefined) profile.rankedStreak = 0
  if (profile.rankedPeakRank === undefined) profile.rankedPeakRank = 'Bronze'
  if (profile.hangmanMmr === undefined) profile.hangmanMmr = 1000
  if (profile.hangmanWins === undefined) profile.hangmanWins = 0
  if (profile.hangmanLosses === undefined) profile.hangmanLosses = 0
  if (profile.hangmanStreak === undefined) profile.hangmanStreak = 0
  return profile
}

// ─── Model Mock Factory ──────────────────────────────────────────────────────

function createModelMock(modelName: string) {
  return new Proxy({}, {
    get(_target: any, action: string) {
      return async (...args: any[]) => {
        const params = args[0] || {}

        // ── Profile ──────────────────────────────────────────────────────────
        if (modelName === 'profile') {
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const { userId, id, username, friendCode } = params.where || {}
            const key = userId || id
            if (key) return getOrCreateProfile(db, key)
            if (username) return Object.values(db.profiles).find(p => p.username === username) || null
            if (friendCode) return Object.values(db.profiles).find(p => p.friendCode === friendCode) || null
            return null
          }
          if (action === 'upsert') {
            const db = loadDb()
            const key = params.where?.userId || params.create?.userId
            let profile = db.profiles[key]
            if (!profile) {
              profile = getOrCreateProfile(db, key, params.create?.username)
              Object.assign(profile, params.create || {})
              db.profiles[key] = profile
            } else {
              Object.assign(profile, params.update || {})
              profile.updatedAt = new Date().toISOString()
            }
            saveDb(db)
            return profile
          }
          if (action === 'create') {
            const db = loadDb()
            const data = params.data || {}
            const profile = getOrCreateProfile(db, data.userId, data.username)
            Object.assign(profile, data)
            db.profiles[data.userId] = profile
            saveDb(db)
            return profile
          }
          if (action === 'update') {
            const db = loadDb()
            const key = params.where?.userId || params.where?.id
            const profile = db.profiles[key]
            if (profile) {
              const d = params.data || {}
              if (d.xp?.increment)    profile.xp    += d.xp.increment
              if (d.coins?.increment) profile.coins += d.coins.increment
              Object.assign(profile, d)
              profile.updatedAt = new Date().toISOString()
              saveDb(db)
            }
            return profile
          }
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.profiles)
            if (where.username?.contains) {
              const q = where.username.contains.toLowerCase()
              list = list.filter(p => p.username.toLowerCase().includes(q))
            }
            if (where.friendCode?.equals) {
              list = list.filter(p => p.friendCode === where.friendCode.equals)
            }
            if (where.id?.not) {
              list = list.filter(p => p.id !== where.id.not)
            }
            if (where.id?.in) {
              list = list.filter(p => where.id.in.includes(p.id))
            }
            // Sort by XP descending if requested (common for leaderboards)
            if (params.orderBy?.xp === 'desc') {
              list.sort((a, b) => b.xp - a.xp)
            }
            // Apply select projection
            if (params.select) {
              const keys = Object.keys(params.select)
              list = list.map(p => {
                // Ensure all projection fields are initialized
                if (p.selectedTitle === undefined) p.selectedTitle = null
                if (p.selectedBadge === undefined) p.selectedBadge = null
                if (p.selectedFrame === undefined) p.selectedFrame = null
                if (p.selectedChatPack === undefined) p.selectedChatPack = null
                if (p.selectedTheme === undefined) p.selectedTheme = null
                if (p.selectedEffect === undefined) p.selectedEffect = null
                if (p.currentRank === undefined) p.currentRank = null
                if (p.previousRank === undefined) p.previousRank = null
                if (p._count === undefined) p._count = { wonMatches: 0, friends: 0 }
                return Object.fromEntries(keys.map(k => [k, p[k]]))
              })
            }
            if (params.take) list = list.slice(0, params.take)
            return list
          }
          if (action === 'count') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.profiles)
            if (where.xp?.gt) {
              list = list.filter(p => p.xp > where.xp.gt)
            }
            return list.length
          }
        }

        // ── Friendship ────────────────────────────────────────────────────────
        if (modelName === 'friendship') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.friendships)
            if (where.OR) {
              const ids = where.OR.flatMap((c: any) => Object.values(c))
              list = list.filter(f => ids.includes(f.requesterId) || ids.includes(f.addresseeId))
            }
            if (where.requesterId) list = list.filter(f => f.requesterId === where.requesterId)
            if (where.addresseeId) list = list.filter(f => f.addresseeId === where.addresseeId)
            if (where.status)      list = list.filter(f => f.status === where.status)
            return list
          }
          if (action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            return Object.values(db.friendships).find(f => {
              if (where.OR) {
                return where.OR.some((c: any) =>
                  Object.entries(c).every(([k, v]) => (f as any)[k] === v)
                )
              }
              return Object.entries(where).every(([k, v]) => (f as any)[k] === v)
            }) || null
          }
          if (action === 'findUnique') {
            const db = loadDb()
            const id = params.where?.id
            return db.friendships[id] || null
          }
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const id = `friendship-${d.requesterId}-${d.addresseeId}`
            const record = {
              id,
              requesterId: d.requesterId,
              addresseeId: d.addresseeId,
              status: d.status || 'PENDING',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requester: getOrCreateProfile(db, d.requesterId),
              addressee: getOrCreateProfile(db, d.addresseeId),
            }
            db.friendships[id] = record
            saveDb(db)
            return record
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            const record = db.friendships[id]
            if (record) {
              Object.assign(record, params.data || {})
              record.updatedAt = new Date().toISOString()
              saveDb(db)
            }
            return record
          }
          if (action === 'upsert') {
            const db = loadDb()
            const where = params.where || {}
            let existing: any = null
            if (where.id) existing = db.friendships[where.id]
            if (!existing && where.requesterId_addresseeId) {
              const id = `friendship-${where.requesterId_addresseeId.requesterId}-${where.requesterId_addresseeId.addresseeId}`
              existing = db.friendships[id]
            }
            if (existing) {
              Object.assign(existing, params.update || {})
              existing.updatedAt = new Date().toISOString()
              saveDb(db)
              return existing
            }
            const d = params.create || {}
            const newId = `friendship-${d.requesterId}-${d.addresseeId}`
            const record = {
              id: newId,
              ...d,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              requester: getOrCreateProfile(db, d.requesterId),
              addressee: getOrCreateProfile(db, d.addresseeId),
            }
            db.friendships[newId] = record
            saveDb(db)
            return record
          }
          if (action === 'delete') {
            const db = loadDb()
            const id = params.where?.id
            if (id) {
              delete db.friendships[id]
              saveDb(db)
            }
            return { success: true }
          }
        }

        // ── MultiplayerInvite ────────────────────────────────────────────────
        if (modelName === 'multiplayerInvite') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.invites)
            if (where.receiverId) list = list.filter(i => i.receiverId === where.receiverId)
            if (where.senderId)   list = list.filter(i => i.senderId === where.senderId)
            if (where.status)     list = list.filter(i => i.status === where.status)
            return list
          }
          if (action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            return Object.values(db.invites).find(i =>
              Object.entries(where).every(([k, v]) => (i as any)[k] === v)
            ) || null
          }
          if (action === 'findUnique') {
            const db = loadDb()
            return db.invites[params.where?.id] || null
          }
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const invite = {
              id: `invite-${Date.now()}`,
              ...d,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sender: { profile: getOrCreateProfile(db, d.senderId) },
              room: db.rooms[d.roomCode] || { roomCode: d.roomCode, gameSlug: 'scribble', status: 'WAITING' },
            }
            db.invites[invite.id] = invite
            saveDb(db)
            return invite
          }
          if (action === 'update' || action === 'updateMany') {
            const db = loadDb()
            const id = params.where?.id
            const invite = id ? db.invites[id] : null
            if (invite) {
              Object.assign(invite, params.data || {})
              saveDb(db)
            }
            // Fallback for updateMany
            if (!id && params.where?.roomId && params.where?.receiverId) {
              const list = Object.values(db.invites).filter((i: any) => i.roomId === params.where.roomId && i.receiverId === params.where.receiverId)
              list.forEach((i: any) => Object.assign(i, params.data || {}))
              saveDb(db)
              return { count: list.length }
            }
            return invite || { count: 1 }
          }
          if (action === 'delete' || action === 'deleteMany') {
            const db = loadDb()
            const id = params.where?.id
            if (id) {
              delete db.invites[id]
              saveDb(db)
            }
            return { count: 1 }
          }
        }

        // ── Notification ─────────────────────────────────────────────────────
        if (modelName === 'notification') {
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const n = { id: `notif-${Date.now()}`, ...d, isRead: false, createdAt: new Date().toISOString() }
            db.notifications[n.id] = n
            saveDb(db)
            return n
          }
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.notifications)
            if (where.profileId) list = list.filter(n => n.profileId === where.profileId)
            if (where.userId)    list = list.filter(n => n.userId === where.userId)
            if (params.take)     list = list.slice(0, params.take)
            return list
          }
          if (action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.notifications)
            if (where.profileId) list = list.filter(n => n.profileId === where.profileId)
            if (where.type)      list = list.filter(n => n.type === where.type)
            if (where.isRead !== undefined) list = list.filter(n => n.isRead === where.isRead)
            return list[0] || null
          }
          if (action === 'findUnique') {
            const db = loadDb()
            return db.notifications[params.where?.id] || null
          }
          if (action === 'update') {
            const db = loadDb()
            const n = db.notifications[params.where?.id]
            if (n) {
              Object.assign(n, params.data || {})
              saveDb(db)
            }
            return n || null
          }
          if (action === 'updateMany') return { count: 1 }
          if (action === 'delete') {
            const db = loadDb()
            delete db.notifications[params.where?.id]
            saveDb(db)
            return { success: true }
          }
        }

        // ── MultiplayerRoom ──────────────────────────────────────────────────
        if (modelName === 'multiplayerRoom') {
          if (action === 'findUnique') {
            const db = loadDb()
            const { roomCode, id } = params.where || {}
            if (roomCode) return db.rooms[roomCode] || null
            if (id) return Object.values(db.rooms).find(r => r.id === id) || null
            return null
          }
          if (action === 'findMany') {
            const db = loadDb()
            const status = params.where?.status
            const list = Object.values(db.rooms)
            return status ? list.filter(r => r.status === status) : list
          }
          if (action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            return Object.values(db.rooms).find(r =>
              Object.entries(where).every(([k, v]) => {
                if (k === 'OR') return (v as any[]).some(c => Object.entries(c).every(([ck, cv]) => (r.players || []).some((p: any) => p[ck] === cv)))
                return (r as any)[k] === v
              })
            ) || null
          }
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const room = {
              id: `room-${d.roomCode}`,
              roomCode: d.roomCode,
              gameSlug: d.gameSlug,
              status: 'WAITING',
              hostUserId: d.hostUserId,
              maxPlayers: d.maxPlayers || 4,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              players: [{
                id: `player-room-${d.roomCode}-${d.hostUserId}`,
                roomId: `room-${d.roomCode}`,
                userId: d.hostUserId,
                status: 'NOT_READY',
                joinedAt: new Date().toISOString(),
                profile: getOrCreateProfile(db, d.hostUserId),
              }],
            }
            db.rooms[d.roomCode] = room
            saveDb(db)
            return room
          }
          if (action === 'update') {
            const db = loadDb()
            const { roomCode, id } = params.where || {}
            let room = roomCode ? db.rooms[roomCode]
                     : Object.values(db.rooms).find(r => r.id === id)
            if (room && params.data) {
              Object.assign(room, params.data)
              room.updatedAt = new Date().toISOString()
              saveDb(db)
            }
            return room
          }
          if (action === 'delete') {
            const db = loadDb()
            const { roomCode, id } = params.where || {}
            const key = roomCode || (id ? Object.entries(db.rooms).find(([, r]) => r.id === id)?.[0] : null)
            if (key) {
              delete db.rooms[key]
              saveDb(db)
            }
            return { success: true }
          }
        }

        // ── MultiplayerRoomPlayer ────────────────────────────────────────────
        if (modelName === 'multiplayerRoomPlayer') {
          if (action === 'findUnique') {
            const db = loadDb()
            const { roomId_userId } = params.where || {}
            if (!roomId_userId) return null
            const { userId, roomId } = roomId_userId
            const room = Object.values(db.rooms).find(r => r.id === roomId)
            const p = room?.players?.find((p: any) => p.userId === userId)
            if (!p) return null
            return { ...p, room, profile: getOrCreateProfile(db, userId) }
          }
          if (action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            for (const room of Object.values(db.rooms)) {
              const p = (room.players || []).find((p: any) =>
                Object.entries(where).every(([k, v]) => (p as any)[k] === v || room[k] === v)
              )
              if (p) return { ...p, room }
            }
            return null
          }
          if (action === 'findMany') {
            const db = loadDb()
            const { userId, roomId } = params.where || {}
            const results: any[] = []
            for (const room of Object.values(db.rooms)) {
              if (roomId && room.id !== roomId) continue
              for (const p of (room.players || [])) {
                if (!userId || p.userId === userId) {
                  results.push({ ...p, room, profile: getOrCreateProfile(db, p.userId) })
                }
              }
            }
            return results
          }
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const room = Object.values(db.rooms).find(r => r.id === d.roomId)
            const player = {
              id: `player-${d.roomId}-${d.userId}`,
              roomId: d.roomId,
              userId: d.userId,
              status: 'NOT_READY',
              joinedAt: new Date().toISOString(),
              profile: getOrCreateProfile(db, d.userId),
            }
            if (room && !room.players.some((p: any) => p.userId === d.userId)) {
              room.players.push(player)
              saveDb(db)
            }
            return player
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            for (const room of Object.values(db.rooms)) {
              const p = room.players?.find((p: any) => p.id === id)
              if (p) {
                Object.assign(p, params.data || {})
                saveDb(db)
                return p
              }
            }
            return null
          }
          if (action === 'updateMany') {
            const db = loadDb()
            const where = params.where || {}
            let count = 0
            for (const room of Object.values(db.rooms)) {
              for (const p of (room.players || [])) {
                let matches = true
                for (const [key, val] of Object.entries(where)) {
                  if (key === 'NOT') {
                    let notMatches = true
                    for (const [nk, nv] of Object.entries(val as any)) {
                      if (nk === 'status' && p.status !== nv) notMatches = false
                      if (nk === 'userId' && p.userId !== nv) notMatches = false
                      if (nk === 'roomId' && p.roomId !== nv && room.id !== nv) notMatches = false
                    }
                    if (notMatches) matches = false
                  } else if (key === 'roomId') {
                    if (p.roomId !== val && room.id !== val) matches = false
                  } else if (key === 'userId') {
                    if (p.userId !== val) matches = false
                  } else if (key === 'status') {
                    if (p.status !== val) matches = false
                  } else {
                    if (p[key] !== val && room[key] !== val) matches = false
                  }
                }
                if (matches) {
                  Object.assign(p, params.data || {})
                  count++
                }
              }
            }
            if (count > 0) saveDb(db)
            return { count }
          }
          if (action === 'delete') {
            const db = loadDb()
            const { roomId_userId } = params.where || {}
            if (roomId_userId) {
              const { userId, roomId } = roomId_userId
              const room = Object.values(db.rooms).find(r => r.id === roomId)
              if (room) {
                room.players = room.players.filter((p: any) => p.userId !== userId)
                saveDb(db)
              }
            }
            return { success: true }
          }
          if (action === 'deleteMany') {
            const db = loadDb()
            const { roomId } = params.where || {}
            let changed = false
            for (const room of Object.values(db.rooms)) {
              if (room.id === roomId) {
                room.players = []
                changed = true
              }
            }
            if (changed) saveDb(db)
            return { count: 1 }
          }
        }

        // ── MultiplayerGameSession ───────────────────────────────────────────
        if (modelName === 'multiplayerGameSession') {
          if (action === 'findUnique') {
            const db = loadDb()
            const { roomId, id } = params.where || {}
            if (roomId) return db.sessions[roomId] || null
            if (id) return Object.values(db.sessions).find(s => s.id === id) || null
            return null
          }
          if (action === 'create') {
            const db = loadDb()
            const d = params.data || {}
            const session = {
              id: `session-${d.roomId}`,
              roomId: d.roomId,
              gameSlug: d.gameSlug,
              status: d.status || 'PLAYING',
              gameState: d.gameState,
              currentTurn: d.currentTurn,
              winnerId: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            db.sessions[d.roomId] = session
            saveDb(db)
            return session
          }
          if (action === 'update') {
            const db = loadDb()
            const { roomId, id } = params.where || {}
            const key = roomId || (id ? Object.entries(db.sessions).find(([, s]) => s.id === id)?.[0] : null)
            const session = key ? db.sessions[key] : null
            if (session && params.data) {
              Object.assign(session, params.data)
              session.updatedAt = new Date().toISOString()
              saveDb(db)
            }
            return session
          }
          if (action === 'upsert') {
            const db = loadDb()
            const { roomId } = params.where || {}
            let session = db.sessions[roomId]
            if (!session) {
              const d = params.create || {}
              session = {
                id: `session-${d.roomId}`,
                roomId: d.roomId,
                gameSlug: d.gameSlug,
                status: d.status || 'PLAYING',
                gameState: d.gameState,
                currentTurn: d.currentTurn,
                winnerId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
              db.sessions[roomId] = session
            } else {
              Object.assign(session, params.update || {})
              session.updatedAt = new Date().toISOString()
            }
            saveDb(db)
            return session
          }
          if (action === 'delete') {
            const db = loadDb()
            const { roomId } = params.where || {}
            if (roomId) {
              delete db.sessions[roomId]
              saveDb(db)
            }
            return { success: true }
          }
        }

        // ── CosmeticItem ─────────────────────────────────────────────────────
        if (modelName === 'cosmeticItem') {
          if (action === 'findMany') {
            const where = params.where || {}
            let list = [...MOCK_COSMETIC_ITEMS]
            if (where.type) {
              if (where.type.in) {
                list = list.filter(item => where.type.in.includes(item.type))
              } else {
                list = list.filter(item => item.type === where.type)
              }
            }
            if (where.isDefault !== undefined) {
              list = list.filter(item => item.isDefault === where.isDefault)
            }
            return list
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const where = params.where || {}
            const id = where.id
            const name = where.name
            if (id) return MOCK_COSMETIC_ITEMS.find(item => item.id === id) || null
            if (name) return MOCK_COSMETIC_ITEMS.find(item => item.name === name) || null
            return null
          }
        }

        // ── ProfileInventory ──────────────────────────────────────────────────
        if (modelName === 'profileInventory') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.inventories ? Object.values(db.inventories) : []
            if (where.profileId) {
              list = list.filter((i: any) => i.profileId === where.profileId)
            }
            list = list.map((i: any) => ({
              ...i,
              cosmeticItem: MOCK_COSMETIC_ITEMS.find(c => c.id === i.cosmeticItemId) || null
            }))
            return list
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            if (id) {
              const res = db.inventories?.[id] || null
              if (res) {
                res.cosmeticItem = MOCK_COSMETIC_ITEMS.find(c => c.id === res.cosmeticItemId) || null
              }
              return res
            }
            const compound = where.profileId_cosmeticItemId
            if (compound) {
              const invId = `${compound.profileId}_${compound.cosmeticItemId}`
              const res = db.inventories?.[invId] || null
              if (res) {
                res.cosmeticItem = MOCK_COSMETIC_ITEMS.find(c => c.id === res.cosmeticItemId) || null
              }
              return res
            }
            return null
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.inventories) db.inventories = {}
            const data = params.data || {}
            const id = data.id || `${data.profileId}_${data.cosmeticItemId}`
            const invRecord = {
              id,
              profileId: data.profileId,
              cosmeticItemId: data.cosmeticItemId,
              purchasedAt: new Date().toISOString(),
            }
            db.inventories[id] = invRecord
            saveDb(db)
            return {
              ...invRecord,
              cosmeticItem: MOCK_COSMETIC_ITEMS.find(c => c.id === data.cosmeticItemId) || null
            }
          }
        }

        // ── ChallengeClaim ────────────────────────────────────────────────────
        if (modelName === 'challengeClaim') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.challengeClaims ? Object.values(db.challengeClaims) : []
            if (where.profileId) {
              list = list.filter((c: any) => c.profileId === where.profileId)
            }
            return list
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            if (id) {
              return db.challengeClaims?.[id] || null
            }
            const compound = where.profileId_challengeId
            if (compound) {
              const claimId = `${compound.profileId}_${compound.challengeId}`
              return db.challengeClaims?.[claimId] || null
            }
            return null
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.challengeClaims) db.challengeClaims = {}
            const data = params.data || {}
            const id = `${data.profileId}_${data.challengeId}`
            const claimRecord = {
              id,
              profileId: data.profileId,
              challengeId: data.challengeId,
              claimedAt: new Date().toISOString()
            }
            db.challengeClaims[id] = claimRecord
            saveDb(db)
            return claimRecord
          }
        }

        // ── Tournament ────────────────────────────────────────────────────────
        if (modelName === 'tournament') {
          const populateTournamentRelations = (t: any, db: any, include: any) => {
            if (!t) return t
            const clone = { ...t }
            if (include?.registrations) {
              let regs = Object.values(db.tournamentRegistrations || {}).filter((r: any) => r.tournamentId === t.id)
              if (include.registrations.include?.profile) {
                regs = regs.map((r: any) => ({
                  ...r,
                  profile: db.profiles[r.profileId] || null
                }))
              }
              if (include.registrations.include?.team) {
                regs = regs.map((r: any) => ({
                  ...r,
                  team: db.tournamentTeams[r.teamId] || null
                }))
              }
              clone.registrations = regs
            } else {
              clone.registrations = clone.registrations || []
            }

            if (include?.subTournaments) {
              let subs = Object.values(db.subTournaments || {}).filter((s: any) => s.tournamentId === t.id)
              if (include.subTournaments.include?.matches) {
                subs = subs.map((s: any) => ({
                  ...s,
                  matches: Object.values(db.tournamentMatches || {}).filter((m: any) => m.subTournamentId === s.id)
                }))
              }
              clone.subTournaments = subs
            } else {
              clone.subTournaments = clone.subTournaments || []
            }
            return clone
          }

          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournaments || {})
            list.sort((a: any, b: any) => new Date(a.regStart || 0).getTime() - new Date(b.regStart || 0).getTime())
            return list.map((t: any) => populateTournamentRelations(t, db, params.include))
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const id = params.where?.id
            let t = null
            if (id && db.tournaments) t = db.tournaments[id] || null
            if (!t && params.where?.inviteCode) {
              t = Object.values(db.tournaments || {}).find((x: any) => x.inviteCode === params.where.inviteCode) || null
            }
            return populateTournamentRelations(t, db, params.include)
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournaments) db.tournaments = {}
            const d = params.data || {}
            const t = {
              id: d.id || `tournament-${Date.now()}`,
              name: d.name || 'Tournament',
              description: d.description || '',
              startDate: d.startDate || new Date().toISOString(),
              endDate: d.endDate || new Date().toISOString(),
              eligibleGames: d.eligibleGames || [],
              rewardCoins: d.rewardCoins || 0,
              rewardBadge: d.rewardBadge || null,
              rewardTitle: d.rewardTitle || null,
              rewardCosmetic: d.rewardCosmetic || null,
              bracketData: d.bracketData || null,
              status: d.status || 'REGISTERING',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              ...d
            }
            db.tournaments[t.id] = t
            saveDb(db)
            return t
          }
          if (action === 'update') {
            const db = loadDb()
            if (!db.tournaments) db.tournaments = {}
            const id = params.where?.id
            if (id && db.tournaments[id]) {
              const t = db.tournaments[id]
              Object.assign(t, params.data || {})
              t.updatedAt = new Date().toISOString()
              saveDb(db)
              return t
            }
            return null
          }
        }

        // ── TournamentRegistration ────────────────────────────────────────────
        if (modelName === 'tournamentRegistration') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournamentRegistrations) db.tournamentRegistrations = {}
            const d = params.data || {}
            const profileId = d.profile?.connect?.id || d.profileId
            const tournamentId = d.tournament?.connect?.id || d.tournamentId
            const teamId = d.team?.connect?.id || d.teamId
            
            const r = {
              id: d.id || `reg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              tournamentId,
              profileId,
              teamId: teamId || null,
              status: d.status || 'REGISTERED',
              waitingPosition: d.waitingPosition || 0,
              registeredAt: new Date().toISOString()
            }
            db.tournamentRegistrations[r.id] = r
            saveDb(db)
            return r
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournamentRegistrations || {})
            const where = params.where || {}
            if (where.tournamentId) list = list.filter((r: any) => r.tournamentId === where.tournamentId)
            if (where.profileId) list = list.filter((r: any) => r.profileId === where.profileId)
            if (where.teamId) list = list.filter((r: any) => r.teamId === where.teamId)
            if (where.status) list = list.filter((r: any) => r.status === where.status)
            
            if (params.include?.profile) {
              list = list.map((r: any) => ({
                ...r,
                profile: db.profiles[r.profileId] || null
              }))
            }
            if (params.include?.tournament) {
              list = list.map((r: any) => ({
                ...r,
                tournament: db.tournaments[r.tournamentId] || null
              }))
            }
            return list
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            let list = Object.values(db.tournamentRegistrations || {})
            const where = params.where || {}
            let r: any = null
            if (where.id) {
              r = db.tournamentRegistrations[where.id] || null
            } else {
              if (where.tournamentId) list = list.filter((r: any) => r.tournamentId === where.tournamentId)
              if (where.profileId) list = list.filter((r: any) => r.profileId === where.profileId)
              if (where.tournamentId_profileId) {
                const { tournamentId, profileId } = where.tournamentId_profileId
                list = list.filter((r: any) => r.tournamentId === tournamentId && r.profileId === profileId)
              }
              r = list[0] || null
            }
            if (r) {
              if (params.include?.profile) {
                r.profile = db.profiles[r.profileId] || null
              }
              if (params.include?.tournament) {
                r.tournament = db.tournaments[r.tournamentId] || null
              }
            }
            return r
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            let r = null
            if (id) {
              r = db.tournamentRegistrations[id]
            } else if (params.where?.tournamentId_profileId) {
              const { tournamentId, profileId } = params.where.tournamentId_profileId
              r = Object.values(db.tournamentRegistrations || {}).find((x: any) => x.tournamentId === tournamentId && x.profileId === profileId)
            }
            if (r) {
              Object.assign(r, params.data || {})
              saveDb(db)
            }
            return r
          }
          if (action === 'delete') {
            const db = loadDb()
            const id = params.where?.id
            let rId = id
            if (!rId && params.where?.tournamentId_profileId) {
              const { tournamentId, profileId } = params.where.tournamentId_profileId
              const found = Object.values(db.tournamentRegistrations || {}).find((x: any) => x.tournamentId === tournamentId && x.profileId === profileId) as any
              if (found) rId = found.id
            }
            if (rId && db.tournamentRegistrations) {
              delete db.tournamentRegistrations[rId]
              saveDb(db)
            }
            return { success: true }
          }
          if (action === 'deleteMany') {
            const db = loadDb()
            const where = params.where || {}
            let count = 0
            if (db.tournamentRegistrations) {
              for (const [key, value] of Object.entries(db.tournamentRegistrations) as any) {
                let match = true
                if (where.tournamentId && value.tournamentId !== where.tournamentId) match = false
                if (where.profileId && value.profileId !== where.profileId) match = false
                if (match) {
                  delete db.tournamentRegistrations[key]
                  count++
                }
              }
              saveDb(db)
            }
            return { count }
          }
        }

        // ── SubTournament ─────────────────────────────────────────────────────
        if (modelName === 'subTournament') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.subTournaments) db.subTournaments = {}
            const d = params.data || {}
            const s = {
              id: d.id || `subt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              tournamentId: d.tournament?.connect?.id || d.tournamentId,
              name: d.name || 'Division Bracket',
              capacity: d.capacity || 8,
              status: d.status || 'ACTIVE',
              winnerId: d.winnerId || null,
              createdAt: new Date().toISOString()
            }
            db.subTournaments[s.id] = s
            saveDb(db)
            return s
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.subTournaments || {})
            const where = params.where || {}
            if (where.tournamentId) list = list.filter((s: any) => s.tournamentId === where.tournamentId)
            if (where.status) list = list.filter((s: any) => s.status === where.status)
            
            if (params.include?.matches) {
              list = list.map((s: any) => {
                const matches = Object.values(db.tournamentMatches || {}).filter((m: any) => m.subTournamentId === s.id)
                return { ...s, matches }
              })
            }
            if (params.include?.tournament) {
              list = list.map((s: any) => ({
                ...s,
                tournament: db.tournaments[s.tournamentId] || null
              }))
            }
            return list
          }
          if (action === 'count') {
            const db = loadDb()
            let list = Object.values(db.subTournaments || {})
            const where = params.where || {}
            if (where.tournamentId) list = list.filter((s: any) => s.tournamentId === where.tournamentId)
            if (where.status) list = list.filter((s: any) => s.status === where.status)
            return list.length
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            if (id && db.subTournaments) {
              const s = db.subTournaments[id]
              if (s) {
                if (params.include?.matches) {
                  s.matches = Object.values(db.tournamentMatches || {}).filter((m: any) => m.subTournamentId === s.id)
                }
                if (params.include?.tournament) {
                  s.tournament = db.tournaments[s.tournamentId] || null
                }
              }
              return s || null
            }
            let list = Object.values(db.subTournaments || {})
            if (where.tournamentId) list = list.filter((s: any) => s.tournamentId === where.tournamentId)
            if (where.status) list = list.filter((s: any) => s.status === where.status)
            const s = list[0] || null
            if (s) {
              if (params.include?.matches) {
                s.matches = Object.values(db.tournamentMatches || {}).filter((m: any) => m.subTournamentId === s.id)
              }
              if (params.include?.tournament) {
                s.tournament = db.tournaments[s.tournamentId] || null
              }
            }
            return s || null
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            const s = db.subTournaments[id]
            if (s) {
              Object.assign(s, params.data || {})
              saveDb(db)
            }
            return s || null
          }
        }

        // ── TournamentMatch ───────────────────────────────────────────────────
        if (modelName === 'tournamentMatch') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournamentMatches) db.tournamentMatches = {}
            const d = params.data || {}
            const m = {
              id: d.id || `tmatch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              subTournamentId: d.subTournament?.connect?.id || d.subTournamentId,
              roundIndex: d.roundIndex || 0,
              roundName: d.roundName || '',
              matchIndex: d.matchIndex || 0,
              p1Id: d.p1Id || null,
              p2Id: d.p2Id || null,
              p1Name: d.p1Name || null,
              p2Name: d.p2Name || null,
              p1Score: d.p1Score !== undefined ? d.p1Score : null,
              p2Score: d.p2Score !== undefined ? d.p2Score : null,
              winnerId: d.winnerId || null,
              status: d.status || 'PENDING',
              matchTime: d.matchTime || new Date().toISOString(),
              joinWindowStart: d.joinWindowStart || new Date().toISOString(),
              joinWindowEnd: d.joinWindowEnd || new Date().toISOString(),
              p1Joined: d.p1Joined || false,
              p2Joined: d.p2Joined || false,
              p1Ready: d.p1Ready || false,
              p2Ready: d.p2Ready || false,
              createdAt: new Date().toISOString()
            }
            db.tournamentMatches[m.id] = m
            saveDb(db)
            return m
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournamentMatches || {})
            const where = params.where || {}
            if (where.subTournamentId) list = list.filter((m: any) => m.subTournamentId === where.subTournamentId)
            if (where.status) {
              if (typeof where.status === 'string') {
                list = list.filter((m: any) => m.status === where.status)
              } else if (where.status.in) {
                list = list.filter((m: any) => where.status.in.includes(m.status))
              }
            }
            if (where.OR) {
              list = list.filter((m: any) => {
                return where.OR.some((cond: any) => {
                  if (cond.p1Id && m.p1Id === cond.p1Id) return true
                  if (cond.p2Id && m.p2Id === cond.p2Id) return true
                  return false
                })
              })
            }
            
            if (params.include?.subTournament) {
              list = list.map((m: any) => {
                const sub = db.subTournaments[m.subTournamentId]
                if (sub && params.include.subTournament.include?.tournament) {
                  sub.tournament = db.tournaments[sub.tournamentId] || null
                }
                return { ...m, subTournament: sub || null }
              })
            }
            return list
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            if (id && db.tournamentMatches) {
              const m = db.tournamentMatches[id]
              if (m && params.include?.subTournament) {
                const sub = db.subTournaments[m.subTournamentId]
                if (sub && params.include.subTournament.include?.tournament) {
                  sub.tournament = db.tournaments[sub.tournamentId] || null
                }
                m.subTournament = sub || null
              }
              return m || null
            }
            let list = Object.values(db.tournamentMatches || {})
            if (where.subTournamentId) list = list.filter((m: any) => m.subTournamentId === where.subTournamentId)
            if (where.roundIndex !== undefined) list = list.filter((m: any) => m.roundIndex === where.roundIndex)
            if (where.matchIndex !== undefined) list = list.filter((m: any) => m.matchIndex === where.matchIndex)
            if (where.status) list = list.filter((m: any) => m.status === where.status)
            const m = list[0] || null
            if (m && params.include?.subTournament) {
              const sub = db.subTournaments[m.subTournamentId]
              if (sub && params.include.subTournament.include?.tournament) {
                sub.tournament = db.tournaments[sub.tournamentId] || null
              }
              m.subTournament = sub || null
            }
            return m
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            const m = db.tournamentMatches[id]
            if (m) {
              Object.assign(m, params.data || {})
              saveDb(db)
            }
            return m || null
          }
        }

        // ── TournamentTeam ────────────────────────────────────────────────────
        if (modelName === 'tournamentTeam') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournamentTeams) db.tournamentTeams = {}
            const d = params.data || {}
            const t = {
              id: d.id || `team-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              tournamentId: d.tournament?.connect?.id || d.tournamentId,
              name: d.name || 'Team Name',
              captainId: d.captainId || '',
              inviteCode: d.inviteCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
              isReady: d.isReady || false,
              createdAt: new Date().toISOString()
            }
            db.tournamentTeams[t.id] = t
            saveDb(db)
            return t
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournamentTeams || {})
            const where = params.where || {}
            if (where.tournamentId) list = list.filter((t: any) => t.tournamentId === where.tournamentId)
            
            if (params.include?.members) {
              list = list.map((t: any) => {
                const members = Object.values(db.tournamentTeamMembers || {}).filter((m: any) => m.teamId === t.id)
                return { ...t, members }
              })
            }
            return list
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.tournamentTeams || {})
            if (where.id) return db.tournamentTeams[where.id] || null
            if (where.inviteCode) list = list.filter((t: any) => t.inviteCode === where.inviteCode)
            if (where.tournamentId) list = list.filter((t: any) => t.tournamentId === where.tournamentId)
            if (where.captainId) list = list.filter((t: any) => t.captainId === where.captainId)
            const t = list[0] || null
            if (t) {
              if (params.include?.members) {
                t.members = Object.values(db.tournamentTeamMembers || {}).filter((m: any) => m.teamId === t.id).map((m: any) => ({
                  ...m,
                  profile: db.profiles[m.profileId] || null
                }))
              }
            }
            return t
          }
          if (action === 'update') {
            const db = loadDb()
            const id = params.where?.id
            const t = db.tournamentTeams[id]
            if (t) {
              Object.assign(t, params.data || {})
              saveDb(db)
            }
            return t || null
          }
          if (action === 'delete') {
            const db = loadDb()
            const id = params.where?.id
            if (id && db.tournamentTeams) {
              delete db.tournamentTeams[id]
              saveDb(db)
            }
            return { success: true }
          }
        }

        // ── TournamentTeamMember ──────────────────────────────────────────────
        if (modelName === 'tournamentTeamMember') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournamentTeamMembers) db.tournamentTeamMembers = {}
            const d = params.data || {}
            const m = {
              id: d.id || `teamm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              teamId: d.team?.connect?.id || d.teamId,
              profileId: d.profile?.connect?.id || d.profileId,
              joinedAt: new Date().toISOString()
            }
            db.tournamentTeamMembers[m.id] = m
            saveDb(db)
            return m
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournamentTeamMembers || {})
            const where = params.where || {}
            if (where.teamId) list = list.filter((m: any) => m.teamId === where.teamId)
            if (where.profileId) list = list.filter((m: any) => m.profileId === where.profileId)
            
            if (params.include?.profile) {
              list = list.map((m: any) => ({
                ...m,
                profile: db.profiles[m.profileId] || null
              }))
            }
            return list
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.tournamentTeamMembers || {})
            if (where.id) return db.tournamentTeamMembers[where.id] || null
            if (where.teamId_profileId) {
              const { teamId, profileId } = where.teamId_profileId
              list = list.filter((m: any) => m.teamId === teamId && m.profileId === profileId)
            }
            const m = list[0] || null
            if (m && params.include?.profile) {
              m.profile = db.profiles[m.profileId] || null
            }
            return m
          }
          if (action === 'delete') {
            const db = loadDb()
            const id = params.where?.id
            let mId = id
            if (!mId && params.where?.teamId_profileId) {
              const { teamId, profileId } = params.where.teamId_profileId
              const found = Object.values(db.tournamentTeamMembers || {}).find((x: any) => x.teamId === teamId && x.profileId === profileId) as any
              if (found) mId = found.id
            }
            if (mId && db.tournamentTeamMembers) {
              delete db.tournamentTeamMembers[mId]
              saveDb(db)
            }
            return { success: true }
          }
        }

        // ── TournamentAuditLog ──────────────────────────────────────────────
        if (modelName === 'tournamentAuditLog') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.tournamentAuditLogs) db.tournamentAuditLogs = {}
            const d = params.data || {}
            const m = {
              id: d.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              tournamentId: d.tournament?.connect?.id || d.tournamentId,
              event: d.event || '',
              details: d.details || null,
              createdAt: new Date().toISOString()
            }
            db.tournamentAuditLogs[m.id] = m
            saveDb(db)
            return m
          }
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.tournamentAuditLogs || {})
            const where = params.where || {}
            if (where.tournamentId) list = list.filter((m: any) => m.tournamentId === where.tournamentId)
            return list
          }
        }

        // ── MatchRecord ──────────────────────────────────────────────────────
        if (modelName === 'matchRecord') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.matches) db.matches = {}
            const data = params.data || {}
            const id = data.id || `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const record = {
              id,
              roomCode: data.roomCode || null,
              gameId: data.gameId || null,
              player1Id: data.player1Id || null,
              player2Id: data.player2Id || null,
              player1Score: data.player1Score || 0,
              player2Score: data.player2Score || 0,
              winnerId: data.winnerId || null,
              xpEarned: data.xpEarned || 0,
              coinsEarned: data.coinsEarned || 0,
              durationSecs: data.durationSecs || null,
              playedAt: data.playedAt || new Date().toISOString()
            }
            db.matches[id] = record
            saveDb(db)
            return record
          }
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.matches ? Object.values(db.matches) : []
            if (where.OR) {
              list = list.filter((m: any) => {
                return where.OR.some((cond: any) => {
                  if (cond.player1Id && m.player1Id !== cond.player1Id) return false
                  if (cond.player2Id && m.player2Id !== cond.player2Id) return false
                  return true
                })
              })
            }
            if (where.playedAt?.gte) {
              const gteDate = new Date(where.playedAt.gte)
              list = list.filter((m: any) => new Date(m.playedAt) >= gteDate)
            }
            if (where.winnerId) {
              list = list.filter((m: any) => m.winnerId === where.winnerId)
            }
            // Sorting / take
            list.sort((a: any, b: any) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
            if (params.take) {
              list = list.slice(0, params.take)
            }
            return list
          }
          if (action === 'count') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.matches ? Object.values(db.matches) : []
            if (where.OR) {
              list = list.filter((m: any) => {
                return where.OR.some((cond: any) => {
                  let match = true
                  if (cond.player1Id && m.player1Id !== cond.player1Id) match = false
                  if (cond.player2Id && m.player2Id !== cond.player2Id) match = false
                  return match
                })
              })
            }
            if (where.winnerId) {
              list = list.filter((m: any) => m.winnerId === where.winnerId)
            }
            if (where.playedAt?.gte) {
              const gteDate = new Date(where.playedAt.gte)
              list = list.filter((m: any) => new Date(m.playedAt) >= gteDate)
            }
            return list.length
          }
        }

        // ── XPEvent ──────────────────────────────────────────────────────────
        if (modelName === 'xPEvent') {
          if (action === 'create') {
            const db = loadDb()
            if (!db.xpEvents) db.xpEvents = {}
            const data = params.data || {}
            const id = data.id || `xpevent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const record = {
              id,
              profileId: data.profileId || null,
              type: data.type || 'GAME_PLAY',
              amount: data.amount || 0,
              meta: data.meta || null,
              createdAt: data.createdAt || new Date().toISOString()
            }
            db.xpEvents[id] = record
            saveDb(db)
            return record
          }
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.xpEvents ? Object.values(db.xpEvents) : []
            if (where.profileId) {
              list = list.filter((x: any) => x.profileId === where.profileId)
            }
            if (where.createdAt?.gte) {
              const gteDate = new Date(where.createdAt.gte)
              list = list.filter((x: any) => new Date(x.createdAt) >= gteDate)
            }
            return list
          }
          if (action === 'aggregate') {
            const db = loadDb()
            const where = params.where || {}
            let list = db.xpEvents ? Object.values(db.xpEvents) : []
            if (where.profileId) {
              list = list.filter((x: any) => x.profileId === where.profileId)
            }
            if (where.createdAt?.gte) {
              const gteDate = new Date(where.createdAt.gte)
              list = list.filter((x: any) => new Date(x.createdAt) >= gteDate)
            }
            const sum = list.reduce((acc: number, x: any) => acc + (x.amount || 0), 0)
            return {
              _sum: {
                amount: sum
              }
            }
          }
        }

        // ── Ad ───────────────────────────────────────────────────────────────
        if (modelName === 'ad') {
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.ads || {})
            const where = params.where || {}
            if (where.active !== undefined) {
              list = list.filter((a: any) => a.active === where.active)
            }
            if (where.id) {
              if (where.id.not) {
                list = list.filter((a: any) => a.id !== where.id.not)
              } else {
                list = list.filter((a: any) => a.id === where.id)
              }
            }
            if (where.OR) {
              list = list.filter((a: any) => {
                return where.OR.some((cond: any) => {
                  if (cond.allGames !== undefined && a.allGames === cond.allGames) return true
                  if (cond.games?.has && a.games?.includes(cond.games.has)) return true
                  return false
                })
              })
            }
            if (params.orderBy?.createdAt === 'desc') {
              list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            }
            if (params.take) {
              list = list.slice(0, params.take)
            }
            return list
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            if (where.id) {
              return db.ads?.[where.id] || null
            }
            return null
          }
          if (action === 'create') {
            const db = loadDb()
            const data = params.data || {}
            const id = data.id || `ad-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
            const record = {
              id,
              imageUrl: data.imageUrl,
              targetUrl: data.targetUrl,
              durationSecs: data.durationSecs ?? 5,
              duration_seconds: data.duration_seconds ?? data.durationSecs ?? 5,
              skip_after_seconds: data.skip_after_seconds ?? 5,
              allGames: data.allGames ?? false,
              games: data.games ?? [],
              active: data.active ?? true,
              impressions: 0,
              clicks: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            if (!db.ads) db.ads = {}
            db.ads[id] = record
            saveDb(db)
            return record
          }
          if (action === 'update') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            const record = db.ads?.[id]
            if (record) {
              const data = params.data || {}
              if (data.impressions?.increment) {
                record.impressions += data.impressions.increment
              } else if (data.clicks?.increment) {
                record.clicks += data.clicks.increment
              } else {
                if (data.imageUrl !== undefined) record.imageUrl = data.imageUrl
                if (data.targetUrl !== undefined) record.targetUrl = data.targetUrl
                if (data.durationSecs !== undefined) record.durationSecs = data.durationSecs
                if (data.duration_seconds !== undefined) record.duration_seconds = data.duration_seconds
                if (data.skip_after_seconds !== undefined) record.skip_after_seconds = data.skip_after_seconds
                if (data.allGames !== undefined) record.allGames = data.allGames
                if (data.games !== undefined) record.games = data.games
                if (data.active !== undefined) record.active = data.active
              }
              record.updatedAt = new Date().toISOString()
              saveDb(db)
            }
            return record
          }
          if (action === 'delete') {
            const db = loadDb()
            const where = params.where || {}
            const id = where.id
            if (id && db.ads?.[id]) {
              delete db.ads[id]
              saveDb(db)
            }
            return { id }
          }
        }

        // ── Game ─────────────────────────────────────────────────────────────
        if (modelName === 'game') {
          if (action === 'findUnique') {
            const slug = params.where?.slug
            const names: Record<string, string> = {
              scribble: 'Scribble', memory: 'Memory Match', 'dots-boxes': 'Dots & Boxes',
              cricket: 'Hand Cricket', 'rock-paper': 'Rock Paper Scissors',
            }
            return { id: `game-${slug}`, slug, name: names[slug] || slug, description: 'Game', type: 'REWRITTEN', isMultiplay: true, category: 'social' }
          }
        }

        // ── RankedSeason ─────────────────────────────────────────────────────
        if (modelName === 'rankedSeason') {
          if (action === 'findMany') {
            const db = loadDb()
            let list = Object.values(db.rankedSeasons || {})
            if (list.length === 0) {
              const defaultSeason = {
                id: 'season-genesis',
                name: 'Season 1: Genesis',
                startDate: new Date('2026-06-01T00:00:00Z').toISOString(),
                endDate: new Date('2026-08-31T23:59:59Z').toISOString(),
                isActive: true,
                rewards: { first: 'Season 1 Champion Title', top10: 'Gold Rank Frame' }
              }
              db.rankedSeasons = { 'season-genesis': defaultSeason }
              saveDb(db)
              list = [defaultSeason]
            }
            return list
          }
          if (action === 'findFirst' || action === 'findUnique') {
            const db = loadDb()
            const list = Object.values(db.rankedSeasons || {})
            if (list.length === 0) {
              const defaultSeason = {
                id: 'season-genesis',
                name: 'Season 1: Genesis',
                startDate: new Date('2026-06-01T00:00:00Z').toISOString(),
                endDate: new Date('2026-08-31T23:59:59Z').toISOString(),
                isActive: true,
                rewards: { first: 'Season 1 Champion Title', top10: 'Gold Rank Frame' }
              }
              db.rankedSeasons = { 'season-genesis': defaultSeason }
              saveDb(db)
              return defaultSeason
            }
            const active = list.find((s: any) => s.isActive)
            return active || list[0]
          }
          if (action === 'create') {
            const db = loadDb()
            const data = params.data || {}
            const id = data.id || `season-${Date.now()}`
            const record = {
              id,
              name: data.name,
              startDate: data.startDate,
              endDate: data.endDate,
              isActive: data.isActive ?? true,
              rewards: data.rewards || null
            }
            if (!db.rankedSeasons) db.rankedSeasons = {}
            db.rankedSeasons[id] = record
            saveDb(db)
            return record
          }
        }

        // ── SeasonSnapshot ───────────────────────────────────────────────────
        if (modelName === 'seasonSnapshot') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.seasonSnapshots || {})
            if (where.seasonId) {
              list = list.filter((s: any) => s.seasonId === where.seasonId)
            }
            if (where.profileId) {
              list = list.filter((s: any) => s.profileId === where.profileId)
            }
            return list
          }
          if (action === 'create') {
            const db = loadDb()
            const data = params.data || {}
            const id = data.id || `snap-${Date.now()}`
            const record = {
              id,
              seasonId: data.seasonId,
              profileId: data.profileId,
              username: data.username,
              mmr: data.mmr,
              rank: data.rank,
              wins: data.wins,
              losses: data.losses,
              winRate: data.winRate
            }
            if (!db.seasonSnapshots) db.seasonSnapshots = {}
            db.seasonSnapshots[id] = record
            saveDb(db)
            return record
          }
        }

        // ── RankedMatch ──────────────────────────────────────────────────────
        if (modelName === 'rankedMatch') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            let list = Object.values(db.rankedMatches || {})
            if (where.profileId) {
              list = list.filter((m: any) => m.profileId === where.profileId)
            }
            list.sort((a: any, b: any) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
            return list
          }
          if (action === 'create') {
            const db = loadDb()
            const data = params.data || {}
            const id = data.id || `rmatch-${Date.now()}`
            const record = {
              id,
              profileId: data.profileId,
              opponentName: data.opponentName,
              result: data.result,
              mmrChange: data.mmrChange,
              playedAt: new Date().toISOString()
            }
            if (!db.rankedMatches) db.rankedMatches = {}
            db.rankedMatches[id] = record
            saveDb(db)
            return record
          }
        }
      
        // ── Achievement ──────────────────────────────────────────────────────
        if (modelName === 'achievement') {
          if (action === 'findMany') {
            return [
              { id: 'first-game', slug: 'first-game', name: 'First Move', description: 'Play your first game.', xpReward: 50, coinReward: 10, category: 'Gameplay' },
              { id: 'first-win', slug: 'first-win', name: 'Winner Winner', description: 'Win your first match.', xpReward: 100, coinReward: 25, category: 'Wins' },
              { id: 'level-5', slug: 'level-5', name: 'Rising Star', description: 'Reach level 5.', xpReward: 150, coinReward: 50, category: 'Streaks' },
              { id: 'streak-3', slug: 'streak-3', name: 'On Fire', description: 'Maintain a 3-day active streak.', xpReward: 150, coinReward: 50, category: 'Streaks' }
            ]
          }
        }

        // ── UserAchievement ──────────────────────────────────────────────────
        if (modelName === 'userAchievement') {
          if (action === 'findMany') {
            const db = loadDb()
            const where = params.where || {}
            return [
              {
                id: 'ua-1',
                profileId: where.profileId || 'test-user-a',
                achievementId: 'first-game',
                unlockedAt: new Date().toISOString(),
                achievement: { id: 'first-game', slug: 'first-game', name: 'First Move', description: 'Play your first game.', xpReward: 50, coinReward: 10, category: 'Gameplay' }
              },
              {
                id: 'ua-2',
                profileId: where.profileId || 'test-user-a',
                achievementId: 'first-win',
                unlockedAt: new Date().toISOString(),
                achievement: { id: 'first-win', slug: 'first-win', name: 'Winner Winner', description: 'Win your first match.', xpReward: 100, coinReward: 25, category: 'Wins' }
              }
            ]
          }
        }

        // ── WeeklyLeaderboardState ───────────────────────────────────────────
        if (modelName === 'weeklyLeaderboardState') {
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const state = (db.weeklyLeaderboardState || {})['current']
            if (state) return state
            // return a safe default if not seeded
            const d = new Date(); d.setHours(10,30,0,0)
            const day = d.getDay(); const diff = day===0?-6:1-day; d.setDate(d.getDate()+diff)
            if (d.getTime() > Date.now()) d.setDate(d.getDate()-7)
            return { id:'current', weekNumber:2, startDate:d.toISOString(), endDate:new Date(d.getTime()+7*24*60*60*1000).toISOString() }
          }
          if (action === 'upsert' || action === 'update') {
            const db = loadDb()
            if (!db.weeklyLeaderboardState) db.weeklyLeaderboardState = {}
            const existing = db.weeklyLeaderboardState['current'] || {}
            const data = params.update || params.create || params.data || {}
            db.weeklyLeaderboardState['current'] = { ...existing, ...data }
            saveDb(db)
            return db.weeklyLeaderboardState['current']
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.weeklyLeaderboardState) db.weeklyLeaderboardState = {}
            const data = params.data || {}
            db.weeklyLeaderboardState[data.id || 'current'] = data
            saveDb(db)
            return data
          }
        }

        // ── WeeklyLeaderboardArchive ─────────────────────────────────────────
        if (modelName === 'weeklyLeaderboardArchive') {
          if (action === 'findMany') {
            const db = loadDb()
            const archives = Object.values(db.weeklyLeaderboardArchive || {})
            const where = params.where || {}
            let result = archives as any[]
            if (where.weekNumber !== undefined) result = result.filter(a => a.weekNumber === where.weekNumber)
            const orderBy = params.orderBy
            if (orderBy?.weekNumber === 'desc') result.sort((a,b)=>b.weekNumber-a.weekNumber)
            else result.sort((a,b)=>a.weekNumber-b.weekNumber)
            return result
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const where = params.where || {}
            const archives = Object.values(db.weeklyLeaderboardArchive || {}) as any[]
            if (where.weekNumber !== undefined) return archives.find(a=>a.weekNumber===where.weekNumber) || null
            if (where.id) return (db.weeklyLeaderboardArchive || {})[where.id] || null
            return archives[0] || null
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.weeklyLeaderboardArchive) db.weeklyLeaderboardArchive = {}
            const data = params.data || {}
            const id = data.id || `archive-${Date.now()}`
            const record = { ...data, id }
            db.weeklyLeaderboardArchive[id] = record
            saveDb(db)
            return record
          }
          if (action === 'update') {
            const db = loadDb()
            if (!db.weeklyLeaderboardArchive) db.weeklyLeaderboardArchive = {}
            const where = params.where || {}
            const key = where.id || Object.keys(db.weeklyLeaderboardArchive).find(k => {
              const a = (db.weeklyLeaderboardArchive||{})[k]
              return where.weekNumber !== undefined && a.weekNumber === where.weekNumber
            })
            if (key && db.weeklyLeaderboardArchive[key]) {
              const upd = params.data || {}
              db.weeklyLeaderboardArchive[key] = { ...db.weeklyLeaderboardArchive[key], ...upd }
              saveDb(db)
              return db.weeklyLeaderboardArchive[key]
            }
            return null
          }
          if (action === 'count') {
            const db = loadDb()
            return Object.keys(db.weeklyLeaderboardArchive || {}).length
          }
        }

        // ── WeeklyLeaderboardReward ──────────────────────────────────────────
        if (modelName === 'weeklyLeaderboardReward') {
          if (action === 'findMany') {
            const db = loadDb()
            const rewards = Object.values(db.weeklyLeaderboardReward || {}) as any[]
            const where = params.where || {}
            let result = rewards
            if (where.profileId) result = result.filter(r => r.profileId === where.profileId)
            if (where.weekNumber !== undefined) result = result.filter(r => r.weekNumber === where.weekNumber)
            if (where.claimed !== undefined) result = result.filter(r => r.claimed === where.claimed)
            if (params.orderBy?.createdAt === 'desc') result.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())
            return result
          }
          if (action === 'findUnique' || action === 'findFirst') {
            const db = loadDb()
            const rewards = Object.values(db.weeklyLeaderboardReward || {}) as any[]
            const where = params.where || {}
            if (where.profileId_weekNumber) {
              return rewards.find(r=>r.profileId===where.profileId_weekNumber.profileId && r.weekNumber===where.profileId_weekNumber.weekNumber) || null
            }
            if (where.profileId && where.weekNumber !== undefined) {
              return rewards.find(r=>r.profileId===where.profileId && r.weekNumber===where.weekNumber) || null
            }
            if (where.id) return (db.weeklyLeaderboardReward || {})[where.id] || null
            if (where.profileId && !where.weekNumber) return rewards.find(r=>r.profileId===where.profileId) || null
            return rewards[0] || null
          }
          if (action === 'create') {
            const db = loadDb()
            if (!db.weeklyLeaderboardReward) db.weeklyLeaderboardReward = {}
            const data = params.data || {}
            const id = data.id || `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`
            const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() }
            db.weeklyLeaderboardReward[id] = record
            saveDb(db)
            return record
          }
          if (action === 'createMany') {
            const db = loadDb()
            if (!db.weeklyLeaderboardReward) db.weeklyLeaderboardReward = {}
            const items = params.data || []
            for (const data of items) {
              const id = data.id || `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`
              db.weeklyLeaderboardReward[id] = { ...data, id, createdAt: data.createdAt || new Date().toISOString() }
            }
            saveDb(db)
            return { count: items.length }
          }
          if (action === 'update') {
            const db = loadDb()
            if (!db.weeklyLeaderboardReward) db.weeklyLeaderboardReward = {}
            const where = params.where || {}
            let key = where.id
            if (!key && where.profileId_weekNumber) {
              const rewards = Object.entries(db.weeklyLeaderboardReward)
              const found = rewards.find(([,r]:any)=>r.profileId===where.profileId_weekNumber.profileId && r.weekNumber===where.profileId_weekNumber.weekNumber)
              key = found ? found[0] : null
            }
            if (key && db.weeklyLeaderboardReward[key]) {
              const upd = params.data || {}
              db.weeklyLeaderboardReward[key] = { ...db.weeklyLeaderboardReward[key], ...upd }
              saveDb(db)
              return db.weeklyLeaderboardReward[key]
            }
            return null
          }
          if (action === 'count') {
            const db = loadDb()
            const rewards = Object.values(db.weeklyLeaderboardReward || {}) as any[]
            const where = params.where || {}
            let result = rewards
            if (where.profileId) result = result.filter(r=>r.profileId===where.profileId)
            if (where.weekNumber !== undefined) result = result.filter(r=>r.weekNumber===where.weekNumber)
            return result.length
          }
        }

        // ── Fallback Actions for unregistered or secondary models ───────────
        if (action === 'findMany')   return []
        if (action === 'findUnique') return null
        if (action === 'findFirst')  return null
        if (action === 'count')      return 0
        if (action === 'create')     return { id: `mock-${Date.now()}` }
        if (action === 'update')     return null
        if (action === 'upsert')     return { id: `mock-${Date.now()}` }
        if (action === 'delete')     return { success: true }
        if (action === 'deleteMany') return { count: 0 }
        if (action === 'updateMany') return { count: 0 }
        if (action === 'aggregate')  return { _sum: { score: 0, amount: 0 }, _count: 0 }
        if (action === 'groupBy')    return []

        return null
      }
    }
  })
}

// ─── Exported Proxy Factory ──────────────────────────────────────────────────

export function createPrismaMockProxy(realPrisma: any) {
  const handler = {
    get(target: any, prop: string): any {
      if (prop === '$queryRaw')  return async () => [{ '?column?': 1 }]
      if (prop === '$disconnect') return async () => {}
      if (prop === '$transaction') {
        return async (arg: any) => {
          if (typeof arg === 'function') {
            const proxy = new Proxy(target, handler)
            return arg(proxy)
          }
          if (Array.isArray(arg)) return Promise.all(arg)
          return arg
        }
      }

      const models = [
        'profile', 'profileGameStats', 'preferences', 'game', 'score',
        'matchRecord', 'xPEvent', 'friendship', 'notification', 'achievement',
        'userAchievement', 'cosmeticItem', 'profileInventory', 'dailyRewardLog',
        'battlePass', 'battlePassTier', 'profileBattlePass', 'analyticsEvent',
        'multiplayerRoom', 'multiplayerGameSession', 'multiplayerRoomPlayer',
        'multiplayerInvite', 'multiplayerChatMessage', 'challengeClaim', 'tournament',
        'rankedSeason', 'seasonSnapshot', 'rankedMatch', 'ad',
        'tournamentRegistration', 'subTournament', 'tournamentMatch', 'tournamentTeam', 'tournamentTeamMember',
        'tournamentAuditLog',
        'weeklyLeaderboardState', 'weeklyLeaderboardArchive', 'weeklyLeaderboardReward',
        // Also support potential legacy aliases just in case
        'matchResult', 'gameScore',
      ]
      if (models.includes(prop)) return createModelMock(prop)
      return target ? target[prop] : undefined
    }
  }
  return new Proxy(realPrisma || {}, handler)
}
