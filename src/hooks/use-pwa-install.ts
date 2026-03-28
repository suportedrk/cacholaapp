'use client'

import { useState, useEffect, useRef } from 'react'

const DISMISS_KEY    = 'cachola-pwa-dismissed'   // timestamp until which banner is hidden
const VISIT_KEY      = 'cachola-pwa-visits'       // visit count
const FIRST_VISIT_KEY = 'cachola-pwa-first-visit' // timestamp of first visit
const DISMISS_DAYS   = 30
const MIN_VISITS     = 3
const MIN_TIME_MS    = 2 * 60 * 1000 // 2 minutes

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner]         = useState(false)
  const [installed, setInstalled]           = useState(false)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    if (isStandalone) {
      setInstalled(true)
      return
    }

    // Dismissed recently
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() < Number(dismissed)) return

    // Track visit count
    const visits = Number(localStorage.getItem(VISIT_KEY) || '0') + 1
    localStorage.setItem(VISIT_KEY, String(visits))

    // Track first visit time
    if (!localStorage.getItem(FIRST_VISIT_KEY)) {
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()))
    }
    const firstVisit = Number(localStorage.getItem(FIRST_VISIT_KEY))

    function maybeShow(prompt: BeforeInstallPromptEvent) {
      const elapsed      = Date.now() - firstVisit
      const enoughVisits = visits >= MIN_VISITS
      const enoughTime   = elapsed >= MIN_TIME_MS

      if (enoughVisits || enoughTime) {
        setShowBanner(true)
      } else {
        // Schedule for when 2-minute threshold is reached
        const remaining = Math.max(0, MIN_TIME_MS - elapsed)
        showTimer.current = setTimeout(() => setShowBanner(true), remaining)
      }
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferredPrompt(evt)
      maybeShow(evt)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      if (showTimer.current) clearTimeout(showTimer.current)
    }
  }, [])

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setShowBanner(false)
  }

  function dismiss() {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISS_KEY, String(until))
    setShowBanner(false)
  }

  return {
    showBanner: showBanner && !installed,
    canInstall: !!deferredPrompt,
    install,
    dismiss,
  }
}
