import { WordMetadata } from './types'
import { WordValidator } from './WordValidator'
import { CATEGORIES, COMMON_WORDS } from '../wordWizardDictionary'

// Extra fallback lists to ensure all supported categories have enough high-quality words
const FALLBACK_LISTS: Record<string, string[]> = {
  animals: ['Lion', 'Tiger', 'Monkey', 'Zebra', 'Giraffe', 'Penguin', 'Dolphin', 'Koala', 'Kangaroo', 'Panda', 'Cheetah', 'Elephant', 'Rabbit', 'Fox', 'Deer', 'Owl', 'Eagle', 'Snake', 'Lizard', 'Frog', 'Cat', 'Dog', 'Bear', 'Wolf', 'Horse'],
  objects: ['Pencil', 'Chair', 'Table', 'Clock', 'Phone', 'Bottle', 'Keyboard', 'Hammer', 'Camera', 'Umbrella', 'Mirror', 'Wallet', 'Basket', 'Candle', 'Pillow', 'Blanket', 'Ladder', 'Scissors', 'Book', 'Glass', 'Cup', 'Spoon', 'Key', 'Bag'],
  food: ['Pizza', 'Burger', 'Pasta', 'Salad', 'Sushi', 'Apple', 'Banana', 'Orange', 'Cheese', 'Bread', 'Butter', 'Cookie', 'Chocolate', 'Yogurt', 'Chicken', 'Steak', 'Tomato', 'Potato', 'Rice', 'Cake', 'Juice', 'Milk', 'Honey'],
  sports: ['Football', 'Basketball', 'Tennis', 'Cricket', 'Soccer', 'Rugby', 'Golf', 'Hockey', 'Baseball', 'Boxing', 'Running', 'Swimming', 'Cycling', 'Skiing', 'Surfing', 'Karate', 'Chess', 'Race', 'Gym', 'Polo', 'Rowing'],
  technology: ['Computer', 'Internet', 'Software', 'Network', 'Robot', 'Screen', 'Battery', 'Router', 'Server', 'Sensor', 'Database', 'Hacker', 'Pixel', 'Coding', 'Mobile', 'Gadget', 'Laptop', 'Tablet', 'AI', 'Silicon', 'Code'],
  nature: ['Forest', 'Mountain', 'River', 'Ocean', 'Valley', 'Desert', 'Flower', 'Grass', 'Cloud', 'Rainbow', 'Sun', 'Moon', 'Star', 'Island', 'Canyon', 'Volcano', 'Waterfall', 'Jungle', 'Rain', 'Leaf', 'Wind', 'Rock', 'Sea'],
  vehicles: ['Car', 'Train', 'Truck', 'Bicycle', 'Motorcycle', 'Airplane', 'Helicopter', 'Boat', 'Submarine', 'Yacht', 'Rocket', 'Scooter', 'Tractor', 'Ambulance', 'Cruiser', 'Bus', 'Bike', 'Tram', 'Subway', 'Cab', 'Van'],
  places: ['School', 'Hospital', 'Library', 'Airport', 'Station', 'Museum', 'Palace', 'Castle', 'Temple', 'Market', 'Garden', 'Beach', 'Theater', 'Office', 'Garage', 'Studio', 'Stadium', 'City', 'Country', 'Town', 'Village', 'Park'],
  professions: ['Doctor', 'Teacher', 'Engineer', 'Artist', 'Writer', 'Actor', 'Chef', 'Pilot', 'Police', 'Fireman', 'Nurse', 'Dentist', 'Farmer', 'Judge', 'Lawyer', 'Sailor', 'Soldier', 'Baker', 'Tailor', 'Singer', 'Scientist']
}

export class WordGenerator {
  static async generate(category: string, difficulty: 'easy' | 'normal' | 'hard'): Promise<WordMetadata[]> {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      console.warn('[WordGenerator] GROQ_API_KEY is not defined. Using local fallback dictionary.')
      return this.generateFallback(category, difficulty)
    }

