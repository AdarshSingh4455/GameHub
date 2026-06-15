let gameMode = null;
const totalPairs = 12; 
const gameIcons = [
  'icons/icons8-user-100.png',
  'icons/icons8-caveman-100.png',
  'icons/nerd-hair.png',
  'icons/circle-user.gif',
  'icons/icons8-user-male.gif',
  'icons/icons8-person-female.gif',
  'icons/One.gif',
  'icons/two.gif'
];

let player1Icon = "";
let player2Icon = "";
let player1Name = "";
let player2Name = "";
let selectedCategory = '';
let flippedCards = [];
let matchedPairs = 0;
let currentPlayer = 1;
let player1Score = 0;
let player2Score = 0;

// Show loading screen for 2 seconds before displaying the main content
document.body.style.overflow = "hidden"; // Prevent scrolling during loading

const flipSound = new Audio("Assets/flip.mp3");
const matchSound = new Audio("Assets/match.mp3");
const winSound = new Audio("Assets/win.mp3");

function getRankByWins(wins) {
  if (wins >= 100) return "King 👑";
  if (wins >= 76) return "Pro";
  if (wins >= 51) return "Skilled";
  if (wins >= 31) return "Amateur";
  if (wins >= 16) return "Learner";
  if (wins >= 6) return "Beginner";
  return "Noob";
}


const emojiIcons = {
  Fruits: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍉', '🍋', '🍊', '🥭', '🍑'],
  Animals: ['🐶', '🐸', '🐵', '🐭', '🐹', '🐰', '🦊', '🐼', '🐨', '🐯', '🦁', '🐮'],
  Sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋'],
  Vehicles: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚜', '🚲', '🛴'],
  Food: ['🍔', '🍟', '🌭', '🍕', '🥪', '🌮', '🌯', '🥗', '🍿', '🍩', '🍪', '🎂'],
  Weather: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌪️']
};


document.addEventListener("DOMContentLoaded", function () {
  const loader = document.getElementById("loadingScreen");
  const container = document.getElementById("pageContainer");

  const username = new URLSearchParams(window.location.search).get("username");
  if (username) {
    const p1NameInput = document.getElementById("player1Name");
    if (p1NameInput) p1NameInput.value = username;
  }

  setTimeout(() => {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.display = "none";
      container.style.display = "block";
    }, 500);
  }, 2000);
});

function selectMode(mode) {
  if (mode === "Computer") {
    const username = new URLSearchParams(window.location.search).get("username") || "";
    window.location.href = `index2.html?username=${encodeURIComponent(username)}`;
  } else {
    gameMode = mode;
    document.getElementById("modeSelection").style.display = "none";
    document.getElementById("nameInput").style.display = "flex";

    document.getElementById("player2Name").value = "";
    document.getElementById("player2Name").disabled = false;
  }
}


function nextToIcons() {
  player1Name = document.getElementById("player1Name").value.trim() || "Player 1";
  player2Name = document.getElementById("player2Name").value.trim() || "Player 2";

  document.getElementById("player1NameDisplay").textContent = player1Name;
  document.getElementById("player2NameDisplay").textContent = player2Name;


  if (!player1Name) player1Name = "Player 1";
  if (!player2Name) player2Name = "Player 2";

  console.log("Player1:", player1Name, "| Player2:", player2Name);
  console.log("Names Set:", player1Name, player2Name);



  if (!player1Name || !player2Name) {
    alert("Please enter both names.");
    return;
  }

  player1Icon = "";
  player2Icon = "";

  document.getElementById("nameInput").style.display = "none";
  document.getElementById("iconSelection").style.display = "block";

  const p1Div = document.getElementById("player1Icons");
  const p2Div = document.getElementById("player2Icons");
  p1Div.innerHTML = "";
  p2Div.innerHTML = "";

  gameIcons.forEach(icon => {
    const img1 = document.createElement("img");
    img1.src = icon;
    img1.onclick = () => selectIcon('player1', icon);
    p1Div.appendChild(img1);

    const img2 = document.createElement("img");
    img2.src = icon;
    img2.onclick = () => selectIcon('player2', icon);
    p2Div.appendChild(img2);
  });
}

function selectIcon(player, icon) {
  if (player === 'player1') {
    if (player2Icon && icon === player2Icon) {
      alert("Choose a different icon than Player 2.");
      return;
    }
    player1Icon = icon;
    document.querySelectorAll('#player1Icons img').forEach(img => img.classList.remove('selected'));
    const selectedImg = [...document.querySelectorAll('#player1Icons img')].find(img => img.src.includes(icon));
    if (selectedImg) selectedImg.classList.add('selected');
  } else {
    if (player1Icon && icon === player1Icon) {
      alert("Choose a different icon than Player 1.");
      return;
    }
    player2Icon = icon;
    document.querySelectorAll('#player2Icons img').forEach(img => img.classList.remove('selected'));
    const selectedImg = [...document.querySelectorAll('#player2Icons img')].find(img => img.src.includes(icon));
    if (selectedImg) selectedImg.classList.add('selected');
  }
}

