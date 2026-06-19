const inMemoryProfiles = new Map<string, any>()
const inMemoryRooms = new Map<string, any>()
const inMemorySessions = new Map<string, any>()

export function createPrismaMockProxy(realPrisma: any) {
  const handler = {
    get(target: any, prop: string): any {
      if (prop === '$queryRaw') {
        return async () => [{ '?column?': 1 }]
      }
      if (prop === '$disconnect') {
        return async () => {}
      }

      const models = ['profile', 'multiplayerRoom', 'multiplayerGameSession', 'multiplayerRoomPlayer', 'friendship', 'game', 'multiplayerInvite', 'notification']
      if (models.includes(prop)) {
        return createModelMock(prop)
      }

      return target ? target[prop] : undefined
    }
  }
  return new Proxy(realPrisma || {}, handler)
}

function createModelMock(modelName: string) {
  return new Proxy({}, {
    get(target: any, action: string) {
      return async (...args: any[]) => {
        console.log(`[MOCK PRISMA QUERY] ${modelName}.${action}`, JSON.stringify(args))
        const params = args[0] || {}

        if (modelName === 'profile') {
          if (action === 'findUnique' || action === 'findFirst') {
            const userId = params.where?.userId || params.where?.id
            if (!userId) return null
            let profile = inMemoryProfiles.get(userId)
            if (!profile) {
              profile = {
                id: userId,
                userId,
                username: params.where?.username || `User_${userId.substring(0, 5)}`,
                avatarUrl: null,
                xp: 100,
                level: 1,
                coins: 50,
                createdAt: new Date(),
                updatedAt: new Date()
              }
              inMemoryProfiles.set(userId, profile)
            }
            return profile
          }
          if (action === 'upsert') {
            const userId = params.where?.userId || params.create?.userId
            let profile = inMemoryProfiles.get(userId)
            if (!profile) {
              profile = {
                id: userId,
                userId,
                username: params.create?.username || `User_${userId.substring(0, 5)}`,
                avatarUrl: null,
                isGuest: params.create?.isGuest || false,
                xp: params.create?.xp || 0,
                level: params.create?.level || 1,
                coins: params.create?.coins || 0,
                createdAt: new Date(),
                updatedAt: new Date()
              }
              inMemoryProfiles.set(userId, profile)
            }
            return profile
          }
          if (action === 'update') {
            const userId = params.where?.userId || params.where?.id
            const profile = inMemoryProfiles.get(userId)
            if (profile) {
              if (params.data?.xp?.increment) profile.xp += params.data.xp.increment
              if (params.data?.coins?.increment) profile.coins += params.data.coins.increment
              profile.updatedAt = new Date()
            }
            return profile
          }
          if (action === 'findMany') {
            return Array.from(inMemoryProfiles.values())
          }
        }

        if (modelName === 'multiplayerRoom') {
          if (action === 'findUnique') {
            const roomCode = params.where?.roomCode
            const id = params.where?.id
            let room = null
            if (roomCode) {
              room = inMemoryRooms.get(roomCode)
            } else if (id) {
              room = Array.from(inMemoryRooms.values()).find(r => r.id === id)
            }
            return room
          }
          if (action === 'findMany') {
            const status = params.where?.status
            const list = Array.from(inMemoryRooms.values())
            if (status) return list.filter(r => r.status === status)
            return list
          }
          if (action === 'create') {
            const data = params.data
            const room = {
              id: `room-${data.roomCode}`,
              roomCode: data.roomCode,
              gameSlug: data.gameSlug,
              status: 'WAITING',
              hostUserId: data.hostUserId,
              maxPlayers: data.maxPlayers || 4,
              createdAt: new Date(),
              updatedAt: new Date(),
              players: [
                {
                  id: `player-${data.hostUserId}`,
                  roomId: `room-${data.roomCode}`,
                  userId: data.hostUserId,
                  status: 'READY', // Host is auto ready
                  joinedAt: new Date(),
                  profile: inMemoryProfiles.get(data.hostUserId) || {
                    id: data.hostUserId,
                    userId: data.hostUserId,
                    username: `HostPlayer`,
                    xp: 100,
                    level: 1
                  }
                }
              ]
            }
            inMemoryRooms.set(data.roomCode, room)
            return room
          }
          if (action === 'update') {
            const roomCode = params.where?.roomCode
            const id = params.where?.id
            let room = null
            if (roomCode) room = inMemoryRooms.get(roomCode)
            else if (id) room = Array.from(inMemoryRooms.values()).find(r => r.id === id)
            
            if (room && params.data) {
              Object.assign(room, params.data)
              room.updatedAt = new Date()
            }
            return room
          }
        }

        if (modelName === 'multiplayerRoomPlayer') {
          if (action === 'findUnique') {
            const userId = params.where?.roomId_userId?.userId
            const roomId = params.where?.roomId_userId?.roomId
            const room = Array.from(inMemoryRooms.values()).find(r => r.id === roomId)
            const roomPlayer = room?.players.find((p: any) => p.userId === userId)
            return {
              id: `player-${userId}`,
              roomId,
              userId,
              status: roomPlayer?.status || 'NOT_READY',
              room,
              profile: inMemoryProfiles.get(userId) || {
                id: userId,
                userId,
                username: `Player_${userId.substring(0, 5)}`,
                xp: 100,
                level: 1
              }
            }
          }
          if (action === 'findMany') {
            const userId = params.where?.userId
            if (userId) {
              return Array.from(inMemoryRooms.values())
                .filter(r => r.players.some((p: any) => p.userId === userId))
                .map(r => ({
                  roomId: r.id,
                  userId,
                  status: 'JOINED',
                  room: r
                }))
            }
            return []
          }
          if (action === 'create') {
            const data = params.data
            const room = Array.from(inMemoryRooms.values()).find(r => r.id === data.roomId)
            if (room) {
              const profile = inMemoryProfiles.get(data.userId) || {
                id: data.userId,
                userId: data.userId,
                username: `JoinerPlayer`,
                xp: 100,
                level: 1
              }
              const player = {
                id: `player-${data.userId}`,
                roomId: data.roomId,
                userId: data.userId,
                status: 'NOT_READY',
                joinedAt: new Date(),
                profile
              }
              if (!room.players.some((p: any) => p.userId === data.userId)) {
                room.players.push(player)
              }
            }
            return { id: `player-${data.userId}` }
          }
          if (action === 'update') {
            const id = params.where?.id
            const userId = id?.replace('player-', '')
            const room = Array.from(inMemoryRooms.values()).find(r => r.players.some((p: any) => p.userId === userId))
            if (room) {
              const player = room.players.find((p: any) => p.userId === userId)
              if (player) {
                player.status = params.data?.status || 'READY'
              }
            }
            return {
              id,
              userId,
              status: params.data?.status || 'READY'
            }
          }
          if (action === 'delete') {
            const userId = params.where?.roomId_userId?.userId
            const roomId = params.where?.roomId_userId?.roomId
            const room = Array.from(inMemoryRooms.values()).find(r => r.id === roomId)
            if (room) {
              room.players = room.players.filter((p: any) => p.userId !== userId)
            }
            return { success: true }
          }
          if (action === 'updateMany') {
            return { count: 1 }
          }
        }

        if (modelName === 'multiplayerGameSession') {
          if (action === 'findUnique') {
            const roomId = params.where?.roomId
            return inMemorySessions.get(roomId) || null
          }
          if (action === 'create') {
            const data = params.data
            const session = {
              id: `session-${data.roomId}`,
              roomId: data.roomId,
              gameSlug: data.gameSlug,
              status: data.status || 'PLAYING',
              gameState: data.gameState,
              currentTurn: data.currentTurn,
              winnerId: null,
              createdAt: new Date(),
              updatedAt: new Date()
            }
            inMemorySessions.set(data.roomId, session)
            return session
          }
          if (action === 'update') {
            const roomId = params.where?.roomId
            const session = inMemorySessions.get(roomId)
            if (session && params.data) {
              if (params.data.gameState) {
                session.gameState = params.data.gameState
              }
              if (params.data.status) {
                session.status = params.data.status
              }
              if (params.data.winnerId !== undefined) {
                session.winnerId = params.data.winnerId
              }
              session.updatedAt = new Date()
            }
            return session
          }
          if (action === 'upsert') {
            const roomId = params.where?.roomId
            let session = inMemorySessions.get(roomId)
            if (!session) {
              const data = params.create
              session = {
                id: `session-${data.roomId}`,
                roomId: data.roomId,
                gameSlug: data.gameSlug,
                status: data.status || 'PLAYING',
                gameState: data.gameState,
                currentTurn: data.currentTurn,
                winnerId: null,
                createdAt: new Date(),
                updatedAt: new Date()
              }
              inMemorySessions.set(data.roomId, session)
            } else {
              const data = params.update
              if (data.gameState) {
                session.gameState = data.gameState
              }
              if (data.status) {
                session.status = data.status
              }
              if (data.winnerId !== undefined) {
                session.winnerId = data.winnerId
              }
              session.updatedAt = new Date()
            }
            return session
          }
        }

        if (modelName === 'game') {
          if (action === 'findUnique') {
            const slug = params.where?.slug
            return {
              id: `game-${slug}`,
              slug,
              name: slug === 'scribble' ? 'Scribble' : slug,
              description: 'Mock game description',
              type: 'REWRITTEN',
              isMultiplay: true,
              category: 'social'
            }
          }
        }

        if (modelName === 'friendship') {
          if (action === 'findMany') {
            return []
          }
          if (action === 'upsert') {
            return { success: true }
          }
        }

        if (modelName === 'multiplayerInvite') {
          if (action === 'findMany' || action === 'findFirst') {
            return []
          }
          if (action === 'create') {
            return { id: 'invite-uuid' }
          }
        }

        if (modelName === 'notification') {
          if (action === 'create') {
            return { id: 'notif-uuid' }
          }
        }

        return null
      }
    }
  })
}
