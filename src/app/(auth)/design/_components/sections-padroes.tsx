import type { ReactNode } from 'react'
import { ShowcaseSection } from './primitives'
import { CodeBlock } from './primitives'

function Pattern({
  title,
  why,
  bad,
  good,
}: {
  title: string
  why: string
  bad: ReactNode
  good: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border-default bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 mb-3 text-sm text-muted-foreground">{why}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-status-error-text">✗ Errado</span>
          <CodeBlock tone="bad">{bad}</CodeBlock>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold text-status-success-text">✓ Certo</span>
          <CodeBlock tone="good">{good}</CodeBlock>
        </div>
      </div>
    </div>
  )
}

export function Padroes() {
  return (
    <ShowcaseSection
      id="padroes"
      title="Padrões & anti-padrões"
      description="As regras duras do design system. Os exemplos 'errado' são apenas texto — nada aqui usa código incorreto de verdade."
    >
      <Pattern
        title="Hex hardcoded na UI"
        why="Hex cru não adapta ao dark mode e foge dos tokens. Use tokens semânticos."
        bad={`<div className="bg-[#7C8D78] text-[#fff]">`}
        good={`<div className="bg-primary text-primary-foreground">`}
      />
      <Pattern
        title="Tint cru sem dark: vs classes .badge-/.icon-"
        why="bg-blue-50/text-blue-700 quebra no dark mode (fundo claro + texto claro). As classes utilitárias já trazem o par claro+escuro."
        bad={`<span className="bg-blue-50 text-blue-700 border-blue-200">`}
        good={`<span className="badge-blue border">  {/* ou icon-blue */}`}
      />
      <Pattern
        title="Skeleton de loading"
        why="animate-pulse usa --muted e fica inconsistente; .skeleton-shimmer é o padrão dark-safe."
        bad={`<div className="bg-muted animate-pulse h-4 w-32" />`}
        good={`<div className="skeleton-shimmer h-4 w-32" />\n{/* ou <Skeleton className="h-4 w-32" /> */}`}
      />
      <Pattern
        title="Botão que navega"
        why="Button asChild NÃO é suportado neste stack (@base-ui). Use Link com buttonVariants."
        bad={`<Button asChild><Link href="/x">Ir</Link></Button>`}
        good={`<Link href="/x" className={cn(buttonVariants({ variant: 'outline' }))}>Ir</Link>`}
      />
      <Pattern
        title="HTML para html2canvas / impressão"
        why="html2canvas não entende o oklch() que o Tailwind v4 gera. Em export PNG / window.print use inline styles com hex."
        bad={`<div className="bg-primary text-foreground">  {/* vira oklch → quebra */}`}
        good={`<div style={{ backgroundColor: '#7C8D78', color: '#1A1A1A' }}>`}
      />
      <Pattern
        title="Touch target mínimo (44px)"
        why="Alvos de toque pequenos falham em mobile/acessibilidade. Envolva o elemento pequeno num wrapper de 44px."
        bad={`<button className="p-1"><X className="size-3" /></button>`}
        good={`<button className="inline-flex size-11 items-center justify-center">\n  <X className="size-3" />\n</button>`}
      />
    </ShowcaseSection>
  )
}
