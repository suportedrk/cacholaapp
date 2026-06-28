'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PreviewMode = 'atual' | 'proposta'
export type AccentChoice = 'coral' | 'gold'

/**
 * Controle do preview de redesign (PR 0). Fica FORA do container `.theme-proposta`,
 * então usa o tema atual e permanece legível ao alternar.
 */
export function PreviewControls({
  mode,
  setMode,
  accent,
  setAccent,
}: {
  mode: PreviewMode
  setMode: (m: PreviewMode) => void
  accent: AccentChoice
  setAccent: (a: AccentChoice) => void
}) {
  const seg = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
    )

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-default bg-card p-2">
      <div className="inline-flex items-center gap-2">
        <span className="pl-1 text-xs font-semibold text-muted-foreground">Pré-visualizar</span>
        <div className="inline-flex rounded-lg border border-border-default p-0.5">
          <button onClick={() => setMode('atual')} className={seg(mode === 'atual')}>Atual</button>
          <button onClick={() => setMode('proposta')} className={seg(mode === 'proposta')}>Proposta</button>
        </div>
      </div>

      {mode === 'proposta' && (
        <>
          <div className="inline-flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Accent</span>
            <div className="inline-flex rounded-lg border border-border-default p-0.5">
              <button onClick={() => setAccent('coral')} className={seg(accent === 'coral')}>Coral</button>
              <button onClick={() => setAccent('gold')} className={seg(accent === 'gold')}>Dourado</button>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Tokens escopados — não afeta produção. Títulos em Bricolage Grotesque. Overlays via portal (modais/menus) seguem o tema atual.
          </span>
        </>
      )}
    </div>
  )
}

/** Amostra do accent festivo proposto (usa a CSS var --accent-festivo do tema). */
export function AccentSample() {
  return (
    <div className="rounded-lg border border-border-default bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Accent festivo (novo) — uso parcimonioso</h3>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Destaque para CTAs especiais, estados de &ldquo;ganho&rdquo;/comemoração e KPIs de topo. Convive com a primária (sálvia) e a terracota (Moema) — não as substitui.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ backgroundColor: 'var(--accent-festivo)', color: 'var(--accent-festivo-foreground)' }}
        >
          <Sparkles className="size-4" /> Comemorar venda
        </button>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--accent-festivo) 16%, transparent)',
            color: 'var(--accent-festivo)',
            borderColor: 'color-mix(in oklch, var(--accent-festivo) 35%, transparent)',
          }}
        >
          Festa fechada
        </span>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--accent-festivo)' }}>
          R$ 84k
        </span>
        <span
          className="inline-flex size-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--accent-festivo) 14%, transparent)',
            color: 'var(--accent-festivo)',
          }}
        >
          <Sparkles className="size-4" />
        </span>
      </div>
    </div>
  )
}
