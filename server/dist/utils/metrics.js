"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDisconnect = recordDisconnect;
exports.recordReconnectSuccess = recordReconnectSuccess;
exports.startMetricsReporting = startMetricsReporting;
const logger_1 = require("./logger");
let disconnectsCount = 0;
let reconnectsCount = 0;
let totalDisconnectsEver = 0;
let totalReconnectsEver = 0;
/**
 * Log a disconnection event
 */
function recordDisconnect() {
    disconnectsCount++;
    totalDisconnectsEver++;
}
/**
 * Log a successful reconnection recovery
 */
function recordReconnectSuccess() {
    reconnectsCount++;
    totalReconnectsEver++;
}
/**
 * Start the observability loop reporting to Pino structured logs every 60 seconds
 */
function startMetricsReporting(io) {
    setInterval(() => {
        try {
            const activeUsers = io.engine.clientsCount;
            // Adapt rooms count to exclude default client socket rooms (socket.id is counted as a room)
            let activeRoomsCount = 0;
            for (const [roomId, sockets] of io.sockets.adapter.rooms.entries()) {
                if (!sockets.has(roomId)) {
                    activeRoomsCount++;
                }
            }
            // Calculate connection recovery rate
            const recoveryRate = totalDisconnectsEver > 0
                ? ((totalReconnectsEver / totalDisconnectsEver) * 100).toFixed(1) + '%'
                : '100.0%'; // default to 100% if no drops occurred
            logger_1.logger.info({
                metrics: {
                    active_users: activeUsers,
                    active_rooms: activeRoomsCount,
                    reconnect_success_rate: recoveryRate,
                    disconnects_last_minute: disconnectsCount,
                    reconnects_last_minute: reconnectsCount
                }
            }, '🎮 GameHub Metrics Report');
            // Reset sliding window stats
            disconnectsCount = 0;
            reconnectsCount = 0;
        }
        catch (err) {
            logger_1.logger.error({ err }, 'Failed to compute active socket metrics');
        }
    }, 60000);
}
