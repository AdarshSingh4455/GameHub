import { Socket } from 'socket.io'
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'
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

// ─── JWKS Client (cached per process) ─────────────────────────────────────────
// Lazy-initialised so tests / local dev don't require SUPABASE_URL.
let jwksClient: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKSClient(): ReturnType<typeof createRemoteJWKSet> | null {
  if (jwksClient) return jwksClient

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`
  jwksClient = createRemoteJWKSet(new URL(jwksUri))
  return jwksClient
}

// ─── Payload Extractor ────────────────────────────────────────────────────────
function extractUserFromPayload(decoded: JWTPayload & Record<string, any>) {
  const sub = decoded.sub as string
  const email: string | undefined = decoded.email
  const meta = decoded.user_metadata || decoded.app_metadata || {}

  return {
    userId: sub,
    email,
    username: meta?.username || email?.split('@')[0] || 'Player',
    avatarUrl:
      meta?.avatar_url ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${sub}`,
    level: meta?.level || 1,
  }
}

// ─── Primary verifier: JWKS / ES256 (async) ───────────────────────────────────
async function verifyWithJWKS(token: string): Promise<JWTPayload & Record<string, any>> {
  const client = getJWKSClient()
  if (!client) throw new Error('JWKS client not configured (missing SUPABASE_URL env var)')

  const { payload } = await jwtVerify(token, client, {
    // Supabase issues tokens for the auth service — do NOT pin audience/issuer
    // strictly here so that both old and new Supabase token shapes are accepted.
    algorithms: ['ES256'],
  })

  return payload as JWTPayload & Record<string, any>
}

// ─── Fallback verifier: HS256 symmetric secret ────────────────────────────────
function verifyWithSecret(token: string, secret: string): Record<string, any> {
  return jwt.verify(token, secret, { algorithms: ['HS256'] }) as Record<string, any>
}

// ─── Socket.IO Authentication Middleware ──────────────────────────────────────
export const socketAuthMiddleware = (
  socket: Socket,
  next: (err?: Error) => void
) => {
  const token = socket.handshake.auth?.token

  // ── Mock Auth (dev/test only) ─────────────────────────────────────────────
  if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    const mockUserId = socket.handshake.auth?.mockUserId || 'mock-user-id'
    const mockUsername = socket.handshake.auth?.mockUsername || 'Adarsh'
    socket.data.user = {
      userId: mockUserId,
      username: mockUsername,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUsername}`,
      level: 1,
    }
    return next()
  }

  if (!token) {
    return next(new Error('Authentication error: Token is required'))
  }

  // ── Async verification (ES256 via JWKS, fallback HS256) ───────────────────
  ;(async () => {
    try {
      let decoded: Record<string, any>

      // 1. Try ES256 JWKS verification first (Supabase modern asymmetric keys)
      try {
        decoded = await verifyWithJWKS(token)
      } catch (jwksErr: any) {
        // 2. If JWKS fails (e.g. project still on legacy HS256 secret), try symmetric fallback
        const jwtSecret = process.env.SUPABASE_JWT_SECRET
        if (!jwtSecret) {
          // Re-throw the JWKS error — there is nothing else to try
          throw jwksErr
        }
        try {
          decoded = verifyWithSecret(token, jwtSecret)
        } catch (hs256Err: any) {
          // Both methods failed — surface the original JWKS error as it is more informative
          throw new Error(
            `JWT verification failed. JWKS error: ${jwksErr.message} | HS256 error: ${hs256Err.message}`
          )
        }
      }

      socket.data.user = extractUserFromPayload(decoded)
      next()
    } catch (err: any) {
      next(new Error(`Authentication error: ${err.message}`))
    }
  })()
}
