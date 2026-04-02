// /admin/unidades/setup — Wizard de setup para nova unidade
// Cria a unidade no banco e redireciona para /admin/unidades/[id]/setup

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Step1Dados, type Step1Data } from './components/steps/Step1Dados'

const supabase = createClient()

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function NovaUnidadeSetupPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [data, setData] = useState<Step1Data>({
    name: '',
    slug: '',
    address: '',
    phone: '',
  })

  function isValid() {
    return data.name.trim().length >= 2 && data.slug.trim().length >= 2
  }

  async function handleCreate() {
    if (!isValid()) {
      toast.error('Preencha o nome e o slug da unidade.')
      return
    }
    setCreating(true)
    try {
      const { data: newUnit, error } = await supabase
        .from('units')
        .insert({
          name: data.name.trim(),
          slug: data.slug.trim(),
          address: data.address.trim() || null,
          phone: data.phone.trim() || null,
          is_active: true,
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') {
          toast.error('Já existe uma unidade com esse slug. Escolha um diferente.')
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success('Unidade criada! Continuando o setup...')
      router.push(`/admin/unidades/${newUnit.id}/setup`)
    } catch {
      toast.error('Erro ao criar unidade.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/unidades"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Unidades
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Nova Unidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados básicos para criar a unidade e iniciar o wizard de configuração.
        </p>
      </div>

      {/* Card de formulário */}
      <div className="card rounded-xl p-4 sm:p-6">
        <Step1Dados
          data={data}
          onChange={(d) => setData((prev) => ({ ...prev, ...d }))}
          isEditing={false}
        />
      </div>

      {/* Ação */}
      <div className="flex justify-end">
        <Button
          onClick={handleCreate}
          disabled={!isValid() || creating}
          className="min-w-[180px]"
        >
          {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {creating ? 'Criando...' : 'Criar e configurar →'}
        </Button>
      </div>
    </div>
  )
}
