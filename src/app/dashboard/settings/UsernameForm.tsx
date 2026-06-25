'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/contexts/ToastContext'

interface UsernameFormProps {
  initialUsername: string
  initialDisplayName: string
  initialAvatarUrl: string
}

const PRESET_AVATARS = [
  { name: 'Gamer', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Gamer' },
  { name: 'Ninja', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ninja' },
  { name: 'Astronaut', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astronaut' },
  { name: 'Robot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Robot' },
  { name: 'Cyber', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber' },
]

export default function UsernameForm({ initialUsername, initialDisplayName, initialAvatarUrl }: UsernameFormProps) {
  const router = useRouter()
  const { addToast } = useToast()
  
  const [username, setUsername] = useState(initialUsername)
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  
  const [usernameAvailable, setUsernameAvailable] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [ownedAvatars, setOwnedAvatars] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/store/items')
      .then((res) => {
        if (res.ok) return res.json()
        return { items: [], ownedIds: [] }
      })
      .then((data) => {
        const ownedItems = data.items.filter((item: any) => data.ownedIds.includes(item.id) && item.type === 'AVATAR')
        const urls = ownedItems.map((item: any) => item.assetUrl).filter(Boolean)
        setOwnedAvatars(urls)
      })
      .catch((err) => console.error(err))
  }, [])

  // Debounced username availability check
  useEffect(() => {
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) {
      setUsernameAvailable('invalid')
      return
    }
    if (trimmed === initialUsername.toLowerCase()) {
      setUsernameAvailable('available')
      return
    }
    if (trimmed.length < 3 || trimmed.length > 20 || !/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameAvailable('invalid')
      return
    }

    setUsernameAvailable('checking')
    const timer = setTimeout(() => {
      fetch(`/api/profile/check-username?username=${trimmed}`)
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          if (data.available) {
            setUsernameAvailable('available')
          } else {
            setUsernameAvailable('taken')
          }
        })
        .catch(() => {
          setUsernameAvailable('idle')
        })
    }, 400)

    return () => clearTimeout(timer)
  }, [username, initialUsername])

  const hasChanges =
    username.trim().toLowerCase() !== initialUsername.toLowerCase() ||
    displayName.trim() !== initialDisplayName ||
    avatarUrl.trim() !== initialAvatarUrl

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const trimmedUser = username.trim().toLowerCase()
    const trimmedDisplayName = displayName.trim()
    const trimmedAvatar = avatarUrl.trim()

    // Validations
    if (!trimmedUser) {
      setError('Username is required')
      return
    }
    if (trimmedUser.length < 3 || trimmedUser.length > 20) {
      setError('Username must be between 3 and 20 characters')
      return
    }
    if (!/^[a-z0-9_]+$/.test(trimmedUser)) {
      setError('Username can only contain lowercase letters, numbers, and underscores')
      return
    }
    if (trimmedUser !== initialUsername.toLowerCase() && usernameAvailable !== 'available') {
      setError('Selected username is already taken or invalid')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/profile/update-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUser,
          displayName: trimmedDisplayName,
          avatarUrl: trimmedAvatar,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess('Profile updated successfully!')
      
      addToast(
        'level_up',
        'Profile Updated',
        'Your profile changes have been saved.'
      )

      // Trigger header details to update
      window.dispatchEvent(new Event('gamehub_xp_update'))

      router.refresh()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Predefined Avatars Grid */}
      <div>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'hsl(220 10% 65%)' }}>
          Choose Avatar
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {PRESET_AVATARS.map((avatar) => {
            const isSelected = avatarUrl === avatar.url
            return (
              <button
                key={avatar.name}
                type="button"
                onClick={() => setAvatarUrl(avatar.url)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  border: isSelected ? '3px solid hsl(220 100% 65%)' : '2px solid hsl(220 15% 20%)',
                  background: 'hsl(220 20% 8%)',
                  padding: 4,
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.1)' : 'none',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 10px hsl(220 100% 65% / 0.4)' : 'none',
                }}
                title={avatar.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={avatar.url} alt={avatar.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              </button>
            )
          })}
          {ownedAvatars.map((url, index) => {
            const isSelected = avatarUrl === url
            return (
              <button
                key={`owned-${index}`}
                type="button"
                onClick={() => setAvatarUrl(url)}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  border: isSelected ? '3px solid hsl(220 100% 65%)' : '2px solid hsl(220 15% 20%)',
                  background: 'hsl(220 20% 8%)',
                  padding: 4,
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.1)' : 'none',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 10px hsl(220 100% 65% / 0.4)' : 'none',
                }}
                title="Purchased Avatar"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Owned Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
              </button>
            )
          })}
        </div>

        {/* Custom Avatar URL Input */}
        <input
          className="input"
          type="text"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Or paste custom image URL..."
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
        />
      </div>

      {/* Username Field with inline status indicator */}
      <div>
        <label 
          htmlFor="settings-username" 
          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}
        >
          Username
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="settings-username"
            className="input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            placeholder="enter_new_username"
            style={{ paddingRight: '6.5rem' }}
          />
          <div style={{
            position: 'absolute',
            right: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '0.72rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            {usernameAvailable === 'checking' && <span style={{ color: 'hsl(220 10% 50%)' }}>⏳ Checking...</span>}
            {usernameAvailable === 'available' && <span style={{ color: 'hsl(142 70% 55%)' }}>✓ Available</span>}
            {usernameAvailable === 'taken' && <span style={{ color: 'hsl(0 80% 65%)' }}>❌ Taken</span>}
            {usernameAvailable === 'invalid' && username.length > 0 && <span style={{ color: 'hsl(0 80% 65%)' }}>❌ Invalid</span>}
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'hsl(220 10% 40%)', marginTop: '0.35rem' }}>
          3-20 characters, lowercase letters, numbers, and underscores only.
        </p>
      </div>

      {/* Display Name Field */}
      <div>
        <label 
          htmlFor="settings-displayname" 
          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'hsl(220 10% 65%)' }}
        >
          Display Name
        </label>
        <input
          id="settings-displayname"
          className="input"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={loading}
          maxLength={25}
          placeholder="Enter display name"
        />
      </div>

      {error && (
        <div 
          style={{ 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-md)', 
            background: 'hsl(0 80% 55% / 0.1)', 
            border: '1px solid hsl(0 80% 55% / 0.3)',
            color: 'hsl(0 80% 70%)',
            fontSize: '0.85rem'
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div 
          style={{ 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-md)', 
            background: 'hsl(142 70% 45% / 0.1)', 
            border: '1px solid hsl(142 70% 45% / 0.3)',
            color: 'hsl(142 70% 65%)',
            fontSize: '0.85rem'
          }}
        >
          ✅ {success}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={loading || !hasChanges || (username.trim().toLowerCase() !== initialUsername.toLowerCase() && usernameAvailable !== 'available')}
        style={{ 
          opacity: (loading || !hasChanges || (username.trim().toLowerCase() !== initialUsername.toLowerCase() && usernameAvailable !== 'available')) ? 0.6 : 1,
          cursor: (loading || !hasChanges || (username.trim().toLowerCase() !== initialUsername.toLowerCase() && usernameAvailable !== 'available')) ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {loading ? 'Saving Profile...' : 'Save Profile Details'}
      </button>
    </form>
  )
}
