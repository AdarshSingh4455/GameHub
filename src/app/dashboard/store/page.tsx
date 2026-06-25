'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useToast } from '@/lib/contexts/ToastContext'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { prefetchProfileDetails } from '@/lib/prefetch'
import Avatar from '@/components/shared/Avatar'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/layout/Card'

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

const LOCKED_PREVIEWS: Record<string, Array<{
  name: string
  priceCoins: number
  requirement: string
  emoji: string
}>> = {
  TITLE: [
    { name: 'Cosmic Title', priceCoins: 150, requirement: 'Reach Level 15', emoji: '⚡' },
    { name: 'Shadow Warrior', priceCoins: 80, requirement: 'Purchase in Store', emoji: '⚡' },
    { name: 'Game Legend', priceCoins: 500, requirement: 'Win 100 Matches', emoji: '⚡' },
    { name: 'Speed Demon', priceCoins: 120, requirement: 'Solve Memory Match in 15s', emoji: '⚡' }
  ],
  AVATAR_FRAME: [
    { name: 'Neon Frame', priceCoins: 100, requirement: 'Reach Level 5', emoji: '🖼️' },
    { name: 'Prestige Border', priceCoins: 250, requirement: 'Reach Level 10', emoji: '🖼️' },
    { name: 'Ruby Glow', priceCoins: 350, requirement: 'Reach Level 25', emoji: '🖼️' },
    { name: 'Champion Frame', priceCoins: 450, requirement: 'Win 50 Matches', emoji: '🖼️' }
  ],
  EFFECT: [
    { name: 'Thunder Effect', priceCoins: 300, requirement: 'Open in Rare Mystery Crate', emoji: '✨' },
    { name: 'Cosmic Trail', priceCoins: 200, requirement: 'Reach Level 15', emoji: '✨' },
    { name: 'Rainbow Sparkles', priceCoins: 150, requirement: 'Daily Rewards streak 7', emoji: '✨' },
    { name: 'Golden Aura', priceCoins: 400, requirement: 'Reach Level 50', emoji: '✨' }
  ]
}

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
  
  // Crate Opening Animation States
  const [openingCrate, setOpeningCrate] = useState<StoreItem | null>(null)
  const [crateAnimStep, setCrateAnimStep] = useState<number>(0)
  const [crateReward, setCrateReward] = useState<any | null>(null)
  const crateTimersRef = useRef<any[]>([])

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
        selectedTitle: localStorage.getItem('gamehub_guest_selected_title') || null,
        selectedFrame: localStorage.getItem('gamehub_guest_selected_frame') || null,
        selectedEffect: localStorage.getItem('gamehub_guest_selected_effect') || null,
        selectedTheme: localStorage.getItem('gamehub_guest_selected_theme') || null,
        selectedChatPack: localStorage.getItem('gamehub_guest_selected_chat_pack') || null
      }
      setProfile(guestProfile)
      setPreviewedTitle(guestProfile.selectedTitle)
      setPreviewedFrame(guestProfile.selectedFrame)
      setPreviewedEffect(guestProfile.selectedEffect)
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
        
        // Open the visual crate opening sequence modal
        setOpeningCrate(item)
        setCrateReward(data.reward)
        setCrateAnimStep(1) // Step 1: Modal open / Crate visible

        // Reset and clear any old timers
        crateTimersRef.current.forEach(clearTimeout)
        crateTimersRef.current = []

        // Sequence timeouts
        const t1 = setTimeout(() => {
          setCrateAnimStep(2) // Step 2: Crate shakes
        }, 500)

        const t2 = setTimeout(() => {
          setCrateAnimStep(3) // Step 3: Radial glow aura turns on
        }, 1400)

        const t3 = setTimeout(() => {
          setCrateAnimStep(4) // Step 4: Crate scales up
        }, 2200)

        const t4 = setTimeout(() => {
          setCrateAnimStep(5) // Step 5: Crate bursts open
        }, 2800)

        const t5 = setTimeout(() => {
          setCrateAnimStep(6) // Step 6: Reveal reward card
        }, 3400)

        const t6 = setTimeout(() => {
          setCrateAnimStep(7) // Step 7: Done (and trigger canvas confetti)
        }, 3800)

        crateTimersRef.current.push(t1, t2, t3, t4, t5, t6)

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

  const handleSkipCrateAnimation = () => {
    crateTimersRef.current.forEach(clearTimeout)
    crateTimersRef.current = []
    setCrateAnimStep(7)
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
      
      const storageKey = item.type === 'TITLE' ? 'gamehub_guest_selected_title'
                       : item.type === 'AVATAR_FRAME' ? 'gamehub_guest_selected_frame'
                       : item.type === 'EFFECT' ? 'gamehub_guest_selected_effect'
                       : item.type === 'CHAT_PACK' ? 'gamehub_guest_selected_chat_pack'
                       : 'gamehub_guest_selected_theme'
      if (val) {
        localStorage.setItem(storageKey, val)
      } else {
        localStorage.removeItem(storageKey)
      }

      const updatedProfile = { ...profile, [field]: val }
      setProfile(updatedProfile)
      if (item.type === 'TITLE') setPreviewedTitle(val)
      if (item.type === 'AVATAR_FRAME') setPreviewedFrame(val)
      if (item.type === 'EFFECT') setPreviewedEffect(val)

      // Dispatch event to sync sidebar layout
      window.dispatchEvent(new Event('gamehub_xp_update'))
      
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
    <>
      <PageWrapper style={{ maxWidth: 640, marginInline: 'auto', gap: '1.25rem' }} className="animate-fadeIn safe-bottom-padding mobile-centered-wrapper">
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
      <Card variant="glass" style={{
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
      </Card>

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
        <Card variant="glass" style={{
          height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '10px', border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'hsl(210 100% 65%)',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)', fontWeight: 600 }}>Loading Store Catalog...</span>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Items Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '0.5rem',
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
                <Card
                  key={item.id}
                  style={{
                    padding: '0.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '0.4rem',
                    background: 'hsl(222 18% 12% / 0.95)',
                    borderColor: isEquipped ? 'hsl(142 70% 50% / 0.6)' : owned ? 'hsl(210 100% 50% / 0.4)' : !requirementMet ? 'hsl(0 80% 40% / 0.3)' : 'hsl(220 15% 20%)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  id={`store-item-${item.id}`}
                >
                  {/* Item preview icon */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'hsl(220 20% 7%)',
                    border: '1px solid hsl(220 15% 18%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
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

                    <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%' }}>
                      {item.name}
                    </div>
                    {item.metadata?.description ? (
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', minHeight: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                        {item.metadata.description}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 55%)', minHeight: 14 }}>
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
                    ) : (owned || (!user && (item.type as string) !== 'SCRATCHER' && (item.type as string) !== 'CRATES')) ? (
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
                </Card>
              )
            })}
            {activeCategoryItems.length === 0 && (
              ['TITLE', 'AVATAR_FRAME', 'EFFECT'].includes(activeCategory) ? (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', alignItems: 'center' }}>
                  <Card variant="glass" style={{ padding: '2rem 1rem', textAlign: 'center', background: 'hsl(220 20% 10% / 0.6)', borderStyle: 'dashed' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
                    <h3 style={{ fontWeight: 800, fontSize: '1.15rem', color: 'white', margin: '0 0 0.25rem 0' }}>No items unlocked yet</h3>
                    <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 55%)', margin: 0 }}>Unlock locked items by leveling up or opening mystery crates!</p>
                  </Card>
                  
                  <div style={{ width: '100%' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'hsl(220 10% 45%)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>
                      Available Unlockables Preview
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', width: '100%' }}>
                      {(LOCKED_PREVIEWS[activeCategory] || []).map((preview, i) => (
                        <Card 
                          key={i} 
                          variant="glass" 
                          style={{ 
                            padding: '1rem', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            textAlign: 'center', 
                            gap: '0.5rem',
                            border: '1px solid hsl(220 15% 16%)',
                            background: 'hsl(220 20% 8% / 0.8)'
                          }}
                        >
                          <div style={{ fontSize: '1.75rem', position: 'relative' }}>
                            {activeCategory === 'TITLE' && <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'hsl(45 100% 55%)', border: '1px solid hsl(45 100% 40%)', background: 'hsl(45 100% 50% / 0.15)', padding: '0.15rem 0.5rem', borderRadius: 6, textTransform: 'uppercase' }}>{preview.name.replace(' Title', '')}</span>}
                            {activeCategory === 'AVATAR_FRAME' && (
                              <div style={{ width: 48, height: 48, borderRadius: '50%', border: preview.name.includes('Neon') ? '3px solid hsl(220 100% 60%)' : '3px solid hsl(45 100% 55%)', boxShadow: preview.name.includes('Neon') ? '0 0 10px hsl(220 100% 60%)' : '0 0 10px hsl(45 100% 55%)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(220 20% 12%)' }}>
                                👤
                              </div>
                            )}
                            {activeCategory === 'EFFECT' && <span style={{ textShadow: '0 0 10px currentColor' }}>{preview.name.includes('Thunder') ? '⚡' : preview.name.includes('Rainbow') ? '🌈' : '✨'}</span>}
                            <span style={{ position: 'absolute', bottom: -5, right: -5, fontSize: '0.85rem' }}>🔒</span>
                          </div>
                          
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'white', marginTop: '0.25rem' }}>{preview.name}</div>
                          
                          <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 50%)', minHeight: 28 }}>
                            {preview.requirement}
                          </div>
                          
                          <div style={{ width: '100%', padding: '0.35rem', background: 'hsl(220 20% 12%)', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, color: 'hsl(45 100% 55%)' }}>
                            💰 {preview.priceCoins} Coins
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'hsl(220 10% 45%)', fontSize: '0.85rem' }}>
                  No items available in this category yet.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </PageWrapper>

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
                  {scratcherReward.type === 'coins' ? '🪙' : scratcherReward.type === 'xp' ? '✨' : scratcherReward.type === 'badge' ? '🏅' : scratcherReward.type === 'crate' ? '🎁' : '👤'}
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

      {/* --- CRATE OPENING ANIMATION SYSTEM MODAL --- */}
      {openingCrate && crateAnimStep > 0 && crateReward && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.95)',
            zIndex: 100003,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(12px)',
          }}
          className="animate-fadeIn"
        >
          {/* Confetti canvas on Step 7 */}
          {crateAnimStep === 7 && (
            <CrateConfettiCanvas />
          )}

          <div
            className="card glass"
            style={{
              width: '100%',
              maxWidth: 400,
              padding: '2.5rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2rem',
              textAlign: 'center',
              borderRadius: 28,
              border: '1px solid hsl(45 100% 55% / 0.25)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 0 40px hsl(45 100% 55% / 0.1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Step 3: Radial glowing background */}
            {crateAnimStep >= 3 && crateAnimStep < 6 && (
              <div
                style={{
                  position: 'absolute',
                  width: '280px',
                  height: '280px',
                  background: 'radial-gradient(circle, hsl(45 100% 55% / 0.25) 0%, transparent 70%)',
                  borderRadius: '50%',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
                className="crate-glow-anim"
              />
            )}

            {/* Crate Visual representation */}
            {crateAnimStep < 6 ? (
              <div
                style={{
                  position: 'relative',
                  width: 140,
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                  transition: 'transform 0.4s ease',
                  transform: crateAnimStep === 4 ? 'scale(1.3)' : crateAnimStep === 5 ? 'scale(0.1)' : 'scale(1)'
                }}
                className={crateAnimStep === 2 ? 'crate-shake-anim' : ''}
              >
                {/* Visual design for the box based on type */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 16,
                    background: getCrateBg(openingCrate.id),
                    border: `3px solid ${getCrateBorderColor(openingCrate.id)}`,
                    boxShadow: `0 0 20px ${getCrateGlowColor(openingCrate.id)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    position: 'relative',
                  }}
                >
                  🎁
                  {/* Lock badge or emblem */}
                  <span style={{ position: 'absolute', bottom: -5, right: -5, background: '#1e293b', border: '1px solid #475569', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🔑</span>
                </div>
              </div>
            ) : (
              /* Step 6 & 7: Reveal Reward Card */
              <div
                className="animate-scaleUp"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.25rem',
                  zIndex: 1,
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 950, color: 'hsl(45 100% 60%)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  🔓 ITEM UNLOCKED!
                </div>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: 'hsl(222 20% 7%)',
                    border: '3px solid hsl(45 100% 55%)',
                    boxShadow: '0 0 25px hsl(45 100% 55% / 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4.5rem',
                  }}
                >
                  {crateReward.type === 'coins' ? '🪙' : crateReward.type === 'xp' ? '✨' : '👤'}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 950, color: 'white', margin: 0 }}>
                    {crateReward.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem' }}>
                    Type: <strong style={{ textTransform: 'uppercase', color: 'hsl(220 100% 70%)' }}>{crateReward.type}</strong>
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Burst Particles overlay */}
            {crateAnimStep === 5 && (
              <div
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
                className="crate-burst-anim"
              >
                {/* 15 floating particles */}
                {Array.from({ length: 15 }).map((_, i) => {
                  const angle = (i * 2 * Math.PI) / 15
                  const x = Math.cos(angle) * 120
                  const y = Math.sin(angle) * 120
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getCrateBorderColor(openingCrate.id),
                        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                        opacity: 0.8,
                        transition: 'transform 0.5s ease, opacity 0.5s ease',
                      }}
                    />
                  )
                })}
              </div>
            )}

            {/* Actions / Skip Button */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 3 }}>
              {crateAnimStep < 6 ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSkipCrateAnimation}
                  style={{ borderRadius: 12 }}
                >
                  ⏭️ Skip Animation
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setOpeningCrate(null)
                    setCrateReward(null)
                    setCrateAnimStep(0)
                  }}
                  style={{ borderRadius: 12, width: '100%' }}
                >
                  🎉 Awesomeness!
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Crate Animation Helpers & Subcomponents
function getCrateBg(id: string): string {
  if (id.includes('bronze')) return 'linear-gradient(135deg, #3f2a1d, #6e473b)'
  if (id.includes('silver')) return 'linear-gradient(135deg, #4b5563, #9ca3af)'
  if (id.includes('gold')) return 'linear-gradient(135deg, #78350f, #eab308)'
  return 'linear-gradient(135deg, #581c87, #c084fc)'
}

function getCrateBorderColor(id: string): string {
  if (id.includes('bronze')) return '#cd7f32'
  if (id.includes('silver')) return '#cbd5e1'
  if (id.includes('gold')) return '#fbbf24'
  return '#a855f7'
}

function getCrateGlowColor(id: string): string {
  if (id.includes('bronze')) return 'rgba(205, 127, 50, 0.2)'
  if (id.includes('silver')) return 'rgba(203, 213, 225, 0.25)'
  if (id.includes('gold')) return 'rgba(251, 191, 36, 0.4)'
  return 'rgba(168, 85, 247, 0.5)'
}

function CrateConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const colors = ['#FFD700', '#FFA500', '#FF5722', '#00E5FF', '#76FF03', '#E040FB', '#FF1744']
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.05 + 0.02,
      tiltAngle: 0,
      speed: Math.random() * 3 + 4,
    }))

    const drawConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleIncremental
        p.y += p.speed
        p.x += Math.sin(p.tiltAngle) * 0.5

        ctx.beginPath()
        ctx.lineWidth = p.r
        ctx.strokeStyle = p.color
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y)
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2)
        ctx.stroke()

        if (p.y > canvas.height) {
          particles[idx] = {
            ...p,
            x: Math.random() * canvas.width,
            y: -10,
            tilt: Math.random() * 10 - 5,
            tiltAngle: 0,
          }
        }
      })
      animationId = requestAnimationFrame(drawConfetti)
    }

    drawConfetti()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100004,
        width: '100vw',
        height: '100vh',
      }}
    />
  )
}
