'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useSectors } from '@/hooks/use-sectors'
import { useUsers } from '@/hooks/use-users'
import { useEquipment } from '@/hooks/use-equipment'
import { useCreateMaintenanceOrder, useUpdateMaintenanceOrder } from '@/hooks/use-maintenance'
import { useAuth } from '@/hooks/use-auth'
import type {
  MaintenanceWithDetails, MaintenanceType, MaintenancePriority,
  MaintenanceStatus, RecurrenceRule,
} from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────
interface FormData {
  title:            string
  description:      string
  type:             MaintenanceType
  priority:         MaintenancePriority
  status:           MaintenanceStatus
  sector_id:        string
  equipment_id:     string
  assigned_to:      string
  due_date:         string
  // recorrência
  recurrence_frequency: 'daily' | 'weekly' | 'monthly'
  recurrence_interval:  string
  recurrence_day_of_week: string
  recurrence_day_of_month: string
  recurrence_advance_notice: string
}

const DEFAULT_FORM: FormData = {
  title:            '',
  description:      '',
  type:             'punctual',
  priority:         'medium',
  status:           'open',
  sector_id:        '',
  equipment_id:     '',
  assigned_to:      '',
  due_date:         '',
  recurrence_frequency:      'weekly',
  recurrence_interval:       '1',
  recurrence_day_of_week:    '1',
  recurrence_day_of_month:   '1',
  recurrence_advance_notice: '2',
}

const DAY_OF_WEEK_OPTS = [
  { value: '0', label: 'Domingo' }, { value: '1', label: 'Segunda' },
  { value: '2', label: 'Terça' },   { value: '3', label: 'Quarta' },
  { value: '4', label: 'Quinta' },  { value: '5', label: 'Sexta' },
  { value: '6', label: 'Sábado' },
]

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────
interface Props {
  order?: MaintenanceWithDetails
  onSuccess?: (id: string) => void
}

