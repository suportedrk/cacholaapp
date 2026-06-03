'use client'

import { useState } from 'react'
import { ExternalLink, Globe, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
import { LINK_CATEGORIA_LABELS, type CentralServicosLink } from '@/types/central-servicos'

/** Deriva a URL do favicon do domínio (fallback automático de ícone). */
function faviconFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return null
  }
}

/** Ícone do card: icone_url manual → favicon do domínio → Globe genérico (onError). */
function LinkIcon({ link }: { link: CentralServicosLink }) {
  const [errored, setErrored] = useState(false)
  const src = link.icone_url || faviconFromUrl(link.url)

  if (!src || errored) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Globe className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={32}
        height={32}
        className="h-6 w-6 object-contain"
        onError={() => setErrored(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}

interface LinkCardProps {
  link: CentralServicosLink
  canEdit: boolean
  onEdit: (link: CentralServicosLink) => void
}

export function LinkCard({ link, canEdit, onEdit }: LinkCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow',
        'hover:shadow-sm',
        !link.ativo && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <LinkIcon link={link} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{link.nome}</h3>
            {!link.ativo && (
              <Badge variant="secondary" className="shrink-0">
                Inativo
              </Badge>
            )}
          </div>
          {link.descricao && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{link.descricao}</p>
          )}
          <Badge variant="outline" className="mt-2">
            {LINK_CATEGORIA_LABELS[link.categoria]}
          </Badge>
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: 'sm' }), 'flex-1')}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Acessar
        </a>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(link)}
            aria-label={`Editar ${link.nome}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
