'use client'

import { useState, useCallback } from 'react'
import {
  Zap, Droplets, Sparkles, Building2, Wrench, Monitor,
  MoreHorizontal, Flame, Wind, Plug, Shield, Layers,
  Hammer, TreePine, Grid3x3, Check, X, Pencil, Plus, Loader2,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfigTable } from '@/components/features/settings/config-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { cn } from '@/lib/utils'
import { useSectors, useCreateSector, useUpdateSector, useDeleteSector } from '@/hooks/use-sectors'
import {
  useMaintenanceCategories,
  useCreateMaintenanceCategory,
  useUpdateMaintenanceCategory,
  useDeleteMaintenanceCategory,
} from '@/hooks/use-maintenance-categories'
import { useMaintenanceItems, useCreateMaintenanceItem, useUpdateMaintenanceItem, useDeleteMaintenanceItem } from '@/hooks/use-maintenance-items'
import { useMaintenanceSla, useUpsertMaintenanceSla } from '@/hooks/use-maintenance-sla'
import type { MaintenanceCategory, MaintenanceItem } from '@/types/database.types'
import type { ConfigItem } from '@/components/features/settings/config-table'

// ─────────────────────────────────────────────────────────────
// ICON REGISTRY (para seletor de categorias)
// ─────────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { key: 'zap',            Icon: Zap,           label: 'Elétrica'     },
  { key: 'droplets',       Icon: Droplets,       label: 'Hidráulica'   },
  { key: 'sparkles',       Icon: Sparkles,       label: 'Limpeza'      },
  { key: 'building',       Icon: Building2,      label: 'Estrutural'   },
  { key: 'wrench',         Icon: Wrench,         label: 'Ferramentas'  },
  { key: 'monitor',        Icon: Monitor,        label: 'TI'           },
  { key: 'more-horizontal',Icon: MoreHorizontal, label: 'Outros'       },
  { key: 'flame',          Icon: Flame,          label: 'Incêndio'     },
  { key: 'wind',           Icon: Wind,           label: 'Ar-cond.'     },
  { key: 'plug',           Icon: Plug,           label: 'Tomadas'      },
  { key: 'shield',         Icon: Shield,         label: 'Segurança'    },
  { key: 'layers',         Icon: Layers,         label: 'Revestimento' },
  { key: 'hammer',         Icon: Hammer,         label: 'Obra'         },
  { key: 'tree-pine',      Icon: TreePine,       label: 'Jardinagem'   },
  { key: 'grid',           Icon: Grid3x3,        label: 'Geral'        },
] as const

type IconKey = typeof ICON_OPTIONS[number]['key']

function getIconComponent(key: string) {
  const found = ICON_OPTIONS.find((o) => o.key === key)
  return found ? found.Icon : MoreHorizontal
}

const COLOR_PRESETS = [
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#EC4899', // Pink
  '#6B7280', // Gray
  '#71717A', // Zinc
]

