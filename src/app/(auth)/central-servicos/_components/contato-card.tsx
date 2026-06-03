'use client'

import { Mail, MessageCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { ContatoAvatar } from './contato-avatar'
import {
  CONTATO_UNIDADE_LABELS,
  buildWhatsappUrl,
  type CentralServicosContato,
} from '@/types/central-servicos'

interface ContatoCardProps {
  contato: CentralServicosContato
  signedUrl?: string
  canEdit: boolean
  onEdit: (c: CentralServicosContato) => void
}

export function ContatoCard({ contato, signedUrl, canEdit, onEdit }: ContatoCardProps) {
  const whatsapp = buildWhatsappUrl(contato.telefone)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        !contato.ativo && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <ContatoAvatar src={signedUrl} nome={contato.nome} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{contato.nome}</h3>
            {!contato.ativo && (
              <Badge variant="secondary" className="shrink-0">Inativo</Badge>
            )}
          </div>
          {contato.cargo && (
            <p className="truncate text-xs text-muted-foreground">{contato.cargo}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {contato.setor && (
              <span className="text-xs text-muted-foreground">{contato.setor}</span>
            )}
            <Badge variant="outline">{CONTATO_UNIDADE_LABELS[contato.unidade]}</Badge>
          </div>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(contato)}
            aria-label={`Editar ${contato.nome}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      {(contato.email || whatsapp) && (
        <div className="flex flex-wrap items-center gap-2">
          {contato.email && (
            <a
              href={`mailto:${contato.email}`}
              className="inline-flex items-center gap-1.5 text-xs text-text-link hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{contato.email}</span>
            </a>
          )}
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'ml-auto')}
            >
              <MessageCircle className="mr-1.5 h-4 w-4" />
              WhatsApp
            </a>
          )}
        </div>
      )}
    </div>
  )
}
