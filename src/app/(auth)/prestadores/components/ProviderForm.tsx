'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUnitStore } from '@/stores/unit-store'
import { useServiceCategories } from '@/hooks/use-service-categories'
import {
  useCreateProvider,
  useUpdateProvider,
} from '@/hooks/use-providers'
import {
  useCreateContact,
  useDeleteContact,
  useUpdateContact,
} from '@/hooks/use-provider-contacts'
import {
  useCreateProviderService,
  useDeleteProviderService,
  useUpdateProviderService,
} from '@/hooks/use-provider-services'
import {
  useUploadProviderDocument,
  useDeleteProviderDocument,
} from '@/hooks/use-provider-documents'
import { parseCurrency } from '@/lib/utils/providers'

import { ProviderFormStepper } from './ProviderFormStepper'
import type { StepDef } from './ProviderFormStepper'
import { BasicDataStep, validateBasicData } from './steps/BasicDataStep'
import type { BasicData } from './steps/BasicDataStep'
import { DEFAULT_BASIC_DATA } from './steps/BasicDataStep'
import { ContactsStep, validateContactsStep } from './steps/ContactsStep'
import { ServicesStep, validateServicesStep } from './steps/ServicesStep'
import { DocumentsStep } from './steps/DocumentsStep'
import type { ContactDraft } from './ContactInlineForm'
import type { ServiceDraft } from './ServiceInlineForm'
import type { DocDraft } from './DocumentUploadCard'
import type { ServiceProviderWithDetails } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  provider?: ServiceProviderWithDetails
  onSuccess?: () => void
}

type StepErrors = Record<string, string>

