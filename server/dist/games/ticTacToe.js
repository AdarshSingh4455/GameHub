"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTicTacToeSession = getTicTacToeSession;
exports.saveTicTacToeSession = saveTicTacToeSession;
exports.deleteTicTacToeSession = deleteTicTacToeSession;
exports.processTicTacToeMove = processTicTacToeMove;
const framework_1 = require("./framework");
const WINNING_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
];
/**
 * Checks if a player has won the game
 */
function checkWinner(board) {
    for (const [a, b, c] of WINNING_LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line: [a, b, c] };
        }
    }
    return null;
}
/**
 * Loads the active Tic-Tac-Toe game session state
 */
async function getTicTacToeSession(roomCode, roomId, prisma) {
    return (0, framework_1.getGameSessionFromCache)('tic-tac-toe', roomCode, roomId, prisma);
}
/**
 * Saves Tic-Tac-Toe game session state to cache
 */
async function saveTicTacToeSession(roomCode, state) {
    return (0, framework_1.saveGameSessionToCache)('tic-tac-toe', roomCode, state);
}
/**
 * Deletes Tic-Tac-Toe game session state from cache
 */
async function deleteTicTacToeSession(roomCode) {
    return (0, framework_1.deleteGameSessionFromCache)('tic-tac-toe', roomCode);
}
/**
 * Processes a Tic-Tac-Toe multiplayer move
 */
async function processTicTacToeMove(roomCode, roomId, userId, move, players, prisma) {
    const currentGameState = await getTicTacToeSession(roomCode, roomId, prisma);
    if (!currentGameState) {
        throw new Error('Game session not found');
    }
    // Authoritative turn check
    (0, framework_1.validateTurn)(currentGameState, userId);
    const { index } = move;
    if (index === undefined || index < 0 || index > 8) {
        throw new Error('Invalid board index');
    }
    const board = currentGameState.board || Array(9).fill(null);
    // Validate double-click/already claimed cell
    if (board[index] !== null) {
        throw new Error('Cell already claimed');
    }
    const playerIds = players.map(p => p.userId);
    const opponentUserId = playerIds.find(id => id !== userId) || '';
    // Assign symbols based on room order (p1 = X, p2 = O)
    const isP1 = playerIds[0] === userId;
    const symbol = isP1 ? 'X' : 'O';
    // Apply move to board
    board[index] = symbol;
    currentGameState.board = board;
    if (!currentGameState.moveCount) {
        currentGameState.moveCount = 0;
    }
    currentGameState.moveCount++;
    // Check win or draw
    const winCheck = checkWinner(board);
    let gameFinished = false;
    let winnerId = null;
    let updatedStatus = 'PLAYING';
    let snapshotPersisted = false;
    let nextTurn = opponentUserId;
    if (winCheck) {
        gameFinished = true;
        winnerId = userId; // The active player won
        updatedStatus = 'FINISHED';
        nextTurn = null;
        currentGameState.winnerId = winnerId;
        currentGameState.winningLine = winCheck.line;
        currentGameState.currentTurn = null;
        // Final snapshot persistence
        (0, framework_1.persistSnapshotAsync)(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma);
        await deleteTicTacToeSession(roomCode);
        snapshotPersisted = true;
    }
    else if (board.every((cell) => cell !== null)) {
        gameFinished = true;
        winnerId = 'DRAW';
        updatedStatus = 'FINISHED';
        nextTurn = null;
        currentGameState.winnerId = 'DRAW';
        currentGameState.currentTurn = null;
        // Final snapshot persistence
        (0, framework_1.persistSnapshotAsync)(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma);
        await deleteTicTacToeSession(roomCode);
        snapshotPersisted = true;
    }
    else {
        // Normal turn switch
        currentGameState.currentTurn = nextTurn;
        // Update turn expiration timestamp for turn timer countdown
        const turnDurationMs = 30000; // 30 seconds turn timer
        currentGameState.turnExpiration = new Date(Date.now() + turnDurationMs).toISOString();
    }
    // Persist snapshot asynchronously: on every move (since TTT has max 9 moves, we snapshot every move for high recovery guarantees)
    if (!snapshotPersisted) {
        (0, framework_1.persistSnapshotAsync)(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'tic-tac-toe', prisma);
        snapshotPersisted = true;
        // Save updated state to Redis cache
        await saveTicTacToeSession(roomCode, currentGameState);
    }
    return {
        state: currentGameState,
        snapshotPersisted,
        gameFinished,
        winnerId: updatedStatus === 'FINISHED' ? (winnerId || 'DRAW') : null
    };
}
