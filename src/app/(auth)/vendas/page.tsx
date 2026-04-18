'use client'

import { useState } from 'react'
import { TrendingUp, AlertCircle, Construction } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { hasRole } from '@/config/roles'
import { VENDAS_MANAGE_ROLES } from '@/config/roles'

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <Construction className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">{label} — Em construção</p>
      <p className="text-xs">Disponível na próxima fase de desenvolvimento.</p>
    </div>
  )
}

export default function VendasPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('meu-painel')

  const isVendedora = profile?.role === 'vendedora'
  const isManager   = hasRole(profile?.role, VENDAS_MANAGE_ROLES)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="icon-brand rounded-lg p-2">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
          <p className="text-sm text-muted-foreground">
            Painel de acompanhamento de vendas e relacionamento com clientes
          </p>
        </div>
      </div>

      {/* Alerta: vendedora sem seller_id vinculado */}
      {isVendedora && !profile?.seller_id && (
        <div className="flex items-start gap-3 rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-text">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Sua conta ainda não foi vinculada a uma vendedora. Entre em contato com a administração.
          </span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList variant="line" className="mb-0">
          <TabsTrigger value="meu-painel">Meu Painel</TabsTrigger>
          <TabsTrigger value="upsell">Upsell</TabsTrigger>
          <TabsTrigger value="recompra">Recompra</TabsTrigger>
        </TabsList>

        <TabsContent value="meu-painel" className="mt-6">
          {isVendedora && !profile?.seller_id ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <AlertCircle className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">Conta não vinculada</p>
              <p className="text-xs text-center max-w-xs">
                Para acessar seu painel, peça ao administrador para vincular seu usuário a uma vendedora.
              </p>
            </div>
          ) : isManager ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Construction className="w-10 h-10 opacity-40" />
              <p className="text-sm font-medium">Meu Painel — Em construção</p>
              <p className="text-xs text-center max-w-xs">
                A visão consolidada para gestores estará disponível na próxima fase.
                Use o módulo BI para acompanhar indicadores por vendedora.
              </p>
            </div>
          ) : (
            <PlaceholderTab label="Meu Painel" />
          )}
        </TabsContent>

        <TabsContent value="upsell" className="mt-6">
          <PlaceholderTab label="Upsell" />
        </TabsContent>

        <TabsContent value="recompra" className="mt-6">
          <PlaceholderTab label="Recompra" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
