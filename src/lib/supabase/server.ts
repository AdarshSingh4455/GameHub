import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  if (process.env.MOCK_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return {
      auth: {
        getUser: async () => {
          return {
            data: {
              user: {
                id: 'mock-user-id',
                email: 'adarsh004455@gmail.com',
                user_metadata: {
                  username: 'Adarsh',
                },
              },
            },
            error: null,
          }
        },
        signOut: async () => {
          return { error: null }
        },
      },
    } as unknown as ReturnType<typeof createServerClient>
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — can't set cookies; rely on middleware
          }
        },
      },
    }
  )
}
