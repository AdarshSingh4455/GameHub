import { WordMetadata, WordEngineOptions } from './types'
import { CATEGORIES, COMMON_WORDS } from '../wordWizardDictionary'

export async function getWordsClient(options: WordEngineOptions): Promise<WordMetadata[]> {
  try {
    const params = new URLSearchParams({
      category: options.category,
      difficulty: options.difficulty,
      count: String(options.count)
    })
    const res = await fetch(`/api/word-engine?${params.toString()}`)
    if (!res.ok) throw new Error('Failed to fetch words from engine')
    const data = await res.json()
    if (data.success && Array.isArray(data.words)) {
      return data.words
    }
    throw new Error(data.error || 'Invalid API response')
  } catch (error) {
    console.error('[WordEngineClient] Error fetching words, using local fallback:', error)
    return getLocalWordsFallback(options.category, options.difficulty, options.count)
  }
}

function getLocalWordsFallback(category: string, difficulty: string, count: number): WordMetadata[] {
  const catKey = category.toLowerCase()
  const catWords = CATEGORIES[catKey] || CATEGORIES.nature
  
  const results: WordMetadata[] = []
  const shuffled = [...catWords].sort(() => Math.random() - 0.5)
  
  for (const w of shuffled) {
    if (results.length >= count) break
    results.push({
      word: w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      category,
      difficulty: difficulty as any,
      hint: `A common word in ${category}.`,
      length: w.length
    })
  }

  let i = 0
  while (results.length < count && i < COMMON_WORDS.length) {
    const w = COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)]
    if (results.some(item => item.word.toLowerCase() === w.toLowerCase())) continue
    results.push({
      word: w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      category,
      difficulty: difficulty as any,
      hint: `A common word of length ${w.length}.`,
      length: w.length
    })
  }
  return results
}
