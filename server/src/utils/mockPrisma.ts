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
  { id: 'item-chat-cricket', name: 'Cricket Pack', type: 'CHAT_PACK', priceCoins: 80, assetUrl: 'Cricket', isDefault: false, metadata: { messages: ['Sixer! 🏏', 'Bowled him! 🎯', 'Howzzat! 📢', 'Good bowling! ⚾'] } },
  { id: 'item-chat-legend', name: 'Legend Pack', type: 'CHAT_PACK', priceCoins: 120, assetUrl: 'Legend', isDefault: false, metadata: { messages: ['What A Move! 🧠', 'Too Easy! ⚡', 'Close One! 😱', 'Good Luck! 🍀'] } },

  // Scratchers
  { id: 'item-scratch-bronze', name: 'Bronze Scratcher', type: 'SCRATCHER', priceCoins: 20, assetUrl: 'Bronze', isDefault: false, metadata: { rarity: 'COMMON', description: 'Scratch to win basic Coins or XP.' } },
  { id: 'item-scratch-silver', name: 'Silver Scratcher', type: 'SCRATCHER', priceCoins: 50, assetUrl: 'Silver', isDefault: false, metadata: { rarity: 'RARE', description: 'Scratch to win decent Coins, XP, or Rare items.' } },
  { id: 'item-scratch-gold', name: 'Gold Scratcher', type: 'SCRATCHER', priceCoins: 100, assetUrl: 'Gold', isDefault: false, metadata: { rarity: 'EPIC', description: 'Scratch to win huge Coins, XP, or Epic items.' } },
  { id: 'item-scratch-legendary', name: 'Legendary Scratcher', type: 'SCRATCHER', priceCoins: 250, assetUrl: 'Legendary', isDefault: false, metadata: { rarity: 'LEGENDARY', description: 'Scratch to win Legendary rewards!' } },

  // Titles
  { id: 'title-rookie', name: 'Rookie', type: 'TITLE', priceCoins: 50, isDefault: false, metadata: { description: 'New kid on the block' } },
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
  { id: 'frame-mythic', name: 'Mythic', type: 'AVATAR_FRAME', priceCoins: 400, isDefault: false, metadata: { description: 'Ascendant legendary border' } }
]

let cachedDb: MockDbState | null = null

export function loadDb(): MockDbState {
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
          cachedDb = parsed
          return parsed
        }
      }
    }
  } catch (err) {
    if (cachedDb) return cachedDb
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
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
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
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
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
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date().toISOString(),
      selectedTitle: null,
      selectedBadge: null,
      selectedFrame: null,
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
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
    xpEvents: {}
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
  try {
    const tmpPath = DB_PATH + '.tmp'
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8')
    fs.renameSync(tmpPath, DB_PATH)
  } catch (err) {}
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
      selectedTheme: null,
      selectedEffect: null,
      currentRank: null,
      previousRank: null,
      _count: { wonMatches: 0, friends: 0 }
    }
    db.profiles[userId] = profile
    saveDb(db)
  }
  // Ensure fields are not missing
  if (profile.selectedTitle === undefined) profile.selectedTitle = null
  if (profile.selectedBadge === undefined) profile.selectedBadge = null
  if (profile.selectedFrame === undefined) profile.selectedFrame = null
  if (profile.selectedTheme === undefined) profile.selectedTheme = null
  if (profile.selectedEffect === undefined) profile.selectedEffect = null
  if (profile.currentRank === undefined) profile.currentRank = null
  if (profile.previousRank === undefined) profile.previousRank = null
  if (profile._count === undefined) profile._count = { wonMatches: 0, friends: 0 }
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
                id: `player-${d.hostUserId}`,
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
              id: `player-${d.userId}`,
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
            const userId = id?.replace('player-', '')
            for (const room of Object.values(db.rooms)) {
              const p = room.players?.find((p: any) => p.userId === userId)
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
            const { roomId, status } = params.where || {}
            let count = 0
            for (const room of Object.values(db.rooms)) {
              if (room.id === roomId) {
                for (const p of (room.players || [])) {
                  if (!status || p.status === status) {
                     Object.assign(p, params.data || {})
                     count++
                  }
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
        'multiplayerInvite', 'multiplayerChatMessage',
        // Also support potential legacy aliases just in case
        'matchResult', 'gameScore',
      ]
      if (models.includes(prop)) return createModelMock(prop)
      return target ? target[prop] : undefined
    }
  }
  return new Proxy(realPrisma || {}, handler)
}
