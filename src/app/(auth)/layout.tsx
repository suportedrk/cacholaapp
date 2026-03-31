import { Providers } from '@/lib/providers'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard } from '@/components/layout/auth-guard'
import { AppReadyGate } from '@/components/app-ready-gate'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGuard>
        <AppReadyGate>
          <AppLayout>{children}</AppLayout>
        </AppReadyGate>
      </AuthGuard>
    </Providers>
  )
}
