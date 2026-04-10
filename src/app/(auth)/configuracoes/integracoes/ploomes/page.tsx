'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow, format, parseISO, addMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Webhook,
  Clock,
  ExternalLink,
  MapPin,
  Loader2,
  Activity,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { useAuth } from '@/hooks/use-auth'
import {
  useSyncLogs,
  useWebhookLogs,
  useWebhookStats,
  usePloomesConfig,
  useTriggerSync,
  useRegisterWebhook,
} from '@/hooks/use-ploomes-integration'
import type { PloomesSyncLog, PloomesWebhookLog } from '@/types/database.types'

// ── Helpers ───────────────────────────────────────────────────

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: ptBR })
  } catch {
    return iso
  }
}

function formatMs(ms: number | null) {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function durationBetween(started: string, finished: string | null) {
  if (!finished) return '—'
  try {
    const ms = parseISO(finished).getTime() - parseISO(started).getTime()
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(0)}s`
  } catch {
    return '—'
  }
}

// ── Badges ────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: PloomesSyncLog['status'] }) {
  if (status === 'success') return (
    <span className="badge-green border text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
      <CheckCircle2 className="h-3 w-3" /> Sucesso
    </span>
  )
  if (status === 'error') return (
    <span className="badge-red border text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
      <XCircle className="h-3 w-3" /> Erro
    </span>
  )
  return (
    <span className="badge-amber border text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" /> Executando
    </span>
  )
}

function WebhookStatusBadge({ status }: { status: PloomesWebhookLog['status'] }) {
  const map = {
    success:    { cls: 'badge-green',  label: 'Sucesso' },
    error:      { cls: 'badge-red',    label: 'Erro' },
    skipped:    { cls: 'badge-gray',   label: 'Ignorado' },
    processing: { cls: 'badge-amber',  label: 'Processando' },
    received:   { cls: 'badge-gray',   label: 'Recebido' },
  } as const
  const { cls, label } = map[status] ?? map.received
  return (
    <span className={`${cls} border text-xs px-2 py-0.5 rounded-full`}>{label}</span>
  )
}

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-muted-foreground text-xs">—</span>
  const isWin = action === 'Win'
  return (
    <span className={`border text-xs px-2 py-0.5 rounded-full ${isWin ? 'badge-green' : 'badge-blue'}`}>
      {action}
    </span>
  )
}

// ── Seção 1: Webhook Status ───────────────────────────────────

function WebhookStatusCard() {
  const { profile } = useAuth()
  const isSuperAdmin = profile?.role === 'super_admin'

  const { data: config } = usePloomesConfig()
  const { data: webhookLogs, isLoading: logsLoading } = useWebhookLogs()
  const stats = useWebhookStats(webhookLogs)
  const { mutate: registerWebhook, isPending: registering } = useRegisterWebhook()

  const isRegistered = !!config?.webhook_registered_at
  const lastWebhook = webhookLogs?.[0]
  // eslint-disable-next-line react-hooks/purity
  const nowTs = Date.now()
  const hasRecentActivity = !!lastWebhook &&
    (nowTs - parseISO(lastWebhook.received_at).getTime()) < 24 * 60 * 60 * 1000
  const hasErrors = stats.error > 0

  // Determinar status visual do webhook
  let statusIcon = <XCircle className="h-5 w-5 text-muted-foreground" />
  let statusLabel = 'Não registrado'
  let statusClass = 'text-muted-foreground'

  if (isRegistered && hasRecentActivity && !hasErrors) {
    statusIcon = <CheckCircle2 className="h-5 w-5 text-green-600" />
    statusLabel = 'Registrado e ativo'
    statusClass = 'text-green-700 dark:text-green-400'
  } else if (isRegistered && hasErrors) {
    statusIcon = <AlertTriangle className="h-5 w-5 text-amber-500" />
    statusLabel = 'Registrado — com erros'
    statusClass = 'text-amber-700 dark:text-amber-400'
  } else if (isRegistered) {
    statusIcon = <AlertTriangle className="h-5 w-5 text-amber-400" />
    statusLabel = 'Registrado — sem atividade recente'
    statusClass = 'text-amber-600 dark:text-amber-400'
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-brand rounded-lg p-2">
            <Webhook className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Webhook</h2>
            <p className="text-xs text-muted-foreground">Recepção em tempo real de eventos do Ploomes</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${statusClass}`}>
          {statusIcon}
          <span className="hidden sm:inline">{statusLabel}</span>
        </div>
      </div>

      {/* Métricas 24h */}
      {logsLoading ? (
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Recebidos', value: stats.total, cls: '' },
            { label: 'Processados', value: stats.success, cls: 'text-green-600 dark:text-green-400' },
            { label: 'Erros', value: stats.error, cls: stats.error > 0 ? 'text-red-600 dark:text-red-400' : '' },
            { label: 'Ignorados', value: stats.skipped, cls: 'text-muted-foreground' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-secondary p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label} (24h)</p>
            </div>
          ))}
        </div>
      )}

      {/* Último webhook recebido */}
      {lastWebhook && (
        <div className="rounded-lg border border-border bg-surface-secondary p-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted-foreground text-xs">Último webhook:</span>
          <span className="font-medium">{relativeTime(lastWebhook.received_at)}</span>
          {lastWebhook.deal_id && (
            <a
              href={`https://app10.ploomes.com/deal/${lastWebhook.deal_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline flex items-center gap-0.5 text-xs"
            >
              Deal #{lastWebhook.deal_id} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <ActionBadge action={lastWebhook.action} />
          <WebhookStatusBadge status={lastWebhook.status} />
          {lastWebhook.processing_ms !== null && (
            <span className="text-xs text-muted-foreground">{formatMs(lastWebhook.processing_ms)}</span>
          )}
        </div>
      )}

      {!lastWebhook && !logsLoading && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Nenhum webhook recebido ainda.
        </p>
      )}

      {/* Ações */}
      {isSuperAdmin && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => registerWebhook()}
            disabled={registering}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {registering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {isRegistered ? 'Re-registrar Webhook' : 'Registrar Webhook no Ploomes'}
          </button>
          {config?.webhook_registered_at && (
            <p className="text-xs text-muted-foreground self-center">
              Registrado em {format(parseISO(config.webhook_registered_at), "dd/MM/yyyy 'às' HH:mm")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Seção 2: Sync (Cron) Status ───────────────────────────────

function SyncStatusSection() {
  const { data: logs, isLoading } = useSyncLogs()
  const { mutate: triggerSync, isPending: syncing } = useTriggerSync()

  const lastSync = logs?.[0]
  const nextSyncAt = lastSync?.started_at
    ? addMinutes(parseISO(lastSync.started_at), 15)
    : null
  // eslint-disable-next-line react-hooks/purity
  const syncNowTs = Date.now()
  const minutesUntilNext = nextSyncAt
    ? Math.max(0, Math.round((nextSyncAt.getTime() - syncNowTs) / 60_000))
    : null

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-brand rounded-lg p-2">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Sincronização Automática (Cron)</h2>
            <p className="text-xs text-muted-foreground">Atualização completa a cada 15 minutos</p>
          </div>
        </div>
        {lastSync && <SyncStatusBadge status={lastSync.status} />}
      </div>

      {/* Último sync + próximo */}
      {isLoading ? (
        <div className="skeleton-shimmer h-16 rounded-lg" />
      ) : lastSync ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <p className="text-xs text-muted-foreground">Último sync</p>
            <p className="text-sm font-medium mt-0.5">{relativeTime(lastSync.started_at)}</p>
            <p className="text-xs text-muted-foreground">{durationBetween(lastSync.started_at, lastSync.finished_at)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <p className="text-xs text-muted-foreground">Resultado</p>
            <p className="text-sm font-medium mt-0.5 tabular-nums">
              {lastSync.deals_found} encontrados
            </p>
            <p className="text-xs text-muted-foreground">
              {lastSync.deals_created} criados · {lastSync.deals_updated} atualizados
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Próximo sync
            </p>
            <p className="text-sm font-medium mt-0.5">
              {minutesUntilNext !== null
                ? minutesUntilNext === 0 ? 'Agora' : `em ~${minutesUntilNext} min`
                : '—'}
            </p>
            {nextSyncAt && (
              <p className="text-xs text-muted-foreground">
                {format(nextSyncAt, 'HH:mm')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">Nenhum sync registrado ainda.</p>
      )}

      {lastSync?.error_message && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-400">
          <p className="font-medium">Erro no último sync:</p>
          <p className="text-xs mt-0.5 font-mono break-all">{lastSync.error_message}</p>
        </div>
      )}

      {/* Botão forçar sync */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => triggerSync()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando…' : 'Forçar Sync Agora'}
        </button>
      </div>

      {/* Histórico compacto: últimos 5 */}
      {logs && logs.length > 1 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Iniciado</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Duração</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Encontrados</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Criados</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.slice(0, 5).map((log) => (
                  <tr key={log.id} className="hover:bg-surface-secondary/50">
                    <td className="px-3 py-2 text-muted-foreground">{relativeTime(log.started_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {durationBetween(log.started_at, log.finished_at)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{log.deals_found ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{log.deals_created ?? 0}</td>
                    <td className="px-3 py-2"><SyncStatusBadge status={log.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Seção 3: Log de Webhooks ──────────────────────────────────

function WebhookLogSection() {
  const { data: logs, isLoading } = useWebhookLogs()

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="icon-brand rounded-lg p-2">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">Log de Webhooks Recebidos</h2>
          <p className="text-xs text-muted-foreground">Últimos 20 eventos</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-shimmer h-10 rounded-lg" />
          ))}
        </div>
      ) : !logs || logs.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Webhook className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum webhook recebido ainda</p>
          <p className="text-xs text-muted-foreground">
            Registre o webhook no Ploomes para começar a receber eventos em tempo real.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Recebido</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Deal</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Ação</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-right px-3 py-2 text-muted-foreground font-medium">Tempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <WebhookLogRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function WebhookLogRow({ log }: { log: PloomesWebhookLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-surface-secondary/50 cursor-pointer"
        onClick={() => log.status === 'error' && setExpanded((v) => !v)}
      >
        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
          {relativeTime(log.received_at)}
        </td>
        <td className="px-3 py-2.5">
          {log.deal_id ? (
            <a
              href={`https://app10.ploomes.com/deal/${log.deal_id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline flex items-center gap-0.5"
            >
              #{log.deal_id} <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <ActionBadge action={log.action} />
        </td>
        <td className="px-3 py-2.5">
          <WebhookStatusBadge status={log.status} />
        </td>
        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
          {formatMs(log.processing_ms)}
        </td>
      </tr>
      {expanded && log.error_message && (
        <tr>
          <td colSpan={5} className="px-3 py-2 bg-red-50 dark:bg-red-950/20">
            <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">
              {log.error_message}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Seção 4: Saúde da Integração ─────────────────────────────

function IntegrationHealthCard() {
  const { data: logs } = useSyncLogs()
  const lastSync = logs?.[0]

  const dealsFound = lastSync?.deals_found ?? null
  const dealsCreated = lastSync?.deals_created ?? 0
  const dealsUpdated = lastSync?.deals_updated ?? 0
  const dealsLost = lastSync?.deals_removed ?? 0

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-brand rounded-lg p-2">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Saúde da Integração</h2>
            <p className="text-xs text-muted-foreground">Baseado no último sync completo</p>
          </div>
        </div>
        <Link
          href="/configuracoes/integracoes/ploomes/mapeamento"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MapPin className="h-3 w-3" />
          Ver mapeamento
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {dealsFound !== null ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total no Ploomes', value: dealsFound, cls: '' },
            { label: 'Importados', value: dealsCreated + dealsUpdated, cls: 'text-green-600 dark:text-green-400' },
            { label: 'Atualizados', value: dealsUpdated, cls: '' },
            { label: 'Perdidos', value: dealsLost, cls: dealsLost > 0 ? 'text-muted-foreground' : '' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border border-border bg-surface-secondary p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Execute um sync para ver os dados de saúde.
        </p>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function PloomesIntegrationPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Integração Ploomes CRM"
        description="Monitoramento do sistema híbrido: webhook em tempo real + cron a cada 15 minutos."
        actions={
          <Link
            href="/configuracoes/integracoes/ploomes/mapeamento"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <MapPin className="h-3.5 w-3.5" />
            Mapeamento de Campos
          </Link>
        }
      />

      <WebhookStatusCard />
      <SyncStatusSection />
      <WebhookLogSection />
      <IntegrationHealthCard />
    </div>
  )
}
