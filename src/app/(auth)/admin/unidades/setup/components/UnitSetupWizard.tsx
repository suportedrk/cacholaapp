'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Loader2,
  Building2, Link2, Copy, Users, Handshake, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useUnitStore } from '@/stores/unit-store'
import { UnitSetupStepper } from './UnitSetupStepper'
import { Step1Dados, type Step1Data } from './steps/Step1Dados'
import { Step2Ploomes, type Step2Data } from './steps/Step2Ploomes'
import { Step3Templates, type Step3Data } from './steps/Step3Templates'
import { Step4Equipe, type Step4Data } from './steps/Step4Equipe'
import { Step5Prestadores, type Step5Data } from './steps/Step5Prestadores'
import {
  useCopyTemplates,
  useLinkTeam,
  useLinkProviders,
  useFinalizeSetup,
} from '@/hooks/use-unit-setup'
import type { UnitSetupStatus } from '@/hooks/use-unit-setup'
import type { StepDef } from './UnitSetupStepper'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  unitId: string
  initialStatus: UnitSetupStatus
}

// ─────────────────────────────────────────────────────────────
// Step labels
// ─────────────────────────────────────────────────────────────

const STEP_LABELS = ['Dados', 'Ploomes', 'Templates', 'Equipe', 'Prestadores']

// ─────────────────────────────────────────────────────────────
// Summary component
// ─────────────────────────────────────────────────────────────

