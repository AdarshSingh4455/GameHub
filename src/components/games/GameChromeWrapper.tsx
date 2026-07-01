'use client'

import React, { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFullscreen } from '@/lib/hooks/useFullscreen'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { getLevelProgress } from '@/lib/xpUtils'
import GameIcon from '@/components/games/GameIcon'
import { useSocket } from '@/lib/contexts/SocketContext'
import { HeaderButton } from '@/components/shared/HeaderButton'
import { InfoIcon, BookIcon } from '@/components/shared/Icons'

interface Props {
  slug: string
  name: string
  emoji: string
  description: string
  type: string
  children: (isFullscreen: boolean) => React.ReactNode
}

const GAME_RULES: Record<string, string[]> = {
  'colorsort': [
    'Group same colors into individual jars.',
    'You can only pour onto:',
    '• Empty jar',
    '• Same top color',
    'Complete when all jars contain a single color.'
  ],
  'waterconnect': [
    'Connect matching colored dots.',
    'Paths cannot overlap.',
    'Challenge mode requires filling the board.'
  ],
  'memory': [
    'Flip cards and find matching pairs.',
    'Highest matches wins.',
    'AI memory differs by difficulty.'
  ],
  'memorymatch': [
    'Flip cards and find matching pairs.',
    'Highest matches wins.',
    'AI memory differs by difficulty.'
  ],
  'dotsboxes': [
    'Draw lines between dots.',
    'Complete a box to score.',
    'Completing a box grants another turn.',
    'Highest score wins.'
  ],
  'tictactoe': [
    'Create a line of 3 symbols.',
    'Horizontal, vertical, or diagonal.'
  ],
  'ttt': [
    'Create a line of 3 symbols.',
    'Horizontal, vertical, or diagonal.'
  ],
  'wordwizard': [
    'How To Play: Connect adjacent letters (horizontally, vertically, or diagonally) to form words of 3+ letters. Drag to select, or click sequentially.',
    'Scoring: Score scales with word length (100 for 3 letters, 200 for 4, 400 for 5, 700 for 6, 1000 for 7+). Combos increase points.',
    'Special Tiles: Spell words through special tiles to get bonuses: Gold (Double word score), Freeze (Freeze time), Arcane (Gain a hint).',
    'Category Hunt: Complete the category target words checklist. Easy mode reveals full words, Normal reveals lengths, Hard hides words. Clear all targets for a +1000 points completion bonus.',
    'Hint System: Progressive levels. Level 1 highlights starting tile on board, Level 2 reveals word length, Level 3 highlights the first two letters.',
    'Daily Challenge: Play daily seeded boards with special modifiers like Double Rare Letters, No Hints, and Time Attack.'
  ],
  'blockblast': [
    'How To Play: Place block shapes on the 8x8 grid. Tap to select and place, or drag and drop.',
    'Scoring: Earn points for placing tiles (+10 per tile) and clearing lines (+100 per line).',
    'Rotation Controls: Rotate shapes using R key on Desktop, Double Tap on mobile piece slots, or the ↻ Rotate button.',
    'Combos: Clear lines on consecutive moves to build a combo chain and earn extra bonuses (+50 x combo).',
    'Hold Slot: Tap a piece and press Hold to store it. Swapping is allowed once per move (resets on placement).',
    'Undo: Revert your last placement if you make a mistake. Clears after your next move.',
    'Daily Challenge: Play seed-based boards identical for all players globally (UTC seed).'
  ],
  'neontetris': [
    'Goal: Clear horizontal rows by filling them completely with glowing Tetromino blocks.',
    'Rotate CW: Double Click/Double Tap active piece, or click Rotate button, or press X key / Up Arrow.',
    'Desktop Controls: ← / → (Move), ↓ (Soft Drop), Space (Hard Drop), Z (Rotate CCW), X (Rotate CW), Shift (Hold piece).',
    'Mobile Controls: Tap the bottom button overlay to slide, rotate, drop, or hold.',
    'SRS Rotation: Pieces feature standard wall kick behavior to spin into tight spots.',
    'Daily Challenge: Globally seeded variants (Garbage rows, Obstacles, Combo boards) identical for everyone.',
    'Perfect Clear: Empty the board completely to unlock a massive +2000 points bonus!'
  ],
  'cricket': [
    'Guess and click a run score (1 to 6).',
    'If your run matches the opponent\'s guess, you are out!',
    'Try to score more runs than the opponent before running out of wickets.'
  ],
  'scribble': [
    'Draw the assigned word on the canvas when it\'s your turn.',
    'Guess other players\' drawings as fast as possible to score higher points.'
  ],
  'charades': [
    'Act out movies or shows using only text hints.',
    'Your teammate tries to guess the title before time runs out.'
  ],
  'spy': [
    'Everyone is given the same word except the Spy.',
    'Describe your word without giving it away to identify the Spy.'
  ],
  'rps': [
    'Choose Rock, Paper, or Scissors.',
    'Rock beats Scissors, Scissors beats Paper, Paper beats Rock.',
    'Win the best of 3 rounds to win the match.'
  ],
  'numguess': [
    'Guess the secret number between 1 and 100.',
    'Pay attention to hot/cold feedback to narrow down the range.'
  ],
  'numberguessing': [
    'Guess the secret number between 1 and 100.',
    'Pay attention to hot/cold feedback to narrow down the range.'
  ],
  '2048': [
    'Slide tiles in four directions to merge matching numbers.',
    'Combine tiles to reach the elusive 2048 tile!'
  ],
  'fighter': [
    'Dodge incoming enemy fighter planes.',
    'Shoot down enemies to boost your score and gain XP.'
  ],
  'ludo': [
    'Roll the dice and race your pieces around the board.',
    'Reach the home base before other players do.'
  ],
  'arrowpuzzle': [
    'Click arrows to release them from the board.',
    'Arrows can only fly in the direction they point if their path is clear.'
  ],
  'unblocktraffic': [
    'Slide vehicles horizontally or vertically to clear a path.',
    'Unblock the target vehicle and let it escape to complete the level.'
  ],
  'memory-plate': [
    'Memorize the ingredients on the plate before the preview timer runs out.',
    'Arrange items on your plate exactly matching the positions, quantities, and rotations.',
    'Tap items from the tray to select, and tap the plate to place them.',
    'In Medium/Hard difficulty, tap placed items to rotate them by 90 degrees.',
    'Submit to calculate your accuracy and speed score.'
  ],
  'memoryplate': [
    'Memorize the ingredients on the plate before the preview timer runs out.',
    'Arrange items on your plate exactly matching the positions, quantities, and rotations.',
    'Tap items from the tray to select, and tap the plate to place them.',
    'In Medium/Hard difficulty, tap placed items to rotate them by 90 degrees.',
    'Submit to calculate your accuracy and speed score.'
  ]
}

