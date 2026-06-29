export interface WordMetadata {
  word: string
  category: string
  difficulty: 'easy' | 'normal' | 'hard'
  hint: string
  length: number
  generatedAt?: number
  lastUsedAt?: number
  source?: 'groq' | 'fallback'
  batchId?: string
}

export interface WordEngineOptions {
  category: string
  difficulty: 'easy' | 'normal' | 'hard'
  count: number
}
