export function calculatePlacementScore(blocksCount: number): number {
  return blocksCount * 10
}

export function calculateLineClearScore(linesCount: number): number {
  if (linesCount <= 0) return 0
  if (linesCount === 1) return 100
  if (linesCount === 2) return 250
  if (linesCount === 3) return 400
  if (linesCount === 4) return 600
  return 800 // 5+ lines
}

export function calculateComboBonus(comboChain: number): number {
  if (comboChain <= 0) return 0
  return 50 * comboChain
}

export function calculateCoinsEarned(
  score: number,
  difficulty: 'easy' | 'normal' | 'hard',
  maxCombo: number
): number {
  const baseCoins = Math.floor(score / 100)
  const comboBonus = maxCombo * 5
  const diffMultiplier = difficulty === 'hard' ? 2.0 : difficulty === 'normal' ? 1.5 : 1.0
  const coins = Math.floor((baseCoins + comboBonus) * diffMultiplier)
  return Math.max(5, coins) // Minimum 5 coins
}
