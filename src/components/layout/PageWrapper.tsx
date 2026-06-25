'use client'

import React, { useState, useEffect } from 'react'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

export default function PageWrapper({ children, className = '', style, id }: PageWrapperProps) {
  const [mounted, setMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    const checkMobile = () => setIsMobile(window.innerWidth <= 767)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // If mobile, strip out layout-constraining inline styles so CSS classes take over.
  const cleanedStyle = (mounted && isMobile && style)
    ? {
        ...style,
        maxWidth: undefined,
        margin: undefined,
        marginInline: undefined,
        marginInlineStart: undefined,
        marginInlineEnd: undefined,
      }
    : style

  return (
    <div
      id={id}
      className={`w-full min-w-0 px-4 py-4 md:py-6 flex flex-col gap-4 md:gap-6 ${className}`}
      style={{
        boxSizing: 'border-box',
        ...cleanedStyle
      }}
    >
      {children}
    </div>
  )
}
