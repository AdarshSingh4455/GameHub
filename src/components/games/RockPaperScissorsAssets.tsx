import React from 'react'

interface AssetProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

// ── ROCK — textured stone illustration ──────────────────────────────────────
export const RockIllustration: React.FC<AssetProps> = ({ size = 80, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 12px hsl(355 85% 55% / 0.6))', ...style }}
  >
    <defs>
      <radialGradient id="rock-body" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="hsl(355 30% 52%)" />
        <stop offset="55%" stopColor="hsl(355 25% 38%)" />
        <stop offset="100%" stopColor="hsl(355 20% 22%)" />
      </radialGradient>
      <radialGradient id="rock-sheen" cx="30%" cy="25%" r="50%">
        <stop offset="0%" stopColor="white" stopOpacity="0.18" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="rock-crack" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(355 85% 70%)" stopOpacity="0.6" />
        <stop offset="100%" stopColor="hsl(355 85% 55%)" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    {/* Main stone body */}
    <path
      d="M16 50 C14 42 18 28 26 20 C32 14 42 12 50 15 C60 18 67 28 66 40 C65 52 58 64 46 67 C34 70 18 62 16 50Z"
      fill="url(#rock-body)"
    />
    {/* Surface sheen */}
    <path
      d="M16 50 C14 42 18 28 26 20 C32 14 42 12 50 15 C60 18 67 28 66 40 C65 52 58 64 46 67 C34 70 18 62 16 50Z"
      fill="url(#rock-sheen)"
    />
    {/* Neon outline */}
    <path
      d="M16 50 C14 42 18 28 26 20 C32 14 42 12 50 15 C60 18 67 28 66 40 C65 52 58 64 46 67 C34 70 18 62 16 50Z"
      stroke="hsl(355 85% 65%)"
      strokeWidth="1.5"
      fill="none"
      strokeOpacity="0.85"
    />
    {/* Rock cracks/texture */}
    <path d="M32 22 L28 36 L38 42" stroke="url(#rock-crack)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M46 18 L50 32 L42 38" stroke="url(#rock-crack)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M24 46 L34 52 L30 62" stroke="url(#rock-crack)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M54 36 L58 48 L50 55" stroke="url(#rock-crack)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    {/* Highlight facet */}
    <ellipse cx="32" cy="26" rx="6" ry="4" fill="white" fillOpacity="0.1" transform="rotate(-20 32 26)" />
  </svg>
)