function goToCategory() {
  if (!player1Icon || !player2Icon) {
    alert("Please select icons for both players.");
    return;
  }

  document.getElementById("iconSelection").style.display = "none";
  document.getElementById("categorySelection").style.display = "block";
}

function selectCategory(category) {
  selectedCategory = category;

  document.getElementById("categorySelection").style.display = "none";
  document.getElementById("scoreboard").style.display = "block";
  document.getElementById("gameBoard").style.display = "grid";

  startGame();
}

function startGame() {
  // Reset scores and state
  matchedPairs = 0;
  player1Score = 0;
  player2Score = 0;
  currentPlayer = 1;
  flippedCards = [];

  // Show UI sections
  document.getElementById("categorySelection").style.display = "none";
  document.getElementById("scoreboard").style.display = "flex";
  document.getElementById("gameBoard").style.display = "grid";

  // Display names and scores
  document.getElementById("player1NameDisplay").textContent = player1Name;
  document.getElementById("player2NameDisplay").textContent = player2Name;
  document.getElementById("player1Score").textContent = "0";
  document.getElementById("player2Score").textContent = "0";

  // Set user icons
  document.getElementById("player1IconDisplay").src = player1Icon;
  document.getElementById("player2IconDisplay").src = player2Icon;

  // Set player badges
  const leaderboard = JSON.parse(localStorage.getItem('memoryGameLeaderboard')) || [];
  const player1 = leaderboard.find(p => p.name === player1Name) || { gamesWon: 0 };
  const player2 = leaderboard.find(p => p.name === player2Name) || { gamesWon: 0 };
  setPlayerBadges(player1.gamesWon, player2.gamesWon);



  // Highlight active player
  updateTurnHighlight();

  // Start the game logic (render cards etc.)
  initGame();

  document.getElementById("progressBar").style.display = "block";
  document.getElementById("progressFill").style.width = "0%";
}

function initGame() {
  const icons = emojiIcons[selectedCategory] || emojiIcons["Fruits"];
  const gamePairs = [...icons, ...icons]; // duplicate icons
  shuffle(gamePairs);

  const gameBoard = document.getElementById("gameBoard");
  gameBoard.innerHTML = "";

  gamePairs.forEach((icon, index) => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.icon = icon;
    card.dataset.index = index;
    card.addEventListener("click", handleCardClick);
    gameBoard.appendChild(card);
  });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function updateLiveProgress() {
  const percent = (matchedPairs / totalPairs) * 100;
  document.getElementById("progressFill").style.width = `${percent}%`;
}


function handleCardClick(e) {
  const card = e.target;

  if (card.classList.contains("flipped") || card.classList.contains("matched")) return;

  if (soundOn) flipSound.play();
  card.classList.add("flipped");
  card.textContent = card.dataset.icon;
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    const [c1, c2] = flippedCards;

    if (c1.dataset.icon === c2.dataset.icon) {
      if (soundOn) matchSound.play();
      c1.classList.add("matched");
      c2.classList.add("matched");
      matchedPairs++;

      // Score update
      if (currentPlayer === 1) {
        player1Score++;
        document.getElementById("player1Score").textContent = "Player 1: " + player1Score;
      } else {
        player2Score++;
        document.getElementById("player2Score").textContent = "Player 2: " + player2Score;
      }
      updateLiveProgress();
      pulseBackground(); 

      // Win condition
      if (matchedPairs === totalPairs && !document.getElementById("popup").style.display.includes("block")) {
        if (soundOn) winSound.play();
        const winner = getWinner();
        showPopup(`${winner} wins! 🎉`);
      }


    } else {
      setTimeout(() => {
        c1.classList.remove("flipped");
        c1.textContent = "";
        c2.classList.remove("flipped");
        c2.textContent = "";

        // Switch player turn
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        updateTurnHighlight();
      }, 1000);

    }

    flippedCards = [];
  }
}

function pulseBackground() {
  const colors = ['#121212', '#1a1a1a', '#222', '#2a2a2a', '#1c1c1c', '#141414'];
  const newColor = colors[matchedPairs % colors.length];

  document.body.style.backgroundColor = newColor;
}

function getWinner() {
  if (player1Score > player2Score) return player1Name;
  else if (player2Score > player1Score) return player2Name;
  else return "No one! It's a Tie";
}

