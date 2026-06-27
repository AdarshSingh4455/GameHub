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
async function setUserPresence(userId, presence) {
    if (!redis_1.redisClient.isReady)
        return;
    const key = `presence:user:${userId}`;
    try {
        if (presence === 'OFFLINE') {
            await redis_1.redisClient.del(key);
        }
        else {
            let data;
            if (typeof presence === 'string') {
                data = {
                    status: presence,
                    activity: presence === 'IN_GAME' ? 'Playing' : 'Browsing Games',
                    lastSeenAt: new Date().toISOString()
                };
            }
            else {
                data = presence;
            }
            await redis_1.redisClient.set(key, JSON.stringify(data), { EX: PRESENCE_TTL });
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
        const val = await redis_1.redisClient.get(`presence:user:${userId}`);
        if (!val)
            return 'OFFLINE';
        try {
            return JSON.parse(val);
        }
        catch {
            return {
                status: val,
                activity: 'Idle',
                lastSeenAt: new Date().toISOString()
            };
        }
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
        if (currentPresence) {
            await redis_1.redisClient.expire(key, PRESENCE_TTL);
        }
    }
    catch (err) {
        console.error(`Failed to refresh presence TTL for user ${userId}:`, err);
    }
}
