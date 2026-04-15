'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MEETING_STATUS_LABELS } from '@/types/minutes'
import type {
  MeetingStatus,
  MeetingMinuteFormData,
  MeetingMinuteDetail,
  ParticipantDraft,
  ActionItemDraft,
} from '@/types/minutes'
import { ParticipantSelector } from './ParticipantSelector'
import { ActionItemsEditor } from './ActionItemsEditor'
import { DiscardChangesDialog } from './DiscardChangesDialog'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UnitUser {
  id:         string
  name:       string
  avatar_url: string | null
  is_active:  boolean
}

interface Props {
  /** Provided in edit mode — pre-fills the form */
  minute?:        MeetingMinuteDetail
  unitUsers:      UnitUser[]
  /** Current user id — auto-added as organizer in create mode */
  currentUserId:  string
  isEditMode:     boolean
  isSaving:       boolean
  onSave:         (data: MeetingMinuteFormData) => void
}

// ─────────────────────────────────────────────────────────────
// Helpers — build initial form state
// ─────────────────────────────────────────────────────────────

function buildInitialForm(
  minute: MeetingMinuteDetail | undefined,
  currentUserId: string,
): MeetingMinuteFormData {
  if (minute) {
    return {
      title:        minute.title,
      meeting_date: minute.meeting_date.slice(0, 10),
      location:     minute.location ?? '',
      summary:      minute.summary  ?? '',
      notes:        minute.notes    ?? '',
      status:       minute.status,
      participants: minute.participants.map((p) => ({
        _key:    p.user_id,
        user_id: p.user_id,
        role:    p.role,
      })),
      action_items: minute.action_items.map((a) => ({
        _key:        a.id,
        id:          a.id,
        description: a.description,
        assigned_to: a.assigned_to,
        due_date:    a.due_date ? a.due_date.slice(0, 10) : null,
        status:      a.status,
      })),
    }
  }

  // Create mode — today's date, current user as organizer
  const today = new Date().toISOString().slice(0, 10)
  return {
    title:        '',
    meeting_date: today,
    location:     '',
    summary:      '',
    notes:        '',
    status:       'draft',
    participants: [{
      _key:    currentUserId,
      user_id: currentUserId,
      role:    'organizer',
    }],
    action_items: [],
  }
}

