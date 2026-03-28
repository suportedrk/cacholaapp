import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentItem {
  id: string
  label: string
  sublabel?: string
  href: string
  group: string
  ts: number
}

interface CommandPaletteStore {
  isOpen: boolean
  recentItems: RecentItem[]
  open:  () => void
  close: () => void
  toggle: () => void
  addRecent: (item: Omit<RecentItem, 'ts'>) => void
}

export const useCommandPaletteStore = create<CommandPaletteStore>()(
  persist(
    (set) => ({
      isOpen: false,
      recentItems: [],

      open:   () => set({ isOpen: true }),
      close:  () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),

      addRecent: (item) =>
        set((s) => {
          // keep max 5, dedup by id, most recent first
          const without = s.recentItems.filter((r) => r.id !== item.id).slice(0, 4)
          return { recentItems: [{ ...item, ts: Date.now() }, ...without] }
        }),
    }),
    {
      name: 'cachola-cmd-palette',
      partialize: (s) => ({ recentItems: s.recentItems }),
    },
  ),
)
