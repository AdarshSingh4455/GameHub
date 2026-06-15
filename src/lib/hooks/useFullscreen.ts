'use client'

import { useState, useEffect, RefObject } from 'react'

interface VendorDocument extends Document {
  webkitFullscreenElement?: Element
  mozFullScreenElement?: Element
  msFullscreenElement?: Element
  webkitExitFullscreen?: () => Promise<void>
  mozCancelFullScreen?: () => Promise<void>
  msExitFullscreen?: () => Promise<void>
}

interface VendorHTMLElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
}

export function useFullscreen(ref: RefObject<HTMLElement | null>, autoFullscreenOnMobile: boolean = false) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (autoFullscreenOnMobile && typeof window !== 'undefined' && window.innerWidth < 768) {
      const element = ref.current
      if (element) {
        element.classList.add('fullscreen-mobile-fallback')
        setIsFullscreen(true)
      }
    }
  }, [autoFullscreenOnMobile, ref])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as VendorDocument
      const isCurrentlyFullscreen = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      )
      setIsFullscreen(isCurrentlyFullscreen)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = async () => {
    const element = ref.current as VendorHTMLElement | null
    if (!element) return

    const doc = document as VendorDocument

    if (!isFullscreen) {
      try {
        if (element.requestFullscreen) {
          await element.requestFullscreen()
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen()
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen()
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen()
        } else {
          // Mobile Fallback: add css class for simulated fullscreen
          element.classList.add('fullscreen-mobile-fallback')
          setIsFullscreen(true)
        }
      } catch (err) {
        console.warn('Fullscreen request failed, applying mobile CSS fallback:', err)
        element.classList.add('fullscreen-mobile-fallback')
        setIsFullscreen(true)
      }
    } else {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen()
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen()
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen()
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen()
        } else {
          // Mobile Fallback: remove css class
          element.classList.remove('fullscreen-mobile-fallback')
          setIsFullscreen(false)
        }
      } catch (err) {
        console.warn('Exit fullscreen failed, removing mobile CSS fallback:', err)
        element.classList.remove('fullscreen-mobile-fallback')
        setIsFullscreen(false)
      }
    }
  }

  // Handle ESC key or other cleanup for mobile fallback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen && ref.current?.classList.contains('fullscreen-mobile-fallback')) {
        ref.current.classList.remove('fullscreen-mobile-fallback')
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, ref])

  return { isFullscreen, toggleFullscreen }
}
