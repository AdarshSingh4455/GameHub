"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snakeArenaTickIntervals = void 0;
exports.getSnakeArenaSession = getSnakeArenaSession;
exports.saveSnakeArenaSession = saveSnakeArenaSession;
exports.deleteSnakeArenaSession = deleteSnakeArenaSession;
exports.processSnakeDirectionChange = processSnakeDirectionChange;
exports.processSnakeBoost = processSnakeBoost;
exports.tickSnakeArena = tickSnakeArena;
exports.startSnakeArenaTick = startSnakeArenaTick;
exports.stopSnakeArenaTick = stopSnakeArenaTick;
const framework_1 = require("./framework");
const logger_1 = require("../utils/logger");
exports.snakeArenaTickIntervals = new Map();
async function getSnakeArenaSession(roomCode, roomId, prisma) {
    return (0, framework_1.getGameSessionFromCache)('snake-arena', roomCode, roomId, prisma);
}
async function saveSnakeArenaSession(roomCode, state) {
    return (0, framework_1.saveGameSessionToCache)('snake-arena', roomCode, state);
}
async function deleteSnakeArenaSession(roomCode) {
    return (0, framework_1.deleteGameSessionFromCache)('snake-arena', roomCode);
}
// Spawns food at a safe position not occupied by snake heads
function spawnFoodAtRandom(cols, rows, snakes, type) {
    let attempts = 0;
    let x = Math.floor(Math.random() * (cols - 4) + 2);
    let y = Math.floor(Math.random() * (rows - 4) + 2);
    // Try to avoid spawning directly inside any active snake's head
    while (attempts < 20) {
        let collides = false;
        for (const sId in snakes) {
            if (snakes[sId].status === 'ACTIVE' && snakes[sId].body.length > 0) {
                const head = snakes[sId].body[0];
                if (head.x === x && head.y === y) {
                    collides = true;
                    break;
                }
            }
        }
        if (!collides)
            break;
        x = Math.floor(Math.random() * (cols - 4) + 2);
        y = Math.floor(Math.random() * (rows - 4) + 2);
        attempts++;
    }
    let value = 10;
    if (type === 'golden')
        value = 30;
    if (type === 'giant')
        value = 20;
    const food = {
        id: `food-${Math.random().toString(36).substring(2, 9)}`,
        x,
        y,
        type,
        value
    };
    if (type !== 'normal') {
        // Golden & Giant foods expire in 8 seconds if not eaten
        food.expiresAt = Date.now() + 8000;
    }
    return food;
}
// Spawns powerups randomly
function spawnPowerupAtRandom(cols, rows, snakes) {
    const x = Math.floor(Math.random() * (cols - 4) + 2);
    const y = Math.floor(Math.random() * (rows - 4) + 2);
    const types = ['speed', 'shield', 'ghost', 'magnet', 'freeze', 'double'];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        id: `powerup-${Math.random().toString(36).substring(2, 9)}`,
        x,
        y,
        type,
        expiresAt: Date.now() + 10000 // Powerups despawn after 10 seconds if uncollected
    };
}
function processSnakeDirectionChange(state, userId, newDir) {
    const snake = state.snakes[userId];
    if (!snake || snake.status !== 'ACTIVE')
        return state;
    // Prevent 180-degree instant turns into own body
    const currentDir = snake.direction;
    const isOpposite = (newDir.x !== 0 && newDir.x === -currentDir.x) || (newDir.y !== 0 && newDir.y === -currentDir.y);
    if (isOpposite)
        return state;
    snake.direction = newDir;
    return state;
}
function processSnakeBoost(state, userId, isBoosting) {
    const snake = state.snakes[userId];
    if (!snake || snake.status !== 'ACTIVE')
        return state;
    // We toggle active boost if they have a speed powerup
    const hasSpeed = snake.activePowerups.some(p => p.type === 'speed');
    if (hasSpeed) {
        // Handled dynamically in movement tick speed checks
    }
    return state;
}
// Runs a single authoritative movement tick for all snakes
function tickSnakeArena(state) {
    if (state.status !== 'PLAYING')
        return { state, events: [] };
    const events = [];
    state.tickCount++;
    const now = Date.now();
    // 1. Despawn expired foods & powerups
    state.foods = state.foods.filter(f => !f.expiresAt || f.expiresAt > now);
    state.powerups = state.powerups.filter(p => p.expiresAt > now);
    // Spawning logic: occasionally spawn golden or giant food
    if (state.tickCount % 50 === 0 && state.foods.filter(f => f.type !== 'normal').length < 3) {
        const fType = Math.random() > 0.5 ? 'golden' : 'giant';
        state.foods.push(spawnFoodAtRandom(state.cols, state.rows, state.snakes, fType));
    }
    // Spawning logic: spawn powerups every 80 ticks
    if (state.tickCount % 80 === 0 && state.powerups.length < 4) {
        state.powerups.push(spawnPowerupAtRandom(state.cols, state.rows, state.snakes));
    }
    const activeSnakes = Object.values(state.snakes).filter(s => s.status === 'ACTIVE');
    // Freeze powerup check: Is anyone freezing others?
    const freezeActiveFor = activeSnakes.find(s => s.activePowerups.some(p => p.type === 'freeze'));
    // 2. Compute next positions (handles speed boost moving twice in single tick)
    const nextBodies = {};
    for (const snake of activeSnakes) {
        // If freeze is active and this snake is not the freezer, it is frozen and doesn't move on this tick!
        if (freezeActiveFor && freezeActiveFor.userId !== snake.userId && state.tickCount % 2 === 0) {
            nextBodies[snake.userId] = [...snake.body];
            continue;
        }
        const hasSpeed = snake.activePowerups.some(p => p.type === 'speed');
        const moveSteps = hasSpeed ? 2 : 1;
        let tempBody = [...snake.body];
        for (let step = 0; step < moveSteps; step++) {
            if (tempBody.length === 0)
                break;
            const head = tempBody[0];
            const dir = snake.direction;
            const nextHead = { x: head.x + dir.x, y: head.y + dir.y };
            // Insert new head at front, drop tail unless growing (handled below in food eating)
            tempBody.unshift(nextHead);
            tempBody.pop();
        }
        nextBodies[snake.userId] = tempBody;
        snake.survivalTime = Math.round((now - state.startTime) / 1000);
    }
    // 3. Collision Resolution
    const eliminatedSnakes = [];
    const eliminationsLog = [];
    for (const snake of activeSnakes) {
        const body = nextBodies[snake.userId];
        if (!body || body.length === 0)
            continue;
        const head = body[0];
        // Priority 1: Wall Collision
        if (head.x < 0 || head.x >= state.cols || head.y < 0 || head.y >= state.rows) {
            eliminatedSnakes.push(snake.userId);
            eliminationsLog.push({ deadId: snake.userId, killerId: null });
            events.push({ type: 'wall-collision', userId: snake.userId });
            continue;
        }
        const isSpawnProtected = snake.spawnProtectedUntil > now;
        // Priority 2: Own Body Collision
        let hitSelf = false;
        // Skip checking head itself (index 0)
        for (let i = 1; i < body.length; i++) {
            if (body[i].x === head.x && body[i].y === head.y) {
                hitSelf = true;
                break;
            }
        }
        if (hitSelf && !isSpawnProtected) {
            eliminatedSnakes.push(snake.userId);
            eliminationsLog.push({ deadId: snake.userId, killerId: null });
            events.push({ type: 'self-collision', userId: snake.userId });
            continue;
        }
        // Priority 3: Other Snake Body Collision
        let hitOtherBody = false;
        let killerId = null;
        const hasGhost = snake.activePowerups.some(p => p.type === 'ghost');
        const hasShield = snake.activePowerups.some(p => p.type === 'shield');
        if (!isSpawnProtected && !hasGhost) {
            for (const other of activeSnakes) {
                if (other.userId === snake.userId)
                    continue;
                const otherProtected = other.spawnProtectedUntil > now;
                if (otherProtected)
                    continue; // Ignore protected snakes
                const otherBody = nextBodies[other.userId] || other.body;
                // Check if head hit other body segments (excluding head itself)
                for (let i = 1; i < otherBody.length; i++) {
                    if (otherBody[i].x === head.x && otherBody[i].y === head.y) {
                        hitOtherBody = true;
                        killerId = other.userId;
                        break;
                    }
                }
                if (hitOtherBody)
                    break;
            }
        }
        if (hitOtherBody) {
            if (hasShield) {
                // Shield absorbs the blow! Deactivate shield immediately.
                snake.activePowerups = snake.activePowerups.filter(p => p.type !== 'shield');
                events.push({ type: 'shield-break', userId: snake.userId });
            }
            else {
                eliminatedSnakes.push(snake.userId);
                eliminationsLog.push({ deadId: snake.userId, killerId });
                events.push({ type: 'body-collision', userId: snake.userId, hitUserId: killerId });
                continue;
            }
        }
    }
    // Priority 4: Head-to-Head Collisions
    const headLocations = {};
    for (const snake of activeSnakes) {
        if (eliminatedSnakes.includes(snake.userId))
            continue;
        const body = nextBodies[snake.userId];
        if (!body || body.length === 0)
            continue;
        const head = body[0];
        const key = `${head.x},${head.y}`;
        if (!headLocations[key])
            headLocations[key] = [];
        headLocations[key].push(snake.userId);
    }
    for (const key in headLocations) {
        const collidingIds = headLocations[key];
        if (collidingIds.length > 1) {
            // Multiple heads met on the same cell!
            // Resolve: find max length
            let maxLength = -1;
            const lengthMap = {};
            for (const id of collidingIds) {
                const len = state.snakes[id].body.length;
                lengthMap[id] = len;
                if (len > maxLength)
                    maxLength = len;
            }
            // Check how many have this max length
            const winners = collidingIds.filter(id => lengthMap[id] === maxLength);
            if (winners.length > 1) {
                // Tie: all at this location die!
                for (const id of collidingIds) {
                    if (!eliminatedSnakes.includes(id)) {
                        eliminatedSnakes.push(id);
                        eliminationsLog.push({ deadId: id, killerId: null });
                        events.push({ type: 'head-collision', userId: id, status: 'draw' });
                    }
                }
            }
            else {
                // One winner: longer snake survives!
                const winnerId = winners[0];
                for (const id of collidingIds) {
                    if (id !== winnerId && !eliminatedSnakes.includes(id)) {
                        eliminatedSnakes.push(id);
                        eliminationsLog.push({ deadId: id, killerId: winnerId });
                        events.push({ type: 'head-collision', userId: id, winnerId });
                    }
                }
            }
        }
    }
    // Process Eliminations: Turn dead bodies into food
    for (const log of eliminationsLog) {
        const s = state.snakes[log.deadId];
        s.status = 'ELIMINATED';
        // Scatter body segments as food pieces with small offsets
        s.body.forEach((seg) => {
            // Scatter: -1, 0, or 1 offset
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            let foodX = Math.max(1, Math.min(state.cols - 2, seg.x + dx));
            let foodY = Math.max(1, Math.min(state.rows - 2, seg.y + dy));
            state.foods.push({
                id: `food-${Math.random().toString(36).substring(2, 9)}`,
                x: foodX,
                y: foodY,
                type: 'dead',
                value: 15,
                expiresAt: now + 10000 // Expires in 10s
            });
        });
        if (log.killerId) {
            const killer = state.snakes[log.killerId];
            if (killer) {
                killer.eliminations++;
                killer.score += 50;
            }
        }
    }
    // 4. Update surviving snakes and handle food / powerup eating
    for (const snake of activeSnakes) {
        if (eliminatedSnakes.includes(snake.userId))
            continue;
        const body = nextBodies[snake.userId];
        if (!body || body.length === 0)
            continue;
        const head = body[0];
        snake.body = body;
        // Expiration checks for active powerups
        snake.activePowerups = snake.activePowerups.filter(p => p.expiresAt > now);
        // Check powerup pickup
        const powerupIndex = state.powerups.findIndex(p => p.x === head.x && p.y === head.y);
        if (powerupIndex !== -1) {
            const picked = state.powerups[powerupIndex];
            state.powerups.splice(powerupIndex, 1);
            // Add to snake powerups (duration 8 seconds)
            snake.activePowerups = snake.activePowerups.filter(p => p.type !== picked.type);
            snake.activePowerups.push({
                type: picked.type,
                expiresAt: now + 8000
            });
            events.push({ type: 'powerup-pickup', userId: snake.userId, powerup: picked.type });
        }
        // Magnet powerup check: pull food within 2 cells
        const hasMagnet = snake.activePowerups.some(p => p.type === 'magnet');
        if (hasMagnet) {
            for (const food of state.foods) {
                const dist = Math.max(Math.abs(food.x - head.x), Math.abs(food.y - head.y));
                if (dist <= 2 && dist > 0) {
                    // Pull food towards head
                    food.x = head.x;
                    food.y = head.y;
                }
            }
        }
        // Check food eating
        const eatenIndexes = [];
        state.foods.forEach((food, idx) => {
            if (food.x === head.x && food.y === head.y) {
                eatenIndexes.push(idx);
            }
        });
        if (eatenIndexes.length > 0) {
            // Eat the food
            for (const idx of eatenIndexes) {
                const food = state.foods[idx];
                const hasDouble = snake.activePowerups.some(p => p.type === 'double');
                let growAmount = 1;
                if (food.type === 'giant')
                    growAmount = 3;
                if (hasDouble)
                    growAmount *= 2;
                // Grow by extending tail
                for (let g = 0; g < growAmount; g++) {
                    const tail = snake.body[snake.body.length - 1] || head;
                    snake.body.push({ ...tail });
                }
                const scoreAwarded = hasDouble ? food.value * 2 : food.value;
                snake.score += scoreAwarded;
                snake.length = snake.body.length;
                events.push({ type: 'food-eaten', userId: snake.userId, foodType: food.type });
            }
            // Filter out eaten foods
            state.foods = state.foods.filter((_, idx) => !eatenIndexes.includes(idx));
            // Spawn replacement normal foods
            eatenIndexes.forEach(() => {
                state.foods.push(spawnFoodAtRandom(state.cols, state.rows, state.snakes, 'normal'));
            });
        }
    }
    // 5. Game End Checklist
    const survivors = Object.values(state.snakes).filter(s => s.status === 'ACTIVE');
    const totalPlayers = Object.keys(state.snakes).length;
    if (totalPlayers === 1) {
        // Solo vs AI Mode
        if (survivors.length === 0) {
            state.status = 'FINISHED';
            state.winnerId = null;
            events.push({ type: 'game-over', winnerId: null });
        }
        else {
            // Check if AI is dead, handled dynamically by AI module
        }
    }
    else {
        // Multiplayer Mode
        if (survivors.length === 1) {
            state.status = 'FINISHED';
            state.winnerId = survivors[0].userId;
            events.push({ type: 'game-over', winnerId: survivors[0].userId });
        }
        else if (survivors.length === 0) {
            state.status = 'FINISHED';
            state.winnerId = null;
            events.push({ type: 'game-over', winnerId: null });
        }
    }
    return { state, events };
}
function startSnakeArenaTick(roomCode, io, prisma) {
    stopSnakeArenaTick(roomCode);
    const interval = setInterval(async () => {
        try {
            const room = await prisma.multiplayerRoom.findUnique({
                where: { roomCode },
                include: { players: { include: { profile: true } } }
            });
            if (!room || room.status !== 'PLAYING') {
                stopSnakeArenaTick(roomCode);
                return;
            }
            const state = await getSnakeArenaSession(roomCode, room.id, prisma);
            if (!state || state.status !== 'PLAYING') {
                stopSnakeArenaTick(roomCode);
                return;
            }
            const { state: nextState, events } = tickSnakeArena(state);
            await saveSnakeArenaSession(roomCode, nextState);
            io.to(`room:${roomCode}`).emit('game-update', {
                gameState: nextState,
                events,
                gameFinished: nextState.status === 'FINISHED',
                winnerId: nextState.winnerId
            });
            if (nextState.status === 'FINISHED') {
                stopSnakeArenaTick(roomCode);
                (0, framework_1.persistSnapshotAsync)(room.id, nextState, 'FINISHED', nextState.winnerId, null, 'snake-arena', prisma);
                await (0, framework_1.handleMatchCompletion)(room, nextState, nextState.winnerId, prisma);
            }
        }
        catch (err) {
            logger_1.logger.error(`Error in snake-arena tick for roomCode=${roomCode}: ${err?.message || err}`);
        }
    }, 100);
    exports.snakeArenaTickIntervals.set(roomCode, interval);
}
function stopSnakeArenaTick(roomCode) {
    const interval = exports.snakeArenaTickIntervals.get(roomCode);
    if (interval) {
        clearInterval(interval);
        exports.snakeArenaTickIntervals.delete(roomCode);
    }
}
