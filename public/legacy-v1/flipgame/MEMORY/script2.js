const aiTurnSound = new Audio("Assets/ai-start.mp3"); // ✅ apne sound path
const flipSound = new Audio("Assets/flip.mp3");
const matchSound = new Audio("Assets/match.mp3");
const winSound = new Audio("Assets/win.mp3");
let soundOn = true;
let difficulty = "Normal";
let aiStats = JSON.parse(localStorage.getItem("aiStats")) || { games: 0, wins: 0 };

let playerName = "";
let selectedCategory = "";
let currentPlayer = 1;
let player1Score = 0;
let player2Score = 0;
let matchedPairs = 0;
const totalPairs = 12;
let flippedCards = [];
let aiMemory = {}; // 🧠 key = emoji, value = [index1, index2]

const emojiIcons = {
  Fruits: ['🍎', '🍌', '🍇', '🍓', '🍍', '🍉', '🍒', '🍋', '🥭', '🍑', '🍈', '🥝'],
  Animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🐸'],
  Sports: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥊','🥋','🏓','🏸','⛳'],
  Vehicles: ['🚗','🚕','🚌','🚎','🏎️','🚓','🚑','🚒','🚛','🚜','🚂','✈️'],
  Food: ['🍔','🍟','🌭','🍕','🥪','🌮','🍩','🎂','🍜','🍝','🥗','🍣'],
  Weather: ['☀️','🌤️','🌧️','⛈️','🌩️','❄️','🌪️','☁️','🌈','🌫️','💨','🌦️']
};


document.addEventListener("DOMContentLoaded", () => {
  let dots = document.getElementById("dots");
  let count = 0;
  const dotInterval = setInterval(() => {
    count = (count + 1) % 4;
    dots.textContent = '.'.repeat(count || 1);
  }, 500);

  setTimeout(() => {
    clearInterval(dotInterval);
    document.getElementById("loadingScreen").style.display = "none";
    document.getElementById("mainUI").style.display = "block";
    document.getElementById("startAIButton").addEventListener("click", startAISetup);
  }, 2500); // 2.5 seconds loading
});

function startAISetup() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Enter your name!");
  difficulty = document.getElementById("difficultySelect").value;

  document.getElementById("player1NameDisplay").textContent = playerName;
  document.getElementById("nameInput").style.display = "none";

  document.getElementById("categorySelection").style.display = "block";

  document.getElementById("progressBar").style.display = "block";

  startGame();
}

function startGame() {
  matchedPairs = 0;
  player1Score = 0;
  player2Score = 0;
  currentPlayer = 1;
  aiMemory = {};
  flippedCards = [];

  updateScore();
  updateTurnHighlight();

  const gameBoard = document.getElementById("gameBoard");
  gameBoard.innerHTML = "";

  const icons = emojiIcons[selectedCategory];
  const gamePairs = [...icons, ...icons];
  shuffle(gamePairs);

  gamePairs.forEach((icon, index) => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.icon = icon;
    card.dataset.index = index;
    card.textContent = "";
    card.addEventListener("click", handleCardClick);
    gameBoard.appendChild(card);
  });

  updateLiveProgress();
  if (currentPlayer === 2) computerTurn();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function handleCardClick(e) {
  const card = e.target;
  if (currentPlayer !== 1 || card.classList.contains("flipped") || card.classList.contains("matched")) return;

  flipCard(card);
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    checkMatch();
  }
}

function flipCard(card) {
  card.classList.add("flipped");
  card.textContent = card.dataset.icon;
    if (soundOn) flipSound.play(); // 🔊 sound when card is flipped
}

function unflipCards(cards) {
  cards.forEach(card => {
    card.classList.remove("flipped");
    card.textContent = "";
  });
}

function markAsMatched(cards) {
  cards.forEach(card => {
    card.classList.add("matched");
  });
}