export function MaintenanceForm({ order, onSuccess }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const isEditing = !!order

  const { data: sectors = [] } = useSectors(true)
  const { data: users = [] } = useUsers({ isActive: true })
  const { data: equipmentList = [] } = useEquipment({ onlyActive: true })

  const createOrder = useCreateMaintenanceOrder()
  const updateOrder = useUpdateMaintenanceOrder()

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  // Inicializar formulário com dados existentes ou default
  const [form, setForm] = useState<FormData>(() => {
    if (!order) return DEFAULT_FORM
    const r = order.recurrence_rule
    return {
      title:            order.title,
      description:      order.description ?? '',
      type:             order.type,
      priority:         order.priority,
      status:           order.status,
      sector_id:        order.sector_id ?? '',
      equipment_id:     order.equipment_id ?? '',
      assigned_to:      order.assigned_to ?? '',
      due_date:         order.due_date ? order.due_date.split('T')[0] : '',
      recurrence_frequency:      r?.frequency ?? 'weekly',
      recurrence_interval:       String(r?.interval ?? 1),
      recurrence_day_of_week:    String(r?.day_of_week ?? 1),
      recurrence_day_of_month:   String(r?.day_of_month ?? 1),
      recurrence_advance_notice: String(r?.advance_notice_days ?? 2),
    }
  })

  function set(key: keyof FormData, value: string | null) {
    setForm((prev) => ({ ...prev, [key]: value ?? '' }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.title.trim()) errs.title = 'Título é obrigatório'
    if (!form.type) errs.type = 'Tipo é obrigatório'
    if (form.type === 'recurring' && !form.recurrence_interval)
      errs.recurrence_interval = 'Intervalo é obrigatório'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function buildRecurrenceRule(): RecurrenceRule | null {
    if (form.type !== 'recurring') return null
    const today = new Date()
    return {
      frequency: form.recurrence_frequency,
      interval:  parseInt(form.recurrence_interval, 10) || 1,
      ...(form.recurrence_frequency === 'weekly' && {
        day_of_week: parseInt(form.recurrence_day_of_week, 10),
      }),
      ...(form.recurrence_frequency === 'monthly' && {
        day_of_month: parseInt(form.recurrence_day_of_month, 10),
      }),
      advance_notice_days: parseInt(form.recurrence_advance_notice, 10) || 2,
      next_due_date: form.due_date || today.toISOString().split('T')[0],
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const payload = {
      title:           form.title.trim(),
      description:     form.description.trim() || null,
      type:            form.type,
      priority:        form.priority,
      status:          form.status,
      sector_id:       form.sector_id || null,
      equipment_id:    form.equipment_id || null,
      assigned_to:     form.assigned_to || null,
      due_date:        form.due_date ? new Date(form.due_date).toISOString() : null,
      event_id:        null,
      recurrence_rule: buildRecurrenceRule(),
      created_by:      profile?.id ?? '',
    }

    if (isEditing) {
      await updateOrder.mutateAsync({ id: order.id, data: payload })
      onSuccess ? onSuccess(order.id) : router.push(`/manutencao/${order.id}`)
    } else {
      const { id } = await createOrder.mutateAsync(payload as any)
      onSuccess ? onSuccess(id) : router.push(`/manutencao/${id}`)
    }
  }

  const isSaving = createOrder.isPending || updateOrder.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ── Seção 1: Informações Básicas ──────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Informações Básicas</h2>
        <Separator />

        <div className="space-y-1.5">
          <Label htmlFor="title">Título <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Descreva o problema ou serviço..."
            className={cn(errors.title && 'border-destructive')}
          />
          {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descrição detalhada</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Detalhe o problema, sintomas, o que precisa ser feito..."
            className="min-h-[120px] resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo <span className="text-destructive">*</span></Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger className={cn(errors.type && 'border-destructive')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="emergency">🔴 Emergencial</SelectItem>
                <SelectItem value="punctual">🟡 Pontual</SelectItem>
                <SelectItem value="recurring">🟢 Recorrente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="waiting_parts">Aguardando Peças</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── Seção 2: Localização ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Localização</h2>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Setor / Local</Label>
            <Select value={form.sector_id} onValueChange={(v) => set('sector_id', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar setor..." />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Equipamento / Ativo</Label>
            <Select
              value={form.equipment_id || '__none__'}
              onValueChange={(v) => set('equipment_id', v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar equipamento..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {equipmentList.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.name}
                    {eq.location ? ` — ${eq.location}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* ── Seção 3: Responsável e Prazo ─────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Responsável e Prazo</h2>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={form.assigned_to} onValueChange={(v) => set('assigned_to', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar responsável..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due_date">Data Limite</Label>
            <Input
              id="due_date"
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Seção 4: Recorrência (só se tipo = recurring) ─────── */}
      {form.type === 'recurring' && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <RefreshCw className="w-4 h-4 text-green-600" />
            Regra de Recorrência
          </h2>
          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Frequência</Label>
              <Select
                value={form.recurrence_frequency}
                onValueChange={(v) => set('recurrence_frequency', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diário</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec_interval">
                A cada{' '}
                {form.recurrence_frequency === 'daily' ? 'dias' :
                 form.recurrence_frequency === 'weekly' ? 'semanas' : 'meses'}
              </Label>
              <Input
                id="rec_interval"
                type="number"
                min="1"
                max="52"
                value={form.recurrence_interval}
                onChange={(e) => set('recurrence_interval', e.target.value)}
                className={cn(errors.recurrence_interval && 'border-destructive')}
              />
            </div>

            {form.recurrence_frequency === 'weekly' && (
              <div className="space-y-1.5">
                <Label>Dia da Semana</Label>
                <Select
                  value={form.recurrence_day_of_week}
                  onValueChange={(v) => set('recurrence_day_of_week', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_OF_WEEK_OPTS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.recurrence_frequency === 'monthly' && (
              <div className="space-y-1.5">
                <Label htmlFor="rec_day_month">Dia do Mês</Label>
                <Input
                  id="rec_day_month"
                  type="number"
                  min="1"
                  max="31"
                  value={form.recurrence_day_of_month}
                  onChange={(e) => set('recurrence_day_of_month', e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rec_advance">Alertar quantos dias antes?</Label>
              <Input
                id="rec_advance"
                type="number"
                min="0"
                max="30"
                value={form.recurrence_advance_notice}
                onChange={(e) => set('recurrence_advance_notice', e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            Quando esta ordem for concluída, o sistema cria automaticamente a próxima com a data calculada pela regra acima.
          </p>
        </section>
      )}

      {/* ── Seção 5: Fotos (placeholder — Bloco 2) ───────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Fotos</h2>
        <Separator />
        <div className="rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Upload de fotos disponível na tela de detalhe após criação.
        </div>
      </section>

      {/* ── Ações ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar Alterações' : 'Criar Ordem'}
        </Button>
      </div>
    </form>
  )
}
