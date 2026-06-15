import { SHAPES_CATALOG } from '../src/lib/blockBlastShapes.ts';
import { placePiece, createEmptyBoard } from '../src/lib/BlockBlastEngine.ts';

console.log('Starting automated Block Blast shape alignment verification...');
let errors = 0;

for (const piece of SHAPES_CATALOG) {
  console.log(`Checking piece: ${piece.name} (${piece.id})`);

  // 1. Audit Shape Definitions
  const gridRows = piece.grid.length;
  const gridCols = piece.grid[0].length;
  
  if (gridRows !== piece.height) {
    console.error(`  [ERROR] Shape height mismatch: definition height is ${piece.height}, grid has ${gridRows} rows.`);
    errors++;
  }
  if (gridCols !== piece.width) {
    console.error(`  [ERROR] Shape width mismatch: definition width is ${piece.width}, grid has ${gridCols} columns.`);
    errors++;
  }

  const calculatedBlocksCount = piece.grid.reduce((sum, row) => sum + row.filter(val => val === 1).length, 0);
  if (calculatedBlocksCount !== piece.blocksCount) {
    console.error(`  [ERROR] blocksCount mismatch: definition blocksCount is ${piece.blocksCount}, grid has ${calculatedBlocksCount} active cells.`);
    errors++;
  }

  // 2. Validate Coordinate Matching
  // Simulate placement at (0, 0)
  const board = createEmptyBoard();
  const startRow = 0;
  const startCol = 0;

  // Calculate preview highlights formula cells
  const previewCells = [];
  for (let r = 0; r < piece.grid.length; r++) {
    for (let c = 0; c < piece.grid[r].length; c++) {
      if (piece.grid[r][c] === 1) {
        previewCells.push(`${startRow + r},${startCol + c}`);
      }
    }
  }

  // Calculate committed cells from placing piece
  const { nextBoard } = placePiece(board, piece, startRow, startCol);
  const committedCells = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (nextBoard[r][c] !== null) {
        committedCells.push(`${r},${c}`);
      }
    }
  }

  // Compare sets
  const previewSet = new Set(previewCells);
  const committedSet = new Set(committedCells);

  if (previewSet.size !== committedSet.size) {
    console.error(`  [ERROR] Cell counts mismatch: preview highlights ${previewSet.size} cells, but committed board has ${committedSet.size} cells.`);
    errors++;
  }

  for (const cell of previewSet) {
    if (!committedSet.has(cell)) {
      console.error(`  [ERROR] Cell mismatch: cell ${cell} was highlighted in preview, but not committed to board.`);
      errors++;
    }
  }

  for (const cell of committedSet) {
    if (!previewSet.has(cell)) {
      console.error(`  [ERROR] Cell mismatch: cell ${cell} was committed to board, but not highlighted in preview.`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ Verification failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log('\n✅ Verification succeeded! All Block Blast shapes, preview coordinates, and committed cells align perfectly.');
  process.exit(0);
}
