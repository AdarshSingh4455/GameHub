"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INITIAL_STATES = void 0;
exports.getGameSessionFromCache = getGameSessionFromCache;
exports.saveGameSessionToCache = saveGameSessionToCache;
exports.deleteGameSessionFromCache = deleteGameSessionFromCache;
exports.validateTurn = validateTurn;
exports.persistSnapshotAsync = persistSnapshotAsync;
exports.handleMatchCompletion = handleMatchCompletion;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const words_1 = require("./words");
// Active Game Cache TTL: 2 hours
const GAME_CACHE_TTL = 7200;
/**
 * Reusable initial state generators for multiplayer games
 */
exports.INITIAL_STATES = {
    'cricket': (players, hostUserId) => {
        if (players.length === 2) {
            const p1 = players[0].userId;
            const p2 = players[1].userId;
            const tossWinnerId = players[Math.floor(Math.random() * 2)].userId;
            return {
                stage: 'TOSS',
                tossWinnerId,
                tossChoice: null,
                innings: 1,
                runs: 0,
                wickets: 0,
                balls: 0,
                maxOvers: 2,
                maxWickets: 1,
                battingUserId: null,
                bowlingUserId: null,
                moves: {},
                history: [],
                commentary: [`🪙 New Match! Coin tossed. Waiting for choice.`],
                replayVotes: {},
                teams: {
                    'BLUE': { players: [p1], captain: p1 },
                    'GREEN': { players: [p2], captain: p2 }
                },
                playerRuns: { [p1]: 0, [p2]: 0 },
                currentPartnership: 0,
                quickChat: []
            };
        }
        else {
            return {
                stage: 'TEAM_SETUP',
                hostUserId,
                teams: {
                    'BLUE': { players: [], captain: null },
                    'GREEN': { players: [], captain: null }
                },
                innings: 1,
                runs: 0,
                wickets: 0,
                balls: 0,
                maxOvers: 2,
                maxWickets: players.length / 2,
                battingUserId: null,
                bowlingUserId: null,
                moves: {},
                history: [],
                commentary: [`🏏 Choose your teams (🔵 Blue Team or 🟢 Green Team).`],
                replayVotes: {},
                playerRuns: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
                currentPartnership: 0,
                quickChat: []
            };
        }
    },
    'scribble': (players, hostUserId) => {
        return {
            stage: 'LOBBY_SETTINGS',
            hostUserId,
            timerDuration: 45,
            round: 1,
            maxRounds: 3,
            drawerId: hostUserId,
            drawerIndex: 0,
            wordsToSelect: [],
            selectedWord: '',
            guessedPlayers: [],
            playerScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            roundScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            hints: [],
            hintString: '',
            timerStart: Date.now(),
            timerRemaining: 45,
            canvasLines: [],
            replayVotes: {},
            lastDrawAt: Date.now(),
            commentary: [`🎨 Welcome to Scribble! Host is selecting timer settings.`]
        };
    },
    'dots-boxes': (players, hostUserId) => {
        const startTurn = players[Math.floor(Math.random() * players.length)].userId;
        return {
            dotsSize: 6,
            horizontalLines: [],
            verticalLines: [],
            completedBoxes: [],
            playerScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            currentTurn: startTurn,
            moveCount: 0,
            replayVotes: {},
            turnExpiration: new Date(Date.now() + 60000).toISOString()
        };
    },
    'tic-tac-toe': (players, hostUserId) => {
        const startTurn = players[Math.floor(Math.random() * players.length)].userId;
        return {
            board: Array(9).fill(null),
            currentTurn: startTurn,
            moveCount: 0,
            replayVotes: {},
            turnExpiration: null,
            spectators: []
        };
    },
    'four-in-a-row': (players, hostUserId) => {
        const startTurn = players[Math.floor(Math.random() * players.length)].userId;
        return {
            board: Array(42).fill(null),
            currentTurn: startTurn,
            moveCount: 0,
            replayVotes: {},
            turnExpiration: null,
            spectators: []
        };
    },
    'snake-arena': (players, hostUserId) => {
        const cols = 60;
        const rows = 40;
        const colors = [
            '#ef4444', // red
            '#3b82f6', // blue
            '#10b981', // green
            '#f59e0b', // yellow
            '#8b5cf6', // purple
            '#ec4899', // pink
            '#14b8a6', // teal
            '#f97316' // orange
        ];
        const snakes = {};
        players.forEach((p, idx) => {
            const angle = (idx / players.length) * 2 * Math.PI;
            const startX = Math.floor(cols / 2 + Math.cos(angle) * (cols / 4));
            const startY = Math.floor(rows / 2 + Math.sin(angle) * (rows / 4));
            const dirX = startX < cols / 2 ? 1 : -1;
            const dirY = 0;
            snakes[p.userId] = {
                userId: p.userId,
                username: p.username || 'Player',
                body: [
                    { x: startX, y: startY },
                    { x: startX - dirX, y: startY - dirY },
                    { x: startX - 2 * dirX, y: startY - 2 * dirY }
                ],
                direction: { x: dirX, y: dirY },
                length: 3,
                score: 0,
                eliminations: 0,
                survivalTime: 0,
                status: 'ACTIVE',
                color: colors[idx % colors.length],
                spawnProtectedUntil: Date.now() + 2000,
                activePowerups: []
            };
        });
        const foods = [];
        for (let i = 0; i < 5; i++) {
            foods.push({
                id: `food-${Math.random().toString(36).substring(2, 9)}`,
                x: Math.floor(Math.random() * (cols - 4) + 2),
                y: Math.floor(Math.random() * (rows - 4) + 2),
                type: 'normal',
                value: 10
            });
        }
        return {
            cols,
            rows,
            snakes,
            foods,
            powerups: [],
            tickCount: 0,
            status: 'PLAYING',
            winnerId: null,
            replayVotes: {},
            spectators: [],
            startTime: Date.now(),
            mapTheme: 'classic'
        };
    },
    'memory': (players, hostUserId) => {
        const startTurn = players[Math.floor(Math.random() * players.length)].userId;
        const EMOJIS = [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
            '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
            '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
            '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞'
        ];
        const pairsCount = 8;
        const selectedEmojis = EMOJIS.slice(0, pairsCount);
        const cardList = [];
        selectedEmojis.forEach((emoji, index) => {
            cardList.push({ id: index * 2, emoji, isFlipped: false, isMatched: false });
            cardList.push({ id: index * 2 + 1, emoji, isFlipped: false, isMatched: false });
        });
        // Shuffle cards
        for (let i = cardList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardList[i], cardList[j]] = [cardList[j], cardList[i]];
        }
        return {
            gridSize: '4x4',
            cards: cardList,
            flippedIndices: [],
            playerScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            currentTurn: startTurn,
            moveCount: 0,
            replayVotes: {},
            turnExpiration: new Date(Date.now() + 60000).toISOString()
        };
    },
    'rps': (players) => {
        return {
            stage: 'PLAYING',
            round: 1,
            moves: {},
            playerScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            history: [],
            commentary: ['✊ Match started! Make your choice.'],
            replayVotes: {},
            turnExpiration: new Date(Date.now() + 60000).toISOString()
        };
    },
    'number-guessing': (players) => {
        const startTurn = players[Math.floor(Math.random() * players.length)].userId;
        const secret = Math.floor(Math.random() * 100) + 1;
        return {
            stage: 'PLAYING',
            minBound: 1,
            maxBound: 100,
            secretNumber: secret,
            currentTurn: startTurn,
            guessesHistory: [],
            guessFeedback: 'Guess a secret number between 1 and 100!',
            playerScores: players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {}),
            replayVotes: {},
            turnExpiration: new Date(Date.now() + 60000).toISOString()
        };
    },
    'hangman': (players, hostUserId) => {
        const p1 = players[0].userId;
        const p2 = players[1].userId;
        const startTurn = players[Math.floor(Math.random() * 2)].userId;
        return {
            stage: 'WORD_SUBMISSION',
            hostUserId,
            p1Id: p1,
            p2Id: p2,
            p1Word: '',
            p2Word: '',
            p1Guesses: [],
            p2Guesses: [],
            p1Lives: 8,
            p2Lives: 8,
            p1IncorrectGuesses: [],
            p2IncorrectGuesses: [],
            p1FullGuessesLeft: 2,
            p2FullGuessesLeft: 2,
            currentTurn: startTurn,
            winnerId: null,
            turnExpiration: null
        };
    },
    'whos-spy': (players, hostUserId) => {
        const spyPlayer = players[Math.floor(Math.random() * players.length)];
        const spyId = spyPlayer.userId;
        const category = words_1.WORD_CATEGORIES[Math.floor(Math.random() * words_1.WORD_CATEGORIES.length)];
        const wordsList = words_1.LOCAL_CATEGORIES[category] || words_1.LOCAL_CATEGORIES.Animals;
        const word = wordsList[Math.floor(Math.random() * wordsList.length)];
        const clueOrder = players.map(p => p.userId).sort(() => Math.random() - 0.5);
        return {
            stage: 'REVEAL',
            roomCode: null, // set by socket layer
            hostUserId,
            spyId,
            category,
            word,
            usedWords: {
                [category]: [word]
            },
            dismissedRole: {},
            clues: {},
            clueOrder,
            currentTurnIndex: 0,
            currentTurn: null,
            discussionMessages: [],
            votes: {},
            winnerId: null,
            replayVotes: {}
        };
    }
};
/**
 * Loads the active game session state from Redis, fallback to PostgreSQL
 */