const STEP_LABELS = ['Dados Básicos', 'Contatos', 'Serviços', 'Documentos']
const TOTAL_STEPS = 4

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildBasicFromProvider(p: ServiceProviderWithDetails): BasicData {
  return {
    document_type: p.document_type,
    document_number: p.document_number,
    name: p.name,
    legal_name: p.legal_name ?? '',
    status: p.status,
    instagram: p.instagram ?? '',
    zip_code: p.zip_code ?? '',
    state: p.state ?? '',
    city: p.city ?? '',
    address: p.address ?? '',
    website: p.website ?? '',
    tags: p.tags ?? [],
    notes: p.notes ?? '',
  }
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function ProviderForm({ provider, onSuccess }: Props) {
  const router = useRouter()
  const { activeUnitId } = useUnitStore()
  const isEditMode = !!provider

  // ── Data ──────────────────────────────────────────────────
  const { data: categories = [] } = useServiceCategories()

  // ── Mutations ─────────────────────────────────────────────
  const createProvider = useCreateProvider()
  const updateProvider = useUpdateProvider()
  const createContact = useCreateContact()
  const deleteContact = useDeleteContact()
  const updateContact = useUpdateContact()
  const createService = useCreateProviderService()
  const deleteService = useDeleteProviderService()
  const updateService = useUpdateProviderService()
  const uploadDoc = useUploadProviderDocument()
  const deleteDoc = useDeleteProviderDocument()

  // ── Step state ────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]))
  const [stepErrors, setStepErrors] = useState<StepErrors[]>(
    Array.from({ length: TOTAL_STEPS }, () => ({}))
  )
  const [isSaving, setIsSaving] = useState(false)

  // ── Form data ─────────────────────────────────────────────
  const [basicData, setBasicData] = useState<BasicData>(
    provider ? buildBasicFromProvider(provider) : DEFAULT_BASIC_DATA
  )
  const [pendingContacts, setPendingContacts] = useState<ContactDraft[]>([])
  const [pendingServices, setPendingServices] = useState<ServiceDraft[]>([])
  const [pendingDocs, setPendingDocs] = useState<DocDraft[]>([])

  // ── Helpers ───────────────────────────────────────────────

  function setStepError(step: number, errors: StepErrors) {
    setStepErrors((prev) => {
      const next = [...prev]
      next[step] = errors
      return next
    })
  }

  function clearError(step: number, field: string) {
    setStepErrors((prev) => {
      const next = [...prev]
      next[step] = { ...next[step] }
      delete next[step][field]
      return next
    })
  }

  function validateStep(step: number): boolean {
    let errs: StepErrors = {}
    if (step === 0) {
      errs = validateBasicData(basicData)
    } else if (step === 1) {
      errs = validateContactsStep(provider?.contacts ?? [], pendingContacts)
    } else if (step === 2) {
      errs = validateServicesStep(provider?.services ?? [], pendingServices)
    }
    setStepError(step, errs)
    return Object.keys(errs).length === 0
  }

  function validateAll(): number {
    const allErrs = [
      validateBasicData(basicData),
      validateContactsStep(provider?.contacts ?? [], pendingContacts),
      validateServicesStep(provider?.services ?? [], pendingServices),
      {},
    ]
    const newStepErrors = allErrs.map((e) => e)
    setStepErrors(newStepErrors)

    // Return first step with errors (-1 if none)
    return newStepErrors.findIndex((e) => Object.keys(e).length > 0)
  }

  // ── Navigation ────────────────────────────────────────────

  function goNext() {
    if (!validateStep(currentStep)) return
    const next = currentStep + 1
    setCurrentStep(next)
    setVisitedSteps((prev) => new Set([...prev, next]))
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  function handleStepClick(step: number) {
    if (!visitedSteps.has(step)) return
    setCurrentStep(step)
  }

  // ── Save ──────────────────────────────────────────────────

  async function handleSave() {
    const firstErrStep = validateAll()
    if (firstErrStep !== -1) {
      setCurrentStep(firstErrStep)
      toast.error('Corrija os erros antes de salvar.')
      return
    }

    setIsSaving(true)
    try {
      if (isEditMode) {
        await saveEditMode()
      } else {
        await saveCreateMode()
      }
      onSuccess?.()
    } catch {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveCreateMode() {
    // 1. Create provider
    const providerRow = await createProvider.mutateAsync({
      document_type: basicData.document_type,
      document_number: basicData.document_number.replace(/\D/g, ''),
      name: basicData.name.trim(),
      legal_name: basicData.legal_name.trim() || undefined,
      status: basicData.status,
      tags: basicData.tags,
      notes: basicData.notes.trim() || undefined,
      address: basicData.address.trim() || undefined,
      city: basicData.city.trim() || undefined,
      state: basicData.state || undefined,
      zip_code: basicData.zip_code.replace(/\D/g, '') || undefined,
      website: basicData.website.trim() || undefined,
      instagram: basicData.instagram.trim() || undefined,
    })

    const providerId = providerRow.id

    // 2. Create contacts (fire independently — warn on fail, don't block)
    const contactResults = await Promise.allSettled(
      pendingContacts.map((c) =>
        createContact.mutateAsync({
          provider_id: providerId,
          unit_id: activeUnitId!,
          type: c.type,
          value: c.value.replace(/\D/g, '') || c.value,
          label: c.label || undefined,
          is_primary: c.is_primary,
        })
      )
    )
    const failedContacts = contactResults.filter((r) => r.status === 'rejected').length
    if (failedContacts > 0) {
      toast.warning(`${failedContacts} contato(s) não foram salvos.`)
    }

    // 3. Create services
    const serviceResults = await Promise.allSettled(
      pendingServices.map((s) =>
        createService.mutateAsync({
          provider_id: providerId,
          category_id: s.category_id,
          unit_id: activeUnitId!,
          description: s.description || undefined,
          price_type: s.price_type,
          price_value: s.price_value ? parseCurrency(s.price_value) : undefined,
          notes: s.notes || undefined,
        })
      )
    )
    const failedServices = serviceResults.filter((r) => r.status === 'rejected').length
    if (failedServices > 0) {
      toast.warning(`${failedServices} serviço(s) não foram salvos.`)
    }

    // 4. Upload documents
    const docResults = await Promise.allSettled(
      pendingDocs
        .filter((d) => d.name.trim())
        .map((d) =>
          uploadDoc.mutateAsync({
            provider_id: providerId,
            unit_id: activeUnitId!,
            file: d.file,
            name: d.name.trim(),
            doc_type: d.doc_type,
            expires_at: d.expires_at || undefined,
          })
        )
    )
    const failedDocs = docResults.filter((r) => r.status === 'rejected').length
    if (failedDocs > 0) {
      toast.warning(`${failedDocs} documento(s) não foram enviados.`)
    }

    toast.success('Prestador cadastrado com sucesso!')
    router.push(`/prestadores/${providerId}`)
  }

  async function saveEditMode() {
    if (!provider) return

    await updateProvider.mutateAsync({
      id: provider.id,
      document_type: basicData.document_type,
      document_number: basicData.document_number.replace(/\D/g, ''),
      name: basicData.name.trim(),
      legal_name: basicData.legal_name.trim() || undefined,
      status: basicData.status,
      tags: basicData.tags,
      notes: basicData.notes.trim() || undefined,
      address: basicData.address.trim() || undefined,
      city: basicData.city.trim() || undefined,
      state: basicData.state || undefined,
      zip_code: basicData.zip_code.replace(/\D/g, '') || undefined,
      website: basicData.website.trim() || undefined,
      instagram: basicData.instagram.trim() || undefined,
    })

    toast.success('Prestador atualizado com sucesso!')
    router.push(`/prestadores/${provider.id}`)
  }

  // ── Edit mode: immediate sub-resource mutations ───────────

  const handleDeleteSavedContact = useCallback(
    (id: string) => {
      if (!provider) return
      deleteContact.mutate({ id, provider_id: provider.id })
    },
    [deleteContact, provider]
  )

  const handleUpdateSavedContact = useCallback(
    (id: string, data: Partial<ContactDraft>) => {
      if (!provider) return
      updateContact.mutate({
        id,
        provider_id: provider.id,
        unit_id: activeUnitId!,
        type: data.type,
        value: data.value,
        label: data.label,
        is_primary: data.is_primary,
      })
    },
    [updateContact, provider, activeUnitId]
  )

  const handleDeleteSavedService = useCallback(
    (id: string) => {
      if (!provider) return
      deleteService.mutate({ id, provider_id: provider.id })
    },
    [deleteService, provider]
  )

  const handleUpdateSavedService = useCallback(
    (id: string, data: Partial<ServiceDraft>) => {
      if (!provider) return
      updateService.mutate({
        id,
        provider_id: provider.id,
        price_type: data.price_type,
        price_value: data.price_value ? parseCurrency(data.price_value) : undefined,
        description: data.description || undefined,
        notes: data.notes || undefined,
      })
    },
    [updateService, provider]
  )

  const handleDeleteSavedDoc = useCallback(
    (id: string) => {
      if (!provider) return
      const doc = provider.documents.find((d) => d.id === id)
      if (!doc) return
      deleteDoc.mutate({ id, provider_id: provider.id, file_url: doc.file_url })
    },
    [deleteDoc, provider]
  )

  // ── Stepper definitions ───────────────────────────────────

  const steps: StepDef[] = STEP_LABELS.map((label, idx) => ({
    label,
    isComplete: visitedSteps.has(idx) && idx < currentStep,
    hasError: Object.keys(stepErrors[idx]).length > 0,
  }))

  const isLastStep = currentStep === TOTAL_STEPS - 1

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href={isEditMode ? `/prestadores/${provider!.id}` : '/prestadores'}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEditMode ? 'Voltar para o prestador' : 'Voltar para listagem'}
        </Link>
      </div>

      {/* Stepper */}
      <ProviderFormStepper
        currentStep={currentStep}
        steps={steps}
        onStepClick={handleStepClick}
        visitedSteps={visitedSteps}
      />

      {/* Step card */}
      <div className="bg-card rounded-xl border border-border p-5 sm:p-6">
        {/* Step 0 — Dados Básicos */}
        {currentStep === 0 && (
          <BasicDataStep
            data={basicData}
            errors={stepErrors[0]}
            onChange={(field, value) => {
              setBasicData((prev) => ({ ...prev, [field]: value }))
            }}
            onClearError={(field) => clearError(0, field)}
          />
        )}

        {/* Step 1 — Contatos */}
        {currentStep === 1 && (
          <ContactsStep
            savedContacts={provider?.contacts ?? []}
            pendingContacts={pendingContacts}
            errors={stepErrors[1]}
            onAddPending={(c) => setPendingContacts((prev) => [...prev, c])}
            onUpdatePending={(idx, c) =>
              setPendingContacts((prev) => prev.map((x, i) => (i === idx ? c : x)))
            }
            onRemovePending={(idx) =>
              setPendingContacts((prev) => prev.filter((_, i) => i !== idx))
            }
            onDeleteSaved={isEditMode ? handleDeleteSavedContact : undefined}
            onUpdateSaved={isEditMode ? handleUpdateSavedContact : undefined}
          />
        )}

        {/* Step 2 — Serviços */}
        {currentStep === 2 && (
          <ServicesStep
            savedServices={provider?.services ?? []}
            pendingServices={pendingServices}
            categories={categories}
            errors={stepErrors[2]}
            onAddPending={(s) => setPendingServices((prev) => [...prev, s])}
            onUpdatePending={(idx, s) =>
              setPendingServices((prev) => prev.map((x, i) => (i === idx ? s : x)))
            }
            onRemovePending={(idx) =>
              setPendingServices((prev) => prev.filter((_, i) => i !== idx))
            }
            onDeleteSaved={isEditMode ? handleDeleteSavedService : undefined}
            onUpdateSaved={isEditMode ? handleUpdateSavedService : undefined}
          />
        )}

        {/* Step 3 — Documentos */}
        {currentStep === 3 && (
          <DocumentsStep
            savedDocuments={provider?.documents ?? []}
            pendingDocs={pendingDocs}
            errors={stepErrors[3]}
            onAddDoc={(d) => setPendingDocs((prev) => [...prev, d])}
            onUpdateDoc={(idx, data) =>
              setPendingDocs((prev) =>
                prev.map((x, i) => (i === idx ? { ...x, ...data } : x))
              )
            }
            onRemoveDoc={(idx) =>
              setPendingDocs((prev) => prev.filter((_, i) => i !== idx))
            }
            onDeleteSaved={isEditMode ? handleDeleteSavedDoc : undefined}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className={cn(
        'flex gap-3',
        'flex-col-reverse sm:flex-row sm:justify-end',
      )}>
        {/* Cancel / Anterior */}
        {currentStep === 0 ? (
          <button
            type="button"
            onClick={() => router.push(isEditMode ? `/prestadores/${provider!.id}` : '/prestadores')}
            className="h-11 sm:h-10 px-5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        ) : (
          <button
            type="button"
            onClick={goPrev}
            disabled={isSaving}
            className="h-11 sm:h-10 px-5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
        )}

        {/* Próximo / Salvar */}
        {isLastStep ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-11 sm:h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Salvando…' : isEditMode ? 'Salvar Alterações' : 'Cadastrar Prestador'}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="h-11 sm:h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all inline-flex items-center justify-center gap-2"
          >
            Próximo
            <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        )}
      </div>
    </div>
  )
}
