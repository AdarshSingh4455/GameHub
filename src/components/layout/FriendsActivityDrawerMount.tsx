'use client'

import dynamic from 'next/dynamic'

const FriendsActivityDrawer = dynamic(
  () => import('@/components/layout/FriendsActivityDrawer'),
  { ssr: false }
)

export default function FriendsActivityDrawerMount({ show }: { show: boolean }) {
  if (!show) return null
  return <FriendsActivityDrawer />
}
