'use client'

import { CalendarDays, Users, Wrench, TrendingUp, DollarSign, Clock, Lock } from 'lucide-react'
import type { MaintenanceStatus, MaintenanceType } from '@/types/database.types'
import { CHART_COLORS } from '@/lib/constants/brand-colors'

import { KpiCard, TrendBadge } from '@/components/features/dashboard/kpi-card'
import { StatsCard } from '@/components/features/dashboard/stats-card'
import { ReportStatsCard } from '@/components/features/reports/report-stats-card'
import {
  MaintenanceStatusBadge, MaintenancePriorityBadge, MAINTENANCE_STATUS_CONFIG, MAINTENANCE_PRIORITY_CONFIG,
} from '@/components/features/maintenance/maintenance-status-badge'
import {
  MaintenanceTypeBadge, MAINTENANCE_TYPE_CONFIG,
} from '@/components/features/maintenance/maintenance-type-badge'
import { PloomeBadge } from '@/components/features/ploomes/ploomes-badge'

import { ShowcaseSection, ShowcaseCard, Demo } from './primitives'

const SPARK = [{ v: 10 }, { v: 14 }, { v: 9 }, { v: 18 }, { v: 22 }, { v: 28 }]
const SPARK2 = [{ v: 30 }, { v: 26 }, { v: 28 }, { v: 20 }, { v: 18 }, { v: 14 }]
const SPARK3 = [{ v: 5 }, { v: 8 }, { v: 6 }, { v: 4 }, { v: 3 }, { v: 2 }]

