'use client'

import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock, Wifi } from 'lucide-react'
import { usePloomesSyncStatus, useTriggerPloomesSync } from '@/hooks/use-ploomes-sync'
import { cn } from '@/lib/utils'

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'agora mesmo'
  if (mins < 60) return `há ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `há ${hrs}h`
  return `há ${Math.floor(hrs / 24)}d`
}

export function SyncStatusCard() {
  const { data, isLoading } = usePloomesSyncStatus()
  const trigger = useTriggerPloomesSync()

  const latest = data?.latest
  const isRunning = data?.isRunning ?? false
  const isPending = trigger.isPending

  const statusConfig = {
    running: { icon: <Loader2 className="h-4 w-4 animate-spin text-amber-500" />, label: 'Sincronizando…', color: 'text-amber-600' },
    success: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, label: 'Conectado', color: 'text-green-600' },
    error:   { icon: <XCircle className="h-4 w-4 text-red-500" />, label: 'Erro na última sync', color: 'text-red-600' },
  }

  const cfg = latest ? statusConfig[latest.status] : null

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Ploomes CRM</h3>
            {cfg && (
              <span className={cn('flex items-center gap-1 text-xs font-medium', cfg.color)}>
                {cfg.icon}
                {cfg.label}
              </span>
            )}
            {!latest && !isLoading && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Nunca sincronizado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pipeline: Cachola Festas Fechadas
          </p>
        </div>

        <button
          onClick={() => trigger.mutate({})}
          disabled={isRunning || isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <RefreshCw className={cn('h-3 w-3', (isRunning || isPending) && 'animate-spin')} />
          {isRunning || isPending ? 'Sincronizando…' : 'Sincronizar Agora'}
        </button>
      </div>

      {/* Última sync */}
      {latest && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
          {[
            { label: 'Encontradas', value: latest.deals_found },
            { label: 'Criadas', value: latest.deals_created, color: 'text-green-600' },
            { label: 'Atualizadas', value: latest.deals_updated, color: 'text-blue-600' },
            { label: 'Erros', value: latest.deals_errors, color: latest.deals_errors > 0 ? 'text-red-600' : undefined },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-muted/40 p-2">
              <p className={cn('text-lg font-bold tabular-nums', color ?? 'text-foreground')}>{value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Timestamp */}
      {latest?.started_at && (
        <p className="text-[11px] text-muted-foreground">
          Última sync {formatRelativeTime(latest.started_at)}
          {latest.triggered_by === 'manual' ? ' (manual)' : latest.triggered_by === 'webhook' ? ' (webhook)' : ' (automática)'}
        </p>
      )}

      {/* Erro */}
      {latest?.status === 'error' && latest.error_message && (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {latest.error_message}
        </div>
      )}
    </div>
  )
}
