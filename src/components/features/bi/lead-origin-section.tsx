'use client'

// ============================================================
// LeadOriginSection — Painel "Origem dos Leads" no /bi
// ============================================================
// Renderiza um LeadOriginPanel por unidade, lado a lado
// (mobile: coluna única; md+: 2 colunas).
//
// Props:
//   units  — lista de unidades do usuário (de userUnits.map)
//   months — período selecionado (vem da pill na page.tsx)
//
// Não tem state próprio de período: recebe `months` via prop
// e reage automaticamente quando o usuário troca a pill no topo
// da página Visão Geral — comportamento consistente com
// BIUnitComparison que segue o mesmo padrão.
// ============================================================

import { BarChart3 } from 'lucide-react'
import { LeadOriginPanel } from './lead-origin-panel'

interface Unit {
  id:   string
  name: string
}

interface Props {
  units:  Unit[]
  months: number
}

export function LeadOriginSection({ units, months }: Props) {
  if (units.length === 0) return null

  return (
    <div className="rounded-xl border border-border-default bg-card overflow-hidden">
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-text-tertiary" />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Origem dos Leads</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Distribuição percentual por canal de captação — últimos {months === 24 ? 'todos os' : months} meses
          </p>
        </div>
      </div>

      {/* Grid de painéis: 1 coluna mobile → 2 colunas md+ */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {units.map((u) => (
            <LeadOriginPanel
              key={u.id}
              unitId={u.id}
              unitName={u.name}
              months={months}
            />
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-text-tertiary mt-2">
          Dados de origem disponíveis a partir de mai/2025. Negócios anteriores podem aparecer
          em &ldquo;(sem origem)&rdquo; caso o campo não tenha sido preenchido no Ploomes.
        </p>
      </div>
    </div>
  )
}
