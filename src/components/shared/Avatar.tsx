'use client'

import React from 'react'

interface AvatarProps {
  avatarUrl?: string | null
  username?: string
  selectedFrame?: string | null
  size?: number
  className?: string
}

export default function Avatar({
  avatarUrl,
  username = 'Player',
  selectedFrame,
  size = 40,
  className = ''
}: AvatarProps) {
  // Normalize frame name
  const frameLower = selectedFrame ? selectedFrame.toLowerCase().replace(' frame', '').trim() : ''

  // Inline styling for the border size/inset relative to the avatar size
  const borderWidth = selectedFrame ? Math.max(2, Math.round(size * 0.08)) : 0
  const outerSize = size + borderWidth * 2

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : '??'

  // Map normalized frame names to CSS classes
  const frameClass = frameLower ? `frame-${frameLower}` : ''

  return (
    <div
      className={`avatar-container ${frameClass} ${className}`}
      style={{
        position: 'relative',
        width: outerSize,
        height: outerSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease',
        padding: selectedFrame ? `${borderWidth}px` : '0px'
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'hsl(220 20% 12%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 2
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <span
            style={{
              fontSize: `${Math.max(10, Math.round(size * 0.38))}px`,
              fontWeight: 800,
              color: 'hsl(220 100% 70%)'
            }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  )
}
