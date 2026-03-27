'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, Loader2, MapPin, Phone, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUnits } from '@/hooks/use-units'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Unit } from '@/types/database.types'

export default function UnidadesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { data: units, isLoading, isError } = useUnits()

  const filtered = units?.filter((u) =>
    !search.trim() || u.name.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Unidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {units ? `${units.length} unidade${units.length !== 1 ? 's' : ''}` : 'Gerenciar unidades do negócio'}
          </p>
        </div>
        <Button onClick={() => router.push(`${ROUTES.units}/nova`)} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Nova Unidade
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar unidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="text-center py-12 text-destructive text-sm">
          Erro ao carregar unidades. Tente novamente.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhuma unidade encontrada</p>
          {search && <p className="text-sm mt-1">Tente outro termo de busca</p>}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              onClick={() => router.push(`${ROUTES.units}/${unit.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UnitCard({ unit, onClick }: { unit: Unit; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border border-border bg-card',
        'hover:shadow-md hover:border-primary/30 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{unit.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{unit.slug}</p>
          </div>
        </div>
        <Badge variant={unit.is_active ? 'default' : 'secondary'} className="shrink-0 text-xs">
          {unit.is_active ? (
            <><CheckCircle2 className="w-3 h-3 mr-1" />Ativa</>
          ) : (
            <><XCircle className="w-3 h-3 mr-1" />Inativa</>
          )}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {unit.address && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{unit.address}</span>
          </div>
        )}
        {unit.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>{unit.phone}</span>
          </div>
        )}
        {!unit.address && !unit.phone && (
          <p className="text-xs text-muted-foreground italic">Sem informações de contato</p>
        )}
      </div>
    </button>
  )
}
