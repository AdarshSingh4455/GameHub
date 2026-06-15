'use client'

import React, { useEffect, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'

interface Props {
  src: string
  title: string
  slug: string
  username?: string
  isFullscreen: boolean
}

export default function IframeGame({ src, title, slug, username, isFullscreen }: Props) {
  const { submitGameResult } = useGameSession()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Append username query parameter to iframe source
  const finalSrc = `${src}${src.includes('?') ? '&' : '?'}username=${encodeURIComponent(username || 'Guest')}`

  useEffect(() => {
    function handleIframeMessage(event: MessageEvent) {
      // 1. Validate Origin (only allow same-origin communication)
      if (event.origin !== window.location.origin) {
        console.warn(`[postMessage Security] Ignored message from unapproved origin: ${event.origin}`)
        return
      }

      const data = event.data
      if (!data || typeof data !== 'object') return

      // Ignore unknown events
      if (data.type !== 'game_over') {
        return
      }

      // 2. Validate Payload Shape & Type according to standardized contract
      const hasValidSlug = typeof data.gameSlug === 'string'
      const hasValidResult = ['win', 'loss', 'draw'].includes(data.result)
      const hasValidScore = typeof data.score === 'number'

      if (!hasValidSlug || !hasValidResult || !hasValidScore) {
        console.error('[postMessage Security] Rejected malformed game_over event payload:', data)
        return
      }

      // Safe and validated event submission
      submitGameResult({
        gameSlug: data.gameSlug,
        result: data.result as 'win' | 'loss' | 'draw',
        metadata: {
          ...data.metadata,
          score: data.score,
        },
      })
    }

    window.addEventListener('message', handleIframeMessage)
    return () => window.removeEventListener('message', handleIframeMessage)
  }, [slug, submitGameResult])

  // Inject CSS to hide duplicate headers / rankings / progression in same-origin legacy games
  const handleIframeLoad = () => {
    const iframe = iframeRef.current
    if (!iframe) return

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        const style = doc.createElement('style')
        style.innerHTML = `
          /* CSS Injection to hide duplicate headers, rankings, or dashboard buttons in legacy games */
          header, .header, #header, 
          .back-btn, .quit-btn, .dashboard-btn,
          .leaderboard-btn, #leaderboard, .leaderboard,
          .high-score, .best-score, .progression-panel,
          #gamehub-duplicate-element {
            display: none !important;
          }
        `
        doc.head.appendChild(style)
      }
    } catch (err) {
      console.warn('[Iframe CSS Injection blocked by same-origin policy or other issue]:', err)
    }
  }

  // Dynamic container styling based on fullscreen prop
  const containerStyle: React.CSSProperties = isFullscreen
    ? {
        background: 'black',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: 1,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
      }

  return (
    <div style={containerStyle} id="iframe-game-wrapper">
      {/* Iframe element container */}
      <div
        className={isFullscreen ? '' : 'card'}
        style={{
          overflow: 'hidden',
          borderRadius: isFullscreen ? 0 : 16,
          flex: isFullscreen ? 1 : 'unset',
          border: isFullscreen ? 'none' : undefined,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <iframe
          ref={iframeRef}
          src={finalSrc}
          title={title}
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: isFullscreen ? '100%' : 'clamp(450px, 65vh, 750px)',
            border: 'none',
            display: 'block',
            flex: isFullscreen ? 1 : 'unset',
          }}
          allow="fullscreen; autoplay"
          id="iframe-game-frame"
        />
      </div>
    </div>
  )
}
