'use client'

import { useState } from 'react'
import { Database, Download, AlertTriangle, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useBackups, requestDownloadUrl, type BackupLogRow } from '@/hooks/use-backups'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function StatusBadge({ status }: { status: BackupLogRow['status'] }) {
  if (status === 'success') {
    return (
      <Badge variant="outline" className="gap-1.5 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950">
        <CheckCircle2 className="size-3" />
        Sucesso
      </Badge>
    )
  }
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="gap-1.5 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950">
        <XCircle className="size-3" />
        Falhou
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1.5 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950">
      <Clock className="size-3" />
      Em progresso
    </Badge>
  )
}

function SourceBadge({ source }: { source: BackupLogRow['source'] }) {
  return (
    <Badge variant="secondary" className="text-xs">
      {source === 'r2_upload' ? 'R2' : 'Local'}
    </Badge>
  )
}

// ── Health Card ───────────────────────────────────────────────────────────────

function HealthCard({ rows }: { rows: BackupLogRow[] }) {
  const lastDaily = rows.find((r) => r.kind === 'daily' && r.source === 'local')
  const lastR2 = rows.find((r) => r.kind === 'daily' && r.source === 'r2_upload')
  const failedCount = rows.filter((r) => r.status === 'failed').length

  const healthOk =
    lastDaily?.status === 'success' && lastR2?.status === 'success' && failedCount === 0

  return (
    <div
      className={`rounded-lg border p-4 ${
        healthOk
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950'
          : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {healthOk ? (
          <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
        ) : (
          <AlertTriangle className="size-5 text-yellow-600 dark:text-yellow-400" />
        )}
        <h2 className="text-sm font-semibold text-foreground">Status do Backup</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Último Backup Local</p>
          {lastDaily ? (
            <div className="space-y-1">
              <p className="font-medium">
                {formatDistanceToNow(new Date(lastDaily.started_at), { addSuffix: true, locale: ptBR })}
              </p>
              <StatusBadge status={lastDaily.status} />
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum registro</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Último Upload R2</p>
          {lastR2 ? (
            <div className="space-y-1">
              <p className="font-medium">
                {formatDistanceToNow(new Date(lastR2.started_at), { addSuffix: true, locale: ptBR })}
              </p>
              <StatusBadge status={lastR2.status} />
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum registro</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Falhas Recentes</p>
          {failedCount > 0 ? (
            <p className="font-semibold text-red-700 dark:text-red-400">{failedCount} falha{failedCount > 1 ? 's' : ''}</p>
          ) : (
            <p className="font-medium text-green-700 dark:text-green-400">Nenhuma</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Backup Table ──────────────────────────────────────────────────────────────

function BackupTable({ rows }: { rows: BackupLogRow[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(row: BackupLogRow) {
    if (downloading) return
    setDownloading(row.id)
    try {
      const url = await requestDownloadUrl(row.id)
      const a = document.createElement('a')
      a.href = url
      a.download = row.filename
      a.click()
    } catch (err: unknown) {
      const e = err as { hint?: string; message?: string; status?: number }
      if (e.status === 503) {
        toast.error('Download indisponível', {
          description:
            'Download disponível apenas em produção. Em ambiente local, use o backup via SSH.',
        })
      } else {
        toast.error('Erro ao gerar URL de download', {
          description: e.hint ?? e.message ?? 'Tente novamente.',
        })
      }
    } finally {
      setDownloading(null)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <Database className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arquivo</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Fonte</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Tamanho</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Iniciado</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={row.filename}>
                {row.filename}
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <SourceBadge source={row.source} />
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                {formatBytes(row.size_bytes)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
                {row.error_message && (
                  <p
                    className="text-xs text-red-600 mt-1 max-w-[200px] truncate"
                    title={row.error_message}
                  >
                    {row.error_message}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                {format(new Date(row.started_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </td>
              <td className="px-4 py-3 text-right">
                {row.source === 'r2_upload' && row.status === 'success' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7"
                    disabled={downloading === row.id}
                    onClick={() => handleDownload(row)}
                  >
                    {downloading === row.id ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Download className="size-3" />
                    )}
                    <span className="hidden sm:inline">Baixar</span>
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BackupsPage() {
  const { data: rows = [], isLoading, isError, refetch } = useBackups()
  const { isTimedOut: timedOut } = useLoadingTimeout(isLoading)

  if (isLoading && !timedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Backups" description="Histórico de backups do banco de dados." />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || timedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Backups" description="Histórico de backups do banco de dados." />
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <AlertTriangle className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Erro ao carregar backups.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const daily = rows.filter((r) => r.kind === 'daily')
  const weekly = rows.filter((r) => r.kind === 'weekly')
  const monthly = rows.filter((r) => r.kind === 'monthly')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backups"
        description="Histórico de backups do banco de dados e uploads para Cloudflare R2."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-2">
            <RefreshCw className="size-4" />
            Atualizar
          </Button>
        }
      />

      <HealthCard rows={rows} />

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">
            Diário
            {daily.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({daily.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="weekly">
            Semanal
            {weekly.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({weekly.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly">
            Mensal
            {monthly.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({monthly.length})</span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          <BackupTable rows={daily} />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <BackupTable rows={weekly} />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <BackupTable rows={monthly} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