function showPopup(message) {
  document.getElementById("popupMessage").textContent = message;
  document.getElementById("popup").style.display = "block";

  const winner = getWinner().replace(" wins!", "");
  let gameResult = 'draw';
  if (winner === player1Name) {
    gameResult = 'win';
  } else if (winner === player2Name) {
    gameResult = 'loss';
  }

  if (window.parent) {
    window.parent.postMessage({
      type: "game_over",
      gameSlug: "memory",
      result: gameResult,
      score: player1Score,
      metadata: {
        player1: player1Name,
        player2: player2Name,
        winner: winner,
      }
    }, window.location.origin);
  }

  // 🧠 History Save
  const history = JSON.parse(localStorage.getItem("memoryGameHistory")) || [];
  history.unshift({
    player1: player1Name,
    player2: player2Name,
    winner: getWinner().replace(" wins!", ""),
    date: new Date().toLocaleString(),
  });
  localStorage.setItem("memoryGameHistory", JSON.stringify(history.slice(0, 100)));

  // 🏆 Leaderboard Save
  let leaderboard = JSON.parse(localStorage.getItem("memoryGameLeaderboard")) || [];

  function updatePlayer(name, won) {
    let player = leaderboard.find(p => p.name === name);
    if (!player) {
      player = { name: name, gamesPlayed: 0, gamesWon: 0 };
      leaderboard.push(player);
    }
    player.gamesPlayed++;
    if (won) player.gamesWon++;
  }

  const winner = getWinner().replace(" wins!", "");
  if (winner === player1Name) {
    updatePlayer(player1Name, true);
    updatePlayer(player2Name, false);
  } else if (winner === player2Name) {
    updatePlayer(player2Name, true);
    updatePlayer(player1Name, false);
  } else {
    updatePlayer(player1Name, false);
    updatePlayer(player2Name, false);
  }

  localStorage.setItem("memoryGameLeaderboard", JSON.stringify(leaderboard));
}

function resetGame() {
  location.reload();
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

let soundOn = true;

function toggleMenu() {
  const overlay = document.getElementById('menuOverlay');
  overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
}

function toggleSound() {
  soundOn = !soundOn;
  document.getElementById('soundStatus').textContent = soundOn ? 'On' : 'Off';
  // Agar sound effects lage ho toh unko mute karo yahan
  // flipSound.muted = !soundOn;
  // matchSound.muted = !soundOn;
  // winSound.muted = !soundOn;
}

function exitGame() {
  location.reload();
}

//extra
function closePopup() {
  document.getElementById("popup").style.display = "none";
  resetGame();
}

function goToRanking() {
  const rankList = document.getElementById("rankList");
  rankList.innerHTML = "";

  const leaderboard = JSON.parse(localStorage.getItem('memoryGameLeaderboard')) || [];

  leaderboard.forEach(player => {
    const rank = getRankByWins(player.gamesWon);
    const box = document.createElement("div");
    box.className = "rank-box";

    const cap = player.gamesWon >= 100 ? 100 : 
                player.gamesWon >= 76 ? 100 :
                player.gamesWon >= 51 ? 75 :
                player.gamesWon >= 31 ? 50 :
                player.gamesWon >= 16 ? 30 :
                player.gamesWon >= 6  ? 15 : 5;

    const progress = Math.min((player.gamesWon / cap) * 100, 100);

    box.innerHTML = `
      <strong>${player.name}</strong><br/>
      Rank: ${rank} | Wins: ${player.gamesWon}<br/>
      <div class="rank-progress-bar">
        <div class="rank-progress-fill" style="width: ${progress}%"></div>
      </div>
    `;
    rankList.appendChild(box);
  });

  document.getElementById("rankModal").style.display = "block";
}

function closeRankModal() {
  document.getElementById("rankModal").style.display = "none";
}

function setPlayerBadges(p1Wins = 0, p2Wins = 0) {
  document.getElementById("badge1").textContent = getRankByWins(p1Wins);
  document.getElementById("badge2").textContent = getRankByWins(p2Wins);
}

function resetHistory() {
  if (confirm("Are you sure you want to delete all game history?")) {
    localStorage.removeItem("memoryGameHistory");
    localStorage.removeItem("memoryGameLeaderboard");
    alert("History & Leaderboard reset!");
    location.reload();
  }
}

function goBack() {
  window.location.href = "index.html"; // or gameHub.html if you have a hub
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

function playAgain() {
  document.getElementById("popup").style.display = "none";
  matchedPairs = 0;
  player1Score = 0;
  player2Score = 0;
  currentPlayer = 1;
  flippedCards = [];

  updateScore();
  updateTurnHighlight();

  // Clear previous board
  const gameBoard = document.getElementById("gameBoard");
  gameBoard.innerHTML = ""; // remove old cards

  document.getElementById("progressFill").style.width = "0%";

  initGame(); // rebuild board with same players/category
}

function updateScore() {
  document.getElementById("player1Score").textContent = player1Score;
  document.getElementById("player2Score").textContent = player2Score;
}


function quitGame() {
  window.location.href = "index.html"; // or your home page
}

