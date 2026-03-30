'use client'

import { ProviderForm } from '../components/ProviderForm'

export default function NovoPrestadorPage() {
  return (
    <div className="max-w-3xl space-y-0">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-foreground">Novo Prestador</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Preencha as informações em 4 etapas simples
        </p>
      </div>
      <ProviderForm />
    </div>
  )
}
