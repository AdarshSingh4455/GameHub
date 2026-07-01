import React from 'react'
import { Gamepad2 } from 'lucide-react'
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

  if (slug === 'four-in-a-row') {
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
        <rect x="6" y="8" width="28" height="24" rx="4" fill="hsl(220 70% 35%)" stroke="hsl(220 70% 50%)" strokeWidth="1.5" />
        <circle cx="11" cy="14" r="2.5" fill="hsl(355 85% 55%)" />
        <circle cx="11" cy="20" r="2.5" fill="rgba(255,255,255,0.15)" />
        <circle cx="11" cy="26" r="2.5" fill="rgba(255,255,255,0.15)" />
        <circle cx="17" cy="14" r="2.5" fill="hsl(45 95% 50%)" />
        <circle cx="17" cy="20" r="2.5" fill="hsl(355 85% 55%)" />
        <circle cx="17" cy="26" r="2.5" fill="rgba(255,255,255,0.15)" />
        <circle cx="23" cy="14" r="2.5" fill="hsl(45 95% 50%)" />
        <circle cx="23" cy="20" r="2.5" fill="hsl(45 95% 50%)" />
        <circle cx="23" cy="26" r="2.5" fill="hsl(355 85% 55%)" />
        <circle cx="29" cy="14" r="2.5" fill="rgba(255,255,255,0.15)" />
        <circle cx="29" cy="20" r="2.5" fill="hsl(45 95% 50%)" />
        <circle cx="29" cy="26" r="2.5" fill="hsl(355 85% 55%)" />
        <line x1="11" y1="14" x2="29" y2="26" stroke="#ffffff" strokeWidth="1" strokeDasharray="1.5 1.5" opacity="0.8" />
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

  // 9. Dumb Charades Icon
  if (slug === 'dumb-charades') {
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
        {/* Theater mask comedy */}
        <path d="M11 12 C11 8, 20 8, 20 12 C20 16, 11 16, 11 12 Z M13 11 A 0.8 0.8 0 1 0 13 13 A 0.8 0.8 0 1 0 13 11 Z M18 11 A 0.8 0.8 0 1 0 18 13 A 0.8 0.8 0 1 0 18 11 Z M14 13.5 Q 15.5 14.8, 17 13.5" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" />
        {/* Theater mask tragedy */}
        <path d="M20 28 C20 24, 29 24, 29 28 C29 32, 20 32, 20 28 Z M22 27 A 0.8 0.8 0 1 0 22 29 A 0.8 0.8 0 1 0 22 27 Z M27 27 A 0.8 0.8 0 1 0 27 29 A 0.8 0.8 0 1 0 27 27 Z M23 30.5 Q 24.5 29.2, 26 30.5" stroke={secondaryAccent} strokeWidth="1.5" strokeLinecap="round" />
        {/* Intertwined ribbons */}
        <path d="M 13 24 Q 20 20, 27 16" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeDasharray="2,2" />
      </svg>
    )
  }

  // 10. Who's Spy Icon
  if (slug === 'whos-spy') {
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
        {/* Detective Hat */}
        <path d="M12 22 L28 22 C30 22, 30 19, 28 19 L26 19 C25 15, 23 11, 20 11 C17 11, 15 15, 14 19 L12 19 C10 19, 10 22, 12 22 Z" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" strokeLinejoin="round" />
        {/* Hat Ribbon */}
        <path d="M14 19 L26 19" stroke={secondaryAccent} strokeWidth="2" />
        {/* Sunglasses / Glasses */}
        <path d="M14 26 C14 28, 17 28, 17 26 M23 26 C23 28, 26 28, 26 26 M17 26 L23 26" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // 11. Word Wizard Icon
  if (slug === 'word-wizard') {
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
        {/* Open Book */}
        <path d="M20 28 C16 26, 12 26, 8 28 L8 12 C12 10, 16 10, 20 12 C24 10, 28 10, 32 12 L32 28 C28 26, 24 26, 20 28 Z" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 12 L20 28" stroke={accentColor} strokeWidth="2" />
        {/* Magic Wand */}
        <path d="M26 14 L34 6" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" />
        {/* Glowing star */}
        <path d="M34 6 L33 9 L30 10 L33 11 L34 14 L35 11 L38 10 L35 9 Z" fill="#ffffff" />
      </svg>
    )
  }

  // 12. 2048 Icon
  if (slug === '2048') {
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
        {/* 2x2 Grid Tiles */}
        <rect x="9" y="9" width="10" height="10" rx="2" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="1.5" />
        <rect x="21" y="9" width="10" height="10" rx="2" fill="rgba(255,255,255,0.05)" stroke={secondaryAccent} strokeWidth="1.5" />
        <rect x="9" y="21" width="10" height="10" rx="2" fill="rgba(255,255,255,0.05)" stroke={successColor} strokeWidth="1.5" />
        <rect x="21" y="21" width="10" height="10" rx="2" fill="rgba(255,255,255,0.05)" stroke="hsl(38 95% 55%)" strokeWidth="1.5" />
        {/* Numbers representations (tiny dots/shapes) */}
        <circle cx="14" cy="14" r="1.5" fill="#ffffff" />
        <circle cx="26" cy="14" r="1.5" fill="#ffffff" />
        <circle cx="14" cy="26" r="1.5" fill="#ffffff" />
        <circle cx="26" cy="26" r="1.5" fill="#ffffff" />
      </svg>
    )
  }

  // 13. Fighter Jet Icon
  if (slug === 'fighter') {
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
        {/* Jet Wings & Body */}
        <path d="M20 8 L24 18 L34 26 L24 26 L20 32 L16 26 L6 26 L16 18 Z" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" strokeLinejoin="round" />
        {/* Engines / Exhaust flames */}
        <path d="M17 32 L17 35 L20 37 L23 35 L23 32" stroke={secondaryAccent} strokeWidth="1.5" />
        {/* Blaster Lasers */}
        <line x1="12" y1="18" x2="12" y2="10" stroke={successColor} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="28" y1="18" x2="28" y2="10" stroke={successColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  // 14. Ludo Icon
  if (slug === 'ludo') {
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
        {/* Ludo 4 Quadrants Outline */}
        <rect x="9" y="9" width="10" height="10" rx="1" fill="hsl(355 85% 55% / 0.15)" stroke="hsl(355 85% 55%)" strokeWidth="1.5" />
        <rect x="21" y="9" width="10" height="10" rx="1" fill="hsl(220 100% 65% / 0.15)" stroke={accentColor} strokeWidth="1.5" />
        <rect x="9" y="21" width="10" height="10" rx="1" fill="hsl(142 70% 45% / 0.15)" stroke={successColor} strokeWidth="1.5" />
        <rect x="21" y="21" width="10" height="10" rx="1" fill="hsl(38 95% 55% / 0.15)" stroke="hsl(38 95% 55%)" strokeWidth="1.5" />
        {/* Central Dice */}
        <rect x="17" y="17" width="6" height="6" rx="1" fill="#ffffff" />
        <circle cx="20" cy="20" r="1" fill="#000000" />
      </svg>
    )
  }

  // 15. Arrow Puzzle Icon
  if (slug === 'arrow-puzzle') {
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
        {/* Arrow Left */}
        <path d="M18 13 L13 18 L18 23 M13 18 L27 18" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Arrow Right */}
        <path d="M22 27 L27 22 L22 17 M27 22 L13 22" stroke={secondaryAccent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      </svg>
    )
  }

  // 16. Color Sort Icon
  if (slug === 'color-sort') {
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
        {/* Test Tube 1 */}
        <path d="M13 11 L13 27 C13 29.2, 15.8 29.2, 15.8 27 L15.8 11" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
        <line x1="13" y1="21" x2="15.8" y2="21" stroke={accentColor} strokeWidth="1.5" />
        <path d="M13 22 L13 27 C13 28, 15.8 28, 15.8 27 L15.8 22 Z" fill={accentColor} opacity="0.3" />
        {/* Test Tube 2 */}
        <path d="M24 11 L24 27 C24 29.2, 26.8 29.2, 26.8 27 L26.8 11" stroke={secondaryAccent} strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="18" x2="26.8" y2="18" stroke={secondaryAccent} strokeWidth="1.5" />
        <path d="M24 19 L24 27 C24 28, 26.8 28, 26.8 27 L26.8 19 Z" fill={secondaryAccent} opacity="0.3" />
      </svg>
    )
  }

  // 17. Unblock Traffic Icon
  if (slug === 'unblock-traffic') {
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
        {/* Grid Board lines */}
        <line x1="8" y1="20" x2="32" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,2" />
        <line x1="20" y1="8" x2="20" y2="32" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="2,2" />
        {/* Red escape car */}
        <rect x="14" y="16" width="16" height="8" rx="2" fill="hsl(355 85% 55% / 0.2)" stroke="hsl(355 85% 55%)" strokeWidth="2" />
        <circle cx="18" cy="24" r="1.5" fill="#ffffff" />
        <circle cx="26" cy="24" r="1.5" fill="#ffffff" />
        {/* Blockers */}
        <rect x="8" y="10" width="8" height="16" rx="2" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      </svg>
    )
  }

  // 18. Water Connect Icon
  if (slug === 'water-connect') {
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
        {/* Water Pipe connections */}
        <path d="M10 20 L24 20 C25 20, 25 25, 25 32" stroke={accentColor} strokeWidth="3.5" strokeLinecap="round" />
        {/* Droplet */}
        <path d="M25 15 C25 15, 22 18, 22 20 C22 21.6, 23.3 23, 25 23 C26.6 23, 28 21.6, 28 20 C28 18, 25 15, 25 15 Z" fill={secondaryAccent} />
      </svg>
    )
  }

  // 19. Block Blast Icon
  if (slug === 'block-blast') {
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
        {/* Explosion Blocks */}
        <rect x="9" y="15" width="8" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke={accentColor} strokeWidth="2" />
        <rect x="23" y="9" width="8" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke={secondaryAccent} strokeWidth="2" />
        <rect x="21" y="23" width="8" height="8" rx="2" fill="rgba(255,255,255,0.05)" stroke={successColor} strokeWidth="2" />
        {/* Explosion sparks */}
        <circle cx="16" cy="11" r="1" fill="#ffffff" />
        <circle cx="31" cy="21" r="1.2" fill="#ffffff" />
        <circle cx="14" cy="28" r="1" fill="#ffffff" />
      </svg>
    )
  }

  // 20. Snake Arena Icon
  if (slug === 'snake-arena') {
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
        {/* Snake Winding Path */}
        <path d="M10 28 L24 28 C26 28, 28 26, 28 24 C28 22, 26 20, 24 20 L16 20 C14 20, 12 18, 12 16 C12 14, 14 12, 16 12 L30 12" stroke={successColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Snake Eyes on head */}
        <circle cx="28" cy="12" r="0.75" fill="#ffffff" />
        {/* Glowing food item */}
        <circle cx="30" cy="24" r="2.2" fill="hsl(38 95% 55%)" />
        <circle cx="30" cy="24" r="4.5" stroke="hsl(38 95% 55% / 0.4)" strokeWidth="1" />
      </svg>
    )
  }

  // 21. Bubble Shooter Saga Icon
  if (slug === 'bubble-shooter') {
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
        {/* Colorful Bubble Cluster */}
        <defs>
          <radialGradient id="bubble-pink" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff9ebb" />
            <stop offset="50%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#9f1239" />
          </radialGradient>
          <radialGradient id="bubble-blue" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
          <radialGradient id="bubble-green" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#064e3b" />
          </radialGradient>
        </defs>
        {/* Bubbles */}
        <circle cx="15" cy="15" r="7" fill="url(#bubble-pink)" stroke="#ffffff" strokeWidth="0.5" />
        <circle cx="15" cy="15" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        
        <circle cx="26" cy="18" r="8" fill="url(#bubble-blue)" stroke="#ffffff" strokeWidth="0.5" />
        <circle cx="26" cy="18" r="8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        
        <circle cx="18" cy="27" r="7.5" fill="url(#bubble-green)" stroke="#ffffff" strokeWidth="0.5" />
        <circle cx="18" cy="27" r="7.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        
        {/* Glow dots / highlights */}
        <circle cx="13" cy="13" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="24" cy="16" r="1.8" fill="#ffffff" opacity="0.8" />
        <circle cx="16" cy="25" r="1.6" fill="#ffffff" opacity="0.8" />
      </svg>
    )
  }

  // 22. Memory Plate Icon
  if (slug === 'memory-plate') {
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
        {/* Premium Food Plate */}
        <circle cx="20" cy="20" r="13" fill="rgba(255,255,255,0.03)" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="20" cy="20" r="9" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* Fork on Left */}
        <path d="M4 14 L4 26" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2 14 L2 18 M4 14 L4 18 M6 14 L6 18" stroke="#94a3b8" strokeWidth="1" />
        {/* Knife on Right */}
        <path d="M36 14 L36 26" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M36 14 C35 15, 34 17, 34 20 L36 20 Z" fill="#94a3b8" />
        {/* Food Items arranged on Plate */}
        <circle cx="17" cy="17" r="2.5" fill="#f43f5e" /> {/* Cherry */}
        <path d="M23 17 L25 21 L21 21 Z" fill="#facc15" /> {/* Cheese / Cake Slice */}
        <circle cx="20" cy="24" r="3" fill="#a855f7" /> {/* Macaron / Cake */}
        <circle cx="20" cy="24" r="1.5" fill="#ffffff" opacity="0.7" />
      </svg>
    )
  }


  // Fallback to vector icon if no SVG defined
  return (
    <Gamepad2
      className={className}
      size={size}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        color: accentColor
      }}
    />
  )
}
export default GameIcon