// ─────────────────────────────────────────────────────────────
// SLA CONFIG
// ─────────────────────────────────────────────────────────────
const SLA_CONFIG = {
  critical: { label: 'Crítica', colorClass: 'text-red-600', bgClass: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800' },
  high:     { label: 'Alta',    colorClass: 'text-orange-600', bgClass: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800' },
  medium:   { label: 'Média',   colorClass: 'text-amber-600', bgClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
  low:      { label: 'Baixa',   colorClass: 'text-green-600', bgClass: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' },
} as const

// ─────────────────────────────────────────────────────────────
// TAB: SETORES
// ─────────────────────────────────────────────────────────────
function SetoresTab() {
  const { data: sectors = [], isLoading } = useSectors(false)
  const create = useCreateSector()
  const update = useUpdateSector()
  const del    = useDeleteSector()

  const items: ConfigItem[] = sectors.map((s) => ({
    id: s.id,
    name: s.name,
    is_active: s.is_active,
    sort_order: s.sort_order,
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Setores são as áreas físicas da sua unidade (Cozinha, Salão, Banheiros…). Cada chamado de manutenção é vinculado a um setor.
      </p>
      <ConfigTable
        title="Setor"
        items={items}
        isLoading={isLoading}
        onCreate={async (d) => { await create.mutateAsync({ name: d.name }) }}
        onUpdate={async (id, d) => { await update.mutateAsync({ id, name: d.name, is_active: d.is_active }) }}
        onDelete={async (id) => { await del.mutateAsync(id) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: CATEGORIAS (custom UI — icon + color)
// ─────────────────────────────────────────────────────────────

interface CategoryFormState {
  name: string
  icon: IconKey
  color: string
}

const DEFAULT_CAT_FORM: CategoryFormState = { name: '', icon: 'wrench', color: '#F59E0B' }

function CategoryRow({
  cat,
  onSave,
  onToggle,
  onDelete,
}: {
  cat: MaintenanceCategory
  onSave: (id: string, data: Partial<MaintenanceCategory>) => Promise<void>
  onToggle: (cat: MaintenanceCategory) => Promise<void>
  onDelete: (cat: MaintenanceCategory) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<CategoryFormState>({ name: cat.name, icon: cat.icon as IconKey, color: cat.color })
  const [saving, setSaving] = useState(false)

  const Icon = getIconComponent(form.icon)
  const CatIcon = getIconComponent(cat.icon)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave(cat.id, { name: form.name.trim(), icon: form.icon, color: form.color })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className={cn('p-4 bg-muted/30', !cat.is_active && 'opacity-50')}>
        <div className="space-y-3">
          {/* Nome */}
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome da categoria"
            className="h-9 text-sm"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          />

          {/* Seletor de ícone */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Ícone</p>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map(({ key, Icon: Ic, label }) => (
                <button
                  key={key}
                  type="button"
                  title={label}
                  onClick={() => setForm((f) => ({ ...f, icon: key }))}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
                    form.icon === key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Ic className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de cor */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
            <div className="flex flex-wrap gap-2 items-center">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: form.color === c ? 'var(--color-foreground)' : 'transparent',
                  }}
                />
              ))}
              {/* Color picker livre */}
              <label className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden" title="Cor personalizada">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-full h-full opacity-0 cursor-pointer absolute"
                />
                <span className="text-[10px] text-muted-foreground select-none">+</span>
              </label>
              {/* Preview */}
              <div className="w-7 h-7 rounded-full border-2 border-border" style={{ backgroundColor: form.color }} />
            </div>
          </div>

          {/* Preview live */}
          <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card w-fit">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: form.color + '20' }}>
              <Icon className="w-4 h-4" style={{ color: form.color }} />
            </div>
            <span className="text-sm font-medium">{form.name || 'Prévia'}</span>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <X className="w-3.5 h-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-3 px-3 py-2.5 bg-card', !cat.is_active && 'opacity-50')}>
      {/* Ícone com cor */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: cat.color + '20' }}
      >
        <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
      </div>

      <span className="text-sm font-medium flex-1 min-w-0 truncate">{cat.name}</span>

      {/* Cor pill */}
      <div className="w-4 h-4 rounded-full shrink-0 ring-1 ring-border" style={{ backgroundColor: cat.color }} />

      <Switch
        checked={cat.is_active}
        onCheckedChange={() => onToggle(cat)}
        aria-label={cat.is_active ? 'Desativar' : 'Ativar'}
      />
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => onDelete(cat)}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function CategoriasTab() {
  const { data: cats = [], isLoading } = useMaintenanceCategories(false)
  const create = useCreateMaintenanceCategory()
  const update = useUpdateMaintenanceCategory()
  const del    = useDeleteMaintenanceCategory()

  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState<CategoryFormState>(DEFAULT_CAT_FORM)
  const [savingNew, setSavingNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceCategory | null>(null)

  const NewIcon = getIconComponent(newForm.icon)

  async function handleCreate() {
    if (!newForm.name.trim()) return
    setSavingNew(true)
    try {
      await create.mutateAsync({ name: newForm.name.trim(), icon: newForm.icon, color: newForm.color })
      setNewForm(DEFAULT_CAT_FORM)
      setAdding(false)
    } finally {
      setSavingNew(false)
    }
  }

  const handleSave = useCallback(async (id: string, data: Partial<MaintenanceCategory>) => {
    await update.mutateAsync({ id, ...data })
  }, [update])

  const handleToggle = useCallback(async (cat: MaintenanceCategory) => {
    await update.mutateAsync({ id: cat.id, is_active: !cat.is_active })
  }, [update])

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Categorias classificam os chamados por tipo de problema. Cada uma tem um ícone e uma cor para facilitar a identificação visual.
      </p>

      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {cats.length === 0 && !adding && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhuma categoria cadastrada ainda.
          </div>
        )}

        {cats.map((cat) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            onSave={handleSave}
            onToggle={handleToggle}
            onDelete={setDeleteTarget}
          />
        ))}

        {/* Linha de criação */}
        {adding && (
          <div className="p-4 bg-muted/30 space-y-3">
            <Input
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome da categoria"
              className="h-9 text-sm"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') setAdding(false) }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Ícone</p>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => setNewForm((f) => ({ ...f, icon: key }))}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
                      newForm.icon === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Cor</p>
              <div className="flex flex-wrap gap-2 items-center">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewForm((f) => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: newForm.color === c ? 'var(--color-foreground)' : 'transparent' }}
                  />
                ))}
                <label className="relative w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors" title="Cor personalizada">
                  <input
                    type="color"
                    value={newForm.color}
                    onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <span className="text-[10px] text-muted-foreground select-none">+</span>
                </label>
              </div>
            </div>
            {/* Preview */}
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card w-fit">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: newForm.color + '20' }}>
                <NewIcon className="w-4 h-4" style={{ color: newForm.color }} />
              </div>
              <span className="text-sm font-medium">{newForm.name || 'Prévia'}</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={savingNew || !newForm.name.trim()}>
                {savingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Criar categoria
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewForm(DEFAULT_CAT_FORM) }}>
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {!adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar categoria
        </Button>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remover "${deleteTarget?.name}"?`}
        description="Esta ação não pode ser desfeita. Chamados que usam esta categoria podem ser afetados."
        confirmLabel="Remover"
        onConfirm={async () => {
          if (deleteTarget) await del.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: ITENS
// ─────────────────────────────────────────────────────────────
function ItensTab() {
  const { data: sectors = [] } = useSectors(true)
  const [filterSectorId, setFilterSectorId] = useState<string>('')

  const { data: items = [], isLoading } = useMaintenanceItems(false, filterSectorId || null)
  const create = useCreateMaintenanceItem()
  const update = useUpdateMaintenanceItem()
  const del    = useDeleteMaintenanceItem()

  const configItems: ConfigItem[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    is_active: item.is_active,
    sort_order: item.sort_order,
    sector_name: (item as MaintenanceItem & { sector?: { name: string } | null }).sector?.name ?? '',
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Itens são elementos específicos que podem precisar de manutenção dentro de um setor (ex: &quot;Geladeira&quot;, &quot;Torneira do Pia&quot;).
      </p>

      {/* Filtro por setor */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Filtrar por setor:</label>
        <select
          value={filterSectorId}
          onChange={(e) => setFilterSectorId(e.target.value)}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos os setores</option>
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
          <option value="__no_sector__" disabled>Sem setor</option>
        </select>
      </div>

      <ConfigTable
        title="Item"
        items={configItems}
        isLoading={isLoading}
        extraField={{ key: 'sector_name', label: 'Setor', type: 'text' }}
        onCreate={async (d) => {
          // Encontrar setor pelo nome (ou usar filterSectorId)
          const matchedSector = sectors.find((s) => s.name.toLowerCase() === String(d.sector_name ?? '').toLowerCase())
          await create.mutateAsync({
            name: d.name,
            sector_id: matchedSector?.id ?? filterSectorId || null,
          })
        }}
        onUpdate={async (id, d) => {
          await update.mutateAsync({ id, name: d.name, is_active: d.is_active })
        }}
        onDelete={async (id) => { await del.mutateAsync(id) }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TAB: SLA
// ─────────────────────────────────────────────────────────────
type UrgencyKey = 'critical' | 'high' | 'medium' | 'low'

function SlaCard({
  urgency,
  responseHours,
  resolutionHours,
  onSave,
}: {
  urgency: UrgencyKey
  responseHours: number
  resolutionHours: number
  onSave: (data: { response_hours: number; resolution_hours: number }) => Promise<void>
}) {
  const cfg = SLA_CONFIG[urgency]
  const [resp, setResp] = useState(String(responseHours))
  const [resol, setResol] = useState(String(resolutionHours))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function handleSave() {
    const r = parseInt(resp)
    const rs = parseInt(resol)
    if (isNaN(r) || isNaN(rs) || r <= 0 || rs <= 0) return
    setSaving(true)
    try {
      await onSave({ response_hours: r, resolution_hours: rs })
      setDirty(false)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function formatHours(h: number) {
    if (h < 24) return `${h}h`
    const days = Math.floor(h / 24)
    const rem  = h % 24
    return rem > 0 ? `${days}d ${rem}h` : `${days}d`
  }

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bgClass)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-semibold', cfg.colorClass)}>
          Urgência {cfg.label}
        </span>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="text-green-600 hover:text-green-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => { setEditing(false); setResp(String(responseHours)); setResol(String(resolutionHours)); setDirty(false) }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Tempo de resposta */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Resposta (1º contato)</p>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={resp}
                min={1}
                onChange={(e) => { setResp(e.target.value); setDirty(true) }}
                className="h-8 text-sm w-20"
              />
              <span className="text-xs text-muted-foreground">horas</span>
            </div>
          ) : (
            <p className="text-lg font-bold text-foreground">{formatHours(responseHours)}</p>
          )}
        </div>

        {/* Tempo de resolução */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Resolução completa</p>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                value={resol}
                min={1}
                onChange={(e) => { setResol(e.target.value); setDirty(true) }}
                className="h-8 text-sm w-20"
              />
              <span className="text-xs text-muted-foreground">horas</span>
            </div>
          ) : (
            <p className="text-lg font-bold text-foreground">{formatHours(resolutionHours)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SlaTab() {
  const { data: slaList = [], isLoading } = useMaintenanceSla()
  const upsert = useUpsertMaintenanceSla()

  const urgencies: UrgencyKey[] = ['critical', 'high', 'medium', 'low']

  const DEFAULT_SLA: Record<UrgencyKey, { response_hours: number; resolution_hours: number }> = {
    critical: { response_hours: 1,  resolution_hours: 4   },
    high:     { response_hours: 4,  resolution_hours: 24  },
    medium:   { response_hours: 24, resolution_hours: 72  },
    low:      { response_hours: 72, resolution_hours: 168 },
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        SLA (Service Level Agreement) define os prazos máximos de resposta e resolução para cada nível de urgência. O sistema alertará quando um chamado estiver próximo de vencer.
      </p>

      {slaList.length === 0 && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Nenhum SLA configurado. Aplique a migration de seed ou salve abaixo para criar os padrões.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {urgencies.map((urgency) => {
          const existing = slaList.find((s) => s.urgency_level === urgency)
          const defaults = DEFAULT_SLA[urgency]
          return (
            <SlaCard
              key={urgency}
              urgency={urgency}
              responseHours={existing?.response_hours ?? defaults.response_hours}
              resolutionHours={existing?.resolution_hours ?? defaults.resolution_hours}
              onSave={async (data) => {
                await upsert.mutateAsync({ urgency_level: urgency, ...data })
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ManutencaoConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Manutenção"
        description="Gerencie setores, categorias, itens catalogados e regras de SLA para os chamados."
      />

      <Tabs defaultValue="setores">
        <TabsList>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="sla">SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="setores" className="mt-6">
          <SetoresTab />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <CategoriasTab />
        </TabsContent>

        <TabsContent value="itens" className="mt-6">
          <ItensTab />
        </TabsContent>

        <TabsContent value="sla" className="mt-6">
          <SlaTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
