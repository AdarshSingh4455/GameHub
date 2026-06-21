import React from 'react'

export interface CandyPieceProps {
  color: string | null
  special: 'row' | 'column' | 'area' | 'color' | null
  blocker: 'ice' | 'stone' | 'lock' | 'double_lock' | 'crate' | null
  size?: number
  isSelected?: boolean
  isHovered?: boolean
}

export const CandyPiece: React.FC<CandyPieceProps> = ({
  color,
  special,
  blocker,
  size = 50,
  isSelected = false,
  isHovered = false,
}) => {
  // Common styling classes for animations
  const baseScale = isSelected ? 'scale-110' : isHovered ? 'scale-105' : 'scale-100'
  const transitionClass = 'transition-transform duration-200 ease-out'

  // Colors & Gradients
  const getGradients = () => (
    <defs>
      <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff5e62" />
        <stop offset="100%" stopColor="#ff1e27" />
      </linearGradient>
      <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </linearGradient>
      <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#059669" />
      </linearGradient>
      <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="100%" stopColor="#7c3aed" />
      </linearGradient>
      <linearGradient id="grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0891b2" />
      </linearGradient>
      <linearGradient id="grad-orange" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
      <linearGradient id="grad-stone" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#78716c" />
        <stop offset="100%" stopColor="#44403c" />
      </linearGradient>
      <linearGradient id="grad-crate" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
      <linearGradient id="grad-ruby" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fca5a5" />
        <stop offset="100%" stopColor="#dc2626" />
      </linearGradient>
      
      {/* Glow filters */}
      <filter id="glow-light" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )

  const renderBaseCandy = () => {
    switch (color) {
      case 'red':
        return (
          // Heart shape
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="url(#grad-red)"
            filter="drop-shadow(0px 2px 3px rgba(239, 68, 68, 0.4))"
          />
        )
      case 'blue':
        return (
          // Tear Drop shape
          <path
            d="M12 2.5C8.13 8.08 5.5 12.08 5.5 15c0 3.59 2.91 6.5 6.5 6.5s6.5-2.91 6.5-6.5c0-2.92-2.63-6.92-6.5-12.5z"
            fill="url(#grad-blue)"
            filter="drop-shadow(0px 2px 3px rgba(37, 99, 235, 0.4))"
          />
        )
      case 'green':
        return (
          // Hexagon gem
          <path
            d="M12 2L21.5 7.5v11L12 22L2.5 18.5v-11L12 2z"
            fill="url(#grad-green)"
            filter="drop-shadow(0px 2px 3px rgba(16, 185, 129, 0.4))"
          />
        )
      case 'yellow':
        return (
          // Star candy
          <path
            d="M12 2l2.6 6.3 6.9 1-5 4.9 1.2 6.8-5.7-3.6-5.7 3.6 1.2-6.8-5-4.9 6.9-1L12 2z"
            fill="url(#grad-yellow)"
            filter="drop-shadow(0px 2px 3px rgba(245, 158, 11, 0.4))"
          />
        )
      case 'purple':
        return (
          // Oval gem
          <ellipse
            cx="12"
            cy="12"
            rx="7.5"
            ry="9.5"
            fill="url(#grad-purple)"
            filter="drop-shadow(0px 2px 3px rgba(139, 92, 246, 0.4))"
          />
        )
      case 'cyan':
        return (
          // Sharp diamond
          <path
            d="M12 2L21.5 12L12 22L2.5 12L12 2z"
            fill="url(#grad-cyan)"
            filter="drop-shadow(0px 2px 3px rgba(6, 182, 212, 0.4))"
          />
        )
      case 'orange':
        return (
          // Swirl slice candy
          <g>
            <circle cx="12" cy="12" r="9.5" fill="url(#grad-orange)" filter="drop-shadow(0px 2px 3px rgba(249, 115, 22, 0.4))" />
            <circle cx="12" cy="12" r="7.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 12 4 L 12 20 M 4 12 L 20 12 M 6.3 6.3 L 17.7 17.7 M 6.3 17.7 L 17.7 6.3" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          </g>
        )
      default:
        return null
    }
  }

  // Draw Special Layers
  const renderSpecialOverlay = () => {
    if (!special) return null

    if (special === 'row') {
      return (
        // Horizontal stripes
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-light)">
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="6" y1="8" x2="18" y2="8" strokeOpacity="0.6" strokeWidth="1.5" />
          <line x1="6" y1="16" x2="18" y2="16" strokeOpacity="0.6" strokeWidth="1.5" />
        </g>
      )
    }

    if (special === 'column') {
      return (
        // Vertical stripes
        <g stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-light)">
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="8" y1="6" x2="8" y2="18" strokeOpacity="0.6" strokeWidth="1.5" />
          <line x1="16" y1="6" x2="16" y2="18" strokeOpacity="0.6" strokeWidth="1.5" />
        </g>
      )
    }

    if (special === 'area') {
      return (
        // Area Bomb: wrapped candy styling
        <g>
          {/* Glowing ring */}
          <circle cx="12" cy="12" r="11" fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3,2" filter="url(#glow-light)" />
          {/* Bow ties on sides */}
          <path d="M 1 12 L 4 8 L 4 16 Z M 23 12 L 20 8 L 20 16 Z" fill="#eab308" opacity="0.8" />
        </g>
      )
    }

    if (special === 'color') {
      return (
        // Color bomb: rainbow disco ball overrides the base candy
        <g>
          <radialGradient id="rainbow-grad" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#f43f5e" />
            <stop offset="55%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#10b981" />
            <stop offset="90%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </radialGradient>
          <circle cx="12" cy="12" r="10" fill="url(#rainbow-grad)" filter="drop-shadow(0px 2px 4px rgba(255,255,255,0.35))" />
          {/* Sparkles */}
          <path d="M12 5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" fill="#ffffff" transform="scale(0.6) translate(6, 6)" />
          <path d="M12 5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" fill="#ffffff" transform="scale(0.4) translate(30, 20)" />
          <path d="M12 5l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" fill="#ffffff" transform="scale(0.5) translate(10, 30)" />
        </g>
      )
    }

    return null
  }

  // Draw Blocker Layers
  const renderBlocker = () => {
    if (!blocker) return null

    switch (blocker) {
      case 'ice':
        return (
          // Ice: shiny blue transparent block overlay
          <g>
            <rect x="1.5" y="1.5" width="21" height="21" rx="4" fill="rgba(186, 230, 253, 0.45)" stroke="#7dd3fc" strokeWidth="1.5" />
            {/* Crack lines */}
            <path d="M 3 3 L 8 9 L 14 6 M 21 21 L 16 14 L 11 17 M 4 20 L 9 13" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="1" fill="none" />
            {/* Ice shine */}
            <path d="M 4 4 L 10 4 L 4 10 Z" fill="rgba(255,255,255,0.4)" />
          </g>
        )
      case 'stone':
        return (
          // Stone: solid brick wall look
          <g>
            <rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="url(#grad-stone)" stroke="#292524" strokeWidth="2" />
            {/* Brick divisions */}
            <line x1="1.5" y1="12" x2="22.5" y2="12" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="12" y1="1.5" x2="12" y2="12" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="6" y1="12" x2="6" y2="22.5" stroke="#1c1917" strokeWidth="1.5" />
            <line x1="18" y1="12" x2="18" y2="22.5" stroke="#1c1917" strokeWidth="1.5" />
          </g>
        )
      case 'lock':
      case 'double_lock':
        const isDouble = blocker === 'double_lock'
        return (
          // Padlock overlay
          <g transform="translate(4, 4) scale(0.65)" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.5))">
            {/* Padlock loop */}
            <path d="M6 10V6c0-3.3 2.7-6 6-6s6 2.7 6 6v4" fill="none" stroke={isDouble ? 'url(#grad-ruby)' : 'url(#grad-gold)'} strokeWidth="3" />
            {/* Padlock body */}
            <rect x="2" y="9" width="20" height="15" rx="3" fill={isDouble ? 'url(#grad-ruby)' : 'url(#grad-gold)'} stroke={isDouble ? '#7f1d1d' : '#854d0e'} strokeWidth="1" />
            {/* Keyhole */}
            <circle cx="12" cy="15" r="2" fill="#1e293b" />
            <path d="M12 17v4" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        )
      case 'crate':
        return (
          // Crate: wooden crate planks
          <g>
            <rect x="2" y="2" width="20" height="20" fill="url(#grad-crate)" stroke="#451a03" strokeWidth="2" />
            {/* Diagonal planks */}
            <line x1="2" y1="2" x2="22" y2="22" stroke="#451a03" strokeWidth="1.5" />
            <line x1="2" y1="22" x2="22" y2="2" stroke="#451a03" strokeWidth="1.5" />
            {/* Border lines */}
            <rect x="4" y="4" width="16" height="16" fill="none" stroke="#451a03" strokeWidth="1" />
          </g>
        )
      default:
        return null
    }
  }

  // selection highlight ring
  const renderSelectionOutline = () => {
    if (!isSelected) return null
    return (
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="5"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="2"
        style={{ filter: 'drop-shadow(0px 0px 4px #3b82f6)' }}
        className="animate-pulse"
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={`${transitionClass} ${baseScale}`}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {getGradients()}
        {special === 'color' ? null : renderBaseCandy()}
        {renderSpecialOverlay()}
        {renderBlocker()}
        {renderSelectionOutline()}
      </svg>
    </div>
  )
}
