'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  AlertTriangle,
  Wrench,
  Calendar,
  MapPin,
  Tag,
  Camera,
  Plus,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  ArrowRightLeft,
  Pencil,
  Trash2,
  Phone,
  MessageCircle,
  ImagePlus,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useTicket,
  useUpdateTicketStatus,
  useUpdateTicketEquipment,
  useUpdateTicketAssignee,
  useAddExecution,
  useExecutionEdit,
  useDeleteExecution,
  useUploadTicketPhoto,
  useApproveCost,
  useFinalizeTicket,
} from '@/hooks/use-tickets'
import { useEquipment } from '@/hooks/use-equipment'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useProviders } from '@/hooks/use-providers'
import { useMaintenanceExecutorOptions } from '@/hooks/use-maintenance-executors'
import { useMaintenancePeople, type MaintenancePeopleMap } from '@/hooks/use-maintenance-people'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useAuth } from '@/hooks/use-auth'
import { URGENCY_CONFIG, NATURE_CONFIG, STATUS_CONFIG } from '@/components/features/maintenance/ticket-card'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  MaintenanceTicketWithDetails,
  MaintenanceExecution,
  MaintenanceTicketPhoto,
  MaintenanceStatusHistory,
  TicketStatus,
  ExecutionStatus,
} from '@/types/database.types'
import { hasRole, MAINTENANCE_ADMIN_ROLES } from '@/config/roles'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<TicketStatus, string> = {
  open:         'Aberto',
  in_progress:  'Em Andamento',
  waiting_part: 'Aguard. Peça',
  concluded:    'Concluído',
  cancelled:    'Cancelado',
}

// 'concluded' fora do seletor genérico: a conclusão acontece SÓ pelo fluxo
// dedicado "Concluir chamado" (que exige a descrição da resolução).
const STATUS_TRANSITIONS: Record<string, TicketStatus[]> = {
  open:         ['in_progress', 'cancelled'],
  in_progress:  ['waiting_part', 'cancelled'],
  waiting_part: ['in_progress', 'cancelled'],
}

const STATUS_ICON: Record<string, React.ElementType> = {
  open:         Clock,
  in_progress:  Wrench,
  waiting_part: Package,
  concluded:    CheckCircle2,
  cancelled:    XCircle,
}

const EXEC_STATUS_LABELS: Record<ExecutionStatus, string> = {
  assigned:    'Atribuída',
  in_progress: 'Em Andamento',
  concluded:   'Concluída',
}

const EXEC_STATUS_BADGE: Record<ExecutionStatus, string> = {
  assigned:    'badge-gray border',
  in_progress: 'badge-amber border',
  concluded:   'badge-green border',
}

