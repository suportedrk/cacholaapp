'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X, EyeOff } from 'lucide-react'
import { useIsReadOnly } from '@/hooks/use-read-only'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useEventTypes, usePackages, useVenues } from '@/hooks/use-event-config'
import { useUsers } from '@/hooks/use-users'
import { useCreateEvent, useUpdateEvent } from '@/hooks/use-events'
import { useAuth } from '@/hooks/use-auth'
import type { EventWithDetails, EventStatus, User } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// Tipos internos do formulário
// ─────────────────────────────────────────────────────────────
interface StaffEntry {
  user_id: string
  role_in_event: string
  name: string // para exibição
}

interface FormData {
  // Seção 1 — Informações Básicas
  title: string
  date: Date | undefined
  start_time: string
  end_time: string
  status: EventStatus
  // Seção 2 — Cliente
  client_name: string
  birthday_person: string
  birthday_age: string
  guest_count: string
  // Seção 3 — Detalhes
  event_type_id: string
  package_id: string
  venue_id: string
  // Seção 5 — Observações
  notes: string
  ploomes_deal_id: string
}

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: 'pending',     label: 'Pendente' },
  { value: 'confirmed',   label: 'Confirmado' },
  { value: 'preparing',   label: 'Em Preparo' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'finished',    label: 'Finalizado' },
  { value: 'post_event',  label: 'Pós-Evento' },
]

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
interface EventFormProps {
  event?: EventWithDetails // Se fornecido, modo de edição
}

