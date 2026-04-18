'use client'

import { useState } from 'react'
import { AlertCircle, ShoppingBag } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useUpsellOpportunities, useUpsellCount, type UpsellSource } from '@/hooks/use-upsell'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { Button } from '@/components/ui/button'
import { UpsellSourceTabs } from './upsell-source-tabs'
import { UpsellFilters } from './upsell-filters'
import { UpsellCard } from './upsell-card'
import { CarteireLivreBanner } from './carteira-livre-banner'
import { PopularAddonsHint } from './popular-addons-hint'

export function UpsellTab() {
  const { profile } = useAuth()
  const [source,        setSource]        = useState<UpsellSource>('mine')
  const [showContacted, setShowContacted] = useState(false)

  const sellerId   = (profile?.seller_id as string | null) ?? null
  const canRegister = !!sellerId

  const { data: count } = useUpsellCount()
  const {
    data: opportunities,
    isLoading,
    isError,
    refetch,
  } = useUpsellOpportunities({ sellerId, showContacted, source })

  const timedOut = useLoadingTimeout(isLoading)

  // ── Loading ───────────────────────────────────────────────
  if (isLoading && !timedOut) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="skeleton-shimmer h-4 w-48 rounded" />
            <div className="skeleton-shimmer h-3 w-32 rounded" />
            <div className="skeleton-shimmer h-3 w-56 rounded" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error / timeout ────────────────────────────────────────
  if (isError || timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <AlertCircle className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">Erro ao carregar oportunidades</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  const items = opportunities ?? []

  return (
    <div className="space-y-4">
      {/* Source sub-tabs */}
      <UpsellSourceTabs
        source={source}
        onSourceChange={setSource}
        mineCount={count?.my_count ?? 0}
        carteiraLivreCount={count?.carteira_livre_count ?? 0}
      />

      {/* Carteira Livre banner */}
      {(source === 'carteira_livre' || source === 'all') && (count?.carteira_livre_count ?? 0) > 0 && (
        <CarteireLivreBanner />
      )}

      {/* Popular addons hint (shows for "50 Pessoas" package type) */}
      <PopularAddonsHint packageName="50 Pessoas" />

      {/* Filters + count */}
      <UpsellFilters
        showContacted={showContacted}
        onToggle={setShowContacted}
        totalShown={items.length}
      />

      {/* Alert: vendedora without seller_id */}
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
          <ShoppingBag className="w-10 h-10 opacity-40" />
          <p className="text-sm font-medium">
            {showContacted
              ? 'Nenhuma oportunidade na janela de 30–40 dias'
              : 'Todas as oportunidades já foram contatadas'}
          </p>
          {!showContacted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContacted(true)}
            >
              Ver contatadas
            </Button>
          )}
        </div>
      )}

      {/* Cards */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((opp) => (
            <UpsellCard
              key={opp.event_id}
              opportunity={opp}
              canRegister={canRegister}
            />
          ))}
        </div>
      )}
    </div>
  )
}
