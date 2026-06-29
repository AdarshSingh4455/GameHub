import { WordMetadata } from './types'

export class WordValidator {
  static validate(wordObj: any, expectedCategory: string): WordMetadata | null {
    if (!wordObj || typeof wordObj !== 'object') return null
    
    let word = typeof wordObj.word === 'string' ? wordObj.word.trim() : ''
    if (!word || word.length < 3 || word.length > 12) return null
    
    // Check characters (alphabetic only)
    if (!/^[a-zA-Z]+$/.test(word)) return null
    
    // Capitalize case as specified: Keep all words in Capital Case (e.g. 'Apple')
    word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    
    const category = typeof wordObj.category === 'string' && wordObj.category.trim() ? wordObj.category.trim() : expectedCategory
    
    let difficulty: 'easy' | 'normal' | 'hard' = 'normal'
    if (wordObj.difficulty === 'easy' || wordObj.difficulty === 'normal' || wordObj.difficulty === 'hard') {
      difficulty = wordObj.difficulty
    } else {
      // Inferred difficulty from length if not provided
      if (word.length <= 4) difficulty = 'easy'
      else if (word.length >= 7) difficulty = 'hard'
    }
    
    const hint = typeof wordObj.hint === 'string' && wordObj.hint.trim() ? wordObj.hint.trim() : `A word related to ${category}`
    
    return {
      word,
      category,
      difficulty,
      hint,
      length: word.length
    }
  }
}
