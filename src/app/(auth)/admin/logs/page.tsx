import { ScrollText } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/placeholder-page'

export default function LogsPage() {
  return (
    <PlaceholderPage
      icon={ScrollText}
      title="Logs de Auditoria"
      description="Acompanhe todas as ações realizadas no sistema: criações, edições, exclusões e acessos."
      phase="Fase 1"
    />
  )
}
