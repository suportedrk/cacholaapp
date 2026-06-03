'use client'

import { useState } from 'react'
import { Pencil, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AVISO_CATEGORIA_LABELS,
  CONTATO_UNIDADE_LABELS,
  avisoEstado,
  type CentralServicosAviso,
} from '@/types/central-servicos'

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

function fmt(iso: string): string {
  return dateFmt.format(new Date(iso))
}

interface AvisoCardProps {
  aviso: CentralServicosAviso
  canEdit: boolean
  onEdit: (a: CentralServicosAviso) => void
}

const LIMITE_CONTEUDO = 220

export function AvisoCard({ aviso, canEdit, onEdit }: AvisoCardProps) {
  const isAlta = aviso.prioridade === 'alta'
  const estado = avisoEstado(aviso)
  const longo = aviso.conteudo.length > LIMITE_CONTEUDO
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4',
        isAlta ? 'border-status-warning-text/40 border-l-4 border-l-status-warning-text' : 'border-border',
        estado !== 'vigente' && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {isAlta && (
              <Badge className="gap-1 bg-status-warning-bg text-status-warning-text">
                <AlertTriangle className="h-3 w-3" />
                Alta
              </Badge>
            )}
            <h3 className="text-sm font-semibold text-foreground">{aviso.titulo}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{AVISO_CATEGORIA_LABELS[aviso.categoria]}</Badge>
            <Badge variant="secondary">{CONTATO_UNIDADE_LABELS[aviso.unidade]}</Badge>
            <span className="text-xs text-muted-foreground">{fmt(aviso.publicado_em)}</span>
            {/* Marcadores de estado — só aparecem para quem tem edit (RLS já oculta dos demais) */}
            {estado === 'futuro' && (
              <Badge variant="outline" className="gap-1 text-text-link">
                <Clock className="h-3 w-3" />
                Agendado
              </Badge>
            )}
            {estado === 'expirado' && (
              <Badge variant="outline" className="text-muted-foreground">Expirado</Badge>
            )}
          </div>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(aviso)}
            aria-label={`Editar ${aviso.titulo}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className={cn('mt-3 whitespace-pre-line text-sm text-muted-foreground', longo && !expanded && 'line-clamp-3')}>
        {aviso.conteudo}
      </p>
      {longo && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-text-link hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}

      {aviso.expira_em && estado !== 'expirado' && (
        <p className="mt-2 text-xs text-muted-foreground">Expira em {fmt(aviso.expira_em)}</p>
      )}
    </div>
  )
}
