'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useSearchParams } from 'next/navigation'
import {
  generatePlateLayout,
  scorePlateSubmission,
  FOOD_CATALOG,
  FOOD_DISPLAY_NAMES,
  PlateLayout,
  FoodPlacement
} from '@/lib/memoryPlateEngine'
import FoodIcon from './FoodIcon'
import { audioSynth } from '@/lib/audioSynth'

type GameState = 'menu' | 'preview' | 'countdown' | 'placing' | 'results'

export default function MemoryPlateGame() {
  const { submitGameResult } = useGameSession()
  const searchParams = useSearchParams()
  
  // Game parameters from query/params
  const mode = searchParams.get('mode') || 'practice'
  const isRanked = mode === 'ranked'
  const targetScore = parseInt(searchParams.get('targetScore') || '1000', 10)
  const opponentName = searchParams.get('opponent') || 'ApexBot'

  // Settings
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [gameState, setGameState] = useState<GameState>('menu')
  
  // Audio state
  const [isSoundMuted, setIsSoundMuted] = useState(false)

  // Core gameplay states
  const [currentSeed, setCurrentSeed] = useState<number>(0)
  const [roundNumber, setRoundNumber] = useState<number>(1)
  const [totalRoundCount] = useState<number>(3)
  const [totalScore, setTotalScore] = useState<number>(0)
  const [roundAccuracy, setRoundAccuracy] = useState<number>(0)
  const [roundPointsGained, setRoundPointsGained] = useState<number>(0)
  const [accuracyHistory, setAccuracyHistory] = useState<number[]>([])

  // Layout structures
  const [plateLayout, setPlateLayout] = useState<PlateLayout | null>(null)
  const [placedFoods, setPlacedFoods] = useState<FoodPlacement[]>([])
  
  // Staggered reveal for food items in preview
  const [revealedCount, setRevealedCount] = useState<number>(0)
  
  // Timer & countdown states
  const [countdown, setCountdown] = useState<number>(3)
  const [previewTimerLeft, setPreviewTimerLeft] = useState<number>(100) // percentage
  const [placingTimeTotal, setPlacingTimeTotal] = useState<number>(30) // seconds
  const [placingTimeLeft, setPlacingTimeLeft] = useState<number>(30) // seconds

  // Selection states
  const [selectedTrayFood, setSelectedTrayFood] = useState<string | null>(null)
  const [selectedPlacedId, setSelectedPlacedId] = useState<string | null>(null)
  
  // References
  const previewTimerRef = useRef<any>(null)
  const placingTimerRef = useRef<any>(null)
  const previewStartTimeRef = useRef<number>(0)
  const placingStartTimeRef = useRef<number>(0)
  const plateContainerRef = useRef<HTMLDivElement>(null)

  // Toggle sound
  const handleToggleSound = () => {
    const nextMute = !isSoundMuted
    setIsSoundMuted(nextMute)
    localStorage.setItem('gamehub_audio_muted', nextMute ? 'true' : 'false')
    if (nextMute) {
      audioSynth.stopBgm()
    } else {
      audioSynth.startBgm('memory')
    }
  }

  // Load sound setting
  useEffect(() => {
    const isMuted = localStorage.getItem('gamehub_audio_muted') === 'true'
    setIsSoundMuted(isMuted)
  }, [])

  // Start new round
  const startRound = useCallback((round: number, nextDifficulty: 'easy' | 'medium' | 'hard') => {
    // Generate new seed or use existing query parameter for ranked synchronization
    const querySeed = searchParams.get('seed')
    const seed = querySeed ? parseInt(querySeed, 10) + round * 10 : Math.floor(Math.random() * 1000000)
    
    setCurrentSeed(seed)
    const layout = generatePlateLayout(seed, nextDifficulty)
    setPlateLayout(layout)
    setPlacedFoods([])
    setRevealedCount(0)
    setSelectedTrayFood(null)
    setSelectedPlacedId(null)
    setGameState('preview')

    // Music control
    if (round === 1) {
      audioSynth.stopBgm()
      audioSynth.startBgm('memory')
    }

    // Play slide animation sound
    setTimeout(() => {
      audioSynth.playPop()
    }, 100)

    // Stagger reveal of food items
    let count = 0
    const staggerInterval = setInterval(() => {
      count++
      setRevealedCount(count)
      if (layout.foods && count >= layout.foods.length) {
        clearInterval(staggerInterval)
        
        // Start preview visual timer bar
        previewStartTimeRef.current = Date.now()
        const duration = layout.previewDurationMs
        
        if (previewTimerRef.current) clearInterval(previewTimerRef.current)
        previewTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - previewStartTimeRef.current
          const percent = Math.max(0, 100 - (elapsed / duration) * 100)
          setPreviewTimerLeft(percent)
          
          if (elapsed >= duration) {
            clearInterval(previewTimerRef.current)
            startCountdown()
          }
        }, 30)
      } else {
        audioSynth.playTick()
      }
    }, 300)
  }, [searchParams])

  // Countdown Phase
  const startCountdown = () => {
    if (previewTimerRef.current) clearInterval(previewTimerRef.current)
    setGameState('countdown')
    setCountdown(3)
    audioSynth.playTick()

    let val = 3
    const cInterval = setInterval(() => {
      val--
      setCountdown(val)
      if (val <= 0) {
        clearInterval(cInterval)
        // Transition to Placing Phase
        startPlacing()
      } else {
        audioSynth.playTick()
      }
    }, 1000)
  };

  // Placing Phase
  const startPlacing = () => {
    setGameState('placing')
    
    // 30 seconds for easy, 40 for medium, 50 for hard
    const timeLimit = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 60
    setPlacingTimeTotal(timeLimit)
    setPlacingTimeLeft(timeLimit)
    
    placingStartTimeRef.current = Date.now()
    if (placingTimerRef.current) clearInterval(placingTimerRef.current)
    placingTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - placingStartTimeRef.current) / 1000)
      const left = Math.max(0, timeLimit - elapsed)
      setPlacingTimeLeft(left)
      
      if (left <= 0) {
        clearInterval(placingTimerRef.current)
        // Auto-submit on timeout
        handleSubmit()
      }
    }, 1000)
  };

  // Submit plate
  const handleSubmit = () => {
    if (placingTimerRef.current) clearInterval(placingTimerRef.current)
    if (!plateLayout) return

    const timeSpent = placingTimeTotal - placingTimeLeft
    const result = scorePlateSubmission(
      plateLayout,
      placedFoods.map(f => ({ type: f.type, x: f.x, y: f.y, rotation: f.rotation, scale: f.scale })),
      placingTimeLeft,
      placingTimeTotal
    )

    // Sound
    if (result.accuracy >= 70) {
      audioSynth.playSuccess()
    } else {
      audioSynth.playBuzzer()
    }

    setRoundAccuracy(result.accuracy)
    setRoundPointsGained(result.score)
    setTotalScore(prev => prev + result.score)
    setAccuracyHistory(prev => [...prev, result.accuracy])
    setGameState('results')

    // Submit early matchmaking result if ranked and exceeds target score
    if (isRanked && (totalScore + result.score) >= targetScore) {
      triggerEndGame(totalScore + result.score, 'win')
    }
  };

  // Handle proceed to next round or end game
  const handleProceed = () => {
    if (roundNumber < totalRoundCount) {
      const nextRound = roundNumber + 1
      setRoundNumber(nextRound)
      startRound(nextRound, difficulty)
    } else {
      // Game session complete
      const finalAccuracySum = accuracyHistory.reduce((a, b) => a + b, 0)
      const avgAccuracy = Math.round(finalAccuracySum / totalRoundCount)
      
      // Outcome
      const isWinner = isRanked ? (totalScore >= targetScore) : (avgAccuracy >= 60)
      triggerEndGame(totalScore, isWinner ? 'win' : 'loss')
    }
  }

  // End Game & submit result
  const triggerEndGame = (finalScore: number, finalResult: 'win' | 'loss') => {
    audioSynth.stopBgm()
    
    // Save to daily challenges
    const finalAccuracy = Math.round(accuracyHistory.reduce((a, b) => a + b, 0) / Math.max(1, accuracyHistory.length))
    
    // Daily challenges checks
    window.dispatchEvent(new CustomEvent('gamehub_increment_challenge', {
      detail: { slug: 'memory-plate', score: finalScore, accuracy: finalAccuracy, difficulty }
    }))

    // Save achievement stats
    // Submit result
    submitGameResult({
      gameSlug: 'memory-plate',
      result: finalResult,
      metadata: {
        score: finalScore,
        customTitle: finalResult === 'win' ? 'Memory Master!' : 'Plate Failed',
        customSubtitle: `Total Score: ${finalScore} • Accuracy: ${finalAccuracy}%`,
        statistics: [
          { label: 'Total Score', value: finalScore, color: '#38bdf8' },
          { label: 'Avg Accuracy', value: `${finalAccuracy}%`, color: '#10b981' },
          { label: 'Difficulty', value: difficulty.toUpperCase(), color: '#ec4899' },
          { label: 'Rounds', value: `${roundNumber}/${totalRoundCount}`, color: '#a855f7' }
        ],
        gameMetadata: {
          difficulty,
          avgAccuracy: finalAccuracy,
          totalScore: finalScore,
          isRanked,
          targetScore: isRanked ? targetScore : undefined
        }
      }
    })

    // Ranked stats post
    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: finalResult,
          opponentName
        })
      }).catch(err => console.error('Failed to submit ranked stats:', err))
    }

    setGameState('menu')
  }

  // Handle Plate click to place food
  const handlePlateClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState !== 'placing' || !plateContainerRef.current) return

    const rect = plateContainerRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Center is (rect.width/2, rect.height/2)
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Map pixel offsets to relative offsets (-40 to 40)
    // Plate width/height is roughly 320px
    const scaleFactor = 320 / 100 // pixels per coordinate unit
    const rx = Math.round((clickX - centerX) / scaleFactor)
    const ry = Math.round((clickY - centerY) / scaleFactor)

    // Boundaries check (keep within radius 38)
    const dist = Math.sqrt(rx * rx + ry * ry)
    if (dist > 38) {
      // Outside plate boundaries
      return
    }

    if (selectedTrayFood) {
      // Place new food item
      const newItem: FoodPlacement = {
        id: `placed-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: selectedTrayFood,
        x: rx,
        y: ry,
        rotation: 0,
        scale: 1.0
      }
      setPlacedFoods(prev => [...prev, newItem])
      audioSynth.playPop()
      setSelectedTrayFood(null)
    } else if (selectedPlacedId) {
      // Move existing item
      setPlacedFoods(prev => prev.map(f => {
        if (f.id === selectedPlacedId) {
          return { ...f, x: rx, y: ry }
        }
        return f
      }))
      audioSynth.playTick()
      setSelectedPlacedId(null)
    }
  }

  // Remove food item from plate
  const handleRemovePlaced = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlacedFoods(prev => prev.filter(f => f.id !== id))
    audioSynth.playTick()
    if (selectedPlacedId === id) setSelectedPlacedId(null)
  }

  // Rotate food item
  const handleRotatePlaced = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPlacedFoods(prev => prev.map(f => {
      if (f.id === id) {
        return { ...f, rotation: (f.rotation + 90) % 360 }
      }
      return f
    }))
    audioSynth.playRotate()
  }

  // Init ranked game immediately on mount if param present
  useEffect(() => {
    if (isRanked) {
      // Start Ranked queue immediately
      setDifficulty(difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'medium')
      setRoundNumber(1)
      setTotalScore(0)
      setAccuracyHistory([])
      startRound(1, difficulty)
    }
    return () => {
      audioSynth.stopBgm()
      if (previewTimerRef.current) clearInterval(previewTimerRef.current)
      if (placingTimerRef.current) clearInterval(placingTimerRef.current)
    }
  }, [isRanked, startRound, difficulty])

  // Helper styles based on plate theme
  const getPlateBackground = (color: string) => {
    switch (color) {
      case 'neon-blue':
        return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
      case 'neon-pink':
        return 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
      case 'neon-green':
        return 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
      case 'gold':
        return 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)'
      case 'cyberpunk':
        return 'linear-gradient(135deg, #a855f7 0%, #1e1b4b 100%)'
      case 'holo-purple':
      default:
        return 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'hsl(222 24% 7%)',
        borderRadius: '16px',
        color: '#f8fafc',
        width: '100%',
        minHeight: '520px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Sound Controller */}
      <button
        onClick={handleToggleSound}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          padding: '0.4rem 0.6rem',
          borderRadius: '8px',
          color: '#f8fafc',
          cursor: 'pointer',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          zIndex: 10
        }}
      >
        {isSoundMuted ? '🔇 Muted' : '🔊 Sound'}
      </button>

      {/* ── STATE: MENU ── */}
      {gameState === 'menu' && (
        <div style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#a855f7', marginBottom: '1.5rem' }}>
            Memory Plate
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Memorize the arrangement of ingredients on the plate and recreate it exactly as shown. Speed and accuracy matter!
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
            {(['easy', 'medium', 'hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: difficulty === d ? '#a855f7' : 'rgba(255,255,255,0.1)',
                  background: difficulty === d ? '#a855f7' : 'rgba(255,255,255,0.04)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setRoundNumber(1)
              setTotalScore(0)
              setAccuracyHistory([])
              startRound(1, difficulty)
            }}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '12px' }}
          >
            Start Practice
          </button>
        </div>
      )}

      {/* ── STATE: PREVIEW ── */}
      {gameState === 'preview' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', gap: '1rem' }}>
            <span>Round {roundNumber} of {totalRoundCount}</span>
            <span style={{ color: '#a855f7' }}>Memorize the plate!</span>
          </div>

          {/* Dynamic visual timer bar */}
          <div style={{ width: '320px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${previewTimerLeft}%`, height: '100%', background: '#a855f7', transition: 'width 30ms linear' }} />
          </div>

          {/* Plate Layout rendering */}
          <div
            ref={plateContainerRef}
            style={{
              width: '320px',
              height: '320px',
              borderRadius: plateLayout.plateShape === 'circle' ? '50%' : plateLayout.plateShape === 'square' ? '16px' : '30%',
              background: getPlateBackground(plateLayout.plateColor),
              position: 'relative',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              clipPath: plateLayout.plateShape === 'hexagon' ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : undefined
            }}
          >
            {/* Foods popping up sequentially */}
            {plateLayout.foods.slice(0, revealedCount).map((food) => (
              <div
                key={food.id}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${food.x * 3.2}px)`,
                  top: `calc(50% + ${food.y * 3.2}px)`,
                  width: '60px',
                  height: '60px',
                  transform: `translate(-50%, -50%) rotate(${food.rotation}deg) scale(${food.scale})`,
                  transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              >
                <FoodIcon type={food.type} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATE: COUNTDOWN ── */}
      {gameState === 'countdown' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '5rem', fontWeight: 900, color: '#ec4899', animation: 'pulse 1s infinite' }}>
            {countdown}
          </span>
          <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Recreation starts next...</p>
        </div>
      )}

      {/* ── STATE: PLACING ── */}
      {gameState === 'placing' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '380px', fontSize: '0.9rem' }}>
            <span>Round {roundNumber} of {totalRoundCount}</span>
            <span style={{ color: placingTimeLeft < 10 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
              ⏱️ {placingTimeLeft}s remaining
            </span>
          </div>

          {/* Interactive Plate Container */}
          <div
            ref={plateContainerRef}
            onClick={handlePlateClick}
            style={{
              width: '320px',
              height: '320px',
              borderRadius: plateLayout.plateShape === 'circle' ? '50%' : plateLayout.plateShape === 'square' ? '16px' : '30%',
              background: 'hsl(222, 18%, 18%)',
              border: '4px dashed rgba(255,255,255,0.15)',
              position: 'relative',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              cursor: selectedTrayFood || selectedPlacedId ? 'crosshair' : 'default',
              clipPath: plateLayout.plateShape === 'hexagon' ? 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' : undefined
            }}
          >
            {/* Placed foods */}
            {placedFoods.map((food) => (
              <div
                key={food.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPlacedId(food.id)
                  setSelectedTrayFood(null)
                }}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${food.x * 3.2}px)`,
                  top: `calc(50% + ${food.y * 3.2}px)`,
                  width: '60px',
                  height: '60px',
                  transform: `translate(-50%, -50%) rotate(${food.rotation}deg)`,
                  border: selectedPlacedId === food.id ? '2px solid #a855f7' : 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                <FoodIcon type={food.type} />
                
                {/* Control overlays */}
                <button
                  onClick={(e) => handleRemovePlaced(food.id, e)}
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '18px',
                    height: '18px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
                
                {difficulty !== 'easy' && (
                  <button
                    onClick={(e) => handleRotatePlaced(food.id, e)}
                    style={{
                      position: 'absolute',
                      bottom: '-8px',
                      right: '-8px',
                      width: '18px',
                      height: '18px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ↻
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Recreate instructions */}
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: 0 }}>
            {selectedTrayFood ? `Tap plate to place ${FOOD_DISPLAY_NAMES[selectedTrayFood]}` : selectedPlacedId ? 'Tap empty plate spot to move item' : 'Tap item below, then tap plate to arrange'}
          </p>

          {/* Food Selection Tray (Horizontal Scrollable) */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              overflowX: 'auto',
              width: '100%',
              maxWidth: '380px',
              padding: '0.5rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            {FOOD_CATALOG.map(food => (
              <button
                key={food}
                onClick={() => {
                  setSelectedTrayFood(food)
                  setSelectedPlacedId(null)
                  audioSynth.playTick()
                }}
                style={{
                  minWidth: '54px',
                  height: '54px',
                  borderRadius: '10px',
                  background: selectedTrayFood === food ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.05)',
                  border: selectedTrayFood === food ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title={FOOD_DISPLAY_NAMES[food]}
              >
                <div style={{ width: '40px', height: '40px' }}>
                  <FoodIcon type={food} />
                </div>
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={placedFoods.length === 0}
            style={{ width: '100%', maxWidth: '320px', padding: '0.75rem', borderRadius: '12px' }}
          >
            Submit Arrangement
          </button>
        </div>
      )}

      {/* ── STATE: RESULTS ── */}
      {gameState === 'results' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
            Round {roundNumber} Results
          </h3>

          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', margin: '1rem 0' }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#f59e0b' }}>{roundAccuracy}%</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Accuracy</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#38bdf8' }}>+{roundPointsGained}</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Points</div>
            </div>
          </div>

          {/* Side-by-side comparison */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Target */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Original Plate</span>
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: plateLayout.plateShape === 'circle' ? '50%' : plateLayout.plateShape === 'square' ? '8px' : '20%',
                  background: getPlateBackground(plateLayout.plateColor),
                  position: 'relative'
                }}
              >
                {plateLayout.foods.map((food) => (
                  <div
                    key={food.id}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${food.x * 1.4}px)`,
                      top: `calc(50% + ${food.y * 1.4}px)`,
                      width: '28px',
                      height: '28px',
                      transform: `translate(-50%, -50%) rotate(${food.rotation}deg) scale(${food.scale})`
                    }}
                  >
                    <FoodIcon type={food.type} />
                  </div>
                ))}
              </div>
            </div>

            {/* Submission */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Your Plate</span>
              <div
                style={{
                  width: '140px',
                  height: '140px',
                  borderRadius: plateLayout.plateShape === 'circle' ? '50%' : plateLayout.plateShape === 'square' ? '8px' : '20%',
                  background: 'hsl(222, 18%, 18%)',
                  border: '2px dashed rgba(255,255,255,0.1)',
                  position: 'relative'
                }}
              >
                {placedFoods.map((food) => (
                  <div
                    key={food.id}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${food.x * 1.4}px)`,
                      top: `calc(50% + ${food.y * 1.4}px)`,
                      width: '28px',
                      height: '28px',
                      transform: `translate(-50%, -50%) rotate(${food.rotation}deg) scale(${food.scale})`
                    }}
                  >
                    <FoodIcon type={food.type} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleProceed}
            style={{ width: '100%', maxWidth: '320px', padding: '0.75rem', borderRadius: '12px', marginTop: '1rem' }}
          >
            {roundNumber < totalRoundCount ? 'Next Round' : 'View Session Results'}
          </button>
        </div>
      )}
    </div>
  )
}
