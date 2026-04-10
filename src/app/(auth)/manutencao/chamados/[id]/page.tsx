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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useTicket,
  useUpdateTicketStatus,
  useAddExecution,
  useUploadTicketPhoto,
  useApproveCost,
} from '@/hooks/use-tickets'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useProviders } from '@/hooks/use-providers'
import { useUnitUsers } from '@/hooks/use-units'
import { useUnitStore } from '@/stores/unit-store'
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

const STATUS_TRANSITIONS: Record<string, TicketStatus[]> = {
  open:         ['in_progress', 'cancelled'],
  in_progress:  ['waiting_part', 'concluded', 'cancelled'],
  waiting_part: ['in_progress', 'concluded', 'cancelled'],
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

const MANAGER_ROLES = ['super_admin', 'diretor', 'gerente']

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
}: {
  ticketId: string
  unitId: string
  onClose: () => void
}) {
  const [type, setType] = useState<'internal' | 'external'>('internal')
  const [userId, setUserId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [description, setDescription] = useState('')
  const [costStr, setCostStr] = useState('')
  const [execStatus, setExecStatus] = useState<ExecutionStatus>('assigned')

  const { data: unitUsers = [] } = useUnitUsers(unitId)
  const { data: providers = [] } = useProviders({ status: 'active' })
  const { mutate: addExecution, isPending } = useAddExecution(onClose)

  function handleSave() {
    addExecution({
      ticket_id:        ticketId,
      executor_type:    type,
      internal_user_id: type === 'internal' ? userId || null : null,
      provider_id:      type === 'external' ? providerId || null : null,
      description:      description.trim() || null,
      cost:             parseFloat(costStr.replace(',', '.')) || 0,
      status:           execStatus,
    } as Parameters<typeof addExecution>[0])
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Adicionar Execução</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tipo toggle */}
        <div className="flex gap-2">
          {(['internal', 'external'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
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
              onChange={(e) => setUserId(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {unitUsers.map((u) => (
                <option key={u.user.id} value={u.user.id}>{u.user.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prestador</label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
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

        {/* Custo */}
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

        <div className="flex gap-2">
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
// ExecutionRow
// ─────────────────────────────────────────────────────────────
type RichExecution = MaintenanceExecution & {
  internal_user: { id: string; name: string; avatar_url: string | null } | null
  provider: { id: string; name: string } | null
}

function ExecutionRow({
  execution,
  ticketId,
  canApprove,
}: {
  execution: RichExecution
  ticketId: string
  canApprove: boolean
}) {
  const { mutate: approveCost, isPending } = useApproveCost(ticketId)

  const executorName = execution.internal_user?.name ?? execution.provider?.name ?? 'Não atribuído'
  const isInternal   = execution.executor_type === 'internal'
  const hasCost      = execution.cost > 0

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
        </div>

        <div className="text-right shrink-0 space-y-1">
          {hasCost && (
            <p className="text-sm font-semibold">
              R$ {execution.cost.toFixed(2).replace('.', ',')}
            </p>
          )}
          {hasCost && (
            execution.cost_approved ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Aprovado</p>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">Pendente</p>
            )
          )}
          {hasCost && !execution.cost_approved && canApprove && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-2"
              disabled={isPending}
              onClick={() => approveCost(execution.id)}
            >
              {isPending ? '...' : 'Aprovar'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HistoryItem
// ─────────────────────────────────────────────────────────────
type RichHistory = MaintenanceStatusHistory & {
  changed_by_user: { name: string } | null
}

function HistoryItem({ item, isLast }: { item: RichHistory; isLast: boolean }) {
  const StatusIcon = STATUS_ICON[item.to_status] ?? Clock
  const toLabel    = STATUS_LABELS[item.to_status as TicketStatus] ?? item.to_status
  const fromLabel  = item.from_status
    ? (STATUS_LABELS[item.from_status as TicketStatus] ?? item.from_status)
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
          {item.changed_by_user?.name ?? 'Sistema'} · {formatRelative(item.created_at)}
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
  const { activeUnitId } = useUnitStore()

  const { data: ticket, isLoading, isError } = useTicket(id)
  const { isTimedOut } = useLoadingTimeout(isLoading)

  const [statusModalOpen, setStatusModalOpen]   = useState(false)
  const [addExecOpen, setAddExecOpen]           = useState(false)
  const [lightboxIdx, setLightboxIdx]           = useState<number | null>(null)
  const [isUploading, setIsUploading]           = useState(false)

  const { mutateAsync: uploadPhoto } = useUploadTicketPhoto()

  // Signed URLs for photos
  const photoUrls  = (ticket?.photos ?? []).map((p: MaintenanceTicketPhoto) => p.url)
  const { data: signedUrls = {} } = useSignedUrls('maintenance-photos', photoUrls)

  // ─── Permissions ───
  const canEdit    = !!ticket && ticket.status !== 'concluded' && ticket.status !== 'cancelled'
  const canApprove = MANAGER_ROLES.includes(profile?.role ?? '')

  // ─── File upload handler ───
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ticket || !activeUnitId) return
    setIsUploading(true)
    try {
      await uploadPhoto({ file, ticketId: ticket.id, unitId: activeUnitId })
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
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isTimedOut ? 'Tempo esgotado ao carregar o chamado.' : 'Chamado não encontrado.'}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>
            Voltar para Chamados
          </Button>
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
          {canEdit && nextStatuses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 shrink-0"
              onClick={() => setStatusModalOpen(true)}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Alterar Status
            </Button>
          )}
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
        <InfoRow icon={Wrench}   label="Item/Local"  value={typedTicket.item?.name} />

        <InfoRow icon={Calendar} label="Prazo"       value={formatDate(typedTicket.due_at) ?? undefined} />
        <InfoRow icon={Clock}    label="Aberto em"   value={formatDate(typedTicket.created_at) ?? undefined} />
        {typedTicket.concluded_at && (
          <InfoRow icon={CheckCircle2} label="Concluído em" value={formatDate(typedTicket.concluded_at) ?? undefined} />
        )}
      </div>

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
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo: MaintenanceTicketPhoto, i: number) => (
              <button
                key={photo.id}
                onClick={() => setLightboxIdx(i)}
                className="aspect-square rounded-lg overflow-hidden border border-border bg-muted hover:opacity-80 transition-opacity"
              >
                {signedUrls[photo.url] ? (
                  <img
                    src={signedUrls[photo.url]}
                    alt={photo.caption ?? `Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
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
        {executions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma execução registrada</p>
        ) : (
          executions.map((ex) => (
            <ExecutionRow
              key={ex.id}
              execution={ex}
              ticketId={typedTicket.id}
              canApprove={canApprove}
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
              <HistoryItem key={h.id} item={h} isLast={i === history.length - 1} />
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

      {addExecOpen && activeUnitId && (
        <AddExecutionModal
          ticketId={typedTicket.id}
          unitId={activeUnitId}
          onClose={() => setAddExecOpen(false)}
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
