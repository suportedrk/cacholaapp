'use client'

import { Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ShowcaseNav, type ShowcaseSectionRef } from './_components/showcase-nav'
import {
  TokensCores,
  TokensSemanticos,
  TokensTipografia,
  TokensEspacoSombra,
  TokensUtilitarias,
} from './_components/sections-tokens'
import { ComponentesUI, ComponentesShared } from './_components/sections-componentes'
import { ComponentesFeature, CatalogoModulos } from './_components/sections-extras'
import { Graficos, ChromeNavegacao, EstadosFeedback, ChipsIndicadores } from './_components/sections-tier-a'
import { Padroes } from './_components/sections-padroes'

const SECTIONS: ShowcaseSectionRef[] = [
  { id: 'cores', label: 'Cores' },
  { id: 'semanticos', label: 'Tokens semânticos' },
  { id: 'tipografia', label: 'Tipografia' },
  { id: 'espaco', label: 'Espaço & sombra' },
  { id: 'utilitarias', label: 'Classes utilitárias' },
  { id: 'ui', label: 'Componentes ui/' },
  { id: 'shared', label: 'Componentes shared/' },
  { id: 'feature', label: 'Componentes de feature' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'chrome-live', label: 'Chrome & navegação' },
  { id: 'estados', label: 'Estados & feedback' },
  { id: 'indicadores', label: 'Chips & indicadores' },
  { id: 'catalogo', label: 'Catálogo (layout & features)' },
  { id: 'padroes', label: 'Padrões' },
]

export default function DesignPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Design System"
        description="Vitrine viva dos tokens e componentes do Cachola OS — renderizada com os tokens REAIS."
      />

      {/* Regra de ouro + dica de dark mode */}
      <div className="flex items-start gap-2 rounded-lg border border-status-info-border bg-status-info-bg px-4 py-3 text-status-info-text">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-semibold">Regra de ouro:</span> classe utilitária
            {' '}(<code className="text-code">.badge-/.icon-/.card-interactive</code>) › token semântico
            {' '}(<code className="text-code">bg-surface-*</code>, <code className="text-code">text-status-*</code>) › rampa
            {' '}(<code className="text-code">bg-brand-500</code>) › hex (só Recharts/jsPDF/e-mail/print).
          </p>
          <p className="text-status-info-text/80">
            Use o toggle <span className="font-medium">Sol/Lua</span> na navbar para validar o dark mode — toda esta página re-temiza sozinha.
          </p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
        {/* Nav lateral sticky (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <ShowcaseNav sections={SECTIONS} />
          </div>
        </aside>

        {/* Conteúdo */}
        <div className="min-w-0 space-y-14">
          {/* Nav horizontal (mobile) */}
          <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="focus-ring shrink-0 rounded-full border border-border-default px-3 py-1 text-xs text-muted-foreground"
              >
                {s.label}
              </a>
            ))}
          </div>

          <TokensCores />
          <TokensSemanticos />
          <TokensTipografia />
          <TokensEspacoSombra />
          <TokensUtilitarias />
          <ComponentesUI />
          <ComponentesShared />
          <ComponentesFeature />
          <Graficos />
          <ChromeNavegacao />
          <EstadosFeedback />
          <ChipsIndicadores />
          <CatalogoModulos />
          <Padroes />
        </div>
      </div>
    </div>
  )
}
