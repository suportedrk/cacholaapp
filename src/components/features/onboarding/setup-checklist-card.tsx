'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, X, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useSetupChecklist } from '@/hooks/use-onboarding'
import { cn } from '@/lib/utils'

const DISMISS_KEY = 'setup-checklist-dismissed'

// ── Component ─────────────────────────────────────────────────

export function SetupChecklistCard() {
  const router = useRouter()
  const { profile } = useAuth()

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(DISMISS_KEY) === 'true'
  })

  const isAdmin =
    !!profile?.role && ['super_admin', 'diretor', 'gerente'].includes(profile.role)

  const { data: status, isLoading } = useSetupChecklist()

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  // Don't render for non-admins, loading, dismissed, or no data
  if (!isAdmin || dismissed || isLoading || !status) return null

  const items = [
    {
      key: 'ploomes',
      label: 'Configurar integração Ploomes',
      route: '/configuracoes/integracoes/ploomes',
      done: status.ploomes,
    },
    {
      key: 'template',
      label: 'Criar primeiro modelo de checklist',
      route: '/checklists/templates/novo',
      done: status.checklistTemplate,
    },
    {
      key: 'equipment',
      label: 'Cadastrar equipamentos',
      route: '/equipamentos/novo',
      done: status.equipment,
    },
    {
      key: 'team',
      label: 'Convidar membros da equipe',
      route: '/admin/usuarios/novo',
      done: status.teamMembers,
    },
  ]

  const doneCount = items.filter((i) => i.done).length

  // Hide once everything is done
  if (doneCount === items.length) return null

  const pct = Math.round((doneCount / items.length) * 100)

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-brand-50 dark:bg-brand-950/20 p-4 relative">
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="pr-8 mb-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          Complete a configuração do Cachola OS
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {doneCount} de {items.length} etapas concluídas
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full mb-3.5 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Items */}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <button
              onClick={() => !item.done && router.push(item.route)}
              disabled={item.done}
              className={cn(
                'w-full flex items-center gap-2.5 text-left rounded-xl px-2.5 py-2 text-sm transition-colors',
                item.done
                  ? 'opacity-55 cursor-default'
                  : 'hover:bg-white/70 dark:hover:bg-white/[0.06] cursor-pointer',
              )}
            >
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
              ) : (
                <Circle className="w-4 h-4 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(
                  'flex-1 font-medium',
                  item.done && 'line-through text-muted-foreground',
                )}
              >
                {item.label}
              </span>
              {!item.done && (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
