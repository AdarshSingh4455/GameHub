'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/contexts/ToastContext'

interface Ad {
  id: string
  imageUrl: string
  targetUrl: string
  durationSecs: number
  duration_seconds?: number
  skip_after_seconds?: number
  allGames: boolean
  games: string[]
  active: boolean
  impressions: number
  clicks: number
}

interface Tournament {
  id: string
  name: string
  description: string | null
  startDate: string
  endDate: string
  eligibleGames: string[]
  rewardCoins: number
  rewardBadge: string | null
  rewardTitle: string | null
  rewardCosmetic: string | null
}

interface Cosmetic {
  id: string
  name: string
  type: string
  priceCoins: number
  assetUrl: string | null
  metadata: any | null
  isDefault: boolean
}

const GAMES_LIST = [
  { slug: 'cricket', name: 'Hand Cricket' },
  { slug: 'scribble', name: 'Scribble' },
  { slug: 'dumb-charades', name: 'Dumb Charades' },
  { slug: 'whos-spy', name: "Who's Spy" },
  { slug: 'tic-tac-toe', name: 'Tic-Tac-Toe' },
  { slug: 'word-wizard', name: 'Word Wizard' },
  { slug: 'rps', name: 'Rock Paper Scissors' },
  { slug: 'number-guessing', name: 'Number Guessing' },
  { slug: '2048', name: '2048' },
  { slug: 'fighter', name: 'Fighter Jet' },
  { slug: 'ludo', name: 'Ludo' },
  { slug: 'memory', name: 'Memory Match' },
]

