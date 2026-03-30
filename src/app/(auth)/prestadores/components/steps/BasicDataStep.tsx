'use client'

import { useRef, useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  maskDocument,
  validateCPF,
  validateCNPJ,
} from '@/lib/utils/providers'
import { PROVIDER_STATUS_LABELS } from '@/types/providers'
import type { DocumentType, ProviderStatus } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface BasicData {
  document_type: DocumentType
  document_number: string
  name: string
  legal_name: string
  status: ProviderStatus
  instagram: string
  zip_code: string
  state: string
  city: string
  address: string
  website: string
  tags: string[]
  notes: string
}

export const DEFAULT_BASIC_DATA: BasicData = {
  document_type: 'cpf',
  document_number: '',
  name: '',
  legal_name: '',
  status: 'active',
  instagram: '',
  zip_code: '',
  state: '',
  city: '',
  address: '',
  website: '',
  tags: [],
  notes: '',
}

interface Props {
  data: BasicData
  errors: Record<string, string>
  onChange: (field: keyof BasicData, value: BasicData[keyof BasicData]) => void
  onClearError: (field: string) => void
}

// ─────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────

export function validateBasicData(data: BasicData): Record<string, string> {
  const errs: Record<string, string> = {}
  if (!data.document_type) errs.document_type = 'Selecione o tipo de documento.'

  const docDigits = data.document_number.replace(/\D/g, '')
  if (!data.document_number) {
    errs.document_number = 'Informe o número do documento.'
  } else if (data.document_type === 'cpf' && !validateCPF(docDigits)) {
    errs.document_number = 'CPF inválido.'
  } else if (data.document_type === 'cnpj' && !validateCNPJ(docDigits)) {
    errs.document_number = 'CNPJ inválido.'
  }

  if (!data.name.trim()) {
    errs.name = 'Informe o nome do prestador.'
  } else if (data.name.trim().length < 3) {
    errs.name = 'Nome deve ter no mínimo 3 caracteres.'
  }

  if (data.document_type === 'cnpj' && !data.legal_name.trim()) {
    errs.legal_name = 'Razão social é obrigatória para CNPJ.'
  }

  return errs
}

// ─────────────────────────────────────────────────────────────
// BR states list
// ─────────────────────────────────────────────────────────────

const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

