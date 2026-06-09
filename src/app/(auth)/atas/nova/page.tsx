'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useUsers } from '@/hooks/use-users'
import { useCreateMeetingMinute } from '@/hooks/use-meeting-minute-mutations'
import { useAtasPermissions } from '@/hooks/use-atas-permissions'
import { MeetingMinuteForm } from '../components/MeetingMinuteForm'
import { DIRETORIA_ROLES, hasRole } from '@/config/roles'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { MeetingMinuteFormData } from '@/types/minutes'

type AtaScope = 'unit' | 'global'

export default function NovaAtaPage() {
  const router   = useRouter()
  const user     = useAuthReadyStore((s) => s.user)
  const profile  = useAuthReadyStore((s) => s.profile)
  const { activeUnitId } = useUnitStore()

  // Só a diretoria escolhe o escopo; demais cargos criam sempre na unidade ativa.
  const isDiretoria = hasRole(profile?.role, DIRETORIA_ROLES)
  const [scope, setScope] = useState<AtaScope>('unit')
  const effectiveScope: AtaScope = isDiretoria ? scope : 'unit'

  // ── Permission gate ────────────────────────────────────────
  // Espera a permissão resolver antes de decidir o redirect (sem flicker).
  const perms = useAtasPermissions()
  useEffect(() => {
    if (!perms.isLoading && !perms.canCreate) {
      router.replace('/atas')
    }
  }, [perms.isLoading, perms.canCreate, router])

  // ── Data ──────────────────────────────────────────────────
  // Unidade atual: usuários da unidade ativa (como hoje).
  const { data: unitUsersRaw = [] } = useUnitUsers(activeUnitId ?? undefined)
  const unitUsers = unitUsersRaw.map((u) => ({
    id:         u.user.id,
    name:       u.user.name,
    avatar_url: u.user.avatar_url,
    is_active:  u.user.is_active,
  }))

  // Geral: usuários ativos das duas unidades (deduplicados pela própria tabela users).
  // RLS de `users` só devolve a lista completa a quem tem users.view (diretoria);
  // para os demais cargos o resultado é filtrado pelo RLS e nunca é usado (escopo travado em 'unit').
  const { data: allActiveUsers = [] } = useUsers({ isActive: true })
  const globalUsers = allActiveUsers.map((u) => ({
    id:         u.id,
    name:       u.name,
    avatar_url: u.avatar_url,
    is_active:  u.is_active,
  }))

  const selectedUsers = effectiveScope === 'global' ? globalUsers : unitUsers

  // ── Mutation ───────────────────────────────────────────────
  const createMinute = useCreateMeetingMinute()

  async function handleSave(form: MeetingMinuteFormData) {
    if (!user?.id) return
    // Geral: unit_id null (RLS exige diretoria). Unidade atual: exige activeUnitId.
    if (effectiveScope === 'unit' && !activeUnitId) return
    await createMinute.mutateAsync({
      unit_id: effectiveScope === 'global' ? null : activeUnitId,
      form,
      userId:  user.id,
    })
    router.push('/atas')
  }

  // ── Render ─────────────────────────────────────────────────
  // Enquanto a permissão não resolve, mostra carregando — não renderiza nada
  // nem decide o redirect ainda.
  if (perms.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm text-muted-foreground">Carregando…</span>
      </div>
    )
  }

  // Sem permissão de criar: o efeito acima já dispara o redirect; evita flash do form.
  if (!perms.canCreate) return null
  if (!user) return null

  // O bloqueio "selecione uma unidade" só vale para o escopo de unidade —
  // o fluxo "Geral" (diretoria, inclusive em "Todas as unidades") nunca é bloqueado.
  const hasUnit = !!activeUnitId
  const canShowForm = effectiveScope === 'global' || hasUnit

  return (
    <div className="space-y-6">
      {/* Seletor de escopo — só para a diretoria, acima do formulário */}
      {isDiretoria && (
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-2">
          <label htmlFor="ata-scope" className="block text-sm font-medium text-foreground">
            Escopo da ata
          </label>
          <Select value={scope} onValueChange={(v) => setScope(v as AtaScope)}>
            <SelectTrigger id="ata-scope" className="w-full sm:w-72">
              <SelectValue>
                {scope === 'global' ? 'Geral (sem unidade)' : 'Unidade atual'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unit">Unidade atual</SelectItem>
              <SelectItem value="global">Geral (sem unidade)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {scope === 'global'
              ? 'Ata geral, sem vínculo com uma unidade. Participantes das duas unidades.'
              : 'Ata vinculada à unidade ativa no seletor de unidades.'}
          </p>
        </section>
      )}

      {canShowForm ? (
        <MeetingMinuteForm
          unitUsers={selectedUsers}
          currentUserId={user.id}
          isEditMode={false}
          isSaving={createMinute.isPending}
          onSave={handleSave}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Selecione uma unidade no seletor acima para criar uma ata.
          </p>
        </div>
      )}
    </div>
  )
}
