'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useSearchParams } from 'next/navigation'
import {
  generatePlateLayout,
  scorePlateSubmission,
  FOOD_CATALOG,
  FOOD_DISPLAY_NAMES,
  FOOD_THEMES,
  PlateLayout,
  FoodPlacement
} from '@/lib/memoryPlateEngine'
import FoodIcon from './FoodIcon'
import { audioSynth } from '@/lib/audioSynth'

type GameState = 'menu' | 'loading_assets' | 'preview' | 'countdown' | 'placing' | 'results'

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
  
  // Animation classes
  const [animationClass, setAnimationClass] = useState<string>('animate-appear')
  
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

  // Preload helper
  const preloadAssets = (foodsToPreload: string[], callback: () => void) => {
    let loadedCount = 0
    const targetCount = foodsToPreload.length
    if (targetCount === 0) {
      callback()
      return
    }
    let finished = false
    const timeoutId = setTimeout(() => {
      if (!finished) {
        finished = true
        callback()
      }
    }, 2500)

    foodsToPreload.forEach(food => {
      const img = new Image()
      img.onload = img.onerror = () => {
        loadedCount++
        if (loadedCount >= targetCount && !finished) {
          finished = true
          clearTimeout(timeoutId)
          callback()
        }
      }
      img.src = `/assets/games/memory-plate/foods/${food}.svg`
    })
  }

  // Start new round
  const startRound = useCallback((round: number, nextDifficulty: 'easy' | 'medium' | 'hard') => {
    const querySeed = searchParams.get('seed')
    const seed = querySeed ? parseInt(querySeed, 10) + round * 10 : Math.floor(Math.random() * 1000000)
    
    setCurrentSeed(seed)
    const layout = generatePlateLayout(seed, nextDifficulty)
    setPlateLayout(layout)
    setPlacedFoods([])
    setRevealedCount(0)
    setSelectedTrayFood(null)
    setSelectedPlacedId(null)
    setAnimationClass('animate-appear')
    setGameState('loading_assets')

    // Collect assets to preload
    const themeName = layout.theme || 'breakfast'
    const themeFoods = FOOD_THEMES[themeName] || []
    const foodsToPreload = Array.from(new Set([...layout.foods.map(f => f.type), ...themeFoods]))

    preloadAssets(foodsToPreload, () => {
      setGameState('preview')

      if (round === 1) {
        audioSynth.stopBgm()
        audioSynth.startBgm('memory')
      }

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
      }, 250)
    })
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
        startPlacing()
      } else {
        audioSynth.playTick()
      }
    }, 1000)
  };

  // Placing Phase
  const startPlacing = () => {
    setGameState('placing')
    setAnimationClass('animate-appear')
    
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
        handleSubmit()
      }
    }, 1000)
  };

  // Submit plate
  const handleSubmit = () => {
    if (placingTimerRef.current) clearInterval(placingTimerRef.current)
    if (!plateLayout) return

    const result = scorePlateSubmission(
      plateLayout,
      placedFoods.map(f => ({ type: f.type, x: f.x, y: f.y, rotation: f.rotation, scale: f.scale })),
      placingTimeLeft,
      placingTimeTotal
    )

    if (result.accuracy >= 70) {
      audioSynth.playSuccess()
      setAnimationClass('animate-celebrate')
    } else {
      audioSynth.playBuzzer()
      setAnimationClass('animate-shake')
    }

    setRoundAccuracy(result.accuracy)
    setRoundPointsGained(result.score)
    setTotalScore(prev => prev + result.score)
    setAccuracyHistory(prev => [...prev, result.accuracy])
    setGameState('results')

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
      const finalAccuracySum = accuracyHistory.reduce((a, b) => a + b, 0)
      const avgAccuracy = Math.round(finalAccuracySum / totalRoundCount)
      const isWinner = isRanked ? (totalScore >= targetScore) : (avgAccuracy >= 60)
      triggerEndGame(totalScore, isWinner ? 'win' : 'loss')
    }
  }

  // End Game & submit result
  const triggerEndGame = (finalScore: number, finalResult: 'win' | 'loss') => {
    audioSynth.stopBgm()
    const finalAccuracy = Math.round(accuracyHistory.reduce((a, b) => a + b, 0) / Math.max(1, accuracyHistory.length))
    
    window.dispatchEvent(new CustomEvent('gamehub_increment_challenge', {
      detail: { slug: 'memory-plate', score: finalScore, accuracy: finalAccuracy, difficulty }
    }))

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

    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: finalResult,
          opponentName,
          gameSlug: 'memory-plate'
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

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    const scaleFactor = 320 / 100
    const rx = Math.round((clickX - centerX) / scaleFactor)
    const ry = Math.round((clickY - centerY) / scaleFactor)

    const dist = Math.sqrt(rx * rx + ry * ry)
    if (dist > 38 && difficulty !== 'hard') {
      return
    }

    if (selectedTrayFood) {
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

  // Premium serving surfaces renderer
  const renderSurfaceBackground = (surfaceType: string) => {
    switch (surfaceType) {
      case 'ceramic': // Easy: Premium white dinner plate
        return (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8fafc 50%, #f1f5f9 85%, #cbd5e1 100%)',
            boxShadow: 'inset 0 4px 10px rgba(255,255,255,0.8), inset 0 -4px 12px rgba(0,0,0,0.06), 0 10px 25px rgba(0,0,0,0.2)',
            border: '12px solid #e2e8f0'
          }}>
            {/* Inner rim ring */}
            <div style={{
              position: 'absolute', inset: '16px', borderRadius: '50%',
              border: '1px solid rgba(0,0,0,0.04)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
            }} />
            {/* Gloss reflection overlay */}
            <div style={{
              position: 'absolute', top: '8px', left: '15%', width: '70%', height: '30%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)',
              borderRadius: '50%'
            }} />
          </div>
        )
      case 'wood-tray': // Medium: Wooden serving tray
        return (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '16px',
            background: 'linear-gradient(135deg, #854d0e 0%, #713f12 50%, #451a03 100%)',
            border: '10px solid #451a03',
            boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.4), 0 12px 28px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              position: 'absolute', inset: '6px', borderRadius: '8px',
              border: '1.5px solid rgba(0,0,0,0.25)',
              boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.1)'
            }} />
          </div>
        )
      case 'slate-board': // Medium: Slate serving board
        return (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '8px',
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '4px solid #334155',
            boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.08,
              background: 'repeating-linear-gradient(45deg, #000, #000 2px, transparent 2px, transparent 10px)'
            }} />
          </div>
        )
      case 'square-platter': // Medium: Square ceramic platter
        return (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '24px',
            background: 'radial-gradient(circle at 30% 30%, #fafaf9 0%, #f5f5f4 50%, #e7e5e4 100%)',
            border: '8px solid #d6d3d1',
            boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.8), 0 12px 28px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              position: 'absolute', inset: '10px', borderRadius: '16px',
              border: '1.5px solid rgba(0,0,0,0.03)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)'
            }} />
          </div>
        )
      case 'breakfast-tray': // Medium: Breakfast tray with handles
        return (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '12px',
            background: 'linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%)',
            border: '8px solid #0284c7',
            boxShadow: '0 12px 28px rgba(0,0,0,0.25)'
          }}>
            {/* Left handle */}
            <div style={{
              position: 'absolute', left: '-18px', top: '35%', width: '10px', height: '30%',
              background: '#0369a1', borderRadius: '4px 0 0 4px', boxShadow: '-2px 4px 6px rgba(0,0,0,0.2)'
            }} />
            {/* Right handle */}
            <div style={{
              position: 'absolute', right: '-18px', top: '35%', width: '10px', height: '30%',
              background: '#0369a1', borderRadius: '0 4px 4px 0', boxShadow: '2px 4px 6px rgba(0,0,0,0.2)'
            }} />
          </div>
        )
      case 'restaurant-table': // Hard: Restaurant table layout
        return (
          <div style={{
            position: 'absolute', inset: 0,
            background: '#0f172a',
            overflow: 'hidden'
          }}>
            {/* Tablecloth check pattern */}
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.04,
              backgroundImage: 'radial-gradient(#fff 15%, transparent 16%), radial-gradient(#fff 15%, transparent 16%)',
              backgroundSize: '30px 30px',
              backgroundPosition: '0 0, 15px 15px'
            }} />
            {/* Placemat */}
            <div style={{
              position: 'absolute', inset: '10px',
              background: 'linear-gradient(180deg, #f5f5dc 0%, #e2e2bf 100%)',
              border: '1.5px solid #d2b48c', borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }} />
            {/* Napkin (bottom-left decorative) */}
            <div style={{
              position: 'absolute', left: '15px', bottom: '15px', width: '60px', height: '60px',
              background: '#ef4444', clipPath: 'polygon(0 100%, 100% 100%, 50% 0)', opacity: 0.75,
              boxShadow: '1px 2px 4px rgba(0,0,0,0.1)'
            }} />
            
            {/* 1. Dinner Plate (left-center) */}
            <div style={{
              position: 'absolute', left: 'calc(50% + -10 * 3.2px)', top: 'calc(50% + 10 * 3.2px)',
              width: '160px', height: '160px', transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8fafc 50%, #f1f5f9 85%, #cbd5e1 100%)',
              boxShadow: 'inset 0 2px 5px rgba(255,255,255,0.8), 0 6px 15px rgba(0,0,0,0.15)',
              border: '6px solid #e2e8f0'
            }} />

            {/* 2. Side Plate (top-left) */}
            <div style={{
              position: 'absolute', left: 'calc(50% + -25 * 3.2px)', top: 'calc(50% + -20 * 3.2px)',
              width: '80px', height: '80px', transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f8fafc 50%, #cbd5e1 100%)',
              boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.8), 0 4px 10px rgba(0,0,0,0.12)',
              border: '3px solid #e2e8f0'
            }} />

            {/* 3. Bowl (bottom-right) */}
            <div style={{
              position: 'absolute', left: 'calc(50% + 22 * 3.2px)', top: 'calc(50% + 22 * 3.2px)',
              width: '95px', height: '95px', transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: '#9a3412',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.4), 0 6px 12px rgba(0,0,0,0.2)',
              border: '3px solid #7c2d12'
            }}>
              {/* Inner soup fill */}
              <div style={{
                position: 'absolute', inset: '10px', borderRadius: '50%',
                background: '#451a03', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5)'
              }} />
            </div>

            {/* 4. Cup & Saucer (top-right) */}
            <div style={{
              position: 'absolute', left: 'calc(50% + 23 * 3.2px)', top: 'calc(50% + -22 * 3.2px)',
              width: '65px', height: '65px', transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: '#fff',
              border: '3px solid #cbd5e1',
              boxShadow: '0 3px 8px rgba(0,0,0,0.1)'
            }}>
              {/* Coffee fill */}
              <div style={{
                position: 'absolute', inset: '12px', borderRadius: '50%',
                background: '#543d2b', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)'
              }} />
              {/* Cup handle */}
              <div style={{
                position: 'absolute', right: '-12px', top: '25%', width: '12px', height: '50%',
                background: '#fff', border: '2px solid #cbd5e1', borderRadius: '0 8px 8px 0'
              }} />
            </div>
          </div>
        )
      default:
        return null
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
      {/* CSS Animation Keyframes injection */}
      <style>{`
        @keyframes plate-appear {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes shake-wrong {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        @keyframes celebration-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); filter: brightness(1.15); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animate-appear {
          animation: plate-appear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-shake {
          animation: shake-wrong 0.4s ease-in-out;
        }
        .animate-celebrate {
          animation: celebration-pulse 0.6s ease-in-out 2;
        }
        .animate-fade {
          animation: fade-in 0.3s ease-out forwards;
        }
        .food-hover:hover {
          transform: scale(1.1) translateY(-2px);
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

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
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#a855f7', marginBottom: '0.5rem' }}>
            Memory Plate
          </h2>
          <div style={{ display: 'inline-block', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168,85,247,0.2)', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, marginBottom: '1.5rem' }}>
            ✨ Premium Redesign
          </div>
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

      {/* ── STATE: LOADING ASSETS ── */}
      {gameState === 'loading_assets' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(168, 85, 247, 0.2)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Preloading food theme collections...</p>
        </div>
      )}

      {/* ── STATE: PREVIEW ── */}
      {gameState === 'preview' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', gap: '1rem' }}>
            <span>Round {roundNumber} of {totalRoundCount}</span>
            <span style={{ color: '#a855f7' }}>Theme: {plateLayout.theme?.toUpperCase()}</span>
          </div>

          <div style={{ marginBottom: '1rem', color: '#c084fc', fontSize: '0.8rem', fontWeight: 500 }}>
            Memorize the arrangement!
          </div>

          {/* Dynamic visual timer bar */}
          <div style={{ width: '320px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${previewTimerLeft}%`, height: '100%', background: '#a855f7', transition: 'width 30ms linear' }} />
          </div>

          {/* Interactive Plate Container */}
          <div
            ref={plateContainerRef}
            className={animationClass}
            style={{
              width: '320px',
              height: '320px',
              position: 'relative',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: difficulty === 'easy' ? '50%' : difficulty === 'medium' ? '16px' : '0px',
              overflow: 'hidden'
            }}
          >
            {/* Draw beautiful surface backdrop */}
            {renderSurfaceBackground(plateLayout.surfaceType || 'ceramic')}

            {/* Foods popping up sequentially */}
            {plateLayout.foods.slice(0, revealedCount).map((food) => (
              <div
                key={food.id}
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${food.x * 3.2}px)`,
                  top: `calc(50% + ${food.y * 3.2}px)`,
                  width: '54px',
                  height: '54px',
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
          <span style={{ fontSize: '5rem', fontWeight: 900, color: '#ec4899', transform: 'scale(1)', transition: 'all 0.5s' }}>
            {countdown}
          </span>
          <p style={{ color: '#94a3b8', fontSize: '1rem', marginTop: '1rem' }}>Recreation starts next...</p>
        </div>
      )}

      {/* ── STATE: PLACING ── */}
      {gameState === 'placing' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1rem' }}>
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
            className={animationClass}
            style={{
              width: '320px',
              height: '320px',
              position: 'relative',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              cursor: selectedTrayFood || selectedPlacedId ? 'crosshair' : 'default',
              borderRadius: difficulty === 'easy' ? '50%' : difficulty === 'medium' ? '16px' : '0px',
              overflow: 'hidden'
            }}
          >
            {/* Draw beautiful surface backdrop */}
            {renderSurfaceBackground(plateLayout.surfaceType || 'ceramic')}

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
                  width: '54px',
                  height: '54px',
                  transform: `translate(-50%, -50%) rotate(${food.rotation}deg)`,
                  border: selectedPlacedId === food.id ? '2px solid #a855f7' : 'none',
                  borderRadius: '10px',
                  boxShadow: selectedPlacedId === food.id ? '0 0 10px rgba(168,85,247,0.8)' : 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  background: 'rgba(255,255,255,0.04)',
                  zIndex: 20
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
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    zIndex: 25
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
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 25
                    }}
                  >
                    ↻
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Recreate instructions */}
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: 0, minHeight: '1.2rem' }}>
            {selectedTrayFood ? `Tap surface to place ${FOOD_DISPLAY_NAMES[selectedTrayFood]}` : selectedPlacedId ? 'Tap empty surface spot to move item' : 'Tap item below, then tap surface to arrange'}
          </p>

          {/* Food Selection Tray (Only chosen theme foods scrollable) */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              overflowX: 'auto',
              width: '100%',
              maxWidth: '380px',
              padding: '0.6rem 0.5rem',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              scrollbarWidth: 'thin'
            }}
          >
            {(FOOD_THEMES[plateLayout.theme || 'breakfast'] || []).map(food => (
              <button
                key={food}
                onClick={() => {
                  setSelectedTrayFood(food)
                  setSelectedPlacedId(null)
                  audioSynth.playTick()
                }}
                className="food-hover"
                style={{
                  minWidth: '54px',
                  height: '54px',
                  borderRadius: '10px',
                  background: selectedTrayFood === food ? 'rgba(168,85,247,0.2)' : 'rgba(255,255,255,0.04)',
                  border: selectedTrayFood === food ? '2.5px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  outline: 'none',
                  padding: '4px',
                  transition: 'all 0.15s ease'
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
            style={{ width: '100%', maxWidth: '320px', padding: '0.75rem', borderRadius: '12px', fontWeight: 600 }}
          >
            Submit Arrangement
          </button>
        </div>
      )}

      {/* ── STATE: RESULTS ── */}
      {gameState === 'results' && plateLayout && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.25rem', textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: roundAccuracy >= 70 ? '#10b981' : '#f59e0b' }}>
            {roundAccuracy >= 70 ? 'Excellent Match!' : 'Round Completed'}
          </h3>

          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', margin: '0.5rem 0' }}>
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
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Target */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 500 }}>Original Layout</span>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  position: 'relative',
                  borderRadius: difficulty === 'easy' ? '50%' : difficulty === 'medium' ? '12px' : '0px',
                  overflow: 'hidden',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                  transform: 'scale(1)'
                }}
              >
                {/* Micro scaled layout background */}
                <div style={{ transform: 'scale(0.46875)', transformOrigin: 'top left', width: '320px', height: '320px', position: 'absolute' }}>
                  {renderSurfaceBackground(plateLayout.surfaceType || 'ceramic')}
                </div>
                {plateLayout.foods.map((food) => (
                  <div
                    key={food.id}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${food.x * 1.5}px)`,
                      top: `calc(50% + ${food.y * 1.5}px)`,
                      width: '26px',
                      height: '26px',
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
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 500 }}>Your Arrangement</span>
              <div
                style={{
                  width: '150px',
                  height: '150px',
                  position: 'relative',
                  borderRadius: difficulty === 'easy' ? '50%' : difficulty === 'medium' ? '12px' : '0px',
                  overflow: 'hidden',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                }}
              >
                {/* Micro scaled layout background */}
                <div style={{ transform: 'scale(0.46875)', transformOrigin: 'top left', width: '320px', height: '320px', position: 'absolute' }}>
                  {renderSurfaceBackground(plateLayout.surfaceType || 'ceramic')}
                </div>
                {placedFoods.map((food) => (
                  <div
                    key={food.id}
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${food.x * 1.5}px)`,
                      top: `calc(50% + ${food.y * 1.5}px)`,
                      width: '26px',
                      height: '26px',
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
            style={{ width: '100%', maxWidth: '320px', padding: '0.75rem', borderRadius: '12px', marginTop: '0.5rem', fontWeight: 600 }}
          >
            {roundNumber < totalRoundCount ? 'Next Round' : 'View Session Results'}
          </button>
        </div>
      )}
    </div>
  )
}
