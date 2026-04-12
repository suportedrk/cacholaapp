'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Building2, ChevronDown, Check, Layers } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useUnitStore } from '@/stores/unit-store'
import { useAuth } from '@/hooks/use-auth'

const GLOBAL_VIEWER_ROLES = ['super_admin', 'diretor']

function formatSlug(slug: string) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function UnitSwitcher() {
  const qc = useQueryClient()
  const { userUnits, activeUnitId } = useAuth()
  const { setActiveUnit } = useUnitStore()

  // Verificar se o usuário pode ver todas as unidades
  const canViewAll = userUnits.some((u) => GLOBAL_VIEWER_ROLES.includes(u.role))

  const activeUserUnit = userUnits.find((u) => u.unit_id === activeUnitId)
  const activeSlug = (activeUserUnit?.unit as { slug: string } | undefined)?.slug
  const activeName = activeUnitId === null
    ? 'Todas as unidades'
    : activeSlug ? formatSlug(activeSlug) : 'Unidade'

  function switchUnit(unitId: string | null) {
    const unitObj = unitId
      ? (userUnits.find((u) => u.unit_id === unitId)?.unit as { id: string; name: string; slug: string } | undefined) ?? null
      : null
    setActiveUnit(unitId, unitObj)
    // Invalidar todas as queries dependentes de unidade
    qc.invalidateQueries({ queryKey: ['events'] })
    qc.invalidateQueries({ queryKey: ['events-infinite'] })
    qc.invalidateQueries({ queryKey: ['events-tab-counts'] })
    qc.invalidateQueries({ queryKey: ['events-kpis'] })
    qc.invalidateQueries({ queryKey: ['checklists'] })
    qc.invalidateQueries({ queryKey: ['maintenance'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['event-types'] })
    qc.invalidateQueries({ queryKey: ['packages'] })
    qc.invalidateQueries({ queryKey: ['venues'] })
    qc.invalidateQueries({ queryKey: ['sectors'] })
    qc.invalidateQueries({ queryKey: ['checklist-categories'] })
  }

  if (userUnits.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm',
          'text-muted-foreground hover:text-foreground hover:bg-accent',
          'transition-colors outline-none max-w-[180px]',
          'focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Selecionar unidade"
      >
        {activeUnitId === null
          ? <Layers className="w-4 h-4 shrink-0 text-primary" />
          : <Building2 className="w-4 h-4 shrink-0 text-primary" />
        }
        <span className="hidden sm:inline truncate font-medium text-foreground text-xs sm:text-sm">
          {activeName}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        {/* Opção "Todas as unidades" — só para super_admin/diretor */}
        {canViewAll && (
          <>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onClick={() => switchUnit(null)}
            >
              <Layers className="w-4 h-4 text-primary" />
              <span className="flex-1">Todas as unidades</span>
              {activeUnitId === null && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Unidades do usuário */}
        {userUnits.map((uu) => {
          const unit = uu.unit as { id: string; name: string; slug: string; is_active: boolean }
          return (
            <DropdownMenuItem
              key={uu.unit_id}
              className={cn('cursor-pointer gap-2', !unit.is_active && 'opacity-50')}
              onClick={() => switchUnit(uu.unit_id)}
              disabled={!unit.is_active}
            >
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate">{formatSlug(unit.slug)}</span>
              {uu.unit_id === activeUnitId && <Check className="w-3.5 h-3.5 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
