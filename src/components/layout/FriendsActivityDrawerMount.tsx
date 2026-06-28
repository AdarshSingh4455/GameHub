'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

const FriendsActivityDrawer = dynamic(
  () => import('@/components/layout/FriendsActivityDrawer'),
  { ssr: false }
)

export default function FriendsActivityDrawerMount({ show }: { show: boolean }) {
  const [isGameplayActive, setIsGameplayActive] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleGameplayEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ active: boolean }>
      setIsGameplayActive(!!customEvent.detail?.active)
    }

    window.addEventListener('gamehub_gameplay', handleGameplayEvent)
    return () => {
      window.removeEventListener('gamehub_gameplay', handleGameplayEvent)
    }
  }, [])

  // Path-based fallback for redundancy and direct load support
  const isGameplayPath = 
    (pathname.startsWith('/dashboard/games/') && pathname !== '/dashboard/games') ||
    pathname.startsWith('/dashboard/multiplayer/play/')

  const hideDrawer = isGameplayActive || isGameplayPath

  if (!show || hideDrawer) return null
  return <FriendsActivityDrawer />
}
