import fs from 'fs'
import path from 'path'
import { WordMetadata } from './types'

export interface UserCacheData {
  pools: Record<string, Record<string, WordMetadata[]>>
  usedWords: string[]
}

export interface CacheData {
  users: Record<string, UserCacheData>
}

const CACHE_FILE = path.join(process.cwd(), 'src/lib/word-engine/cache.json')

export class WordCache {
  private static inMemoryCache: CacheData = {
    users: {}
  }

  static load(): CacheData {
    // If inMemoryCache already has loaded data, return it
    if (Object.keys(this.inMemoryCache.users).length > 0) {
      return this.inMemoryCache
    }

    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf-8')
        const parsed = JSON.parse(data)
        if (parsed && parsed.users) {
          this.inMemoryCache = parsed
          return this.inMemoryCache
        } else {
          console.log('[WordCache] Old format detected in cache.json. Discarding and initializing fresh per-user cache.')
          this.clear()
        }
      }
    } catch (e) {
      console.error('[WordCache] Failed to load cache file:', e)
    }

    return this.inMemoryCache
  }

  static save(data: CacheData) {
    this.inMemoryCache = data
    try {
      const dir = path.dirname(CACHE_FILE)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.error('[WordCache] Failed to save cache file:', e)
    }
  }

  static getUserData(userId: string): UserCacheData {
    const data = this.load()
    if (!data.users[userId]) {
      data.users[userId] = {
        pools: {},
        usedWords: []
      }
    }
    return data.users[userId]
  }

  static saveUserData(userId: string, userData: UserCacheData) {
    const data = this.load()
    data.users[userId] = userData
    this.save(data)
  }

  static clear() {
    this.inMemoryCache = { users: {} }
    if (fs.existsSync(CACHE_FILE)) {
      try {
        fs.unlinkSync(CACHE_FILE)
      } catch {}
    }
  }
}