const TAG_SUGGESTIONS = [
  'Pontual', 'Criativo', 'Excelente com crianças', 'Equip. próprio',
  'Precisa supervisão', 'Premium', 'Custo-benefício', 'Faz pacote',
]

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function BasicDataStep({ data, errors, onChange, onClearError }: Props) {
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || data.tags.includes(trimmed)) return
    onChange('tags', [...data.tags, trimmed])
    setTagInput('')
  }

  function removeTag(tag: string) {
    onChange('tags', data.tags.filter((t) => t !== tag))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && data.tags.length > 0) {
      removeTag(data.tags[data.tags.length - 1])
    }
  }

  function handleDocNumberChange(raw: string) {
    // When switching type clear the field
    const masked = maskDocument(raw)
    onChange('document_number', masked)
    onClearError('document_number')
  }

  function handleDocTypeChange(type: DocumentType) {
    onChange('document_type', type)
    onChange('document_number', '')
    if (type === 'cpf') onChange('legal_name', '')
    onClearError('document_type')
    onClearError('document_number')
    onClearError('legal_name')
  }

  const filteredSuggestions = TAG_SUGGESTIONS.filter(
    (s) => !data.tags.includes(s) && s.toLowerCase().includes(tagInput.toLowerCase())
  )

  const inputBase = cn(
    'w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground',
    'placeholder:text-muted-foreground/60 outline-none',
    'focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
  )

  const fieldError = (field: string) => errors[field]

  const FieldError = ({ field }: { field: string }) => {
    const msg = fieldError(field)
    if (!msg) return null
    return (
      <p className="flex items-center gap-1 text-xs text-destructive mt-1">
        <AlertCircle className="w-3 h-3 shrink-0" />
        {msg}
      </p>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Documento ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Identificação</h3>

        {/* Tipo de documento */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Tipo de Documento <span className="text-destructive">*</span>
          </p>
          <div className="flex gap-4">
            {(['cpf', 'cnpj'] as DocumentType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="document_type"
                  value={t}
                  checked={data.document_type === t}
                  onChange={() => handleDocTypeChange(t)}
                  className="h-4 w-4 accent-primary cursor-pointer"
                />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors select-none uppercase">
                  {t}
                </span>
              </label>
            ))}
          </div>
          <FieldError field="document_type" />
        </div>

        {/* Número do documento */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {data.document_type === 'cpf' ? 'CPF' : 'CNPJ'} <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={data.document_number}
            onChange={(e) => handleDocNumberChange(e.target.value)}
            onBlur={() => {
              const docDigits = data.document_number.replace(/\D/g, '')
              if (data.document_type === 'cpf' && docDigits && !validateCPF(docDigits)) {
                // error already set on submit; just show visual hint
              }
            }}
            placeholder={data.document_type === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
            aria-invalid={!!fieldError('document_number')}
            className={cn(
              inputBase,
              fieldError('document_number') && 'border-destructive focus:ring-destructive/30',
            )}
          />
          <FieldError field="document_number" />
        </div>
      </section>

      {/* ── Dados pessoais ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Dados do Prestador</h3>

        {/* Nome */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Nome / Nome Fantasia <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => { onChange('name', e.target.value); onClearError('name') }}
            placeholder="Nome do prestador ou empresa"
            aria-invalid={!!fieldError('name')}
            className={cn(inputBase, fieldError('name') && 'border-destructive focus:ring-destructive/30')}
          />
          <FieldError field="name" />
        </div>

        {/* Razão social (CNPJ only) */}
        {data.document_type === 'cnpj' && (
          <div className="space-y-1.5 animate-fade-up">
            <label className="block text-sm font-medium text-foreground">
              Razão Social <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={data.legal_name}
              onChange={(e) => { onChange('legal_name', e.target.value); onClearError('legal_name') }}
              placeholder="Razão social completa"
              aria-invalid={!!fieldError('legal_name')}
              className={cn(inputBase, fieldError('legal_name') && 'border-destructive focus:ring-destructive/30')}
            />
            <FieldError field="legal_name" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Status */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Status</label>
            <select
              value={data.status}
              onChange={(e) => onChange('status', e.target.value as ProviderStatus)}
              className={cn(inputBase, 'cursor-pointer appearance-none pr-8')}
            >
              {(Object.keys(PROVIDER_STATUS_LABELS) as ProviderStatus[]).map((s) => (
                <option key={s} value={s}>{PROVIDER_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Instagram
              <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                @
              </span>
              <input
                type="text"
                value={data.instagram}
                onChange={(e) => onChange('instagram', e.target.value.replace(/^@/, ''))}
                placeholder="usuario"
                className={cn(inputBase, 'pl-7')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Endereço ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Endereço</h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* CEP */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              CEP
              <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.zip_code}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 8)
                const masked = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
                onChange('zip_code', masked)
              }}
              placeholder="00000-000"
              className={inputBase}
            />
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              UF
              <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
            </label>
            <select
              value={data.state}
              onChange={(e) => onChange('state', e.target.value)}
              className={cn(inputBase, 'cursor-pointer appearance-none pr-8')}
            >
              <option value="">—</option>
              {BR_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Cidade */}
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Cidade
              <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
            </label>
            <input
              type="text"
              value={data.city}
              onChange={(e) => onChange('city', e.target.value)}
              placeholder="São Paulo"
              className={inputBase}
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Logradouro
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>
          <input
            type="text"
            value={data.address}
            onChange={(e) => onChange('address', e.target.value)}
            placeholder="Rua, número, complemento"
            className={inputBase}
          />
        </div>
      </section>

      {/* ── Informações adicionais ── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Informações Adicionais</h3>

        {/* Website */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Website
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>
          <input
            type="url"
            value={data.website}
            onChange={(e) => onChange('website', e.target.value)}
            placeholder="https://..."
            className={inputBase}
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Tags
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>

          {/* Pills */}
          {data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {data.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-destructive transition-colors ml-0.5"
                    aria-label={`Remover tag ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setShowSuggestions(true) }}
              onKeyDown={handleTagKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder='Digite e pressione Enter ou vírgula para adicionar'
              className={inputBase}
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 z-10 bg-card border border-border rounded-lg shadow-md py-1 max-h-40 overflow-y-auto">
                {filteredSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                    className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pressione Enter ou vírgula para adicionar. Clique em uma sugestão para selecionar.
          </p>
        </div>

        {/* Observações */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Observações internas
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>
          <textarea
            value={data.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Anotações internas sobre este prestador..."
            rows={4}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground',
              'placeholder:text-muted-foreground/60 outline-none resize-none',
              'focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
              'min-h-[100px]',
            )}
          />
        </div>
      </section>
    </div>
  )
}
