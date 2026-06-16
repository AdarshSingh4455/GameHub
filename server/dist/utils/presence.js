"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserPresence = setUserPresence;
exports.getUserPresence = getUserPresence;
exports.keepPresenceAlive = keepPresenceAlive;
const redis_1 = require("./redis");
const PRESENCE_TTL = 60; // 60 seconds TTL for heartbeat updates
/**
 * Sets user presence state in Redis
 */
async function setUserPresence(userId, state) {
    if (!redis_1.redisClient.isReady)
        return;
    const key = `presence:user:${userId}`;
    try {
        if (state === 'OFFLINE') {
            await redis_1.redisClient.del(key);
        }
        else {
            await redis_1.redisClient.set(key, state, { EX: PRESENCE_TTL });
        }
    }
    catch (err) {
        console.error(`Failed to set presence for user ${userId}:`, err);
    }
}
/**
 * Gets the current user presence state from Redis
 */
async function getUserPresence(userId) {
    if (!redis_1.redisClient.isReady)
        return 'OFFLINE';
    try {
        const state = await redis_1.redisClient.get(`presence:user:${userId}`);
        return state || 'OFFLINE';
    }
    catch (err) {
        console.error(`Failed to get presence for user ${userId}:`, err);
        return 'OFFLINE';
    }
}
/**
 * Refreshes user presence TTL (heartbeat)
 */
async function keepPresenceAlive(userId) {
    if (!redis_1.redisClient.isReady)
        return;
    const key = `presence:user:${userId}`;
    try {
        const currentPresence = await redis_1.redisClient.get(key);
        if (currentPresence && currentPresence !== 'OFFLINE') {
            await redis_1.redisClient.expire(key, PRESENCE_TTL);
        }
    }
    catch (err) {
        console.error(`Failed to refresh presence TTL for user ${userId}:`, err);
    }
}