// ─────────────────────────────────────────────────────────────
// Átomos de feature renderizáveis com mock (presentacionais)
// ─────────────────────────────────────────────────────────────
export function ComponentesFeature() {
  return (
    <ShowcaseSection
      id="feature"
      title="Componentes de feature — átomos"
      description="Componentes de módulo presentacionais e mockáveis (sem objeto de domínio). Os demais — que recebem Event/Order/Deal ou dados de RPC — estão no catálogo abaixo."
    >
      <ShowcaseCard title="KpiCard · TrendBadge" hint="dashboard/ · sparkline Recharts">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Eventos do Mês" value={42} icon={CalendarDays} iconClass="icon-brand" strokeColor={CHART_COLORS.primary} spark={SPARK} trend={12} href="#" />
            <KpiCard label="Leads do Mês" value={128} icon={Users} iconClass="icon-blue" strokeColor={CHART_COLORS.tealMid} spark={SPARK2} trend={-5} href="#" />
            <KpiCard label="Manutenções Abertas" value={3} icon={Wrench} iconClass="icon-amber" strokeColor={CHART_COLORS.danger} spark={SPARK3} trend={-20} invertTrend href="#" />
          </div>
          <Demo label="TrendBadge (alta / queda / estável)">
            <TrendBadge trend={12} /><TrendBadge trend={-8} /><TrendBadge trend={0} />
          </Demo>
        </div>
      </ShowcaseCard>

      <div className="grid gap-6 md:grid-cols-2">
        <ShowcaseCard title="StatsCard" hint="dashboard/">
          <StatsCard title="Checklists pendentes" value={7} icon={Clock} description="Aguardando conclusão" iconClass="icon-purple" />
        </ShowcaseCard>
        <ShowcaseCard title="ReportStatsCard" hint="reports/ · accent">
          <div className="grid grid-cols-2 gap-3">
            <ReportStatsCard title="Receita" value="R$ 84k" subtitle="no período" icon={DollarSign} accent="success" />
            <ReportStatsCard title="Atrasos" value={4} subtitle="acima do SLA" icon={Clock} accent="danger" />
            <ReportStatsCard title="Conversão" value="62%" icon={TrendingUp} accent="default" />
            <ReportStatsCard title="A vencer" value={9} icon={CalendarDays} accent="warning" />
          </div>
        </ShowcaseCard>
      </div>

      <ShowcaseCard title="Badges de Manutenção" hint="maintenance/ · status / prioridade / tipo">
        <div className="space-y-4">
          <Demo label="Status">
            {(Object.keys(MAINTENANCE_STATUS_CONFIG) as MaintenanceStatus[]).map((s) => (
              <MaintenanceStatusBadge key={s} status={s} />
            ))}
          </Demo>
          <Demo label="Prioridade">
            {Object.keys(MAINTENANCE_PRIORITY_CONFIG).map((p) => (
              <MaintenancePriorityBadge key={p} priority={p} />
            ))}
          </Demo>
          <Demo label="Tipo">
            {(Object.keys(MAINTENANCE_TYPE_CONFIG) as MaintenanceType[]).map((t) => (
              <MaintenanceTypeBadge key={t} type={t} />
            ))}
          </Demo>
        </div>
      </ShowcaseCard>

      <ShowcaseCard title="PloomeBadge" hint="ploomes/">
        <Demo>
          <PloomeBadge url="https://app10.ploomes.com/deal/1" />
          <PloomeBadge size="xs" />
        </Demo>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}

// ─────────────────────────────────────────────────────────────
// Catálogo de referência — layout/chrome + features por módulo
// ─────────────────────────────────────────────────────────────
const LAYOUT_REF: { name: string; role: string; wired?: boolean }[] = [
  { name: 'app-layout', role: 'Shell autenticado (sidebar + navbar + main).' },
  { name: 'auth-guard', role: 'Redireciona não-autenticado para /login.' },
  { name: 'navbar', role: 'Barra superior: busca, unit-switcher, sino, avatar.', wired: true },
  { name: 'sidebar', role: 'Navegação lateral colapsável (nav-items + rota).', wired: true },
  { name: 'breadcrumbs', role: 'Trilha de navegação derivada da rota.', wired: true },
  { name: 'notification-bell', role: 'Sino + slide-over de notificações.', wired: true },
  { name: 'unit-switcher', role: 'Troca de unidade ativa.', wired: true },
  { name: 'unit-accent-wrapper', role: 'Aplica a cor de destaque da unidade.' },
  { name: 'impersonate-banner', role: 'Faixa "Ver como" no topo.', wired: true },
  { name: 'impersonate-exit-bar', role: 'Barra para sair da impersonação.', wired: true },
]

const FEATURE_REF: { mod: string; items: string }[] = [
  { mod: 'audit', items: 'audit-diff · audit-filters · audit-log-table' },
  { mod: 'bi', items: 'bi-adoption-card · bi-breakdown-by-unit · bi-funnel · bi-trend-charts · bi-unit-comparison · category-drilldown-sheet · drilldown-deal-card · lead-origin-panel/-section · seller-drilldown-sheet · seller-orders-drilldown-sheet · sellers-charts · sellers-ranking-table · sellers-tab · stage-drilldown · vendas-por-categoria-section · vendas-realizadas-tab' },
  { mod: 'checklists', items: 'add-checklist-modal · checklist-card · checklist-item-row · checklist-progress · sortable-template-items' },
  { mod: 'command-palette', items: 'command-palette (⌘K)' },
  { mod: 'dashboard', items: 'calendar-view · calendar-export/* · event-quick-view · kpi-card ✓ · next-event-card · pre-reserva-modal · pre-reserva-detail-modal · stats-card ✓' },
  { mod: 'equipment', items: 'equipment-card · equipment-form' },
  { mod: 'events', items: 'event-card · event-day-group · event-filters · event-form · event-temporal-tabs · event-timeline · events-kpi-cards · pre-reserva-card · pre-reserva-ploomes-card' },
  { mod: 'keyboard-shortcuts', items: 'shortcuts-modal' },
  { mod: 'maintenance', items: 'contact-list · cost-card · cost-form-modal · costs-tab · history-tab/-timeline · kanban-board/-card · maintenance-agenda-calendar · maintenance-card · maintenance-charts · maintenance-filters · maintenance-form · maintenance-kpis · maintenance-status-badge ✓ · maintenance-type-badge ✓ · maintenance-tabs · maintenance-timeline · overdue-banner · photo-section · preventive-schedule · quick-actions-bar · quick-cost-sheet · reject-cost-modal · sla-card · status-bottom-sheet · supplier-card/-form/-list/-document-section/-rating · ticket-card · ticket-form-modal · ticket-kanban-board · unit-picker-banner' },
  { mod: 'onboarding', items: 'guided-tour · setup-checklist-card · welcome-modal' },
  { mod: 'ploomes', items: 'field-mapping-card · mapping-contact/-field/-pipeline/-status-card · ploomes-badge ✓ · ploomes-event-details · sync-history-table · sync-status-card' },
  { mod: 'pwa', items: 'install-banner · splash-screen · service-worker-updater' },
  { mod: 'reports', items: 'bar-chart-card · donut-chart-card · horizontal-bar-chart-card · report-stats-card ✓ · report-filters · export-button · events-tab · maintenance-tab · checklists-tab · staff-tab' },
  { mod: 'settings', items: 'brand-identity-tab · business-hours-tab · config-table · general-settings-tab' },
]

export function CatalogoModulos() {
  return (
    <ShowcaseSection
      id="catalogo"
      title="Catálogo — layout & features"
      description="Mapa de referência dos componentes fora de ui/+shared/. Os de layout são 'chrome' presos a sessão/stores; os de feature recebem objeto de domínio ou dados de RPC. ✓ = já renderizado ao vivo acima."
    >
      <ShowcaseCard title="Layout / chrome" hint="src/components/layout/ · cadeado = wired a sessão/stores">
        <ul className="divide-y divide-border-default text-sm">
          {LAYOUT_REF.map((c) => (
            <li key={c.name} className="flex flex-wrap items-center gap-x-2 py-1.5">
              <code className="text-code text-foreground">{c.name}</code>
              {c.wired && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="wired a sessão/stores" />}
              <span className="text-muted-foreground">— {c.role}</span>
            </li>
          ))}
        </ul>
      </ShowcaseCard>

      <ShowcaseCard title="Features por módulo" hint="src/components/features/ · ~110 componentes">
        <div className="space-y-3">
          {FEATURE_REF.map((m) => (
            <div key={m.mod} className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <code className="text-code text-foreground">{m.mod}/</code>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.items}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Estes não são renderizados ao vivo aqui porque dependem de dados de domínio (Event, MaintenanceOrder, Deal…) ou de hooks/RPC. Para vê-los em contexto, abra o módulo correspondente. Os átomos mockáveis (✓) já aparecem na seção acima.
        </p>
      </ShowcaseCard>
    </ShowcaseSection>
  )
}
