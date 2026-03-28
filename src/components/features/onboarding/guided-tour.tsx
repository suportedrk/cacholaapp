'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingStore, TOUR_STEPS } from '@/stores/onboarding-store'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface TooltipPos {
  top: number
  left: number
  placement: 'above' | 'below' | 'right' | 'left'
}

// ── Helpers ───────────────────────────────────────────────────

const PAD = 10  // spotlight padding around the target
const TIP_W = 284
const TIP_H = 150

function getTooltipPos(spotlight: Rect): TooltipPos {
  const viewH = window.innerHeight
  const viewW = window.innerWidth
  const margin = 12

  const spBottom = spotlight.top + spotlight.height
  const spRight  = spotlight.left + spotlight.width
  const centerX  = spotlight.left + spotlight.width / 2

  const clampX = (x: number) => Math.max(12, Math.min(viewW - TIP_W - 12, x))

  // Prefer below
  if (viewH - spBottom >= TIP_H + margin) {
    return { top: spBottom + margin, left: clampX(centerX - TIP_W / 2), placement: 'below' }
  }
  // Then above
  if (spotlight.top >= TIP_H + margin) {
    return { top: spotlight.top - TIP_H - margin, left: clampX(centerX - TIP_W / 2), placement: 'above' }
  }
  // Then right
  if (viewW - spRight >= TIP_W + margin) {
    const top = Math.max(12, Math.min(viewH - TIP_H - 12, spotlight.top + spotlight.height / 2 - TIP_H / 2))
    return { top, left: spRight + margin, placement: 'right' }
  }
  // Fallback: left
  const top = Math.max(12, Math.min(viewH - TIP_H - 12, spotlight.top + spotlight.height / 2 - TIP_H / 2))
  return { top, left: Math.max(12, spotlight.left - TIP_W - margin), placement: 'left' }
}

// ── Arrow ─────────────────────────────────────────────────────

function Arrow({ placement }: { placement: TooltipPos['placement'] }) {
  const base = 'absolute w-0 h-0 border-[6px] border-transparent'
  const arrowStyle = {
    above:  'bottom-[-12px] left-1/2 -translate-x-1/2 border-t-card',
    below:  'top-[-12px] left-1/2 -translate-x-1/2 border-b-card',
    right:  'left-[-12px] top-1/2 -translate-y-1/2 border-r-card',
    left:   'right-[-12px] top-1/2 -translate-y-1/2 border-l-card',
  }[placement]

  return <div className={cn(base, arrowStyle)} />
}

// ── Main component ────────────────────────────────────────────

export function GuidedTour() {
  const { tourActive, tourStep, nextTourStep, skipTour } = useOnboardingStore()

  const [mounted,      setMounted]      = useState(false)
  const [spotlight,    setSpotlight]    = useState<Rect | null>(null)
  const [tooltipPos,   setTooltipPos]   = useState<TooltipPos | null>(null)

  const step = TOUR_STEPS[tourStep]

  useEffect(() => { setMounted(true) }, [])

  const updatePositions = useCallback(() => {
    if (!tourActive || !step) return

    const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`)
    if (!el) {
      nextTourStep()
      return
    }

    const r = el.getBoundingClientRect()

    // Skip if element is completely off-screen (e.g. sidebar hidden on mobile)
    const isOffScreen =
      r.right <= 0 ||
      r.bottom <= 0 ||
      r.left >= window.innerWidth ||
      r.top >= window.innerHeight
    if (isOffScreen) {
      nextTourStep()
      return
    }
    const rect: Rect = {
      top:    r.top    - PAD,
      left:   r.left   - PAD,
      width:  r.width  + PAD * 2,
      height: r.height + PAD * 2,
    }
    setSpotlight(rect)
    setTooltipPos(getTooltipPos(rect))
  }, [tourActive, tourStep, step, nextTourStep])

  useEffect(() => {
    updatePositions()
    window.addEventListener('resize', updatePositions)
    return () => window.removeEventListener('resize', updatePositions)
  }, [updatePositions])

  // Scroll target into view if needed
  useEffect(() => {
    if (!tourActive || !step) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [tourActive, tourStep, step])

  if (!mounted || !tourActive || !step || !spotlight) return null

  const isLast = tourStep === TOUR_STEPS.length - 1

  return createPortal(
    <>
      {/* ── Dark overlay (blocks background clicks) ── */}
      <div
        className="fixed inset-0 z-[9997] pointer-events-all"
        aria-hidden
        onClick={skipTour}
      />

      {/* ── Spotlight (box-shadow creates the overlay hole) ── */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          top:    spotlight.top,
          left:   spotlight.left,
          width:  spotlight.width,
          height: spotlight.height,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 2px hsl(var(--primary))',
          zIndex: 9998,
          pointerEvents: 'none',
          transition: 'top 250ms ease-out, left 250ms ease-out, width 250ms ease-out, height 250ms ease-out',
        }}
      />

      {/* ── Tooltip card ── */}
      {tooltipPos && (
        <div
          style={{
            position: 'fixed',
            top:  tooltipPos.top,
            left: tooltipPos.left,
            width: TIP_W,
            zIndex: 9999,
          }}
          className="bg-card border border-border rounded-2xl shadow-2xl p-4 animate-scale-in"
        >
          <Arrow placement={tooltipPos.placement} />

          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground leading-snug">{step.title}</p>
            <button
              onClick={skipTour}
              className="shrink-0 -mt-0.5 -mr-0.5 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Fechar tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">{step.description}</p>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mb-3.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === tourStep
                    ? 'w-4 h-1.5 bg-primary'
                    : i < tourStep
                    ? 'w-1.5 h-1.5 bg-primary/40'
                    : 'w-1.5 h-1.5 bg-muted-foreground/20',
                )}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={skipTour}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Pular tour
            </button>
            <Button size="sm" onClick={nextTourStep} className="h-7 text-xs px-3">
              {isLast ? 'Concluir' : 'Próximo →'}
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
