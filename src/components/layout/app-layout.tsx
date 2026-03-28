'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from './sidebar'
import { Navbar } from './navbar'

interface AppLayoutProps {
  children: React.ReactNode
}

const COLLAPSED_KEY = 'sidebar-collapsed'

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Restore collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
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
    <div className="flex h-svh bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Área principal */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Navbar */}
        <Navbar
          onMenuClick={() => setSidebarOpen(true)}
          scrolled={scrolled}
        />

        {/* Conteúdo */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
