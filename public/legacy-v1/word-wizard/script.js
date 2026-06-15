const levelData = {
  grid: [
    ['B','I','R','D'],
    ['A','N','O','L'],
    ['C','T','E','S'],
    ['H','U','G','E']
  ],
  targetWords: ['BIRD', 'CUTE', 'HUG']
};
const allLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Random words (can be replaced with a proper API/dictionary logic later)
const sampleWords = ['TIME', 'LOVE', 'HUGE', 'NOTE', 'CUTE', 'HUG', 'BIRD', 'RING','HAT', 'TREE'];
const gridSize = 4;
let score = 0, timer, timeLeft = 60;
const gridEl = document.getElementById('grid');
const wordListEl = document.getElementById('wordList');
let selectedCells = [], selectedLetters = [], foundWords = new Set();
let isSelecting = false;

function newGame() {
  const { grid, words } = generateSmartGrid();
  levelData.grid = grid;
  levelData.targetWords = words;

  foundWords.clear();
  score = 0;
  timeLeft = 60;
  document.getElementById('scoreBoard').textContent = `Score: ${score} | Time: ${timeLeft}s`;
  clearInterval(timer);
  startTimer();
  renderGrid();
  renderWords();
}

// Helper to get a random word of a specific length
function getWord(length) {
  const candidates = sampleWords.filter(w => w.length === length);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

  // Generate a random 4x4 grid
function generateRandomGrid() {
  const grid = [];
  for (let i = 0; i < 4; i++) {
    grid.push([]);
    for (let j = 0; j < 4; j++) {
      const randIndex = Math.floor(Math.random() * allLetters.length);
      grid[i].push(allLetters[randIndex]);
    }
  }
  return grid;
}
function startTimer() {
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById('scoreBoard').textContent = `Score: ${score} | Time: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      alert(`⏰ Time’s up! Final Score: ${score}`);
    }
  }, 1000);
}

// Main function to generate grid with diagonally placed words
function generateSmartGrid() {
  let grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(''));
  let placedWords = [];

  // Place first word: top-left to bottom-right
  let word1 = getWord(gridSize);
  for (let i = 0; i < gridSize; i++) {
    grid[i][i] = word1[i];
  }
  placedWords.push(word1);

  // Place second word: top-right to bottom-left
  let word2 = getWord(gridSize);
  for (let i = 0; i < gridSize; i++) {
    grid[i][gridSize - 1 - i] = word2[i];
  }
  placedWords.push(word2);

  // Place third word: diagonal offset starting from (0,1) ➡️ (3,2)
  let word3 = getWord(gridSize);
  for (let i = 0; i < gridSize; i++) {
    const row = i;
    const col = (i + 1) % gridSize;
    grid[row][col] = word3[i];
  }
  placedWords.push(word3);

  // Fill the remaining cells randomly
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!grid[r][c]) {
        const randLetter = allLetters[Math.floor(Math.random() * allLetters.length)];
        grid[r][c] = randLetter;
      }
    }
  }

    return { grid, words: placedWords };
}
function renderGrid() {
  gridEl.innerHTML = '';
  levelData.grid.forEach((row, rIdx) => {
    row.forEach((letter, cIdx) => {
      const cell = document.createElement('div');
      cell.textContent = letter;
      cell.classList.add('grid-cell');
      cell.dataset.row = rIdx;
      cell.dataset.col = cIdx;
      gridEl.appendChild(cell);
    });
  });
}

function findWordsInGrid(grid) {
  const letters = grid.flat().join('');
  return sampleWords.filter(word =>
    word.split('').every(letter => letters.includes(letter))
  ).slice(0, 5);
}

function renderWords() {
  wordListEl.innerHTML = '';
  levelData.targetWords.forEach(word => {
    const el = document.createElement('div');
    el.textContent = word;
    el.classList.add('word-item', `word-${word}`);
    wordListEl.appendChild(el);
  });
}

function getCellFromEvent(e) {
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  const el = document.elementFromPoint(clientX, clientY);
  return el?.classList.contains('grid-cell') ? el : null;
}

function getCellPos(cell) {
  return {
    row: parseInt(cell.dataset.row),
    col: parseInt(cell.dataset.col)
  };
}

function isAdjacent(c1, c2) {
  const a = getCellPos(c1), b = getCellPos(c2);
  const dr = Math.abs(a.row - b.row), dc = Math.abs(a.col - b.col);
  return (dr <= 1 && dc <= 1 && !(dr === 0 && dc === 0));
}

function selectCell(cell) {
  if (!cell || selectedCells.includes(cell)) return;
  if (selectedCells.length && !isAdjacent(selectedCells[selectedCells.length - 1], cell)) return;
  selectedCells.push(cell);
  selectedLetters.push(cell.textContent);
  cell.classList.add('selected');
}

function clearSelection() {
  selectedCells.forEach(cell => cell.classList.remove('selected'));
  selectedCells = [];
  selectedLetters = [];
}

function resetSelection(onlyClear = false) {
  if (!onlyClear) clearSelection();
  selectedLetters = [];
  selectedCells = [];
}

function wrongWordEffect() {
  selectedCells.forEach(cell => cell.classList.add("wrong"));
  if (navigator.vibrate) navigator.vibrate(200);
  setTimeout(() => {
    selectedCells.forEach(cell => cell.classList.remove("wrong", "selected"));
    resetSelection(true);
  }, 500);
}

// Boost checkWordValidity to update score
function checkWordValidity(word, cells) {
  if (levelData.targetWords.includes(word) && !foundWords.has(word)) {
    foundWords.add(word);
    score += word.length * 10; // score = 10 points per letter
    document.getElementById('scoreBoard').textContent = `Score: ${score} | Time: ${timeLeft}s`;
    cells.forEach(cell => {
      cell.classList.remove('selected');
      cell.classList.add('permanent');
    });
    const wordEl = document.querySelector(`.word-${word}`);
    if (wordEl) wordEl.style.textDecoration = "line-through";
    resetSelection(true);
  } else {
    wrongWordEffect();
  }
}


function finalizeWord() {
  const word = selectedLetters.join('');
  if (word.length >= 3) checkWordValidity(word, selectedCells);
  else wrongWordEffect();
}

gridEl.addEventListener('mousedown', e => {
  e.preventDefault();
  clearSelection();
  isSelecting = true;
  selectCell(getCellFromEvent(e));
});

gridEl.addEventListener('touchstart', e => {
  e.preventDefault();
  clearSelection();
  isSelecting = true;
  selectCell(getCellFromEvent(e));
}, { passive: false });

gridEl.addEventListener('mousemove', e => {
  if (!isSelecting) return;
  selectCell(getCellFromEvent(e));
});

gridEl.addEventListener('touchmove', e => {
  if (!isSelecting) return;
  selectCell(getCellFromEvent(e));
}, { passive: false });

window.addEventListener('mouseup', () => {
  if (!isSelecting) return;
  isSelecting = false;
  finalizeWord();
});

window.addEventListener('touchend', () => {
  if (!isSelecting) return;
  isSelecting = false;
  finalizeWord();
});

// New Game Button
document.getElementById('newGameBtn').addEventListener('click', newGame);
// INIT
renderGrid();
renderWords();
