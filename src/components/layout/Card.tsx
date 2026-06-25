'use client'

import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  id?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  variant?: 'default' | 'glass' | 'elevated'
}

export default function Card({ children, className = '', style, id, onClick, variant = 'default' }: CardProps) {
  const baseClass = {
    default: 'bg-[hsl(var(--bg-surface))] border border-[hsl(var(--border-subtle))]',
    glass: 'card glass bg-[hsl(var(--bg-surface)/0.8)] backdrop-blur-md border border-[hsl(var(--border-subtle))]',
    elevated: 'bg-[hsl(var(--bg-elevated))] border border-[hsl(var(--border-subtle))] shadow-lg'
  }[variant]

  return (
    <div
      id={id}
      onClick={onClick}
      className={`w-full rounded-[var(--radius-lg)] p-4 md:p-5 transition-all duration-300 ${onClick ? 'cursor-pointer hover:border-[hsl(var(--brand-primary)/0.4)] hover:shadow-[var(--shadow-glow-primary)]' : ''} ${baseClass} ${className}`}
      style={{
        boxSizing: 'border-box',
        ...style
      }}
    >
      {children}
    </div>
  )
}
