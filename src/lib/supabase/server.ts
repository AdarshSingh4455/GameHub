import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  if (process.env.MOCK_AUTH === 'true') {
    const mockUserId = cookieStore.get('mock_user_id')?.value || 'mock-user-id'
    const mockUsername = cookieStore.get('mock_username')?.value || 'Adarsh'
    const mockEmail = cookieStore.get('mock_email')?.value || `${mockUsername.toLowerCase()}@example.com`

    return {
      auth: {
        getUser: async () => {
          return {
            data: {
              user: {
                id: mockUserId,
                email: mockEmail,
                user_metadata: {
                  username: mockUsername,
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
