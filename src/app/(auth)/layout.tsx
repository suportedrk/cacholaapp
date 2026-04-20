import { Providers } from '@/lib/providers'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard } from '@/components/layout/auth-guard'
import { AppReadyGate } from '@/components/app-ready-gate'
import { ServiceWorkerUpdater } from '@/components/pwa/service-worker-updater'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      {/* Detecta novos deploys e exibe toast de atualização — deve ficar
          dentro de <Providers> para ter acesso ao <Toaster> do Sonner. */}
      <ServiceWorkerUpdater />
      <AuthGuard>
        <AppReadyGate>
          <AppLayout>{children}</AppLayout>
        </AppReadyGate>
      </AuthGuard>
    </Providers>
  )
}
