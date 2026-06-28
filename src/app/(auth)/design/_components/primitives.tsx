import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Primitivos de apresentação da vitrine `/design`.
 * São helpers EXCLUSIVOS desta rota (não são abstrações reutilizáveis do app);
 * existem só para organizar o showcase com consistência.
 */

/** Seção com âncora (alvo da nav lateral) + título + descrição. */
export function ShowcaseSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4 border-b border-border-default pb-3">
        <h2 className="text-heading-3 text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  )
}

/** Cartão container (não existe Card base em ui/ — usamos o padrão do projeto). */
export function ShowcaseCard({
  title,
  hint,
  children,
  className,
}: {
  title?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-border-default bg-card p-5', className)}>
      {(title || hint) && (
        <div className="mb-4 flex items-baseline justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

/** Célula rotulada para exibir um componente/variante em contexto. */
export function Demo({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      )}
      <div className={cn('flex flex-wrap items-center gap-3', className)}>{children}</div>
    </div>
  )
}

/** Amostra de cor (rampa ou token semântico). `swatchClassName` aplica o bg real. */
export function Swatch({
  swatchClassName,
  name,
  value,
}: {
  swatchClassName: string
  name: string
  value?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          'h-12 w-full rounded-md border border-border-default',
          swatchClassName
        )}
      />
      <span className="font-mono text-[11px] text-foreground">{name}</span>
      {value && (
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {value}
        </span>
      )}
    </div>
  )
}

/** Bloco de código (string). `tone` colore exemplos errado/certo dos anti-padrões. */
export function CodeBlock({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'bad' | 'good'
}) {
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-md border p-3 text-xs leading-relaxed',
        tone === 'bad' &&
          'border-status-error-border bg-status-error-bg text-status-error-text',
        tone === 'good' &&
          'border-status-success-border bg-status-success-bg text-status-success-text',
        tone === 'neutral' &&
          'border-border-default bg-surface-tertiary text-foreground'
      )}
    >
      <code className="font-mono whitespace-pre-wrap break-words">{children}</code>
    </pre>
  )
}
