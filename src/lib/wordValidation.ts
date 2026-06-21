import { WORD_SET } from './wordWizardDictionary'

/**
 * Computes the Levenshtein distance between two strings.
 */
export function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Validates a word. If it is in the dictionary, returns null (meaning it is correct).
 * Otherwise, searches the dictionary for the closest match within a threshold of 2 edits.
 * If a suggestion is found, returns it with the original case. Otherwise returns null.
 */
export function validateAndSuggest(text: string): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  
  const cleanText = trimmed.toLowerCase()

  // If already in word set, it's valid
  if (WORD_SET.has(cleanText)) {
    return null
  }

  // Find the closest match
  let closestWord: string | null = null
  let minDistance = Infinity

  for (const dictWord of WORD_SET) {
    // Optimization: skip distance check if length difference is greater than minDistance
    if (Math.abs(dictWord.length - cleanText.length) > 2) {
      continue
    }
    const dist = getLevenshteinDistance(cleanText, dictWord)
    if (dist < minDistance) {
      minDistance = dist
      closestWord = dictWord
    }
  }

  // Only suggest if distance is small (e.g. 1 or 2 edits)
  if (closestWord && minDistance <= 2) {
    // Match the casing of the original text
    if (trimmed === trimmed.toUpperCase()) {
      return closestWord.toUpperCase()
    } else if (trimmed[0] === trimmed[0].toUpperCase()) {
      return closestWord[0].toUpperCase() + closestWord.slice(1)
    }
    return closestWord
  }

  return null
}
