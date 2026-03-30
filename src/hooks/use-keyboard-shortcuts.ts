'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCommandPaletteStore } from '@/stores/command-palette-store'
import { useShortcutsStore } from '@/stores/shortcuts-store'

// ── G + key navigation map ──────────────────────────────────
const GO_ROUTES: Record<string, string> = {
  d: '/dashboard',
  c: '/checklists',
  m: '/manutencao',
  e: '/equipamentos',
  s: '/configuracoes',
}

// ── Detects if the active element accepts text input ────────
function isEditable(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

// ──────────────────────────────────────────────────────────────
// HOOK
// ──────────────────────────────────────────────────────────────
export function useKeyboardShortcuts() {
  const router          = useRouter()
  const isPaletteOpen   = useCommandPaletteStore((s) => s.isOpen)
  const toggleShortcuts = useShortcutsStore((s) => s.toggle)

  // Sequence tracking for G + key (1 s window)
  const seqRef   = useRef<string | null>(null)
  const seqTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep palette-open state in ref to avoid stale closure in effect
  const paletteOpenRef = useRef(isPaletteOpen)
  // eslint-disable-next-line react-hooks/refs
  paletteOpenRef.current = isPaletteOpen

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept typing in form fields or when palette is open
      if (isEditable() || paletteOpenRef.current) return

      // Ctrl+/ or ⌘/ → toggle cheat sheet
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        toggleShortcuts()
        return
      }

      // ? → toggle cheat sheet (shift+/ on US keyboards)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        toggleShortcuts()
        return
      }

      // N → toggle notification panel (click the bell button)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const bell = document.querySelector<HTMLButtonElement>('[aria-label="Notificações"]')
        bell?.click()
        return
      }

      // G → start sequence, wait for next key
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        seqRef.current = 'g'
        if (seqTimer.current) clearTimeout(seqTimer.current)
        seqTimer.current = setTimeout(() => { seqRef.current = null }, 1000)
        return
      }

      // Second key after G
      if (seqRef.current === 'g') {
        seqRef.current = null
        if (seqTimer.current) clearTimeout(seqTimer.current)
        const dest = GO_ROUTES[e.key.toLowerCase()]
        if (dest) {
          e.preventDefault()
          router.push(dest)
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (seqTimer.current) clearTimeout(seqTimer.current)
    }
  }, [router, toggleShortcuts])
}
