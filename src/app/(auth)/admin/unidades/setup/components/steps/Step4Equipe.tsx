'use client'

import { Users, Search, Loader2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { useSystemUsers, useUnitTeam } from '@/hooks/use-unit-setup'
import { useRoles } from '@/hooks/use-rbac-catalogs'
import type { UserRole } from '@/types/database.types'
import type { Role } from '@/types/permissions'
import { ROLE_LABELS } from '@/lib/constants'
import { hasRole, SYSTEM_ONLY_ROLES } from '@/config/roles'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface TeamSelection {
  userId: string
  role: UserRole
}

export interface Step4Data {
  selectedMembers: TeamSelection[]
}

interface Props {
  targetUnitId: string
  data: Step4Data
  onChange: (data: Partial<Step4Data>) => void
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Step4Equipe({ targetUnitId, data, onChange }: Props) {
  const [search, setSearch] = useState('')
  const { data: roles } = useRoles()
  const { data: allUsers, isLoading: loadingUsers, isError: errorUsers } = useSystemUsers()
  const { data: existingTeam } = useUnitTeam(targetUnitId)

  // Usuários que já estão vinculados à unidade
  const existingSet = useMemo(() => new Set((existingTeam ?? []).map((m) => m.user_id)), [existingTeam])

  // Filtrar por busca
  const filtered = useMemo(() => {
    if (!allUsers) return []
    const q = search.toLowerCase().trim()
    return allUsers.filter((u) =>
      !q || u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
    )
  }, [allUsers, search])

  function isSelected(userId: string) {
    return data.selectedMembers.some((m) => m.userId === userId)
  }

  function getRole(userId: string): UserRole {
    return data.selectedMembers.find((m) => m.userId === userId)?.role ?? 'gerente'
  }

  function toggleUser(userId: string, defaultRole: UserRole) {
    if (isSelected(userId)) {
      onChange({ selectedMembers: data.selectedMembers.filter((m) => m.userId !== userId) })
    } else {
      onChange({ selectedMembers: [...data.selectedMembers, { userId, role: defaultRole }] })
    }
  }

  function updateRole(userId: string, role: UserRole) {
    onChange({
      selectedMembers: data.selectedMembers.map((m) =>
        m.userId === userId ? { ...m, role } : m
      ),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-brand p-2 rounded-lg">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Equipe</h2>
          <p className="text-sm text-muted-foreground">
            Selecione os colaboradores que terão acesso a esta unidade e defina seus papéis.
          </p>
        </div>
      </div>

      {/* Contador selecionados */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.selectedMembers.length > 0
            ? `${data.selectedMembers.length} colaborador(es) selecionado(s)`
            : 'Nenhum colaborador selecionado'}
        </p>
        {data.selectedMembers.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ selectedMembers: [] })}
            className="text-xs text-destructive hover:underline"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar colaborador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista de usuários */}
      {loadingUsers ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando colaboradores...
        </div>
      ) : errorUsers ? (
        <p className="text-sm text-destructive py-4">
          Erro ao carregar colaboradores. Tente novamente.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum colaborador encontrado.
            </p>
          )}
          {filtered.map((user) => {
            const selected = isSelected(user.id)
            const alreadyLinked = existingSet.has(user.id)

            return (
              <div
                key={user.id}
                className={cn(
                  'rounded-lg border-2 transition-all',
                  selected ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleUser(user.id, (user.role as UserRole) ?? 'gerente')}
                    className="w-11 h-11 -m-2 flex items-center justify-center"
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remover' : 'Selecionar'} ${user.name}`}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      selected ? 'bg-primary border-primary' : 'border-border',
                    )}>
                      {selected && (
                        <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                          <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Info do usuário */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      {alreadyLinked && (
                        <span className="badge-green border text-xs shrink-0">Vinculado</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                  </div>

                  {/* Role na nova unidade */}
                  {selected && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={getRole(user.id)}
                        onValueChange={(v) => v && updateRole(user.id, v as UserRole)}
                      >
                        <SelectTrigger size="sm" className="min-w-[110px] shrink-0" aria-label={`Papel de ${user.name} nesta unidade`}>
                          <span data-slot="select-value" className="flex flex-1 text-left text-xs">
                            {ROLE_LABELS[getRole(user.id)] ?? getRole(user.id)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {(roles ?? [])
                            .filter((r) => !hasRole(r.code as Role, SYSTEM_ONLY_ROLES))
                            .map((r) => (
                              <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          Colaboradores com papel <strong>super_admin</strong> já têm acesso a todas as unidades automaticamente
          e não aparecem nesta lista. O papel definido aqui será específico para esta unidade.
        </p>
      </div>
    </div>
  )
}
