'use client'

import { useState } from 'react'
import { Plus, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, COMMERCIAL_CHECKLIST_MANAGE_ROLES } from '@/config/roles'
import { useCommercialTemplates } from '@/hooks/commercial-checklist/use-commercial-templates'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { TemplateForm } from '../_components/template-form'

export default function TemplatesPage() {
  const { profile } = useAuth()

  if (!hasRole(profile?.role, COMMERCIAL_CHECKLIST_MANAGE_ROLES)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-text-secondary">Sem permissão para acessar esta página.</p>
      </div>
    )
  }

  return <TemplatesContent />
}

function TemplatesContent() {
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen,     setFormOpen]     = useState(false)

  const { data, isLoading, isError, refetch } = useCommercialTemplates(showInactive)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const templates = data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="icon-brand rounded-md p-2">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Templates</h1>
            <p className="text-sm text-text-secondary">Modelos de tarefas comerciais</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
              Mostrar inativos
            </Label>
          </div>

          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Novo template
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && !isTimedOut && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg skeleton-shimmer" />)}
        </div>
      )}

      {/* Error */}
      {(isError || isTimedOut) && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-4 flex items-center justify-between">
          <p className="text-sm text-status-error-text">Erro ao carregar templates.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">Nenhum template cadastrado</p>
          <p className="text-text-tertiary text-sm mt-1">
            Crie o primeiro template para organizar as tarefas da equipe comercial.
          </p>
        </div>
      )}

      {/* Template list */}
      {!isLoading && !isError && templates.length > 0 && (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <Link
              key={tpl.id}
              href={`/vendas/checklist/templates/${tpl.id}`}
              className={cn(
                'flex items-center gap-4 rounded-lg border bg-card p-4 card-interactive',
                !tpl.active && 'opacity-60',
              )}
            >
              <span className="icon-brand rounded-md p-2 shrink-0">
                <FileText className="h-4 w-4" />
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-text-primary">{tpl.title}</p>
                  {!tpl.active && (
                    <span className="badge-gray border text-xs rounded-full px-2 py-0.5">
                      Inativo
                    </span>
                  )}
                  <span className="badge-brand border text-xs rounded-full px-2 py-0.5">
                    {tpl.unit_name ?? 'Global'}
                  </span>
                </div>

                {tpl.description && (
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{tpl.description}</p>
                )}

                <p className="text-xs text-text-secondary mt-1">
                  Criado por {tpl.creator_name ?? '—'}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 text-text-tertiary shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Create form */}
      <TemplateForm key="new" open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
