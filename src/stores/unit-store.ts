import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit, UserUnitWithUnit } from '@/types/database.types'

interface UnitStore {
  /** null = todas as unidades (visão consolidada — super_admin/diretor) */
  activeUnitId: string | null
  activeUnit: Pick<Unit, 'id' | 'name' | 'slug'> | null
  /** Todas as unidades que o usuário tem acesso */
  userUnits: UserUnitWithUnit[]
  /**
   * true depois que o usuário escolheu uma unidade (ou "Todas") explicitamente
   * pela UI. Persistido — desambigua, na hidratação, o `activeUnitId === null`
   * de "escolheu Todas" do `null` de "nunca escolheu" (que ainda cai no
   * is_default). Marcado só por `selectUnit`, nunca por `setActiveUnit`.
   */
  hasExplicitSelection: boolean
  /**
   * true depois que o persist middleware terminou de ler o localStorage.
   * Evita que queries com `!!activeUnitId` disparem com o valor inicial null
   * antes da rehidratação completar (relevante no ciclo SSR → CSR do Next.js).
   */
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  /** Uso programático (boot, impersonate) — NÃO marca escolha explícita. */
  setActiveUnit: (unitId: string | null, unit?: Pick<Unit, 'id' | 'name' | 'slug'> | null) => void
  /** Escolha do usuário via UI — marca `hasExplicitSelection` para sobreviver ao reload. */
  selectUnit: (unitId: string | null, unit?: Pick<Unit, 'id' | 'name' | 'slug'> | null) => void
  setUserUnits: (userUnits: UserUnitWithUnit[]) => void
  reset: () => void
}

export const useUnitStore = create<UnitStore>()(
  persist(
    (set) => ({
      activeUnitId: null,
      activeUnit: null,
      userUnits: [],
      hasExplicitSelection: false,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      setActiveUnit: (unitId, unit) =>
        set({
          activeUnitId: unitId,
          activeUnit: unit ?? null,
        }),

      selectUnit: (unitId, unit) =>
        set({
          activeUnitId: unitId,
          activeUnit: unit ?? null,
          hasExplicitSelection: true,
        }),

      setUserUnits: (userUnits) => set({ userUnits }),

      reset: () =>
        set({ activeUnitId: null, activeUnit: null, userUnits: [], hasExplicitSelection: false }),
    }),
    {
      name: 'cachola-active-unit',
      // Persistir o ID da unidade ativa + o marcador de escolha explícita
      partialize: (state) => ({
        activeUnitId: state.activeUnitId,
        hasExplicitSelection: state.hasExplicitSelection,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
