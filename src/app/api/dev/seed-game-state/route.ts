import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

// Only available in MOCK_AUTH / development mode
export async function POST(req: NextRequest) {
  if (process.env.MOCK_AUTH !== 'true' && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { roomId, roomCode, gameSlug, hostUserId, players, gameState } = body

    const DB_PATH = path.join(process.cwd(), 'node_modules', '.cache', 'mock_db_state.json')

    let db: any = { profiles: {}, rooms: {}, sessions: {}, friendships: {}, invites: {}, notifications: {}, inventories: {} }
    if (fs.existsSync(DB_PATH)) {
      try { db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) } catch {}
    }

    // Ensure player profiles exist
    for (const userId of players) {
      if (!db.profiles[userId]) {
        db.profiles[userId] = {
          id: userId, userId, username: `Player_${userId.slice(-4)}`,
          avatarUrl: null, friendCode: `GH-${userId.toUpperCase().slice(-8)}`,
          xp: 1000, level: 5, coins: 5000, isGuest: false,
          lastSeenAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          selectedTitle: null, selectedFrame: null, selectedEffect: null,
          currentRank: null, previousRank: null, _count: { wonMatches: 0, friends: 0 }
        }
      }
    }

    // Seed the room
    db.rooms = db.rooms || {}
    db.rooms[roomId] = {
      id: roomId,
      roomCode,
      gameSlug,
      hostUserId,
      status: 'PLAYING',
      maxPlayers: players.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      players: players.map((userId: string, idx: number) => ({
        id: `${roomId}-player-${idx}`,
        roomId,
        userId,
        status: 'READY',
        joinedAt: new Date().toISOString()
      }))
    }

    // Seed the game session
    db.sessions = db.sessions || {}
    db.sessions[roomId] = {
      id: `session-${roomId}`,
      roomId,
      gameSlug,
      status: 'PLAYING',
      gameState,
      currentTurn: gameState?.battingUserId || gameState?.currentTurn || null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8')

    return NextResponse.json({ success: true, roomCode, roomId })
  } catch (err: any) {
    console.error('[DEV SEED] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
