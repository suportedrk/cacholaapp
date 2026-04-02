'use client'

import { useState, useMemo } from 'react'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Wrench,
  Handshake,
  Settings2,
  Search,
  Info,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/shared/page-header'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

type Module = 'dashboard' | 'events' | 'checklists' | 'maintenance' | 'providers' | 'settings'

interface BusinessRule {
  id: string
  module: Module
  name: string
  description: string
  calculation: string[]
  comparison?: string
  note?: string
  updatedAt: string
}

// ─────────────────────────────────────────────────────────────
// DADOS ESTÁTICOS
// ─────────────────────────────────────────────────────────────

const BUSINESS_RULES: BusinessRule[] = [
  {
    id: 'dashboard-eventos-mes',
    module: 'dashboard',
    name: 'Eventos do Mês',
    description:
      'Quantidade de festas confirmadas e abertas com data marcada para o mês atual.',
    calculation: [
      'Funil: Cachola',
      'Estágio do funil: Festa Fechada',
      'Conta eventos com status "confirmed" (inclui deals ganhos e reabertos para excedente)',
      'Exclui deals perdidos (status "lost")',
      'Filtra pela data da festa (campo date) no mês atual',
      'Filtrado pela unidade selecionada no sistema',
    ],
    comparison:
      'Variação percentual comparada com o mesmo cálculo do mês anterior.',
    note:
      'No Ploomes, "confirmed" agrupa StatusId 1 (Em aberto / reaberto para excedente) e StatusId 2 (Ganho), ambos no estágio "Festa Fechada". Apenas StatusId 3 (Perdido) é excluído.',
    updatedAt: 'Abril 2026',
  },
  {
    id: 'dashboard-conversao',
    module: 'dashboard',
    name: 'Taxa de Conversão',
    description:
      'De todos os orçamentos que tiveram uma decisão (cliente fechou ou desistiu), qual porcentagem virou festa.',
    calculation: [
      'Fórmula: Eventos do Mês ÷ (Eventos do Mês + Perdidos no mês) × 100',
      '"Eventos do Mês" segue a regra de KPI correspondente',
      '"Perdidos" = deals com status "lost" e data da festa no mês',
      'Orçamentos ainda em negociação (sem decisão) não entram no cálculo',
      'Se não houver nenhum deal com decisão no mês, exibe "—"',
      'Filtrado pela unidade selecionada no sistema',
    ],
    comparison:
      'Variação em pontos percentuais comparada com o mês anterior.',
    updatedAt: 'Abril 2026',
  },
  {
    id: 'dashboard-leads',
    module: 'dashboard',
    name: 'Leads do Mês',
    description:
      'Total de orçamentos/leads que têm festa marcada para o mês atual, independente do resultado.',
    calculation: [
      'Conta TODOS os deals com data da festa no mês (confirmed + lost)',
      'Inclui todos os status: fechou, perdeu ou reabriu',
      'Filtrado pela unidade selecionada no sistema',
    ],
    comparison:
      'Variação percentual comparada com o mês anterior.',
    note:
      'A data usada é sempre a data da festa (campo date), não a data de criação do deal no Ploomes. Todos os deals foram importados em batch, portanto o created_at reflete a data do sync, não a data real de entrada do lead.',
    updatedAt: 'Abril 2026',
  },
  {
    id: 'dashboard-manutencoes',
    module: 'dashboard',
    name: 'Manutenções Abertas',
    description:
      'Quantidade de ordens de manutenção pendentes na unidade no momento atual.',
    calculation: [
      'Conta todas as ordens de manutenção com status aberto/em andamento/aguardando peças',
      'Exclui ordens concluídas e canceladas',
      'Filtrado pela unidade selecionada no sistema',
    ],
    comparison:
      'Compara com o total de manutenções abertas 30 dias atrás. Uma ordem "estava aberta" se foi criada antes do corte e não havia sido concluída até aquela data.',
    note:
      'Para manutenções, menos é melhor — as cores de tendência são invertidas: queda = verde (bom), alta = vermelho (ruim).',
    updatedAt: 'Abril 2026',
  },
  {
    id: 'dashboard-checklists',
    module: 'dashboard',
    name: 'Checklists Pendentes',
    description:
      'Quantidade de checklists ainda não concluídos na unidade no momento atual.',
    calculation: [
      'Conta todos os checklists com status pendente (não concluído e não cancelado)',
      'Exclui checklists concluídos e cancelados',
      'Filtrado pela unidade selecionada no sistema',
    ],
    comparison:
      'Compara com o total de checklists pendentes 30 dias atrás, usando a mesma lógica de corte temporal.',
    note:
      'Assim como manutenções, menos é melhor — cores de tendência invertidas: queda = verde (bom), alta = vermelho (ruim).',
    updatedAt: 'Abril 2026',
  },
  {
    id: 'settings-ploomes-unit-mapping',
    module: 'settings',
    name: 'Associação de Unidade por Deal',
    description:
      'Define a qual unidade do Cachola OS cada deal/evento importado do Ploomes pertence.',
    calculation: [
      'Ao importar um deal, o sync lê o campo "Unidade Escolhida" (ObjectValueName)',
      'Consulta a tabela ploomes_unit_mapping para encontrar o unit_id correspondente',
      'Se não encontrar mapeamento exato, tenta busca parcial no nome da unidade (ilike)',
      'Se ainda não encontrar, atribui à primeira unidade ativa (fallback)',
    ],
    comparison:
      'Configurável via banco — adicionar linha em ploomes_unit_mapping para novas unidades sem necessidade de redeploy.',
    note:
      'Valores mapeados atualmente: "Cachola PINHEIROS" → Buffet Cachola Pinheiros | "Cachola MOEMA" → Buffet Cachola Moema. Ao criar uma nova unidade no Ploomes, inserir o mapeamento correspondente na tabela ploomes_unit_mapping.',
    updatedAt: '2026-04-02',
  },
]

