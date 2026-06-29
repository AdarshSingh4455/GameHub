import { WordRepository } from './WordRepository'
import { WordMetadata, WordEngineOptions } from './types'

export class WordEngine {
  static async getWords(options: WordEngineOptions & { userId: string }): Promise<WordMetadata[]> {
    const categories = ['Animals', 'Objects', 'Food', 'Sports', 'Technology', 'Nature', 'Vehicles', 'Places', 'Professions']
    let category = options.category
    
    // Normalize case and match category name
    const matchingCategory = categories.find(c => c.toLowerCase() === category.toLowerCase())
    if (matchingCategory) {
      category = matchingCategory
    } else if (category.toLowerCase() === 'random') {
      category = categories[Math.floor(Math.random() * categories.length)]
    }

    return WordRepository.getWords(category, options.difficulty as 'easy' | 'normal' | 'hard', options.count, options.userId)
  }
}
