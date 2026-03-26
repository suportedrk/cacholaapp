import type { Metadata } from 'next'
import { LayoutDashboard } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral das operações do Cachola
        </p>
      </div>

      {/* Empty state — conteúdo será implementado nas próximas fases */}
      <div className="flex flex-col items-center justify-center min-h-[400px] rounded-2xl border-2 border-dashed border-border bg-card">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <LayoutDashboard className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-base font-medium text-foreground">Dashboard em construção</h2>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-xs">
          Os módulos de eventos, manutenção e checklists serão adicionados nas próximas fases.
        </p>
      </div>
    </div>
  )
}
