"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhosSpySession = getWhosSpySession;
exports.saveWhosSpySession = saveWhosSpySession;
exports.deleteWhosSpySession = deleteWhosSpySession;
exports.clearWhosSpyTimer = clearWhosSpyTimer;
exports.isWordBlocked = isWordBlocked;
exports.getWhosSpyMaskedState = getWhosSpyMaskedState;
exports.broadcastGameState = broadcastGameState;
exports.startWhosSpyTimer = startWhosSpyTimer;
exports.handleWhosSpyCompletionRewards = handleWhosSpyCompletionRewards;
exports.processWhosSpyMove = processWhosSpyMove;
exports.startWhosSpyRematch = startWhosSpyRematch;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const words_1 = require("./words");
const queue_1 = require("../utils/queue");
const index_1 = require("../index");
const framework_1 = require("./framework");
const GAME_CACHE_TTL = 7200;
const whosSpyTimers = new Map();
async function getWhosSpySession(roomCode, roomId, prisma) {
    const redisKey = `game:whosspy:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            const cached = await redis_1.redisClient.get(redisKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }
        catch (err) {
            console.error('Failed to get Whos Spy session from Redis:', err);
        }
    }
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        await saveWhosSpySession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
async function saveWhosSpySession(roomCode, state) {
    const redisKey = `game:whosspy:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.set(redisKey, JSON.stringify(state), { EX: GAME_CACHE_TTL });
        }
        catch (err) {
            console.error('Failed to save Whos Spy session to Redis:', err);
        }
    }
}
async function deleteWhosSpySession(roomCode) {
    const redisKey = `game:whosspy:${roomCode}`;
    if (redis_1.redisClient.isReady) {
        try {
            await redis_1.redisClient.del(redisKey);
        }
        catch (err) {
            console.error('Failed to delete Whos Spy session from Redis:', err);
        }
    }
}
function clearWhosSpyTimer(roomCode) {
    const timer = whosSpyTimers.get(roomCode);
    if (timer) {
        clearTimeout(timer);
        whosSpyTimers.delete(roomCode);
    }
}
function isWordBlocked(message, secretWord) {
    if (!secretWord)
        return false;
    const cleanMsg = message.toLowerCase().trim();
    const cleanWord = secretWord.toLowerCase().trim();
    const variations = new Set();
    variations.add(cleanWord);
    // Plural / singular simple variations
    if (cleanWord.endsWith('s')) {
        variations.add(cleanWord.slice(0, -1));
    }
    else {
        variations.add(cleanWord + 's');
    }
    if (cleanWord.endsWith('y')) {
        variations.add(cleanWord.slice(0, -1) + 'ies');
    }
    else if (cleanWord.endsWith('ies')) {
        variations.add(cleanWord.slice(0, -3) + 'y');
    }
    if (cleanWord.endsWith('x') || cleanWord.endsWith('ch') || cleanWord.endsWith('sh')) {
        variations.add(cleanWord + 'es');
    }
    // Possessives
    variations.add(cleanWord + "'s");
    variations.add(cleanWord + "s'");
    // Add registered aliases
    const aliases = words_1.WORD_ALIASES[secretWord] || [];
    for (const alias of aliases) {
        const cleanAlias = alias.toLowerCase().trim();
        variations.add(cleanAlias);
        if (cleanAlias.endsWith('s')) {
            variations.add(cleanAlias.slice(0, -1));
        }
        else {
            variations.add(cleanAlias + 's');
        }
        variations.add(cleanAlias + "'s");
    }
    for (const variant of variations) {
        const escapedVariant = variant.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedVariant}\\b`, 'i');
        if (regex.test(cleanMsg)) {
            return true;
        }
    }
    return false;
}
function getWhosSpyMaskedState(state, userId) {
    if (!state)
        return null;
    const cloned = JSON.parse(JSON.stringify(state));
    if (cloned.spyId === userId) {
        delete cloned.word;
        cloned.isSpy = true;
    }
    else {
        cloned.isSpy = false;
    }
    if (cloned.stage === 'VOTING' || cloned.stage === 'REVOTE') {
        cloned.hasVoted = {};
        if (cloned.votes) {
            for (const voterId of Object.keys(cloned.votes)) {
                cloned.hasVoted[voterId] = true;
            }
        }
        delete cloned.votes;
    }
    return cloned;
}
function broadcastGameState(roomCode, state, players, io) {
    for (const player of players) {
        const socketId = index_1.userSockets.get(player.userId);
        if (socketId) {
            const maskedState = getWhosSpyMaskedState(state, player.userId);
            io.to(socketId).emit('game-update', {
                gameState: maskedState,
                gameFinished: state.stage === 'FINISHED',
                winnerId: state.winnerId,
                serverTime: Date.now()
            });
        }
    }
}
function startWhosSpyTimer(roomCode, roomId, durationMs, targetStage, players, prisma, io) {
    clearWhosSpyTimer(roomCode);
    const timer = setTimeout(async () => {
        const queue = (0, queue_1.getRoomQueue)(roomCode);
        queue.add(async () => {
            try {
                const room = await prisma.multiplayerRoom.findUnique({
                    where: { roomCode },
                    include: { players: { include: { profile: true } } }
                });
                if (!room || room.status !== 'PLAYING')
                    return;
                const state = await getWhosSpySession(roomCode, roomId, prisma);
                if (!state)
                    return;
                if (targetStage === 'VOTING' && state.stage === 'DISCUSSION') {
                    state.stage = 'VOTING';
                    state.timerStart = Date.now();
                    const isFast = process.env.TEST_FAST_TIMEOUT === 'true';
                    state.timerDuration = isFast ? 5 : 30;
                    state.votes = {};
                    await saveWhosSpySession(roomCode, state);
                    const now = new Date();
                    await prisma.multiplayerGameSession.update({
                        where: { roomId },
                        data: { gameState: state, updatedAt: now }
                    });
                    broadcastGameState(roomCode, state, room.players, io);
                    startWhosSpyTimer(roomCode, roomId, isFast ? 5000 : 30000, 'VOTE_REVEAL', players, prisma, io);
                }
                else if (targetStage === 'VOTE_REVEAL' && (state.stage === 'VOTING' || state.stage === 'REVOTE')) {
                    await resolveVotes(roomCode, roomId, state, room.players, prisma, io);
                }
            }
            catch (err) {
                console.error('[WhosSpy Timer Error]', err);
            }
        });
    }, durationMs);
    whosSpyTimers.set(roomCode, timer);
}
async function resolveVotes(roomCode, roomId, state, players, prisma, io) {
    clearWhosSpyTimer(roomCode);
    const votes = state.votes || {};
    const voteCounts = {};
    for (const p of players) {
        voteCounts[p.userId] = 0;
    }
    for (const voterId of Object.keys(votes)) {
        const votedId = votes[voterId];
        if (votedId && voteCounts[votedId] !== undefined) {
            voteCounts[votedId]++;
        }
    }
    state.voteCounts = voteCounts;
    let maxVotes = -1;
    let tiedPlayers = [];
    for (const userId of Object.keys(voteCounts)) {
        const count = voteCounts[userId];
        if (count > maxVotes) {
            maxVotes = count;
            tiedPlayers = [userId];
        }
        else if (count === maxVotes) {
            tiedPlayers.push(userId);
        }
    }
    // Tie Handling: 30s revote between tied players
    let eliminatedUserId = '';
    if (tiedPlayers.length > 1) {
        if (state.stage === 'VOTING') {
            state.stage = 'REVOTE';
            state.tiedPlayers = tiedPlayers;
            state.votes = {};
            state.voteCounts = {};
            state.timerStart = Date.now();
            const isFast = process.env.TEST_FAST_TIMEOUT === 'true';
            state.timerDuration = isFast ? 5 : 30;
            const tiedUsernames = tiedPlayers.map(id => players.find(p => p.userId === id)?.profile?.username || 'Player').join(', ');
            state.commentary = state.commentary || [];
            state.commentary.unshift(`⚖️ Tie vote between: ${tiedUsernames}! Starting a 30-second revote.`);
            await saveWhosSpySession(roomCode, state);
            const now = new Date();
            await prisma.multiplayerGameSession.update({
                where: { roomId },
                data: { gameState: state, updatedAt: now }
            });
            broadcastGameState(roomCode, state, players, io);
            startWhosSpyTimer(roomCode, roomId, isFast ? 5000 : 30000, 'VOTE_REVEAL', players, prisma, io);
            return;
        }
        else {
            eliminatedUserId = tiedPlayers[Math.floor(Math.random() * tiedPlayers.length)];
        }
    }
    else if (tiedPlayers.length === 1) {
        eliminatedUserId = tiedPlayers[0];
    }
    else {
        eliminatedUserId = players[Math.floor(Math.random() * players.length)].userId;
    }
    state.eliminatedUserId = eliminatedUserId;
    const eliminatedUsername = players.find(p => p.userId === eliminatedUserId)?.profile?.username || 'Someone';
    state.commentary = state.commentary || [];
    state.commentary.unshift(`🗳️ Voting completed! ${eliminatedUsername} was voted out.`);
    if (eliminatedUserId === state.spyId) {
        state.stage = 'SPY_GUESS';
        state.currentTurn = state.spyId;
        state.timerStart = Date.now();
        const isFast = process.env.TEST_FAST_TIMEOUT === 'true';
        state.timerDuration = isFast ? 5 : 30;
        const guessTimeout = setTimeout(async () => {
            const queue = (0, queue_1.getRoomQueue)(roomCode);
            queue.add(async () => {
                try {
                    const room = await prisma.multiplayerRoom.findUnique({
                        where: { roomCode },
                        include: { players: { include: { profile: true } } }
                    });
                    if (!room || room.status !== 'PLAYING')
                        return;
                    const s = await getWhosSpySession(roomCode, roomId, prisma);
                    if (!s || s.stage !== 'SPY_GUESS')
                        return;
                    s.stage = 'FINISHED';
                    s.winnerId = 'CIVILIANS';
                    s.commentary.unshift(`⏰ Time out! The Spy failed to guess the secret word.`);
                    await saveWhosSpySession(roomCode, s);
                    await prisma.multiplayerGameSession.update({
                        where: { roomId },
                        data: { status: 'FINISHED', winnerId: 'CIVILIANS', gameState: s }
                    });
                    await handleWhosSpyCompletionRewards(roomId, s, 'CIVILIANS', room.players, prisma);
                    broadcastGameState(roomCode, s, room.players, io);
                    (0, queue_1.deleteRoomQueue)(roomCode);
                }
                catch (err) {
                    console.error('[WhosSpy Guess Timeout Error]', err);
                }
            });
        }, isFast ? 5000 : 30000);
        whosSpyTimers.set(roomCode, guessTimeout);
        await saveWhosSpySession(roomCode, state);
        const now = new Date();
        await prisma.multiplayerGameSession.update({
            where: { roomId },
            data: { gameState: state, currentTurn: state.spyId, updatedAt: now }
        });
        broadcastGameState(roomCode, state, players, io);
    }
    else {
        state.stage = 'FINISHED';
        state.winnerId = state.spyId;
        state.commentary.unshift(`🕵️ The Spy survived the vote and wins the game!`);
        await saveWhosSpySession(roomCode, state);
        await prisma.multiplayerGameSession.update({
            where: { roomId },
            data: { status: 'FINISHED', winnerId: state.spyId, gameState: state }
        });
        await handleWhosSpyCompletionRewards(roomId, state, state.spyId, players, prisma);
        broadcastGameState(roomCode, state, players, io);
        (0, queue_1.deleteRoomQueue)(roomCode);
    }
}
async function handleWhosSpyCompletionRewards(roomId, state, winnerId, players, prisma) {
    try {
        const game = await prisma.game.findUnique({ where: { slug: 'whos-spy' } });
        if (!game)
            return;
        const spyId = state.spyId;
        const spyPlayer = players.find(p => p.userId === spyId);
        const isSpyWin = winnerId === spyId;
        for (const p of players) {
            const isSpy = p.userId === spyId;
            let xp = 30;
            let coins = 5;
            if (isSpyWin) {
                if (isSpy) {
                    xp = 40;
                    coins = 10;
                }
                else {
                    xp = 5;
                    coins = 2;
                }
            }
            else {
                if (isSpy) {
                    xp = 5;
                    coins = 2;
                }
                else {
                    xp = 25;
                    coins = 8;
                }
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
        const hostProfile = players.find(p => p.userId === state.hostUserId)?.profile;
        if (hostProfile) {
            await prisma.matchRecord.create({
                data: {
                    roomCode: state.roomCode || '',
                    gameId: game.id,
                    player1Id: hostProfile.id,
                    player1Score: isSpyWin ? 150 : 30,
                    winnerId: isSpyWin ? spyPlayer?.profile?.id : null,
                    xpEarned: isSpyWin ? 150 : 100,
                    coinsEarned: isSpyWin ? 30 : 20
                }
            });
        }
        await prisma.multiplayerRoom.update({
            where: { id: roomId },
            data: { status: 'FINISHED' }
        });
    }
    catch (err) {
        logger_1.logger.error(err, 'Failed to distribute Whos Spy rewards');
    }
}
async function processWhosSpyMove(roomCode, roomId, userId, move, players, prisma, io) {
    const state = await getWhosSpySession(roomCode, roomId, prisma);
    if (!state)
        throw new Error('Game session not found');
    const { type } = move;
    if (type === 'reveal-dismiss') {
        state.dismissedRole = state.dismissedRole || {};
        state.dismissedRole[userId] = true;
        const allDismissed = players.every(p => state.dismissedRole[p.userId] === true);
        if (allDismissed) {
            state.stage = 'CLUE';
            state.currentTurnIndex = 0;
            state.currentTurn = state.clueOrder[0];
            state.timerStart = Date.now();
            state.timerDuration = 45; // 45s for clue submission
        }
        await saveWhosSpySession(roomCode, state);
        const now = new Date();
        await prisma.multiplayerGameSession.update({
            where: { roomId },
            data: {
                gameState: state,
                currentTurn: state.currentTurn || null,
                updatedAt: now
            }
        });
        return { state, gameFinished: false, winnerId: null };
    }
    if (type === 'clue') {
        if (state.stage !== 'CLUE') {
            throw new Error('Not currently the clue phase');
        }
        if (state.currentTurn !== userId) {
            throw new Error("It's not your turn");
        }
        const clue = move.clue || '';
        if (!clue.trim()) {
            throw new Error('Clue cannot be empty');
        }
        // Check message block rules
        if (isWordBlocked(clue, state.word)) {
            throw new Error('⚠️ Your message reveals too much about the secret word. Try giving a subtler clue.');
        }
        state.clues = state.clues || {};
        state.clues[userId] = clue.trim();
        state.currentTurnIndex = (state.currentTurnIndex || 0) + 1;
        if (state.currentTurnIndex < state.clueOrder.length) {
            state.currentTurn = state.clueOrder[state.currentTurnIndex];
        }
        else {
            // Transition to DISCUSSION
            state.stage = 'DISCUSSION';
            state.currentTurn = null;
            state.timerStart = Date.now();
            const isFast = process.env.TEST_FAST_TIMEOUT === 'true';
            let duration = 90;
            const numPlayers = players.length;
            if (numPlayers >= 3 && numPlayers <= 5) {
                duration = 60;
            }
            else if (numPlayers >= 6 && numPlayers <= 8) {
                duration = 90;
            }
            else if (numPlayers >= 9 && numPlayers <= 10) {
                duration = 120;
            }
            state.timerDuration = isFast ? 5 : duration;
            startWhosSpyTimer(roomCode, roomId, isFast ? 5000 : duration * 1000, 'VOTING', players, prisma, io);
        }
        await saveWhosSpySession(roomCode, state);
        const now = new Date();
        await prisma.multiplayerGameSession.update({
            where: { roomId },
            data: {
                gameState: state,
                currentTurn: state.currentTurn || null,
                updatedAt: now
            }
        });
        return { state, gameFinished: false, winnerId: null };
    }
    if (type === 'vote') {
        if (state.stage !== 'VOTING' && state.stage !== 'REVOTE') {
            throw new Error('Not currently the voting phase');
        }
        const targetUserId = move.targetUserId;
        if (!targetUserId) {
            throw new Error('Must vote for a player');
        }
        if (targetUserId === userId) {
            throw new Error('You cannot vote for yourself');
        }
        if (!players.some(p => p.userId === targetUserId)) {
            throw new Error('Invalid target player');
        }
        if (state.stage === 'REVOTE') {
            const tied = state.tiedPlayers || [];
            if (!tied.includes(targetUserId)) {
                throw new Error('You must vote for one of the tied players');
            }
        }
        state.votes = state.votes || {};
        state.votes[userId] = targetUserId;
        const allVoted = players.every(p => state.votes[p.userId] !== undefined);
        if (allVoted) {
            clearWhosSpyTimer(roomCode);
            await resolveVotes(roomCode, roomId, state, players, prisma, io);
            const isFinished = state.stage === 'FINISHED';
            return { state, gameFinished: isFinished, winnerId: isFinished ? state.winnerId : null };
        }
        await saveWhosSpySession(roomCode, state);
        const now = new Date();
        await prisma.multiplayerGameSession.update({
            where: { roomId },
            data: { gameState: state, updatedAt: now }
        });
        return { state, gameFinished: false, winnerId: null };
    }
    if (type === 'spy-guess') {
        if (state.stage !== 'SPY_GUESS') {
            throw new Error('Not currently the guess phase');
        }
        if (userId !== state.spyId) {
            throw new Error('Only the Spy can guess the secret word');
        }
        const guess = move.guess || '';
        const cleanGuess = guess.toLowerCase().trim();
        const cleanWord = state.word.toLowerCase().trim();
        clearWhosSpyTimer(roomCode);
        if (cleanGuess === cleanWord) {
            state.stage = 'FINISHED';
            state.winnerId = state.spyId;
            state.commentary.unshift(`🕵️ Correct guess! The Spy guessed the secret word "${state.word}" and wins!`);
            await saveWhosSpySession(roomCode, state);
            await prisma.multiplayerGameSession.update({
                where: { roomId },
                data: { status: 'FINISHED', winnerId: state.spyId, gameState: state }
            });
            await handleWhosSpyCompletionRewards(roomId, state, state.spyId, players, prisma);
            return { state, gameFinished: true, winnerId: state.spyId };
        }
        else {
            state.stage = 'FINISHED';
            state.winnerId = 'CIVILIANS';
            state.commentary.unshift(`🐾 Incorrect guess! The Spy guessed "${guess}". The secret word was "${state.word}". Civilians win!`);
            await saveWhosSpySession(roomCode, state);
            await prisma.multiplayerGameSession.update({
                where: { roomId },
                data: { status: 'FINISHED', winnerId: 'CIVILIANS', gameState: state }
            });
            await handleWhosSpyCompletionRewards(roomId, state, 'CIVILIANS', players, prisma);
            return { state, gameFinished: true, winnerId: 'CIVILIANS' };
        }
    }
    throw new Error('Invalid Whos Spy move type');
}
async function startWhosSpyRematch(roomCode, hostUserId, players, prevGameState) {
    await deleteWhosSpySession(roomCode);
    const prevUsedWords = prevGameState?.usedWords || {};
    const finalGameState = framework_1.INITIAL_STATES['whos-spy'](players, hostUserId);
    const category = finalGameState.category;
    const used = prevUsedWords[category] || [];
    const allWords = words_1.LOCAL_CATEGORIES[category] || words_1.LOCAL_CATEGORIES.Animals;
    let unusedWords = allWords.filter((w) => !used.includes(w));
    if (unusedWords.length === 0) {
        prevUsedWords[category] = [];
        unusedWords = allWords;
    }
    const chosenWord = unusedWords[Math.floor(Math.random() * unusedWords.length)];
    prevUsedWords[category].push(chosenWord);
    finalGameState.word = chosenWord;
    finalGameState.usedWords = prevUsedWords;
    finalGameState.roomCode = roomCode;
    await saveWhosSpySession(roomCode, finalGameState);
    return finalGameState;
}
