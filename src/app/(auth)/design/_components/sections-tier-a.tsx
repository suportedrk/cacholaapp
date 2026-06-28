'use client'

import { useState } from 'react'
import {
  WifiOff, Sun, Moon, Eye, Loader2, AlertCircle, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/constants/brand-colors'
import type { TabKey } from '@/hooks/use-events'

import { BarChartCard } from '@/components/features/reports/bar-chart-card'
import { DonutChartCard } from '@/components/features/reports/donut-chart-card'
import { HorizontalBarChartCard } from '@/components/features/reports/horizontal-bar-chart-card'
import { EventTemporalTabs } from '@/components/features/events/event-temporal-tabs'
import { Breadcrumbs } from '@/components/layout/breadcrumbs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

import { ShowcaseSection, ShowcaseCard, Demo } from './primitives'

// ─────────────────────────────────────────────────────────────
// GRÁFICOS (Recharts) — reusa os chart cards de produção (reports/)
// ─────────────────────────────────────────────────────────────
const BAR_DATA = [
  { mes: 'Jan', leads: 40, ganhos: 12 }, { mes: 'Fev', leads: 52, ganhos: 18 },
  { mes: 'Mar', leads: 44, ganhos: 15 }, { mes: 'Abr', leads: 61, ganhos: 22 },
  { mes: 'Mai', leads: 58, ganhos: 25 }, { mes: 'Jun', leads: 70, ganhos: 31 },
]
const DONUT_DATA = [
  { name: 'Instagram', value: 62 }, { name: 'Indicação', value: 24 },
  { name: 'WhatsApp', value: 18 }, { name: 'Site/Web', value: 9 }, { name: 'TikTok', value: 5 },
]
const HBAR_DATA = [
  { name: 'Carolina', value: 84000 }, { name: 'Bruna', value: 61500 },
  { name: 'Raphaela', value: 48200 }, { name: 'Ana', value: 33000 },
]

export function Graficos() {
  return (
    <ShowcaseSection
      id="graficos"
      title="Gráficos (Recharts)"
      description="Padrões de chart reutilizáveis (reports/). Cor sempre hex via CHART_COLORS — exceção legítima do Recharts. O AreaChart de tendência aparece como sparkline no KpiCard acima."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <BarChartCard
          title="Barras (Leads × Ganhos)"
          data={BAR_DATA}
          xKey="mes"
          series={[
            { dataKey: 'leads', name: 'Leads', color: CHART_COLORS.secondary },
            { dataKey: 'ganhos', name: 'Ganhos', color: CHART_COLORS.primary },
          ]}
        />
        <BarChartCard
          title="Barras empilhadas (stacked)"
          data={BAR_DATA}
          xKey="mes"
          stacked
          series={[
            { dataKey: 'ganhos', name: 'Ganhos', color: CHART_COLORS.primary },
            { dataKey: 'leads', name: 'Leads', color: CHART_COLORS.secondary },
          ]}
        />
        <DonutChartCard title="Donut (origem dos leads)" data={DONUT_DATA} />
        <HorizontalBarChartCard title="Barras horizontais (ranking)" data={HBAR_DATA} />
      </div>
    </ShowcaseSection>
  )
}

// ─────────────────────────────────────────────────────────────
// CHROME & NAVEGAÇÃO
// ─────────────────────────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border-default bg-muted px-1.5 text-xs font-medium text-foreground shadow-xs">
      {children}
    </kbd>
  )
}

