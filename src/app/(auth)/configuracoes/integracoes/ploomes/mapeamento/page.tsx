'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  GitBranch, Database, User, CheckCircle2,
  RotateCw, Check, AlertCircle, Info, MapPin,
  FlaskConical, ArrowRight, HelpCircle, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePloomesConfig, usePloomesSyncStatus, useTriggerPloomesSync } from '@/hooks/use-ploomes-sync'
import { useUnitStore } from '@/stores/unit-store'
import { DEAL_FIELD_MAP } from '@/lib/ploomes/field-mapping'
import type { PloomesConfigRow } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ─────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const CONTACT_FIELD_LABELS: Record<string, string> = {
  clientName:  'Nome do Cliente',
  clientEmail: 'E-mail',
  clientPhone: 'Telefone',
}

const PARSER_LABELS: Record<string, string> = {
  date:   'Data',
  time:   'Hora',
  string: 'Texto',
  number: 'Número',
}

const PLOOMES_STATUS_BADGES: Record<string, string> = {
  'Em aberto': 'badge-blue border',
  'Ganho':     'badge-green border',
  'Perdido':   'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40',
}

const EVENT_STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  pending:   'Pendente',
  finished:  'Finalizado',
  lost:      'Perdido',
}

const EVENT_STATUS_BADGES: Record<string, string> = {
  confirmed: 'badge-green border',
  pending:   'badge-amber border',
  finished:  'badge-gray border',
  lost:      'badge-gray border',
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden skeleton-shimmer">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-secondary/30">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className="h-3 w-52 rounded bg-muted" />
        </div>
      </div>
      <div className="divide-y divide-border">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between items-center px-5 py-3.5">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ElementType
  title: string
  description: string
  badge?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-secondary/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">{title}</h3>
          {badge}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="Informação"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-lg bg-popover border border-border shadow-md px-3 py-2 text-xs text-muted-foreground z-50">
          {text}
        </div>
      )}
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs font-medium transition-all',
      state === 'saving' && 'text-muted-foreground',
      state === 'saved'  && 'text-green-600 dark:text-green-400',
      state === 'error'  && 'text-destructive',
    )}>
      {state === 'saving' && <RotateCw className="h-3 w-3 animate-spin" />}
      {state === 'saved'  && <Check className="h-3 w-3" />}
      {state === 'error'  && <AlertCircle className="h-3 w-3" />}
      {state === 'saving' && 'Salvando…'}
      {state === 'saved'  && 'Salvo'}
      {state === 'error'  && 'Erro ao salvar'}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION 1 — FUNIL & ESTÁGIO
// ─────────────────────────────────────────────────────────────

interface PipelineSectionProps {
  pipelineId: string
  stageId: string
  wonStatusId: string
  onChange: (field: 'pipelineId' | 'stageId' | 'wonStatusId', value: string) => void
  disabled: boolean
}

