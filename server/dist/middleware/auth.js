"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
        // Development/testing mock auth bypass
        const mockUserId = socket.handshake.auth?.mockUserId || 'mock-user-id';
        const mockUsername = socket.handshake.auth?.mockUsername || 'Adarsh';
        socket.data.user = {
            userId: mockUserId,
            username: mockUsername,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUsername}`,
            level: 1
        };
        return next();
    }
    if (!token) {
        return next(new Error('Authentication error: Token is required'));
    }
    try {
        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        if (!jwtSecret) {
            return next(new Error('Server configuration error: JWT secret is missing'));
        }
        // Verify Supabase JWT locally (HS256 signed using the secret key)
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        socket.data.user = {
            userId: decoded.sub,
            email: decoded.email,
            username: decoded.user_metadata?.username || decoded.email?.split('@')[0] || 'Player',
            avatarUrl: decoded.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${decoded.sub}`,
            level: decoded.user_metadata?.level || 1
        };
        next();
    }
    catch (err) {
        return next(new Error(`Authentication error: ${err.message}`));
    }
};
exports.socketAuthMiddleware = socketAuthMiddleware;
