import { Providers } from '@/lib/providers'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthGuard } from '@/components/layout/auth-guard'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AuthGuard>
        <AppLayout>{children}</AppLayout>
      </AuthGuard>
    </Providers>
  )
}
