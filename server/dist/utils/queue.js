"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomQueue = getRoomQueue;
exports.deleteRoomQueue = deleteRoomQueue;
class RoomQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }
    /**
     * Pushes a task to the queue and returns a promise that resolves when the task finishes.
     */
    add(task) {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                }
                catch (err) {
                    reject(err);
                }
            };
            this.queue.push(wrappedTask);
            this.processNext();
        });
    }
    async processNext() {
        if (this.processing || this.queue.length === 0)
            return;
        this.processing = true;
        const task = this.queue.shift();
        if (task) {
            try {
                await task();
            }
            catch (err) {
                // Errors are captured inside wrappedTask reject
            }
        }
        this.processing = false;
        this.processNext();
    }
}
const roomQueues = {};
/**
 * Gets or creates a RoomQueue for a roomCode
 */
function getRoomQueue(roomCode) {
    const normalized = roomCode.trim().toUpperCase();
    if (!roomQueues[normalized]) {
        roomQueues[normalized] = new RoomQueue();
    }
    return roomQueues[normalized];
}
/**
 * Clean up the queue for a closed room
 */
function deleteRoomQueue(roomCode) {
    const normalized = roomCode.trim().toUpperCase();
    delete roomQueues[normalized];
}
