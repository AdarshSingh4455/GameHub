import React from 'react'
import { GAMES_REGISTRY } from '@/lib/games'

interface GameIconProps {
  slug: string
  size?: number
  className?: string
}

export const GameIcon: React.FC<GameIconProps> = ({ slug, size = 40, className }) => {
  if (slug === 'neon-tetris') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
      >
        <defs>
          <filter id="neon-glow-tetris" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Glow T-shape tetromino */}
        <g filter="url(#neon-glow-tetris)">
          {/* Top Block */}
          <rect x="16" y="6" width="8" height="8" rx="1.5" fill="#f43f5e" stroke="#fda4af" strokeWidth="1" />
          {/* Middle Block */}
          <rect x="6" y="16" width="8" height="8" rx="1.5" fill="#3b82f6" stroke="#93c5fd" strokeWidth="1" />
          {/* Center Block */}
          <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#f43f5e" stroke="#fda4af" strokeWidth="1" />
          {/* Right Block */}
          <rect x="26" y="16" width="8" height="8" rx="1.5" fill="#10b981" stroke="#6ee7b7" strokeWidth="1" />
        </g>
        {/* Inner highlights for neon block look */}
        <path d="M 8 18 L 12 18" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" opacity="0.6" />
        <path d="M 18 8 L 22 8" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" opacity="0.6" />
        <path d="M 18 18 L 22 18" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" opacity="0.6" />
        <path d="M 28 18 L 32 18" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" opacity="0.6" />
      </svg>
    )
  }

  if (slug === 'ai-infinite-candy-crush') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'inline-block', verticalAlign: 'middle' }}
      >
        <defs>
          <linearGradient id="candy-icon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>
        {/* Left wrap end */}
        <path d="M 6 20 L 15 12 L 15 28 Z" fill="url(#candy-icon-grad)" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.3))" />
        {/* Right wrap end */}
        <path d="M 34 20 L 25 12 L 25 28 Z" fill="url(#candy-icon-grad)" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.3))" />
        {/* Center circle candy */}
        <circle cx="20" cy="20" r="9" fill="url(#candy-icon-grad)" stroke="#ffffff" strokeWidth="1.5" style={{ filter: 'drop-shadow(0px 2px 4px rgba(244, 63, 94, 0.55))' }} />
        {/* Swirl stripe inside */}
        <path d="M 14 20 Q 20 14 26 20" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      </svg>
    )
  }

  // Fallback to game registry emoji
  const game = GAMES_REGISTRY.find(g => g.slug === slug)
  return (
    <span
      className={className}
      style={{
        fontSize: `${size * 0.7}px`,
        lineHeight: 1,
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    >
      {game?.emoji || '🎮'}
    </span>
  )
}
export default GameIcon
