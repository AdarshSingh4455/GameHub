import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      userId: string
      username: string
      email?: string
      avatarUrl?: string
      level?: number
    }
  }
}

export const socketAuthMiddleware = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token

  if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    // Development/testing mock auth bypass
    const mockUserId = socket.handshake.auth?.mockUserId || 'mock-user-id'
    const mockUsername = socket.handshake.auth?.mockUsername || 'Adarsh'
    socket.data.user = {
      userId: mockUserId,
      username: mockUsername,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUsername}`,
      level: 1
    }
    return next()
  }

  if (!token) {
    return next(new Error('Authentication error: Token is required'))
  }

  try {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET
    if (!jwtSecret) {
      return next(new Error('Server configuration error: JWT secret is missing'))
    }

    // Verify Supabase JWT locally (HS256 signed using the secret key)
    const decoded = jwt.verify(token, jwtSecret) as any

    socket.data.user = {
      userId: decoded.sub,
      email: decoded.email,
      username: decoded.user_metadata?.username || decoded.email?.split('@')[0] || 'Player',
      avatarUrl: decoded.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${decoded.sub}`,
      level: decoded.user_metadata?.level || 1
    }

    next()
  } catch (err: any) {
    return next(new Error(`Authentication error: ${err.message}`))
  }
}
