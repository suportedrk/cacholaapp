'use client'

import { useState } from 'react'
import { Plus, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import {
  hasRole,
  COMMERCIAL_CHECKLIST_MANAGE_ROLES,
  COMMERCIAL_CHECKLIST_ARCHIVE_ROLES,
} from '@/config/roles'
import {
  useCommercialAutomations,
  useUpdateCommercialAutomation,
  useDeleteCommercialAutomation,
  type CommercialAutomation,
} from '@/hooks/commercial-checklist/use-commercial-automations'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { AutomationCard } from '../_components/automation-card'
import { AutomationForm } from '../_components/automation-form'

export default function AutomacoesPage() {
  const { profile } = useAuth()

  if (!hasRole(profile?.role, COMMERCIAL_CHECKLIST_MANAGE_ROLES)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-text-secondary">Sem permissão para acessar esta página.</p>
      </div>
    )
  }

  return <AutomacoesContent />
}

function AutomacoesContent() {
  const { profile } = useAuth()
  const [formOpen,       setFormOpen]       = useState(false)
  const [formInstance,   setFormInstance]   = useState(0)
  const [editTarget,     setEditTarget]     = useState<CommercialAutomation | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<CommercialAutomation | null>(null)

  const { data, isLoading, isError, refetch } = useCommercialAutomations()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)
  const updateMut = useUpdateCommercialAutomation()
  const deleteMut = useDeleteCommercialAutomation()

  const automations = data ?? []
  const canDelete   = hasRole(profile?.role, COMMERCIAL_CHECKLIST_ARCHIVE_ROLES)
  const isActing    = updateMut.isPending || deleteMut.isPending

  function handleOpenCreate() {
    setEditTarget(null)
    setFormOpen(true)
  }

  function handleOpenEdit(automation: CommercialAutomation) {
    setEditTarget(automation)
    setFormOpen(true)
  }

  function handleCloseForm() {
    setFormOpen(false)
    setFormInstance((n) => n + 1)
    setEditTarget(null)
  }

  async function handleToggle(automation: CommercialAutomation) {
    await updateMut.mutateAsync({ id: automation.id, active: !automation.active })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    await deleteMut.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="icon-brand rounded-md p-2">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Automações</h1>
            <p className="text-sm text-text-secondary">
              Tarefas criadas automaticamente quando um deal muda de stage no Ploomes
            </p>
          </div>
        </div>

        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova automação
        </Button>
      </div>

      {/* Explicação */}
      <div className="rounded-lg border border-border-default bg-surface-secondary p-4 text-sm text-text-secondary space-y-1">
        <p className="font-medium text-text-primary">Como funciona</p>
        <p>
          Cada regra monitora um stage do Ploomes. Quando o sync detecta que um deal
          entrou naquele stage, as tarefas do template escolhido são criadas automaticamente
          e atribuídas à vendedora responsável pelo deal.
        </p>
        <p className="text-xs text-text-tertiary pt-1">
          Tarefas automáticas aparecem nas abas &ldquo;Minhas Tarefas&rdquo; e &ldquo;Equipe Comercial&rdquo;
          com o badge <strong>Automática</strong> e link direto para o deal no Ploomes.
        </p>
      </div>

      {/* Loading */}
      {isLoading && !isTimedOut && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg skeleton-shimmer" />)}
        </div>
      )}

      {/* Error */}
      {(isError || isTimedOut) && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-4 flex items-center justify-between">
          <p className="text-sm text-status-error-text">Erro ao carregar automações.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && automations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Zap className="h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">Nenhuma automação configurada</p>
          <p className="text-text-tertiary text-sm mt-1">
            Crie uma regra para gerar tarefas automaticamente a partir de stages do Ploomes.
          </p>
        </div>
      )}

      {/* Lista */}
      {!isLoading && !isError && automations.length > 0 && (
        <div className="space-y-3">
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              canDelete={canDelete}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
              onToggle={handleToggle}
              isToggling={isActing}
            />
          ))}
        </div>
      )}

      {/* Form (create / edit) */}
      <AutomationForm
        key={`${editTarget?.id ?? 'new'}-${formInstance}`}
        automation={editTarget}
        open={formOpen}
        onClose={handleCloseForm}
      />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Excluir automação?"
        description="Esta regra será removida permanentemente. As tarefas já criadas por ela não serão afetadas."
        confirmLabel="Excluir"
        destructive
        loading={deleteMut.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
