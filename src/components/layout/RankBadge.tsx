import React from 'react'
import { getRankDetails } from '@/lib/rankedUtils'

interface RankBadgeProps {
  mmr: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  mmr,
  size = 'md',
  showLabel = false,
}) => {
  const details = getRankDetails(mmr)

  // Size mapping
  const sizePx = {
    sm: 24,
    md: 44,
    lg: 80,
  }[size]

  const labelFontSize = {
    sm: '0.65rem',
    md: '0.8rem',
    lg: '1.1rem',
  }[size]

  // Render specific SVG paths per rank category
  const renderBadgeIcon = () => {
    switch (details.rank) {
      case 'Bronze':
        return (
          // Shield shape
          <path
            d="M12 2L2 5v6c0 5.5 4.5 10 10 12 5.5-2 10-6.5 10-12V5l-10-3z"
            fill="url(#badge-bronze-grad)"
            stroke="#78350f"
            strokeWidth="1.5"
          />
        )
      case 'Silver':
        return (
          // Double chevron shield
          <g>
            <path
              d="M12 2L3 6v6c0 5 4 9.5 9 11 5-1.5 9-6 9-11V6l-9-4z"
              fill="url(#badge-silver-grad)"
              stroke="#475569"
              strokeWidth="1.5"
            />
            <path d="M7 11l5 4 5-4" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
          </g>
        )
      case 'Gold':
        return (
          // Crown / Winged shield
          <g>
            <path
              d="M12 2L3 6v6c0 5 4 9.5 9 11 5-1.5 9-6 9-11V6l-9-4z"
              fill="url(#badge-gold-grad)"
              stroke="#854d0e"
              strokeWidth="1.5"
            />
            {/* Crown inside */}
            <path d="M8 15l2-5 2 3 2-3 2 5Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />
          </g>
        )
      case 'Platinum':
        return (
          // Gem facet pentagon
          <g>
            <path
              d="M12 2L22 9.5L18.2 21.5H5.8L2 9.5L12 2z"
              fill="url(#badge-plat-grad)"
              stroke="#0f766e"
              strokeWidth="1.5"
            />
            {/* Glowing crystal facets */}
            <path d="M12 2L12 21.5 M2 9.5h20 M5.8 21.5L12 9.5L18.2 21.5" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          </g>
        )
      case 'Diamond':
        return (
          // Diamond crystal shape
          <g>
            <path
              d="M12 2L21.5 10L12 22L2.5 10L12 2z"
              fill="url(#badge-diamond-grad)"
              stroke="#0369a1"
              strokeWidth="1.5"
            />
            {/* Highlights */}
            <path d="M12 2L12 22 M2.5 10h19 M6.5 10L12 2L17.5 10L12 22Z" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          </g>
        )
      case 'Master':
        return (
          // Hexagram core with rings
          <g>
            {/* Outer ring */}
            <circle cx="12" cy="12" r="9" fill="none" stroke="url(#badge-master-grad)" strokeWidth="1.5" />
            {/* Inner star */}
            <path
              d="M12 3l2.5 6.2 6.5.6-4.9 4.5 1.5 6.4-5.6-3.4-5.6 3.4 1.5-6.4-4.9-4.5 6.5-.6L12 3z"
              fill="url(#badge-master-grad)"
              stroke="#581c87"
              strokeWidth="1"
            />
          </g>
        )
      case 'Grandmaster':
        return (
          // Blazing star crest
          <g filter="url(#badge-glow-gm)">
            {/* Flame spikes */}
            <path d="M12 1L15 8L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 8Z" fill="url(#badge-gm-grad)" stroke="#7f1d1d" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4.5" fill="#fef08a" stroke="#dc2626" strokeWidth="1" />
          </g>
        )
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: `drop-shadow(0 2px 6px ${details.glowColor})`,
          transition: 'transform 0.3s ease',
        }}
        className="hover:scale-110"
      >
        <defs>
          <linearGradient id="badge-bronze-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <linearGradient id="badge-silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="badge-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="badge-plat-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="50%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#115e59" />
          </linearGradient>
          <linearGradient id="badge-diamond-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="badge-master-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#581c87" />
          </linearGradient>
          <linearGradient id="badge-gm-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
          <filter id="badge-glow-gm" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {renderBadgeIcon()}
      </svg>
      {showLabel && (
        <span
          style={{
            fontSize: labelFontSize,
            fontWeight: 800,
            color: details.badgeColor,
            textShadow: `0 0 10px ${details.glowColor}`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: '0.1rem',
          }}
        >
          {details.label}
        </span>
      )}
    </div>
  )
}
export default RankBadge
