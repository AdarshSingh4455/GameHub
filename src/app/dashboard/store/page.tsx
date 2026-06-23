'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { prefetchProfileDetails } from '@/lib/prefetch'
import Avatar from '@/components/shared/Avatar'

interface StoreItem {
  id: string
  name: string
  type: 'AVATAR' | 'CHAT_PACK' | 'SCRATCHER' | 'AVATAR_FRAME' | 'BOARD_THEME' | 'TITLE' | 'EFFECT'
  priceCoins: number
  assetUrl: string | null
  metadata: any
}

const CATEGORIES = [
  { id: 'SCRATCHER', label: 'Scratchers', emoji: '🃏' },
  { id: 'CRATES', label: 'Mystery Crates', emoji: '🎁' },
  { id: 'TITLE', label: 'Titles', emoji: '⚡' },
  { id: 'EFFECT', label: 'Effects', emoji: '✨' },
  { id: 'AVATAR_FRAME', label: 'Frames', emoji: '🖼️' },
  { id: 'CHAT_PACK', label: 'Chat Packs', emoji: '💬' },
  { id: 'PERK', label: 'Lobby Perks', emoji: '🛡️' }
]

export default function StorePage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [activeCategory, setActiveCategory] = useState<string>('SCRATCHER')
  const [items, setItems] = useState<StoreItem[]>([])
  const [ownedIds, setOwnedIds] = useState<string[]>([])
  const [coins, setCoins] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [equippingId, setEquippingId] = useState<string | null>(null)

  // Live Preview States
  const [profile, setProfile] = useState<any>(null)
  const [previewedTitle, setPreviewedTitle] = useState<string | null>(null)
  const [previewedFrame, setPreviewedFrame] = useState<string | null>(null)
  const [previewedEffect, setPreviewedEffect] = useState<string | null>(null)

  // Scratcher Minigame State
  const [scratchingAd, setScratchingAd] = useState<StoreItem | null>(null)
  const [scratcherReward, setScratcherReward] = useState<any | null>(null)
  const [scratchPercent, setScratchPercent] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scratchStateRef = useRef({ isDrawing: false, lastX: 0, lastY: 0, scratchedPixels: new Set<string>() })

  const fetchProfileDetails = () => {
    fetch('/api/profile/details')
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile)
          setPreviewedTitle(data.profile.selectedTitle)
          setPreviewedFrame(data.profile.selectedFrame)
          setPreviewedEffect(data.profile.selectedEffect)
        }
      })
      .catch(console.error)
  }

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
      fetchProfileDetails()
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
      
      // Simulate a guest profile
      const guestProfile = {
        username: 'GuestUser',
        avatarUrl: null,
        selectedTitle: null,
        selectedFrame: null,
        selectedEffect: null
      }
      setProfile(guestProfile)
    }
  }

  useEffect(() => {
    fetchStoreData()
    prefetchProfileDetails()

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

    if (item.type === ('CRATES' as any)) {
      setBuyingId(item.id)
      try {
        const crateType = item.id.replace('crate-', '').toUpperCase()
        const res = await fetch('/api/store/crates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crateType })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Crate opening failed')
        
        addToast(
          'success',
          'Crate Opened! 🎁',
          `You opened a ${item.name} and received: ${data.reward.name}!`
        )
        fetchStoreData()
        window.dispatchEvent(new Event('gamehub_xp_update'))
      } catch (err: any) {
        addToast('error', 'Crate Failed', err.message)
      } finally {
        setBuyingId(null)
      }
      return
    }

    if (item.id === 'perk-streak-protect') {
      setBuyingId(item.id)
      try {
        const res = await fetch('/api/profile/streak-protect', {
          method: 'POST'
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Purchase failed')
        
        addToast('success', 'Streak Protection Active! 🛡️', 'Streak protection is active on your profile.')
        fetchStoreData()
        window.dispatchEvent(new Event('gamehub_xp_update'))
      } catch (err: any) {
        addToast('error', 'Purchase Failed', err.message)
      } finally {
        setBuyingId(null)
      }
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

  // Equip handler
  const handleEquip = async (item: StoreItem, action: 'equip' | 'unequip') => {
    if (!user) {
      const field = item.type === 'TITLE' ? 'selectedTitle'
                  : item.type === 'AVATAR_FRAME' ? 'selectedFrame'
                  : item.type === 'EFFECT' ? 'selectedEffect'
                  : item.type === 'CHAT_PACK' ? 'selectedChatPack'
                  : 'selectedTheme'
      const val = action === 'equip' ? item.name : null
      
      const updatedProfile = { ...profile, [field]: val }
      setProfile(updatedProfile)
      if (item.type === 'TITLE') setPreviewedTitle(val)
      if (item.type === 'AVATAR_FRAME') setPreviewedFrame(val)
      if (item.type === 'EFFECT') setPreviewedEffect(val)
      
      addToast('success', 'Cosmetic Updated', `${item.name} ${action === 'equip' ? 'equipped' : 'unequipped'}!`)
      return
    }

    setEquippingId(item.id)
    try {
      const res = await fetch('/api/profile/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Equip failed')

      addToast('success', 'Cosmetic Updated', `${item.name} ${action === 'equip' ? 'equipped' : 'unequipped'}!`)
      fetchProfileDetails()
    } catch (err: any) {
      addToast('error', 'Action Failed', err.message)
    } finally {
      setEquippingId(null)
    }
  }

  const handlePreview = (item: StoreItem) => {
    if (item.type === 'TITLE') {
      setPreviewedTitle(item.name)
    } else if (item.type === 'AVATAR_FRAME') {
      setPreviewedFrame(item.name)
    } else if (item.type === 'EFFECT') {
      setPreviewedEffect(item.name)
    }
    addToast('success', 'Preview Updated', `Previewing ${item.name} on your card!`)
  }

  // Visual frame borders
  const getFrameBorder = (frameName: string) => {
    if (frameName.includes('Bronze')) return '4px solid #cd7f32'
    if (frameName.includes('Silver')) return '4px solid #c0c0c0'
    if (frameName.includes('Gold')) return '4px solid #ffd700'
    if (frameName.includes('Diamond')) return '4px solid #00ffff'
    if (frameName.includes('Mythic')) return '4px dashed #ff007f'
    return '2px solid rgba(255,255,255,0.1)'
  }

  const getFrameShadow = (frameName: string) => {
    if (frameName.includes('Diamond')) return '0 0 10px #00ffff'
    if (frameName.includes('Mythic')) return '0 0 15px #ff007f'
    return 'none'
  }

  const getEffectGradient = (effectName: string) => {
    if (effectName.includes('Confetti')) return 'radial-gradient(circle, #ff007f 10%, #00ffff 60%, transparent 100%)'
    if (effectName.includes('Lightning')) return 'radial-gradient(circle, #00ffff 20%, #0000ff 70%, transparent 100%)'
    if (effectName.includes('Golden')) return 'radial-gradient(circle, #ffd700 20%, #ff8c00 70%, transparent 100%)'
    if (effectName.includes('Fire')) return 'radial-gradient(circle, #ff4500 20%, #ff0000 70%, transparent 100%)'
    if (effectName.includes('Sparkles')) return 'radial-gradient(circle, #ffd700 10%, #ffffff 50%, transparent 100%)'
    if (effectName.includes('Diamond')) return 'radial-gradient(circle, #00ffff 20%, #7fffd4 70%, transparent 100%)'
    if (effectName.includes('Royal')) return 'radial-gradient(circle, #8a2be2 20%, #dda0dd 70%, transparent 100%)'
    return 'none'
  }

  // --- SCRATCH CARD LOGIC ---
  useEffect(() => {
    if (!scratchingAd || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 280
    canvas.height = 160

    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    gradient.addColorStop(0, '#B0B5BC')
    gradient.addColorStop(0.5, '#E1E4E8')
    gradient.addColorStop(1, '#8A919A')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

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

    for (let i = 0; i < imageData.data.length; i += 32) {
      if (imageData.data[i + 3] === 0) {
        transparentCount++
      }
    }

    const percent = Math.round((transparentCount / (totalPixels / 8)) * 100)
    setScratchPercent(percent)

    if (percent > 45) {
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

  let activeCategoryItems = items.filter((item) => item.type === activeCategory)
  if (activeCategory === 'CRATES') {
    activeCategoryItems = [
      {
        id: 'crate-bronze',
        name: 'Bronze Mystery Crate',
        type: 'CRATES' as any,
        priceCoins: 50,
        assetUrl: null,
        metadata: { description: 'Contains common rewards, XP (30-80), and low chances of cosmetics.' }
      },
      {
        id: 'crate-silver',
        name: 'Silver Mystery Crate',
        type: 'CRATES' as any,
        priceCoins: 100,
        assetUrl: null,
        metadata: { description: 'Unlocks rare rewards, moderate XP (60-150), and decent cosmetics.' }
      },
      {
        id: 'crate-gold',
        name: 'Gold Mystery Crate',
        type: 'CRATES' as any,
        priceCoins: 250,
        assetUrl: null,
        metadata: { description: 'Epic loot chest filled with XP (150-400) and high cosmetic odds.' }
      },
      {
        id: 'crate-mythic',
        name: 'Mythic Mystery Crate',
        type: 'CRATES' as any,
        priceCoins: 500,
        assetUrl: null,
        metadata: { description: 'The ultimate container! Huge XP (300-1000) and guaranteed epic cosmetics.' }
      }
    ]
  } else if (activeCategory === 'PERK') {
    activeCategoryItems = [
      {
        id: 'perk-streak-protect',
        name: 'Streak Protection',
        type: 'PERK' as any,
        priceCoins: 100,
        assetUrl: null,
        metadata: { description: 'Protects your daily login streak from resetting if you miss a day.' }
      }
    ]
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0 0.75rem' }} className="animate-fadeIn safe-bottom-padding">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.12; }
          50% { opacity: 0.22; }
        }
      `}</style>

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

      {/* Interactive Preview Card Mockup */}
      <div className="card glass" style={{
        padding: '1.25rem',
        borderRadius: 20,
        background: 'linear-gradient(135deg, hsl(222 25% 10%), hsl(222 20% 7%))',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '0.75rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
      }}>
        {previewedEffect && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: getEffectGradient(previewedEffect),
            opacity: 0.12,
            pointerEvents: 'none',
            zIndex: 0,
            animation: 'pulse-slow 3s infinite'
          }} />
        )}

        <div style={{ zIndex: 1 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Avatar & Profile Preview
          </span>
        </div>

        <div style={{ zIndex: 1 }}>
          <Avatar
            avatarUrl={profile?.avatarUrl}
            username={profile?.username || 'Guest'}
            selectedFrame={previewedFrame}
            size={80}
          />
        </div>

        <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {profile?.username || 'GuestUser'}
          </div>
          {previewedTitle && (
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: 'hsl(45 100% 60%)',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              padding: '0.2rem 0.65rem',
              borderRadius: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'inline-block',
              marginTop: '4px'
            }}>
              🏆 {previewedTitle}
            </span>
          )}
          {previewedEffect && (
            <span style={{ fontSize: '0.68rem', color: 'hsl(210 100% 65%)', fontWeight: 700, marginTop: '2px', display: 'block' }}>
              ✨ Effect: {previewedEffect}
            </span>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="category-chips-container" style={{ borderBottom: '1px solid hsl(220 15% 18%)', marginBottom: '1rem' }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`category-chip ${isActive ? 'active' : ''}`}
              id={`store-category-${cat.id}`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Redesigned Compact Loader */}
      {loading ? (
        <div className="card glass" style={{
          height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'hsl(210 100% 65%)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Loading Store Catalog...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Items Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: activeCategory === 'CRATES'
              ? 'repeat(auto-fill, minmax(140px, 1fr))'
              : 'repeat(2, 1fr)',
            gap: activeCategory === 'CRATES' ? '0.65rem' : '0.75rem',
            justifyContent: 'center'
          }} className="store-items-grid stagger">
            {activeCategoryItems.map((item) => {
              const owned = item.id === 'perk-streak-protect' ? !!profile?.streakProtectionActive : ownedIds.includes(item.id)
              const rarity = item.metadata?.rarity || 'COMMON'
              const rarityColors: any = {
                COMMON: 'hsl(220 10% 55%)',
                RARE: 'hsl(220 100% 70%)',
                EPIC: 'hsl(270 80% 70%)',
                LEGENDARY: 'hsl(45 100% 60%)',
              }

              // Determine if cosmetic is active/equipped
              let isEquipped = false
              if (item.type === 'TITLE') {
                isEquipped = profile?.selectedTitle === item.name
              } else if (item.type === 'AVATAR_FRAME') {
                isEquipped = profile?.selectedFrame === item.name
              } else if (item.type === 'EFFECT') {
                isEquipped = profile?.selectedEffect === item.name
              } else if (item.type === 'CHAT_PACK') {
                isEquipped = profile?.selectedChatPack === item.name
              } else if (item.type === 'BOARD_THEME') {
                isEquipped = profile?.selectedTheme === item.name
              } else if (item.id === 'perk-streak-protect') {
                isEquipped = !!profile?.streakProtectionActive
              }

              // Can preview frames, effects, and titles
              const canPreview = ['TITLE', 'AVATAR_FRAME', 'EFFECT'].includes(item.type)

              // Calculate milestone requirements
              let requirementText = ''
              let requirementMet = true
              let progressPercentage = 100
              let progressLabel = ''

              if (item.type === 'AVATAR_FRAME') {
                const minLevel = item.metadata?.minLevel
                if (minLevel !== undefined && minLevel !== null) {
                  const currentLevel = profile?.level || 1
                  requirementMet = currentLevel >= minLevel
                  requirementText = `Requires Level ${minLevel}`
                  progressPercentage = Math.min(100, Math.round((currentLevel / minLevel) * 100))
                  progressLabel = `Level ${currentLevel}/${minLevel}`
                }
              } else if (item.type === 'TITLE') {
                const minWins = item.metadata?.minWins
                if (minWins !== undefined && minWins !== null) {
                  const currentWins = profile?.gameStats?.reduce((sum: number, g: any) => sum + g.winCount, 0) || 0
                  requirementMet = currentWins >= minWins
                  requirementText = `Requires ${minWins} Wins`
                  progressPercentage = Math.min(100, Math.round((currentWins / minWins) * 100))
                  progressLabel = `Wins ${currentWins}/${minWins}`
                }
              }

              return (
                <div
                  key={item.id}
                  className="card card-hover"
                  style={{
                    padding: activeCategory === 'CRATES' ? '0.75rem' : '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: activeCategory === 'CRATES' ? '0.5rem' : '0.75rem',
                    borderRadius: 16,
                    background: 'hsl(222 18% 12% / 0.95)',
                    border: '1px solid hsl(220 15% 20%)',
                    borderColor: isEquipped ? 'hsl(142 70% 50% / 0.6)' : owned ? 'hsl(210 100% 50% / 0.4)' : !requirementMet ? 'hsl(0 80% 40% / 0.3)' : 'hsl(220 15% 20%)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  id={`store-item-${item.id}`}
                >
                  {/* Item preview icon */}
                  <div style={{
                    width: activeCategory === 'CRATES' ? 48 : 64,
                    height: activeCategory === 'CRATES' ? 48 : 64,
                    borderRadius: 12,
                    background: 'hsl(220 20% 7%)',
                    border: '1px solid hsl(220 15% 18%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    overflow: 'hidden',
                  }}>
                    {item.type === 'TITLE' ? (
                      '⚡'
                    ) : item.type === 'EFFECT' ? (
                      '✨'
                    ) : item.type === 'AVATAR_FRAME' ? (
                      '🖼️'
                    ) : item.type === 'CHAT_PACK' ? (
                      '💬'
                    ) : item.type === 'SCRATCHER' ? (
                      '🃏'
                    ) : (
                      '📦'
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                    {/* Badge */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                      {item.type === ('CRATES' as any) ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'hsl(270 80% 50%)', color: 'white', textTransform: 'uppercase' }}>
                          Consumable
                        </span>
                      ) : isEquipped ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'hsl(142 70% 45%)', color: 'black', textTransform: 'uppercase' }}>
                          {item.id === 'perk-streak-protect' ? 'Active' : 'Equipped'}
                        </span>
                      ) : owned ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'hsl(210 100% 55%)', color: 'white', textTransform: 'uppercase' }}>
                          Owned
                        </span>
                      ) : !requirementMet ? (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'hsl(0 80% 40%)', color: 'white', textTransform: 'uppercase' }}>
                          Locked
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'hsl(220 10% 40%)', color: 'white', textTransform: 'uppercase' }}>
                          Claimable
                        </span>
                      )}
                    </div>

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

                    {/* Requirement Progress Bar */}
                    {requirementText && !owned && (
                      <div style={{ marginTop: '6px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'hsl(220 10% 50%)', marginBottom: '3px' }}>
                          <span>{requirementText}</span>
                          <span style={{ fontWeight: 'bold' }}>{progressLabel}</span>
                        </div>
                        <div style={{ height: '4px', background: 'hsl(220 20% 7%)', borderRadius: 99, overflow: 'hidden', width: '100%' }}>
                          <div style={{ width: `${progressPercentage}%`, height: '100%', background: requirementMet ? 'hsl(142 70% 50%)' : 'hsl(220 100% 60%)', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {isEquipped ? (
                      <button
                        id={`store-item-unequip-${item.id}`}
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEquip(item, 'unequip')}
                        disabled={equippingId === item.id || item.id === 'perk-streak-protect'}
                        style={{ width: '100%', borderRadius: 12, fontSize: '0.75rem', padding: '0.4rem' }}
                      >
                        {item.id === 'perk-streak-protect' ? 'Protected' : equippingId === item.id ? 'Saving...' : 'Unequip'}
                      </button>
                    ) : owned ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canPreview && (
                          <button
                            id={`store-item-preview-${item.id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handlePreview(item)}
                            style={{ flex: 1, borderRadius: 12, fontSize: '0.7rem', padding: '0.4rem' }}
                          >
                            👁️ Preview
                          </button>
                        )}
                        <button
                          id={`store-item-equip-${item.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEquip(item, 'equip')}
                          disabled={equippingId === item.id}
                          style={{ flex: canPreview ? 1.5 : 1, borderRadius: 12, fontSize: '0.75rem', padding: '0.4rem' }}
                        >
                          {equippingId === item.id ? 'Equipping...' : 'Equip'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canPreview && (
                          <button
                            id={`store-item-preview-${item.id}`}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handlePreview(item)}
                            style={{ flex: 1, borderRadius: 12, fontSize: '0.7rem', padding: '0.4rem' }}
                          >
                            👁️ Preview
                          </button>
                        )}
                        <button
                          id={`store-item-buy-${item.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleBuy(item)}
                          disabled={buyingId === item.id || !requirementMet}
                          style={{
                            flex: canPreview ? 1.5 : 1,
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            padding: '0.4rem',
                            background: !requirementMet ? 'hsl(220 15% 15%)' : undefined,
                            borderColor: !requirementMet ? 'hsl(220 15% 20%)' : undefined,
                            color: !requirementMet ? 'hsl(220 10% 40%)' : undefined
                          }}
                        >
                          {buyingId === item.id ? 'Unlocking...' : !requirementMet ? 'Locked' : item.priceCoins === 0 ? '🎁 Unlock' : `💰 ${item.priceCoins}`}
                        </button>
                      </div>
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
