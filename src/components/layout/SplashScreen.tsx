'use client'

import { useState, useEffect } from 'react'

export default function SplashScreen() {
  const [visible, setVisible] = useState(false)
  const [isFading, setIsFading] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Check if splash has already been shown in this tab session
    const shown = sessionStorage.getItem('gamehub_splash_shown')
    if (shown) {
      return
    }

    setVisible(true)

    let isPageLoaded = false
    let minTimeElapsed = false
    let maxTimeElapsed = false

    const checkAndDismiss = () => {
      // Dismiss only if minimum time has elapsed AND (page is loaded OR max time cap has elapsed)
      if (minTimeElapsed && (isPageLoaded || maxTimeElapsed)) {
        setIsFading(true)
        setTimeout(() => {
          setVisible(false)
          sessionStorage.setItem('gamehub_splash_shown', 'true')
        }, 300)
      }
    }

    // 1. Check page load status
    if (typeof window !== 'undefined') {
      if (document.readyState === 'complete') {
        isPageLoaded = true
      } else {
        const handleLoad = () => {
          isPageLoaded = true
          checkAndDismiss()
        }
        window.addEventListener('load', handleLoad)
      }
    }

    // 2. Progress bar animation (reaches 100% in 1.5 seconds)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 4 // 25 steps * 60ms = 1500ms
      })
    }, 60)

    // 3. Minimum display timer (1.5 seconds)
    const minTimer = setTimeout(() => {
      minTimeElapsed = true
      setProgress(100)
      checkAndDismiss()
    }, 1500)

    // 4. Maximum display timer / cap (3.0 seconds)
    const maxTimer = setTimeout(() => {
      maxTimeElapsed = true
      checkAndDismiss()
    }, 3000)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(minTimer)
      clearTimeout(maxTimer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', checkAndDismiss)
      }
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'hsl(222 20% 10%)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      opacity: isFading ? 0 : 1,
      transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      pointerEvents: isFading ? 'none' : 'auto',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', maxWidth: '300px', width: '80%' }}>
        {/* GameHub Logo */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '3rem',
          boxShadow: '0 8px 32px hsl(220 100% 60% / 0.3)',
          animation: 'pulse-glow 2s infinite',
        }}>
          🎮
        </div>

        {/* GameHub Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(135deg, hsl(220 100% 75%), hsl(270 80% 75%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            GameHub
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'hsl(220 10% 55%)', marginTop: '0.25rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Play · Compete · Win
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div style={{ width: '100%', height: '6px', background: 'hsl(220 20% 16%)', borderRadius: '99px', overflow: 'hidden', marginTop: '1rem' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, hsl(220 100% 65%), hsl(270 80% 65%))', borderRadius: '99px', transition: 'width 0.08s linear' }} />
        </div>
      </div>
    </div>
  )
}