export function EventForm({ event }: EventFormProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const isEditing = !!event

  // Queries de dados de configuração
  const { data: eventTypes = [] } = useEventTypes()
  const { data: packages = [] } = usePackages()
  const { data: venues = [] } = useVenues()
  const { data: usersData } = useUsers()
  const activeUsers = (usersData ?? []).filter((u: User) => u.is_active)

  // Mutations
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const isLoading = createEvent.isPending || updateEvent.isPending
  const isReadOnly = useIsReadOnly()

  // ─── Estado do formulário ───
  const [form, setForm] = useState<FormData>({
    title:           event?.title ?? '',
    date:            event?.date ? new Date(`${event.date}T00:00:00`) : undefined,
    start_time:      event?.start_time?.slice(0, 5) ?? '',
    end_time:        event?.end_time?.slice(0, 5) ?? '',
    status:          event?.status ?? 'pending',
    client_name:     event?.client_name ?? '',
    birthday_person: event?.birthday_person ?? '',
    birthday_age:    event?.birthday_age?.toString() ?? '',
    guest_count:     event?.guest_count?.toString() ?? '',
    event_type_id:   event?.event_type?.id ?? '',
    package_id:      event?.package?.id ?? '',
    venue_id:        event?.venue?.id ?? '',
    notes:           event?.notes ?? '',
    ploomes_deal_id: event?.ploomes_deal_id ?? '',
  })

  const [staff, setStaff] = useState<StaffEntry[]>(
    event?.staff.map((s) => ({
      user_id: s.user.id,
      role_in_event: s.role_in_event,
      name: s.user.name,
    })) ?? []
  )

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [dateOpen, setDateOpen] = useState(false)

  // ─── Helpers ───
  const setField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const addStaff = (userId: string | null) => {
    if (!userId) return
    const user = activeUsers.find((u: User) => u.id === userId)
    if (!user || staff.some((s) => s.user_id === userId)) return
    setStaff((prev) => [...prev, { user_id: userId, role_in_event: '', name: user.name }])
  }

  const removeStaff = (userId: string) =>
    setStaff((prev) => prev.filter((s) => s.user_id !== userId))

  const updateStaffRole = (userId: string, role: string) =>
    setStaff((prev) =>
      prev.map((s) => (s.user_id === userId ? { ...s, role_in_event: role } : s))
    )

  // ─── Validação ───
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (!form.title.trim())        newErrors.title = 'Título obrigatório'
    if (!form.date)                newErrors.date = 'Data obrigatória'
    if (!form.start_time)          newErrors.start_time = 'Horário de início obrigatório'
    if (!form.end_time)            newErrors.end_time = 'Horário de término obrigatório'
    if (!form.client_name.trim())  newErrors.client_name = 'Nome do contratante obrigatório'
    if (form.start_time && form.end_time && form.start_time >= form.end_time) {
      newErrors.end_time = 'Horário de término deve ser após o início'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ─── Submit ───
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !profile) return

    const eventData = {
      title:           form.title.trim(),
      date:            format(form.date!, 'yyyy-MM-dd'),
      start_time:      form.start_time + ':00',
      end_time:        form.end_time + ':00',
      status:          form.status,
      client_name:     form.client_name.trim(),
      birthday_person: form.birthday_person.trim() || null,
      birthday_age:    form.birthday_age ? parseInt(form.birthday_age) : null,
      guest_count:     form.guest_count ? parseInt(form.guest_count) : null,
      event_type_id:   form.event_type_id || null,
      package_id:      form.package_id || null,
      venue_id:        form.venue_id || null,
      notes:           form.notes.trim() || null,
      ploomes_deal_id: form.ploomes_deal_id.trim() || null,
    }

    const staffEntries = staff
      .filter((s) => s.role_in_event.trim())
      .map((s) => ({ user_id: s.user_id, role_in_event: s.role_in_event.trim() }))

    if (isEditing) {
      await updateEvent.mutateAsync({
        id: event.id,
        eventData,
        staffEntries,
      })
      router.push(`/eventos/${event.id}`)
    } else {
      const id = await createEvent.mutateAsync({
        eventData: { ...eventData, created_by: profile.id },
        staffEntries,
      })
      router.push(`/eventos/${id}`)
    }
  }

  // ─── Render ───
  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8 max-w-2xl">

      {/* ── Seção 1: Informações Básicas ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Informações Básicas
        </h2>
        <div className="grid gap-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Título do Evento *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Ex: Festa da Maria, 5 anos"
              className={cn(errors.title && 'border-destructive')}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label>Data do Evento *</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger
                className={cn(
                  'flex h-10 w-full items-center justify-start rounded-lg border border-input bg-transparent px-3 text-sm transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                  !form.date && 'text-muted-foreground',
                  errors.date && 'border-destructive'
                )}
              >
                {form.date
                  ? format(form.date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
                  : 'Selecionar data'}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={form.date}
                  onSelect={(d) => { setField('date', d); setDateOpen(false) }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Início *</Label>
              <Input
                id="start_time"
                type="time"
                value={form.start_time}
                onChange={(e) => setField('start_time', e.target.value)}
                className={cn(errors.start_time && 'border-destructive')}
              />
              {errors.start_time && <p className="text-xs text-destructive">{errors.start_time}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">Término *</Label>
              <Input
                id="end_time"
                type="time"
                value={form.end_time}
                onChange={(e) => setField('end_time', e.target.value)}
                className={cn(errors.end_time && 'border-destructive')}
              />
              {errors.end_time && <p className="text-xs text-destructive">{errors.end_time}</p>}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setField('status', (v ?? 'pending') as EventStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Seção 2: Cliente ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Cliente
        </h2>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="client_name">Nome do Contratante *</Label>
            <Input
              id="client_name"
              value={form.client_name}
              onChange={(e) => setField('client_name', e.target.value)}
              placeholder="Ex: João Silva"
              className={cn(errors.client_name && 'border-destructive')}
            />
            {errors.client_name && <p className="text-xs text-destructive">{errors.client_name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="birthday_person">Nome do Aniversariante</Label>
            <Input
              id="birthday_person"
              value={form.birthday_person}
              onChange={(e) => setField('birthday_person', e.target.value)}
              placeholder="Ex: Maria"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="birthday_age">Idade</Label>
              <Input
                id="birthday_age"
                type="number"
                min={0}
                max={120}
                value={form.birthday_age}
                onChange={(e) => setField('birthday_age', e.target.value)}
                placeholder="Ex: 5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guest_count">Nº de Convidados</Label>
              <Input
                id="guest_count"
                type="number"
                min={0}
                value={form.guest_count}
                onChange={(e) => setField('guest_count', e.target.value)}
                placeholder="Ex: 80"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Seção 3: Detalhes do Evento ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Detalhes do Evento
        </h2>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Tipo de Evento</Label>
            <Select
              value={form.event_type_id}
              onValueChange={(v) => setField('event_type_id', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Pacote Contratado</Label>
            <Select
              value={form.package_id}
              onValueChange={(v) => setField('package_id', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar pacote..." />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Local / Salão</Label>
            <Select
              value={form.venue_id}
              onValueChange={(v) => setField('venue_id', v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar salão..." />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.capacity ? ` (cap. ${v.capacity})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <div className="border-t border-border" />

      {/* ── Seção 4: Equipe ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Equipe Designada
        </h2>

        {/* Select para adicionar membro */}
        <div className="space-y-1.5">
          <Label>Adicionar membro</Label>
          <Select onValueChange={(v) => addStaff(v)} value="">
            <SelectTrigger>
              <SelectValue placeholder="Selecionar funcionário..." />
            </SelectTrigger>
            <SelectContent>
              {activeUsers
                .filter((u: User) => !staff.some((s) => s.user_id === u.id))
                .map((u: User) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de membros adicionados */}
        {staff.length > 0 && (
          <div className="space-y-2">
            {staff.map((s) => (
              <div key={s.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                  {s.name}
                </span>
                <Input
                  placeholder="Função (ex: Garçom)"
                  value={s.role_in_event}
                  onChange={(e) => updateStaffRole(s.user_id, e.target.value)}
                  className="h-8 text-sm w-36 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => removeStaff(s.user_id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {staff.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3 border border-dashed border-border rounded-lg">
            Nenhum funcionário designado
          </p>
        )}
      </section>

      <div className="border-t border-border" />

      {/* ── Seção 5: Observações ── */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Observações
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações Especiais</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Alergias, restrições alimentares, pedidos especiais..."
            className="resize-none"
            rows={3}
          />
        </div>

        {/* Ploomes — campo oculto para integração futura */}
        {form.ploomes_deal_id && (
          <div className="space-y-1.5">
            <Label htmlFor="ploomes_deal_id" className="text-muted-foreground text-xs">
              ID Ploomes (integração)
            </Label>
            <Input
              id="ploomes_deal_id"
              value={form.ploomes_deal_id}
              readOnly
              className="bg-muted text-muted-foreground text-xs h-8"
            />
          </div>
        )}
      </section>

      {/* ── Botões ── */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || isReadOnly}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar Alterações' : 'Criar Evento'}
        </Button>
        {isReadOnly && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <EyeOff className="w-3.5 h-3.5" />
            Modo visualização — ações desabilitadas
          </span>
        )}
      </div>
    </form>
  )
}
