'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { MaintenanceForm } from '@/components/features/maintenance/maintenance-form'
import { Skeleton } from '@/components/ui/skeleton'
import { useMaintenanceOrder } from '@/hooks/use-maintenance'

export default function EditarOrdemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: order, isLoading, isError } = useMaintenanceOrder(id)

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-48" />
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="space-y-4">
        <Link href="/manutencao" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <p className="text-sm text-destructive">Ordem não encontrada ou sem permissão.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href={`/manutencao/${id}`}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para a ordem
      </Link>
      <PageHeader
        title="Editar Ordem"
        description={`Editando: ${order.title}`}
      />
      <div className="bg-card rounded-xl border border-border p-6">
        <MaintenanceForm order={order} />
      </div>
    </div>
  )
}
