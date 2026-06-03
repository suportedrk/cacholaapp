'use client'

import { useMemo } from 'react'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useGrupoMembros } from '@/hooks/use-central-servicos-contatos'
import { CONTATOS_BUCKET } from '@/types/central-servicos'
import { ContatoAvatar } from './contato-avatar'

interface Props {
  grupoId: string
  /** Carrega só quando o grupo está expandido (lazy). */
  open: boolean
}

/**
 * "Quem recebe": lista read-only dos membros (pessoas) de um grupo.
 * Visível a todos com view; membros inativos são escondidos pela RLS do C1
 * (JOIN com `!inner` no hook). Usada na expansão da listagem.
 */
export function GrupoMembrosList({ grupoId, open }: Props) {
  const { data: membros = [], isLoading } = useGrupoMembros(grupoId, open)

  const fotoPaths = useMemo(
    () => membros.map((m) => m.membro.foto_path).filter((p): p is string => !!p),
    [membros],
  )
  const { data: signedUrls = {} } = useSignedUrls(CONTATOS_BUCKET, fotoPaths)

  if (isLoading) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Carregando quem recebe…</p>
  }
  if (membros.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Sem membros.</p>
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Quem recebe ({membros.length})</p>
      <ul className="flex flex-wrap gap-2">
        {membros.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3"
          >
            <ContatoAvatar
              src={m.membro.foto_path ? signedUrls[m.membro.foto_path] : undefined}
              nome={m.membro.nome}
              size={24}
            />
            <span className="text-xs text-foreground">
              {m.membro.nome}
              {m.membro.cargo ? <span className="text-muted-foreground"> · {m.membro.cargo}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
