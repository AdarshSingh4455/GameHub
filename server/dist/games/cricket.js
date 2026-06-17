"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCricketSession = getCricketSession;
exports.saveCricketSession = saveCricketSession;
exports.deleteCricketSession = deleteCricketSession;
exports.processCricketMove = processCricketMove;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
// Active Game Cache TTL: 2 hours
const GAME_CACHE_TTL = 7200;
/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
async function getCricketSession(roomCode, roomId, prisma) {
    const redisKey = `game:cricket:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error('Failed to get cricket session from Redis:', err);
        }
    }
    // Fallback to PostgreSQL
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        // Warm up Redis cache
        await saveCricketSession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
/**
 * Saves active game session state to Redis
 */
async function saveCricketSession(roomCode, state) {
    const redisKey = `game:cricket:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error('Failed to save cricket session to Redis:', err);
        }
    }
}
/**
 * Deletes game session state from Redis
 */
async function deleteCricketSession(roomCode) {
    const redisKey = `game:cricket:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error('Failed to delete cricket session from Redis:', err);
        }
    }
}
/**
 * Persists a snapshot of the current game session state to PostgreSQL
 */
function persistSnapshot(roomId, state, status, winnerId, prisma) {
    const now = new Date();
    prisma.multiplayerGameSession.update({
        where: { roomId },
        data: {
            status,
            winnerId,
            gameState: state,
            lastActivityAt: now,
            updatedAt: now
        }
    }).then(() => {
        logger_1.logger.info(`[SNAPSHOT SUCCESS] Persisted cricket game state to PostgreSQL for roomId=${roomId}`);
    }).catch((err) => {
        (0, logger_1.logError)(err, { roomId, context: 'cricket-snapshot' });
    });
}
/**
 * Processes Hand Cricket game moves
 */
async function processCricketMove(roomCode, roomId, userId, move, players, prisma) {
    const currentGameState = await getCricketSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Game session not found');
    }
    const { type } = move;
    const playerIds = players.map(p => p.userId);
    const opponentUserId = playerIds.find(id => id !== userId) || '';
    let snapshotPersisted = false;
    let gameFinished = false;
    let winnerId = null;
    let updatedStatus = 'PLAYING';
    // Increment move count to determine snapshot intervals
    if (!currentGameState.moveCount) {
        currentGameState.moveCount = 0;
    }
    if (type === 'toss') {
        const { choice } = move;
        if (currentGameState.stage !== 'TOSS') {
            throw new Error('Game is not in TOSS stage');
        }
        if (currentGameState.tossWinnerId !== userId) {
            throw new Error('Only the toss winner can choose roles');
        }
        if (choice !== 'BAT' && choice !== 'BOWL') {
            throw new Error('Invalid toss choice');
        }
        currentGameState.tossChoice = choice;
        if (choice === 'BAT') {
            currentGameState.battingUserId = userId;
            currentGameState.bowlingUserId = opponentUserId;
        }
        else {
            currentGameState.battingUserId = opponentUserId;
            currentGameState.bowlingUserId = userId;
        }
        const getUsername = (uid) => players.find(p => p.userId === uid)?.username || 'Player';
        currentGameState.stage = 'FIRST_INNINGS';
        currentGameState.commentary.unshift(`🏏 ${getUsername(currentGameState.battingUserId)} will BAT first. ${getUsername(currentGameState.bowlingUserId)} will BOWL.`);
        // Persist snapshot on stage transitions (toss complete)
        persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
        snapshotPersisted = true;
    }
    else if (type === 'play') {
        const { number } = move;
        if (number === undefined || isNaN(number) || number < 1 || number > 6) {
            throw new Error('Move number must be between 1 and 6');
        }
        if (currentGameState.stage !== 'FIRST_INNINGS' && currentGameState.stage !== 'SECOND_INNINGS') {
            throw new Error('Game is not in an active innings stage');
        }
        if (!currentGameState.moves) {
            currentGameState.moves = {};
        }
        if (currentGameState.moves[userId] !== undefined && currentGameState.moves[userId] !== null) {
            throw new Error('You have already submitted a move for this turn');
        }
        // Register player move
        currentGameState.moves[userId] = number;
        currentGameState.moveCount++;
        const movesCount = Object.keys(currentGameState.moves).length;
        const getUsername = (uid) => players.find(p => p.userId === uid)?.username || 'Player';
        if (movesCount === 2) {
            // Resolve simultaneous moves
            const batMove = currentGameState.moves[currentGameState.battingUserId];
            const bowlMove = currentGameState.moves[currentGameState.bowlingUserId];
            const isOut = batMove === bowlMove;
            currentGameState.balls += 1;
            if (isOut) {
                currentGameState.wickets += 1;
                currentGameState.commentary.unshift(`🔴 OUT! Both players chose ${batMove}. ${getUsername(currentGameState.battingUserId)} is out.`);
            }
            else {
                currentGameState.runs += batMove;
                currentGameState.commentary.unshift(`🏏 Runs: ${batMove} (Bat: ${batMove}, Bowl: ${bowlMove}). Score: ${currentGameState.runs}/${currentGameState.wickets}.`);
            }
            if (!currentGameState.history) {
                currentGameState.history = [];
            }
            currentGameState.history.unshift({
                innings: currentGameState.innings,
                ball: currentGameState.balls,
                batMove,
                bowlMove,
                runs: isOut ? 0 : batMove,
                isOut
            });
            // Clear current turn moves
            currentGameState.moves = {};
            // Handle Innings Transitions
            if (currentGameState.stage === 'FIRST_INNINGS') {
                if (currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6) {
                    const target = currentGameState.runs + 1;
                    currentGameState.stage = 'SECOND_INNINGS';
                    currentGameState.innings = 2;
                    currentGameState.target = target;
                    currentGameState.innings1Score = currentGameState.runs;
                    // Swap batting/bowling roles
                    const temp = currentGameState.battingUserId;
                    currentGameState.battingUserId = currentGameState.bowlingUserId;
                    currentGameState.bowlingUserId = temp;
                    // Reset scores
                    currentGameState.runs = 0;
                    currentGameState.wickets = 0;
                    currentGameState.balls = 0;
                    currentGameState.commentary.unshift(`🔄 Innings over. ${getUsername(currentGameState.battingUserId)} needs ${target} runs to win.`);
                    // Persist snapshot on innings switch
                    persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
                    snapshotPersisted = true;
                }
            }
            else if (currentGameState.stage === 'SECOND_INNINGS') {
                const target = currentGameState.target;
                let isFinished = false;
                if (currentGameState.runs >= target) {
                    isFinished = true;
                    winnerId = currentGameState.battingUserId;
                }
                else if (currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6) {
                    isFinished = true;
                    if (currentGameState.runs === target - 1) {
                        winnerId = null; // Tie/Draw
                    }
                    else {
                        winnerId = currentGameState.bowlingUserId;
                    }
                }
                if (isFinished) {
                    currentGameState.stage = 'FINISHED';
                    currentGameState.innings2Score = currentGameState.runs;
                    currentGameState.commentary.unshift(winnerId
                        ? `🏆 Match Over! Winner: ${getUsername(winnerId)}.`
                        : `🤝 Match Over! It's a DRAW/TIE.`);
                    updatedStatus = 'FINISHED';
                    gameFinished = true;
                    // Persist final match snapshot and clear cache
                    persistSnapshot(roomId, currentGameState, updatedStatus, winnerId, prisma);
                    await deleteCricketSession(roomCode);
                    snapshotPersisted = true;
                }
            }
        }
        // Persist snapshot periodically: every 5 moves (meaning 10 player actions), if game ends, OR if Redis is down
        if (!snapshotPersisted && (currentGameState.moveCount % 10 === 0 || !redis_1.redisClient.isReady)) {
            persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
            snapshotPersisted = true;
        }
    }
    if (!gameFinished) {
        await saveCricketSession(roomCode, currentGameState);
    }
    return {
        state: currentGameState,
        snapshotPersisted,
        gameFinished,
        winnerId
    };
}
