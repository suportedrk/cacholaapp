'use client'

import { Check, AlertCircle, FileText, Phone, Briefcase, Paperclip } from 'lucide-react'
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

const STEP_ICONS = [FileText, Phone, Briefcase, Paperclip]

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ProviderFormStepper({ currentStep, steps, onStepClick, visitedSteps }: Props) {
  return (
    <nav aria-label="Etapas do formulário" className="w-full">
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
                  'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 text-xs font-semibold select-none',
                  // Complete
                  isComplete && !hasError && 'bg-primary border-primary text-primary-foreground',
                  // Current (not complete)
                  isCurrent && !isComplete && !hasError && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/20',
                  // Error
                  hasError && 'bg-destructive border-destructive text-destructive-foreground',
                  // Pending (not visited)
                  !isComplete && !isCurrent && !hasError && 'bg-muted border-border text-muted-foreground',
                  // Cursor
                  isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                )}
              >
                {hasError ? (
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                ) : isComplete ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>

              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-[10px] sm:text-xs font-medium text-center leading-tight max-w-[56px] sm:max-w-none',
                  isCurrent ? 'text-primary' : hasError ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {/* Mobile: show step number + label only for current */}
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">
                  {isCurrent ? step.label : <span className="opacity-0">·</span>}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
