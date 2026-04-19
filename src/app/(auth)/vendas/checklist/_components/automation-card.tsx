'use client'

import { ArrowRight, Pencil, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { CommercialAutomation } from '@/hooks/commercial-checklist/use-commercial-automations'

interface AutomationCardProps {
  automation: CommercialAutomation
  canDelete:  boolean
  onEdit:     (automation: CommercialAutomation) => void
  onDelete:   (automation: CommercialAutomation) => void
  onToggle:   (automation: CommercialAutomation) => void
  isToggling: boolean
}

export function AutomationCard({
  automation,
  canDelete,
  onEdit,
  onDelete,
  onToggle,
  isToggling,
}: AutomationCardProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors',
      !automation.active && 'opacity-60',
    )}>
      {/* Ícone */}
      <span className={cn(
        'icon-brand rounded-md p-2 shrink-0',
        !automation.active && 'opacity-50',
      )}>
        <Zap className="h-4 w-4" />
      </span>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-text-primary">
            {automation.stage_name ?? `Stage ${automation.stage_id}`}
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
          <p className="text-sm text-text-secondary">
            {automation.template_title ?? '—'}
          </p>
          {!automation.active && (
            <span className="badge-gray border text-xs rounded-full px-2 py-0.5">Inativa</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-text-tertiary">
          {automation.unit_name ? automation.unit_name : 'Global'}
        </p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 shrink-0">
        <Switch
          checked={automation.active}
          onCheckedChange={() => onToggle(automation)}
          disabled={isToggling}
          aria-label={automation.active ? 'Desativar automação' : 'Ativar automação'}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-text-tertiary hover:text-text-primary"
          title="Editar automação"
          onClick={() => onEdit(automation)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-tertiary hover:text-status-error-text"
            title="Excluir automação"
            onClick={() => onDelete(automation)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
