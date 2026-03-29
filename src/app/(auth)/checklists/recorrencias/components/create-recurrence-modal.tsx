'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { addDays, addWeeks, addMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChecklistTemplates } from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import {
  useCreateRecurrence,
  useUpdateRecurrence,
} from '@/hooks/use-checklist-recurrences'
import { useAuth } from '@/hooks/use-auth'
import type { ChecklistRecurrence } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type Frequency = ChecklistRecurrence['frequency']

export type RecurrenceWithJoins = ChecklistRecurrence & {
  template?:      { id: string; title: string; category_id: string | null } | null
  assigned_user?: { id: string; name: string; avatar_url: string | null } | null
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily',    label: 'Diária'    },
  { value: 'weekly',   label: 'Semanal'   },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly',  label: 'Mensal'    },
]

// Starting from Sunday (index 0)
const DAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const DAY_FULL  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function buildPreviewTitle(prefix: string, freq: Frequency): string {
  const today = new Date()
  let d = today
  if (freq === 'daily')    d = addDays(today, 1)
  if (freq === 'weekly')   d = addDays(today, 7)
  if (freq === 'biweekly') d = addWeeks(today, 2)
  if (freq === 'monthly')  d = addMonths(today, 1)
  const dateStr = format(d, 'dd/MM/yyyy', { locale: ptBR })
  return `${prefix || 'Prefixo'} — ${dateStr}`
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface CreateRecurrenceModalProps {
  open:        boolean
  onClose:     () => void
  editTarget?: RecurrenceWithJoins | null
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function CreateRecurrenceModal({
  open,
  onClose,
  editTarget,
}: CreateRecurrenceModalProps) {
  const { profile } = useAuth()
  const { mutate: create, isPending: isCreating } = useCreateRecurrence()
  const { mutate: update, isPending: isUpdating } = useUpdateRecurrence()
  const isPending = isCreating || isUpdating

  const { data: templates = [] } = useChecklistTemplates(true)
  const { data: users = [] }     = useUsers({ isActive: true })

  // ── Form state ─────────────────────────────────────────────
  const [templateId,  setTemplateId]  = useState('')
  const [frequency,   setFrequency]   = useState<Frequency>('weekly')
  const [daysOfWeek,  setDaysOfWeek]  = useState<number[]>([1]) // Monday default
  const [dayOfMonth,  setDayOfMonth]  = useState(1)
  const [timeOfDay,   setTimeOfDay]   = useState('08:00')
  const [assignedTo,  setAssignedTo]  = useState('')
  const [titlePrefix, setTitlePrefix] = useState('')

  // Populate form on edit / reset on create — multiple setState is legitimate here (form init)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (editTarget) {
      setTemplateId(editTarget.template_id)
      setFrequency(editTarget.frequency)
      setDaysOfWeek(editTarget.day_of_week ?? [1])
      setDayOfMonth(editTarget.day_of_month ?? 1)
      setTimeOfDay(editTarget.time_of_day.slice(0, 5)) // 'HH:MM:SS' → 'HH:MM'
      setAssignedTo(editTarget.assigned_to ?? '')
      setTitlePrefix(editTarget.title_prefix ?? '')
    } else {
      setTemplateId('')
      setFrequency('weekly')
      setDaysOfWeek([1])
      setDayOfMonth(1)
      setTimeOfDay('08:00')
      setAssignedTo('')
      setTitlePrefix('')
    }
  }, [editTarget, open])
  /* eslint-enable react-hooks/set-state-in-effect */

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function handleAutoPrefix(tplId: string) {
    if (titlePrefix) return
    const tpl = templates.find((t) => t.id === tplId)
    if (tpl) setTitlePrefix(tpl.title)
  }

  function handleSubmit() {
    if (!templateId) return

    const common = {
      templateId,
      frequency,
      dayOfWeek: (frequency === 'weekly' || frequency === 'biweekly') ? daysOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      timeOfDay,
      assignedTo:  assignedTo  || undefined,
      titlePrefix: titlePrefix || undefined,
    }

    if (editTarget) {
      update(
        {
          id: editTarget.id,
          ...common,
          dayOfWeek:  (frequency === 'weekly' || frequency === 'biweekly') ? daysOfWeek : null,
          dayOfMonth: frequency === 'monthly' ? dayOfMonth : null,
        },
        { onSuccess: onClose },
      )
    } else {
      create(
        { ...common, createdBy: profile?.id },
        { onSuccess: onClose },
      )
    }
  }

  if (!open) return null

  const previewTitle = buildPreviewTitle(titlePrefix, frequency)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative bg-card border border-border w-full max-h-[90svh] overflow-y-auto',
        'sm:max-w-lg sm:rounded-2xl rounded-t-2xl animate-scale-in',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold">
              {editTarget ? 'Editar regra de recorrência' : 'Nova regra de recorrência'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">

          {/* ── Template ─────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Template *
            </label>
            <select
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value)
                handleAutoPrefix(e.target.value)
              }}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione um template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          {/* ── Frequency pills ──────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Frequência
            </label>
            <div className="flex gap-2 flex-wrap">
              {FREQ_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={cn(
                    'h-9 px-4 rounded-lg text-sm font-medium border transition-colors',
                    frequency === opt.value
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-background border-border hover:bg-muted/60',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Day of week (weekly / biweekly) ──────────── */}
          {(frequency === 'weekly' || frequency === 'biweekly') && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dias da semana
              </label>
              <div className="flex gap-1.5">
                {DAY_SHORT.map((label, day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    title={DAY_FULL[day]}
                    className={cn(
                      'w-9 h-9 rounded-full text-xs font-medium border transition-colors shrink-0',
                      daysOfWeek.includes(day)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-background border-border hover:bg-muted/60',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Day of month (monthly) ───────────────────── */}
          {frequency === 'monthly' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dia do mês
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(Math.min(28, Math.max(1, Number(e.target.value))))}
                  className="w-24 h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">Máximo dia 28 (evita meses curtos)</span>
              </div>
            </div>
          )}

          {/* ── Time ─────────────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Horário de geração
            </label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* ── Assigned user ─────────────────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Responsável padrão
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Nenhum</option>
              {users.map((u: { id: string; name: string }) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* ── Title prefix + preview ───────────────────── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prefixo do título
            </label>
            <input
              type="text"
              value={titlePrefix}
              onChange={(e) => setTitlePrefix(e.target.value)}
              placeholder="Ex: Limpeza Semanal"
              maxLength={60}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="px-3 py-2 bg-muted rounded-lg text-xs text-muted-foreground">
              Exemplo:{' '}
              <span className="font-medium text-foreground">{previewTitle}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!templateId || isPending}
            className="gap-2"
          >
            {isPending
              ? 'Salvando…'
              : editTarget
              ? 'Salvar alterações'
              : 'Criar regra'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
