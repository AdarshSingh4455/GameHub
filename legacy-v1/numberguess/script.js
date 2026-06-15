let targetNumber;
let attempts;
let gameOver = false;
let timer;
let timeLeft = 45;
let currentMode = "medium"; // default

function startGame(mode) {
  currentMode = mode;

  if (mode === "easy") {
    attempts = 15;
    targetNumber = Math.floor(Math.random() * 150) + 1;
    document.getElementById("timer").style.display = "none";
  } else if (mode === "medium") {
    attempts = 10;
    targetNumber = Math.floor(Math.random() * 100) + 1;
    document.getElementById("timer").style.display = "none";
  } else if (mode === "hard") {
    attempts = Infinity; // no limit on attempts
    targetNumber = Math.floor(Math.random() * 100) + 1;
    document.getElementById("timer").style.display = "block";
    startTimer();
  }

  console.log("Target:", targetNumber);

  document.getElementById("number").style.display = "none";
  document.getElementById("cover").style.display = "flex";
  document.getElementById("hint").innerText = "";
  document.getElementById("guessInput").value = "";
  document.getElementById("guessInput").disabled = false;
  document.getElementById("number").classList.remove("glow");
  document.getElementById("attempts").innerText = isFinite(attempts) ? `Attempts left: ${attempts}` : `⏱ Time-based mode`;
  gameOver = false;

  // Hide modal
  document.getElementById("difficultyModal").style.display = "none";
}

function checkGuess() {
  if (gameOver) return;

  const guess = parseInt(document.getElementById("guessInput").value);
  const input = document.getElementById("guessInput");
  const numberBox = document.getElementById("number");

  if (!guess) return;

  // Decrement attempt if not in hard mode
  if (currentMode !== "hard") {
    attempts--;
    document.getElementById("attempts").innerText = `Attempts left: ${attempts}`;
  }

  if (guess === targetNumber) {
    document.getElementById("hint").innerText = "🎉 Correct Guess!";
    document.getElementById("cover").style.display = "none";
    numberBox.innerText = targetNumber;
    numberBox.style.display = "block";
    numberBox.classList.add("glow");
    input.disabled = true;
    gameOver = true;
    clearInterval(timer);
    launchConfetti();
  } else {
    document.getElementById("hint").innerText = guess < targetNumber ? "📉 Too Low!" : "📈 Too High!";
    document.getElementById("cover").classList.add("shake");
    setTimeout(() => {
      document.getElementById("cover").classList.remove("shake");
    }, 400);
  }

  // If no attempts left
  if (attempts === 0 && currentMode !== "hard" && guess !== targetNumber) {
    document.getElementById("hint").innerText = `❌ Out of attempts! The number was ${targetNumber}`;
    document.getElementById("cover").style.display = "none";
    numberBox.innerText = targetNumber;
    numberBox.style.display = "block";
    input.disabled = true;
    gameOver = true;
    clearInterval(timer);
  }
}

function startTimer() {
  clearInterval(timer);
  timeLeft = 45;
  document.getElementById("timeLeft").innerText = timeLeft;

  timer = setInterval(() => {
    if (gameOver) {
      clearInterval(timer);
      return;
    }

    timeLeft--;
    document.getElementById("timeLeft").innerText = timeLeft;

    if (timeLeft <= 0) {
      clearInterval(timer);
      document.getElementById("hint").innerText = `⏰ Time's up! The number was ${targetNumber}`;
      document.getElementById("cover").style.display = "none";
      document.getElementById("number").innerText = targetNumber;
      document.getElementById("number").style.display = "block";
      document.getElementById("guessInput").disabled = true;
      gameOver = true;
    }
  }, 1000);
}

function restartGame() {
  gameOver = false;
  clearInterval(timer);
  startGame(currentMode);
}

function launchConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  });
}

// Handle Enter key for submitting guess
document.getElementById("guessInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    e.preventDefault(); // Prevent default form submission
    checkGuess();
  }
});