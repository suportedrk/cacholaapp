import { create } from 'zustand'

// ── Tour step definitions ────────────────────────────────────
export const TOUR_STEPS = [
  {
    id: 'sidebar',
    title: 'Menu principal',
    description: 'Acesse todos os módulos do Cachola OS pelo menu lateral.',
  },
  {
    id: 'unit-switcher',
    title: 'Suas unidades',
    description: 'Alterne entre unidades para ver os dados de cada local.',
  },
  {
    id: 'calendar',
    title: 'Calendário de eventos',
    description: 'Visualize e navegue por todos os eventos e manutenções agendadas.',
  },
  {
    id: 'notifications',
    title: 'Central de notificações',
    description: 'Fique por dentro de alertas e atualizações em tempo real.',
  },
] as const

export type TourStepId = typeof TOUR_STEPS[number]['id']

// ── Store ────────────────────────────────────────────────────
interface OnboardingStore {
  welcomeOpen: boolean
  tourActive: boolean
  tourStep: number

  setWelcomeOpen: (v: boolean) => void
  startTour: () => void
  nextTourStep: () => void
  skipTour: () => void
}

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  welcomeOpen: false,
  tourActive: false,
  tourStep: 0,

  setWelcomeOpen: (v) => set({ welcomeOpen: v }),

  startTour: () => set({ tourActive: true, tourStep: 0, welcomeOpen: false }),

  nextTourStep: () =>
    set((s) => {
      const next = s.tourStep + 1
      if (next >= TOUR_STEPS.length) return { tourActive: false, tourStep: 0 }
      return { tourStep: next }
    }),

  skipTour: () => set({ tourActive: false, tourStep: 0 }),
}))