export default function GameChromeWrapper({ slug, name, emoji, description, children }: Props) {
  const router = useRouter()
  const { user, preloadAdsForGame } = useGameSession()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(wrapperRef, true)
  const [showDesc, setShowDesc] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const { updateActivity } = useSocket()

  useEffect(() => {
    // Rich Presence update: status IN_GAME, activity "Playing Hangman", elapsed time tracking
    const mode = slug.startsWith('multiplayer') || slug.includes('-multi') ? 'Multiplayer' : 'Solo Practice'
    updateActivity('IN_GAME', `Playing ${name}`, slug, mode, Date.now())
    window.dispatchEvent(new CustomEvent('gamehub_gameplay', { detail: { active: true } }))
    return () => {
      updateActivity('ONLINE', 'Browsing Games')
      window.dispatchEvent(new CustomEvent('gamehub_gameplay', { detail: { active: false } }))
    }
  }, [slug, name, updateActivity])

  useEffect(() => {
    preloadAdsForGame(slug).catch((err) => console.error('Failed to preload ads:', err))
  }, [slug, preloadAdsForGame])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRules(false)
      }
    }
    if (showRules) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showRules])

  const [stats, setStats] = useState({
    level: 1,
    xp: 0,
    coins: 0,
  })
  const [pulse, setPulse] = useState(false)

  // Load stats dynamically
  const loadStats = () => {
    if (user) {
      fetch('/api/profile/details')
        .then((res) => {
          if (res.ok) return res.json()
          throw new Error()
        })
        .then((data) => {
          setStats((prev) => {
            const next = {
              level: data.profile.level,
              xp: data.profile.xp,
              coins: data.profile.coins,
            }
            // Pulse HUD if values changed
            if (prev.xp !== next.xp || prev.coins !== next.coins || prev.level !== next.level) {
              setPulse(true)
            }
            return next
          })
        })
        .catch(() => {})
    } else {
      // Guest
      const guestXP = parseInt(localStorage.getItem('gamehub_guest_xp') || '0', 10)
      const guestLevel = parseInt(localStorage.getItem('gamehub_guest_level') || '1', 10)
      const guestCoins = parseInt(localStorage.getItem('gamehub_guest_coins') || '0', 10)

      setStats((prev) => {
        const next = {
          level: guestLevel,
          xp: guestXP,
          coins: guestCoins,
        }
        if (prev.xp !== next.xp || prev.coins !== next.coins || prev.level !== next.level) {
          setPulse(true)
        }
        return next
      })
    }
  }

  useEffect(() => {
    loadStats()

    const handleUpdate = () => {
      loadStats()
    }

    window.addEventListener('storage', handleUpdate)
    window.addEventListener('gamehub_xp_update', handleUpdate)
    
    return () => {
      window.removeEventListener('storage', handleUpdate)
      window.removeEventListener('gamehub_xp_update', handleUpdate)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Reset pulse state after animation
  useEffect(() => {
    if (!pulse) return
    const timer = setTimeout(() => setPulse(false), 600)
    return () => clearTimeout(timer)
  }, [pulse])

  const { progressPercent } = getLevelProgress(stats.xp)

  return (
    <div
      ref={wrapperRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: isFullscreen ? 'hsl(222 20% 7%)' : 'transparent',
        height: isFullscreen ? '100vh' : 'auto',
        position: isFullscreen ? 'relative' : 'initial',
        zIndex: isFullscreen ? 1000 : 'auto',
        padding: isFullscreen ? '0 0.5rem 0.5rem 0.5rem' : 0,
        boxSizing: 'border-box',
        overflow: isFullscreen ? 'hidden' : 'visible',
      }}
      className={`game-wrapper-container ${isFullscreen ? 'fullscreen-active' : ''}`}
    >
      {/* ── Top HUD Bar ── */}
      <div
        className="game-hud-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid hsl(220 15% 18%)',
          background: 'hsl(222 20% 11%)',
          borderRadius: isFullscreen ? '0' : '16px 16px 0 0',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm game-back-btn"
            onClick={() => router.push('/dashboard/games')}
            style={{ padding: '0.4rem 0.6rem', minWidth: 'auto', background: 'hsl(220 20% 15%)' }}
            title="Back to all games"
          >
            ←
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <GameIcon slug={slug} size={24} />
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'white' }}>{name}</span>
            {description && (
              <HeaderButton
                onClick={() => setShowDesc(!showDesc)}
                icon={<InfoIcon size={16} />}
                title="Toggle description"
                isActive={showDesc}
                id="game-desc-btn"
              />
            )}
            <HeaderButton
              onClick={() => setShowRules(true)}
              icon={<BookIcon size={16} />}
              label="Rules"
              title="Show rules to play"
              id="game-rules-btn"
            />
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm fullscreen-btn"
          onClick={toggleFullscreen}
          style={{
            background: 'hsl(220 20% 15%)',
            borderColor: 'hsl(220 15% 22%)',
            color: 'hsl(220 10% 85%)',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '36px',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Collapsible Description Drawer ── */}
      {showDesc && description && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            background: 'hsl(222 20% 8%)',
            borderBottom: '1px solid hsl(220 15% 18%)',
            fontSize: '0.85rem',
            color: 'hsl(220 10% 70%)',
            lineHeight: '1.45',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {description}
        </div>
      )}

      {/* ── Live Stats Strip ── */}
      <div
        className={`hud-stats-strip ${pulse ? 'hud-pulse' : ''}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 1.25rem',
          background: 'hsl(222 20% 9%)',
          borderBottom: '1px solid hsl(220 15% 18%)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'hsl(220 10% 65%)',
          borderRadius: isFullscreen ? '0' : '0 0 16px 16px',
          transition: 'none',
          marginBottom: isFullscreen ? '0.75rem' : '1.5rem',
        }}
      >
        <div>
          ⭐ Level <strong style={{ color: 'hsl(270 80% 70%)' }}>{stats.level}</strong>
        </div>
        <div style={{ flex: 1, margin: '0 1.5rem', maxWidth: '200px' }}>
          <div style={{ height: 5, background: 'hsl(220 20% 18%)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 65%), hsl(270 80% 65%))', borderRadius: 99 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>✨ {stats.xp} XP</span>
          <span>💰 {stats.coins} Coins</span>
        </div>
      </div>

      {/* ── Game Area ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: isFullscreen ? 1 : 'unset',
          justifyContent: isFullscreen ? 'center' : 'initial',
          alignItems: 'center',
          overflow: isFullscreen ? 'hidden' : 'visible',
          height: isFullscreen ? 'calc(100% - 100px)' : 'auto',
          width: '100%',
        }}
      >
        {children(isFullscreen)}
      </div>

      {/* ── Rules Modal Overlay ── */}
      {showRules && (
        <div
          onClick={() => setShowRules(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'hsl(222 20% 6% / 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.2s ease-out',
          }}
          id="game-rules-modal-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, hsl(222 20% 12%) 0%, hsl(222 20% 8%) 100%)',
              border: '1px solid hsl(220 15% 20%)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '480px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
              position: 'relative',
              animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            id="game-rules-modal-content"
            role="dialog"
            aria-labelledby="rules-modal-title"
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid hsl(220 15% 16%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2
                id="rules-modal-title"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: 'white',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <BookIcon size={20} style={{ color: 'hsl(220 100% 70%)' }} />
                <span>Rules to Play: {name}</span>
              </h2>
              <button
                onClick={() => setShowRules(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(220 10% 60%)',
                  fontSize: '1.5rem',
                  fontWeight: 'light',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                  transition: 'color 0.2s',
                }}
                title="Close modal"
                id="game-rules-close-btn"
              >
                &times;
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div
              style={{
                padding: '1.5rem',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                color: 'hsl(220 10% 80%)',
                fontSize: '0.92rem',
                lineHeight: 1.6,
              }}
            >
              {(() => {
                const normalizedSlug = (slug || '').toLowerCase().replace(/[^a-z]/g, '')
                const rules = GAME_RULES[normalizedSlug] || [
                  `Play ${name} to earn XP and coins.`,
                  'Check the instructions inside the game setup screen.',
                  'Achieve high scores to level up your profile.'
                ]
                return (
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {rules.map((rule, idx) => (
                      <li key={idx} style={{ listStyleType: 'disc' }}>
                        {rule}
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid hsl(220 15% 16%)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setShowRules(false)}
                className="btn btn-primary"
                style={{ borderRadius: 10, padding: '0.55rem 1.5rem', fontSize: '0.85rem' }}
                id="game-rules-ok-btn"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic CSS Inject for Rules Modal */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @media (max-width: 767px) {
          .game-hud-bar {
            padding: 0.4rem 0.6rem !important;
            gap: 0.5rem !important;
          }
          .hud-stats-strip {
            padding: 0.3rem 0.6rem !important;
            margin-bottom: 0.4rem !important;
          }
          .game-wrapper-container {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
