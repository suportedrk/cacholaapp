import { Wrench } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/placeholder-page'

export default function ManutencaoPage() {
  return (
    <PlaceholderPage
      icon={Wrench}
      title="Manutenção"
      description="Registre ordens de serviço, acompanhe manutenções preventivas e corretivas com fotos antes/depois."
      phase="Fase 1"
    />
  )
}