function PipelineSection({ pipelineId, stageId, wonStatusId, onChange, disabled }: PipelineSectionProps) {
  const fields = [
    {
      key: 'pipelineId' as const,
      value: pipelineId,
      label: 'ID do Pipeline',
      placeholder: 'ex: 60000636',
      tooltip: 'O ID do funil (pipeline) no Ploomes. Encontre em Configurações → Funis no painel do Ploomes.',
      required: true,
    },
    {
      key: 'stageId' as const,
      value: stageId,
      label: 'ID do Estágio (Festa Fechada)',
      placeholder: 'ex: 60004787',
      tooltip: 'O ID do estágio que representa "Festa Fechada" no funil. Somente deals neste estágio são importados.',
      required: true,
    },
    {
      key: 'wonStatusId' as const,
      value: wonStatusId,
      label: 'ID do Status "Ganho"',
      placeholder: 'ex: 2',
      tooltip: 'ID do StatusId no Ploomes que representa negócio ganho. Padrão: 1=Em aberto, 2=Ganho, 3=Perdido.',
      required: false,
    },
  ]

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <SectionHeader
        icon={GitBranch}
        title="Funil & Estágio"
        description="IDs usados para buscar e importar deals do Ploomes CRM"
        badge={
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/40 px-1.5 py-0.5 rounded-full">
            Configuração obrigatória
          </span>
        }
      />
      <div className="divide-y divide-border">
        {fields.map(({ key, value, label, placeholder, tooltip, required }) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5">
            <div className="flex items-center gap-1.5 sm:w-56 shrink-0">
              <span className="text-sm font-medium">{label}</span>
              {required && <span className="text-[10px] text-red-500 font-bold">*</span>}
              <Tooltip text={tooltip} />
            </div>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(key, e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  'w-full max-w-[180px] h-8 rounded-lg border border-border bg-background px-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
                  'placeholder:text-muted-foreground/50 font-mono',
                  disabled && 'opacity-50 cursor-not-allowed',
                  !value && required && 'border-amber-300 focus:ring-amber-400',
                )}
              />
              {value ? (
                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : required ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION 2 — CAMPOS DA FESTA (read-only)
// ─────────────────────────────────────────────────────────────

function FieldMappingSection({ config }: { config: PloomesConfigRow }) {
  const entries = Object.entries(DEAL_FIELD_MAP)
  const configuredCount = entries.filter(([key]) => key in config.field_mappings).length

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <SectionHeader
        icon={Database}
        title="Campos da Festa"
        description="Campos customizados do deal Ploomes → campos do evento no sistema"
        badge={
          <span className={cn(
            'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
            configuredCount === entries.length
              ? 'badge-green border-green-200 dark:border-green-900/40'
              : 'badge-amber border-amber-200 dark:border-amber-900/40',
          )}>
            {configuredCount}/{entries.length} configurados
          </span>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2 w-8" />
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Rótulo</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Campo Interno</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Parser</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map(([fieldKey, def]) => {
              const isConfigured = fieldKey in config.field_mappings
              return (
                <tr key={fieldKey} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-center">
                    {isConfigured ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-border mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">{def.label}</span>
                      <code className="text-[10px] text-muted-foreground font-mono hidden sm:block">
                        {fieldKey.replace('deal_', '').substring(0, 8)}…
                      </code>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{def.field}</code>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {PARSER_LABELS[def.parser] ?? def.parser}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 bg-muted/20 border-t border-border flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Estes mapeamentos são definidos no código-fonte em{' '}
          <code className="font-mono">src/lib/ploomes/field-mapping.ts</code>.
          Para alterar, edite o arquivo e faça deploy.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION 3 — DADOS DO CLIENTE
// ─────────────────────────────────────────────────────────────

interface ContactSectionProps {
  mappings: Record<string, string>
  onChange: (field: string, value: string) => void
  disabled: boolean
}

function ContactSection({ mappings, onChange, disabled }: ContactSectionProps) {
  const fields = ['clientName', 'clientEmail', 'clientPhone']

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <SectionHeader
        icon={User}
        title="Dados do Cliente"
        description="Campos do contato Ploomes → informações do cliente no evento"
      />
      <div className="divide-y divide-border">
        {fields.map((field) => (
          <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3.5">
            <div className="sm:w-40 shrink-0">
              <p className="text-sm font-medium">{CONTACT_FIELD_LABELS[field] ?? field}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{field}</p>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-muted-foreground shrink-0">← Contact.</span>
              <input
                type="text"
                value={mappings[field] ?? ''}
                onChange={(e) => onChange(field, e.target.value)}
                placeholder="NomeDoCampo"
                disabled={disabled}
                className={cn(
                  'w-full max-w-[180px] h-8 rounded-lg border border-border bg-background px-3 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
                  'placeholder:text-muted-foreground/50 font-mono',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SECTION 4 — STATUS DO DEAL (read-only)
// ─────────────────────────────────────────────────────────────

type StatusEntry = {
  statusId: number
  statusName: string
  cacholaStatus: string
}

function StatusSection({ config }: { config: PloomesConfigRow }) {
  const raw = config.status_mappings
  const entries: StatusEntry[] = Array.isArray(raw)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (raw as any[]).map((e) => ({
        statusId: e.statusId,
        statusName: e.statusName,
        cacholaStatus: e.cacholaStatus ?? e.cacholaAction ?? '',
      }))
    : Object.entries(raw as Record<string, string>).map(([name, status], i) => ({
        statusId: i + 1,
        statusName: name,
        cacholaStatus: status,
      }))

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <SectionHeader
        icon={CheckCircle2}
        title="Status do Deal"
        description="StatusId do Ploomes → status do evento no Cachola OS"
      />

      {/* Nota contextual */}
      <div className="px-5 py-3 bg-blue-50/60 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
          Todos os deals no estágio <strong>Festa Fechada</strong> são importados.
          Deals <strong>Perdido</strong> ficam ocultos por padrão na lista de eventos, mas são mantidos para estatísticas.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground text-center">
          Nenhum mapeamento de status configurado.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.statusId} className="flex items-center gap-3 px-5 py-3.5">
              {/* StatusId badge */}
              <span className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-mono font-bold bg-muted text-muted-foreground">
                {entry.statusId}
              </span>

              {/* Ploomes status pill */}
              <span className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                PLOOMES_STATUS_BADGES[entry.statusName] ?? 'badge-gray border',
              )}>
                {entry.statusName}
              </span>

              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

              {/* Cachola OS status pill */}
              <span className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                EVENT_STATUS_BADGES[entry.cacholaStatus] ?? 'badge-gray border',
              )}>
                {EVENT_STATUS_LABELS[entry.cacholaStatus] ?? entry.cacholaStatus}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-3 bg-muted/20 border-t border-border flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Para alterar este mapeamento, edite{' '}
          <code className="font-mono">status_mappings</code> na tabela{' '}
          <code className="font-mono">ploomes_config</code>.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SYNC STATUS MINI-CARD
// ─────────────────────────────────────────────────────────────

function SyncMiniCard() {
  const { data: syncData } = usePloomesSyncStatus()
  const triggerSync = useTriggerPloomesSync()
  const { activeUnitId } = useUnitStore()

  const latest = syncData?.latest
  const isRunning = syncData?.isRunning ?? false

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {isRunning ? (
            <RotateCw className="h-3.5 w-3.5 text-blue-500 animate-spin" />
          ) : latest?.status === 'success' ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : latest?.status === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium text-foreground">
            {isRunning
              ? 'Sincronizando…'
              : latest?.status === 'success'
              ? `${latest.deals_found} deals importados`
              : latest?.status === 'error'
              ? 'Último sync falhou'
              : 'Nenhum sync realizado'}
          </span>
        </div>
        {latest?.started_at && !isRunning && (
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(parseISO(latest.started_at), { locale: ptBR, addSuffix: true })}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5 shrink-0"
        disabled={isRunning || triggerSync.isPending}
        onClick={() => triggerSync.mutate({ unitId: activeUnitId ?? undefined })}
      >
        {triggerSync.isPending || isRunning ? (
          <RotateCw className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
        Sincronizar agora
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────

export default function PloomesFieldMappingPage() {
  const { activeUnitId } = useUnitStore()
  const { data: config, isLoading, isError } = usePloomesConfig(activeUnitId)

  // Editable state (pipeline section)
  const [pipelineId,  setPipelineId]  = useState('')
  const [stageId,     setStageId]     = useState('')
  const [wonStatusId, setWonStatusId] = useState('')

  // Contact mappings editable state
  const [contactMappings, setContactMappings] = useState<Record<string, string>>({})

  // Save state
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Testing state
  const [testing, setTesting] = useState(false)

  // Mirror config into a ref so effects can read it without being in dep arrays
  const configRef = useRef<PloomesConfigRow | null>(null)
  useEffect(() => { configRef.current = config ?? null }, [config])

  // Hydrate local state when config loads
  useEffect(() => {
    if (!config) return
    setPipelineId(String(config.pipeline_id ?? ''))
    setStageId(String(config.stage_id ?? ''))
    setWonStatusId(String(config.won_status_id ?? ''))
    setContactMappings((config.contact_mappings as Record<string, string>) ?? {})
  }, [config])

  // Auto-save with 500ms debounce
  const triggerSave = useCallback(() => {
    if (!config || !activeUnitId) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    setSaveState('saving')

    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/ploomes/config', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unit_id:          activeUnitId,
            pipeline_id:      parseInt(pipelineId, 10) || null,
            stage_id:         parseInt(stageId, 10) || null,
            won_status_id:    parseInt(wonStatusId, 10) || null,
            contact_mappings: contactMappings,
          }),
        })
        if (!res.ok) throw new Error('Erro ao salvar')
        setSaveState('saved')
        savedTimer.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('error')
      }
    }, 500)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, stageId, wonStatusId, contactMappings, activeUnitId, config])

  // Handlers that update state AND trigger save
  function handlePipelineChange(field: 'pipelineId' | 'stageId' | 'wonStatusId', value: string) {
    if (field === 'pipelineId')  setPipelineId(value)
    if (field === 'stageId')     setStageId(value)
    if (field === 'wonStatusId') setWonStatusId(value)
  }

  // Use effect to trigger save when pipeline fields change
  // Guard: skip if values just came from config hydration (no real user edit)
  const prevPipeline = useRef({ pipelineId: '', stageId: '', wonStatusId: '' })
  useEffect(() => {
    const prev = prevPipeline.current
    if (
      prev.pipelineId  === pipelineId &&
      prev.stageId     === stageId &&
      prev.wonStatusId === wonStatusId
    ) return
    prevPipeline.current = { pipelineId, stageId, wonStatusId }
    const cfg = configRef.current
    if (!cfg) return
    // Skip save if values still match DB (just hydrated, not edited)
    if (
      pipelineId  === String(cfg.pipeline_id  ?? '') &&
      stageId     === String(cfg.stage_id      ?? '') &&
      wonStatusId === String(cfg.won_status_id ?? '')
    ) return
    triggerSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipelineId, stageId, wonStatusId])

  const prevContact = useRef<Record<string, string>>({})
  useEffect(() => {
    const prev = JSON.stringify(prevContact.current)
    const curr = JSON.stringify(contactMappings)
    if (prev === curr) return
    prevContact.current = { ...contactMappings }
    const cfg = configRef.current
    if (!cfg) return
    // Skip save if contact mappings just came from hydration
    if (curr === JSON.stringify(cfg.contact_mappings)) return
    triggerSave()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactMappings])

  function handleContactChange(field: string, value: string) {
    setContactMappings((prev) => ({ ...prev, [field]: value }))
  }

  // Test mapping
  async function handleTestMapping() {
    setTesting(true)
    try {
      const res = await fetch('/api/ploomes/deals')
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'API Ploomes não disponível')
      }
      const data = await res.json() as { deals?: Array<{ title?: string; eventDate?: string; clientName?: string }> }
      const deal = data.deals?.[0]
      if (!deal) {
        toast.info('Nenhum deal encontrado no pipeline configurado.')
      } else {
        toast.success(
          `Mapeamento OK — "${deal.title ?? 'sem título'}" · ${deal.eventDate ?? 'sem data'} · ${deal.clientName ?? 'cliente desconhecido'}`,
          { duration: 5000 }
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao testar mapeamento')
    } finally {
      setTesting(false)
    }
  }

  const isSaving = saveState === 'saving'

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-24">

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Mapeamento de Campos</h1>
          <SaveIndicator state={saveState} />
        </div>
        <p className="text-sm text-muted-foreground pl-9">
          Configure como os dados do Ploomes CRM são importados para o Cachola OS.
        </p>
      </div>

      {/* Sync mini-card */}
      <SyncMiniCard />

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erro ao carregar configuração. Verifique se a integração está configurada.
        </div>
      )}

      {/* Config not found */}
      {!isLoading && !isError && !config && (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center shadow-sm">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm font-medium">Configuração não encontrada</p>
          <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
            Execute a migration <code className="font-mono">015_ploomes_config.sql</code> e realize
            o primeiro sync para gerar a configuração padrão.
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <>
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </>
      )}

      {/* Sections */}
      {config && (
        <div className="space-y-4">
          <PipelineSection
            pipelineId={pipelineId}
            stageId={stageId}
            wonStatusId={wonStatusId}
            onChange={handlePipelineChange}
            disabled={isSaving}
          />

          <FieldMappingSection config={config} />

          <ContactSection
            mappings={contactMappings}
            onChange={handleContactChange}
            disabled={isSaving}
          />

          <StatusSection config={config} />
        </div>
      )}

      {/* Sticky footer — Test mapping button */}
      {config && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 py-3 safe-area-inset-bottom">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Alterações são salvas automaticamente.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 ml-auto"
              onClick={handleTestMapping}
              disabled={testing || !config}
            >
              {testing ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              {testing ? 'Testando…' : 'Testar mapeamento'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
