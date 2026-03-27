'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Package, Search } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { useEquipment, useEquipmentCategories } from '@/hooks/use-equipment'
import { EquipmentCard, EquipmentCardSkeleton } from '@/components/features/equipment/equipment-card'
import { useDebounce } from '@/hooks/use-debounce'
import type { EquipmentStatus } from '@/types/database.types'

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: 'all',       label: 'Todos os status' },
  { value: 'active',    label: 'Ativos' },
  { value: 'inactive',  label: 'Inativos' },
  { value: 'in_repair', label: 'Em Reparo' },
  { value: 'retired',   label: 'Aposentados' },
]

export default function EquipamentosPage() {
  const router = useRouter()
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus]     = useState('all')
  const debouncedSearch = useDebounce(search, 300)

  const { data: categories = [] } = useEquipmentCategories()
  const { data: equipmentList = [], isLoading, error } = useEquipment({
    search:   debouncedSearch,
    category: category || undefined,
    status:   status !== 'all' ? [status as EquipmentStatus] : undefined,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipamentos"
        description="Gerencie os ativos e equipamentos do buffet"
        actions={
          <Link href="/equipamentos/novo" className={buttonVariants({ size: 'sm' })}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo equipamento
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={category || '__all__'} onValueChange={(v: string | null) => setCategory(v === '__all__' ? '' : (v ?? ''))}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v: string | null) => setStatus(v ?? 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-destructive text-sm">
          Erro ao carregar equipamentos. Tente novamente.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <EquipmentCardSkeleton key={i} />)}
        </div>
      ) : equipmentList.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || category || status !== 'all'
            ? 'Nenhum equipamento encontrado'
            : 'Nenhum equipamento cadastrado'}
          description={search || category || status !== 'all'
            ? 'Tente ajustar os filtros.'
            : 'Comece cadastrando os ativos do buffet.'}
          action={!search && !category && status === 'all' ? {
            label: 'Novo equipamento',
            onClick: () => router.push('/equipamentos/novo'),
          } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {equipmentList.map((eq) => (
            <EquipmentCard key={eq.id} equipment={eq} />
          ))}
        </div>
      )}
    </div>
  )
}
