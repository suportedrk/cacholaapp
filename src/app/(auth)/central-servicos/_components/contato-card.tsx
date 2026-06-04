'use client'

import { useState } from 'react'
import { Mail, Pencil, Users, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContatoAvatar } from './contato-avatar'
import { GrupoMembrosList } from './grupo-membros-list'
import { ContatoTelefoneAcoes } from './contato-telefone-acoes'
import {
  CONTATO_UNIDADE_LABELS,
  type CentralServicosContato,
} from '@/types/central-servicos'

interface ContatoCardProps {
  contato: CentralServicosContato
  signedUrl?: string
  canEdit: boolean
  onEdit: (c: CentralServicosContato) => void
}

export function ContatoCard({ contato, signedUrl, canEdit, onEdit }: ContatoCardProps) {
  const isGrupo = contato.tipo === 'grupo'
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4',
        !contato.ativo && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <ContatoAvatar src={signedUrl} nome={contato.nome} isGrupo={isGrupo} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{contato.nome}</h3>
            {isGrupo && (
              <Badge variant="outline" className="shrink-0 gap-1">
                <Users className="h-3 w-3" />
                Grupo
              </Badge>
            )}
            {!contato.ativo && (
              <Badge variant="secondary" className="shrink-0">Inativo</Badge>
            )}
          </div>
          {!isGrupo && contato.cargo && (
            <p className="truncate text-xs text-muted-foreground">{contato.cargo}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!isGrupo && contato.setor && (
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

      <div className="flex items-center gap-2">
        {contato.email ? (
          <a
            href={`mailto:${contato.email}`}
            className="inline-flex min-w-0 items-center gap-1.5 text-xs text-text-link hover:underline"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contato.email}</span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Sem e-mail</span>
        )}
        <ContatoTelefoneAcoes
          telefone={isGrupo ? null : contato.telefone}
          nome={contato.nome}
          className="ml-auto"
        />
      </div>

      {/* Quem recebe — expansível (grupos) */}
      {isGrupo && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Quem recebe
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </button>
          {expanded && (
            <div className="mt-2">
              <GrupoMembrosList grupoId={contato.id} open={expanded} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
