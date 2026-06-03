'use client'

import { useMemo, useState } from 'react'
import { X, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useGrupoMembros,
  useAddMembro,
  useRemoveMembro,
  useCentralServicosContatos,
} from '@/hooks/use-central-servicos-contatos'

interface Props {
  grupoId: string
}

/**
 * Editor de "quem recebe" de um grupo (dentro do Sheet de edição).
 * Renderizado só para quem tem escrita (o Sheet só abre para editores).
 */
export function GrupoMembrosEditor({ grupoId }: Props) {
  const { data: membros = [], isLoading } = useGrupoMembros(grupoId)
  const { data: contatos = [] } = useCentralServicosContatos()
  const addMembro = useAddMembro()
  const removeMembro = useRemoveMembro()

  const [toAdd, setToAdd] = useState('')

  // Pessoas ativas que ainda não são membros.
  const disponiveis = useMemo(() => {
    const jaMembro = new Set(membros.map((m) => m.membro.id))
    return contatos.filter((c) => c.tipo === 'pessoa' && c.ativo && !jaMembro.has(c.id))
  }, [contatos, membros])

  const busy = addMembro.isPending || removeMembro.isPending

  async function handleAdd() {
    if (!toAdd) return
    try {
      await addMembro.mutateAsync({ grupoId, membroId: toAdd })
      setToAdd('')
    } catch {
      /* toast no hook */
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">Quem recebe</p>
        <p className="text-xs text-muted-foreground">Pessoas da agenda que pertencem a este grupo.</p>
      </div>

      {/* Adicionar membro */}
      <div className="flex items-center gap-2">
        <Select value={toAdd} onValueChange={(v) => setToAdd(v ?? '')} disabled={busy || disponiveis.length === 0}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {toAdd
                ? disponiveis.find((d) => d.id === toAdd)?.nome
                : disponiveis.length === 0
                  ? 'Nenhuma pessoa disponível'
                  : 'Adicionar pessoa…'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {disponiveis.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
                {p.setor ? ` — ${p.setor}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={handleAdd} disabled={!toAdd || busy}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Lista de membros */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : membros.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum membro ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {membros.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary px-2.5 py-1.5"
            >
              <span className="min-w-0 truncate text-sm text-foreground">
                {m.membro.nome}
                {m.membro.cargo ? (
                  <span className="text-muted-foreground"> — {m.membro.cargo}</span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => removeMembro.mutate({ grupoId, membroId: m.membro.id })}
                aria-label={`Remover ${m.membro.nome}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
