function rotateGrid(grid) {
  const H = grid.length
  const W = grid[0].length
  const newGrid = Array.from({ length: W }, () => Array(H).fill(0))
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      newGrid[c][H - 1 - r] = grid[r][c]
    }
  }
  return newGrid
}

const original = [[1, 1], [1, 0]];
const rotated = rotateGrid(original);

console.log("Original:");
console.log(original);
console.log("Rotated CW:");
console.log(rotated);
