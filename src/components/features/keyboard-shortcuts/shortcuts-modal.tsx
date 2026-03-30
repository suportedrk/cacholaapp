'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useShortcutsStore } from '@/stores/shortcuts-store'

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
type ShortcutItem = { keys: string[]; desc: string }
type ShortcutGroup = { title: string; items: ShortcutItem[] }

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navegação',
    items: [
      { keys: ['G', 'D'], desc: 'Dashboard' },
      { keys: ['G', 'C'], desc: 'Checklists' },
      { keys: ['G', 'M'], desc: 'Manutenção' },
      { keys: ['G', 'E'], desc: 'Equipamentos' },
      { keys: ['G', 'S'], desc: 'Configurações' },
    ],
  },
  {
    title: 'Painéis',
    items: [
      { keys: ['Ctrl', 'K'],  desc: 'Busca rápida (Command Palette)' },
      { keys: ['N'],          desc: 'Notificações' },
      { keys: ['Ctrl', '/'],  desc: 'Atalhos de teclado' },
      { keys: ['?'],          desc: 'Atalhos de teclado' },
    ],
  },
]

const GROUPS_MAC: ShortcutGroup[] = [
  {
    title: 'Navegação',
    items: [
      { keys: ['G', 'D'], desc: 'Dashboard' },
      { keys: ['G', 'C'], desc: 'Checklists' },
      { keys: ['G', 'M'], desc: 'Manutenção' },
      { keys: ['G', 'E'], desc: 'Equipamentos' },
      { keys: ['G', 'S'], desc: 'Configurações' },
    ],
  },
  {
    title: 'Painéis',
    items: [
      { keys: ['⌘', 'K'],  desc: 'Busca rápida (Command Palette)' },
      { keys: ['N'],        desc: 'Notificações' },
      { keys: ['⌘', '/'],  desc: 'Atalhos de teclado' },
      { keys: ['?'],        desc: 'Atalhos de teclado' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded text-[0.65rem] font-mono font-semibold leading-none bg-muted border border-border text-foreground shadow-[0_1px_0_0_var(--color-border)]">
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, desc }: ShortcutItem) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-sm text-foreground">{desc}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-0.5">
            {i > 0 && (
              <span className="text-[0.6rem] text-muted-foreground mx-0.5">+</span>
            )}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PANEL
// ─────────────────────────────────────────────────────────────
function ShortcutsPanel({ onClose }: { onClose: () => void }) {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPod|iPad/.test(navigator.platform))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const groups = isMac ? GROUPS_MAC : GROUPS

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Atalhos de Teclado</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Desativados quando digitando em campos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid sm:grid-cols-2 gap-x-6 px-5 py-4 max-h-[65vh] overflow-y-auto">
          {groups.map((g) => (
            <div key={g.title} className="mb-4 sm:mb-0">
              <p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                {g.title}
              </p>
              <div>
                {g.items.map((item, i) => (
                  <ShortcutRow key={i} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            Pressione <Kbd>Esc</Kbd> para fechar
          </span>
          <span>
            Sequências G+tecla: janela de 1s
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────
export function ShortcutsModal() {
  const { isOpen, close } = useShortcutsStore()
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  if (!mounted || !isOpen) return null
  return createPortal(<ShortcutsPanel onClose={close} />, document.body)
}
