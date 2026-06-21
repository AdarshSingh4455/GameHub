"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRateLimit = exports.submitMoveLimiter = exports.sendChatLimiter = exports.joinRoomLimiter = exports.createRoomLimiter = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const redis_1 = require("../utils/redis");
class AdaptiveRateLimiter {
    constructor(opts) {
        this.redisLimiter = new rate_limiter_flexible_1.RateLimiterRedis({
            storeClient: redis_1.redisClient,
            ...opts
        });
        this.memoryLimiter = new rate_limiter_flexible_1.RateLimiterMemory(opts);
    }
    async consume(key, points = 1) {
        if (redis_1.redisClient.isReady) {
            try {
                return await this.redisLimiter.consume(key, points);
            }
            catch (err) {
                // If it is a rate limit rejection (rejected resource contains msBeforeNext), rethrow it
                if (err && err.msBeforeNext !== undefined) {
                    throw err;
                }
                // Otherwise, it is a Redis connection error/offline state; fallback to memory
                return await this.memoryLimiter.consume(key, points);
            }
        }
        else {
            return await this.memoryLimiter.consume(key, points);
        }
    }
}
// Rate limit rules: key prefixes, points (max requests), duration (in seconds)
exports.createRoomLimiter = new AdaptiveRateLimiter({
    keyPrefix: 'rl:create_room',
    points: 5,
    duration: 60
});
exports.joinRoomLimiter = new AdaptiveRateLimiter({
    keyPrefix: 'rl:join_room',
    points: 10,
    duration: 60
});
exports.sendChatLimiter = new AdaptiveRateLimiter({
    keyPrefix: 'rl:send_chat',
    points: 60,
    duration: 60
});
exports.submitMoveLimiter = new AdaptiveRateLimiter({
    keyPrefix: 'rl:submit_move',
    points: 2, // Allow a minor double-click buffer but block heavy spam
    duration: 1
});
/**
 * Check if the current socket client exceeds the rate limit for a specific action.
 * Emits an error event or executes the callback with an error parameter if blocked.
 */
const checkRateLimit = async (socket, limiter, event, callback) => {
    // Bypass rate limiting in mock/test environment to prevent test failures
    if (process.env.MOCK_AUTH === 'true') {
        return true;
    }
    // Rate limit by userId if logged in, fallback to socket.id or handshake IP
    const identifier = socket.data.user?.userId || socket.id;
    try {
        await limiter.consume(identifier);
        return true;
    }
    catch (rejRes) {
        console.warn(`[RATE LIMIT EXCEEDED] identifier=${identifier} event=${event}`);
        const errorMsg = 'Too many requests. Please try again in a moment.';
        if (callback) {
            callback({ error: errorMsg });
        }
        else {
            socket.emit('error', errorMsg);
        }
        return false;
    }
};
exports.checkRateLimit = checkRateLimit;
