'use client'

import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'
import { usePloomesSyncStatus, type PloomesSyncLog } from '@/hooks/use-ploomes-sync'
import { cn } from '@/lib/utils'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function durationLabel(log: PloomesSyncLog): string {
  if (!log.finished_at) return '—'
  const ms = new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const STATUS_ICON = {
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  error:   <XCircle className="h-3.5 w-3.5 text-red-500" />,
}

const TRIGGER_LABEL = {
  cron:    'Automático',
  manual:  'Manual',
  webhook: 'Webhook',
}

export function SyncHistoryTable() {
  const { data, isLoading } = usePloomesSyncStatus()
  const logs = data?.logs ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Clock className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhuma sincronização registrada ainda.</p>
        <p className="text-xs">Use o botão "Sincronizar Agora" acima para iniciar.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Data/Hora</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium text-right">Encontradas</th>
            <th className="px-4 py-2.5 font-medium text-right">Criadas</th>
            <th className="px-4 py-2.5 font-medium text-right">Atualizadas</th>
            <th className="px-4 py-2.5 font-medium text-right">Erros</th>
            <th className="hidden sm:table-cell px-4 py-2.5 font-medium">Origem</th>
            <th className="hidden sm:table-cell px-4 py-2.5 font-medium text-right">Duração</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr
              key={log.id}
              className={cn(
                'border-b border-border last:border-0 transition-colors hover:bg-muted/20',
                log.status === 'error' && 'bg-destructive/5',
              )}
            >
              <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                {formatDate(log.started_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-1">
                  {STATUS_ICON[log.status]}
                  <span className="text-xs capitalize hidden sm:inline">
                    {log.status === 'running' ? 'Em andamento' : log.status === 'success' ? 'Sucesso' : 'Erro'}
                  </span>
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{log.deals_found}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-green-600">{log.deals_created}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-blue-600">{log.deals_updated}</td>
              <td className={cn('px-4 py-2.5 text-right tabular-nums', log.deals_errors > 0 ? 'text-red-600 font-medium' : '')}>
                {log.deals_errors}
              </td>
              <td className="hidden sm:table-cell px-4 py-2.5 text-xs text-muted-foreground">
                {TRIGGER_LABEL[log.triggered_by]}
              </td>
              <td className="hidden sm:table-cell px-4 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                {durationLabel(log)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
