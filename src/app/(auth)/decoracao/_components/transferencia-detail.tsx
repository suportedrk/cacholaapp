'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Printer,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import {
  useTransferencia,
  useReceberTransferencia,
  useCancelarTransferencia,
} from '@/hooks/use-decoracao-transferencias'
import { ROUTES } from '@/lib/constants'
import type { TransferenciaItemHidratado } from '@/types/decoracao'
import { TransferenciaStatusBadge } from './transferencia-status-badge'
import { RomaneioPrintDialog } from './romaneio-print-dialog'

function variacaoLabel(it: TransferenciaItemHidratado): string {
  const partes = [it.variacao_tamanho, it.variacao_cor, it.variacao_detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : it.variacao_codigo
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export function TransferenciaDetail({ id }: { id: string }) {
  const router = useRouter()
  const [printOpen, setPrintOpen] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const {
    data: t,
    isLoading,
    isError,
    refetch,
  } = useTransferencia(id)

  const { isTimedOut, retry } = useLoadingTimeout(isLoading)
  const { mutateAsync: receber, isPending: receberLoading } = useReceberTransferencia()
  const { mutateAsync: cancelar, isPending: cancelarLoading } = useCancelarTransferencia()

  const back = (
    <Link
      href={ROUTES.decoracaoTransferencias}
      className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      Transferências
    </Link>
  )

  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        {back}
        <Skeleton className="skeleton-shimmer h-9 w-72 rounded" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || isTimedOut || !t) {
    return (
      <div className="space-y-6">
        {back}
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar transferência.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void (isTimedOut ? retry() : refetch())}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const emTransito = t.status === 'em_transito'

  async function handleReceber() {
    try {
      await receber(id)
      toast.success('Transferência recebida. Saldo atualizado no destino.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao receber.')
    }
  }

  async function handleCancelar() {
    try {
      await cancelar(id)
      toast.success('Transferência cancelada. Saldo devolvido à origem.')
      setConfirmCancel(false)
      router.push(ROUTES.decoracaoTransferencias)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao cancelar.')
    }
  }

  const totalPecas = t.itens.reduce((acc, it) => acc + it.quantidade, 0)

  return (
    <div className="space-y-6">
      {back}

      <PageHeader
        title="Transferência"
        description={`Lançada em ${formatDateTime(t.data_envio)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPrintOpen(true)}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir romaneio
            </Button>
            {emTransito && (
              <>
                <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={cancelarLoading}>
                  {cancelarLoading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-1.5 h-4 w-4" />
                  )}
                  Cancelar
                </Button>
                <Button onClick={handleReceber} disabled={receberLoading}>
                  {receberLoading ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  )}
                  Dar baixa (receber)
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Cabeçalho com origem/destino e status */}
      <div className="rounded-lg border bg-surface-primary p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-base font-semibold">
            <span>{t.origem_nome}</span>
            <ArrowRight className="h-5 w-5 text-text-tertiary" />
            <span>{t.destino_nome}</span>
          </div>
          <TransferenciaStatusBadge status={t.status} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-tertiary">Lançada por</dt>
            <dd>{t.created_by_nome ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Data de envio</dt>
            <dd>{formatDateTime(t.data_envio)}</dd>
          </div>
          {t.status === 'recebida' && (
            <>
              <div>
                <dt className="text-xs text-text-tertiary">Recebida por</dt>
                <dd>{t.recebido_por_nome ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary">Data de recebimento</dt>
                <dd>{formatDateTime(t.data_recebimento)}</dd>
              </div>
            </>
          )}
          {t.observacoes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-text-tertiary">Observações</dt>
              <dd className="whitespace-pre-wrap">{t.observacoes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Itens */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            Itens ({t.itens.length})
          </h2>
          <span className="text-xs text-text-tertiary">
            Total: {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-left font-medium">Variação</th>
                <th className="px-3 py-2 text-left font-medium">Código</th>
                <th className="px-3 py-2 text-right font-medium">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              {t.itens.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.item_nome}</td>
                  <td className="px-3 py-2">{variacaoLabel(it)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.variacao_codigo}</td>
                  <td className="px-3 py-2 text-right font-medium">{it.quantidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: confirmação de cancelamento */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar transferência?</DialogTitle>
            <DialogDescription>
              O saldo das peças voltará para <strong>{t.origem_nome}</strong>. Essa ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelar} disabled={cancelarLoading}>
              {cancelarLoading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de impressão do romaneio */}
      <RomaneioPrintDialog open={printOpen} onOpenChange={setPrintOpen} transferencia={t} />
    </div>
  )
}