export function ChromeNavegacao() {
  const [tab, setTab] = useState<TabKey>('week')

  return (
    <ShowcaseSection
      id="chrome-live"
      title="Chrome & navegação"
      description="Elementos transversais da casca do app. Alguns são presos a sessão/stores na navbar/sidebar — aqui aparecem como exemplo visual."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Toggle de tema · badges de navbar/sidebar">
          <div className="space-y-4">
            <Demo label="Toggle de tema (Sol/Lua)">
              <button className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-border-default text-foreground" aria-label="tema claro"><Sun className="size-4" /></button>
              <button className="focus-ring inline-flex size-9 items-center justify-center rounded-lg border border-border-default text-foreground" aria-label="tema escuro"><Moon className="size-4" /></button>
            </Demo>
            <Demo label="Pill 'Em breve' · badge de contagem · offline">
              <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium badge-amber">Em breve</span>
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">3</span>
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium badge-amber"><WifiOff className="size-3" />Offline</span>
            </Demo>
            <Demo label="Kbd (atalhos de teclado)">
              <Kbd>⌘</Kbd><Kbd>K</Kbd><span className="text-muted-foreground text-sm">·</span><Kbd>G</Kbd><Kbd>D</Kbd><span className="text-muted-foreground text-sm">·</span><Kbd>?</Kbd>
            </Demo>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Breadcrumbs · Abas temporais">
          <div className="space-y-4">
            <Demo label="Breadcrumbs (componente real, deriva da rota)">
              <Breadcrumbs />
            </Demo>
            <Demo label="EventTemporalTabs (Hoje/Semana/Mês/Todos)">
              <EventTemporalTabs
                active={tab}
                counts={{ today: 2, week: 8, month: 23, all: 412 }}
                onTabChange={setTab}
              />
            </Demo>
          </div>
        </ShowcaseCard>
      </div>

      <ShowcaseCard title="Banner de impersonação ('Ver como')" hint="exemplo visual — o real é wired ao impersonate-store">
        <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2 badge-amber">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Eye className="size-4 shrink-0" />
            Visualizando como <strong>Maria Silva</strong> (vendedora — Pinheiros)
          </span>
          <button className="focus-ring rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline">Sair</button>
        </div>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

// ─────────────────────────────────────────────────────────────
// ESTADOS & FEEDBACK
// ─────────────────────────────────────────────────────────────
export function EstadosFeedback() {
  return (
    <ShowcaseSection
      id="estados"
      title="Estados & feedback"
      description="Padrões de erro, timeout e carregamento que toda tela deve tratar (além de loading/empty já mostrados)."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Erro + 'Tentar novamente'">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg/40 py-10 text-center">
            <AlertCircle className="size-8 text-status-error-text" />
            <div>
              <p className="text-sm font-medium text-foreground">Não foi possível carregar</p>
              <p className="text-xs text-muted-foreground">Verifique sua conexão e tente de novo.</p>
            </div>
            <Button variant="outline" size="sm">Tentar novamente</Button>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Loading timeout (safety net 12s)">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-default py-10 text-center">
            <Loader2 className="size-7 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">O carregamento está demorando mais que o esperado…</p>
            <Button variant="outline" size="sm">Recarregar</Button>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Empty (lista vazia)">
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Search className="size-6 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum resultado</p>
            <p className="text-xs text-muted-foreground">Ajuste os filtros e tente de novo.</p>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Skeleton de card">
          <div className="rounded-xl border border-border-default p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="mb-3 h-8 w-16" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </ShowcaseCard>
      </div>
    </ShowcaseSection>
  )
}

// ─────────────────────────────────────────────────────────────
// CHIPS & INDICADORES TRANSVERSAIS
// ─────────────────────────────────────────────────────────────
const DEAL_STATUS = [
  { label: 'Em aberto', cls: 'badge-amber' },
  { label: 'Ganho', cls: 'badge-green' },
  { label: 'Perdido', cls: 'badge-gray' },
]
const OUTCOMES = [
  { label: 'Tentou', cls: 'badge-amber' },
  { label: 'Recusou', cls: 'badge-red' },
  { label: 'Vendeu adicional', cls: 'badge-green' },
  { label: 'Vendeu upgrade', cls: 'badge-green' },
  { label: 'Outro', cls: 'badge-gray' },
]
const ADOPTION = [
  { name: 'Carolina', pct: 88 },
  { name: 'Bruna', pct: 64 },
  { name: 'Raphaela', pct: 41 },
]

export function ChipsIndicadores() {
  const [loadingMore, setLoadingMore] = useState(false)

  return (
    <ShowcaseSection
      id="indicadores"
      title="Chips & indicadores transversais"
      description="Pequenos padrões repetidos em várias telas: valor restrito por permissão, paginação, barras de adoção e badges de status."
    >
      <ShowcaseCard title="Valor restrito · Carregar mais">
        <div className="space-y-4">
          <Demo label="Gate de valor (canViewFestaValues / canViewProviderCost)">
            <span className="text-sm tabular-nums text-foreground">R$ 12.400</span>
            <span className="text-muted-foreground text-sm">vs.</span>
            <span className="text-xs text-text-tertiary">— Restrito —</span>
          </Demo>
          <Demo label="Carregar mais / paginação">
            <Button
              variant="outline"
              size="sm"
              disabled={loadingMore}
              onClick={() => { setLoadingMore(true); window.setTimeout(() => setLoadingMore(false), 1200) }}
            >
              {loadingMore ? <><Loader2 className="size-3.5 animate-spin" />Carregando…</> : 'Carregar mais'}
            </Button>
          </Demo>
        </div>
      </ShowcaseCard>

      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="Badges de status de deal · outcome de upsell">
          <div className="space-y-4">
            <Demo label="Status do deal">
              {DEAL_STATUS.map((b) => (
                <span key={b.label} className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', b.cls)}>{b.label}</span>
              ))}
            </Demo>
            <Demo label="Outcome de contato (upsell)">
              {OUTCOMES.map((b) => (
                <span key={b.label} className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', b.cls)}>{b.label}</span>
              ))}
            </Demo>
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Barra de adoção (% por vendedora)">
          <div className="space-y-3">
            {ADOPTION.map((a) => (
              <div key={a.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{a.name}</span>
                  <span className="tabular-nums text-muted-foreground">{a.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      a.pct >= 80 ? 'bg-status-success-text' : a.pct >= 50 ? 'bg-status-warning-text' : 'bg-status-error-text'
                    )}
                    style={{ width: `${a.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </ShowcaseCard>
      </div>
    </ShowcaseSection>
  )
}
