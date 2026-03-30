import { create } from 'zustand'
import { type ProviderFilters, DEFAULT_PROVIDER_FILTERS } from '@/types/providers'

interface ProviderFiltersStore {
  filters: ProviderFilters
  setFilter: <K extends keyof ProviderFilters>(key: K, value: ProviderFilters[K]) => void
  resetFilters: () => void
  hasActiveFilters: () => boolean
}

export const useProviderFiltersStore = create<ProviderFiltersStore>((set, get) => ({
  filters: { ...DEFAULT_PROVIDER_FILTERS },

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_PROVIDER_FILTERS } }),

  hasActiveFilters: () => {
    const { filters } = get()
    return (
      filters.search !== '' ||
      filters.status !== 'all' ||
      filters.category_id !== 'all' ||
      filters.min_rating > 0 ||
      filters.has_expiring_docs
    )
  },
}))
