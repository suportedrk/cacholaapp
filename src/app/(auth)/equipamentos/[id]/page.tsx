'use client'

import { use } from 'react'
import Link from 'next/link'
import { format, parseISO, isFuture, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Pencil, MapPin, Tag, Hash, Calendar, Plus,
  ShieldCheck, ShieldAlert, Wrench, Package,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEquipmentItem, useEquipmentMaintenanceHistory } from '@/hooks/use-equipment'
import { useSignedUrls } from '@/hooks/use-signed-urls'

// ── Labels ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active:   { label: 'Ativo',      className: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inativo',    className: 'badge-gray border' },
  in_repair:{ label: 'Em Reparo',  className: 'bg-amber-100 text-amber-700' },
  retired:  { label: 'Aposentado', className: 'bg-red-100 text-red-700' },
}

const MAINT_STATUS: Record<string, { label: string; className: string }> = {
  open:          { label: 'Aberta',          className: 'bg-blue-100 text-blue-700' },
  in_progress:   { label: 'Em Andamento',    className: 'bg-purple-100 text-purple-700' },
  waiting_part:  { label: 'Aguard. Peça',    className: 'bg-amber-100 text-amber-700' },
  concluded:     { label: 'Concluído',        className: 'bg-green-100 text-green-700' },
  cancelled:     { label: 'Cancelado',        className: 'badge-gray border' },
}

const MAINT_NATURE: Record<string, string> = {
  emergencial: '🔴 Emergencial',
  pontual:     '🟡 Pontual',
  agendado:    '📅 Agendado',
  preventivo:  '🔧 Preventivo',
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export default function EquipamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: equipment, isLoading, error } = useEquipmentItem(id)
  const { data: history = [], isLoading: historyLoading } = useEquipmentMaintenanceHistory(id)

  const photoPath = equipment?.photo_url ? [equipment.photo_url] : []
  const { data: signedUrls = {} } = useSignedUrls('equipment-photos', photoPath)
  const photoSrc = equipment?.photo_url ? signedUrls[equipment.photo_url] : null

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-64 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    )
  }

  if (error || !equipment) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center py-20 text-center">
        <Package className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Equipamento não encontrado.</p>
        <Link href="/equipamentos" className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />Voltar
        </Link>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[equipment.status]
  const inWarranty = equipment.warranty_until && isFuture(parseISO(equipment.warranty_until))
  const warrantyExpired = equipment.warranty_until && isPast(parseISO(equipment.warranty_until))
  const openMaint = history.filter((m) => {
    const s = (m as { status: string }).status
    return s !== 'concluded' && s !== 'cancelled'
  }).length

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">{equipment.name}</h1>
          {equipment.category && (
            <p className="text-sm text-muted-foreground">{equipment.category}</p>
          )}
        </div>
        <Link href={`/equipamentos/${id}/editar`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Editar
        </Link>
      </div>

      {/* Card de detalhes */}
      <div className="rounded-xl border bg-card p-5 space-y-5">

        {/* Foto */}
        {photoSrc && (
          <div className="w-full max-w-xs mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={equipment.name}
              className="w-full rounded-xl object-cover border"
              style={{ maxHeight: 240 }}
            />
          </div>
        )}

        {/* Badges de status */}
        <div className="flex flex-wrap gap-2">
          <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', statusCfg.className)}>
            {statusCfg.label}
          </span>
          {inWarranty && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              <ShieldCheck className="w-3.5 h-3.5" />
              Em garantia
            </span>
          )}
          {warrantyExpired && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
              <ShieldAlert className="w-3.5 h-3.5" />
              Garantia expirada
            </span>
          )}
          {openMaint > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <Wrench className="w-3.5 h-3.5" />
              {openMaint} OS em aberto
            </span>
          )}
        </div>

        {/* Grid de informações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {equipment.location && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Localização</p>
                <p className="font-medium text-foreground">{equipment.location}</p>
              </div>
            </div>
          )}

          {equipment.category && (
            <div className="flex items-start gap-2">
              <Tag className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Categoria</p>
                <p className="font-medium text-foreground">{equipment.category}</p>
              </div>
            </div>
          )}

          {equipment.serial_number && (
            <div className="flex items-start gap-2">
              <Hash className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Número de Série</p>
                <p className="font-medium text-foreground">{equipment.serial_number}</p>
              </div>
            </div>
          )}

          {equipment.purchase_date && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Data de Compra</p>
                <p className="font-medium text-foreground">
                  {format(parseISO(equipment.purchase_date), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          )}

          {equipment.warranty_until && (
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Garantia até</p>
                <p className={cn(
                  'font-medium',
                  inWarranty ? 'text-blue-700' : 'text-muted-foreground line-through'
                )}>
                  {format(parseISO(equipment.warranty_until), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Notas */}
        {equipment.notes && (
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground whitespace-pre-line">{equipment.notes}</p>
          </div>
        )}
      </div>

      {/* Histórico de manutenções */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Histórico de Manutenções ({history.length})
          </h2>
          <Link href={`/manutencao/chamados?equipment_id=${id}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova OS
          </Link>
        </div>

        {historyLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhuma ordem de manutenção para este equipamento
          </div>
        ) : (
          <div className="divide-y">
            {history.map((m) => {
              const mo = m as unknown as {
                id: string; title: string; nature: string;
                urgency: string; status: string;
                created_at: string; due_at: string | null;
                sector: { name: string } | null;
                opened_by_user: { name: string } | null;
              }
              const mStatus = MAINT_STATUS[mo.status] ?? { label: mo.status, className: 'bg-muted' }
              return (
                <Link
                  key={mo.id}
                  href={`/manutencao/chamados/${mo.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground truncate">{mo.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {MAINT_NATURE[mo.nature] ?? mo.nature}
                      </span>
                      {mo.sector?.name && (
                        <span className="text-xs text-muted-foreground">• {mo.sector.name}</span>
                      )}
                      {mo.opened_by_user?.name && (
                        <span className="text-xs text-muted-foreground">• {mo.opened_by_user.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', mStatus.className)}>
                      {mStatus.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(mo.created_at), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

