'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

declare global {
  interface Window {
    deferredInstallPrompt: any
    showPwaInstallPrompt: () => Promise<void>
    Capacitor?: any
  }
}

export default function PwaManager() {
  const router = useRouter()
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [newVersionInfo, setNewVersionInfo] = useState<{ version: string; whatsNew: string[] } | null>(null)

  useEffect(() => {
    // 0. Check app version updates
    const LOCAL_VERSION = 'v1.0.0'
    fetch('/api/version')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version !== LOCAL_VERSION) {
          setNewVersionInfo(data)
          setShowUpdateModal(true)
        }
      })
      .catch((err) => console.error('Failed to check app version:', err))

    // 1. Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('📡 [PWA] Service Worker registered scope:', reg.scope)
            
            // Listen for updates found on the service worker
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker is available for update
                    console.log('📡 [PWA] New service worker installed and waiting!')
                  }
                })
              }
            })
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
      e.preventDefault()
      window.deferredInstallPrompt = e
      console.log('📥 [PWA] Install prompt available')
      logAnalytics('Install Prompt Shown', { platform: navigator.userAgent })
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: true }))
    }

    const handleAppInstalled = () => {
      console.log('🎉 [PWA] App successfully installed!')
      logAnalytics('App Installed')
      window.deferredInstallPrompt = null
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: false }))
    }

    window.showPwaInstallPrompt = async () => {
      const promptEvent = window.deferredInstallPrompt
      if (!promptEvent) {
        console.log('⚠️ [PWA] No active install prompt deferred.')
        return
      }

      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      console.log(`👤 [PWA] User response to installation: ${outcome}`)

      if (outcome === 'accepted') {
        logAnalytics('Install Prompt Accepted')
      } else {
        logAnalytics('Install Prompt Dismissed')
      }

      window.deferredInstallPrompt = null
      window.dispatchEvent(new CustomEvent('pwa_installable', { detail: false }))
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    if (isStandalone) {
      logAnalytics('pwa_launched_standalone')
    }

    // 3. Handle Capacitor Deep Links
    const isCapacitor = typeof window !== 'undefined' && window.Capacitor
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

  const handlePerformUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }
    alert('Updating GameHub to v1.1.0... The application will restart.')
    window.location.reload()
  }

  const handleSimulateFlexibleUpdate = () => {
    alert('Flexible Update download started in background. You can continue playing. You will be prompted to restart when ready!')
    setShowUpdateModal(false)
    setTimeout(() => {
      if (confirm('Flexible Update downloaded! Restart now to apply GameHub v1.1.0?')) {
        window.location.reload()
      }
    }, 5000)
  }

  return (
    <>
      {showUpdateModal && newVersionInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.94)',
            zIndex: 200000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            backdropFilter: 'blur(10px)',
          }}
          className="animate-fadeIn"
          id="pwa-update-modal-backdrop"
        >
          <div
            className="card glass"
            style={{
              width: '100%',
              maxWidth: 420,
              padding: '2rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              borderRadius: 24,
              border: '1px solid hsl(220 100% 60% / 0.25)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 25px hsl(220 100% 60% / 0.1)',
            }}
            id="pwa-update-modal-body"
          >
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 100% 65%)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                🚀 New Update Available
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'white', margin: '0.2rem 0 0.5rem 0' }}>
                GameHub {newVersionInfo.version}
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'hsl(220 10% 55%)', marginBottom: '0.75rem' }}>
                <span>Installed: <strong>v1.0.0</strong></span>
                <span>•</span>
                <span>Latest: <strong style={{ color: 'white' }}>{newVersionInfo.version}</strong></span>
              </div>
            </div>

            {/* Whats New release notes */}
            <div style={{ background: 'hsl(222 20% 7% / 0.6)', border: '1px solid hsl(220 15% 18%)', borderRadius: 16, padding: '1rem' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: 'white', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                What&apos;s New:
              </span>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'hsl(220 10% 75%)', display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left', lineHeight: 1.4 }}>
                {newVersionInfo.whatsNew.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>

            {/* Update simulation options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                className="btn btn-primary"
                onClick={handlePerformUpdate}
                style={{ width: '100%', borderRadius: 12, fontWeight: 800, minHeight: 44 }}
                id="update-immediate-btn"
              >
                ⚡ Update Now
              </button>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleSimulateFlexibleUpdate}
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.72rem', minHeight: 38 }}
                  id="update-flexible-btn"
                >
                  Flexible Download
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowUpdateModal(false)}
                  style={{ flex: 1, borderRadius: 10, fontSize: '0.72rem', minHeight: 38 }}
                  id="update-later-btn"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
