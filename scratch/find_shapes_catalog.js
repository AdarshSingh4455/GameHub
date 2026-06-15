import fs from 'fs';

const content = fs.readFileSync('./src/components/games/BlockBlastGame.tsx', 'utf8');
const lines = content.split('\n');

console.log('--- grid references ---');
lines.forEach((line, index) => {
  if (line.includes('.grid')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});

console.log('--- setPieces references ---');
lines.forEach((line, index) => {
  if (line.includes('setPieces')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
