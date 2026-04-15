import { create } from 'zustand'
import { type MeetingMinutesFilters, DEFAULT_MINUTES_FILTERS } from '@/types/minutes'

interface MeetingMinutesFiltersStore {
  filters: MeetingMinutesFilters
  setFilter: <K extends keyof MeetingMinutesFilters>(key: K, value: MeetingMinutesFilters[K]) => void
  resetFilters: () => void
  hasActiveFilters: () => boolean
}

export const useMeetingMinutesFiltersStore = create<MeetingMinutesFiltersStore>((set, get) => ({
  filters: { ...DEFAULT_MINUTES_FILTERS },

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_MINUTES_FILTERS } }),

  hasActiveFilters: () => {
    const { filters } = get()
    return (
      filters.search !== '' ||
      filters.status !== 'all' ||
      filters.period !== '6' ||
      filters.onlyMine
    )
  },
}))
