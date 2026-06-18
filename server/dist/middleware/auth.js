"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const jose_1 = require("jose");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ─── JWKS Client (cached per process) ─────────────────────────────────────────
// Lazy-initialised so tests / local dev don't require SUPABASE_URL.
let jwksClient = null;
function getJWKSClient() {
    if (jwksClient)
        return jwksClient;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl)
        return null;
    const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
    jwksClient = (0, jose_1.createRemoteJWKSet)(new URL(jwksUri));
    return jwksClient;
}
// ─── Payload Extractor ────────────────────────────────────────────────────────
function extractUserFromPayload(decoded) {
    const sub = decoded.sub;
    const email = decoded.email;
    const meta = decoded.user_metadata || decoded.app_metadata || {};
    return {
        userId: sub,
        email,
        username: meta?.username || email?.split('@')[0] || 'Player',
        avatarUrl: meta?.avatar_url ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${sub}`,
        level: meta?.level || 1,
    };
}
// ─── Primary verifier: JWKS / ES256 (async) ───────────────────────────────────
async function verifyWithJWKS(token) {
    const client = getJWKSClient();
    if (!client)
        throw new Error('JWKS client not configured (missing SUPABASE_URL env var)');
    const { payload } = await (0, jose_1.jwtVerify)(token, client, {
        // Supabase issues tokens for the auth service — do NOT pin audience/issuer
        // strictly here so that both old and new Supabase token shapes are accepted.
        algorithms: ['ES256'],
    });
    return payload;
}
// ─── Fallback verifier: HS256 symmetric secret ────────────────────────────────
function verifyWithSecret(token, secret) {
    return jsonwebtoken_1.default.verify(token, secret, { algorithms: ['HS256'] });
}
// ─── Socket.IO Authentication Middleware ──────────────────────────────────────
const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth?.token;
    // ── Mock Auth (dev/test only) ─────────────────────────────────────────────
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
        const mockUserId = socket.handshake.auth?.mockUserId || 'mock-user-id';
        const mockUsername = socket.handshake.auth?.mockUsername || 'Adarsh';
        socket.data.user = {
            userId: mockUserId,
            username: mockUsername,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUsername}`,
            level: 1,
        };
        return next();
    }
    if (!token) {
        return next(new Error('Authentication error: Token is required'));
    }
    // ── Async verification (ES256 via JWKS, fallback HS256) ───────────────────
    ;
    (async () => {
        try {
            let decoded;
            // 1. Try ES256 JWKS verification first (Supabase modern asymmetric keys)
            try {
                decoded = await verifyWithJWKS(token);
            }
            catch (jwksErr) {
                // 2. If JWKS fails (e.g. project still on legacy HS256 secret), try symmetric fallback
                const jwtSecret = process.env.SUPABASE_JWT_SECRET;
                if (!jwtSecret) {
                    // Re-throw the JWKS error — there is nothing else to try
                    throw jwksErr;
                }
                try {
                    decoded = verifyWithSecret(token, jwtSecret);
                }
                catch (hs256Err) {
                    // Both methods failed — surface the original JWKS error as it is more informative
                    throw new Error(`JWT verification failed. JWKS error: ${jwksErr.message} | HS256 error: ${hs256Err.message}`);
                }
            }
            socket.data.user = extractUserFromPayload(decoded);
            next();
        }
        catch (err) {
            next(new Error(`Authentication error: ${err.message}`));
        }
    })();
};
exports.socketAuthMiddleware = socketAuthMiddleware;
