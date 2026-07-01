import React, { useRef } from 'react'
import { getWordFromPath } from '@/lib/wordWizardEngine'
import { SelectionGestureEngine } from '@/lib/word-engine/SelectionGestureEngine'

export interface BoardProps {
  grid: string[][]
  specialTiles: Record<string, 'gold' | 'arcane' | 'freeze' | 'combo'>
  path: [number, number][]
  setPath: React.Dispatch<React.SetStateAction<[number, number][]>>
  onSubmitWord: (spelledWord: string, path: [number, number][]) => void
  disabled?: boolean
  particlesRef: React.RefObject<any>
  hintHighlights?: [number, number][]
  hintLevel?: number
}

export default function WordWizardBoard({
  grid,
  specialTiles,
  path,
  setPath,
  onSubmitWord,
  disabled = false,
  particlesRef,
  hintHighlights = [],
  hintLevel = 0,
}: BoardProps) {
  const size = grid.length
  const boardRef = useRef<HTMLDivElement | null>(null)
  const isDragging = useRef<boolean>(false)
  const lastCellRef = useRef<string | null>(null)
  
  // Track touch/mouse coordinates to calculate cell indexes on the fly
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Use forgiving radial engine
    const match = SelectionGestureEngine.getClosestCell(x, y, rect.width, rect.height, size, 0.90)

    if (match) {
      isDragging.current = true
      const cellKey = `${match.r},${match.c}`
      lastCellRef.current = cellKey
      setPath([[match.r, match.c]])

      particlesRef.current?.addBurst(x, y, '#818cf8', 8)
      
      // Request pointer capture to track drag outside cell
      boardRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || disabled) return
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Use forgiving radial engine
    const match = SelectionGestureEngine.getClosestCell(x, y, rect.width, rect.height, size, 0.90)

    if (match) {
      const { r, c } = match
      const cellKey = `${r},${c}`
      if (cellKey === lastCellRef.current) return

      // Emit trail
      particlesRef.current?.addTrail(x, y, 'rgba(139, 92, 246, 0.55)')

      setPath((prev) => {
        if (prev.length === 0) {
          lastCellRef.current = cellKey
          return [[r, c]]
        }

        const lastCell = prev[prev.length - 1]
        
        // Backward drag -> erase last item (feels super premium)
        const indexInPath = prev.findIndex(([pr, pc]) => pr === r && pc === c)
        if (indexInPath !== -1 && indexInPath < prev.length - 1) {
          lastCellRef.current = cellKey
          return prev.slice(0, indexInPath + 1)
        }

        // Check if cell is already in the path
        if (indexInPath !== -1) return prev

        // Check adjacency and interpolate if needed (for fast drags/diagonal snapping)
        const dr = Math.abs(lastCell[0] - r)
        const dc = Math.abs(lastCell[1] - c)

        if (dr <= 1 && dc <= 1) {
          // Adjacent cell, add directly
          lastCellRef.current = cellKey
          return [...prev, [r, c]]
        } else {
          // Fast drag or skipped intermediate cells. Interpolate to make diagonal/straight drags seamless!
          const interp = SelectionGestureEngine.getInterpolatedPath(lastCell[0], lastCell[1], r, c)
          
          // Filter out cells already in the path
          const filteredInterp = interp.filter(([ir, ic]) => !prev.some(([pr, pc]) => pr === ir && pc === ic))
          
          if (filteredInterp.length > 0) {
            lastCellRef.current = cellKey
            return [...prev, ...filteredInterp]
          }
        }

        return prev
      })
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    lastCellRef.current = null

    try {
      boardRef.current?.releasePointerCapture(e.pointerId)
    } catch {}

    if (path.length >= 3) {
      const word = getWordFromPath(path, grid)
      onSubmitWord(word, path)
    } else {
      setPath([])
    }
  }

  // Handle cell click for tap-to-select mode
  const handleCellClick = (r: number, c: number) => {
    if (disabled || isDragging.current) return

    setPath((prev) => {
      if (prev.length === 0) {
        return [[r, c]]
      }

      const lastCell = prev[prev.length - 1]
      const alreadyIdx = prev.findIndex(([pr, pc]) => pr === r && pc === c)

      if (alreadyIdx !== -1) {
        // Clicked on a cell already in path: deselect it and everything after it
        return prev.slice(0, alreadyIdx)
      }

      // Check adjacency
      const dr = Math.abs(lastCell[0] - r)
      const dc = Math.abs(lastCell[1] - c)
      if (dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0)) {
        return [...prev, [r, c]]
      }

      // If clicked far away, reset path with new selection
      return [[r, c]]
    })
  }

  // Draw SVG lines between cell centers
  const renderLines = () => {
    if (path.length < 2) return null
    const cellPercent = 100 / size

    return (
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <defs>
          <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(262, 83%, 62%)" />
            <stop offset="100%" stopColor="hsl(220, 89%, 60%)" />
          </linearGradient>
        </defs>
        {path.map((_, index) => {
          if (index === 0) return null
          const [r1, c1] = path[index - 1]
          const [r2, c2] = path[index]

          const x1 = `${(c1 + 0.5) * cellPercent}%`
          const y1 = `${(r1 + 0.5) * cellPercent}%`
          const x2 = `${(c2 + 0.5) * cellPercent}%`
          const y2 = `${(r2 + 0.5) * cellPercent}%`

          return (
            <g key={index}>
              {/* Outer glow trail */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(129, 140, 248, 0.25)"
                strokeWidth="18"
                strokeLinecap="round"
                style={{
                  filter: 'blur(3px)',
                }}
              />
              {/* Inner core path */}
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#pathGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 6px hsl(250, 89%, 60%))',
                  opacity: 0.95,
                }}
              />
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1/1',
        background: 'rgba(9, 11, 23, 0.5)',
        border: '2px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        padding: 10,
        touchAction: 'none',
        userSelect: 'none',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), inset 0 2px 10px rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div
        ref={boardRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
          gap: size >= 12 ? 4 : size >= 10 ? 6 : 8,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      >
        {grid.map((row, r) =>
          row.map((letter, c) => {
            const isSelected = path.some(([pr, pc]) => pr === r && pc === c)
            const isLast = path.length > 0 && path[path.length - 1][0] === r && path[path.length - 1][1] === c
            const special = specialTiles[`${r},${c}`]
            
            const isHighlighted = hintHighlights && hintHighlights.some(([hr, hc]) => hr === r && hc === c)

            // Calculate styles for selected states
            let borderStyle = '1px solid rgba(255, 255, 255, 0.1)'
            let bgStyle = 'linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01))'
            let shadowStyle = 'none'

            if (isSelected) {
              borderStyle = isLast ? '2px solid #818cf8' : '2px solid #6366f1'
              bgStyle = isLast 
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(79, 70, 229, 0.2))'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.1))'
              shadowStyle = '0 0 15px rgba(99, 102, 241, 0.25)'
            } else if (isHighlighted) {
              // Handled by gold-pulse animation class
            } else if (special === 'gold') {
              borderStyle = '1px solid rgba(251, 191, 36, 0.6)'
              bgStyle = 'linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(217, 119, 6, 0.05))'
              shadowStyle = 'inset 0 0 10px rgba(251, 191, 36, 0.08)'
            } else if (special === 'arcane') {
              borderStyle = '1px solid rgba(167, 139, 250, 0.6)'
              bgStyle = 'linear-gradient(135deg, rgba(167, 139, 250, 0.12), rgba(124, 58, 237, 0.05))'
              shadowStyle = 'inset 0 0 10px rgba(167, 139, 250, 0.08)'
            } else if (special === 'freeze') {
              borderStyle = '1px solid rgba(34, 211, 238, 0.6)'
              bgStyle = 'linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(8, 145, 178, 0.05))'
              shadowStyle = 'inset 0 0 10px rgba(34, 211, 238, 0.08)'
            } else if (special === 'combo') {
              borderStyle = '1px solid rgba(244, 63, 94, 0.6)'
              bgStyle = 'linear-gradient(135deg, rgba(244, 63, 94, 0.12), rgba(225, 29, 72, 0.05))'
              shadowStyle = 'inset 0 0 10px rgba(244, 63, 94, 0.08)'
            }

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={isHighlighted && !isSelected ? 'gold-pulse-tile' : ''}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: bgStyle,
                  border: borderStyle,
                  borderRadius: 14,
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: shadowStyle,
                  transition: 'all 0.15s ease-out',
                  transform: isSelected ? 'scale(0.96)' : 'none',
                }}
              >
                {/* Special Tile Badges */}
                {special && !isSelected && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      padding: '1px 4px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      color: 'white',
                      backgroundColor:
                        special === 'gold'
                          ? '#d97706'
                          : special === 'arcane'
                          ? '#7c3aed'
                          : special === 'freeze'
                          ? '#0891b2'
                          : '#e11d48',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {special === 'gold' ? '2X' : special === 'arcane' ? '★' : special === 'freeze' ? 'FRZ' : 'CBO'}
                  </span>
                )}

                <div
                  style={{
                    fontSize: size >= 12 ? '0.75rem' : size >= 10 ? '0.9rem' : size >= 8 ? '1.1rem' : size === 5 ? '2rem' : '2.5rem',
                    fontWeight: 800,
                    color: isSelected ? 'white' : 'rgba(255, 255, 255, 0.85)',
                    textShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.5)' : 'none',
                  }}
                >
                  {letter}
                </div>
              </div>
            )
          })
        )}
      </div>

      {renderLines()}

      {/* Render hint path lines if Level 3 (Full path glow) */}
      {hintLevel === 3 && hintHighlights.length >= 2 && (() => {
        const cellPercent = 100 / size
        return (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 9,
            }}
          >
            <defs>
              <linearGradient id="hintGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(251, 191, 36, 0.95)" />
                <stop offset="100%" stopColor="rgba(245, 158, 11, 0.95)" />
              </linearGradient>
            </defs>
            {hintHighlights.map((_, index) => {
              if (index === 0) return null
              const [r1, c1] = hintHighlights[index - 1]
              const [r2, c2] = hintHighlights[index]

              const x1 = `${(c1 + 0.5) * cellPercent}%`
              const y1 = `${(r1 + 0.5) * cellPercent}%`
              const x2 = `${(c2 + 0.5) * cellPercent}%`
              const y2 = `${(r2 + 0.5) * cellPercent}%`

              return (
                <line
                  key={`hint-${index}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="url(#hintGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.8))',
                  }}
                />
              )
            })}
          </svg>
        )
      })()}

      <style>{`
        @keyframes goldPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
            background: linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(217, 119, 6, 0.2)) !important;
            border: 2px solid rgba(251, 191, 36, 0.9) !important;
          }
          70% {
            box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
            background: linear-gradient(135deg, rgba(251, 191, 36, 0.6), rgba(217, 119, 6, 0.3)) !important;
            border: 2px solid rgba(251, 191, 36, 1) !important;
          }
          100% {
            box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
            background: linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(217, 119, 6, 0.2)) !important;
            border: 2px solid rgba(251, 191, 36, 0.9) !important;
          }
        }
        .gold-pulse-tile {
          animation: goldPulse 1.5s infinite ease-in-out !important;
        }
      `}</style>
    </div>
  )
}