async function getGameSessionFromCache(gameSlug, roomCode, roomId, prisma) {
    const redisKey = `game:${gameSlug}:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error(`Failed to get ${gameSlug} session from Redis:`, err);
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
        await saveGameSessionToCache(gameSlug, roomCode, parsedState);
        return parsedState;
    }
    return null;
}
/**
 * Saves active game session state to Redis
 */
async function saveGameSessionToCache(gameSlug, roomCode, state) {
    const redisKey = `game:${gameSlug}:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error(`Failed to save ${gameSlug} session to Redis:`, err);
        }
    }
}
/**
 * Deletes game session state from Redis
 */
async function deleteGameSessionFromCache(gameSlug, roomCode) {
    const redisKey = `game:${gameSlug}:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error(`Failed to delete ${gameSlug} session from Redis:`, err);
        }
    }
}
/**
 * Validates whether it is currently the requesting user's turn
 */
function validateTurn(state, userId) {
    if (!state) {
        throw new Error('Game session not found');
    }
    if (state.currentTurn !== userId) {
        throw new Error("It's not your turn");
    }
}
/**
 * Asynchronously persists a snapshot of the current game session state to PostgreSQL
 */
function persistSnapshotAsync(roomId, state, status, winnerId, nextTurn, gameSlug, prisma) {
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
        logger_1.logger.info(`[SNAPSHOT SUCCESS] Persisted ${gameSlug} state to PostgreSQL for roomId=${roomId}`);
    }).catch((err) => {
        (0, logger_1.logError)(err, { roomId, context: `${gameSlug}-snapshot` });
    });
}
/**
 * Persists match results and distributes XP/coins progression awards
 */
async function handleMatchCompletion(room, state, winnerId, prisma) {
    logger_1.logger.info(`[MATCH FINISHED] room=${room.roomCode} game=${room.gameSlug} winner=${winnerId || 'DRAW'}`);
    if (room.gameSlug === 'whos-spy') {
        return;
    }
    if (room.gameSlug === 'snake-arena') {
        await prisma.multiplayerRoom.update({
            where: { id: room.id },
            data: { status: 'FINISHED' }
        });
        try {
            const game = await prisma.game.findUnique({ where: { slug: 'snake-arena' } });
            if (!game)
                return;
            const snakes = state.snakes || {};
            for (const p of room.players) {
                if (!p.profile)
                    continue;
                const s = snakes[p.userId] || { score: 0, eliminations: 0, length: 3, survivalTime: 0 };
                const isWinner = winnerId === p.userId;
                const baseXP = isWinner ? 100 : 25;
                const baseCoins = isWinner ? 20 : 5;
                const foodsEaten = Math.max(0, Math.floor((s.score || 0) / 10));
                const bonusXP = Math.floor(foodsEaten * 2 + (s.eliminations || 0) * 10);
                const bonusCoins = Math.floor(foodsEaten * 1 + (s.eliminations || 0) * 5);
                const totalXP = baseXP + bonusXP;
                const totalCoins = baseCoins + bonusCoins;
                await prisma.profile.update({
                    where: { id: p.profile.id },
                    data: {
                        xp: { increment: totalXP },
                        coins: { increment: totalCoins }
                    }
                });
                await prisma.score.create({
                    data: {
                        profileId: p.profile.id,
                        gameId: game.id,
                        score: s.score || 0,
                        metadata: {
                            mode: 'multiplayer',
                            foodsCollected: foodsEaten,
                            longestLength: s.length || 3,
                            eliminations: s.eliminations || 0,
                            survivalTime: s.survivalTime || 0
                        }
                    }
                });
                await prisma.xPEvent.create({
                    data: {
                        profileId: p.profile.id,
                        type: isWinner ? 'MATCH_WIN' : 'MATCH_LOSS',
                        amount: totalXP,
                        meta: { gameSlug: 'snake-arena', roomCode: room.roomCode }
                    }
                });
            }
            const host = room.players.find((p) => p.userId === room.hostUserId);
            const topOpponent = room.players.find((p) => p.userId !== room.hostUserId);
            if (host && host.profile) {
                const hostProfile = host.profile;
                const oppProfile = topOpponent?.profile || hostProfile;
                await prisma.matchRecord.create({
                    data: {
                        roomCode: room.roomCode,
                        gameId: game.id,
                        player1Id: hostProfile.id,
                        player2Id: oppProfile.id,
                        player1Score: snakes[host.userId]?.score ?? 0,
                        player2Score: topOpponent ? (snakes[topOpponent.userId]?.score ?? 0) : 0,
                        winnerId: winnerId ? room.players.find((p) => p.userId === winnerId)?.profile?.id || null : null,
                        xpEarned: winnerId === host.userId ? 100 : 25,
                        coinsEarned: winnerId === host.userId ? 20 : 5
                    }
                });
            }
            logger_1.logger.info(`[MATCH RECORD SUCCESS] Snake Arena match results saved for room=${room.roomCode}`);
        }
        catch (err) {
            (0, logger_1.logError)(err, { roomCode: room.roomCode, context: 'persist-snake-arena-match' });
        }
        return;
    }
    // Complete room status in PostgreSQL
    await prisma.multiplayerRoom.update({
        where: { id: room.id },
        data: { status: 'FINISHED' }
    });
    // Match result persistence in MatchRecord table and Player Progression updates
    try {
        const game = await prisma.game.findUnique({
            where: { slug: room.gameSlug }
        });
        if (game) {
            const p1 = room.players[0];
            const p2 = room.players[1];
            if (p1 && p2) {
                const winnerProfile = winnerId
                    ? room.players.find((p) => p.userId === winnerId)?.profile
                    : null;
                const isDraw = winnerId === 'DRAW' || !winnerId;
                // P1 rewards
                const p1Winner = winnerId === p1.userId;
                const p1XPEarned = isDraw ? 50 : p1Winner ? 100 : 10;
                const p1CoinsEarned = isDraw ? 10 : p1Winner ? 20 : 5;
                // P2 rewards
                const p2Winner = winnerId === p2.userId;
                const p2XPEarned = isDraw ? 50 : p2Winner ? 100 : 10;
                const p2CoinsEarned = isDraw ? 10 : p2Winner ? 20 : 5;
                // Update player 1 XP and Coins
                if (p1.profile) {
                    await prisma.profile.update({
                        where: { id: p1.profile.id },
                        data: {
                            xp: { increment: p1XPEarned },
                            coins: { increment: p1CoinsEarned }
                        }
                    });
                }
                // Update player 2 XP and Coins
                if (p2.profile) {
                    await prisma.profile.update({
                        where: { id: p2.profile.id },
                        data: {
                            xp: { increment: p2XPEarned },
                            coins: { increment: p2CoinsEarned }
                        }
                    });
                }
                let p1Score = 0;
                let p2Score = 0;
                if (room.gameSlug === 'dots-boxes') {
                    p1Score = state.playerScores?.[p1.userId] || 0;
                    p2Score = state.playerScores?.[p2.userId] || 0;
                }
                else if (room.gameSlug === 'tic-tac-toe' || room.gameSlug === 'four-in-a-row') {
                    // Tic tac toe / Four in a row final scores can be 1 for winner, 0 for loser, or 0-0 for draw
                    p1Score = winnerId === p1.userId ? 1 : 0;
                    p2Score = winnerId === p2.userId ? 1 : 0;
                }
                else if (room.gameSlug === 'cricket') {
                    p1Score = state.runs || 0;
                    p2Score = state.opponentRuns || 0;
                }
                else if (room.gameSlug === 'memory' || room.gameSlug === 'rps') {
                    p1Score = state.playerScores?.[p1.userId] || 0;
                    p2Score = state.playerScores?.[p2.userId] || 0;
                }
                else if (room.gameSlug === 'number-guessing') {
                    p1Score = winnerId === p1.userId ? 1 : 0;
                    p2Score = winnerId === p2.userId ? 1 : 0;
                }
                // Create MatchRecord
                await prisma.matchRecord.create({
                    data: {
                        roomCode: room.roomCode,
                        gameId: game.id,
                        player1Id: p1.profile.id,
                        player2Id: p2.profile.id,
                        player1Score: p1Score,
                        player2Score: p2Score,
                        winnerId: winnerProfile ? winnerProfile.id : null,
                        xpEarned: p1Winner ? p1XPEarned : p2XPEarned, // logs primary player earnings relative to record
                        coinsEarned: p1Winner ? p1CoinsEarned : p2CoinsEarned
                    }
                });
                logger_1.logger.info(`[MATCH RECORD SUCCESS] Persisted MatchRecord and updated profiles for room=${room.roomCode}`);
            }
        }
    }
    catch (err) {
        (0, logger_1.logError)(err, { roomCode: room.roomCode, context: 'persist-match-completion' });
    }
}
