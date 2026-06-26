import React from 'react'
import { GAMES_REGISTRY } from '@/lib/games'

interface GameIconProps {
  slug: string
  size?: number
  className?: string
}

export const GameIcon: React.FC<GameIconProps> = ({ slug, size = 40, className }) => {
  // Common style variables for consistent look
  const strokeColor = '#ffffff'
  const accentColor = 'hsl(220 100% 65%)' // Premium brand blue
  const secondaryAccent = 'hsl(270 85% 65%)' // Brand purple
  const successColor = 'hsl(142 75% 45%)' // Success green

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
        <g filter="url(#neon-glow-tetris)">
          <rect x="16" y="6" width="8" height="8" rx="1.5" fill="#f43f5e" stroke="#fda4af" strokeWidth="1" />
          <rect x="6" y="16" width="8" height="8" rx="1.5" fill="#3b82f6" stroke="#93c5fd" strokeWidth="1" />
          <rect x="16" y="16" width="8" height="8" rx="1.5" fill="#f43f5e" stroke="#fda4af" strokeWidth="1" />
          <rect x="26" y="16" width="8" height="8" rx="1.5" fill="#10b981" stroke="#6ee7b7" strokeWidth="1" />
        </g>
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
        <path d="M 6 20 L 15 12 L 15 28 Z" fill="url(#candy-icon-grad)" />
        <path d="M 34 20 L 25 12 L 25 28 Z" fill="url(#candy-icon-grad)" />
        <circle cx="20" cy="20" r="9" fill="url(#candy-icon-grad)" stroke="#ffffff" strokeWidth="1.5" />
        <path d="M 14 20 Q 20 14 26 20" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      </svg>
    )
  }

  // 1. Hand Cricket Icon
  if (slug === 'cricket') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path d="M 12 30 L 26 12 C 27 11 29 11 30 12 C 31 13 31 15 30 16 L 16 34" stroke={accentColor} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 10 32 L 6 36" stroke={strokeColor} strokeWidth="3" strokeLinecap="round" />
        <circle cx="28" cy="28" r="4.5" fill={secondaryAccent} stroke="#ffffff" strokeWidth="1" />
        <path d="M 28 23.5 C 26 25 26 31 28 32.5" stroke="#ffffff" strokeWidth="0.75" strokeLinecap="round" />
      </svg>
    )
  }

  // 2. Dots & Boxes Icon
  if (slug === 'dots-boxes') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Connection lines */}
        <line x1="12" y1="12" x2="28" y2="12" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="12" y1="12" x2="12" y2="28" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" />
        {/* Dots grid */}
        <circle cx="12" cy="12" r="3.5" fill="#ffffff" />
        <circle cx="28" cy="12" r="3.5" fill="#ffffff" />
        <circle cx="12" cy="28" r="3.5" fill="#ffffff" />
        <circle cx="28" cy="28" r="3.5" fill="rgba(255,255,255,0.4)" />
        {/* Drawing Pencil */}
        <path d="M 32 32 L 24 24 L 20 28 L 22 32 Z" fill="#ffffff" stroke={strokeColor} strokeWidth="0.75" />
        <path d="M 20 28 L 18 30 L 22 32 Z" fill={accentColor} />
      </svg>
    )
  }

  // 3. Tic-Tac-Toe Icon
  if (slug === 'tic-tac-toe') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Grid lines */}
        <line x1="16" y1="8" x2="16" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="24" y1="8" x2="24" y2="32" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="8" y1="16" x2="32" y2="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <line x1="8" y1="24" x2="32" y2="24" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        {/* Neon X */}
        <path d="M 9 9 L 15 15 M 15 9 L 9 15" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Neon O */}
        <circle cx="28" cy="28" r="3.5" stroke={secondaryAccent} strokeWidth="2.5" />
      </svg>
    )
  }

  // 4. Memory Match Icon
  if (slug === 'memory') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Card 1 */}
        <rect x="8" y="10" width="12" height="18" rx="2" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" />
        <circle cx="14" cy="19" r="2.5" fill="#ffffff" />
        {/* Card 2 (slightly offset and matching) */}
        <rect x="20" y="12" width="12" height="18" rx="2" fill="rgba(255,255,255,0.05)" stroke={secondaryAccent} strokeWidth="2" />
        <circle cx="26" cy="21" r="2.5" fill="#ffffff" />
      </svg>
    )
  }

  // 5. Rock Paper Scissors Icon
  if (slug === 'rps') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Rock */}
        <circle cx="14" cy="16" r="4.5" fill="none" stroke={accentColor} strokeWidth="2" />
        {/* Scissors */}
        <path d="M 23 11 L 29 17 M 29 11 L 23 17" stroke={secondaryAccent} strokeWidth="2" strokeLinecap="round" />
        {/* Paper (Flat hand representation) */}
        <rect x="13" y="24" width="14" height="8" rx="1.5" fill="none" stroke={successColor} strokeWidth="2" />
      </svg>
    )
  }

  // 6. Number Guessing Icon
  if (slug === 'number-guessing') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <circle cx="20" cy="20" r="12" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="8" stroke={accentColor} strokeWidth="1.5" />
        {/* Numbers overlay */}
        <text x="17" y="24" fill="#ffffff" fontSize="12" fontWeight="900" fontFamily="sans-serif">?</text>
        <text x="8" y="15" fill={secondaryAccent} fontSize="8" fontWeight="700" fontFamily="sans-serif">9</text>
        <text x="29" y="15" fill={successColor} fontSize="8" fontWeight="700" fontFamily="sans-serif">3</text>
      </svg>
    )
  }

  // 7. Scribble Icon
  if (slug === 'scribble') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Artist Palette */}
        <path d="M 28 26 C 30 22 30 14 26 10 C 22 6 12 6 9 12 C 6 18 8 28 16 30 C 18 30.5 20 29.5 21 28 C 22 26.5 24 26 26 27 C 27 27.5 27.5 27 28 26 Z" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" />
        {/* Paint Wells */}
        <circle cx="12" cy="12" r="2.2" fill={secondaryAccent} />
        <circle cx="18" cy="11" r="2.2" fill={successColor} />
        <circle cx="23" cy="15" r="2.2" fill="hsl(38 95% 55%)" />
        {/* Paintbrush */}
        <path d="M 12 32 L 28 16" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 28 16 L 31 13 L 33 15 L 30 18 Z" fill="#ffffff" />
        <path d="M 31 13 L 33 11 C 34 10 35 10 36 11 C 37 12 37 13 36 14 L 34 16 Z" fill={secondaryAccent} />
      </svg>
    )
  }

  // 8. Hangman Icon
  if (slug === 'hangman') {
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
        <rect width="40" height="40" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* Gallows */}
        <path d="M 10 32 L 18 32 M 14 32 L 14 10 L 24 10 L 24 14" stroke={secondaryAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Rope loop / Head */}
        <circle cx="24" cy="17" r="3" stroke={accentColor} strokeWidth="1.5" />
        {/* Body sticks */}
        <line x1="24" y1="20" x2="24" y2="26" stroke="#ffffff" strokeWidth="1.5" />
        <line x1="21" y1="22" x2="27" y2="22" stroke="#ffffff" strokeWidth="1.5" />
        <line x1="24" y1="26" x2="22" y2="30" stroke="#ffffff" strokeWidth="1.5" />
        <line x1="24" y1="26" x2="26" y2="30" stroke="#ffffff" strokeWidth="1.5" />
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
