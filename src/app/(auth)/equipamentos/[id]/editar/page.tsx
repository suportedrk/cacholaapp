'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'
import { useEquipmentItem } from '@/hooks/use-equipment'
import { EquipmentForm } from '@/components/features/equipment/equipment-form'

export default function EditarEquipamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: equipment, isLoading, error } = useEquipmentItem(id)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-96 bg-muted rounded-xl" />
      </div>
    )
  }

  if (error || !equipment) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Equipamento não encontrado.</p>
        <Link href="/equipamentos" className={buttonVariants({ variant: 'outline' })}>
          <ArrowLeft className="w-4 h-4 mr-1.5" />Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Editar Equipamento"
        description={equipment.name}
        actions={
          <Link href={`/equipamentos/${id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Voltar
          </Link>
        }
      />
      <div className="rounded-xl border bg-card p-6">
        <EquipmentForm equipment={equipment} />
      </div>
    </div>
  )
}
