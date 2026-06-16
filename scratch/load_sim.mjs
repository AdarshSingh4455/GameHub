import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple manual env loader
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.join(__dirname, '../.env.local');
const envPath = path.join(__dirname, '../.env');

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      
      // Strip optional quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      
      if (!process.env[key]) {
        process.env[key] = val;
      }
    });
  }
}

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    ? false
    : { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SOCKET_URL = 'http://localhost:5000';
const CONCURRENT_ROOMS = 5;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createClient(userId, username) {
  return io(SOCKET_URL, {
    auth: {
      mockUserId: userId,
      mockUsername: username
    },
    transports: ['websocket'],
    forceNew: true,
    autoConnect: false
  });
}

async function setupDatabaseProfiles() {
  console.log('Inserting mock profiles into database...');
  for (let i = 1; i <= CONCURRENT_ROOMS; i++) {
    const hostId = `host-user-${i}`;
    const hostName = `Host_${i}`;
    const guestId = `guest-user-${i}`;
    const guestName = `Guest_${i}`;

    await prisma.profile.upsert({
      where: { userId: hostId },
      update: {},
      create: {
        userId: hostId,
        username: hostName,
        isGuest: true
      }
    });

    await prisma.profile.upsert({
      where: { userId: guestId },
      update: {},
      create: {
        userId: guestId,
        username: guestName,
        isGuest: true
      }
    });
  }
  console.log('Mock profiles upserted successfully.');
}

async function cleanupDatabaseRooms() {
  console.log('Cleaning up simulation rooms from database...');
  for (let i = 1; i <= CONCURRENT_ROOMS; i++) {
    await prisma.multiplayerRoom.deleteMany({
      where: {
        hostUserId: `host-user-${i}`
      }
    });
  }
  console.log('Database cleanup completed.');
}

async function simulateRoom(roomIndex) {
  const hostId = `host-user-${roomIndex}`;
  const hostName = `Host_${roomIndex}`;
  const guestId = `guest-user-${roomIndex}`;
  const guestName = `Guest_${roomIndex}`;

  console.log(`[Room ${roomIndex}] Connecting clients...`);
  const hostSocket = createClient(hostId, hostName);
  const guestSocket = createClient(guestId, guestName);

  return new Promise((resolve) => {
    let roomCode = '';
    let roomId = '';

    const cleanup = () => {
      hostSocket.disconnect();
      guestSocket.disconnect();
    };

    hostSocket.on('connect', () => {
      console.log(`[Room ${roomIndex}] Host connected.`);
      
      // Host creates room
      hostSocket.emit('create-room', { gameSlug: 'cricket', maxPlayers: 2 }, (res) => {
        if (res.error) {
          console.error(`[Room ${roomIndex}] Create room error:`, res.error);
          cleanup();
          return resolve();
        }
        roomCode = res.roomCode;
        console.log(`[Room ${roomIndex}] Room created: ${roomCode}`);

        // Guest connects after room is created
        guestSocket.on('connect', () => {
          console.log(`[Room ${roomIndex}] Guest connected. Joining room ${roomCode}...`);
          guestSocket.emit('join-room', { roomCode }, (joinRes) => {
            if (joinRes.error) {
              console.error(`[Room ${roomIndex}] Guest join error:`, joinRes.error);
              cleanup();
              return resolve();
            }
            console.log(`[Room ${roomIndex}] Guest joined room.`);
          });
        });

        guestSocket.connect();
      });
    });

    hostSocket.on('connect_error', (err) => {
      console.error(`[Room ${roomIndex}] Host connect error:`, err.message);
      cleanup();
      resolve();
    });

    guestSocket.on('connect_error', (err) => {
      console.error(`[Room ${roomIndex}] Guest connect error:`, err.message);
      cleanup();
      resolve();
    });

    // Handle room updates to track state and progress the flow
    let hostReady = false;
    let guestReady = false;
    let gameStarted = false;

    const onRoomUpdate = (data) => {
      roomId = data.room.id;
      const players = data.players || [];
      
      // Find host and guest readiness
      const hostPlayer = players.find(p => p.userId === hostId);
      const guestPlayer = players.find(p => p.userId === guestId);

      if (hostPlayer && guestPlayer) {
        // Toggle readiness if not ready
        if (hostPlayer.status === 'NOT_READY' && !hostReady) {
          hostReady = true;
          hostSocket.emit('toggle-ready', { roomId });
        }
        if (guestPlayer.status === 'NOT_READY' && !guestReady) {
          guestReady = true;
          guestSocket.emit('toggle-ready', { roomId });
        }

        // Host starts game if everyone is ready
        if (players.every(p => p.status === 'READY') && hostPlayer.status === 'READY' && guestPlayer.status === 'READY' && !gameStarted) {
          gameStarted = true;
          console.log(`[Room ${roomIndex}] Both players ready. Starting game...`);
          hostSocket.emit('start-game', { roomId }, (startRes) => {
            if (startRes.error) {
              console.error(`[Room ${roomIndex}] Start game error:`, startRes.error);
            }
          });
        }
      }
    };

    hostSocket.on('room-update', onRoomUpdate);
    guestSocket.on('room-update', onRoomUpdate);

    // Listen for game-state representing game starts
    hostSocket.on('game-state', (data) => {
      console.log(`[Room ${roomIndex}] Game state received. Stage: ${data.gameSession?.gameState?.stage}`);
      
      // Toss move
      if (data.gameSession?.gameState?.stage === 'TOSS') {
        console.log(`[Room ${roomIndex}] Submitting toss moves...`);
        hostSocket.emit('submit-move', { roomCode, move: { type: 'toss', choice: 'heads' } });
        guestSocket.emit('submit-move', { roomCode, move: { type: 'toss', choice: 'tails' } });
      }
    });

    let movesSubmitted = 0;
    hostSocket.on('game-update', async (data) => {
      const stage = data.gameState?.stage;
      console.log(`[Room ${roomIndex}] Game update: Stage=${stage}, Winner=${data.winnerId}`);
      
      if (stage === 'PLAYING' && movesSubmitted < 3) {
        movesSubmitted++;
        console.log(`[Room ${roomIndex}] Play move round ${movesSubmitted}`);
        hostSocket.emit('submit-move', { roomCode, move: { type: 'play', number: Math.floor(Math.random() * 6) + 1 } });
        guestSocket.emit('submit-move', { roomCode, move: { type: 'play', number: Math.floor(Math.random() * 6) + 1 } });
      }

      if (stage === 'FINISHED' || data.gameFinished) {
        console.log(`[Room ${roomIndex}] Game finished. Winner: ${data.winnerId}`);
        cleanup();
        resolve();
      }
    });

    // Connect Host to kick-off
    hostSocket.connect();
    
    // Safety timeout: 15 seconds
    setTimeout(() => {
      cleanup();
      resolve();
    }, 15000);
  });
}

async function runLoadSimulation() {
  console.log(`🚀 Starting Multiplayer Load Simulation: ${CONCURRENT_ROOMS} concurrent rooms (10 clients total)...`);
  const startTime = Date.now();

  await setupDatabaseProfiles();
  
  // Make sure existing rooms for these hosts are cleaned up
  await cleanupDatabaseRooms();

  const roomSimulations = Array.from({ length: CONCURRENT_ROOMS }, (_, i) => simulateRoom(i + 1));
  await Promise.all(roomSimulations);

  // Clean up rooms after simulation runs
  await cleanupDatabaseRooms();
  
  await prisma.$disconnect();
  await pool.end();

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Load Simulation completed in ${duration.toFixed(2)} seconds.`);
}

runLoadSimulation().catch(async (err) => {
  console.error('Simulation failed:', err);
  await prisma.$disconnect();
  await pool.end();
});