function formKey(form: MeetingMinuteFormData): string {
  return JSON.stringify(form)
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

interface FormErrors {
  title?:        string
  meeting_date?: string
  action_items?: string
}

function validate(form: MeetingMinuteFormData): FormErrors {
  const errs: FormErrors = {}
  if (!form.title.trim())        errs.title        = 'Título é obrigatório.'
  if (!form.meeting_date)        errs.meeting_date  = 'Data da reunião é obrigatória.'
  const emptyItem = form.action_items.find((a) => !a.description.trim())
  if (emptyItem) errs.action_items = 'Todos os itens de ação precisam de uma descrição.'
  return errs
}

// ─────────────────────────────────────────────────────────────
// MeetingMinuteForm
// ─────────────────────────────────────────────────────────────

export function MeetingMinuteForm({
  minute,
  unitUsers,
  currentUserId,
  isEditMode,
  isSaving,
  onSave,
}: Props) {
  const router = useRouter()

  const initialForm = useMemo(
    () => buildInitialForm(minute, currentUserId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally only once — form is uncontrolled after init
  )
  const initialKey = useMemo(() => formKey(initialForm), [initialForm])

  const [form, setForm]     = useState<MeetingMinuteFormData>(initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showDiscard, setShowDiscard] = useState(false)

  const isDirty = formKey(form) !== initialKey

  // ── Field helpers ─────────────────────────────────────────

  function setField<K extends keyof MeetingMinuteFormData>(
    key: K,
    value: MeetingMinuteFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  // ── Save ──────────────────────────────────────────────────

  function handleSave() {
    const errs = validate(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    onSave(form)
  }

  // ── Cancel / back ─────────────────────────────────────────

  function handleCancel() {
    if (isDirty) {
      setShowDiscard(true)
    } else {
      navigateBack()
    }
  }

  function navigateBack() {
    if (isEditMode && minute) {
      router.push(`/atas`)
    } else {
      router.push('/atas')
    }
  }

  // ── Computed original lists for mutation sync ─────────────
  const originalParticipants: ParticipantDraft[] = useMemo(
    () => initialForm.participants,
    [initialForm]
  )
  const originalActionItems: ActionItemDraft[] = useMemo(
    () => initialForm.action_items,
    [initialForm]
  )
  // Expose via form — mutations hook reads them separately
  void originalParticipants
  void originalActionItems

  // ─── Render ───────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6 pb-24 sm:pb-0">
        {/* Back link */}
        <div>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {isEditMode ? 'Voltar para atas' : 'Voltar para atas'}
          </button>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {isEditMode ? 'Editar Ata' : 'Nova Ata'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEditMode
              ? 'Atualize os dados da ata de reunião.'
              : 'Preencha os dados da nova ata de reunião.'}
          </p>
        </div>

        {/* ── Section 1: Informações Gerais ─────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Informações Gerais</h2>

          {/* Title */}
          <div>
            <label htmlFor="minute-title" className="block text-sm font-medium text-foreground mb-1">
              Título <span className="text-destructive">*</span>
            </label>
            <input
              id="minute-title"
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Ex.: Reunião de Planejamento Mensal"
              className={cn(
                'w-full h-10 px-3 rounded-lg border bg-background',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                'transition-colors',
                errors.title ? 'border-destructive' : 'border-border',
              )}
            />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Date + Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="minute-date" className="block text-sm font-medium text-foreground mb-1">
                Data da Reunião <span className="text-destructive">*</span>
              </label>
              <input
                id="minute-date"
                type="date"
                value={form.meeting_date}
                onChange={(e) => setField('meeting_date', e.target.value)}
                className={cn(
                  'w-full h-10 px-3 rounded-lg border bg-background',
                  'text-sm text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                  'transition-colors',
                  errors.meeting_date ? 'border-destructive' : 'border-border',
                )}
              />
              {errors.meeting_date && (
                <p className="mt-1 text-xs text-destructive">{errors.meeting_date}</p>
              )}
            </div>

            <div>
              <label htmlFor="minute-location" className="block text-sm font-medium text-foreground mb-1">
                Local
              </label>
              <input
                id="minute-location"
                type="text"
                value={form.location}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="Ex.: Sala de reuniões"
                className={cn(
                  'w-full h-10 px-3 rounded-lg border border-border bg-background',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                  'transition-colors',
                )}
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <label htmlFor="minute-summary" className="block text-sm font-medium text-foreground mb-1">
              Resumo
            </label>
            <textarea
              id="minute-summary"
              value={form.summary}
              onChange={(e) => setField('summary', e.target.value)}
              rows={3}
              placeholder="Breve resumo da reunião..."
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border border-border bg-background resize-none',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                'transition-colors',
              )}
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="minute-notes" className="block text-sm font-medium text-foreground mb-1">
              Notas / Pauta
            </label>
            <textarea
              id="minute-notes"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={5}
              placeholder="Detalhes, pauta, decisões tomadas..."
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border border-border bg-background resize-y',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                'transition-colors',
              )}
            />
          </div>
        </section>

        {/* ── Section 2: Participantes ──────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Participantes</h2>
          <ParticipantSelector
            participants={form.participants}
            unitUsers={unitUsers}
            onChange={(participants) => setField('participants', participants)}
          />
        </section>

        {/* ── Section 3: Itens de Ação ──────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Itens de Ação</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tarefas e responsabilidades definidas na reunião.
            </p>
          </div>
          {errors.action_items && (
            <p className="text-xs text-destructive">{errors.action_items}</p>
          )}
          <ActionItemsEditor
            items={form.action_items}
            unitUsers={unitUsers}
            isEditMode={isEditMode}
            onChange={(items) => setField('action_items', items)}
          />
        </section>

        {/* ── Section 4: Status ─────────────────────────── */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Status da Ata</h2>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Status
            </label>
            <Select
              value={form.status}
              onValueChange={(v) => setField('status', v as MeetingStatus)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MEETING_STATUS_LABELS) as [MeetingStatus, string][]).map(
                  ([status, label]) => (
                    <SelectItem key={status} value={status}>{label}</SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {form.status === 'draft'
                ? 'Rascunho — visível apenas para você e participantes com acesso elevado.'
                : 'Publicada — visível para todos os participantes da ata.'}
            </p>
          </div>
        </section>

        {/* ── Footer (desktop: inline / mobile: sticky) ─── */}
        <div className={cn(
          // Mobile: sticky bar at bottom
          'fixed bottom-0 left-0 right-0 z-sticky',
          'sm:static sm:z-auto',
          'bg-background/95 backdrop-blur sm:bg-transparent sm:backdrop-blur-none',
          'border-t border-border sm:border-none',
          'px-4 py-3 sm:p-0',
          'flex gap-3 sm:justify-end',
        )}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 sm:flex-none h-11 sm:h-10 px-5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none h-11 sm:h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving
              ? 'Salvando…'
              : isEditMode
                ? 'Salvar Alterações'
                : 'Criar Ata'}
          </button>
        </div>
      </div>

      {/* Discard dialog */}
      <DiscardChangesDialog
        open={showDiscard}
        onKeep={() => setShowDiscard(false)}
        onDiscard={navigateBack}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// Re-export original lists for parent to access
// ─────────────────────────────────────────────────────────────

export function buildOriginalLists(minute: MeetingMinuteDetail) {
  const participants: ParticipantDraft[] = minute.participants.map((p) => ({
    _key:    p.user_id,
    user_id: p.user_id,
    role:    p.role,
  }))

  const action_items: ActionItemDraft[] = minute.action_items.map((a) => ({
    _key:        a.id,
    id:          a.id,
    description: a.description,
    assigned_to: a.assigned_to,
    due_date:    a.due_date ? a.due_date.slice(0, 10) : null,
    status:      a.status,
  }))

  return { participants, action_items }
}