export default function AdminPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [role, setRole] = useState<string | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<'ads' | 'analytics' | 'tournaments' | 'updates' | 'tools'>('ads')

  // Data States
  const [ads, setAds] = useState<Ad[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)

  // Forms / Upload States
  const [adForm, setAdForm] = useState({
    id: '',
    imageUrl: '',
    targetUrl: '',
    durationSecs: 5,
    duration_seconds: 5,
    skip_after_seconds: 5,
    allGames: true,
    games: [] as string[],
    active: true,
  })
  const [uploadingImage, setUploadingImage] = useState(false)
  const [runningTools, setRunningTools] = useState(false)
  const [toolsResult, setToolsResult] = useState<any>(null)

  const [tournamentForm, setTournamentForm] = useState({
    id: '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    eligibleGames: [] as string[],
    rewardCoins: 0,
    rewardBadge: '',
    rewardTitle: '',
    rewardCosmetic: '',
  })

  const [cosmeticForm, setCosmeticForm] = useState({
    id: '',
    name: '',
    type: 'AVATAR',
    priceCoins: 50,
    assetUrl: '',
    rarity: 'COMMON', // COMMON, RARE, EPIC, LEGENDARY
    isDefault: false,
    chatMessages: '', // parsed to messages array in metadata
  })

  // Auth Verification
  useEffect(() => {
    fetch('/api/profile/details')
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error()
      })
      .then((data) => {
        setRole(data.profile.role)
        setLoadingAuth(false)
        if (data.profile.role !== 'SUPER_ADMIN') {
          addToast('error', 'Unauthorized', 'You do not have access to this page.')
          router.push('/dashboard')
        }
      })
      .catch(() => {
        setLoadingAuth(false)
        router.push('/login?redirect=/dashboard/admin')
      })
  }, [router, addToast])

  // Fetch Data based on active tab
  const fetchData = async () => {
    if (role !== 'SUPER_ADMIN') return
    setLoadingData(true)
    try {
      if (activeTab === 'ads') {
        const res = await fetch('/api/admin/ads')
        const data = await res.json()
        setAds(data.ads || [])
      } else if (activeTab === 'analytics') {
        const res = await fetch('/api/admin/analytics')
        const data = await res.json()
        setAnalytics(data || null)
      } else if (activeTab === 'tournaments') {
        const res = await fetch('/api/admin/tournaments')
        const data = await res.json()
        setTournaments(data.tournaments || [])
      } else if (activeTab === 'updates') {
        const res = await fetch('/api/admin/cosmetics')
        const data = await res.json()
        setCosmetics(data.cosmetics || [])
      }
    } catch (err) {
      console.error(err)
      addToast('error', 'Error', 'Failed to fetch admin data.')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (role === 'SUPER_ADMIN') {
      fetchData()
    }
  }, [role, activeTab])

  // --- AD ACTIONS ---
  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/ads/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      setAdForm((prev) => ({ ...prev, imageUrl: data.url }))
      addToast('success', 'Upload Successful', 'Ad banner image uploaded locally!')
    } catch (err: any) {
      addToast('error', 'Upload Error', err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleAdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = adForm.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/ads', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adForm),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save ad')
      }

      addToast('success', 'Ad Saved', adForm.id ? 'Ad updated successfully!' : 'Ad created successfully!')
      setAdForm({ id: '', imageUrl: '', targetUrl: '', durationSecs: 5, duration_seconds: 5, skip_after_seconds: 5, allGames: true, games: [], active: true })
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  const handleAdToggleActive = async (ad: Ad) => {
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ad, active: !ad.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Toggle failed')

      addToast('success', 'Status Updated', 'Ad active state changed!')
      fetchData()
    } catch (err: any) {
      addToast('error', 'Limit Exceeded', err.message)
    }
  }

  const handleAdDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return
    try {
      const res = await fetch(`/api/admin/ads?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      addToast('info', 'Deleted', 'Ad banner deleted.')
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  // --- TOURNAMENT ACTIONS ---
  const handleTournamentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const method = tournamentForm.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/tournaments', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournamentForm),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to save tournament')

      addToast('success', 'Tournament Saved', 'Tournament configurations created!')
      setTournamentForm({
        id: '',
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        eligibleGames: [],
        rewardCoins: 0,
        rewardBadge: '',
        rewardTitle: '',
        rewardCosmetic: '',
      })
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  const handleTournamentDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return
    try {
      const res = await fetch(`/api/admin/tournaments?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      addToast('info', 'Deleted', 'Tournament deleted.')
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  // --- COSMETIC UPDATES ACTIONS ---
  const handleCosmeticSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Build metadata
      let metadata: any = { rarity: cosmeticForm.rarity }
      if (cosmeticForm.type === 'CHAT_PACK') {
        const msgs = cosmeticForm.chatMessages
          .split('\n')
          .map((m) => m.trim())
          .filter(Boolean)
        metadata.messages = msgs
      } else if (cosmeticForm.type === 'SCRATCHER') {
        metadata.description = cosmeticForm.rarity === 'COMMON' ? 'Scratch to win basic Coins or XP.' :
                               cosmeticForm.rarity === 'RARE' ? 'Scratch to win decent Coins, XP, or Rare items.' :
                               cosmeticForm.rarity === 'EPIC' ? 'Scratch to win huge Coins, XP, or Epic items.' :
                               'Scratch to win Legendary rewards!'
      }

      const payload = {
        id: cosmeticForm.id,
        name: cosmeticForm.name,
        type: cosmeticForm.type,
        priceCoins: cosmeticForm.priceCoins,
        assetUrl: cosmeticForm.assetUrl,
        isDefault: cosmeticForm.isDefault,
        metadata,
      }

      const method = cosmeticForm.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/cosmetics', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to save cosmetic')

      addToast('success', 'Cosmetic Updated', 'Cosmetic catalog updated!')
      setCosmeticForm({
        id: '',
        name: '',
        type: 'AVATAR',
        priceCoins: 50,
        assetUrl: '',
        rarity: 'COMMON',
        isDefault: false,
        chatMessages: '',
      })
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  const handleCosmeticDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this cosmetic?')) return
    try {
      const res = await fetch(`/api/admin/cosmetics?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      addToast('info', 'Deleted', 'Cosmetic item deleted.')
      fetchData()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    }
  }

  if (loadingAuth) {
    return <div style={{ color: 'hsl(220 10% 50%)', padding: '3rem', textAlign: 'center' }}>Authenticating Admin rights...</div>
  }

  if (role !== 'SUPER_ADMIN') {
    return null // redirecting
  }

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fadeIn">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}>🛠️ Super Admin Control Center</h1>
        <p style={{ color: 'hsl(220 10% 55%)' }}>Perform platform operations, review system analytics, manage ad banners, and publish game updates.</p>
      </div>

      {/* Tabs list (Optimized for 390x844 responsive flow - wrapping and horizontal swipeable) */}
      <div style={{ display: 'flex', borderBottom: '1px solid hsl(220 15% 18%)', gap: '0.5rem', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '0.1rem' }}>
        {[
          { id: 'ads', label: 'Ads Management', emoji: '📢' },
          { id: 'analytics', label: 'Analytics', emoji: '📊' },
          { id: 'tournaments', label: 'Tournaments', emoji: '🏆' },
          { id: 'updates', label: 'Updates / Cosmetics', emoji: '📦' },
          { id: 'tools', label: 'Admin Tools', emoji: '🔧' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeTab === t.id ? 'hsl(220 100% 70%)' : 'hsl(220 10% 50%)',
              fontWeight: 700,
              fontSize: '0.82rem',
              padding: '0.5rem 0.65rem 0.65rem',
              cursor: 'pointer',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            id={`admin-tab-${t.id}`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
            {activeTab === t.id && (
              <div style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: 'hsl(220 100% 60%)',
                boxShadow: '0 0 8px hsl(220 100% 60%)'
              }} />
            )}
          </button>
        ))}
      </div>

      {loadingData && (
        <div style={{ textAlign: 'center', color: 'hsl(220 10% 55%)', padding: '1rem' }}>Loading configurations...</div>
      )}

      {/* TAB 1: ADS MANAGEMENT */}
      {activeTab === 'ads' && !loadingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Create Ad Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: 'white' }}>
              {adForm.id ? '✏️ Edit Ad Banner' : '➕ Create Ad Banner'}
            </h2>
            <form onSubmit={handleAdSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Upload Section */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>
                    Upload Image File
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAdImageUpload}
                    style={{ fontSize: '0.78rem', display: 'block', width: '100%', marginBottom: '0.5rem' }}
                  />
                  {uploadingImage && <span style={{ fontSize: '0.7rem', color: 'hsl(220 100% 70%)' }}>Uploading...</span>}

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>
                    Or External Image URL
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="https://..."
                    value={adForm.imageUrl}
                    onChange={(e) => setAdForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>
                    Target URL (Redirect Click)
                  </label>
                  <input
                    className="input"
                    type="text"
                    placeholder="https://..."
                    value={adForm.targetUrl}
                    onChange={(e) => setAdForm((prev) => ({ ...prev, targetUrl: e.target.value }))}
                    required
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>
                        Ad Duration
                      </label>
                      <select
                        value={adForm.duration_seconds}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          setAdForm((prev) => ({ ...prev, duration_seconds: val, durationSecs: val }))
                        }}
                        style={{ height: '36px', background: 'hsl(220 15% 10%)', border: '1px solid hsl(220 15% 18%)', color: 'white', borderRadius: '6px', padding: '0 0.5rem', fontSize: '0.78rem', width: '100%' }}
                      >
                        {[5, 10, 15, 20, 30, 60].map((opt) => (
                          <option key={opt} value={opt}>{opt}s</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>
                        Skip Button Delay
                      </label>
                      <select
                        value={adForm.skip_after_seconds}
                        onChange={(e) => setAdForm((prev) => ({ ...prev, skip_after_seconds: parseInt(e.target.value, 10) }))}
                        style={{ height: '36px', background: 'hsl(220 15% 10%)', border: '1px solid hsl(220 15% 18%)', color: 'white', borderRadius: '6px', padding: '0 0.5rem', fontSize: '0.78rem', width: '100%' }}
                      >
                        {[0, 3, 5, 10, 15].map((opt) => (
                          <option key={opt} value={opt}>{opt}s</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', color: 'white' }}>
                      <input
                        type="checkbox"
                        checked={adForm.active}
                        onChange={(e) => setAdForm((prev) => ({ ...prev, active: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                      Enable Immediately
                    </label>
                  </div>
                </div>
              </div>

              {/* Game Targeting */}
              <div style={{ borderTop: '1px solid hsl(220 15% 18%)', paddingTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.8rem', color: 'white', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={adForm.allGames}
                    onChange={(e) => setAdForm((prev) => ({ ...prev, allGames: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  Target All Games
                </label>

                {!adForm.allGames && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 50%)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                      Select Games:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.4rem' }}>
                      {GAMES_LIST.map((g) => {
                        const checked = adForm.games.includes(g.slug)
                        return (
                          <label key={g.slug} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'hsl(220 10% 75%)', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setAdForm((prev) => {
                                  const nextGames = checked
                                    ? prev.games.filter((s) => s !== g.slug)
                                    : [...prev.games, g.slug]
                                  return { ...prev, games: nextGames }
                                })
                              }}
                              style={{ width: 14, height: 14 }}
                            />
                            {g.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!adForm.imageUrl || !adForm.targetUrl}>
                  {adForm.id ? 'Save Ad Changes' : 'Publish Ad Banner'}
                </button>
                {adForm.id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setAdForm({ id: '', imageUrl: '', targetUrl: '', durationSecs: 5, duration_seconds: 5, skip_after_seconds: 5, allGames: true, games: [], active: true })}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Active Ads List */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Active Ads Campaigns ({ads.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ads.map((ad) => (
                <div key={ad.id} className="card" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ad.imageUrl} alt="banner" style={{ width: 80, height: 45, borderRadius: 6, objectFit: 'cover', background: 'hsl(220 20% 8%)', border: '1px solid hsl(220 15% 20%)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        Target: <a href={ad.targetUrl} target="_blank" rel="noreferrer" style={{ color: 'hsl(220 100% 70%)', textDecoration: 'none' }} className="hover-underline">{ad.targetUrl}</a>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.2rem' }}>
                        Timer: <strong>{ad.duration_seconds ?? ad.durationSecs}s (skip: {ad.skip_after_seconds ?? ad.durationSecs}s)</strong> · Impressions: <strong>{ad.impressions}</strong> · Clicks: <strong>{ad.clicks}</strong>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'hsl(38 95% 60%)', marginTop: '0.15rem' }}>
                        Targets: {ad.allGames ? 'All Games' : ad.games.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      className={`btn btn-sm ${ad.active ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleAdToggleActive(ad)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      {ad.active ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAdForm({ id: ad.id, imageUrl: ad.imageUrl, targetUrl: ad.targetUrl, durationSecs: ad.durationSecs, duration_seconds: ad.duration_seconds ?? ad.durationSecs ?? 5, skip_after_seconds: ad.skip_after_seconds ?? ad.durationSecs ?? 5, allGames: ad.allGames, games: ad.games, active: ad.active })}
                      style={{ padding: '0.25rem' }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAdDelete(ad.id)}
                      style={{ padding: '0.25rem', color: 'hsl(0 80% 60%)' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
              {ads.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(220 10% 50%)', border: '1px dashed hsl(220 15% 15%)', borderRadius: 16 }}>
                  No ad campaigns configured.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === 'analytics' && analytics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Total Users</span>
              <strong style={{ fontSize: '1.6rem', color: 'white' }}>{analytics.users.totalUsers}</strong>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem' }}>Active: {analytics.users.activeUsers}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Active (DAU/WAU)</span>
              <strong style={{ fontSize: '1.6rem', color: 'hsl(220 100% 70%)' }}>{analytics.users.dau} <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', fontWeight: 500 }}>/ {analytics.users.wau}</span></strong>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem' }}>MAU: {analytics.users.mau}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Total Played Matches</span>
              <strong style={{ fontSize: '1.6rem', color: 'hsl(142 70% 55%)' }}>{analytics.games.totalMatches}</strong>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem' }}>Avg duration: {analytics.games.avgSessionDuration}s</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Retention & Claims</span>
              <strong style={{ fontSize: '1.6rem', color: 'hsl(38 95% 60%)' }}>{analytics.retention.dailyClaimsCount}</strong>
              <div style={{ fontSize: '0.65rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem' }}>Avg Streak: {analytics.retention.avgStreak}d</div>
            </div>
          </div>

          {/* Economy & Ads Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Economy Block */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '1rem' }}>
                🪙 Economy Status
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'hsl(220 10% 75%)' }}>Coins Earned</span>
                    <strong style={{ color: 'hsl(142 70% 55%)' }}>{analytics.economy.coinsEarned.toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 6, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'hsl(142 70% 45%)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: 'hsl(220 10% 75%)' }}>Coins Spent (Store purchases)</span>
                    <strong style={{ color: 'hsl(0 80% 60%)' }}>{analytics.economy.coinsSpent.toLocaleString()}</strong>
                  </div>
                  <div style={{ height: 6, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, analytics.economy.coinsEarned > 0 ? (analytics.economy.coinsSpent / analytics.economy.coinsEarned) * 100 : 0)}%`,
                      height: '100%',
                      background: 'hsl(0 80% 50%)'
                    }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'hsl(220 10% 45%)', marginTop: '0.2rem', textAlign: 'right' }}>
                    Circulation: {(analytics.economy.coinsEarned - analytics.economy.coinsSpent).toLocaleString()} in wallets
                  </div>
                </div>
              </div>
            </div>

            {/* Ads CTR Block */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '1rem' }}>
                📢 Ads Performance
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', alignItems: 'center', height: '100%', paddingBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{analytics.ads.impressions}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Impressions</div>
                </div>
                <div style={{ borderLeft: '1px solid hsl(220 15% 18%)', height: 40 }} />
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{analytics.ads.clicks}</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)' }}>Clicks</div>
                </div>
                <div style={{ borderLeft: '1px solid hsl(220 15% 18%)', height: 40 }} />
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(45 100% 55%)' }}>{analytics.ads.ctr}%</div>
                  <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', fontWeight: 600 }}>Click-Through Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Game popularity */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
              🎮 Game Stats Summary
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', textAlign: 'center' }}>
              <div style={{ padding: '0.5rem', background: 'hsl(220 20% 7%)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.7rem', color: 'hsl(142 70% 55%)', display: 'block', fontWeight: 700 }}>🔥 MOST PLAYED GAME</span>
                <strong style={{ fontSize: '1rem', color: 'white' }}>{analytics.games.mostPlayed}</strong>
              </div>
              <div style={{ padding: '0.5rem', background: 'hsl(220 20% 7%)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.7rem', color: 'hsl(0 80% 60%)', display: 'block', fontWeight: 700 }}>❄️ LEAST PLAYED GAME</span>
                <strong style={{ fontSize: '1rem', color: 'white' }}>{analytics.games.leastPlayed}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TOURNAMENTS */}
      {activeTab === 'tournaments' && !loadingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Create Tournament Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: 'white' }}>🏆 Create Tournament Configuration</h2>
            <form onSubmit={handleTournamentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>Tournament Name</label>
                  <input
                    className="input"
                    type="text"
                    value={tournamentForm.name}
                    onChange={(e) => setTournamentForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem', marginTop: '0.5rem' }}>Description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={tournamentForm.description}
                    onChange={(e) => setTournamentForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>Start Date</label>
                      <input
                        className="input"
                        type="date"
                        value={tournamentForm.startDate}
                        onChange={(e) => setTournamentForm((prev) => ({ ...prev, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>End Date</label>
                      <input
                        className="input"
                        type="date"
                        value={tournamentForm.endDate}
                        onChange={(e) => setTournamentForm((prev) => ({ ...prev, endDate: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem', marginTop: '0.5rem' }}>Eligible Games (Targeted Slugs)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem' }}>
                    {GAMES_LIST.slice(0, 8).map((g) => {
                      const checked = tournamentForm.eligibleGames.includes(g.slug)
                      return (
                        <label key={g.slug} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'hsl(220 10% 70%)', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTournamentForm((prev) => {
                                const nextGames = checked
                                  ? prev.eligibleGames.filter((s) => s !== g.slug)
                                  : [...prev.eligibleGames, g.slug]
                                return { ...prev, eligibleGames: nextGames }
                              })
                            }}
                            style={{ width: 14, height: 14 }}
                          />
                          {g.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Rewards Configuration */}
              <div style={{ borderTop: '1px solid hsl(220 15% 18%)', paddingTop: '0.75rem' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>🎁 Reward Configuration (PVP Winners)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Reward Coins</label>
                    <input
                      className="input"
                      type="number"
                      value={tournamentForm.rewardCoins}
                      onChange={(e) => setTournamentForm((prev) => ({ ...prev, rewardCoins: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Reward Badge Name</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g. Master Champion"
                      value={tournamentForm.rewardBadge}
                      onChange={(e) => setTournamentForm((prev) => ({ ...prev, rewardBadge: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Reward Title Name</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g. Hand Cricket Dictator"
                      value={tournamentForm.rewardTitle}
                      onChange={(e) => setTournamentForm((prev) => ({ ...prev, rewardTitle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Limited Cosmetic Item</label>
                    <input
                      className="input"
                      type="text"
                      placeholder="e.g. Golden Cyber Skin"
                      value={tournamentForm.rewardCosmetic}
                      onChange={(e) => setTournamentForm((prev) => ({ ...prev, rewardCosmetic: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
                Publish Tournament Structure
              </button>
            </form>
          </div>

          {/* Tournaments List */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Published Tournaments ({tournaments.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {tournaments.map((t) => (
                <div key={t.id} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>
                      🏆 {t.name}
                    </div>
                    {t.description && <p style={{ margin: '0.15rem 0', fontSize: '0.78rem', color: 'hsl(220 10% 60%)' }}>{t.description}</p>}
                    <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '0.2rem' }}>
                      Start: <strong>{new Date(t.startDate).toLocaleDateString()}</strong> · End: <strong>{new Date(t.endDate).toLocaleDateString()}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {t.rewardCoins > 0 && <span className="badge badge-gold" style={{ fontSize: '0.62rem' }}>💰 {t.rewardCoins} Coins</span>}
                      {t.rewardBadge && <span className="badge badge-blue" style={{ fontSize: '0.62rem' }}>🎖️ {t.rewardBadge}</span>}
                      {t.rewardTitle && <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>⚡ {t.rewardTitle}</span>}
                      {t.rewardCosmetic && <span className="badge badge-gold" style={{ fontSize: '0.62rem' }}>💎 {t.rewardCosmetic} (Limited)</span>}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleTournamentDelete(t.id)}
                    style={{ padding: '0.3rem', color: 'hsl(0 80% 60%)', flexShrink: 0 }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
              {tournaments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(220 10% 50%)', border: '1px dashed hsl(220 15% 15%)', borderRadius: 16 }}>
                  No tournaments registered yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COSMETICS / UPDATES */}
      {activeTab === 'updates' && !loadingData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Create Cosmetic Form */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: 'white' }}>
              {cosmeticForm.id ? '✏️ Edit Cosmetic Item' : '📦 Publish New Cosmetic Item'}
            </h2>
            <form onSubmit={handleCosmeticSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>Cosmetic Name</label>
                  <input
                    className="input"
                    type="text"
                    value={cosmeticForm.name}
                    onChange={(e) => setCosmeticForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Cosmetic Type</label>
                      <select
                        className="input"
                        value={cosmeticForm.type}
                        onChange={(e) => setCosmeticForm((prev) => ({ ...prev, type: e.target.value }))}
                        style={{ height: 38 }}
                      >
                        <option value="AVATAR">Avatar</option>
                        <option value="CHAT_PACK">Chat Pack</option>
                        <option value="SCRATCHER">Scratcher</option>
                        <option value="AVATAR_FRAME">Avatar Frame</option>
                        <option value="BOARD_THEME">Board Theme</option>
                        <option value="TITLE">Title</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Price (Coins)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={cosmeticForm.priceCoins}
                        onChange={(e) => setCosmeticForm((prev) => ({ ...prev, priceCoins: parseInt(e.target.value) || 0 }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.35rem' }}>Asset URL / Dicebear Seed</label>
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. https://... or Robot"
                    value={cosmeticForm.assetUrl}
                    onChange={(e) => setCosmeticForm((prev) => ({ ...prev, assetUrl: e.target.value }))}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.2rem' }}>Rarity Tier</label>
                      <select
                        className="input"
                        value={cosmeticForm.rarity}
                        onChange={(e) => setCosmeticForm((prev) => ({ ...prev, rarity: e.target.value }))}
                        style={{ height: 38 }}
                      >
                        <option value="COMMON">Common</option>
                        <option value="RARE">Rare</option>
                        <option value="EPIC">Epic</option>
                        <option value="LEGENDARY">Legendary</option>
                      </select>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', color: 'white', marginTop: '1.25rem' }}>
                      <input
                        type="checkbox"
                        checked={cosmeticForm.isDefault}
                        onChange={(e) => setCosmeticForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                      Is Default Item
                    </label>
                  </div>
                </div>
              </div>

              {/* Chat pack messages entry */}
              {cosmeticForm.type === 'CHAT_PACK' && (
                <div style={{ borderTop: '1px solid hsl(220 15% 18%)', paddingTop: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'hsl(220 10% 65%)', marginBottom: '0.25rem' }}>
                    Chat Pack Messages (one message per line)
                  </label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder={`Well played! 🤝\nGood game! 🎮\nNice move! 🔥`}
                    value={cosmeticForm.chatMessages}
                    onChange={(e) => setCosmeticForm((prev) => ({ ...prev, chatMessages: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={!cosmeticForm.name}>
                  {cosmeticForm.id ? 'Save Cosmetic' : 'Publish Cosmetic'}
                </button>
                {cosmeticForm.id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCosmeticForm({ id: '', name: '', type: 'AVATAR', priceCoins: 50, assetUrl: '', rarity: 'COMMON', isDefault: false, chatMessages: '' })}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Cosmetics List */}
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              Published Cosmetics in Store ({cosmetics.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {cosmetics.map((c) => {
                const rarity = c.metadata?.rarity || 'COMMON'
                const rarityColors: any = {
                  COMMON: 'hsl(220 10% 65%)',
                  RARE: 'hsl(220 100% 70%)',
                  EPIC: 'hsl(270 80% 70%)',
                  LEGENDARY: 'hsl(45 100% 60%)',
                }

                return (
                  <div key={c.id} className="card" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', background: 'hsl(222 18% 12%)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: 'hsl(220 20% 7%)',
                        border: '1px solid hsl(220 15% 20%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {c.type === 'AVATAR' && c.assetUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.assetUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : c.type === 'AVATAR' ? (
                          '👤'
                        ) : c.type === 'CHAT_PACK' ? (
                          '💬'
                        ) : c.type === 'SCRATCHER' ? (
                          '🃏'
                        ) : (
                          '💎'
                        )}
                      </div>
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 55%)', marginTop: '0.2rem' }}>
                          Type: <strong>{c.type}</strong> · Price: <strong style={{ color: 'hsl(45 100% 55%)' }}>{c.priceCoins} Coins</strong> · Rarity: <strong style={{ color: rarityColors[rarity] }}>{rarity}</strong>
                        </div>
                        {c.type === 'CHAT_PACK' && c.metadata?.messages && (
                          <div style={{ fontSize: '0.68rem', color: 'hsl(220 10% 45%)', marginTop: '0.15rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            Messages: {c.metadata.messages.join(' | ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          let msgsStr = ''
                          if (c.type === 'CHAT_PACK' && c.metadata?.messages) {
                            msgsStr = c.metadata.messages.join('\n')
                          }
                          setCosmeticForm({
                            id: c.id,
                            name: c.name,
                            type: c.type,
                            priceCoins: c.priceCoins,
                            assetUrl: c.assetUrl || '',
                            rarity: c.metadata?.rarity || 'COMMON',
                            isDefault: c.isDefault,
                            chatMessages: msgsStr,
                          })
                        }}
                        style={{ padding: '0.25rem 0.45rem' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCosmeticDelete(c.id)}
                        style={{ padding: '0.25rem 0.45rem', color: 'hsl(0 80% 60%)' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })}
              {cosmetics.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'hsl(220 10% 50%)', border: '1px dashed hsl(220 15% 15%)', borderRadius: 16 }}>
                  No cosmetic items cataloged.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN TOOLS */}
      {activeTab === 'tools' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.5rem', color: 'white' }}>🔧 Administrative Utilities</h2>
            <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Run system utilities to audit, repair, and sync player states across the platform.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid hsl(220 15% 18%)', paddingTop: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '0.25rem' }}>Rebuild & Sync Cosmetic Unlocks</h3>
                <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                  Iterates through all registered user profiles, recalculates user levels based on their current XP, sums total match wins, and automatically re-awards any missing progression cosmetics (e.g., Neon Frame, Rainbow Sparkles, level-based frames/titles).
                </p>
                <button
                  className="btn"
                  onClick={async () => {
                    if (!confirm('Are you sure you want to run the unlock recovery tool? This will inspect all user accounts.')) return
                    setRunningTools(true)
                    setToolsResult(null)
                    try {
                      const res = await fetch('/admin/tools/rebuild-unlocks', { method: 'POST' })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Execution failed')
                      setToolsResult(data)
                      addToast('success', 'Recovery Complete', 'User progression awards rebuilt successfully!')
                    } catch (e: any) {
                      addToast('error', 'Execution Error', e.message)
                    } finally {
                      setRunningTools(false)
                    }
                  }}
                  disabled={runningTools}
                  style={{
                    background: runningTools ? 'hsl(220 10% 25%)' : 'hsl(220 100% 50%)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: runningTools ? 'not-allowed' : 'pointer'
                  }}
                >
                  {runningTools ? 'Running audit...' : 'Execute Recovery Tool'}
                </button>
              </div>

              {toolsResult && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'hsl(220 15% 12%)',
                  border: '1px solid hsl(220 15% 18%)',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  maxHeight: '250px',
                  overflowY: 'auto',
                  color: 'hsl(120 100% 75%)'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: 'white' }}>Result Summary:</div>
                  <div>Status: Success</div>
                  <div>Message: {toolsResult.message}</div>
                  <div>Profiles Rebuilt/Audited: {toolsResult.rebuiltCount}</div>
                  {toolsResult.details && toolsResult.details.length > 0 ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ textDecoration: 'underline', marginBottom: '0.25rem', color: 'hsl(220 100% 80%)' }}>Details:</div>
                      {toolsResult.details.map((d: any, idx: number) => (
                        <div key={idx} style={{ marginBottom: '0.25rem' }}>
                          • {d.username} (Lvl {d.oldLevel} → {d.newLevel}, Wins: {d.totalWins}): Unlocked: [{d.unlockedItems.join(', ')}]
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: '0.5rem', color: 'hsl(220 10% 55%)' }}>No missing cosmetic awards detected. All users are in sync.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
