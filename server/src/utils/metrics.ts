import { logger } from './logger'

let disconnectsCount = 0
let reconnectsCount = 0
let totalDisconnectsEver = 0
let totalReconnectsEver = 0

/**
 * Log a disconnection event
 */
export function recordDisconnect() {
  disconnectsCount++
  totalDisconnectsEver++
}

/**
 * Log a successful reconnection recovery
 */
export function recordReconnectSuccess() {
  reconnectsCount++
  totalReconnectsEver++
}

/**
 * Start the observability loop reporting to Pino structured logs every 60 seconds
 */
export function startMetricsReporting(io: any) {
  setInterval(() => {
    try {
      const activeUsers = io.engine.clientsCount
      
      // Adapt rooms count to exclude default client socket rooms (socket.id is counted as a room)
      let activeRoomsCount = 0
      for (const [roomId, sockets] of io.sockets.adapter.rooms.entries()) {
        if (!sockets.has(roomId)) {
          activeRoomsCount++
        }
      }

      // Calculate connection recovery rate
      const recoveryRate = totalDisconnectsEver > 0
        ? ((totalReconnectsEver / totalDisconnectsEver) * 100).toFixed(1) + '%'
        : '100.0%' // default to 100% if no drops occurred

      logger.info({
        metrics: {
          active_users: activeUsers,
          active_rooms: activeRoomsCount,
          reconnect_success_rate: recoveryRate,
          disconnects_last_minute: disconnectsCount,
          reconnects_last_minute: reconnectsCount
        }
      }, '🎮 GameHub Metrics Report')

      // Reset sliding window stats
      disconnectsCount = 0
      reconnectsCount = 0
    } catch (err) {
      logger.error({ err }, 'Failed to compute active socket metrics')
    }
  }, 60000)
}
