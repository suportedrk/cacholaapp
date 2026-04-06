'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, UserPlus, Loader2, Users, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/shared/user-avatar'
import { StatusBadge } from '@/components/shared/status-badge'
import { useUsers } from '@/hooks/use-users'
import { useAuth } from '@/hooks/use-auth'
import { useStartImpersonate } from '@/hooks/use-impersonate'
import { ROLE_LABELS, ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database.types'

export default function UsuariosPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  const { data: users, isLoading, isError } = useUsers({
    search: search.length >= 2 ? search : undefined,
    isActive: filterActive,
  })

  // realProfile = quem está realmente logado (não muda com impersonate)
  const { realProfile } = useAuth()
  const isSuperAdmin = realProfile?.role === 'super_admin'

  const startImpersonate = useStartImpersonate()
  // Rastrear qual botão está carregando (para feedback por linha)
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)

  async function handleViewAs(userId: string) {
    setLoadingUserId(userId)
    try {
      await startImpersonate.mutateAsync(userId)
      // Redirecionar para o dashboard com o contexto do usuário impersonado
      router.push(ROUTES.dashboard)
    } finally {
      setLoadingUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Usuários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {users ? `${users.length} usuário${users.length !== 1 ? 's' : ''}` : 'Gerenciar usuários do sistema'}
          </p>
        </div>
        <Button onClick={() => router.push(`${ROUTES.users}/novo`)} className="shrink-0">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Todos', value: undefined },
            { label: 'Ativos', value: true },
            { label: 'Inativos', value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setFilterActive(opt.value)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                filterActive === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Carregando usuários...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">Erro ao carregar usuários</p>
          <p className="mt-1 text-xs text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        </div>
      ) : !users || users.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] rounded-2xl border-2 border-dashed border-border bg-card">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-3">
            <Users className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhum usuário encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground text-center max-w-xs">
            {search ? 'Tente outros termos de busca.' : 'Crie o primeiro usuário para começar.'}
          </p>
          {!search && (
            <Button className="mt-4" onClick={() => router.push(`${ROUTES.users}/novo`)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="hidden md:grid md:grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span className="w-9" />
            <span>Usuário</span>
            <span className="w-28">Cargo</span>
            <span className="w-20">Status</span>
            <span className="w-20">Ações</span>
          </div>

          <ul className="divide-y divide-border">
            {users.map((user) => {
              const canViewAs =
                isSuperAdmin &&
                user.id !== realProfile?.id &&
                (user.role as UserRole) !== 'super_admin'
              const isLoadingThis = loadingUserId === user.id

              return (
                <li key={user.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors md:grid md:grid-cols-[auto_1fr_auto_auto_auto] md:gap-4">
                    <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="hidden md:block">
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </div>
                    <div className="hidden md:block">
                      <StatusBadge active={user.is_active} />
                    </div>
                    <div className="flex items-center gap-1 ml-auto md:ml-0">
                      {/* Botão "Ver como" — apenas super_admin, excluindo si mesmo e outros super_admins */}
                      {canViewAs && (
                        <button
                          onClick={() => handleViewAs(user.id)}
                          disabled={isLoadingThis || loadingUserId !== null}
                          title={`Ver como ${user.name}`}
                          aria-label={`Visualizar sistema como ${user.name}`}
                          className={cn(
                            'p-2 rounded-lg transition-colors min-h-[36px] flex items-center justify-center',
                            'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30',
                            (isLoadingThis || loadingUserId !== null) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {isLoadingThis
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Eye className="w-4 h-4" />
                          }
                        </button>
                      )}
                      <Link
                        href={`${ROUTES.users}/${user.id}`}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-primary hover:bg-primary/10 transition-colors min-h-[36px] flex items-center"
                      >
                        Editar
                      </Link>
                      <Link
                        href={`${ROUTES.users}/${user.id}/permissoes`}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:bg-accent transition-colors min-h-[36px] flex items-center"
                      >
                        Permissões
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
