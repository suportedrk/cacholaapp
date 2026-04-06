import { create } from 'zustand'
import type { User as AppUser, UserUnitWithUnit, Unit } from '@/types/database.types'
import type { PermissionMap } from '@/types/permissions'

/**
 * Store de impersonate — "Ver como" (super_admin only).
 *
 * SEGURANÇA:
 * - Sem persist: o estado morre no F5 (intencional)
 * - session/user do Supabase NUNCA são alterados — só profile e dados derivados
 * - Apenas leitura client-side: zero alteração no banco
 *
 * FLUXO:
 * startImpersonating(params) →
 *   1. Salva estado original do UnitStore
 *   2. Substitui activeUnitId/activeUnit/userUnits no UnitStore pelo do impersonado
 *   3. Seta isImpersonating = true
 *
 * stopImpersonating() →
 *   1. Restaura UnitStore ao estado original
 *   2. Limpa tudo
 */

interface ImpersonateState {
  // ─── Status ───────────────────────────────────────────────────
  isImpersonating: boolean

  // ─── Dados do usuário impersonado ────────────────────────────
  impersonatedProfile: AppUser | null
  impersonatedUserUnits: UserUnitWithUnit[] | null
  impersonatedPermissions: PermissionMap | null

  // ─── Snapshot original do admin (para restaurar) ─────────────
  originalActiveUnitId: string | null
  originalActiveUnit: Pick<Unit, 'id' | 'name' | 'slug'> | null
  originalUserUnits: UserUnitWithUnit[] | null

  // ─── Actions ──────────────────────────────────────────────────
  startImpersonating: (params: {
    profile: AppUser
    userUnits: UserUnitWithUnit[]
    permissions: PermissionMap
  }) => void
  stopImpersonating: () => void
}

export const useImpersonateStore = create<ImpersonateState>((set) => ({
  // Estado inicial
  isImpersonating: false,
  impersonatedProfile: null,
  impersonatedUserUnits: null,
  impersonatedPermissions: null,
  originalActiveUnitId: null,
  originalActiveUnit: null,
  originalUserUnits: null,

  startImpersonating: ({ profile, userUnits, permissions }) => {
    // Importação lazy para evitar dependência circular
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUnitStore } = require('@/stores/unit-store') as typeof import('@/stores/unit-store')
    const unitState = useUnitStore.getState()

    // 1. Salvar snapshot atual do admin
    const originalActiveUnitId = unitState.activeUnitId
    const originalActiveUnit = unitState.activeUnit
    const originalUserUnits = unitState.userUnits

    // 2. Calcular a unidade default do usuário impersonado
    const defaultUnit = userUnits.find((uu) => uu.is_default) ?? userUnits[0] ?? null
    const defaultUnitId = defaultUnit?.unit_id ?? null
    const defaultUnitObj = defaultUnit?.unit
      ? {
          id: defaultUnit.unit.id,
          name: defaultUnit.unit.name,
          slug: defaultUnit.unit.slug,
        }
      : null

    // 3. Atualizar UnitStore com o contexto do impersonado
    unitState.setActiveUnit(defaultUnitId, defaultUnitObj)
    unitState.setUserUnits(userUnits)

    // 4. Setar estado de impersonate
    set({
      isImpersonating: true,
      impersonatedProfile: profile,
      impersonatedUserUnits: userUnits,
      impersonatedPermissions: permissions,
      originalActiveUnitId,
      originalActiveUnit,
      originalUserUnits,
    })
  },

  stopImpersonating: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useUnitStore } = require('@/stores/unit-store') as typeof import('@/stores/unit-store')
    const unitState = useUnitStore.getState()
    const store = useImpersonateStore.getState()

    // 1. Restaurar UnitStore ao estado original do admin
    unitState.setActiveUnit(store.originalActiveUnitId, store.originalActiveUnit ?? null)
    unitState.setUserUnits(store.originalUserUnits ?? [])

    // 2. Limpar estado de impersonate
    set({
      isImpersonating: false,
      impersonatedProfile: null,
      impersonatedUserUnits: null,
      impersonatedPermissions: null,
      originalActiveUnitId: null,
      originalActiveUnit: null,
      originalUserUnits: null,
    })
  },
}))
