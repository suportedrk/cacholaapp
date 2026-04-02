'use client'

import { Handshake, Search, Star, Loader2 } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { useSourceProviders, useAllUnits } from '@/hooks/use-unit-setup'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Step5Data {
  copyFrom: boolean
  sourceUnitId: string | null
  selectedProviderIds: string[]
}

interface Props {
  targetUnitId: string
  data: Step5Data
  onChange: (data: Partial<Step5Data>) => void
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Step5Prestadores({ targetUnitId, data, onChange }: Props) {
  const [search, setSearch] = useState('')
  const { data: units } = useAllUnits()
  const sourceUnits = (units ?? []).filter((u) => u.id !== targetUnitId)

  const { data: providers, isLoading: loadingProviders } = useSourceProviders(
    data.copyFrom ? data.sourceUnitId : null
  )

  const filtered = useMemo(() => {
    if (!providers) return []
    const q = search.toLowerCase().trim()
    return providers.filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [providers, search])

  function isSelected(id: string) {
    return data.selectedProviderIds.includes(id)
  }

  function toggleProvider(id: string) {
    if (isSelected(id)) {
      onChange({ selectedProviderIds: data.selectedProviderIds.filter((pid) => pid !== id) })
    } else {
      onChange({ selectedProviderIds: [...data.selectedProviderIds, id] })
    }
  }

  function toggleAll() {
    if (!filtered.length) return
    const allFilteredIds = filtered.map((p) => p.id)
    const allSelected = allFilteredIds.every((id) => data.selectedProviderIds.includes(id))
    if (allSelected) {
      onChange({ selectedProviderIds: data.selectedProviderIds.filter((id) => !allFilteredIds.includes(id)) })
    } else {
      const combined = Array.from(new Set([...data.selectedProviderIds, ...allFilteredIds]))
      onChange({ selectedProviderIds: combined })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-brand p-2 rounded-lg">
          <Handshake className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Prestadores de Serviço</h2>
          <p className="text-sm text-muted-foreground">
            Copie prestadores de outra unidade para agilizar o início das operações.
          </p>
        </div>
      </div>

      {/* Opção: copiar ou não */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ copyFrom: true })}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all',
            data.copyFrom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-primary/40 text-muted-foreground',
          )}
        >
          <Handshake className="w-6 h-6" />
          Copiar de outra unidade
        </button>
        <button
          type="button"
          onClick={() => onChange({ copyFrom: false, sourceUnitId: null, selectedProviderIds: [] })}
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all',
            !data.copyFrom
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:border-primary/40 text-muted-foreground',
          )}
        >
          <Search className="w-6 h-6" />
          Configurar depois
        </button>
      </div>

      {data.copyFrom && (
        <div className="space-y-4 animate-fade-up">
          {/* Selecionar unidade de origem */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Unidade de origem <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {sourceUnits.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => onChange({ sourceUnitId: unit.id, selectedProviderIds: [] })}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                    data.sourceUnitId === unit.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    data.sourceUnitId === unit.id ? 'border-primary' : 'border-border',
                  )}>
                    {data.sourceUnitId === unit.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm font-medium text-foreground">{unit.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de prestadores */}
          {data.sourceUnitId && (
            <div className="space-y-3">
              {/* Busca + selecionar todos */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar prestador..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {filtered.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline shrink-0"
                  >
                    {filtered.every((p) => isSelected(p.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
              </div>

              {/* Contador */}
              {data.selectedProviderIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {data.selectedProviderIds.length} prestador(es) selecionado(s)
                </p>
              )}

              {loadingProviders ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando prestadores...
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {search ? 'Nenhum prestador encontrado.' : 'Esta unidade não tem prestadores ativos.'}
                    </p>
                  )}
                  {filtered.map((provider) => {
                    const selected = isSelected(provider.id)
                    const primaryContact = (provider.provider_contacts as unknown as Array<{ type: string; value: string; is_primary: boolean }>)
                      ?.find((c) => c.is_primary) ?? null

                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => toggleProvider(provider.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                          selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                        )}
                        aria-pressed={selected}
                      >
                        {/* Checkbox visual */}
                        <div className={cn(
                          'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                          selected ? 'bg-primary border-primary' : 'border-border',
                        )}>
                          {selected && (
                            <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{provider.name}</span>
                            {provider.avg_rating > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                                <Star className="w-3 h-3 fill-current" />
                                {provider.avg_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                          {primaryContact && (
                            <p className="text-xs text-muted-foreground truncate">{primaryContact.value}</p>
                          )}
                          {provider.tags?.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">{provider.tags.slice(0, 2).join(', ')}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!data.copyFrom && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>
            Você poderá cadastrar prestadores em <strong>Prestadores → Novo</strong> após o setup.
          </p>
        </div>
      )}

      {/* Aviso sobre cópia */}
      {data.copyFrom && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
          <p>
            Cada prestador copiado cria um registro independente nesta unidade — alterações futuras
            não são sincronizadas automaticamente entre as unidades.
          </p>
        </div>
      )}
    </div>
  )
}
