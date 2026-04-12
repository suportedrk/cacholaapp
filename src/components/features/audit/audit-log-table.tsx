'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/user-avatar'
import { AuditDiff } from './audit-diff'
import { cn } from '@/lib/utils'
import type { AuditLogWithUser } from '@/types/database.types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ── Labels e cores ──────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  events:        'Eventos',
  maintenance:   'Manutenção',
  checklists:    'Checklists',
  users:         'Usuários',
  equipment:     'Equipamentos',
  units:         'Unidades',
  settings:      'Configurações',
  reports:       'Relatórios',
  audit_logs:    'Auditoria',
  notifications: 'Notificações',
}

const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  create:        { label: 'Criação',           className: 'bg-green-100 text-green-800' },
  update:        { label: 'Atualização',        className: 'bg-blue-100 text-blue-800'  },
  delete:        { label: 'Exclusão',           className: 'bg-red-100 text-red-800'    },
  status_change: { label: 'Mudança de Status',  className: 'bg-amber-100 text-amber-800' },
  login:         { label: 'Login',              className: 'badge-gray border'           },
  logout:        { label: 'Logout',             className: 'badge-gray border'           },
  export:        { label: 'Exportação',         className: 'bg-purple-100 text-purple-800' },
}

function actionCfg(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, className: 'bg-muted text-muted-foreground' }
}

// ── Linha expansível ────────────────────────────────────────

function AuditLogRow({ log }: { log: AuditLogWithUser }) {
  const [open, setOpen] = useState(false)
  const { label: actionLabel, className: actionClass } = actionCfg(log.action)
  const hasDetail = log.old_data !== null || log.new_data !== null

  return (
    <>
      <tr
        className={cn(
          'border-b border-border transition-colors',
          hasDetail && 'cursor-pointer hover:bg-muted/40',
          open && 'bg-muted/30'
        )}
        onClick={() => hasDetail && setOpen((v) => !v)}
      >
        {/* Expandir */}
        <td className="w-8 pl-3 pr-0 py-2">
          {hasDetail
            ? open
              ? <ChevronDown className="size-4 text-muted-foreground" />
              : <ChevronRight className="size-4 text-muted-foreground" />
            : <span className="w-4 inline-block" />
          }
        </td>

        {/* Data/Hora */}
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          <div>{format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}</div>
          <div className="font-mono">{format(new Date(log.created_at), "HH:mm:ss")}</div>
        </td>

        {/* Usuário */}
        <td className="px-3 py-2">
          {log.user ? (
            <div className="flex items-center gap-2 min-w-0">
              <UserAvatar
                name={log.user.name}
                avatarUrl={log.user.avatar_url}
                size="sm"
              />
              <span className="text-sm truncate max-w-[120px]">{log.user.name}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sistema</span>
          )}
        </td>

        {/* Módulo */}
        <td className="px-3 py-2 text-sm">
          <span className="text-foreground/80">
            {MODULE_LABELS[log.module] ?? log.module}
          </span>
        </td>

        {/* Ação */}
        <td className="px-3 py-2">
          <span className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
            actionClass
          )}>
            {actionLabel}
          </span>
        </td>

        {/* Entidade */}
        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
          <div>{log.entity_type}</div>
          {log.entity_id && (
            <div className="truncate max-w-[80px]" title={log.entity_id}>
              {log.entity_id.slice(0, 8)}…
            </div>
          )}
        </td>

        {/* IP */}
        <td className="px-3 py-2 text-xs text-muted-foreground font-mono hidden lg:table-cell">
          {log.ip ?? '—'}
        </td>
      </tr>

      {/* Linha de diff expandida */}
      {open && hasDetail && (
        <tr className="border-b border-border bg-muted/10">
          <td colSpan={7} className="px-6 py-3">
            <AuditDiff
              oldData={log.old_data}
              newData={log.new_data}
              action={log.action}
            />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Skeleton de carregamento ────────────────────────────────

function AuditLogRowSkeleton() {
  return (
    <tr className="border-b border-border">
      {[8, 80, 130, 90, 70, 70, 60].map((w, i) => (
        <td key={i} className="px-3 py-3">
          <div className={`h-3 bg-muted animate-pulse rounded`} style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

// ── Tabela principal ─────────────────────────────────────────

interface AuditLogTableProps {
  logs: AuditLogWithUser[]
  isLoading: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  onLoadMore: () => void
}

export function AuditLogTable({
  logs,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
}: AuditLogTableProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="w-8 pl-3" />
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Data/Hora</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Usuário</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Módulo</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Ação</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Entidade</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <AuditLogRowSkeleton key={i} />)
              : logs.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                      Nenhum log encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )
                : logs.map((log) => <AuditLogRow key={log.id} log={log} />)
            }
          </tbody>
        </table>
      </div>

      {/* Rodapé: contagem + load more */}
      {!isLoading && logs.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {logs.length} {logs.length === 1 ? 'registro' : 'registros'} exibidos
            {hasNextPage && ' · há mais registros'}
          </span>
          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isFetchingNextPage}
              className="gap-2"
            >
              {isFetchingNextPage && <Loader2 className="size-3 animate-spin" />}
              Carregar mais
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
