const canvas = document.getElementById("ludoCanvas");
const ctx = canvas.getContext("2d");

const bgImage = new Image();
bgImage.src = "Assets/bg.jpg";

const players = [
  {
    color: "Red",
    emoji: "🔴",
    homeX: 85,
    homeY: 85,
    tokenColor: "red",
    tokens: []
  },
  {
    color: "Blue",
    emoji: "🔵",
    homeX: 125,
    homeY: 435,
    tokenColor: "blue",
    tokens: []
  }
];

const pathCells = [
  { x: 230, y: 50 },  // Red start
  { x: 180, y: 50 },
  { x: 130, y: 50 },
  { x: 80, y: 50 },
  { x: 50, y: 80 },
  { x: 50, y: 130 },
  { x: 50, y: 180 },
  { x: 50, y: 230 },
  { x: 80, y: 260 },
  { x: 130, y: 260 },
  { x: 180, y: 260 },
  { x: 230, y: 260 },
  { x: 260, y: 230 },
  { x: 260, y: 180 },
  { x: 260, y: 130 },
  { x: 260, y: 80 },
  { x: 260, y: 50 },
  // 🔁 Keep adding till 52 cells done (full Ludo circle)
];



let currentPlayerIndex = 0;
let currentDice = 0;


bgImage.onload = () => {
  drawBoard();
  drawAllTokens();
  updateUI();
};

token.pathIndex = 0; // when leaving home
token.x = pathCells[0].x;
token.y = pathCells[0].y;

if (typeof token.pathIndex === "number") {
  token.pathIndex += currentDice;
  token.x = pathCells[token.pathIndex].x;
  token.y = pathCells[token.pathIndex].y;
}


function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  const player = players[currentPlayerIndex];
  ctx.strokeStyle = player.tokenColor;
  ctx.lineWidth = 4;
  ctx.strokeRect(player.homeX - 10, player.homeY - 10, 70, 70);
}

function rollDice() {
  currentDice = Math.floor(Math.random() * 6) + 1;
  document.getElementById("diceValue").innerText = `Dice: ${currentDice}`;

  const currentPlayer = players[currentPlayerIndex];

  // Simple move logic: if 6 and any token is inside home, move it out
  if (currentDice === 6) {
    const token = currentPlayer.tokens.find(t => isInHome(t, currentPlayer));
    if (token) {
      // Temporary starting cell (change later to actual path)
      token.x = currentPlayer.color === "Red" ? 150 : 150;
      token.y = currentPlayer.color === "Red" ? 50 : 400;
      drawBoard();
      drawAllTokens();
      return; // no turn change
    }
  }

  setTimeout(() => {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    drawBoard();
    drawAllTokens();
    updateUI();
  }, 1000);
}


function nextTurn() {
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateUI();
}

function updateUI() {
  const player = players[currentPlayerIndex];
  document.getElementById("turnInfo").innerText = `Turn: ${player.color} ${player.emoji}`;
}

// --- TOKENS SETUP ---

function drawAllTokens() {
  players.forEach((player) => {
    if (player.tokens.length === 0) {
      generateTokens(player);
    }
    drawTokens(player);
  });
}

// function generateTokens(player) {
//   const spacing = 30;
//   const radius = 10;
//   const x = player.homeX;
//   const y = player.homeY;

//   player.tokens.push({ x: x, y: y });
//   player.tokens.push({ x: x + spacing, y: y });
//   player.tokens.push({ x: x, y: y + spacing });
//   player.tokens.push({ x: x + spacing, y: y + spacing });
// }
function generateTokens(player) {
  const spacing = 25;
  const x = player.homeX;
  const y = player.homeY;

  player.tokens = [
    { x: x, y: y },
    { x: x + spacing, y: y },
    { x: x, y: y + spacing },
    { x: x + spacing, y: y + spacing }
  ];
}


function drawTokens(player) {
  player.tokens.forEach(token => {
    ctx.beginPath();
    ctx.arc(token.x, token.y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = player.tokenColor;
    ctx.fill();
    ctx.strokeStyle = "black";
    ctx.stroke();
  });
}

function isInHome(token, player) {
  return token.x >= player.homeX &&
         token.x <= player.homeX + 30 &&
         token.y >= player.homeY &&
         token.y <= player.homeY + 30;
}
