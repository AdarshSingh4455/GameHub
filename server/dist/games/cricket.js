"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCricketSession = getCricketSession;
exports.saveCricketSession = saveCricketSession;
exports.deleteCricketSession = deleteCricketSession;
exports.processCricketMove = processCricketMove;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
const GAME_CACHE_TTL = 7200;
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
    const dbSession = await prisma.multiplayerGameSession.findUnique({
        where: { roomId }
    });
    if (dbSession) {
        const parsedState = typeof dbSession.gameState === 'string'
            ? JSON.parse(dbSession.gameState)
            : dbSession.gameState;
        await saveCricketSession(roomCode, parsedState);
        return parsedState;
    }
    return null;
}
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
async function processCricketMove(roomCode, roomId, userId, move, players, prisma) {
    const currentGameState = await getCricketSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Game session not found');
    }
    const { type } = move;
    let snapshotPersisted = false;
    let gameFinished = false;
    let winnerId = null;
    let updatedStatus = 'PLAYING';
    if (!currentGameState.moveCount) {
        currentGameState.moveCount = 0;
    }
    const getUsername = (uid) => players.find(p => p.userId === uid)?.username || 'Player';
    if (type === 'join-team') {
        if (currentGameState.stage !== 'TEAM_SETUP') {
            throw new Error('Cannot join teams outside setup stage');
        }
        const team = move.team;
        if (team !== 'BLUE' && team !== 'GREEN') {
            throw new Error('Invalid team selection');
        }
        // Remove player from other team
        const otherTeam = team === 'BLUE' ? 'GREEN' : 'BLUE';
        currentGameState.teams[otherTeam].players = (currentGameState.teams[otherTeam].players || []).filter((id) => id !== userId);
        if (currentGameState.teams[otherTeam].captain === userId) {
            currentGameState.teams[otherTeam].captain = currentGameState.teams[otherTeam].players[0] || null;
        }
        // Add to selected team
        if (!currentGameState.teams[team].players.includes(userId)) {
            currentGameState.teams[team].players.push(userId);
        }
        // Set captain if none exists
        if (!currentGameState.teams[team].captain) {
            currentGameState.teams[team].captain = userId;
        }
        currentGameState.commentary.unshift(`🔵 ${getUsername(userId)} joined the ${team === 'BLUE' ? 'Blue' : 'Green'} Team!`);
        await saveCricketSession(roomCode, currentGameState);
    }
    else if (type === 'start-match') {
        if (currentGameState.stage !== 'TEAM_SETUP') {
            throw new Error('Match already started');
        }
        if (currentGameState.hostUserId !== userId) {
            throw new Error('Only the host can start the match');
        }
        // Auto-balance teams
        const totalPlayersCount = players.length;
        const targetSize = totalPlayersCount / 2;
        let blueList = [...(currentGameState.teams['BLUE'].players || [])];
        let greenList = [...(currentGameState.teams['GREEN'].players || [])];
        const activeUserIds = players.map(p => p.userId);
        blueList = blueList.filter(id => activeUserIds.includes(id));
        greenList = greenList.filter(id => activeUserIds.includes(id));
        const unassigned = activeUserIds.filter(id => !blueList.includes(id) && !greenList.includes(id));
        for (const uId of unassigned) {
            if (blueList.length < targetSize) {
                blueList.push(uId);
            }
            else {
                greenList.push(uId);
            }
        }
        while (blueList.length > targetSize) {
            const moved = blueList.pop();
            greenList.push(moved);
        }
        while (greenList.length > targetSize) {
            const moved = greenList.pop();
            blueList.push(moved);
        }
        currentGameState.teams['BLUE'].players = blueList;
        currentGameState.teams['GREEN'].players = greenList;
        if (!currentGameState.teams['BLUE'].captain || !blueList.includes(currentGameState.teams['BLUE'].captain)) {
            currentGameState.teams['BLUE'].captain = blueList[0] || null;
        }
        if (!currentGameState.teams['GREEN'].captain || !greenList.includes(currentGameState.teams['GREEN'].captain)) {
            currentGameState.teams['GREEN'].captain = greenList[0] || null;
        }
        // Set Max wickets to team size
        currentGameState.maxWickets = targetSize;
        // Select random Captain to win Toss
        const captains = [currentGameState.teams['BLUE'].captain, currentGameState.teams['GREEN'].captain].filter(Boolean);
        const tossWinnerId = captains[Math.floor(Math.random() * captains.length)];
        currentGameState.tossWinnerId = tossWinnerId;
        currentGameState.stage = 'TOSS';
        currentGameState.commentary.unshift(`🪙 Teams balanced! Coin tossed. Captain ${getUsername(tossWinnerId)} won the toss.`);
        persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
        snapshotPersisted = true;
    }
    else if (type === 'toss') {
        const { choice } = move;
        if (currentGameState.stage !== 'TOSS') {
            throw new Error('Game is not in TOSS stage');
        }
        if (currentGameState.tossWinnerId !== userId) {
            throw new Error('Only the toss winner captain can choose roles');
        }
        if (choice !== 'BAT' && choice !== 'BOWL') {
            throw new Error('Invalid toss choice');
        }
        currentGameState.tossChoice = choice;
        // Identify teams
        const isBlueWinner = currentGameState.teams['BLUE'].players.includes(userId);
        const tossWinnerTeam = isBlueWinner ? 'BLUE' : 'GREEN';
        const opponentTeam = tossWinnerTeam === 'BLUE' ? 'GREEN' : 'BLUE';
        if (choice === 'BAT') {
            currentGameState.battingTeam = tossWinnerTeam;
            currentGameState.bowlingTeam = opponentTeam;
        }
        else {
            currentGameState.battingTeam = opponentTeam;
            currentGameState.bowlingTeam = tossWinnerTeam;
        }
        currentGameState.batsmanIndex = 0;
        currentGameState.battingUserId = currentGameState.teams[currentGameState.battingTeam].players[0];
        currentGameState.bowlerIndex = 0;
        currentGameState.bowlingUserId = currentGameState.teams[currentGameState.bowlingTeam].players[0];
        currentGameState.stage = 'FIRST_INNINGS';
        currentGameState.commentary.unshift(`🏏 ${currentGameState.battingTeam === 'BLUE' ? '🔵 Blue Team' : '🟢 Green Team'} will BAT first. ${currentGameState.bowlingTeam === 'BLUE' ? '🔵 Blue Team' : '🟢 Green Team'} will BOWL.`);
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
        const { battingUserId, bowlingUserId } = currentGameState;
        if (userId !== battingUserId && userId !== bowlingUserId) {
            throw new Error('You are not currently batting or bowling');
        }
        if (!currentGameState.moves) {
            currentGameState.moves = {};
        }
        if (currentGameState.moves[userId] !== undefined && currentGameState.moves[userId] !== null) {
            throw new Error('You have already submitted a move for this ball');
        }
        currentGameState.moves[userId] = number;
        currentGameState.moveCount++;
        const movesCount = Object.keys(currentGameState.moves).length;
        if (movesCount === 2) {
            // Resolve Ball
            const batMove = currentGameState.moves[battingUserId];
            const bowlMove = currentGameState.moves[bowlingUserId];
            const isOut = batMove === bowlMove;
            currentGameState.balls += 1;
            if (isOut) {
                currentGameState.wickets += 1;
                currentGameState.currentPartnership = 0;
                currentGameState.commentary.unshift(`❌ OUT! Both chose ${batMove}. ${getUsername(battingUserId)} is out!`);
            }
            else {
                currentGameState.runs += batMove;
                currentGameState.playerRuns[battingUserId] = (currentGameState.playerRuns[battingUserId] || 0) + batMove;
                currentGameState.currentPartnership += batMove;
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
                isOut,
                batsmanId: battingUserId,
                bowlerId: bowlingUserId
            });
            // Clear moves
            currentGameState.moves = {};
            // Check bowler rotation after over (6 balls)
            let overFinished = currentGameState.balls % 6 === 0;
            // Process stage conditions
            if (currentGameState.stage === 'FIRST_INNINGS') {
                const isExhausted = currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6;
                if (isExhausted) {
                    // Switch Innings
                    const target = currentGameState.runs + 1;
                    currentGameState.stage = 'SECOND_INNINGS';
                    currentGameState.innings = 2;
                    currentGameState.target = target;
                    currentGameState.innings1Score = currentGameState.runs;
                    const tempTeam = currentGameState.battingTeam;
                    currentGameState.battingTeam = currentGameState.bowlingTeam;
                    currentGameState.bowlingTeam = tempTeam;
                    // Reset counts
                    currentGameState.runs = 0;
                    currentGameState.wickets = 0;
                    currentGameState.balls = 0;
                    currentGameState.batsmanIndex = 0;
                    currentGameState.battingUserId = currentGameState.teams[currentGameState.battingTeam].players[0];
                    currentGameState.bowlerIndex = 0;
                    currentGameState.bowlingUserId = currentGameState.teams[currentGameState.bowlingTeam].players[0];
                    currentGameState.currentPartnership = 0;
                    currentGameState.commentary.unshift(`🔄 Innings Over! ${currentGameState.battingTeam === 'BLUE' ? '🔵 Blue Team' : '🟢 Green Team'} needs ${target} runs to win.`);
                    persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
                    snapshotPersisted = true;
                }
                else {
                    // If wicket fell, rotate batsman
                    if (isOut) {
                        currentGameState.batsmanIndex++;
                        currentGameState.battingUserId = currentGameState.teams[currentGameState.battingTeam].players[currentGameState.batsmanIndex];
                        currentGameState.commentary.unshift(`🏏 New Batter Arrives: ${getUsername(currentGameState.battingUserId)}.`);
                    }
                    // Rotate bowler if over complete
                    if (overFinished) {
                        currentGameState.bowlerIndex = (currentGameState.bowlerIndex + 1) % currentGameState.teams[currentGameState.bowlingTeam].players.length;
                        currentGameState.bowlingUserId = currentGameState.teams[currentGameState.bowlingTeam].players[currentGameState.bowlerIndex];
                        currentGameState.commentary.unshift(`🎯 Over complete! New bowler: ${getUsername(currentGameState.bowlingUserId)}.`);
                    }
                }
            }
            else if (currentGameState.stage === 'SECOND_INNINGS') {
                const target = currentGameState.target;
                let isFinished = false;
                if (currentGameState.runs >= target) {
                    isFinished = true;
                    winnerId = currentGameState.battingTeam;
                }
                else if (currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6) {
                    isFinished = true;
                    if (currentGameState.runs === target - 1) {
                        winnerId = 'DRAW';
                    }
                    else {
                        winnerId = currentGameState.bowlingTeam;
                    }
                }
                if (isFinished) {
                    currentGameState.stage = 'FINISHED';
                    currentGameState.innings2Score = currentGameState.runs;
                    let winnerLabel = 'TIE/DRAW';
                    if (winnerId === 'BLUE')
                        winnerLabel = '🔵 Blue Team Wins!';
                    else if (winnerId === 'GREEN')
                        winnerLabel = '🟢 Green Team Wins!';
                    currentGameState.commentary.unshift(`🏆 Match Over! Outcome: ${winnerLabel}`);
                    updatedStatus = 'FINISHED';
                    gameFinished = true;
                    // Persist snapshot and clean cache
                    persistSnapshot(roomId, currentGameState, updatedStatus, winnerId, prisma);
                    await deleteCricketSession(roomCode);
                    snapshotPersisted = true;
                }
                else {
                    // Rotate batsman if out
                    if (isOut) {
                        currentGameState.batsmanIndex++;
                        currentGameState.battingUserId = currentGameState.teams[currentGameState.battingTeam].players[currentGameState.batsmanIndex];
                        currentGameState.commentary.unshift(`🏏 New Batter Arrives: ${getUsername(currentGameState.battingUserId)}.`);
                    }
                    // Rotate bowler if over complete
                    if (overFinished) {
                        currentGameState.bowlerIndex = (currentGameState.bowlerIndex + 1) % currentGameState.teams[currentGameState.bowlingTeam].players.length;
                        currentGameState.bowlingUserId = currentGameState.teams[currentGameState.bowlingTeam].players[currentGameState.bowlerIndex];
                        currentGameState.commentary.unshift(`🎯 Over complete! New bowler: ${getUsername(currentGameState.bowlingUserId)}.`);
                    }
                }
            }
        }
        if (!snapshotPersisted && (currentGameState.moveCount % 10 === 0 || !redis_1.redisClient.isReady)) {
            persistSnapshot(roomId, currentGameState, updatedStatus, null, prisma);
            snapshotPersisted = true;
        }
    }
    else if (type === 'quick-chat') {
        const { message } = move;
        const validMsgs = ["Nice Shot!", "Well Played!", "Bowl Tight!", "Great Ball!", "Let's Win!"];
        if (message && validMsgs.includes(message)) {
            const isBlue = currentGameState.teams['BLUE'].players.includes(userId);
            const team = isBlue ? 'BLUE' : 'GREEN';
            if (!currentGameState.quickChat) {
                currentGameState.quickChat = [];
            }
            currentGameState.quickChat.push({
                userId,
                username: getUsername(userId),
                team,
                message,
                timestamp: Date.now()
            });
            // Keep only last 10
            if (currentGameState.quickChat.length > 10) {
                currentGameState.quickChat.shift();
            }
            await saveCricketSession(roomCode, currentGameState);
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
