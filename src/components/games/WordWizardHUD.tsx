// Word Wizard HUD Component
// Displays stats: score, combo counter, time progress, category quests, active modifiers, and hints control

import React from 'react'
import { DailyModifier, getModifierDescription } from '@/lib/wordWizardDaily'

interface HUDProps {
  score: number
  combo: number
  timeLeft: number | null // null means Endless mode
  maxTime: number
  dailyModifier: DailyModifier | null
  hintsRemaining: number
  onUseHint: () => void
  disabled?: boolean
}

export default function WordWizardHUD({
  score,
  combo,
  timeLeft,
  maxTime,
  dailyModifier,
  hintsRemaining,
  onUseHint,
  disabled = false,
}: HUDProps) {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getQuestLabel = (quest: string) => {
    switch (quest) {
      case 'animals':
        return '🦄 Spell an Animal word!'
      case 'food':
        return '🍎 Spell a Food word!'
      case 'magic':
        return '🪄 Spell a Magic/Spell word!'
      case 'nature':
        return '🌿 Spell a Nature word!'
      case 'colors':
        return '🎨 Spell a Color word!'
      default:
        return '📝 Spell any word!'
    }
  }

  const getModifierLabel = (mod: DailyModifier) => {
    switch (mod) {
      case 'double_rare':
        return '💎 Double Rare Letters'
      case 'no_hints':
        return '🚫 No Hints Allowed'
      case 'time_attack':
        return '⚡ Time Attack (+3s/word)'
      case 'giant_board':
        return '🗺️ Giant 6x6 Board'
      case 'combo_frenzy':
        return '🔥 Combo Frenzy (2x Combos)'
      default:
        return '🔮 Classic Modifier'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Score, Combo, Time Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Score Counter */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score</span>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fbbf24', textShadow: '0 2px 10px rgba(251, 191, 36, 0.2)' }}>
            {score}
          </span>
        </div>

        {/* Combo Multiplier Badge */}
        {combo > 1 && (
          <div
            className="animate-pulse"
            style={{
              padding: '6px 12px',
              background: 'linear-gradient(135deg, #ec4899, #db2777)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 20,
              color: 'white',
              fontWeight: 800,
              fontSize: '0.9rem',
              boxShadow: '0 0 15px rgba(236, 72, 153, 0.4)',
            }}
          >
            Combo x{combo}
          </div>
        )}

        {/* Timer / Endless Indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Time</span>
          {timeLeft !== null ? (
            <span
              style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                color: timeLeft <= 10 ? '#ef4444' : '#10b981',
                textShadow: timeLeft <= 10 ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none',
                transition: 'color 0.3s ease',
              }}
            >
              {formatTime(timeLeft)}
            </span>
          ) : (
            <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8' }}>∞</span >
          )}
        </div>
      </div>

      {/* Progress Bar (Only visible when timeLeft is active) */}
      {timeLeft !== null && (
        <div
          style={{
            width: '100%',
            height: 6,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, (timeLeft / maxTime) * 100)}%`,
              backgroundColor: timeLeft <= 10 ? '#ef4444' : '#10b981',
              borderRadius: 3,
              boxShadow: timeLeft <= 10 ? '0 0 8px #ef4444' : 'none',
              transition: 'width 1s linear, background-color 0.5s ease',
            }}
          />
        </div>
      )}

      {/* Modifiers row */}
      {dailyModifier && dailyModifier !== 'classic' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            paddingTop: 4,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Daily Modifier Status */}
          <div
            title={getModifierDescription(dailyModifier)}
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#67e8f9',
              padding: '4px 8px',
              background: 'rgba(103, 232, 249, 0.08)',
              border: '1px solid rgba(103, 232, 249, 0.2)',
              borderRadius: 8,
              cursor: 'help',
            }}
          >
            {getModifierLabel(dailyModifier)}
          </div>
        </div>
      )}

      {/* Hint panel row */}
      {dailyModifier !== 'no_hints' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            paddingTop: 4,
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            Reveal hidden words on the board
          </span>
          <button
            onClick={onUseHint}
            disabled={disabled || hintsRemaining <= 0}
            data-testid="ww-hint-button"
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid rgba(129, 140, 248, 0.3)',
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#818cf8',
              opacity: disabled || hintsRemaining <= 0 ? 0.5 : 1,
              cursor: disabled || hintsRemaining <= 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🔮 Hint ({hintsRemaining})
          </button>
        </div>
      )}
    </div>
  )
}
