'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, AlertTriangle, Wrench, User, Calendar, MapPin, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTicket } from '@/hooks/use-tickets'
import { URGENCY_CONFIG, NATURE_CONFIG, STATUS_CONFIG } from '@/components/features/maintenance/ticket-card'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

export default function ChamadoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: ticket, isLoading, isError } = useTicket(id)
  const { isTimedOut } = useLoadingTimeout(isLoading)

  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-40 bg-muted rounded-xl" />
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

  const urgency = URGENCY_CONFIG[ticket.urgency]
  const nature  = NATURE_CONFIG[ticket.nature]
  const status  = STATUS_CONFIG[ticket.status]

  const formatDate = (d?: string | null) =>
    d ? format(parseISO(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : null

  return (
    <div className="space-y-5 pb-8">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar para Chamados
      </Button>

      {/* Header card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${urgency?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
            {urgency?.label ?? ticket.urgency}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${nature?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
            {nature?.label ?? ticket.nature}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${status?.badge ?? 'bg-muted text-muted-foreground border border-border'}`}>
            {status?.label ?? ticket.status}
          </span>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{ticket.title}</h1>
        {ticket.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{ticket.description}</p>
        )}
      </div>

      {/* Info grid */}
      <div className="bg-card border border-border rounded-xl p-5 divide-y divide-border">
        <InfoRow icon={MapPin}   label="Setor"        value={(ticket as any).sector?.name} />
        <InfoRow icon={Tag}      label="Categoria"    value={(ticket as any).category?.name} />
        <InfoRow icon={Wrench}   label="Item/Local"   value={(ticket as any).item?.name} />
        <InfoRow icon={User}     label="Responsável"  value={(ticket as any).assigned_to ?? undefined} />
        <InfoRow icon={Calendar} label="Prazo"        value={formatDate(ticket.due_at) ?? undefined} />
        <InfoRow icon={Clock}    label="Aberto em"    value={formatDate(ticket.created_at) ?? undefined} />
        {ticket.concluded_at && (
          <InfoRow icon={Clock} label="Concluído em" value={formatDate(ticket.concluded_at) ?? undefined} />
        )}
      </div>

      {/* Executions */}
      {Array.isArray((ticket as any).executions) && (ticket as any).executions.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Execuções</h2>
          <div className="space-y-0">
            {((ticket as any).executions as Array<{
              id: string
              description?: string | null
              cost: number
              cost_approved: boolean
              status: string
              concluded_at?: string | null
            }>).map((ex) => (
              <div key={ex.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{ex.description ?? 'Sem descrição'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ex.status === 'concluded' ? 'Concluída' : ex.status === 'in_progress' ? 'Em andamento' : 'Atribuída'}
                    {ex.concluded_at && ` · ${formatDate(ex.concluded_at)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">
                    {ex.cost > 0 ? `R$ ${ex.cost.toFixed(2).replace('.', ',')}` : '—'}
                  </p>
                  {ex.cost > 0 && (
                    <p className={`text-xs ${ex.cost_approved ? 'text-green-600' : 'text-amber-600'}`}>
                      {ex.cost_approved ? 'Aprovado' : 'Pendente'}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status history */}
      {Array.isArray((ticket as any).history) && (ticket as any).history.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">Histórico de status</h2>
          <div className="space-y-0">
            {((ticket as any).history as Array<{
              id: string
              from_status?: string | null
              to_status: string
              note?: string | null
              created_at: string
            }>).map((h, i, arr) => {
              const toStatus = STATUS_CONFIG[h.to_status as keyof typeof STATUS_CONFIG]
              return (
                <div key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 border-2 ${toStatus ? 'border-primary bg-primary/20' : 'border-border bg-muted'}`} />
                    {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-border my-1" />}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {h.from_status
                        ? `${STATUS_CONFIG[h.from_status as keyof typeof STATUS_CONFIG]?.label ?? h.from_status} → `
                        : ''}
                      {toStatus?.label ?? h.to_status}
                    </p>
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(h.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
