'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

interface StoreItem {
  id: string
  name: string
  type: 'AVATAR' | 'CHAT_PACK' | 'SCRATCHER' | 'AVATAR_FRAME' | 'BOARD_THEME' | 'TITLE'
  priceCoins: number
  assetUrl: string | null
  metadata: any
}

const CATEGORIES = [
  { id: 'AVATAR', label: 'Avatars', emoji: '👤' },
  { id: 'CHAT_PACK', label: 'Chat Packs', emoji: '💬' },
  { id: 'SCRATCHER', label: 'Scratchers', emoji: '🃏' },
  { id: 'TITLE', label: 'Titles', emoji: '⚡', comingSoon: true },
  { id: 'EFFECT', label: 'Effects', emoji: '✨', comingSoon: true },
]

export default function StorePage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [activeCategory, setActiveCategory] = useState<string>('AVATAR')
  const [items, setItems] = useState<StoreItem[]>([])
  const [ownedIds, setOwnedIds] = useState<string[]>([])
  const [coins, setCoins] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  // Scratcher Minigame State
  const [scratchingAd, setScratchingAd] = useState<StoreItem | null>(null)
  const [scratcherReward, setScratcherReward] = useState<any | null>(null)
  const [scratchPercent, setScratchPercent] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scratchStateRef = useRef({ isDrawing: false, lastX: 0, lastY: 0, scratchedPixels: new Set<string>() })

  const fetchStoreData = () => {
    setLoading(true)
    if (user) {
      fetch('/api/store/items')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          setItems(data.items || [])
          setOwnedIds(data.ownedIds || [])
          setCoins(data.userCoins || 0)
          setLoading(false)
        })
        .catch(() => {
          addToast('error', 'Error', 'Failed to load store catalog.')
          setLoading(false)
        })
    } else {
      // Simulate store for guest
      const guestCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)
      setCoins(guestCoins)

      // Fetch items from endpoint but simulate ownership locally
      fetch('/api/store/items')
        .then((res) => res.json())
        .then((data) => {
          setItems(data.items || [])
          const guestInventory = JSON.parse(localStorage.getItem('gamehub_guest_inventory') || '[]')
          setOwnedIds(guestInventory)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }

  useEffect(() => {
    fetchStoreData()

    const handleUpdate = () => {
      fetchStoreData()
    }
    window.addEventListener('gamehub_xp_update', handleUpdate)
    return () => window.removeEventListener('gamehub_xp_update', handleUpdate)
  }, [user])

  // Purchase handler
  const handleBuy = async (item: StoreItem) => {
    if (coins < item.priceCoins) {
      addToast('error', 'Insufficient Coins', `You need ${item.priceCoins} coins to buy this item.`)
      return
    }

    setBuyingId(item.id)

    if (user) {
      try {
        const res = await fetch('/api/store/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cosmeticItemId: item.id }),
        })
        const data = await res.json()

        if (!res.ok) throw new Error(data.error || 'Purchase failed')

        if (item.type === 'SCRATCHER') {
          // Open Scratcher minigame!
          setScratchingAd(item)
          setScratcherReward(data.reward)
          setCoins(data.userCoins)
          window.dispatchEvent(new Event('gamehub_xp_update'))
        } else {
          addToast('success', 'Purchase Complete', `You bought ${item.name}!`)
          fetchStoreData()
          window.dispatchEvent(new Event('gamehub_xp_update'))
        }
      } catch (err: any) {
        addToast('error', 'Purchase Failed', err.message)
      } finally {
        setBuyingId(null)
      }
    } else {
      // Guest local purchase
      const nextCoins = coins - item.priceCoins
      localStorage.setItem('gamehub_guest_coins', nextCoins.toString())
      setCoins(nextCoins)

      if (item.type === 'SCRATCHER') {
        // Mock a reward for guest
        const mockPrizes = [
          { type: 'coins', value: 30, name: '30 Coins' },
          { type: 'xp', value: 50, name: '50 XP' },
          { type: 'cosmetic', name: 'Cyber Bot Avatar', item: { name: 'Cyber Bot Avatar', id: 'cyber-bot' } }
        ] as any[]
        const prize = mockPrizes[Math.floor(Math.random() * mockPrizes.length)]
        
        if (prize.type === 'coins') {
          localStorage.setItem('gamehub_guest_coins', (nextCoins + (prize.value || 0)).toString())
        } else if (prize.type === 'xp') {
          const currentXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
          localStorage.setItem('gamehub_guest_xp', (currentXP + (prize.value || 0)).toString())
        } else {
          const inventory = JSON.parse(localStorage.getItem('gamehub_guest_inventory') || '[]')
          if (!inventory.includes('cyber-bot')) {
            inventory.push('cyber-bot')
            localStorage.setItem('gamehub_guest_inventory', JSON.stringify(inventory))
          }
        }

        setScratchingAd(item)
        setScratcherReward(prize)
        addToast('success', 'Purchased Scratcher', `Charged ${item.priceCoins} coins. Scratch now!`)
      } else {
        const inventory = JSON.parse(localStorage.getItem('gamehub_guest_inventory') || '[]')
        inventory.push(item.id)
        localStorage.setItem('gamehub_guest_inventory', JSON.stringify(inventory))
        addToast('success', 'Purchase Complete [GUEST]', `You bought ${item.name}!`)
        fetchStoreData()
      }
      window.dispatchEvent(new Event('gamehub_xp_update'))
      setBuyingId(null)
    }
  }

  // --- SCRATCH CARD LOGIC ---
  useEffect(() => {
    if (!scratchingAd || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup canvas resolution and fill
    canvas.width = 280
    canvas.height = 160

    // Fill with silver scratch layer
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#B0B5BC')
    gradient.addColorStop(0.5, '#E1E4E8')
    gradient.addColorStop(1, '#8A919A')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw some glitter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3, 3)
    }

    ctx.fillStyle = 'hsl(220 20% 18%)'
    ctx.font = '800 13px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SCRATCH HERE 🤞', canvas.width / 2, canvas.height / 2)

    setScratchPercent(0)
    scratchStateRef.current = { isDrawing: false, lastX: 0, lastY: 0, scratchedPixels: new Set() }
  }, [scratchingAd])

  const checkScratchPercentage = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const totalPixels = imageData.data.length / 4
    let transparentCount = 0

    // Sample every 8th pixel to speed up calculation
    for (let i = 0; i < imageData.data.length; i += 32) {
      if (imageData.data[i + 3] === 0) {
        transparentCount++
      }
    }

    const percent = Math.round((transparentCount / (totalPixels / 8)) * 100)
    setScratchPercent(percent)

    if (percent > 45) {
      // Auto-clear scratch layer
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setScratchPercent(100)
    }
  }

  const handleScratchStart = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    
    scratchStateRef.current.isDrawing = true
    scratchStateRef.current.lastX = clientX - rect.left
    scratchStateRef.current.lastY = clientY - rect.top
  }

  const handleScratchMove = (e: React.MouseEvent | React.TouchEvent) => {
    const state = scratchStateRef.current
    const canvas = canvasRef.current
    if (!state.isDrawing || !canvas) return

    e.preventDefault()

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const x = clientX - rect.left
    const y = clientY - rect.top

    // Draw scratch path using destination-out to clear the silver fill
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.lineWidth = 26
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(state.lastX, state.lastY)
    ctx.lineTo(x, y)
    ctx.stroke()

    state.lastX = x
    state.lastY = y

    checkScratchPercentage(ctx, canvas)
  }

  const handleScratchEnd = () => {
    scratchStateRef.current.isDrawing = false
  }

  const activeCategoryItems = items.filter((item) => item.type === activeCategory)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="animate-fadeIn">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.8rem)', fontWeight: 800, marginBottom: '0.25rem' }}>🪙 Coin Store</h1>
          <p style={{ color: 'hsl(220 10% 55%)', margin: 0, fontSize: '0.85rem' }}>Purchase cosmetics with your hard-earned coins. No real money required.</p>
        </div>
        <div style={{ background: 'hsl(45 100% 50% / 0.12)', border: '1px solid hsl(45 100% 50% / 0.25)', padding: '0.45rem 1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.2rem' }}>💰</span>
          <span style={{ fontSize: '1rem', fontWeight: 900, color: 'hsl(45 100% 60%)' }} id="store-user-coins">{coins.toLocaleString()} Coins</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="category-chips-container" style={{ borderBottom: '1px solid hsl(220 15% 18%)', marginBottom: '1rem' }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => !cat.comingSoon && setActiveCategory(cat.id)}
              className={`category-chip ${isActive ? 'active' : ''}`}
              style={{
                cursor: cat.comingSoon ? 'not-allowed' : 'pointer',
                opacity: cat.comingSoon ? 0.4 : 1,
              }}
              id={`store-category-${cat.id}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              {cat.comingSoon && <span style={{ fontSize: '0.55rem', padding: '0.1rem 0.3rem', borderRadius: 4, background: 'hsl(220 20% 10%)', color: 'hsl(220 10% 40%)', marginLeft: '4px' }}>CS</span>}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'hsl(220 10% 50%)' }}>Loading store catalog...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Items Grid (Mobile first: 2 columns max) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', justifyContent: 'center' }} className="stagger">
            {activeCategoryItems.map((item) => {
              const owned = ownedIds.includes(item.id)
              const rarity = item.metadata?.rarity || 'COMMON'
              const rarityColors: any = {
                COMMON: 'hsl(220 10% 55%)',
                RARE: 'hsl(220 100% 70%)',
                EPIC: 'hsl(270 80% 70%)',
                LEGENDARY: 'hsl(45 100% 60%)',
              }

              return (
                <div
                  key={item.id}
                  className="card card-hover"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '0.75rem',
                    borderRadius: 16,
                    background: 'hsl(222 18% 12% / 0.95)',
                    border: '1px solid hsl(220 15% 20%)',
                    borderColor: owned ? 'hsl(142 70% 50% / 0.35)' : 'hsl(220 15% 20%)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  id={`store-item-${item.id}`}
                >
                  {/* Item preview icon */}
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    background: 'hsl(220 20% 7%)',
                    border: '1px solid hsl(220 15% 18%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    overflow: 'hidden',
                  }}>
                    {item.type === 'AVATAR' && item.assetUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.assetUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : item.type === 'AVATAR' ? (
                      '👤'
                    ) : item.type === 'CHAT_PACK' ? (
                      '💬'
                    ) : item.type === 'SCRATCHER' ? (
                      '🃏'
                    ) : (
                      '📦'
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                      {item.name}
                    </div>
                    {item.metadata?.description ? (
                      <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', minHeight: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                        {item.metadata.description}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', minHeight: 14 }}>
                        Store cosmetic item
                      </div>
                    )}
                    {item.type === 'SCRATCHER' && (
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: rarityColors[rarity], textTransform: 'uppercase', marginTop: '0.1rem' }}>
                        {rarity}
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', width: '100%' }}>
                    {owned ? (
                      <button className="btn btn-secondary btn-sm" disabled style={{ width: '100%', borderRadius: 12, background: 'hsl(142 70% 50% / 0.08)', color: 'hsl(142 70% 55%)', borderColor: 'transparent', cursor: 'not-allowed', fontSize: '0.75rem' }}>
                        Purchased ✓
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleBuy(item)}
                        disabled={buyingId === item.id}
                        style={{ width: '100%', borderRadius: 12, fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                      >
                        {buyingId === item.id ? 'Buying...' : `💰 ${item.priceCoins}`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {activeCategoryItems.length === 0 && (
              <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 45%)', fontSize: '0.85rem' }}>
                No items available in this category yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- INTERACTIVE SCRATCHER CARD MODAL --- */}
      {scratchingAd && scratcherReward && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.92)',
            zIndex: 100002,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          className="animate-fadeIn"
        >
          <div
            className="card glass"
            style={{
              width: '100%',
              maxWidth: 340,
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              textAlign: 'center',
              boxShadow: '0 10px 45px rgba(0,0,0,0.8), 0 0 25px hsl(45 100% 55% / 0.15)',
              borderRadius: 24,
              border: '1px solid hsl(45 100% 55% / 0.3)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(45 100% 60%)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                🃏 Scratcher Ticket
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', margin: '0.15rem 0' }}>
                {scratchingAd.name}
              </h2>
              <p style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)' }}>
                Scratch with your cursor or finger to reveal your surprise!
              </p>
            </div>

            {/* Scratcher Canvas container */}
            <div style={{ position: 'relative', width: 280, height: 160, borderRadius: 16, overflow: 'hidden', border: '2px solid hsl(220 15% 20%)', background: 'hsl(222 20% 7%)' }}>
              
              {/* Prize underneath */}
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '1rem',
                zIndex: 0,
              }} className="animate-fadeIn">
                <span style={{ fontSize: '2.8rem' }}>
                  {scratcherReward.type === 'coins' ? '🪙' : scratcherReward.type === 'xp' ? '✨' : scratcherReward.type === 'badge' ? '🏅' : '👤'}
                </span>
                <strong style={{ fontSize: '1.1rem', color: 'hsl(45 100% 60%)' }}>
                  {scratcherReward.name}
                </strong>
                <span style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)' }}>
                  Added to your profile
                </span>
              </div>

              {/* Scratch canvas overlay */}
              <canvas
                ref={canvasRef}
                onMouseDown={handleScratchStart}
                onMouseMove={handleScratchMove}
                onMouseUp={handleScratchEnd}
                onMouseLeave={handleScratchEnd}
                onTouchStart={handleScratchStart}
                onTouchMove={handleScratchMove}
                onTouchEnd={handleScratchEnd}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                  cursor: 'crosshair',
                  touchAction: 'none',
                  opacity: scratchPercent >= 100 ? 0 : 1,
                  transition: 'opacity 0.5s ease',
                }}
              />
            </div>

            {/* Scratch progress */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'hsl(220 10% 50%)', marginBottom: '0.2rem' }}>
                <span>Scratched</span>
                <span>{scratchPercent}%</span>
              </div>
              <div style={{ height: 4, background: 'hsl(220 20% 8%)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: `${scratchPercent}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 60%), hsl(270 80% 60%))', borderRadius: 99 }} />
              </div>
            </div>

            {scratchPercent >= 100 ? (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setScratchingAd(null)
                  setScratcherReward(null)
                  fetchStoreData()
                }}
                style={{ width: '100%', borderRadius: 12 }}
                id="scratcher-claim-btn"
              >
                🎉 Claim Reward!
              </button>
            ) : (
              <button className="btn btn-secondary" disabled style={{ width: '100%', borderRadius: 12, opacity: 0.5 }}>
                Scratch more to claim
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
