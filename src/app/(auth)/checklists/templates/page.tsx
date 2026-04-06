'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, FileText, Pencil, Copy, MoreVertical, PowerOff, Power,
  Camera, Star, Clock, AlarmClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import {
  useChecklistTemplates,
  useDeleteTemplate,
  useReactivateTemplate,
  useDuplicateTemplate,
  useChecklistCategories,
} from '@/hooks/use-checklists'
import { useUnitStore } from '@/stores/unit-store'
import { cn } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { TemplateWithItems } from '@/types/database.types'
import type { Priority } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const PRIORITY_PILL: Record<Priority, string> = {
  low:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
  high:   'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400',
}

function fmtMin(m: number) {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE CARD
// ─────────────────────────────────────────────────────────────

function TemplateCard({
  tpl,
  usageCount,
  onEdit,
  onDuplicate,
  onToggleActive,
}: {
  tpl: TemplateWithItems
  usageCount: number
  onEdit: () => void
  onDuplicate: () => void
  onToggleActive: () => void
}) {
  const items = tpl.template_items
  const totalMinutes = items.reduce((s, i) => s + (i.default_estimated_minutes ?? 0), 0)
  const photoCount    = items.filter((i) => i.requires_photo).length
  const requiredCount = items.filter((i) => i.is_required).length
  const priority      = (tpl.default_priority ?? 'medium') as Priority

  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 transition-all card-interactive',
      !tpl.is_active && 'opacity-60',
    )}>
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{tpl.title}</p>
            {!tpl.is_active && (
              <span className="text-[10px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                Inativo
              </span>
            )}
          </div>

          {/* Subtitle: category + items + time */}
          <p className="text-xs text-muted-foreground mt-0.5">
            {tpl.category?.name && (
              <span className="font-medium text-foreground/70">{tpl.category.name} · </span>
            )}
            {items.length} ite{items.length !== 1 ? 'ns' : 'm'}
            {totalMinutes > 0 && ` · ~${fmtMin(totalMinutes)}`}
          </p>
        </div>

        {/* Priority badge */}
        {priority !== 'medium' && (
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0',
            PRIORITY_PILL[priority],
          )}>
            {PRIORITY_LABELS[priority]}
          </span>
        )}

        {/* Menu ⋮ */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 -mr-1 -mt-0.5">
                <MoreVertical className="w-4 h-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="w-4 h-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} className="gap-2">
              <Copy className="w-4 h-4" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleActive} className="gap-2">
              {tpl.is_active ? (
                <>
                  <PowerOff className="w-4 h-4" />
                  Desativar
                </>
              ) : (
                <>
                  <Power className="w-4 h-4" />
                  Reativar
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Indicator row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {photoCount > 0 && (
          <span className="flex items-center gap-1">
            <Camera className="w-3 h-3" />
            {photoCount} foto{photoCount !== 1 ? 's' : ''}
          </span>
        )}
        {requiredCount > 0 && (
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-400" />
            {requiredCount} obrigatório{requiredCount !== 1 ? 's' : ''}
          </span>
        )}
        {totalMinutes > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {fmtMin(totalMinutes)}
          </span>
        )}

        {/* Usage count */}
        <span className="ml-auto">
          {usageCount > 0
            ? `Usado ${usageCount} vez${usageCount !== 1 ? 'es' : ''}`
            : 'Nunca usado'}
        </span>
      </div>

      {/* Description */}
      {tpl.description && (
        <p className="mt-2 text-xs text-muted-foreground/80 line-clamp-2 border-t border-border/40 pt-2">
          {tpl.description}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter()
  const { activeUnitId } = useUnitStore()

  const [search,       setSearch]       = useState('')
  const [categoryId,   setCategoryId]   = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const { data: templates = [], isLoading } = useChecklistTemplates(false)
  const { data: categories = [] }           = useChecklistCategories()
  const deleteTemplate    = useDeleteTemplate()
  const reactivateTemplate = useReactivateTemplate()
  const duplicateTemplate  = useDuplicateTemplate()

  const [deactivateTarget, setDeactivateTarget] = useState<TemplateWithItems | null>(null)

  // Usage count: count checklists per template_id
  const { data: usageCounts = {} } = useQuery({
    queryKey: ['template-usage-counts', activeUnitId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()
      const q = supabase.from('checklists').select('template_id').not('template_id', 'is', null)
      if (activeUnitId) q.eq('unit_id', activeUnitId)
      const { data } = await q
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        if (row.template_id) counts[row.template_id] = (counts[row.template_id] ?? 0) + 1
      }
      return counts
    },
  })

  // Filtered list
  const filtered = templates.filter((tpl) => {
    if (!showInactive && !tpl.is_active) return false
    if (search && !tpl.title.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryId && tpl.category_id !== categoryId) return false
    return true
  })

  const activeCount   = templates.filter((t) => t.is_active).length
  const inactiveCount = templates.filter((t) => !t.is_active).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates de Checklist"
        description="Crie modelos reutilizáveis para seus checklists"
        actions={
          <Button size="sm" onClick={() => router.push('/checklists/templates/novo')}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Template
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar templates..."
          className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {categories.length > 0 && (
          <Select
            value={categoryId || null}
            onValueChange={(v) => setCategoryId(v ?? '')}
          >
            <SelectTrigger size="sm" className="min-w-[160px]">
              {categoryId
                ? <span data-slot="select-value" className="flex flex-1 text-left">{categories.find((c) => c.id === categoryId)?.name ?? 'Categoria'}</span>
                : <SelectValue placeholder="Todas as categorias" />}
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {inactiveCount > 0 && (
          <button
            onClick={() => setShowInactive((v) => !v)}
            className={cn(
              'h-9 px-3 rounded-lg border text-sm transition-colors shrink-0',
              showInactive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground',
            )}
          >
            {showInactive ? 'Ocultar inativos' : `Mostrar inativos (${inactiveCount})`}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && templates.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum template criado"
          description="Crie templates reutilizáveis para agilizar a criação de checklists."
          action={{
            label: 'Criar Template',
            onClick: () => router.push('/checklists/templates/novo'),
          }}
        />
      )}

      {/* No results with filter */}
      {!isLoading && templates.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={AlarmClock}
          title="Nenhum template encontrado"
          description="Tente ajustar os filtros de busca."
          action={{ label: 'Limpar filtros', onClick: () => { setSearch(''); setCategoryId(''); setShowInactive(false) } }}
        />
      )}

      {/* Grid */}
      {!isLoading && filtered.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                usageCount={usageCounts[tpl.id] ?? 0}
                onEdit={() => router.push(`/checklists/templates/${tpl.id}/editar`)}
                onDuplicate={async () => {
                  const newId = await duplicateTemplate.mutateAsync(tpl.id)
                  if (newId) router.push(`/checklists/templates/${newId}/editar`)
                }}
                onToggleActive={() => {
                  if (tpl.is_active) setDeactivateTarget(tpl)
                  else reactivateTemplate.mutate(tpl.id)
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {activeCount} template{activeCount !== 1 ? 's' : ''} ativo{activeCount !== 1 ? 's' : ''}
            {inactiveCount > 0 && ` · ${inactiveCount} inativo${inactiveCount !== 1 ? 's' : ''}`}
          </p>
        </>
      )}

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(o) => !o && setDeactivateTarget(null)}
        title={`Desativar "${deactivateTarget?.title}"?`}
        description="O template será desativado e não aparecerá no seletor de criação de checklists. Checklists existentes não serão afetados."
        confirmLabel="Desativar"
        loading={deleteTemplate.isPending}
        onConfirm={async () => {
          if (deactivateTarget) {
            await deleteTemplate.mutateAsync(deactivateTarget.id)
            setDeactivateTarget(null)
          }
        }}
      />
    </div>
  )
}
