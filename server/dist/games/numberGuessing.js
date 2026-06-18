"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNumberGuessingSession = getNumberGuessingSession;
exports.saveNumberGuessingSession = saveNumberGuessingSession;
exports.deleteNumberGuessingSession = deleteNumberGuessingSession;
exports.getMaskedNumberGuessingState = getMaskedNumberGuessingState;
exports.processNumberGuessingMove = processNumberGuessingMove;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const GAME_CACHE_TTL = 7200;
/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
async function getNumberGuessingSession(roomCode, roomId, prisma) {
    const redisKey = `game:numberguessing:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error('Failed to get number guessing session from Redis:', err);
        }
    }
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        await saveNumberGuessingSession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
/**
 * Saves active game session state to Redis
 */
async function saveNumberGuessingSession(roomCode, state) {
    const redisKey = `game:numberguessing:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error('Failed to save number guessing session to Redis:', err);
        }
    }
}
/**
 * Deletes game session state from Redis
 */
async function deleteNumberGuessingSession(roomCode) {
    const redisKey = `game:numberguessing:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error('Failed to delete number guessing session from Redis:', err);
        }
    }
}
/**
 * Persists a snapshot of the current game session state to PostgreSQL
 */
function persistSnapshot(roomId, state, status, winnerId, nextTurn, prisma) {
    const now = new Date();
    prisma.multiplayerGameSession.update({
        where: { roomId },
        data: {
            status,
            winnerId,
            currentTurn: nextTurn,
            gameState: state,
            lastActivityAt: now,
            updatedAt: now
        }
    }).then(() => {
        logger_1.logger.info(`[SNAPSHOT SUCCESS] Persisted number guessing game state to PostgreSQL for roomId=${roomId}`);
    }).catch((err) => {
        (0, logger_1.logError)(err, { roomId, context: 'numberguessing-snapshot' });
    });
}
/**
 * Masks secret number in the gameState before sending to clients to prevent inspect-element cheating
 */
function getMaskedNumberGuessingState(state) {
    if (!state)
        return null;
    const cloned = { ...state };
    delete cloned.secretNumber;
    return cloned;
}
/**
 * Processes Number Guessing moves
 */
async function processNumberGuessingMove(roomCode, roomId, userId, move, players, prisma) {
    const currentGameState = await getNumberGuessingSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Game session not found');
    }
    const currentTurn = currentGameState.currentTurn;
    if (currentTurn !== userId) {
        throw new Error("It's not your turn");
    }
    const { guess } = move;
    const minBound = currentGameState.minBound || 1;
    const maxBound = currentGameState.maxBound || 100;
    if (guess === undefined || isNaN(guess) || guess < 1 || guess > 100) {
        throw new Error('Please enter a valid guess between 1 and 100');
    }
    const playerIds = players.map(p => p.userId);
    const opponentUserId = playerIds.find(id => id !== userId) || '';
    const username = players.find(p => p.userId === userId)?.username || 'Player';
    const secretNumber = currentGameState.secretNumber;
    let feedback = '';
    let gameFinished = false;
    let winnerId = null;
    if (guess === secretNumber) {
        feedback = 'Correct! 🎉';
        gameFinished = true;
        winnerId = userId;
        currentGameState.stage = 'FINISHED';
        currentGameState.winnerId = userId;
    }
    else if (guess > secretNumber) {
        feedback = 'Too High! 📉';
        if (guess < maxBound) {
            currentGameState.maxBound = guess - 1;
        }
    }
    else {
        feedback = 'Too Low! 📈';
        if (guess > minBound) {
            currentGameState.minBound = guess + 1;
        }
    }
    const roundLog = {
        guess,
        by: username,
        feedback
    };
    if (!currentGameState.guessesHistory) {
        currentGameState.guessesHistory = [];
    }
    currentGameState.guessesHistory.unshift(roundLog);
    currentGameState.guessFeedback = `${username} guessed ${guess}: ${feedback}`;
    if (!gameFinished) {
        currentGameState.currentTurn = opponentUserId;
        currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString();
    }
    await saveNumberGuessingSession(roomCode, currentGameState);
    persistSnapshot(roomId, currentGameState, gameFinished ? 'FINISHED' : 'PLAYING', winnerId, gameFinished ? null : opponentUserId, prisma);
    return { state: currentGameState, gameFinished, winnerId };
}