function SummarySection({ label, icon: Icon, count, done }: {
  label: string; icon: React.ElementType; count?: number; done: boolean
}) {
  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      done ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20' : 'border-border bg-muted/30',
    )}>
      <div className={cn('p-2 rounded-lg', done ? 'icon-success' : 'icon-muted')}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <p className={cn('text-sm font-medium', done ? 'text-green-800 dark:text-green-300' : 'text-muted-foreground')}>{label}</p>
        {count !== undefined && count > 0 && (
          <p className="text-xs text-muted-foreground">{count} item(s) configurado(s)</p>
        )}
      </div>
      {done
        ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
        : <span className="text-xs text-muted-foreground shrink-0">Pulado</span>
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Wizard
// ─────────────────────────────────────────────────────────────

export function UnitSetupWizard({ unitId, initialStatus }: Props) {
  const router = useRouter()
  const { setActiveUnit } = useUnitStore()

  const [currentStep, setCurrentStep] = useState(0)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]))
  const [submitting, setSubmitting] = useState(false)

  // Step data
  const [step1, setStep1] = useState<Step1Data>({
    name: initialStatus.unit.name ?? '',
    slug: initialStatus.unit.slug ?? '',
    address: initialStatus.unit.address ?? '',
    phone: initialStatus.unit.phone ?? '',
  })
  const [step2, setStep2] = useState<Step2Data>({
    ploomesUnitName: initialStatus.ploomesValue ?? '',
    ploomesObjectId: '',
  })
  const [step3, setStep3] = useState<Step3Data>({ copyFrom: false, sourceUnitId: null })
  const [step4, setStep4] = useState<Step4Data>({ selectedMembers: [] })
  const [step5, setStep5] = useState<Step5Data>({ copyFrom: false, sourceUnitId: null, selectedProviderIds: [] })

  // Mutations
  const copyTemplates = useCopyTemplates()
  const linkTeam = useLinkTeam()
  const linkProviders = useLinkProviders()
  const finalizeSetup = useFinalizeSetup()

  // ── Validation ─────────────────────────────────────────────

  function isStep1Valid() {
    return step1.name.trim().length >= 2 && step1.slug.trim().length >= 2
  }
  function isStep2Valid() { return true } // Ploomes é opcional
  function isStep3Valid() { return !step3.copyFrom || !!step3.sourceUnitId }
  function isStep4Valid() { return true } // equipe é opcional
  function isStep5Valid() { return !step5.copyFrom || !!step5.sourceUnitId }

  function getStepError(idx: number) {
    if (idx === 0 && visitedSteps.has(0) && !isStep1Valid()) return true
    if (idx === 2 && visitedSteps.has(2) && !isStep3Valid()) return true
    if (idx === 4 && visitedSteps.has(4) && !isStep5Valid()) return true
    return false
  }

  const steps: StepDef[] = STEP_LABELS.map((label, idx) => ({
    label,
    isComplete: visitedSteps.has(idx + 1) || (idx === 4 && submitting),
    hasError: getStepError(idx),
  }))

  // ── Navigation ─────────────────────────────────────────────

  const goToStep = useCallback((idx: number) => {
    setCurrentStep(idx)
    setVisitedSteps((prev) => new Set([...prev, idx]))
  }, [])

  async function handleNext() {
    // Validate current step
    if (currentStep === 0 && !isStep1Valid()) {
      toast.error('Preencha o nome e o slug da unidade.')
      return
    }
    if (currentStep === 2 && !isStep3Valid()) {
      toast.error('Selecione a unidade de origem para copiar templates.')
      return
    }
    if (currentStep === 4 && !isStep5Valid()) {
      toast.error('Selecione a unidade de origem para copiar prestadores.')
      return
    }

    if (currentStep < 4) {
      goToStep(currentStep + 1)
    } else {
      await handleFinish()
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  // ── Finish ─────────────────────────────────────────────────

  async function handleFinish() {
    setSubmitting(true)
    try {
      // 1. Finalizar: mapeamento Ploomes + sync
      await finalizeSetup.mutateAsync({
        unitId,
        name: step1.name !== initialStatus.unit.name ? step1.name : undefined,
        address: step1.address || undefined,
        phone: step1.phone || undefined,
        ploomesUnitName: step2.ploomesUnitName.trim() || undefined,
        ploomesObjectId: step2.ploomesObjectId ? parseInt(step2.ploomesObjectId, 10) : undefined,
        triggerPloomeSync: !!step2.ploomesUnitName.trim() && !initialStatus.hasPloomesMapping,
      })

      // 2. Copiar templates
      if (step3.copyFrom && step3.sourceUnitId) {
        const result = await copyTemplates.mutateAsync({
          sourceUnitId: step3.sourceUnitId,
          targetUnitId: unitId,
        })
        toast.success(
          `Templates copiados: ${result.result.checklistTemplates} modelos, ${result.result.sectors} setores, ${result.result.serviceCategories} categorias de serviço.`
        )
      }

      // 3. Vincular equipe
      if (step4.selectedMembers.length > 0) {
        await linkTeam.mutateAsync({ unitId, members: step4.selectedMembers })
      }

      // 4. Copiar prestadores
      if (step5.copyFrom && step5.sourceUnitId && step5.selectedProviderIds.length > 0) {
        const result = await linkProviders.mutateAsync({
          sourceUnitId: step5.sourceUnitId,
          targetUnitId: unitId,
          providerIds: step5.selectedProviderIds,
        })
        toast.success(`${result.copied} prestador(es) copiado(s)${result.skipped > 0 ? `, ${result.skipped} já existia(m).` : '.'}`)
      }

      toast.success('Setup concluído com sucesso!')

      // Selecionar a unidade recém-configurada
      setActiveUnit(unitId)

      // Redirecionar para o dashboard
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao concluir setup.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────

  const isLastStep = currentStep === 4

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="card rounded-xl p-4 sm:p-6">
        <UnitSetupStepper
          currentStep={currentStep}
          steps={steps}
          onStepClick={goToStep}
          visitedSteps={visitedSteps}
        />
      </div>

      {/* Step content */}
      <div className="card rounded-xl p-4 sm:p-6 min-h-[400px]">
        {currentStep === 0 && (
          <Step1Dados
            data={step1}
            onChange={(d) => setStep1((prev) => ({ ...prev, ...d }))}
            isEditing={true}
          />
        )}
        {currentStep === 1 && (
          <Step2Ploomes
            data={step2}
            onChange={(d) => setStep2((prev) => ({ ...prev, ...d }))}
            existingValue={initialStatus.ploomesValue}
          />
        )}
        {currentStep === 2 && (
          <Step3Templates
            targetUnitId={unitId}
            data={step3}
            onChange={(d) => setStep3((prev) => ({ ...prev, ...d }))}
          />
        )}
        {currentStep === 3 && (
          <Step4Equipe
            targetUnitId={unitId}
            data={step4}
            onChange={(d) => setStep4((prev) => ({ ...prev, ...d }))}
          />
        )}
        {currentStep === 4 && !submitting && (
          <Step5Prestadores
            targetUnitId={unitId}
            data={step5}
            onChange={(d) => setStep5((prev) => ({ ...prev, ...d }))}
          />
        )}

        {/* Summary — aparece ao finalizar */}
        {submitting && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-base font-medium text-foreground">Concluindo setup...</p>
            </div>
            <SummarySection label="Dados da Unidade" icon={Building2} done={true} />
            <SummarySection label="Integração Ploomes" icon={Link2} done={!!step2.ploomesUnitName.trim()} />
            <SummarySection label="Templates Operacionais" icon={Copy} done={step3.copyFrom && !!step3.sourceUnitId} />
            <SummarySection label="Equipe" icon={Users} count={step4.selectedMembers.length} done={step4.selectedMembers.length > 0} />
            <SummarySection label="Prestadores" icon={Handshake} count={step5.selectedProviderIds.length} done={step5.copyFrom && step5.selectedProviderIds.length > 0} />
          </div>
        )}
      </div>

      {/* Aviso step 0 — nome não pode ser vazio */}
      {currentStep === 0 && !isStep1Valid() && visitedSteps.has(0) && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Nome e slug são obrigatórios.
        </div>
      )}

      {/* Navigation */}
      <div className={cn('flex gap-3', currentStep === 0 ? 'justify-end' : 'justify-between')}>
        {currentStep > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={submitting}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
        )}
        <Button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="min-w-[140px]"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aguarde...</>
          ) : isLastStep ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" />Concluir Setup</>
          ) : (
            <>Próximo<ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </div>
    </div>
  )
}
