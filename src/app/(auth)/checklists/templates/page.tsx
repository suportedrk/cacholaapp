'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FileText, Pencil, Trash2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useChecklistTemplates, useDeleteTemplate } from '@/hooks/use-checklists'
import type { TemplateWithItems } from '@/types/database.types'

export default function TemplatesPage() {
  const router = useRouter()
  const { data: templates = [], isLoading } = useChecklistTemplates(false)
  const deleteTemplate = useDeleteTemplate()

  const [deleteTarget, setDeleteTarget] = useState<TemplateWithItems | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/checklists"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <PageHeader
          title="Templates de Checklist"
          description="Crie modelos reutilizáveis para seus checklists"
          actions={
            <Button
              size="sm"
              onClick={() => router.push('/checklists/templates/novo')}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Novo Template
            </Button>
          }
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum template criado"
          description="Crie templates para reutilizar em vários eventos."
          action={{
            label: 'Criar Template',
            onClick: () => router.push('/checklists/templates/novo'),
          }}
        />
      )}

      {/* Lista */}
      {!isLoading && templates.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{tpl.title}</p>
                  {!tpl.is_active && (
                    <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tpl.template_items.length} itens
                  {tpl.category && ` · ${tpl.category.name}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => router.push(`/checklists/templates/${tpl.id}/editar`)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Editar"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(tpl)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Desativar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Desativar "${deleteTarget?.title}"?`}
        description="O template será desativado e não poderá ser usado em novos checklists. Checklists existentes não serão afetados."
        confirmLabel="Desativar"
        loading={deleteTemplate.isPending}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteTemplate.mutateAsync(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
      />
    </div>
  )
}
