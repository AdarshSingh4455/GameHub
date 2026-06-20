import { useState, useEffect } from 'react'

const memoryCache = new Map<string, any>()

export function useCachedFetch<T>(url: string | null, options?: RequestInit) {
  const [data, setData] = useState<T | null>(() => {
    if (!url) return null
    // Try to load from memory cache first
    if (memoryCache.has(url)) {
      return memoryCache.get(url)
    }
    // Then try localStorage
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`cache:${url}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          memoryCache.set(url, parsed.data)
          return parsed.data
        }
      } catch (e) {
        // Ignore
      }
    }
    return null
  })
  const [loading, setLoading] = useState(!data)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!url) return
    let active = true
    const fetchData = async () => {
      try {
        const res = await fetch(url, options)
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const json = await res.json()
        if (active) {
          setData(json)
          setLoading(false)
          memoryCache.set(url, json)
          try {
            localStorage.setItem(`cache:${url}`, JSON.stringify({ data: json, timestamp: Date.now() }))
          } catch (e) {
            // Ignore
          }
        }
      } catch (err) {
        if (active) {
          setError(err as Error)
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => {
      active = false
    }
  }, [url])

  const mutate = (newData: T) => {
    if (!url) return
    setData(newData)
    memoryCache.set(url, newData)
    try {
      localStorage.setItem(`cache:${url}`, JSON.stringify({ data: newData, timestamp: Date.now() }))
    } catch (e) {}
  }

  return { data, loading, error, mutate }
}

export function clearCache(url: string) {
  memoryCache.delete(url)
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`cache:${url}`)
    } catch (e) {}
  }
}
