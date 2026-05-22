import { cn } from '@/lib/utils'

interface ForminhaColorDotProps {
  corHex: string | null
  /** sm = 16px (bolinhas dentro de temas), md = 28px (tela de cores) */
  size?: 'sm' | 'md'
  numero?: number
  nome?: string
  className?: string
}

const SIZE_PX = { sm: 16, md: 28 } as const

/**
 * Bolinha colorida da legenda de forminhas.
 * Cor não definida (cor_hex null) → círculo tracejado vazio.
 */
export function ForminhaColorDot({
  corHex,
  size = 'sm',
  numero,
  nome,
  className,
}: ForminhaColorDotProps) {
  const px = SIZE_PX[size]
  const title =
    numero != null ? `Nº ${numero}${nome ? ` — ${nome}` : ''}` : (nome ?? undefined)

  if (!corHex) {
    return (
      <span
        title={title}
        aria-label={title ?? 'Cor não definida'}
        className={cn(
          'inline-block shrink-0 rounded-full border-2 border-dashed border-border-strong bg-transparent',
          className,
        )}
        style={{ width: px, height: px }}
      />
    )
  }

  return (
    <span
      title={title}
      aria-label={title ?? 'Cor da forminha'}
      className={cn(
        'inline-block shrink-0 rounded-full border border-border-default',
        className,
      )}
      style={{ width: px, height: px, backgroundColor: corHex }}
    />
  )
}
