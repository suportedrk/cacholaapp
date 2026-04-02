'use client'

import { Copy, CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2, Building2 } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCopyableData, useAllUnits } from '@/hooks/use-unit-setup'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Step3Data {
  copyFrom: boolean            // true = copiar de outra unidade
  sourceUnitId: string | null  // qual unidade de origem
}

interface Props {
  targetUnitId: string
  data: Step3Data
  onChange: (data: Partial<Step3Data>) => void
}

// ─────────────────────────────────────────────────────────────
// Sub-component: CopyPreview
// ─────────────────────────────────────────────────────────────

function CopyPreview({ sourceUnitId, targetUnitId }: { sourceUnitId: string; targetUnitId: string }) {
  const { data, isLoading } = useCopyableData(sourceUnitId !== targetUnitId ? sourceUnitId : null)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando dados da unidade de origem...
      </div>
    )
  }

  if (!data) return null

  const sections = [
    { label: 'Modelos de checklist', items: data.checklistTemplates, count: data.checklistTemplates.length },
    { label: 'Categorias de checklist', items: data.checklistCategories, count: data.checklistCategories.length },
    { label: 'Setores de manutenção', items: data.sectors, count: data.sectors.length },
    { label: 'Categorias de equipamentos', items: data.equipmentCategories, count: data.equipmentCategories.length },
    { label: 'Categorias de serviço (prestadores)', items: data.serviceCategories, count: data.serviceCategories.length },
  ]

  const totalItems = sections.reduce((acc, s) => acc + s.count, 0)

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/40 transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          {totalItems} itens serão copiados
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Expandido */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {sections.map((section) => (
            <div key={section.label} className="px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{section.label}</span>
                <span className={cn('font-medium', section.count > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                  {section.count} {section.count !== 1 ? 'itens' : 'item'}
                </span>
              </div>
              {section.label === 'Modelos de checklist' && section.items.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {(section.items as { id: string; name: string; itemCount?: number }[]).map((item) => (
                    <li key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Circle className="w-2.5 h-2.5 fill-muted-foreground" />
                        {item.name}
                      </span>
                      {item.itemCount !== undefined && (
                        <span className="text-muted-foreground/70">{item.itemCount} itens</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Aviso sobre o que NÃO é copiado */}
      <div className="border-t border-border p-3 bg-muted/30 text-xs text-muted-foreground">
        <strong>Não são copiados:</strong> Responsáveis por item de checklist (específicos por unidade),
        eventos, ordens de manutenção, equipamentos e prestadores.
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function Step3Templates({ targetUnitId, data, onChange }: Props) {
  const { data: units, isLoading: loadingUnits } = useAllUnits()
  const sourceUnits = (units ?? []).filter((u) => u.id !== targetUnitId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-brand p-2 rounded-lg">
          <Copy className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Templates Operacionais</h2>
          <p className="text-sm text-muted-foreground">
            Copie modelos de checklist, setores e categorias de uma unidade existente.
          </p>
        </div>
      </div>

      {/* Opção: copiar ou não */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ copyFrom: true })}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all',
            data.copyFrom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-primary/40 text-muted-foreground',
          )}
        >
          <Copy className="w-6 h-6" />
          Copiar de outra unidade
        </button>
        <button
          type="button"
          onClick={() => onChange({ copyFrom: false, sourceUnitId: null })}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all',
            !data.copyFrom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-primary/40 text-muted-foreground',
          )}
        >
          <Circle className="w-6 h-6" />
          Configurar depois
        </button>
      </div>

      {/* Selecionar unidade de origem */}
      {data.copyFrom && (
        <div className="space-y-4 animate-fade-up">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Unidade de origem <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {loadingUnits && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Carregando unidades...
                </div>
              )}
              {!loadingUnits && sourceUnits.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Building2 className="w-4 h-4 shrink-0" />
                  Nenhuma outra unidade disponível.
                </div>
              )}
              {sourceUnits.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => onChange({ sourceUnitId: unit.id })}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                    data.sourceUnitId === unit.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    data.sourceUnitId === unit.id ? 'border-primary' : 'border-border',
                  )}>
                    {data.sourceUnitId === unit.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{unit.name}</p>
                    <p className="text-xs text-muted-foreground">{unit.slug}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview do que será copiado */}
          {data.sourceUnitId && (
            <CopyPreview sourceUnitId={data.sourceUnitId} targetUnitId={targetUnitId} />
          )}
        </div>
      )}

      {/* Pular */}
      {!data.copyFrom && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Você poderá criar modelos de checklist, setores e categorias manualmente mais tarde,
            acessando cada módulo separadamente.
          </p>
        </div>
      )}
    </div>
  )
}
