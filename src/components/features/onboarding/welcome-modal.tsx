'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, CheckSquare, Wrench, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingStore } from '@/stores/onboarding-store'
import { useCompleteOnboarding } from '@/hooks/use-onboarding'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

// ── Slide definitions ─────────────────────────────────────────

const SLIDES = [
  {
    icon: Calendar,
    iconClass: 'icon-brand',
    title: 'Seus eventos em um só lugar',
    description:
      'Gerencie festas, escalas e datas com facilidade. Visualize tudo no calendário integrado.',
  },
  {
    icon: CheckSquare,
    iconClass: 'icon-green',
    title: 'Checklists para nunca esquecer nada',
    description:
      'Crie modelos de checklist e aplique a cada evento. Acompanhe o progresso em tempo real.',
  },
  {
    icon: Wrench,
    iconClass: 'icon-orange',
    title: 'Manutenção preventiva sob controle',
    description:
      'Registre ordens de serviço, defina recorrências e nunca perca prazos de manutenção.',
  },
] as const

// ── Component ─────────────────────────────────────────────────

export function WelcomeModal() {
  const { welcomeOpen, setWelcomeOpen, startTour } = useOnboardingStore()
  const { profile } = useAuth()
  const { mutate: completeOnboarding } = useCompleteOnboarding()

  const [slide, setSlide] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset slide when modal opens
  useEffect(() => {
    if (welcomeOpen) setSlide(0)
  }, [welcomeOpen])

  function handleNext() {
    if (slide < SLIDES.length - 1) {
      setSlide((s) => s + 1)
    } else {
      handleBegin()
    }
  }

  function handleBegin() {
    completeOnboarding()
    setWelcomeOpen(false)
    setTimeout(() => startTour(), 400)
  }

  function handleSkip() {
    completeOnboarding()
    setWelcomeOpen(false)
  }

  if (!mounted || !welcomeOpen) return null

  const { icon: Icon, iconClass, title, description } = SLIDES[slide]
  const firstName = profile?.name?.split(' ')[0] ?? 'você'
  const isLast = slide === SLIDES.length - 1

  return createPortal(
    <div
      className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-page-enter"
      onClick={(e) => e.target === e.currentTarget && handleSkip()}
    >
      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden animate-scale-in">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-md ring-1 ring-primary/20 shrink-0">
            <span className="text-2xl font-bold text-primary-foreground">C</span>
          </div>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5"
          >
            Pular
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Greeting ── */}
        <div className="px-6 pt-4 pb-0">
          <h2 className="text-xl font-bold text-foreground">
            Olá, {firstName}! 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bem-vindo ao Cachola OS. Deixa eu te mostrar o que tem aqui.
          </p>
        </div>

        {/* ── Slide ── */}
        <div className="px-6 py-7">
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className={cn(
                'w-20 h-20 rounded-3xl flex items-center justify-center shrink-0',
                iconClass,
              )}
            >
              <Icon className="w-10 h-10" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
            </div>
          </div>
        </div>

        {/* ── Dots ── */}
        <div className="flex justify-center gap-1.5 pb-1">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              aria-label={`Slide ${i + 1}`}
              className={cn(
                'rounded-full transition-all duration-200',
                i === slide
                  ? 'w-5 h-2 bg-primary'
                  : 'w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/40',
              )}
            />
          ))}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 px-6 py-5">
          <button
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            className={cn(
              'text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0',
              slide === 0 && 'invisible pointer-events-none',
            )}
          >
            ← Voltar
          </button>
          <Button onClick={handleNext} className="flex-1 gap-1.5">
            {isLast ? (
              <>Começar <ArrowRight className="w-4 h-4" /></>
            ) : (
              <>Próximo <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
