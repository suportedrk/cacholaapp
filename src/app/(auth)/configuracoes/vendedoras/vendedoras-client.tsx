// TODO Fase futura: coluna "Usuário vinculado" na listagem de vendedoras,
// com ação de desvincular/revincular (JOIN users.seller_id = sellers.id).

'use client'

import { useState } from 'react'
import { Pencil, RefreshCw, AlertCircle, Users, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useSellers } from '@/hooks/use-sellers'
import { useUnits } from '@/hooks/use-units'
import { useAuth } from '@/hooks/use-auth'
import { SellerEditSheet } from './seller-edit-sheet'
import type { Seller } from '@/types/seller'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { hasRole, TEMPLATE_MANAGE_ROLES, SELLERS_MANAGE_ROLES } from '@/config/roles'

type FilterKey = 'all' | 'active' | 'inactive' | 'system'

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Todas',
  active: 'Ativas',
  inactive: 'Inativas',
  system: 'Sistema',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function VendedorasClient() {
  const { realProfile } = useAuth()
  const isSuperAdmin = hasRole(realProfile?.role, TEMPLATE_MANAGE_ROLES)
  const canSyncSellers = hasRole(realProfile?.role, SELLERS_MANAGE_ROLES)

  const { data: sellers = [], isLoading, isError } = useSellers()
  const { data: units = [] } = useUnits()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const [filter, setFilter] = useState<FilterKey>('all')
  const [editSeller, setEditSeller] = useState<Seller | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const queryClient = useQueryClient()

  async function handleSync() {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/ploomes/sync-sellers', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Erro desconhecido.')
      const { created, updated } = body.result as { created: number; updated: number }
      toast.success(
        `${created} nova(s) vendedora(s) importada(s) e ${updated} atualizada(s).`,
      )
      queryClient.invalidateQueries({ queryKey: ['sellers'] })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao sincronizar com o Ploomes.',
      )
    } finally {
      setIsSyncing(false)
    }
  }

  const unitMap = Object.fromEntries(units.map((u) => [u.id, u.name]))

  const filtered = sellers.filter((s) => {
    if (filter === 'active') return s.status === 'active' && !s.is_system_account
    if (filter === 'inactive') return s.status === 'inactive' && !s.is_system_account
    if (filter === 'system') return s.is_system_account
    return true
  })

  function openEdit(seller: Seller) {
    setEditSeller(seller)
    setSheetOpen(true)
  }

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vendedoras" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / Timeout ──────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vendedoras" />
        <div className="flex flex-col items-center gap-3 py-12 text-text-secondary">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="text-sm">Erro ao carregar vendedoras.</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Vendedoras"
          actions={
            canSyncSellers ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSync}
                        disabled={isSyncing}
                      />
                    }
                  >
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Users className="mr-2 h-4 w-4" />
                    )}
                    Sincronizar do Ploomes
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-sm leading-normal">
                    Traz para o sistema todas as pessoas cadastradas e ativas no Ploomes.
                    Use quando entrar alguém novo no time de vendas e o nome dela ainda
                    não aparecer nas listas (por exemplo, na hora de criar o usuário e
                    vincular a vendedora). Quem já está aqui não é duplicado.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : undefined
          }
        />

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                filter === key
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
              )}
            >
              {FILTER_LABELS[key]}
              <span className="ml-1.5 text-xs opacity-70">
                {key === 'all'
                  ? sellers.length
                  : key === 'active'
                    ? sellers.filter((s) => s.status === 'active' && !s.is_system_account).length
                    : key === 'inactive'
                      ? sellers.filter((s) => s.status === 'inactive' && !s.is_system_account).length
                      : sellers.filter((s) => s.is_system_account).length}
              </span>
            </button>
          ))}
        </div>

        {/* Empty */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary text-sm">
            Nenhuma vendedora encontrada.
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-text-secondary">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Contratação</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Desligamento</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Unidade</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filtered.map((seller) => (
                  <tr
                    key={seller.id}
                    className="bg-card hover:bg-surface-secondary transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{seller.name}</div>
                      {seller.email && (
                        <div className="text-xs text-text-tertiary mt-0.5">{seller.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {seller.is_system_account ? (
                        <Badge variant="outline" className="badge-gray border text-xs">
                          Sistema
                        </Badge>
                      ) : seller.status === 'active' ? (
                        <Badge variant="outline" className="badge-green border text-xs">
                          Ativa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="badge-red border text-xs">
                          Inativa
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-text-secondary">
                      {formatDate(seller.hire_date)}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-text-secondary">
                      {seller.status === 'inactive' ? formatDate(seller.termination_date) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-text-secondary">
                      {seller.primary_unit_id ? (unitMap[seller.primary_unit_id] ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(seller)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-surface-tertiary text-text-secondary hover:text-text-primary transition-colors"
                        aria-label={`Editar ${seller.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SellerEditSheet
        seller={editSeller}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isSuperAdmin={isSuperAdmin}
      />
    </>
  )
}
