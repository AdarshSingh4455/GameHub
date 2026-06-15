// Seeded PRNG and Level Generator from WaterConnectGame.tsx
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function getSeededRandom(seedStr) {
  let h1 = 1779033703, h2 = 3024733165, h3 = 3362453659, h4 = 50249325
  for (let i = 0; i < seedStr.length; i++) {
    const k = seedStr.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  return mulberry32((h1 ^ h2 ^ h3 ^ h4) >>> 0)
}

const GRID_SIZES = {
  easy: 4,
  medium: 5,
  hard: 6,
  expert: 7,
  pro: 8,
}

function generateFlowPuzzle(difficulty, levelNum) {
  const size = GRID_SIZES[difficulty]
  const rng = getSeededRandom(`wc-flow-${difficulty}-${levelNum}`)
  
  const ALL_COLORS = [
    'hsl(0 100% 50%)',     // Red
    'hsl(215 100% 50%)',   // Blue
    'hsl(142 80% 45%)',    // Green
    'hsl(48 100% 50%)',    // Yellow
    'hsl(280 95% 55%)',    // Purple
    'hsl(28 100% 50%)',    // Orange
    'hsl(180 100% 45%)',   // Cyan
    'hsl(325 100% 50%)',   // Magenta
    'hsl(90 90% 45%)',     // Lime
    'hsl(15 90% 40%)',     // Brown
  ]

  let attempts = 0
  while (attempts < 3000) {
    attempts++
    const grid = Array.from({ length: size }, () => Array(size).fill(-1))
    const paths = []
    let pathId = 0

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== -1) continue

        const currentPath = [[r, c]]
        grid[r][c] = pathId
        let curR = r
        let curC = c
        let len = 1

        while (true) {
          const neighbors = []
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
          for (const [dr, dc] of dirs) {
            const nr = curR + dr
            const nc = curC + dc
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] === -1) {
              neighbors.push([nr, nc])
            }
          }

          if (neighbors.length === 0) break
          if (len >= 2 && rng() < 0.22) break // probability to stop growing

          const [nr, nc] = neighbors[Math.floor(rng() * neighbors.length)]
          currentPath.push([nr, nc])
          grid[nr][nc] = pathId
          curR = nr
          curC = nc
          len++
        }

        paths.push(currentPath)
        pathId++
      }
    }

    // Attempt to merge isolated single-cell paths
    const len1Paths = paths.filter(p => p.length === 1)
    const validPaths = paths.filter(p => p.length > 1)
    let mergeFailed = false

    for (const p1 of len1Paths) {
      const cell = p1[0]
      let merged = false

      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      const rngNeighbors = dirs.map(([dr, dc]) => [cell[0] + dr, cell[1] + dc])
        .filter(([nr, nc]) => nr >= 0 && nr < size && nc >= 0 && nc < size)

      for (const [nr, nc] of rngNeighbors) {
        const parentPath = validPaths.find(p => 
          (p[0][0] === nr && p[0][1] === nc) || 
          (p[p.length - 1][0] === nr && p[p.length - 1][1] === nc)
        )

        if (parentPath) {
          if (parentPath[0][0] === nr && parentPath[0][1] === nc) {
            parentPath.unshift(cell)
          } else {
            parentPath.push(cell)
          }
          merged = true
          break
        }
      }

      if (!merged) {
        mergeFailed = true
        break
      }
    }

    if (!mergeFailed && validPaths.length > 0) {
      const minColors = Math.max(3, Math.floor(size * 0.8))
      const maxColors = Math.min(ALL_COLORS.length, Math.floor(size * 1.3))
      if (validPaths.length >= minColors && validPaths.length <= maxColors) {
        const colors = [...ALL_COLORS.slice(0, validPaths.length)]
        for (let i = colors.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [colors[i], colors[j]] = [colors[j], colors[i]]
        }

        const dots = []
        validPaths.forEach((path, idx) => {
          const start = path[0]
          const end = path[path.length - 1]
          const color = colors[idx]
          dots.push({ r: start[0], c: start[1], color, id: idx })
          dots.push({ r: end[0], c: end[1], color, id: idx })
        })

        return { size, colors, dots, solvedPaths: validPaths }
      }
    }
  }

  // Fallback
  const colors = ALL_COLORS.slice(0, size)
  const dots = []
  const solvedPaths = []
  for (let r = 0; r < size; r++) {
    const path = []
    for (let c = 0; c < size; c++) {
      path.push([r, c])
    }
    solvedPaths.push(path)
    dots.push({ r, c: 0, color: colors[r], id: r })
    dots.push({ r, c: size - 1, color: colors[r], id: r })
  }
  return { size, colors, dots, solvedPaths }
}

const puzzle = generateFlowPuzzle('easy', 1);
console.log('Puzzle dots:', JSON.stringify(puzzle.dots, null, 2));
console.log('Solved paths:', JSON.stringify(puzzle.solvedPaths, null, 2));
