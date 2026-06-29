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
    icon: <ZapIcon size={13} />,
    bgColor: 'hsl(142 70% 45% / 0.15)',
    borderColor: 'hsl(142 70% 45% / 0.4)',
    textColor: 'hsl(142 70% 55%)',
    glowColor: 'hsl(142 70% 55% / 0.4)',
  },
  shield: {
    label: 'Shield',
    icon: <ShieldIcon size={13} />,
    bgColor: 'hsl(217 91% 60% / 0.15)',
    borderColor: 'hsl(217 91% 60% / 0.4)',
    textColor: 'hsl(217 91% 70%)',
    glowColor: 'hsl(217 91% 70% / 0.4)',
  },
  ghost: {
    label: 'Ghost',
    icon: <EyeOffIcon size={13} />,
    bgColor: 'hsl(271 91% 65% / 0.15)',
    borderColor: 'hsl(271 91% 65% / 0.4)',
    textColor: 'hsl(271 91% 75%)',
    glowColor: 'hsl(271 91% 75% / 0.4)',
  },
  magnet: {
    label: 'Magnet',
    icon: <MagnetIcon size={13} />,
    bgColor: 'hsl(45 93% 47% / 0.15)',
    borderColor: 'hsl(45 93% 47% / 0.4)',
    textColor: 'hsl(45 93% 57%)',
    glowColor: 'hsl(45 93% 57% / 0.4)',
  },
  freeze: {
    label: 'Freeze',
    icon: <SnowflakeIcon size={13} />,
    bgColor: 'hsl(190 90% 50% / 0.15)',
    borderColor: 'hsl(190 90% 50% / 0.4)',
    textColor: 'hsl(190 90% 60%)',
    glowColor: 'hsl(190 90% 60% / 0.4)',
  },
  double: {
    label: 'Double',
    icon: <CoinsIcon size={13} />,
    bgColor: 'hsl(320 90% 50% / 0.15)',
    borderColor: 'hsl(320 90% 50% / 0.4)',
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

  return (
    <span
      className={`powerup-badge-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        fontSize: '0.7rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        color: config.textColor,
        boxShadow: `0 0 8px ${config.glowColor}`,
        height: '24px',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {config.icon}
      </span>
      <span>{config.label}</span>
      {timeLeft !== undefined && (
        <span style={{ opacity: 0.85, marginLeft: '2px' }}>
          ({timeLeft}s)
        </span>
      )}
    </span>
  )
}

export default PowerupBadge
