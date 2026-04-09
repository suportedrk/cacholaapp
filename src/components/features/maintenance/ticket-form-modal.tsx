'use client'

import { useState, useEffect } from 'react'
import { ClipboardList } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { useCreateTicket, type TicketInsert } from '@/hooks/use-tickets'
import { useSectors } from '@/hooks/use-sectors'
import { useMaintenanceCategories } from '@/hooks/use-maintenance-categories'
import { useMaintenanceItems } from '@/hooks/use-maintenance-items'
import type { TicketNature, TicketUrgency } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const NATURE_OPTIONS: { value: TicketNature; label: string }[] = [
  { value: 'emergencial', label: 'Emergencial' },
  { value: 'pontual',     label: 'Pontual'     },
  { value: 'agendado',    label: 'Agendado'    },
  { value: 'preventivo',  label: 'Preventivo'  },
]

const URGENCY_OPTIONS: { value: TicketUrgency; label: string }[] = [
  { value: 'critical', label: 'Crítico' },
  { value: 'high',     label: 'Alto'    },
  { value: 'medium',   label: 'Médio'   },
  { value: 'low',      label: 'Baixo'   },
]

// ─────────────────────────────────────────────────────────────
// FORM STATE
// ─────────────────────────────────────────────────────────────
type FormState = {
  title:          string
  description:    string
  sector_id:      string
  category_id:    string
  item_id:        string
  nature:         TicketNature
  urgency:        TicketUrgency
  scheduled_date: string
}

const INITIAL: FormState = {
  title:          '',
  description:    '',
  sector_id:      '',
  category_id:    '',
  item_id:        '',
  nature:         'pontual',
  urgency:        'medium',
  scheduled_date: '',
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface TicketFormModalProps {
  open:       boolean
  onClose:    () => void
  onCreated?: (id: string) => void
}

export function TicketFormModal({ open, onClose, onCreated }: TicketFormModalProps) {
  const [form, setForm]     = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const { data: sectors    = [] } = useSectors(true)
  const { data: categories = [] } = useMaintenanceCategories(true)
  const { data: items      = [] } = useMaintenanceItems(true, form.sector_id || null)

  const createTicket = useCreateTicket((ticket) => {
    onClose()
    onCreated?.(ticket.id)
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(INITIAL)
      setErrors({})
    }
  }, [open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!form.title.trim())   e.title  = 'Título é obrigatório'
    if (!form.nature)         e.nature  = 'Natureza é obrigatória'
    if (!form.urgency)        e.urgency = 'Urgência é obrigatória'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || createTicket.isPending) return

    const payload: TicketInsert = {
      title:       form.title.trim(),
      nature:      form.nature,
      urgency:     form.urgency,
      description: form.description.trim() || null,
      sector_id:   form.sector_id   || null,
      category_id: form.category_id || null,
      item_id:     form.item_id     || null,
      scheduled_date:
        form.nature === 'agendado' && form.scheduled_date
          ? new Date(form.scheduled_date).toISOString()
          : null,
    }

    createTicket.mutate(payload)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Novo Chamado
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-4 pt-2">
          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder='Ex: "Torneira da cozinha com vazamento"'
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus transition-colors placeholder:text-text-tertiary"
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descreva o problema com mais detalhes..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus transition-colors resize-none placeholder:text-text-tertiary"
            />
          </div>

          {/* Natureza + Urgência (row) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Natureza <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.nature}
                onValueChange={(v) => set('nature', (v ?? '') as TicketNature)}
              >
                <SelectTrigger className={errors.nature ? 'border-destructive' : ''}>
                  <span data-slot="select-value">
                    {NATURE_OPTIONS.find((o) => o.value === form.nature)?.label ?? 'Selecionar...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {NATURE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.nature && (
                <p className="text-xs text-destructive">{errors.nature}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Urgência <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.urgency}
                onValueChange={(v) => set('urgency', (v ?? '') as TicketUrgency)}
              >
                <SelectTrigger className={errors.urgency ? 'border-destructive' : ''}>
                  <span data-slot="select-value">
                    {URGENCY_OPTIONS.find((o) => o.value === form.urgency)?.label ?? 'Selecionar...'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.urgency && (
                <p className="text-xs text-destructive">{errors.urgency}</p>
              )}
            </div>
          </div>

          {/* Data agendada — só quando natureza = agendado */}
          {form.nature === 'agendado' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">
                Data agendada
              </label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => set('scheduled_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-border-focus transition-colors"
              />
            </div>
          )}

          {/* Setor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Setor</label>
            <Select
              value={form.sector_id || 'none'}
              onValueChange={(v) => {
                set('sector_id', v === 'none' ? '' : (v ?? ''))
                set('item_id', '') // reset item when sector changes
              }}
            >
              <SelectTrigger>
                <span data-slot="select-value">
                  {form.sector_id
                    ? (sectors.find((s) => s.id === form.sector_id)?.name ?? 'Nenhum')
                    : 'Nenhum'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Categoria</label>
            <Select
              value={form.category_id || 'none'}
              onValueChange={(v) => set('category_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger>
                <span data-slot="select-value">
                  {form.category_id
                    ? (categories.find((c) => c.id === form.category_id)?.name ?? 'Nenhuma')
                    : 'Nenhuma'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: c.color ?? '#888' }}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Item/Local — filtrado pelo setor */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">
              Item / Local
            </label>
            <Select
              value={form.item_id || 'none'}
              onValueChange={(v) => set('item_id', v === 'none' ? '' : (v ?? ''))}
            >
              <SelectTrigger>
                <span data-slot="select-value">
                  {form.item_id
                    ? (items.find((i) => i.id === form.item_id)?.name ?? 'Nenhum')
                    : 'Nenhum'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createTicket.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit as any}
            disabled={createTicket.isPending}
          >
            {createTicket.isPending ? 'Abrindo...' : 'Abrir Chamado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
