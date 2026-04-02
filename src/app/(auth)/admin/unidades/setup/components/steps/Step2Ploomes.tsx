'use client'

import { useState } from 'react'
import { Link2, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Step2Data {
  ploomesUnitName: string    // Ex: "Cachola MOEMA"
  ploomesObjectId: string    // Ex: "609551206" (texto, converte para int na API)
}

interface Props {
  data: Step2Data
  onChange: (data: Partial<Step2Data>) => void
  existingValue: string | null  // valor já mapeado no banco
}

interface TestResult {
  deals: number
  error?: string
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function Step2Ploomes({ data, onChange, existingValue }: Props) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  async function handleTest() {
    if (!data.ploomesUnitName.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      // Buscar deals via proxy do Ploomes para validar o valor
      const res = await fetch(
        `/api/ploomes/deals?unitName=${encodeURIComponent(data.ploomesUnitName.trim())}&top=1`
      )
      if (!res.ok) {
        setTestResult({ deals: 0, error: 'Falha ao conectar com o Ploomes.' })
        return
      }
      const json = await res.json()
      // A rota retorna total de deals — fallback para contagem do array
      const count = json.total ?? (Array.isArray(json.deals) ? json.deals.length : 0)
      setTestResult({ deals: count })
    } catch {
      setTestResult({ deals: 0, error: 'Erro de conexão.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="icon-brand p-2 rounded-lg">
          <Link2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Integração Ploomes</h2>
          <p className="text-sm text-muted-foreground">
            Configure como esta unidade é identificada no CRM Ploomes.
          </p>
        </div>
      </div>

      {/* Já mapeado */}
      {existingValue && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">Mapeamento existente</p>
            <p className="text-sm text-green-700 dark:text-green-400 mt-0.5">
              Esta unidade já está mapeada como <strong>&ldquo;{existingValue}&rdquo;</strong> no Ploomes.
              Altere abaixo apenas se necessário.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {/* Nome no Ploomes */}
        <div className="space-y-2">
          <Label htmlFor="ploomes-unit-name">
            Nome da unidade no Ploomes{' '}
            <span className="text-muted-foreground text-xs font-normal">(campo &ldquo;Unidade Escolhida&rdquo;)</span>
          </Label>
          <Input
            id="ploomes-unit-name"
            placeholder='Ex: Cachola MOEMA'
            value={data.ploomesUnitName}
            onChange={(e) => {
              onChange({ ploomesUnitName: e.target.value })
              setTestResult(null)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Copie exatamente como aparece no campo &ldquo;Unidade Escolhida&rdquo; nos negócios do Ploomes.
            Distinção de maiúsculas/minúsculas é respeitada.
          </p>
        </div>

        {/* ObjectValueId (opcional) */}
        <div className="space-y-2">
          <Label htmlFor="ploomes-object-id">
            ObjectValueId{' '}
            <span className="text-muted-foreground text-xs font-normal">(opcional — backup para futuras integrações)</span>
          </Label>
          <Input
            id="ploomes-object-id"
            placeholder="Ex: 609551206"
            value={data.ploomesObjectId}
            onChange={(e) => onChange({ ploomesObjectId: e.target.value.replace(/\D/g, '') })}
            inputMode="numeric"
          />
        </div>

        {/* Testar conexão */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={!data.ploomesUnitName.trim() || testing}
          >
            {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {testing ? 'Testando...' : 'Testar conexão'}
          </Button>

          {testResult && !testResult.error && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {testResult.deals > 0
                  ? `${testResult.deals} deal(s) encontrado(s) com este valor`
                  : 'Nenhum deal encontrado — verifique o nome'}
              </span>
            </div>
          )}

          {testResult?.error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span>{testResult.error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Como funciona */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">Como funciona</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Cada negócio no Ploomes tem um campo &ldquo;Unidade Escolhida&rdquo;</li>
          <li>O sync lê o valor desse campo e associa ao Cachola OS usando esta tabela de mapeamento</li>
          <li>Se não houver mapeamento, o deal vai para a primeira unidade ativa (fallback)</li>
        </ul>
        <a
          href="/configuracoes/integracoes/ploomes"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
        >
          Ver configuração do Ploomes
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Pular */}
      <p className="text-xs text-muted-foreground">
        Se esta unidade não usa o Ploomes, pode pular esta etapa.
      </p>
    </div>
  )
}
