import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/sync-cookie
 *
 * In MOCK_AUTH mode, this endpoint ensures the mock_user_id cookie points to the
 * canonical profile for the given username/email. It uses the same resolution logic
 * as /api/auth/resolve-user so that login and session validation are consistent.
 *
 * If the current cookie userId doesn't match the canonical userId (e.g., stale hashed
 * ID from old login code), it corrects the cookie so subsequent API calls use the right ID.
 */
export async function GET(request: NextRequest) {
  if (process.env.MOCK_AUTH !== 'true') {
    return NextResponse.json({ synced: false, reason: 'Not in mock mode' })
  }

  const cookieHeader = request.headers.get('cookie') || ''
  const parsedCookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const eqIdx = c.indexOf('=')
      if (eqIdx === -1) return [c.trim(), '']
      return [c.substring(0, eqIdx).trim(), decodeURIComponent(c.substring(eqIdx + 1).trim())]
    })
  )

  const currentUserId = parsedCookies['mock_user_id']
  const currentUsername = parsedCookies['mock_username']

  if (!currentUsername) {
    // Without a username, we can't determine the canonical profile
    return NextResponse.json({ synced: false, reason: 'No username cookie present' })
  }

  // Use the same resolution logic as /api/auth/resolve-user
  // to find the canonical userId for this username
  let canonicalUserId: string | null = null

  // 1. Exact username match
  const profileExact = await prisma.profile.findUnique({ where: { username: currentUsername } })
  if (profileExact) {
    canonicalUserId = profileExact.userId
  }

  // 2. Case-insensitive username match + email-based fallbacks
  if (!canonicalUserId) {
    const allProfiles = await prisma.profile.findMany()

    // Case-insensitive username
    const ciMatch = allProfiles.find((p: any) =>
      p.username?.toLowerCase() === currentUsername.toLowerCase()
    )
    if (ciMatch) {
      canonicalUserId = ciMatch.userId
    }

    // Email field stored in profile
    if (!canonicalUserId) {
      const emailMatch = allProfiles.find((p: any) =>
        p.email?.toLowerCase() === currentUsername.toLowerCase()
      )
      if (emailMatch) canonicalUserId = emailMatch.userId
    }

    // Email-prefix match: handles adarsh004455 -> Adarsh
    // The stored username starts with the cookie username, or vice versa
    if (!canonicalUserId) {
      const emailPrefix = currentUsername.toLowerCase()
      const prefixMatch = allProfiles.find((p: any) => {
        const uname = (p.username || '').toLowerCase()
        return uname.startsWith(emailPrefix) || emailPrefix.startsWith(uname)
      })
      if (prefixMatch) canonicalUserId = prefixMatch.userId
    }
  }

  if (!canonicalUserId) {
    // No existing profile for this username — this is a genuinely new user
    return NextResponse.json({ synced: false, reason: 'No matching profile found for username' })
  }

  const needsCorrection = canonicalUserId !== currentUserId

  if (needsCorrection) {
    console.log(`[sync-cookie] Correcting stale cookie: "${currentUserId}" -> "${canonicalUserId}" (username="${currentUsername}")`)
  }

  const response = NextResponse.json({
    synced: true,
    corrected: needsCorrection,
    userId: canonicalUserId
  })

  if (needsCorrection) {
    // Overwrite the stale cookie with the canonical userId
    response.cookies.set('mock_user_id', canonicalUserId, { path: '/', maxAge: 86400 * 7 })
  }

  return response
}
