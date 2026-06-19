let cachedDetails: any = null
let lastFetched: number = 0
const CACHE_TTL = 15000 // 15 seconds cache lifetime

export async function prefetchProfileDetails(force = false): Promise<any> {
  const now = Date.now()
  if (!force && cachedDetails && now - lastFetched < CACHE_TTL) {
    return cachedDetails
  }

  try {
    const res = await fetch('/api/profile/details')
    if (res.ok) {
      const data = await res.json()
      cachedDetails = data
      lastFetched = now
      
      // Dispatch an event so components listening to details update can react
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gamehub_details_prefetched', { detail: data }))
      }
      return data
    }
  } catch (err) {
    console.error('Failed to prefetch profile details:', err)
  }
  return cachedDetails
}

export function getCachedProfileDetails(): any {
  return cachedDetails
}

export function clearPrefetchCache() {
  cachedDetails = null
  lastFetched = 0
}
