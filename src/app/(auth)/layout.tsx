import { Providers } from '@/lib/providers'
import { AppLayout } from '@/components/layout/app-layout'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppLayout>{children}</AppLayout>
    </Providers>
  )
}
