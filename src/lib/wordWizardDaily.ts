// Word Wizard Daily Challenge Config and Seed Helpers

export const DAILY_MODIFIERS = [
  'classic',
  'double_rare',
  'combo_frenzy',
  'time_attack',
  'no_hints',
  'giant_board',
] as const

export type DailyModifier = typeof DAILY_MODIFIERS[number]

export function getDailyDateStr(): string {
  // Returns UTC date string YYYY-MM-DD
  return new Date().toISOString().split('T')[0]
}

export function getDailySeed(dateStr: string = getDailyDateStr()): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getDailyModifier(dateStr: string = getDailyDateStr()): DailyModifier {
  const seed = getDailySeed(dateStr)
  // Use seed to select modifier deterministically
  const index = seed % DAILY_MODIFIERS.length
  return DAILY_MODIFIERS[index]
}

export function getModifierDescription(modifier: DailyModifier): string {
  switch (modifier) {
    case 'double_rare':
      return 'Double Rare Letters: The board has twice as many rare/high-scoring letters!'
    case 'no_hints':
      return 'No Hints: You cannot use hints during this challenge.'
    case 'time_attack':
      return 'Time Attack: Start with only 40 seconds, but earn +3 seconds per word found!'
    case 'giant_board':
      return 'Giant Board: Spelled on a giant 6x6 grid. Think big!'
    case 'combo_frenzy':
      return 'Combo Frenzy: Combos give double multiplier bonuses!'
    default:
      return 'Classic rules apply. Spell as many words as you can!'
  }
}
