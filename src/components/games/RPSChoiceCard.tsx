'use client'

import React from 'react'
import { RockIllustration, PaperIllustration, ScissorsIllustration } from './RockPaperScissorsAssets'

export type RPSMove = 'rock' | 'paper' | 'scissors'

const MOVE_CONFIG: Record<RPSMove, {
  label: string
  color: string
  glow: string
  borderSelected: string
  bgSelected: string
}> = {
  rock: {
    label: 'ROCK',
    color: 'hsl(355 85% 65%)',
    glow: '0 0 24px hsl(355 85% 55% / 0.55)',
    borderSelected: 'hsl(355 85% 65%)',
    bgSelected: 'hsl(355 85% 55% / 0.1)',
  },
  paper: {
    label: 'PAPER',
    color: 'hsl(220 100% 68%)',
    glow: '0 0 24px hsl(220 100% 60% / 0.55)',
    borderSelected: 'hsl(220 100% 68%)',
    bgSelected: 'hsl(220 100% 60% / 0.1)',
  },
  scissors: {
    label: 'SCISSORS',
    color: 'hsl(45 100% 60%)',
    glow: '0 0 24px hsl(45 100% 55% / 0.55)',
    borderSelected: 'hsl(45 100% 60%)',
    bgSelected: 'hsl(45 100% 55% / 0.1)',
  },
}

const ILLUSTRATION_COMPONENTS: Record<RPSMove, React.FC<{ size?: number }>> = {
  rock: RockIllustration,
  paper: PaperIllustration,
  scissors: ScissorsIllustration,
}

interface Props {
  move: RPSMove
  selected?: boolean
  disabled?: boolean
  dimmed?: boolean // loser state
  onClick?: () => void
  size?: 'normal' | 'large'
}

export default function RPSChoiceCard({ move, selected = false, disabled = false, dimmed = false, onClick, size = 'normal' }: Props) {
  const [hovered, setHovered] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)
  const cfg = MOVE_CONFIG[move]

  const cardW = size === 'large' ? 140 : 110
  const cardH = size === 'large' ? 190 : 155
  const illSize = size === 'large' ? 90 : 70

  const borderColor = selected
    ? cfg.borderSelected
    : hovered && !disabled
    ? cfg.color
    : 'hsl(220 15% 22%)'

  const bg = selected
    ? cfg.bgSelected
    : hovered && !disabled
    ? 'hsl(222 20% 13%)'
    : 'hsl(222 20% 9%)'

  const boxShadow = selected
    ? cfg.glow
    : hovered && !disabled
    ? `0 0 14px ${cfg.color}44`
    : 'none'

  const transform = pressed
    ? 'scale(0.94)'
    : selected
    ? 'scale(1.04) translateY(-3px)'
    : hovered && !disabled
    ? 'scale(1.06) translateY(-4px)'
    : 'scale(1) translateY(0)'

  const opacity = dimmed ? 0.38 : disabled && !selected ? 0.55 : 1

  return (
    <button
      id={`rps-card-${move}`}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => { if (!disabled) setHovered(true) }}
      onMouseLeave={() => { setHovered(false); setPressed(false) }}
      onMouseDown={() => { if (!disabled) setPressed(true) }}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => { if (!disabled) setPressed(true) }}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: cardW,
        height: cardH,
        borderRadius: 20,
        border: `2px solid ${borderColor}`,
        background: bg,
        boxShadow,
        cursor: disabled ? 'default' : 'pointer',
        transform,
        opacity,
        transition: pressed
          ? 'transform 0.06s ease, opacity 0.15s'
          : 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 0.5rem 0.85rem',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Neon top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: 2,
          background: selected || (hovered && !disabled) ? cfg.color : 'transparent',
          borderRadius: '0 0 4px 4px',
          transition: 'background 0.18s',
        }}
      />

      {/* Illustration */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        {(() => { const Illus = ILLUSTRATION_COMPONENTS[move]; return <Illus size={illSize} /> })()}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: '0.68rem',
          fontWeight: 900,
          letterSpacing: '0.12em',
          color: selected ? cfg.color : hovered && !disabled ? cfg.color : 'hsl(220 10% 60%)',
          transition: 'color 0.18s',
          userSelect: 'none',
        }}
      >
        {cfg.label}
      </div>
    </button>
  )
}
