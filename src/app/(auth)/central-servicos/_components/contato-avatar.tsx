'use client'

import { useState } from 'react'
import { User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContatoAvatarProps {
  /** URL assinada da foto (ou undefined quando não há foto / ainda carregando). */
  src?: string
  nome: string
  /** Grupo → placeholder de grupo (ícone Users) em vez de pessoa. */
  isGrupo?: boolean
  /** Tamanho em px (quadrado). */
  size?: number
  className?: string
}

/**
 * Avatar do contato: foto (signed URL do bucket privado) ou placeholder.
 * Pessoa → ícone User; grupo → ícone Users. Fallback ao placeholder se a
 * imagem falhar ao carregar (onError).
 */
export function ContatoAvatar({ src, nome, isGrupo, size = 40, className }: ContatoAvatarProps) {
  const [errored, setErrored] = useState(false)
  const showImg = src && !errored
  const Placeholder = isGrupo ? Users : User

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={nome}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <Placeholder className="text-muted-foreground" style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </div>
  )
}
