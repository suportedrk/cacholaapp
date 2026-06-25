import { FileCheck2, FileX2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractSignedBadgeProps {
  /**
   * Estado do contrato (Clicksign) agregado das orders da festa:
   *   null  -> festa sem documento de venda (não renderiza nada)
   *   false -> "Não assinado"
   *   true  -> "Assinado"
   */
  signed: boolean | null | undefined
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Etiqueta de contrato assinado (Clicksign). Escondida quando `signed` é
 * null/undefined (festa sem nenhum documento de venda — decisão de produto).
 * Usada na listagem de eventos e no topo do detalhe da festa.
 */
export function ContractSignedBadge({ signed, size = 'sm', className }: ContractSignedBadgeProps) {
  if (signed === null || signed === undefined) return null

  const Icon = signed ? FileCheck2 : FileX2

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        signed ? 'badge-green' : 'badge-red',
        className,
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
      {signed ? 'Assinado' : 'Não assinado'}
    </span>
  )
}