function checkMatch() {
  const [c1, c2] = flippedCards;
  const icon1 = c1.dataset.icon;
  const icon2 = c2.dataset.icon;

  // Update AI Memory
  rememberCard(c1);
  rememberCard(c2);

  if (icon1 === icon2) {
    markAsMatched([c1, c2]);
    matchedPairs++;
    if (soundOn) matchSound.play(); // 🔊 sound when cards match

    if (currentPlayer === 1) {
      player1Score++;
    } else {
      player2Score++;
    }

    updateScore();
    updateLiveProgress();

    if (matchedPairs === totalPairs) return endGame();

    flippedCards = [];
    if (currentPlayer === 2) setTimeout(computerTurn, 800);
  } else {
    setTimeout(() => {
      unflipCards([c1, c2]);
      flippedCards = [];
      switchPlayer();
    }, 1000);
  }
}

function rememberCard(card) {
  const icon = card.dataset.icon;
  const index = parseInt(card.dataset.index);
  if (!aiMemory[icon]) aiMemory[icon] = [];
  if (!aiMemory[icon].includes(index)) aiMemory[icon].push(index);
}

function switchPlayer() {
  currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTurnHighlight();
  if (currentPlayer === 2) setTimeout(computerTurn, 800);
}

function computerTurn() {
  document.getElementById("aiThinking").style.display = "block";
  if (soundOn) aiTurnSound.play();

  setTimeout(() => {
    document.getElementById("aiThinking").style.display = "none";

    const cards = document.querySelectorAll(".card:not(.flipped):not(.matched)");
    let toFlip = [];

    if (difficulty === "Hard" || difficulty === "Normal") {
      for (const [emoji, indexes] of Object.entries(aiMemory)) {
        const available = indexes.filter(i => {
          const c = document.querySelector(`.card[data-index="${i}"]`);
          return c && !c.classList.contains("flipped") && !c.classList.contains("matched");
        });

        if (available.length >= 2) {
          toFlip = available.slice(0, 2);
          break;
        }
      }
    }

    // Easy mode or no match known
    if (toFlip.length < 2) {
      const unseen = [...cards].map(c => parseInt(c.dataset.index));
      toFlip = unseen.sort(() => 0.5 - Math.random()).slice(0, 2);
    }

    const [card1, card2] = toFlip.map(i => document.querySelector(`.card[data-index="${i}"]`));
    if (card1 && card2) {
      flipCard(card1);
      if (difficulty !== "Easy") rememberCard(card1);

      setTimeout(() => {
        flipCard(card2);
        if (difficulty !== "Easy") rememberCard(card2);
        flippedCards = [card1, card2];
        setTimeout(checkMatch, 700);
      }, 700);
    }
  }, 1200);
}

function updateScore() {
  document.getElementById("player1Score").textContent = player1Score;
  document.getElementById("player2Score").textContent = player2Score;
}

function updateLiveProgress() {
  const percent = (matchedPairs / totalPairs) * 100;
  document.getElementById("progressFill").style.width = `${percent}%`;
}

function endGame() {
  let msg = "";
  aiStats.games++;

  if (player1Score > player2Score) {
    msg = `${playerName} wins! 🎉`;
  } else if (player2Score > player1Score) {
    msg = `Computer wins! 🤖`;
    aiStats.wins++;
  } else {
    msg = `It's a tie!`;
  }

  localStorage.setItem("aiStats", JSON.stringify(aiStats));
  msg += `\nComputer Win %: ${((aiStats.wins / aiStats.games) * 100).toFixed(1)}%`;

  document.getElementById("popupMessage").textContent = msg;
  document.getElementById("popup").style.display = "block";
}


function selectCategory(category) {
  selectedCategory = category;

  document.getElementById("categorySelection").style.display = "none";
  document.getElementById("scoreboard").style.display = "flex";
  document.getElementById("gameBoard").style.display = "grid";
  document.getElementById("progressBar").style.display = "block";

  startGame();
}
function closePopup() {
  document.getElementById("popup").style.display = "none";
  startGame();
}

function updateTurnHighlight() {
  const p1 = document.getElementById("player1Display");
  const p2 = document.getElementById("player2Display");

  p1.classList.remove("active");
  p2.classList.remove("active");

  if (currentPlayer === 1) {
    p1.classList.add("active");
  } else {
    p2.classList.add("active");
  }
}
function exitGame() {
  location.reload();
}
function goBack() {
  window.location.href = "index.html"; // or gameHub.html if you have a hub
}
function toggleSound() {
  soundOn = !soundOn;
  document.getElementById("soundStatus").textContent = soundOn ? "On" : "Off";
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      alert(`Error attempting fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
}
