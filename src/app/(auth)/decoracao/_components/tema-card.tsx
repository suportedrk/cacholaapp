'use client'

import { ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ForminhaColorDot } from './forminha-color-dot'
import type { DecoracaoTemaComForminhas } from '@/types/decoracao'

interface TemaCardProps {
  tema: DecoracaoTemaComForminhas
  signedUrl?: string
  onClick: () => void
}

export function TemaCard({ tema, signedUrl, onClick }: TemaCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cn(
        'card-interactive focus-ring flex flex-col overflow-hidden rounded-xl border border-border-default bg-card',
        !tema.ativo && 'opacity-70',
      )}
      aria-label={`Abrir tema ${tema.nome}`}
    >
      {/* Foto */}
      {signedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signedUrl}
          alt={tema.nome}
          className="h-24 w-full object-cover"
        />
      ) : (
        <div className="flex h-24 items-center justify-center bg-surface-secondary text-text-tertiary">
          <ImageOff className="h-6 w-6" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="leading-tight font-semibold text-text-primary">{tema.nome}</h3>
          <Badge
            variant="outline"
            className={cn('border text-xs', tema.ativo ? 'badge-green' : 'badge-gray')}
          >
            {tema.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>

        <p className="text-xs text-text-tertiary">{tema.categoria ?? 'Sem categoria'}</p>

        {(tema.personalizado || tema.decoradora_externa) && (
          <div className="flex flex-wrap gap-1">
            {tema.personalizado && (
              <Badge variant="outline" className="badge-amber border text-xs">
                Personalizado
              </Badge>
            )}
            {tema.decoradora_externa && (
              <Badge variant="outline" className="badge-amber border text-xs">
                Decoradora externa
              </Badge>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          {tema.forminhas.length === 0 ? (
            <span className="text-xs text-text-tertiary">Sem forminhas vinculadas</span>
          ) : (
            tema.forminhas.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-secondary px-1.5 py-0.5 text-[11px] text-text-secondary"
              >
                <ForminhaColorDot
                  corHex={f.cor_hex}
                  numero={f.numero}
                  nome={f.nome}
                  size="sm"
                />
                {f.numero}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
