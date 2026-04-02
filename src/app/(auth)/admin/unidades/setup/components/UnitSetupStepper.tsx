'use client'

import { Check, AlertCircle, Building2, Link2, Copy, Users, Handshake } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface StepDef {
  label: string
  isComplete: boolean
  hasError: boolean
}

interface Props {
  currentStep: number
  steps: StepDef[]
  onStepClick: (step: number) => void
  visitedSteps: Set<number>
}

const STEP_ICONS = [Building2, Link2, Copy, Users, Handshake]

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function UnitSetupStepper({ currentStep, steps, onStepClick, visitedSteps }: Props) {
  return (
    <nav aria-label="Etapas do wizard" className="w-full">
      <ol className="flex items-start justify-between relative">
        {steps.map((step, idx) => {
          const Icon = STEP_ICONS[idx]
          const isCurrent = idx === currentStep
          const isComplete = step.isComplete
          const hasError = step.hasError
          const isVisited = visitedSteps.has(idx)
          const isClickable = isVisited && !isCurrent

          return (
            <li key={idx} className="flex flex-1 flex-col items-center relative">
              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute top-4 left-1/2 w-full h-0.5 -z-0',
                    isComplete ? 'bg-primary' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(idx)}
                disabled={!isClickable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Etapa ${idx + 1}: ${step.label}${isComplete ? ' (concluída)' : ''}${hasError ? ' (com erro)' : ''}`}
                className={cn(
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 shrink-0',
                  isComplete && !hasError && 'bg-primary border-primary text-primary-foreground',
                  hasError && 'bg-destructive border-destructive text-destructive-foreground',
                  isCurrent && !isComplete && !hasError && 'bg-background border-primary text-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]',
                  !isCurrent && !isComplete && !hasError && 'bg-background border-border text-muted-foreground',
                  isClickable && 'cursor-pointer hover:border-primary/70',
                  !isClickable && !isCurrent && 'cursor-default',
                )}
              >
                {isComplete && !hasError ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : hasError ? (
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>

              {/* Label — hidden on very small screens */}
              <span
                className={cn(
                  'mt-2 text-center text-xs font-medium leading-tight hidden sm:block max-w-[80px] transition-colors duration-200',
                  isCurrent && 'text-primary',
                  isComplete && !hasError && !isCurrent && 'text-primary/70',
                  hasError && 'text-destructive',
                  !isCurrent && !isComplete && !hasError && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>

              {/* Mobile: step number below (tiny) */}
              <span className="mt-1 text-[10px] text-muted-foreground sm:hidden">
                {idx + 1}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
