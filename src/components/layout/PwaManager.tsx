'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    deferredInstallPrompt: any
    showPwaInstallPrompt: () => Promise<void>
  }
}

export default function PwaManager() {
  const router = useRouter()

  useEffect(() => {
    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('📡 [PWA] Service Worker registered scope:', reg.scope)
          })
          .catch((err) => {
            console.error('❌ [PWA] Service Worker registration failed:', err)
          })
      })
    }

    // 2. Track PWA events
    const logAnalytics = async (eventName: string, metadata?: Record<string, any>) => {
      try {
        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventName, metadata })
        })
      } catch (err) {
        console.error('Failed to log PWA event:', err)
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default prompt
      e.preventDefault()
      // Stash event
      window.deferredInstallPrompt = e
      
      console.log('📥 [PWA] Install prompt available')
      
      // Log that prompt is shown/available
      logAnalytics('Install Prompt Shown', { platform: navigator.userAgent })

      // Dispatch a custom event to notify UI components (like DashboardNav)
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: true }))
    }

    const handleAppInstalled = () => {
      console.log('🎉 [PWA] App successfully installed!')
      logAnalytics('App Installed')
      window.deferredInstallPrompt = null
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: false }))
    }

    // Add prompt trigger helper to window
    window.showPwaInstallPrompt = async () => {
      const promptEvent = window.deferredInstallPrompt
      if (!promptEvent) {
        console.log('⚠️ [PWA] No active install prompt deferred.')
        return
      }

      // Show native prompt
      promptEvent.prompt()
      
      // Wait for user choice
      const { outcome } = await promptEvent.userChoice
      console.log(`👤 [PWA] User response to installation: ${outcome}`)

      if (outcome === 'accepted') {
        logAnalytics('Install Prompt Accepted')
      } else {
        logAnalytics('Install Prompt Dismissed')
      }

      // Clear stashed prompt
      window.deferredInstallPrompt = null
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: false }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check if app is already running in standalone mode (installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (isStandalone) {
      logAnalytics('pwa_launched_standalone')
    }

    // 3. Handle Capacitor Deep Links
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor
    let deepLinkListener: any = null

    if (isCapacitor) {
      console.log('📱 [Capacitor] Native environment detected inside PwaManager')
      import('@capacitor/app').then(({ App }) => {
        App.addListener('appUrlOpen', (event: any) => {
          console.log('📱 [Capacitor] App opened with URL:', event.url)
          try {
            const targetUrl = event.url
            if (targetUrl.startsWith('gamehub://join')) {
              const urlObj = new URL(targetUrl)
              const room = urlObj.searchParams.get('room')
              if (room) {
                console.log(`📱 [Capacitor] Directing to join room: ${room}`)
                router.push(`/dashboard/multiplayer?room=${room}`)
              }
            } else if (targetUrl.includes('/dashboard/multiplayer/play/')) {
              const parts = targetUrl.split('/dashboard/multiplayer/play/')
              if (parts.length > 1) {
                const room = parts[1].split(/[?#]/)[0]
                if (room) {
                  console.log(`📱 [Capacitor] Directing to play page: ${room}`)
                  router.push(`/dashboard/multiplayer/play/${room}`)
                }
              }
            } else if (targetUrl.includes('/dashboard/multiplayer')) {
              const urlObj = new URL(targetUrl)
              const room = urlObj.searchParams.get('room') || urlObj.searchParams.get('code')
              if (room) {
                router.push(`/dashboard/multiplayer?room=${room}`)
              }
            }
          } catch (err) {
            console.error('Error handling deep link:', err)
          }
        }).then((listener) => {
          deepLinkListener = listener
        })
      }).catch(err => {
        console.error('[Capacitor] Failed to load @capacitor/app plugin:', err)
      })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      if (deepLinkListener) {
        deepLinkListener.remove()
      }
    }
  }, [router])

  return null
}