// ─────────────────────────────────────────────────────────────
// CONFIG DE MÓDULOS
// ─────────────────────────────────────────────────────────────

const MODULE_CONFIG: Record<
  Module,
  { label: string; Icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  dashboard:   { label: 'Dashboard',    Icon: LayoutDashboard, badgeClass: 'badge-brand' },
  events:      { label: 'Eventos',      Icon: CalendarDays,    badgeClass: 'badge-blue'  },
  checklists:  { label: 'Checklists',   Icon: ClipboardList,   badgeClass: 'badge-green' },
  maintenance: { label: 'Manutenção',   Icon: Wrench,          badgeClass: 'badge-amber' },
  providers:   { label: 'Prestadores',  Icon: Handshake,       badgeClass: 'badge-purple'},
  settings:    { label: 'Configurações',Icon: Settings2,       badgeClass: 'badge-gray'  },
}

const MODULES_ORDER: Module[] = ['dashboard', 'settings', 'events', 'checklists', 'maintenance', 'providers']
const MODULES_COMING_SOON: Module[] = ['events', 'checklists', 'maintenance', 'providers']

// ─────────────────────────────────────────────────────────────
// CARD DE REGRA
// ─────────────────────────────────────────────────────────────

function RuleCard({ rule }: { rule: BusinessRule }) {
  const mod = MODULE_CONFIG[rule.module]

  return (
    <article className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 icon-brand">
            <mod.Icon className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-foreground text-base leading-tight">
            {rule.name}
          </h3>
        </div>
        <span className={cn('badge-gray border text-[11px] shrink-0 px-2 py-0.5 rounded-full font-medium')}>
          {mod.label}
        </span>
      </div>

      {/* O que mede */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          O que mede
        </p>
        <p className="text-sm text-foreground leading-relaxed">{rule.description}</p>
      </section>

      {/* Como calcula */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Como calcula
        </p>
        <ul className="space-y-1">
          {rule.calculation.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Comparação */}
      {rule.comparison && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Comparação com período anterior
          </p>
          <p className="text-sm text-foreground leading-relaxed">{rule.comparison}</p>
        </section>
      )}

      {/* Nota */}
      {rule.note && (
        <div className="flex gap-2.5 rounded-lg bg-blue-50 border-l-4 border-blue-400 px-3 py-2.5 dark:bg-blue-950/30 dark:border-blue-600">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{rule.note}</p>
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
        Última atualização: {rule.updatedAt}
      </p>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// SEÇÃO DE MÓDULO (ACORDEÃO)
// ─────────────────────────────────────────────────────────────

function ModuleSection({
  module,
  rules,
  defaultOpen,
}: {
  module: Module
  rules: BusinessRule[]
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false)
  const mod = MODULE_CONFIG[module]
  const isComingSoon = MODULES_COMING_SOON.includes(module) && rules.length === 0

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-5 py-4',
          'text-left transition-colors duration-150',
          'hover:bg-muted/40',
          isOpen && 'bg-muted/20',
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            module === 'dashboard' ? 'icon-brand' : 'icon-gray',
          )}>
            <mod.Icon className="w-4 h-4" />
          </div>
          <span className="font-semibold text-foreground">{mod.label}</span>
          {!isComingSoon && (
            <span className="text-[11px] text-muted-foreground font-medium">
              {rules.length} {rules.length === 1 ? 'regra' : 'regras'}
            </span>
          )}
          {isComingSoon && (
            <span className="badge-gray border text-[11px] px-2 py-0.5 rounded-full font-medium">
              Em breve
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Conteúdo — CSS grid animation */}
      <div
        className="grid transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-2 border-t border-border">
            {isComingSoon ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                As regras deste módulo serão documentadas em breve.
              </p>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function RegrasPage() {
  const [search, setSearch] = useState('')

  const searchLower = search.trim().toLowerCase()

  // Filtrar regras que batem na busca
  const filteredByModule = useMemo<Record<Module, BusinessRule[]>>(() => {
    const result: Partial<Record<Module, BusinessRule[]>> = {}
    for (const mod of MODULES_ORDER) {
      if (!searchLower) {
        result[mod] = BUSINESS_RULES.filter((r) => r.module === mod)
      } else {
        result[mod] = BUSINESS_RULES.filter(
          (r) =>
            r.module === mod &&
            (r.name.toLowerCase().includes(searchLower) ||
              r.description.toLowerCase().includes(searchLower) ||
              r.calculation.some((c) => c.toLowerCase().includes(searchLower)) ||
              (r.note ?? '').toLowerCase().includes(searchLower)),
        )
      }
    }
    return result as Record<Module, BusinessRule[]>
  }, [searchLower])

  const totalFiltered = Object.values(filteredByModule).reduce((s, a) => s + a.length, 0)
  const hasSearch = searchLower.length > 0

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Regras de Negócio"
          description="Documentação das regras e cálculos utilizados no sistema"
        />
        <span className="badge-gray border text-xs px-2.5 py-1 rounded-full font-medium shrink-0 self-start mt-1">
          Somente leitura
        </span>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar regras de negócio…"
          className={cn(
            'w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'transition-colors duration-150',
          )}
        />
      </div>

      {/* Empty state da busca */}
      {hasSearch && totalFiltered === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Search className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Nenhuma regra encontrada para{' '}
            <span className="font-medium text-foreground">&quot;{search}&quot;</span>
          </p>
          <button
            onClick={() => setSearch('')}
            className="text-xs text-primary underline underline-offset-4"
          >
            Limpar busca
          </button>
        </div>
      )}

      {/* Seções por módulo */}
      {(!hasSearch || totalFiltered > 0) && (
        <div className="space-y-3">
          {MODULES_ORDER.map((mod) => {
            const rules = filteredByModule[mod]
            // Durante busca ativa, ocultar módulos sem resultados (exceto "em breve")
            if (hasSearch && rules.length === 0) return null
            return (
              <ModuleSection
                key={mod}
                module={mod}
                rules={rules}
                defaultOpen={mod === 'dashboard'}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
