import React from 'react'
import {
  ZapIcon,
  ShieldIcon,
  EyeOffIcon,
  MagnetIcon,
  SnowflakeIcon,
  CoinsIcon
} from '@/components/shared/Icons'

export type PowerupType = 'speed' | 'shield' | 'ghost' | 'magnet' | 'freeze' | 'double'

interface PowerupBadgeProps {
  type: PowerupType
  timeLeft?: number
  className?: string
  style?: React.CSSProperties
}

const POWERUP_CONFIGS: Record<
  PowerupType,
  {
    label: string
    icon: React.ReactNode
    bgColor: string
    borderColor: string
    textColor: string
    glowColor: string
  }
> = {
  speed: {
    label: 'Speed',
    icon: <ZapIcon size={12} />,
    bgColor: 'hsl(142 70% 45% / 0.15)',
    borderColor: 'hsl(142 70% 45% / 0.5)',
    textColor: 'hsl(142 70% 55%)',
    glowColor: 'hsl(142 70% 55% / 0.4)',
  },
  shield: {
    label: 'Shield',
    icon: <ShieldIcon size={12} />,
    bgColor: 'hsl(217 91% 60% / 0.15)',
    borderColor: 'hsl(217 91% 60% / 0.5)',
    textColor: 'hsl(217 91% 70%)',
    glowColor: 'hsl(217 91% 70% / 0.4)',
  },
  ghost: {
    label: 'Ghost',
    icon: <EyeOffIcon size={12} />,
    bgColor: 'hsl(271 91% 65% / 0.15)',
    borderColor: 'hsl(271 91% 65% / 0.5)',
    textColor: 'hsl(271 91% 75%)',
    glowColor: 'hsl(271 91% 75% / 0.4)',
  },
  magnet: {
    label: 'Magnet',
    icon: <MagnetIcon size={12} />,
    bgColor: 'hsl(45 93% 47% / 0.15)',
    borderColor: 'hsl(45 93% 47% / 0.5)',
    textColor: 'hsl(45 93% 57%)',
    glowColor: 'hsl(45 93% 57% / 0.4)',
  },
  freeze: {
    label: 'Freeze',
    icon: <SnowflakeIcon size={12} />,
    bgColor: 'hsl(190 90% 50% / 0.15)',
    borderColor: 'hsl(190 90% 50% / 0.5)',
    textColor: 'hsl(190 90% 60%)',
    glowColor: 'hsl(190 90% 60% / 0.4)',
  },
  double: {
    label: 'Double',
    icon: <CoinsIcon size={12} />,
    bgColor: 'hsl(320 90% 50% / 0.15)',
    borderColor: 'hsl(320 90% 50% / 0.5)',
    textColor: 'hsl(320 90% 60%)',
    glowColor: 'hsl(320 90% 60% / 0.4)',
  },
}

export const PowerupBadge: React.FC<PowerupBadgeProps> = ({
  type,
  timeLeft,
  className = '',
  style = {},
}) => {
  const config = POWERUP_CONFIGS[type]
  if (!config) return null

  // Default duration is 8 seconds
  const maxDuration = 8
  const pct = timeLeft !== undefined ? Math.min(100, Math.max(0, (timeLeft / maxDuration) * 100)) : 100
  const radius = 9
  const circ = 2 * Math.PI * radius
  const strokeDashoffset = circ - (pct / 100) * circ

  return (
    <div
      className={`powerup-badge-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0.25rem 0.65rem',
        borderRadius: '10px',
        fontSize: '0.72rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: config.bgColor,
        border: `1.5px solid ${config.borderColor}`,
        color: config.textColor,
        boxShadow: `0 0 12px ${config.glowColor}`,
        height: '28px',
        boxSizing: 'border-box',
        position: 'relative',
        animation: 'badge-glow-pulse 2s infinite alternate',
        ...style,
      }}
    >
      <style>{`
        @keyframes badge-glow-pulse {
          0% { box-shadow: 0 0 4px ${config.glowColor}; }
          100% { box-shadow: 0 0 14px ${config.glowColor}; }
        }
      `}</style>

      {/* Circular Timer Ring */}
      <div style={{ position: 'relative', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="2"
          />
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke={config.textColor}
            strokeWidth="2"
            strokeDasharray={circ}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {config.icon}
        </div>
      </div>

      <span>{config.label}</span>
      {timeLeft !== undefined && (
        <span style={{ opacity: 0.85, fontWeight: 900 }}>
          {timeLeft}s
        </span>
      )}
    </div>
  )
}

export default PowerupBadge
