'use client'

import { useState } from 'react'
import { AlertCircle, Gift } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import {
  useRecompraAniversario,
  useRecompraFestaPassada,
  useRecompraCount,
  type RecompraType,
  type RecompraSource,
} from '@/hooks/use-recompra'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { Button } from '@/components/ui/button'
import { UpsellSourceTabs } from '../upsell/upsell-source-tabs'
import { RecompraTypeTabs } from './recompra-type-tabs'
import { RecompraCardAniversario } from './recompra-card-aniversario'
import { RecompraCardFesta } from './recompra-card-festa'
import { CarteiraLivreRecompraBanner } from './carteira-livre-recompra-banner'
import type { UpsellSource } from '@/hooks/use-upsell'

export function RecompraTab() {
  const { profile } = useAuth()

  const [recompraType,   setRecompraType]   = useState<RecompraType>('aniversario')
  const [source,         setSource]         = useState<UpsellSource>('mine')
  const [showContacted,  setShowContacted]  = useState(false)

  const sellerId    = (profile?.seller_id as string | null) ?? null
  const canRegister = !!sellerId

  const { data: counts } = useRecompraCount()

  const {
    data: aniversarioData,
    isLoading: loadingAniv,
    isError: errorAniv,
    refetch: refetchAniv,
  } = useRecompraAniversario({ sellerId, showContacted, source })

  const {
    data: festaData,
    isLoading: loadingFesta,
    isError: errorFesta,
    refetch: refetchFesta,
  } = useRecompraFestaPassada({ sellerId, showContacted, source })

  const isActive = recompraType === 'aniversario'
  const isLoading = isActive ? loadingAniv : loadingFesta
  const isError   = isActive ? errorAniv   : errorFesta
  const refetch   = isActive ? refetchAniv : refetchFesta

  const { isTimedOut: timedOut } = useLoadingTimeout(isLoading)

  const anivItems  = aniversarioData ?? []
  const festaItems = festaData       ?? []
  const items      = isActive ? anivItems : festaItems

  // Compute source counts from loaded data for the source tabs
  const mineCountAniv         = anivItems.filter((i) => !i.is_carteira_livre).length
  const carteiraLivreCountAniv = anivItems.filter((i) => i.is_carteira_livre).length
  const mineCountFesta         = festaItems.filter((i) => !i.is_carteira_livre).length
  const carteiraLivreCountFesta = festaItems.filter((i) => i.is_carteira_livre).length

  const mineCount         = isActive ? mineCountAniv         : mineCountFesta
  const carteiraLivreCount = isActive ? carteiraLivreCountAniv : carteiraLivreCountFesta

  const typeTabs = (
    <RecompraTypeTabs
      activeType={recompraType}
      onTypeChange={(t) => { setRecompraType(t); setSource('mine'); setShowContacted(false) }}
      aniversarioCount={counts?.aniversario_count ?? 0}
      festaPassadaCount={counts?.festa_passada_count ?? 0}
    />
  )

  const sourceTabs = (
    <UpsellSourceTabs
      source={source as UpsellSource}
      onSourceChange={(s) => setSource(s as UpsellSource)}
      mineCount={mineCount}
      carteiraLivreCount={carteiraLivreCount}
    />
  )

  // ── Loading ───────────────────────────────────────────────
  if (isLoading && !timedOut) {
    return (
      <div className="space-y-4">
        {typeTabs}
        {sourceTabs}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="skeleton-shimmer h-4 w-32 rounded" />
              <div className="skeleton-shimmer h-3 w-48 rounded" />
              <div className="skeleton-shimmer h-3 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Error / timeout ────────────────────────────────────────
  if (isError || timedOut) {
    return (
      <div className="space-y-4">
        {typeTabs}
        {sourceTabs}
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <AlertCircle className="w-10 h-10 opacity-40" />
          <p className="text-sm font-medium">Erro ao carregar oportunidades</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Type tabs */}
      {typeTabs}

      {/* Source sub-tabs */}
      {sourceTabs}

      {/* Carteira Livre banner */}
      {(source === 'carteira_livre' || source === 'all') && carteiraLivreCount > 0 && (
        <CarteiraLivreRecompraBanner />
      )}

      {/* Show contacted toggle + count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {items.length} oportunidade{items.length !== 1 ? 's' : ''}
          {showContacted ? '' : ' não contatadas'}
        </span>
        <button
          onClick={() => setShowContacted((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          {showContacted ? 'Ocultar contatadas' : 'Ver contatadas'}
        </button>
      </div>

      {/* Alert: vendedora sem seller_id */}
      {!canRegister && (
        <div className="flex items-start gap-3 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-text">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Sua conta não está vinculada a uma vendedora — contatos não podem ser registrados.
          </span>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Gift className="w-10 h-10 opacity-40" />
          <p className="text-sm font-medium">
            {showContacted
              ? 'Nenhuma oportunidade de recompra encontrada'
              : 'Todas as oportunidades já foram contatadas'}
          </p>
          {!showContacted && (
            <Button variant="outline" size="sm" onClick={() => setShowContacted(true)}>
              Ver contatadas
            </Button>
          )}
        </div>
      )}

      {/* Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {isActive
            ? anivItems.map((opp) => (
                <RecompraCardAniversario
                  key={`${opp.contact_email}|${opp.aniversariante_birthday}`}
                  opportunity={opp}
                  canRegister={canRegister}
                />
              ))
            : festaItems.map((opp) => (
                <RecompraCardFesta
                  key={`${opp.contact_email}|${opp.aniversariante_birthday}`}
                  opportunity={opp}
                  canRegister={canRegister}
                />
              ))}
        </div>
      )}
    </div>
  )
}