    const systemPrompt = `You are a helpful assistant that generates word lists for word search/puzzle games.
You must respond in strict JSON format. The JSON object must contain exactly two keys: 'category' and 'words'.
The 'category' key must match the category name provided.
The 'words' key must contain an array of exactly 100 unique, interesting, concrete English nouns related to that category and difficulty.
Each word object in the array must contain:
- 'word': the English noun (single word, no spaces, no special characters, e.g. 'Tiger')
- 'hint': a short, helpful, fun hint or clue describing the word (e.g. 'A striped wild cat')
- 'difficulty': either 'easy', 'normal', or 'hard' (tailored to this request)

Do not include abstract terms, phrases, or verbs. Use difficulty: '${difficulty}'.`

    const userPrompt = `Generate exactly 100 unique, concrete, and interesting nouns for the category '${category}' with difficulty '${difficulty}'. Return in JSON format with keys 'category' and 'words'.`

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`Groq API error: status ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('Empty response content')

      const parsed = JSON.parse(content)
      if (!parsed.words || !Array.isArray(parsed.words)) {
        throw new Error('Invalid words JSON structure')
      }

      const batchId = 'batch-' + Math.random().toString(36).substring(2, 15)
      const generatedAt = Date.now()

      const validated: WordMetadata[] = []
      for (const item of parsed.words) {
        const val = WordValidator.validate(item, category)
        if (val) {
          validated.push({
            ...val,
            generatedAt,
            source: 'groq',
            batchId
          })
        }
      }
      
      // If we got some valid words, return them, otherwise fallback
      if (validated.length > 5) {
        return validated
      }
      return this.generateFallback(category, difficulty)
    } catch (err: any) {
      console.error(`[WordGenerator] Error generating via Groq: ${err.message}. Using fallback.`)
      return this.generateFallback(category, difficulty)
    }
  }

  private static generateFallback(category: string, difficulty: 'easy' | 'normal' | 'hard'): WordMetadata[] {
    const categoryLower = category.toLowerCase()
    
    // Check if we have a curated list in CATEGORIES or FALLBACK_LISTS
    let wordsSource: string[] = FALLBACK_LISTS[categoryLower] || CATEGORIES[categoryLower] || CATEGORIES.nature
    
    const words: WordMetadata[] = []
    const used = new Set<string>()
    const batchId = 'batch-' + Math.random().toString(36).substring(2, 15)
    const generatedAt = Date.now()
    
    // Add primary category words
    for (const w of wordsSource) {
      const wordClean = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      if (used.has(wordClean.toLowerCase())) continue
      used.add(wordClean.toLowerCase())
      
      words.push({
        word: wordClean,
        category,
        difficulty,
        hint: `A common word in the ${category} category.`,
        length: wordClean.length,
        generatedAt,
        source: 'fallback',
        batchId
      })
    }

    // Fill the rest with random common words of corresponding length/difficulty
    let i = 0
    while (words.length < 100 && i < COMMON_WORDS.length) {
      const w = COMMON_WORDS[i++]
      // filter based on difficulty/length
      const len = w.length
      if (difficulty === 'easy' && len > 5) continue
      if (difficulty === 'hard' && len < 6) continue
      if (difficulty === 'normal' && (len < 4 || len > 7)) continue

      const wordClean = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      if (used.has(wordClean.toLowerCase())) continue
      used.add(wordClean.toLowerCase())
      
      words.push({
        word: wordClean,
        category,
        difficulty,
        hint: `A common ${difficulty} word of length ${wordClean.length}.`,
        length: wordClean.length,
        generatedAt,
        source: 'fallback',
        batchId
      })
    }
    
    // Final emergency fill
    let j = 0
    while (words.length < 100 && j < COMMON_WORDS.length) {
      const w = COMMON_WORDS[j++]
      const wordClean = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      if (used.has(wordClean.toLowerCase())) continue
      used.add(wordClean.toLowerCase())
      
      words.push({
        word: wordClean,
        category,
        difficulty,
        hint: `A common word of length ${wordClean.length}.`,
        length: wordClean.length,
        generatedAt,
        source: 'fallback',
        batchId
      })
    }

    return words
  }
}
