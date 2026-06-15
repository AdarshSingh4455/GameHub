const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST"]
  }
});

const WORDS = ["elephant", "laptop", "banana", "mountain", "airplane", "rainbow", "guitar"];

function getRandomWords() {
  let shuffled = [...WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

let rooms = {}; // To store room data

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("create-room", ({ username, settings }, callback) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
      players: [{ id: socket.id, name: username, score: 0 }],
      hostId: socket.id,
      settings,
      gameStarted: false
    };
    socket.join(roomCode);
    callback(roomCode);
    console.log(`Room ${roomCode} created by ${username}`);
  });

  socket.on("join-room", ({ username, roomCode }, callback) => {
    const room = rooms[roomCode];
    if (!room) return callback({ error: "Room not found" });

    room.players.push({ id: socket.id, name: username, score: 0 });
    room.scores = room.scores || {};
    room.scores[username] = 0;

    socket.join(roomCode);
    callback({ success: true, players: room.players });
    io.to(roomCode).emit("player-joined", room.players);
  });

  socket.on("chat-message", ({ roomCode, playerName, message }) => {
    const room = rooms[roomCode];
    const correctWord = room.currentWord.toLowerCase().trim();
    const guess = message.toLowerCase().trim();

    if (guess === correctWord) {
      if (!room.guessedPlayers) room.guessedPlayers = new Set();
      if (!room.guessedPlayers.has(socket.id)) {
        room.guessedPlayers.add(socket.id);

        const basePoints = 50;
        const bonus = room.currentTimeLeft * 2;
        const totalPoints = basePoints + bonus;

        room.scores[playerName] += totalPoints;

        const drawerId = room.drawerSocketId;
        const drawerPlayer = Object.entries(room.players).find(([id, name]) => id === drawerId);
        if (drawerPlayer) {
          room.scores[drawerPlayer[1]] += 25;
        }

        io.to(roomCode).emit("correct-guess", { playerName });
        io.to(roomCode).emit("update-scores", room.scores);
      }
      return;
    }

    io.to(roomCode).emit("chat-message", { playerName, message });
  });

  function startRoundTimer(roomCode, word, io, roundTime) {
    let revealed = Array(word.length).fill("_");
    let interval = 1000;
    let timeLeft = roundTime;
    let revealIndexes = [];

    for (let i = 0; i < word.length; i++) revealIndexes.push(i);
    revealIndexes = revealIndexes.sort(() => Math.random() - 0.5);

    const intervalId = setInterval(() => {
      timeLeft--;
      rooms[roomCode].currentTimeLeft = timeLeft;

      if ((roundTime - timeLeft) % 20 === 0 && revealIndexes.length > 0) {
        const indexToReveal = revealIndexes.shift();
        revealed[indexToReveal] = word[indexToReveal];
        io.to(roomCode).emit("hint-reveal", revealed.join(" "));
      }

      io.to(roomCode).emit("timer-update", timeLeft);

      if (timeLeft <= 0) {
        clearInterval(intervalId);
        io.to(roomCode).emit("turn-ended");
      }
    }, interval);
  }
    // Emit 3 words to the drawer on their turn
  socket.on("start-turn", ({ roomCode }) => {
    const words = getRandomWords();
    io.to(socket.id).emit("choose-word", words); // Only send to the drawer
  });

  // Receive chosen word and notify others
  socket.on("word-chosen", ({ roomCode, word }) => {
    const displayWord = "_ ".repeat(word.length).trim();
    rooms[roomCode].currentWord = word;
    io.to(roomCode).emit("start-round", { displayWord });
  
    // Start the round timer
    startRoundTimer(roomCode, word, io, rooms[roomCode].settings.time || 60); // Default 60 seconds
  });


    // Add the drawing-data event listener
  socket.on("drawing-data", ({ roomCode, drawing }) => {
    socket.to(roomCode).emit("receive-drawing", { drawing });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Optional: remove from rooms
  });
});

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

server.listen(5000, () => {
  console.log("Server listening on port 5000");
});
