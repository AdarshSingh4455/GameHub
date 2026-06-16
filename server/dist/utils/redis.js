"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectRedis = exports.redisClient = void 0;
const redis_1 = require("redis");
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
exports.redisClient = (0, redis_1.createClient)({
    url: redisUrl
});
exports.redisClient.on('error', (err) => {
    console.error('Redis Client Connection Error:', err);
});
// Immediately connect to Redis
const connectRedis = async () => {
    if (!exports.redisClient.isOpen) {
        try {
            await exports.redisClient.connect();
            console.log('🔌 Connected to Redis presence and rate limit cache.');
        }
        catch (err) {
            console.error('❌ Redis Connection Failed:', err);
        }
    }
};
exports.connectRedis = connectRedis;
