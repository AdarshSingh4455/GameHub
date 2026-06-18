"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scribbleInactivityCheckers = exports.SCRIBBLE_WORDS = void 0;
exports.getScribbleSession = getScribbleSession;
exports.saveScribbleSession = saveScribbleSession;
exports.deleteScribbleSession = deleteScribbleSession;
exports.clearScribbleInactivityCheck = clearScribbleInactivityCheck;
exports.startScribbleInactivityCheck = startScribbleInactivityCheck;
exports.getScribbleMaskedState = getScribbleMaskedState;
exports.processScribbleMove = processScribbleMove;
exports.startScribbleDrawing = startScribbleDrawing;
exports.endScribbleRound = endScribbleRound;
exports.setupNextScribbleTurn = setupNextScribbleTurn;
exports.startScribbleWordSelectionTimer = startScribbleWordSelectionTimer;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const GAME_CACHE_TTL = 7200;
exports.SCRIBBLE_WORDS = [
    "Apple", "Mountain", "Doctor", "Football", "House", "Cat", "Dog", "Car", "Sun", "Tree",
    "Banana", "Airplane", "Laptop", "Coffee", "Guitar", "Sword", "Rocket", "Chair", "Bridge", "Castle",
    "Spider", "Pizza", "Burger", "Pencil", "Camera", "Mirror", "Hammer", "Clock", "Flower", "Fish",
    "Bird", "Snake", "Hat", "Shoes", "Moon", "Star", "Cloud", "Rainbow", "Fire", "Water",
    "Elephant", "Bicycle", "Cookie", "Dolphin", "Jungle", "Volcano", "Violin", "Helicopter", "Turtle", "Dinosaur"
];
async function getScribbleSession(roomCode, roomId, prisma) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error('Failed to get scribble session from Redis:', err);
        }
    }
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        await saveScribbleSession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
async function saveScribbleSession(roomCode, state) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error('Failed to save scribble session to Redis:', err);
        }
    }
}
async function deleteScribbleSession(roomCode) {
    const redisKey = `game:scribble:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error('Failed to delete scribble session from Redis:', err);
        }
    }
}
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
        logger_1.logger.info(`[SNAPSHOT SUCCESS] Persisted scribble game state to PostgreSQL for roomId=${roomId}`);
    }).catch((err) => {
        (0, logger_1.logError)(err, { roomId, context: 'scribble-snapshot' });
    });
}
// Global active interval checkers for scribble games
exports.scribbleInactivityCheckers = new Map();
function clearScribbleInactivityCheck(roomCode) {
    const interval = exports.scribbleInactivityCheckers.get(roomCode);
    if (interval) {
        clearInterval(interval);
        exports.scribbleInactivityCheckers.delete(roomCode);
    }
}
function startScribbleInactivityCheck(roomCode, io, prisma) {
    clearScribbleInactivityCheck(roomCode);
    const interval = setInterval(async () => {
        try {
            const room = await prisma.multiplayerRoom.findUnique({
                where: { roomCode },
                include: { players: { include: { profile: true } } }
            });
            if (!room || room.status !== 'PLAYING') {
                clearScribbleInactivityCheck(roomCode);
                return;
            }
            const state = await getScribbleSession(roomCode, room.id, prisma);
            if (!state || state.stage !== 'DRAWING') {
                clearScribbleInactivityCheck(roomCode);
                return;
            }
            const elapsedInactivity = Date.now() - state.lastDrawAt;
            if (elapsedInactivity >= 15000) {
                clearScribbleInactivityCheck(roomCode);
                const getUsername = (uid) => room.players.find((p) => p.userId === uid)?.profile?.username || 'Drawer';
                state.commentary.unshift(`⚠️ ${getUsername(state.drawerId)} was skipped due to drawing inactivity!`);
                await endScribbleRound(roomCode, room.id, state, room.players, prisma, io, true);
            }
            else if (elapsedInactivity >= 10000) {
                io.to(`game:${roomCode}`).emit('scribble-afk-warning', { drawerId: state.drawerId });
            }
        }
        catch (err) {
            console.error('Inactivity check error:', err);
        }
    }, 1000);
    exports.scribbleInactivityCheckers.set(roomCode, interval);
}
function getScribbleMaskedState(state, userId) {
    if (!state)
        return null;
    if (state.drawerId === userId || state.stage === 'ROUND_SUMMARY' || state.stage === 'FINISHED') {
        return state;
    }
    if (state.stage === 'DRAWING' && state.selectedWord) {
        const word = state.selectedWord.toUpperCase();
        const elapsedMs = Date.now() - state.timerStart;
        // Scaling interval logic:
        // 30s -> 8s
        // 45s -> 12s
        // 60s -> 15s
        let revealInterval = 12;
        if (state.timerDuration === 30)
            revealInterval = 8;
        else if (state.timerDuration === 60)
            revealInterval = 15;
        const hintsCount = Math.floor(elapsedMs / (revealInterval * 1000));
        const maxReveal = Math.floor(word.length / 2); // Never reveal more than 50%
        const cappedHintsCount = Math.min(hintsCount, maxReveal);
        // Deterministic shuffle of indices to reveal based on word seed
        const indices = Array.from({ length: word.length }, (_, i) => i);
        let seed = word.length;
        for (let i = indices.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            const j = Math.floor((seed / 233280) * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const revealedIndices = indices.slice(0, cappedHintsCount);
        let hintString = '';
        for (let i = 0; i < word.length; i++) {
            if (revealedIndices.includes(i)) {
                hintString += word[i] + ' ';
            }
            else {
                hintString += '_ ';
            }
        }
        hintString = hintString.trim();
        return {
            ...state,
            selectedWord: undefined, // Mask the word
            hintString
        };
    }
    return state;
}
async function processScribbleMove(roomCode, roomId, userId, move, players, prisma, io) {
    const currentGameState = await getScribbleSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Scribble session not found');
    }
    const { type } = move;
    let gameFinished = false;
    let winnerId = null;
    if (type === 'settings') {
        if (currentGameState.stage !== 'LOBBY_SETTINGS') {
            throw new Error('Game settings already initialized');
        }
        if (currentGameState.hostUserId !== userId) {
            throw new Error('Only the host can configure the match');
        }
        const duration = move.timerDuration || 45;
        if (duration !== 30 && duration !== 45 && duration !== 60) {
            throw new Error('Invalid timer duration');
        }
        currentGameState.timerDuration = duration;
        // Transition to Word Selection for first drawer
        currentGameState.drawerIndex = 0;
        currentGameState.drawerId = players[0].userId;
        currentGameState.stage = 'WORD_SELECTION';
        currentGameState.wordsToSelect = generateRandomWords();
        currentGameState.timerStart = Date.now();
        currentGameState.timerRemaining = 15; // 15 seconds to pick word
        await saveScribbleSession(roomCode, currentGameState);
        persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma);
        // Schedule word selection timeout
        startScribbleWordSelectionTimer(roomCode, io, prisma);
    }
    else if (type === 'select-word') {
        if (currentGameState.stage !== 'WORD_SELECTION') {
            throw new Error('Not currently selecting a word');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the current drawer can select the word');
        }
        const word = move.word || '';
        if (!currentGameState.wordsToSelect.includes(word)) {
            throw new Error('Invalid word selection');
        }
        await startScribbleDrawing(roomCode, roomId, currentGameState, word, players, prisma, io);
    }
    else if (type === 'draw') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Not in drawing stage');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the drawer can draw');
        }
        currentGameState.canvasLines = move.lines || [];
        currentGameState.lastDrawAt = Date.now();
        await saveScribbleSession(roomCode, currentGameState);
    }
    else if (type === 'clear') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Not in drawing stage');
        }
        if (currentGameState.drawerId !== userId) {
            throw new Error('Only the drawer can clear the canvas');
        }
        currentGameState.canvasLines = [];
        currentGameState.lastDrawAt = Date.now();
        await saveScribbleSession(roomCode, currentGameState);
    }
    else if (type === 'guess') {
        if (currentGameState.stage !== 'DRAWING') {
            throw new Error('Guesses are only allowed during drawing');
        }
        if (currentGameState.drawerId === userId) {
            throw new Error('Drawer cannot guess their own word');
        }
        if (currentGameState.guessedPlayers.includes(userId)) {
            throw new Error('You already guessed correctly');
        }
        const guess = (move.guess || '').trim().toLowerCase();
        const targetWord = currentGameState.selectedWord.toLowerCase();
        const getUsername = (uid) => players.find((p) => p.userId === uid)?.username || 'Player';
        if (guess === targetWord) {
            // Correct Guess!
            currentGameState.guessedPlayers.push(userId);
            const elapsedMs = Date.now() - currentGameState.timerStart;
            const duration = currentGameState.timerDuration;
            let points = 40;
            if (elapsedMs < (duration * 1000) / 3) {
                points = 100;
            }
            else if (elapsedMs < (duration * 1000 * 2) / 3) {
                points = 70;
            }
            // First Correct Guess Bonus (+25 points)
            if (!currentGameState.firstGuessed) {
                points += 25;
                currentGameState.firstGuessed = true;
                currentGameState.commentary.unshift(`⭐ ${getUsername(userId)} guessed FIRST! (+25 pts)`);
            }
            currentGameState.roundScores[userId] = points;
            currentGameState.playerScores[userId] = (currentGameState.playerScores[userId] || 0) + points;
            // Drawer Bonus (+20 points per guesser)
            const drawerId = currentGameState.drawerId;
            currentGameState.roundScores[drawerId] = (currentGameState.roundScores[drawerId] || 0) + 20;
            currentGameState.playerScores[drawerId] = (currentGameState.playerScores[drawerId] || 0) + 20;
            currentGameState.commentary.unshift(`✅ ${getUsername(userId)} guessed correctly! (+${points} pts)`);
            // Check if all active players (except drawer) have guessed correctly
            const spectators = players.filter((p) => p.userId !== drawerId);
            const allGuessed = spectators.every((p) => currentGameState.guessedPlayers.includes(p.userId));
            if (allGuessed) {
                clearScribbleInactivityCheck(roomCode);
                await endScribbleRound(roomCode, roomId, currentGameState, players, prisma, io);
            }
            else {
                await saveScribbleSession(roomCode, currentGameState);
                persistSnapshot(roomId, currentGameState, 'PLAYING', null, prisma);
            }
        }
        else {
            // Incorrect guess - treat as chat message or log
            currentGameState.commentary.unshift(`💬 ${getUsername(userId)}: ${move.guess}`);
            await saveScribbleSession(roomCode, currentGameState);
        }
    }
    return { state: currentGameState, gameFinished, winnerId };
}
function generateRandomWords() {
    const shuffled = [...exports.SCRIBBLE_WORDS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 4);
}
async function startScribbleDrawing(roomCode, roomId, state, word, players, prisma, io) {
    (0, index_1.clearTurnTimer)(roomCode);
    state.selectedWord = word;
    state.stage = 'DRAWING';
    state.timerStart = Date.now();
    state.guessedPlayers = [];
    state.roundScores = players.reduce((acc, p) => ({ ...acc, [p.userId]: 0 }), {});
    state.firstGuessed = false;
    state.canvasLines = [];
    state.lastDrawAt = Date.now();
    const getUsername = (uid) => players.find((p) => p.userId === uid)?.username || 'Drawer';
    state.commentary.unshift(`🎨 Round started! ${getUsername(state.drawerId)} is drawing...`);
    await saveScribbleSession(roomCode, state);
    persistSnapshot(roomId, state, 'PLAYING', null, prisma);
    // Start activity monitoring
    startScribbleInactivityCheck(roomCode, io, prisma);
    // Schedule round end drawing timer
    const duration = state.timerDuration;
    const timeout = setTimeout(async () => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const freshState = await getScribbleSession(roomCode, room.id, prisma);
                if (freshState && freshState.stage === 'DRAWING') {
                    clearScribbleInactivityCheck(roomCode);
                    await endScribbleRound(roomCode, room.id, freshState, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Drawing round timer expired error:', err);
            }
        });
    }, duration * 1000);
    index_1.roomTurnTimeouts.set(roomCode, timeout);
    // Emit player-specific masked states
    for (const player of players) {
        const pSocketId = index_1.userSockets.get(player.userId);
        if (pSocketId) {
            const maskedState = getScribbleMaskedState(state, player.userId);
            io.to(pSocketId).emit('game-update', {
                gameState: maskedState,
                gameFinished: false,
                winnerId: null
            });
        }
    }
}
async function endScribbleRound(roomCode, roomId, state, players, prisma, io, isSkipped = false) {
    (0, index_1.clearTurnTimer)(roomCode);
    clearScribbleInactivityCheck(roomCode);
    state.stage = 'ROUND_SUMMARY';
    state.commentary.unshift(`🏁 Round Over! The word was: "${state.selectedWord.toUpperCase()}"`);
    await saveScribbleSession(roomCode, state);
    persistSnapshot(roomId, state, 'PLAYING', null, prisma);
    // Notify clients (reveal full word to everyone in round summary)
    io.to(`game:${roomCode}`).emit('game-update', {
        gameState: state,
        gameFinished: false,
        winnerId: null
    });
    // Start 8-second Round Summary timer
    const summaryTimeout = setTimeout(() => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const freshState = await getScribbleSession(roomCode, room.id, prisma);
                if (freshState && freshState.stage === 'ROUND_SUMMARY') {
                    await setupNextScribbleTurn(roomCode, room.id, freshState, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Round summary transition error:', err);
            }
        });
    }, 8000);
    index_1.roomTurnTimeouts.set(roomCode, summaryTimeout);
}
async function setupNextScribbleTurn(roomCode, roomId, state, players, prisma, io) {
    state.drawerIndex++;
    // If everyone completed drawing in this round, advance round
    if (state.drawerIndex >= players.length) {
        state.drawerIndex = 0;
        state.round++;
    }
    // Check if final round ended
    if (state.round > state.maxRounds) {
        state.stage = 'FINISHED';
        // Find winner
        let maxScore = -1;
        let winnerId = null;
        Object.keys(state.playerScores).forEach(uid => {
            const s = state.playerScores[uid];
            if (s > maxScore) {
                maxScore = s;
                winnerId = uid;
            }
            else if (s === maxScore) {
                winnerId = 'DRAW';
            }
        });
        state.commentary.unshift(`🏆 Match finished! Leaderboard is final.`);
        await saveScribbleSession(roomCode, state);
        persistSnapshot(roomId, state, 'FINISHED', winnerId, prisma);
        // Distribute multiplayer rewards
        await handleMultiplayerCompletionRewards(roomId, state, winnerId, players, prisma);
        await deleteScribbleSession(roomCode);
        io.to(`game:${roomCode}`).emit('game-update', {
            gameState: state,
            gameFinished: true,
            winnerId
        });
    }
    else {
        // Word selection for next drawer
        const nextDrawer = players[state.drawerIndex];
        state.drawerId = nextDrawer.userId;
        state.stage = 'WORD_SELECTION';
        state.wordsToSelect = generateRandomWords();
        state.selectedWord = '';
        state.timerStart = Date.now();
        state.timerRemaining = 15;
        state.canvasLines = [];
        await saveScribbleSession(roomCode, state);
        persistSnapshot(roomId, state, 'PLAYING', null, prisma);
        // Schedule Word Selection timer (15s)
        startScribbleWordSelectionTimer(roomCode, io, prisma);
        // Emit player-specific masked states for word selection stage
        for (const player of players) {
            const pSocketId = index_1.userSockets.get(player.userId);
            if (pSocketId) {
                const maskedState = getScribbleMaskedState(state, player.userId);
                io.to(pSocketId).emit('game-update', {
                    gameState: maskedState,
                    gameFinished: false,
                    winnerId: null
                });
            }
        }
    }
}
function startScribbleWordSelectionTimer(roomCode, io, prisma) {
    (0, index_1.clearTurnTimer)(roomCode);
    const timeout = setTimeout(() => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room)
                    return;
                const session = await prisma.multiplayerGameSession.findUnique({ where: { roomId: room.id } });
                if (!session || session.status !== 'PLAYING')
                    return;
                const state = await getScribbleSession(roomCode, room.id, prisma);
                if (state && state.stage === 'WORD_SELECTION') {
                    // Drawer did not pick word in 15 seconds! Select first word automatically
                    const autoWord = state.wordsToSelect[0] || 'Apple';
                    state.commentary.unshift(`⏰ Time out! Word auto-chosen for drawer.`);
                    await startScribbleDrawing(roomCode, room.id, state, autoWord, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('Word selection timer expired error:', err);
            }
        });
    }, 15000);
    index_1.roomTurnTimeouts.set(roomCode, timeout);
}
async function handleMultiplayerCompletionRewards(roomId, state, winnerId, players, prisma) {
    try {
        const game = await prisma.game.findUnique({ where: { slug: 'scribble' } });
        if (!game)
            return;
        // Order players by scores
        const sortedPlayers = [...players].sort((a, b) => (state.playerScores[b.userId] || 0) - (state.playerScores[a.userId] || 0));
        for (let i = 0; i < sortedPlayers.length; i++) {
            const p = sortedPlayers[i];
            // Determine rewards based on rank
            let xp = 30;
            let coins = 5;
            if (i === 0) {
                xp = 150;
                coins = 30;
            }
            else if (i === 1) {
                xp = 100;
                coins = 20;
            }
            else if (i === 2) {
                xp = 75;
                coins = 15;
            }
            if (p.profile) {
                await prisma.profile.update({
                    where: { id: p.profile.id },
                    data: {
                        xp: { increment: xp },
                        coins: { increment: coins }
                    }
                });
            }
        }
    }
    catch (err) {
        logger_1.logger.error(err, 'Failed to distribute scribble rewards');
    }
}
// Reuse timers/queues references from index.ts by proxying
const index_1 = require("../index");
const queue_1 = require("../utils/queue");
