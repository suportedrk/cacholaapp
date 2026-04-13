'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { FunnelStage } from '@/hooks/use-bi-funnel'
import { StageDrilldown } from './stage-drilldown'

// ── Types ─────────────────────────────────────────────────────

type Props = {
  stages: FunnelStage[]
  totalDeals: number
}

type SelectedStage = {
  stageId: number
  stageName: string
  total: number
}

// ── Helpers ───────────────────────────────────────────────────

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

// Trim long stage names for display
function shortName(name: string): string {
  if (name.length <= 32) return name
  return name.slice(0, 30) + '…'
}

// ── Component ─────────────────────────────────────────────────

export function BIFunnel({ stages, totalDeals }: Props) {
  const [selectedStage, setSelectedStage] = useState<SelectedStage | null>(null)

  if (stages.length === 0) return null

  return (
    <>
      <div className="space-y-2">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1">
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-3 h-3 rounded-sm bg-amber-400" />
            Em aberto
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-3 h-3 rounded-sm bg-green-500" />
            Ganhos
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span className="w-3 h-3 rounded-sm bg-neutral-300 dark:bg-neutral-600" />
            Perdidos
          </span>
          <span className="ml-auto text-xs text-text-tertiary hidden sm:block">
            Clique em um stage para ver os deals
          </span>
        </div>

        {/* Bars */}
        <div className="space-y-2.5">
          {stages.map((stage) => {
            const widthPct    = pct(stage.total, totalDeals)
            const emAbertoPct = pct(stage.em_aberto, stage.total)
            const ganhosPct   = pct(stage.ganhos,    stage.total)
            const perdidosPct = 100 - emAbertoPct - ganhosPct

            return (
              <div
                key={stage.stage_id}
                role="button"
                tabIndex={0}
                aria-label={`Ver deals de ${stage.stage_name}`}
                className="space-y-1 cursor-pointer group rounded-md p-1 -m-1 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus transition-colors"
                onClick={() => setSelectedStage({
                  stageId:   stage.stage_id,
                  stageName: stage.stage_name,
                  total:     stage.total,
                })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedStage({
                      stageId:   stage.stage_id,
                      stageName: stage.stage_name,
                      total:     stage.total,
                    })
                  }
                }}
              >
                {/* Stage label + count */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-text-secondary group-hover:text-text-primary truncate transition-colors">
                    {shortName(stage.stage_name)}
                  </span>
                  <span className="text-xs font-semibold text-text-primary tabular-nums shrink-0">
                    {stage.total.toLocaleString('pt-BR')}
                  </span>
                </div>

                {/* Bar track — left-aligned for taper effect */}
                <div className="h-5 bg-surface-tertiary rounded-md overflow-hidden group-hover:ring-1 group-hover:ring-border-strong transition-all">
                  <div
                    className="h-full flex transition-all duration-500"
                    style={{ width: `${Math.max(widthPct, 2)}%` }}
                  >
                    {/* Em aberto (amber) */}
                    {emAbertoPct > 0 && (
                      <div
                        className="h-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${emAbertoPct}%` }}
                        title={`Em aberto: ${stage.em_aberto.toLocaleString('pt-BR')}`}
                      />
                    )}
                    {/* Ganhos (green) */}
                    {ganhosPct > 0 && (
                      <div
                        className="h-full bg-green-500 transition-all duration-500"
                        style={{ width: `${ganhosPct}%` }}
                        title={`Ganhos: ${stage.ganhos.toLocaleString('pt-BR')}`}
                      />
                    )}
                    {/* Perdidos (gray) */}
                    {perdidosPct > 0 && (
                      <div
                        className={cn(
                          'h-full bg-neutral-300 dark:bg-neutral-600 transition-all duration-500',
                        )}
                        style={{ width: `${perdidosPct}%` }}
                        title={`Perdidos: ${stage.perdidos.toLocaleString('pt-BR')}`}
                      />
                    )}
                  </div>
                </div>

                {/* Sub-counts */}
                <div className="flex gap-3 text-[11px] text-text-tertiary">
                  {stage.em_aberto > 0 && (
                    <span>
                      <span className="text-amber-500 font-medium">{stage.em_aberto.toLocaleString('pt-BR')}</span>
                      {' '}em aberto
                    </span>
                  )}
                  {stage.ganhos > 0 && (
                    <span>
                      <span className="text-green-600 dark:text-green-400 font-medium">{stage.ganhos.toLocaleString('pt-BR')}</span>
                      {' '}ganhos
                    </span>
                  )}
                  {stage.perdidos > 0 && (
                    <span>
                      <span className="font-medium">{stage.perdidos.toLocaleString('pt-BR')}</span>
                      {' '}perdidos
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Drill-down slide-over */}
      <StageDrilldown
        isOpen={!!selectedStage}
        onClose={() => setSelectedStage(null)}
        stageId={selectedStage?.stageId ?? 0}
        stageName={selectedStage?.stageName ?? ''}
        stageTotal={selectedStage?.total ?? 0}
      />
    </>
  )
}
