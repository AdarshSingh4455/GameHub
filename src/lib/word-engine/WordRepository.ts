import { WordCache } from './WordCache'
import { WordGenerator } from './WordGenerator'
import { WordMetadata } from './types'

export class WordRepository {
  private static pendingGenerations: Record<string, Promise<WordMetadata[]>> = {}

  static async getWords(
    category: string,
    difficulty: 'easy' | 'normal' | 'hard',
    count: number,
    userId: string
  ): Promise<WordMetadata[]> {
    const userData = WordCache.getUserData(userId)
    const catKey = category.toLowerCase()
    const diffKey = difficulty

    if (!userData.pools[catKey]) {
      userData.pools[catKey] = {}
    }
    if (!userData.pools[catKey][diffKey]) {
      userData.pools[catKey][diffKey] = []
    }

    let pool = userData.pools[catKey][diffKey]
    const genKey = `${userId}-${catKey}-${diffKey}`

    // If cache has fewer than count words, do a synchronous fetch (or reuse an active one)
    if (pool.length < count) {
      console.log(`[WordRepository] Pool low (${pool.length}) for user ${userId}. Fetching synchronous batch for ${category} (${difficulty})...`)
      
      // Deduplicate simultaneous synchronous generation triggers
      if (!this.pendingGenerations[genKey]) {
        this.pendingGenerations[genKey] = WordGenerator.generate(category, difficulty)
      }

      try {
        const newWords = await this.pendingGenerations[genKey]
        const usedSet = new Set(userData.usedWords.map(w => w.toLowerCase()))
        const uniqueNewWords = newWords.filter(w => !usedSet.has(w.word.toLowerCase()))

        pool.push(...uniqueNewWords)
        userData.pools[catKey][diffKey] = pool
        WordCache.saveUserData(userId, userData)
      } finally {
        delete this.pendingGenerations[genKey]
      }
    }

    // Serve words
    const served = pool.slice(0, count)
    const remaining = pool.slice(count)
    userData.pools[catKey][diffKey] = remaining

    // Mark served words as used
    const now = Date.now()
    served.forEach(w => {
      w.lastUsedAt = now
      if (!userData.usedWords.includes(w.word)) {
        userData.usedWords.push(w.word)
      }
    })

    if (userData.usedWords.length > 5000) {
      userData.usedWords = userData.usedWords.slice(-5000)
    }

    WordCache.saveUserData(userId, userData)

    // Trigger background pre-generation if remaining falls below 20 and no active generation is running
    if (remaining.length < 20 && !this.pendingGenerations[genKey]) {
      console.log(`[WordRepository] Background generation triggered for user ${userId}, category ${category} (${difficulty}). Remaining: ${remaining.length}`)
      
      this.pendingGenerations[genKey] = WordGenerator.generate(category, difficulty)
      
      this.pendingGenerations[genKey].then(newBatch => {
        const currentUserData = WordCache.getUserData(userId)
        if (!currentUserData.pools[catKey]) currentUserData.pools[catKey] = {}
        if (!currentUserData.pools[catKey][diffKey]) currentUserData.pools[catKey][diffKey] = []

        const usedSet = new Set(currentUserData.usedWords.map(w => w.toLowerCase()))
        const uniqueBatch = newBatch.filter(w => !usedSet.has(w.word.toLowerCase()))

        currentUserData.pools[catKey][diffKey].push(...uniqueBatch)
        WordCache.saveUserData(userId, currentUserData)
        console.log(`[WordRepository] Background batch finished for user ${userId}, category ${category} (${difficulty}). Added ${uniqueBatch.length} new words.`)
      }).catch(err => {
        console.error(`[WordRepository] Background generation failed for user ${userId}, category ${category} (${difficulty}):`, err)
      }).finally(() => {
        delete this.pendingGenerations[genKey]
      })
    }

    return served
  }
}
