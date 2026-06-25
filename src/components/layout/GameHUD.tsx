'use client'

import React from 'react'

interface GameHUDProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
}

export default function GameHUD({ children, className = '', style, id }: GameHUDProps) {
  return (
    <div
      id={id}
      className={`card glass w-full flex items-center justify-between p-3 md:p-4 rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--bg-surface)/0.85)] backdrop-blur-md gap-3 ${className}`}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  )
}
