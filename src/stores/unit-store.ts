import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Unit, UserUnitWithUnit } from '@/types/database.types'

interface UnitStore {
  /** null = todas as unidades (visão consolidada — super_admin/diretor) */
  activeUnitId: string | null
  activeUnit: Pick<Unit, 'id' | 'name' | 'slug'> | null
  /** Todas as unidades que o usuário tem acesso */
  userUnits: UserUnitWithUnit[]
  setActiveUnit: (unitId: string | null, unit?: Pick<Unit, 'id' | 'name' | 'slug'> | null) => void
  setUserUnits: (userUnits: UserUnitWithUnit[]) => void
  reset: () => void
}

export const useUnitStore = create<UnitStore>()(
  persist(
    (set) => ({
      activeUnitId: null,
      activeUnit: null,
      userUnits: [],

      setActiveUnit: (unitId, unit) =>
        set({
          activeUnitId: unitId,
          activeUnit: unit ?? null,
        }),

      setUserUnits: (userUnits) => set({ userUnits }),

      reset: () => set({ activeUnitId: null, activeUnit: null, userUnits: [] }),
    }),
    {
      name: 'cachola-active-unit',
      // Persistir apenas o ID da unidade ativa (não os dados completos)
      partialize: (state) => ({ activeUnitId: state.activeUnitId }),
    }
  )
)
