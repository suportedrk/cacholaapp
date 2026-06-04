'use client'

import { MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildWhatsappUrl, buildTelUrl } from '@/types/central-servicos'

interface Props {
  telefone: string | null
  nome: string
  className?: string
}

const ICON = 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors'

/**
 * Dois ícones pequenos e alinhados para a coluna "Telefone": WhatsApp (wa.me) e
 * ligar (tel:). Sem telefone (ou grupo) → ícones apagados/desabilitados, sem clique.
 */
export function ContatoTelefoneAcoes({ telefone, nome, className }: Props) {
  const whatsapp = buildWhatsappUrl(telefone)
  const tel = buildTelUrl(telefone)
  const ativo = !!whatsapp && !!tel

  if (!ativo) {
    return (
      <div className={cn('flex items-center gap-1', className)} aria-hidden="true">
        <span className={cn(ICON, 'text-muted-foreground/30')}>
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className={cn(ICON, 'text-muted-foreground/30')}>
          <Phone className="h-4 w-4" />
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <a
        href={whatsapp!}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(ICON, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        aria-label={`WhatsApp de ${nome}`}
        title="WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
      <a
        href={tel!}
        className={cn(ICON, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
        aria-label={`Ligar para ${nome}`}
        title="Ligar"
      >
        <Phone className="h-4 w-4" />
      </a>
    </div>
  )
}