// ── PAPER — folded paper sheet illustration ─────────────────────────────────
export const PaperIllustration: React.FC<AssetProps> = ({ size = 80, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 12px hsl(220 100% 60% / 0.6))', ...style }}
  >
    <defs>
      <linearGradient id="paper-body" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(220 40% 40%)" />
        <stop offset="100%" stopColor="hsl(220 30% 22%)" />
      </linearGradient>
      <linearGradient id="paper-fold" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="hsl(220 50% 50%)" />
        <stop offset="100%" stopColor="hsl(220 40% 30%)" />
      </linearGradient>
      <linearGradient id="paper-line" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="hsl(220 100% 68%)" stopOpacity="0.8" />
        <stop offset="100%" stopColor="hsl(270 80% 68%)" stopOpacity="0.4" />
      </linearGradient>
    </defs>
    {/* Paper body */}
    <rect x="14" y="12" width="42" height="54" rx="3" fill="url(#paper-body)" />
    {/* Folded corner (top-right) */}
    <path d="M42 12 L56 12 L56 26 L42 12Z" fill="url(#paper-fold)" />
    <path d="M42 12 L56 26 L42 26 Z" fill="hsl(220 20% 15%)" fillOpacity="0.5" />
    {/* Fold crease line */}
    <path d="M42 12 L56 26" stroke="hsl(220 100% 68%)" strokeWidth="1" strokeOpacity="0.6" />
    {/* Neon border */}
    <rect x="14" y="12" width="42" height="54" rx="3" stroke="hsl(220 100% 68%)" strokeWidth="1.5" strokeOpacity="0.9" fill="none" />
    {/* Text lines on paper */}
    <line x1="22" y1="34" x2="48" y2="34" stroke="url(#paper-line)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="22" y1="42" x2="44" y2="42" stroke="url(#paper-line)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="22" y1="50" x2="46" y2="50" stroke="url(#paper-line)" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="22" y1="58" x2="38" y2="58" stroke="url(#paper-line)" strokeWidth="1.5" strokeLinecap="round" />
    {/* Sheen */}
    <rect x="16" y="14" width="18" height="28" rx="2" fill="white" fillOpacity="0.05" />
  </svg>
)

// ── SCISSORS — metallic scissors illustration ───────────────────────────────
export const ScissorsIllustration: React.FC<AssetProps> = ({ size = 80, className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 12px hsl(45 100% 55% / 0.6))', ...style }}
  >
    <defs>
      <linearGradient id="blade-1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(45 80% 70%)" />
        <stop offset="50%" stopColor="hsl(45 60% 50%)" />
        <stop offset="100%" stopColor="hsl(45 40% 32%)" />
      </linearGradient>
      <linearGradient id="blade-2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="hsl(45 80% 70%)" />
        <stop offset="50%" stopColor="hsl(45 60% 50%)" />
        <stop offset="100%" stopColor="hsl(45 40% 32%)" />
      </linearGradient>
      <radialGradient id="pivot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(45 100% 80%)" />
        <stop offset="100%" stopColor="hsl(45 100% 55%)" />
      </radialGradient>
    </defs>
    {/* Blade 1 — top-left to bottom-right */}
    <path
      d="M18 14 C20 16 38 34 42 40 L48 68 C46 70 42 70 40 68 L34 42 C28 36 14 20 14 18 C14 15 16 12 18 14Z"
      fill="url(#blade-1)"
    />
    {/* Blade 1 edge highlight */}
    <path
      d="M18 14 C20 16 38 34 42 40"
      stroke="hsl(45 100% 78%)"
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
      strokeOpacity="0.7"
    />
    {/* Blade 2 — top-right to bottom-left */}
    <path
      d="M62 14 C60 16 42 34 38 40 L32 68 C34 70 38 70 40 68 L46 42 C52 36 66 20 66 18 C66 15 64 12 62 14Z"
      fill="url(#blade-2)"
    />
    {/* Blade 2 edge highlight */}
    <path
      d="M62 14 C60 16 42 34 38 40"
      stroke="hsl(45 100% 78%)"
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
      strokeOpacity="0.7"
    />
    {/* Pivot screw */}
    <circle cx="40" cy="40" r="5" fill="url(#pivot)" />
    <circle cx="40" cy="40" r="5" stroke="hsl(45 100% 85%)" strokeWidth="1" strokeOpacity="0.6" />
    <circle cx="40" cy="40" r="2" fill="hsl(45 20% 20%)" />
    {/* Neon outline blades */}
    <path
      d="M18 14 C20 16 38 34 42 40 L48 68 C46 70 42 70 40 68 L34 42 C28 36 14 20 14 18 C14 15 16 12 18 14Z"
      stroke="hsl(45 100% 60%)"
      strokeWidth="1"
      fill="none"
      strokeOpacity="0.7"
    />
    <path
      d="M62 14 C60 16 42 34 38 40 L32 68 C34 70 38 70 40 68 L46 42 C52 36 66 20 66 18 C66 15 64 12 62 14Z"
      stroke="hsl(45 100% 60%)"
      strokeWidth="1"
      fill="none"
      strokeOpacity="0.7"
    />
  </svg>
)

// ── Legacy small vectors for backward compat ─────────────────────────────────
export const RockVector = RockIllustration
export const PaperVector = PaperIllustration
export const ScissorsVector = ScissorsIllustration
