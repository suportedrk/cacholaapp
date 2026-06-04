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
  /**
   * Quando definido E há foto real visível, o avatar vira um botão (clique para
   * ampliar a foto). Sem `onClick` — ou quando é placeholder — fica não-clicável.
   */
  onClick?: () => void
}

/**
 * Avatar do contato: foto (signed URL do bucket privado) ou placeholder.
 * Pessoa → ícone User; grupo → ícone Users. Fallback ao placeholder se a
 * imagem falhar ao carregar (onError).
 */
export function ContatoAvatar({ src, nome, isGrupo, size = 40, className, onClick }: ContatoAvatarProps) {
  const [errored, setErrored] = useState(false)
  const showImg = src && !errored
  const Placeholder = isGrupo ? Users : User
  const clickable = !!onClick && !!showImg

  const baseClass = cn(
    'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary',
    className,
  )

  const inner = showImg ? (
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
  )

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Ver foto de ${nome}`}
        className={cn(baseClass, 'focus-ring cursor-pointer transition-opacity hover:opacity-90')}
        style={{ width: size, height: size }}
      >
        {inner}
      </button>
    )
  }

  return (
    <div className={baseClass} style={{ width: size, height: size }}>
      {inner}
    </div>
  )
}
