'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Navbar } from './navbar'
import { WelcomeModal } from '@/components/features/onboarding/welcome-modal'
import { GuidedTour } from '@/components/features/onboarding/guided-tour'
import { useOnboarding } from '@/hooks/use-onboarding'
import { CommandPalette } from '@/components/features/command-palette/command-palette'
import { ShortcutsModal } from '@/components/features/keyboard-shortcuts/shortcuts-modal'
import { InstallBanner } from '@/components/features/pwa/install-banner'
import { SplashScreen } from '@/components/features/pwa/splash-screen'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { UnitAccentWrapper } from './unit-accent-wrapper'
import { ImpersonateBanner } from './impersonate-banner'
import { useImpersonateStore } from '@/stores/impersonate-store'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

const COLLAPSED_KEY = 'sidebar-collapsed'

function OnboardingLayer() {
  useOnboarding()
  return (
    <>
      <WelcomeModal />
      <GuidedTour />
    </>
  )
}

// Registers all global keyboard shortcuts
function KeyboardLayer() {
  useKeyboardShortcuts()
  return null
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [scrolled, setScrolled]                 = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Banner de impersonate eleva o layout em 40px (h-10)
  const isImpersonating = useImpersonateStore((s) => s.isImpersonating)

  // Restore collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'true') setSidebarCollapsed(true)
  }, [])

  const handleToggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(COLLAPSED_KEY, String(next))
      return next
    })
  }, [])

  // Track scroll for navbar shadow
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    function onScroll() {
      setScrolled(el!.scrollTop > 4)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <UnitAccentWrapper>
      {/* Banner de impersonate — fixo acima de tudo, z-[60] */}
      <ImpersonateBanner />

      <div className={cn('flex bg-background overflow-hidden', isImpersonating ? 'h-[calc(100svh-2.5rem)]' : 'h-svh')}>
        {/* Global layers */}
        <OnboardingLayer />
        <KeyboardLayer />
        <CommandPalette />
        <ShortcutsModal />
        <SplashScreen />
        <InstallBanner />

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={handleToggleCollapse}
        />

        {/* Main area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Navbar
            onMenuClick={() => setSidebarOpen(true)}
            scrolled={scrolled}
          />
          {/* key forces remount on navigation → animate-page-enter */}
          <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
            <div key={pathname} className="animate-page-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </UnitAccentWrapper>
  )
}