function formatDate(d?: string | null) {
  if (!d) return null
  return format(parseISO(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

function formatRelative(d: string) {
  return formatDistanceToNow(parseISO(d), { locale: ptBR, addSuffix: true })
}

// ─────────────────────────────────────────────────────────────
// InfoRow
// ─────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EquipmentRow — edição inline do equipamento vinculado
// ─────────────────────────────────────────────────────────────
function EquipmentRow({
  ticketId,
  ticketUnitId,
  currentEquipment,
  canEdit,
}: {
  ticketId: string
  ticketUnitId: string
  currentEquipment: { id: string; name: string; category: string | null } | null
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(currentEquipment?.id ?? '')

  // Filtra equipamentos pela unidade do TICKET (não do store) — evita listar equipamentos
  // de outras unidades quando o seletor global está em "Todas" ou em unidade diferente.
  const { data: equipments = [] } = useEquipment({ status: ['active', 'in_repair'] }, ticketUnitId)
  const { mutate: updateEquipment, isPending } = useUpdateTicketEquipment()

  function handleConfirm() {
    updateEquipment(
      { id: ticketId, equipmentId: selected || null },
      { onSuccess: () => setEditing(false) }
    )
  }

  function handleCancel() {
    setSelected(currentEquipment?.id ?? '')
    setEditing(false)
  }

  const displayName = currentEquipment?.name ?? null
  const displayCategory = currentEquipment?.category ?? null

  if (editing) {
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
        <Package className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">Equipamento</p>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:border-border-focus transition-colors"
            autoFocus
          >
            <option value="">Nenhum equipamento</option>
            {equipments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.category ? ` · ${e.category}` : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-interactive-primary-hover transition-colors"
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="h-7 px-3 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Package className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Equipamento</p>
        <div className="flex items-center gap-2 mt-0.5">
          {displayName ? (
            <p className="text-sm font-medium text-foreground">
              {displayName}
              {displayCategory && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">· {displayCategory}</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum</p>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0"
              aria-label="Editar equipamento"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AssigneeRow — edição inline do Responsável pelo chamado (dono/gestor)
// ─────────────────────────────────────────────────────────────
function AssigneeRow({
  ticketId,
  ticketUnitId,
  currentAssignee,
  canEdit,
}: {
  ticketId: string
  ticketUnitId: string
  currentAssignee: { id: string; name: string; avatar_url: string | null } | null
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(currentAssignee?.id ?? '')

  // Candidatos = equipe de manutenção da unidade do TICKET (RPC gated por
  // manutencao 'edit' + check_permission view + escopo de unidade).
  const { data: assignees = [] } = useMaintenanceExecutorOptions(ticketUnitId)
  const { mutate: updateAssignee, isPending } = useUpdateTicketAssignee()

  function handleConfirm() {
    updateAssignee(
      { id: ticketId, assigneeId: selected || null },
      { onSuccess: () => setEditing(false) }
    )
  }

  function handleCancel() {
    setSelected(currentAssignee?.id ?? '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
        <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground">Responsável pelo chamado</p>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:border-border-focus transition-colors"
            autoFocus
          >
            <option value="">Sem responsável</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 hover:bg-interactive-primary-hover transition-colors"
            >
              {isPending ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="h-7 px-3 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Responsável pelo chamado</p>
        <div className="flex items-center gap-2 mt-0.5">
          {currentAssignee ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar name={currentAssignee.name} avatarUrl={currentAssignee.avatar_url} size="sm" />
              <p className="text-sm font-medium text-foreground truncate">{currentAssignee.name}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem responsável</p>
          )}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0"
              aria-label="Editar responsável pelo chamado"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// StatusModal
// ─────────────────────────────────────────────────────────────
function StatusModal({
  ticketId,
  currentStatus,
  onClose,
}: {
  ticketId: string
  currentStatus: TicketStatus
  onClose: () => void
}) {
  const [newStatus, setNewStatus] = useState<TicketStatus | ''>('')
  const [note, setNote] = useState('')
  const { mutate: updateStatus, isPending } = useUpdateTicketStatus()

  const options = STATUS_TRANSITIONS[currentStatus] ?? []

  function handleConfirm() {
    if (!newStatus) return
    updateStatus(
      { id: ticketId, status: newStatus, note: note.trim() || undefined },
      { onSuccess: onClose }
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Alterar Status</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Novo status</label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Selecione...</option>
            {options.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Observação (opcional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Descreva o motivo da mudança..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={!newStatus || isPending}
            onClick={handleConfirm}
          >
            {isPending ? 'Salvando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────
// AddExecutionModal
// ─────────────────────────────────────────────────────────────
function AddExecutionModal({
  ticketId,
  unitId,
  onClose,
  execution,
}: {
  ticketId: string
  unitId: string
  onClose: () => void
  execution?: RichExecution
}) {
  const isEditMode = !!execution

  const [type, setType] = useState<'internal' | 'external'>(execution?.executor_type ?? 'internal')
  const [userId, setUserId] = useState(execution?.internal_user_id ?? '')
  const [providerId, setProviderId] = useState(execution?.provider_id ?? '')
  const [responsibleId, setResponsibleId] = useState(execution?.responsible_user_id ?? '')
  const [description, setDescription] = useState(execution?.description ?? '')
  const [costStr, setCostStr] = useState('')
  const [execStatus, setExecStatus] = useState<ExecutionStatus>(execution?.status ?? 'assigned')
  const [scheduledAt, setScheduledAt] = useState(isoToDatetimeLocal(execution?.scheduled_at ?? null))
  const [durationStr, setDurationStr] = useState(execution?.estimated_duration_minutes?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  // Executor interno = equipe de manutenção (RPC com check_permission view + escopo unidade).
  const { data: executors = [] } = useMaintenanceExecutorOptions(unitId)
  // Responsável interno do serviço externo: também da EQUIPE de manutenção (D6) —
  // precisa de manutencao.view para enxergar a própria tarefa pela RLS.
  const { data: responsibles = [] } = useMaintenanceExecutorOptions(unitId)
  // Prestadores filtrados pela unidade do TICKET — em "Todas" no seletor global,
  // o store estaria em null e o hook listaria prestadores de todas as unidades.
  const { data: providers = [] } = useProviders({ status: 'active' }, unitId)
  const { mutate: addExecution, isPending: isPendingAdd } = useAddExecution(onClose)
  const { mutate: editExecution, isPending: isPendingEdit } = useExecutionEdit(ticketId)
  const isPending = isPendingAdd || isPendingEdit

  // Reset em cascata ao alternar interno/external: limpa os campos do outro tipo.
  function switchType(t: 'internal' | 'external') {
    setType(t)
    setError(null)
    if (t === 'internal') {
      setProviderId('')
      setResponsibleId('')
    } else {
      setUserId('')
    }
  }

  function handleSave() {
    if (type === 'internal' && !userId) {
      setError('Selecione o colaborador.')
      return
    }
    if (type === 'external' && (!providerId || !responsibleId)) {
      setError('Selecione o prestador e o responsável interno.')
      return
    }

    if (isEditMode && execution) {
      editExecution({
        id:                  execution.id,
        executor_type:       type,
        internal_user_id:    type === 'internal' ? userId || null : null,
        provider_id:         type === 'external' ? providerId || null : null,
        responsible_user_id: type === 'external' ? responsibleId || null : null,
        description:         description.trim() || null,
        status:              execStatus,
        scheduled_at:        scheduledAt ? new Date(`${scheduledAt}:00-03:00`).toISOString() : null,
        estimated_duration_minutes: durationStr ? parseInt(durationStr, 10) || null : null,
      }, { onSuccess: onClose })
    } else {
      addExecution({
        ticket_id:           ticketId,
        executor_type:       type,
        internal_user_id:    type === 'internal' ? userId || null : null,
        provider_id:         type === 'external' ? providerId || null : null,
        responsible_user_id: type === 'external' ? responsibleId || null : null,
        description:         description.trim() || null,
        cost:               parseFloat(costStr.replace(',', '.')) || 0,
        status:             execStatus,
        // datetime-local é "naive" — fixamos o fuso de Brasília (UTC-3, sem horário
        // de verão) em vez de depender do fuso do dispositivo. '2026-06-15T14:30'
        // → '2026-06-15T14:30:00-03:00' → toISOString() grava o UTC correto.
        scheduled_at:        scheduledAt ? new Date(`${scheduledAt}:00-03:00`).toISOString() : null,
        estimated_duration_minutes: durationStr ? parseInt(durationStr, 10) || null : null,
      } as Parameters<typeof addExecution>[0])
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho fixo */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-base font-semibold">{isEditMode ? 'Editar Execução' : 'Adicionar Execução'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2 space-y-4">
          {/* Tipo toggle */}
          <div className="flex gap-2">
            {(['internal', 'external'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchType(t)}
                className={`flex-1 h-9 rounded-lg text-sm font-medium transition-colors border ${
                  type === t
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {t === 'internal' ? 'Interno' : 'Externo'}
              </button>
            ))}
          </div>

          {/* Executor */}
          {type === 'internal' ? (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Colaborador</label>
              <select
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setError(null) }}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Selecione...</option>
                {executors.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Prestador</label>
                <select
                  value={providerId}
                  onChange={(e) => { setProviderId(e.target.value); setError(null) }}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Responsável interno</label>
                <select
                  value={responsibleId}
                  onChange={(e) => { setResponsibleId(e.target.value); setError(null) }}
                  className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecione...</option>
                  {responsibles.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Quem acompanha o serviço do prestador.</p>
              </div>
            </>
          )}

          {/* Descrição */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="O que será feito..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Custo — oculto em modo edição (gerenciado pelo workflow de aprovação) */}
          {!isEditMode && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Custo estimado (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={costStr}
                onChange={(e) => setCostStr(e.target.value)}
                placeholder="0,00"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* Status */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <select
              value={execStatus}
              onChange={(e) => setExecStatus(e.target.value as ExecutionStatus)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="assigned">Atribuída</option>
              <option value="in_progress">Em Andamento</option>
              <option value="concluded">Concluída</option>
            </select>
          </div>

          {/* Agendamento — opcional. Gera o lançamento na agenda e na lista de tarefas. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Data e hora</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Duração (min)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                placeholder="ex: 60"
                className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Agendar gera a tarefa para o designado e o lançamento na agenda. Opcional.
          </p>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Rodapé fixo */}
        <div className="flex gap-2 px-6 pt-4 pb-6 shrink-0 border-t border-border">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" className="flex-1" disabled={isPending} onClick={handleSave}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────
// FinalizeModal — concluir chamado (resolução obrigatória + fotos 'conclusao')
// ─────────────────────────────────────────────────────────────
function nowLocalDatetime(): string {
  // 'YYYY-MM-DDTHH:MM' no horário de Brasília, para o input datetime-local.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

// Converte ISO UTC → 'YYYY-MM-DDTHH:MM' em Brasília, para o input datetime-local.
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function FinalizeModal({
  ticketId,
  unitId,
  onClose,
}: {
  ticketId: string
  unitId: string
  onClose: () => void
}) {
  const [concludedAt, setConcludedAt] = useState(() => nowLocalDatetime())
  const [resolution, setResolution]   = useState('')
  const [error, setError]             = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)

  const { mutateAsync: finalize } = useFinalizeTicket(ticketId)
  const { mutateAsync: uploadPhoto } = useUploadTicketPhoto()
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  function handleAddFiles(files: FileList | null) {
    if (!files) return
    setPendingFiles((prev) => [...prev, ...Array.from(files)])
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function handleConfirm() {
    if (!resolution.trim()) {
      setError('Descreva o que foi realizado.')
      return
    }
    if (!concludedAt) {
      setError('Informe a data e hora da conclusão.')
      return
    }
    setSubmitting(true)
    try {
      // Offset Brasília fixo (-03:00), igual ao Bloco D.
      const concludedAtISO = new Date(`${concludedAt}:00-03:00`).toISOString()
      await finalize({ concludedAtISO, resolutionNotes: resolution.trim() })
      // Upload best-effort das fotos do 'depois' (ticket já concluído, mas
      // a foto é da fase conclusao). Falha de foto não desfaz a conclusão.
      let failed = 0
      for (const file of pendingFiles) {
        try {
          await uploadPhoto({ file, ticketId, unitId, phase: 'conclusao' })
        } catch { failed++ }
      }
      if (failed > 0) {
        toast.error(`Chamado concluído, mas ${failed} foto(s) não subiram. Reenvie no detalhe.`, { duration: 6000 })
      }
      onClose()
    } catch {
      // finalize.onError já mostrou o toast
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Concluir chamado
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data e hora da conclusão</label>
          <input
            type="datetime-local"
            value={concludedAt}
            onChange={(e) => { setConcludedAt(e.target.value); setError(null) }}
            className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            O que foi realizado <span className="text-destructive">*</span>
          </label>
          <textarea
            value={resolution}
            onChange={(e) => { setResolution(e.target.value); setError(null) }}
            rows={4}
            placeholder="Descreva o serviço executado..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fotos do serviço concluído</label>
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full h-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:border-border-focus hover:text-text-secondary transition-colors"
          >
            <ImagePlus className="w-4 h-4" />
            Anexar fotos {pendingFiles.length > 0 ? `(${pendingFiles.length})` : ''}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleAddFiles(e.target.files)}
          />
          <p className="text-xs text-text-tertiary">Recomendado, opcional.</p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button size="sm" className="flex-1" onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Concluindo...' : 'Concluir'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────────────
// ExecutionRow
// ─────────────────────────────────────────────────────────────
type ProviderContact = { type: 'phone' | 'email' | 'whatsapp'; value: string; is_primary: boolean | null }
type RichExecution = MaintenanceExecution & {
  internal_user:         { id: string; name: string; avatar_url: string | null } | null
  responsible_user:      { id: string; name: string } | null
  cost_approved_by_user: { id: string; name: string } | null
  provider:              { id: string; name: string; contacts: ProviderContact[] } | null
}

// Escolhe o contato preferindo is_primary (mesmo critério do ProviderCard).
function pickContact(contacts: ProviderContact[], type: 'phone' | 'whatsapp'): string | null {
  const matches = contacts.filter((c) => c.type === type)
  if (matches.length === 0) return null
  return (matches.find((c) => c.is_primary) ?? matches[0]).value
}

// Normaliza para wa.me: só dígitos; prefixa 55 SÓ se ainda não tiver código do país.
function waNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
}

function ExecutionRow({
  execution,
  ticketId,
  unitId,
  canApprove,
  canEdit,
  canDelete,
  people,
}: {
  execution: RichExecution
  ticketId: string
  unitId: string
  canApprove: boolean
  canEdit: boolean
  canDelete: boolean
  people: MaintenancePeopleMap
}) {
  const { mutate: approveCost, isPending } = useApproveCost(ticketId)
  const { mutate: deleteExecution, isPending: isDeleting } = useDeleteExecution(ticketId)
  const [approving, setApproving]   = useState(false)
  const [approvedStr, setApprovedStr] = useState(() => execution.cost.toFixed(2).replace('.', ','))
  const [editOpen, setEditOpen]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Nomes de usuário resolvidos pela RPC (Map) — embed só como fallback (NULL p/ técnicos).
  const internalName = execution.internal_user_id
    ? (people.get(execution.internal_user_id)?.name ?? execution.internal_user?.name ?? null)
    : null
  const responsibleName = execution.responsible_user_id
    ? (people.get(execution.responsible_user_id)?.name ?? execution.responsible_user?.name ?? null)
    : null
  const approvedByName = execution.cost_approved_by
    ? (people.get(execution.cost_approved_by)?.name ?? execution.cost_approved_by_user?.name ?? null)
    : null

  const executorName = internalName ?? execution.provider?.name ?? 'Não atribuído'
  const isInternal   = execution.executor_type === 'internal'
  const hasCost      = execution.cost > 0

  // Data/hora da aprovação sempre em Brasília.
  const approvedAtFmt = execution.cost_approved_at
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
      }).format(new Date(execution.cost_approved_at))
    : null

  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{executorName}</p>
            <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${isInternal ? 'badge-brand border' : 'badge-blue border'}`}>
              {isInternal ? 'Interno' : 'Externo'}
            </span>
            <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${EXEC_STATUS_BADGE[execution.status]}`}>
              {EXEC_STATUS_LABELS[execution.status]}
            </span>
          </div>
          {execution.description && (
            <p className="text-xs text-muted-foreground">{execution.description}</p>
          )}
          {execution.concluded_at && (
            <p className="text-xs text-muted-foreground">Concluída {formatRelative(execution.concluded_at)}</p>
          )}

          {/* Serviço externo: responsável interno + contato do prestador */}
          {!isInternal && responsibleName && (
            <p className="text-xs text-muted-foreground">
              Responsável: <span className="text-foreground font-medium">{responsibleName}</span>
            </p>
          )}
          {!isInternal && execution.provider && (() => {
            const wa  = pickContact(execution.provider.contacts ?? [], 'whatsapp')
            const tel = pickContact(execution.provider.contacts ?? [], 'phone')
            if (!wa && !tel) return null
            return (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {wa && (
                  <a
                    href={`https://wa.me/${waNumber(wa)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`WhatsApp de ${execution.provider.name}`}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" aria-hidden="true" />
                    WhatsApp
                  </a>
                )}
                {tel && (
                  <a
                    href={`tel:${tel.replace(/\D/g, '')}`}
                    aria-label={`Telefone de ${execution.provider.name}`}
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border hover:bg-muted/70 transition-colors"
                  >
                    <Phone className="w-3 h-3" aria-hidden="true" />
                    Telefone
                  </a>
                )}
              </div>
            )
          })()}
        </div>

        <div className="text-right shrink-0 space-y-1 min-w-[150px]">
          {hasCost && (
            <>
              <p className="text-xs text-muted-foreground">
                Estimado:{' '}
                <span className="text-foreground font-medium">R$ {execution.cost.toFixed(2).replace('.', ',')}</span>
              </p>
              {execution.cost_approved && execution.approved_cost != null && (
                <p className="text-xs text-muted-foreground">
                  Aprovado:{' '}
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    R$ {Number(execution.approved_cost).toFixed(2).replace('.', ',')}
                  </span>
                </p>
              )}

              {execution.cost_approved ? (
                <p className="text-[11px] text-muted-foreground">
                  Aprovado por {approvedByName ?? '—'}
                  {approvedAtFmt ? ` em ${approvedAtFmt}` : ''}
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
              )}

              {!execution.cost_approved && canApprove && (
                approving ? (
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={approvedStr}
                      onChange={(e) => setApprovedStr(e.target.value)}
                      aria-label="Valor aprovado"
                      className="w-20 h-7 rounded border border-border bg-background px-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      className="text-xs h-7 px-2"
                      disabled={isPending}
                      onClick={() => approveCost({ executionId: execution.id, approvedCost: parseFloat(approvedStr.replace(',', '.')) || 0 })}
                    >
                      {isPending ? '...' : 'Confirmar'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2"
                    onClick={() => setApproving(true)}
                  >
                    Aprovar
                  </Button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Ações — Editar e Excluir (só para quem tem permissão e ticket editável) */}
      {(canEdit || canDelete) && (
        <div className="flex justify-end gap-1.5 mt-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">Remover execução?</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isDeleting}
                onClick={() => deleteExecution(execution.id)}
              >
                {isDeleting ? '...' : 'Sim'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isDeleting}
                onClick={() => setConfirmDelete(false)}
              >
                Não
              </Button>
            </div>
          ) : (
            <>
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  aria-label="Editar execução"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-red-50 hover:text-destructive dark:hover:bg-red-950/30 transition-colors"
                  aria-label="Remover execução"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {editOpen && (
        <AddExecutionModal
          ticketId={ticketId}
          unitId={unitId}
          execution={execution}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HistoryItem
// ─────────────────────────────────────────────────────────────
type RichHistory = MaintenanceStatusHistory & {
  changed_by_user: { name: string } | null
}

function HistoryItem({ item, isLast, people }: { item: RichHistory; isLast: boolean; people: MaintenancePeopleMap }) {
  const StatusIcon = STATUS_ICON[item.to_status] ?? Clock
  const toLabel    = STATUS_LABELS[item.to_status as TicketStatus] ?? item.to_status
  const fromLabel  = item.from_status
    ? (STATUS_LABELS[item.from_status as TicketStatus] ?? item.from_status)
    : null

  // Autor da mudança resolvido pela RPC (Map); embed só como fallback.
  const changedByName = item.changed_by
    ? (people.get(item.changed_by)?.name ?? item.changed_by_user?.name ?? null)
    : null

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <StatusIcon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-border my-1" />}
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {fromLabel ? `${fromLabel} → ` : ''}{toLabel}
        </p>
        {item.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{item.note}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">
          {changedByName ?? 'Sistema'} · {formatRelative(item.created_at)}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ChamadoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { profile } = useAuth()

  const { data: ticket, isLoading, isError, refetch } = useTicket(id)
  // Threshold local maior que o default (12s) — o detalhe inclui nested select pesado
  // (executions + photos + history em uma única query). Em produção lenta, 12s gera
  // falso positivo. P10/Fase 4b: 20s + mensagem suavizada + Tentar novamente que refetch.
  const { isTimedOut } = useLoadingTimeout(isLoading, 20_000)

  // Nomes de usuário (responsável, solicitante, executor interno, aprovador, autor de
  // status) via RPC SECURITY DEFINER — a RLS de public.users só deixa super_admin/diretor
  // verem outros usuários, então os embeds voltam NULL para técnicos. O Map resolve por id.
  const { data: peopleMap } = useMaintenancePeople(ticket?.unit_id ?? null)
  const people: MaintenancePeopleMap = peopleMap ?? new Map()

  const [statusModalOpen, setStatusModalOpen]   = useState(false)
  const [finalizeOpen, setFinalizeOpen]         = useState(false)
  const [addExecOpen, setAddExecOpen]           = useState(false)
  const [lightboxIdx, setLightboxIdx]           = useState<number | null>(null)
  const [isUploading, setIsUploading]           = useState(false)

  const { mutateAsync: uploadPhoto } = useUploadTicketPhoto()

  // Signed URLs for photos
  const photoUrls  = (ticket?.photos ?? []).map((p: MaintenanceTicketPhoto) => p.url)
  const { data: signedUrls = {} } = useSignedUrls('maintenance-photos', photoUrls)

  // ─── Permissions ───
  const canEdit    = !!ticket && ticket.status !== 'concluded' && ticket.status !== 'cancelled'
  const canApprove = hasRole(profile?.role, MAINTENANCE_ADMIN_ROLES)
  const canDelete  = canEdit && hasRole(profile?.role, MAINTENANCE_ADMIN_ROLES)

  // ─── File upload handler ───
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ticket) return
    setIsUploading(true)
    try {
      await uploadPhoto({ file, ticketId: ticket.id, unitId: ticket.unit_id })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Loading states ───
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    )
  }

  if (isError || isTimedOut || !ticket) {
    const isSlow = isTimedOut && !isError
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <AlertTriangle className={`w-8 h-8 mx-auto mb-3 ${isSlow ? 'text-amber-500' : 'text-destructive'}`} />
          <p className="text-sm text-muted-foreground">
            {isSlow
              ? 'Está demorando mais do que o normal — verifique sua conexão e tente novamente.'
              : 'Chamado não encontrado.'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {isSlow && (
              <Button size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              Voltar para Chamados
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const typedTicket  = ticket as MaintenanceTicketWithDetails
  const executions   = typedTicket.executions as RichExecution[]
  const photos       = typedTicket.photos
  const history      = typedTicket.history as RichHistory[]

  const urgency = URGENCY_CONFIG[typedTicket.urgency]
  const nature  = NATURE_CONFIG[typedTicket.nature]
  const status  = STATUS_CONFIG[typedTicket.status]

  const nextStatuses = STATUS_TRANSITIONS[typedTicket.status] ?? []

  // Carimbo "Aberto em": data/hora + nome do solicitante (opened_by), resolvido pela RPC
  // (Map), com o embed só como fallback.
  const openedStamp = (() => {
    const when = formatDate(typedTicket.created_at)
    if (!when) return undefined
    const who = (typedTicket.opened_by ? people.get(typedTicket.opened_by)?.name : null)
      ?? typedTicket.opened_by_user?.name
    return who ? `${when} · por ${who}` : when
  })()

  // Responsável pelo chamado resolvido pela RPC (Map) + fallback no embed.
  const assignedPerson = typedTicket.assigned_to_user_id
    ? {
        id: typedTicket.assigned_to_user_id,
        name: people.get(typedTicket.assigned_to_user_id)?.name
          ?? typedTicket.assigned_to_user?.name
          ?? '—',
        avatar_url: people.get(typedTicket.assigned_to_user_id)?.avatar_url
          ?? typedTicket.assigned_to_user?.avatar_url
          ?? null,
      }
    : null

  // "Concluído por" resolvido pela RPC (Map) + fallback no embed.
  const concludedByName = typedTicket.concluded_by_user_id
    ? (people.get(typedTicket.concluded_by_user_id)?.name ?? typedTicket.concluded_by_user?.name ?? null)
    : null

  return (
    <div className="space-y-5 pb-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para Chamados
      </Button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${urgency?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
              {urgency?.label ?? typedTicket.urgency}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${nature?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
              {nature?.label ?? typedTicket.nature}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${status?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
              {status?.label ?? typedTicket.status}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && nextStatuses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setStatusModalOpen(true)}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Alterar Status
              </Button>
            )}
            {canEdit && (typedTicket.status === 'in_progress' || typedTicket.status === 'waiting_part') && (
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setFinalizeOpen(true)}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Concluir chamado
              </Button>
            )}
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{typedTicket.title}</h1>
        {typedTicket.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{typedTicket.description}</p>
        )}
      </div>

      {/* Info grid */}
      <div className="bg-card border border-border rounded-xl p-5 divide-y divide-border">
        <InfoRow icon={MapPin}   label="Setor"       value={typedTicket.sector?.name} />
        <InfoRow icon={Tag}      label="Categoria"   value={typedTicket.category?.name} />
        <EquipmentRow
          ticketId={typedTicket.id}
          ticketUnitId={typedTicket.unit_id}
          currentEquipment={typedTicket.equipment ?? null}
          canEdit={canEdit}
        />
        <AssigneeRow
          ticketId={typedTicket.id}
          ticketUnitId={typedTicket.unit_id}
          currentAssignee={assignedPerson}
          canEdit={canEdit}
        />
        <InfoRow icon={Calendar} label="Prazo"       value={formatDate(typedTicket.due_at) ?? undefined} />
        <InfoRow icon={Clock}    label="Aberto em"   value={openedStamp} />
        {typedTicket.concluded_at && (
          <InfoRow icon={CheckCircle2} label="Concluído em" value={formatDate(typedTicket.concluded_at) ?? undefined} />
        )}
        {concludedByName && (
          <InfoRow icon={Wrench} label="Concluído por" value={concludedByName} />
        )}
      </div>

      {/* Resolução — o que foi realizado */}
      {typedTicket.resolution_notes && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Resolução</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{typedTicket.resolution_notes}</p>
        </div>
      )}

      {/* Fotos */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Fotos</h2>
          {canEdit && (
            <label className={`cursor-pointer text-xs text-primary hover:underline flex items-center gap-1 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Camera className="w-3.5 h-3.5" />
              {isUploading ? 'Enviando...' : 'Adicionar'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoUpload}
                disabled={isUploading}
              />
            </label>
          )}
        </div>
        {photos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma foto registrada</p>
        ) : (
          <div className="space-y-4">
            {(['abertura', 'conclusao'] as const).map((ph) => {
              const group = photos.filter((p: MaintenanceTicketPhoto) => (p.phase ?? 'abertura') === ph)
              if (group.length === 0) return null
              return (
                <div key={ph} className="space-y-2">
                  <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
                    {ph === 'abertura' ? 'Abertura' : 'Conclusão'}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {group.map((photo: MaintenanceTicketPhoto) => {
                      const idx = photos.findIndex((p: MaintenanceTicketPhoto) => p.id === photo.id)
                      return (
                        <button
                          key={photo.id}
                          onClick={() => setLightboxIdx(idx)}
                          className="aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:opacity-80 transition-opacity"
                        >
                          {signedUrls[photo.url] ? (
                            <img
                              src={signedUrls[photo.url]}
                              alt={photo.caption ?? 'Foto'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Execuções */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Execuções</h2>
          {canEdit && (
            <button
              onClick={() => setAddExecOpen(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          )}
        </div>
        {/* Aviso: nenhuma execução com data agendada → chamado não aparece no calendário */}
        {!executions.some((ex) => ex.scheduled_at) && (
          <div className="mb-3 flex gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />
            <div className="min-w-0">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Este chamado ainda não tem execução agendada. Ele aparecerá no calendário assim que você agendar uma execução (data e executor).
              </p>
              {canEdit && (
                <button
                  onClick={() => setAddExecOpen(true)}
                  className="mt-1.5 text-xs font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  Agendar execução
                </button>
              )}
            </div>
          </div>
        )}

        {executions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma execução registrada</p>
        ) : (
          executions.map((ex) => (
            <ExecutionRow
              key={ex.id}
              execution={ex}
              ticketId={typedTicket.id}
              unitId={typedTicket.unit_id}
              canApprove={canApprove}
              canEdit={canEdit}
              canDelete={canDelete}
              people={people}
            />
          ))
        )}
      </div>

      {/* Histórico de status */}
      {history.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Histórico de Status</h2>
          <div>
            {history.map((h, i) => (
              <HistoryItem key={h.id} item={h} isLast={i === history.length - 1} people={people} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {statusModalOpen && (
        <StatusModal
          ticketId={typedTicket.id}
          currentStatus={typedTicket.status}
          onClose={() => setStatusModalOpen(false)}
        />
      )}

      {addExecOpen && (
        <AddExecutionModal
          ticketId={typedTicket.id}
          unitId={typedTicket.unit_id}
          onClose={() => setAddExecOpen(false)}
        />
      )}

      {finalizeOpen && (
        <FinalizeModal
          ticketId={typedTicket.id}
          unitId={typedTicket.unit_id}
          onClose={() => setFinalizeOpen(false)}
        />
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxIdx(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={signedUrls[photos[lightboxIdx]?.url] ?? ''}
            alt={photos[lightboxIdx]?.caption ?? `Foto ${lightboxIdx + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {photos[lightboxIdx]?.caption && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-3 py-1 rounded whitespace-nowrap">
              {photos[lightboxIdx].caption}
            </p>
          )}
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/40 rounded-full p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + photos.length) % photos.length) }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black/40 rounded-full p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % photos.length) }}
              >
                ›
              </button>
              <p className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/70 text-xs">
                {lightboxIdx + 1} / {photos.length}
              </p>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
