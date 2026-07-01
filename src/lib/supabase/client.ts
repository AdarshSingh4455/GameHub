import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
    return {
      auth: {
        getUser: async () => {
          if (typeof window !== 'undefined') {
            const cookies = Object.fromEntries(
              document.cookie.split(';').map(c => {
                const eqIdx = c.indexOf('=')
                if (eqIdx === -1) return [c.trim(), '']
                const name = c.substring(0, eqIdx).trim()
                const value = c.substring(eqIdx + 1).trim()
                return [name, decodeURIComponent(value)]
              })
            )
            const mockUserId = cookies['mock_user_id'] || 'mock-user-id'
            const mockUsername = cookies['mock_username'] || 'Adarsh'
            const mockEmail = cookies['mock_email'] || `${mockUsername.toLowerCase()}@example.com`
            return {
              data: {
                user: {
                  id: mockUserId,
                  email: mockEmail,
                  user_metadata: { username: mockUsername }
                }
              },
              error: null
            }
          }
          return { data: { user: null }, error: null }
        },
        signInWithPassword: async ({ email, password }: any) => {
          // Extract username from email
          const mockUsername = email.split('@')[0]
          let mockUserId = `mock-uid-${mockUsername}`

          try {
            const res = await fetch(`/api/auth/resolve-user?username=${encodeURIComponent(mockUsername)}&email=${encodeURIComponent(email)}`)
            if (res.ok) {
              const data = await res.json()
              if (data.userId) {
                mockUserId = data.userId
              }
            }
          } catch (e) {
            console.error('Failed to resolve mock user ID:', e)
          }

          if (typeof window !== 'undefined') {
            document.cookie = `mock_user_id=${mockUserId}; path=/; max-age=86400`
            document.cookie = `mock_username=${mockUsername}; path=/; max-age=86400`
            localStorage.setItem('gamehub_mock_user_id', mockUserId)
            localStorage.setItem('gamehub_mock_username', mockUsername)
          }

          return {
            data: {
              user: {
                id: mockUserId,
                email,
                user_metadata: { username: mockUsername }
              }
            },
            error: null
          }
        },

        signUp: async ({ email, password, options }: any) => {
          const mockUsername = options?.data?.username || email.split('@')[0]
          let hash = 0
          for (let i = 0; i < email.length; i++) {
            hash = (hash << 5) - hash + email.charCodeAt(i)
            hash |= 0
          }
          const mockUserId = `mock-uid-${Math.abs(hash)}`

          if (typeof window !== 'undefined') {
            document.cookie = `mock_user_id=${mockUserId}; path=/; max-age=86400`
            document.cookie = `mock_username=${mockUsername}; path=/; max-age=86400`
            localStorage.setItem('gamehub_mock_user_id', mockUserId)
            localStorage.setItem('gamehub_mock_username', mockUsername)
          }

          // Automatically seed/create mock profile via API endpoint
          try {
            await fetch('/api/profile/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: mockUserId, username: mockUsername }),
            })
          } catch (e) {
            console.error('Failed to create mock profile:', e)
          }

          return {
            data: {
              user: {
                id: mockUserId,
                email,
                user_metadata: { username: mockUsername }
              }
            },
            error: null
          }
        },
        signOut: async () => {
          if (typeof window !== 'undefined') {
            document.cookie = 'mock_user_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
            document.cookie = 'mock_username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
            localStorage.removeItem('gamehub_mock_user_id')
            localStorage.removeItem('gamehub_mock_username')
          }
          return { error: null }
        },
        onAuthStateChange: (callback: any) => {
          return {
            data: {
              subscription: {
                unsubscribe: () => {}
              }
            }
          }
        }
      }
    } as any
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
