"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = void 0;
const redis_1 = require("redis");
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl,
    socket: {
        reconnectStrategy: (retries) => {
            // Limit reconnection attempts to avoid log spamming when Redis is offline
            if (retries > 3) {
                console.warn('⚠️ Redis connection attempts exhausted. Running in fallback memory mode.');
                return false; // Stop reconnecting
            }
            // Backoff delay of 2 seconds between retries
            return 2000;
        }
    }
});
exports.redisClient.on('error', (err) => {
    // Only log if it's not a connection refused error or if it's within first few retries
    console.error('Redis Client Connection Error:', err.message || err);
});
// Immediately connect to Redis
const connectRedis = async () => {
    if (!exports.redisClient.isOpen) {
        try {
            await exports.redisClient.connect();
            console.log('🔌 Connected to Redis presence and rate limit cache.');
        }
        catch (err) {
            console.error('❌ Redis Connection Failed:', err.message || err);
        }
    }
};
exports.connectRedis = connectRedis;
